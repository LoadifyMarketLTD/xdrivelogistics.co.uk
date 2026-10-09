begin;

alter table public.invoices
  add column if not exists document_type text not null default 'invoice',
  add column if not exists parent_invoice_id uuid references public.invoices(id) on delete restrict,
  add column if not exists adjustment_reason text;

alter table public.invoices drop constraint if exists invoices_document_type_check;
alter table public.invoices
  add constraint invoices_document_type_check
  check (document_type in ('invoice','supplementary','credit_note'));

create index if not exists invoices_parent_invoice_idx
  on public.invoices(parent_invoice_id)
  where parent_invoice_id is not null;

comment on column public.invoices.document_type is
  'Financial document type: invoice, supplementary invoice, or credit note.';
comment on column public.invoices.parent_invoice_id is
  'Original invoice adjusted by this supplementary invoice or credit note.';
comment on column public.invoices.adjustment_reason is
  'Immutable business reason for a supplementary invoice or credit note.';

notify pgrst, 'reload schema';
commit;
