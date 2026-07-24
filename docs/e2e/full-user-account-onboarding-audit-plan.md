# Full user account, role and onboarding audit plan

Target: all production user accounts in `auth.users`, with internal/test accounts clearly flagged and excluded from business totals.

Branch: `audit/production-e2e-user-lifecycle`

## Objective

Build a complete evidence record for every user from registration through dashboard access, then use the combined results to identify systemic defects in:

- account creation;
- email confirmation;
- registration classification;
- role mapping;
- onboarding initialisation;
- onboarding step progression;
- save/resume behaviour;
- submission and approval gating;
- company provisioning;
- membership provisioning;
- profile state;
- workspace resolution;
- route, navigation, API and RLS permissions;
- duplicate prevention and idempotency.

No account is marked fully PASS from database evidence alone. Database, application and permission evidence are separate gates.

## Audit phases

### Phase 1 — Complete production inventory

For every `auth.users` row, collect:

- email and user id;
- account created date;
- email confirmation date;
- last sign-in;
- raw and app metadata;
- internal/test/real-collaborator classification;
- profile row and all role/status/company fields;
- driver profile/persona data where applicable;
- onboarding application and all progression fields;
- company rows created by the user;
- all memberships, including inactive and suspended;
- relevant notification events;
- relevant audit/review events.

The audit must include accounts not present in the original 24-account sample.

### Phase 2 — Registration intent reconstruction

Reconstruct what the user selected at registration from:

- `signup_type`;
- `account_type`;
- `requested_role`;
- `workspace_mode`;
- `owner_driver_workspace`;
- registration-era metadata;
- onboarding account type.

Calculate one canonical registration intent:

- individual driver;
- owner-driver without own workspace;
- owner-driver with own workspace;
- fleet/company operator;
- broker/shipper;
- customer/shipper;
- internal/platform owner;
- unsupported/ambiguous.

Flag conflicting metadata instead of silently choosing one value.

### Phase 3 — Onboarding state audit

For every account determine:

- whether onboarding should exist;
- whether it was initialised;
- whether account type matches registration intent;
- current step;
- completion percentage;
- steps completed;
- mandatory steps still missing;
- required documents missing;
- whether the account can legally resume onboarding;
- whether submission occurred;
- whether submission occurred only after required completion;
- whether review occurred;
- whether approval/rejection/request-changes is valid;
- whether approved users reached the correct workspace;
- whether incomplete or unsubmitted users received access prematurely.

Required lifecycle classification:

- `EMAIL_UNCONFIRMED`;
- `ONBOARDING_NOT_INITIALISED`;
- `ONBOARDING_DRAFT`;
- `ONBOARDING_IN_PROGRESS`;
- `READY_TO_SUBMIT`;
- `SUBMITTED_UNDER_REVIEW`;
- `REQUEST_CHANGES`;
- `REJECTED`;
- `APPROVED`;
- `STATE_INCONSISTENT`.

### Phase 4 — Role and workspace authority audit

Compare all role sources:

- auth metadata role;
- requested role;
- profile role;
- driver persona;
- onboarding account type;
- company type;
- membership role;
- creator relationship;
- resolved application role;
- resolved workspace.

For each user record:

- intended role;
- stored profile role;
- authoritative runtime role;
- expected workspace;
- actual landing route;
- allowed dashboards;
- denied dashboards;
- visible navigation;
- hidden navigation;
- API access;
- RLS access.

Legacy aliases are documented but not automatically treated as defects. A mismatch is a defect only when it changes access, workspace, onboarding or business meaning.

### Phase 5 — Provisioning order audit

Detect invalid ordering such as:

- company created before onboarding submission;
- company activated before approval;
- active membership before approval;
- active profile before approval when the role requires approval;
- approved onboarding without company/membership provisioning;
- company owner without linked `profiles.company_id`;
- created company with no membership;
- membership to a company the user should not access;
- multiple active workspaces;
- refresh or repeated action creating duplicate records.

### Phase 6 — Credentialed E2E verification

Use only explicitly authorised internal/test accounts for authenticated tests. For every available credentialed account verify:

- login result;
- initial redirect;
- onboarding resume permission;
- exact displayed current step;
- fields already saved;
- missing requirements shown to user;
- back/forward navigation;
- refresh stability;
- repeated save and submit clicks;
- direct URL access to later steps;
- dashboard route resolution;
- navigation items;
- forbidden routes;
- API status codes;
- RLS read/write behaviour;
- logout and re-login stability.

Real collaborator accounts without explicit authorisation remain read-only and are never mutated.

### Phase 7 — Systemic defect grouping

Do not repair accounts one by one before grouping defects. Every finding must be mapped to a root-cause family:

- registration option missing;
- registration metadata mismatch;
- callback/init failure;
- onboarding row missing;
- onboarding step calculation defect;
- completion percentage defect;
- submission gating defect;
- approval gating defect;
- provisioning-before-approval defect;
- profile role mapping defect;
- workspace resolution defect;
- membership provisioning defect;
- duplicate/idempotency defect;
- route guard defect;
- navigation permission defect;
- RLS/API permission defect;
- legacy data migration defect.

A code defect must receive a regression test before repair is considered complete.

## Per-account evidence record

Each user receives one row/report containing:

1. identity and internal/test classification;
2. registration choice and reconstructed intent;
3. email verification state;
4. profile role/status/company state;
5. onboarding expected/existing state;
6. completed and missing onboarding steps;
7. submission/review/approval evidence;
8. company and membership state;
9. expected role/workspace;
10. actual login route and navigation;
11. allowed and denied route checks;
12. API/RLS evidence;
13. consistency findings;
14. root-cause category;
15. repair recommendation;
16. final status.

Final statuses:

- `PASS_COMPLETE`;
- `PASS_INCOMPLETE_USER_ACTION_REQUIRED`;
- `PASS_INTERNAL_TEST_ACCOUNT`;
- `FAIL_DATA_STATE`;
- `FAIL_APPLICATION_BEHAVIOUR`;
- `FAIL_PERMISSION_MODEL`;
- `BLOCKED_NEEDS_CREDENTIALS`;
- `BLOCKED_NEEDS_BUSINESS_INTENT`.

## Required deliverables

- complete all-user inventory, not only the initial sample;
- one per-account evidence table;
- one registration-intent versus stored-role matrix;
- one onboarding progression matrix;
- one provisioning-order matrix;
- one route/navigation/API/RLS matrix;
- root-cause defect list with affected accounts;
- regression tests for every confirmed code defect;
- minimal repair plan separated into code fixes and data repairs;
- rerun evidence after repairs;
- draft PR retained until all executable checks pass.

## Safety and merge gate

- no bulk role normalisation;
- no automatic company or membership creation;
- no collaborator mutation without explicit authorisation;
- no production scenario marked PASS without exact evidence;
- no merge while any confirmed systemic defect lacks regression coverage;
- all data repairs must be account-specific, reversible and independently verified.
