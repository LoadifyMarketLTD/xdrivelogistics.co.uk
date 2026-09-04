-- Forward-compatible source expansion for append-only legal evidence.
-- This migration is committed for preview/release validation only and is not
-- applied to Production as part of PR #499.

begin;

alter table if exists public.registration_legal_acceptances
  drop constraint if exists registration_legal_acceptances_source_check;

alter table if exists public.registration_legal_acceptances
  add constraint registration_legal_acceptances_source_check
  check (source in ('registration', 'material_reacceptance'));

comment on column public.registration_legal_acceptances.source is
  'Evidence event origin: initial registration or a later material contractual re-acceptance.';

commit;

notify pgrst, 'reload schema';
