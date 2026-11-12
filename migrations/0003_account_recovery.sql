-- Recovery requests are rate-limited per email digest. Public launch also needs Turnstile and IP/WAF abuse controls.
CREATE TABLE IF NOT EXISTS password_reset_attempts (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 email_digest TEXT NOT NULL,
 requested_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reset_attempts_email_time ON password_reset_attempts(email_digest,requested_at);
