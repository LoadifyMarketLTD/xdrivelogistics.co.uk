BEGIN;

ALTER TABLE public.registration_legal_acceptances
  ADD COLUMN IF NOT EXISTS language_comprehension_confirmed_at timestamptz;

ALTER TABLE public.registration_legal_acceptances
  DROP CONSTRAINT IF EXISTS registration_legal_acceptances_language_supported;
ALTER TABLE public.registration_legal_acceptances
  ADD CONSTRAINT registration_legal_acceptances_language_supported CHECK (
    acceptance_language IS NULL
    OR acceptance_language IN (
      'en','ro','fr','es','pl',
      'ur','pa-guru','pa-shah','hi','bn','gu'
    )
  );

ALTER TABLE public.registration_legal_acceptances
  DROP CONSTRAINT IF EXISTS registration_legal_acceptances_language_comprehension_same_event;
ALTER TABLE public.registration_legal_acceptances
  ADD CONSTRAINT registration_legal_acceptances_language_comprehension_same_event CHECK (
    language_comprehension_confirmed_at IS NULL
    OR language_comprehension_confirmed_at = accepted_at
  );

COMMENT ON COLUMN public.registration_legal_acceptances.language_comprehension_confirmed_at IS
  'Timestamp of the explicit confirmation that the signer can read and understand the selected legal document language. New acceptances record the same instant as accepted_at; legacy rows remain NULL and are not backfilled.';

COMMIT;
NOTIFY pgrst, 'reload schema';
