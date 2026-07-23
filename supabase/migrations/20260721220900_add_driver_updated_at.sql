-- Clean-bootstrap compatibility for account reconciliation and native runtime.
-- Historical driver tables were created without updated_at in some database
-- shapes, while later reconciliation and API code update this timestamp.

BEGIN;

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.drivers
SET updated_at = COALESCE(updated_at, created_at, now());

COMMIT;

NOTIFY pgrst, 'reload schema';
