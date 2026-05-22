-- Migration 037: Secondary table hardening.
--
-- Tables targeted: loads, payments, subscriptions, documents, reviews,
--                  notifications, messages.
-- Current state: all seven tables carry broad FOR ALL USING is_company_member(company_id)
--                or similar — inherited from migration 021. is_company_member includes
--                drivers and viewers, which violates least-privilege intent.
--
-- Access model applied:
--   loads / documents     — operator INSERT with creator/admin mutation; non-driver SELECT
--   payments / subscriptions — admin-only write; non-driver SELECT (no creator concept)
--   reviews               — non-driver INSERT (reviewer_user_id enforced); all-member SELECT
--   notifications         — own row SELECT/UPDATE/DELETE; admin INSERT
--   messages              — participant SELECT; sender INSERT; sender/admin DELETE; no UPDATE

BEGIN;

-- ─── loads ────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "loads_all_member" ON public.loads;

ALTER TABLE public.loads
  ALTER COLUMN created_by SET DEFAULT auth.uid();

CREATE POLICY "loads_select_non_driver"
  ON public.loads FOR SELECT
  USING (public.is_company_non_driver(company_id));

CREATE POLICY "loads_insert_operator"
  ON public.loads FOR INSERT
  WITH CHECK (
    public.is_company_operator(company_id)
    AND (
      created_by = auth.uid()
      OR public.is_company_admin(company_id)
    )
  );

CREATE POLICY "loads_update_creator_or_admin"
  ON public.loads FOR UPDATE
  USING (
    public.is_company_operator(company_id)
    AND (
      created_by = auth.uid()
      OR public.is_company_admin(company_id)
    )
  )
  WITH CHECK (
    public.is_company_operator(company_id)
    AND (
      created_by = auth.uid()
      OR public.is_company_admin(company_id)
    )
  );

CREATE POLICY "loads_delete_creator_or_admin"
  ON public.loads FOR DELETE
  USING (
    public.is_company_operator(company_id)
    AND (
      created_by = auth.uid()
      OR public.is_company_admin(company_id)
    )
  );

-- ─── payments ─────────────────────────────────────────────────────────────────
-- No creator column — write operations are admin-only.

DROP POLICY IF EXISTS "payments_all_member" ON public.payments;

CREATE POLICY "payments_select_non_driver"
  ON public.payments FOR SELECT
  USING (public.is_company_non_driver(company_id));

CREATE POLICY "payments_insert_admin"
  ON public.payments FOR INSERT
  WITH CHECK (public.is_company_admin(company_id));

CREATE POLICY "payments_update_admin"
  ON public.payments FOR UPDATE
  USING (public.is_company_admin(company_id))
  WITH CHECK (public.is_company_admin(company_id));

CREATE POLICY "payments_delete_admin"
  ON public.payments FOR DELETE
  USING (public.is_company_admin(company_id));

-- ─── subscriptions ────────────────────────────────────────────────────────────
-- No creator column — write operations are admin-only.

DROP POLICY IF EXISTS "subscriptions_all_member" ON public.subscriptions;

CREATE POLICY "subscriptions_select_non_driver"
  ON public.subscriptions FOR SELECT
  USING (public.is_company_non_driver(company_id));

CREATE POLICY "subscriptions_insert_admin"
  ON public.subscriptions FOR INSERT
  WITH CHECK (public.is_company_admin(company_id));

CREATE POLICY "subscriptions_update_admin"
  ON public.subscriptions FOR UPDATE
  USING (public.is_company_admin(company_id))
  WITH CHECK (public.is_company_admin(company_id));

CREATE POLICY "subscriptions_delete_admin"
  ON public.subscriptions FOR DELETE
  USING (public.is_company_admin(company_id));

-- ─── documents ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "documents_all_member" ON public.documents;

ALTER TABLE public.documents
  ALTER COLUMN created_by SET DEFAULT auth.uid();

CREATE POLICY "documents_select_non_driver"
  ON public.documents FOR SELECT
  USING (public.is_company_non_driver(company_id));

CREATE POLICY "documents_insert_operator"
  ON public.documents FOR INSERT
  WITH CHECK (
    public.is_company_operator(company_id)
    AND (
      created_by = auth.uid()
      OR public.is_company_admin(company_id)
    )
  );

CREATE POLICY "documents_update_creator_or_admin"
  ON public.documents FOR UPDATE
  USING (
    public.is_company_operator(company_id)
    AND (
      created_by = auth.uid()
      OR public.is_company_admin(company_id)
    )
  )
  WITH CHECK (
    public.is_company_operator(company_id)
    AND (
      created_by = auth.uid()
      OR public.is_company_admin(company_id)
    )
  );

CREATE POLICY "documents_delete_creator_or_admin"
  ON public.documents FOR DELETE
  USING (
    public.is_company_operator(company_id)
    AND (
      created_by = auth.uid()
      OR public.is_company_admin(company_id)
    )
  );

-- ─── reviews ──────────────────────────────────────────────────────────────────
-- reviewer_user_id is the creator equivalent; any company member may read.

DROP POLICY IF EXISTS "reviews_all_member" ON public.reviews;

CREATE POLICY "reviews_select_member"
  ON public.reviews FOR SELECT
  USING (public.is_company_member(company_id));

CREATE POLICY "reviews_insert_non_driver"
  ON public.reviews FOR INSERT
  WITH CHECK (
    public.is_company_non_driver(company_id)
    AND reviewer_user_id = auth.uid()
  );

CREATE POLICY "reviews_update_reviewer_or_admin"
  ON public.reviews FOR UPDATE
  USING (
    public.is_company_non_driver(company_id)
    AND (
      reviewer_user_id = auth.uid()
      OR public.is_company_admin(company_id)
    )
  )
  WITH CHECK (
    public.is_company_non_driver(company_id)
    AND (
      reviewer_user_id = auth.uid()
      OR public.is_company_admin(company_id)
    )
  );

CREATE POLICY "reviews_delete_reviewer_or_admin"
  ON public.reviews FOR DELETE
  USING (
    public.is_company_non_driver(company_id)
    AND (
      reviewer_user_id = auth.uid()
      OR public.is_company_admin(company_id)
    )
  );

-- ─── notifications ────────────────────────────────────────────────────────────
-- Personal rows: users access only their own notifications.
-- Admins may INSERT notifications for company users.

DROP POLICY IF EXISTS "notifications_all_member" ON public.notifications;

CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "notifications_insert_admin"
  ON public.notifications FOR INSERT
  WITH CHECK (
    company_id IS NOT NULL
    AND public.is_company_admin(company_id)
  );

CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "notifications_delete_own"
  ON public.notifications FOR DELETE
  USING (user_id = auth.uid());

-- ─── messages ─────────────────────────────────────────────────────────────────
-- Participant SELECT; sender INSERT; sender/admin DELETE.
-- No UPDATE: messages are immutable once sent.

DROP POLICY IF EXISTS "messages_all_member" ON public.messages;

CREATE POLICY "messages_select_participant"
  ON public.messages FOR SELECT
  USING (
    sender_user_id = auth.uid()
    OR recipient_user_id = auth.uid()
  );

CREATE POLICY "messages_insert_sender"
  ON public.messages FOR INSERT
  WITH CHECK (
    sender_user_id = auth.uid()
    AND (
      company_id IS NULL
      OR public.is_company_member(company_id)
    )
  );

CREATE POLICY "messages_delete_sender_or_admin"
  ON public.messages FOR DELETE
  USING (
    sender_user_id = auth.uid()
    OR (
      company_id IS NOT NULL
      AND public.is_company_admin(company_id)
    )
  );

COMMIT;
