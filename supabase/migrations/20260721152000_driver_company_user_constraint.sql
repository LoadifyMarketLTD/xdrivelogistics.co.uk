BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'drivers_company_user_unique'
      AND conrelid = 'public.drivers'::regclass
  ) THEN
    ALTER TABLE public.drivers
      ADD CONSTRAINT drivers_company_user_unique UNIQUE (company_id, user_id);
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
