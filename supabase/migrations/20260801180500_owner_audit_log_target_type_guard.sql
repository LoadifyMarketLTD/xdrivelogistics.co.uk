BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'owner_audit_log'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'owner_audit_log'
        AND column_name = 'target_type'
    ) THEN
      ALTER TABLE public.owner_audit_log
        ADD COLUMN target_type text;
    END IF;

    UPDATE public.owner_audit_log
    SET target_type = CASE
      WHEN action_type IN ('document_viewed', 'document_approved', 'document_rejected') THEN 'document'
      WHEN action_type = 'support_ticket_updated' THEN 'support_ticket'
      WHEN action_type LIKE 'fraud_case_%' THEN 'fraud_review_case'
      WHEN action_type LIKE 'marketplace_%' THEN 'marketplace'
      WHEN target_company_id IS NOT NULL THEN 'company'
      ELSE 'platform'
    END
    WHERE target_type IS NULL OR btrim(target_type) = '';

    ALTER TABLE public.owner_audit_log
      ALTER COLUMN target_type SET DEFAULT 'platform';

    ALTER TABLE public.owner_audit_log
      ALTER COLUMN target_type SET NOT NULL;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.owner_audit_log_assign_target_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.target_type IS NULL OR btrim(NEW.target_type) = '' THEN
    NEW.target_type := CASE
      WHEN NEW.action_type IN ('document_viewed', 'document_approved', 'document_rejected') THEN 'document'
      WHEN NEW.action_type = 'support_ticket_updated' THEN 'support_ticket'
      WHEN NEW.action_type LIKE 'fraud_case_%' THEN 'fraud_review_case'
      WHEN NEW.action_type LIKE 'marketplace_%' THEN 'marketplace'
      WHEN NEW.target_company_id IS NOT NULL THEN 'company'
      ELSE 'platform'
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_owner_audit_log_assign_target_type ON public.owner_audit_log;

CREATE TRIGGER trg_owner_audit_log_assign_target_type
BEFORE INSERT ON public.owner_audit_log
FOR EACH ROW
EXECUTE FUNCTION public.owner_audit_log_assign_target_type();

COMMIT;
