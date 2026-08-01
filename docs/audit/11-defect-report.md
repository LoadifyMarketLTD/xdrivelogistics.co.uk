# Audit 11 — Defect Report

> Static certification defect register refreshed on 2026-08-01 for commit `38977d4d06bfb9fbaf55803f8a480262d8d3f262`.
> This register records launch blockers and major contradictions discovered during the repository-wide audit.

## Metadata

| Field | Value |
|---|---|
| Report maintained by | Copilot Task Agent |
| Audit mode | Repository-only static audit + committed automation evidence |
| Last updated | 2026-08-01 |
| Total defects logged | 9 |

## Active Defects

| ID | Source Audit | Date Found | Description | Severity | Status | Affected Roles | Launch Blocker |
|---|---|---|---|---|---|---|---|
| **DEF-009** | **Platform Owner — live DB read** | **2026-08-01** | **P0 Production reconciliation blocker: login outage was mitigated, Unit A (`drivers` columns/defaults/nullability + canonical `drivers_driver_type_check`) is now aligned from confirmed manual Production SQL, but remaining independent units (active-bid duplicate compatibility, RLS, RPC, notifications) are still unverified for safe rollout.** | **P0 CRITICAL** | **OPEN — RECONCILIATION UNITS PENDING EVIDENCE** | **all authenticated roles** | **Yes** |
| DEF-001 | Audit 18 — API Contract | 2026-08-01 | API contract coverage is critically incomplete: `docs/master-matrix/02-api-inventory.md` records 72 business routes, only 10 CLOSED and 62 PARTIAL. | CRITICAL | OPEN | all authenticated roles | Yes |
| DEF-002 | Audit 19 — UX/UI Consistency | 2026-08-01 | Interactive surface audit regenerated at 334 targets with 281 duplicate targets and 63 inaccessible pages; navigation consistency is not certifiable. | CRITICAL | OPEN | public, customer, driver, broker, admin, super-admin | Yes |
| DEF-003 | Audit 02 / 08 / 19 | 2026-08-01 | Legacy `/m/*` web routes coexist with the canonical Expo driver app, creating duplicated mobile behaviour and certification drift. | MAJOR | OPEN | driver, owner-driver | Yes |
| DEF-004 | Audit 01 / 05 / 06 / 07 / 10 | 2026-08-01 | Production-readiness evidence is incomplete: live env vars, SSL/HSTS, health, observability, DB state and workflow retest evidence are not fully captured. | CRITICAL | OPEN | all roles / platform | Yes |
| DEF-005 | Audit 03 / 15 | 2026-08-01 | Notification/email delivery depends on manual Supabase dashboard wiring; end-to-end delivery and retry evidence is incomplete. | MAJOR | OPEN | broker, customer, driver, admin, super-admin | Yes |
| DEF-006 | Audit 06 / 07 / 13 / 16 | 2026-08-01 | Multi-company isolation, private storage isolation and realtime publication behaviour have strong static evidence but incomplete runtime proof. | MAJOR | OPEN | all authenticated roles | Yes |
| DEF-007 | Audit 02 / 08 / 17 | 2026-08-01 | Driver mobile/GPS certification is incomplete: no fresh physical-device evidence for full journey, GPS accuracy, offline queue, push and stability. | MAJOR | OPEN | driver, fleet, admin | Yes |
| DEF-008 | Audit 09 | 2026-08-01 | No committed runtime performance certification exists for Lighthouse, API latency, mobile stability or load/soak behaviour. | MAJOR | OPEN | public, customer, driver, broker, admin | Yes |

## Defect Detail Records

### DEF-001

| Field | Value |
|---|---|
| ID | DEF-001 |
| Source audit | Audit 18 — API Contract |
| Evidence | `docs/master-matrix/02-api-inventory.md:120-125` |
| Affected files | `docs/master-matrix/02-api-inventory.md`, `app/api/**/route.ts` |
| Affected roles | all authenticated roles |
| Reproduction | Review the totals section in the API inventory; compare with filesystem scan of `app/api/**/route.ts`. |
| Production impact | Unverified auth/error/isolation paths can regress silently on business-critical APIs. |
| Recommendation | Close the 62 PARTIAL API rows with runtime 2xx/4xx/401/403 evidence or explicitly fail them and fix in follow-up implementation PRs. |
| Launch blocker | Yes |

### DEF-002

| Field | Value |
|---|---|
| ID | DEF-002 |
| Source audit | Audit 19 — UX/UI Consistency |
| Evidence | `docs/audit/platform-interactive-summary.json` regenerated in this session |
| Affected files | `docs/audit/platform-interactive-summary.json`, `docs/audit/platform-interactive-matrix.json`, affected `app/**/page.tsx` surfaces |
| Affected roles | public, customer, driver, broker, admin, super-admin |
| Reproduction | Run `npm run audit:interactive`; inspect duplicate target and inaccessible page diagnostics. |
| Production impact | Users can encounter duplicated navigation, unreachable screens and inconsistent path entry points. |
| Recommendation | Reduce duplicate targets, explicitly link currently inaccessible routes, and re-run the interactive audit until duplicates/inaccessible counts are acceptable. |
| Launch blocker | Yes |

### DEF-003

| Field | Value |
|---|---|
| ID | DEF-003 |
| Source audit | Audit 02 / Audit 08 / Audit 19 |
| Evidence | `README.md` mobile routing section, `app/m/**`, `apps/driver-mobile/**` |
| Affected files | `README.md`, `app/m/**`, `apps/driver-mobile/**` |
| Affected roles | driver, owner-driver |
| Reproduction | Compare the canonical mobile statement in `README.md` with the continued presence of legacy `/m/*` routes. |
| Production impact | Feature drift across duplicate mobile surfaces complicates QA, support and release certification. |
| Recommendation | Freeze one canonical mobile surface and move the other to explicit deprecation/removal planning in a follow-up implementation PR. |
| Launch blocker | Yes |

### DEF-004

| Field | Value |
|---|---|
| ID | DEF-004 |
| Source audit | Audit 10 — Production Readiness |
| Evidence | `docs/audit/10-production-readiness.md`, `docs/audit/20-production-release-checklist.md` |
| Affected files | deployment/runtime environment outside repo, plus readiness docs |
| Affected roles | all roles / platform |
| Reproduction | Attempt to satisfy release-checklist items requiring live env, SSL, observability and production DB state from repo-only evidence. |
| Production impact | Release approval would rely on assumptions rather than verified deployment reality. |
| Recommendation | Run a dedicated live-environment certification pass and capture evidence for each blocked criterion before release. |
| Launch blocker | Yes |

### DEF-005

| Field | Value |
|---|---|
| ID | DEF-005 |
| Source audit | Audit 15 — Notification Audit |
| Evidence | `README.md` notifications deployment section, `supabase/functions/send-email/index.ts`, `supabase/functions/notify-operational-event/index.ts` |
| Affected files | README wiring docs, edge functions, webhook configuration |
| Affected roles | broker, customer, driver, admin, super-admin |
| Reproduction | Inspect README deployment steps; note manual dashboard hook/webhook requirements and lack of end-to-end delivery proof in audit docs. |
| Production impact | Notifications can fail silently or remain partially configured despite code presence. |
| Recommendation | Capture live hook/webhook configuration evidence and retest delivery, retry and failure paths per event type. |
| Launch blocker | Yes |

### DEF-006

| Field | Value |
|---|---|
| ID | DEF-006 |
| Source audit | Audit 13 — Multi-Company Isolation |
| Evidence | `docs/audit/automated-audit-report.md`, `supabase/tests/notification_recipient_isolation.sql`, `supabase/diagnostics/runtime_vehicle_insert_rls_probe.sql` |
| Affected files | RLS policies, storage policies, realtime subscriptions, isolation diagnostics |
| Affected roles | all authenticated roles |
| Reproduction | Review static policy evidence, then note the absence of committed live two-tenant proof for documents, realtime and mixed memberships. |
| Production impact | Cross-company leakage could still exist in runtime edge cases that static policy presence alone does not disprove. |
| Recommendation | Execute live two-tenant probes for reads, writes, documents and realtime streams, then attach evidence to the workbooks. |
| Launch blocker | Yes |

### DEF-007

| Field | Value |
|---|---|
| ID | DEF-007 |
| Source audit | Audit 08 — Android Functional / Audit 17 — GPS & Location |
| Evidence | `.github/workflows/android-native-ci.yml`, `docs/audit/20-production-release-checklist.md` |
| Affected files | `apps/driver-mobile/**`, `android-native/**`, GPS/location APIs |
| Affected roles | driver, fleet, admin |
| Reproduction | Compare CI/emulator evidence with missing physical-device checklist sign-off for login, GPS, push, offline queue and crash-free session. |
| Production impact | Driver operations depend on device/runtime behaviour that is not yet certified. |
| Recommendation | Run and record a physical-device certification session on the production APK and attach evidence per checklist item. |
| Launch blocker | Yes |

### DEF-008

| Field | Value |
|---|---|
| ID | DEF-008 |
| Source audit | Audit 09 — Performance |
| Evidence | absence of benchmark artifacts in repo; release checklist performance module |
| Affected files | performance evidence missing across web/mobile/runtime |
| Affected roles | public, customer, driver, broker, admin |
| Reproduction | Search `docs/audit` and CI workflows for Lighthouse/API latency/load outputs for this commit; no qualifying certification artifact exists. |
| Production impact | Launch would proceed without a measured performance baseline or stability proof. |
| Recommendation | Add measured Lighthouse, API latency and mobile stability evidence before requesting release approval. |
| Launch blocker | Yes |

### DEF-009

| Field | Value |
|---|---|
| ID | DEF-009 |
| Severity | **P0 CRITICAL — Production Login Blocker** |
| Source audit | Platform Owner live read (2026-08-01) + emergency manual Production repairs + reconciliation artifacts in this PR |
| Evidence | Original live evidence showed both migrations absent and both driver columns missing. Confirmed Production evidence now records: `drivers.can_commercial_bid` = `boolean NOT NULL default true`; `drivers.driver_type` = `text NOT NULL default 'company_driver'`; no prior `driver_type` constraint; manual narrow apply succeeded for `drivers_driver_type_check` with canonical values; `driver_type` distribution = `company_driver 5`, `owner_driver 0`, legacy/non-canonical `0`, `NULL 0`; `can_commercial_bid` distribution = `true 5`, `false 0`, `NULL 0`. Remaining units still require independent read-only/staging evidence. |
| Affected files | `supabase/migrations/20260725184000_driver_commercial_bidding_controls.sql`, `supabase/migrations/20260726060000_canonical_driver_type_architecture.sql`, `middleware.ts` (secondary bug: no 42703 fallback) |
| Affected roles | All authenticated roles (login fails before role is resolved) |
| Confirmed root cause | Two driver-commercial migrations were absent from the live Supabase project during the outage, and middleware lacked a 42703 fallback. After the outage, emergency manual Production repairs changed live schema/data state. The incident is now a reconciliation problem, not a safe replay-migration problem. |
| Reproduction | 1. Log in with any driver or company-admin account on production. 2. Observe redirect to `/forbidden`. 3. Check browser network tab: `GET /rest/v1/drivers?select=id,company_id,...,can_commercial_bid&user_id=eq.<id>` returns `HTTP 400`. |
| Blast radius | 100% of users with a company membership (company admins, fleet managers, company drivers). Standalone drivers with no membership may partially authenticate but encounter failures at the driver-route gate. |
| Secondary bug found | `middleware.ts` (line ≈321 before fix) queries `can_commercial_bid` inside `resolveRouteAuth` with no `isMissingDriverCommercialColumn` fallback. `authSession.ts` and `app/api/auth/context/route.ts` had the fallback from the July 2026 incident — middleware did not. |
| Remediation — frontend | Add `isMissingDriverCanBidColumn` 42703 guard in `middleware.ts` (same pattern as `authSession.ts`). **This PR applies this fix.** Protects all future logins from column-absent errors. |
| Remediation — schema | **Do not apply** `/home/runner/work/xdrivelogistics.co.uk/xdrivelogistics.co.uk/supabase/migrations/20260801000000_p0_driver_commercial_columns_catchup.sql` to Production. Use the read-only drift audit and the independently reviewable narrow units in `/home/runner/work/xdrivelogistics.co.uk/xdrivelogistics.co.uk/supabase/ops/production-driver-commercial-reconciliation-runbook.md` instead. |
| Migration dependency chain | Broad catch-up sequencing is superseded for Production by concern-by-concern reconciliation. Narrow units now exist for driver-column constraints, duplicate-safe indexes, `job_bids_exchange_insert` RLS, and `review_onboarding_application_atomic`; `can_commercial_bid` data reconciliation and notification behavior remain approval-gated runbooks until runtime evidence exists. |
| Rollback procedure | Roll back only the independently approved narrow unit being applied. No global rollback that drops emergency-repair columns is authorized. Recovery steps are documented per unit in `/home/runner/work/xdrivelogistics.co.uk/xdrivelogistics.co.uk/supabase/ops/production-driver-commercial-reconciliation-runbook.md`. |
| Post-migration verification | Do not claim PASS from static inspection alone. Required evidence is: (1) raw read-only Production drift output, (2) staging/disposable validation on a Production-equivalent baseline, (3) post-apply verification for the specific narrow unit, and (4) runtime workflow evidence for login, bidding, onboarding, and notification paths touched by that unit. |
| Launch blocker | **Yes — P0 reconciliation blocker for controlled Production rollout of remaining units (indexes/RLS/RPC/notifications).** |
| Status | **MITIGATED FOR LOGIN / OPEN FOR RECONCILIATION** — Unit A is aligned in Production from the confirmed narrow manual apply; remaining units stay blocked pending concern-by-concern read-only and staging evidence. |

## Release Gate

| Criterion | Status |
|---|---|
| 0 CRITICAL defects open | ❌ FAIL |
| 0 MAJOR defects open | ❌ FAIL |
| All FIXED defects re-tested and VERIFIED | ❌ FAIL |
| No regressions introduced by fixes | ⚠️ NOT APPLICABLE IN THIS PR (audit only; no implementation changes) |

**Gate decision:** ❌ FAIL — defects remain and block certification.
