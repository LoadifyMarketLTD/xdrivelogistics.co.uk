-- Backfill existing company contact details from approved onboarding payloads.
-- Uses the most recent approved non-empty value per company and field.
-- Idempotent: only updates when the onboarding value differs from companies.

with ranked_email as (
  select
    company_id,
    nullif(trim(payload->>'contact_email'), '') as onboarding_email,
    row_number() over (
      partition by company_id
      order by created_at desc
    ) as rn
  from public.onboarding_applications
  where company_id is not null
    and status = 'approved'
    and nullif(trim(payload->>'contact_email'), '') is not null
)
update public.companies c
set email = re.onboarding_email
from ranked_email re
where re.company_id = c.id
  and re.rn = 1
  and re.onboarding_email is distinct from c.email;

with ranked_website as (
  select
    company_id,
    nullif(trim(payload->>'website'), '') as onboarding_website,
    row_number() over (
      partition by company_id
      order by created_at desc
    ) as rn
  from public.onboarding_applications
  where company_id is not null
    and status = 'approved'
    and nullif(trim(payload->>'website'), '') is not null
)
update public.companies c
set website = rw.onboarding_website
from ranked_website rw
where rw.company_id = c.id
  and rw.rn = 1
  and rw.onboarding_website is distinct from c.website;
