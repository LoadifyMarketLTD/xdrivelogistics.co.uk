# All Accounts Consistency Verification

Target: production database and application behaviour for every account listed in the consistency export.

Branch: `audit/production-e2e-user-lifecycle`

PR: `#289`

## Objective

Verify every account individually before any repair is proposed or applied.

This document is read-only by default. No profile role, company link, membership, onboarding status, company status or permission may be changed until the evidence for that exact account has been reviewed.

## Verification rules

1. Do not infer that `NO_MEMBERSHIP` is an error for a driver or customer.
2. Do not infer that membership role `owner` requires profile role `company_admin`.
3. Treat legacy profile roles such as `admin`, `owner`, `company`, `broker`, `driver` and `customer` according to the application role mapper.
4. Do not create a company or membership for incomplete, unsubmitted, pending or rejected onboarding.
5. Do not overwrite internal platform-owner roles.
6. Internal, personal, legacy and approved test accounts remain excluded from collaborator and commercial-user statistics.
7. Every proposed mutation must be minimal, account-specific and preceded by read-only evidence.
8. After any approved repair, rerun the full integrity audit and the account-specific verification query.

## Internal and approved test accounts

The following accounts must be treated as internal, personal, legacy or approved test accounts and excluded from business-user totals:

- `angelicatoda@gmail.com`
- `dannycourierltd@gmail.com`
- `dannyelbill@gmail.com`
- `dannyelbill447@gmail.com`
- `fleserdumitru@gmail.com`
- `loadifymarket.co.uk@gmail.com`
- `xdrivelogisticsltd@gmail.com`

Their data may be inspected and used for authorised testing, but roles and permissions must not be normalised blindly from company membership.

## Read-only master query

Run this query first for the complete account set.

```sql
with target_accounts(email) as (
  values
    ('info@risolutions.uk'),
    ('kesha112@gmail.com'),
    ('mtlogisticsgroup555@gmail.com'),
    ('ajhcouriersltd@outlook.com'),
    ('alexa.dorobantu86@gmail.com'),
    ('angelicatoda@gmail.com'),
    ('arif52@hotmail.co.uk'),
    ('arvinraj1515@gmail.com'),
    ('danielapostoae@yahoo.com'),
    ('earlyriselogistics.erl@gmail.com'),
    ('fez234@aol.com'),
    ('kennykagande2@gmail.com'),
    ('maria.amariutei15@gmail.com'),
    ('massmclean@gmail.com'),
    ('royhandley50@hotmail.co.uk'),
    ('thesbsourier@yahoo.com'),
    ('tomm25cowper@gmail.com'),
    ('usamaali5454@gmail.com'),
    ('a09870175@gmail.com'),
    ('dola-9491@outlook.com'),
    ('loadifymarket.co.uk@gmail.com'),
    ('logistics@navson.com'),
    ('ryolimitedlogistics@outlook.com'),
    ('xdrivelogisticsltd@gmail.com')
),
active_memberships as (
  select
    cm.user_id,
    count(*) filter (where cm.status = 'active') as active_membership_count,
    jsonb_agg(
      jsonb_build_object(
        'membership_id', cm.id,
        'company_id', cm.company_id,
        'role', cm.role,
        'status', cm.status,
        'created_at', cm.created_at,
        'updated_at', cm.updated_at
      ) order by cm.created_at
    ) as memberships
  from public.company_memberships cm
  group by cm.user_id
),
created_companies as (
  select
    c.created_by,
    count(*) as created_company_count,
    jsonb_agg(
      jsonb_build_object(
        'company_id', c.id,
        'name', c.name,
        'status', c.status,
        'company_type', c.company_type,
        'created_at', c.created_at,
        'updated_at', c.updated_at
      ) order by c.created_at
    ) as companies_created
  from public.companies c
  group by c.created_by
),
linked_company as (
  select
    p.user_id,
    jsonb_build_object(
      'company_id', c.id,
      'name', c.name,
      'status', c.status,
      'company_type', c.company_type,
      'created_by', c.created_by
    ) as profile_company
  from public.profiles p
  left join public.companies c on c.id = p.company_id
)
select
  ta.email,
  au.id as user_id,
  au.email_confirmed_at,
  au.created_at as auth_created_at,
  au.last_sign_in_at,
  au.raw_user_meta_data,
  p.id as profile_id,
  p.role as profile_role,
  p.status as profile_status,
  p.company_id as profile_company_id,
  p.is_driver,
  p.created_at as profile_created_at,
  p.updated_at as profile_updated_at,
  oa.id as onboarding_id,
  oa.account_type,
  oa.workspace_mode,
  oa.owner_driver_workspace,
  oa.status as onboarding_status,
  oa.current_step,
  oa.completion_percentage,
  oa.submitted_at,
  oa.reviewed_at,
  oa.reviewed_by,
  oa.review_notes,
  coalesce(am.active_membership_count, 0) as active_membership_count,
  am.memberships,
  coalesce(cc.created_company_count, 0) as created_company_count,
  cc.companies_created,
  lc.profile_company
from target_accounts ta
left join auth.users au on lower(au.email) = lower(ta.email)
left join public.profiles p on p.user_id = au.id
left join public.onboarding_applications oa on oa.user_id = au.id
left join active_memberships am on am.user_id = au.id
left join created_companies cc on cc.created_by = au.id
left join linked_company lc on lc.user_id = au.id
order by ta.email;
```

If a referenced column differs in production, adapt only the projection. Do not alter data to make the query succeed.

## Duplicate and referential-integrity checks

Run these read-only checks after the master query.

```sql
-- More than one profile per user
select user_id, count(*)
from public.profiles
where user_id in (
  select id from auth.users where lower(email) in (
    'info@risolutions.uk','kesha112@gmail.com','mtlogisticsgroup555@gmail.com',
    'ajhcouriersltd@outlook.com','alexa.dorobantu86@gmail.com','angelicatoda@gmail.com',
    'arif52@hotmail.co.uk','arvinraj1515@gmail.com','danielapostoae@yahoo.com',
    'earlyriselogistics.erl@gmail.com','fez234@aol.com','kennykagande2@gmail.com',
    'maria.amariutei15@gmail.com','massmclean@gmail.com','royhandley50@hotmail.co.uk',
    'thesbsourier@yahoo.com','tomm25cowper@gmail.com','usamaali5454@gmail.com',
    'a09870175@gmail.com','dola-9491@outlook.com','loadifymarket.co.uk@gmail.com',
    'logistics@navson.com','ryolimitedlogistics@outlook.com','xdrivelogisticsltd@gmail.com'
  )
)
group by user_id
having count(*) <> 1;

-- More than one onboarding application per user
select user_id, count(*)
from public.onboarding_applications
where user_id in (
  select id from auth.users where lower(email) in (
    'info@risolutions.uk','kesha112@gmail.com','mtlogisticsgroup555@gmail.com',
    'ajhcouriersltd@outlook.com','alexa.dorobantu86@gmail.com','angelicatoda@gmail.com',
    'arif52@hotmail.co.uk','arvinraj1515@gmail.com','danielapostoae@yahoo.com',
    'earlyriselogistics.erl@gmail.com','fez234@aol.com','kennykagande2@gmail.com',
    'maria.amariutei15@gmail.com','massmclean@gmail.com','royhandley50@hotmail.co.uk',
    'thesbsourier@yahoo.com','tomm25cowper@gmail.com','usamaali5454@gmail.com',
    'a09870175@gmail.com','dola-9491@outlook.com','loadifymarket.co.uk@gmail.com',
    'logistics@navson.com','ryolimitedlogistics@outlook.com','xdrivelogisticsltd@gmail.com'
  )
)
group by user_id
having count(*) > 1;

-- More than one active membership per user
select user_id, count(*)
from public.company_memberships
where status = 'active'
and user_id in (
  select id from auth.users where lower(email) in (
    'info@risolutions.uk','kesha112@gmail.com','mtlogisticsgroup555@gmail.com',
    'ajhcouriersltd@outlook.com','alexa.dorobantu86@gmail.com','angelicatoda@gmail.com',
    'arif52@hotmail.co.uk','arvinraj1515@gmail.com','danielapostoae@yahoo.com',
    'earlyriselogistics.erl@gmail.com','fez234@aol.com','kennykagande2@gmail.com',
    'maria.amariutei15@gmail.com','massmclean@gmail.com','royhandley50@hotmail.co.uk',
    'thesbsourier@yahoo.com','tomm25cowper@gmail.com','usamaali5454@gmail.com',
    'a09870175@gmail.com','dola-9491@outlook.com','loadifymarket.co.uk@gmail.com',
    'logistics@navson.com','ryolimitedlogistics@outlook.com','xdrivelogisticsltd@gmail.com'
  )
)
group by user_id
having count(*) > 1;

-- Broken profile company references
select p.user_id, p.company_id
from public.profiles p
left join public.companies c on c.id = p.company_id
where p.company_id is not null
and c.id is null;

-- Broken membership company references
select cm.id, cm.user_id, cm.company_id
from public.company_memberships cm
left join public.companies c on c.id = cm.company_id
where c.id is null;
```

## Account-by-account matrix

| Email | Initial classification | Required verification | Mutation rule |
|---|---|---|---|
| `info@risolutions.uk` | `COMPANY_MISMATCH` | Confirm exactly one active owner membership, company exists, company is intended, onboarding supports company ownership | Link `profiles.company_id` only after all checks pass |
| `kesha112@gmail.com` | `COMPANY_MISMATCH` | Confirm one active owner membership and intended company; confirm `admin` is accepted legacy alias | Link company only; do not change role merely for canonicalisation |
| `mtlogisticsgroup555@gmail.com` | `COMPANY_MISMATCH` | Same checks as above | Link company only if unambiguous |
| `ajhcouriersltd@outlook.com` | `NO_MEMBERSHIP` driver | Confirm driver onboarding/persona and no owner-workspace request | No company or membership expected for individual driver |
| `alexa.dorobantu86@gmail.com` | `NO_MEMBERSHIP` driver | Confirm driver onboarding/persona | No automatic repair |
| `angelicatoda@gmail.com` | Internal/test customer pending | Confirm onboarding status and pending reason; exclude from metrics | No company expected unless approved company onboarding exists |
| `arif52@hotmail.co.uk` | `NO_MEMBERSHIP` driver | Confirm individual-driver path and dashboard route | No automatic repair |
| `arvinraj1515@gmail.com` | `NO_MEMBERSHIP` driver, onboarding previously corrected | Confirm onboarding remains `in_progress`, no company, no membership | Do not approve or provision until complete and submitted |
| `danielapostoae@yahoo.com` | `NO_MEMBERSHIP` driver | Confirm individual-driver intent | No automatic repair |
| `earlyriselogistics.erl@gmail.com` | `NO_MEMBERSHIP` driver | Verify whether name implies company but onboarding says driver; use onboarding evidence, not email name | No automatic repair |
| `fez234@aol.com` | `NO_MEMBERSHIP` driver | Confirm individual-driver intent | No automatic repair |
| `kennykagande2@gmail.com` | `NO_MEMBERSHIP` driver | Confirm individual-driver intent | No automatic repair |
| `maria.amariutei15@gmail.com` | `NO_MEMBERSHIP` driver | Confirm individual-driver intent | No automatic repair |
| `massmclean@gmail.com` | `NO_MEMBERSHIP` driver | Confirm individual-driver intent | No automatic repair |
| `royhandley50@hotmail.co.uk` | Company admin pending, no membership | Inspect onboarding completion, submission and review state; determine whether company provisioning is legitimately pending | Never create company/membership for incomplete or unsubmitted onboarding |
| `thesbsourier@yahoo.com` | `NO_MEMBERSHIP` driver | Confirm individual-driver intent | No automatic repair |
| `tomm25cowper@gmail.com` | `NO_MEMBERSHIP` customer | Confirm customer account and customer dashboard access | No company membership required by default |
| `usamaali5454@gmail.com` | `NO_MEMBERSHIP` driver | Confirm individual-driver intent | No automatic repair |
| `a09870175@gmail.com` | `ROLE_MISMATCH` broker + owner membership | Confirm company type, onboarding account type and intended broker workspace | Broker may remain broker while owning a company; no blind role change |
| `dola-9491@outlook.com` | `ROLE_MISMATCH` owner + owner membership | Determine whether `owner` is platform-owner or company-owner semantics | Never demote until platform permissions are proven unnecessary |
| `loadifymarket.co.uk@gmail.com` | Internal/test account | Confirm intended test role and workspace; exclude from metrics | No automatic role normalisation |
| `logistics@navson.com` | `ROLE_MISMATCH` customer + owner membership | Confirm onboarding type, company type, actual dashboard and business intent | Change only if customer role is proven wrong |
| `ryolimitedlogistics@outlook.com` | `ROLE_MISMATCH` admin + owner membership | Confirm `admin` maps to `company_admin` and routes correctly | Canonical role rewrite not required if behaviour is correct |
| `xdrivelogisticsltd@gmail.com` | Internal platform-owner account | Confirm super-admin/platform-owner access, company membership and route protection | Never replace `owner` with `company_admin` automatically |

## Per-account application verification

For each account that can be safely authenticated, record:

- login result;
- post-login route;
- visible navigation;
- hidden navigation;
- access to intended dashboard;
- denial from unauthorised dashboards;
- onboarding resume or pending-approval behaviour;
- company workspace resolution;
- API response codes for allowed and denied requests;
- whether logout/login preserves the same role and workspace;
- whether refresh changes any company or membership count.

## Expected role interpretation

Application role mapping currently treats these values as aliases:

- `admin` → `company_admin`
- `owner` → `owner`
- `company` → `company_staff`
- `owner_driver`, `owner_operator`, `self_employed` → `driver`
- `customer_shipper`, `shipper`, `client` → `customer`
- `transport_broker`, `freight_broker` → `broker`

A canonicalisation difference is not itself a production defect when route access and permissions are correct.

## Repair decision outcomes

Each account must finish in exactly one category:

- `PASS_NO_CHANGE`: current state is valid.
- `PASS_INTERNAL_TEST_ACCOUNT`: valid internal/test state; excluded from metrics.
- `REPAIR_PROFILE_COMPANY_LINK`: unambiguous active membership exists and profile link is missing.
- `REPAIR_PROFILE_ROLE`: role is proven inconsistent with onboarding, company type and actual intended access.
- `REPAIR_MEMBERSHIP`: membership is missing, duplicated or points to the wrong company, with authoritative evidence.
- `REPAIR_ONBOARDING_STATE`: onboarding was incorrectly approved, rejected or left inconsistent.
- `BLOCKED_NEEDS_BUSINESS_EVIDENCE`: data does not establish the user's intended account type.
- `BLOCKED_NEEDS_CREDENTIALS`: database state is known but dashboard and RLS behaviour cannot yet be verified.

## Required evidence record

Use this format for every account:

```text
Email:
User ID:
Internal/test account: yes/no
Auth confirmed:
Profile role/status/company_id:
Onboarding account_type/workspace/status/progress/submitted_at:
Created companies:
Memberships:
Active membership count:
Resolved application role:
Expected workspace:
Actual route:
Allowed routes:
Denied routes:
API/RLS evidence:
Duplicate checks:
Decision:
Proposed mutation:
Post-repair verification:
```

## Completion gate

This verification block is complete only when:

1. all 24 accounts have an evidence record;
2. all false positives are marked `PASS_NO_CHANGE` or `PASS_INTERNAL_TEST_ACCOUNT`;
3. every real mismatch has a minimal repair proposal;
4. no repair relies only on the exported `proposed_*` columns;
5. all applied repairs are followed by the seven production integrity checks;
6. dashboard and RLS evidence exists for every account with available approved test credentials;
7. PR #289 remains draft until the complete lifecycle matrix and this account matrix are reconciled.
