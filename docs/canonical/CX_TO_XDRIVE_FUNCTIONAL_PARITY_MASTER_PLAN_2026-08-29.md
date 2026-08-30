# CX → XDrive Functional Parity Master Plan

Date: 2026-08-29
Repository: `LoadifyMarketLTD/xdrivelogistics.co.uk`
Branch: `fix/cx-dashboard-convergence-20260829`
Status: CANONICAL WORKING PLAN

## 0. Purpose

This document replaces any interpretation that XDrive should use one dashboard template, one fixed KPI count, or one reduced subset of Courier Exchange concepts across every role.

The working rule is:

> XDrive must reproduce, as far as legitimately useful for its own product model, the functional architecture, workflow coverage, information density, navigation depth, progressive disclosure and operational behaviour demonstrated by Courier Exchange / Transport Exchange Group, while using XDrive branding, XDrive terminology where appropriate, XDrive security contracts and XDrive visual tokens.

This is NOT a 100% visual copy instruction.

This IS a functional-parity and workflow-completeness instruction.

## 1. Source hierarchy

Implementation decisions must be grounded in this order:

1. Official Transport Exchange Group help-centre documentation describing behaviour and workflows.
2. Current Courier Exchange screenshots supplied by the product owner, including expanded/collapsed states and role-specific navigation.
3. Courier Exchange screenshots already stored in the repository.
4. Existing XDrive backend/API/RLS/lifecycle contracts.
5. Existing XDrive UI components and current rendered state.
6. Inference only when the sources above do not define the behaviour.

When source material and current XDrive assumptions conflict, the conflict must be recorded explicitly. Do not silently simplify the product.

## 2. Official CX documentation source inventory

The following official TEG/CX documentation is part of the required product reference set.

### 2.1 Load discovery, search and quoting

- Finding and posting loads-Fleet
  - https://help.transportexchangegroup.com/hc/en-gb/articles/360020946379-Finding-and-posting-loads-Fleet
  - Required concepts: List View, Interactive Freight Radar Map, From/To radius, minimum/maximum vehicle, Save as Default, date/body/freight filters, On Demand, Regular Load, Daily Hire, map clusters, freshness, click-through load details, Quote Now, load alerts, won-load notifications, allocation.

- Finding and posting loads
  - https://help.transportexchangegroup.com/hc/en-gb/articles/360016730739-Finding-and-posting-loads
  - Required concepts: posted-load quote management, carrier information, feedback summary, quote amount, ETA/distance, dismiss/book, booking confirmation.

- How do I post loads?
  - https://help.transportexchangegroup.com/hc/en-gb/articles/360020946459-How-do-I-post-loads
  - Required concepts: Post Load entry point available broadly, load type, job description, suggested vehicle, packaging, body type, notes/instructions.

- How to quote on loads
  - https://help.transportexchangegroup.com/hc/en-gb/articles/360016161659-How-to-quote-on-loads
  - Required concepts: quote from alerts/search results, eQuote eligibility, Submit Quote, quote management.

- Unsuccessful quotes
  - https://help.transportexchangegroup.com/hc/en-gb/articles/6579714824348-Unsuccessful-quotes
  - Required concepts: declined/unsuccessful quote state, notifications where applicable, desktop/mobile visibility.

- How to use load alerts
  - https://help.transportexchangegroup.com/hc/en-gb/articles/360016122740-How-to-use-load-alerts
  - Required concepts: GPS-dependent alerts, notification feed, map view, call/message alternative when eQuotes are disabled, manual search.

### 2.2 Allocation, execution, Diary and POD

- Allocating loads
  - https://help.transportexchangegroup.com/hc/en-gb/articles/360016738659-Allocating-loads
  - Required concepts: quote acceptance, booking confirmation, direct booking, allocate to company vehicle/subcontractor.

- Transporting loads
  - https://help.transportexchangegroup.com/hc/en-gb/articles/360020920220-Transporting-loads
  - Required concepts: lifecycle status updates, driver/mobile vs telematics handling, POD, Return/Future Journey, monitoring.

- Transporting and managing the load
  - https://help.transportexchangegroup.com/hc/en-gb/articles/4600393357084-Transporting-and-managing-the-load
  - Required concepts: Diary as full booking activity store, real-time mobile sync, operational management.

- How do I manage my load during a booking?
  - https://help.transportexchangegroup.com/hc/en-gb/articles/360015818979-How-do-I-manage-my-load-during-a-booking
  - Required concepts: Diary functions for POD, invoices, feedback, payment reports, manual status updates, current/past bookings, internal notes.

- What happens when I arrive at the delivery point?
  - https://help.transportexchangegroup.com/hc/en-gb/articles/360015804260-What-happens-when-I-arrive-at-the-delivery-point
  - Required concepts: delivery instructions, On Site Delivery, delivery notes, unload, Delivered/POD, invoice continuation.

- Multi-drop jobs
  - https://help.transportexchangegroup.com/hc/en-gb/articles/10013611458204-Multi-drop-jobs
  - Required concepts: multi-stop posting/execution, regular repeat jobs and multi-drop support.

### 2.3 Tracking, live capacity and operational visibility

- About Freight Vision
  - https://help.transportexchangegroup.com/hc/en-gb/articles/21180321435420-About-Freight-Vision
  - Required concepts: in-progress visibility for own drivers/subcontractors, desktop/mobile access model.

- How to use the Freight Vision app
  - https://help.transportexchangegroup.com/hc/en-gb/articles/21180480882844-How-to-use-the-Freight-Vision-app
  - Required concepts: bookings in progress, tracked/not tracked, progress auto-refresh, on-time/behind ETA/late/not tracked, live capacity, availability colours, filters, contact, Messenger.

- Live availability map
  - https://help.transportexchangegroup.com/hc/en-gb/articles/6270045425180-Live-availability-map
  - Required concepts: live GPS map, own drivers/subcontractors vs all advertised vehicles, nearest-driver search, filter rail, saved defaults.

- Telematics Integrations
  - https://help.transportexchangegroup.com/hc/en-gb/articles/360020821140-Telematics-Integrations
  - Required concepts: third-party telematics, live map participation, location-based load matching/alerts.

- How to manage your telematics integrations
  - https://help.transportexchangegroup.com/hc/en-gb/articles/7492133152540-How-to-manage-your-telematics-integrations
  - Required concepts: integration credentials, vehicle mapping, edit/remove integration, Drivers & Vehicles linkage.

- How to enable GPS tracking and load alerts on the Courier Exchange driver app
  - https://help.transportexchangegroup.com/hc/en-gb/articles/360016426060-How-to-enable-GPS-tracking-and-load-alerts-on-the-Courier-Exchange-driver-app

- How to enable GPS tracking and load alerts on the Courier Exchange fleet app
  - https://help.transportexchangegroup.com/hc/en-gb/articles/360016426100-How-to-enable-GPS-tracking-and-load-alerts-on-the-Courier-Exchange-fleet-app

### 2.4 Notifications, Return Journeys and dead-mile reduction

- Setting up notifications and alerts
  - https://help.transportexchangegroup.com/hc/en-gb/articles/360015813959-Setting-up-notifications-and-alerts
  - Required concepts: home-location alerts, return-journey alerts, location-based alerts, radius, vehicle range, email options, international lanes.

- What notifications will I receive?
  - https://help.transportexchangegroup.com/hc/en-gb/articles/360015764960-What-notifications-will-I-receive
  - Required concepts: desktop/mobile/email/SMS channels, home/GPS matching, notification recipient configuration, POD/booking confirmation recipients.

- Smart Alerts
  - https://help.transportexchangegroup.com/hc/en-gb/articles/7591216030364-What-are-Smart-Alerts
  - Required concepts: en-route alerts, configurable recipient emails and intervals.

- How to get full loads on your return trips
  - https://help.transportexchangegroup.com/hc/en-gb/articles/21179509736988-How-to-get-full-loads-on-your-return-trips
  - Required concepts: desktop return-journey publishing for transport companies.

### 2.5 Directory, messaging, members and reputation

- How to use the directory
  - https://help.transportexchangegroup.com/hc/en-gb/articles/22675987521052-How-to-use-the-directory

- Why can't I find a member on the directory?
  - https://help.transportexchangegroup.com/hc/en-gb/articles/7590910308124-Why-can-t-I-find-a-member-on-the-directory
  - Required concepts: active-member lookup, completed-job Order fallback for historical member/contact details.

- Freight Messenger overview
  - https://help.transportexchangegroup.com/hc/en-gb/articles/23716679334812-Freight-Messenger-overview
  - Required concepts: centralised messaging, group messaging, edit/delete/copy/reactions/unread, cross-platform sync, access from directory/live availability/Diary/users.

- Feedback policy
  - https://help.transportexchangegroup.com/hc/en-gb/articles/4408008007698-Feedback-policy

- Rating Your Experience With Other Members
  - https://help.transportexchangegroup.com/hc/en-gb/articles/360016854699-Rating-Your-Experience-With-Other-Members
  - Required concepts: Awaiting Feedback, Leave Feedback, negative feedback/complaint flow, evidence attachments, Recent Feedback, View Feedback, report abuse.

- Disputes overview
  - https://help.transportexchangegroup.com/hc/en-gb/articles/7033177233820-Disputes-overview
  - Required concepts: feedback vs formal dispute separation and serious-incident workflow.

### 2.6 Fleet administration, account roles and company controls

- User roles and permissions
  - https://help.transportexchangegroup.com/hc/en-gb/articles/8897033776540-User-roles-and-permissions
  - Required concepts: Account Owner, Company Admin, Company User, Finance Director, Finance Bookkeeper and role-specific access boundaries.

- Exchange account owner role
  - https://help.transportexchangegroup.com/hc/en-gb/articles/8869572090780-Exchange-account-owner-role
  - Required concepts: owner permissions, Trustd/company/bank/business docs, role management.

- Adding, editing and deleting users
  - https://help.transportexchangegroup.com/hc/en-gb/articles/360015790299-Adding-editing-and-deleting-users
  - Required concepts: user management, role restrictions, Solo-plan distinction.

- Adding, editing and deleting subcontractors
  - https://help.transportexchangegroup.com/hc/en-gb/articles/21165819427612-Adding-editing-and-deleting-subcontractors
  - Required concepts: Exchange-member and external subcontractors.

- Editing a company profile
  - https://help.transportexchangegroup.com/hc/en-gb/articles/360015764560-Editing-a-company-profile
  - Required concepts: verified fields, controlled profile editing, business docs.

- The event log
  - https://help.transportexchangegroup.com/hc/en-gb/articles/7084822511772-The-event-log
  - Required concepts: vehicle/driver/account activity reporting, tracking history, login/logout history, date-range reporting.

### 2.7 Finance, invoices and accounting

XDrive must copy the useful business capability, not SmartPay branding or TEG-specific payment rails.

- Managing loads and quotes
  - https://help.transportexchangegroup.com/hc/en-gb/articles/360016960159-Managing-loads-and-quotes
  - Required concepts: monitor load, carrier contact, POD, invoice creation/editing/supplementary invoice.

- Raise an invoice
  - https://help.transportexchangegroup.com/hc/en-gb/articles/14313980344476-Raise-an-invoice
  - Required concepts: Ready to Invoice, draft/create/email, batch invoices, POD/order review, awaiting payment, paid status.

- SmartPay Accounts Payable
  - https://help.transportexchangegroup.com/hc/en-gb/articles/13814715647132-SmartPay-Accounts-Payable
  - Required concepts to translate into XDrive: invoice list/filtering, missing-doc chase, supplier contact, approve/bulk approve, schedule payment, accounting integration.

- SmartPay: uploading invoices
  - https://help.transportexchangegroup.com/hc/en-gb/articles/25601707792412-SmartPay-uploading-invoices
  - Required concepts: external invoice upload, file validation, matching to job/customer.

- Invoices and payments off platform
  - https://help.transportexchangegroup.com/hc/en-gb/articles/14305062311836-Invoices-and-payments-off-platform
  - Required concepts: manual paid status, off-platform payment reconciliation, external factoring flagging.

- Settings in SmartPay
  - https://help.transportexchangegroup.com/hc/en-gb/articles/13918680049052-Settings-in-SmartPay
  - Required concepts to translate: invoice branding, email templates, backdating rules, supplier/payment groups.

- SmartPay Statements
  - https://help.transportexchangegroup.com/hc/en-gb/articles/29192392066972-SmartPay-Statements
  - Required concepts: date-filtered income/expense export and accounting records.

- Getting paid via SmartPay
  - https://help.transportexchangegroup.com/hc/en-gb/articles/22234165263772-Getting-paid-via-SmartPay
  - Required concepts: remittance, grouped payments, payment visibility.

## 3. Product architecture rule: no universal dashboard template

There is no global rule that every workspace gets 6 KPI cards.

Each workspace must be designed from:

1. the user's primary operational questions;
2. required top-level modules;
3. required page tabs/status states;
4. required actions;
5. required alerts/exceptions;
6. only then, the useful count of KPI/signal cells.

KPI/signal count is therefore role-dependent and can be 0, 3, 4, 5, 6, 8, 10 or another justified number.

A KPI/signal must not exist merely to fill a grid.

## 4. Role-by-role target navigation

The exact final labels are an XDrive product decision, but the functional coverage below is mandatory.

### 4.1 Driver / Owner Driver

Primary capabilities:
- Dashboard
- Directory
- Loads
- Quotes
- Jobs / current execution
- Diary
- Return Journeys
- Availability
- Nearby / live capacity where permitted
- Messages
- Event Log where role allows
- Account
- Documents
- Vehicle
- Finance / invoices where applicable

Dashboard priority:
- current status / availability
- current execution
- next lifecycle action
- bookings
- return journey
- relevant loads / alerts
- feedback
- documents/compliance
- nearby/live position context

Do not copy Fleet KPI counts onto Driver.

### 4.2 Fleet Manager / Company Fleet

Primary capabilities:
- Dashboard
- Directory
- Live Availability
- Fleet / My Fleet
- Drivers & Vehicles
- Drivers
- Vehicles
- Return Journeys
- Loads
- Quotes
- Jobs
- Diary
- Freight Vision / Tracking
- Event Log
- Finance/Accounting as role permits
- Messages
- Company/Profile/Settings as permitted

Dashboard signals may include, when data exists:
- unallocated
- allocated
- active/in-progress
- available drivers
- unavailable/unknown vehicles
- stale/untracked positions
- exceptions/late
- compliance/document alerts
- future availability
- return journeys

No fixed count is imposed.

### 4.3 Dispatcher

Primary questions:
- what is unallocated?
- what is due soon?
- who/what is available?
- what is live now?
- what is late/exceptional?
- which positions are stale/untracked?

Required surfaces:
- job allocation queue
- driver/vehicle live availability
- live positions
- jobs/Diary
- tracking/Freight Vision
- Return Journeys/future positions
- messaging/contact
- exception rail

### 4.4 Carrier / Company Admin

Required coverage:
- Dashboard
- Marketplace/Loads
- Quotes
- Won Work
- Jobs
- Diary
- Fleet
- Drivers & Vehicles
- Live Availability
- Return Journeys
- Freight Vision
- Directory
- Messages
- Event Log
- Finance
- Compliance/Documents
- Company Profile/Settings

### 4.5 Customer / Load Poster

Required coverage:
- Dashboard / transport control
- Post Load
- Loads / transport requests
- Quotes received
- compare carriers
- member/feedback profile
- award/book/confirmation
- Bookings / Diary
- live Tracking / Freight Vision equivalent
- POD / delivery evidence
- invoices / accounts payable
- messages
- companies/directory
- account/settings

### 4.6 Broker / Freight Forwarder

Required coverage:
- Dashboard
- enquiries/posted loads
- quotes received and quotes sent where applicable
- carrier/member comparison
- award/book confirmation
- live carrier execution
- Diary
- tracking
- evidence/POD
- invoices/margin/exposure
- directory/subcontractors
- messaging
- feedback/disputes

### 4.7 Finance

Required coverage:
- Ready to invoice
- Draft
- Awaiting approval/payment
- Overdue
- Paid
- invoice preview
- POD/order evidence
- supplementary invoice/credit-note equivalent if supported
- external/off-platform reconciliation
- statements/export
- finance settings/permissions
- AP and AR separated where XDrive supports both

### 4.8 Compliance

Required coverage:
- driver/vehicle/company documents
- verification state
- expired / expiring
- pending review
- insurance/licence/compliance requirements
- incidents/disputes where appropriate
- coverage status

### 4.9 Viewer

Read-only subset only. Do not duplicate write controls.

## 5. Mandatory page contracts

### 5.1 Loads

Must support, subject to role and backend authority:
- List View
- Map/Freight Radar View
- left filter rail or equivalent dense filter surface
- From + radius
- To + radius
- vehicle minimum and maximum
- exact/specialist vehicle filter where XDrive taxonomy supports it
- body/equipment
- freight/cargo
- member/company
- date/time
- posted-within
- Save as Default
- recent searches
- On Demand
- Regular Load
- Daily Hire
- pagination/items per page
- Expand All / Collapse All for expandable load records
- load notes where visible
- quote/contact action according to poster preference
- no exposure of protected exact pre-award coordinates

### 5.2 Freight Radar

Must support:
- same result set as List View
- public-area marker positioning pre-award
- cluster grouping
- freshness indicator
- hover/tap route indication
- cluster click -> compact load list
- Details
- Quote Now when eQuote is permitted
- privacy-safe fallback when location resolution fails

### 5.3 Quotes

Carrier side:
- Received where relevant
- Archived
- Submitted
- Unsuccessful
- accepted/won state where applicable
- quote amount
- status
- load context
- expand/collapse if extra details exist
- withdraw where legitimate

Load-poster side:
- carrier/member identity
- vehicle
- feedback/reputation summary
- date/time
- contact
- amount
- ETA/distance when available
- Dismiss
- Book/Award
- confirmation workflow

### 5.4 Diary

Diary is not only history. It is the operational record.

Required state tabs, where applicable:
- All
- Unallocated
- Allocated
- In Progress
- Completed
- Cancelled
- Expired
- Awaiting Feedback
- Recent Feedback

Required record behaviour:
- collapsed scan state
- expanded operational detail state
- full history state where applicable
- Expand All / Collapse All
- route
- timing
- member
- vehicle
- status
- notes
- lifecycle timeline
- actions remain accessible without forcing unnecessary navigation

Required contextual actions when legitimate:
- POD
- Order
- Notes
- History
- Documents
- Invoice / View invoice
- Feedback / View feedback
- contact/message

### 5.5 Jobs / Execution

Lifecycle must remain authoritative and server validated.

Operational lifecycle target:
- allocated/accepted
- On my way to pickup
- On site pickup
- Loaded
- On my way to delivery when XDrive contract supports it
- On site delivery
- Delivered/POD
- Complete

List pages must not create a second lifecycle implementation. Mutations belong in the authoritative execution surface/API.

### 5.6 Return Journeys / Future Availability

Required capabilities:
- publish empty-vehicle journey
- search journeys
- own journeys
- route/from/to
- radius
- vehicle
- date/time
- future availability signal
- list/map when supported
- matching/alerts integration where XDrive backend supports it

### 5.7 Live Availability

Required capabilities:
- live positions
- future positions
- nearby search
- own drivers/subcontractors vs broader permitted pool
- availability states
- freshness/staleness
- filter rail
- saved/default search where useful
- locate/contact/message
- privacy and role-aware visibility

### 5.8 Tracking / Freight Vision equivalent

Required operational signals are data-dependent, not fixed-count:
- total allocated/in-progress
- On Time
- Behind ETA
- Late
- Not Tracked
- Not Started / unknown when legitimate

Required capabilities:
- booking list
- live location
- route trail where authorised
- lifecycle status auto-refresh
- exceptions
- contact/messaging
- own driver/subcontractor/carrier distinctions where relevant

### 5.9 Directory

Required capabilities:
- member/company search
- profile
- contact where allowed
- fleet/vehicle/service information where available
- reputation/feedback
- messaging
- historical booking fallback where directory membership is no longer active, subject to XDrive retention/access policy

### 5.10 Messaging

Required target capabilities, phased by backend support:
- contextual booking/load messaging
- directory messaging
- live-availability messaging
- unread state
- conversation history
- company/member contacts
- group messaging if the XDrive message model supports it
- edit/delete/reaction only if contractually supported

Do not add fake UI for unsupported messaging operations.

### 5.11 Event Log

Required target:
- driver/vehicle/account events
- tracking history when tracking existed
- login/logout/session events when data exists
- date filters
- export/report when supported

### 5.12 Finance

XDrive target must reproduce capability, not SmartPay branding.

Minimum target:
- invoice lifecycle
- invoice preview
- POD/order association
- drafts
- unpaid/awaiting payment
- overdue
- paid
- upload external invoice where valid
- mark paid/reconcile off-platform where valid
- batch actions if underlying model supports them
- statements/export
- appropriate permissions

## 6. Dashboard composition rules

Dashboard design is role-specific.

### Driver
Prefer current execution/status/bookings/return journey/feedback/documents. KPI count may be low.

### Fleet
Prefer control signals + unallocated/live/availability/exception queues. Can legitimately have more signals than Driver.

### Dispatcher
Prefer due-soon/unallocated/active/exceptions/available/stale GPS and allocation queue.

### Customer
Prefer Post Load, quote decisions, active deliveries, delayed/exceptions, POD/evidence and invoice position.

### Broker
Prefer enquiries, quote decisions, awarded work, execution, evidence, margin/financial exposure.

### Finance
Prefer receivables/payables/overdue/due soon/drafts/paid/approval signals.

### Compliance
Prefer expired/due/pending/inactive/incidents/coverage.

Do not create empty signals merely to reach a number.

## 7. Visual and interaction contract

Use XDrive identity and the measured workspace contract established 2026-08-29.

Core geometry:
- workspace header around 50px
- page x/y padding around 12px
- primary controls around 32px
- tabs around 28px
- micro actions around 24px
- panel headers around 36px
- dense table rows around 40–44px
- operational body text around 12–13px
- metadata 10–11px
- border radius 4px
- restrained shadows
- high information density without 8–9px body text

Interaction doctrine:
- SCAN → EXPAND → ACT → COLLAPSE
- action rails remain accessible where CX demonstrates persistent actions
- Expand All / Collapse All on every meaningful expandable result surface
- do not add Expand All to non-expandable flat tables
- keep list/map parity

## 8. Protected-by-default, not immutable

The following are protected by default:
- lifecycle
- RLS
- DB contracts
- API contracts
- permissions
- tracking visibility
- POD rules
- invoice behaviour

If functional parity requires a real product capability that current contracts cannot support:

1. record the CX capability;
2. identify the XDrive gap;
3. prove it is not only a UI gap;
4. assess DB/API/RLS/security/mobile impact;
5. implement the narrowest correct contract change;
6. add tests;
7. resume UI parity work.

Never fake unavailable data and never relax security silently.

Hard exclusions for this convergence stream:
- no `/super-admin` visual or functional redesign
- no resurrection of PR #359 Workspace visuals
- no arbitrary new design system
- no desktop-density changes imposed on Expo/mobile
- no TEG/CX branding, advertisements, insurer banners or SmartPay brand copying

## 9. Work plan — execution phases

### Phase A — Documentation closure and parity ledger

A1. Maintain the official source inventory in this document.
A2. Index repository CX screenshots by feature/page/role.
A3. Build a row-by-row parity ledger:
`CX capability | XDrive role | XDrive route | status | gap | implementation | tests`.
A4. Status values: `KEEP`, `PRESENT-HIDDEN`, `PARTIAL`, `MISSING`, `NOT-APPLICABLE`, `BLOCKED-BY-CONTRACT`.

Exit gate: no CX capability in the source inventory exists without a parity disposition.

### Phase B — Global navigation parity

B1. Driver / Owner Driver navigation.
B2. Fleet navigation.
B3. Dispatcher navigation.
B4. Carrier/Admin navigation.
B5. Customer navigation.
B6. Broker navigation.
B7. Finance/Compliance/Viewer navigation.
B8. Decide which items are direct top-nav and which live in More/Workspace menus based on role and viewport.

Exit gate: every required module is reachable without hidden or contradictory navigation.

### Phase C — Marketplace / Loads parity

C1. Search filters.
C2. min/max vehicle parity.
C3. saved defaults/recent search.
C4. On Demand / Regular / Daily Hire deterministic tabs.
C5. List View.
C6. Freight Radar.
C7. clustering/freshness.
C8. Quote Now / contact preference.
C9. alerts/notifications integration assessment.
C10. pagination and expand/collapse.

### Phase D — Quotes / award / booking

D1. Carrier quote states.
D2. Load-poster quote comparison.
D3. reputation/feedback visibility.
D4. dismiss/book.
D5. award/confirmation.
D6. won-load notification.
D7. allocate driver + vehicle.

### Phase E — Diary / Jobs / execution

E1. all Diary status tabs.
E2. compact/expanded/full-history records.
E3. persistent action rail.
E4. authoritative lifecycle.
E5. notes/order/documents/history.
E6. POD.
E7. feedback/recent feedback.
E8. invoice preview.
E9. multi-drop review.

### Phase F — Fleet resources and availability

F1. Drivers.
F2. Vehicles.
F3. Drivers & Vehicles consolidated access.
F4. Live Availability.
F5. Future positions.
F6. Nearby.
F7. Return Journeys.
F8. tracking freshness.
F9. locate/contact/message.
F10. telematics integration readiness.

### Phase G — Freight Vision / Tracking

G1. booking-in-progress feed.
G2. tracked/untracked.
G3. on-time/behind/late/not-started signals.
G4. live map.
G5. route history where authorised.
G6. exception rail.
G7. contact/Messenger.

### Phase H — Customer and Broker end-to-end

H1. Post Load.
H2. receive/compare quotes.
H3. award.
H4. confirmation.
H5. active delivery.
H6. tracking.
H7. POD/evidence.
H8. invoice.
H9. feedback/dispute.

### Phase I — Finance

I1. AP/AR information architecture.
I2. Ready to Invoice.
I3. Draft.
I4. Awaiting Payment/Approval.
I5. Overdue.
I6. Paid.
I7. external invoice upload.
I8. off-platform reconciliation.
I9. batch actions if supported.
I10. statements/export.
I11. finance roles.

### Phase J — Directory / Messaging / Event Log / Settings

J1. Directory/member profile/reputation.
J2. Messenger entry points.
J3. notification preferences.
J4. smart/en-route alerts equivalent.
J5. Event Log.
J6. Company Profile.
J7. users/roles.
J8. documents/compliance.
J9. telematics integration settings.

### Phase K — Role-specific dashboards

Only after underlying workflows exist.

K1. Driver.
K2. Owner Driver.
K3. Fleet.
K4. Dispatcher.
K5. Carrier/Admin.
K6. Customer.
K7. Broker.
K8. Finance.
K9. Compliance.
K10. Viewer.

For each dashboard:
- identify primary operational decisions;
- determine signals dynamically from those decisions;
- do not impose a universal KPI count;
- keep action/queue surfaces above analytics where appropriate.

### Phase L — Cross-workspace regression and release gate

L1. structural contract tests.
L2. TypeScript.
L3. ESLint.
L4. focused Vitest suites.
L5. full Vitest suite where feasible locally.
L6. production build locally.
L7. browser route walkthrough via local environment.
L8. PowerShell verification because GitHub Actions is not available for this project run.
L9. visual comparison against supplied CX screenshots.
L10. role-permission verification.
L11. DB/API/RLS verification for any protected-contract changes.
L12. final parity ledger must have no unexplained `MISSING` or `PARTIAL` capability.

## 10. Self-audit gate after every workspace

A workspace cannot be declared complete until the following are answered:

1. Are all required top-nav modules reachable?
2. Are all page tabs/status categories present?
3. Are all required search/filter controls present?
4. Are List/Map modes present where required?
5. Is Expand All / Collapse All present on expandable result surfaces?
6. Are contextual actions available at the correct record state?
7. Are hidden/protected details still protected?
8. Does the workflow complete end-to-end without dead navigation?
9. Are role permissions correct?
10. Is the dashboard using the correct role-specific signals rather than a template count?
11. Does the page follow the 2026-08-29 XDrive spacing/density contract?
12. Are all tests for that workspace added/updated?

Required scorecard:
- FUNCTIONAL PARITY: X/Y
- NAVIGATION PARITY: X/Y
- WORKFLOW PARITY: X/Y
- VISUAL/DENSITY PARITY: X/Y
- OPEN GAPS: explicit list
- BACKEND/SECURITY GAPS: explicit list

## 11. Immediate next actions on the active branch

1. Create the detailed CX capability parity ledger from this source inventory.
2. Fix Company Marketplace load-type tab stale-state issue.
3. Audit top navigation role-by-role against CX capability coverage.
4. Finish Carrier/Broker route-level audits.
5. Convert Live Availability KPI wall to role-appropriate compact signals without changing shared KPI primitives globally.
6. Audit Directory, Messaging, Event Log and notification entry points.
7. Audit Finance against invoice/AP/AR source set.
8. Audit Feedback/Dispute workflow.
9. Audit multi-drop handling.
10. Audit Return/Future Journey matching and alerts.
11. Run branch-wide self-audit before local PowerShell validation.

## 12. Definition of complete

This convergence stream is complete only when:

- every relevant official CX capability in this plan has an explicit XDrive disposition;
- every relevant XDrive role can complete its real operational workflow end-to-end;
- missing capabilities are implemented or explicitly documented as not applicable with product justification;
- no dashboard is shaped by an arbitrary universal KPI count;
- CX-like density, progressive disclosure and operational clarity are achieved with XDrive branding;
- privacy, RLS, permissions, lifecycle integrity, POD and invoice contracts remain correct;
- local PowerShell build/typecheck/test verification is complete;
- the final parity ledger contains no unexplained gaps.
