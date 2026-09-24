// D1 storage in a unit-of-work style: rows needed for an update are loaded up front,
// handlers work with plain objects synchronously, save() writes back only what changed.
// Every D1 call is a subrequest (50 per invocation on the free plan), so loads and writes are batched.

const newUser = () => ({ game: null, mode: null });

export class Store {
  constructor(db) {
    this.db = db;
    this.games = new Map();
    this.users = new Map();
    this.snapshots = new Map(); // row key -> JSON as loaded/saved, undefined for new rows
    this.ops = []; // extra statements for the next save()
  }

  async loadGames(codes) {
    const missing = [...new Set(codes)].filter((code) => code && !this.games.has(code));
    if (!missing.length) return;
    const placeholders = missing.map(() => '?').join(', ');
    const { results } = await this.db
      .prepare(`SELECT code, data FROM games WHERE code IN (${placeholders})`)
      .bind(...missing)
      .all();
    for (const row of results) {
      this.games.set(row.code, JSON.parse(row.data));
      this.snapshots.set(`g:${row.code}`, row.data);
    }
  }

  // Loads the user, their current game, the game their pending input refers to and any extra games.
  async preload(userId, codes = []) {
    const row = await this.db.prepare('SELECT game, mode FROM users WHERE user_id = ?').bind(userId).first();
    if (row) {
      const user = { game: row.game, mode: row.mode ? JSON.parse(row.mode) : null };
      this.users.set(userId, user);
      this.snapshots.set(`u:${userId}`, JSON.stringify(user));
    }
    const user = this.users.get(userId);
    await this.loadGames([...codes, user?.game, user?.mode?.code]);
  }

  async save() {
    const statements = [];
    const now = new Date().toISOString();

    for (const [code, game] of this.games) {
      const data = JSON.stringify(game);
      const key = `g:${code}`;
      if (this.snapshots.get(key) === data) continue;
      // New games use a plain INSERT: a code collision fails loudly instead of overwriting another game.
      statements.push(this.snapshots.has(key)
        ? this.db.prepare('UPDATE games SET status = ?, data = ?, updated_at = ? WHERE code = ?').bind(game.status, data, now, code)
        : this.db.prepare('INSERT INTO games (code, status, data, updated_at) VALUES (?, ?, ?, ?)').bind(code, game.status, data, now));
      this.snapshots.set(key, data);
    }

    for (const [userId, user] of this.users) {
      const json = JSON.stringify(user);
      const key = `u:${userId}`;
      if (this.snapshots.get(key) === json) continue;
      statements.push(this.db
        .prepare('INSERT INTO users (user_id, game, mode) VALUES (?, ?, ?) ON CONFLICT (user_id) DO UPDATE SET game = excluded.game, mode = excluded.mode')
        .bind(userId, user.game, user.mode ? JSON.stringify(user.mode) : null));
      this.snapshots.set(key, json);
    }

    statements.push(...this.ops);
    this.ops = [];
    if (statements.length) await this.db.batch(statements);
  }

  user(userId) {
    if (!this.users.has(userId)) this.users.set(userId, newUser());
    return this.users.get(userId);
  }

  getGame(code) {
    return this.games.get(code);
  }

  currentGame(userId) {
    const code = this.users.get(userId)?.game;
    return code ? this.games.get(code) : undefined;
  }

  setCurrentGame(userId, code) {
    this.user(userId).game = code ?? null;
  }

  // Mode = what the next message from the user means (wish text, message to Santa, ...).
  getMode(userId) {
    return this.users.get(userId)?.mode ?? null;
  }

  setMode(userId, mode) {
    this.user(userId).mode = mode ?? null;
  }

  addGame(game) {
    this.games.set(game.code, game);
  }

  deleteGame(code) {
    for (const user of this.users.values()) {
      if (user.game === code) user.game = null;
      if (user.mode?.code === code) user.mode = null;
    }
    this.games.delete(code);
    this.snapshots.delete(`g:${code}`);
    this.ops.push(
      this.db.prepare('UPDATE users SET game = NULL WHERE game = ?').bind(code),
      this.db.prepare("UPDATE users SET mode = NULL WHERE json_extract(mode, '$.code') = ?").bind(code),
      this.db.prepare('DELETE FROM reminders WHERE code = ?').bind(code),
      this.db.prepare('DELETE FROM games WHERE code = ?').bind(code),
    );
  }

  resetReminders(code, kinds) {
    for (const kind of kinds) {
      this.ops.push(this.db.prepare('DELETE FROM reminders WHERE code = ? AND kind = ?').bind(code, kind));
    }
  }
}

// Games that can still have reminders, with their reminder log attached as game.reminders.
export async function loadActiveGames(db) {
  const [games, reminders] = await db.batch([
    db.prepare("SELECT data FROM games WHERE status IN ('open', 'drawn')"),
    db.prepare('SELECT code, kind, sent FROM reminders'),
  ]);
  const sent = {};
  for (const row of reminders.results) {
    sent[row.code] ??= {};
    sent[row.code][row.kind] = row.sent;
  }
  return games.results.map((row) => {
    const game = JSON.parse(row.data);
    game.reminders = sent[game.code] ?? {};
    return game;
  });
}

export function markReminder(db, code, kind, sent) {
  return db
    .prepare('INSERT INTO reminders (code, kind, sent) VALUES (?, ?, ?) ON CONFLICT (code, kind) DO UPDATE SET sent = excluded.sent')
    .bind(code, kind, sent)
    .run();
}
