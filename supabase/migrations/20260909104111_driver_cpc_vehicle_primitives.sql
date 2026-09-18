ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS is_zero_emission boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.vehicle_requires_driver_cpc(
  p_vehicle_type text,
  p_max_weight_kg numeric,
  p_zero_emission boolean DEFAULT false
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_max_weight_kg IS NOT NULL AND p_max_weight_kg > 0 THEN
      CASE
        WHEN COALESCE(p_zero_emission, false) AND p_max_weight_kg <= 4250 THEN false
        ELSE p_max_weight_kg > 3500
      END
    WHEN lower(COALESCE(p_vehicle_type, '')) IN (
      'bicycle','motorbike','car','van_small','van_large','swb_van','mwb_van',
      'lwb_van','xlwb_van','luton','luton_tail_lift','curtainside_van','truck_3_5t'
    ) THEN false
    WHEN lower(COALESCE(p_vehicle_type, '')) IN (
      'truck_5t','truck_7_5t','truck_12t','truck_18t','truck_26t','artic',
      'artic_44t_curtainsider','artic_44t_box_trailer','artic_44t_flatbed',
      'artic_44t_refrigerated','artic_44t_double_deck'
    ) THEN true
    ELSE true
  END;
$$;

CREATE OR REPLACE FUNCTION public.xdrive_vehicle_rank(p_vehicle_type text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE lower(COALESCE(p_vehicle_type, ''))
    WHEN 'small_van' THEN 1 WHEN 'van_small' THEN 1
    WHEN 'swb_van' THEN 2 WHEN 'mwb_van' THEN 3
    WHEN 'lwb_van' THEN 4 WHEN 'xlwb_van' THEN 5 WHEN 'van_large' THEN 5
    WHEN 'luton' THEN 6 WHEN 'luton_tail_lift' THEN 6 WHEN 'curtainside_van' THEN 6
    WHEN 'truck_3_5t' THEN 7 WHEN 'truck_5t' THEN 8 WHEN 'truck_7_5t' THEN 9
    WHEN 'truck_12t' THEN 10 WHEN 'truck_18t' THEN 11 WHEN 'truck_26t' THEN 12
    WHEN 'artic' THEN 13 WHEN 'artic_44t_curtainsider' THEN 13
    WHEN 'artic_44t_box_trailer' THEN 13 WHEN 'artic_44t_flatbed' THEN 13
    WHEN 'artic_44t_refrigerated' THEN 13 WHEN 'artic_44t_double_deck' THEN 13
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION public.vehicle_can_cover_requested_type(
  p_actual_type text,
  p_requested_type text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN NULLIF(trim(COALESCE(p_requested_type, '')), '') IS NULL THEN true
    WHEN public.xdrive_vehicle_rank(p_actual_type) > 0
      AND public.xdrive_vehicle_rank(p_requested_type) > 0
      THEN public.xdrive_vehicle_rank(p_actual_type) >= public.xdrive_vehicle_rank(p_requested_type)
    ELSE lower(COALESCE(p_actual_type, '')) = lower(COALESCE(p_requested_type, ''))
  END;
$$;

CREATE OR REPLACE FUNCTION public.driver_has_valid_cpc(p_driver_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.driver_documents dd
    WHERE dd.driver_id = p_driver_id
      AND regexp_replace(lower(COALESCE(dd.doc_type, '')), '[^a-z0-9]+', '', 'g') IN ('cpc','cpccard')
      AND lower(COALESCE(dd.status::text, '')) = 'approved'
      AND (dd.expiry_date IS NULL OR dd.expiry_date >= CURRENT_DATE)
  ) OR EXISTS (
    SELECT 1
    FROM public.driver_identity_documents did
    JOIN public.onboarding_applications oa ON oa.id = did.onboarding_application_id
    JOIN public.drivers d ON d.user_id = oa.user_id
    WHERE d.id = p_driver_id
      AND oa.company_id = d.company_id
      AND regexp_replace(lower(COALESCE(did.doc_type, '')), '[^a-z0-9]+', '', 'g') IN ('cpc','cpccard')
      AND lower(COALESCE(did.verification_status::text, '')) = 'verified'
      AND did.file_path IS NOT NULL
      AND (did.expiry_date IS NULL OR did.expiry_date >= CURRENT_DATE)
  );
$$;

REVOKE ALL ON FUNCTION public.driver_has_valid_cpc(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.driver_has_valid_cpc(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_has_valid_cpc(uuid) TO service_role;;
