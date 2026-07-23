-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 081 — Return journeys backfill
-- Copies existing return journey data from legacy drivers flat columns into
-- the proper return_journeys table. On a clean database those legacy columns
-- do not exist, so the historical backfill must safely become a no-op.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regclass('public.drivers') IS NOT NULL
     AND to_regclass('public.return_journeys') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'drivers'
         AND column_name = 'return_journey_from'
     )
     AND EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'drivers'
         AND column_name = 'return_journey_to'
     )
     AND EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'drivers'
         AND column_name = 'return_journey_date'
     ) THEN
    EXECUTE $backfill$
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
        d.id,
        d.return_journey_from,
        d.return_journey_to,
        d.return_journey_date::timestamptz,
        'available'
      FROM public.drivers d
      WHERE d.company_id IS NOT NULL
        AND d.return_journey_from IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM public.return_journeys rj
          WHERE rj.driver_id = d.id
            AND rj.from_postcode = d.return_journey_from
        )
    $backfill$;
  END IF;
END;
$$;
