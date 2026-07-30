-- Executable regression checks for transactional fraud decision atomicity.
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

INSERT INTO public.fraud_review_cases (
  id,
  case_type,
  severity,
  status,
  automatic_hold,
  evidence
)
VALUES (
  '65000000-0000-0000-0000-000000000001',
  'manual_report',
  'high',
  'open',
  true,
  '{}'::jsonb
);

SELECT pg_temp.expect_exception(
  $sql$
  SELECT public.owner_decide_fraud_review_case(
    '66000000-0000-0000-0000-000000000001'::uuid,
    '65000000-0000-0000-0000-000000000001'::uuid,
    'investigate',
    'atomicity test: actor is intentionally invalid'
  )
  $sql$,
  'Fraud decision unexpectedly succeeded when audit insertion should fail.'
);

DO $$
DECLARE
  v_status text;
BEGIN
  SELECT status
  INTO v_status
  FROM public.fraud_review_cases
  WHERE id = '65000000-0000-0000-0000-000000000001';

  IF v_status IS DISTINCT FROM 'open' THEN
    RAISE EXCEPTION
      'Fraud decision was not rolled back atomically. Expected status=open, got=%.',
      v_status;
  END IF;
END;
$$;

ROLLBACK;
