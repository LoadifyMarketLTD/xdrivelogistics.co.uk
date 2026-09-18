DO $$
DECLARE
  v_max_profile bigint;
  v_company_count bigint;
  v_last_assigned bigint;
BEGIN
  SELECT COALESCE(max(substring(xd_id from '(\d{6})$')::bigint), 0)
  INTO v_max_profile
  FROM public.profiles
  WHERE xd_id ~ '(\d{6})$';

  -- Preserve each existing user's numeric identity, only shorten the public format.
  UPDATE public.profiles
  SET xd_id = 'XD-' || substring(xd_id from '(\d{6})$')
  WHERE xd_id ~ '(\d{6})$';

  -- Companies previously shared numbers with users and later used random IDs.
  -- Reassign every company deterministically into the global namespace after users.
  WITH ranked AS (
    SELECT id,
           row_number() OVER (ORDER BY created_at NULLS LAST, id) AS rn
    FROM public.companies
  )
  UPDATE public.companies c
  SET xd_id = 'XD-' || lpad((v_max_profile + ranked.rn)::text, 6, '0')
  FROM ranked
  WHERE c.id = ranked.id;

  SELECT count(*) INTO v_company_count FROM public.companies;
  v_last_assigned := v_max_profile + v_company_count;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class pc JOIN pg_namespace pn ON pn.oid = pc.relnamespace
    WHERE pn.nspname = 'public' AND pc.relname = 'xd_public_id_seq' AND pc.relkind = 'S'
  ) THEN
    EXECUTE 'CREATE SEQUENCE public.xd_public_id_seq';
  END IF;

  PERFORM setval('public.xd_public_id_seq', GREATEST(v_last_assigned, 1), true);
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
  ELSIF NEW.xd_id IS NULL THEN
    NEW.xd_id := OLD.xd_id;
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
  ELSIF NEW.xd_id IS NULL THEN
    NEW.xd_id := OLD.xd_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_companies_assign_xd_id ON public.companies;
CREATE TRIGGER trg_companies_assign_xd_id
BEFORE INSERT OR UPDATE OF xd_id ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.assign_xd_company_id();

DROP TRIGGER IF EXISTS trg_profiles_assign_xd_id ON public.profiles;
CREATE TRIGGER trg_profiles_assign_xd_id
BEFORE INSERT OR UPDATE OF xd_id ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.assign_xd_user_id();

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_xd_id_format_chk;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_xd_id_format_chk CHECK (xd_id ~ '^XD-[0-9]{6,}$');
ALTER TABLE public.companies DROP CONSTRAINT IF EXISTS companies_xd_id_format_chk;
ALTER TABLE public.companies ADD CONSTRAINT companies_xd_id_format_chk CHECK (xd_id ~ '^XD-[0-9]{6,}$');;
