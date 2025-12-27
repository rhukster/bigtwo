import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
config();

const __dirname = dirname(fileURLToPath(import.meta.url));

// Import routes
import authRoutes from './routes/auth.ts';

// Import socket handlers
import { setupLobbyHandlers } from './socket/lobby.ts';
import { setupGameHandlers } from './socket/game.ts';
import { setupChatHandlers } from './socket/chat.ts';

// Import database (initializes on import)
import './db/index.ts';

const app = express();
const httpServer = createServer(app);

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const PORT = parseInt(process.env.PORT || '3001');
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-in-production';

// Socket.io setup
const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: CLIENT_URL,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

// API Routes
app.use('/api/auth', authRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// In-memory state for lobby and games
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

// Global state
export const lobbyUsers = new Map<string, LobbyUser>();
export const gameRooms = new Map<string, GameRoom>();
export const socketToUser = new Map<string, string>();

// Generate short room codes
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  // Setup handlers
  setupLobbyHandlers(io, socket, { lobbyUsers, gameRooms, socketToUser, generateRoomCode });
  setupGameHandlers(io, socket, { lobbyUsers, gameRooms, socketToUser });
  setupChatHandlers(io, socket, { lobbyUsers, gameRooms, socketToUser });

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);

    const userId = socketToUser.get(socket.id);
    if (userId) {
      const user = lobbyUsers.get(userId);
      if (user) {
        // Broadcast user left
        socket.broadcast.emit('lobby:user_left', { userId, userName: user.name });
        lobbyUsers.delete(userId);
      }
      socketToUser.delete(socket.id);
    }

    // Handle room disconnection
    for (const [roomId, room] of gameRooms) {
      const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
      if (playerIndex !== -1 && !room.players[playerIndex].isAi) {
        const player = room.players[playerIndex];

        if (room.status === 'waiting') {
          // Remove player from waiting room
          room.players.splice(playerIndex, 1);

          // If host left, assign new host or delete room
          if (player.isHost) {
            if (room.players.length > 0) {
              room.players[0].isHost = true;
              room.hostId = room.players[0].id;
              room.hostName = room.players[0].name;
            } else {
              gameRooms.delete(roomId);
              io.emit('lobby:room_deleted', { roomId });
              continue;
            }
          }
        } else if (room.status === 'playing') {
          // Mark player as disconnected but don't remove
          // They can reconnect
          io.to(roomId).emit('game:player_disconnected', {
            playerId: player.id,
            playerName: player.name
          });
        }

        io.to(roomId).emit('room:updated', room);
        io.emit('lobby:room_updated', room);
      }

      // Handle spectator disconnect
      const spectatorIndex = room.spectators.findIndex(s => s.socketId === socket.id);
      if (spectatorIndex !== -1) {
        room.spectators.splice(spectatorIndex, 1);
        io.to(roomId).emit('room:spectator_left', {
          spectatorId: room.spectators[spectatorIndex]?.id
        });
      }
    }
  });
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`
🎴 Big Two Multiplayer Server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 Server running on port ${PORT}
🔗 Client URL: ${CLIENT_URL}
📁 Data directory: ${join(__dirname, '../data')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);
});

export { io, generateRoomCode };
