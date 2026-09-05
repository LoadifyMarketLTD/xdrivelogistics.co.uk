-- Explicit current-date remediation for legacy accounts that pre-date immutable
-- registration legal evidence. This does not backfill or recreate historical
-- acceptance; it only allows a new auditable acceptance event recorded now.

begin;

alter table public.registration_legal_acceptances
  drop constraint if exists registration_legal_acceptances_source_check;

alter table public.registration_legal_acceptances
  add constraint registration_legal_acceptances_source_check
  check (source in ('registration', 'material_reacceptance', 'initial_remediation'));

-- Concurrent remediation submissions for the same current contractual
-- requirement must collapse to one evidence event even though the evidence hash
-- contains the acceptance timestamp.
create unique index if not exists registration_legal_acceptances_initial_remediation_requirement_uidx
  on public.registration_legal_acceptances (
    user_id,
    registration_role,
    legal_version,
    md5(agreements::text)
  )
  where source = 'initial_remediation';

comment on column public.registration_legal_acceptances.source is
  'Evidence event origin: initial registration, later material re-acceptance, or explicit current-date remediation for a legacy account with no immutable initial evidence.';

commit;

notify pgrst, 'reload schema';
