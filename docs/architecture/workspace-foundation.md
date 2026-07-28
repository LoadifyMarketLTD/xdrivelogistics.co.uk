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
| Workspace registry | `lib/workspaceRegistry.ts` + `lib/protectedRouteRequirements.ts` | ✅ | None | No |
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
2. Enabled workspaces come from explicit workspace set when provided.
3. `activeWorkspace` is independently selected and must be within enabled workspaces.
4. Route workspace boundary must match selected workspace.
5. Unknown, null, empty, malformed company type fails closed when no explicit enabled set exists.

Typed fail-closed reasons include:

- `unsupported_company_type`
- `workspace_not_enabled`
- `active_workspace_required`
- `workspace_mismatch`

Recognized legacy company types mapping to `carrier_fleet` is restricted to:

- `standard`
- `carrier`
- `fleet`

There is no fallback default for null/empty/unknown types.

---

## Protected-route authorization contract

`lib/protectedRouteRequirements.ts` defines the canonical protected-route registry.

`lib/workspacePermissionResolver.ts` is fail-closed and returns typed allow/deny:

- denies unknown protected routes with `unmapped_route`
- denies cross-workspace access with `route_workspace_mismatch`
- denies disabled/not-permitted workspace selection
- denies URL manipulation/path traversal with `malformed_route`

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
