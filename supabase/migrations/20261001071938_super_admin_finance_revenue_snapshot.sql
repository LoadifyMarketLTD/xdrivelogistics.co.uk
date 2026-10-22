BEGIN;

CREATE OR REPLACE FUNCTION public.super_admin_finance_revenue_snapshot()
RETURNS TABLE (
  invoice_currencies text[],
  settlement_currencies text[],
  total_invoiced numeric,
  total_revenue numeric,
  paid_invoices bigint,
  total_invoices bigint,
  unpaid_amount numeric,
  monthly_revenue jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH issued AS (
    SELECT id, amount, currency, invoice_date, payment_status
    FROM public.invoices
    WHERE payment_status = 'paid'
       OR status IN ('sent', 'overdue', 'paid', 'Submitted', 'Approved', 'Disputed')
  ),
  payment_totals AS (
    SELECT invoice_id, sum(amount) AS paid_amount
    FROM public.invoice_payment_history
    GROUP BY invoice_id
  ),
  invoice_currency_set AS (
    SELECT COALESCE(
      array_agg(DISTINCT upper(currency::text)) FILTER (WHERE currency IS NOT NULL),
      ARRAY[]::text[]
    ) AS currencies
    FROM issued
  ),
  settlement_currency_set AS (
    SELECT COALESCE(
      array_agg(DISTINCT upper(currency::text)) FILTER (WHERE currency IS NOT NULL),
      ARRAY[]::text[]
    ) AS currencies
    FROM public.invoice_payment_history
  ),
  monthly AS (
    SELECT to_char(date_trunc('month', invoice_date), 'YYYY-MM') AS month,
           sum(amount) AS amount
    FROM issued
    WHERE payment_status = 'paid'
      AND invoice_date IS NOT NULL
    GROUP BY 1
    ORDER BY 1 DESC
    LIMIT 12
  )
  SELECT
    (SELECT currencies FROM invoice_currency_set),
    (SELECT currencies FROM settlement_currency_set),
    COALESCE((SELECT sum(amount) FROM issued), 0),
    COALESCE((SELECT sum(amount) FROM issued WHERE payment_status = 'paid'), 0),
    (SELECT count(*) FROM issued WHERE payment_status = 'paid'),
    (SELECT count(*) FROM issued),
    COALESCE((
      SELECT sum(greatest(0::numeric, i.amount - COALESCE(p.paid_amount, 0)))
      FROM issued i
      LEFT JOIN payment_totals p ON p.invoice_id = i.id
      WHERE i.payment_status <> 'paid'
    ), 0),
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('month', month, 'amount', amount) ORDER BY month DESC)
      FROM monthly
    ), '[]'::jsonb);
$$;

REVOKE ALL ON FUNCTION public.super_admin_finance_revenue_snapshot() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_finance_revenue_snapshot() TO service_role;

COMMENT ON FUNCTION public.super_admin_finance_revenue_snapshot() IS
  'Service-role-only one-round-trip revenue and settlement snapshot for Super Admin finance.';

COMMIT;
NOTIFY pgrst, 'reload schema';
