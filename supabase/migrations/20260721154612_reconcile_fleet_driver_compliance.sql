BEGIN;

CREATE OR REPLACE FUNCTION public.fleet_driver_compliance_current(p_driver_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invitation public.fleet_driver_invitations%ROWTYPE;
  v_required_docs text[] := ARRAY['driving_licence', 'proof_of_address', 'right_to_work'];
BEGIN
  IF p_driver_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO v_invitation
  FROM public.fleet_driver_invitations
  WHERE driver_id = p_driver_id
  ORDER BY updated_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN true;
  END IF;

  IF v_invitation.status <> 'approved'
     OR v_invitation.accepted_at IS NULL
     OR v_invitation.approved_at IS NULL THEN
    RETURN false;
  END IF;

  RETURN NOT EXISTS (
    SELECT 1
    FROM unnest(v_required_docs) required(doc_type)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.driver_documents dd
      WHERE dd.driver_id = p_driver_id
        AND dd.doc_type = required.doc_type
        AND dd.file_path IS NOT NULL
        AND dd.status = 'approved'
        AND (dd.expiry_date IS NULL OR dd.expiry_date >= current_date)
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fleet_driver_compliance_current(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fleet_driver_compliance_current(uuid)
  TO service_role;

DO $$
BEGIN
  IF to_regprocedure('public.fleet_driver_compliance_current(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Fleet Driver compliance reconciliation failed.';
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
