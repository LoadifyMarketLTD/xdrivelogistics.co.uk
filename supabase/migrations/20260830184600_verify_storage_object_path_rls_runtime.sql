BEGIN;

-- P0-06 production RLS proof using an existing private vehicle document.
-- The proof switches to the real `authenticated` database role and supplies JWT
-- claims, so the SELECT is evaluated by storage.objects RLS rather than by the
-- migration/service role. Only a temporary table is mutated.
CREATE TEMP TABLE p0_06_storage_rls_probe (
  authorised_user_id uuid,
  outsider_user_id uuid,
  object_name text,
  authorised_visible integer,
  outsider_visible integer
) ON COMMIT DROP;

INSERT INTO p0_06_storage_rls_probe (authorised_user_id, outsider_user_id, object_name)
SELECT
  d.user_id,
  (
    SELECT p2.user_id
    FROM public.profiles p2
    WHERE p2.user_id IS DISTINCT FROM d.user_id
      AND p2.company_id IS NOT NULL
      AND p2.company_id IS DISTINCT FROM d.company_id
      AND p2.status::text = 'active'
      AND p2.role = 'customer'
    ORDER BY p2.created_at
    LIMIT 1
  ),
  o.name
FROM public.vehicles v
JOIN public.drivers d
  ON d.id = v.assigned_driver_id
 AND d.app_access = true
 AND d.status::text = 'active'
JOIN storage.objects o
  ON o.bucket_id = 'vehicle-docs'
 AND (storage.foldername(o.name))[1] = v.company_id::text
 AND (storage.foldername(o.name))[2] = v.id::text
WHERE d.user_id IS NOT NULL
ORDER BY o.created_at DESC
LIMIT 1;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM p0_06_storage_rls_probe) THEN
    RAISE EXCEPTION 'P0-06 runtime proof requires one assigned active Driver vehicle document.';
  END IF;
  IF EXISTS (SELECT 1 FROM p0_06_storage_rls_probe WHERE outsider_user_id IS NULL) THEN
    RAISE EXCEPTION 'P0-06 runtime proof requires one unrelated active Customer identity.';
  END IF;
END;
$$;

GRANT SELECT, UPDATE ON p0_06_storage_rls_probe TO authenticated;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT authorised_user_id::text FROM p0_06_storage_rls_probe LIMIT 1),
  true
);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

UPDATE p0_06_storage_rls_probe p
SET authorised_visible = (
  SELECT count(*)::integer
  FROM storage.objects o
  WHERE o.bucket_id = 'vehicle-docs'
    AND o.name = p.object_name
);

SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT outsider_user_id::text FROM p0_06_storage_rls_probe LIMIT 1),
  true
);

UPDATE p0_06_storage_rls_probe p
SET outsider_visible = (
  SELECT count(*)::integer
  FROM storage.objects o
  WHERE o.bucket_id = 'vehicle-docs'
    AND o.name = p.object_name
);

RESET ROLE;

DO $$
DECLARE
  v_authorised integer;
  v_outsider integer;
BEGIN
  SELECT authorised_visible, outsider_visible
  INTO v_authorised, v_outsider
  FROM p0_06_storage_rls_probe
  LIMIT 1;

  IF v_authorised <> 1 THEN
    RAISE EXCEPTION 'Assigned Driver could not read their canonical vehicle document through RLS (visible=%).', v_authorised;
  END IF;

  IF v_outsider <> 0 THEN
    RAISE EXCEPTION 'Unrelated Customer could read another company vehicle document through RLS (visible=%).', v_outsider;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND (
        COALESCE(qual, '') ILIKE '%storage.foldername(d.name)%'
        OR COALESCE(with_check, '') ILIKE '%storage.foldername(d.name)%'
      )
  ) THEN
    RAISE EXCEPTION 'Driver-name Storage path parser reappeared during runtime proof.';
  END IF;
END;
$$;

COMMIT;
