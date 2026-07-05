-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 107 — User Feedback
-- Creates user_feedback table so authenticated users can submit in-app
-- feedback (ratings, categories, messages).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.user_feedback (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  company_id    uuid        REFERENCES public.companies(id) ON DELETE SET NULL,
  rating        smallint    CHECK (rating BETWEEN 1 AND 5),
  category      text        NOT NULL DEFAULT 'general'
                            CHECK (category IN ('bug', 'feature_request', 'general', 'compliment', 'other')),
  message       text        NOT NULL CHECK (char_length(message) <= 3000),
  page_url      text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS user_feedback_user_id_idx
  ON public.user_feedback (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS user_feedback_company_id_idx
  ON public.user_feedback (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS user_feedback_category_idx
  ON public.user_feedback (category, created_at DESC);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert their own feedback
CREATE POLICY IF NOT EXISTS user_feedback_insert
  ON public.user_feedback FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can read their own feedback
CREATE POLICY IF NOT EXISTS user_feedback_own_read
  ON public.user_feedback FOR SELECT
  USING (user_id = auth.uid());
