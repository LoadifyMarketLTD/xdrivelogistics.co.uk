# XDrive Logistics — Dashboard Role Master Blueprint

**Canonical date:** 26 September 2026  
**Repository:** `LoadifyMarketLTD/xdrivelogistics.co.uk`  
**Verified baseline commit:** `1e48d1966ddcc33e6708323e8639fb48cc394b59`  
**Parent functional benchmark:** `docs/benchmarks/CX_ROLE_FUNCTION_MASTER_BLUEPRINT_2026-09-25.md`  
**Scope:** Customer, Broker, Carrier/Fleet Company, Owner Driver, Fleet Employed Driver, plus role-boundary sub-roles.  
**Purpose:** separate role/dashboard blueprint. This document does not replace the CX functional master blueprint or contract-protection work.

---

## 0. Governing rule

A feature is not complete because a route, component, menu entry, test fixture or mock exists.

Every required capability must be assessed through this matrix:

**Required → Exists → Visible → Authorised → Denied → Real Data → Mutation → Linked → Audited → Mobile → E2E → Status**

Definitions:

- **Required** — expected for the role.
- **Exists** — route/component/API/backend exists.
- **Visible** — user can discover it from the role workspace.
- **Authorised** — correct role is allowed by backend/service/RLS, not only UI.
- **Denied** — adjacent/incorrect roles are actively blocked.
- **Real Data** — reads real persisted platform records.
- **Mutation** — state-changing action performs real authoritative write.
- **Linked** — stays connected to canonical load/job/booking identity.
- **Audited** — significant action appears in Event Log/audit trail where required.
- **Mobile** — mobile/native parity exists where the role requires it.
- **E2E** — complete lifecycle has been executed with real role accounts.
- **Status** — PASS / FAIL / PARTIAL / BLOCKED / DEFERRED / CODE-RESOLVED-E2E-PENDING.

No capability can be signed off until all applicable gates pass.

---

## 1. Canonical roles

Current workspace role model verified in `lib/workspaceRole.ts`:

- `platform_owner`
- `company_owner`
- `company_admin`
- `carrier_admin`
- `broker`
- `customer`
- `fleet_manager`
- `dispatcher`
- `driver`
- `owner_driver`
- `finance`
- `compliance`
- `viewer`

Canonical distinction:

- **Fleet Employed Driver = `driver`**
- **Owner Driver = `owner_driver`**
- Owner Driver must combine execution with authorised self-business/commercial functions.
- Fleet Employed Driver must remain execution-focused and must not inherit company-owner finance/admin scope.

---

## 2. Shared lifecycle invariant

All dashboards must map to one canonical transport lifecycle:

**Requirement / Load → Quote → Award → Booking → Allocation → Driver Acceptance → Pickup → In Transit → Delivery → POD → Invoice → Payment Status → Dispute if any → History / Event Log**

No role may create a parallel shadow identity that breaks traceability.

Required cross-linkage:

- Load ID ↔ quote
- quote ↔ award
- award ↔ booking/job
- job ↔ driver/vehicle allocation
- job ↔ tracking/ETA
- job ↔ messages
- job ↔ pickup/delivery evidence
- job ↔ POD
- POD ↔ invoice
- invoice ↔ payment status
- disputes ↔ original job/invoice
- significant actions ↔ Event Log

---

## 3. Current verified code findings

Baseline: `main@1e48d1966ddcc33e6708323e8639fb48cc394b59`.

### 3.1 Confirmed current defect — Customer navigation drift

`lib/workspaceRole.ts` defines a broader canonical Customer navigation including:

- Tracking
- Diary
- Messages
- Event Log
- Directory / Network
- Disputes
- Bookings
- Quotes
- Loads

However `app/components/workspace/TopWorkspaceShell.tsx` returns `composeCustomerPrototypeNav()` for `role === 'customer'`.

The prototype nav omits direct exposure of several canonical surfaces, including:

- `/customer/tracking`
- `/customer/diary`
- `/customer/messages`
- `/customer/event-log`
- `/customer/network`
- `/customer/disputes`
- `/customer/awards`

**Status: CONFIRMED P0 — navigation architecture drift.**

### 3.2 Confirmed current defect — Broker navigation drift

`lib/workspaceRole.ts` defines a broader canonical Broker navigation.

`TopWorkspaceShell.tsx` returns `composeBrokerPrototypeNav()` for `role === 'broker'`, overriding the capability-derived nav.

Prototype nav does not directly expose important canonical surfaces including:

- `/broker/enquiries`
- `/broker/compare-quotes`
- `/broker/awards`
- `/broker/diary`
- `/broker/messages`
- `/broker/event-log`

**Status: CONFIRMED P0 — navigation architecture drift.**

### 3.3 Driver navigation findings updated from earlier audit

Earlier findings stated that Fleet Driver lacked `My Jobs / Assigned Jobs` and that Availability was wired incorrectly.

At the verified baseline:

- `SHARED_DRIVER_NAV` contains `My Jobs → /driver/jobs`.
- `SHARED_DRIVER_NAV` contains `Availability → /driver/availability`.
- `DriverWorkspaceShell.tsx` recognises `/driver/availability/live` separately as **Live Availability**.

Therefore those two historical P0 findings are no longer classified as open code defects.

**Status: CODE-RESOLVED — E2E proof still required for role visibility, routing and mobile/native parity.**

### 3.4 Role enforcement baseline

`lib/roleCapabilities.ts` and `lib/workspaceRole.ts` contain route/capability gating for Customer, Broker, Carrier/Fleet and Driver surfaces.

This is necessary but not sufficient. The blueprint requires negative-access E2E tests because route declarations alone do not prove:

- server mutation denial,
- RLS denial,
- cross-company isolation,
- finance isolation,
- exact-GPS isolation,
- team/sub-role restrictions.

---

# 4. Customer blueprint

## 4.1 Mission

A Customer must be able to create transport demand, receive/compare quotes, award work, monitor execution, receive evidence, manage invoices/disputes and retain a complete operational record.

## 4.2 Required primary surfaces

- Dashboard
- Action Centre
- Post Load
- My Loads
- Quotes
- Compare Quotes
- Awards
- Bookings / Jobs
- Tracking
- ETA
- Deliveries
- POD & Documents
- Invoices
- Disputes
- Diary
- Network / Directory
- Messages
- Notifications
- Event Log
- Team
- Settings / Account

## 4.3 Required E2E

**Post → Publish → Receive quotes → Compare → Award → Booking → Track → ETA updates → Delivery → POD → Invoice → payment state → dispute where applicable → Diary/Event Log.**

## 4.4 Permission requirements

Customer may:

- manage its own loads;
- receive and compare quotes on its own loads;
- award its own work;
- see tracking only for its authorised jobs;
- review POD for its own jobs;
- view customer-side invoices;
- create/manage disputes linked to its own work;
- use role-safe network/member discovery.

Customer must not:

- inspect competing customers' loads;
- inspect unrelated carrier jobs;
- allocate carrier drivers unless a future explicit workflow permits it;
- see unrelated exact driver GPS;
- access carrier internal invoice registers;
- access fleet-wide driver/vehicle administration.

## 4.5 Current P0

Replace or reconcile `composeCustomerPrototypeNav()` so the visible workspace does not hide required canonical capabilities.

The final implementation must have one source of truth for role nav or a deterministic composition layer that preserves all authorised canonical surfaces.

---

# 5. Broker blueprint

## 5.1 Mission

Broker manages customer demand and carrier supply while preserving commercial separation, margin visibility and full job traceability.

## 5.2 Required primary surfaces

- Dashboard
- Action Centre
- Enquiries
- Customers
- Customer Loads
- Post Load
- Carrier Network
- Carrier Quotes
- Compare Quotes
- Awards
- Active Jobs
- Tracking / ETA
- POD Review
- Customer Invoices
- Carrier Costs
- Margin / Profit
- Disputes
- Diary
- Messages
- Notifications
- Event Log
- Team
- Settings

## 5.3 Required commercial chain

For every brokered job:

**Customer revenue → carrier cost → gross margin → customer invoice → carrier cost/payable record → payment/dispute state**

No value may be fabricated or derived from disconnected mock data.

## 5.4 Required E2E

**Enquiry → customer requirement → post/source → carrier quotes → compare → award → booking → carrier execution → track → POD review → customer invoice + carrier cost → margin → dispute/closeout → history.**

## 5.5 Broker permission boundaries

Broker may:

- manage its own customer relationships;
- post/source loads within authorised scope;
- receive/compare/award carrier quotes;
- monitor jobs it manages;
- view broker commercial data for those jobs;
- manage linked disputes and evidence.

Broker must not:

- act as platform owner;
- see unrelated company finance;
- see unrelated exact fleet GPS;
- modify carrier internal fleet records;
- modify another broker's customer book.

## 5.6 Current P0

Replace or reconcile `composeBrokerPrototypeNav()` so Enquiries, Compare/Award, Diary, Messages and Event Log cannot disappear from the main role architecture.

---

# 6. Carrier / Fleet Company blueprint

## 6.1 Mission

Find and win work, allocate resources, execute transport, manage fleet readiness and complete commercial closeout.

## 6.2 Required surfaces

- Dashboard
- Action Centre
- Marketplace
- Directory
- Load alerts / matching
- Quotes
- Won Work / accepted work
- Jobs
- Operations Centre
- Allocation / reassignment
- Drivers
- Vehicles
- Driver & Vehicle resources
- Live Availability
- Fleet Positions
- Future Availability
- Return Journeys
- Freight Vision
- Diary
- Messages
- Notifications
- Event Log
- POD / Documents
- Incidents / Disputes
- Finance / Invoices
- Compliance
- Settings
- Membership & Billing only for authorised owner/admin roles

## 6.3 Required E2E

**Find/match → Quote → Win → Allocate driver/vehicle → Driver executes → Monitor live status/ETA → POD → Invoice → payment state → reporting/history.**

## 6.4 Key risk

Carrier/Fleet is currently structurally rich. The primary risk is duplicated surfaces with divergent behaviour or data sources.

Audit must prove one canonical authority for:

- active jobs;
- allocation;
- live availability;
- fleet positions;
- future positions;
- returns;
- POD;
- invoices;
- messaging;
- event history.

Duplicate UI is acceptable only if it reads/writes the same authoritative data and remains behaviourally consistent.

---

# 7. Fleet Manager blueprint

## 7.1 Mission

Operate fleet capacity and execution without inheriting ownership-only controls.

## 7.2 Required surfaces/capabilities

- fleet dashboard;
- assigned/active jobs;
- driver allocation and reassignment;
- drivers;
- vehicles;
- live availability;
- current positions;
- future availability/positions;
- returns;
- Freight Vision;
- tracking/ETA;
- document/compliance exceptions;
- incidents;
- operational messages;
- Event Log;
- operational finance visibility only where explicitly authorised.

## 7.3 Must prove

- cannot access owner membership billing;
- cannot change company ownership controls;
- cannot access finance beyond configured scope;
- can allocate only company-authorised resources;
- cannot cross company boundary;
- exact GPS visibility limited to authorised fleet;
- reassignment preserves job and audit history.

---

# 8. Dispatcher blueprint

## 8.1 Mission

Coordinate day-to-day execution and resource allocation.

Required:

- jobs;
- allocation;
- dispatch;
- active jobs;
- driver/vehicle state;
- live tracking;
- exceptions;
- messages;
- POD review where authorised;
- Event Log.

Must not inherit company ownership/billing unless separately assigned.

---

# 9. Owner Driver blueprint

## 9.1 Mission

Owner Driver is a driver who also operates their own transport business.

Owner Driver = execution + authorised commercial/self-business capabilities.

## 9.2 Required operating loop

**Loads → Quote → Won Work → Jobs → Availability → Journeys/Returns → Who's Nearby → POD → Invoices → History**

This loop must be discoverable and coherent, not fragmented across unrelated menus.

## 9.3 Required capabilities

- Available Loads
- search/filter
- auto-match
- load alerts
- My Quotes
- Won Work
- My Jobs
- lifecycle execution
- Availability
- Live Availability
- future destination
- Return Journeys
- Who's Nearby
- tracking
- pickup/delivery evidence
- multiple POD images
- signature
- recipient
- notes
- Documents
- Messages
- Event Log
- own invoices
- own business/account controls
- Membership & Billing where appropriate
- Directory/Network

## 9.4 Finance rule

Owner Driver finance must remain tied to real completed jobs and POD.

Required:

**Job → POD → invoice → due date → outstanding/overdue/paid/disputed → history**

XDrive does not hold settlement funds in the MVP.

## 9.5 P1

Ensure the operating loop is presented as one coherent workflow and not split unnecessarily between top nav, cards, account/settings and hidden secondary routes.

---

# 10. Fleet Employed Driver blueprint

## 10.1 Mission

Execute work assigned by the fleet without receiving owner/company administration.

## 10.2 Required primary surfaces

- Driver Dashboard
- My Jobs / Assigned Jobs
- active job
- next collection/delivery
- job acceptance where required
- lifecycle status controls
- navigation/ETA
- pickup evidence
- delivery evidence
- multi-photo evidence selection/upload
- signature
- recipient
- notes
- Availability
- Live Availability
- assigned vehicle
- own Documents
- Messages
- Notifications / load-job alerts appropriate to role
- own Diary/history
- Event Log for own activity

## 10.3 Must be denied by default

- company invoice register;
- owner finance;
- membership billing;
- company settings;
- management of other drivers;
- fleet-wide finance reports;
- unrelated vehicle management;
- company membership administration;
- cross-company jobs;
- unrelated exact GPS.

## 10.4 Current code status

At the verified baseline:

- `My Jobs → /driver/jobs` exists in `SHARED_DRIVER_NAV`.
- `Availability → /driver/availability` exists in `SHARED_DRIVER_NAV`.
- `/driver/availability/live` is a separate recognised route title.

These are **not signed off** until tested with a real `driver` role and the native/mobile surface.

## 10.5 Required E2E

**Receive assignment → accept → on my way → on site pickup → collected → on my way delivery → on site delivery → upload multiple evidence items + signature/recipient → delivered → own history.**

---

# 11. Driver Base blueprint

Common execution layer shared by authorised driver contexts.

Required:

- Jobs
- route/date/time
- vehicle fit
- availability
- status lifecycle
- tracking
- POD/evidence
- documents
- messages
- notifications
- history
- event trace
- error/retry states
- hardware Back behaviour on native/mobile
- offline/poor-network-safe behaviour where supported

Commercial capabilities such as marketplace loads/quotes must be role/context gated.

---

# 12. Finance sub-role

Finance may receive only finance-relevant authority:

- job read context needed for invoicing;
- customer invoices;
- carrier invoices/costs;
- payment state;
- margin where authorised;
- finance reports.

Finance must not automatically receive:

- driver management;
- fleet allocation;
- platform administration;
- role management;
- exact GPS.

---

# 13. Compliance sub-role

Compliance may receive:

- driver/vehicle documents;
- expiry state;
- verification workflow;
- incidents;
- compliance exceptions.

Compliance must not automatically receive:

- pricing/margin;
- billing ownership;
- carrier commercial bidding;
- unrelated job mutation.

---

# 14. Viewer sub-role

Viewer is read-only and minimum privilege.

Every mutation must be denied even if a page is accidentally rendered.

---

# 15. Platform Owner

Platform Owner is a separate global administration context.

It must not be used to paper over customer/broker/carrier permission defects during E2E.

Role audits must use real target-role accounts, not only Platform Owner.

---

# 16. Customer/Broker team sub-role authorization

Customer and Broker team invitation/activation flows require explicit E2E proof.

Where the platform permits variants such as owner/admin/dispatcher/viewer, verify:

1. invitation creation;
2. email/activation path;
3. membership creation;
4. role resolution;
5. visible navigation;
6. allowed routes;
7. denied routes;
8. server mutation enforcement;
9. RLS/cross-company isolation;
10. Event Log entry;
11. revocation/deactivation;
12. no privilege persistence after role downgrade.

Until this is executed, classify as **authorization risk**, not PASS.

---

# 17. Cross-role authorization matrix

| Capability | Customer | Broker | Carrier Owner/Admin | Fleet Manager | Dispatcher | Owner Driver | Fleet Driver | Finance | Compliance | Viewer |
|---|---|---|---|---|---|---|---|---|---|---|
| Post own load | FULL | FULL | COND | NO | COND | COND | NO | NO | NO | NO |
| Marketplace loads | NO/COND | sourcing | FULL | VIEW/COND | VIEW/COND | FULL | COND | NO | NO | VIEW/NO |
| Submit quote | NO | receives | FULL | NO/COND | NO/COND | FULL | COND | NO | NO | NO |
| Compare/award | FULL | FULL | own posted work | NO | NO/COND | own posted work | NO | NO | NO | NO |
| Allocate driver/vehicle | NO | NO | FULL | FULL | FULL | self | NO | NO | NO | NO |
| Execute job | NO | NO | COND | NO | NO | FULL | FULL | NO | NO | NO |
| Live tracking | own jobs | managed jobs | own company/jobs | own fleet | dispatched fleet | own jobs | own jobs | contextual only | contextual only | limited |
| Unrelated exact GPS | NO | NO | own fleet only | own fleet only | own fleet only | NO | NO | NO | NO | NO |
| POD capture | NO | review | review/COND | review | review | FULL | FULL | NO | review/COND | NO |
| Customer invoices | VIEW | FULL | if poster/authorised | operational only | NO | NO | NO | FULL/COND | NO | VIEW/NO |
| Carrier invoices | payer view | cost side | FULL | operational VIEW | NO | FULL own | NO | FULL/COND | NO | VIEW/NO |
| Company billing | own account | own account | owner/admin only | NO | NO | own business | NO | finance if delegated | NO | NO |
| Drivers/vehicles mgmt | NO | NO | FULL | FULL | COND | own/self | assigned own only | NO | compliance scope | NO |
| Return Journeys | NO | sourcing/VIEW | FULL | FULL | COND | FULL | COND | NO | NO | VIEW/NO |
| Messages | FULL | FULL | FULL | FULL | FULL | FULL | FULL | role-safe | role-safe | VIEW/COND |
| Event Log | own | managed | company | fleet | operations | own/business | own | finance scope | compliance scope | VIEW/COND |

This table is a target policy. Implementation must be verified against server/RLS behaviour.

---

# 18. P0 gates

The following must be closed before dashboard-role sign-off:

1. Customer prototype navigation drift.
2. Broker prototype navigation drift.
3. Customer/Broker sub-role authorization E2E.
4. Owner Driver ↔ Fleet Driver separation.
5. Carrier/Fleet cross-company allocation isolation.
6. Tracking/ETA visibility by role and exact-GPS privacy.
7. POD → Invoice → History linkage.
8. Negative access to finance/admin/company controls.
9. Fleet Driver mobile/native regression.
10. Canonical job identity maintained across all role transitions.

Historical driver-nav issues now present in code are not removed from audit history; they are tracked as **CODE-RESOLVED-E2E-PENDING** until real role/mobile execution passes.

---

# 19. P1 gates

1. Owner Driver operating loop consolidation.
2. Carrier/Fleet duplicate surface convergence.
3. Consistent role navigation source of truth.
4. Consistent alerts and notification preferences.
5. Directory/Network role-safe parity.
6. Diary/history parity.
7. Job-contextual messaging parity.
8. Event Log completeness.

---

# 20. Mandatory implementation order

1. Build complete route/capability matrix from current code.
2. Customer.
3. Broker.
4. Carrier/Fleet.
5. Owner Driver.
6. Fleet Employed Driver.
7. Cross-role authorization.
8. Mobile/native Driver regression.
9. Final role matrix sign-off.

Do not skip ahead from an unresolved P0 that invalidates downstream proof.

---

# 21. Per-capability evidence sheet

Every audited capability should use this row format:

| Role | Capability | Required | Exists | Visible | Authorised | Denied | Real Data | Mutation | Linked | Audited | Mobile | E2E | Status | Evidence |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|

Evidence should identify concrete route/component/API/test/DB policy and, for E2E, the actual role/account and observed result.

---

# 22. Test doctrine

For every real defect:

**reproduce → identify cause → repair → local tests → E2E retest → close**

Do not mark PASS from:

- route existence;
- successful TypeScript build alone;
- hidden button alone;
- mocked fixture alone;
- Platform Owner access;
- screenshot without backend proof.

Negative tests are mandatory for privileged functions.

---

# 23. Sign-off scenarios

### A. Customer
Post → Quotes → Compare → Award → Booking → Tracking/ETA → POD → Invoice → Payment state → History.

### B. Broker
Enquiry → Post/source → Quotes → Compare/Award → Execution → POD → Customer invoice + Carrier cost → Margin → History.

### C. Carrier/Fleet
Find/match → Quote → Win → Allocate → Execute → Monitor → POD → Invoice → Payment state → History.

### D. Owner Driver
Find/match → Quote → Win → Execute → POD → Invoice → Payment state → Return Journey → next work → History.

### E. Fleet Employed Driver
Receive assigned job → Accept → Pickup → evidence → delivery → multi-evidence/signature → Delivered → own history.

### F. Negative authorization
For every role, attempt direct URL and direct API mutation for adjacent privileged capabilities. Expected result must be explicit denial, not merely hidden navigation.

---

# 24. Definition of final PASS

This blueprint is complete only when:

- each required row has evidence;
- all P0 defects are closed or explicitly blocked by a real external dependency;
- correct roles can perform required mutations;
- incorrect roles are denied;
- data is real and persists;
- cross-company isolation is proven;
- canonical lifecycle linkage is intact;
- Event Log contains required actions;
- desktop and applicable mobile/native flows pass;
- no known navigation architecture hides required authorised capabilities;
- final E2E scenarios A–F pass against the deployed environment intended for release.

Until then, the dashboard-role work remains **IN PROGRESS**.
