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
  players: Array<{ id: string; name: string; socketId?: string }>;
  spectators: Array<{ id: string; name: string; socketId: string }>;
}

interface SharedState {
  lobbyUsers: Map<string, LobbyUser>;
  gameRooms: Map<string, GameRoom>;
  socketToUser: Map<string, string>;
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: number;
  type: 'user' | 'system';
}

// Rate limiting: max 10 messages per 10 seconds per user
const rateLimits = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 10000; // 10 seconds
const RATE_LIMIT_MAX = 10;

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const timestamps = rateLimits.get(userId) || [];

  // Remove old timestamps
  const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW);

  if (recent.length >= RATE_LIMIT_MAX) {
    return true;
  }

  recent.push(now);
  rateLimits.set(userId, recent);
  return false;
}

// Message history (in-memory, last 1000 messages per channel)
const lobbyChat: ChatMessage[] = [];
const roomChats = new Map<string, ChatMessage[]>();
const privateChats = new Map<string, ChatMessage[]>(); // Key: sorted `${id1}:${id2}`
const MAX_HISTORY = 1000;

function getPMKey(userId1: string, userId2: string): string {
  return [userId1, userId2].sort().join(':');
}

function addMessage(messages: ChatMessage[], message: ChatMessage) {
  messages.push(message);
  if (messages.length > MAX_HISTORY) {
    messages.shift();
  }
}

export function setupChatHandlers(io: Server, socket: Socket, state: SharedState) {
  const { lobbyUsers, gameRooms, socketToUser } = state;

  // Send message to lobby
  socket.on('chat:lobby', (data: { content: string }) => {
    const userId = socketToUser.get(socket.id);
    if (!userId) return;

    const user = lobbyUsers.get(userId);
    if (!user) return;

    // Rate limit check
    if (isRateLimited(userId)) {
      socket.emit('error', { message: 'Slow down! Too many messages.' });
      return;
    }

    // Sanitize content
    const content = data.content.trim().slice(0, 500);
    if (!content) return;

    const message: ChatMessage = {
      id: nanoid(),
      senderId: userId,
      senderName: user.name,
      content,
      timestamp: Date.now(),
      type: 'user'
    };

    addMessage(lobbyChat, message);
    io.emit('chat:lobby_message', message);
  });

  // Send message to room
  socket.on('chat:room', (data: { roomId: string; content: string }) => {
    const userId = socketToUser.get(socket.id);
    if (!userId) return;

    const user = lobbyUsers.get(userId);
    if (!user) return;

    const room = gameRooms.get(data.roomId);
    if (!room) return;

    // Check user is in room
    const isInRoom = room.players.some(p => p.id === userId) ||
      room.spectators.some(s => s.id === userId);
    if (!isInRoom) return;

    // Rate limit check
    if (isRateLimited(userId)) {
      socket.emit('error', { message: 'Slow down! Too many messages.' });
      return;
    }

    // Sanitize content
    const content = data.content.trim().slice(0, 500);
    if (!content) return;

    const message: ChatMessage = {
      id: nanoid(),
      senderId: userId,
      senderName: user.name,
      content,
      timestamp: Date.now(),
      type: 'user'
    };

    // Get or create room chat history
    if (!roomChats.has(data.roomId)) {
      roomChats.set(data.roomId, []);
    }
    addMessage(roomChats.get(data.roomId)!, message);

    io.to(data.roomId).emit('chat:room_message', message);
  });

  // Get lobby chat history
  socket.on('chat:get_lobby_history', (callback: (messages: ChatMessage[]) => void) => {
    callback(lobbyChat.slice(-100)); // Last 100 messages
  });

  // Get room chat history
  socket.on('chat:get_room_history', (data: { roomId: string }, callback: (messages: ChatMessage[]) => void) => {
    const history = roomChats.get(data.roomId) || [];
    callback(history.slice(-100)); // Last 100 messages
  });

  // Send private message
  socket.on('chat:pm', (data: { recipientId: string; content: string }) => {
    const userId = socketToUser.get(socket.id);
    if (!userId) return;

    const sender = lobbyUsers.get(userId);
    if (!sender) return;

    const recipient = lobbyUsers.get(data.recipientId);
    if (!recipient) {
      socket.emit('error', { message: 'User not found or offline' });
      return;
    }

    // Rate limit check
    if (isRateLimited(userId)) {
      socket.emit('error', { message: 'Slow down! Too many messages.' });
      return;
    }

    // Sanitize content
    const content = data.content.trim().slice(0, 500);
    if (!content) return;

    const message: ChatMessage = {
      id: nanoid(),
      senderId: userId,
      senderName: sender.name,
      content,
      timestamp: Date.now(),
      type: 'user'
    };

    // Store in both users' history
    const pmKey = getPMKey(userId, data.recipientId);
    if (!privateChats.has(pmKey)) {
      privateChats.set(pmKey, []);
    }
    addMessage(privateChats.get(pmKey)!, message);

    // Send to recipient
    io.to(recipient.socketId).emit('chat:pm_received', {
      ...message,
      recipientId: data.recipientId,
      recipientName: recipient.name
    });

    // Send confirmation back to sender
    socket.emit('chat:pm_sent', {
      ...message,
      recipientId: data.recipientId,
      recipientName: recipient.name
    });
  });

  // Get PM history with a user
  socket.on('chat:get_pm_history', (data: { otherUserId: string }, callback: (messages: ChatMessage[]) => void) => {
    const userId = socketToUser.get(socket.id);
    if (!userId) {
      callback([]);
      return;
    }

    const pmKey = getPMKey(userId, data.otherUserId);
    const history = privateChats.get(pmKey) || [];
    callback(history.slice(-50));
  });
}

// System message helper (for game events)
export function sendSystemMessage(io: Server, roomId: string, content: string) {
  const message: ChatMessage = {
    id: nanoid(),
    senderId: 'system',
    senderName: 'System',
    content,
    timestamp: Date.now(),
    type: 'system'
  };

  if (!roomChats.has(roomId)) {
    roomChats.set(roomId, []);
  }
  addMessage(roomChats.get(roomId)!, message);

  io.to(roomId).emit('chat:room_message', message);
}
