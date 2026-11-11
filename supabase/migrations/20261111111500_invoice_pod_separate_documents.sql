-- Preserve invoice and signed POD as separate official A4 documents.
ALTER TABLE public.invoice_documents
  DROP CONSTRAINT IF EXISTS invoice_documents_doc_type_check;
ALTER TABLE public.invoice_documents
  ADD CONSTRAINT invoice_documents_doc_type_check
  CHECK (doc_type IN ('invoice_pdf', 'pod_pdf', 'pod_photo', 'pod_signature', 'other'));
