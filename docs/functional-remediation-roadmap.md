# Functional Remediation Roadmap (Do Not Merge Until P0 + P1 Complete)

This register tracks the MVP functional blockers from the role-by-role audit and defines release priorities.

## Canonical Blocker Register

| ID | Exact issue | Affected role | Severity | Estimated implementation effort | Dependency on schema/migration | Recommended implementation order | Owner | Status |
|---|---|---|---|---|---|---|---|---|
| FR-001 | Audit blocker inventory is not yet transcribed into a tracked backlog (screenshots exist, but no canonical issue list in repo/PR). | All roles | Critical | 0.5 day | No | 1 | Product + Engineering | CLOSED |
| FR-002 | Super Admin support workflows were removed (`/super-admin/support/*` + support API) and require restored/replacement workflow coverage. | Super Admin | High | 1-2 days | Possible | 2 | Engineering | CLOSED |
| FR-003 | Super Admin finance/notifications use canonical sources, but end-to-end functional validation evidence is still missing. | Super Admin | High | 1 day | No | 3 | QA + Engineering | PARTIAL |
| FR-004 | Company Admin functional blockers from the audit are unresolved or unverified. | Company Admin | Critical | 2-4 days | Possible | 4 | Engineering | Open |
| FR-005 | Dispatcher functional blockers from the audit are unresolved or unverified. | Dispatcher | Critical | 2-4 days | Possible | 5 | Engineering | Open |
| FR-006 | Driver functional blockers from the audit are unresolved or unverified. | Driver | Critical | 2-4 days | Possible | 6 | Engineering | Open |
| FR-007 | Customer functional blockers from the audit are unresolved or unverified. | Customer | Critical | 2-4 days | Possible | 7 | Engineering | Open |
| FR-008 | Complete role-based live verification evidence is missing for closure of all reported MVP blockers. | All roles | Critical | 1-2 days | No | 8 | QA | Open |

## MVP Release Blockers

These must be complete before launch:

1. Build a canonical blocker register from role-by-role audit screenshots (one ticket per blocker, with owner and status).
2. Restore or replace Super Admin support workflows if tickets/complaints/disputes are in MVP scope.
3. Close unresolved role blockers for Super Admin, Company Admin, Dispatcher, Driver, and Customer.
4. Execute full live role-based verification and classify each blocker as VERIFIED/PARTIAL/FAILED/NOT TESTED with evidence.
5. Re-run release validation gates only after blocker closure evidence is complete.

## Post-MVP Improvements

- UX polish and non-blocking dashboard refinements per role.
- Expanded analytics/reporting views not required for core operational workflow completion.
- Additional automation around audit evidence formatting/export.

## Already Fixed By Current PR

1. Super Admin notifications switched to canonical `notification_events` model with status-based rendering.
2. Super Admin finance payments switched to canonical `invoice_payment_history` ledger model.
3. Broker bid workflows aligned to canonical `job_bids` + `submitted` lifecycle.
4. Localhost canonical-host redirect exception added to reduce local/test routing friction.
5. Legacy duplicate Super Admin support routes/pages were removed; this remediation restores them pending final MVP scope decision.

## P0 Closure Evidence (Current Branch)

- **FR-001 — CLOSED**
  - Canonical blocker register exists in this file under **Canonical Blocker Register**.
  - Tracked IDs and statuses are now versioned in-repo.

- **FR-002 — CLOSED**
  - Restored support workflow endpoints/pages are present:
    - `app/api/super-admin/support/route.ts`
    - `app/super-admin/support/tickets/page.tsx`
    - `app/super-admin/support/complaints/page.tsx`
    - `app/super-admin/support/disputes/page.tsx`
  - Runtime validation suite added:
    - `e2e/super-admin-support.spec.ts` (tickets, complaints, disputes, ticket-create API flow)
  - Validation commands pass in this branch:
    - `npm run lint`
    - `npm run typecheck`
    - `npm run build`

- **FR-003 — PARTIAL**
  - Runtime suite exists: `e2e/super-admin.spec.ts` (notifications + payment ledger canonical source checks).
  - This sandbox cannot fully close FR-003 because owner staging credentials and staging runtime execution evidence are not available in-branch.
  - Required for full closure: execute `npx playwright test e2e/super-admin.spec.ts --project=chromium` against staging with valid `E2E_OWNER_EMAIL` + `E2E_OWNER_PASSWORD`, then attach run artifacts.

## Launch Priority Roadmap

- **P0 (Immediate, before merge):** FR-001, FR-002, FR-003
- **P1 (Release gating):** FR-004, FR-005, FR-006, FR-007, FR-008
- **P2 (After MVP):** Post-MVP improvements
