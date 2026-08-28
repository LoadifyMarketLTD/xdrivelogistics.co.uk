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
| 1 | Marketplace / Exchange | Load search, matching, quoting, member/load discovery, available vehicles | Audited; repairs below | REPAIR | `7ae684cb`, `17f8125d`, `e1f9b751`, `5eb48d96`, `94ce0c90`, `6efd39d4` + contract tests | STATIC VERIFIED; tests NEEXECUTED |
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

### 1. Marketplace / Exchange — STATIC CLOSED

CX benchmark established from current official/public CX material:
- verified closed-network members can search loads and quote;
- load posters select/accept a carrier quote;
- load search supports location/vehicle/schedule matching and alerts/auto-matching;
- available-vehicle discovery supports direct carrier contact/booking workflows;
- compliance is a prerequisite and remains monitored;
- commercial activity belongs to the carrier/member relationship, while drivers execute work.

XDrive strengths retained (`KEEP` inside this repaired domain):
- exact pickup/delivery coordinates are used server-side for radius/ranking but are not returned pre-award;
- public pre-award load DTOs use outcodes/approximate areas;
- own-company jobs are excluded from carrier search;
- Exchange vs direct-invite visibility is explicit;
- job posting is idempotency-aware and creates `exchange_expires_at`;
- database compliance triggers guard publish/bid/execution, and award rechecks carrier compliance;
- canonical `accept_job_bid_atomic` accepts one bid, rejects competitors, records award history and only auto-allocates a sole owner-driver carrier;
- detailed mobile quote history remains personal to the named driver.

Repairs completed:
1. Active quote identity now matches the canonical DB rule: one active quote per carrier company/job, not per driver/job (`7ae684cb`).
2. Driver marketplace load-board visibility is strict: missing visibility is not implicitly public; expired posts are excluded; `myBid` follows company identity when available (`17f8125d`).
3. Driver search now honours canonical `exchange_expires_at` (`e1f9b751`).
4. Company Marketplace search and quote submission now honour `exchange_expires_at`, including a server-side 409 after expiry (`5eb48d96`).
5. Expo no longer reads `job_bids` directly to decide whether a load is already quoted. The device-bound mobile bids API exposes only active company `jobId`s, preserving company quote identity without leaking colleagues' amounts/messages (`94ce0c90`, `6efd39d4`).

Contract tests added:
- `cxVsXdriveMarketplaceCompanyQuoteContract.test.ts`
- `cxVsXdriveDriverLoadBoardContract.test.ts`
- `cxVsXdriveMarketplaceExpiryParity.test.ts`
- `cxVsXdriveMobileActiveQuoteBoundary.test.ts`

Deferred deliberately to later domains rather than duplicated here:
- Expo `canQuote` readiness UX → Domain 3 Driver;
- Vehicles-on-Demand / Live Availability direct-booking handoff → Domain 8 Availability;
- broader pricing / PPM intelligence → Domain 10 Commercial.

Static verdict: `REPAIR` completed for demonstrated fragmentation. Repository diff is scoped to Marketplace contracts/tests plus this ledger. Executable build/test proof is still pending.

### 2. Fleet

Status: NEXT
