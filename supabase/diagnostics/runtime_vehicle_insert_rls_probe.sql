-- Runtime probe: vehicles INSERT RLS diagnostics for current authenticated user.
-- Run in Supabase SQL Editor as the affected authenticated user context if possible.
-- Replace company_name filter if required.

BEGIN;

-- 1) Resolve target company from membership/profile for visibility
WITH ctx AS (
  SELECT auth.uid() AS uid
),
candidate_company AS (
  SELECT c.id, c.name
  FROM public.companies c
  WHERE c.name = 'XDrive Logistics Admin Company'
  LIMIT 1
)
SELECT
  ctx.uid AS auth_uid,
  cc.id AS company_id,
  cc.name AS company_name
FROM ctx
CROSS JOIN candidate_company cc;

-- 2) Membership row used by helper functions
SELECT
  cm.company_id,
  cm.user_id,
  cm.role_in_company,
  cm.status,
  cm.created_at
FROM public.company_memberships cm
WHERE cm.user_id = auth.uid()
ORDER BY cm.created_at DESC;

-- 3) Profile row used by helper functions
SELECT
  p.user_id,
  p.role,
  p.status,
  p.company_id
FROM public.profiles p
WHERE p.user_id = auth.uid()
LIMIT 1;

-- 4) Helper evaluation for target company
WITH company AS (
  SELECT id
  FROM public.companies
  WHERE name = 'XDrive Logistics Admin Company'
  LIMIT 1
)
SELECT
  c.id AS company_id,
  public.is_company_admin(c.id) AS is_company_admin,
  public.is_company_operator(c.id) AS is_company_operator
FROM company c;

-- 5) Active RLS policies on vehicles
SELECT
  pol.policyname,
  pol.cmd,
  pol.permissive,
  pol.qual,
  pol.with_check
FROM pg_policies pol
WHERE pol.schemaname = 'public'
  AND pol.tablename = 'vehicles'
ORDER BY pol.policyname;

-- 6) Dry-run INSERT gate test (rolled back)
WITH company AS (
  SELECT id
  FROM public.companies
  WHERE name = 'XDrive Logistics Admin Company'
  LIMIT 1
)
INSERT INTO public.vehicles (company_id, type, reg_plate, make, model, payload_kg, has_tail_lift, assigned_driver_id)
SELECT
  c.id,
  'van_large'::public.vehicle_type,
  'RLS-PROBE',
  'probe',
  'probe',
  NULL,
  false,
  NULL
FROM company c
RETURNING id, company_id, type, reg_plate;

ROLLBACK;
