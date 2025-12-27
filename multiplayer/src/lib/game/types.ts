// Card and game types shared between client and server

export const SUITS = ['♦', '♣', '♥', '♠'] as const;
export const RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'] as const;

export type Suit = typeof SUITS[number];
export type Rank = typeof RANKS[number];

export const SUIT_ORDER: Record<Suit, number> = { '♦': 0, '♣': 1, '♥': 2, '♠': 3 };
export const RANK_ORDER: Record<Rank, number> = {
  '3': 0, '4': 1, '5': 2, '6': 3, '7': 4, '8': 5, '9': 6,
  '10': 7, 'J': 8, 'Q': 9, 'K': 10, 'A': 11, '2': 12
};

export interface Card {
  rank: Rank;
  suit: Suit;
}

export type PlayType = 'single' | 'pair' | 'triple' | 'straight' | 'flush' | 'fullhouse' | 'four' | 'straightflush';

export interface PlayTypeResult {
  type: PlayType;
  str: number; // Strength value for comparison
}

export interface Play {
  cards: Card[];
  playerId: string;
  playerName: string;
  timestamp: number;
}

export interface Player {
  id: string;
  name: string;
  isAi: boolean;
  isGuest: boolean;
  isReady: boolean;
  isConnected: boolean;
  cardCount: number; // Don't expose actual cards to other players
}

export interface PlayerWithHand extends Player {
  hand: Card[];
}

// Game state sent to clients (sanitized - no other player hands)
export interface ClientGameState {
  id: string;
  roomCode: string;
  players: Player[];
  hand: Card[]; // Only the current player's hand (alias: myHand for compatibility)
  currentPlayer: number; // Index of current player
  currentPlay: Card[] | null;
  currentPlayType: PlayTypeResult | null;
  controlPlayer: number; // Index of player who has control
  passCount: number;
  playHistory: Play[];
  gameOver: boolean;
  winnerId: string | null;
  winnerName: string | null;
  isFirstPlay: boolean;
  lastPlayerId: string | null; // ID of player who made last play
  scores: Record<string, number>; // Points per player
}

// Full server-side game state
export interface ServerGameState {
  id: string;
  roomCode: string;
  players: PlayerWithHand[];
  currentPlayerIndex: number;
  currentPlay: Card[] | null;
  currentPlayType: PlayTypeResult | null;
  controlPlayerIndex: number;
  passCount: number;
  playHistory: Play[];
  gameOver: boolean;
  winnerId: string | null;
  firstPlayMade: boolean;
  startedAt: Date;
  endedAt: Date | null;
}

// Room/Lobby types
export interface RoomSettings {
  maxPlayers: 2 | 3 | 4;
  allowSpectators: boolean;
  fillWithAi: boolean;
  aiDifficulty: 'easy' | 'medium' | 'hard';
  isPrivate: boolean;
  turnTimeLimit: number | null; // seconds, null = no limit
}

export interface Room {
  id: string;
  code: string;
  name: string;
  hostId: string;
  hostName: string;
  settings: RoomSettings;
  players: RoomPlayer[];
  spectators: RoomPlayer[];
  status: 'waiting' | 'playing' | 'finished';
  createdAt: Date;
  gameId: string | null;
}

export interface RoomPlayer {
  id: string;
  name: string;
  isReady: boolean;
  isHost: boolean;
  isAi: boolean;
}

// Chat types
export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: number;
  type: 'user' | 'system';
}

// User types
export interface User {
  id: string;
  username: string;
  email: string;
  isGuest: boolean;
}

export interface LeaderboardEntry {
  userId: string;
  username: string;
  totalGames: number;
  wins: number;
  totalPoints: number;
  currentStreak: number;
  bestStreak: number;
  rank: number;
}

// Socket event payloads
export interface LobbyState {
  users: { id: string; name: string; status: 'online' | 'in-game' }[];
  rooms: Room[];
}

export interface GameScores {
  results: {
    playerId: string;
    playerName: string;
    isAi: boolean;
    position: number;
    cardsRemaining: number;
    pointsDelta: number;
  }[];
}
