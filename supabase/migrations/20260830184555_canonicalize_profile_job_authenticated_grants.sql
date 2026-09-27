BEGIN;

-- Storage SELECT policies are OR-composed on storage.objects. Even when the
-- requested bucket is vehicle-docs, policy planning/evaluation can touch the
-- direct profiles/jobs dependencies used by other authenticated Storage
-- policies. Fresh branch databases must therefore reproduce the same base
-- grants as Production before the runtime proof executes.
REVOKE TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.profiles, public.jobs
FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE
ON TABLE public.profiles, public.jobs
TO authenticated;

GRANT ALL
ON TABLE public.profiles, public.jobs
TO service_role;

COMMIT;
