CREATE OR REPLACE FUNCTION public.get_missing_onboarding_documents(p_application_id uuid)
RETURNS TABLE(document_family text, doc_type text, reason text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH app AS (
    SELECT id, account_type, COALESCE(payload, '{}'::jsonb) AS payload
    FROM public.onboarding_applications
    WHERE id = p_application_id
  ),
  base_requirements AS (
    SELECT r.document_family, r.doc_type, app.account_type
    FROM public.compliance_document_requirements r
    JOIN app ON app.account_type = r.account_type
    WHERE r.active = true
      AND r.required = true
  ),
  dynamic_cpc AS (
    SELECT 'identity'::text AS document_family, 'cpc'::text AS doc_type, app.account_type
    FROM app
    WHERE app.account_type = 'owner_driver'
      AND (app.payload ? 'vehicle_type' OR app.payload ? 'max_weight_kg')
      AND public.vehicle_requires_driver_cpc(
        app.payload->>'vehicle_type',
        CASE
          WHEN COALESCE(app.payload->>'max_weight_kg', '') ~ '^[0-9]+([.][0-9]+)?$'
            THEN (app.payload->>'max_weight_kg')::numeric
          ELSE NULL
        END,
        lower(COALESCE(app.payload->>'is_zero_emission', 'false')) IN ('true','1','yes')
      )
  ),
  requirements AS (
    SELECT * FROM base_requirements
    UNION
    SELECT * FROM dynamic_cpc
  )
  SELECT
    requirement.document_family,
    requirement.doc_type,
    CASE
      WHEN requirement.document_family = 'company'
        THEN 'Missing, unapproved or expired company document.'
      ELSE 'Missing, unverified or expired identity document.'
    END AS reason
  FROM requirements requirement
  WHERE NOT (
    CASE
      WHEN requirement.document_family = 'company' THEN EXISTS (
        SELECT 1
        FROM public.company_documents document
        WHERE document.onboarding_application_id = p_application_id
          AND document.doc_type = requirement.doc_type
          AND document.status = 'approved'
          AND document.file_path IS NOT NULL
          AND (document.expiry_date IS NULL OR document.expiry_date >= CURRENT_DATE)
      )
      WHEN requirement.document_family = 'identity' THEN (
        EXISTS (
          SELECT 1
          FROM public.driver_identity_documents document
          WHERE document.onboarding_application_id = p_application_id
            AND document.doc_type = requirement.doc_type
            AND document.verification_status = 'verified'
            AND document.file_path IS NOT NULL
            AND (document.expiry_date IS NULL OR document.expiry_date >= CURRENT_DATE)
        )
        OR (
          requirement.account_type = 'owner_driver'
          AND requirement.doc_type = 'proof_of_address'
          AND EXISTS (
            SELECT 1
            FROM public.driver_identity_documents licence
            WHERE licence.onboarding_application_id = p_application_id
              AND licence.doc_type = 'driving_licence'
              AND licence.verification_status = 'verified'
              AND licence.file_path IS NOT NULL
              AND (licence.expiry_date IS NULL OR licence.expiry_date >= CURRENT_DATE)
          )
        )
      )
      ELSE false
    END
  );
$function$;;
