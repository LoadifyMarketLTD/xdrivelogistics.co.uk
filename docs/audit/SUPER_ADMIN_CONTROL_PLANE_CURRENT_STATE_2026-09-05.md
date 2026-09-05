# Super Admin / Platform Owner Control Plane — Current State

Date: 2026-09-05
Workstream: PR #505 (`fix/super-admin-control-plane-completeness-20260905`)
Base: PR #504 (`fix/super-admin-home-e2e-20260905`)
Status: DRAFT / NOT MERGED

## Operating rule

`/super-admin` is the Platform Owner control plane. It must not grant Platform Owner implicit access to tenant-only workspaces such as `/broker`, `/customer`, `/driver`, or company `/admin` surfaces merely for inspection. Cross-platform oversight belongs inside `/super-admin` and uses owner-authorized APIs plus entity Inspector links.

All remediated `/api/super-admin/*` routes use the canonical `verifyPlatformOwner` boundary. The boundary requires an authenticated profile whose normalized role is `owner` and whose normalized status is `active`. Deploy Preview is read-only for Super Admin: non-GET/HEAD/OPTIONS requests fail closed before mutation.

## Current owner surfaces

### Dashboard / diagnostics
- Command Centre (`/super-admin`)
- Global Search (`/super-admin/search`)
- Platform Analytics (`/super-admin/analytics`)
- Platform Health (`/super-admin/health`)
- Notifications (`/super-admin/notifications`), including governed retry where the Production governance RPC is available
- Platform Case Centre / Action Centre where its schema is available

Command Centre uses exact database counts for its global indicators. A core count that cannot be determined is an error, not zero. Missing optional domains are surfaced as unavailable/unknown and cause the affected incident/action-queue totals to be unknown rather than falsely healthy.

### Marketplace / operations
- Marketplace
- Quotes
- Allocations
- Disputes
- Jobs: all / active / pending / completed
- Deliveries
- POD queue
- Driver availability
- Fleet positions

Marketplace list/pagination and summary totals are global rather than limited to a hidden first-page cap. Governed per-job intervention remains behind active-owner authorization and the Deploy Preview write lock.

### Fleet
- Global Drivers
- Vehicle Registry (`/super-admin/fleet/vehicles`)
- Return Journeys (`/super-admin/fleet/return-journeys`)

The tenant Fleet `Maintenance` page is not represented as a separate global maintenance system because the current product does not persist a canonical maintenance-health domain. The tenant page derives document signals from vehicles/documents; Super Admin must not fabricate service/maintenance state.

### Companies / authority
- All Companies governance
- Broker Oversight (`/super-admin/companies/brokers`) without broker-workspace impersonation
- Membership & Access (`/super-admin/companies/memberships`)
- Pending Approval
- Active Companies
- Suspended Companies
- Verification
- Company Compliance
- Onboarding approval-readiness oversight

Company membership authority and application/profile role are displayed separately to avoid conflating tenant authority with platform/application authority.

Company approve/reject/suspend/reinstate uses the canonical active-owner guard, is blocked in Deploy Preview and retains the audited governance RPC. A successful API response also requires reconciliation data from the governance mutation.

Onboarding and approval-readiness are globally paginated/exact-counted; they do not present an arbitrary first 200/250 applications as platform-wide truth. Compliance-check failure remains an explicit approval blocker.

### Finance / membership billing
- Finance Overview
- Invoices
- Payments
- Revenue
- Financial Breakdown
- Membership Subscriptions (`/super-admin/finance/subscriptions`)
- Stripe Webhook Operations (`/super-admin/finance/stripe-webhooks`)

Finance ledgers use server-side pagination and exact totals. Revenue reporting traverses the complete source ledgers rather than a fixed first 500/2000 rows. A single monetary aggregate is refused when invoice currencies or settlement currencies conflict; no implicit GBP conversion is performed.

Stripe webhook UI deliberately omits secret payloads and connected-account identifiers. Membership subscription UI exposes only whether Stripe customer/subscription linkage is configured, not raw identifiers.

### Compliance / support
- Identity & Fraud Review
- Insurance
- Operator Licences
- Expiry Tracking
- Document Review
- Support Tickets
- Complaints
- Support Disputes

Compliance document type filtering is case-insensitive to preserve historical aliases. Identity/company/vehicle lookups fail closed. Document review requires audit-ledger durability; if audit persistence fails after document mutation, a compensating rollback is attempted and rollback failure is surfaced explicitly.

Support and notification summaries no longer treat a capped page as platform-wide total. Query failure is not converted into a zero-ticket/zero-notification healthy state.

### Platform governance
- Global Settings
- Legal & Agreements (`/super-admin/settings/legal-agreements`)
- Access Matrix (`/super-admin/settings/roles-permissions`)
- Feature Flags
- Audit Logs
- All Users
- Platform Administrators

`Access Matrix` is intentionally read-only. It documents canonical roles, workspace boundaries and capability groups; it does not claim to assign/revoke role authority. The legacy `section=roles` mutation path is explicitly gated and cannot mutate role permissions.

`Platform Administrators` is backed by the authoritative owner-profile registry plus Supabase Auth identity lookup. Promotion/demotion/session revocation is intentionally not implemented in this workstream.

## Fail-closed data truth

The following rules are mandatory across Super Admin:

1. A failed refresh clears stale rows/summaries before rendering the error.
2. A successful HTTP response with a missing/invalid required data contract is an error, not an empty state.
3. Shared table requests have a bounded timeout.
4. Analytics and Finance global summaries must not be computed from an arbitrary first 500/2000 rows.
5. Company, onboarding, marketplace and registry KPI totals must use exact global counts, not the currently visible page.
6. Multi-currency amounts must not be silently summed into a single GBP total.
7. `void` invoice lifecycle state is represented canonically as `Cancelled`, not `Draft`.
8. Platform Health must clear stale health state on failure and includes membership billing + Stripe webhook processing signals.
9. Exact-count `null` is unknown/failure, never zero.
10. A missing optional source may be reported as unavailable, but any aggregate that depends on it must become unknown/partial rather than falsely complete.
11. Deploy Preview must not mutate Super Admin state.

## Persisted Production domains surfaced by this workstream

Read-only Super Admin visibility exists for persisted domains already present in the hosted database:
- `vehicles`
- `return_journeys`
- `company_memberships`
- `platform_membership_subscriptions`
- `stripe_webhook_events`
- `registration_legal_acceptances`

No migration is introduced merely to create UI for these existing domains. This workstream does not mutate Production data.

## Inspector / search strategy

Global Search and Inspector remain canonical for entities already modeled as inspectable objects, including company, user, driver, vehicle, job, invoice, POD, ticket, dispute and platform case.

New governance ledgers link to these canonical entities instead of inventing duplicate inspector entity types when the ledger row itself is already fully represented on its page. Examples:
- Vehicle Registry → vehicle/company/driver Inspector
- Membership & Access → user/company Inspector
- Subscriptions → user/company Inspector
- Legal & Agreements → user/company Inspector
- Broker Oversight → company Inspector

Return Journey and Stripe webhook rows are currently ledger records rather than standalone Inspector entities.

## Intentionally gated mutations

The following are **not** authorized by this workstream and must not be added casually:
- promote/demote Platform Owner / Platform Admin
- revoke auth sessions globally
- arbitrary cross-tenant role mutation
- accept legal agreements on behalf of a user
- mutate Stripe billing state from the read-only oversight pages
- replay Stripe webhooks from the UI without a dedicated audited/idempotent backend contract

Before role/session mutations are introduced, the design must include at minimum:
- active Platform Owner verification
- last-owner protection
- recent re-authentication / step-up boundary
- explicit reason
- immutable audit record
- before/after authority state
- Deploy Preview read-only behavior
- transactional failure handling

## Regression / Netlify gate

PR #505 has a dedicated Netlify release-gate branch:
- lint across the Super Admin control-plane delta;
- `__tests__/superAdminControlPlaneCompleteness.test.ts`;
- `__tests__/invoiceStatusCanonical.test.ts`;
- existing `__tests__/superAdminStatsContract.test.ts`;
- existing `__tests__/commandCentreMetrics.test.ts`;
- full TypeScript typecheck;
- production Next.js build.

The control-plane regression contract protects, among other invariants:
- canonical active-owner guard use on every remediated API route;
- no reintroduction of local bearer-token owner guards in those routes;
- Deploy Preview write locking;
- Command Centre exact-count/source-coverage fail-closed behavior;
- onboarding pagination/no hidden 250 cap;
- audited/reconciled company governance;
- role mutation gate;
- Finance pagination and multi-currency refusal.

## Current external validation state

PR #505 intentionally remains stacked on PR #504. PR #504 remains DRAFT / NOT MERGED and is based on `main`.

Canonical Netlify project: `xdrivelogistics` (`ebb86624-9d7e-4e02-afcf-31ff6980d726`). The similarly named `xdrive-logistics` project and `silly-faloodeh-cea857` are non-canonical for this gate.

Multiple #505 HEAD snapshots were checked and no `netlify/xdrivelogistics/deploy-preview` commit status was emitted, while PR #504 does have the canonical successful preview status. Repository `netlify.toml` and `netlify-ignore-foreign-site.mjs` do not intentionally skip the canonical site. Therefore the exact-head #505 preview gate is **NOT PASSED** and currently blocked by preview creation/status for the stacked PR; absence of a status is not treated as success.

Do not retarget #505 to `main`, create a second validation PR, or manually trigger a potentially production-context deploy merely to manufacture a green gate without an explicit decision to change the validation topology.

## Final validation gate

PR #505 remains DRAFT / NOT MERGED until:
- exact-head Netlify Deploy Preview builds successfully on canonical `xdrivelogistics`;
- the dedicated #505 Netlify lint/unit-test gate passes;
- typecheck and production build pass in that same exact-head preview;
- preview secret scan / deploy validation is acceptable;
- final authenticated Platform Owner browser E2E verifies navigation, data contracts, error states, read-only preview behavior and drill-downs once, after structural work is complete.

GitHub Actions are not part of this validation gate.
