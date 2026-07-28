# Phase 2 — Shared UI Control Contract

## Base

This phase starts from the verified Foundation merge commit:

`984f0dc1a38097d73462cf3127f6909d528fe614`

## Objective

Build the shared authenticated application shell and authoritative context-switching UI without implementing role-specific dashboards or changing business workflows.

## Allowed scope

- Shared shell for the existing stable route families: `/driver`, `/customer`, `/broker`, `/admin`, `/admin/fleet`, `/super-admin`.
- Organisation / Company switcher backed only by active server-authoritative `company_memberships` and canonical `companies` records.
- Workspace switcher backed only by the merged Foundation workspace registry, enabled workspaces, membership identity and capability resolution.
- Role/persona display that cannot grant permissions client-side.
- Shared sidebar and top-navigation contracts.
- Global-search UI skeleton and adapter contract only; no invented backend or data source.
- Notifications and messages entry points that link only to existing routes.
- Responsive and accessibility behaviour for the shared shell.
- Tests for cross-company isolation, stale-context clearing, failed switching and route preservation.

## Mandatory security invariants

- No client-only company or workspace switching.
- No arbitrary first-membership, first-company or first-driver selection.
- Every accepted switch re-resolves `companyId`, `membershipId`, `membershipRole`, `driverId`, `workspaceRole`, capabilities and Driver commercial facts from authoritative server data.
- Switching company or workspace clears stale Driver, commercial, finance and admin facts before resolving the next context.
- Driver and Owner Driver share `/driver` rights when valid same-company Driver evidence exists; neither identity receives `/admin` merely from Driver access.
- Company Owner is not automatically a Shipper.
- Company Admin is not automatically a Fleet Operator.
- MembershipRole is not BusinessWorkspace.
- Route prefix is not permission.
- Unknown, inactive, unsupported or cross-company context fails closed.

## Explicitly out of scope

- Owner Operator dashboard implementation.
- Customer / Shipper dashboard implementation.
- Broker dashboard implementation.
- Fleet dashboard implementation.
- Action Centre and role-specific overview widgets.
- Marketplace, jobs, quoting, dispatch, POD, finance or invoice workflow changes.
- Route migration, route renaming or duplicate dashboard creation.
- Supabase migrations, RLS changes, production data changes or deployment.
- Ready-for-review transition or merge before independent audit and explicit authorisation.

## Required workflow

1. Produce a read-only inventory and duplication/conflict report before implementation.
2. Reuse Foundation contracts and permission resolvers; do not copy or fork them into UI components.
3. If repository evidence conflicts with this contract, return a `CONFLICT REPORT` and stop.
4. Keep the PR Draft throughout implementation.
5. Validate with `npm ci`, `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run build`, Public E2E and CodeQL.
