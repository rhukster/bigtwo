<script lang="ts">
  import type { Card } from '../game/types';

  interface Props {
    card: Card;
    selected?: boolean;
    onClick?: () => void;
    disabled?: boolean;
    small?: boolean;
  }

  let { card, selected = false, onClick, disabled = false, small = false }: Props = $props();

  const suitColors: Record<string, string> = {
    '♠': '#333',
    '♣': '#333',
    '♥': '#dc3545',
    '♦': '#dc3545'
  };

  function getSuitColor(suit: string): string {
    return suitColors[suit] || '#333';
  }
</script>

<button
  class="card"
  class:selected
  class:small
  disabled={disabled}
  onclick={onClick}
  style="--suit-color: {getSuitColor(card.suit)}"
>
  <div class="card-corner top-left">
    <span class="rank">{card.rank}</span>
    <span class="suit">{card.suit}</span>
  </div>
  <div class="card-center">
    <span class="suit-large">{card.suit}</span>
  </div>
  <div class="card-corner bottom-right">
    <span class="rank">{card.rank}</span>
    <span class="suit">{card.suit}</span>
  </div>
</button>

<style>
  .card {
    position: relative;
    width: var(--card-width, 70px);
    height: var(--card-height, 100px);
    background: linear-gradient(145deg, #fff 0%, #f8f8f8 100%);
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    cursor: pointer;
    transition: transform 0.15s, box-shadow 0.15s;
    border: 2px solid transparent;
    font-family: 'Georgia', serif;
    padding: 0;
    flex-shrink: 0;
  }

  .card:hover:not(:disabled) {
    transform: translateY(-8px);
    box-shadow: 0 8px 16px rgba(0,0,0,0.3);
  }

  .card.selected {
    transform: translateY(-15px);
    border-color: var(--gold, #d4af37);
    box-shadow: 0 8px 20px rgba(212,175,55,0.4);
  }

  .card:disabled {
    cursor: default;
    pointer-events: none;
  }

  .card:disabled:hover {
    transform: none;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  }

  .card.small {
    width: calc(var(--card-width, 70px) * 0.7);
    height: calc(var(--card-height, 100px) * 0.7);
    font-size: 0.8em;
  }

  .card-corner {
    position: absolute;
    display: flex;
    flex-direction: column;
    align-items: center;
    line-height: 1;
    color: var(--suit-color);
  }

  .top-left {
    top: 4px;
    left: 6px;
  }

  .bottom-right {
    bottom: 4px;
    right: 6px;
    transform: rotate(180deg);
  }

  .rank {
    font-size: var(--card-rank-size, 1.1rem);
    font-weight: bold;
  }

  .suit {
    font-size: var(--card-suit-size, 0.9rem);
  }

  .card-center {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: var(--suit-color);
  }

  .suit-large {
    font-size: var(--card-center-size, 2rem);
  }

  .card.small .rank {
    font-size: calc(var(--card-rank-size, 1.1rem) * 0.8);
  }

  .card.small .suit {
    font-size: calc(var(--card-suit-size, 0.9rem) * 0.8);
  }

  .card.small .suit-large {
    font-size: calc(var(--card-center-size, 2rem) * 0.7);
  }
</style>
