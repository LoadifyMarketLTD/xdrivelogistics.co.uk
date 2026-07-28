# Workspace Foundation — Architecture Map

## Purpose

This document maps every required multi-role concept to the existing entity or file it
reuses, identifies gaps, and records whether each gap requires a migration or is deferred.

---

## Workspace separation

| Required concept | Existing entity / file | Reused as-is | Gap | Migration needed |
|---|---|---|---|---|
| `BusinessWorkspace` type | `lib/businessWorkspace.ts` (new) | — | None | No |
| `MembershipRole` type | `lib/membershipRole.ts` (new) | maps DB `company_role` ENUM | `finance`, `compliance`, `driver` not in DB enum | Later migration |
| Workspace registry | `lib/workspaceRegistry.ts` (new) | — | None | No |
| Active-company context | `lib/activeWorkspace.ts` (new) | reads `companies` + `company_memberships` | None | No |
| Route-boundary helpers | `lib/workspaceBoundary.ts` (new) | complements `lib/roleCapabilities.ts` | None | No |

---

## Canonical entity mapping

| Required concept | Existing DB table | Notes |
|---|---|---|
| Organisation / company | `public.companies` | Free-text `company_type`; no ENUM constraint yet |
| Organisation member | `public.company_memberships` | `role_in_company` uses `company_role` ENUM |
| Membership role values | `public.company_role` ENUM | `owner`, `admin`, `dispatcher`, `member`, `viewer` |
| Membership status | `public.membership_status` ENUM | `invited`, `active`, `suspended` |
| Job lifecycle | `public.jobs` | `status` uses `job_status` ENUM (12 values) |
| Job status values | `public.job_status` ENUM | `draft`, `posted`, `quoted`, `awarded`, `allocated`, `collected`, `in_transit`, `delivered`, `invoiced`, `paid`, `cancelled`, `disputed` |
| Bids / quotes | `public.job_bids` | `status` CHECK: `submitted`, `accepted`, `rejected`, `withdrawn` |

Do **not** create `organisations` or `organisation_members` tables. Use `companies` and
`company_memberships` — they are already the authoritative source.

---

## Workspace → route mapping

| `BusinessWorkspace` | Route prefix | Existing route | Notes |
|---|---|---|---|
| `owner_operator` | `/driver` | ✅ existing | Owner-driver workspace |
| `shipper` | `/customer` | ✅ existing | Customer / shipper workspace |
| `broker` | `/broker` | ✅ existing | Freight broker workspace |
| `carrier_fleet` | `/admin` | ✅ existing | Carrier / fleet company workspace |

**The `/admin` prefix is the legacy carrier-fleet surface and must not be renamed to
`/customer` or repurposed as the shipper workspace.** The real shipper workspace lives at
`/customer`.

---

## MembershipRole → DB ENUM gap analysis

| `MembershipRole` value | In DB `company_role` ENUM | Action |
|---|---|---|
| `owner` | ✅ yes | reused as-is |
| `admin` | ✅ yes | reused as-is |
| `dispatcher` | ✅ yes | reused as-is |
| `member` | ✅ yes (added in migration 064) | reused as-is |
| `viewer` | ✅ yes | reused as-is |
| `finance` | ❌ not in DB | planned; requires `ALTER TYPE company_role ADD VALUE 'finance'` |
| `compliance` | ❌ not in DB | planned; requires `ALTER TYPE company_role ADD VALUE 'compliance'` |
| `driver` | ❌ not in DB | planned; driver members are currently managed via the separate `public.drivers` table |

Until a migration adds the missing values, `finance`, `compliance` and `driver` must not
be persisted in `company_memberships.role_in_company`.

---

## company.company_type gap

`public.companies.company_type` is a free-text column (not an ENUM) in the current
schema. `lib/activeWorkspace.ts::resolveWorkspaceForCompany` normalises known values:

| `company_type` value | Resolves to |
|---|---|
| `customer`, `shipper` | `shipper` |
| `broker` | `broker` |
| `standard`, `carrier`, `fleet`, _(empty)_ | `carrier_fleet` |

**Gap**: a future migration should constrain `company_type` to a proper ENUM or a CHECK
constraint to prevent free-text drift. No migration is created in this PR.

---

## Existing UI/navigation boundaries

| UI concept | File | Notes |
|---|---|---|
| `WorkspaceRole` (UI resolver) | `lib/workspaceRole.ts` | coarse-grained role for nav/shell; not the same as `MembershipRole` |
| `WorkspaceCapability` | `lib/workspaceRole.ts` | capability strings shared with `lib/roleCapabilities.ts` |
| Route access guard | `lib/roleCapabilities.ts` | `isCapabilityAllowedForPath` — drives middleware |
| Nav shell | `app/admin/AdminPlatformShell.tsx` | unchanged in this PR |

**CarrierDashboard** (`app/components/workspace/RoleDashboards.tsx`) remains the
carrier/company dashboard label for `/admin`. The shipper-facing label "Customer
Dashboard" belongs to `/customer` (`app/customer/page.tsx`).

---

## Explicitly out of scope for this PR

- Renaming CarrierDashboard to CustomerDashboard.
- Rebuilding Marketplace, Commercial, Jobs, Operations Centre or any dashboard UI.
- Redirecting My Quotes / Won Work to a new implementation.
- Supabase migrations or RLS changes.
- Production changes, merge or deploy.
