# CX → XDrive Executable Parity Ledger

Date: 2026-08-29
Repository: `LoadifyMarketLTD/xdrivelogistics.co.uk`
Branch: `fix/cx-dashboard-convergence-20260829`
Parent plan: `docs/canonical/CX_TO_XDRIVE_FUNCTIONAL_PARITY_MASTER_PLAN_2026-08-29.md`
Status: ACTIVE EXECUTION LEDGER

## 0. Rules

Status vocabulary:
- `KEEP` — capability exists at the correct functional depth and only regression/visual validation remains.
- `PRESENT-HIDDEN` — capability exists but navigation/discoverability is weaker than the CX reference.
- `PARTIAL` — capability exists but one or more required behaviours/states/actions are missing.
- `MISSING` — capability is not implemented in XDrive for the role where it is required.
- `BLOCKED-BY-CONTRACT` — UI parity requires an API/DB/RLS/lifecycle/permission capability that does not yet safely exist.
- `NOT-APPLICABLE` — CX-specific commercial/brand capability that is not part of XDrive's product model.

A row may move to `KEEP` only after code audit and focused contract coverage. Runtime/browser verification remains a separate final gate.

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
| Load Alerts / GPS-matched alerts | Driver | PARTIAL | Current marketplace/nearby data exists; complete alert rules, preferences, notification feed and location-based matching need full audit | Phase C/J |
| Won-load notification | Driver | PARTIAL | Award state exists; notification delivery parity not yet fully audited | Phase D |
| Multi-drop execution parity | Driver execution | PARTIAL | Job description classification exists; multi-stop execution contract requires dedicated audit | Phase E9 |

## 3. Fleet Manager / Company Fleet

| CX capability | XDrive route / component | Status | Gap / execution | Test / gate |
|---|---|---:|---|---|
| Fleet Dashboard | Fleet resolver/dashboard | KEEP | Role-specific queues/signals; no universal KPI count | Fleet dashboard contract |
| Directory | company Marketplace directory / shell route | PRESENT-HIDDEN | Function exists; ensure top-level prominence matches role need | Phase B2 |
| Live Availability | `/admin/live-availability` | PARTIAL | Live/Future/Nearby + map exist; large KPI wall still requires local SignalStrip cleanup | cleanup + availability contract |
| My Fleet / Fleet Resources | `/admin/fleet/resources` | KEEP | SignalStrip + dense operational table | Fleet resources contract |
| Drivers | `/admin/fleet/drivers` | KEEP | Dense register + Locate → Live Positions | Fleet driver contract |
| Vehicles | `/admin/fleet/vehicles` | KEEP | Dense register; do not fabricate unavailable state | Fleet vehicle contract |
| Drivers & Vehicles consolidated access | Fleet shell / resources | PARTIAL | Both registers exist; consolidated discoverability/nav still needs parity decision | Phase B2/F3 |
| Return Journeys | `/admin/fleet/returns` | KEEP | Dense register, freshness, Locate/Call/Manage | returns contract |
| Future Positions | Live Availability / Returns | KEEP | Existing future availability surfaces | availability contract |
| Nearby / broader permitted pool | `/admin/live-availability` Nearby Exchange | KEEP | Uses privacy-scoped existing backend | Nearby contract |
| Loads | Company Marketplace | KEEP | List/Map, filters, quote, min/max | marketplace contracts |
| Freight Radar | Company Marketplace | KEEP | Public outcode clustering, freshness, Details/Quote Now | `cxCompanyMarketplaceRadarContract` |
| Quotes | Company Marketplace My Quotes | KEEP | Quote lifecycle visible | marketplace contract |
| Won Work | Company Marketplace Won Work | KEEP | Awarded work visible | marketplace contract |
| Diary | Admin/Company Diary | KEEP | Expand all and operational register | global expand contract |
| Freight Vision | company tracking route | KEEP | Existing tracking surface with status buckets; Not Started added/required | Freight Vision contract |
| Accounting / Finance | Admin Finance | KEEP | XDrive terminology may remain Finance | Finance phase |
| Event Log | `/admin/event-log` | KEEP | Shared user-scoped event register | Event Log contract |
| Messages | company/fleet | PARTIAL | Directory/network and Driver messaging exist; generic company Messenger contract not fully available | Phase J2 / possible contract gap |
| Telematics integrations | Fleet settings | PARTIAL | Tracking data exists; credential/integration management parity requires dedicated audit | Phase F10/J9 |
| Load Alerts | Fleet | PARTIAL | Needs full rules/preferences/channel parity audit | Phase C9/J3/J4 |

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
| Messenger/contact | Dispatcher | PARTIAL | Contact actions exist in several surfaces; unified contextual messaging not fully audited | Phase J2 |
| Event Log | `/admin/event-log` | KEEP | user-scoped | Event Log contract |

## 5. Carrier / Company Admin

| CX capability | XDrive surface | Status | Gap / execution | Test / gate |
|---|---|---:|---|---|
| Dashboard | Carrier Operations Dashboard | KEEP | Dashboard already workboard-first, not KPI-wall | Carrier contract |
| Marketplace / Loads | Company Marketplace | KEEP | CX-close functional surface | marketplace contracts |
| Directory | Marketplace directory | PRESENT-HIDDEN | Exists; top-nav promotion decision remains | Phase B4 |
| Quotes | Company Marketplace / Quotes | KEEP | quote states available | marketplace audit |
| Won Work | Company Marketplace | KEEP | awarded work available | marketplace audit |
| Jobs | Admin Jobs | KEEP | expandable dense register | global expand contract |
| Diary | Admin Diary | KEEP | expandable operational record | global expand contract |
| Fleet | Fleet routes | KEEP | Drivers/Vehicles/Resources available | fleet audit |
| Live Availability | `/admin/live-availability` | PARTIAL | Functional but KPI-wall cleanup remains | availability cleanup |
| Return Journeys | Fleet returns | KEEP | operational register | returns contract |
| Freight Vision | tracking route | KEEP | tracking/exceptions | tracking contract |
| Event Log | `/admin/event-log` | KEEP | shared event log | Event Log contract |
| Finance | Admin Finance | KEEP | retain XDrive capability | Finance phase |
| Compliance/Documents | Admin Compliance | KEEP | queue-first layout | Compliance contract |
| Messages | Carrier | PARTIAL | No fully generic CX-style Messenger yet | Phase J2 |
| Company Profile/Settings | Admin/account routes | KEEP | existing profile/settings; detailed parity audit still required | Phase J6/J7/J8 |

## 6. Customer / Load Poster

| CX capability | XDrive surface | Status | Gap / execution | Test / gate |
|---|---|---:|---|---|
| Dashboard / Transport Control | `/customer` | KEEP | Action Centre and decisions before summary signals | Customer contract |
| Post Load | customer load creation | KEEP | primary CTA exists | workflow audit |
| Loads / transport requests | customer loads | KEEP | customer-side register exists | route audit |
| Quotes received | customer decision surfaces | KEEP | decision queue exists | Customer contract |
| Compare carriers | customer quote workflow | PARTIAL | Need dedicated audit for carrier identity/reputation/ETA/distance parity | Phase D2/D3 |
| Award / Book | customer quote workflow | KEEP | award path exists; confirmation parity needs audit | Phase D5 |
| Bookings / active deliveries | customer dashboard/register | KEEP | active delivery queue | Customer contract |
| Live tracking | customer tracking | KEEP | role-scoped tracking exists | tracking/privacy gate |
| POD / evidence | customer dashboard/doc surfaces | KEEP | evidence available | Customer contract |
| Invoices / AP | customer finance | KEEP | existing commercial/document surface | Finance phase |
| Companies / Directory | `/customer/network` | KEEP | semantic Directory equivalent | navigation audit |
| Messages | Customer | PARTIAL | generic contextual messaging not fully audited | Phase J2 |
| Event Log | `/customer/event-log` | KEEP | user-scoped | Event Log contract |
| Feedback / dispute | Customer | PARTIAL | feedback exists in product; CX-style complaint/dispute parity needs full audit | Phase H9/J1 |

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
| Invoice | Broker finance surface | KEEP | existing commercial flow | Finance phase |
| Event Log | `/broker/event-log` | KEEP | user-scoped | Event Log contract |
| Messages | Broker | PARTIAL | no generic Messenger parity yet | Phase J2 |
| Feedback / disputes | Broker | PARTIAL | dedicated parity audit required | Phase H9 |

## 8. Finance

| CX capability | XDrive surface | Status | Gap / execution | Test / gate |
|---|---|---:|---|---|
| Finance dashboard | Finance control dashboard | KEEP | receivables-first, role-specific signals | Finance dashboard contract |
| Invoice lifecycle | finance routes | KEEP | draft/unpaid/overdue/paid base exists | Phase I audit |
| Invoice preview | Driver Diary + finance | KEEP | contextual PDF preview implemented | invoice contract |
| POD/order association | finance/job data | KEEP | available in Driver Diary/order sheet; full finance audit required | Phase I2 |
| Ready to Invoice | Finance | PARTIAL | verify explicit queue/state vs inferred draft state | Phase I2 |
| Awaiting payment | Finance | KEEP | receivables state exists | Phase I4 |
| Overdue | Finance | KEEP | existing signal/queue | Finance contract |
| External invoice upload | Finance | PARTIAL | requires explicit feature audit | Phase I7 |
| Off-platform reconciliation / mark paid | Finance | PARTIAL | contract audit required | Phase I8 |
| Batch actions | Finance | PARTIAL | only if underlying model safely supports | Phase I9 |
| Statements/export | Finance | PARTIAL | export/reporting audit required | Phase I10 |
| Finance roles | role resolver/permissions | KEEP | finance role exists; detailed permission verification final gate | role audit |

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

## 11. Cross-role capabilities requiring dedicated next-pass audit

These are the highest-priority rows that are not yet `KEEP`:

1. **Load Alerts / Notifications** — Driver + Fleet + Carrier; notification rules, home/GPS/return-journey matching, recipients/channels, preferences.
2. **Generic Freight Messenger parity** — Carrier/Fleet/Dispatcher/Customer/Broker; Driver has a real message contract but it is not yet a safe generic cross-role contract.
3. **Live Availability KPI-wall cleanup** — convert local 6-card wall into role-appropriate compact signals without changing global `KpiGrid`.
4. **Drivers & Vehicles consolidated navigation** — route discoverability and top-nav placement for Fleet/Carrier roles.
5. **Company Marketplace load-type tab determinism** — remove stale-state risk in `On Demand / Regular Load / Daily Hire` quick tabs.
6. **Customer carrier comparison** — feedback/reputation, ETA/distance/contact parity before award.
7. **Multi-drop execution** — determine whether current job model is sufficient or a protected contract extension is required.
8. **Telematics integration management** — credentials/provider/vehicle mapping UI + permission contract audit.
9. **Finance advanced parity** — Ready to Invoice, external upload, reconciliation, batch actions, statements/export.
10. **Feedback / complaints / disputes** — cross-role workflow and evidence model audit.
11. **Company/Carrier generic Messages entry points** — only after a safe backend contract is proved.
12. **Notification preferences / Smart Alert equivalent** — settings + channels + recipient model.

## 12. Immediate execution order from this ledger

1. Fix Company Marketplace load-type tab stale-state bug.
2. Refactor Live Availability local KPI wall → `OperationalSignalStrip`, preserving all real signals.
3. Build navigation parity matrix against role registries and actual routes; promote Fleet/Carrier modules where needed.
4. Audit Load Alerts/Notifications backend and settings surfaces.
5. Audit Customer quote comparison and booking-confirmation depth.
6. Audit generic messaging contract before exposing cross-role Messenger UI.
7. Audit Finance advanced capability matrix.
8. Audit feedback/dispute workflow.
9. Audit telematics integrations and multi-drop contract.
10. Continue role-by-role self-audit scorecards.

## 13. Exit condition for Phase A

Phase A remains OPEN until every capability named in the parent plan has one explicit ledger row and one disposition.

No workspace may be called complete solely because its dashboard visually resembles CX.
