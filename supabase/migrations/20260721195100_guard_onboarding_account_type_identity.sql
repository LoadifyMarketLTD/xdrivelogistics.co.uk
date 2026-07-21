-- Prevent a public account from changing identity between Supabase signup
-- metadata and the onboarding row. The database is the final guard even if a
-- client sends a forged or conflicting initialization payload.

BEGIN;

CREATE OR REPLACE FUNCTION public.canonical_public_account_type(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE lower(trim(COALESCE(p_value, '')))
    WHEN 'customer' THEN 'customer'
    WHEN 'customer_shipper' THEN 'customer'
    WHEN 'shipper' THEN 'customer'
    WHEN 'client' THEN 'customer'

    WHEN 'broker' THEN 'broker'
    WHEN 'broker_shipper' THEN 'broker'
    WHEN 'transport_broker' THEN 'broker'
    WHEN 'freight_broker' THEN 'broker'

    WHEN 'fleet_operator' THEN 'fleet_operator'
    WHEN 'fleet_courier' THEN 'fleet_operator'
    WHEN 'fleet/courier' THEN 'fleet_operator'

    WHEN 'owner_driver' THEN 'owner_driver'
    WHEN 'owner-driver' THEN 'owner_driver'
    WHEN 'owner_operator' THEN 'owner_driver'
    WHEN 'owner-operator' THEN 'owner_driver'
    WHEN 'sole_trader' THEN 'owner_driver'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.guard_onboarding_account_type_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_metadata jsonb;
  v_distinct_types text[];
  v_saved_type text;
BEGIN
  SELECT COALESCE(u.raw_user_meta_data, '{}'::jsonb)
  INTO v_metadata
  FROM auth.users u
  WHERE u.id = NEW.user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Onboarding user does not exist.' USING ERRCODE = '23503';
  END IF;

  SELECT array_agg(DISTINCT canonical_type ORDER BY canonical_type)
  INTO v_distinct_types
  FROM (
    SELECT public.canonical_public_account_type(v_metadata ->> 'account_type') AS canonical_type
    UNION ALL
    SELECT public.canonical_public_account_type(v_metadata ->> 'requested_role')
    UNION ALL
    SELECT public.canonical_public_account_type(v_metadata ->> 'signup_type')
  ) candidates
  WHERE canonical_type IS NOT NULL;

  IF COALESCE(array_length(v_distinct_types, 1), 0) > 1 THEN
    RAISE EXCEPTION 'Conflicting public account types in signup metadata: %', v_distinct_types
      USING ERRCODE = '23514';
  END IF;

  v_saved_type := public.canonical_public_account_type(NEW.account_type);
  IF v_saved_type IS NULL THEN
    RAISE EXCEPTION 'Unsupported onboarding account type: %', NEW.account_type
      USING ERRCODE = '23514';
  END IF;

  IF COALESCE(array_length(v_distinct_types, 1), 0) = 1
     AND v_distinct_types[1] <> v_saved_type THEN
    RAISE EXCEPTION 'Onboarding account type % does not match signup account type %.',
      v_saved_type,
      v_distinct_types[1]
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_onboarding_account_type_identity ON public.onboarding_applications;
CREATE TRIGGER trg_guard_onboarding_account_type_identity
BEFORE INSERT OR UPDATE OF user_id, account_type ON public.onboarding_applications
FOR EACH ROW
EXECUTE FUNCTION public.guard_onboarding_account_type_identity();

REVOKE ALL ON FUNCTION public.canonical_public_account_type(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.canonical_public_account_type(text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.guard_onboarding_account_type_identity() FROM PUBLIC;

NOTIFY pgrst, 'reload schema';
COMMIT;
