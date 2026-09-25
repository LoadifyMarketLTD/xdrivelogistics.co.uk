# XDrive Logistics — CX Role & Function Master Blueprint

**Canonical benchmark date:** 25 September 2026  
**Repository:** `LoadifyMarketLTD/xdrivelogistics.co.uk`  
**Primary benchmark:** Courier Exchange functional model  
**Global exception:** SmartPay / escrow / platform-held funds are excluded from XDrive's current product model.

## 0. Purpose

This is the authoritative blueprint for auditing and completing XDrive by role. A route, menu item or page does **not** count as a complete function. Every important capability must be proven through UI, permissions, real data, backend authority, persistence, notifications/audit where relevant, and end-to-end lifecycle behaviour.

For every relevant CX capability, XDrive must have exactly one explicit outcome:

1. Equivalent capability exists and is verified end-to-end.
2. Equivalent capability is intentionally adapted to XDrive.
3. Capability is explicitly deferred to a future phase.

No important function should remain silently absent.

## 1. Product doctrine

XDrive follows the same broad operational direction as CX:

- freight marketplace and load posting;
- carrier / owner-driver load discovery;
- quote and award workflows;
- driver and fleet availability;
- live positions and live job execution;
- future positions and return journeys;
- fleet and resource management;
- real-time alerts;
- tracking and ETA;
- POD/evidence;
- invoicing and payment-status visibility;
- directory/network;
- secure messaging;
- Diary/history;
- operational reporting;
- compliance;
- future telematics/API integrations;
- future Europe-ready operation.

The benchmark is functional, not visual. XDrive must use its own branding, terminology, design system and implementation.

## 2. Explicit SmartPay exception

XDrive Finance must support invoice creation/upload, POD linkage, due date, outstanding/overdue/paid state, disputes, statements, reporting and full traceability to the job.

XDrive does **not** currently support:

- escrow;
- holding customer funds;
- settling invoices on behalf of members;
- automatic movement of money between members;
- payment guarantees;
- SmartPay-style settlement.

Payment remains direct between trading parties. SmartPay parity must never be raised as a missing launch function.

## 3. Canonical transport lifecycle

All roles must map to one canonical lifecycle.

### Commercial creation
1. Enquiry / transport requirement created.
2. Collection and delivery details entered.
3. Cargo and vehicle requirements entered.
4. Contacts, references and loading requirements entered.
5. Documents attached where relevant.
6. Draft or publish.
7. Visibility/audience applied.
8. Matching engine identifies suitable capacity.
9. Relevant members/drivers receive alerts.

### Marketplace / award
10. Carrier or owner-driver discovers or is matched to the load.
11. Load detail reviewed.
12. Quote submitted.
13. Quote revised/withdrawn if policy permits.
14. Poster receives quotes.
15. Poster compares price/member/capability.
16. Quote accepted.
17. Job awarded.
18. Booking becomes canonical.
19. Carrier allocates driver/vehicle where required.

### Execution
20. Driver receives booking.
21. Driver accepts where required.
22. On my way to pickup.
23. On site pickup.
24. Collection evidence/notes.
25. Loaded/collected.
26. On my way to delivery.
27. Live position and ETA update.
28. Delay/exception alerts as relevant.
29. On site delivery.
30. Delivery evidence.
31. Signature/recipient/photos/documents.
32. POD completed.
33. Delivered.
34. Completed.

### Closeout
35. POD available against same job.
36. Invoice created/uploaded.
37. Invoice visible to payer.
38. Due date tracked.
39. Paid / overdue / disputed state visible.
40. Job remains in Diary/history.
41. Job messages remain linked.
42. Event Log retains significant actions.
43. Reports update from real records.

**Invariant:** Load → Quote → Award → Booking → Allocation → Driver execution → Tracking → POD → Messages → Invoice → Payment status → Dispute → Event Log must remain connected through one canonical job identity.

## 4. Universal platform capabilities

### 4.1 Discovery and matching
Where relevant, XDrive must support:

- pickup/delivery search;
- route;
- date/time;
- vehicle type;
- dimensions;
- weight/pallets;
- special requirements;
- current location;
- destination;
- future position;
- return journey;
- driver/vehicle availability;
- radius;
- saved searches;
- automatic matching;
- configurable matching radius;
- direct capacity discovery;
- direct vehicle/member booking where approved;
- Europe-ready location handling.

A list of loads alone is not matching.

### 4.2 Alerts
Potential triggers:

- matching load;
- load changed;
- quote received;
- quote awarded;
- allocation;
- driver acceptance;
- collection;
- ETA change;
- delay;
- exception;
- delivery;
- POD;
- invoice;
- invoice due/overdue;
- dispute;
- document expiry;
- future-position match;
- message.

Channels may include in-app, push and email. Preferences must be real, not decorative.

### 4.3 Location / ETA / traffic
Where authorised:

- GPS must come from executing device/telematics;
- last-update timestamp must exist;
- stale tracking must be detectable;
- ETA should use current route conditions where supported;
- ETA must be recalculated, not remain a static estimate;
- significant changes should be able to trigger alerts;
- exact GPS must be role-restricted.

### 4.4 Messaging
Messaging must support:

- member conversation;
- job-contextual conversation;
- company/member context;
- unread state;
- sender identity;
- timestamps;
- job reference;
- auditable history;
- job → conversation and conversation → job navigation.

### 4.5 Directory / Network
Role-appropriate discovery should expose truthful:

- trading identity;
- XDrive member ID;
- capabilities;
- vehicles/fleet where appropriate;
- coverage/location;
- contact route;
- compliance state where authorised;
- relationship/favourite/preferred status if supported;
- message/contact;
- potential direct sourcing/booking.

No fabricated rating, verification or trust badge.

### 4.6 Diary / History
Must support future/current/completed/cancelled work, booking detail, driver/vehicle, price where authorised, POD, invoice, messages, events, filters and date ranges.

### 4.7 Event Log
Record significant actions with actor, role, timestamp, entity/job reference, old/new state where relevant and event type.

---

# 5. Role blueprints

## 5.1 Customer

### Mission
Post transport, source a carrier, monitor execution, receive evidence and manage commercial closeout.

### Mandatory
- Dashboard
- Post Load
- edit/cancel load
- Loads
- Quotes
- compare
- award
- Bookings
- live tracking
- ETA
- POD/evidence
- Documents
- Invoices
- Disputes
- Diary
- Directory/Network
- Messages
- Notifications
- Event Log

### Post Load data
- collection/delivery date and time slot;
- full addresses/postcodes;
- collection/delivery contacts;
- customer ref / PO / booking ref;
- vehicle requirement;
- cargo;
- pallets;
- stackability;
- weight/dimensions;
- value where relevant;
- tail lift/forklift/handball;
- instructions;
- documents;
- draft/publish/edit/cancel/duplicate where allowed.

### Customer E2E
**Post → Publish → Quotes → Compare → Award → Booking → Track/ETA → POD → Invoice → Payment state → Dispute if needed → Complete history.**

---

## 5.2 Broker

### Mission
Manage both customer demand and carrier supply.

### Mandatory
- Enquiries
- Post Load
- customer loads
- carrier sourcing
- carrier directory
- carrier quotes
- compare/award
- Jobs
- tracking
- ETA
- POD review
- customer invoices
- carrier costs
- margins
- disputes
- Messages
- Diary
- Event Log
- reports

### Commercial chain
Broker must preserve:
- customer revenue;
- carrier cost;
- gross margin;
- customer invoice;
- carrier payable/cost;
- job linkage;
- no fabricated margin.

### Broker E2E
**Enquiry → Customer requirement → Post/source → Quotes → Award → Track → POD → Customer invoice + carrier cost → Margin → Dispute/closeout → History.**

---

## 5.3 Carrier / Company

### Mission
Find work, win work, allocate resources, execute transport and control fleet/commercial operations.

### Mandatory
- Find Loads / Marketplace
- alerts / matching
- Quotes
- Won Work
- Jobs
- allocation/reallocation
- Drivers
- Vehicles
- Availability
- Live positions/map
- Return Journeys
- Directory
- Freight Vision
- POD
- Invoices/accounts
- Compliance
- Messages
- Notifications
- Event Log

### Matching inputs
- current driver/vehicle location;
- availability;
- vehicle type;
- future position;
- journey direction;
- radius.

### Fleet map
Must be capable of showing own fleet resources, live work, next destination/future position and suitable opportunities where authorised.

### Carrier E2E
**Find/match → Quote → Win → Allocate → Execute → Monitor map/ETA → POD → Invoice → Payment status → Reporting/history.**

---

## 5.4 Fleet Manager

### Mission
Control fleet capacity and execution, not company ownership.

### Mandatory
- all authorised fleet drivers;
- vehicles;
- availability;
- current positions;
- future positions;
- allocation;
- reallocation;
- active/live jobs;
- map/tracking;
- Return Journeys;
- compliance/expiry;
- exceptions;
- driver alerts;
- Freight Vision;
- operational finance visibility;
- Messages;
- Event Log.

### Must support
- driver/vehicle readiness;
- last tracking update;
- future destination/date;
- unallocated jobs;
- driver eligibility;
- active vehicle validation;
- conflict detection;
- reassignment;
- delay/tracking/evidence/document exceptions.

### Fleet Manager E2E
**See capacity → Match resource → Allocate → Driver executes → Monitor map/ETA → Recover exception → Verify POD → Operational closeout.**

---

## 5.5 Owner Driver

### Mission
An executing driver who also operates their own transport business.

Owner Driver = Driver execution + commercial/business capability.

### Mandatory
Everything in Driver Base plus:

- Find Loads
- quote
- auto-match
- configurable load alerts
- availability
- future position
- Journeys/Returns
- Who's Nearby
- tracking
- past bookings
- POD
- invoices
- business/account controls
- Messages
- Directory/Network
- commercial position
- PPM/lane intelligence when real data supports it.

### Owner Driver Finance
Must support job/POD-linked invoice generation and due/overdue/paid visibility.

### PPM / lane intelligence
Only from real data, with:
- vehicle class;
- lane/area definition;
- date window;
- sample size;
- update timestamp;
- outlier handling;
- no invented rate;
- no promise that historic average is a guaranteed market price.

### Owner Driver E2E
**Find/match → Quote → Win → Execute → POD → Invoice → Payment status → Return Journey → Next work → Full history.**

---

## 5.6 Fleet Employed Driver

### Mission
Execute assigned fleet work without receiving owner/business administration.

### Mandatory
- assigned jobs;
- job acceptance where required;
- lifecycle status actions;
- navigation/ETA;
- pickup evidence;
- delivery evidence;
- multi-photo selection/addition;
- signature;
- recipient;
- notes;
- availability;
- assigned vehicle;
- own documents;
- Messages;
- alerts;
- own history.

### Must not receive by default
- company invoice register;
- company billing;
- membership billing;
- company settings;
- owner finance;
- fleet-wide finance reports;
- management of other drivers;
- unrelated vehicle management;
- company admin.

### Fleet Employed Driver E2E
**Receive → Accept → Navigate → Pickup → Evidence → Delivery → Multiple POD items/signature → Complete → Own history.**

---

## 5.7 Driver Base

### Mission
Common execution/mobile-work layer used by authorised driver contexts.

### Mandatory
- Loads
- search/filter
- quote where authorised
- auto matching
- load alerts
- availability
- future destination
- Return Journeys
- Who's Nearby
- Jobs/Bookings
- canonical status lifecycle
- tracking
- POD
- Documents
- Messages
- Notifications
- Diary/history
- Event Log

### Loads
Must include route, times, vehicle fit, weight/pallets, distance to pickup, journey distance and correct date filtering.

### Auto-match
Must use real inputs such as current location, destination preference, radius, vehicle, schedule, future position and journey direction.

### Who's Nearby
Must obey privacy and precision rules; no unauthorised exact GPS.

### POD
Must support multiple photos, signature, recipient, notes and upload retry/error state.

---

# 6. P0 — launch-critical benchmark gaps to verify

1. **Real auto-match** — not just load listing.
2. **Live traffic + ETA recalculation.**
3. **Real alert preferences** across in-app/push/email.
4. **Future position + Return Journeys integrated into matching.**
5. **POD → invoice → history linkage.**
6. **Job-contextual messaging with auditability.**
7. **Role boundary integrity**:
   - Owner Driver vs Fleet Employed Driver;
   - Customer vs Broker;
   - Fleet Manager vs Company Owner/Admin;
   - invoice visibility;
   - exact GPS visibility;
   - company admin capability.

---

# 7. P1 — competitive parity

## Fleet map + opportunity matching
Planner should understand:
- vehicle locations;
- availability;
- current jobs;
- next destinations;
- suitable load opportunities.

## Lane / PPM intelligence
Implement only from sufficient real platform history.

## Vehicles on Demand / direct booking
Controlled workflow:
- find available vehicle/member;
- inspect allowed availability;
- message/contact;
- request/book direct work;
- create canonical booking;
- preserve commercial record.

## Fleet notifications
- position-based load opportunity;
- allocation;
- tracking stale;
- delay;
- document expiry;
- POD missing.

## Member credentials / trust
Expose only truthful company, member, compliance and capability data.

---

# 8. P2 — integration / scale

## Telematics
Future common interface should accept:
- vehicle ID;
- GPS;
- timestamp;
- speed/heading only if needed;
- availability/capacity;
- next destination;
- visibility scope;
- mapping to XDrive company/vehicle.

Native mobile tracking and telematics should feed the same canonical location layer.

## TMS/API
Future enterprise integration:
- create/update/cancel load;
- quote/award events;
- lifecycle events;
- tracking;
- POD;
- invoice metadata.

## Europe readiness
Avoid UK-only assumptions for country, postcode, timezone, currency, VAT/tax, phone/address handling.

---

# 9. Permission matrix

Legend: FULL = manage/own, EXEC = execution only, VIEW = authorised visibility, COND = conditional, NO = denied by default.

| Capability | Customer | Broker | Carrier/Company | Fleet Manager | Owner Driver | Fleet Employed Driver | Driver Base |
|---|---|---|---|---|---|---|---|
| Post own load | FULL | FULL | COND | NO | COND | NO | COND |
| Marketplace loads | NO/COND | sourcing | FULL | VIEW/COND | FULL | COND | COND |
| Submit quote | NO | receives | FULL | NO/COND | FULL | COND | COND |
| Compare/award | FULL | FULL | own posted loads | NO | own posted loads | NO | NO |
| Allocate driver/vehicle | NO | NO | FULL | FULL | self | NO | NO |
| Live tracking | own jobs | managed jobs | carried jobs | fleet jobs | own jobs | own jobs | own jobs |
| Unrelated exact GPS | NO | NO | own fleet only | own fleet only | NO except authorised scope | NO | NO |
| POD capture | NO | review | review/manage | review | FULL | FULL | FULL |
| POD review | FULL | FULL | FULL | FULL | FULL | own | own |
| Customer invoices | VIEW | FULL | if poster | operational only | NO | NO | NO |
| Carrier invoices | payer view | carrier-cost side | FULL | operational VIEW | FULL | NO | NO |
| Company billing/admin | own | own | owner/admin FULL | NO | own business | NO | NO |
| Drivers/vehicles mgmt | NO | NO | FULL | FULL | own/self | own assigned only | own assigned only |
| Return Journeys | NO | sourcing/view | FULL | FULL | FULL | COND | FULL/COND |
| Directory | role-safe | FULL | FULL | FULL | FULL | COND | FULL/COND |
| Messages | FULL | FULL | FULL | FULL | FULL | FULL | FULL |
| Event Log | own | managed | company | fleet | own/business | own | own |
| Finance reports | own | FULL broker | FULL | operational VIEW | own business | NO | NO |

---

# 10. Privacy / security rules

- Customer sees exact live tracking only for the executing booking where authorised.
- Broker sees managed-job tracking only.
- Other members do not see unrelated exact driver GPS.
- Who's Nearby may use reduced precision.
- Fleet/Carrier sees its own authorised fleet.
- Tracking must expose freshness.
- Competing quotes must not leak.
- Employed drivers must not receive business finance/admin.
- Backend/RLS/service authorization must enforce scope; hidden UI alone is insufficient.
- Award, allocation, lifecycle, POD finalisation, invoice issue, payment-status change, dispute change and role changes require server authority and audit history.

---

# 11. Definition of DONE

A feature is not DONE because a route exists, a button renders, TypeScript passes or a mock test passes.

A function is DONE only when all applicable checks pass:

1. UI exists.
2. Correct role sees it.
3. Incorrect role cannot use it.
4. Real data loads.
5. Empty/unavailable/partial states are truthful.
6. Action performs a real request/mutation.
7. Backend validates authority.
8. DB/RLS/service authorization is correct.
9. Result persists.
10. Related modules update.
11. Notifications fire where required.
12. Event Log records significant action.
13. Desktop/mobile behaviour is correct.
14. Error/retry path works.
15. E2E lifecycle is retested.

---

# 12. Required E2E scenarios

### A — Customer sourced job
Customer: Post → Quotes → Award → Booking → Tracking → POD → Invoice → Payment state → History.

### B — Broker managed job
Broker: Enquiry → Post/source → Quotes → Award → Carrier execution → POD → Customer invoice / carrier cost → Margin → History.

### C — Carrier marketplace job
Carrier: Find load → Quote → Win → Allocate → Execute → POD → Invoice → payment status.

### D — Owner Driver marketplace job
Owner Driver: Match/search → Quote → Win → Execute → POD → Invoice → Return Journey → next work.

### E — Fleet employed execution
Fleet Manager allocates. Fleet Driver receives → accepts → navigates → pickup → multiple evidence → delivery → multiple POD images/signature → complete. Fleet Manager monitors and reviews closeout.

### F — Future-position matching
Driver/Owner Driver sets destination → matching uses destination/radius → relevant alert → quote → award.

### G — Direct capacity sourcing
Poster/Broker finds available vehicle/member → inspects allowed availability → contacts/requests → canonical booking → normal execution lifecycle.

---

# 13. Current XDrive route inventory

As reviewed on canonical main on 25 September 2026:

### Driver
`loads`, `quotes`, `won-work`, `jobs`, `availability`, `returns`, `nearby`, `load-alerts`, `vehicles`, `documents`, `messages`, `notifications`, `history`, `event-log`, `finance`, `freight-vision`.

### Customer
`post-load`, `loads`, `quotes`, `awards`, `bookings`, `tracking`, `jobs`, `deliveries`, `documents`, `invoices`, `disputes`, `diary`, `network`, `messages`, `notifications`, `event-log`, `action-centre`.

### Broker
`enquiries`, `post-load`, `loads`, `bids`, `compare-quotes`, `awards`, `carrier-network`, `customers`, `jobs`, `pod-review`, `customer-invoices`, `carrier-costs`, `margins`, `finance`, `disputes`, `diary`, `messages`, `notifications`, `event-log`, `action-centre`.

### Carrier / Fleet
`marketplace`, `exchange-quotes`, `jobs`, `fleet`, `drivers`, `vehicles`, `live-availability`, `freight-vision`, `returns`, `diary`, `messages`, `notifications`, `event-log`, `invoices`, `finance`, `documents`, `incidents`, `pod`, `operations-centre`.

**Inventory does not prove completeness.**

---

# 14. Mandatory closeout checklist by role

## Customer
- [ ] Post Load
- [ ] Edit/cancel
- [ ] Quotes
- [ ] Compare
- [ ] Award
- [ ] Booking
- [ ] Live tracking
- [ ] ETA
- [ ] POD/evidence
- [ ] Documents
- [ ] Invoices
- [ ] Disputes
- [ ] Diary
- [ ] Directory/Network
- [ ] Messages
- [ ] Notifications
- [ ] Event Log

## Broker
- [ ] Enquiries
- [ ] Post Load
- [ ] Customer loads
- [ ] Carrier sourcing
- [ ] Quotes
- [ ] Compare/award
- [ ] Jobs
- [ ] Tracking
- [ ] POD review
- [ ] Customer invoices
- [ ] Carrier costs
- [ ] Margins
- [ ] Disputes
- [ ] Messages
- [ ] Diary
- [ ] Event Log
- [ ] Reports

## Carrier / Company
- [ ] Find Loads
- [ ] Matching
- [ ] Alerts
- [ ] Quotes
- [ ] Won Work
- [ ] Jobs
- [ ] Allocation
- [ ] Drivers
- [ ] Vehicles
- [ ] Availability
- [ ] Live positions/map
- [ ] Return Journeys
- [ ] Directory
- [ ] Freight Vision
- [ ] POD
- [ ] Invoices/accounts
- [ ] Compliance
- [ ] Messages
- [ ] Notifications
- [ ] Event Log

## Fleet Manager
- [ ] Drivers
- [ ] Vehicles
- [ ] Availability
- [ ] Current positions
- [ ] Future positions
- [ ] Allocation
- [ ] Reallocation
- [ ] Live jobs
- [ ] Map/tracking
- [ ] Return Journeys
- [ ] Compliance/expiry
- [ ] Exceptions
- [ ] Driver alerts
- [ ] Freight Vision
- [ ] Operational finance
- [ ] Messages
- [ ] Event Log

## Owner Driver
- [ ] Driver Base
- [ ] Find Loads
- [ ] Quote
- [ ] Auto-match
- [ ] Alerts
- [ ] Availability
- [ ] Future position
- [ ] Journeys/Returns
- [ ] Who's Nearby
- [ ] Tracking
- [ ] Past bookings
- [ ] POD
- [ ] Invoices
- [ ] Business/account
- [ ] Messages
- [ ] Directory/network
- [ ] PPM/lane intelligence

## Fleet Employed Driver
- [ ] Assigned jobs
- [ ] Acceptance
- [ ] Full execution statuses
- [ ] Navigation/ETA
- [ ] Multiple pickup evidence
- [ ] Multiple delivery evidence
- [ ] Signature/recipient
- [ ] Availability
- [ ] Assigned vehicle
- [ ] Own documents
- [ ] Messages
- [ ] Alerts
- [ ] Own history
- [ ] No company finance
- [ ] No billing
- [ ] No admin

## Driver Base
- [ ] Loads
- [ ] Search/filter
- [ ] Quote where authorised
- [ ] Auto-match
- [ ] Load alerts
- [ ] Availability
- [ ] Future destination
- [ ] Return Journeys
- [ ] Who's Nearby
- [ ] Jobs/Bookings
- [ ] Status lifecycle
- [ ] Tracking
- [ ] POD
- [ ] Documents
- [ ] Messages
- [ ] Notifications
- [ ] Diary/history
- [ ] Event Log

---

# 15. CX benchmark prompts to keep in scope

Current CX public material explicitly advertises or describes:

- driver load search;
- vehicle/location/schedule-based discovery;
- live traffic and ETA;
- auto-match;
- configurable alerts;
- availability status;
- Journeys / current and future availability;
- return-load discovery;
- average price-per-mile data;
- Directory;
- fleet control;
- real-time driver/subcontractor availability;
- live delivery status;
- live ETA through POD;
- secure auditable messaging;
- live vehicles/capacity map;
- load posting;
- priority alerts;
- electronic POD;
- invoicing;
- Diary;
- accounting tools;
- Fleet PPM;
- Lane Price / Lane Benchmarking;
- Vehicles on Demand;
- telematics integrations;
- TMS/API posting;
- Europe access;
- tracked-vehicle capacity and next destination;
- vehicle-location visibility controls;
- combined vehicle + load map;
- automated location-based load notifications.

These are benchmark prompts unless explicitly deferred.

---

# 16. Final product rule

When a CX operational feature is relevant to an XDrive role:

> **XDrive must have an equivalent functional solution, an intentionally adapted solution, or an explicit deferred roadmap decision.**

The only globally approved exception is:

> **No SmartPay / escrow / platform-held funds in the current XDrive model.**

Everything else is subject to functional audit.

---

# 17. Audit execution order

1. Driver Base
2. Fleet Employed Driver
3. Owner Driver
4. Fleet Manager
5. Carrier / Company
6. Customer
7. Broker
8. Cross-role marketplace/matching
9. Cross-role tracking/ETA
10. Cross-role POD/invoice/history
11. Cross-role messaging/audit
12. Direct booking / Vehicles on Demand
13. PPM/lane intelligence
14. Telematics/API readiness
15. Full multi-role E2E regression

Each item remains OPEN until it passes the Definition of DONE.
