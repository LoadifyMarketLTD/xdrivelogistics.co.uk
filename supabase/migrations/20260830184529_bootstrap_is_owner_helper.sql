-- Fresh-schema parity for the hosted Platform Owner helper.
-- Production already has this helper; CREATE OR REPLACE keeps the definition
-- deterministic while making later reviewer/security migrations replay-safe.

CREATE OR REPLACE FUNCTION public.is_owner(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = uid
      AND p.role = 'owner'
      AND p.status::text = 'active'
  );
$function$;
