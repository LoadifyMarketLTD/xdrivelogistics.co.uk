-- P1-004 schema guard: onboarding submit routes already depend on these profile
-- tables; define them in migrations so clean environments can replay safely.

CREATE TABLE IF NOT EXISTS public.fleet_compliance_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_application_id uuid NOT NULL REFERENCES public.onboarding_applications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  legal_company_name text NOT NULL,
  trading_name text,
  company_number text,
  vat_number text,
  registered_address text,
  trading_address text,
  contact_person text,
  compliance_contact text,
  transport_contact text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fleet_compliance_profiles_onboarding_unique UNIQUE (onboarding_application_id)
);

CREATE TABLE IF NOT EXISTS public.owner_driver_compliance_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_application_id uuid NOT NULL REFERENCES public.onboarding_applications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  dob date,
  nationality text,
  address text,
  phone text,
  email text,
  right_to_work_status text,
  visa_type text,
  visa_expiry date,
  share_code text,
  settled_status boolean,
  pre_settled_status boolean,
  registration text,
  make text,
  model text,
  payload text,
  dimensions text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT owner_driver_compliance_profiles_onboarding_unique UNIQUE (onboarding_application_id)
);

DROP TRIGGER IF EXISTS trg_touch_updated_at_fleet_compliance_profiles ON public.fleet_compliance_profiles;
CREATE TRIGGER trg_touch_updated_at_fleet_compliance_profiles
BEFORE UPDATE ON public.fleet_compliance_profiles
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at_generic();

DROP TRIGGER IF EXISTS trg_touch_updated_at_owner_driver_compliance_profiles ON public.owner_driver_compliance_profiles;
CREATE TRIGGER trg_touch_updated_at_owner_driver_compliance_profiles
BEFORE UPDATE ON public.owner_driver_compliance_profiles
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at_generic();

ALTER TABLE public.fleet_compliance_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_driver_compliance_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fleet_compliance_profiles_owner_select ON public.fleet_compliance_profiles;
CREATE POLICY fleet_compliance_profiles_owner_select
  ON public.fleet_compliance_profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS owner_driver_compliance_profiles_owner_select ON public.owner_driver_compliance_profiles;
CREATE POLICY owner_driver_compliance_profiles_owner_select
  ON public.owner_driver_compliance_profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
