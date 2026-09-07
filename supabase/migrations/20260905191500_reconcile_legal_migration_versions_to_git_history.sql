-- Canonicalize the four legal migration history rows created by the controlled
-- Production rollout to the exact timestamped migration filenames in Git.
-- This is metadata-only reconciliation; it does not alter legal evidence rows.

do $$
declare
  v_old integer;
  v_new integer;
  v_updated integer;
begin
  with m(old_version,new_version,migration_name) as (
    values
      ('20260905190347','20260904210500','registration_legal_acceptance_evidence'),
      ('20260905190410','20260904215518','registration_legal_material_reacceptance'),
      ('20260905190424','20260905183500','registration_legal_initial_remediation'),
      ('20260905190627','20260905191000','registration_legal_service_role_append_only')
  )
  select
    count(*) filter (where s.version is not null),
    count(*) filter (where t.version is not null)
  into v_old, v_new
  from m
  left join supabase_migrations.schema_migrations s
    on s.version = m.old_version
   and s.name = m.migration_name
  left join supabase_migrations.schema_migrations t
    on t.version = m.new_version;

  if v_old = 4 and v_new = 0 then
    with m(old_version,new_version,migration_name) as (
      values
        ('20260905190347','20260904210500','registration_legal_acceptance_evidence'),
        ('20260905190410','20260904215518','registration_legal_material_reacceptance'),
        ('20260905190424','20260905183500','registration_legal_initial_remediation'),
        ('20260905190627','20260905191000','registration_legal_service_role_append_only')
    )
    update supabase_migrations.schema_migrations s
    set version = m.new_version
    from m
    where s.version = m.old_version
      and s.name = m.migration_name;

    get diagnostics v_updated = row_count;
    if v_updated <> 4 then
      raise exception 'Expected 4 legal migration metadata updates, got %', v_updated;
    end if;
  elsif v_old = 0 and v_new = 4 then
    null;
  else
    raise exception 'Legal migration history is neither generated nor canonical: old %, canonical %', v_old, v_new;
  end if;
end $$;
