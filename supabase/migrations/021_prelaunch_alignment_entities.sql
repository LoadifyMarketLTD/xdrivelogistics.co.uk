-- ============================================================
-- 021_prelaunch_alignment_entities.sql
-- Pre-launch schema alignment:
-- - Ensures quotes/drivers exist with expected columns
-- - Adds missing launch entities: loads, notifications, messages,
--   subscriptions, payments, documents, reviews
-- - Enables RLS and reloads PostgREST schema cache
-- ============================================================

-- Ensure DRIVERS table exists (for environments with partial schema)
CREATE TABLE IF NOT EXISTS public.drivers (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id         uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name    text,
  phone           text,
  email           text,
  status          text        DEFAULT 'active',
  login_pin       text,
  app_access      boolean     DEFAULT false,
  last_app_login  timestamptz,
  device_token    text,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS company_id      uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS display_name    text;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS email           text;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS phone           text;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS status          text DEFAULT 'active';
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS app_access      boolean DEFAULT false;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS created_at      timestamptz DEFAULT now();

-- Ensure QUOTES table exists
CREATE TABLE IF NOT EXISTS public.quotes (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        uuid        REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by        uuid        REFERENCES auth.users(id),
  customer_name     text,
  customer_email    text,
  customer_phone    text,
  pickup_location   text,
  delivery_location text,
  vehicle_type      text,
  cargo_type        text,
  amount            numeric,
  currency          text        DEFAULT 'GBP',
  status            text        DEFAULT 'draft',
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS company_id        uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS created_by        uuid REFERENCES auth.users(id);
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS customer_name     text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS customer_email    text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS customer_phone    text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS pickup_location   text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS delivery_location text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS amount            numeric;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS currency          text DEFAULT 'GBP';
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS status            text DEFAULT 'draft';
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS created_at        timestamptz DEFAULT now();

-- Missing launch entities
CREATE TABLE IF NOT EXISTS public.loads (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  job_id       uuid       REFERENCES public.jobs(id) ON DELETE SET NULL,
  title       text,
  status      text        DEFAULT 'open',
  created_by  uuid        REFERENCES auth.users(id),
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid        REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id     uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text        NOT NULL,
  body        text,
  type        text        DEFAULT 'info',
  read_at     timestamptz,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.messages (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         uuid        REFERENCES public.companies(id) ON DELETE CASCADE,
  conversation_id    uuid,
  sender_user_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_user_id  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  body               text        NOT NULL,
  created_at         timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         uuid        REFERENCES public.companies(id) ON DELETE CASCADE,
  provider           text        DEFAULT 'manual',
  provider_ref       text,
  status             text        DEFAULT 'inactive',
  current_period_end timestamptz,
  created_at         timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payments (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         uuid        REFERENCES public.companies(id) ON DELETE CASCADE,
  invoice_id         uuid        REFERENCES public.invoices(id) ON DELETE SET NULL,
  amount             numeric     NOT NULL DEFAULT 0,
  currency           text        DEFAULT 'GBP',
  status             text        DEFAULT 'pending',
  provider           text,
  provider_ref       text,
  created_at         timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.documents (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid        REFERENCES public.companies(id) ON DELETE CASCADE,
  job_id      uuid        REFERENCES public.jobs(id) ON DELETE SET NULL,
  driver_id   uuid        REFERENCES public.drivers(id) ON DELETE SET NULL,
  doc_type    text        DEFAULT 'other',
  file_path   text,
  created_by  uuid        REFERENCES auth.users(id),
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reviews (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         uuid        REFERENCES public.companies(id) ON DELETE CASCADE,
  job_id             uuid        REFERENCES public.jobs(id) ON DELETE SET NULL,
  reviewer_user_id   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_user_id   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  rating             int         CHECK (rating BETWEEN 1 AND 5),
  comment            text,
  created_at         timestamptz DEFAULT now()
);

-- RLS enablement
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Policies (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='drivers' AND policyname='drivers_select_member') THEN
    CREATE POLICY "drivers_select_member" ON public.drivers FOR SELECT USING (public.is_company_member(company_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='drivers' AND policyname='drivers_all_admin') THEN
    CREATE POLICY "drivers_all_admin" ON public.drivers FOR ALL USING (public.is_company_admin(company_id));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='quotes' AND policyname='quotes_all_member') THEN
    CREATE POLICY "quotes_all_member" ON public.quotes FOR ALL USING (public.is_company_member(company_id));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='loads' AND policyname='loads_all_member') THEN
    CREATE POLICY "loads_all_member" ON public.loads FOR ALL USING (public.is_company_member(company_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='notifications_all_member') THEN
    CREATE POLICY "notifications_all_member" ON public.notifications FOR ALL USING (
      company_id IS NULL OR public.is_company_member(company_id)
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='messages' AND policyname='messages_all_member') THEN
    CREATE POLICY "messages_all_member" ON public.messages FOR ALL USING (
      company_id IS NULL OR public.is_company_member(company_id)
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='subscriptions' AND policyname='subscriptions_all_member') THEN
    CREATE POLICY "subscriptions_all_member" ON public.subscriptions FOR ALL USING (public.is_company_member(company_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payments' AND policyname='payments_all_member') THEN
    CREATE POLICY "payments_all_member" ON public.payments FOR ALL USING (public.is_company_member(company_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='documents' AND policyname='documents_all_member') THEN
    CREATE POLICY "documents_all_member" ON public.documents FOR ALL USING (public.is_company_member(company_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='reviews' AND policyname='reviews_all_member') THEN
    CREATE POLICY "reviews_all_member" ON public.reviews FOR ALL USING (
      company_id IS NULL OR public.is_company_member(company_id)
    );
  END IF;
END $$;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS messages_conversation_id_idx ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS payments_invoice_id_idx ON public.payments(invoice_id);
CREATE INDEX IF NOT EXISTS reviews_job_id_idx ON public.reviews(job_id);

NOTIFY pgrst, 'reload schema';
