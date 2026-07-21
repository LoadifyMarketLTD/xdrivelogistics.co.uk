-- Repair legacy role aliases and emergency Customer fallbacks once, from
-- onboarding/company/driver evidence. This is intentionally a migration rather
-- than a login side effect.

BEGIN;

-- Public registrations: onboarding account_type is authoritative. Preserve a
-- deliberately blocked lifecycle state, but correct the role, company link and
-- ordinary pending/active status.
UPDATE public.profiles p
SET role = CASE
      WHEN a.account_type = 'customer_shipper' THEN 'customer'
      WHEN a.account_type = 'broker_shipper' THEN 'broker'
      WHEN a.account_type = 'fleet_courier' THEN 'company_admin'
      WHEN a.account_type = 'owner_driver' THEN 'driver'
      ELSE p.role
    END,
    status = CASE
      WHEN p.status IN ('blocked', 'suspended', 'inactive') THEN p.status
      WHEN a.status = 'approved' THEN 'active'
      ELSE 'pending'
    END,
    company_id = COALESCE(a.company_id, p.company_id),
    is_driver = a.account_type = 'owner_driver',
    updated_at = now()
FROM public.onboarding_applications a
WHERE a.user_id = p.user_id
  AND p.role IS DISTINCT FROM 'owner'
  AND a.account_type IN ('customer_shipper', 'broker_shipper', 'fleet_courier', 'owner_driver');

-- Established accounts without public onboarding: use the latest active
-- membership in an active, explicitly typed company. Unknown company types are
-- not converted to Customer or any other role.
WITH ranked_company_membership AS (
  SELECT
    cm.user_id,
    cm.company_id,
    cm.role_in_company,
    lower(COALESCE(c.company_type, '')) AS company_type,
    row_number() OVER (
      PARTITION BY cm.user_id
      ORDER BY cm.updated_at DESC NULLS LAST, cm.created_at DESC NULLS LAST, cm.id DESC
    ) AS position
  FROM public.company_memberships cm
  JOIN public.companies c ON c.id = cm.company_id
  WHERE cm.user_id IS NOT NULL
    AND cm.status = 'active'
    AND c.status::text = 'active'
    AND lower(COALESCE(c.company_type, '')) IN (
      'broker', 'broker_shipper', 'transport_broker',
      'customer', 'customer_shipper', 'shipper',
      'carrier', 'fleet', 'fleet_courier', 'courier', 'haulier',
      'owner_driver', 'owner_operator'
    )
), authoritative_company AS (
  SELECT *
  FROM ranked_company_membership
  WHERE position = 1
)
UPDATE public.profiles p
SET role = CASE
      WHEN a.company_type IN ('broker', 'broker_shipper', 'transport_broker') THEN 'broker'
      WHEN a.company_type IN ('customer', 'customer_shipper', 'shipper') THEN 'customer'
      WHEN a.company_type IN ('owner_driver', 'owner_operator') THEN 'driver'
      WHEN a.role_in_company IN ('owner', 'admin') THEN 'company_admin'
      ELSE 'company_staff'
    END,
    status = CASE
      WHEN p.status IN ('blocked', 'suspended', 'inactive') THEN p.status
      ELSE 'active'
    END,
    company_id = a.company_id,
    is_driver = a.company_type IN ('owner_driver', 'owner_operator'),
    updated_at = now()
FROM authoritative_company a
WHERE p.user_id = a.user_id
  AND p.role IS DISTINCT FROM 'owner'
  AND NOT EXISTS (
    SELECT 1
    FROM public.onboarding_applications oa
    WHERE oa.user_id = p.user_id
  );

-- Explicit driver rows are authoritative for invited Fleet Drivers and legacy
-- Owner Drivers. Do not overwrite a platform owner or a public onboarding role.
WITH ranked_driver AS (
  SELECT
    d.user_id,
    d.company_id,
    COALESCE(d.app_access, false) AS app_access,
    row_number() OVER (
      PARTITION BY d.user_id
      ORDER BY d.updated_at DESC NULLS LAST, d.created_at DESC NULLS LAST, d.id DESC
    ) AS position
  FROM public.drivers d
  WHERE d.user_id IS NOT NULL
)
UPDATE public.profiles p
SET role = 'driver',
    status = CASE
      WHEN p.status IN ('blocked', 'suspended', 'inactive') THEN p.status
      WHEN d.app_access THEN 'active'
      ELSE 'pending'
    END,
    company_id = COALESCE(d.company_id, p.company_id),
    is_driver = true,
    updated_at = now()
FROM ranked_driver d
WHERE d.position = 1
  AND p.user_id = d.user_id
  AND p.role IS DISTINCT FROM 'owner'
  AND NOT EXISTS (
    SELECT 1
    FROM public.onboarding_applications oa
    WHERE oa.user_id = p.user_id
  );

NOTIFY pgrst, 'reload schema';
COMMIT;
