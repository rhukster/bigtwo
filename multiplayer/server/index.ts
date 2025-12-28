import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import Database from 'better-sqlite3';
import SqliteStore from 'better-sqlite3-session-store';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

// Load environment variables
config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';

// Import routes
import authRoutes from './routes/auth.js';

// Import webhook handler
import { setupWebhook } from './webhook.js';

// Import socket handlers
import { setupLobbyHandlers } from './socket/lobby.js';
import { setupGameHandlers, activeGames } from './socket/game.js';
import { setupChatHandlers } from './socket/chat.js';

// Import database (initializes on import)
import './db/index.js';
import { getLeaderboard, getUserStats } from './db/index.js';

const app = express();
const httpServer = createServer(app);

const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const PORT = parseInt(process.env.PORT || '3001');
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-in-production';

// Initialize SQLite session store
const SessionStore = SqliteStore(session);
const sessionDb = new Database(join(__dirname, '../data/sessions.db'));
sessionDb.pragma('journal_mode = WAL');

// Socket.io setup
const io = new Server(httpServer, {
  cors: {
    origin: isProduction ? APP_URL : true,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: isProduction ? APP_URL : true,
  credentials: true
}));

// Setup GitHub webhook (before json middleware - needs raw body)
if (isProduction) {
  setupWebhook(app);
}

app.use(express.json());
app.use(cookieParser());
app.use(session({
  store: new SessionStore({
    client: sessionDb,
    expired: {
      clear: true,
      intervalMs: 900000 // Clean up expired sessions every 15 minutes
    }
  }),
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProduction,
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: isProduction ? 'strict' : 'lax'
  }
}));

// API Routes
app.use('/api/auth', authRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Leaderboard API
app.get('/api/leaderboard', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const leaderboard = getLeaderboard(limit);
    res.json({ leaderboard });
  } catch (error) {
    console.error('[API] Leaderboard error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Serve static files in production
if (isProduction) {
  const buildPath = join(__dirname, '../build');

  if (existsSync(buildPath)) {
    app.use(express.static(buildPath));

    // SPA fallback - serve index.html for all non-API routes
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io/')) {
        return next();
      }
      res.sendFile(join(buildPath, 'index.html'));
    });

    console.log(`[Server] Serving static files from ${buildPath}`);
  } else {
    console.warn(`[Server] Build directory not found at ${buildPath}`);
  }
}

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

      // Check if user is in an active game - if so, don't remove them yet
      let inActiveGame = false;
      for (const room of gameRooms.values()) {
        if (room.status === 'playing' && room.players.some(p => p.id === userId && !p.isAi)) {
          inActiveGame = true;
          break;
        }
      }

      if (user && !inActiveGame) {
        // Not in active game - broadcast user left and remove
        socket.broadcast.emit('lobby:user_left', { userId, userName: user.name });
        lobbyUsers.delete(userId);
      } else if (user) {
        // In active game - keep user in lobby but clear socket mapping
        console.log(`[Socket] ${user.name} disconnected but in active game - keeping for reconnect`);
      }
      socketToUser.delete(socket.id);
    }

    // Handle room disconnection
    for (const [roomId, room] of gameRooms) {
      const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
      if (playerIndex !== -1 && !room.players[playerIndex].isAi) {
        const player = room.players[playerIndex];
        const wasHost = player.isHost;

        if (room.status === 'waiting') {
          // Remove player from waiting room
          room.players.splice(playerIndex, 1);

          // Check if any human players remain
          const humanPlayers = room.players.filter(p => !p.isAi);
          if (humanPlayers.length === 0) {
            // No humans left - delete room
            gameRooms.delete(roomId);
            io.emit('lobby:room_deleted', { roomId });
            continue;
          }

          // If host left, assign new host to next human
          if (wasHost) {
            const nextHuman = humanPlayers[0];
            nextHuman.isHost = true;
            nextHuman.isReady = true;  // Host is always ready
            room.hostId = nextHuman.id;
            room.hostName = nextHuman.name;
            console.log(`[Room] Host transferred to ${nextHuman.name} (disconnect)`);
          }
        } else if (room.status === 'playing' || room.status === 'finished') {
          // In active/finished game: transfer host to next human if needed
          if (wasHost) {
            const nextHuman = room.players.find(p => !p.isAi && p.id !== player.id);
            if (nextHuman) {
              // Transfer host to another human
              player.isHost = false;
              nextHuman.isHost = true;
              nextHuman.isReady = true;  // Host is always ready
              room.hostId = nextHuman.id;
              room.hostName = nextHuman.name;
              console.log(`[Game] Host transferred to ${nextHuman.name} (disconnect)`);
            }
            // If no other human, keep this player as host (they might reconnect)
          }

          // Mark player as disconnected in game state
          if (room.gameId) {
            const game = activeGames.get(room.gameId);
            if (game) {
              const gamePlayer = game.players.find(p => p.id === player.id);
              if (gamePlayer) {
                gamePlayer.isConnected = false;
              }
            }
          }

          // Mark player as disconnected
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
🔗 App URL: ${APP_URL}
📁 Data directory: ${join(__dirname, '../data')}
🏗️  Mode: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);
});

export { io, generateRoomCode };
