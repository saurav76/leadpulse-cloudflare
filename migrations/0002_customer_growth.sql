-- Privacy-conscious customer lifecycle, attribution and future billing hooks.
-- Keep payment processing disabled until separately configured and validated.
ALTER TABLE users ADD COLUMN acquisition_source TEXT NOT NULL DEFAULT 'direct';
ALTER TABLE users ADD COLUMN acquisition_campaign TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN password_reset_hash TEXT;
ALTER TABLE users ADD COLUMN password_reset_expires_at TEXT;
ALTER TABLE users ADD COLUMN paid_verified_at TEXT;

CREATE TABLE IF NOT EXISTS customer_activity (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 action TEXT NOT NULL,
 happened_at TEXT NOT NULL,
 origin TEXT NOT NULL DEFAULT 'customer'
);
CREATE INDEX IF NOT EXISTS idx_activity_user_time ON customer_activity(user_id,happened_at);
CREATE INDEX IF NOT EXISTS idx_activity_action_time ON customer_activity(action,happened_at);

CREATE TABLE IF NOT EXISTS outreach_prospects (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 company_name TEXT NOT NULL,
 website TEXT NOT NULL,
 sector TEXT NOT NULL DEFAULT '',
 market TEXT NOT NULL DEFAULT '',
 business_contact TEXT NOT NULL DEFAULT '',
 source_url TEXT NOT NULL DEFAULT '',
 eligibility TEXT NOT NULL DEFAULT 'needs_review',
 status TEXT NOT NULL DEFAULT 'researched',
 suppression_reason TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 UNIQUE(website,business_contact)
);
CREATE INDEX IF NOT EXISTS idx_prospect_review ON outreach_prospects(eligibility,status);
CREATE TABLE IF NOT EXISTS campaign_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 prospect_id INTEGER REFERENCES outreach_prospects(id) ON DELETE SET NULL,
 event_type TEXT NOT NULL,
 campaign TEXT NOT NULL DEFAULT '',
 occurred_at TEXT NOT NULL,
 UNIQUE(prospect_id,event_type,campaign,occurred_at)
);
CREATE INDEX IF NOT EXISTS idx_campaign_event_type_time ON campaign_events(event_type,occurred_at);

CREATE TABLE IF NOT EXISTS payment_intents_pending (
 id TEXT PRIMARY KEY,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 plan TEXT NOT NULL CHECK (plan IN ('solo','studio','agency')),
 provider TEXT NOT NULL DEFAULT 'none',
 state TEXT NOT NULL DEFAULT 'not_configured',
 created_at TEXT NOT NULL,
 CHECK (state IN ('not_configured','mocked','cancelled'))
);
