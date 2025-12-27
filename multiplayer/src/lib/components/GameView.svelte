<script lang="ts">
  import type { Card as CardType, ClientGameState } from '../game/types';
  import Card from './Card.svelte';
  import Hand from './Hand.svelte';
  import PlayZone from './PlayZone.svelte';
  import Icon from './Icon.svelte';
  import { getPlayType, getPlayTypeName, canBeat, includesThreeOfDiamonds } from '../game/engine';
  import {
    roomMessages,
    sendRoomMessage,
    privateMessages,
    unreadPMs,
    activePMUser,
    sendPM,
    openPMChat,
    closePMChat,
    lobbyState,
    user,
    gameEndResult,
    clearGameEndResult,
    unreadRoomMessages,
    setRoomChatOpen,
    cheatNearWin,
    leaveRoom
  } from '../stores/socket';
  import { onMount } from 'svelte';
  import confetti from 'canvas-confetti';

  interface Props {
    gameState: ClientGameState;
    roomName: string;
    roomId: string;
    userId: string;
    onPlay: (cards: CardType[]) => void;
    onPass: () => void;
    onLeave: () => void;
  }

  let { gameState, roomName, roomId, userId, onPlay, onPass, onLeave }: Props = $props();

  let showLeaveConfirm = $state(false);
  let showRoomChat = $state(false);
  let roomChatInput = $state('');
  let pmInput = $state('');

  // Track if current user won
  let isWinner = $derived($gameEndResult?.winnerId === userId);

  // Trigger confetti when player wins
  $effect(() => {
    if (isWinner) {
      // Realistic confetti burst effect
      const count = 200;
      const defaults = { origin: { y: 0.7 } };

      function fire(particleRatio: number, opts: confetti.Options) {
        confetti({
          ...defaults,
          ...opts,
          particleCount: Math.floor(count * particleRatio)
        });
      }

      fire(0.25, { spread: 26, startVelocity: 55 });
      fire(0.2, { spread: 60 });
      fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
      fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
      fire(0.1, { spread: 120, startVelocity: 45 });
    }
  });

  // Sync room chat open state for unread tracking
  $effect(() => {
    setRoomChatOpen(showRoomChat);
  });

  // DEBUG: Keyboard shortcut for cheat code (Ctrl+Shift+W)
  onMount(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.shiftKey && e.key === 'W') {
        e.preventDefault();
        console.log('[CHEAT] Near-win activated!');
        cheatNearWin(roomId);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  function handleSendRoomChat() {
    if (roomChatInput.trim() && roomId) {
      sendRoomMessage(roomId, roomChatInput.trim());
      roomChatInput = '';
    }
  }

  function handleSendPM() {
    if (pmInput.trim() && $activePMUser) {
      sendPM($activePMUser.id, pmInput.trim());
      pmInput = '';
    }
  }

  function handleClickUser(oderId: string, userName: string) {
    if (userId === oderId) return;
    openPMChat(oderId, userName);
  }

  // Count total unread PMs
  let totalUnread = $derived($unreadPMs.size);

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
    console.log('[GameView] handlePlay called', {
      selectedCards,
      isMyTurn,
      isFirstPlay,
      hasControl,
      currentPlay,
      currentPlayType
    });

    if (selectedCards.length === 0) {
      console.log('[GameView] No cards selected');
      return;
    }

    // Validate play
    const playType = getPlayType(selectedCards);
    console.log('[GameView] playType:', playType);
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

    console.log('[GameView] Calling onPlay with:', selectedCards);
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
  <!-- Top bar with leave and chat buttons -->
  <div class="top-bar">
    <button class="leave-btn" onclick={() => showLeaveConfirm = true}>
      <Icon name="x" size="sm" /> Leave
    </button>
    <div class="chat-toggles">
      <button
        class="chat-toggle-btn"
        class:active={showRoomChat}
        class:has-unread={$unreadRoomMessages > 0}
        onclick={() => showRoomChat = !showRoomChat}
      >
        <Icon name="message-circle" size="sm" /> Chat {#if $unreadRoomMessages > 0}<span class="unread-badge">{$unreadRoomMessages}</span>{/if}
      </button>
      <button
        class="chat-toggle-btn"
        class:has-unread={totalUnread > 0}
        onclick={() => {
          // If no active PM, show list of players to message
          if (!$activePMUser && $lobbyState.users.length > 1) {
            // Find first other user
            const otherUser = $lobbyState.users.find(u => u.id !== userId);
            if (otherUser) openPMChat(otherUser.id, otherUser.name);
          }
        }}
      >
        <Icon name="mail" size="sm" /> DM {#if totalUnread > 0}<span class="unread-badge">{totalUnread}</span>{/if}
      </button>
    </div>
  </div>

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

{#if showLeaveConfirm}
  <div class="modal-overlay" onclick={() => showLeaveConfirm = false}>
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <h3>Leave Game?</h3>
      <p>Your position will be replaced by an AI player. Are you sure you want to leave?</p>
      <div class="modal-buttons">
        <button class="btn btn-secondary" onclick={() => showLeaveConfirm = false}>
          Cancel
        </button>
        <button class="btn btn-danger" onclick={() => { showLeaveConfirm = false; onLeave(); }}>
          Leave Game
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Room Chat Panel -->
{#if showRoomChat}
  <div class="chat-panel room-chat">
    <div class="chat-panel-header">
      <span class="chat-panel-title"><Icon name="message-circle" size="sm" /> {roomName}</span>
      <button class="chat-panel-close" onclick={() => showRoomChat = false}><Icon name="x" size="sm" /></button>
    </div>
    <div class="chat-panel-messages">
      {#each $roomMessages as msg}
        <div class="chat-msg" class:own={msg.senderId === userId} class:system={msg.type === 'system'}>
          <span class="chat-msg-sender">{msg.senderId === userId ? 'You' : msg.senderName}:</span>
          <span class="chat-msg-content">{msg.content}</span>
        </div>
      {/each}
      {#if $roomMessages.length === 0}
        <p class="chat-empty">No messages yet</p>
      {/if}
    </div>
    <form class="chat-panel-input" onsubmit={(e) => { e.preventDefault(); handleSendRoomChat(); }}>
      <input
        type="text"
        bind:value={roomChatInput}
        placeholder="Type a message..."
        maxlength="500"
      />
      <button type="submit" class="btn btn-primary btn-sm">Send</button>
    </form>
  </div>
{/if}

<!-- PM Panel -->
{#if $activePMUser}
  <div class="chat-panel pm-chat">
    <div class="chat-panel-header">
      <span class="chat-panel-title"><Icon name="mail" size="sm" /> {$activePMUser.name}</span>
      <button class="chat-panel-close" onclick={closePMChat}><Icon name="x" size="sm" /></button>
    </div>
    <div class="chat-panel-users">
      {#each $lobbyState.users.filter(u => u.id !== userId) as otherUser}
        <button
          class="user-pill"
          class:active={$activePMUser?.id === otherUser.id}
          class:has-unread={$unreadPMs.has(otherUser.id)}
          onclick={() => openPMChat(otherUser.id, otherUser.name)}
        >
          {otherUser.name}
          {#if $unreadPMs.has(otherUser.id)}
            <span class="unread-dot"></span>
          {/if}
        </button>
      {/each}
    </div>
    <div class="chat-panel-messages">
      {#each $privateMessages[$activePMUser.id] || [] as msg}
        <div class="chat-msg" class:own={msg.senderId === userId}>
          <span class="chat-msg-sender">{msg.senderId === userId ? 'You' : msg.senderName}:</span>
          <span class="chat-msg-content">{msg.content}</span>
        </div>
      {/each}
      {#if !($privateMessages[$activePMUser.id]?.length)}
        <p class="chat-empty">No messages yet. Say hi!</p>
      {/if}
    </div>
    <form class="chat-panel-input" onsubmit={(e) => { e.preventDefault(); handleSendPM(); }}>
      <input
        type="text"
        bind:value={pmInput}
        placeholder="Type a message..."
        maxlength="500"
      />
      <button type="submit" class="btn btn-primary btn-sm">Send</button>
    </form>
  </div>
{/if}

<!-- Game End Screen -->
{#if $gameEndResult}
  <div class="game-end-overlay">
    <div class="game-end-modal">
      <div class="winner-announcement" class:is-you={isWinner}>
        {#if isWinner}
          <div class="trophy"><Icon name="trophy" size={64} /></div>
          <h2>You Won!</h2>
        {:else}
          <h2>{$gameEndResult.winnerName} Wins!</h2>
        {/if}
      </div>

      <div class="results-table">
        <h3>Results</h3>
        {#each $gameEndResult.results.sort((a, b) => b.pointsDelta - a.pointsDelta) as result}
          <div class="result-row" class:winner={result.playerId === $gameEndResult.winnerId} class:you={result.playerId === userId}>
            <span class="player-name">
              {result.playerName}
              {#if result.playerId === userId}(You){/if}
            </span>
            <span class="cards-left">
              {#if result.cardsRemaining === 0}
                <Icon name="star" size="sm" />
              {:else}
                {result.cardsRemaining} cards
              {/if}
            </span>
            <span class="points" class:positive={result.pointsDelta > 0} class:negative={result.pointsDelta < 0}>
              {result.pointsDelta > 0 ? '+' : ''}{result.pointsDelta}
            </span>
          </div>
        {/each}
      </div>

      <button class="btn btn-primary" onclick={() => { clearGameEndResult(); leaveRoom(); }}>
        Back to Lobby
      </button>
    </div>
  </div>
{/if}

<style>
  .top-bar {
    position: absolute;
    top: 8px;
    left: 8px;
    right: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    z-index: 10;
  }

  .leave-btn {
    background: rgba(0,0,0,0.5);
    border: 1px solid rgba(255,255,255,0.3);
    color: rgba(255,255,255,0.7);
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .leave-btn:hover {
    background: rgba(220,53,69,0.8);
    color: white;
    border-color: #dc3545;
  }

  .chat-toggles {
    display: flex;
    gap: 8px;
  }

  .chat-toggle-btn {
    background: rgba(0,0,0,0.5);
    border: 1px solid rgba(255,255,255,0.3);
    color: rgba(255,255,255,0.7);
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .chat-toggle-btn:hover {
    background: rgba(255,255,255,0.1);
    color: white;
  }

  .chat-toggle-btn.active {
    background: rgba(212,175,55,0.3);
    border-color: var(--gold, #d4af37);
    color: white;
  }

  .chat-toggle-btn.has-unread {
    border-color: var(--gold, #d4af37);
  }

  .unread-badge {
    background: var(--gold, #d4af37);
    color: #1a1a1a;
    font-size: 0.65rem;
    padding: 1px 5px;
    border-radius: 10px;
    font-weight: 600;
  }

  /* Chat Panels */
  .chat-panel {
    position: fixed;
    bottom: 20px;
    width: 300px;
    max-height: 350px;
    background: rgba(26, 26, 26, 0.95);
    border-radius: 12px;
    border: 1px solid rgba(212,175,55,0.3);
    display: flex;
    flex-direction: column;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    z-index: 50;
  }

  .room-chat {
    right: 20px;
  }

  .pm-chat {
    right: 340px;
  }

  .chat-panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px;
    border-bottom: 1px solid rgba(255,255,255,0.1);
  }

  .chat-panel-title {
    font-weight: 600;
    color: var(--gold, #d4af37);
    font-size: 0.85rem;
  }

  .chat-panel-close {
    background: none;
    border: none;
    color: rgba(255,255,255,0.5);
    cursor: pointer;
    font-size: 0.9rem;
    padding: 2px;
  }

  .chat-panel-close:hover {
    color: white;
  }

  .chat-panel-users {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 8px 14px;
    border-bottom: 1px solid rgba(255,255,255,0.1);
  }

  .user-pill {
    background: rgba(255,255,255,0.1);
    border: 1px solid transparent;
    color: rgba(255,255,255,0.7);
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 0.7rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .user-pill:hover {
    background: rgba(255,255,255,0.2);
  }

  .user-pill.active {
    background: rgba(212,175,55,0.2);
    border-color: var(--gold, #d4af37);
    color: white;
  }

  .user-pill.has-unread {
    border-color: var(--gold, #d4af37);
  }

  .unread-dot {
    width: 6px;
    height: 6px;
    background: var(--gold, #d4af37);
    border-radius: 50%;
  }

  .chat-panel-messages {
    flex: 1;
    overflow-y: auto;
    padding: 10px 14px;
    max-height: 180px;
    min-height: 80px;
  }

  .chat-msg {
    padding: 4px 0;
    font-size: 0.8rem;
  }

  .chat-msg.own .chat-msg-sender {
    color: #4CAF50;
  }

  .chat-msg.system {
    opacity: 0.6;
    font-style: italic;
  }

  .chat-msg-sender {
    color: var(--gold, #d4af37);
    font-weight: 500;
    margin-right: 6px;
  }

  .chat-msg-content {
    color: rgba(255,255,255,0.8);
  }

  .chat-empty {
    color: rgba(255,255,255,0.4);
    font-size: 0.8rem;
    text-align: center;
    margin: 16px 0;
  }

  .chat-panel-input {
    display: flex;
    gap: 6px;
    padding: 10px;
    border-top: 1px solid rgba(255,255,255,0.1);
  }

  .chat-panel-input input {
    flex: 1;
    font-size: 0.8rem;
    padding: 6px 10px;
    background: rgba(0,0,0,0.3);
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 4px;
    color: white;
  }

  .chat-panel-input input::placeholder {
    color: rgba(255,255,255,0.4);
  }

  .btn-sm {
    padding: 6px 12px;
    font-size: 0.75rem;
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .modal {
    background: var(--bg-dark, #1a1a1a);
    border-radius: 12px;
    padding: 24px;
    max-width: 350px;
    text-align: center;
    border: 1px solid rgba(255,255,255,0.2);
  }

  .modal h3 {
    margin: 0 0 12px;
    color: white;
  }

  .modal p {
    margin: 0 0 20px;
    color: rgba(255,255,255,0.7);
    font-size: 0.9rem;
  }

  .modal-buttons {
    display: flex;
    gap: 12px;
    justify-content: center;
  }

  .btn-danger {
    background: #dc3545;
    color: white;
    border: none;
  }

  .btn-danger:hover {
    background: #c82333;
  }

  .game-view {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 120px);
    position: relative;
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

  /* Mobile chat panels */
  @media (max-width: 700px) {
    .chat-panel {
      width: 260px;
    }

    .pm-chat {
      right: 20px;
      bottom: 390px;
    }

    .chat-panel-messages {
      max-height: 120px;
    }
  }

  @media (max-width: 480px) {
    .chat-toggles {
      gap: 4px;
    }

    .chat-toggle-btn {
      padding: 4px 8px;
      font-size: 0.7rem;
    }

    .chat-panel {
      width: calc(100vw - 40px);
      left: 20px;
      right: 20px;
    }

    .pm-chat {
      bottom: auto;
      top: 50px;
    }

    .room-chat {
      bottom: 20px;
    }
  }

  /* Game End Screen */
  .game-end-overlay {
    position: fixed;
    inset: 0;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    pointer-events: none;
  }

  .game-end-modal {
    background: var(--bg-dark, #1a1a1a);
    border-radius: 16px;
    padding: 32px;
    text-align: center;
    border: 2px solid var(--gold, #d4af37);
    max-width: 400px;
    width: 90%;
    z-index: 201;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
    pointer-events: auto;
  }

  .winner-announcement {
    margin-bottom: 24px;
  }

  .winner-announcement.is-you h2 {
    color: var(--gold, #d4af37);
    font-size: 2rem;
    animation: winner-glow 1s ease-in-out infinite alternate;
  }

  @keyframes winner-glow {
    from {
      text-shadow: 0 0 10px rgba(212, 175, 55, 0.5);
    }
    to {
      text-shadow: 0 0 20px rgba(212, 175, 55, 0.8), 0 0 30px rgba(212, 175, 55, 0.6);
    }
  }

  .trophy {
    color: var(--gold, #fbbf24);
    filter: drop-shadow(0 4px 12px rgba(251, 191, 36, 0.4));
    animation: trophy-bounce 0.5s ease-in-out infinite alternate;
  }

  @keyframes trophy-bounce {
    from {
      transform: translateY(0) scale(1);
    }
    to {
      transform: translateY(-10px) scale(1.1);
    }
  }

  .winner-announcement h2 {
    margin: 12px 0 0;
    color: white;
    font-size: 1.5rem;
  }

  .results-table {
    margin-bottom: 24px;
  }

  .results-table h3 {
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.9rem;
    margin: 0 0 12px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .result-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    margin-bottom: 6px;
    font-size: 0.9rem;
  }

  .result-row.winner {
    background: rgba(212, 175, 55, 0.2);
    border: 1px solid var(--gold, #d4af37);
  }

  .result-row.you {
    border-left: 3px solid var(--gold, #d4af37);
  }

  .result-row .player-name {
    color: white;
    font-weight: 500;
  }

  .result-row .cards-left {
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.8rem;
  }

  .result-row .points {
    font-weight: 600;
    min-width: 50px;
    text-align: right;
  }

  .result-row .points.positive {
    color: #4CAF50;
  }

  .result-row .points.negative {
    color: #f44336;
  }
</style>
