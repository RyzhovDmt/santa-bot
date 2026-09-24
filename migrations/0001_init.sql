-- A game is stored as one JSON document: participants, wishes and pairs are always read together.
CREATE TABLE games (
  code TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX games_status ON games (status);

-- Current game of a user and what the bot expects from their next message.
CREATE TABLE users (
  user_id TEXT PRIMARY KEY,
  game TEXT,
  mode TEXT
);

CREATE INDEX users_game ON users (game);

-- Last day a reminder of each kind was sent. Kept apart from games
-- so the hourly cron never overwrites a game edited at the same moment.
CREATE TABLE reminders (
  code TEXT NOT NULL,
  kind TEXT NOT NULL,
  sent TEXT NOT NULL,
  PRIMARY KEY (code, kind)
);
