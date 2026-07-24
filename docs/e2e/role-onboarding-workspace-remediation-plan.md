# Role, Onboarding, Workspace and Permission Remediation Plan

Branch: `audit/production-e2e-user-lifecycle`

PR: `#289`

## Objective

Reach an evidence-backed state in which every supported registration role has one authoritative lifecycle from registration through metadata, profile persistence, onboarding, approval, provisioning, workspace resolution, route access, API authorization and RLS enforcement.

No role is marked complete from static inspection alone. Merge remains blocked until all required runtime and database evidence is attached to the production lifecycle matrix.

## Canonical layers

The implementation must keep these layers distinct:

1. Registration choice — what the applicant selects.
2. Account type — which onboarding workflow and approval contract applies.
3. Profile role — canonical application identity.
4. Membership role — authority inside one company.
5. Driver persona — operational classification only.
6. Workspace role — resolved UI and capability context.
7. Capabilities — action-level authorization.
8. RLS — database-level enforcement.

A value from one layer must never silently substitute for another without an explicit mapper and regression coverage.

## Supported lifecycle matrix

| Registration choice | Account type | Profile role | Workspace after approval | Company required |
|---|---|---|---|---|
| Individual Driver | `individual_driver` target; legacy `owner_driver` only during migration | `driver` | `driver` | No |
| Owner Operator, driver-only | `owner_driver` | `driver` | `driver` | No |
| Owner Operator, own operations workspace | `owner_driver` | `driver` before provisioning; company authority after approval | `owner_driver` or company admin according to provisioning contract | Yes |
| Fleet Operator | `fleet_courier` | `company_admin` canonical; legacy storage alias permitted only through mapper | company admin / company owner | Yes |
| Transport Broker | `broker_shipper` | `broker` canonical | broker | Yes |
| Customer / Shipper | `customer_shipper` | `customer` | customer | No by default |
| Company member / dispatcher | invite-only membership flow | `company_staff` or explicitly assigned canonical role | capability-derived company workspace | Existing company |
| Platform Owner | internal-only | `owner` | platform owner | Platform scope |

## Work packages

### WP1 — Registration and metadata contract

- Keep Individual Driver visible.
- Keep owner-operator workspace choice explicit.
- Persist `workspace_mode` and `owner_driver_workspace` consistently.
- Introduce a canonical registration-to-account-type mapper used by registration, callback and onboarding initialisation.
- Add contract tests for every public registration choice and both owner-operator variants.

Exit gate:

- Every public registration choice produces one deterministic metadata payload.
- No owner-operator flag is inferred from display labels alone.

### WP2 — Individual-driver onboarding separation

- Add `individual_driver` to the onboarding account-type domain.
- Add database migration updating account-type constraints safely and idempotently.
- Add route segment and normalisation aliases.
- Define individual-driver required documents separately from owner-operator documents.
- Update onboarding init, session, submit and approval/provisioning paths.
- Backward compatibility: existing driver-only accounts stored as `owner_driver` remain readable and can be migrated only when evidence proves they have no provider workspace/company provisioning.

Exit gate:

- New Individual Driver accounts never require company creation.
- New Individual Driver accounts cannot unlock owner-driver commercial capabilities.
- Existing owner-driver applications are not reclassified blindly.

### WP3 — Authoritative role and membership mapping

- Inventory every stored `profiles.role` and `company_memberships.role` value in production.
- Define a canonical mapping table for legacy aliases.
- Remove ambiguous fallbacks where `company`, `member` or `admin` can resolve to broader authority without additional evidence.
- Decide explicit contracts for `member`, `dispatcher`, `finance`, `compliance`, `viewer`, `fleet_manager` and carrier administration.
- Add least-privilege regression tests for every mapping.

Exit gate:

- A basic `member` cannot receive carrier-admin capabilities unless explicitly assigned.
- Membership roles do not grant platform-owner access.
- Profile aliases remain backward compatible without privilege escalation.

### WP4 — Route authorization fail-closed conversion

- Inventory every route under `/admin`, `/broker`, `/customer`, `/driver`, `/m` and `/super-admin`.
- Add an explicit route requirement for every protected page.
- Replace the current protected-route default allow with default deny.
- Keep only exact workspace home routes explicitly public to the corresponding authenticated workspace.
- Validate direct URL access, refresh and nested routes.

Exit gate:

- A newly added protected route without a declaration is denied.
- Every existing protected route has an owner, workspace role and capability contract.

### WP5 — API authorization

- Inventory every route handler and server action that reads or mutates protected data.
- Require authenticated identity, workspace/company context and action capability.
- Verify ownership checks independently of UI route access.
- Add negative tests for cross-company IDs and forged role metadata.

Exit gate:

- UI denial is not the only security boundary.
- Cross-company reads and writes fail at the API/database layer.

### WP6 — RLS verification and hardening

For each critical table, verify SELECT/INSERT/UPDATE/DELETE policies for every role class:

- profiles
- companies
- company_memberships
- onboarding_applications
- onboarding_documents
- drivers
- vehicles
- loads
- quotes/bids
- jobs and job events
- POD/documents
- invoices and payments
- disputes/incidents

Exit gate:

- Anonymous access is denied unless explicitly public.
- Users cannot read or mutate another company's rows.
- Drivers can access only their own permitted operational records.
- Service-role-only operations cannot be invoked through user clients.

### WP7 — Approval and provisioning idempotency

- Trace approval RPC/function and every write it performs.
- Guarantee one company, one authoritative owner membership and one profile link per approved company applicant.
- Prevent provisioning for draft, under-review, rejected or request-changes states.
- Verify repeated approval, retry and concurrent submission behavior.

Exit gate:

- Repeating approval is idempotent.
- Partial failures are recoverable without duplicate companies or memberships.

### WP8 — Existing-account consistency

- Run the read-only master query in production.
- Classify every account by expected lifecycle, actual state and evidence.
- Exclude approved internal/test/legacy accounts from collaborator totals.
- Group defects by root cause.
- Apply only minimal, reviewed and reversible repairs.
- Rerun the master query after each repair batch.

Exit gate:

- Every listed account has an evidence-backed classification.
- No real collaborator account is changed by an automated test.

### WP9 — Regression suite

Required automated coverage:

- registration metadata matrix;
- onboarding account-type and document matrix;
- approval/provisioning idempotency;
- workspace resolution matrix;
- capability matrix;
- route allow/deny matrix;
- API negative authorization;
- database RLS tests;
- production-safe authenticated lifecycle smoke tests using dedicated E2E accounts.

Exit gate:

- Typecheck, lint, unit/contract tests, Playwright and production build pass.
- Production mutation tests remain guarded by explicit opt-in and approved E2E addresses.

## Implementation order

1. Lock registration metadata contracts with tests.
2. Add individual-driver onboarding domain and migration.
3. Verify and harden approval/provisioning.
4. Canonicalise membership-role resolution by least privilege.
5. Inventory protected routes and convert to fail-closed.
6. Audit API/server actions.
7. Audit and test RLS.
8. Run existing-account read-only verification.
9. Apply minimal account repairs where proven.
10. Execute the full role lifecycle matrix in production using dedicated accounts.

## Merge gate

PR #289 must not be merged while any required row in the lifecycle matrix is `FAIL`, `BLOCKED` or `NOT RUN`.

Required evidence before merge:

- exact changed files and commits for every confirmed defect;
- regression test proving each defect;
- successful CI and production build;
- database migration validation in a disposable/local environment before production;
- production read-only account consistency output;
- authenticated production evidence for every supported role and owner-operator variant;
- no unresolved privilege-escalation or cross-company access finding.
