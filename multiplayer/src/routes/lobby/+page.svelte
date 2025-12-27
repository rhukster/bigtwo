<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import {
    user,
    connected,
    lobbyState,
    currentRoom,
    gameState,
    connectSocket,
    createRoom,
    joinRoom,
    leaveRoom,
    toggleReady,
    addAi,
    startGame,
    playCards,
    passTurn,
    sendLobbyMessage,
    lobbyMessages,
    disconnectSocket,
    readyCountdowns,
    leaveGame,
    privateMessages,
    unreadPMs,
    activePMUser,
    sendPM,
    openPMChat,
    closePMChat
  } from '$lib/stores/socket';
  import GameView from '$lib/components/GameView.svelte';
  import type { Card } from '$lib/game/types';

  let showCreateRoom = false;
  let showRules = false;
  let roomName = '';
  let maxPlayers: 2 | 3 | 4 = 4;
  let fillWithAi = true;
  let aiDifficulty: 'easy' | 'medium' | 'hard' = 'medium';
  let chatInput = '';
  let joinCode = '';
  let isPrivate = false;
  let pmInput = '';

  function handleSendPM() {
    if (pmInput.trim() && $activePMUser) {
      sendPM($activePMUser.id, pmInput.trim());
      pmInput = '';
    }
  }

  function handleClickUser(userId: string, userName: string) {
    // Don't open PM with yourself
    if (userId === $user?.id) return;
    openPMChat(userId, userName);
  }

  onMount(async () => {
    // Check auth
    if (!$user) {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.user) {
          user.set(data.user);
          connectSocket(data.user);
        } else {
          goto('/');
        }
      } catch (e) {
        goto('/');
      }
    } else if (!$connected) {
      connectSocket($user);
    }
  });

  function handleCreateRoom() {
    createRoom(roomName || `${$user?.username}'s Game`, {
      maxPlayers,
      allowSpectators: false,
      fillWithAi,
      aiDifficulty,
      isPrivate,
      turnTimeLimit: null
    });
    showCreateRoom = false;
    roomName = '';
    isPrivate = false;
  }

  function handleJoinByCode() {
    if (joinCode.trim()) {
      joinRoom(undefined, joinCode.trim().toUpperCase());
      joinCode = '';
    }
  }

  function handleSendChat() {
    if (chatInput.trim()) {
      sendLobbyMessage(chatInput.trim());
      chatInput = '';
    }
  }

  function handleLogout() {
    fetch('/api/auth/logout', { method: 'POST' });
    // Clear guest user from localStorage
    localStorage.removeItem('guestUser');
    disconnectSocket();
    user.set(null);
    goto('/');
  }

  function handlePlayCards(cards: Card[]) {
    console.log('[Lobby] handlePlayCards called', {
      cards,
      currentRoom: $currentRoom,
      roomId: $currentRoom?.id,
      userId: $user?.id,
      gameState: $gameState ? {
        currentPlayer: $gameState.currentPlayer,
        controlPlayer: $gameState.controlPlayer,
        handLength: $gameState.hand?.length,
        currentPlay: $gameState.currentPlay
      } : null
    });
    if ($currentRoom) {
      playCards($currentRoom.id, cards);
    } else {
      console.error('[Lobby] No current room! Cannot play cards.');
    }
  }

  function handlePassTurn() {
    if ($currentRoom) {
      passTurn($currentRoom.id);
    }
  }

  function handleLeaveGame() {
    if ($currentRoom) {
      leaveGame($currentRoom.id);
    }
  }
</script>

<svelte:head>
  <title>Lobby - Big Two</title>
</svelte:head>

<div class="lobby-container">
  <header class="lobby-header">
    <div class="logo">
      <span>🎴</span>
      <h1>Big Two</h1>
    </div>
    <div class="user-info">
      <span class="connection-status" class:connected={$connected}>
        {$connected ? '🟢' : '🔴'}
      </span>
      <span class="username">{$user?.username || 'Guest'}</span>
      {#if $user?.isGuest}
        <span class="guest-badge">Guest</span>
      {/if}
      <button class="btn btn-secondary btn-sm" on:click={() => showRules = true}>Rules</button>
      <a href="/leaderboard" class="btn btn-secondary btn-sm">Leaderboard</a>
      <button class="btn btn-secondary btn-sm" on:click={handleLogout}>LOGOUT</button>
    </div>
  </header>

  <main class="lobby-main">
    {#if $gameState}
      <!-- Game View - Full Screen -->
      <GameView
        gameState={$gameState}
        roomName={$currentRoom?.name || 'Game'}
        roomId={$currentRoom?.id || ''}
        userId={$user?.id || ''}
        onPlay={handlePlayCards}
        onPass={handlePassTurn}
        onLeave={handleLeaveGame}
      />
    {:else}
      <!-- Lobby/Room View with Sidebar -->
      <div class="lobby-content">
        <div class="main-section">
          {#if $currentRoom}
            <!-- Room View -->
            <div class="room-view">
              <div class="room-header">
                <button class="back-btn" on:click={leaveRoom}>← Back to Lobby</button>
                <h2>{$currentRoom.name}</h2>
                <div class="room-visibility-badge" class:private={$currentRoom.settings.isPrivate}>
                  {$currentRoom.settings.isPrivate ? '🔒 Invite Only' : '🌐 Open'}
                </div>
                <div class="room-code">
                  Code: <strong>{$currentRoom.code}</strong>
                  <button class="copy-btn" on:click={() => navigator.clipboard.writeText($currentRoom?.code || '')}>
                    📋 Copy
                  </button>
                </div>
              </div>

              <div class="players-grid">
                {#each $currentRoom.players as player, i}
                  <div class="player-slot" class:ready={player.isReady} class:host={player.isHost}>
                    <div class="player-avatar">
                      {player.isAi ? '🤖' : '👤'}
                    </div>
                    <div class="player-name">
                      {player.name}
                      {#if player.isHost}<span class="host-badge">Host</span>{/if}
                    </div>
                    <div class="player-status">
                      {#if player.isAi}
                        <span class="ready-text">Ready</span>
                      {:else if player.isReady}
                        <span class="ready-text">Ready</span>
                      {:else if $readyCountdowns[player.id] !== undefined}
                        <span class="countdown-text">Auto-ready in {$readyCountdowns[player.id]}s</span>
                      {:else}
                        <span class="waiting-text">Waiting...</span>
                      {/if}
                    </div>
                  </div>
                {/each}

                {#each Array($currentRoom.settings.maxPlayers - $currentRoom.players.length) as _, i}
                  <div class="player-slot empty">
                    <div class="player-avatar">❓</div>
                    <div class="player-name">Empty Slot</div>
                    {#if $currentRoom.hostId === $user?.id}
                      <button class="btn btn-secondary btn-sm" on:click={() => addAi($currentRoom?.id || '')}>
                        + Add AI
                      </button>
                    {/if}
                  </div>
                {/each}
              </div>

              <div class="room-actions">
                {#if $currentRoom.hostId === $user?.id}
                  <button
                    class="btn btn-primary"
                    on:click={() => startGame($currentRoom?.id || '')}
                    disabled={$currentRoom.players.length < 2}
                  >
                    Start Game
                  </button>
                {:else}
                  <button
                    class="btn btn-success"
                    on:click={() => toggleReady($currentRoom?.id || '', !$currentRoom?.players.find(p => p.id === $user?.id)?.isReady)}
                  >
                    {$currentRoom.players.find(p => p.id === $user?.id)?.isReady ? 'Not Ready' : 'Ready'}
                  </button>
                {/if}
              </div>
            </div>
          {:else}
            <!-- Lobby Rooms List -->
            <div class="rooms-section">
              <div class="section-header">
                <h2>🎮 Game Rooms</h2>
                <button class="btn btn-primary" on:click={() => showCreateRoom = true}>
                  + Create Room
                </button>
              </div>

              <div class="join-by-code">
                <input
                  type="text"
                  bind:value={joinCode}
                  placeholder="Enter room code..."
                  maxlength="6"
                />
                <button class="btn btn-secondary" on:click={handleJoinByCode}>Join</button>
              </div>

              <div class="rooms-list">
                {#if $lobbyState.rooms.length === 0}
                  <p class="text-muted text-center">No rooms available. Create one!</p>
                {:else}
                  {#each $lobbyState.rooms as room}
                    <div class="room-card">
                      <div class="room-info">
                        <h3>{room.name}</h3>
                        <p>{room.players.length}/{room.settings.maxPlayers} players</p>
                      </div>
                      <button
                        class="btn btn-secondary"
                        on:click={() => joinRoom(room.id)}
                        disabled={room.status !== 'waiting'}
                      >
                        {room.status === 'waiting' ? 'Join' : room.status === 'finished' ? 'Finished' : 'In Game'}
                      </button>
                    </div>
                  {/each}
                {/if}
              </div>
            </div>
          {/if}
        </div>

        <div class="sidebar">
          <div class="online-users">
            <h3>👥 Online ({$lobbyState.users.length})</h3>
            <ul>
              {#each $lobbyState.users as onlineUser}
                <li
                  class:in-game={onlineUser.status === 'in-game'}
                  class:clickable={onlineUser.id !== $user?.id}
                  class:has-unread={$unreadPMs.has(onlineUser.id)}
                  on:click={() => handleClickUser(onlineUser.id, onlineUser.name)}
                >
                  <span class="user-name-row">
                    {onlineUser.name}
                    {#if onlineUser.id === $user?.id}
                      <span class="you-badge">(you)</span>
                    {/if}
                    {#if $unreadPMs.has(onlineUser.id)}
                      <span class="unread-dot"></span>
                    {/if}
                  </span>
                  {#if onlineUser.status === 'in-game'}
                    <span class="status-badge">In Game</span>
                  {:else if onlineUser.id !== $user?.id}
                    <span class="pm-hint">💬</span>
                  {/if}
                </li>
              {/each}
            </ul>
          </div>

          <div class="chat-section">
            <h3>💬 {$currentRoom ? `${$currentRoom.name} Chat` : 'Lobby Chat'}</h3>
            <div class="chat-messages">
              {#each $lobbyMessages as msg}
                <div class="chat-message" class:system={msg.type === 'system'}>
                  <span class="chat-sender">{msg.senderName}:</span>
                  <span class="chat-content">{msg.content}</span>
                </div>
              {/each}
            </div>
            <form class="chat-input" on:submit|preventDefault={handleSendChat}>
              <input
                type="text"
                bind:value={chatInput}
                placeholder="Type a message..."
                maxlength="500"
              />
              <button type="submit" class="btn btn-primary btn-sm">Send</button>
            </form>
          </div>
        </div>
      </div>
    {/if}
  </main>
</div>

{#if showCreateRoom}
  <div class="modal-overlay" on:click={() => showCreateRoom = false}>
    <div class="modal" on:click|stopPropagation>
      <h2>Create Room</h2>

      <div class="form-group">
        <label>Room Name (optional)</label>
        <input type="text" bind:value={roomName} placeholder="My Game" />
      </div>

      <div class="form-group">
        <label>Max Players</label>
        <select bind:value={maxPlayers}>
          <option value={2}>2 Players</option>
          <option value={3}>3 Players</option>
          <option value={4}>4 Players</option>
        </select>
      </div>

      <div class="form-group">
        <label>Room Visibility</label>
        <div class="visibility-options">
          <button
            type="button"
            class="visibility-btn"
            class:active={!isPrivate}
            on:click={() => isPrivate = false}
          >
            🌐 Open
            <span class="visibility-desc">Anyone can join</span>
          </button>
          <button
            type="button"
            class="visibility-btn"
            class:active={isPrivate}
            on:click={() => isPrivate = true}
          >
            🔒 Invite Only
            <span class="visibility-desc">Requires room code</span>
          </button>
        </div>
      </div>

      <div class="form-group">
        <label>
          <input type="checkbox" bind:checked={fillWithAi} />
          Fill empty slots with AI
        </label>
      </div>

      {#if fillWithAi}
        <div class="form-group">
          <label>AI Difficulty</label>
          <select bind:value={aiDifficulty}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
      {/if}

      <div class="modal-actions">
        <button class="btn btn-secondary" on:click={() => showCreateRoom = false}>Cancel</button>
        <button class="btn btn-primary" on:click={handleCreateRoom}>Create</button>
      </div>
    </div>
  </div>
{/if}

{#if $activePMUser && !$gameState}
  <div class="pm-panel">
    <div class="pm-header">
      <span class="pm-title">💬 {$activePMUser.name}</span>
      <button class="pm-close" on:click={closePMChat}>✕</button>
    </div>
    <div class="pm-messages">
      {#each $privateMessages[$activePMUser.id] || [] as msg}
        <div class="pm-message" class:sent={msg.senderId === $user?.id}>
          <span class="pm-sender">{msg.senderId === $user?.id ? 'You' : msg.senderName}:</span>
          <span class="pm-content">{msg.content}</span>
        </div>
      {/each}
      {#if !($privateMessages[$activePMUser.id]?.length)}
        <p class="pm-empty">No messages yet. Say hi!</p>
      {/if}
    </div>
    <form class="pm-input" on:submit|preventDefault={handleSendPM}>
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

{#if showRules}
  <div class="modal-overlay" on:click={() => showRules = false}>
    <div class="rules-modal" on:click|stopPropagation>
      <div class="rules-header">
        <h2>🎴 Game Rules</h2>
        <button class="rules-close" on:click={() => showRules = false}>&times;</button>
      </div>
      <div class="rules-content">
        <section>
          <h3>Objective</h3>
          <p>Be the first player to empty your hand of all cards.</p>
        </section>
        <section>
          <h3>Setup</h3>
          <p>2–4 players (3 is optimal). Cards are dealt evenly from a standard 52-card deck.</p>
        </section>
        <section>
          <h3>Card Rankings</h3>
          <p><strong>Ranks</strong> (low → high): 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → J → Q → K → A → <em>2 (highest!)</em></p>
          <p><strong>Suits</strong> (low → high): ♦ → ♣ → ♥ → ♠</p>
          <p>When cards share the same rank, suit breaks the tie.</p>
        </section>
        <section>
          <h3>Valid Combinations</h3>
          <table class="rules-table">
            <tbody>
              <tr><td>Single</td><td>Any single card</td></tr>
              <tr><td>Pair</td><td>Two cards of same rank</td></tr>
              <tr><td>Triple</td><td>Three cards of same rank</td></tr>
              <tr><td>Straight</td><td>5 consecutive ranks (any suits)</td></tr>
              <tr><td>Flush</td><td>5 cards of same suit</td></tr>
              <tr><td>Full House</td><td>Three-of-a-kind + pair</td></tr>
              <tr><td>Four of a Kind</td><td>Four same rank + 1 kicker</td></tr>
              <tr><td>Straight Flush</td><td>5 consecutive, same suit</td></tr>
            </tbody>
          </table>
        </section>
        <section>
          <h3>Gameplay</h3>
          <ul>
            <li>Player with <strong>3♦</strong> goes first and must include it</li>
            <li>Beat the current play with the <strong>same type</strong> but <strong>higher value</strong>, or pass</li>
            <li>You cannot pass if you have <strong>control</strong> (were the last to play)</li>
            <li>When all other players pass, remaining player gains control and may lead any combo</li>
            <li><em>First to empty their hand wins!</em></li>
          </ul>
        </section>
        <section>
          <h3>Scoring</h3>
          <p><strong>Basic:</strong> Each card remaining = <em>1 point</em> paid to winner</p>
          <p><strong>Penalty:</strong> 10+ cards remaining = <em>2 points per card</em></p>
          <p class="scoring-multipliers"><strong>Multipliers (2x):</strong></p>
          <ul>
            <li>Unused 2s in your hand</li>
            <li>Unused four-of-a-kinds in your hand</li>
            <li>Unused straight flushes in your hand</li>
            <li>Winner finishes with a 2, four-of-a-kind, or straight flush</li>
          </ul>
        </section>
      </div>
    </div>
  </div>
{/if}

<style>
  .lobby-container {
    min-height: 100vh;
    background: var(--bg-darker);
  }

  .lobby-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 24px;
    background: var(--bg-dark);
    border-bottom: 1px solid rgba(212,175,55,0.2);
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .logo span {
    font-size: 1.8rem;
  }

  .logo h1 {
    font-size: 1.5rem;
    margin: 0;
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .username {
    color: var(--gold);
    font-weight: 600;
  }

  .guest-badge {
    background: rgba(255,255,255,0.1);
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.75rem;
    color: rgba(255,255,255,0.6);
  }

  .btn-sm {
    padding: 6px 12px;
    font-size: 0.8rem;
  }

  .lobby-main {
    padding: 24px;
    height: calc(100vh - 70px); /* Full viewport minus header */
    overflow: hidden;
  }

  .lobby-content {
    display: grid;
    grid-template-columns: 1fr 350px;
    gap: 24px;
    max-width: 1400px;
    margin: 0 auto;
    height: 100%;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .section-header h2 {
    margin: 0;
  }

  .join-by-code {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
  }

  .join-by-code input {
    flex: 1;
    text-transform: uppercase;
  }

  .main-section {
    overflow-y: auto;
    height: 100%;
  }

  .rooms-section {
    height: 100%;
  }

  .rooms-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .room-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    background: var(--bg-dark);
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.1);
  }

  .room-card h3 {
    margin: 0 0 4px;
    font-size: 1rem;
    color: white;
    font-family: inherit;
  }

  .room-card p {
    margin: 0;
    color: rgba(255,255,255,0.5);
    font-size: 0.85rem;
  }

  .sidebar {
    display: flex;
    flex-direction: column;
    gap: 16px;
    height: 100%;
    min-height: 0; /* Allow flex children to shrink */
  }

  .online-users, .chat-section {
    background: var(--bg-dark);
    border-radius: 8px;
    padding: 16px;
    border: 1px solid rgba(255,255,255,0.1);
  }

  .online-users {
    flex-shrink: 0; /* Don't shrink online users */
    max-height: 200px;
    overflow-y: auto;
  }

  .online-users h3, .chat-section h3 {
    margin: 0 0 12px;
    font-size: 0.9rem;
    color: var(--gold);
    font-family: inherit;
  }

  .online-users ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .online-users li {
    padding: 6px 0;
    color: rgba(255,255,255,0.8);
    font-size: 0.9rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .online-users li.in-game {
    opacity: 0.5;
  }

  .status-badge {
    font-size: 0.7rem;
    padding: 2px 6px;
    background: rgba(255,255,255,0.1);
    border-radius: 4px;
  }

  .chat-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0; /* Allow flex to shrink below content size */
    overflow: hidden;
  }

  .chat-messages {
    flex: 1;
    overflow-y: auto;
    margin-bottom: 12px;
    font-size: 0.85rem;
    min-height: 0; /* Enable scrolling within flex */
  }

  .chat-message {
    padding: 4px 0;
  }

  .chat-sender {
    color: var(--gold);
    font-weight: 500;
    margin-right: 6px;
  }

  .chat-content {
    color: rgba(255,255,255,0.8);
  }

  .chat-input {
    display: flex;
    gap: 8px;
  }

  .chat-input input {
    flex: 1;
  }

  /* Room View */
  .room-view {
    max-width: 800px;
    margin: 0 auto;
  }

  .room-header {
    text-align: center;
    margin-bottom: 32px;
  }

  .room-header h2 {
    margin: 16px 0 8px;
  }

  .room-code {
    color: rgba(255,255,255,0.6);
  }

  .room-code strong {
    color: var(--gold);
    font-size: 1.2rem;
    letter-spacing: 2px;
  }

  .room-visibility-badge {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 0.8rem;
    background: rgba(76, 175, 80, 0.2);
    color: #4CAF50;
    margin-bottom: 8px;
  }

  .room-visibility-badge.private {
    background: rgba(255, 152, 0, 0.2);
    color: #ff9800;
  }

  .copy-btn {
    background: none;
    border: 1px solid rgba(255,255,255,0.3);
    color: rgba(255,255,255,0.6);
    cursor: pointer;
    font-size: 0.8rem;
    padding: 4px 8px;
    border-radius: 4px;
    margin-left: 8px;
    transition: all 0.2s;
  }

  .copy-btn:hover {
    background: rgba(255,255,255,0.1);
    color: white;
  }

  .back-btn {
    background: none;
    border: none;
    color: rgba(255,255,255,0.6);
    cursor: pointer;
    font-size: 0.9rem;
  }

  .players-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
    margin-bottom: 32px;
  }

  .player-slot {
    background: var(--bg-dark);
    border-radius: 12px;
    padding: 20px;
    text-align: center;
    border: 2px solid rgba(255,255,255,0.1);
    transition: border-color 0.2s;
  }

  .player-slot.ready {
    border-color: #4CAF50;
  }

  .player-slot.host {
    border-color: var(--gold);
  }

  .player-slot.empty {
    opacity: 0.5;
  }

  .player-avatar {
    font-size: 2.5rem;
    margin-bottom: 8px;
  }

  .player-name {
    font-weight: 600;
    margin-bottom: 4px;
  }

  .host-badge {
    background: var(--gold);
    color: #1a1a1a;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.7rem;
    margin-left: 6px;
  }

  .ready-text {
    color: #4CAF50;
  }

  .waiting-text {
    color: rgba(255,255,255,0.4);
  }

  .countdown-text {
    color: #ff9800;
    font-size: 0.85rem;
    animation: pulse 1s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }

  .room-actions {
    text-align: center;
  }

  /* Modal */
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
    background: var(--bg-dark);
    border-radius: 16px;
    padding: 24px;
    width: 90%;
    max-width: 400px;
    border: 1px solid rgba(212,175,55,0.3);
  }

  .modal h2 {
    margin: 0 0 20px;
    text-align: center;
  }

  .form-group {
    margin-bottom: 16px;
  }

  .form-group label {
    display: block;
    margin-bottom: 6px;
    color: rgba(255,255,255,0.7);
    font-size: 0.9rem;
  }

  .form-group input[type="text"],
  .form-group select {
    width: 100%;
  }

  .form-group input[type="checkbox"] {
    margin-right: 8px;
  }

  .modal-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    margin-top: 24px;
  }

  .visibility-options {
    display: flex;
    gap: 8px;
  }

  .visibility-btn {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 12px;
    background: var(--bg-darker);
    border: 2px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    cursor: pointer;
    color: rgba(255,255,255,0.7);
    transition: all 0.2s;
    font-size: 0.9rem;
  }

  .visibility-btn:hover {
    border-color: rgba(255,255,255,0.3);
  }

  .visibility-btn.active {
    border-color: var(--gold);
    background: rgba(212,175,55,0.1);
    color: white;
  }

  .visibility-desc {
    font-size: 0.7rem;
    margin-top: 4px;
    opacity: 0.6;
  }

  /* Clickable users for PM */
  .online-users li.clickable {
    cursor: pointer;
    transition: background 0.2s;
  }

  .online-users li.clickable:hover {
    background: rgba(255,255,255,0.1);
  }

  .online-users li.has-unread {
    background: rgba(212,175,55,0.1);
  }

  .user-name-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .you-badge {
    font-size: 0.7rem;
    opacity: 0.5;
  }

  .unread-dot {
    width: 8px;
    height: 8px;
    background: var(--gold);
    border-radius: 50%;
    animation: pulse 1s infinite;
  }

  .pm-hint {
    font-size: 0.75rem;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .online-users li.clickable:hover .pm-hint {
    opacity: 0.6;
  }

  /* PM Panel */
  .pm-panel {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 320px;
    max-height: 400px;
    background: var(--bg-dark);
    border-radius: 12px;
    border: 1px solid rgba(212,175,55,0.3);
    display: flex;
    flex-direction: column;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    z-index: 50;
  }

  .pm-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid rgba(255,255,255,0.1);
  }

  .pm-title {
    font-weight: 600;
    color: var(--gold);
  }

  .pm-close {
    background: none;
    border: none;
    color: rgba(255,255,255,0.5);
    cursor: pointer;
    font-size: 1rem;
    padding: 4px;
  }

  .pm-close:hover {
    color: white;
  }

  .pm-messages {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px;
    max-height: 280px;
    min-height: 100px;
  }

  .pm-message {
    padding: 6px 0;
    font-size: 0.85rem;
  }

  .pm-message.sent .pm-sender {
    color: #4CAF50;
  }

  .pm-sender {
    color: var(--gold);
    font-weight: 500;
    margin-right: 6px;
  }

  .pm-content {
    color: rgba(255,255,255,0.8);
  }

  .pm-empty {
    color: rgba(255,255,255,0.4);
    font-size: 0.85rem;
    text-align: center;
    margin: 20px 0;
  }

  .pm-input {
    display: flex;
    gap: 8px;
    padding: 12px;
    border-top: 1px solid rgba(255,255,255,0.1);
  }

  .pm-input input {
    flex: 1;
    font-size: 0.85rem;
  }

  /* Rules Modal */
  .rules-modal {
    background: var(--bg-dark);
    border-radius: 16px;
    width: 90%;
    max-width: 600px;
    max-height: 80vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    border: 1px solid rgba(212,175,55,0.3);
  }

  .rules-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 24px;
    border-bottom: 1px solid rgba(255,255,255,0.1);
  }

  .rules-header h2 {
    margin: 0;
    font-size: 1.3rem;
  }

  .rules-close {
    background: none;
    border: none;
    color: rgba(255,255,255,0.5);
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0;
    line-height: 1;
  }

  .rules-close:hover {
    color: white;
  }

  .rules-content {
    padding: 24px;
    overflow-y: auto;
    flex: 1;
  }

  .rules-content section {
    margin-bottom: 20px;
  }

  .rules-content section:last-child {
    margin-bottom: 0;
  }

  .rules-content h3 {
    color: var(--gold);
    font-size: 1rem;
    margin: 0 0 8px;
    font-family: inherit;
  }

  .rules-content p {
    margin: 0 0 8px;
    color: rgba(255,255,255,0.8);
    font-size: 0.9rem;
    line-height: 1.5;
  }

  .rules-content ul {
    margin: 0;
    padding-left: 20px;
    color: rgba(255,255,255,0.8);
    font-size: 0.9rem;
    line-height: 1.6;
  }

  .rules-content li {
    margin-bottom: 6px;
  }

  .rules-content em {
    color: var(--gold);
    font-style: normal;
  }

  .rules-content .scoring-multipliers {
    margin-top: 12px;
    margin-bottom: 4px;
  }

  .rules-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }

  .rules-table td {
    padding: 8px 12px;
    border-bottom: 1px solid rgba(255,255,255,0.1);
  }

  .rules-table td:first-child {
    font-weight: 600;
    color: white;
    width: 140px;
  }

  .rules-table td:last-child {
    color: rgba(255,255,255,0.7);
  }

  .rules-table tr:last-child td {
    border-bottom: none;
  }

  @media (max-width: 900px) {
    .lobby-content {
      grid-template-columns: 1fr;
    }

    .players-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
