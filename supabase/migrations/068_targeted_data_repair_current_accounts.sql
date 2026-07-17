-- 068_targeted_data_repair_current_accounts.sql
-- Targeted account repair with non-destructive safeguards.

BEGIN;

CREATE TABLE IF NOT EXISTS public.migration_068_profile_snapshot (
  id bigserial PRIMARY KEY,
  captured_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid,
  role text,
  company_id uuid,
  is_driver boolean
);

CREATE TABLE IF NOT EXISTS public.migration_068_membership_snapshot (
  id bigserial PRIMARY KEY,
  captured_at timestamptz NOT NULL DEFAULT now(),
  membership_id uuid,
  company_id uuid,
  user_id uuid,
  invited_email text,
  role_in_company text,
  status text
);

CREATE TABLE IF NOT EXISTS public.migration_068_company_snapshot (
  id bigserial PRIMARY KEY,
  captured_at timestamptz NOT NULL DEFAULT now(),
  company_id uuid,
  name text,
  status text,
  created_by uuid
);

INSERT INTO public.migration_068_profile_snapshot (user_id, role, company_id, is_driver)
SELECT p.user_id, p.role, p.company_id, p.is_driver
FROM public.profiles p
JOIN auth.users u ON u.id = p.user_id
WHERE LOWER(u.email) IN ('xdrivelogisticsltd@gmail.com', 'dannyelbill@gmail.com');

INSERT INTO public.migration_068_membership_snapshot (membership_id, company_id, user_id, invited_email, role_in_company, status)
SELECT m.id, m.company_id, m.user_id, m.invited_email, m.role_in_company::text, m.status::text
FROM public.company_memberships m
JOIN auth.users u ON u.id = m.user_id
WHERE LOWER(u.email) IN ('xdrivelogisticsltd@gmail.com', 'dannyelbill@gmail.com');

INSERT INTO public.migration_068_company_snapshot (company_id, name, status, created_by)
SELECT c.id, c.name, c.status, c.created_by
FROM public.companies c
WHERE LOWER(c.name) LIKE '%xdrive%';

DO $$
DECLARE
  v_owner_user uuid;
  v_owner_company uuid;
  v_driver_user uuid;
  v_driver_company uuid;
  v_canonical_xdrive uuid;
  v_duplicate_xdrive uuid;
BEGIN
  -- Owner account normalization
  SELECT id INTO v_owner_user
  FROM auth.users
  WHERE LOWER(email) = 'xdrivelogisticsltd@gmail.com'
  LIMIT 1;

  IF v_owner_user IS NOT NULL THEN
    SELECT company_id INTO v_owner_company
    FROM public.profiles
    WHERE user_id = v_owner_user;

    IF v_owner_company IS NULL THEN
      SELECT company_id INTO v_owner_company
      FROM public.company_memberships
      WHERE user_id = v_owner_user
        AND status = 'active'
      ORDER BY created_at ASC
      LIMIT 1;
    END IF;

    IF v_owner_company IS NULL THEN
      SELECT id INTO v_owner_company
      FROM public.companies
      WHERE created_by = v_owner_user
      ORDER BY created_at ASC
      LIMIT 1;
    END IF;

    IF v_owner_company IS NULL THEN
      INSERT INTO public.companies (name, email, created_by, status, company_type)
      VALUES ('XDrive Workspace', 'xdrivelogisticsltd@gmail.com', v_owner_user, 'active', 'admin')
      RETURNING id INTO v_owner_company;
    END IF;

    UPDATE public.profiles
    SET role = 'owner',
        company_id = v_owner_company,
        updated_at = NOW()
    WHERE user_id = v_owner_user;

    INSERT INTO public.company_memberships (company_id, user_id, invited_email, role_in_company, status, updated_at)
    VALUES (v_owner_company, v_owner_user, 'xdrivelogisticsltd@gmail.com', 'owner', 'active', NOW())
    ON CONFLICT (company_id, user_id)
    DO UPDATE SET role_in_company = 'owner',
                  status = 'active',
                  updated_at = EXCLUDED.updated_at;
  END IF;

  -- Driver account normalization
  SELECT id INTO v_driver_user
  FROM auth.users
  WHERE LOWER(email) = 'dannyelbill@gmail.com'
  LIMIT 1;

  IF v_driver_user IS NOT NULL THEN
    SELECT d.company_id INTO v_driver_company
    FROM public.drivers d
    WHERE d.user_id = v_driver_user
    ORDER BY d.created_at ASC
    LIMIT 1;

    IF v_driver_company IS NULL THEN
      SELECT p.company_id INTO v_driver_company
      FROM public.profiles p
      WHERE p.user_id = v_driver_user;
    END IF;

    IF v_driver_company IS NULL THEN
      SELECT m.company_id INTO v_driver_company
      FROM public.company_memberships m
      WHERE m.user_id = v_driver_user
        AND m.status = 'active'
      ORDER BY m.created_at ASC
      LIMIT 1;
    END IF;

    IF v_driver_company IS NULL THEN
      v_driver_company := v_owner_company;
    END IF;

    IF v_driver_company IS NOT NULL THEN
      UPDATE public.profiles
      SET role = 'driver',
          is_driver = TRUE,
          company_id = v_driver_company,
          updated_at = NOW()
      WHERE user_id = v_driver_user;

      UPDATE public.drivers
      SET company_id = v_driver_company,
          user_id = COALESCE(user_id, v_driver_user)
      WHERE user_id = v_driver_user
         OR LOWER(email) = 'dannyelbill@gmail.com';

      INSERT INTO public.company_memberships (company_id, user_id, invited_email, role_in_company, status, updated_at)
      VALUES (v_driver_company, v_driver_user, 'dannyelbill@gmail.com', 'member', 'active', NOW())
      ON CONFLICT (company_id, user_id)
      DO UPDATE SET role_in_company = 'member',
                    status = 'active',
                    updated_at = EXCLUDED.updated_at;
    END IF;
  END IF;

  -- Duplicate XDrive company consolidation (phase 1 non-destructive)
  SELECT c.id INTO v_canonical_xdrive
  FROM public.companies c
  LEFT JOIN auth.users u ON u.id = c.created_by
  WHERE LOWER(c.name) LIKE '%xdrive%'
  ORDER BY (LOWER(COALESCE(u.email, '')) = 'xdrivelogisticsltd@gmail.com') DESC,
           c.created_at ASC
  LIMIT 1;

  IF v_canonical_xdrive IS NOT NULL THEN
    FOR v_duplicate_xdrive IN
      SELECT c.id
      FROM public.companies c
      WHERE LOWER(c.name) LIKE '%xdrive%'
        AND c.id <> v_canonical_xdrive
    LOOP
      UPDATE public.drivers SET company_id = v_canonical_xdrive WHERE company_id = v_duplicate_xdrive;
      UPDATE public.vehicles SET company_id = v_canonical_xdrive WHERE company_id = v_duplicate_xdrive;
      UPDATE public.jobs SET company_id = v_canonical_xdrive WHERE company_id = v_duplicate_xdrive;
      UPDATE public.quotes SET company_id = v_canonical_xdrive WHERE company_id = v_duplicate_xdrive;
      UPDATE public.invoices SET company_id = v_canonical_xdrive WHERE company_id = v_duplicate_xdrive;
      UPDATE public.job_notes SET company_id = v_canonical_xdrive WHERE company_id = v_duplicate_xdrive;
      UPDATE public.diary_events SET company_id = v_canonical_xdrive WHERE company_id = v_duplicate_xdrive;
      UPDATE public.return_journeys SET company_id = v_canonical_xdrive WHERE company_id = v_duplicate_xdrive;
      UPDATE public.driver_locations SET company_id = v_canonical_xdrive WHERE company_id = v_duplicate_xdrive;

      INSERT INTO public.company_memberships (company_id, user_id, invited_email, role_in_company, status, created_at, updated_at)
      SELECT v_canonical_xdrive, m.user_id, m.invited_email, m.role_in_company, m.status, m.created_at, NOW()
      FROM public.company_memberships m
      WHERE m.company_id = v_duplicate_xdrive
        AND m.user_id IS NOT NULL
      ON CONFLICT (company_id, user_id)
      DO UPDATE SET role_in_company = EXCLUDED.role_in_company,
                    status = EXCLUDED.status,
                    updated_at = EXCLUDED.updated_at;

      INSERT INTO public.company_memberships (company_id, user_id, invited_email, role_in_company, status, created_at, updated_at)
      SELECT v_canonical_xdrive, NULL, m.invited_email, m.role_in_company, m.status, m.created_at, NOW()
      FROM public.company_memberships m
      WHERE m.company_id = v_duplicate_xdrive
        AND m.user_id IS NULL
        AND m.invited_email IS NOT NULL
      ON CONFLICT (company_id, invited_email)
      DO UPDATE SET role_in_company = EXCLUDED.role_in_company,
                    status = EXCLUDED.status,
                    updated_at = EXCLUDED.updated_at;

      UPDATE public.company_memberships
      SET status = 'suspended',
          updated_at = NOW()
      WHERE company_id = v_duplicate_xdrive;

      UPDATE public.companies
      SET status = 'inactive'
      WHERE id = v_duplicate_xdrive;
    END LOOP;
  END IF;
END
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
