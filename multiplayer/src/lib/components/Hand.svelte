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

  // Touch handling to distinguish tap vs scroll
  let touchStartX = $state(0);
  let touchStartY = $state(0);
  let isDragging = $state(false);
  const TAP_THRESHOLD = 10; // pixels - if moved more than this, it's a scroll not a tap

  function isSelected(card: CardType): boolean {
    return selectedCards.some(c => c.rank === card.rank && c.suit === card.suit);
  }

  function handleTouchStart(e: TouchEvent) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    isDragging = false;
  }

  function handleTouchMove(e: TouchEvent) {
    const deltaX = Math.abs(e.touches[0].clientX - touchStartX);
    const deltaY = Math.abs(e.touches[0].clientY - touchStartY);
    if (deltaX > TAP_THRESHOLD || deltaY > TAP_THRESHOLD) {
      isDragging = true;
    }
  }

  function handleCardTap(card: CardType) {
    // Only select if it was a tap, not a scroll
    if (!isDragging && !disabled) {
      onCardClick?.(card);
    }
  }
</script>

<div class="hand-container" class:current-turn={isCurrentTurn}>
  <div
    class="hand"
    style="--total: {cards.length}"
    ontouchstart={handleTouchStart}
    ontouchmove={handleTouchMove}
  >
    {#each cards as card, i}
      <button
        class="card-wrapper"
        class:selected={isSelected(card)}
        style="--index: {i}"
        onclick={() => handleCardTap(card)}
        disabled={disabled}
      >
        <Card
          {card}
          selected={isSelected(card)}
          disabled={true}
        />
      </button>
    {/each}
  </div>
</div>

<style>
  .hand-container {
    padding: 4px 8px;
    padding-top: 16px;
    background: rgba(0,0,0,0.2);
    border-radius: 8px;
    transition: all 0.3s;
    overflow-x: auto;
    overflow-y: clip;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    scrollbar-color: rgba(212,175,55,0.3) transparent;
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
    padding-right: 20px;
    /* Prevent text selection during scroll */
    user-select: none;
    -webkit-user-select: none;
  }

  .card-wrapper {
    margin-right: calc(var(--card-width, 52px) * -1 + 18px);
    transition: transform 0.2s, margin 0.2s;
    flex-shrink: 0;
    /* Reset button styles */
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    /* Prevent touch delay */
    touch-action: pan-x;
  }

  .card-wrapper:last-child {
    margin-right: 0;
  }

  .card-wrapper:disabled {
    cursor: default;
  }

  /* Desktop hover - spread cards */
  @media (hover: hover) {
    .hand:hover .card-wrapper {
      margin-right: calc(var(--card-width, 52px) * -1 + 28px);
    }

    .hand:hover .card-wrapper:last-child {
      margin-right: 0;
    }
  }

  /* Mobile/Touch - larger cards, more spacing, horizontal scroll */
  @media (max-width: 480px), (pointer: coarse) {
    .hand-container {
      padding: 4px 8px;
      padding-top: 12px;
      border-radius: 6px;
      margin: 0 -8px;
      /* Larger card size for mobile */
      --card-width: 62px;
      --card-height: 90px;
      --card-rank-size: 1.05rem;
      --card-suit-size: 0.9rem;
      --card-center-size: 1.7rem;
    }

    .hand {
      padding: 2px 8px;
      padding-right: 40px;
      gap: 0;
    }

    .card-wrapper {
      /* More spacing between cards - show ~28px of each card */
      margin-right: calc(var(--card-width, 62px) * -1 + 28px);
    }

    .card-wrapper:last-child {
      margin-right: 0;
    }
  }

  /* Small mobile screens */
  @media (max-width: 380px) and (pointer: coarse) {
    .hand-container {
      --card-width: 56px;
      --card-height: 82px;
      --card-rank-size: 0.95rem;
      --card-suit-size: 0.85rem;
      --card-center-size: 1.5rem;
    }

    .card-wrapper {
      margin-right: calc(var(--card-width, 56px) * -1 + 24px);
    }

    .card-wrapper:last-child {
      margin-right: 0;
    }
  }

  /* Landscape mobile */
  @media (max-height: 500px) {
    .hand-container {
      padding: 2px 4px;
      padding-top: 10px;
      --card-width: 48px;
      --card-height: 70px;
      --card-rank-size: 0.85rem;
      --card-suit-size: 0.75rem;
      --card-center-size: 1.3rem;
    }

    .card-wrapper {
      margin-right: calc(var(--card-width, 48px) * -1 + 20px);
    }

    .card-wrapper:last-child {
      margin-right: 0;
    }
  }
</style>
