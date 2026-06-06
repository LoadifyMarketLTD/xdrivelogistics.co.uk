-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 081 — Return journeys backfill
-- Copies existing return journey data from drivers flat columns into the
-- proper return_journeys table. Does NOT remove the columns (backward compat).
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.return_journeys (
  company_id,
  driver_id,
  from_postcode,
  to_postcode,
  available_from,
  status
)
SELECT
  d.company_id,
  d.id                                    AS driver_id,
  d.return_journey_from                   AS from_postcode,
  d.return_journey_to                     AS to_postcode,
  d.return_journey_date::timestamptz      AS available_from,
  'available'                             AS status
FROM public.drivers d
WHERE d.company_id IS NOT NULL
  AND d.return_journey_from IS NOT NULL
  -- avoid double-insert if migration is re-run
  AND NOT EXISTS (
    SELECT 1
    FROM   public.return_journeys rj
    WHERE  rj.driver_id      = d.id
      AND  rj.from_postcode  = d.return_journey_from
  );
