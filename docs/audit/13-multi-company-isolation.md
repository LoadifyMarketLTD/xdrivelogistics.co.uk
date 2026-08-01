# Audit 13 — Multi-Company Isolation Audit

## Audit Metadata

| Field | Value |
|---|---|
| Audit date | 2026-08-01 |
| Commit SHA | `38977d4d06bfb9fbaf55803f8a480262d8d3f262` |
| Branch | `copilot/audit-intreg-repository-loadifymarketltd` |
| Verification mode | Static repository audit plus committed/generated automation evidence |
| Overall disposition | PARTIAL — schema and policy evidence is strong, but runtime cross-company proof is not complete. |

## Scope

Company isolation across pages, APIs, RLS, notifications, documents, location streams and membership resolution.

## Evidence Basis

- `docs/audit/automated-audit-report.md` — RLS presence confirmed for critical tables.
- `supabase/tests/notification_recipient_isolation.sql` and `.github/workflows/validate-notification-recipient-isolation.yml`.
- `lib/activeWorkspace.ts`, `lib/authRole.ts`, `middleware.ts` — membership/context enforcement.
- `docs/master-matrix/03-workflow-decomposition.md` and `docs/master-matrix/02-api-inventory.md`.

## Findings

| ID | Finding | Disposition | Evidence |
|---|---|---|---|
| MCI-13-01 | Critical business tables have RLS/policy evidence in migrations and in the automated audit report. | PASS — runtime script evidence | `docs/audit/automated-audit-report.md` SEC-01 section |
| MCI-13-02 | Notification recipient isolation has dedicated SQL validation and CI workflow coverage. | PASS — static evidence only | `supabase/tests/notification_recipient_isolation.sql`, `.github/workflows/validate-notification-recipient-isolation.yml` |
| MCI-13-03 | Workspace selection and route gating are company-aware, reducing accidental cross-tenant navigation. | PASS — static evidence only | `lib/activeWorkspace.ts`, `middleware.ts` |
| MCI-13-04 | Cross-company runtime probes for documents, live dashboards, realtime streams and mixed-membership edge cases remain incomplete in this audit packet. | BLOCKED | `docs/audit/20-production-release-checklist.md`, `supabase/diagnostics/runtime_vehicle_insert_rls_probe.sql` |
| MCI-13-05 | Isolation cannot be certified PASS without live two-tenant evidence. | FAIL | `docs/audit/11-defect-report.md` DEF-006 |

## Release Gate Impact

- Linked defects: DEF-006
- Launch blocker: Yes
- Auditor decision: PARTIAL — schema and policy evidence is strong, but runtime cross-company proof is not complete.
