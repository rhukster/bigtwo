import type { Server, Socket } from 'socket.io';
import { nanoid } from 'nanoid';

interface LobbyUser {
  id: string;
  name: string;
  socketId: string;
  status: 'online' | 'in-game';
  isGuest: boolean;
}

interface GameRoom {
  id: string;
  code: string;
  name: string;
  hostId: string;
  hostName: string;
  settings: {
    maxPlayers: 2 | 3 | 4;
    allowSpectators: boolean;
    fillWithAi: boolean;
    aiDifficulty: 'easy' | 'medium' | 'hard';
    isPrivate: boolean;
    turnTimeLimit: number | null;
  };
  players: Array<{
    id: string;
    name: string;
    isReady: boolean;
    isHost: boolean;
    isAi: boolean;
    isGuest: boolean;
    socketId?: string;
    joinedAt: number;
  }>;
  spectators: Array<{
    id: string;
    name: string;
    socketId: string;
  }>;
  status: 'waiting' | 'playing' | 'finished';
  gameId: string | null;
  createdAt: Date;
}

// Auto-ready timer (30 seconds)
const AUTO_READY_TIMEOUT = 30000;
const readyTimers = new Map<string, NodeJS.Timeout>();  // key: `${roomId}:${playerId}`

function startAutoReadyTimer(io: Server, roomId: string, playerId: string, gameRooms: Map<string, GameRoom>) {
  const timerKey = `${roomId}:${playerId}`;

  // Clear existing timer if any
  if (readyTimers.has(timerKey)) {
    clearInterval(readyTimers.get(timerKey)!);
  }

  let timeLeft = 30;

  const timer = setInterval(() => {
    const room = gameRooms.get(roomId);
    if (!room || room.status !== 'waiting') {
      clearInterval(timer);
      readyTimers.delete(timerKey);
      return;
    }

    const player = room.players.find(p => p.id === playerId);
    if (!player || player.isReady || player.isHost) {
      clearInterval(timer);
      readyTimers.delete(timerKey);
      return;
    }

    timeLeft--;

    // Emit countdown update
    io.to(roomId).emit('room:ready_countdown', {
      playerId,
      timeLeft
    });

    if (timeLeft <= 0) {
      // Auto-ready the player
      player.isReady = true;
      clearInterval(timer);
      readyTimers.delete(timerKey);

      io.to(roomId).emit('room:updated', room);
      io.emit('lobby:room_updated', room);
      console.log(`[Room] ${player.name} was auto-readied in room ${room.code}`);
    }
  }, 1000);

  readyTimers.set(timerKey, timer);
}

function clearAutoReadyTimer(roomId: string, playerId: string) {
  const timerKey = `${roomId}:${playerId}`;
  if (readyTimers.has(timerKey)) {
    clearInterval(readyTimers.get(timerKey)!);
    readyTimers.delete(timerKey);
  }
}

interface SharedState {
  lobbyUsers: Map<string, LobbyUser>;
  gameRooms: Map<string, GameRoom>;
  socketToUser: Map<string, string>;
  generateRoomCode: () => string;
}

export function setupLobbyHandlers(io: Server, socket: Socket, state: SharedState) {
  const { lobbyUsers, gameRooms, socketToUser, generateRoomCode } = state;

  // Join lobby
  socket.on('lobby:join', (data: { userId: string; userName: string; isGuest: boolean }) => {
    const { userId, userName, isGuest } = data;

    // Check if user already exists (reconnecting)
    const existingUser = lobbyUsers.get(userId);
    const isNewUser = !existingUser;

    const user: LobbyUser = {
      id: userId,
      name: userName,
      socketId: socket.id,
      status: 'online',
      isGuest
    };

    lobbyUsers.set(userId, user);
    socketToUser.set(socket.id, userId);

    // Send current lobby state
    socket.emit('lobby:state', {
      users: Array.from(lobbyUsers.values()).map(u => ({
        id: u.id,
        name: u.name,
        status: u.status
      })),
      rooms: Array.from(gameRooms.values()).filter(r => !r.settings.isPrivate)
    });

    // Only broadcast new user to others if they're actually new (not reconnecting)
    if (isNewUser) {
      socket.broadcast.emit('lobby:user_joined', {
        id: userId,
        name: userName,
        status: 'online'
      });
      console.log(`[Lobby] ${userName} joined the lobby`);
    } else {
      console.log(`[Lobby] ${userName} reconnected`);
    }
  });

  // Leave lobby
  socket.on('lobby:leave', () => {
    const userId = socketToUser.get(socket.id);
    if (userId) {
      const user = lobbyUsers.get(userId);
      if (user) {
        socket.broadcast.emit('lobby:user_left', { userId, userName: user.name });
        lobbyUsers.delete(userId);
      }
      socketToUser.delete(socket.id);
    }
  });

  // Create room
  socket.on('room:create', (data: {
    name: string;
    settings: GameRoom['settings'];
  }) => {
    const userId = socketToUser.get(socket.id);
    if (!userId) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    const user = lobbyUsers.get(userId);
    if (!user) {
      socket.emit('error', { message: 'User not found' });
      return;
    }

    // Generate unique room code
    let code = generateRoomCode();
    while (Array.from(gameRooms.values()).some(r => r.code === code)) {
      code = generateRoomCode();
    }

    const room: GameRoom = {
      id: nanoid(),
      code,
      name: data.name || `${user.name}'s Game`,
      hostId: userId,
      hostName: user.name,
      settings: data.settings,
      players: [{
        id: userId,
        name: user.name,
        isReady: true,  // Host is always ready (they control when to start)
        isHost: true,
        isAi: false,
        isGuest: user.isGuest,
        socketId: socket.id,
        joinedAt: Date.now()
      }],
      spectators: [],
      status: 'waiting',
      gameId: null,
      createdAt: new Date()
    };

    gameRooms.set(room.id, room);
    socket.join(room.id);

    // Update user status
    user.status = 'in-game';

    socket.emit('room:created', room);

    // Broadcast new room to lobby (if public)
    if (!room.settings.isPrivate) {
      io.emit('lobby:room_created', room);
    }

    console.log(`[Room] ${user.name} created room ${room.code}`);
  });

  // Join room
  socket.on('room:join', (data: { roomId?: string; roomCode?: string }) => {
    const userId = socketToUser.get(socket.id);
    if (!userId) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    const user = lobbyUsers.get(userId);
    if (!user) {
      socket.emit('error', { message: 'User not found' });
      return;
    }

    // Find room by ID or code
    let room: GameRoom | undefined;
    if (data.roomId) {
      room = gameRooms.get(data.roomId);
    } else if (data.roomCode) {
      room = Array.from(gameRooms.values()).find(r => r.code === data.roomCode);
    }

    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    if (room.status !== 'waiting') {
      socket.emit('error', { message: 'Game already in progress' });
      return;
    }

    if (room.players.length >= room.settings.maxPlayers) {
      if (room.settings.allowSpectators) {
        // Join as spectator
        room.spectators.push({
          id: userId,
          name: user.name,
          socketId: socket.id
        });
        socket.join(room.id);
        user.status = 'in-game';
        socket.emit('room:joined', { room, asSpectator: true });
        io.to(room.id).emit('room:spectator_joined', { id: userId, name: user.name });
        return;
      }
      socket.emit('error', { message: 'Room is full' });
      return;
    }

    // Check if user is already in room
    if (room.players.some(p => p.id === userId)) {
      socket.emit('error', { message: 'Already in room' });
      return;
    }

    // Add player to room
    room.players.push({
      id: userId,
      name: user.name,
      isReady: false,
      isHost: false,
      isAi: false,
      isGuest: user.isGuest,
      socketId: socket.id,
      joinedAt: Date.now()
    });

    socket.join(room.id);
    user.status = 'in-game';

    socket.emit('room:joined', { room, asSpectator: false });
    socket.to(room.id).emit('room:player_joined', {
      id: userId,
      name: user.name
    });

    io.emit('lobby:room_updated', room);

    // Start auto-ready timer for this player
    startAutoReadyTimer(io, room.id, userId, gameRooms);

    console.log(`[Room] ${user.name} joined room ${room.code}`);
  });

  // Leave room
  socket.on('room:leave', () => {
    const userId = socketToUser.get(socket.id);
    if (!userId) return;

    const user = lobbyUsers.get(userId);

    for (const [roomId, room] of gameRooms) {
      const playerIndex = room.players.findIndex(p => p.id === userId);
      const spectatorIndex = room.spectators.findIndex(s => s.id === userId);

      if (playerIndex !== -1) {
        const player = room.players[playerIndex];
        room.players.splice(playerIndex, 1);

        // Clear auto-ready timer if exists
        clearAutoReadyTimer(roomId, userId);

        socket.leave(roomId);
        if (user) user.status = 'online';

        // Handle host leaving
        if (player.isHost && room.players.length > 0) {
          const humanPlayer = room.players.find(p => !p.isAi);
          if (humanPlayer) {
            humanPlayer.isHost = true;
            humanPlayer.isReady = true;  // Host is always ready
            room.hostId = humanPlayer.id;
            room.hostName = humanPlayer.name;
          }
        }

        // Delete empty rooms
        if (room.players.filter(p => !p.isAi).length === 0) {
          gameRooms.delete(roomId);
          io.emit('lobby:room_deleted', { roomId });
        } else {
          io.to(roomId).emit('room:player_left', { playerId: userId });
          io.to(roomId).emit('room:updated', room);
          io.emit('lobby:room_updated', room);
        }

        socket.emit('room:left');
        console.log(`[Room] ${user?.name || userId} left room ${room.code}`);
        return;
      }

      if (spectatorIndex !== -1) {
        room.spectators.splice(spectatorIndex, 1);
        socket.leave(roomId);
        if (user) user.status = 'online';
        io.to(roomId).emit('room:spectator_left', { spectatorId: userId });
        socket.emit('room:left');
        return;
      }
    }
  });

  // Toggle ready status
  socket.on('room:ready', (data: { roomId: string; ready: boolean }) => {
    const userId = socketToUser.get(socket.id);
    if (!userId) return;

    const room = gameRooms.get(data.roomId);
    if (!room) return;

    const player = room.players.find(p => p.id === userId);
    if (!player) return;

    // Host is always ready - ignore ready toggle for hosts
    if (player.isHost) return;

    player.isReady = data.ready;

    // Clear auto-ready timer if player manually readied
    if (data.ready) {
      clearAutoReadyTimer(room.id, userId);
    } else {
      // If player un-readied, start timer again
      startAutoReadyTimer(io, room.id, userId, gameRooms);
    }

    io.to(room.id).emit('room:updated', room);
    io.emit('lobby:room_updated', room);
  });

  // Add AI player
  socket.on('room:add_ai', (data: { roomId: string }) => {
    const userId = socketToUser.get(socket.id);
    if (!userId) return;

    const room = gameRooms.get(data.roomId);
    if (!room) return;

    // Only host can add AI
    if (room.hostId !== userId) {
      socket.emit('error', { message: 'Only host can add AI players' });
      return;
    }

    if (room.players.length >= room.settings.maxPlayers) {
      socket.emit('error', { message: 'Room is full' });
      return;
    }

    const aiNumber = room.players.filter(p => p.isAi).length + 1;
    room.players.push({
      id: `ai-${nanoid(8)}`,
      name: `CPU ${aiNumber}`,
      isReady: true,
      isHost: false,
      isAi: true,
      isGuest: false,
      joinedAt: Date.now()
    });

    io.to(room.id).emit('room:updated', room);
    io.emit('lobby:room_updated', room);
  });

  // Remove AI player
  socket.on('room:remove_ai', (data: { roomId: string; aiId: string }) => {
    const userId = socketToUser.get(socket.id);
    if (!userId) return;

    const room = gameRooms.get(data.roomId);
    if (!room) return;

    // Only host can remove AI
    if (room.hostId !== userId) {
      socket.emit('error', { message: 'Only host can remove AI players' });
      return;
    }

    const aiIndex = room.players.findIndex(p => p.id === data.aiId && p.isAi);
    if (aiIndex !== -1) {
      room.players.splice(aiIndex, 1);
      io.to(room.id).emit('room:updated', room);
      io.emit('lobby:room_updated', room);
    }
  });

  // Get invite link
  socket.on('room:get_invite', (data: { roomId: string }, callback: (code: string) => void) => {
    const room = gameRooms.get(data.roomId);
    if (room) {
      callback(room.code);
    }
  });

  // Update room settings (host only)
  socket.on('room:update_settings', (data: { roomId: string; settings: Partial<GameRoom['settings']> }) => {
    const userId = socketToUser.get(socket.id);
    if (!userId) return;

    const room = gameRooms.get(data.roomId);
    if (!room || room.hostId !== userId) {
      socket.emit('error', { message: 'Only host can update settings' });
      return;
    }

    room.settings = { ...room.settings, ...data.settings };
    io.to(room.id).emit('room:updated', room);
    io.emit('lobby:room_updated', room);
  });

  // Send game invite to another user
  socket.on('room:invite', (data: { roomId: string; targetUserId: string }) => {
    const userId = socketToUser.get(socket.id);
    if (!userId) return;

    const user = lobbyUsers.get(userId);
    if (!user) return;

    const room = gameRooms.get(data.roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    // Check if room is full
    if (room.players.length >= room.settings.maxPlayers) {
      socket.emit('error', { message: 'Room is full' });
      return;
    }

    // Check if game already started
    if (room.status !== 'waiting') {
      socket.emit('error', { message: 'Game already in progress' });
      return;
    }

    const targetUser = lobbyUsers.get(data.targetUserId);
    if (!targetUser) {
      socket.emit('error', { message: 'User not found or offline' });
      return;
    }

    // Send invite to target user
    io.to(targetUser.socketId).emit('room:invite_received', {
      roomId: room.id,
      roomCode: room.code,
      roomName: room.name,
      inviterId: userId,
      inviterName: user.name,
      playerCount: room.players.length,
      maxPlayers: room.settings.maxPlayers
    });

    console.log(`[Room] ${user.name} invited ${targetUser.name} to room ${room.code}`);
  });
}
