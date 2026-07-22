# Super Admin Workspace refinement

## Scope

Repository: `LoadifyMarketLTD/xdrivelogistics.co.uk`

Branch: `feature/unified-dashboard-settings-design-system`

PR: `#270`

This phase refined Super Admin only. The existing visual identity, navigation groups, workspace shell and page layout were preserved. No schema, migration, RLS, lifecycle or production change was made.

## Audited routes

The complete `app/super-admin/**` and `app/api/super-admin/**` surfaces were audited, including dashboard, analytics, health, notifications, companies, onboarding, users, drivers, marketplace, jobs, allocations, POD, finance, compliance, disputes, support, settings, feature flags and audit logs.

Routes changed in this phase:

- `/super-admin`
- `/api/super-admin/stats`
- `/api/super-admin/platform?section=analytics`
- `/api/super-admin/platform?section=notifications`
- `/api/super-admin/companies`

The navigation structure and `SuperAdminWorkspaceShell` were not redesigned.

## Modified files

- `app/super-admin/page.tsx`
- `app/api/super-admin/stats/route.ts`
- `app/api/super-admin/platform/route.ts`
- `app/api/super-admin/companies/route.ts`

## New files

- `app/api/_lib/platformAuth.ts`
- `e2e/super-admin-platform.spec.ts`
- `docs/audit/super-admin-workspace-refinement.md`

## Authorisation model

`requirePlatformOwner(request)` is the canonical server-side platform access helper for the refined endpoints.

It:

1. requires configured server-side Supabase access;
2. extracts a bearer token from the request;
3. validates the authenticated user through `auth.getUser(token)`;
4. reads `profiles.role` for the authenticated user ID;
5. requires the persisted application role `owner`;
6. never accepts a client-provided role or company ID;
7. distinguishes missing credentials, invalid sessions, forbidden access and unavailable server configuration.

The persisted application role `owner` maps to the frontend workspace role `platform_owner`. Company membership ownership does not satisfy this server helper.

Frontend access remains protected by `ProtectedRoute` and the central `/super-admin` route capability boundary. Server-side access remains authoritative.

## KPI definitions

### Companies

- Total companies: persisted company rows.
- Active companies: `companies.status = active`.
- Pending approval: `pending` or `pending_approval`.
- Suspended companies: `companies.status = suspended`.

Internal/test company exclusion cannot be completed until a repository-backed company exclusion relationship is verified.

### Drivers

Driver totals exclude users marked `profiles.is_internal_account = true` when that column is available. Drivers without a user ID remain included because the repository does not provide a safe identity relationship for exclusion.

### Marketplace jobs

Effective status uses the shared classifier:

`current_status ?? status`

Marketplace group:

- draft
- posted
- quoted
- awarded

### Operational jobs

Operational group:

- allocated
- accepted
- on-my-way variants
- pickup-site variants
- loaded/collected
- in transit
- delivery-site variants

Active execution uses the existing shared lifecycle classifier and excludes awarded and allocated.

### Delivered jobs

Delivered milestone successors:

- delivered
- completed
- invoiced
- paid

### Invoices

The shared invoice classifier reconciles `status`, `payment_status` and `due_date`.

Non-payable states are excluded from unpaid counts:

- void
- cancelled/canceled
- credited
- credit note
- deleted

Overdue means payable, unpaid and past the persisted due date.

### Notification failures

Counted from persisted `notification_events.status = failed`.

### Disputes

Open disputes are counted from `job_disputes` when available using persisted open/review/escalation states. If the source is unavailable, the stats response declares `job_disputes` as degraded rather than fabricating a zero-confidence platform state.

## Dashboard refinement

The existing Owner Console layout and visual design were retained.

The dashboard now separates:

- marketplace jobs;
- active operational execution;
- pending companies;
- external driver count where supported;
- overdue invoices;
- notification failures;
- open disputes.

The existing module cards, panels, tables, buttons and navigation destinations were reused.

No completed company, fleet, driver, broker, customer or settings component was rebuilt.

## Notifications

The notification endpoint returns only a safe projection:

- event ID;
- recipient user ID;
- event type;
- safe title;
- safe human-readable message;
- delivery status;
- processed state;
- persisted creation timestamp.

Raw payloads, private storage paths and bid amounts are not returned.

Notification states distinguish:

- pending
- sent
- delivered
- failed
- skipped

A query failure returns HTTP 503 with an explicit degraded state. The dashboard renders a recoverable error banner rather than a false empty activity table.

## Governance rules

The existing company approval, suspension and governance history routes remain the supported controls.

The refined companies register uses canonical server authorisation. Governance history continues to read `owner_audit_log` defensively and reports history availability separately from company data.

No unsupported controls were added for:

- company suspension without an existing endpoint;
- platform finance mutation;
- feature flag mutation;
- compliance mutation;
- dispute resolution;
- onboarding approval.

Those controls remain in their existing repository-backed modules.

## Health boundaries

The dashboard does not fabricate uptime, webhook, queue or provider health values. It provides navigation to existing verified health and notification modules. Notification failures are the only health-like KPI added because they are persisted.

## Permission boundaries

The refined server endpoints:

- do not trust frontend role checks;
- do not trust client company IDs;
- require an authenticated platform owner;
- use platform-scoped service queries only after authorisation;
- do not use company-scoped workspace hooks;
- do not expose private storage paths;
- do not return raw notification payloads.

Company admins, company owners, staff, brokers, customers and drivers cannot satisfy `requirePlatformOwner` unless their persisted application profile role is explicitly `owner`.

## Reused components and modules

- `ProtectedRoute`
- `SuperAdminWorkspaceShell`
- existing Super Admin navigation groups
- `PageFrame`
- `PageHeader`
- `ActionButton`
- `AlertBanner`
- `KpiGrid`
- `KpiCard`
- `Panel`
- `TwoColumn`
- `DataTable`
- `StatusBadge`
- `EmptyState`
- shared `workspaceTheme`
- shared lifecycle classifier
- shared invoice classifier
- existing companies, onboarding, compliance, finance, disputes, audit and health modules

## Tests

`e2e/super-admin-platform.spec.ts` validates:

- effective status precedence;
- awarded/allocated exclusion from active execution;
- invoice status and payment reconciliation;
- canonical authorisation usage by refined APIs;
- safe notification projection;
- absence of bid amounts and raw payload exposure.

Existing public smoke, role, route, workspace and mobile tests remain unchanged.

## Accessibility and responsive behaviour

No layout redesign was made. The existing responsive grid, table overflow, button semantics, status text and workspace shell behaviour were retained. New dashboard values use existing accessible KPI and table components.

## Known limitations requiring live validation

- deployed RLS parity with repository migrations;
- whether all production profiles have `is_internal_account`;
- authoritative internal/test company exclusion mapping;
- production `job_disputes` status values;
- provider-level notification delivery semantics;
- health provider and webhook logs;
- immutable audit-log policy in deployed Supabase;
- signed storage URL behaviour;
- Netlify environment and production API logs.

## Explicit exclusions

This phase did not modify:

- Enterprise Settings;
- Broker Workspace;
- Fleet Workspace;
- Owner Driver Workspace;
- Fleet Driver Workspace;
- Admin Workspace;
- schema;
- migrations;
- RLS;
- lifecycle APIs;
- production deployment.
