# Audit 01 — Customer Workflow

## Audit Metadata

| Field | Value |
|---|---|
| Audit date | 2026-08-01 |
| Commit SHA | `38977d4d06bfb9fbaf55803f8a480262d8d3f262` |
| Branch | `copilot/audit-intreg-repository-loadifymarketltd` |
| Verification mode | Static repository audit plus committed/generated automation evidence |
| Overall disposition | BLOCKED — static evidence shows the workflow exists, but end-to-end runtime verification is incomplete. |

## Scope

Customer acquisition, registration, onboarding, quote request, job posting, bid review, delivery follow-up, invoice access.

## Evidence Basis

- `docs/master-matrix/01-page-inventory.md` — customer routes including `/register`, `/request-quote`, `/customer/*`.
- `docs/master-matrix/03-workflow-decomposition.md` — workflow controls for onboarding, job creation, quote/bid lifecycle, delivery and invoice flows.
- `e2e/customer.spec.ts`, `e2e/production-user-lifecycle.spec.ts`, `e2e/canonical-company-membership-contract.spec.ts` — committed E2E coverage artifacts.
- `app/api/public/quote-request/route.ts`, `app/api/onboarding/**`, `app/api/customer/**` — route handlers for public and authenticated customer actions.

## Findings

| ID | Finding | Disposition | Evidence |
|---|---|---|---|
| CW-01-01 | Registration, login and quote-request entry points exist in the App Router and are wired to concrete pages/API routes. | PASS — static evidence only | `app/register/page.tsx`, `app/login/page.tsx`, `app/request-quote/page.tsx`, `app/api/public/quote-request/route.ts` |
| CW-01-02 | Customer onboarding has dedicated session/init/submit endpoints and resume flows. | PASS — static evidence only | `app/api/onboarding/init/route.ts`, `app/api/onboarding/customer/session/route.ts`, `app/api/onboarding/submit/customer/route.ts`, `app/onboarding/customer/**` |
| CW-01-03 | Customer dashboard/job/quote/delivery/invoice pages are present, but most are marked PARTIAL in the page inventory. | PARTIAL | `docs/master-matrix/01-page-inventory.md` rows for `/customer/*` |
| CW-01-04 | Committed E2E specs exist for customer-facing flows, but repository-only audit cannot prove credentials, live email verification, or DB side effects. | BLOCKED | `e2e/customer.spec.ts`, `e2e/production-user-lifecycle.spec.ts` |
| CW-01-05 | Customer notification, POD retrieval and invoice delivery remain unverified against a live environment. | BLOCKED | `docs/audit/20-production-release-checklist.md` module 1 criteria + `docs/master-matrix/03-workflow-decomposition.md` |

## Release Gate Impact

- Linked defects: DEF-001, DEF-004
- Launch blocker: Yes
- Auditor decision: BLOCKED — static evidence shows the workflow exists, but end-to-end runtime verification is incomplete.
