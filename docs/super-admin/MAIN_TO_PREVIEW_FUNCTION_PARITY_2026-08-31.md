# XDrive Super Admin — Main → Preview #431 Function Parity

Date: 2026-08-31

Preview branch: `preview/super-admin-visual-rebuild-20260831`

Preview PR: #431 — DRAFT / DO NOT MERGE

Purpose: preserve every useful, already-functional Super Admin capability from `main` while changing the information architecture to the card-first Platform Owner control centre and Company 360 experience.

## Safety rules

- `main` is not modified by this preview work.
- Production database is read-only for preview verification.
- Existing semantic/atomic governance APIs are reused; no parallel unsafe mutation path is introduced.
- The shared Platform Owner verifier fails closed for **all non-read Super Admin HTTP methods** in a Netlify Deploy Preview. `GET`, `HEAD` and `OPTIONS` remain available for inspection; `POST`, `PATCH`, `PUT`, `DELETE` and other write methods cannot pass the shared Super Admin authority boundary from #431.
- Individual high-risk preview controls such as company governance and notification retry are also visibly disabled in the UI so the operator is not invited into a mutation flow that the server will reject.
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
| Company governance | approve, reject, suspend, reinstate; compliance activation gate; durable audit | Company 360 Governance Bridge shows canonical controls; mutations disabled in Netlify preview | RESTORED FOR PARITY |
| Users & Access | all users, company owners, customers, dispatchers, drivers, platform admins | Users & Access card | PRESERVED |
| Finance | overview, invoices, financial breakdown/fees, revenue, payments | Finance card | PRESERVED |
| Compliance | document review, insurance, operator licences, expiry tracking, identity/fraud review | Compliance card | PRESERVED |
| Support | tickets, complaints, disputes | Support & Cases card | PRESERVED; complaints schema drift repaired in #431 |
| Platform Cases | cross-domain Case Centre / Action Centre | Support & Cases card + inspectors | SOURCE IMPLEMENTED; Production-backed preview truthfully reports schema unavailable |
| Settings/Security | global settings, roles & permissions, feature flags, audit logs, notifications | Platform & Security card | PRESERVED |
| Global Search | not a complete owner-first control surface in legacy main | persistent top search + Search page | PREVIEW ENHANCEMENT |
| Entity Inspectors | fragmented/limited | canonical company/user/driver/vehicle/job/invoice/POD/ticket/dispute/case inspectors | PREVIEW ENHANCEMENT |
| Company 360 | not available as one dossier | complete cross-domain Platform Owner dossier | PREVIEW ENHANCEMENT |

## Company governance contract preserved

Existing endpoint contract: `PATCH /api/super-admin/companies/[id]`.

Canonical actions:

- `pending` / `pending_approval` → `approve` or `reject`
- `active` → `suspend`
- `suspended` → `reinstate`

The underlying functional contract preserves:

- active Platform Owner verifier;
- server-side transition validation;
- reason required for reject/suspend;
- company compliance readiness assertion before activation;
- feature flag for suspension/reinstatement;
- atomic `set_company_status_governance` RPC;
- durable owner audit.

In PR #431 Netlify Deploy Preview, the controls are displayed but disabled. The shared Super Admin verifier also blocks write methods before a mutation can reach the canonical contract. This keeps Production read-only while still allowing visual/function-parity inspection.

Company 360 also suppresses these controls on a record classified as `legacy_orphaned`.

## Progressive compliance policy used by #431

Not every empty field is a problem.

Classification:

1. **Required / blocking** — only evidence needed to perform a regulated/safety-critical operation.
2. **Required when applicable** — e.g. VAT, international-work evidence or licence classes only when the business/use case requires it.
3. **Recommended** — improves trust/profile completeness but does not block ordinary access.
4. **Optional** — website, description, second address line, additional vehicle photos and similar enrichment unless an investigation/use case explicitly requires them.

`Request completion` must use canonical onboarding/document preflight and request only real required/conditional gaps. It must not send every empty profile field.

## Active owner-driver Company 360 truth example

The active company inspected during this audit has:

- approved onboarding at 100%;
- one active owner membership;
- one active linked profile;
- one active driver;
- one active vehicle;
- four approved driver documents;
- two approved vehicle documents;
- zero company-level documents, which is not itself treated as a failure when no company-level mandatory document is required;
- six approved compliance documents in total;
- zero document issues from the current read model.

The Governance Bridge therefore presents the aggregate compliance evidence (`6/6` approved) rather than treating `0 company-level documents` as a failure.

The company XDrive ID and member-profile XDrive ID are **separate identifiers for separate entity types**. They are not expected to match. Company authority is determined by the canonical company/profile/membership relationship, not by equality between a company identifier and a person/profile identifier. The earlier orange “ID mismatch” warning was therefore removed as a false-positive interpretation.

## Screenshot-driven runtime findings — 31 Aug 2026

### Complaints

Observed in #431: `column reviews.reviewer_id does not exist`.

Production read-only schema inspection confirmed the canonical column is `reviews.reviewer_user_id` (alongside `reviewed_user_id`). The Super Admin support API was corrected to select `reviewer_user_id`; the response keeps a compatibility alias while the Complaints UI now consumes the canonical field. Production currently contains zero review rows, so the correct post-fix UI state is an empty Complaints registry rather than a service error.

### Notifications

Production read-only truth at inspection time:

- 19 `sent`;
- 22 `skipped`;
- 0 `failed`.

A material portion of the skipped records is an intentionally quarantined historical pre-durability backlog with automatic retry disabled. The previous table rendered every row with `last_error` as “Delivery failed”, which incorrectly classified quarantined `skipped` rows. #431 now distinguishes:

- `failed` → **Delivery failed**;
- `skipped` → **Skipped / quarantined**;
- the canonical `last_error`, attempt count and next-attempt timestamp remain visible as evidence.

Notification Retry remains part of the functional Super Admin contract, but is visibly disabled in #431 and cannot pass the shared server-side Deploy Preview write guard.

### Action Centre / Case Centre

Production read-only schema inspection confirmed `public.platform_cases` and `public.platform_case_events` are not currently applied there. Therefore the Production-backed #431 preview must report the case registry as unavailable. It must **not** fabricate `0` P0/P1/unassigned/investigating counts, and no Production migration is applied from this visual preview.

## Main movement after preview fork

`main` advanced after the preview fork primarily through hosted migration-history recovery, clean-replay and database security hardening work. Those commits are not used as a reason to overwrite the preview UI. Functional parity is audited by route/API behavior instead.

## Current parity conclusion

No major functional Super Admin domain found in current `main` is intentionally removed by #431. Material gaps or false interpretations found during live preview inspection have been repaired in the preview branch without touching `main`:

- company governance controls restored as read-only parity controls;
- Complaints aligned to the canonical `reviews.reviewer_user_id` schema;
- historical skipped notifications no longer represented as delivery failures;
- notification Retry disabled in Deploy Preview;
- global Super Admin Deploy Preview write guard added at the shared Platform Owner authority boundary;
- company/profile XDrive IDs correctly treated as separate entity identifiers instead of a mismatch defect.

Remaining preview-only work must continue to distinguish:

- visual/source implementation;
- Netlify build/runtime validation;
- Production read-only truth;
- migrations not applied to Production;
- unexecuted write-E2E gates.
