BEGIN;

ALTER TABLE public.registration_legal_acceptances
  ADD COLUMN IF NOT EXISTS acceptance_language text,
  ADD COLUMN IF NOT EXISTS privacy_document_hash text,
  ADD COLUMN IF NOT EXISTS translation_snapshot_version text;

ALTER TABLE public.registration_legal_acceptances
  DROP CONSTRAINT IF EXISTS registration_legal_acceptances_language_supported;
ALTER TABLE public.registration_legal_acceptances
  ADD CONSTRAINT registration_legal_acceptances_language_supported CHECK (
    acceptance_language IS NULL OR acceptance_language IN ('en','ro','fr','es','pl')
  );

ALTER TABLE public.registration_legal_acceptances
  DROP CONSTRAINT IF EXISTS registration_legal_acceptances_privacy_hash_format;
ALTER TABLE public.registration_legal_acceptances
  ADD CONSTRAINT registration_legal_acceptances_privacy_hash_format CHECK (
    privacy_document_hash IS NULL OR privacy_document_hash ~ '^[0-9a-f]{64}$'
  );

ALTER TABLE public.registration_legal_acceptances
  DROP CONSTRAINT IF EXISTS registration_legal_acceptances_translation_snapshot_complete;
ALTER TABLE public.registration_legal_acceptances
  ADD CONSTRAINT registration_legal_acceptances_translation_snapshot_complete CHECK (
    (acceptance_language IS NULL AND privacy_document_hash IS NULL AND translation_snapshot_version IS NULL)
    OR
    (acceptance_language IS NOT NULL AND privacy_document_hash IS NOT NULL AND NULLIF(btrim(translation_snapshot_version),'') IS NOT NULL)
  );

CREATE OR REPLACE FUNCTION public.validate_registration_legal_translation_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_item jsonb;
BEGIN
  IF NEW.acceptance_language IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.privacy_document_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Invalid privacy document hash.' USING ERRCODE = '23514';
  END IF;

  IF jsonb_typeof(NEW.agreements) <> 'array' OR jsonb_array_length(NEW.agreements) = 0 THEN
    RAISE EXCEPTION 'Translated legal acceptance requires an agreement array.' USING ERRCODE = '23514';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(NEW.agreements)
  LOOP
    IF NULLIF(v_item->>'code','') IS NULL
      OR NULLIF(v_item->>'version','') IS NULL
      OR v_item->>'language' IS DISTINCT FROM NEW.acceptance_language
      OR NULLIF(v_item->>'translationVersion','') IS NULL
      OR COALESCE(v_item->>'documentHash','') !~ '^[0-9a-f]{64}$'
    THEN
      RAISE EXCEPTION 'Incomplete or mismatched translated legal agreement snapshot.' USING ERRCODE = '23514';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS registration_legal_acceptances_validate_translation_snapshot
  ON public.registration_legal_acceptances;
CREATE TRIGGER registration_legal_acceptances_validate_translation_snapshot
BEFORE INSERT ON public.registration_legal_acceptances
FOR EACH ROW EXECUTE FUNCTION public.validate_registration_legal_translation_snapshot();

REVOKE ALL ON FUNCTION public.validate_registration_legal_translation_snapshot() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_registration_legal_translation_snapshot() TO service_role;

COMMIT;
NOTIFY pgrst, 'reload schema';
