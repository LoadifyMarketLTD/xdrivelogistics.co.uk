# Audit 14 — Business Rules Audit

## Audit Metadata

| Field | Value |
|---|---|
| Audit date | 2026-08-01 |
| Commit SHA | `38977d4d06bfb9fbaf55803f8a480262d8d3f262` |
| Branch | `copilot/audit-intreg-repository-loadifymarketltd` |
| Verification mode | Static repository audit plus committed/generated automation evidence |
| Overall disposition | PARTIAL — state-machine and workflow evidence exists, but business-rule closure is incomplete. |

## Scope

Job lifecycle, bid lifecycle, onboarding review, invoice lifecycle, notification triggers and role-dependent business rules.

## Evidence Basis

- `docs/master-matrix/03-workflow-decomposition.md` — control-level workflow matrix.
- `supabase/migrations/079*`, `080*`, `082*`, `103*`, `125-129*`, `20260721224500_*`.
- `__tests__/onboardingContract.test.ts`, `__tests__/jobClientFields.test.ts`, `__tests__/businessWorkspace.test.ts`.
- `e2e/quote-lifecycle-contract.spec.ts`, `e2e/invoice-lifecycle-contract.spec.ts`, `e2e/job-operations-contract.spec.ts`.

## Findings

| ID | Finding | Disposition | Evidence |
|---|---|---|---|
| BRA-14-01 | Workflow decomposition enumerates concrete controls for invitations, jobs, bids, allocation, delivery and invoicing. | PASS — static evidence only | `docs/master-matrix/03-workflow-decomposition.md` |
| BRA-14-02 | Schema and migrations contain explicit lifecycle hardening for bids, jobs, onboarding and invoices. | PASS — static evidence only | named migrations in scope |
| BRA-14-03 | Some business-rule contract tests exist in unit/E2E form, but many controls in the workflow matrix remain PARTIAL or BLOCKED. | PARTIAL | workflow matrix + selected tests |
| BRA-14-04 | Live re-testing of every business transition per role/company has not been captured. | BLOCKED | absence of completed workbooks 01-05 and 18 |
| BRA-14-05 | Business-rules workbook cannot be closed as PASS in the current audit state. | PARTIAL | depends on DEF-001/DEF-004 |

## Release Gate Impact

- Linked defects: DEF-001, DEF-004
- Launch blocker: Yes
- Auditor decision: PARTIAL — state-machine and workflow evidence exists, but business-rule closure is incomplete.
