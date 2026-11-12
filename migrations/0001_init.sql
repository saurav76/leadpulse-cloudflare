-- D1-backed customer data. No ephemeral SQLite dependency.
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 email TEXT NOT NULL UNIQUE,
 password_salt TEXT NOT NULL,
 password_hash TEXT NOT NULL,
 verified INTEGER NOT NULL DEFAULT 0,
 verify_token_hash TEXT,
 verify_expires_at TEXT,
 created_at TEXT NOT NULL,
 trial_until TEXT NOT NULL,
 plan TEXT NOT NULL DEFAULT 'trial',
 billing_status TEXT NOT NULL DEFAULT 'trial',
 paid_until TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS sites (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 url TEXT NOT NULL,
 verify_token TEXT NOT NULL,
 verified_at TEXT,
 form_selector TEXT NOT NULL DEFAULT 'form',
 mode TEXT NOT NULL DEFAULT 'presence',
 success_text TEXT NOT NULL DEFAULT '',
 consent_submit INTEGER NOT NULL DEFAULT 0,
 active INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL,
 last_checked TEXT,
 last_status TEXT NOT NULL DEFAULT 'pending',
 UNIQUE(user_id, url)
);
CREATE INDEX IF NOT EXISTS idx_sites_due ON sites(active,verified_at,last_checked);
CREATE TABLE IF NOT EXISTS checks (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 status TEXT NOT NULL,
 detail TEXT NOT NULL,
 checked_at TEXT NOT NULL,
 duration_ms INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_checks_site ON checks(site_id,checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_checks_day ON checks(checked_at);
CREATE TABLE IF NOT EXISTS usage_reservations (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
 started_at TEXT NOT NULL,
 reserved_ms INTEGER NOT NULL DEFAULT 30000
);
CREATE INDEX IF NOT EXISTS idx_reservations_day ON usage_reservations(started_at);
CREATE TABLE IF NOT EXISTS billing_events (
 id TEXT PRIMARY KEY,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 provider TEXT NOT NULL,
 event_type TEXT NOT NULL,
 verified INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL
);
