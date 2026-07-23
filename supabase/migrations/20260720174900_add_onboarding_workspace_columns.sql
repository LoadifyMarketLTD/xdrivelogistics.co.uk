-- Clean-bootstrap compatibility for the audited onboarding schema.
-- Later onboarding submission and reconciliation migrations require these
-- workspace routing fields to exist on every environment.

BEGIN;

ALTER TABLE public.onboarding_applications
  ADD COLUMN IF NOT EXISTS workspace_mode text,
  ADD COLUMN IF NOT EXISTS owner_driver_workspace boolean NOT NULL DEFAULT false;

UPDATE public.onboarding_applications
SET workspace_mode = CASE
      WHEN account_type = 'owner_driver' THEN 'owner_driver'
      WHEN account_type = 'customer_shipper' THEN 'customer'
      ELSE 'company'
    END,
    owner_driver_workspace = (account_type = 'owner_driver')
WHERE workspace_mode IS NULL
   OR owner_driver_workspace IS DISTINCT FROM (account_type = 'owner_driver');

ALTER TABLE public.onboarding_applications
  ALTER COLUMN workspace_mode SET DEFAULT 'company';

COMMIT;

NOTIFY pgrst, 'reload schema';
