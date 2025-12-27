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
  });

  // Game events
  socket.on('game:started', () => {
    console.log('[Game] Started');
  });

  socket.on('game:state', (state: ClientGameState) => {
    gameState.set(state);
  });

  socket.on('game:play_made', (data: any) => {
    console.log('[Game] Play made:', data);
  });

  socket.on('game:pass_made', (data: any) => {
    console.log('[Game] Pass:', data);
  });

  socket.on('game:end', (data: any) => {
    console.log('[Game] End:', data);
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
  socket?.emit('game:play', { roomId, cards });
}

export function passTurn(roomId: string) {
  socket?.emit('game:pass', { roomId });
}

export function sendLobbyMessage(content: string) {
  socket?.emit('chat:lobby', { content });
}

export function sendRoomMessage(roomId: string, content: string) {
  socket?.emit('chat:room', { roomId, content });
}
