<script lang="ts">
  import type { Card as CardType } from '../game/types';
  import Card from './Card.svelte';

  interface Props {
    cards: CardType[];
    selectedCards: CardType[];
    onCardClick?: (card: CardType) => void;
    disabled?: boolean;
    isCurrentTurn?: boolean;
  }

  let { cards, selectedCards, onCardClick, disabled = false, isCurrentTurn = false }: Props = $props();

  function isSelected(card: CardType): boolean {
    return selectedCards.some(c => c.rank === card.rank && c.suit === card.suit);
  }
</script>

<div class="hand-container" class:current-turn={isCurrentTurn}>
  <div class="hand">
    {#each cards as card, i}
      <div class="card-wrapper" style="--index: {i}; --total: {cards.length}">
        <Card
          {card}
          selected={isSelected(card)}
          onClick={() => onCardClick?.(card)}
          disabled={disabled}
        />
      </div>
    {/each}
  </div>
</div>

<style>
  .hand-container {
    padding: 4px 8px;
    background: rgba(0,0,0,0.2);
    border-radius: 8px;
    transition: all 0.3s;
  }

  .hand-container.current-turn {
    background: rgba(212,175,55,0.1);
    box-shadow: 0 0 12px rgba(212,175,55,0.3);
  }

  .hand {
    display: flex;
    justify-content: center;
    position: relative;
    min-height: var(--card-height, 75px);
    padding: 3px 4px;
  }

  .card-wrapper {
    margin-left: calc(-25px * min(1, var(--total) / 10));
    transition: transform 0.2s, margin 0.2s;
  }

  .card-wrapper:first-child {
    margin-left: 0;
  }

  .hand:hover .card-wrapper {
    margin-left: calc(-18px * min(1, var(--total) / 10));
  }

  .hand:hover .card-wrapper:first-child {
    margin-left: 0;
  }

  /* Mobile adjustments */
  @media (max-width: 480px) {
    .hand-container {
      padding: 4px 6px;
      border-radius: 8px;
    }

    .card-wrapper {
      margin-left: calc(-20px * min(1, var(--total) / 10));
    }

    .hand:hover .card-wrapper {
      margin-left: calc(-15px * min(1, var(--total) / 10));
    }
  }

  /* Very small screens */
  @media (max-height: 500px) {
    .hand-container {
      padding: 3px 5px;
    }

    .card-wrapper {
      margin-left: calc(-18px * min(1, var(--total) / 10));
    }

    .hand:hover .card-wrapper {
      margin-left: calc(-14px * min(1, var(--total) / 10));
    }
  }
</style>
