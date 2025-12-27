<script lang="ts">
  import type { Card as CardType } from '../game/types';
  import Card from './Card.svelte';

  interface Props {
    currentPlay: CardType[] | null;
    currentPlayType: string | null;
    lastPlayerName: string | null;
  }

  let { currentPlay, currentPlayType, lastPlayerName }: Props = $props();
</script>

<div class="play-zone">
  <div class="play-info">
    {#if lastPlayerName}
      <span class="player-name">{lastPlayerName}</span>
      {#if currentPlayType}
        <span class="play-type">played {currentPlayType}</span>
      {/if}
    {:else}
      <span class="waiting">Waiting for play...</span>
    {/if}
  </div>

  <div class="played-cards">
    {#if currentPlay && currentPlay.length > 0}
      {#each currentPlay as card, i}
        <div class="played-card" style="--index: {i}">
          <Card {card} />
        </div>
      {/each}
    {:else}
      <div class="empty-play">
        <span>No cards played</span>
      </div>
    {/if}
  </div>
</div>

<style>
  .play-zone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    min-height: 0;
    padding: 4px;
    background: radial-gradient(ellipse at center, rgba(212,175,55,0.1) 0%, transparent 70%);
    border-radius: 8px;
    border: 2px dashed rgba(212,175,55,0.3);
  }

  .play-info {
    margin-bottom: 4px;
    text-align: center;
    font-size: 0.75rem;
  }

  .player-name {
    color: var(--gold, #d4af37);
    font-weight: 600;
  }

  .play-type {
    color: rgba(255,255,255,0.6);
    margin-left: 6px;
  }

  .waiting {
    color: rgba(255,255,255,0.4);
    font-style: italic;
  }

  .played-cards {
    display: flex;
    justify-content: center;
    gap: 4px;
    align-items: center;
  }

  .played-card {
    transform: rotate(calc((var(--index) - 2) * 3deg));
  }

  .empty-play {
    padding: 20px 30px;
    border-radius: 8px;
    background: rgba(0,0,0,0.2);
    color: rgba(255,255,255,0.3);
    font-size: 0.85rem;
  }

  /* Mobile adjustments */
  @media (max-width: 480px) {
    .play-zone {
      padding: 6px;
      border-radius: 8px;
    }

    .play-info {
      margin-bottom: 6px;
      font-size: 0.75rem;
    }

    .play-type {
      margin-left: 4px;
    }

    .played-cards {
      gap: 2px;
    }

    .empty-play {
      padding: 12px 20px;
      font-size: 0.7rem;
    }
  }

  /* Very small screens */
  @media (max-height: 500px) {
    .play-zone {
      padding: 4px;
    }

    .play-info {
      margin-bottom: 4px;
      font-size: 0.65rem;
    }

    .empty-play {
      padding: 8px 14px;
      font-size: 0.6rem;
    }
  }
</style>
