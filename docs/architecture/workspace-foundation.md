# Workspace Foundation — Architecture Map

## Purpose

This document maps required multi-role concepts to the current foundation contracts and records explicit deferred gaps.

---

## Workspace separation

| Required concept | Existing entity / file | Reused as-is | Gap | Migration needed |
|---|---|---|---|---|
| `BusinessWorkspace` type | `lib/businessWorkspace.ts` | ✅ | None | No |
| App-domain `MembershipRole` | `lib/membershipRole.ts` | ✅ | `finance`, `compliance`, `driver` are app-domain only for now | Later migration |
| DB subset `PersistedCompanyRole` | `lib/membershipRole.ts` | ✅ | DB enum still excludes planned roles | Later migration |
| Workspace registry | `lib/workspaceRegistry.ts` + `lib/roleCapabilities.ts` | ✅ | None | No |
| Active-company context | `lib/activeWorkspace.ts` | ✅ | company_type still free-text | Later migration |
| Typed permission resolver | `lib/workspacePermissionResolver.ts` | ✅ | Server/RLS enforcement wiring deferred | Later approved phase |

---

## Canonical entity mapping

| Required concept | Existing DB table | Notes |
|---|---|---|
| Organisation / company | `public.companies` | `company_type` is free-text; `enabled_workspaces` contract is frontend/domain-only in this phase |
| Organisation member | `public.company_memberships` | `role_in_company` uses `company_role` ENUM subset |
| Membership role persisted values | `public.company_role` ENUM | `owner`, `admin`, `dispatcher`, `member`, `viewer` |
| Membership status | `public.membership_status` ENUM | `invited`, `active`, `suspended` |

Do **not** create `organisations` or `organisation_members` tables in this phase.

---

## Explicit workspace resolution contract

`resolveCompanyEnabledWorkspaces` and `resolveActiveCompanyContext` now enforce:

1. Company membership must be active.
2. Company status must be active; suspended, inactive, blocked (and any non-active value) are denied.
3. Enabled workspaces come from an explicit domain-supplied set (`enabledWorkspaces` option) when provided; otherwise derived from legacy `company_type` mapping.
4. `activeWorkspace` is independently selected and must be within the enabled workspace set.
5. Route workspace boundary must match the selected workspace.
6. Unknown, null, empty, or malformed company type fails closed when no explicit enabled set exists.
7. Multiple active memberships without `preferredCompanyId` returns `active_company_required` (not `no_active_membership`).

Typed fail-closed reasons include:

- `unsupported_company_type`
- `workspace_not_enabled`
- `active_workspace_required`
- `active_company_required`
- `workspace_mismatch`

Membership capability resolution remains workspace-intersected: a route is allowed only when both the active BusinessWorkspace and the active MembershipRole authorize the capability.

Recognized legacy company types mapping to `carrier_fleet` is restricted to:

- `standard`
- `carrier`
- `fleet`

There is no fallback default for null/empty/unknown types.

---

## Protected-route authorization contract

`lib/roleCapabilities.ts` is the single canonical protected-route registry. It exports `ROUTE_REQUIREMENTS`, `getProtectedRouteRequirement` (most-specific, exact-aware), `isProtectedRoute`, and `cleanPathname`.

`isCapabilityAllowedForPath()` (used by the production middleware via `isRoleAllowedForPath()`) now uses `getProtectedRouteRequirement()` internally, making it:

- fail-closed: protected routes without a matching requirement are denied;
- exact-aware: `/admin` exact-only entry does not match `/admin/unknown-page`;
- most-specific: the longest matching prefix wins.

`lib/workspacePermissionResolver.ts` is the typed allow/deny resolver for the new multi-workspace session layer:

- denies unknown protected routes with `unmapped_route`
- denies cross-workspace access with `route_workspace_mismatch`
- denies disabled/not-permitted workspace selection
- denies URL manipulation/path traversal with `malformed_route`

### Shared `/driver` surface contract

`/driver` is a shared driver surface used by both employed fleet drivers and owner-drivers.

- Route prefix alone does **not** prove Owner Operator status.
- `membershipRole = owner` is administrative and does **not** prove owner-driver commercial access.
- `enabledWorkspaces` including `owner_operator` does **not** by itself prove owner-driver commercial access.

Owner Operator-only commercial routes (`/driver/loads`, `/driver/quotes`, `/driver/won-work`, `/driver/finance`, `/driver/returns`) require trusted session/domain facts in addition to route and capability checks:

- `workspaceRole = owner_driver`
- `ownerDriverWorkspace = true`
- `ownerDriverExecutionMode = true`
- valid `driverId`
- active driver/account/company states
- `appAccess` not denied
- `canCommercialBid = true` for quote submission routes

Employed drivers retain `/driver` execution routes (jobs/history/documents/messages/profile/availability) only when their driver state and app access are valid.

---

## Schema gap: app-domain roles vs DB enum

App-domain `MembershipRole` includes:

- `owner | admin | dispatcher | finance | compliance | driver | member | viewer`

DB-persisted `PersistedCompanyRole` remains:

- `owner | admin | dispatcher | member | viewer`

`finance`, `compliance`, and `driver` identities are preserved in the frontend/domain contract and are **not** silently coerced to `viewer`.

A later approved DB migration is required before persisting those values in `company_memberships.role_in_company`.

---

## Deferred server enforcement phase (no migration in this PR)

The frontend/domain resolver contract must be mirrored later by:

1. API/middleware validation using the same route registry and typed deny reasons.
2. Server-side active company + active workspace resolution from authenticated membership rows.
3. Supabase RLS policies enforcing company scope, membership status, and workspace capability boundaries.
4. Optional schema hardening of `companies.company_type` and persisted workspace settings.

This PR does **not** add Supabase migrations, RLS changes, route migrations, deployment, or merge actions.
