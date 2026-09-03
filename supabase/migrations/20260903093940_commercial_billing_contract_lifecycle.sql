BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '300s';

CREATE TABLE IF NOT EXISTS public.stripe_connected_accounts (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  stripe_account_id text NOT NULL UNIQUE CHECK (stripe_account_id ~ '^acct_'),
  account_type text NOT NULL DEFAULT 'standard' CHECK (account_type = 'standard'),
  onboarding_status text NOT NULL DEFAULT 'pending' CHECK (onboarding_status IN ('pending','submitted','restricted','enabled','disabled')),
  charges_enabled boolean NOT NULL DEFAULT false,
  payouts_enabled boolean NOT NULL DEFAULT false,
  details_submitted boolean NOT NULL DEFAULT false,
  requirements_due jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stripe_job_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL UNIQUE REFERENCES public.invoices(id) ON DELETE RESTRICT,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  buyer_company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  supplier_company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  stripe_connected_account_id text NOT NULL CHECK (stripe_connected_account_id ~ '^acct_'),
  stripe_checkout_session_id text UNIQUE,
  stripe_payment_intent_id text UNIQUE,
  stripe_charge_id text UNIQUE,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency text NOT NULL CHECK (currency ~ '^[a-z]{3}$'),
  status text NOT NULL DEFAULT 'checkout_created' CHECK (status IN ('checkout_created','processing','paid','failed','refunded','disputed','cancelled')),
  failure_code text,
  failure_message text,
  paid_at timestamptz,
  refunded_at timestamptz,
  disputed_at timestamptz,
  last_stripe_event_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stripe_job_payments_job_idx ON public.stripe_job_payments(job_id);
CREATE INDEX IF NOT EXISTS stripe_job_payments_buyer_idx ON public.stripe_job_payments(buyer_company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS stripe_job_payments_supplier_idx ON public.stripe_job_payments(supplier_company_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.platform_membership_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  plan_id text NOT NULL CHECK (plan_id IN ('owner-driver','customer-shipper','small-carrier','broker','growing-carrier','fleet')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','trialing','active','past_due','unpaid','paused','cancelled','incomplete','incomplete_expired')),
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text UNIQUE,
  stripe_checkout_session_id text UNIQUE,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  current_period_end timestamptz,
  contract_terms_version text NOT NULL DEFAULT '2026-09-01',
  contract_accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_membership_subscriptions_user_company_uq
  ON public.platform_membership_subscriptions(user_id, company_id)
  WHERE company_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS platform_membership_subscriptions_personal_uq
  ON public.platform_membership_subscriptions(user_id)
  WHERE company_id IS NULL;
CREATE INDEX IF NOT EXISTS platform_membership_subscriptions_status_idx
  ON public.platform_membership_subscriptions(status, trial_ends_at);

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  stripe_event_id text PRIMARY KEY CHECK (stripe_event_id ~ '^evt_'),
  event_type text NOT NULL,
  connected_account_id text,
  livemode boolean NOT NULL,
  processing_status text NOT NULL DEFAULT 'processing' CHECK (processing_status IN ('processing','processed','ignored','failed')),
  error_message text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

ALTER TABLE public.stripe_connected_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_job_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_membership_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.stripe_connected_accounts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.stripe_job_payments FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.platform_membership_subscriptions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.stripe_webhook_events FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.stripe_connected_accounts TO service_role;
GRANT ALL ON TABLE public.stripe_job_payments TO service_role;
GRANT ALL ON TABLE public.platform_membership_subscriptions TO service_role;
GRANT ALL ON TABLE public.stripe_webhook_events TO service_role;

COMMENT ON TABLE public.stripe_connected_accounts IS
  'Server-only mapping between XDrive companies and Stripe Connect Standard accounts. XDrive never stores bank account credentials.';
COMMENT ON TABLE public.stripe_job_payments IS
  'Audit projection of Stripe Connect direct charges for transport invoices. Transport funds are not custodied by XDrive.';
COMMENT ON TABLE public.platform_membership_subscriptions IS
  'XDrive platform membership lifecycle. This is distinct from transport-job payments.';
COMMENT ON TABLE public.stripe_webhook_events IS
  'Idempotency ledger for verified Stripe webhook events.';

COMMIT;
