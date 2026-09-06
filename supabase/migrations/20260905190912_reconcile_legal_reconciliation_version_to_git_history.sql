-- Move the one-off Legal migration-history reconciliation record to a Git
-- timestamp that sorts after every Legal schema migration it reconciles.
-- On a clean replay this migration intentionally no-ops because the one-off
-- hosted-history row does not exist yet.

do $$
declare
  v_old integer;
  v_new integer;
begin
  select
    count(*) filter (where version = '20260905190823' and name = 'reconcile_legal_migration_versions_to_git_history'),
    count(*) filter (where version = '20260905191500' and name = 'reconcile_legal_migration_versions_to_git_history')
  into v_old, v_new
  from supabase_migrations.schema_migrations
  where version in ('20260905190823', '20260905191500');

  if v_old = 1 and v_new = 0 then
    update supabase_migrations.schema_migrations
    set version = '20260905191500'
    where version = '20260905190823'
      and name = 'reconcile_legal_migration_versions_to_git_history';
  elsif (v_old = 0 and v_new = 1) or (v_old = 0 and v_new = 0) then
    null;
  else
    raise exception 'Unexpected Legal reconciliation migration-history state: old %, canonical %', v_old, v_new;
  end if;
end $$;
