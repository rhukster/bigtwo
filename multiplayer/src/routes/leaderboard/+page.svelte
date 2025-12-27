<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import Icon from '$lib/components/Icon.svelte';

  interface LeaderboardEntry {
    user_id: string;
    username: string;
    total_games: number;
    wins: number;
    total_points: number;
    current_streak: number;
    best_streak: number;
  }

  let leaderboard: LeaderboardEntry[] = [];
  let loading = true;
  let error = '';

  onMount(async () => {
    try {
      const res = await fetch('/api/leaderboard');
      const data = await res.json();
      if (data.leaderboard) {
        leaderboard = data.leaderboard;
      }
    } catch (e) {
      error = 'Failed to load leaderboard';
    } finally {
      loading = false;
    }
  });

  function getWinRate(entry: LeaderboardEntry): string {
    if (entry.total_games === 0) return '0%';
    return Math.round((entry.wins / entry.total_games) * 100) + '%';
  }
</script>

<svelte:head>
  <title>Leaderboard - Big Two</title>
</svelte:head>

<div class="leaderboard-container">
  <header class="leaderboard-header">
    <button class="back-btn" on:click={() => goto('/lobby')}>
      <Icon name="arrow-left" size="sm" />
      Back to Lobby
    </button>
    <div class="logo">
      <div class="logo-icon">
        <Icon name="trophy" size="lg" />
      </div>
      <h1>Leaderboard</h1>
    </div>
    <div class="spacer"></div>
  </header>

  <main class="leaderboard-main">
    {#if loading}
      <div class="loading">
        <Icon name="loader" size={48} class="spin" />
        <p>Loading leaderboard...</p>
      </div>
    {:else if error}
      <div class="error-state">
        <Icon name="alert-circle" size={48} />
        <p>{error}</p>
      </div>
    {:else if leaderboard.length === 0}
      <div class="empty-state">
        <Icon name="trophy" size={64} />
        <p>No games played yet!</p>
        <p class="subtext">Be the first to climb the ranks.</p>
        <button class="btn btn-primary" on:click={() => goto('/lobby')}>
          <Icon name="device-gamepad-2" size="sm" />
          Start Playing
        </button>
      </div>
    {:else}
      <div class="leaderboard-table-wrapper">
        <table class="leaderboard-table">
          <thead>
            <tr>
              <th class="rank-col">Rank</th>
              <th class="name-col">Player</th>
              <th class="points-col">Points</th>
              <th class="games-col">Games</th>
              <th class="wins-col">Wins</th>
              <th class="rate-col">Win Rate</th>
              <th class="streak-col">Best Streak</th>
            </tr>
          </thead>
          <tbody>
            {#each leaderboard as entry, i}
              <tr class:gold={i === 0} class:silver={i === 1} class:bronze={i === 2}>
                <td class="rank-col">
                  {#if i === 0}
                    <span class="medal gold-medal">
                      <Icon name="crown" size="lg" />
                    </span>
                  {:else if i === 1}
                    <span class="medal silver-medal">
                      <Icon name="medal" size="lg" />
                    </span>
                  {:else if i === 2}
                    <span class="medal bronze-medal">
                      <Icon name="award" size="lg" />
                    </span>
                  {:else}
                    <span class="rank-num">{i + 1}</span>
                  {/if}
                </td>
                <td class="name-col">{entry.username}</td>
                <td class="points-col">{entry.total_points.toLocaleString()}</td>
                <td class="games-col">{entry.total_games}</td>
                <td class="wins-col">{entry.wins}</td>
                <td class="rate-col">{getWinRate(entry)}</td>
                <td class="streak-col">
                  {#if entry.best_streak > 0}
                    <span class="streak">
                      <Icon name="flame" size="sm" />
                      {entry.best_streak}
                    </span>
                  {:else}
                    <span class="no-streak">-</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </main>
</div>

<style>
  .leaderboard-container {
    min-height: 100vh;
    background: var(--bg-darkest);
  }

  .leaderboard-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 24px;
    background: var(--bg-dark);
    border-bottom: 1px solid var(--border-subtle);
    box-shadow: var(--shadow-md);
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
    padding: 8px 12px;
    transition: color 0.2s;
  }

  .back-btn:hover {
    color: var(--text-primary);
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
    background: linear-gradient(135deg, var(--gold) 0%, var(--gold-dark) 100%);
    border-radius: 10px;
    color: var(--bg-darkest);
    box-shadow: 0 4px 16px var(--gold-glow);
  }

  .logo h1 {
    font-size: 1.25rem;
    margin: 0;
  }

  .spacer {
    width: 120px;
  }

  .leaderboard-main {
    padding: 32px 24px;
    max-width: 1000px;
    margin: 0 auto;
  }

  .loading, .error-state, .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 80px 20px;
    text-align: center;
  }

  .loading {
    color: var(--text-muted);
  }

  .loading p {
    margin-top: 16px;
    color: var(--text-muted);
  }

  .error-state {
    color: var(--danger);
  }

  .error-state p {
    margin-top: 16px;
  }

  .empty-state {
    color: var(--text-muted);
  }

  .empty-state p {
    margin: 16px 0 0;
    font-size: 1.2rem;
    color: var(--text-secondary);
  }

  .empty-state .subtext {
    font-size: 0.9rem;
    opacity: 0.7;
    margin: 8px 0 24px;
  }

  .leaderboard-table-wrapper {
    background: var(--bg-dark);
    border-radius: 16px;
    border: 1px solid var(--border-subtle);
    overflow: hidden;
    box-shadow: var(--shadow-lg);
  }

  .leaderboard-table {
    width: 100%;
    border-collapse: collapse;
  }

  .leaderboard-table th,
  .leaderboard-table td {
    padding: 16px 18px;
    text-align: left;
  }

  .leaderboard-table th {
    background: var(--bg-medium);
    color: var(--text-muted);
    font-weight: 600;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .leaderboard-table td {
    border-bottom: 1px solid var(--border-subtle);
    color: var(--text-secondary);
  }

  .leaderboard-table tbody tr:last-child td {
    border-bottom: none;
  }

  .leaderboard-table tbody tr {
    transition: background 0.2s;
  }

  .leaderboard-table tbody tr:hover {
    background: rgba(255, 255, 255, 0.02);
  }

  .leaderboard-table tr.gold {
    background: linear-gradient(90deg, rgba(251, 191, 36, 0.15) 0%, transparent 100%);
  }

  .leaderboard-table tr.gold:hover {
    background: linear-gradient(90deg, rgba(251, 191, 36, 0.2) 0%, transparent 100%);
  }

  .leaderboard-table tr.silver {
    background: linear-gradient(90deg, rgba(192, 192, 192, 0.1) 0%, transparent 100%);
  }

  .leaderboard-table tr.bronze {
    background: linear-gradient(90deg, rgba(205, 127, 50, 0.1) 0%, transparent 100%);
  }

  .rank-col {
    width: 80px;
    text-align: center !important;
  }

  .name-col {
    font-weight: 600;
    color: var(--text-primary) !important;
  }

  .points-col {
    color: var(--gold) !important;
    font-weight: 700;
    font-family: 'Orbitron', monospace;
  }

  .games-col, .wins-col, .rate-col, .streak-col {
    text-align: center !important;
    width: 100px;
  }

  .medal {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .gold-medal {
    color: var(--gold);
    filter: drop-shadow(0 2px 4px var(--gold-glow));
  }

  .silver-medal {
    color: #c0c0c0;
    filter: drop-shadow(0 2px 4px rgba(192, 192, 192, 0.4));
  }

  .bronze-medal {
    color: #cd7f32;
    filter: drop-shadow(0 2px 4px rgba(205, 127, 50, 0.4));
  }

  .rank-num {
    color: var(--text-muted);
    font-weight: 600;
    font-size: 0.9rem;
  }

  .streak {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: #f97316;
  }

  .no-streak {
    color: var(--text-muted);
  }

  /* Spin animation */
  :global(.spin) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @media (max-width: 768px) {
    .leaderboard-header {
      flex-wrap: wrap;
      gap: 12px;
    }

    .spacer {
      display: none;
    }

    .leaderboard-table th,
    .leaderboard-table td {
      padding: 12px 10px;
      font-size: 0.85rem;
    }

    .games-col, .rate-col {
      display: none;
    }
  }
</style>
