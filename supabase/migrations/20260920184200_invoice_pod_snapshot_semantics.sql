alter table public.invoices
  add column if not exists pod_delivery_status_snapshot text;

create or replace function public.fn_finalize_invoice_pod_snapshot()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_old_status text;
  v_new_status text;
  v_pod_status text;
  v_pod_exists boolean := false;
begin
  if tg_op <> 'UPDATE' then return new; end if;
  v_old_status := lower(coalesce(nullif(old.current_status::text, ''), nullif(old.status::text, ''), ''));
  v_new_status := lower(coalesce(nullif(new.current_status::text, ''), nullif(new.status::text, ''), ''));
  if v_new_status not in ('delivered', 'completed') or v_old_status in ('delivered', 'completed') then return new; end if;

  select nullif(btrim(p.delivery_status), ''), true
  into v_pod_status, v_pod_exists
  from public.proof_of_delivery p
  where p.job_id = new.id
  order by p.created_at desc
  limit 1;

  update public.invoices i
  set
    pod_required = coalesce(i.pod_required, false) or coalesce(new.pod_required, false),
    pod_generated = coalesce(i.pod_generated, false) or coalesce(new.pod_generated, false) or v_pod_exists,
    pod_delivery_status_snapshot = coalesce(v_pod_status, nullif(btrim(coalesce(new.delivery_status, '')), ''), i.pod_delivery_status_snapshot),
    updated_at = now()
  where i.job_id = new.id;
  return new;
end;
$function$;

drop trigger if exists zzz_trg_finalize_invoice_pod_snapshot on public.jobs;
create trigger zzz_trg_finalize_invoice_pod_snapshot
after update of status, current_status, delivered_at, completed_at on public.jobs
for each row execute function public.fn_finalize_invoice_pod_snapshot();
