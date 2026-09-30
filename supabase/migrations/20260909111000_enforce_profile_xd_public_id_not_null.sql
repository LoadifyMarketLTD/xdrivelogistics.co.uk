BEGIN;

-- The hosted schema requires every profile to own a public XD identifier.
-- After the standardisation migration has created the generator, fill any
-- legacy/fresh rows that were still null and enforce hosted nullability.
UPDATE public.profiles
SET xd_id = public.generate_xd_public_id()
WHERE xd_id IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN xd_id SET NOT NULL;

COMMIT;