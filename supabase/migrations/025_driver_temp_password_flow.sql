-- ============================================================
-- 025_driver_temp_password_flow.sql
--
-- Adds support for temporary sequential passwords for newly
-- created driver accounts and first-login password change flow.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class
    WHERE relkind = 'S'
      AND relname = 'driver_temp_password_seq'
  ) THEN
    CREATE SEQUENCE public.driver_temp_password_seq START WITH 1 INCREMENT BY 1;
  END IF;
END $$;

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS temporary_password_seq integer,
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS temp_password_generated_at timestamptz;

ALTER TABLE public.drivers
  ALTER COLUMN temporary_password_seq SET DEFAULT nextval('public.driver_temp_password_seq');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'drivers_temporary_password_seq_unique'
      AND conrelid = 'public.drivers'::regclass
  ) THEN
    ALTER TABLE public.drivers
      ADD CONSTRAINT drivers_temporary_password_seq_unique UNIQUE (temporary_password_seq);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.next_driver_temp_password_seq()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT nextval('public.driver_temp_password_seq')::integer;
$$;

REVOKE ALL ON FUNCTION public.next_driver_temp_password_seq() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_driver_temp_password_seq() TO service_role;

NOTIFY pgrst, 'reload schema';
