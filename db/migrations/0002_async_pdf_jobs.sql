-- Temporary async conversion job metadata. File bytes remain in R2 and expire quickly.
ALTER TABLE processing_jobs ADD COLUMN output_key TEXT;
ALTER TABLE processing_jobs ADD COLUMN filename TEXT;
ALTER TABLE processing_jobs ADD COLUMN output_filename TEXT;
ALTER TABLE processing_jobs ADD COLUMN output_content_type TEXT;
ALTER TABLE processing_jobs ADD COLUMN provider_job_id TEXT;
ALTER TABLE processing_jobs ADD COLUMN progress INTEGER NOT NULL DEFAULT 0;
ALTER TABLE processing_jobs ADD COLUMN message TEXT;
ALTER TABLE processing_jobs ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_processing_jobs_status_updated ON processing_jobs(status, updated_at);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_user_created ON processing_jobs(user_id, created_at DESC);
