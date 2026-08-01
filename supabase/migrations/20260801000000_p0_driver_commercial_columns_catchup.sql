-- Historical SQL for this blocked broad catch-up has been preserved at:
--   docs/ops/20260801000000_p0_driver_commercial_columns_catchup.historical.sql
--
-- This repository migration is now an executable no-op so the automatic
-- migration chain cannot apply the retired DDL, DML, RLS, RPC, or notification
-- changes from that historical incident patch.

BEGIN;

DO $$
BEGIN
  RAISE NOTICE
    '20260801000000_p0_driver_commercial_columns_catchup.sql is retired and intentionally performs no schema or data changes. See docs/ops for the archived historical SQL.';
END;
$$;

COMMIT;
