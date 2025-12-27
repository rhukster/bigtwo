import type { Server, Socket } from 'socket.io';
import { nanoid } from 'nanoid';
import {
  dealCards,
  findStarterIndex,
  getPlayType,
  canBeat,
  includesThreeOfDiamonds,
  removeCardsFromHand,
  hasUnusedTwos,
  hasUnusedQuads,
  hasUnusedStraightFlush,
  calculatePoints,
  sortHand
} from '../../src/lib/game/engine.js';
import type { Card, PlayTypeResult, ServerGameState, ClientGameState } from '../../src/lib/game/types.js';
import { findAiPlay } from '../game/ai.js';
import { createGame, endGame, recordGameResult, updateLeaderboard } from '../db/index.js';

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

interface SharedState {
  lobbyUsers: Map<string, LobbyUser>;
  gameRooms: Map<string, GameRoom>;
  socketToUser: Map<string, string>;
}

// Active games store
const activeGames = new Map<string, ServerGameState>();

export function setupGameHandlers(io: Server, socket: Socket, state: SharedState) {
  const { lobbyUsers, gameRooms, socketToUser } = state;

  // Start game (host only)
  socket.on('room:start', async (data: { roomId: string }) => {
    const userId = socketToUser.get(socket.id);
    if (!userId) return;

    const room = gameRooms.get(data.roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    if (room.hostId !== userId) {
      socket.emit('error', { message: 'Only host can start the game' });
      return;
    }

    // Check if all players are ready (except AI)
    const humanPlayers = room.players.filter(p => !p.isAi);
    if (!humanPlayers.every(p => p.isReady || p.isHost)) {
      socket.emit('error', { message: 'Not all players are ready' });
      return;
    }

    // Fill with AI if enabled
    if (room.settings.fillWithAi) {
      while (room.players.length < room.settings.maxPlayers) {
        const aiNumber = room.players.filter(p => p.isAi).length + 1;
        room.players.push({
          id: `ai-${nanoid(8)}`,
          name: `CPU ${aiNumber}`,
          isReady: true,
          isHost: false,
          isAi: true,
          isGuest: false
        });
      }
    }

    if (room.players.length < 2) {
      socket.emit('error', { message: 'Need at least 2 players to start' });
      return;
    }

    // Create game in database
    const gameId = createGame(room.code, room.players.length);
    room.gameId = gameId;
    room.status = 'playing';

    // Deal cards
    const hands = dealCards(room.players.length);
    const starterIndex = findStarterIndex(hands);

    // Create game state
    const gameState: ServerGameState = {
      id: gameId,
      roomCode: room.code,
      players: room.players.map((p, i) => ({
        id: p.id,
        name: p.name,
        isAi: p.isAi,
        isGuest: p.isGuest,
        isReady: true,
        isConnected: true,
        cardCount: hands[i].length,
        hand: hands[i]
      })),
      currentPlayerIndex: starterIndex,
      currentPlay: null,
      currentPlayType: null,
      controlPlayerIndex: starterIndex,
      passCount: 0,
      playHistory: [],
      gameOver: false,
      winnerId: null,
      firstPlayMade: false,
      startedAt: new Date(),
      endedAt: null
    };

    activeGames.set(gameId, gameState);

    // Notify all players
    io.emit('lobby:room_updated', room);
    io.to(room.id).emit('game:started', { roomId: room.id });

    // Send individual game state to each player
    for (const player of room.players) {
      if (!player.isAi && player.socketId) {
        const clientState = createClientGameState(gameState, player.id);
        io.to(player.socketId).emit('game:state', clientState);
      }
    }

    // Send spectator view (no hands visible)
    for (const spectator of room.spectators) {
      const clientState = createClientGameState(gameState, null);
      io.to(spectator.socketId).emit('game:state', clientState);
    }

    console.log(`[Game] Started game ${gameId} in room ${room.code}`);

    // If first player is AI, trigger their turn
    if (room.players[starterIndex].isAi) {
      setTimeout(() => processAiTurn(io, room, gameState, gameRooms), 1500);
    }
  });

  // Play cards
  socket.on('game:play', (data: { roomId: string; cards: Card[] }) => {
    console.log('[Game] game:play received', { roomId: data.roomId, cards: data.cards });

    const userId = socketToUser.get(socket.id);
    if (!userId) {
      console.log('[Game] No userId for socket');
      socket.emit('error', { message: 'Session expired. Please rejoin the game.' });
      return;
    }

    const room = gameRooms.get(data.roomId);
    if (!room || !room.gameId) {
      console.log('[Game] Room not found or no gameId', { room: room?.id, gameId: room?.gameId });
      socket.emit('error', { message: 'Room not found. The game may have ended.' });
      return;
    }

    const game = activeGames.get(room.gameId);
    if (!game) {
      console.log('[Game] Game not found', { gameId: room.gameId });
      socket.emit('error', { message: 'Game not found. Please restart.' });
      return;
    }

    if (game.gameOver) {
      console.log('[Game] Game already over', { gameId: room.gameId });
      socket.emit('error', { message: 'Game has already ended.' });
      return;
    }

    const playerIndex = game.players.findIndex(p => p.id === userId);
    console.log('[Game] Player check', { userId, playerIndex, currentPlayerIndex: game.currentPlayerIndex });
    if (playerIndex === -1 || playerIndex !== game.currentPlayerIndex) {
      socket.emit('error', { message: 'Not your turn' });
      return;
    }

    const player = game.players[playerIndex];
    const selectedCards = data.cards;

    console.log('[Game] Validating play', {
      firstPlayMade: game.firstPlayMade,
      currentPlay: game.currentPlay,
      selectedCards,
      playerHand: player.hand
    });

    // Validate first play includes 3♦
    if (!game.firstPlayMade) {
      if (!includesThreeOfDiamonds(selectedCards)) {
        console.log('[Game] Rejected: First play must include 3♦');
        socket.emit('error', { message: 'First play must include 3♦' });
        return;
      }
    }

    // Validate play type
    const playType = getPlayType(selectedCards);
    if (!playType) {
      console.log('[Game] Rejected: Invalid combination');
      socket.emit('error', { message: 'Invalid combination' });
      return;
    }

    // Validate can beat current play
    if (game.currentPlay && !canBeat(selectedCards, game.currentPlay, game.currentPlayType)) {
      console.log('[Game] Rejected: Must beat current play');
      socket.emit('error', { message: 'Must play same type but higher' });
      return;
    }

    // Validate player has these cards
    for (const card of selectedCards) {
      if (!player.hand.some(c => c.rank === card.rank && c.suit === card.suit)) {
        console.log('[Game] Rejected: Card not in hand', { card, hand: player.hand });
        socket.emit('error', { message: 'You don\'t have those cards' });
        return;
      }
    }

    console.log('[Game] Play validated, executing');
    // Execute play
    executePlay(io, room, game, gameRooms, playerIndex, selectedCards, playType);
  });

  // Pass turn
  socket.on('game:pass', (data: { roomId: string }) => {
    const userId = socketToUser.get(socket.id);
    if (!userId) {
      socket.emit('error', { message: 'Session expired. Please rejoin the game.' });
      return;
    }

    const room = gameRooms.get(data.roomId);
    if (!room || !room.gameId) {
      socket.emit('error', { message: 'Room not found. The game may have ended.' });
      return;
    }

    const game = activeGames.get(room.gameId);
    if (!game || game.gameOver) {
      socket.emit('error', { message: 'Game not found or already ended.' });
      return;
    }

    const playerIndex = game.players.findIndex(p => p.id === userId);
    if (playerIndex === -1 || playerIndex !== game.currentPlayerIndex) {
      socket.emit('error', { message: 'Not your turn' });
      return;
    }

    // Can't pass if you have control
    if (game.controlPlayerIndex === playerIndex) {
      socket.emit('error', { message: 'You have control, you must play' });
      return;
    }

    executePass(io, room, game, playerIndex);
  });

  // Leave game mid-play (replace with AI)
  socket.on('game:leave', (data: { roomId: string }) => {
    const userId = socketToUser.get(socket.id);
    if (!userId) return;

    const room = gameRooms.get(data.roomId);
    if (!room || !room.gameId) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    const game = activeGames.get(room.gameId);
    if (!game) {
      socket.emit('error', { message: 'Game not found' });
      return;
    }

    const playerIndex = game.players.findIndex(p => p.id === userId);
    if (playerIndex === -1) {
      socket.emit('error', { message: 'Not in this game' });
      return;
    }

    const player = game.players[playerIndex];

    // Replace player with AI
    player.isAi = true;
    player.name = `${player.name} (CPU)`;
    player.isConnected = false;

    // Remove from room player list and add as AI
    const roomPlayerIndex = room.players.findIndex(p => p.id === userId);
    if (roomPlayerIndex !== -1) {
      room.players[roomPlayerIndex].isAi = true;
      room.players[roomPlayerIndex].name = `${room.players[roomPlayerIndex].name} (CPU)`;
    }

    // Update user status
    const user = lobbyUsers.get(userId);
    if (user) {
      user.status = 'online';
    }

    // Leave the socket room
    socket.leave(room.id);

    // Notify client they've left
    socket.emit('room:left');

    // Notify others in the game
    io.to(room.id).emit('game:player_left', {
      playerId: userId,
      playerName: player.name
    });

    // Send updated game state to remaining players
    for (const p of room.players) {
      if (!p.isAi && p.socketId) {
        const clientState = createClientGameState(game, p.id);
        io.to(p.socketId).emit('game:state', clientState);
      }
    }

    io.emit('lobby:room_updated', room);

    console.log(`[Game] ${player.name} left game ${game.id}, replaced with AI`);

    // If it was their turn, process AI turn
    if (game.currentPlayerIndex === playerIndex && !game.gameOver) {
      setTimeout(() => processAiTurn(io, room, game, gameRooms), 1000);
    }
  });

  // DEBUG: Cheat code to fast-forward to near-win state
  socket.on('game:cheat_nearwin', (data: { roomId: string }) => {
    const userId = socketToUser.get(socket.id);
    if (!userId) return;

    const room = gameRooms.get(data.roomId);
    if (!room || !room.gameId) return;

    const game = activeGames.get(room.gameId);
    if (!game || game.gameOver) return;

    const playerIndex = game.players.findIndex(p => p.id === userId);
    if (playerIndex === -1) return;

    // Give this player just 1 random high card
    const highCards: Card[] = [
      { rank: '2', suit: '♠' },
      { rank: '2', suit: '♥' },
      { rank: 'A', suit: '♠' },
      { rank: 'K', suit: '♠' }
    ];
    game.players[playerIndex].hand = [highCards[Math.floor(Math.random() * highCards.length)]];

    // Give other players 2-3 cards each
    for (let i = 0; i < game.players.length; i++) {
      if (i !== playerIndex) {
        const lowCards: Card[] = [
          { rank: '3', suit: '♣' },
          { rank: '4', suit: '♣' },
          { rank: '5', suit: '♣' },
        ];
        game.players[i].hand = lowCards.slice(0, 2 + Math.floor(Math.random() * 2));
      }
    }

    // Set current player to this player with control
    game.currentPlayerIndex = playerIndex;
    game.controlPlayerIndex = playerIndex;
    game.currentPlay = null;
    game.currentPlayType = null;
    game.passCount = 0;
    game.firstPlayMade = true;

    console.log(`[Game] CHEAT: ${game.players[playerIndex].name} near-win state activated`);

    // Send updated game state to all players (use room.players for current socketIds)
    for (const p of room.players) {
      if (!p.isAi && p.socketId) {
        const clientState = createClientGameState(game, p.id);
        io.to(p.socketId).emit('game:state', clientState);
      }
    }
  });
}

function createClientGameState(game: ServerGameState, viewerId: string | null): ClientGameState {
  const viewerIndex = viewerId ? game.players.findIndex(p => p.id === viewerId) : -1;

  // Get last play from history
  const lastPlay = game.playHistory.length > 0 ? game.playHistory[game.playHistory.length - 1] : null;

  return {
    id: game.id,
    roomCode: game.roomCode,
    players: game.players.map(p => ({
      id: p.id,
      name: p.name,
      isAi: p.isAi,
      isReady: p.isReady,
      isConnected: p.isConnected,
      cardCount: p.hand.length
    })),
    hand: viewerIndex >= 0 ? game.players[viewerIndex].hand : [],
    currentPlayer: game.currentPlayerIndex,
    currentPlay: game.currentPlay,
    currentPlayType: game.currentPlayType,
    controlPlayer: game.controlPlayerIndex,
    passCount: game.passCount,
    playHistory: game.playHistory,
    gameOver: game.gameOver,
    winnerId: game.winnerId,
    winnerName: game.winnerId ? game.players.find(p => p.id === game.winnerId)?.name || null : null,
    isFirstPlay: !game.firstPlayMade,
    lastPlayerId: lastPlay?.playerId || null,
    scores: {}
  };
}

function executePlay(
  io: Server,
  room: GameRoom,
  game: ServerGameState,
  gameRooms: Map<string, GameRoom>,
  playerIndex: number,
  cards: Card[],
  playType: PlayTypeResult
) {
  const player = game.players[playerIndex];

  // Update game state
  game.currentPlay = cards;
  game.currentPlayType = playType;
  game.controlPlayerIndex = playerIndex;
  game.passCount = 0;
  game.firstPlayMade = true;

  // Add to play history
  game.playHistory.push({
    cards,
    playerId: player.id,
    playerName: player.name,
    timestamp: Date.now()
  });

  // Remove cards from hand
  player.hand = removeCardsFromHand(player.hand, cards);

  // Broadcast play
  io.to(room.id).emit('game:play_made', {
    playerId: player.id,
    playerName: player.name,
    cards,
    playType
  });

  // Check for win
  if (player.hand.length === 0) {
    endGameWithWinner(io, room, game, playerIndex, gameRooms);
    return;
  }

  // Move to next player
  nextTurn(io, room, game);
}

function executePass(io: Server, room: GameRoom, game: ServerGameState, playerIndex: number) {
  const player = game.players[playerIndex];

  game.passCount++;

  // Broadcast pass
  io.to(room.id).emit('game:pass_made', {
    playerId: player.id,
    playerName: player.name
  });

  // Check if trick is over (all others passed)
  if (game.passCount >= game.players.length - 1) {
    game.currentPlay = null;
    game.currentPlayType = null;
    game.passCount = 0;
    game.playHistory = [];

    io.to(room.id).emit('game:trick_end', {
      controlPlayerId: game.players[game.controlPlayerIndex].id,
      controlPlayerName: game.players[game.controlPlayerIndex].name
    });
  }

  nextTurn(io, room, game);
}

function nextTurn(io: Server, room: GameRoom, game: ServerGameState) {
  game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;

  // Send updated state to all players
  for (const player of room.players) {
    if (!player.isAi && player.socketId) {
      const clientState = createClientGameState(game, player.id);
      io.to(player.socketId).emit('game:state', clientState);
    }
  }

  // Send to spectators
  for (const spectator of room.spectators) {
    const clientState = createClientGameState(game, null);
    io.to(spectator.socketId).emit('game:state', clientState);
  }

  // If next player is AI, trigger their turn
  if (game.players[game.currentPlayerIndex].isAi && !game.gameOver) {
    setTimeout(() => processAiTurn(io, room, game, gameRooms), 1000);
  }
}

function processAiTurn(io: Server, room: GameRoom, game: ServerGameState, gameRooms: Map<string, GameRoom>) {
  if (game.gameOver) return;

  const playerIndex = game.currentPlayerIndex;
  const player = game.players[playerIndex];

  if (!player.isAi) return;

  const difficulty = room.settings.aiDifficulty;
  const hasControl = game.controlPlayerIndex === playerIndex;

  const play = findAiPlay(
    player.hand,
    game.currentPlay,
    game.currentPlayType,
    hasControl,
    game.firstPlayMade,
    difficulty
  );

  if (play) {
    const playType = getPlayType(play)!;
    executePlay(io, room, game, gameRooms, playerIndex, play, playType);
  } else {
    executePass(io, room, game, playerIndex);
  }
}

function endGameWithWinner(io: Server, room: GameRoom, game: ServerGameState, winnerIndex: number, gameRooms: Map<string, GameRoom>) {
  game.gameOver = true;
  game.winnerId = game.players[winnerIndex].id;
  game.endedAt = new Date();

  const winner = game.players[winnerIndex];

  // Check if winner ended with special hand
  const lastPlay = game.playHistory[game.playHistory.length - 1];
  const winnerEndedWithSpecial = lastPlay?.playerId === winner.id &&
    ['four', 'straightflush'].includes(game.currentPlayType?.type || '') ||
    (lastPlay?.cards.length === 1 && lastPlay.cards[0].rank === '2');

  // Calculate scores
  const scores: Record<string, number> = {};
  const results: Array<{
    playerId: string;
    playerName: string;
    isAi: boolean;
    position: number;
    cardsRemaining: number;
    pointsDelta: number;
  }> = [];

  // Sort players by cards remaining (winner first)
  const sortedPlayers = [...game.players].sort((a, b) => a.hand.length - b.hand.length);

  let totalPenalty = 0;

  sortedPlayers.forEach((player, position) => {
    if (player.id === winner.id) {
      results.push({
        playerId: player.id,
        playerName: player.name,
        isAi: player.isAi,
        position: 1,
        cardsRemaining: 0,
        pointsDelta: 0 // Will be set after calculating total
      });
    } else {
      const penalty = calculatePoints(
        player.hand.length,
        hasUnusedTwos(player.hand),
        hasUnusedQuads(player.hand),
        hasUnusedStraightFlush(player.hand),
        winnerEndedWithSpecial
      );

      totalPenalty += penalty;
      scores[player.id] = -penalty;

      results.push({
        playerId: player.id,
        playerName: player.name,
        isAi: player.isAi,
        position: position + 1,
        cardsRemaining: player.hand.length,
        pointsDelta: -penalty
      });
    }
  });

  // Winner gets total of all penalties
  scores[winner.id] = totalPenalty;
  const winnerResult = results.find(r => r.playerId === winner.id)!;
  winnerResult.pointsDelta = totalPenalty;

  // Update database - don't store winner_id for AI or guest players
  const isNonRegisteredWinner = winner.isAi || winner.isGuest;
  endGame(game.id, winner.id, isNonRegisteredWinner);

  for (const result of results) {
    const player = game.players.find(p => p.id === result.playerId)!;
    // For AI or guest players, don't store user_id (they're not in users table)
    const shouldStoreUserId = !player.isAi && !player.isGuest;
    recordGameResult(
      game.id,
      shouldStoreUserId ? result.playerId : null,
      player.isAi,
      result.position,
      result.cardsRemaining,
      result.pointsDelta,
      hasUnusedTwos(player.hand),
      hasUnusedQuads(player.hand),
      hasUnusedStraightFlush(player.hand)
    );

    // Update leaderboard only for registered (non-AI, non-guest) players
    if (shouldStoreUserId) {
      updateLeaderboard(result.playerId, result.position === 1, result.pointsDelta);
    }
  }

  // Broadcast game end
  io.to(room.id).emit('game:end', {
    winnerId: winner.id,
    winnerName: winner.name,
    scores,
    results
  });

  // Update room status
  room.status = 'finished';
  room.gameId = undefined; // Clear game reference
  io.emit('lobby:room_updated', room);

  // Clean up game
  activeGames.delete(game.id);

  console.log(`[Game] Game ${game.id} ended. Winner: ${winner.name}`);

  // Auto-delete room after 60 seconds if no one has left/rejoined
  setTimeout(() => {
    const existingRoom = gameRooms.get(room.id);
    if (existingRoom && existingRoom.status === 'finished') {
      gameRooms.delete(room.id);
      io.emit('lobby:room_deleted', { roomId: room.id });
      console.log(`[Game] Room ${room.code} auto-deleted after game finished`);
    }
  }, 60000);
}

export { activeGames };
