-- ============================================================
-- Migration 089 — Company Subscriptions (Stripe)
-- ============================================================
-- Creates company_subscriptions table to track Stripe billing state
-- per company. Populated by the /api/billing/webhook handler.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.company_subscriptions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              uuid NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  stripe_customer_id      text,
  stripe_subscription_id  text,
  plan                    text NOT NULL DEFAULT 'starter',
  status                  text NOT NULL DEFAULT 'incomplete'
                            CHECK (status IN ('incomplete','active','past_due','cancelled','trialing','unpaid')),
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS company_subscriptions_company_idx
  ON public.company_subscriptions (company_id);

CREATE INDEX IF NOT EXISTS company_subscriptions_customer_idx
  ON public.company_subscriptions (stripe_customer_id);

-- Only service_role and owner can manage subscriptions
ALTER TABLE public.company_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'company_subscriptions'
      AND policyname = 'company_subscriptions_admin_read'
  ) THEN
    CREATE POLICY company_subscriptions_admin_read
      ON public.company_subscriptions
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.company_memberships cm
          WHERE cm.company_id = company_subscriptions.company_id
            AND cm.user_id = auth.uid()
            AND cm.role_in_company IN ('owner', 'admin')
            AND cm.status = 'active'
        )
        OR auth.role() = 'service_role'
      );
  END IF;
END $$;

COMMIT;
