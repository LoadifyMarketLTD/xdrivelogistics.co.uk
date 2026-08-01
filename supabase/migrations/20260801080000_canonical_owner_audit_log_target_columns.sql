BEGIN;

DO $$
BEGIN
  IF to_regclass('public.owner_audit_log') IS NULL THEN
    RAISE EXCEPTION
      'public.owner_audit_log must exist before applying 20260801080000_canonical_owner_audit_log_target_columns.'
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'owner_audit_log'
      AND column_name = 'target_type'
  ) THEN
    IF EXISTS (SELECT 1 FROM public.owner_audit_log LIMIT 1) THEN
      RAISE EXCEPTION
        'owner_audit_log.target_type is missing on a non-empty table. This canonical migration will not invent fallback target values.'
        USING ERRCODE = '23514';
    END IF;

    ALTER TABLE public.owner_audit_log
      ADD COLUMN target_type text;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'owner_audit_log'
      AND column_name = 'target_id'
  ) THEN
    ALTER TABLE public.owner_audit_log
      ADD COLUMN target_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'owner_audit_log'
      AND column_name = 'target_name'
  ) THEN
    ALTER TABLE public.owner_audit_log
      ADD COLUMN target_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'owner_audit_log'
      AND column_name = 'target_type'
      AND data_type = 'text'
  ) THEN
    RAISE EXCEPTION
      'owner_audit_log.target_type must be text before applying 20260801080000_canonical_owner_audit_log_target_columns.'
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'owner_audit_log'
      AND column_name = 'target_id'
      AND udt_name = 'uuid'
  ) THEN
    RAISE EXCEPTION
      'owner_audit_log.target_id must be uuid before applying 20260801080000_canonical_owner_audit_log_target_columns.'
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'owner_audit_log'
      AND column_name = 'target_name'
      AND data_type = 'text'
  ) THEN
    RAISE EXCEPTION
      'owner_audit_log.target_name must be text before applying 20260801080000_canonical_owner_audit_log_target_columns.'
      USING ERRCODE = '23514';
  END IF;

  ALTER TABLE public.owner_audit_log
    ALTER COLUMN target_type DROP DEFAULT;

  IF EXISTS (
    SELECT 1
    FROM public.owner_audit_log
    WHERE target_type IS NULL
    LIMIT 1
  ) THEN
    RAISE EXCEPTION
      'owner_audit_log.target_type contains NULL rows. Populate canonical values before applying 20260801080000_canonical_owner_audit_log_target_columns.'
      USING ERRCODE = '23514';
  END IF;

  ALTER TABLE public.owner_audit_log
    ALTER COLUMN target_type SET NOT NULL;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
