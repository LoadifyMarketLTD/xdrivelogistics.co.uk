# CX → XDrive Executable Parity Ledger

Date: 2026-08-29
Repository: `LoadifyMarketLTD/xdrivelogistics.co.uk`
Branch: `fix/cx-dashboard-convergence-20260829`
Parent plan: `docs/canonical/CX_TO_XDRIVE_FUNCTIONAL_PARITY_MASTER_PLAN_2026-08-29.md`
Status: ACTIVE EXECUTION LEDGER

## 0. Rules

Status vocabulary:
- `KEEP` — capability exists at the correct functional depth and only regression/visual/runtime validation remains.
- `PRESENT-HIDDEN` — capability exists but navigation/discoverability is weaker than the CX reference.
- `PARTIAL` — capability exists but one or more required behaviours/states/actions or deployment prerequisites are missing.
- `MISSING` — capability is not implemented in XDrive for the role where it is required.
- `BLOCKED-BY-CONTRACT` — UI parity requires an API/DB/RLS/lifecycle/permission capability that does not yet safely exist.
- `NOT-APPLICABLE` — CX-specific commercial/brand capability that is not part of XDrive's product model.

A row may move to `KEEP` only after code audit and focused contract coverage. Runtime/browser verification remains a separate final gate. A capability that depends on an unapplied hosted migration remains `PARTIAL` even when repository implementation and static contract coverage are complete.

### 2026-08-29 PR #399 execution snapshot

- Multi-drop Driver Mobile now has ordered server-backed stop progression, current-stop enforcement, Arrived → Completed actions, server refresh after mutation and POD/final-delivery gating. Stop mutations are explicitly online-only; no fake offline queue support was added.
- Telematics ingestion now requires provider-scoped HMAC configuration plus provider driver + vehicle binding to canonical XDrive driver, vehicle and company identities, with disabled/revoked binding rejection and active-job checks.
- Driver Smart Load Alerts now have an opt-in persisted preference contract, current/home/future-position matching, vehicle/budget filters, recipient dedupe, in-app/email/push channel semantics, a Driver settings API and a discoverable Driver Account settings surface. Exact tracking coordinates remain server-side and alert payloads expose public outcodes only.
- Hosted production migration history currently stops at `20260827141443`. PR #399 migrations `20260829165000`, `20260829170500`, `20260829173500`, `20260829185000` and `20260829185200` are **NOT HOSTED/APPLIED**.
- Supabase MCP `apply_migration` is not being used to force production because it cannot preserve the repository migration version and would create remote/local migration-history drift. The repo's approved staging CLI workflow remains the version-safe deployment path.
- `/super-admin` remains untouched; no PR #359 Workspace visual changes are imported.

## 1. Global interaction parity

| CX capability | XDrive surface | Status | Gap / execution | Test / gate |
|---|---|---:|---|---|
| Measured dense workspace shell | shared Workspace shell | KEEP | Preserve 50px shell, 12px page padding, 32px controls, 28px tabs, 24px micro-actions, 36px panel headers, 40–44px tables, radius 4 | workspace convergence contract |
| Scan → Expand → Act → Collapse | expandable operational records | KEEP | Preserve progressive disclosure | structural contract tests |
| Expand All / Collapse All | Driver Loads, Quotes, Jobs, Diary, Return Journeys; Admin Diary/Jobs; Company Marketplace | KEEP | Global control must operate visible results only | `cxGlobalExpandCollapseContract` + Diary/Marketplace contracts |
| Persistent Diary action rail | `/driver/history` | KEEP | POD/Order/Notes/History/Documents/Invoice remain visible when collapsed | `cxDriverDiaryPersistentActionsContract` |
| List/Map parity | Driver Advanced Search; Company Marketplace | KEEP | Same filtered result set must drive both views | Radar contracts |
| No exact pre-award location disclosure | Driver/Company marketplace radar | KEEP | Public outcode centroids only | Radar privacy contracts |

## 2. Driver / Owner Driver

| CX capability | XDrive route / component | Status | Gap / execution | Test / gate |
|---|---|---:|---|---|
| Dashboard | `/driver` | KEEP | Current execution remains dominant; status/context secondary | Driver dashboard contract |
| Directory | `/driver/directory` | KEEP | Promoted from nested load directory | navigation contract |
| Return Journeys | `/driver/returns` | KEEP | Expand/Collapse present; retain CX-close record behaviour | global expand contract |
| Loads / live exchange | `/driver/loads` | KEEP | Dense records + Quote Now + Details | Loads contracts |
| Advanced Search | `/driver/loads/search` | KEEP | From/To radius, min/max vehicle, specialist vehicle, body, freight, member, timing, date, budget, defaults/recent search | `cxDriverFreightRadarQuoteInvoiceContract` |
| On Demand / Regular / Daily Hire | Driver Advanced Search | KEEP | Load type filters implemented | Driver Radar contract |
| Freight Radar | Driver Advanced Search | KEEP | Public outcode radar; cluster behaviour must remain privacy-safe | Driver Radar contract |
| Quote Now modal | Driver Loads/Search | KEEP | Contextual modal; existing `jobId + amount + message` contract preserved | quote contract |
| Quotes state register | `/driver/quotes` | KEEP | Received/Archived/Submitted/Unsuccessful and expandable rows exist | global expand + quotes contract |
| Won Work | `/driver/won-work` | KEEP | Keep award visibility separate from execution lifecycle | route audit |
| Jobs | `/driver/jobs` | KEEP | Expand All shared; lifecycle mutation stays in authoritative job screen | Jobs contract |
| Diary | `/driver/history` | KEEP | All operational history + persistent actions | Diary contract |
| Event Log | `/driver/event-log` | KEEP | Shared user-scoped event register | Event Log contract |
| Messages / Freight Messenger equivalent | `/driver/messages` | KEEP | Driver participant-scoped messaging exists | message contract |
| Live Availability | `/driver/availability` | PRESENT-HIDDEN | Available but should live under role-appropriate nav/More rather than compete with primary modules at every viewport | navigation pass |
| Who's Nearby | `/driver/nearby` / nearby availability surface | KEEP | Privacy-scoped public company/vehicle capacity view | Nearby contract |
| Current Status | Driver Dashboard / Availability | KEEP | Preserve direct status/update affordance | dashboard audit |
| My Documents | Driver Dashboard / Account docs | KEEP | Present as compliance/document signals, not a fake KPI count | dashboard audit |
| Latest Feedback | Driver Dashboard / feedback register | KEEP | Compact last-three style; full register remains accessible | dashboard audit |
| Last 3 Bookings | Driver Dashboard | KEEP | Keep dashboard compact; registers contain full history | dashboard audit |
| Invoice preview from Diary | `/driver/history` + secure PDF endpoint | KEEP | Contextual inline PDF preview implemented | Diary/Invoice contract |
| Payment Report / Finance | `/driver/finance` | KEEP | XDrive is functionally richer than CX shortcut | finance audit |
| Load Alerts / GPS-matched alerts | `/driver/load-alerts` + notification pipeline | PARTIAL | Repository contract is real: opt-in persisted preferences, current/home/future matching, vehicle/budget filters, recipient dedupe and in-app/email/push delivery are implemented. Hosted alert migrations and runtime delivery remain pending | `driverLoadAlertsContract` + hosted migrations + runtime notification gate |
| Won-load notification | Driver | KEEP | `bid_accepted` recipient event/inbox + email path exists; hosted notification execution remains a final runtime gate | Customer award/tracking audit |
| Multi-drop execution parity | Driver Mobile | PARTIAL | Repository contract is now real: persisted ordered stops, current-stop enforcement, Arrived/Completed, concurrency guard, server refresh and final POD/delivery gate. Hosted `job_stops` migration is still pending | `multiDropFoundationContract` + hosted migration + physical Expo E2E |

## 3. Fleet Manager / Company Fleet

| CX capability | XDrive route / component | Status | Gap / execution | Test / gate |
|---|---|---:|---|---|
| Fleet Dashboard | Fleet resolver/dashboard | KEEP | Role-specific queues/signals; no universal KPI count | Fleet dashboard contract |
| Directory | company Marketplace directory / shell route | PRESENT-HIDDEN | Function exists; ensure top-level prominence matches role need | navigation pass |
| Live Availability | `/admin/live-availability` | PARTIAL | Live/Future/Nearby + map exist; local signal-density cleanup/discoverability still requires final pass | availability contract + browser gate |
| My Fleet / Fleet Resources | `/admin/fleet/resources` | KEEP | SignalStrip + dense operational table | Fleet resources contract |
| Drivers | `/admin/fleet/drivers` | KEEP | Dense register + Locate → Live Positions | Fleet driver contract |
| Vehicles | `/admin/fleet/vehicles` | KEEP | Dense register; do not fabricate unavailable state | Fleet vehicle contract |
| Drivers & Vehicles consolidated access | Fleet shell / resources | PARTIAL | Both registers exist; consolidated discoverability/nav still needs parity decision | navigation pass |
| Return Journeys | `/admin/fleet/returns` | KEEP | Dense register, freshness, Locate/Call/Manage | returns contract |
| Future Positions | Live Availability / Returns | KEEP | Existing future availability surfaces | availability contract |
| Nearby / broader permitted pool | `/admin/live-availability` Nearby Exchange | KEEP | Uses privacy-scoped existing backend | Nearby contract |
| Loads | Company Marketplace | KEEP | List/Map, filters, quote, min/max | marketplace contracts |
| Freight Radar | Company Marketplace | KEEP | Public outcode clustering, freshness, Details/Quote Now | `cxCompanyMarketplaceRadarContract` |
| Quotes | Company Marketplace My Quotes | KEEP | Quote lifecycle visible | marketplace contract |
| Won Work | Company Marketplace Won Work | KEEP | Awarded work visible | marketplace contract |
| Diary | Admin/Company Diary | KEEP | Expand all and operational register | global expand contract |
| Freight Vision | company tracking route | KEEP | Existing tracking surface with status buckets; Not Started present | Freight Vision contract |
| Accounting / Finance | Admin Finance | KEEP | XDrive terminology may remain Finance | Finance audit |
| Event Log | `/admin/event-log` | KEEP | Shared user-scoped event register | Event Log contract |
| Messages | company/fleet | KEEP | Participant-scoped Messenger is available for Admin/Carrier/Fleet/Dispatcher paths without weakening RLS | messaging contract + runtime regression |
| Telematics provider ingestion | signed integration endpoint | PARTIAL | Provider-bound driver + vehicle + company mapping, revocation and canonical provenance are implemented; hosted migrations and provider credential management/runtime integration remain | `telematicsIngestContract` + hosted migration/runtime provider gate |
| Load Alerts | Fleet / Carrier | PARTIAL | Driver Smart Alert contract now exists, but Fleet/Carrier recipient, preference and operational ownership semantics have not been implemented or faked | dedicated Fleet/Carrier alert contract |

## 4. Dispatcher

| CX capability | XDrive surface | Status | Gap / execution | Test / gate |
|---|---|---:|---|---|
| Dispatcher Dashboard | Dispatcher control dashboard | KEEP | Unallocated/due/live/exceptions/available/stale position signals | Dispatcher contract |
| Allocation queue | Dispatcher dashboard/jobs | KEEP | Preserve assignment workflow | workflow audit |
| Live Availability | shared Admin route | KEEP | Role must retain access | nav/permission audit |
| Live Positions / Freight Vision | tracking route | KEEP | Keep exception-first view | tracking audit |
| Drivers / Vehicles | Fleet resources | KEEP | Reuse shared registers | route audit |
| Diary / Jobs | Admin Jobs/Diary | KEEP | Dense execution registers | contract tests |
| Return Journeys / future positions | Fleet routes | KEEP | Reuse, role-permission check pending final gate | permissions gate |
| Messenger/contact | Dispatcher | KEEP | Participant-scoped Messenger contract is present; contextual contact actions remain supplemental | messaging contract |
| Event Log | `/admin/event-log` | KEEP | user-scoped | Event Log contract |

## 5. Carrier / Company Admin

| CX capability | XDrive surface | Status | Gap / execution | Test / gate |
|---|---|---:|---|---|
| Dashboard | Carrier Operations Dashboard | KEEP | Dashboard already workboard-first, not KPI-wall | Carrier contract |
| Marketplace / Loads | Company Marketplace | KEEP | CX-close functional surface | marketplace contracts |
| Directory | Marketplace directory | PRESENT-HIDDEN | Exists; top-nav promotion decision remains | navigation pass |
| Quotes | Company Marketplace / Quotes | KEEP | quote states available | marketplace audit |
| Won Work | Company Marketplace Won Work | KEEP | awarded work available | marketplace audit |
| Jobs | Admin Jobs | KEEP | expandable dense register | global expand contract |
| Diary | Admin Diary | KEEP | expandable operational record | global expand contract |
| Fleet | Fleet routes | KEEP | Drivers/Vehicles/Resources available | fleet audit |
| Live Availability | `/admin/live-availability` | PARTIAL | Functional; local signal/discoverability cleanup remains | availability cleanup |
| Return Journeys | Fleet returns | KEEP | operational register | returns contract |
| Freight Vision | tracking route | KEEP | tracking/exceptions | tracking contract |
| Event Log | `/admin/event-log` | KEEP | shared event log | Event Log contract |
| Finance | Admin Finance | KEEP | retain XDrive capability | Finance audit |
| Compliance/Documents | Admin Compliance | KEEP | queue-first layout | Compliance contract |
| Messages | Carrier | KEEP | Participant-scoped cross-company Messenger exists; no arbitrary recipient injection | messaging contract |
| Company Profile/Settings | Admin/account routes | KEEP | existing profile/settings; detailed browser parity remains final gate | account audit |

## 6. Customer / Load Poster

| CX capability | XDrive surface | Status | Gap / execution | Test / gate |
|---|---|---:|---|---|
| Dashboard / Transport Control | `/customer` | KEEP | Action Centre and decisions before summary signals | Customer contract |
| Post Load | customer load creation | KEEP | primary CTA exists | workflow audit |
| Loads / transport requests | customer loads | KEEP | customer-side register exists | route audit |
| Quotes received | customer decision surfaces | KEEP | decision queue exists | Customer contract |
| Compare carriers | customer quote workflow | PARTIAL | Carrier/member identity, profile, price, message, quote time/state exist. Reputation aggregate and canonical ETA/distance-to-pickup remain blocked by missing unambiguous contracts | Customer award/tracking audit |
| Award / Book | customer quote workflow | KEEP | Review & Award → Confirm Award surrounds the protected atomic award path | award contract |
| Bookings / active deliveries | customer dashboard/register | KEEP | active delivery queue | Customer contract |
| Live tracking | customer tracking | KEEP | role-scoped tracking exists | tracking/privacy gate |
| POD / evidence | customer dashboard/doc surfaces | KEEP | evidence available | Customer contract |
| Invoices / AP | customer finance | KEEP | existing commercial/document surface | Finance audit |
| Companies / Directory | `/customer/network` | KEEP | semantic Directory equivalent | navigation audit |
| Messages | Customer | KEEP | Contextual conversation can start from a real bid; recipient identity is resolved server-side and thread access is participant-scoped | messaging contract |
| Event Log | `/customer/event-log` | KEEP | user-scoped | Event Log contract |
| Booking dispute | `/customer/disputes` | KEEP | Server verifies ownership/state and rejects duplicate active disputes | Feedback/disputes audit |
| Trading-partner reputation / reciprocal feedback | Customer/member profile | PARTIAL | Existing feedback data is not yet an unambiguous privacy-safe aggregate for carrier comparison | Feedback/disputes audit |

## 7. Broker / Freight Forwarder

| CX capability | XDrive surface | Status | Gap / execution | Test / gate |
|---|---|---:|---|---|
| Dashboard | `/broker` | KEEP | Action Centre + quote decisions + live carrier execution first | Broker contract |
| Carrier Directory/Network | `/broker/carrier-network` + directory | KEEP | semantic Directory equivalent | nav audit |
| Enquiries / loads | Broker dashboard/loads | KEEP | broker workflow present | route audit |
| Quotes received | Broker quote decisions | KEEP | primary queue | Broker contract |
| Award / carrier selection | broker workflow | KEEP | commercial decision path exists | workflow audit |
| Live execution | Broker dashboard | KEEP | carrier execution visibility | Broker contract |
| POD / evidence | Broker dashboard | KEEP | evidence queue exists | Broker contract |
| Margin / financial exposure | Broker dashboard | KEEP | XDrive-specific richer capability | Broker contract |
| Invoice | Broker finance surface | KEEP | existing commercial flow | Finance audit |
| Event Log | `/broker/event-log` | KEEP | user-scoped | Event Log contract |
| Messages | Broker | KEEP | Participant-scoped Messenger contract exists | messaging contract |
| Booking disputes | Broker dispute management | KEEP | Scoped manager resolve/escalate workflow with audit note exists | Feedback/disputes audit |
| Broader platform complaints/reputation | Broker/member governance | BLOCKED-BY-CONTRACT | Requires explicit complaint case type/evidence/ownership/moderation semantics | Feedback/disputes audit |

## 8. Finance

| CX capability | XDrive surface | Status | Gap / execution | Test / gate |
|---|---|---:|---|---|
| Finance dashboard | Finance control dashboard | KEEP | receivables-first, role-specific signals | Finance dashboard contract |
| Invoice lifecycle | finance routes | KEEP | draft/unpaid/overdue/paid base exists | Finance audit |
| Invoice preview | Driver Diary + finance | KEEP | contextual PDF preview implemented | invoice contract |
| POD/order association | finance/job data | KEEP | available in Driver Diary/order sheet and invoice prefill/detail | Finance audit |
| Ready to Invoice | Finance | KEEP | Derived completed-operated-job queue without inventing a new job status; Create Invoice uses existing prefill path | Finance audit |
| Awaiting payment | Finance | KEEP | receivables state exists | Finance contract |
| Overdue | Finance | KEEP | existing signal/queue | Finance contract |
| External invoice upload | Finance | BLOCKED-BY-CONTRACT | No verified storage/ownership/deduplication/invoice-binding contract; no fake upload UI | Finance audit |
| Off-platform reconciliation / mark paid | Finance | KEEP | Role-checked idempotent payment history with method/reference/date/note and overpayment rejection | Finance audit |
| Batch actions | Finance | BLOCKED-BY-CONTRACT | No safe atomic partial-failure/idempotency/audit contract; no fake batch mutation controls | Finance audit |
| Statements/export | Finance | KEEP | Company-scoped date/counterparty statements + CSV and finance report exports | Finance audit |
| Finance roles | role resolver/permissions | KEEP | finance role exists; detailed permission regression remains final gate | role audit |

## 9. Compliance

| CX-equivalent capability | XDrive surface | Status | Gap / execution | Test / gate |
|---|---|---:|---|---|
| Compliance dashboard | Compliance control dashboard | KEEP | verification/expiry queue dominant | Compliance contract |
| Expired/due/pending signals | Compliance dashboard | KEEP | role-specific, no forced count | Compliance contract |
| Documents | compliance/document routes | KEEP | existing document signals | audit |
| Incident/escalation | compliance dashboard | KEEP | incidents visible | Compliance contract |
| Company/driver/vehicle coverage | compliance dashboard | KEEP | existing coverage view | Compliance contract |

## 10. Viewer

| Capability | XDrive surface | Status | Gap / execution | Test / gate |
|---|---|---:|---|---|
| Read-only dashboard | Viewer dashboard | KEEP | no mutation controls | Viewer contract |
| Operational work register | Viewer dashboard | KEEP | recent work immediately after summary | Viewer contract |
| Event Log | shared Admin event log | KEEP | only own user events | permissions gate |
| Mutable operational actions | Viewer | NOT-APPLICABLE | must remain unavailable | Viewer contract |

## 11. Cross-role capabilities requiring dedicated next-pass work

Highest-priority rows that remain below `KEEP` or intentionally blocked:

1. **Hosted migration gate** — version-safe deployment/verification of `20260829165000`, `20260829170500`, `20260829173500`, `20260829185000` and `20260829185200`; never use a tool path that creates migration-history drift merely to mark them applied.
2. **Customer carrier comparison** — privacy-safe reputation aggregate and canonical bidder ETA/distance-to-pickup contract.
3. **Driver Smart Alerts runtime gate + Fleet/Carrier alerts** — Driver matcher/preferences/channels now exist in repository but still need hosted migrations and live delivery proof. Fleet/Carrier alert ownership, recipients and preferences remain a separate contract gap.
4. **Driver Leave/Edit Feedback** — remains `BLOCKED-BY-CONTRACT` under current `reviews_insert_non_driver` policy; do not weaken RLS casually.
5. **External Invoice Upload** — storage/evidence/ownership/deduplication/invoice-binding contract first.
6. **Batch finance mutations** — atomicity, idempotency, partial failure and audit semantics first.
7. **Telematics integration management** — safe provider credential/binding administration and runtime provider onboarding after hosted migrations.
8. **Fleet/Carrier discoverability** — Directory, Live Availability and Drivers & Vehicles navigation placement cleanup.
9. **Human-facing wording cleanup** — remove leaked technical contract/error terminology from normal UI without hiding actionable error meaning.
10. **Broader complaint/reputation governance** — separate from booking-scoped `job_disputes` unless product scope explicitly says otherwise.

## 12. Immediate execution order from current PR #399 state

1. Preserve hosted migration truth and use only version-safe deployment validation.
2. Close Customer carrier comparison gaps only where a safe contract can be proved.
3. Hosted/runtime validate Driver Smart Alerts; keep Fleet/Carrier alerts separate until their recipient/preference contract exists.
4. Keep Driver reciprocal feedback blocked until reviewed-party identity + RLS semantics are explicit.
5. Keep External Invoice Upload and batch finance mutations blocked until protected contracts exist.
6. Finish role discoverability/navigation cleanup without importing PR #359 visuals.
7. Sweep user-facing wording for technical leakage.
8. Run repository CI/build/typecheck/tests, Netlify preview checks and role/browser regression.
9. Run physical Expo/mobile E2E separately; do not infer it from static tests.
10. Only then consider PR #399 release-ready / non-draft.

## 13. Exit condition

The convergence phase remains OPEN until every non-`KEEP` capability has either:
- a verified implementation and focused contract evidence; or
- an explicit `BLOCKED-BY-CONTRACT`/`NOT-APPLICABLE` disposition with no fake UI.

PR #399 must not be called complete solely because repository structure or screenshots look CX-close. Hosted migrations, runtime integrations, CI/build/typecheck and physical mobile execution are separate release gates.
