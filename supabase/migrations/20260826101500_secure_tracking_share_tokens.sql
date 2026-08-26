BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

CREATE TABLE IF NOT EXISTS public.job_tracking_share_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_accessed_at timestamptz
);

ALTER TABLE public.job_tracking_share_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.job_tracking_share_tokens FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.job_tracking_share_tokens TO service_role;

CREATE INDEX IF NOT EXISTS idx_job_tracking_share_tokens_job_active
  ON public.job_tracking_share_tokens(job_id, expires_at DESC)
  WHERE revoked_at IS NULL;

COMMENT ON TABLE public.job_tracking_share_tokens IS
  'Server-only hashed bearer tokens for explicitly shared read-only live job tracking. Public access remains job-scoped and stops when the job is no longer actively executing.';

NOTIFY pgrst, 'reload schema';

COMMIT;
