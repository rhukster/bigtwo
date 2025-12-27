<script lang="ts">
  import type { Card as CardType, ClientGameState } from '../game/types';
  import Card from './Card.svelte';
  import Hand from './Hand.svelte';
  import PlayZone from './PlayZone.svelte';
  import { getPlayType, getPlayTypeName, canBeat, includesThreeOfDiamonds } from '../game/engine';

  interface Props {
    gameState: ClientGameState;
    userId: string;
    onPlay: (cards: CardType[]) => void;
    onPass: () => void;
  }

  let { gameState, userId, onPlay, onPass }: Props = $props();

  let selectedCards: CardType[] = $state([]);

  // Find current player's hand
  let myHand = $derived(gameState.hand || []);
  let isMyTurn = $derived(gameState.players[gameState.currentPlayer]?.id === userId);
  let isFirstPlay = $derived(gameState.isFirstPlay);
  let hasControl = $derived(gameState.players[gameState.controlPlayer]?.id === userId);
  let currentPlay = $derived(gameState.currentPlay);
  let currentPlayType = $derived(gameState.currentPlayType);

  // Get other players for display around the table
  let myPlayerIndex = $derived(gameState.players.findIndex(p => p.id === userId));
  let otherPlayers = $derived(() => {
    const idx = myPlayerIndex;
    if (idx === -1) return [];
    const others = [];
    const numPlayers = gameState.players.length;
    for (let i = 1; i < numPlayers; i++) {
      const playerIdx = (idx + i) % numPlayers;
      others.push({
        ...gameState.players[playerIdx],
        position: i === 1 ? 'left' : i === 2 ? 'top' : 'right'
      });
    }
    return others;
  });

  function toggleCard(card: CardType) {
    const index = selectedCards.findIndex(c => c.rank === card.rank && c.suit === card.suit);
    if (index >= 0) {
      selectedCards = selectedCards.filter((_, i) => i !== index);
    } else {
      selectedCards = [...selectedCards, card];
    }
  }

  function handlePlay() {
    if (selectedCards.length === 0) return;

    // Validate play
    const playType = getPlayType(selectedCards);
    if (!playType) {
      alert('Invalid card combination');
      return;
    }

    // Check if first play includes 3 of diamonds
    if (isFirstPlay && !includesThreeOfDiamonds(selectedCards)) {
      alert('First play must include 3 of Diamonds');
      return;
    }

    // Check if play beats current
    if (currentPlay && !canBeat(selectedCards, currentPlay, currentPlayType)) {
      alert('Your play must beat the current cards');
      return;
    }

    onPlay(selectedCards);
    selectedCards = [];
  }

  function handlePass() {
    if (isFirstPlay) {
      alert('Cannot pass on first play');
      return;
    }
    if (hasControl) {
      alert('Cannot pass when you have control');
      return;
    }
    onPass();
    selectedCards = [];
  }

  // Get validation status for selected cards
  let playValidation = $derived(() => {
    if (selectedCards.length === 0) return { valid: false, message: 'Select cards to play' };

    const playType = getPlayType(selectedCards);
    if (!playType) return { valid: false, message: 'Invalid combination' };

    if (isFirstPlay && !includesThreeOfDiamonds(selectedCards)) {
      return { valid: false, message: 'Must include 3 of Diamonds' };
    }

    if (currentPlay && !canBeat(selectedCards, currentPlay, currentPlayType)) {
      return { valid: false, message: 'Must beat current play' };
    }

    return { valid: true, message: getPlayTypeName(playType.type) };
  });

  // Find last player who played
  let lastPlayerName = $derived(
    gameState.lastPlayerId
      ? gameState.players.find(p => p.id === gameState.lastPlayerId)?.name || null
      : null
  );
</script>

<div class="game-view">
  <!-- Other players around the table -->
  <div class="other-players">
    {#each otherPlayers() as player}
      <div class="other-player {player.position}" class:current-turn={gameState.players[gameState.currentPlayer]?.id === player.id}>
        <div class="player-info">
          <span class="player-name">{player.name}</span>
          <span class="card-count">{player.cardCount} cards</span>
        </div>
        <div class="card-backs">
          {#each Array(Math.min(player.cardCount, 8)) as _}
            <div class="card-back"></div>
          {/each}
          {#if player.cardCount > 8}
            <span class="more-cards">+{player.cardCount - 8}</span>
          {/if}
        </div>
      </div>
    {/each}
  </div>

  <!-- Center play zone -->
  <PlayZone
    {currentPlay}
    currentPlayType={currentPlayType?.type ? getPlayTypeName(currentPlayType.type) : null}
    {lastPlayerName}
  />

  <!-- Turn indicator -->
  <div class="turn-indicator">
    {#if isMyTurn}
      <span class="your-turn">Your Turn!</span>
    {:else}
      <span class="waiting-turn">{gameState.players[gameState.currentPlayer]?.name}'s turn</span>
    {/if}
  </div>

  <!-- Player's hand -->
  <div class="my-hand-section">
    <Hand
      cards={myHand}
      {selectedCards}
      onCardClick={toggleCard}
      disabled={!isMyTurn}
      isCurrentTurn={isMyTurn}
    />

    <!-- Action buttons -->
    <div class="action-buttons">
      <div class="validation-message" class:valid={playValidation().valid}>
        {playValidation().message}
      </div>

      <div class="buttons">
        <button
          class="btn btn-secondary"
          onclick={handlePass}
          disabled={!isMyTurn || isFirstPlay || hasControl}
        >
          Pass
        </button>
        <button
          class="btn btn-primary"
          onclick={handlePlay}
          disabled={!isMyTurn || !playValidation().valid}
        >
          Play Cards
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  .game-view {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 120px);
    height: calc(100dvh - 120px); /* Dynamic viewport height for mobile */
    max-height: calc(100vh - 120px);
    max-height: calc(100dvh - 120px);
    padding: 4px 8px;
    background:
      radial-gradient(ellipse at center, rgba(0,80,40,0.9) 0%, rgba(0,50,25,0.95) 50%, rgba(0,30,15,1) 100%),
      linear-gradient(180deg, #1a3d2e 0%, #0d261c 100%);
    background-color: #0d261c;
    overflow: hidden;
    box-sizing: border-box;
    /* Card size CSS custom properties - smaller default */
    --card-width: 52px;
    --card-height: 75px;
    --card-rank-size: 0.85rem;
    --card-suit-size: 0.7rem;
    --card-center-size: 1.4rem;
  }

  .other-players {
    display: flex;
    justify-content: center;
    gap: 12px;
    flex-shrink: 0;
  }

  .other-player {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 4px 8px;
    background: rgba(0,0,0,0.3);
    border-radius: 6px;
    border: 2px solid transparent;
    transition: all 0.3s;
  }

  .other-player.current-turn {
    border-color: var(--gold, #d4af37);
    background: rgba(212,175,55,0.1);
  }

  .player-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 2px;
  }

  .player-name {
    color: white;
    font-weight: 600;
    font-size: 0.7rem;
  }

  .card-count {
    color: rgba(255,255,255,0.5);
    font-size: 0.55rem;
  }

  .card-backs {
    display: flex;
  }

  .card-back {
    width: 20px;
    height: 28px;
    background: linear-gradient(135deg, #1a365d 0%, #2d3748 100%);
    border-radius: 2px;
    border: 1px solid rgba(255,255,255,0.2);
    margin-left: -8px;
  }

  .card-back:first-child {
    margin-left: 0;
  }

  .more-cards {
    color: rgba(255,255,255,0.5);
    font-size: 0.6rem;
    margin-left: 4px;
    align-self: center;
  }

  .turn-indicator {
    text-align: center;
    margin: 2px 0;
    flex-shrink: 0;
  }

  .your-turn {
    color: var(--gold, #d4af37);
    font-size: 0.85rem;
    font-weight: bold;
    animation: pulse 1s infinite;
  }

  .waiting-turn {
    color: rgba(255,255,255,0.6);
    font-size: 0.75rem;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }

  .my-hand-section {
    margin-top: auto;
    flex-shrink: 0;
  }

  .action-buttons {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    margin-top: 2px;
    padding-bottom: 4px;
  }

  .validation-message {
    color: rgba(255,255,255,0.5);
    font-size: 0.7rem;
  }

  .validation-message.valid {
    color: #4CAF50;
  }

  .buttons {
    display: flex;
    gap: 8px;
  }

  .btn {
    padding: 6px 16px;
    font-size: 0.8rem;
    border-radius: 5px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: var(--gold, #d4af37);
    color: #1a1a1a;
    border: none;
  }

  .btn-primary:hover:not(:disabled) {
    background: #e5c158;
  }

  .btn-secondary {
    background: transparent;
    color: white;
    border: 2px solid rgba(255,255,255,0.3);
  }

  .btn-secondary:hover:not(:disabled) {
    border-color: white;
  }

  /* Tablet and larger screens */
  @media (min-width: 768px) {
    .game-view {
      padding: 10px 20px;
      --card-width: 70px;
      --card-height: 100px;
      --card-rank-size: 1.1rem;
      --card-suit-size: 0.9rem;
      --card-center-size: 2rem;
    }

    .other-players {
      gap: 20px;
    }

    .other-player {
      padding: 10px 16px;
    }

    .player-name {
      font-size: 0.9rem;
    }

    .card-count {
      font-size: 0.75rem;
    }

    .card-back {
      width: 30px;
      height: 42px;
    }

    .your-turn {
      font-size: 1.1rem;
    }

    .waiting-turn {
      font-size: 0.95rem;
    }

    .btn {
      padding: 10px 28px;
      font-size: 0.9rem;
    }
  }

  /* Small mobile screens */
  @media (max-width: 480px) {
    .game-view {
      padding: 4px 6px;
      --card-width: 44px;
      --card-height: 63px;
      --card-rank-size: 0.75rem;
      --card-suit-size: 0.6rem;
      --card-center-size: 1.2rem;
    }

    .other-players {
      gap: 6px;
    }

    .other-player {
      padding: 4px 6px;
      border-radius: 6px;
    }

    .player-name {
      font-size: 0.7rem;
    }

    .card-count {
      font-size: 0.55rem;
    }

    .card-back {
      width: 18px;
      height: 26px;
      margin-left: -8px;
    }

    .more-cards {
      font-size: 0.5rem;
    }

    .your-turn {
      font-size: 0.85rem;
    }

    .waiting-turn {
      font-size: 0.75rem;
    }

    .validation-message {
      font-size: 0.65rem;
    }

    .buttons {
      gap: 8px;
    }

    .btn {
      padding: 6px 14px;
      font-size: 0.75rem;
    }
  }

  /* Very small screens / landscape mobile */
  @media (max-height: 500px) {
    .game-view {
      --card-width: 40px;
      --card-height: 57px;
      --card-rank-size: 0.65rem;
      --card-suit-size: 0.5rem;
      --card-center-size: 1rem;
    }

    .other-player {
      padding: 3px 5px;
    }

    .player-info {
      margin-bottom: 2px;
    }

    .card-back {
      width: 16px;
      height: 23px;
      margin-left: -7px;
    }

    .turn-indicator {
      margin: 2px 0;
    }

    .action-buttons {
      gap: 2px;
      margin-top: 2px;
      padding-bottom: 4px;
    }

    .btn {
      padding: 5px 12px;
      font-size: 0.7rem;
    }
  }
</style>
