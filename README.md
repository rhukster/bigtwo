# Big Two - Chinese Poker

A browser-based implementation of Big Two (also known as Chinese Poker, Deuces, or Dai Di), built with vanilla HTML, CSS, and JavaScript.

## Play

Open `index.html` in any modern browser - no build step or server required.

## Features

- **2-4 Players**: Play against 1-3 CPU opponents
- **Three Difficulty Levels**: Easy, Medium, and Hard AI
- **Complete Rule Set**: All standard Big Two combinations supported
- **Sound Effects**: Toggle on/off with audio feedback for plays, passes, and wins
- **Built-in Rules**: In-game rules modal for quick reference
- **Polished UI**: Felt table design with wood frame, card animations, and confetti celebration

## Game Rules

### Objective
Be the first player to empty your hand of all cards.

### Card Rankings
- **Ranks** (low to high): 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K, A, 2
- **Suits** (low to high): Diamonds, Clubs, Hearts, Spades

The 2 is the highest rank. When cards share the same rank, suit breaks the tie.

### Valid Combinations

| Type | Description |
|------|-------------|
| Single | Any single card |
| Pair | Two cards of same rank |
| Triple | Three cards of same rank |
| Straight | 5 consecutive ranks (any suits) |
| Flush | 5 cards of same suit |
| Full House | Three-of-a-kind + pair |
| Four of a Kind | Four same rank + 1 kicker |
| Straight Flush | 5 consecutive ranks, same suit |

### Gameplay

1. Player with 3 of Diamonds leads first and must include it in their opening play
2. Beat the current play with the same combination type but higher value, or pass
3. You cannot pass if you have control (were the last to play)
4. When all other players pass, the remaining player gains control and may lead any combination
5. First to empty their hand wins

## Tech Stack

- Pure HTML5, CSS3, and JavaScript
- No external dependencies (uses Google Fonts for typography)
- Web Audio API for sound effects
- Single-file deployment

## License

MIT
