# Admin Workspace Refinement

## Scope

This document records the dedicated company-scoped Admin Workspace implementation on branch `feature/unified-dashboard-settings-design-system` in PR #270. Super Admin implementation was not started.

## Audited routes

- `/admin`
- `/admin/marketplace`
- `/admin/quotes`
- `/admin/bids`
- `/admin/operations-centre`
- `/admin/diary`
- `/admin/jobs`
- `/admin/fleet`
- `/admin/fleet/assignments`
- `/admin/fleet/active-jobs`
- `/admin/fleet/positions`
- `/admin/fleet/maintenance`
- `/admin/drivers`
- `/admin/driver-availability`
- `/admin/vehicles`
- `/admin/documents`
- `/admin/documents/expiry`
- `/admin/incidents`
- `/admin/disputes`
- `/admin/invoices`
- `/admin/finance`
- `/admin/finance/payments`
- `/admin/finance/balances`
- `/admin/finance/reports`
- `/admin/dispatchers`
- `/admin/settings`

Only `/admin` was changed. Existing operational registers and flows remain authoritative.

## Role-resolution behaviour

The `/admin` entry point uses `resolveWorkspaceRole` and `resolveAdminDashboardKind`.

- `fleet_manager` → existing `FleetDashboard`
- `finance` → existing `FinanceDashboard`
- `compliance` → existing `ComplianceDashboard`
- `company_owner` → `AdminWorkspaceView`
- `company_admin` → `AdminWorkspaceView`
- `carrier_admin` → `AdminWorkspaceView`
- `dispatcher` → `AdminWorkspaceView`, with all content filtered by the central capability matrix
- `platform_owner` → `AdminWorkspaceView` only when verified company context exists; otherwise the company Admin view is not selected
- Broker, Customer, Driver and Owner Driver roles do not resolve to `AdminWorkspaceView`

## Reused components

From `WorkspaceUI`:

- `PageFrame`
- `PageHeader`
- `ActionButton`
- `KpiGrid`
- `KpiCard`
- `Panel`
- `TwoColumn`
- `DataTable`
- `StatusBadge`
- `AlertBanner`
- `EmptyState`
- `QuickActions`

Other reused modules:

- `ProtectedRoute`
- `useAuth`
- `useCompanyWorkspaceData`
- `resolveWorkspaceRole`
- `hasWorkspaceCapability`
- existing Fleet, Finance and Compliance dashboards
- existing allocation, job, tracking, document, invoice and settings routes

## New components and helpers

- `app/admin/AdminWorkspaceView.tsx`
- `lib/workspaceClassifiers.ts`
- `lib/adminWorkspaceRole.ts`

No parallel allocation, lifecycle, tracking, POD, document, incident, dispute, finance, notification or settings module was introduced.

## Shared classifiers

### Effective job status

`getEffectiveJobStatus(job)` normalises:

```text
current_status ?? status
```

Lifecycle groups are separated as follows:

- Awarded: `awarded`
- Allocated awaiting acceptance: `allocated`
- Active execution: `accepted` through delivery-site milestones
- Terminal: delivered, completed, invoiced, paid and cancelled
- Exception: failed, failed-delivery, exception and disputed variants verified in repository usage

Posted jobs are not counted as awarded. Awarded and allocated jobs are not counted as active execution.

### Invoice state

`getInvoiceState(invoice)` reconciles `status`, `payment_status` and `due_date`.

- paid if either persisted status marks the invoice paid
- non-payable if void, cancelled, credited or deleted
- unpaid only when payable and not paid
- overdue only when unpaid and the persisted due date has passed

### Recorded compliance state

`getRecordedComplianceState(document)` uses only persisted document rows.

A recorded document blocks readiness when:

- its expiry date has passed; or
- its status is expired, rejected, invalid, failed or suspended.

The implementation does not invent mandatory-document completeness rules and does not declare resources universally compliant when no document rows exist.

## KPI definitions and sources

| KPI | Source | Formula |
|---|---|---|
| Awarded and unallocated | `jobs` | effective status `awarded`, `awarded_carrier_company_id = active company`, no assigned driver |
| Allocated awaiting acceptance | `jobs` | effective status `allocated`, assigned driver exists |
| Active deliveries | `jobs` | effective status in active execution set |
| Delayed or exception | `jobs` | active execution past persisted delivery datetime, or persisted exception status |
| Drivers allocation-ready | `drivers`, `jobs`, `driver_documents` | active/approved/verified, available, no active assignment, no recorded blocking document |
| Drivers unavailable | `drivers` | company roster minus allocation-ready drivers |
| Vehicles allocation-ready | `vehicles`, `jobs`, `vehicle_documents` | no active driver commitment and no recorded blocking document |
| Recorded compliance issues | driver and vehicle document tables | expired or blocking persisted status |
| No delivery photos recorded | `jobs.delivery_photos` | delivered/completed effective state and no delivery photos |
| Unpaid invoices | `invoices` | payable and not paid |
| Overdue invoices | `invoices` | unpaid and persisted due date passed |

Incident and dispute KPI cards were not added because an authoritative company-scoped source was not integrated into the shared data path during this implementation. Their existing routes remain unchanged.

## Attention queue

The queue contains only records supported by persisted company-scoped data and filters every item by required capability before rendering.

### Critical

- overdue active delivery
- persisted failed or exception delivery
- expired, rejected or invalid recorded driver document
- expired, rejected or invalid recorded vehicle document

### High

- pickup imminent without allocation
- awarded and unallocated
- allocated awaiting acceptance
- stale tracking during active execution
- no tracking signal during active execution
- no delivery photos recorded
- overdue invoice

### Destination and capabilities

- allocation items → `/admin/fleet/assignments`, `jobs.allocate`
- active delivery items → `/admin/fleet/active-jobs`, `jobs.track`
- tracking items → `/admin/fleet/positions`, `fleet.positions.view`
- job exceptions/POD → `/admin/jobs`, `jobs.view` or `jobs.review_pod`
- document items → `/admin/documents`, `documents.company.manage`
- invoice items → `/admin/invoices`, `invoices.carrier.manage`

The dashboard never renders an action to a route whose required capability is absent.

## Notifications and recent activity

### Personal notifications

Source: `notification_events`

Filter:

```text
recipient_user_id = authenticated user id
```

Fields used:

- `id`
- `event_type`
- `status`
- `created_at`

Notification query failure is displayed as a partial-load warning, not as an empty state.

### Recent company activity

Persisted sources:

- `jobs.updated_at`
- `job_bids.created_at`
- `invoices.created_at`

Render time is never used as an activity timestamp.

## Company scoping

The implementation preserves `useCompanyWorkspaceData` scoping:

- jobs created by or awarded to the active company
- bids linked to the active company or its company jobs
- invoices where the active company is seller or buyer
- drivers by `company_id`
- vehicles by `company_id`
- documents restricted to resolved company driver and vehicle IDs
- locations by `company_id`

The supplemental company-name query uses the resolved company ID. Notification events are restricted to the authenticated recipient user ID.

## Permission boundaries

The Admin Workspace does not expose:

- platform companies
- global users
- platform health
- feature flags
- platform audit logs
- Super Admin finance
- unrelated company approval or suspension controls
- Customer-only award controls
- Broker-only commercial controls
- Super Admin actions

No schema, migration, RLS, API contract, RPC or lifecycle transition was changed.

## Loading, partial failure and empty states

- shared data loading uses the existing workspace hook state
- shared query failure produces the existing warning banner
- supplemental notification failure produces a separate partial-load warning
- true no-result conditions use explicit empty states
- no failed query is represented as a fake zero-value notification result

## Responsive and accessibility behaviour

- `KpiGrid` wraps responsively
- `TwoColumn` collapses through the shared workspace CSS behaviour
- `DataTable` retains safe horizontal overflow
- controls use native buttons
- status text accompanies colour
- action labels are explicit
- shared focus and keyboard behaviour is preserved

## Tests added

- `e2e/workspace-classifiers.spec.ts`
- `e2e/admin-workspace-role.spec.ts`

Coverage includes:

- `current_status` precedence
- awarded/allocated/active separation
- terminal and exception classification
- invoice payable/unpaid/overdue reconciliation
- recorded compliance blocking states
- specialised Fleet, Finance and Compliance routing
- company Admin role routing
- platform owner company-context requirement
- Broker, Customer, Driver and Owner Driver exclusion

## Known limitations requiring live verification

- deployed RLS policy parity with repository migrations
- mandatory document completeness rules
- authoritative POD completion beyond verified delivery-photo fields
- vehicle operational/maintenance blocking fields not present in the shared workspace projection
- authoritative company-scoped incident and dispute source contract
- notification delivery-provider semantics beyond persisted event status
- production storage signed-URL policy behaviour
- Netlify environment and production logs

## Super Admin boundary

Super Admin Workspace implementation was not started or modified.
