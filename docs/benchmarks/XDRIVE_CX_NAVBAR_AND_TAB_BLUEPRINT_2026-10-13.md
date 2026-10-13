# XDrive Logistics — CX Navbar & Operational Tab Blueprint

**Status:** authoritative implementation blueprint  
**Date:** 13 October 2026  
**Scope:** all non-Super-Admin operational workspaces  
**Reference:** live Courier Exchange session in Opera + current XDrive production + current `TopWorkspaceShell` role navigation

## 1. Objective

XDrive must retain its own modern identity while adopting the information architecture discipline observed live in Courier Exchange (CX): clear primary navigation, strong page hierarchy, one operational object per card, stable status language, visible commercial terms, and compact but readable density.

This document is not a pixel clone specification. It is the canonical visual/functional contract for bringing Customer, Broker, Carrier/Company Admin, Fleet Manager, Dispatcher, Owner Driver, Driver, Finance and Compliance to one coherent operational system. Super Admin remains outside this visual convergence.

## 2. Evidence and live measurements

Measurements below were taken from the live Opera desktop session on a 1920×1080 primary display using Windows UI Automation. Coordinates include browser chrome, so X/Y positions are evidence of alignment; the dimensions are the useful comparison.

### 2.1 Courier Exchange live top actions

| Control | X | Y | W | H |
|---|---:|---:|---:|---:|
| POST LOAD | 1458 | 92 | 122 | 32 |
| BOOK DIRECT | 1595 | 92 | 141 | 32 |

### 2.2 Courier Exchange live primary navbar

All observed primary navbar items were **29 px high**.

| Tab | Width |
|---|---:|
| Dashboard | 102 px |
| Directory | 91 px |
| Live Availability | 145 px |
| My Fleet | 76 px |
| Return Journeys | 143 px |
| Loads | 61 px |
| Quotes | 71 px |
| Diary | 58 px |
| Freight Vision | 121 px |
| Drivers & Vehicles | 149 px |

### 2.3 XDrive Customer live primary navbar

All observed Customer primary nav items were also **29 px high**, demonstrating that the fundamental nav geometry is already close to CX.

| Tab | Width |
|---|---:|
| Dashboard | 102 px |
| Loads | 62 px |
| Quotes | 72 px |
| Bookings | 88 px |
| Diary | 57 px |
| Tracking | 86 px |
| Network | 84 px |
| Action Centre | 124 px |
| More | 74 px |

Top action controls in XDrive Customer measured **33 px high**: Post Load 97×33, Book Direct 110×33, Sign out 74×33.

**Conclusion:** the major visual defect is not the raw navbar height. It is the hierarchy and anatomy below the navbar, especially flat tables that fail to present each transport object as a coherent operational card.

## 3. Canonical navbar contract

### 3.1 Primary navigation

- Shell header: **50 px target**.
- Navbar strip: **42 px target**.
- Visible nav control height: **29 px**.
- Nav label: **13 px**, **600**, **18 px line-height**.
- Horizontal padding: **13 px** per side.
- Active underline: **2 px**.
- Active state: subtle neutral/blue surface, never a large filled pill.
- Default text: neutral dark grey; active text: XDrive navy.
- No shadows.
- No vertical jump when active.
- All roles use the same geometry; only labels/routes differ.
- Keep essential workflow tabs primary. Secondary/administrative surfaces go under **More**.
- Never expose a route merely because it exists: role capability remains authoritative.

### 3.2 Header actions

- Primary commercial actions: **32–33 px** high.
- Primary action order: task CTA first, utility actions after.
- Maximum two high-emphasis CTAs in header.
- Notification and account/sign-out remain visually secondary.
- Header actions must never force the nav strip to wrap.

### 3.3 Right-edge utility / Burger menu

The live CX navbar has one additional control at the extreme right edge: a compact **Burger / utility menu**. It is part of the navbar system and must not be omitted from the XDrive blueprint.

Observed live behavior:
- compact square control at the far-right of the primary navbar;
- notification/state indicator can appear on the control;
- opens a right-side account/utility menu without replacing the current operational page;
- observed menu entries include: **My Profile, Feedback, Settings, Get Started, Company Profile, Documents, Users / Drivers, Other**;
- the signed-in member identity is shown at the top of the menu;
- menu is visually distinct from the operational primary tabs.

XDrive contract:
- place a Burger / utility control as the final right-edge navbar item where the role has secondary account/company utilities;
- target visible control box: **29 × 29 px**, aligned to the same 29 px nav-control height;
- icon: three-line/menu glyph, 16–18 px visual size;
- use a small notification dot/badge only when there is real unread/actionable state;
- opening the control displays a right-aligned dropdown/drawer anchored to the navbar edge;
- utility menu must contain account/company/support/admin surfaces, not core transport workflow tabs;
- role capability filtering remains mandatory;
- suggested grouping: Account (Profile, Settings), Company (Company Profile, Team/Users, Documents), Help (Get Started, Support/Feedback), Other role-authorised utilities;
- keyboard: Enter/Space opens; Escape closes; focus is trapped within the open menu until closed or a destination is chosen;
- clicking outside closes;
- mobile/tablet may merge this utility menu with the general navigation drawer, but Account/Company/Help grouping remains intact.

### 3.4 Responsive behavior

- Desktop ≥ 1280: primary nav remains one horizontal row.
- Tablet 768–1279: preserve role-critical tabs; move low-frequency items into More.
- Mobile < 768: use overflow/drawer navigation; do not horizontally shrink labels below 12 px.
- No nav item may become narrower than its readable label + 20 px combined side space.

## 4. Shared page hierarchy

Every operational page follows this hierarchy:

1. **Page Header** — eyebrow, title, description, page actions.
2. **Filter/Search region** — rail or horizontal card depending workflow density.
3. **Status / lifecycle tabs**.
4. **Result summary/meta strip**.
5. **Operational card stack**.
6. **Expanded details / dialogs / drawers** only when requested.

### 4.1 Shared dimensions

| Primitive | Target |
|---|---:|
| Page horizontal padding | 12 px |
| Page top padding | 12 px |
| Major section gap | 16 px |
| Operational block gap | 8–12 px |
| Filter rail width | 165 px |
| Filter rail → content gap | 12 px |
| Status tab height | 28 px |
| Panel/card header | 36 px |
| Dense body control | 24 px |
| Primary workflow button | 28–32 px |
| Table header | 40 px |
| Secondary table row | 42 px |
| Border | 1 px |
| Radius | 4 px |
| Card shadow | none |
| Page title | 20 px |
| Section title | 14 px |
| Panel/card title | 13 px |
| Body | 12 px |
| Label/meta | 11 px |
| Micro meta | 10–11 px |

## 5. Canonical operational card anatomy

Core transport objects — load, quote, booking, job, diary entry, return journey, tracked job — must not default to a flat full-width table row.

### 5.1 Desktop card

A standard operational card contains:

**Header — 32–36 px**
- XDrive reference
- customer/external reference where authorised
- lifecycle/status badge
- context action such as Open / View details

**Main body — 72–96 px**
- Zone A (30–36%): FROM / TO, collection and delivery location
- Zone B (22–28%): pickup / delivery windows, distance, vehicle
- Zone C (22–28%): weight, packaging, dimensions, special requirements
- Zone D (16–22%): commercial/status data — price, quote state, Payment Terms, member/carrier

**Notes strip — 26–36 px when present**
- public quote notes, load notes or execution-safe summary
- never mix private execution instructions into pre-award visibility

**Footer — 28–36 px**
- workflow actions
- quote/booking outcome
- message/archive/track/POD actions
- lowest-priority metadata

Typical target height:
- **116–132 px** without notes
- **144–168 px** with notes/footer expansion

### 5.2 Status color discipline

- Green: completed/accepted/healthy.
- Blue: active/in progress/informational.
- Orange: awaiting action/attention.
- Red: blocked/failed/cancelled/critical.
- Grey: archived/neutral/inactive.
- Status color is an accent, not the card background.

### 5.3 Commercial visibility

Where legally/operationally relevant, every transport card must surface:
- price / agreed rate / budget according to role,
- **Payment Terms: Pay now / 14 days / 30 days only**,
- payment status where authoritative,
- customer charge / carrier cost / margin only to roles permitted to see them.

No 45/60/90-day base term is allowed anywhere in posting, card display, API input or finance settings.

## 6. Courier Exchange tab radiography and XDrive target

### 6.1 Dashboard

**Observed live CX functions**
- Reports & Statistics
- Gross Margin
- Sub-contract Spend
- Accounts Payable
- Latest invoices / invoices due / awaiting payment / monthly totals
- Reports: bookings received, bookings sub-contracted, loads allocated, return journeys
- Feedback in Last 90 Days
- Payment Performance
- Delivery Performance
- Activity at a glance
- Latest Bookings
- POD/Track actions
- Compliance / supplier status

**XDrive blueprint**
- Use a two-column dashboard at desktop.
- Left: financial/statistical cards and reports.
- Right: operational activity / latest bookings.
- Latest booking is a mini operational card, not a table row.
- Dashboard KPI tiles: 2-column groups, 106 px target on desktop.
- Financial panels must never expose restricted values to operational-only roles.

### 6.2 Directory / Network

**Observed live CX functions**
- Search
- Find My Nearest
- Country
- Member Name / ID
- Location / radius
- Vehicle size
- Body type
- Phone / email
- Specialist services
- Company / Driver result modes
- Sort

**XDrive blueprint**
- Customer label may remain Network; carrier/owner-driver may use Directory.
- 165 px filter rail on dense desktop search.
- Result card shows company/member identity, member ID, location, fleet capability, specialist services, verified contact state and relationship state.
- Search must support name, member ID and location.
- Private contact data appears only where the relationship/role permits it.

### 6.3 Live Availability

**Observed live CX functions**
- Add Future Position
- Live / Future
- UK & Euro / Euro
- Radius
- Availability status
- Member / Driver
- Vehicle size
- Body type
- Register vehicles
- Drivers & Sub-contractors / Other Drivers
- map clustering and availability states

**XDrive blueprint**
- Primary tabs: Live, Future.
- Map/list switch.
- Availability states: Available, Maybe Available, Unavailable, Unknown.
- Driver/vehicle card: member, vehicle type, capacity, last position, availability window, distance.
- Fleet Manager/Dispatcher can act; Customer cannot mutate fleet availability.

### 6.4 My Fleet

**Observed live CX functions**
- Live / Future
- Search Panel
- radius
- availability
- member/driver
- vehicle size/body type
- Groups / Add or Edit Groups
- Register vehicles
- availability status and map clustering

**XDrive blueprint**
- Fleet summary header + filters + vehicle/driver card grid or dense rows.
- Direct actions: assign, availability, vehicle, documents, tracking.
- Group management must be secondary, not dominant.
- Cards must clearly distinguish driver identity from vehicle identity.

### 6.5 Return Journeys

**Observed live CX functions**
- Add Journey
- Our Journeys
- UK & ROI / Euro
- From / To / radius
- recent searches
- member/driver
- vehicle size
- date
- advanced search
- Available Journeys
- Map/List
- All / Ad Hoc / Regular
- pagination
- Track / View Feedback / Book Direct

**XDrive blueprint**
- Route-first operational cards.
- Return-leg suitability shown as distance/detour/time compatibility.
- Add Journey is the primary CTA.
- Book Direct appears only when role/payment readiness permits.
- Never blend available marketplace loads with already committed return work without a clear status separator.

### 6.6 Loads

**Observed live CX functions**
- journey/load search
- UK & ROI / Euro
- From/radius
- member/driver
- vehicle size
- date / advanced search
- Available Journeys
- Map/List
- Collapse All / Refresh
- All / Ad Hoc / Regular
- pagination
- Track / Feedback / Book Direct

**XDrive blueprint**
- Each load is a transport card.
- Main card zones: route; time; cargo/vehicle; commercial/status.
- Footer actions: Quote, Open, Message where permitted.
- Quote CTA must remain obvious.
- No customer-private contact or execution instructions before award.

### 6.7 Quotes

**Observed live CX functions**
- Search Panel
- Pickup Time Within
- Delivery Time Within
- Load ID / Ref
- Booked by
- Received / Archived / Submitted / Unsuccessful
- Collapse All
- per-job FROM/TO
- Pickup/Deliver
- distance, weight, packaging, dimensions
- Requested vehicle
- Payment Terms
- Load Notes
- quote amount / quote result
- Cancel Quote
- View Details
- SOLD / unsuccessful states

**XDrive blueprint**
- This page is the strongest card reference.
- Preserve status tabs above results.
- Each quote/load becomes one bordered card, not a flat table group.
- Route and times dominate visually.
- Payment Terms sits in the commercial/status zone.
- Quote message/notes use a dedicated strip.
- Decision actions belong to the card footer.
- Customer view: Review & Send Offer / Message / Shortlist / Reject / Archive.
- Carrier/Owner Driver view: Quote / Withdraw / Message / status.
- One pending booking offer per job; state must be explicit.

### 6.8 Diary

**Observed live CX functions**
- Contacts
- Payment Report
- Jobs Sub-contracted / Our Bookings
- filters: date, pickup, delivery, load ref, member/driver, booked by, customer, groups
- List / Split
- All / Unallocated / Allocated / In Progress / Completed / Cancelled / Expired / Awaiting Feedback / Recent Feedback
- pagination
- Collapse All / Refresh

**XDrive blueprint**
- Diary is the authoritative lifecycle register.
- Route-first operational card with carrier/member and execution status.
- Expand reveals timeline, booking identity, allocation, POD, documents, invoice and history.
- Status tabs must be identical in meaning across roles.
- Replay/history actions must not change live state.

### 6.9 Freight Vision / Tracking

**Observed live CX functions**
- filters by load/member/booked by/groups
- List / Split
- All In Progress / Live Tracked
- pickup/delivery windows
- KPIs: Total, On Time, Behind ETA, Late, Not Tracked/Not Started
- current location/status updates

**XDrive blueprint**
- Customer label: Tracking.
- Carrier/Fleet label may remain Freight Vision.
- Top KPI strip + list/map or split view.
- Each tracked job card: route, current position, last update, ETA, deviation, driver/vehicle, status.
- Behind/Late must be visually strong but not full-card red unless critical.
- Stale tracking state must be explicit.

### 6.10 Drivers & Vehicles

**Observed live CX functions**
- Users / Drivers
- Company Vehicles
- Vehicle Tracking
- search
- Add Vehicle
- pagination
- Name / Size-Type / Year / Max Weight / Notify When Tracked
- per-vehicle Event Log
- Documents

**XDrive blueprint**
- Tabs: Drivers, Vehicles, Tracking, Documents where capability allows.
- Card/table hybrid is acceptable because this is resource inventory, not a transport lifecycle feed.
- Primary data: identity, type, registration/member ID, capacity, availability, compliance state.
- Secondary actions: event log, documents, edit, tracking.
- Add Vehicle is a single primary CTA.

## 7. Role-specific XDrive primary navigation

The current code already defines the role map. The visual blueprint must preserve these role-specific workflows while using the common geometry.

### Customer
Dashboard · Post Load · Loads · Quotes · Bookings · Diary · Tracking · Network · Action Centre · More

### Broker
Dashboard · Action Centre · Enquiries · Loads · Carrier Quotes · Jobs · Diary · POD Review · Finance · Settings · More

### Carrier / Company Admin
Dashboard · Directory · Live Availability · My Fleet · Return Journeys · Loads · Quotes · Diary · Freight Vision · Drivers & Vehicles · Settings · More

### Fleet Manager
Dashboard · Live Availability · My Fleet · Return Journeys · Jobs · Diary · Freight Vision · Drivers & Vehicles · More

### Owner Driver
Dashboard · Action Centre · Directory · Live Availability · My Fleet · Return Journeys · Loads · Quotes · My Jobs · Diary · More

### Driver
Dashboard · Action Centre · My Jobs · Diary · Availability · Vehicle · Documents · Settings · More

### Dispatcher
Dashboard · Diary · Unallocated · Active Jobs · Collections · Deliveries · Live Positions · Settings · More

### Finance
Dashboard · Diary · Customer Invoices · Carrier Invoices · Payments · Balances · Reports · Settings · More

### Compliance
Dashboard · Driver Docs · Vehicle Docs · Company Docs · Verification · Expiry · Incidents · Settings · More

## 8. Filter placement rule

The live CX audit proves that a **165 px left rail is not inherently the problem**. It works when:
- the main result area uses strong cards,
- the rail is compact,
- the card stack has clear borders and internal sections,
- the information hierarchy is strong.

Therefore:
- dense search pages may retain a 165 px rail;
- simple 2–3 field filters may use a horizontal filter card;
- do not convert every rail to horizontal by default;
- the choice is made per workflow, not per developer preference.

## 9. Interaction contract

Every tab/function must define and test:
- hover
- keyboard focus
- pressed/selected
- disabled
- loading
- empty
- partial data
- error
- permission denied
- mobile/touch state
- persistence after refresh where state is expected to persist

Primary buttons must have clear verb labels. Generic “Details” is secondary to workflow verbs such as Quote, Review Offer, Track, Upload POD, Allocate, Message.

## 10. Responsive card behavior

### ≥ 1280 px
- filter rail + card stack where appropriate
- card body 3–4 zones
- action footer remains one row where possible

### 768–1279 px
- card body becomes 2 columns
- action footer wraps
- rail may remain 165 px until content becomes constrained

### < 768 px
- filter rail stacks above content
- card body becomes one column
- route/status stay first
- touch actions target 36–40 px high
- no horizontal data-table dependency for core workflows

## 11. Implementation order

1. Shared navbar typography/padding/underline contract.
2. Shared `OperationalCard` anatomy for transport objects.
3. Shared filter rail / horizontal-filter decision primitives.
4. Customer: Loads → Quotes → Bookings → Diary → Tracking → Network → Action Centre.
5. Broker: Enquiries → Loads → Carrier Quotes → Jobs → Diary → POD → Finance.
6. Carrier/Company Admin: Directory → Availability → Fleet → Returns → Loads → Quotes → Diary → Freight Vision → Resources.
7. Fleet Manager / Dispatcher.
8. Owner Driver / Driver.
9. Finance / Compliance.
10. Cross-role visual and functional retest.

## 12. Acceptance criteria

A page is not visually complete merely because spacing or colors match.

For every operational tab:
- each primary object has a clear card/container,
- route/status can be found in under one second visually,
- actions visibly belong to the object they affect,
- payment/commercial terms are placed consistently,
- the same status means the same thing across roles,
- no private data leaks pre-award,
- no function is lost during visual refactor,
- desktop/tablet/mobile are checked LIVE,
- keyboard and touch behavior are checked,
- production is rechecked after deploy,
- PASS requires live evidence.

## 13. Non-negotiable design principle

**XDrive must not copy the dated visual styling of Courier Exchange. It must copy the operational clarity.**

The target is: **CX information architecture + XDrive visual identity + one shared cross-role system.**
