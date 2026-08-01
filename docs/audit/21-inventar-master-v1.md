# Audit 21 — Master Inventory v2

> Repository-wide inventory refreshed on 2026-08-01 for commit `38977d4d06bfb9fbaf55803f8a480262d8d3f262`.
> Method: filesystem scan, targeted file review, regenerated audit scripts, and existing master-matrix evidence.

## Repository Summary

| ID | Inventory Category | Count / Result | Evidence |
|---|---|---|---|
| IM-21-01 | Total files (excluding `.git`) | 969 | session filesystem scan |
| IM-21-02 | Total directories (excluding `.git`) | 402 | session filesystem scan |
| IM-21-03 | App Router pages (`page.tsx`) | 168 | `app/**/page.tsx` scan |
| IM-21-04 | Layout files | 6 | `app/**/layout.tsx` scan |
| IM-21-05 | Loading files | 1 | `app/**/loading.tsx` scan |
| IM-21-06 | Error boundaries | 1 | `app/**/error.tsx` scan |
| IM-21-07 | Not-found files | 1 | `app/**/not-found.tsx` scan |
| IM-21-08 | Route handlers (`route.ts`) | 81 | `app/**/route.ts` scan |
| IM-21-09 | Server action files | 1 | `app/actions/**/*.ts` scan |
| IM-21-10 | E2E specs | 18 | `e2e/**/*.ts` scan |
| IM-21-11 | Unit-test files | 31 | `__tests__/**/*.ts` scan |
| IM-21-12 | GitHub Actions workflows | 13 | `.github/workflows/*.yml` scan |
| IM-21-13 | Supabase migrations | 178 | `supabase/migrations/*.sql` scan |
| IM-21-14 | Edge functions | 2 | `supabase/functions/*/index.ts` scan |
| IM-21-15 | Business API routes inventoried in matrix | 72 | `docs/master-matrix/02-api-inventory.md` |
| IM-21-16 | Interactive targets inventoried | 334 | `docs/audit/platform-interactive-summary.json` |

## Major Directory Inventory

| ID | Area | Notes |
|---|---|---|
| IM-21-17 | `/app` | Next.js App Router web platform with public, admin, broker, customer, driver, super-admin, onboarding and legacy mobile surfaces |
| IM-21-18 | `/apps/driver-mobile` | Canonical Expo React Native driver app |
| IM-21-19 | `/android-native` | Native Android app and Gradle build |
| IM-21-20 | `/lib` | Shared auth, role, workspace, navigation and data helpers |
| IM-21-21 | `/supabase` | Migrations, edge functions, diagnostics, ops scripts, tests and linked-project metadata |
| IM-21-22 | `/docs/audit` | Audit workbooks, generated reports and contradiction ledgers |
| IM-21-23 | `/docs/master-matrix` | Page/API/workflow/notification/migration matrices |
| IM-21-24 | `/e2e` | Playwright-based smoke and contract tests |
| IM-21-25 | `/__tests__` | Vitest-based unit and regression tests |
| IM-21-26 | `/.github/workflows` | CI, Android CI and focused validation workflows |

## Roles, Workspaces and Security Surfaces

| ID | Item | Evidence |
|---|---|---|
| IM-21-27 | Canonical app roles: owner, broker, company_admin, company_staff, driver, customer | `lib/authRole.ts` |
| IM-21-28 | Workspace roles/capabilities/nav definitions | `lib/workspaceRole.ts`, `lib/roleCapabilities.ts` |
| IM-21-29 | Protected route prefixes | `middleware.ts` (`/super-admin`, `/broker`, `/admin`, `/driver`, `/customer`, `/m`) |
| IM-21-30 | Auth/session resolution stack | `lib/authSession.ts`, `lib/activeWorkspace.ts`, `middleware.ts` |

## Data Platform Inventory

| ID | Item | Count / Result | Evidence |
|---|---|---|---|
| IM-21-31 | Core+operational tables identified | ~50+ logical tables/records | `supabase/migrations/*.sql`, data audit report |
| IM-21-32 | Views | 21 | data audit report |
| IM-21-33 | Functions / procedures | 182 create-or-alter statements | data audit report |
| IM-21-34 | RLS policies | 227 create-policy statements | data audit report |
| IM-21-35 | Triggers | 68 create-trigger statements | data audit report |
| IM-21-36 | Indexes | 156 create-index statements | data audit report |
| IM-21-37 | Storage buckets | 3 private buckets | `supabase/migrations/032_storage_buckets.sql` |
| IM-21-38 | Realtime-consumed tables identified in code | 4 (`jobs`, `job_tracking_events`, `driver_locations`, `notification_events`) | data audit report |

## Verification Snapshot

| ID | Evidence Stream | Latest Result |
|---|---|---|
| IM-21-39 | Automated audit | 77 PASS / 0 FAIL / 4 MANUAL |
| IM-21-40 | Interactive audit | 334 targets; 1 CLOSED / 52 PARTIAL / 281 DUPLICATE / 0 BROKEN / 63 inaccessible pages |
| IM-21-41 | Page inventory | Extensive, but many PARTIAL rows remain |
| IM-21-42 | API inventory | 72 business routes; 10 CLOSED / 62 PARTIAL |
| IM-21-43 | Workflow matrix | Control-level workflow decomposition exists; many rows PARTIAL/BLOCKED |

## Inventory Decision

The repository inventory is now populated at the major-structure level and cross-linked to supporting matrices. The inventory is **not equivalent to full runtime verification**. The certification gap remains the difference between discovered items and items with closed runtime evidence.
