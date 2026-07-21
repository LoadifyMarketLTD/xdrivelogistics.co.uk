-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 081 — Return journeys backfill
-- Copies existing return journey data from legacy driver flat columns into the
-- canonical return_journeys table. Does NOT remove legacy columns.
--
-- Clean installations never had these legacy driver columns, so the backfill
-- must no-op safely when they are absent.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regclass('public.return_journeys') IS NOT NULL
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

    -- Dynamic SQL is intentional: PostgreSQL must not resolve legacy columns
    -- at all on clean schemas where those columns never existed.
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
            AND rj.to_postcode IS NOT DISTINCT FROM d.return_journey_to
            AND rj.available_from IS NOT DISTINCT FROM d.return_journey_date::timestamptz
        )
    $backfill$;
  ELSE
    RAISE NOTICE 'Skipping legacy return journey backfill: legacy driver columns are not present.';
  END IF;
END
$$;
