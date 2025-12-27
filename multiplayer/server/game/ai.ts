// AI player logic for Big Two
import type { Card, PlayTypeResult } from '../../src/lib/game/types.ts';
import { getPlayType, canBeat, sortHand, cardValue } from '../../src/lib/game/engine.ts';

type Difficulty = 'easy' | 'medium' | 'hard';

// Find a play for AI player
export function findAiPlay(
  hand: Card[],
  currentPlay: Card[] | null,
  currentPlayType: PlayTypeResult | null,
  hasControl: boolean,
  firstPlayMade: boolean,
  difficulty: Difficulty
): Card[] | null {
  const sortedHand = sortHand(hand);

  // If we have control, lead with something
  if (hasControl) {
    return findLeadPlay(sortedHand, firstPlayMade, difficulty);
  }

  // Otherwise, try to beat the current play
  if (!currentPlay || !currentPlayType) return null;

  const beaters = findBeaters(sortedHand, currentPlay, currentPlayType, difficulty);
  if (beaters.length === 0) return null;

  // Easy AI: sometimes passes even when it can beat
  if (difficulty === 'easy') {
    if (Math.random() < 0.3) return null;
    return beaters[Math.floor(Math.random() * beaters.length)];
  }

  // Medium/Hard: play the lowest winning hand (first in sorted list)
  return beaters[0];
}

// Find a play when leading (having control)
function findLeadPlay(hand: Card[], firstPlayMade: boolean, difficulty: Difficulty): Card[] | null {
  // First play must include 3♦
  const threeDiamonds = hand.find(c => c.rank === '3' && c.suit === '♦');

  if (!firstPlayMade && threeDiamonds) {
    // Try to pair it up on medium/hard
    if (difficulty !== 'easy') {
      const otherThree = hand.find(c => c.rank === '3' && c.suit !== '♦');
      if (otherThree) {
        return sortHand([threeDiamonds, otherThree]);
      }
    }
    return [threeDiamonds];
  }

  // Easy AI: just play the first card
  if (difficulty === 'easy') {
    return [hand[0]];
  }

  // Medium/Hard: strategically choose what to lead with
  // Prefer playing low singles that aren't part of pairs/triples
  const analysis = analyzeHand(hand);

  // Try to lead with a pair if we have one (to get it out of our hand)
  if (analysis.pairs.length > 0) {
    return analysis.pairs[0];
  }

  // Lead with a single that's NOT part of a pair or triple
  const safeSingles = hand.filter(card => {
    const rank = card.rank;
    const sameRankCount = hand.filter(c => c.rank === rank).length;
    return sameRankCount === 1;
  });

  if (safeSingles.length > 0) {
    // Play lowest safe single
    return [safeSingles[0]];
  }

  // If all cards are part of pairs/triples, just play the lowest
  return [hand[0]];
}

// Analyze hand to find pairs, triples, etc.
function analyzeHand(hand: Card[]): {
  pairs: Card[][];
  triples: Card[][];
  quads: Card[][];
  singleCards: Card[];
} {
  const pairs: Card[][] = [];
  const triples: Card[][] = [];
  const quads: Card[][] = [];
  const singleCards: Card[] = [];

  // Group cards by rank
  const byRank: Record<string, Card[]> = {};
  for (const card of hand) {
    if (!byRank[card.rank]) byRank[card.rank] = [];
    byRank[card.rank].push(card);
  }

  for (const rank in byRank) {
    const cards = byRank[rank];
    if (cards.length === 4) {
      quads.push(cards);
    } else if (cards.length === 3) {
      triples.push(cards);
    } else if (cards.length === 2) {
      pairs.push(cards);
    } else {
      singleCards.push(cards[0]);
    }
  }

  return { pairs, triples, quads, singleCards };
}

// Check if a card is part of a pair or better in the hand
function isPartOfGroup(card: Card, hand: Card[]): boolean {
  const sameRankCount = hand.filter(c => c.rank === card.rank).length;
  return sameRankCount >= 2;
}

// Find all combinations that can beat the current play
function findBeaters(hand: Card[], currentPlay: Card[], currentPlayType: PlayTypeResult, difficulty: Difficulty): Card[][] {
  const candidates: Card[][] = [];
  const playType = currentPlayType.type;

  const cardCount = playType === 'single' ? 1 :
    playType === 'pair' ? 2 :
      playType === 'triple' ? 3 : 5;

  if (cardCount === 1) {
    // Find all singles that can beat the current play
    // For medium/hard, prefer cards NOT part of pairs/triples
    const analysis = analyzeHand(hand);

    // First, try singles that are truly single (not part of pairs)
    for (const card of analysis.singleCards) {
      if (canBeat([card], currentPlay, currentPlayType)) {
        candidates.push([card]);
      }
    }

    // For easy difficulty or if no safe singles, include all options
    if (difficulty === 'easy' || candidates.length === 0) {
      for (const card of hand) {
        if (canBeat([card], currentPlay, currentPlayType)) {
          // Check if already added
          if (!candidates.some(c => c[0].rank === card.rank && c[0].suit === card.suit)) {
            candidates.push([card]);
          }
        }
      }
    }
  } else if (cardCount === 2) {
    // Find all pairs that can beat
    // For medium/hard, prefer pairs that don't break triples
    const analysis = analyzeHand(hand);

    // First, use actual pairs (not from triples)
    for (const pair of analysis.pairs) {
      if (canBeat(pair, currentPlay, currentPlayType)) {
        candidates.push(pair);
      }
    }

    // For easy difficulty or if no safe pairs, include pairs from triples
    if (difficulty === 'easy' || candidates.length === 0) {
      for (const triple of analysis.triples) {
        // Can make 3 different pairs from a triple
        const pair1 = [triple[0], triple[1]];
        const pair2 = [triple[0], triple[2]];
        const pair3 = [triple[1], triple[2]];
        for (const pair of [pair1, pair2, pair3]) {
          if (canBeat(pair, currentPlay, currentPlayType)) {
            candidates.push(pair);
          }
        }
      }
    }
  } else if (cardCount === 3) {
    // Find all triples that can beat
    const analysis = analyzeHand(hand);

    for (const triple of analysis.triples) {
      if (canBeat(triple, currentPlay, currentPlayType)) {
        candidates.push(triple);
      }
    }

    // Also check quads for triples
    for (const quad of analysis.quads) {
      const triple = [quad[0], quad[1], quad[2]];
      if (canBeat(triple, currentPlay, currentPlayType)) {
        candidates.push(triple);
      }
    }
  } else if (cardCount === 5) {
    // Find all 5-card combos that can beat
    for (let a = 0; a < hand.length - 4; a++) {
      for (let b = a + 1; b < hand.length - 3; b++) {
        for (let c = b + 1; c < hand.length - 2; c++) {
          for (let d = c + 1; d < hand.length - 1; d++) {
            for (let e = d + 1; e < hand.length; e++) {
              const combo = [hand[a], hand[b], hand[c], hand[d], hand[e]];
              const comboType = getPlayType(combo);
              if (comboType && comboType.type === playType && canBeat(combo, currentPlay, currentPlayType)) {
                candidates.push(combo);
              }
            }
          }
        }
      }
    }
  }

  // Sort by strength (lowest first, so AI plays minimum needed to beat)
  return candidates.sort((a, b) => {
    const typeA = getPlayType(a)!;
    const typeB = getPlayType(b)!;
    return typeA.str - typeB.str;
  });
}
