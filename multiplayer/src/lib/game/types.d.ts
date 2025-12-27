export declare const SUITS: readonly ["♦", "♣", "♥", "♠"];
export declare const RANKS: readonly ["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2"];
export type Suit = typeof SUITS[number];
export type Rank = typeof RANKS[number];
export declare const SUIT_ORDER: Record<Suit, number>;
export declare const RANK_ORDER: Record<Rank, number>;
export interface Card {
    rank: Rank;
    suit: Suit;
}
export type PlayType = 'single' | 'pair' | 'triple' | 'straight' | 'flush' | 'fullhouse' | 'four' | 'straightflush';
export interface PlayTypeResult {
    type: PlayType;
    str: number;
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
    cardCount: number;
}
export interface PlayerWithHand extends Player {
    hand: Card[];
}
export interface ClientGameState {
    id: string;
    roomCode: string;
    players: Player[];
    hand: Card[];
    currentPlayer: number;
    currentPlay: Card[] | null;
    currentPlayType: PlayTypeResult | null;
    controlPlayer: number;
    passCount: number;
    playHistory: Play[];
    gameOver: boolean;
    winnerId: string | null;
    winnerName: string | null;
    isFirstPlay: boolean;
    lastPlayerId: string | null;
    scores: Record<string, number>;
}
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
export interface RoomSettings {
    maxPlayers: 2 | 3 | 4;
    allowSpectators: boolean;
    fillWithAi: boolean;
    aiDifficulty: 'easy' | 'medium' | 'hard';
    isPrivate: boolean;
    turnTimeLimit: number | null;
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
export interface ChatMessage {
    id: string;
    senderId: string;
    senderName: string;
    content: string;
    timestamp: number;
    type: 'user' | 'system';
}
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
export interface LobbyState {
    users: {
        id: string;
        name: string;
        status: 'online' | 'in-game';
    }[];
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
