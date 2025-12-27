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
  <div class="hand" style="--total: {cards.length}">
    {#each cards as card, i}
      <div class="card-wrapper" style="--index: {i}">
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
    /* Extra top padding for selected card lift */
    padding-top: 16px;
    background: rgba(0,0,0,0.2);
    border-radius: 8px;
    transition: all 0.3s;
    overflow-x: auto;
    /* Clip must be visible for selected cards that lift up */
    overflow-y: clip;
    -webkit-overflow-scrolling: touch;
    /* Subtle scroll indicator */
    scrollbar-width: thin;
    scrollbar-color: rgba(212,175,55,0.3) transparent;
    /* Center hand when it fits */
    text-align: center;
  }

  .hand-container::-webkit-scrollbar {
    height: 4px;
  }

  .hand-container::-webkit-scrollbar-track {
    background: transparent;
  }

  .hand-container::-webkit-scrollbar-thumb {
    background: rgba(212,175,55,0.3);
    border-radius: 2px;
  }

  .hand-container.current-turn {
    background: rgba(212,175,55,0.1);
    box-shadow: 0 0 12px rgba(212,175,55,0.3);
  }

  .hand {
    display: inline-flex;
    flex-direction: row;
    position: relative;
    min-height: var(--card-height, 75px);
    padding: 3px 4px;
    /* Add padding at end so last card is fully visible when scrolled */
    padding-right: 20px;
  }

  .card-wrapper {
    /* Cards overlap on RIGHT edge, showing LEFT edge (rank/suit corner)
       This is the standard right-handed card fan style.
       Show at least 18px of each card so rank/suit is visible.
       Card width is var(--card-width), so overlap is (card-width - 18px) max */
    margin-right: calc(var(--card-width, 52px) * -1 + 18px);
    transition: transform 0.2s, margin 0.2s;
    flex-shrink: 0;
  }

  .card-wrapper:last-child {
    margin-right: 0;
  }

  /* Hover state - spread out cards */
  @media (hover: hover) {
    .hand:hover .card-wrapper {
      margin-right: calc(var(--card-width, 52px) * -1 + 28px);
    }

    .hand:hover .card-wrapper:last-child {
      margin-right: 0;
    }
  }

  /* Mobile - tighter overlap, scrollable */
  @media (max-width: 480px) {
    .hand-container {
      padding: 2px 4px;
      padding-top: 12px;
      border-radius: 6px;
      /* Make scroll more obvious on mobile */
      margin: 0 -4px;
      padding-left: 8px;
    }

    .hand {
      padding: 2px;
      padding-right: 30px;
    }

    .card-wrapper {
      /* Show at least 14px of each card on mobile */
      margin-right: calc(var(--card-width, 44px) * -1 + 14px);
    }

    .card-wrapper:last-child {
      margin-right: 0;
    }
  }

  /* Very small screens - show at least 12px */
  @media (max-width: 360px) {
    .card-wrapper {
      margin-right: calc(var(--card-width, 44px) * -1 + 12px);
    }

    .card-wrapper:last-child {
      margin-right: 0;
    }
  }

  /* Short screens (landscape mobile) - show at least 14px */
  @media (max-height: 500px) {
    .hand-container {
      padding: 2px 4px;
      padding-top: 10px;
    }

    .card-wrapper {
      margin-right: calc(var(--card-width, 40px) * -1 + 14px);
    }

    .card-wrapper:last-child {
      margin-right: 0;
    }
  }
</style>
