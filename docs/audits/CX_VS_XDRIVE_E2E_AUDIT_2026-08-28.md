# Courier Exchange vs XDrive Logistics — E2E Audit Ledger

Date started: 2026-08-28
Audit branch: `audit/cx-vs-xdrive-e2e-20260828`
Baseline main: `3fe010a68a6107af0496a406f9a98bfe04f5dd54`

## Method

Courier Exchange (CX) is the functional benchmark. XDrive (XD) is audited against current public/official CX behaviour and XDrive's real repository/database contracts. A CX feature is not copied blindly: XDrive may intentionally be stricter for privacy, tenant isolation, security, compliance, or operational correctness.

Each domain is handled once in sequence. A closed domain is reopened only when a later diff directly changes its contract.

Verdicts:
- `PENDING` — not yet audited end-to-end.
- `KEEP` — XDrive contract is equivalent or intentionally stronger.
- `REPAIR` — existing XDrive implementation is materially wrong or fragmented.
- `ADD` — benchmark capability is materially absent and justified for XDrive.
- `REMOVE` — unsafe/redundant/legacy behaviour should be removed.
- `BLOCKED` — cannot be validated safely with current executable/hosted evidence.

Validation states:
- `STATIC VERIFIED` — repository contract and exact diff inspected.
- `EXECUTED PASS` — relevant build/test/runtime gate actually executed successfully.
- `NEEXECUTED` — no executable proof yet; never treat as PASS.

## Non-negotiable XDrive boundaries

- No peer-driver exact GPS or raw driver identity through Exchange discovery.
- Fleet may receive own-company driver/vehicle operational visibility where authorised.
- Customer/broker/job poster visibility is job-scoped, never fleet-wide by default.
- Deep links, notifications and client payloads are never authorization authority.
- Private evidence/documents remain private; access is assignment/tenant scoped.
- Service-role access must still validate user/driver/company/job relationships.
- No hosted Supabase mutation, production deploy, or main merge from this audit without an explicit validated release step.

## Audit domains

| # | Domain | CX benchmark | XDrive evidence | Verdict | Action / commit | Validation |
|---|---|---|---|---|---|---|
| 1 | Marketplace / Exchange | Load search, matching, quoting, member/load discovery, available vehicles | In progress | PENDING | — | NEEXECUTED |
| 2 | Fleet | Driver/vehicle management, job allocation, own-fleet map, alerts | — | PENDING | — | NEEXECUTED |
| 3 | Driver | Search, jobs, lifecycle, availability, journeys, tracking, POD/history | — | PENDING | — | NEEXECUTED |
| 4 | Customer / Load Poster | Post/manage jobs, visibility, booking/tracking handoff | — | PENDING | — | NEEXECUTED |
| 5 | Tracking / Freight Vision equivalent | Live job visibility, ETA, operational milestones | — | PENDING | — | NEEXECUTED |
| 6 | POD / Documents / Invoices | Evidence, POD, document and invoice retrieval | — | PENDING | — | NEEXECUTED |
| 7 | Alerts / Notifications | Configurable operational alerts, assignment/status notifications | — | PENDING | — | NEEXECUTED |
| 8 | Availability / Journeys / Who's Nearby | Availability, return journeys, nearby/vehicle discovery | — | PENDING | — | NEEXECUTED |
| 9 | Membership / Onboarding / Compliance / Trust | Member access, driver/company trust and compliance gates | — | PENDING | — | NEEXECUTED |
| 10 | Commercial / Pricing / PPM intelligence | Quote controls, pricing signals, market intelligence | — | PENDING | — | NEEXECUTED |
| 11 | Security / Privacy / Tenant isolation | Access boundaries across all surfaces | — | PENDING | — | NEEXECUTED |
| 12 | Executable release validation | Production web build + mobile gates + Android/APK | — | PENDING | — | NEEXECUTED |

## Known validated production repair before audit branch

`main` commit `3fe010a68a6107af0496a406f9a98bfe04f5dd54` fixed the nearby-availability TypeScript build failure while preserving the intended split: Fleet may expose authorised own-driver identity; Exchange omits peer-driver identity and uses coarse exchange location. The dedicated Netlify deploy preview passed before merge.

## Domain notes

### 1. Marketplace / Exchange

Status: IN PROGRESS

Audit targets:
- load visibility/search/filtering;
- Exchange vs direct/private visibility;
- own-company exclusion;
- load data minimisation before award;
- quote/bid eligibility and company-level uniqueness;
- fixed-price/direct-booking semantics;
- award/assignment handoff;
- available vehicles and matching;
- expiry/idempotency/race protection;
- web/mobile parity where intentional.
