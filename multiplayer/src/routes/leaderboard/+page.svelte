<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

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
      ← Back to Lobby
    </button>
    <div class="logo">
      <span>🏆</span>
      <h1>Leaderboard</h1>
    </div>
    <div class="spacer"></div>
  </header>

  <main class="leaderboard-main">
    {#if loading}
      <div class="loading">Loading leaderboard...</div>
    {:else if error}
      <div class="error">{error}</div>
    {:else if leaderboard.length === 0}
      <div class="empty">
        <p>No games played yet!</p>
        <p class="subtext">Be the first to climb the ranks.</p>
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
                    <span class="medal">🥇</span>
                  {:else if i === 1}
                    <span class="medal">🥈</span>
                  {:else if i === 2}
                    <span class="medal">🥉</span>
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
                    🔥 {entry.best_streak}
                  {:else}
                    -
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
    background: var(--bg-darker);
  }

  .leaderboard-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 24px;
    background: var(--bg-dark);
    border-bottom: 1px solid rgba(212,175,55,0.2);
  }

  .back-btn {
    background: none;
    border: none;
    color: rgba(255,255,255,0.6);
    cursor: pointer;
    font-size: 0.9rem;
    padding: 8px 12px;
    transition: color 0.2s;
  }

  .back-btn:hover {
    color: white;
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

  .spacer {
    width: 120px;
  }

  .leaderboard-main {
    padding: 24px;
    max-width: 1000px;
    margin: 0 auto;
  }

  .loading, .error, .empty {
    text-align: center;
    padding: 60px 20px;
    color: rgba(255,255,255,0.6);
  }

  .error {
    color: #ff6b6b;
  }

  .empty p {
    margin: 0 0 8px;
    font-size: 1.2rem;
  }

  .empty .subtext {
    font-size: 0.9rem;
    opacity: 0.6;
  }

  .leaderboard-table-wrapper {
    background: var(--bg-dark);
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.1);
    overflow: hidden;
  }

  .leaderboard-table {
    width: 100%;
    border-collapse: collapse;
  }

  .leaderboard-table th,
  .leaderboard-table td {
    padding: 14px 16px;
    text-align: left;
  }

  .leaderboard-table th {
    background: rgba(0,0,0,0.3);
    color: rgba(255,255,255,0.6);
    font-weight: 500;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .leaderboard-table td {
    border-top: 1px solid rgba(255,255,255,0.05);
    color: rgba(255,255,255,0.8);
  }

  .leaderboard-table tr:hover td {
    background: rgba(255,255,255,0.03);
  }

  .leaderboard-table tr.gold td {
    background: rgba(255, 215, 0, 0.08);
  }

  .leaderboard-table tr.silver td {
    background: rgba(192, 192, 192, 0.05);
  }

  .leaderboard-table tr.bronze td {
    background: rgba(205, 127, 50, 0.05);
  }

  .rank-col {
    width: 60px;
    text-align: center !important;
  }

  .name-col {
    font-weight: 600;
    color: white !important;
  }

  .points-col {
    color: var(--gold) !important;
    font-weight: 600;
  }

  .games-col, .wins-col, .rate-col, .streak-col {
    text-align: center !important;
    width: 100px;
  }

  .medal {
    font-size: 1.2rem;
  }

  .rank-num {
    color: rgba(255,255,255,0.4);
    font-weight: 500;
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
      padding: 10px 8px;
      font-size: 0.85rem;
    }

    .games-col, .rate-col {
      display: none;
    }
  }
</style>
