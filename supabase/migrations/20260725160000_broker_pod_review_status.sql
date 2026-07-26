-- ============================================================
-- Migration: broker_pod_review_status
-- Purpose:   Adds broker POD review workflow columns to jobs
--            so brokers can approve, reject or request missing
--            proof of delivery before releasing invoices.
-- ============================================================

-- Idempotent column additions
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS broker_pod_review_status TEXT
    CHECK (broker_pod_review_status IN ('pending', 'approved', 'rejected', 'missing_requested')),
  ADD COLUMN IF NOT EXISTS broker_pod_review_note   TEXT,
  ADD COLUMN IF NOT EXISTS broker_pod_reviewed_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS broker_pod_reviewed_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN jobs.broker_pod_review_status IS
  'Broker POD review outcome. NULL = not yet reviewed. Values: pending | approved | rejected | missing_requested.';
COMMENT ON COLUMN jobs.broker_pod_review_note IS
  'Optional broker note recorded at POD review time.';
COMMENT ON COLUMN jobs.broker_pod_reviewed_at IS
  'Timestamp when the broker completed the POD review action.';
COMMENT ON COLUMN jobs.broker_pod_reviewed_by IS
  'User ID of the broker member who performed the POD review.';

-- Index for broker POD queue queries
CREATE INDEX IF NOT EXISTS idx_jobs_broker_pod_review
  ON jobs (broker_pod_review_status, status)
  WHERE broker_pod_review_status IS NULL OR broker_pod_review_status = 'pending';

-- Post-run verification:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'jobs' AND column_name LIKE 'broker_pod%';
