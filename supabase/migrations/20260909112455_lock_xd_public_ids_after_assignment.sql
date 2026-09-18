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
$$;;
