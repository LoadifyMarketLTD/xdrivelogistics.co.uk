BEGIN;

-- Fresh Supabase preview databases must reproduce the effective Production
-- table grants that the Driver/Fleet RLS and Storage policies depend on.
--
-- Production currently permits authenticated users to SELECT/INSERT/UPDATE
-- drivers and vehicles, with row visibility/writes constrained by RLS. It does
-- not grant authenticated DELETE, TRUNCATE, REFERENCES or TRIGGER privileges.
-- Fresh branch databases were inheriting TRUNCATE/REFERENCES/TRIGGER instead,
-- which caused the canonical Storage RLS runtime proof to fail with
-- "permission denied for table vehicles".
REVOKE TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.drivers, public.vehicles
FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE
ON TABLE public.drivers, public.vehicles
TO authenticated;

GRANT ALL
ON TABLE public.drivers, public.vehicles
TO service_role;

COMMIT;
