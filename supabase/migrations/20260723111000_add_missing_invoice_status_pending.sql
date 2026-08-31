-- Repair: ensure the hosted canonical public.invoice_status labels exist.
--
-- Fresh history originally creates only the legacy Pending/Paid/Overdue labels,
-- while hosted production also carries the lowercase canonical lifecycle labels
-- draft/sent/paid/void/overdue. Later finance migrations use `void` directly,
-- so zero-data replay must reconstruct those observed enum labels in an earlier,
-- separately committed migration before first use.
--
-- ALTER TYPE ... ADD VALUE values become usable after this migration commits.

DO $$
DECLARE
  v_label text;
BEGIN
  FOREACH v_label IN ARRAY ARRAY[
    'draft',
    'sent',
    'paid',
    'void',
    'overdue',
    'Pending'
  ]::text[]
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum
      WHERE enumtypid = 'public.invoice_status'::regtype::oid
        AND enumlabel = v_label
    ) THEN
      EXECUTE format('ALTER TYPE public.invoice_status ADD VALUE %L', v_label);
    END IF;
  END LOOP;
END;
$$;
