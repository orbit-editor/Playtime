CREATE TABLE IF NOT EXISTS classes (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  name        TEXT    NOT NULL DEFAULT '',
  grade       INTEGER NOT NULL DEFAULT 0,
  school      TEXT    NOT NULL DEFAULT '',
  pin_hash    TEXT    NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL DEFAULT 0,
  updated_at  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS students (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id    INTEGER NOT NULL DEFAULT 1,
  sid         TEXT    NOT NULL,
  name        TEXT    NOT NULL,
  pinyin      TEXT    NOT NULL DEFAULT '',
  enabled     INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_students_sid ON students (class_id, sid);
CREATE INDEX IF NOT EXISTS idx_students_pinyin ON students (pinyin);

CREATE TABLE IF NOT EXISTS notices (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT    NOT NULL DEFAULT '',
  body        TEXT    NOT NULL DEFAULT '',
  pinned      INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL DEFAULT 0,
  updated_at  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_notices_created ON notices (created_at);

CREATE TABLE IF NOT EXISTS rewards (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT    NOT NULL DEFAULT '',
  cost          INTEGER NOT NULL DEFAULT 0,
  weekly_limit  INTEGER NOT NULL DEFAULT 0,
  enabled       INTEGER NOT NULL DEFAULT 1,
  created_at    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS redeems (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id  INTEGER NOT NULL,
  reward_id   INTEGER NOT NULL,
  status      TEXT    NOT NULL DEFAULT 'pending',
  created_at  INTEGER NOT NULL DEFAULT 0,
  decided_at  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_redeems_status ON redeems (status, created_at);

CREATE TABLE IF NOT EXISTS plays (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id  INTEGER NOT NULL,
  plugin_id   TEXT    NOT NULL,
  seed        INTEGER NOT NULL DEFAULT 0,
  correct     INTEGER NOT NULL DEFAULT 0,
  total       INTEGER NOT NULL DEFAULT 0,
  elapsed_ms  INTEGER NOT NULL DEFAULT 0,
  settled     INTEGER NOT NULL DEFAULT 0,
  started_at  INTEGER NOT NULL DEFAULT 0,
  ended_at    INTEGER
);

CREATE INDEX IF NOT EXISTS idx_plays_started ON plays (started_at);

CREATE TABLE IF NOT EXISTS flower_ledger (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id  INTEGER NOT NULL,
  delta       INTEGER NOT NULL,
  reason      TEXT    NOT NULL DEFAULT 'play',
  ref_id      INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_ledger_student ON flower_ledger (student_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ledger_created ON flower_ledger (created_at);

CREATE TABLE IF NOT EXISTS plugins (
  id            TEXT PRIMARY KEY,
  name          TEXT    NOT NULL DEFAULT '',
  version       TEXT    NOT NULL DEFAULT '',
  entry         TEXT    NOT NULL DEFAULT 'index.html',
  enabled       INTEGER NOT NULL DEFAULT 1,
  source        TEXT    NOT NULL DEFAULT 'builtin',
  installed_at  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,
  role        TEXT    NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL DEFAULT 0,
  expires_at  INTEGER NOT NULL DEFAULT 0
);

PRAGMA user_version = 1;
