-- Private invoice document storage and provider delivery audit.
-- Apply on staging before enabling the real invoice send action.

BEGIN;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS delivery_provider text,
  ADD COLUMN IF NOT EXISTS delivery_message_id text,
  ADD COLUMN IF NOT EXISTS delivery_recipient_email text,
  ADD COLUMN IF NOT EXISTS delivery_error text,
  ADD COLUMN IF NOT EXISTS delivery_attempted_at timestamptz;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('invoice-docs', 'invoice-docs', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS invoice_docs_member_read ON storage.objects;
CREATE POLICY invoice_docs_member_read
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'invoice-docs'
  AND EXISTS (
    SELECT 1
    FROM public.invoice_documents d
    WHERE d.file_url = storage.objects.name
      AND public.is_company_member(d.company_id)
  )
);

CREATE INDEX IF NOT EXISTS invoices_delivery_message_id_idx
  ON public.invoices (delivery_message_id)
  WHERE delivery_message_id IS NOT NULL;

COMMIT;
