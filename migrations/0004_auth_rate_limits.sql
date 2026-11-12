-- Hash-derived rate-limit keys only. Never persist raw IP addresses.
CREATE TABLE IF NOT EXISTS auth_rate_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key_hash TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('signup','login','recover')),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_rate_events_key_time
 ON auth_rate_events(key_hash,action,created_at);
