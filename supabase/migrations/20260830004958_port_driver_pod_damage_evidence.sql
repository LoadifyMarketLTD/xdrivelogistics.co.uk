-- Ported from PR #398 after production-schema verification.
-- Preserve delivery damage evidence as a first-class POD category.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS damage_photos jsonb;

DO $$
DECLARE
  v_type text;
BEGIN
  SELECT data_type
  INTO v_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'jobs'
    AND column_name = 'damage_photos';

  IF v_type IS NULL THEN
    RAISE EXCEPTION 'jobs.damage_photos was not created';
  END IF;

  IF v_type <> 'jsonb' THEN
    RAISE EXCEPTION 'Unsupported jobs.damage_photos type: %', v_type
      USING ERRCODE = '42804';
  END IF;
END
$$;

ALTER TABLE public.jobs
  ALTER COLUMN damage_photos DROP DEFAULT,
  ALTER COLUMN damage_photos DROP NOT NULL;

COMMIT;
