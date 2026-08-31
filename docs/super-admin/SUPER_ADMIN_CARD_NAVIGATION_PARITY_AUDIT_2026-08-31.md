# XDrive Super Admin — Card Navigation Parity Audit

Date: 2026-08-31  
Scope: visual preview branch `preview/super-admin-visual-rebuild-20260831` / PR #431  
Status: VISUAL PREVIEW ONLY — DO NOT MERGE

## Objective

Replace the long Super Admin sidebar with a card-first control centre **without losing any real Super Admin function**.

The homepage must not maintain a second hand-written navigation inventory. Card quick links now derive from `SUPER_ADMIN_WORKSPACE_DEFINITION`, which is the same canonical navigation definition used by the Super Admin shell.

## Canonical domains and routes

### Command Centre
- Overview → `/super-admin`
- Platform Analytics → `/super-admin/analytics`
- Platform Health → `/super-admin/health`

Global Search, Action Centre and Notifications remain first-class top-command-bar controls instead of being duplicated as primary homepage navigation.

### XDrive Logistics
- XDrive Overview → `/super-admin/xdrive-logistics`
- XDrive Jobs → `/super-admin/xdrive-logistics/jobs`
- XDrive Marketplace → `/super-admin/xdrive-logistics/marketplace`
- Broker Workspace → `/broker`

### Marketplace
- Marketplace Overview → `/super-admin/marketplace`
- Quotes → `/super-admin/operations/quotes`
- Allocations → `/super-admin/operations/allocations`
- Marketplace Disputes → `/super-admin/operations/disputes`

### Operations
- All Jobs → `/super-admin/operations/jobs`
- Active Jobs → `/super-admin/operations/active-jobs`
- Pending Jobs → `/super-admin/operations/pending-jobs`
- Completed Jobs → `/super-admin/operations/completed-jobs`
- Deliveries → `/super-admin/operations/deliveries`
- POD Queue → `/super-admin/operations/pods`

### Drivers & Fleet
- Drivers → `/super-admin/users/drivers`
- Driver Availability → `/super-admin/operations/driver-availability`
- Fleet Positions → `/super-admin/operations/fleet-positions`

Audit finding: the current Super Admin route tree does **not** provide dedicated Owner Drivers or Vehicles list pages. The card description must therefore not promise dedicated controls that do not exist. Individual driver and vehicle entities remain inspectable through the canonical Entity Inspector / Global Search flows.

### Companies
- All Companies → `/super-admin/companies`
- Pending Approval → `/super-admin/companies/approvals`
- Active Companies → `/super-admin/companies/active`
- Suspended Companies → `/super-admin/companies/suspended`
- Onboarding & Verification → `/super-admin/companies/verification`
- Company Compliance → `/super-admin/companies/compliance`

Visual-only `Request completion` is shown in the Companies domain. Canonical mutation logic is intentionally not connected on PR #431.

### Users & Access
- All Users → `/super-admin/users`
- Company Owners → `/super-admin/users/company-owners`
- Customers → `/super-admin/users/customers`
- Dispatchers → `/super-admin/users/dispatchers`
- Drivers → `/super-admin/users/drivers`
- Platform Admins → `/super-admin/users/platform-admins`

### Finance
- Finance Overview → `/super-admin/finance`
- Invoices → `/super-admin/finance/invoices`
- Financial Breakdown → `/super-admin/finance/fees`
- Revenue → `/super-admin/finance/revenue`
- Payments → `/super-admin/finance/payments`

### Compliance
- Document Review → `/super-admin/compliance/documents`
- Insurance → `/super-admin/compliance/insurance`
- Operator Licences → `/super-admin/compliance/operator-licences`
- Expiry Tracking → `/super-admin/compliance/expiries`
- Identity & Fraud Review → `/super-admin/compliance/fraud-cases`

### Support & Cases
- Action Centre → `/super-admin/action-centre`
- Case Centre → `/super-admin/cases`
- Support Tickets → `/super-admin/support/tickets`
- Complaints → `/super-admin/support/complaints`
- Support Disputes → `/super-admin/support/disputes`

### Platform & Security
- Global Settings → `/super-admin/settings/global`
- Roles & Permissions → `/super-admin/settings/roles-permissions`
- Feature Flags → `/super-admin/settings/feature-flags`
- Audit Logs → `/super-admin/settings/audit-logs`
- Notifications → `/super-admin/notifications`

## Inspector presentation rule

Entity Inspector must preserve authoritative data while reducing vertical noise:
- identity and primary status remain immediately visible;
- empty relationship groups must not dominate the page;
- related users/drivers/vehicles/jobs/invoices should be compact summaries / expandable sections;
- Platform exception controls, active cases and audit remain discoverable;
- Company onboarding/document remediation is exposed contextually rather than hidden in a global menu.

## Parity rule

A card description must never promise a function unless a real route or canonical contextual action exists for it.

A canonical Super Admin route added to `SUPER_ADMIN_WORKSPACE_DEFINITION` must automatically appear in the corresponding homepage card. This prevents the previous sidebar-to-card drift where routes such as Expiry Tracking, Support Disputes, Customers, Drivers, Pending/Completed Jobs, Active/Suspended Companies and Notifications were omitted from the homepage shortcut set.

## Safety

PR #431 remains Draft / NOT MERGED. No Production migrations, Production writes, or security-boundary changes are part of this visual parity work.
