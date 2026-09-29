BEGIN;

-- Reproduce the hosted XDrive least-privilege table grants on fresh Supabase
-- databases. Row visibility and writes remain constrained by the existing RLS
-- policies; this migration only canonicalizes the table-level privilege layer.
REVOKE ALL PRIVILEGES
ON TABLE public.drivers, public.vehicles, public.profiles, public.jobs
FROM anon, authenticated;

-- Hosted Production keeps a SELECT grant on drivers for anon, while the
-- drivers_select_none_anon RLS policy remains fail-closed (USING false).
GRANT SELECT ON TABLE public.drivers TO anon;

GRANT SELECT, INSERT, UPDATE
ON TABLE public.drivers, public.vehicles, public.profiles, public.jobs
TO authenticated;

GRANT ALL PRIVILEGES
ON TABLE public.drivers, public.vehicles, public.profiles, public.jobs
TO service_role;

COMMIT;