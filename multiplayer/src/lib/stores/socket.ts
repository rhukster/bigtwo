import { writable, get } from 'svelte/store';
import { io, Socket } from 'socket.io-client';
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
  });

  socket.on('room:updated', (room: Room) => {
    currentRoom.set(room);
  });

  socket.on('room:left', () => {
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
  });

  socket.on('game:pass_made', (data: any) => {
    console.log('[Game] Pass:', data);
  });

  socket.on('game:end', (data: GameEndResult) => {
    console.log('[Game] End:', data);
    gameEndResult.set(data);
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
  socket?.emit('game:leave', { roomId });
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
