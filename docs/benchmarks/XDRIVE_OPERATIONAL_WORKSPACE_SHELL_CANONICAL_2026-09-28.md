# XDrive Operational Workspace Shell - Canonical Contract

Date: 2026-09-28
Scope: operational workspaces only. Super Admin is explicitly excluded and must not be changed by this contract.

## Canonical shell
All operational roles use one two-row shell: a top header for brand/context/actions and a compact horizontal primary navigation row below it.

Roles covered: Customer, Broker, Company Owner/Admin/Carrier Admin, Fleet Manager, Dispatcher, Owner Driver, Employed Driver, Finance and Compliance.

## Mandatory rules
- Settings is directly visible in the primary navbar for every operational role.
- Driver and Owner Driver use the same canonical CSS scope as the other operational workspaces.
- Dashboard cards must not duplicate navigation merely to expose routes already present in the navbar.
- Contextual dashboard actions are allowed only when they act on current data or a current workflow item.
- Primary order follows operational flow: Dashboard, work/marketplace, quotes/jobs, diary/tracking/resources/finance, Settings, More.
- More contains secondary or low-frequency destinations.
- Do not create page-specific navbars when TopWorkspaceShell can represent the role.
- Super Admin remains on its existing separate shell.

## Identity and onboarding
- Workspace selection comes from resolved role, active membership and onboarding state.
- dannyelbill@gmail.com is a Broker account in Production data.
- invited, draft, in_progress and request_changes onboarding states resume onboarding instead of showing a generic pending-approval dead end.
- submitted, under_review, compliance_review and admin_approval remain pending review and cannot enter a workspace.
- Never mutate Production roles/statuses only to make an E2E test pass.

## Visual acceptance
- Navbar remains horizontal on desktop.
- Logo/header/navbar stay aligned.
- Driver/Owner Driver must never fall back to an unstyled vertical list.
- Active state uses the XDrive navy/orange visual language.
- No duplicate quick-action strip below the navbar.

## Gate
- role contract tests pass;
- TypeScript and ESLint/build pass;
- Deploy Preview is READY;
- available authenticated operational roles are visually inspected on the integrated preview.
