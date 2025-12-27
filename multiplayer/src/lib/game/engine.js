import { SUITS, RANKS, SUIT_ORDER, RANK_ORDER } from './types';
// Create a standard 52-card deck
export function createDeck() {
    const deck = [];
    for (const suit of SUITS) {
        for (const rank of RANKS) {
            deck.push({ rank, suit });
        }
    }
    return deck;
}
// Fisher-Yates shuffle
export function shuffle(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}
// Compare two cards for sorting
export function compareCards(a, b) {
    const rankDiff = RANK_ORDER[a.rank] - RANK_ORDER[b.rank];
    if (rankDiff !== 0)
        return rankDiff;
    return SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit];
}
// Sort a hand of cards
export function sortHand(hand) {
    return [...hand].sort(compareCards);
}
// Get numerical value of a card (for comparison)
export function cardValue(card) {
    return RANK_ORDER[card.rank] * 4 + SUIT_ORDER[card.suit];
}
// Check if two cards are equal
export function cardsEqual(a, b) {
    return a.rank === b.rank && a.suit === b.suit;
}
// Check if a card is the 3 of diamonds
export function isThreeOfDiamonds(card) {
    return card.rank === '3' && card.suit === '♦';
}
// Find the player index who has the 3 of diamonds
export function findStarterIndex(hands) {
    for (let i = 0; i < hands.length; i++) {
        if (hands[i].some(isThreeOfDiamonds)) {
            return i;
        }
    }
    return 0;
}
// Determine the type of a card combination
export function getPlayType(cards) {
    const n = cards.length;
    if (n === 0)
        return null;
    const sorted = sortHand(cards);
    const ranks = sorted.map(c => RANK_ORDER[c.rank]);
    const suits = sorted.map(c => c.suit);
    // Single card
    if (n === 1) {
        return { type: 'single', str: cardValue(sorted[0]) };
    }
    // Pair
    if (n === 2 && ranks[0] === ranks[1]) {
        return { type: 'pair', str: cardValue(sorted[1]) };
    }
    // Triple
    if (n === 3 && ranks[0] === ranks[1] && ranks[1] === ranks[2]) {
        return { type: 'triple', str: cardValue(sorted[2]) };
    }
    // 5-card combinations
    if (n === 5) {
        const isFlush = suits.every(s => s === suits[0]);
        const sortedRanks = [...ranks].sort((a, b) => a - b);
        const isStraight = sortedRanks.every((v, i) => i === 0 || v === sortedRanks[i - 1] + 1);
        // Count occurrences of each rank
        const counts = {};
        ranks.forEach(r => counts[r] = (counts[r] || 0) + 1);
        const countValues = Object.values(counts).sort((a, b) => b - a);
        // Four of a kind (with kicker)
        if (countValues[0] === 4) {
            const quadRank = parseInt(Object.keys(counts).find(k => counts[parseInt(k)] === 4) || '0');
            return { type: 'four', str: quadRank * 100 };
        }
        // Full house
        if (countValues[0] === 3 && countValues[1] === 2) {
            const tripRank = parseInt(Object.keys(counts).find(k => counts[parseInt(k)] === 3) || '0');
            return { type: 'fullhouse', str: tripRank * 100 };
        }
        // Straight flush
        if (isFlush && isStraight) {
            return { type: 'straightflush', str: cardValue(sorted[4]) };
        }
        // Flush
        if (isFlush) {
            return { type: 'flush', str: cardValue(sorted[4]) };
        }
        // Straight
        if (isStraight) {
            return { type: 'straight', str: cardValue(sorted[4]) };
        }
    }
    return null;
}
// Check if new cards can beat the current play
export function canBeat(newCards, currentPlay, currentPlayType) {
    if (!currentPlay || !currentPlayType)
        return true;
    const newType = getPlayType(newCards);
    if (!newType)
        return false;
    if (newType.type !== currentPlayType.type)
        return false;
    return newType.str > currentPlayType.str;
}
// Get display name for a play type
export function getPlayTypeName(type) {
    const names = {
        single: 'Single',
        pair: 'Pair',
        triple: 'Triple',
        straight: 'Straight',
        flush: 'Flush',
        fullhouse: 'Full House',
        four: 'Four of a Kind',
        straightflush: 'Straight Flush'
    };
    return names[type];
}
// Validate that a play includes 3♦ (for first play of game)
export function includesThreeOfDiamonds(cards) {
    return cards.some(isThreeOfDiamonds);
}
// Deal cards to players
export function dealCards(numPlayers) {
    const deck = shuffle(createDeck());
    const hands = Array.from({ length: numPlayers }, () => []);
    const cardsPerPlayer = Math.floor(52 / numPlayers);
    const totalDealt = cardsPerPlayer * numPlayers;
    for (let i = 0; i < totalDealt; i++) {
        hands[i % numPlayers].push(deck[i]);
    }
    // Sort each hand
    return hands.map(sortHand);
}
// Remove cards from a hand
export function removeCardsFromHand(hand, cardsToRemove) {
    const result = [...hand];
    for (const cardToRemove of cardsToRemove) {
        const index = result.findIndex(c => cardsEqual(c, cardToRemove));
        if (index !== -1) {
            result.splice(index, 1);
        }
    }
    return result;
}
// Check if hand contains unused 2s (for scoring)
export function hasUnusedTwos(hand) {
    return hand.some(c => c.rank === '2');
}
// Check if hand contains unused four-of-a-kinds
export function hasUnusedQuads(hand) {
    const counts = {};
    for (const card of hand) {
        counts[card.rank] = (counts[card.rank] || 0) + 1;
    }
    return Object.values(counts).some(count => count === 4);
}
// Check if hand contains unused straight flushes
export function hasUnusedStraightFlush(hand) {
    if (hand.length < 5)
        return false;
    // Check all 5-card combinations
    for (let a = 0; a < hand.length - 4; a++) {
        for (let b = a + 1; b < hand.length - 3; b++) {
            for (let c = b + 1; c < hand.length - 2; c++) {
                for (let d = c + 1; d < hand.length - 1; d++) {
                    for (let e = d + 1; e < hand.length; e++) {
                        const combo = [hand[a], hand[b], hand[c], hand[d], hand[e]];
                        const type = getPlayType(combo);
                        if (type?.type === 'straightflush') {
                            return true;
                        }
                    }
                }
            }
        }
    }
    return false;
}
// Calculate points for a player based on cards remaining
export function calculatePoints(cardsRemaining, hasUnusedTwos, hasUnusedQuads, hasUnusedStraightFlush, winnerEndedWithSpecial) {
    // Base points: 1 per card, 2 per card if 10+ remaining
    let points = cardsRemaining >= 10 ? cardsRemaining * 2 : cardsRemaining;
    // Multipliers for special hands
    let multiplier = 1;
    if (hasUnusedTwos)
        multiplier *= 2;
    if (hasUnusedQuads)
        multiplier *= 2;
    if (hasUnusedStraightFlush)
        multiplier *= 2;
    if (winnerEndedWithSpecial)
        multiplier *= 2;
    return points * multiplier;
}
