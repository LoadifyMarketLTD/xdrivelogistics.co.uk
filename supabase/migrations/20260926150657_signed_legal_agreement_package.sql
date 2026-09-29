BEGIN;

ALTER TABLE public.registration_legal_acceptances
  ADD COLUMN IF NOT EXISTS signer_full_name text,
  ADD COLUMN IF NOT EXISTS signature_method text,
  ADD COLUMN IF NOT EXISTS signature_payload_hash text,
  ADD COLUMN IF NOT EXISTS signed_pdf_bucket text,
  ADD COLUMN IF NOT EXISTS signed_pdf_path text,
  ADD COLUMN IF NOT EXISTS signed_pdf_hash text,
  ADD COLUMN IF NOT EXISTS signed_pdf_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS signature_snapshot_version text;

ALTER TABLE public.registration_legal_acceptances
  DROP CONSTRAINT IF EXISTS registration_legal_acceptances_signature_package_complete;
ALTER TABLE public.registration_legal_acceptances
  ADD CONSTRAINT registration_legal_acceptances_signature_package_complete CHECK (
    (signer_full_name IS NULL AND signature_method IS NULL AND signature_payload_hash IS NULL AND signed_pdf_bucket IS NULL AND signed_pdf_path IS NULL AND signed_pdf_hash IS NULL AND signed_pdf_created_at IS NULL AND signature_snapshot_version IS NULL)
    OR
    (
      NULLIF(btrim(signer_full_name),'') IS NOT NULL
      AND signature_method = 'typed_name_explicit_acceptance'
      AND signature_payload_hash ~ '^[0-9a-f]{64}$'
      AND signed_pdf_bucket = 'documents'
      AND NULLIF(btrim(signed_pdf_path),'') IS NOT NULL
      AND signed_pdf_hash ~ '^[0-9a-f]{64}$'
      AND signed_pdf_created_at IS NOT NULL
      AND NULLIF(btrim(signature_snapshot_version),'') IS NOT NULL
    )
  );

COMMENT ON COLUMN public.registration_legal_acceptances.signer_full_name IS
  'Full name typed by the signer during explicit electronic acceptance.';
COMMENT ON COLUMN public.registration_legal_acceptances.signature_payload_hash IS
  'SHA-256 binding signer identity, acceptance timestamp, evidence hash and exact document hashes.';
COMMENT ON COLUMN public.registration_legal_acceptances.signed_pdf_hash IS
  'SHA-256 of the exact signed agreement PDF stored privately in Supabase Storage.';

COMMIT;
NOTIFY pgrst, 'reload schema';
