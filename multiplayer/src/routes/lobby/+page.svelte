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
  import Icon from '$lib/components/Icon.svelte';
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
      <div class="logo-icon">
        <Icon name="playing-cards" size="lg" />
      </div>
      <h1>Big Two</h1>
    </div>
    <div class="user-info">
      <span class="connection-status" class:connected={$connected}>
        <span class="status-dot" class:online={$connected}></span>
      </span>
      <span class="username">{$user?.username || 'Guest'}</span>
      {#if $user?.isGuest}
        <span class="badge badge-muted">Guest</span>
      {/if}
      <button class="btn btn-secondary btn-sm" on:click={() => showRules = true}>
        <Icon name="book" size="sm" />
        Rules
      </button>
      <a href="/leaderboard" class="btn btn-secondary btn-sm">
        <Icon name="trophy" size="sm" />
        Leaderboard
      </a>
      <button class="btn btn-secondary btn-sm" on:click={handleLogout}>
        <Icon name="logout" size="sm" />
        Logout
      </button>
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
                <button class="back-btn" on:click={leaveRoom}>
                  <Icon name="arrow-left" size="sm" />
                  Back to Lobby
                </button>
                <h2>{$currentRoom.name}</h2>
                <div class="room-visibility-badge" class:private={$currentRoom.settings.isPrivate}>
                  {#if $currentRoom.settings.isPrivate}
                    <Icon name="lock" size="sm" />
                    Invite Only
                  {:else}
                    <Icon name="world" size="sm" />
                    Open
                  {/if}
                </div>
                <div class="room-code">
                  Code: <strong>{$currentRoom.code}</strong>
                  <button class="copy-btn" on:click={() => navigator.clipboard.writeText($currentRoom?.code || '')}>
                    <Icon name="copy" size="sm" />
                    Copy
                  </button>
                </div>
              </div>

              <div class="players-grid">
                {#each $currentRoom.players as player, i}
                  <div class="player-slot" class:ready={player.isReady} class:host={player.isHost}>
                    <div class="player-avatar">
                      {#if player.isAi}
                        <Icon name="robot" size="xl" />
                      {:else}
                        <Icon name="user" size="xl" />
                      {/if}
                    </div>
                    <div class="player-name">
                      {player.name}
                      {#if player.isHost}<span class="host-badge">Host</span>{/if}
                    </div>
                    <div class="player-status">
                      {#if player.isAi}
                        <span class="ready-text"><Icon name="check" size="sm" /> Ready</span>
                      {:else if player.isReady}
                        <span class="ready-text"><Icon name="check" size="sm" /> Ready</span>
                      {:else if $readyCountdowns[player.id] !== undefined}
                        <span class="countdown-text"><Icon name="clock" size="sm" /> Auto-ready in {$readyCountdowns[player.id]}s</span>
                      {:else}
                        <span class="waiting-text"><Icon name="loader" size="sm" class="spin" /> Waiting...</span>
                      {/if}
                    </div>
                  </div>
                {/each}

                {#each Array($currentRoom.settings.maxPlayers - $currentRoom.players.length) as _, i}
                  <div class="player-slot empty">
                    <div class="player-avatar empty-avatar">
                      <Icon name="help" size="xl" />
                    </div>
                    <div class="player-name">Empty Slot</div>
                    {#if $currentRoom.hostId === $user?.id}
                      <button class="btn btn-secondary btn-sm" on:click={() => addAi($currentRoom?.id || '')}>
                        <Icon name="plus" size="sm" />
                        Add AI
                      </button>
                    {/if}
                  </div>
                {/each}
              </div>

              <div class="room-actions">
                {#if $currentRoom.hostId === $user?.id}
                  <button
                    class="btn btn-gold"
                    on:click={() => startGame($currentRoom?.id || '')}
                    disabled={$currentRoom.players.length < 2}
                  >
                    <Icon name="play" size="sm" />
                    Start Game
                  </button>
                {:else}
                  <button
                    class="btn btn-success"
                    on:click={() => toggleReady($currentRoom?.id || '', !$currentRoom?.players.find(p => p.id === $user?.id)?.isReady)}
                  >
                    {#if $currentRoom.players.find(p => p.id === $user?.id)?.isReady}
                      <Icon name="x" size="sm" />
                      Not Ready
                    {:else}
                      <Icon name="check" size="sm" />
                      Ready
                    {/if}
                  </button>
                {/if}
              </div>
            </div>
          {:else}
            <!-- Lobby Rooms List -->
            <div class="rooms-section">
              <div class="section-header">
                <h2><Icon name="device-gamepad-2" size="lg" /> Game Rooms</h2>
                <button class="btn btn-primary" on:click={() => showCreateRoom = true}>
                  <Icon name="plus" size="sm" />
                  Create Room
                </button>
              </div>

              <div class="join-by-code">
                <input
                  type="text"
                  bind:value={joinCode}
                  placeholder="Enter room code..."
                  maxlength="6"
                />
                <button class="btn btn-secondary" on:click={handleJoinByCode}>
                  <Icon name="door-enter" size="sm" />
                  Join
                </button>
              </div>

              <div class="rooms-list">
                {#if $lobbyState.rooms.length === 0}
                  <div class="empty-state">
                    <Icon name="device-gamepad-2" size={48} class="text-muted" />
                    <p>No rooms available</p>
                    <p class="subtext">Create one to get started!</p>
                  </div>
                {:else}
                  {#each $lobbyState.rooms as room}
                    <div class="room-card">
                      <div class="room-info">
                        <h3>{room.name}</h3>
                        <p>
                          <Icon name="users" size="sm" />
                          {room.players.length}/{room.settings.maxPlayers} players
                        </p>
                      </div>
                      <button
                        class="btn btn-secondary"
                        on:click={() => joinRoom(room.id)}
                        disabled={room.status !== 'waiting'}
                      >
                        {#if room.status === 'waiting'}
                          <Icon name="door-enter" size="sm" />
                          Join
                        {:else if room.status === 'finished'}
                          <Icon name="circle-check" size="sm" />
                          Finished
                        {:else}
                          <Icon name="play" size="sm" />
                          In Game
                        {/if}
                      </button>
                    </div>
                  {/each}
                {/if}
              </div>
            </div>
          {/if}
        </div>

        <div class="sidebar">
          <div class="panel online-users">
            <div class="panel-header">
              <Icon name="users" size="sm" />
              <h3>Online ({$lobbyState.users.length})</h3>
            </div>
            <ul>
              {#each $lobbyState.users as onlineUser}
                <li
                  class:in-game={onlineUser.status === 'in-game'}
                  class:clickable={onlineUser.id !== $user?.id}
                  class:has-unread={$unreadPMs.has(onlineUser.id)}
                  on:click={() => handleClickUser(onlineUser.id, onlineUser.name)}
                >
                  <span class="user-name-row">
                    <span class="status-dot" class:online={onlineUser.status !== 'in-game'} class:busy={onlineUser.status === 'in-game'}></span>
                    {onlineUser.name}
                    {#if onlineUser.id === $user?.id}
                      <span class="you-badge">(you)</span>
                    {/if}
                    {#if $unreadPMs.has(onlineUser.id)}
                      <span class="unread-indicator"></span>
                    {/if}
                  </span>
                  {#if onlineUser.status === 'in-game'}
                    <span class="badge badge-muted">In Game</span>
                  {:else if onlineUser.id !== $user?.id}
                    <Icon name="message" size="sm" class="pm-hint" />
                  {/if}
                </li>
              {/each}
            </ul>
          </div>

          <div class="panel chat-section">
            <div class="panel-header">
              <Icon name="message-circle" size="sm" />
              <h3>{$currentRoom ? `${$currentRoom.name} Chat` : 'Lobby Chat'}</h3>
            </div>
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
              <button type="submit" class="btn btn-primary btn-sm">
                <Icon name="send" size="sm" />
              </button>
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
            <Icon name="world" size="lg" />
            Open
            <span class="visibility-desc">Anyone can join</span>
          </button>
          <button
            type="button"
            class="visibility-btn"
            class:active={isPrivate}
            on:click={() => isPrivate = true}
          >
            <Icon name="lock" size="lg" />
            Invite Only
            <span class="visibility-desc">Requires room code</span>
          </button>
        </div>
      </div>

      <div class="form-group checkbox-group">
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
        <button class="btn btn-primary" on:click={handleCreateRoom}>
          <Icon name="plus" size="sm" />
          Create
        </button>
      </div>
    </div>
  </div>
{/if}

{#if $activePMUser && !$gameState}
  <div class="pm-panel">
    <div class="pm-header">
      <span class="pm-title"><Icon name="message" size="sm" /> {$activePMUser.name}</span>
      <button class="pm-close" on:click={closePMChat}><Icon name="x" size="sm" /></button>
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
      <button type="submit" class="btn btn-primary btn-sm"><Icon name="send" size="sm" /></button>
    </form>
  </div>
{/if}

{#if showRules}
  <div class="modal-overlay" on:click={() => showRules = false}>
    <div class="rules-modal" on:click|stopPropagation>
      <div class="rules-header">
        <h2><Icon name="book" size="lg" /> Game Rules</h2>
        <button class="rules-close" on:click={() => showRules = false}><Icon name="x" size="lg" /></button>
      </div>
      <div class="rules-content">
        <section>
          <h3>Objective</h3>
          <p>Be the first player to empty your hand of all cards.</p>
        </section>
        <section>
          <h3>Setup</h3>
          <p>2-4 players (3 is optimal). Cards are dealt evenly from a standard 52-card deck.</p>
        </section>
        <section>
          <h3>Card Rankings</h3>
          <p><strong>Ranks</strong> (low to high): 3 - 4 - 5 - 6 - 7 - 8 - 9 - 10 - J - Q - K - A - <em>2 (highest!)</em></p>
          <p><strong>Suits</strong> (low to high): Diamonds - Clubs - Hearts - Spades</p>
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
            <li>Player with <strong>3 of Diamonds</strong> goes first and must include it</li>
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
    background: var(--bg-darkest);
  }

  .lobby-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 24px;
    background: var(--bg-dark);
    border-bottom: 1px solid var(--border-subtle);
    box-shadow: var(--shadow-md);
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .logo-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%);
    border-radius: 10px;
    color: white;
  }

  .logo h1 {
    font-size: 1.25rem;
    margin: 0;
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .connection-status {
    display: flex;
    align-items: center;
  }

  .username {
    color: var(--gold);
    font-weight: 600;
  }

  .lobby-main {
    padding: 24px;
    height: calc(100vh - 70px);
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
    margin-bottom: 20px;
  }

  .section-header h2 {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0;
    font-size: 1.25rem;
  }

  .join-by-code {
    display: flex;
    gap: 8px;
    margin-bottom: 20px;
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

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    color: var(--text-muted);
    text-align: center;
  }

  .empty-state p {
    margin: 16px 0 0;
    font-size: 1.1rem;
  }

  .empty-state .subtext {
    font-size: 0.9rem;
    opacity: 0.7;
    margin-top: 4px;
  }

  .room-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    background: var(--bg-dark);
    border-radius: 12px;
    border: 1px solid var(--border-subtle);
    transition: all 0.2s;
  }

  .room-card:hover {
    border-color: var(--border-light);
    box-shadow: var(--shadow-md);
  }

  .room-card h3 {
    margin: 0 0 4px;
    font-size: 1rem;
    color: var(--text-primary);
    font-family: 'Inter', sans-serif;
  }

  .room-card p {
    margin: 0;
    color: var(--text-muted);
    font-size: 0.85rem;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .sidebar {
    display: flex;
    flex-direction: column;
    gap: 16px;
    height: 100%;
    min-height: 0;
  }

  .online-users {
    flex-shrink: 0;
    max-height: 200px;
    overflow-y: auto;
  }

  .online-users ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .online-users li {
    padding: 8px 0;
    color: var(--text-secondary);
    font-size: 0.875rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-radius: 6px;
    transition: background 0.2s;
  }

  .online-users li.in-game {
    opacity: 0.5;
  }

  .online-users li.clickable {
    cursor: pointer;
    padding: 8px;
    margin: 0 -8px;
  }

  .online-users li.clickable:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .online-users li.has-unread {
    background: var(--accent-primary-glow);
  }

  .user-name-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .you-badge {
    font-size: 0.7rem;
    opacity: 0.5;
  }

  .unread-indicator {
    width: 8px;
    height: 8px;
    background: var(--accent-primary);
    border-radius: 50%;
    animation: pulse 1.5s infinite;
  }

  :global(.pm-hint) {
    opacity: 0;
    transition: opacity 0.2s;
    color: var(--text-muted);
  }

  .online-users li.clickable:hover :global(.pm-hint) {
    opacity: 0.6;
  }

  .chat-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .chat-messages {
    flex: 1;
    overflow-y: auto;
    margin-bottom: 12px;
    font-size: 0.85rem;
    min-height: 0;
  }

  .chat-message {
    padding: 4px 0;
  }

  .chat-sender {
    color: var(--accent-primary);
    font-weight: 500;
    margin-right: 6px;
  }

  .chat-content {
    color: var(--text-secondary);
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
    margin: 16px 0 12px;
  }

  .room-code {
    color: var(--text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .room-code strong {
    color: var(--gold);
    font-size: 1.2rem;
    letter-spacing: 3px;
    font-family: 'Orbitron', monospace;
  }

  .room-visibility-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: 500;
    background: var(--success-glow);
    color: var(--success);
    margin-bottom: 8px;
  }

  .room-visibility-badge.private {
    background: rgba(245, 158, 11, 0.15);
    color: var(--warning);
  }

  .copy-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: transparent;
    border: 1px solid var(--border-light);
    color: var(--text-muted);
    cursor: pointer;
    font-size: 0.8rem;
    padding: 4px 10px;
    border-radius: 6px;
    transition: all 0.2s;
  }

  .copy-btn:hover {
    background: rgba(255, 255, 255, 0.05);
    color: var(--text-primary);
    border-color: var(--accent-primary);
  }

  .back-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 0.9rem;
    transition: color 0.2s;
  }

  .back-btn:hover {
    color: var(--text-primary);
  }

  .players-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
    margin-bottom: 32px;
  }

  .player-slot {
    background: var(--bg-dark);
    border-radius: 16px;
    padding: 24px;
    text-align: center;
    border: 2px solid var(--border-subtle);
    transition: all 0.3s;
  }

  .player-slot.ready {
    border-color: var(--success);
    box-shadow: 0 0 15px var(--success-glow);
  }

  .player-slot.host {
    border-color: var(--gold);
    box-shadow: 0 0 15px var(--gold-glow);
  }

  .player-slot.empty {
    opacity: 0.5;
  }

  .player-avatar {
    color: var(--accent-primary);
    margin-bottom: 12px;
  }

  .player-avatar.empty-avatar {
    color: var(--text-muted);
  }

  .player-name {
    font-weight: 600;
    margin-bottom: 8px;
  }

  .host-badge {
    background: var(--gold);
    color: var(--bg-darkest);
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.7rem;
    margin-left: 6px;
  }

  .ready-text {
    color: var(--success);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
  }

  .waiting-text {
    color: var(--text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
  }

  .countdown-text {
    color: var(--warning);
    font-size: 0.85rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    animation: pulse 1s infinite;
  }

  .room-actions {
    text-align: center;
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .modal {
    background: var(--bg-dark);
    border-radius: 16px;
    padding: 28px;
    width: 90%;
    max-width: 420px;
    border: 1px solid var(--border-light);
    box-shadow: var(--shadow-lg);
  }

  .modal h2 {
    margin: 0 0 24px;
    text-align: center;
    font-size: 1.25rem;
  }

  .form-group {
    margin-bottom: 20px;
  }

  .form-group label {
    display: block;
    margin-bottom: 8px;
    color: var(--text-secondary);
    font-size: 0.875rem;
    font-weight: 500;
  }

  .form-group input[type="text"],
  .form-group select {
    width: 100%;
  }

  .checkbox-group label {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
  }

  .modal-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    margin-top: 28px;
  }

  .visibility-options {
    display: flex;
    gap: 12px;
  }

  .visibility-btn {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16px;
    background: var(--bg-darker);
    border: 2px solid var(--border-subtle);
    border-radius: 12px;
    cursor: pointer;
    color: var(--text-muted);
    transition: all 0.2s;
    font-size: 0.9rem;
  }

  .visibility-btn:hover {
    border-color: var(--border-light);
  }

  .visibility-btn.active {
    border-color: var(--accent-primary);
    background: var(--accent-primary-glow);
    color: var(--text-primary);
  }

  .visibility-desc {
    font-size: 0.7rem;
    margin-top: 6px;
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
    border-radius: 16px;
    border: 1px solid var(--border-light);
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-lg);
    z-index: 50;
  }

  .pm-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 18px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .pm-title {
    font-weight: 600;
    color: var(--accent-primary);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .pm-close {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px;
    transition: color 0.2s;
  }

  .pm-close:hover {
    color: var(--text-primary);
  }

  .pm-messages {
    flex: 1;
    overflow-y: auto;
    padding: 14px 18px;
    max-height: 280px;
    min-height: 100px;
  }

  .pm-message {
    padding: 6px 0;
    font-size: 0.85rem;
  }

  .pm-message.sent .pm-sender {
    color: var(--success);
  }

  .pm-sender {
    color: var(--accent-primary);
    font-weight: 500;
    margin-right: 6px;
  }

  .pm-content {
    color: var(--text-secondary);
  }

  .pm-empty {
    color: var(--text-muted);
    font-size: 0.85rem;
    text-align: center;
    margin: 20px 0;
  }

  .pm-input {
    display: flex;
    gap: 8px;
    padding: 14px;
    border-top: 1px solid var(--border-subtle);
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
    border: 1px solid var(--border-light);
    box-shadow: var(--shadow-lg);
  }

  .rules-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 18px 24px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .rules-header h2 {
    margin: 0;
    font-size: 1.25rem;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .rules-close {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px;
    transition: color 0.2s;
  }

  .rules-close:hover {
    color: var(--text-primary);
  }

  .rules-content {
    padding: 24px;
    overflow-y: auto;
    flex: 1;
  }

  .rules-content section {
    margin-bottom: 24px;
  }

  .rules-content section:last-child {
    margin-bottom: 0;
  }

  .rules-content h3 {
    color: var(--accent-primary);
    font-size: 1rem;
    margin: 0 0 10px;
    font-family: 'Inter', sans-serif;
  }

  .rules-content p {
    margin: 0 0 8px;
    color: var(--text-secondary);
    font-size: 0.9rem;
    line-height: 1.6;
  }

  .rules-content ul {
    margin: 0;
    padding-left: 20px;
    color: var(--text-secondary);
    font-size: 0.9rem;
    line-height: 1.7;
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
    margin-bottom: 6px;
  }

  .rules-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }

  .rules-table td {
    padding: 10px 14px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .rules-table td:first-child {
    font-weight: 600;
    color: var(--text-primary);
    width: 140px;
  }

  .rules-table td:last-child {
    color: var(--text-secondary);
  }

  .rules-table tr:last-child td {
    border-bottom: none;
  }

  /* Spin animation */
  :global(.spin) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @media (max-width: 900px) {
    .lobby-content {
      grid-template-columns: 1fr;
    }

    .players-grid {
      grid-template-columns: 1fr;
    }

    .lobby-header {
      flex-wrap: wrap;
      gap: 12px;
    }

    .user-info {
      flex-wrap: wrap;
      justify-content: center;
    }
  }
</style>
