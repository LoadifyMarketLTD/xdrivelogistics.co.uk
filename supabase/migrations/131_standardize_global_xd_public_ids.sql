BEGIN;

CREATE SEQUENCE IF NOT EXISTS public.xd_public_id_seq;

DO $$
DECLARE
  v_next bigint;
  v_max bigint;
  v_seq_last bigint;
  v_company_id uuid;
BEGIN
  UPDATE public.profiles
  SET xd_id = 'XD-' || substring(xd_id from '(\d{6,})$')
  WHERE xd_id ~ '^XD-ID: GB [0-9]{6,}$';

  UPDATE public.companies
  SET xd_id = 'XD-' || substring(xd_id from '(\d{6,})$')
  WHERE xd_id ~ '^XD-ID: GB [0-9]{6,}$';

  SELECT COALESCE(max(n), 0) INTO v_max
  FROM (
    SELECT substring(xd_id from '^XD-([0-9]+)$')::bigint AS n
    FROM public.profiles WHERE xd_id ~ '^XD-[0-9]+$'
    UNION ALL
    SELECT substring(xd_id from '^XD-([0-9]+)$')::bigint AS n
    FROM public.companies WHERE xd_id ~ '^XD-[0-9]+$'
  ) ids;

  v_next := v_max;

  FOR v_company_id IN
    SELECT c.id
    FROM public.companies c
    WHERE c.xd_id IS NULL
       OR c.xd_id !~ '^XD-[0-9]{6,}$'
       OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.xd_id = c.xd_id)
    ORDER BY c.created_at NULLS LAST, c.id
  LOOP
    v_next := v_next + 1;
    UPDATE public.companies
    SET xd_id = 'XD-' || lpad(v_next::text, 6, '0')
    WHERE id = v_company_id;
  END LOOP;

  SELECT COALESCE(max(n), 0) INTO v_max
  FROM (
    SELECT substring(xd_id from '^XD-([0-9]+)$')::bigint AS n
    FROM public.profiles WHERE xd_id ~ '^XD-[0-9]+$'
    UNION ALL
    SELECT substring(xd_id from '^XD-([0-9]+)$')::bigint AS n
    FROM public.companies WHERE xd_id ~ '^XD-[0-9]+$'
  ) ids;

  SELECT last_value INTO v_seq_last FROM public.xd_public_id_seq;
  PERFORM setval('public.xd_public_id_seq', GREATEST(v_max, v_seq_last, 1), true);
END;
$$;

ALTER TABLE public.companies ALTER COLUMN xd_id DROP DEFAULT;

CREATE OR REPLACE FUNCTION public.generate_xd_public_id()
RETURNS text
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_num bigint;
BEGIN
  v_num := nextval('public.xd_public_id_seq');
  RETURN 'XD-' || lpad(v_num::text, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_xd_user_id()
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = public, pg_temp
AS $$
  SELECT public.generate_xd_public_id();
$$;

CREATE OR REPLACE FUNCTION public.generate_xd_company_id()
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = public, pg_temp
AS $$
  SELECT public.generate_xd_public_id();
$$;

CREATE OR REPLACE FUNCTION public.assign_xd_user_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.xd_id := public.generate_xd_public_id();
  ELSIF NEW.xd_id IS DISTINCT FROM OLD.xd_id THEN
    RAISE EXCEPTION 'XDrive public ID is immutable after assignment.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_xd_company_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.xd_id := public.generate_xd_public_id();
  ELSIF NEW.xd_id IS DISTINCT FROM OLD.xd_id THEN
    RAISE EXCEPTION 'XDrive public ID is immutable after assignment.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_assign_xd_id ON public.profiles;
CREATE TRIGGER trg_profiles_assign_xd_id
BEFORE INSERT OR UPDATE OF xd_id ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.assign_xd_user_id();

DROP TRIGGER IF EXISTS trg_companies_assign_xd_id ON public.companies;
CREATE TRIGGER trg_companies_assign_xd_id
BEFORE INSERT OR UPDATE OF xd_id ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.assign_xd_company_id();

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_xd_id_format_chk;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_xd_id_format_chk
  CHECK (xd_id ~ '^XD-[0-9]{6,}$');

ALTER TABLE public.companies DROP CONSTRAINT IF EXISTS companies_xd_id_format_chk;
ALTER TABLE public.companies ADD CONSTRAINT companies_xd_id_format_chk
  CHECK (xd_id ~ '^XD-[0-9]{6,}$');

CREATE UNIQUE INDEX IF NOT EXISTS companies_xd_id_unique ON public.companies(xd_id);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_xd_id_uidx ON public.profiles(xd_id) WHERE xd_id IS NOT NULL;

COMMIT;
