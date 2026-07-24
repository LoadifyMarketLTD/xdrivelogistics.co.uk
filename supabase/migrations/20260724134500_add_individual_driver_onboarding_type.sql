-- Add a distinct onboarding domain for drivers who do not own or operate a
-- carrier business workspace. Existing owner_driver rows remain unchanged.

ALTER TABLE public.onboarding_applications
  DROP CONSTRAINT IF EXISTS onboarding_applications_account_type_check;

ALTER TABLE public.onboarding_applications
  ADD CONSTRAINT onboarding_applications_account_type_check
  CHECK (
    account_type IN (
      'customer_shipper',
      'broker_shipper',
      'fleet_courier',
      'individual_driver',
      'owner_driver'
    )
  );

COMMENT ON COLUMN public.onboarding_applications.account_type IS
  'Onboarding domain. individual_driver is driver-only and must not provision a carrier company or owner-driver business workspace.';
