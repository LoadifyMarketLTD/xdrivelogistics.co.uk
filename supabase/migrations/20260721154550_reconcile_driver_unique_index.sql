BEGIN;

DO $$
BEGIN
  IF to_regclass('public.drivers_company_user_unique') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'drivers_company_user_unique'
         AND conrelid = 'public.drivers'::regclass
     ) THEN
    EXECUTE 'DROP INDEX public.drivers_company_user_unique';
  END IF;
END
$$;

-- The partial unique index created by the preceding Fleet Driver migration
-- remains active while the following migration installs the canonical table
-- constraint used by PostgREST upserts.
DO $$
BEGIN
  IF to_regclass('public.drivers_company_user_uidx') IS NULL THEN
    CREATE UNIQUE INDEX drivers_company_user_uidx
      ON public.drivers (company_id, user_id)
      WHERE user_id IS NOT NULL;
  END IF;
END
$$;

COMMIT;
