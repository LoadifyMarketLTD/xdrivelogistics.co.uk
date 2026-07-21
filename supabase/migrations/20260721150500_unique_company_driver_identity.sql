BEGIN;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY company_id, user_id
      ORDER BY
        (status = 'active') DESC,
        COALESCE(app_access, false) DESC,
        updated_at DESC NULLS LAST,
        created_at DESC NULLS LAST,
        id DESC
    ) AS position
  FROM public.drivers
  WHERE user_id IS NOT NULL
)
DELETE FROM public.drivers target
USING ranked
WHERE target.id = ranked.id
  AND ranked.position > 1
  AND NOT EXISTS (
    SELECT 1 FROM public.jobs j WHERE j.assigned_driver_id = target.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.vehicles v WHERE v.assigned_driver_id = target.id
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.drivers
    WHERE user_id IS NOT NULL
    GROUP BY company_id, user_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate company/user driver identities remain and require explicit reassignment.';
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS drivers_company_user_uidx
  ON public.drivers (company_id, user_id)
  WHERE user_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';

COMMIT;
