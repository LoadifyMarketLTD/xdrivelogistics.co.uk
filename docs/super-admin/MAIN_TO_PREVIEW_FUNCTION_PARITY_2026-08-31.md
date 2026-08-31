# XDrive Super Admin — Main → Preview #431 Function Parity

Date: 2026-08-31

Preview branch: `preview/super-admin-visual-rebuild-20260831`

Preview PR: #431 — DRAFT / DO NOT MERGE

Purpose: preserve every useful, already-functional Super Admin capability from `main` while changing the information architecture to the card-first Platform Owner control centre and Company 360 experience.

## Safety rules

- `main` is not modified by this preview work.
- Production database is read-only for preview verification.
- Existing semantic/atomic governance APIs are reused; no parallel unsafe mutation path is introduced.
- Optional profile data is not promoted to a blocking compliance requirement.
- Compliance remains progressive: block only the operation that genuinely requires missing mandatory evidence.
- Legacy/orphaned company records do not receive governance or completion mutations from Company 360.

## Main functional domains and #431 parity

| Domain | Functional capability already present in `main` | #431 representation | Verdict |
|---|---|---|---|
| Command Centre | overview, analytics, urgent state | Command Centre card | PRESERVED |
| Platform Health | infra health, email readiness, Stats/Operations/Finance/Compliance/Marketplace/Notifications/Users/Support API checks, integration readiness | Platform Health under Command Centre | PRESERVED 1:1 |
| XDrive Logistics | overview, XDrive jobs, XDrive marketplace, broker workspace | XDrive Logistics card | PRESERVED |
| Marketplace | overview, quotes, allocations, disputes | Marketplace card with all canonical routes | PRESERVED |
| Operations | all/active/pending/completed jobs, deliveries, POD queue | Operations card | PRESERVED |
| Drivers & Fleet | drivers, availability, fleet positions | Drivers & Fleet card | PRESERVED |
| Companies | all, approvals, active, suspended, verification, compliance | Companies card | PRESERVED |
| Company governance | approve, reject, suspend, reinstate; compliance activation gate; durable audit | Company 360 Governance Bridge reuses `/api/super-admin/companies/[id]` | RESTORED IN #431 |
| Users & Access | all users, company owners, customers, dispatchers, drivers, platform admins | Users & Access card | PRESERVED |
| Finance | overview, invoices, financial breakdown/fees, revenue, payments | Finance card | PRESERVED |
| Compliance | document review, insurance, operator licences, expiry tracking, identity/fraud review | Compliance card | PRESERVED |
| Support | tickets, complaints, disputes | Support & Cases card | PRESERVED |
| Platform Cases | cross-domain Case Centre / Action Centre | Support & Cases card + inspectors | PREVIEW ENHANCEMENT |
| Settings/Security | global settings, roles & permissions, feature flags, audit logs, notifications | Platform & Security card | PRESERVED |
| Global Search | not a complete owner-first control surface in legacy main | persistent top search + Search page | PREVIEW ENHANCEMENT |
| Entity Inspectors | fragmented/limited | canonical company/user/driver/vehicle/job/invoice/POD/ticket/dispute/case inspectors | PREVIEW ENHANCEMENT |
| Company 360 | not available as one dossier | complete cross-domain Platform Owner dossier | PREVIEW ENHANCEMENT |

## Company governance contract preserved

Existing endpoint reused: `PATCH /api/super-admin/companies/[id]`.

Canonical actions:

- `pending` / `pending_approval` → `approve` or `reject`
- `active` → `suspend`
- `suspended` → `reinstate`

Controls preserve:

- active Platform Owner verifier;
- server-side transition validation;
- reason required for reject/suspend;
- company compliance readiness assertion before activation;
- feature flag for suspension/reinstatement;
- atomic `set_company_status_governance` RPC;
- durable owner audit.

Company 360 suppresses these mutations on a record classified as `legacy_orphaned`.

## Progressive compliance policy used by #431

Not every empty field is a problem.

Classification:

1. **Required / blocking** — only evidence needed to perform a regulated/safety-critical operation.
2. **Required when applicable** — e.g. VAT, international-work evidence or licence classes only when the business/use case requires it.
3. **Recommended** — improves trust/profile completeness but does not block ordinary access.
4. **Optional** — website, description, second address line, additional vehicle photos and similar enrichment unless an investigation/use case explicitly requires them.

`Request completion` must use canonical onboarding/document preflight and request only real required/conditional gaps. It must not send every empty profile field.

## Active owner-driver Company 360 truth example

The current active company inspected during this audit has:

- approved onboarding at 100%;
- one active owner membership/profile;
- one active driver;
- one active vehicle;
- four approved driver documents;
- two approved vehicle documents;
- zero company-level documents, which is not itself treated as a failure when no company-level mandatory document is required;
- six approved compliance documents in total;
- zero document issues from the current read model.

A company/profile XDrive-ID mismatch is surfaced as a non-blocking identity-review signal rather than silently ignored or automatically suspending the company.

## Main movement after preview fork

`main` advanced after the preview fork primarily through hosted migration-history recovery, clean-replay and database security hardening work. Those commits are not used as a reason to overwrite the preview UI. Functional parity is audited by route/API behavior instead.

## Current parity conclusion

No major functional Super Admin domain found in current `main` is intentionally removed by #431. The material functional gap found during this audit was company governance actions disappearing from the dedicated Company 360 view; that gap has been restored by reusing the existing canonical governance endpoint.

Remaining preview-only work must continue to distinguish:

- visual/source implementation;
- Netlify build/runtime validation;
- Production read-only truth;
- migrations not applied to Production;
- unexecuted write-E2E gates.
