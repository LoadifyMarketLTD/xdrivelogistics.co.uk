begin;

alter table public.invoices
  drop constraint if exists invoices_adjustment_parent_contract;

alter table public.invoices
  add constraint invoices_adjustment_parent_contract
  check (
    (document_type = 'invoice' and parent_invoice_id is null)
    or (
      document_type in ('supplementary','credit_note')
      and parent_invoice_id is not null
      and length(btrim(coalesce(adjustment_reason, ''))) >= 5
    )
  );

create index if not exists invoices_adjustment_family_idx
  on public.invoices(parent_invoice_id, document_type, created_at desc)
  where parent_invoice_id is not null;

comment on constraint invoices_adjustment_parent_contract on public.invoices is
  'Adjustment documents must reference a parent invoice and retain an explicit business reason; normal invoices cannot point at a parent.';

notify pgrst, 'reload schema';
commit;
