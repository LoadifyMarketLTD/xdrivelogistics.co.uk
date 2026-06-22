-- Migration 100: split Customer / Shipper from Broker onboarding.
-- Keeps legacy broker_shipper/fleet_courier/owner_driver values and adds
-- customer_shipper as the lightweight customer onboarding account type.

ALTER TABLE public.onboarding_applications
  DROP CONSTRAINT IF EXISTS onboarding_applications_account_type_check;

ALTER TABLE public.onboarding_applications
  ADD CONSTRAINT onboarding_applications_account_type_check
  CHECK (account_type IN ('customer_shipper', 'broker_shipper', 'fleet_courier', 'owner_driver'));
