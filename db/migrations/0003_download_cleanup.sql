-- Timestamp a completed result stream so its temporary output expires two minutes later.
ALTER TABLE processing_jobs ADD COLUMN downloaded_at TEXT;
CREATE INDEX IF NOT EXISTS idx_processing_jobs_download_expiry ON processing_jobs(downloaded_at, expires_at);
