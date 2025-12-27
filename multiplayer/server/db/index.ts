import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Initialize database
const db = new Database(join(__dirname, '../../data/bigtwo.db'));
db.pragma('journal_mode = WAL');

// Run schema
const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
db.exec(schema);

// User operations
export function createUser(username: string, email: string): string {
  const id = nanoid();
  const stmt = db.prepare(`
    INSERT INTO users (id, username, email) VALUES (?, ?, ?)
  `);
  stmt.run(id, username, email.toLowerCase());

  // Initialize leaderboard entry
  db.prepare(`INSERT INTO leaderboard (user_id) VALUES (?)`).run(id);

  return id;
}

export function getUserByEmail(email: string) {
  return db.prepare(`SELECT * FROM users WHERE email = ?`).get(email.toLowerCase()) as {
    id: string;
    username: string;
    email: string;
    created_at: string;
    last_seen: string;
  } | undefined;
}

export function getUserById(id: string) {
  return db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as {
    id: string;
    username: string;
    email: string;
    created_at: string;
    last_seen: string;
  } | undefined;
}

export function getUserByUsername(username: string) {
  return db.prepare(`SELECT * FROM users WHERE username = ?`).get(username);
}

export function updateLastSeen(userId: string) {
  db.prepare(`UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?`).run(userId);
}

// Magic link operations
export function createMagicLink(userId: string): string {
  const token = nanoid(32);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes

  db.prepare(`
    INSERT INTO magic_links (token, user_id, expires_at) VALUES (?, ?, ?)
  `).run(token, userId, expiresAt);

  return token;
}

export function verifyMagicLink(token: string) {
  const link = db.prepare(`
    SELECT * FROM magic_links
    WHERE token = ? AND used = 0 AND expires_at > datetime('now')
  `).get(token) as { token: string; user_id: string; expires_at: string } | undefined;

  if (link) {
    db.prepare(`UPDATE magic_links SET used = 1 WHERE token = ?`).run(token);
    return link.user_id;
  }
  return null;
}

// Session operations
export function createSession(userId: string): string {
  const id = nanoid(32);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  db.prepare(`
    INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)
  `).run(id, userId, expiresAt);

  return id;
}

export function getSession(sessionId: string) {
  return db.prepare(`
    SELECT s.*, u.username, u.email
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.id = ? AND s.expires_at > datetime('now')
  `).get(sessionId) as {
    id: string;
    user_id: string;
    username: string;
    email: string;
    expires_at: string;
  } | undefined;
}

export function deleteSession(sessionId: string) {
  db.prepare(`DELETE FROM sessions WHERE id = ?`).run(sessionId);
}

// Game operations
export function createGame(roomCode: string, numPlayers: number): string {
  const id = nanoid();
  db.prepare(`
    INSERT INTO games (id, room_code, num_players) VALUES (?, ?, ?)
  `).run(id, roomCode, numPlayers);
  return id;
}

export function endGame(gameId: string, winnerId: string | null, isAiWinner: boolean = false) {
  // If winner is AI, don't set winner_id (foreign key constraint)
  const winnerIdToStore = isAiWinner ? null : winnerId;
  db.prepare(`
    UPDATE games SET ended_at = CURRENT_TIMESTAMP, winner_id = ? WHERE id = ?
  `).run(winnerIdToStore, gameId);
}

export function recordGameResult(
  gameId: string,
  userId: string | null,
  isAi: boolean,
  position: number,
  cardsRemaining: number,
  pointsDelta: number,
  hadUnusedTwos: boolean,
  hadUnusedQuads: boolean,
  hadUnusedSf: boolean
) {
  const id = nanoid();
  db.prepare(`
    INSERT INTO game_results (
      id, game_id, user_id, is_ai, position, cards_remaining,
      points_delta, had_unused_twos, had_unused_quads, had_unused_sf
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, gameId, userId, isAi ? 1 : 0, position, cardsRemaining,
    pointsDelta, hadUnusedTwos ? 1 : 0, hadUnusedQuads ? 1 : 0, hadUnusedSf ? 1 : 0
  );
}

export function updateLeaderboard(userId: string, won: boolean, pointsDelta: number) {
  const current = db.prepare(`SELECT * FROM leaderboard WHERE user_id = ?`).get(userId) as {
    total_games: number;
    wins: number;
    total_points: number;
    current_streak: number;
    best_streak: number;
  } | undefined;

  if (!current) return;

  const newStreak = won ? current.current_streak + 1 : 0;
  const bestStreak = Math.max(current.best_streak, newStreak);

  db.prepare(`
    UPDATE leaderboard SET
      total_games = total_games + 1,
      wins = wins + ?,
      total_points = total_points + ?,
      current_streak = ?,
      best_streak = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `).run(won ? 1 : 0, pointsDelta, newStreak, bestStreak, userId);
}

export function getLeaderboard(limit = 50) {
  return db.prepare(`
    SELECT l.*, u.username
    FROM leaderboard l
    JOIN users u ON l.user_id = u.id
    ORDER BY l.total_points DESC
    LIMIT ?
  `).all(limit);
}

export function getUserStats(userId: string) {
  return db.prepare(`
    SELECT l.*, u.username,
      (SELECT COUNT(*) + 1 FROM leaderboard WHERE total_points > l.total_points) as rank
    FROM leaderboard l
    JOIN users u ON l.user_id = u.id
    WHERE l.user_id = ?
  `).get(userId);
}

// Cleanup expired data
export function cleanupExpired() {
  db.prepare(`DELETE FROM magic_links WHERE expires_at < datetime('now')`).run();
  db.prepare(`DELETE FROM sessions WHERE expires_at < datetime('now')`).run();
}

// Run cleanup on startup and every hour
cleanupExpired();
setInterval(cleanupExpired, 60 * 60 * 1000);

export default db;
