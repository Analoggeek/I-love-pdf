PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0, 1)),
  disabled INTEGER NOT NULL DEFAULT 0 CHECK (disabled IN (0, 1)),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT,
  locale TEXT NOT NULL DEFAULT 'en',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS credits (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  credits INTEGER NOT NULL DEFAULT 0 CHECK (credits >= 0),
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS daily_ai_usage (
  owner_key TEXT NOT NULL,
  usage_date TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
  PRIMARY KEY (owner_key, usage_date)
);
CREATE INDEX IF NOT EXISTS idx_daily_ai_usage_date ON daily_ai_usage(usage_date);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'business')),
  status TEXT NOT NULL DEFAULT 'active',
  provider TEXT,
  provider_customer_id TEXT,
  provider_subscription_id TEXT,
  current_period_end TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS processing_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  tool_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  input_bytes INTEGER,
  output_bytes INTEGER,
  storage_key TEXT,
  output_key TEXT,
  filename TEXT,
  output_filename TEXT,
  output_content_type TEXT,
  provider_job_id TEXT,
  downloaded_at TEXT,
  progress INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  expires_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_expiry ON processing_jobs(expires_at);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_created ON processing_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_status_updated ON processing_jobs(status, updated_at);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_user_created ON processing_jobs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_download_expiry ON processing_jobs(downloaded_at, expires_at);

CREATE TABLE IF NOT EXISTS processing_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_processing_history_user_time ON processing_history(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY,
  visitor_hash TEXT NOT NULL,
  event TEXT NOT NULL CHECK (event IN ('page_view', 'tool_use')),
  path TEXT NOT NULL,
  tool_id TEXT,
  country TEXT NOT NULL DEFAULT 'ZZ',
  device TEXT NOT NULL DEFAULT 'other',
  browser TEXT NOT NULL DEFAULT 'Other',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_analytics_events_time ON analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_visitor_time ON analytics_events(visitor_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_tool ON analytics_events(tool_id, created_at DESC);

CREATE TABLE IF NOT EXISTS tool_usage (
  tool_id TEXT PRIMARY KEY,
  use_count INTEGER NOT NULL DEFAULT 0 CHECK (use_count >= 0),
  last_used_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS api_usage (
  id TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_api_usage_endpoint_time ON api_usage(endpoint, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_status_time ON api_usage(status, created_at DESC);

CREATE TABLE IF NOT EXISTS admin_users (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0)
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);

CREATE TABLE IF NOT EXISTS daily_statistics (
  stat_date TEXT PRIMARY KEY,
  visitors INTEGER NOT NULL DEFAULT 0,
  page_views INTEGER NOT NULL DEFAULT 0,
  tool_uses INTEGER NOT NULL DEFAULT 0,
  ai_requests INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  errors INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS monthly_statistics (
  stat_month TEXT PRIMARY KEY,
  visitors INTEGER NOT NULL DEFAULT 0,
  page_views INTEGER NOT NULL DEFAULT 0,
  tool_uses INTEGER NOT NULL DEFAULT 0,
  ai_requests INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  errors INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES
  ('max_file_mb', '100', datetime('now')),
  ('max_pdf_pages', '500', datetime('now')),
  ('ai_guest_daily_limit', '3', datetime('now')),
  ('ai_user_daily_limit', '10', datetime('now')),
  ('file_retention_hours', '1', datetime('now')),
  ('maintenance_mode', 'false', datetime('now')),
  ('website_title', '"All in One PDF Tools"', datetime('now')),
  ('meta_description', '"Every PDF tool you need in one place."', datetime('now')),
  ('ad_slots', '[]', datetime('now'));
