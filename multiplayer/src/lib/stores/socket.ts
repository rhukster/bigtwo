import { writable, get } from 'svelte/store';
import { io, type Socket } from 'socket.io-client';
import type { User, LobbyState, Room, ChatMessage, ClientGameState } from '../game/types.js';

// User store
export const user = writable<User | null>(null);

// Socket connection
let socket: Socket | null = null;

export const connected = writable(false);
export const lobbyState = writable<LobbyState>({ users: [], rooms: [] });
export const currentRoom = writable<Room | null>(null);
export const gameState = writable<ClientGameState | null>(null);
export const lobbyMessages = writable<ChatMessage[]>([]);
export const roomMessages = writable<ChatMessage[]>([]);
export const readyCountdowns = writable<Record<string, number>>({});  // playerId -> seconds left

// Turn timer
export const turnTimer = writable<{ playerId: string; timeLeft: number } | null>(null);
let turnTimerInterval: ReturnType<typeof setInterval> | null = null;

function startClientTurnTimer(playerId: string, timeLimit: number) {
  // Clear any existing timer
  if (turnTimerInterval) {
    clearInterval(turnTimerInterval);
  }

  turnTimer.set({ playerId, timeLeft: timeLimit });

  turnTimerInterval = setInterval(() => {
    turnTimer.update(t => {
      if (!t || t.timeLeft <= 0) {
        if (turnTimerInterval) {
          clearInterval(turnTimerInterval);
          turnTimerInterval = null;
        }
        return null;
      }
      return { ...t, timeLeft: t.timeLeft - 1 };
    });
  }, 1000);
}

function clearClientTurnTimer() {
  if (turnTimerInterval) {
    clearInterval(turnTimerInterval);
    turnTimerInterval = null;
  }
  turnTimer.set(null);
}

// Private messages: key is the other user's ID
export interface PMMessage extends ChatMessage {
  recipientId: string;
  recipientName: string;
}
export const privateMessages = writable<Record<string, PMMessage[]>>({});  // otherUserId -> messages
export const unreadPMs = writable<Set<string>>(new Set());  // Set of user IDs with unread messages
export const activePMUser = writable<{ id: string; name: string } | null>(null);  // Currently open PM chat

// Game end result
export interface GameEndResult {
  winnerId: string;
  winnerName: string;
  results: Array<{
    playerId: string;
    playerName: string;
    cardsRemaining: number;
    pointsDelta: number;
  }>;
}
export const gameEndResult = writable<GameEndResult | null>(null);

// Unread room messages count
export const unreadRoomMessages = writable<number>(0);
export const roomChatOpen = writable<boolean>(false);

// Unread lobby messages count (for when in game)
export const unreadLobbyMessages = writable<number>(0);
export const lobbyChatOpen = writable<boolean>(false);

// Game invites received
export interface GameInvite {
  roomId: string;
  roomCode: string;
  roomName: string;
  inviterId: string;
  inviterName: string;
  playerCount: number;
  maxPlayers: number;
  receivedAt: number;
}
export const pendingInvites = writable<GameInvite[]>([]);

export function connectSocket(currentUser: User) {
  // Prevent multiple socket connections - check if socket exists at all
  if (socket) {
    console.log('[Socket] Already exists, skipping connection');
    return;
  }

  console.log('[Socket] Creating new connection for', currentUser.username);

  socket = io({
    transports: ['websocket', 'polling']
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected');
    connected.set(true);

    // Join lobby
    socket?.emit('lobby:join', {
      userId: currentUser.id,
      userName: currentUser.username,
      isGuest: currentUser.isGuest
    });

    // Fetch lobby chat history
    socket?.emit('chat:get_lobby_history', (messages: ChatMessage[]) => {
      if (messages && messages.length > 0) {
        lobbyMessages.set(messages);
      }
    });
  });

  socket.on('disconnect', () => {
    console.log('[Socket] Disconnected');
    connected.set(false);
  });

  // Lobby events
  socket.on('lobby:state', (state: LobbyState) => {
    lobbyState.set(state);
  });

  socket.on('lobby:user_joined', (newUser: { id: string; name: string; status: string }) => {
    lobbyState.update(s => {
      // Don't add if user already exists
      if (s.users.some(u => u.id === newUser.id)) {
        return s;
      }
      return {
        ...s,
        users: [...s.users, { id: newUser.id, name: newUser.name, status: newUser.status as 'online' | 'in-game' }]
      };
    });
  });

  socket.on('lobby:user_left', ({ userId }: { userId: string }) => {
    lobbyState.update(s => ({
      ...s,
      users: s.users.filter(u => u.id !== userId)
    }));
  });

  socket.on('lobby:room_created', (room: Room) => {
    lobbyState.update(s => {
      // Don't add if room already exists
      if (s.rooms.some(r => r.id === room.id)) {
        return s;
      }
      return {
        ...s,
        rooms: [...s.rooms, room]
      };
    });
  });

  socket.on('lobby:room_updated', (room: Room) => {
    lobbyState.update(s => ({
      ...s,
      rooms: s.rooms.map(r => r.id === room.id ? room : r)
    }));
  });

  socket.on('lobby:room_deleted', ({ roomId }: { roomId: string }) => {
    lobbyState.update(s => ({
      ...s,
      rooms: s.rooms.filter(r => r.id !== roomId)
    }));
  });

  // Room events
  socket.on('room:created', (room: Room) => {
    currentRoom.set(room);
  });

  socket.on('room:joined', ({ room }: { room: Room }) => {
    currentRoom.set(room);

    // Fetch room chat history
    socket?.emit('chat:get_room_history', { roomId: room.id }, (messages: ChatMessage[]) => {
      if (messages && messages.length > 0) {
        roomMessages.set(messages);
      }
    });
  });

  socket.on('room:updated', (room: Room) => {
    currentRoom.set(room);

    // If room went back to waiting status (e.g., after rematch), clear game state
    if (room.status === 'waiting') {
      gameState.set(null);
      gameEndResult.set(null);
    }
  });

  socket.on('room:left', () => {
    console.log('[Socket] room:left received, clearing state');
    currentRoom.set(null);
    gameState.set(null);
    readyCountdowns.set({});
  });

  socket.on('room:player_joined', ({ id, name }: { id: string; name: string }) => {
    currentRoom.update(r => {
      if (!r) return r;
      // Don't add if player already exists
      if (r.players.some(p => p.id === id)) {
        return r;
      }
      return {
        ...r,
        players: [...r.players, { id, name, isReady: false, isHost: false, isAi: false, isGuest: true }]
      };
    });
  });

  socket.on('room:player_left', ({ playerId }: { playerId: string }) => {
    currentRoom.update(r => {
      if (!r) return r;
      return {
        ...r,
        players: r.players.filter(p => p.id !== playerId)
      };
    });
    // Clear countdown for left player
    readyCountdowns.update(c => {
      const newC = { ...c };
      delete newC[playerId];
      return newC;
    });
  });

  socket.on('room:ready_countdown', ({ playerId, timeLeft }: { playerId: string; timeLeft: number }) => {
    readyCountdowns.update(c => ({
      ...c,
      [playerId]: timeLeft
    }));
  });

  // Game events
  socket.on('game:started', () => {
    console.log('[Game] Started');
    readyCountdowns.set({});  // Clear all countdowns when game starts
  });

  socket.on('game:state', (state: ClientGameState) => {
    console.log('[Socket] game:state received', {
      currentPlayer: state.currentPlayer,
      handLength: state.hand?.length,
      currentPlay: state.currentPlay,
      isFirstPlay: state.isFirstPlay,
      controlPlayer: state.controlPlayer
    });
    gameState.set(state);
  });

  socket.on('game:play_made', (data: any) => {
    console.log('[Game] Play made:', data);
    clearClientTurnTimer();
  });

  socket.on('game:pass_made', (data: any) => {
    console.log('[Game] Pass:', data);
    clearClientTurnTimer();
  });

  socket.on('game:end', (data: GameEndResult) => {
    console.log('[Game] End:', data);
    clearClientTurnTimer();
    gameEndResult.set(data);
  });

  // Turn timer events
  socket.on('game:timer_start', (data: { playerId: string; timeLimit: number }) => {
    console.log('[Game] Timer start:', data);
    startClientTurnTimer(data.playerId, data.timeLimit);
  });

  socket.on('game:auto_pass', (data: { playerId: string; playerName: string; reason: string }) => {
    console.log('[Game] Auto-pass:', data);
    clearClientTurnTimer();
  });

  socket.on('game:auto_play', (data: { playerId: string; playerName: string; reason: string }) => {
    console.log('[Game] Auto-play:', data);
    clearClientTurnTimer();
  });

  // Rematch - reset to room view
  socket.on('game:rematch_ready', (data: { requestedBy: string }) => {
    console.log('[Game] Rematch ready, requested by:', data.requestedBy);
    gameState.set(null);
    gameEndResult.set(null);
    readyCountdowns.set({});
  });

  // Chat events
  socket.on('chat:lobby_message', (message: ChatMessage) => {
    lobbyMessages.update(msgs => {
      // Don't add if message already exists
      if (msgs.some(m => m.id === message.id)) {
        return msgs;
      }
      return [...msgs, message];
    });
    // Increment unread if lobby chat is closed and message is from someone else
    if (!get(lobbyChatOpen) && message.senderId !== currentUser.id) {
      unreadLobbyMessages.update(n => n + 1);
    }
  });

  socket.on('chat:room_message', (message: ChatMessage) => {
    roomMessages.update(msgs => {
      // Don't add if message already exists
      if (msgs.some(m => m.id === message.id)) {
        return msgs;
      }
      return [...msgs, message];
    });
    // Increment unread if chat is closed and message is from someone else
    if (!get(roomChatOpen) && message.senderId !== currentUser.id) {
      unreadRoomMessages.update(n => n + 1);
    }
  });

  // PM events
  socket.on('chat:pm_received', (message: PMMessage) => {
    const senderId = message.senderId;
    privateMessages.update(pms => {
      const existing = pms[senderId] || [];
      // Don't add if message already exists
      if (existing.some(m => m.id === message.id)) {
        return pms;
      }
      return { ...pms, [senderId]: [...existing, message] };
    });

    // Mark as unread if PM chat isn't open for this user
    const currentActivePM = get(activePMUser);
    if (!currentActivePM || currentActivePM.id !== senderId) {
      unreadPMs.update(set => {
        const newSet = new Set(set);
        newSet.add(senderId);
        return newSet;
      });
    }
  });

  socket.on('chat:pm_sent', (message: PMMessage) => {
    const recipientId = message.recipientId;
    privateMessages.update(pms => {
      const existing = pms[recipientId] || [];
      // Don't add if message already exists
      if (existing.some(m => m.id === message.id)) {
        return pms;
      }
      return { ...pms, [recipientId]: [...existing, message] };
    });
  });

  // Invite events
  socket.on('room:invite_received', (invite: Omit<GameInvite, 'receivedAt'>) => {
    console.log('[Socket] Invite received:', invite);
    pendingInvites.update(invites => {
      // Don't add duplicate invites from same room
      if (invites.some(i => i.roomId === invite.roomId)) {
        return invites;
      }
      return [...invites, { ...invite, receivedAt: Date.now() }];
    });
  });

  // Error handling
  socket.on('error', ({ message }: { message: string }) => {
    console.error('[Socket] Error:', message);
    alert(message);
  });
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  connected.set(false);
  // Clear all state to prevent stale data on reconnect
  lobbyState.set({ users: [], rooms: [] });
  currentRoom.set(null);
  gameState.set(null);
  lobbyMessages.set([]);
  roomMessages.set([]);
  readyCountdowns.set({});
  privateMessages.set({});
  unreadPMs.set(new Set());
  activePMUser.set(null);
  gameEndResult.set(null);
  unreadRoomMessages.set(0);
  roomChatOpen.set(false);
}

// Socket actions
export function createRoom(name: string, settings: Room['settings']) {
  socket?.emit('room:create', { name, settings });
}

export function joinRoom(roomId?: string, roomCode?: string) {
  socket?.emit('room:join', { roomId, roomCode });
}

export function leaveRoom() {
  socket?.emit('room:leave');
  currentRoom.set(null);
  gameState.set(null);
  roomMessages.set([]);
  gameEndResult.set(null);
  unreadRoomMessages.set(0);
  roomChatOpen.set(false);
}

export function setRoomChatOpen(open: boolean) {
  roomChatOpen.set(open);
  if (open) {
    unreadRoomMessages.set(0);
  }
}

export function setLobbyChatOpen(open: boolean) {
  lobbyChatOpen.set(open);
  if (open) {
    unreadLobbyMessages.set(0);
  }
}

export function clearGameEndResult() {
  gameEndResult.set(null);
}

export function toggleReady(roomId: string, ready: boolean) {
  socket?.emit('room:ready', { roomId, ready });
}

export function addAi(roomId: string) {
  socket?.emit('room:add_ai', { roomId });
}

export function removeAi(roomId: string, aiId: string) {
  socket?.emit('room:remove_ai', { roomId, aiId });
}

export function startGame(roomId: string) {
  socket?.emit('room:start', { roomId });
}

export function playCards(roomId: string, cards: any[]) {
  console.log('[Socket] playCards called', { roomId, cards, socketConnected: socket?.connected });
  if (!socket) {
    console.error('[Socket] No socket connection!');
    return;
  }
  if (!socket.connected) {
    console.error('[Socket] Socket not connected!');
    return;
  }
  socket.emit('game:play', { roomId, cards });
  console.log('[Socket] game:play emitted');
}

export function passTurn(roomId: string) {
  socket?.emit('game:pass', { roomId });
}

export function leaveGame(roomId: string) {
  console.log('[Socket] leaveGame called, roomId:', roomId, 'socket connected:', socket?.connected);
  socket?.emit('game:leave', { roomId });
}

export function requestRematch(roomId: string) {
  console.log('[Socket] requestRematch called, roomId:', roomId);
  socket?.emit('game:rematch', { roomId });
}

export function sendLobbyMessage(content: string) {
  socket?.emit('chat:lobby', { content });
}

export function sendRoomMessage(roomId: string, content: string) {
  socket?.emit('chat:room', { roomId, content });
}

export function sendPM(recipientId: string, content: string) {
  socket?.emit('chat:pm', { recipientId, content });
}

export function openPMChat(userId: string, userName: string) {
  activePMUser.set({ id: userId, name: userName });
  // Clear unread for this user
  unreadPMs.update(set => {
    const newSet = new Set(set);
    newSet.delete(userId);
    return newSet;
  });
}

export function closePMChat() {
  activePMUser.set(null);
}

// DEBUG: Cheat code to fast-forward to near-win
export function cheatNearWin(roomId: string) {
  socket?.emit('game:cheat_nearwin', { roomId });
}

// Send game invite to a user
export function sendInvite(roomId: string, targetUserId: string) {
  socket?.emit('room:invite', { roomId, targetUserId });
}

// Dismiss a pending invite
export function dismissInvite(roomId: string) {
  pendingInvites.update(invites => invites.filter(i => i.roomId !== roomId));
}

// Accept an invite (just joins the room)
export function acceptInvite(roomId: string) {
  joinRoom(roomId);
  dismissInvite(roomId);
}
