BEGIN;

CREATE OR REPLACE FUNCTION public.get_missing_onboarding_documents(p_application_id uuid)
RETURNS TABLE(document_family text, doc_type text, reason text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH app AS (
    SELECT id, account_type
    FROM public.onboarding_applications
    WHERE id = p_application_id
  ),
  requirements AS (
    SELECT r.document_family, r.doc_type, app.account_type
    FROM public.compliance_document_requirements r
    JOIN app ON app.account_type = r.account_type
    WHERE r.active = true
      AND r.required = true
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
          AND (document.expiry_date IS NULL OR document.expiry_date >= current_date)
      )
      WHEN requirement.document_family = 'identity' THEN (
        EXISTS (
          SELECT 1
          FROM public.driver_identity_documents document
          WHERE document.onboarding_application_id = p_application_id
            AND document.doc_type = requirement.doc_type
            AND document.verification_status = 'verified'
            AND document.file_path IS NOT NULL
            AND (document.expiry_date IS NULL OR document.expiry_date >= current_date)
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
              AND (licence.expiry_date IS NULL OR licence.expiry_date >= current_date)
          )
        )
      )
      ELSE false
    END
  );
$function$;

UPDATE public.onboarding_applications
SET status = 'under_review',
    current_step = 'compliance_remediation',
    last_activity_at = now(),
    updated_at = now()
WHERE status = 'in_progress'
  AND current_step = 'compliance_remediation'
  AND COALESCE((payload->>'legacy_driver_compliance_remediation')::boolean, false) = true;

COMMIT;
