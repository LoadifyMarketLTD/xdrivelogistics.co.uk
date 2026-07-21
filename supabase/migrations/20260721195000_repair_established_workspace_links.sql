-- Repair established operational accounts that predate the onboarding table or
-- were left partially provisioned by the emergency login fallback. This runs
-- once during migration. Login remains read-only.
--
-- Safety rules:
--   * profile and company must both be active;
--   * no non-approved onboarding application may exist;
--   * suspended/removed memberships are never overwritten;
--   * ambiguous company_staff and Fleet Driver identities are not guessed.

BEGIN;

-- Link an active profile to the one active company it already created, but only
-- when the result is unambiguous and the role is an operational workspace owner.
WITH single_active_company AS (
  SELECT
    c.created_by AS user_id,
    min(c.id) AS company_id,
    count(*) AS company_count
  FROM public.companies c
  WHERE c.created_by IS NOT NULL
    AND c.status::text = 'active'
  GROUP BY c.created_by
  HAVING count(*) = 1
)
UPDATE public.profiles p
SET company_id = c.company_id,
    updated_at = now()
FROM single_active_company c
WHERE p.user_id = c.user_id
  AND p.company_id IS NULL
  AND p.status = 'active'
  AND lower(COALESCE(p.role, '')) IN (
    'customer', 'customer_shipper', 'shipper',
    'broker', 'broker_shipper', 'transport_broker',
    'company_admin', 'admin', 'org_admin'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.onboarding_applications a
    WHERE a.user_id = p.user_id
      AND a.status <> 'approved'
  );

-- Some established Customer, Broker and Fleet Operator profiles were activated
-- before a company row was created. Create that tenancy exactly once from the
-- explicit profile role; never use an unknown or generic company_staff role.
INSERT INTO public.companies (
  name,
  email,
  status,
  company_type,
  created_by,
  created_at,
  updated_at
)
SELECT
  COALESCE(NULLIF(trim(p.full_name), ''), split_part(u.email, '@', 1)) || ' workspace',
  u.email,
  'active',
  CASE
    WHEN lower(p.role) IN ('customer', 'customer_shipper', 'shipper') THEN 'customer'
    WHEN lower(p.role) IN ('broker', 'broker_shipper', 'transport_broker') THEN 'broker'
    ELSE 'carrier'
  END,
  p.user_id,
  now(),
  now()
FROM public.profiles p
JOIN auth.users u ON u.id = p.user_id
WHERE p.company_id IS NULL
  AND p.status = 'active'
  AND lower(COALESCE(p.role, '')) IN (
    'customer', 'customer_shipper', 'shipper',
    'broker', 'broker_shipper', 'transport_broker',
    'company_admin', 'admin', 'org_admin'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.companies c
    WHERE c.created_by = p.user_id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.onboarding_applications a
    WHERE a.user_id = p.user_id
      AND a.status <> 'approved'
  );

-- Attach profiles to the company created by the previous statement. The
-- one-company condition prevents an arbitrary choice if historical duplicates
-- already exist.
WITH single_active_company AS (
  SELECT
    c.created_by AS user_id,
    min(c.id) AS company_id,
    count(*) AS company_count
  FROM public.companies c
  WHERE c.created_by IS NOT NULL
    AND c.status::text = 'active'
  GROUP BY c.created_by
  HAVING count(*) = 1
)
UPDATE public.profiles p
SET company_id = c.company_id,
    updated_at = now()
FROM single_active_company c
WHERE p.user_id = c.user_id
  AND p.company_id IS NULL
  AND p.status = 'active'
  AND lower(COALESCE(p.role, '')) IN (
    'customer', 'customer_shipper', 'shipper',
    'broker', 'broker_shipper', 'transport_broker',
    'company_admin', 'admin', 'org_admin'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.onboarding_applications a
    WHERE a.user_id = p.user_id
      AND a.status <> 'approved'
  );

-- Create a missing active membership only when no membership row of any status
-- exists. A suspended or removed row is an explicit governance decision and is
-- therefore preserved.
INSERT INTO public.company_memberships (
  company_id,
  user_id,
  invited_email,
  role_in_company,
  status,
  created_at,
  updated_at
)
SELECT
  p.company_id,
  p.user_id,
  u.email,
  'owner',
  'active',
  now(),
  now()
FROM public.profiles p
JOIN public.companies c ON c.id = p.company_id
JOIN auth.users u ON u.id = p.user_id
WHERE p.status = 'active'
  AND c.status::text = 'active'
  AND lower(COALESCE(p.role, '')) IN (
    'customer', 'customer_shipper', 'shipper',
    'broker', 'broker_shipper', 'transport_broker',
    'company_admin', 'admin', 'org_admin'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.company_memberships cm
    WHERE cm.company_id = p.company_id
      AND cm.user_id = p.user_id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.onboarding_applications a
    WHERE a.user_id = p.user_id
      AND a.status <> 'approved'
  )
ON CONFLICT (company_id, user_id) DO NOTHING;

-- Approved Owner Drivers already have both a driver record and a tenancy
-- company. Restore only a missing owner membership; do not manufacture a driver
-- identity from profile metadata alone.
INSERT INTO public.company_memberships (
  company_id,
  user_id,
  invited_email,
  role_in_company,
  status,
  created_at,
  updated_at
)
SELECT
  d.company_id,
  d.user_id,
  u.email,
  'owner',
  'active',
  now(),
  now()
FROM public.drivers d
JOIN public.profiles p ON p.user_id = d.user_id
JOIN public.companies c ON c.id = d.company_id
JOIN auth.users u ON u.id = d.user_id
WHERE d.user_id IS NOT NULL
  AND d.company_id IS NOT NULL
  AND d.app_access = true
  AND p.status = 'active'
  AND p.is_driver = true
  AND c.status::text = 'active'
  AND lower(COALESCE(c.company_type, '')) IN ('owner_driver', 'owner_operator')
  AND NOT EXISTS (
    SELECT 1
    FROM public.company_memberships cm
    WHERE cm.company_id = d.company_id
      AND cm.user_id = d.user_id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.onboarding_applications a
    WHERE a.user_id = d.user_id
      AND a.status <> 'approved'
  )
ON CONFLICT (company_id, user_id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
COMMIT;
