<script lang="ts">
  import type { Card as CardType, Play } from '../game/types';
  import Card from './Card.svelte';

  interface Props {
    currentPlay: CardType[] | null;
    currentPlayType: string | null;
    lastPlayerName: string | null;
    playHistory?: Play[];
  }

  let { currentPlay, currentPlayType, lastPlayerName, playHistory = [] }: Props = $props();

  // Get all plays to show (last 4, including current)
  let allPlays = $derived(
    playHistory.length > 0
      ? playHistory.slice(-4)
      : []
  );

  // Generate consistent random offset based on play timestamp
  function getRandomOffset(timestamp: number, index: number) {
    // Use timestamp as seed for consistent positioning
    const seed = timestamp + index * 1000;
    const pseudoRandom = (n: number) => {
      const x = Math.sin(n) * 10000;
      return x - Math.floor(x);
    };

    return {
      x: (pseudoRandom(seed) - 0.5) * 60, // -30 to 30 px
      y: (pseudoRandom(seed + 1) - 0.5) * 40, // -20 to 20 px
      rotation: (pseudoRandom(seed + 2) - 0.5) * 20, // -10 to 10 degrees
    };
  }
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

  <div class="play-pile">
    {#if allPlays.length === 0 && (!currentPlay || currentPlay.length === 0)}
      <div class="empty-play">
        <span>No cards played</span>
      </div>
    {:else}
      {#each allPlays as play, playIndex}
        {@const offset = getRandomOffset(play.timestamp, playIndex)}
        {@const isCurrentPlay = playIndex === allPlays.length - 1}
        {@const depth = allPlays.length - 1 - playIndex}
        <div
          class="pile-layer"
          class:current={isCurrentPlay}
          style="
            --offset-x: {offset.x}px;
            --offset-y: {offset.y}px;
            --rotation: {offset.rotation}deg;
            --depth: {depth};
            z-index: {playIndex};
          "
        >
          {#each play.cards as card, cardIndex}
            <div class="piled-card" style="--card-index: {cardIndex}; --card-count: {play.cards.length}">
              <Card {card} />
            </div>
          {/each}
        </div>
      {/each}
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
    position: relative;
    z-index: 100;
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

  .play-pile {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 120px;
    min-width: 200px;
  }

  .pile-layer {
    position: absolute;
    display: flex;
    justify-content: center;
    gap: 2px;
    transform: translate(var(--offset-x), var(--offset-y)) rotate(var(--rotation));
    opacity: calc(1 - var(--depth) * 0.15);
    transition: transform 0.3s ease-out, opacity 0.3s ease-out;
  }

  .pile-layer.current {
    opacity: 1;
  }

  .piled-card {
    /* Slight fan effect within each play */
    transform: rotate(calc((var(--card-index) - (var(--card-count) - 1) / 2) * 4deg));
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
      padding: 4px;
      border-radius: 6px;
      flex: 0 1 auto;
      max-height: 40vh;
    }

    .play-info {
      margin-bottom: 4px;
      font-size: 0.7rem;
    }

    .play-type {
      margin-left: 4px;
    }

    .play-pile {
      min-height: 100px;
      min-width: 150px;
    }

    .piled-card {
      transform: rotate(calc((var(--card-index) - (var(--card-count) - 1) / 2) * 3deg));
    }

    .empty-play {
      padding: 8px 14px;
      font-size: 0.65rem;
    }
  }

  /* Very small screens */
  @media (max-height: 500px) {
    .play-zone {
      padding: 3px;
      flex: 0 1 auto;
      max-height: 30vh;
    }

    .play-info {
      margin-bottom: 2px;
      font-size: 0.6rem;
    }

    .play-pile {
      min-height: 80px;
      min-width: 120px;
    }

    .empty-play {
      padding: 6px 10px;
      font-size: 0.55rem;
    }
  }
</style>
