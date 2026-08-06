-- Atomic support-ticket governance mutation with guaranteed audit persistence.
--
-- The support-ticket status update and owner_audit_log INSERT execute inside the
-- same PostgreSQL function call. Any exception rolls back both operations.
-- This migration is committed only; it is not applied to any environment here.

BEGIN;

CREATE OR REPLACE FUNCTION public.owner_update_support_ticket_with_audit(
  p_actor_user_id uuid,
  p_ticket_id uuid,
  p_action text,
  p_note text
)
RETURNS TABLE (
  ticket_id uuid,
  status text,
  resolution_note text,
  resolved_at timestamptz,
  closed_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_action text := lower(trim(COALESCE(p_action, '')));
  v_reason text := trim(COALESCE(p_note, ''));
  v_ticket record;
  v_new_status text;
  v_action_type text;
  v_new_resolved_at timestamptz;
  v_new_closed_at timestamptz;

  v_updated_id uuid;
  v_updated_status text;
  v_updated_note text;
  v_updated_resolved_at timestamptz;
  v_updated_closed_at timestamptz;
  v_updated_at timestamptz;
BEGIN
  IF p_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'actor_user_id is required for support-ticket governance.'
      USING ERRCODE = '23502';
  END IF;

  IF p_ticket_id IS NULL THEN
    RAISE EXCEPTION 'ticket_id is required for support-ticket governance.'
      USING ERRCODE = '23502';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles AS actor_profile
    WHERE actor_profile.user_id = p_actor_user_id
      AND actor_profile.role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Only a Platform Owner can update support tickets through this governance RPC.'
      USING ERRCODE = '42501';
  END IF;

  IF v_action NOT IN ('investigating', 'resolve', 'close', 'reopen') THEN
    RAISE EXCEPTION 'Invalid support-ticket action: %', v_action
      USING ERRCODE = '23514';
  END IF;

  IF char_length(v_reason) < 5 THEN
    RAISE EXCEPTION 'A support-ticket governance reason of at least 5 characters is required.'
      USING ERRCODE = '23514';
  END IF;

  SELECT
    ticket_row.id,
    ticket_row.company_id,
    ticket_row.subject,
    lower(trim(ticket_row.status::text)) AS status,
    ticket_row.resolution_note,
    ticket_row.resolved_at,
    ticket_row.closed_at,
    ticket_row.updated_at
  INTO v_ticket
  FROM public.support_tickets AS ticket_row
  WHERE ticket_row.id = p_ticket_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Support ticket not found.'
      USING ERRCODE = 'P0002';
  END IF;

  CASE v_action
    WHEN 'investigating' THEN
      v_new_status := 'investigating';
      v_action_type := 'support_ticket_investigating';
      v_new_resolved_at := NULL;
      v_new_closed_at := NULL;

    WHEN 'resolve' THEN
      v_new_status := 'resolved';
      v_action_type := 'support_ticket_resolved';
      v_new_resolved_at := now();
      v_new_closed_at := NULL;

    WHEN 'close' THEN
      v_new_status := 'closed';
      v_action_type := 'support_ticket_closed';
      v_new_closed_at := now();
      IF v_ticket.status = 'resolved' THEN
        v_new_resolved_at := v_ticket.resolved_at;
      ELSE
        v_new_resolved_at := now();
      END IF;

    WHEN 'reopen' THEN
      v_new_status := 'open';
      v_action_type := 'support_ticket_reopened';
      v_new_resolved_at := NULL;
      v_new_closed_at := NULL;
  END CASE;

  UPDATE public.support_tickets AS ticket_row
  SET
    status = v_new_status,
    resolution_note = v_reason,
    resolved_at = v_new_resolved_at,
    closed_at = v_new_closed_at,
    updated_at = now()
  WHERE ticket_row.id = p_ticket_id
  RETURNING
    ticket_row.id,
    ticket_row.status::text,
    ticket_row.resolution_note,
    ticket_row.resolved_at,
    ticket_row.closed_at,
    ticket_row.updated_at
  INTO
    v_updated_id,
    v_updated_status,
    v_updated_note,
    v_updated_resolved_at,
    v_updated_closed_at,
    v_updated_at;

  IF v_updated_id IS NULL THEN
    RAISE EXCEPTION 'Support ticket update did not return a row.'
      USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.owner_audit_log (
    actor_user_id,
    target_type,
    target_id,
    target_name,
    target_company_id,
    action_type,
    old_status,
    new_status,
    reason,
    metadata,
    created_at
  )
  VALUES (
    p_actor_user_id,
    'support_ticket',
    p_ticket_id,
    COALESCE(
      NULLIF(trim(v_ticket.subject::text), ''),
      format('Support ticket %s', p_ticket_id)
    ),
    v_ticket.company_id,
    v_action_type,
    v_ticket.status,
    v_new_status,
    v_reason,
    jsonb_build_object(
      'ticket_id', p_ticket_id,
      'action', v_action
    ),
    now()
  );

  RETURN QUERY
  SELECT
    v_updated_id,
    v_updated_status,
    v_updated_note,
    v_updated_resolved_at,
    v_updated_closed_at,
    v_updated_at;
END;
$function$;

REVOKE ALL ON FUNCTION public.owner_update_support_ticket_with_audit(uuid, uuid, text, text)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.owner_update_support_ticket_with_audit(uuid, uuid, text, text)
  FROM authenticated;
REVOKE ALL ON FUNCTION public.owner_update_support_ticket_with_audit(uuid, uuid, text, text)
  FROM anon;
GRANT EXECUTE ON FUNCTION public.owner_update_support_ticket_with_audit(uuid, uuid, text, text)
  TO service_role;

COMMENT ON FUNCTION public.owner_update_support_ticket_with_audit(uuid, uuid, text, text)
IS 'Atomically updates a support ticket and records the Platform Owner action in owner_audit_log.';

COMMIT;

NOTIFY pgrst, 'reload schema';
