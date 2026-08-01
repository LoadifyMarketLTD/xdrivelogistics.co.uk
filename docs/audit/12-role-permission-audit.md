# Audit 12 — Role & Permission Audit

## Audit Metadata

| Field | Value |
|---|---|
| Audit date | 2026-08-01 |
| Commit SHA | `38977d4d06bfb9fbaf55803f8a480262d8d3f262` |
| Branch | `copilot/audit-intreg-repository-loadifymarketltd` |
| Verification mode | Static repository audit plus committed/generated automation evidence |
| Overall disposition | PARTIAL — role model and tests are extensive, but exhaustive live authorization proof is incomplete. |

## Scope

App roles, workspace roles, capabilities, path gating, onboarding role resolution and permission regression tests.

## Evidence Basis

- `lib/authRole.ts`, `lib/workspaceRole.ts`, `lib/roleCapabilities.ts`, `lib/workspacePermissionResolver.ts`.
- `middleware.ts` — route gating and route-auth resolution.
- `__tests__/roleCapabilities.test.ts`, `__tests__/workspacePermissionResolver.test.ts`, `__tests__/middlewareAuth.test.ts`, `__tests__/middlewarePlatformOwner.test.ts`.
- `docs/audit/automated-audit-report.md` — unit tests executed successfully in the latest run.

## Findings

| ID | Finding | Disposition | Evidence |
|---|---|---|---|
| RPA-12-01 | Canonical app roles and legacy aliases are normalized centrally, including owner-driver persona handling. | PASS — static evidence only | `lib/authRole.ts` |
| RPA-12-02 | Workspace capability definitions and navigation contracts are centralized for platform, company, broker, customer and driver roles. | PASS — static evidence only | `lib/workspaceRole.ts`, `lib/roleCapabilities.ts` |
| RPA-12-03 | Permission-focused unit tests are present and passed in the latest automated audit run. | PASS — runtime script evidence | `docs/audit/automated-audit-report.md`, `__tests__/roleCapabilities.test.ts`, `__tests__/workspacePermissionResolver.test.ts` |
| RPA-12-04 | Live 401/403 verification across all protected routes and APIs for every role/company combination is still incomplete. | BLOCKED | `docs/master-matrix/02-api-inventory.md`, `docs/audit/20-production-release-checklist.md` |
| RPA-12-05 | Role/permission workbook remains PARTIAL until all protected runtime combinations are recorded. | PARTIAL | coverage gap in API/page inventories |

## Release Gate Impact

- Linked defects: DEF-001, DEF-006
- Launch blocker: Yes
- Auditor decision: PARTIAL — role model and tests are extensive, but exhaustive live authorization proof is incomplete.
