-- Canonical CRM privacy request <-> existing Super Admin compliance support ticket.
-- SOURCE ONLY: requires isolated staging verification. Never apply to Production without gate.
-- Neither a support ticket nor a CRM request is created by this migration.
ALTER TABLE public.crm_privacy_requests
  ADD COLUMN IF NOT EXISTS support_ticket_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS crm_privacy_support_ticket_unique
  ON public.crm_privacy_requests(support_ticket_id)
  WHERE support_ticket_id IS NOT NULL;

-- In the full XDrive schema, retain a strict FK to the canonical support
-- registry. The minimal CRM-only SQL fixture can replay independently.
DO $$
BEGIN
  IF to_regclass('public.support_tickets') IS NOT NULL AND
     NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname='crm_privacy_support_ticket_fk'
         AND conrelid='public.crm_privacy_requests'::regclass
     ) THEN
    ALTER TABLE public.crm_privacy_requests
      ADD CONSTRAINT crm_privacy_support_ticket_fk
      FOREIGN KEY (support_ticket_id)
      REFERENCES public.support_tickets(id) ON DELETE RESTRICT;
  END IF;
END $$;
