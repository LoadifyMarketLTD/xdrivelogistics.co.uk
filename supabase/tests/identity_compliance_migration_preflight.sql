-- Executable regression checks for fail-closed identity/membership preflight logic.
-- Run only on disposable/local/staging databases.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.expect_exception(
  p_statement text,
  p_message text
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  BEGIN
    EXECUTE p_statement;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN;
  END;

  RAISE EXCEPTION '%', p_message;
END;
$$;

CREATE TEMP TABLE tmp_company_memberships (
  user_id uuid,
  status text
);

CREATE TEMP TABLE tmp_drivers (
  user_id uuid
);

CREATE TEMP TABLE tmp_job_bids (
  job_id uuid,
  company_id uuid,
  bidder_user_id uuid,
  status text
);

INSERT INTO tmp_company_memberships (user_id, status)
VALUES
  ('61000000-0000-0000-0000-000000000001', 'active'),
  ('61000000-0000-0000-0000-000000000001', 'active');

SELECT pg_temp.expect_exception(
  $sql$
  DO $block$
  BEGIN
    IF EXISTS (
      SELECT user_id
      FROM tmp_company_memberships
      WHERE user_id IS NOT NULL
        AND status = 'active'
      GROUP BY user_id
      HAVING count(*) > 1
    ) THEN
      RAISE EXCEPTION 'duplicate active memberships';
    END IF;
  END;
  $block$
  $sql$,
  'Preflight did not fail on duplicate active memberships.'
);

INSERT INTO tmp_drivers (user_id)
VALUES
  ('62000000-0000-0000-0000-000000000001'),
  ('62000000-0000-0000-0000-000000000001');

SELECT pg_temp.expect_exception(
  $sql$
  DO $block$
  BEGIN
    IF EXISTS (
      SELECT user_id
      FROM tmp_drivers
      WHERE user_id IS NOT NULL
      GROUP BY user_id
      HAVING count(*) > 1
    ) THEN
      RAISE EXCEPTION 'duplicate driver identity';
    END IF;
  END;
  $block$
  $sql$,
  'Preflight did not fail on duplicate driver identities.'
);

INSERT INTO tmp_job_bids (job_id, company_id, bidder_user_id, status)
VALUES
  ('63000000-0000-0000-0000-000000000001', '64000000-0000-0000-0000-000000000001', NULL, 'submitted'),
  ('63000000-0000-0000-0000-000000000001', '64000000-0000-0000-0000-000000000001', NULL, 'accepted');

SELECT pg_temp.expect_exception(
  $sql$
  DO $block$
  BEGIN
    IF EXISTS (
      SELECT job_id, company_id
      FROM tmp_job_bids
      WHERE company_id IS NOT NULL
        AND status IN ('submitted', 'accepted')
      GROUP BY job_id, company_id
      HAVING count(*) > 1
    ) THEN
      RAISE EXCEPTION 'duplicate active company quotation';
    END IF;
  END;
  $block$
  $sql$,
  'Preflight did not fail on duplicate active company quotations.'
);

ROLLBACK;
