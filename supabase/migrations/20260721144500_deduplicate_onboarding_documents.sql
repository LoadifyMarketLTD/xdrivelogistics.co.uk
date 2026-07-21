BEGIN;

-- Historical submit functions inserted placeholder rows after uploaded evidence
-- already existed. Keep the strongest/latest row for each application and type,
-- then make that invariant enforceable for every future upload and submission.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY onboarding_application_id, doc_type
      ORDER BY
        (file_path IS NOT NULL) DESC,
        (status = 'approved') DESC,
        (status = 'pending') DESC,
        updated_at DESC NULLS LAST,
        created_at DESC NULLS LAST,
        id DESC
    ) AS position
  FROM public.company_documents
  WHERE onboarding_application_id IS NOT NULL
)
DELETE FROM public.company_documents target
USING ranked
WHERE target.id = ranked.id
  AND ranked.position > 1;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY onboarding_application_id, doc_type
      ORDER BY
        (file_path IS NOT NULL) DESC,
        (upload_status = 'uploaded') DESC,
        (verification_status = 'verified') DESC,
        updated_at DESC NULLS LAST,
        created_at DESC NULLS LAST,
        id DESC
    ) AS position
  FROM public.driver_identity_documents
  WHERE onboarding_application_id IS NOT NULL
)
DELETE FROM public.driver_identity_documents target
USING ranked
WHERE target.id = ranked.id
  AND ranked.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS company_documents_application_type_uidx
  ON public.company_documents (onboarding_application_id, doc_type)
  WHERE onboarding_application_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS driver_identity_documents_application_type_uidx
  ON public.driver_identity_documents (onboarding_application_id, doc_type)
  WHERE onboarding_application_id IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.company_documents
    WHERE onboarding_application_id IS NOT NULL
    GROUP BY onboarding_application_id, doc_type
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate company onboarding documents remain after reconciliation.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.driver_identity_documents
    WHERE onboarding_application_id IS NOT NULL
    GROUP BY onboarding_application_id, doc_type
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate driver onboarding documents remain after reconciliation.';
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
