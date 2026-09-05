# Super Admin / Platform Owner Control Plane — Current State

Date: 2026-09-05
Workstream: PR #505 (`fix/super-admin-control-plane-completeness-20260905`)
Base: PR #504 (`fix/super-admin-home-e2e-20260905`)

## Operating rule

`/super-admin` is the Platform Owner control plane. It must not grant Platform Owner implicit access to tenant-only workspaces such as `/broker`, `/customer`, `/driver`, or company `/admin` surfaces merely for inspection. Cross-platform oversight belongs inside `/super-admin` and uses owner-authorized APIs plus entity Inspector links.

## Current owner surfaces

### Dashboard / diagnostics
- Command Centre (`/super-admin`)
- Global Search (`/super-admin/search`)
- Platform Analytics (`/super-admin/analytics`)
- Platform Health (`/super-admin/health`)
- Notifications (`/super-admin/notifications`), including governed retry where the Production governance RPC is available
- Platform Case Centre / Action Centre where its schema is available

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

Company membership authority and application/profile role are displayed separately to avoid conflating tenant authority with platform/application authority.

### Finance / membership billing
- Finance Overview
- Invoices
- Payments
- Revenue
- Financial Breakdown
- Membership Subscriptions (`/super-admin/finance/subscriptions`)
- Stripe Webhook Operations (`/super-admin/finance/stripe-webhooks`)

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

### Platform governance
- Global Settings
- Legal & Agreements (`/super-admin/settings/legal-agreements`)
- Access Matrix (`/super-admin/settings/roles-permissions`)
- Feature Flags
- Audit Logs
- All Users
- Platform Administrators

`Access Matrix` is intentionally read-only. It documents canonical roles, workspace boundaries and capability groups; it does not claim to assign/revoke role authority.

`Platform Administrators` is backed by the authoritative owner-profile registry plus Supabase Auth identity lookup. Promotion/demotion/session revocation is intentionally not implemented in this workstream.

## Fail-closed data truth

The following rules are mandatory across Super Admin:

1. A failed refresh clears stale rows/summaries before rendering the error.
2. A successful HTTP response with a missing/invalid required data contract is an error, not an empty state.
3. Shared table requests have a bounded timeout.
4. Analytics and Finance global summaries must not be computed from an arbitrary first 500/2000 rows.
5. Company KPI totals must use exact global counts, not the currently visible page.
6. Multi-currency amounts must not be silently summed into a single GBP total.
7. `void` invoice lifecycle state is represented canonically as `Cancelled`, not `Draft`.
8. Platform Health must clear stale health state on failure and includes membership billing + Stripe webhook processing signals.

## Persisted Production domains surfaced by this workstream

Read-only Super Admin visibility exists for persisted domains already present in the hosted database:
- `vehicles`
- `return_journeys`
- `company_memberships`
- `platform_membership_subscriptions`
- `stripe_webhook_events`
- `registration_legal_acceptances`

No migration is introduced merely to create UI for these existing domains.

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

## Validation gate

PR #505 remains DRAFT / NOT MERGED until:
- exact-head Netlify Deploy Preview builds successfully on canonical `xdrivelogistics`;
- no route introduced by this workstream is missing;
- preview secret scan / deploy validation is acceptable;
- final authenticated Platform Owner browser E2E verifies navigation, data contracts, error states and drill-downs once, after structural work is complete.

GitHub Actions are not part of this validation gate.
