BEGIN;

CREATE OR REPLACE FUNCTION public.get_expiring_vehicle_documents(p_days_ahead integer DEFAULT 30)
RETURNS TABLE(
  document_id uuid,
  vehicle_id uuid,
  vehicle_reference text,
  document_name text,
  expiry_date date,
  days_until_expiry integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    vd.id AS document_id,
    vd.vehicle_id,
    v.vehicle_reference,
    vd.document_name,
    vd.expiry_date,
    (vd.expiry_date - CURRENT_DATE)::integer AS days_until_expiry
  FROM public.vehicle_documents vd
  JOIN public.vehicles v ON vd.vehicle_id = v.id
  WHERE vd.expiry_date IS NOT NULL
    AND vd.expiry_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + p_days_ahead)
    AND v.company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  ORDER BY vd.expiry_date ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_expiring_vehicle_documents(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_expiring_vehicle_documents(integer)
  TO service_role;

COMMIT;