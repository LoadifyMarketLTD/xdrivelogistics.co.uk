-- Pre-launch hot-path indexes for authentication, dashboards, dispatch, and finance.
-- These are intentionally idempotent and behavior-neutral.

CREATE INDEX IF NOT EXISTS idx_company_memberships_user_status_created
  ON public.company_memberships (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_companies_created_by_created
  ON public.companies (created_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_drivers_user_id
  ON public.drivers (user_id);

CREATE INDEX IF NOT EXISTS idx_drivers_company_status_name
  ON public.drivers (company_id, status, display_name);

CREATE INDEX IF NOT EXISTS idx_quotes_company_created
  ON public.quotes (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quotes_company_customer_email_created
  ON public.quotes (company_id, customer_email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_jobs_company_updated
  ON public.jobs (company_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_jobs_company_created_by_updated
  ON public.jobs (company_id, created_by, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_company_created
  ON public.invoices (company_id, created_at DESC);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'invoices'
      AND column_name = 'created_by'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_invoices_company_created_by_created ON public.invoices (company_id, created_by, created_at DESC)';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'invoices'
      AND column_name = 'client_email'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_invoices_company_client_email_created ON public.invoices (company_id, client_email, created_at DESC)';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'jobs'
      AND column_name = 'assigned_company_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_jobs_assigned_company_updated ON public.jobs (assigned_company_id, updated_at DESC)';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'jobs'
      AND column_name = 'awarded_carrier_company_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_jobs_awarded_carrier_updated ON public.jobs (awarded_carrier_company_id, updated_at DESC)';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'jobs'
      AND column_name = 'direct_invite_company_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_jobs_direct_invite_company_updated ON public.jobs (direct_invite_company_id, updated_at DESC)';
  END IF;
END;
$$;
