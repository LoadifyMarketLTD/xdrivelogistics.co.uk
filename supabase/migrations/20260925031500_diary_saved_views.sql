BEGIN;

CREATE TABLE IF NOT EXISTS public.diary_saved_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id, name)
);

CREATE INDEX IF NOT EXISTS diary_saved_views_company_user_idx
  ON public.diary_saved_views(company_id, user_id, updated_at DESC);

ALTER TABLE public.diary_saved_views ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.diary_saved_views TO authenticated;

DROP POLICY IF EXISTS diary_saved_views_select_own ON public.diary_saved_views;
CREATE POLICY diary_saved_views_select_own ON public.diary_saved_views
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.is_company_member(company_id));

DROP POLICY IF EXISTS diary_saved_views_insert_own ON public.diary_saved_views;
CREATE POLICY diary_saved_views_insert_own ON public.diary_saved_views
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_company_member(company_id));

DROP POLICY IF EXISTS diary_saved_views_update_own ON public.diary_saved_views;
CREATE POLICY diary_saved_views_update_own ON public.diary_saved_views
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND public.is_company_member(company_id))
  WITH CHECK (user_id = auth.uid() AND public.is_company_member(company_id));

DROP POLICY IF EXISTS diary_saved_views_delete_own ON public.diary_saved_views;
CREATE POLICY diary_saved_views_delete_own ON public.diary_saved_views
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND public.is_company_member(company_id));

COMMENT ON TABLE public.diary_saved_views IS
  'User-scoped persistent Diary filter views within an authorised XDrive company workspace.';

COMMIT;
