-- Canonical quote lifecycle coupling.
-- Submitted quotes move a pre-award marketplace job to quoted. If every active quote is later
-- withdrawn/rejected before award, the job returns to posted so Loads, Quotes and Diary agree.

create or replace function public.sync_job_quote_lifecycle_from_bid()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text := lower(btrim(coalesce(new.status, '')));
begin
  if v_status = 'submitted' then
    update public.jobs
       set status = 'quoted'
     where id = new.job_id
       and lower(btrim(coalesce(status, ''))) in ('posted', 'open', 'received')
       and accepted_bid_id is null
       and awarded_carrier_company_id is null
       and assigned_company_id is null
       and assigned_driver_id is null;
  elsif tg_op = 'UPDATE'
        and lower(btrim(coalesce(old.status, ''))) = 'submitted'
        and v_status in ('withdrawn', 'rejected') then
    update public.jobs j
       set status = 'posted'
     where j.id = new.job_id
       and lower(btrim(coalesce(j.status, ''))) = 'quoted'
       and j.accepted_bid_id is null
       and j.awarded_carrier_company_id is null
       and j.assigned_company_id is null
       and j.assigned_driver_id is null
       and not exists (
         select 1
           from public.job_bids b
          where b.job_id = j.id
            and b.id <> new.id
            and b.status in ('submitted', 'accepted')
       );
  end if;
  return new;
end;
$$;

revoke all on function public.sync_job_quote_lifecycle_from_bid() from public;
grant execute on function public.sync_job_quote_lifecycle_from_bid() to postgres, service_role;

drop trigger if exists trg_sync_job_to_quoted_on_submitted_bid on public.job_bids;
drop trigger if exists trg_sync_job_quote_lifecycle_from_bid on public.job_bids;
create trigger trg_sync_job_quote_lifecycle_from_bid
after insert or update of status on public.job_bids
for each row
execute function public.sync_job_quote_lifecycle_from_bid();

-- Reconcile submitted quotes created before this coupling existed.
update public.jobs j
   set status = 'quoted'
 where lower(btrim(coalesce(j.status, ''))) in ('posted', 'open', 'received')
   and j.accepted_bid_id is null
   and j.awarded_carrier_company_id is null
   and j.assigned_company_id is null
   and j.assigned_driver_id is null
   and exists (
     select 1
       from public.job_bids b
      where b.job_id = j.id
        and b.status = 'submitted'
   );

-- Reconcile stale quoted jobs with no live quote and no award.
update public.jobs j
   set status = 'posted'
 where lower(btrim(coalesce(j.status, ''))) = 'quoted'
   and j.accepted_bid_id is null
   and j.awarded_carrier_company_id is null
   and j.assigned_company_id is null
   and j.assigned_driver_id is null
   and not exists (
     select 1
       from public.job_bids b
      where b.job_id = j.id
        and b.status in ('submitted', 'accepted')
   );
