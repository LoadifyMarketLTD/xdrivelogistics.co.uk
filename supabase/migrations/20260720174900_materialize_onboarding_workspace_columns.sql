-- Materialize onboarding workspace selectors before the audited compliance
-- alignment migration validates the canonical live schema.

BEGIN;

ALTER TABLE public.onboarding_applications
  ADD COLUMN IF NOT EXISTS workspace_mode text,
  ADD COLUMN IF NOT EXISTS owner_driver_workspace boolean NOT NULL DEFAULT false;

UPDATE public.onboarding_applications
SET
  workspace_mode = COALESCE(
    NULLIF(workspace_mode, ''),
    CASE account_type
      WHEN 'owner_driver' THEN 'owner_driver'
      WHEN 'fleet_courier' THEN 'company'
      WHEN 'broker_shipper' THEN 'broker'
      WHEN 'customer_shipper' THEN 'customer'
      ELSE NULL
    END
  ),
  owner_driver_workspace = owner_driver_workspace OR account_type = 'owner_driver';

COMMIT;
