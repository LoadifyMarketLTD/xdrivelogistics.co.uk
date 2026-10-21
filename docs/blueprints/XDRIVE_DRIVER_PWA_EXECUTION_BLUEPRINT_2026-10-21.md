# XDrive Driver PWA — Professional Execution Blueprint

**Status:** execution contract  
**Date:** 21 October 2026  
**Scope:** Driver / Owner Driver PWA only  
**Product goal:** a simple working PWA for a driver to find work, quote, receive awarded work, execute the delivery lifecycle, complete POD, and — for Owner Driver only — reach invoicing after completed POD.

## 1. Non-negotiable product contract

The Driver PWA is **not** a mobile clone of the full XDrive website and is **not** a replacement for the future native application.

It is a focused operational surface.

Bottom navigation is exactly:

**Jobs | Quotes | Bookings | More**

No Home tab. No Alerts tab. No extra permanent tabs.

Courier Exchange Driver references remain the workflow and information-hierarchy benchmark, but XDrive keeps its own branding, permissions, privacy rules, data model and lifecycle.

The PWA must never show the desktop operational navbar at mobile width. It must never squeeze desktop tables into the phone viewport.

## 2. Primary user journeys

### Journey A — Find and quote work

Login → Jobs → open job → inspect full pre-award details → Quote → quote appears in Quotes.

### Journey B — Track quote outcome

Quotes → open quoted job → see one explicit outcome:
- Quote active / job still available
- Quote won / job awarded to this driver
- Unsuccessful / job awarded elsewhere
- Job withdrawn/cancelled/expired
- Quote withdrawn

When a quote is won, the job automatically becomes visible in Bookings.

### Journey C — Execute awarded work

Bookings → awarded job → Accept → On My Way → On Site Pickup → collection handover / evidence if required → Loaded → On My Way Delivery → On Site Delivery → Delivered → POD.

### Journey D — Owner Driver commercial close

Completed POD → Owner Driver sees invoice action / finance path.

A Company Driver does not receive personal invoicing actions.

## 3. Role and permission rules

### Owner Driver
Can use Jobs and Quotes when commercially eligible.
Can execute Bookings.
Can access Owner Driver finance/invoice functions after POD.
Can access supporting operational functions in More.

### Company Driver
Can execute Bookings.
Can use Jobs/Quotes only where the existing driver commercial-bidding capability permits it.
Must not receive company-owner financial/admin functions merely because those routes exist.
Must not create a personal invoice for company-owned transport work.

All UI visibility must be derived from canonical authenticated role/capabilities, not signup metadata or client-side assumptions.

## 4. PWA shell

### 4.1 Mobile frame
- Portrait-first.
- Full viewport using dynamic viewport height.
- No horizontal page scroll.
- Safe-area support at top and bottom.
- Content scrolls above a fixed bottom bar.
- One compact top bar only.

### 4.2 Top bar
Visible elements:
- XDrive identity/logo, compact.
- Current connectivity/tracking/availability indicator if authoritative.
- Notification/action badge only when real.
- No desktop navigation.

### 4.3 Bottom navigation
Four equal touch targets:
1. Jobs
2. Quotes
3. Bookings
4. More

Rules:
- minimum comfortable touch target;
- icon + short label;
- active state visually unmistakable;
- badge may show real actionable count;
- no fifth item;
- no horizontally scrolling bottom nav.

### 4.4 Shared transport card identity
Jobs, Quotes and Bookings must use the **same transport object visual skeleton** so the driver always recognises the same job.

Shared order:
1. Reference/status strip.
2. Collection → Delivery route.
3. Pickup / Delivery timing.
4. Vehicle + cargo facts.
5. Commercial/status facts.
6. Context-specific action footer.

Do not redesign the same job differently in each tab.

Status colour is an accent only:
- green = accepted/completed/healthy;
- blue = active/in progress;
- amber = waiting/action required;
- red = blocked/failed/cancelled;
- grey = inactive/archive.

No full-card traffic-light backgrounds.

## 5. Login

### 5.1 Entry
Use a Driver-specific mobile login surface backed by the existing authentication system.

Unauthenticated access to Driver PWA routes redirects to the Driver login and preserves the intended destination.

### 5.2 Login screen content
Show only:
- XDrive logo;
- Email;
- Password;
- Show/hide password;
- Sign in;
- Forgot password;
- legal/privacy links;
- concise error message.

Optional only when already supported reliably:
- Remember me / persistent session.

Do not show marketing sections, plan cards, company onboarding content or desktop navigation.

### 5.3 Login success
Default landing destination: **Jobs**.

If an active Booking exists, show a prominent **Resume active booking** strip/badge without replacing the four-tab information architecture.

## 6. Jobs tab

### 6.1 Purpose
Jobs is the marketplace/work feed.

This replaces the Courier Exchange “Alerts” role in the PWA concept: the driver comes here to see available work and quote it.

### 6.2 Jobs list header
Keep it compact:
- title: Jobs;
- result count;
- refresh;
- search/filter control;
- optional filter sheet for location/date/vehicle if backed by real data.

No KPI dashboard.

### 6.3 Job card — collapsed/front face
Every job card must show, where authoritative and permitted:

**Identity**
- XDrive job/load reference;
- live availability state: Available / Closing / Closed / Awarded as applicable;
- posted/updated time only if useful.

**Route**
- collection area;
- delivery area;
- clear directional presentation;
- collection-to-delivery distance when known.

**Timing**
- pickup date/time or window;
- delivery date/time or window.

**Vehicle/cargo**
- requested vehicle label/type;
- weight;
- pallet/item count when present;
- dimensions when relevant;
- important requirement badges such as tail lift, ADR, temperature control, document requirement.

**Commercial**
- payment terms;
- posted rate/budget only where the job contract permits driver visibility;
- if no authoritative amount: do not invent one.

**Driver state**
- Quote CTA if eligible and not already actively quoted;
- “Quoted” state if the driver already has a live quote;
- closed/sold state if the job cannot be quoted.

### 6.4 Privacy before award
Before award:
- show public collection/delivery area, not private execution detail;
- do not expose private contact names, phone numbers, exact access instructions or private customer notes;
- do not expose data that existing marketplace-public rules intentionally suppress.

### 6.5 Card actions
Primary:
- **Open Job**

Secondary/conditional:
- **Quote** if eligible;
- **View Quote** if already quoted.

No unrelated admin actions.

## 7. Job detail / quote preparation page

This is the second page after the driver opens a Job.

### 7.1 Header
- back;
- job reference;
- current availability state.

### 7.2 Route section
Show:
- collection public area;
- delivery public area;
- pickup date/time/window;
- delivery date/time/window;
- collection→delivery distance;
- estimated journey duration if authoritative.

### 7.3 Vehicle and load section
Show authoritative fields:
- requested vehicle;
- weight;
- dimensions;
- pallets/items;
- load/cargo summary;
- tail-lift requirement;
- ADR/hazardous indicator;
- temperature controlled indicator;
- environmental-zone warning when relevant;
- public load notes;
- public special requirements.

### 7.4 Commercial section
Show:
- payment terms;
- visible rate/budget if authorised;
- poster/member/company identity where the marketplace contract permits it.

Do not show private execution contacts before award.

### 7.5 Quote action area
A persistent or clearly visible Quote action opens a simple quote composer.

Mandatory field:
- **Total quote £**

Optional:
- collection ETA / “can collect within” minutes when supported;
- message to poster.

Advanced breakdown may expose:
- base amount;
- additional extras.

The simple path must not force the driver to understand backend accounting fields.

Validation:
- positive amount;
- server-authoritative eligibility;
- collection time constraints respected;
- message length respected;
- duplicate active quote prevented.

After success:
- confirmation;
- card immediately changes to Quoted;
- job appears in Quotes;
- driver is not left on a stale “Quote” CTA.

## 8. Quotes tab

### 8.1 Purpose
Quotes is the personal history/state of jobs this signed-in driver quoted.

It is not company-wide quotation history.

### 8.2 Quote list
Default ordering: newest/most relevant first.

Compact filters:
- Active
- Won
- Unsuccessful
- Withdrawn/Closed

Do not create a complex desktop filter rail.

### 8.3 Quote card — shared identity
Use the same route/timing/vehicle skeleton as the Jobs card.

Add the quote-specific commercial zone:
- quoted amount;
- collection ETA if supplied;
- submitted time;
- short quote message preview;
- quote status.

### 8.4 Explicit outcome states
The card must never silently disappear when the job changes.

Map to a plain-language state:

**Active**
- quote submitted;
- job still available;
- driver may edit/withdraw where backend permits.

**Won**
- quote accepted / job assigned to this driver;
- show **Open Booking**;
- job is present in Bookings.

**Unsuccessful**
- job awarded to another driver/carrier;
- show clear “Awarded elsewhere” / “Unsuccessful” state.

**Closed**
- job cancelled, expired, withdrawn by poster, or otherwise no longer available.

**Withdrawn**
- driver withdrew the quote.

### 8.5 Quote actions
Only where valid:
- Open details;
- Edit quote;
- Withdraw quote;
- Open Booking when won.

Never show Edit/Withdraw after job progression makes the quote immutable.

## 9. Bookings tab

### 9.1 Purpose
Bookings contains jobs assigned to the signed-in driver.

Marketplace browsing does not belong here.

### 9.2 Booking list filters
Keep simple:
- Current
- Completed

Optional historical period can sit inside Completed, not as a top-level PWA tab.

### 9.3 Booking card
Use the same job identity skeleton, now with execution data unlocked.

Show:
- job reference;
- execution status;
- full collection/delivery route appropriate for the awarded driver;
- pickup/delivery time;
- requested/assigned vehicle;
- agreed driver/carrier rate only when role permits;
- next operational action.

If awarded but not accepted:
- strong **Accept Job** action.

### 9.4 Booking detail
After award, unlock operational data:
- exact collection and delivery addresses;
- company/location names;
- contact person;
- telephone;
- access instructions;
- execution notes;
- attachments/documents;
- customer/internal references where permitted;
- stop list for multi-drop;
- route/navigation launch.

Private pre-award restrictions no longer apply to information required for execution.

## 10. Booking execution lifecycle

The PWA must display **one dominant next action**, based on server state.

Canonical sequence:

1. **Accept Job**
   - awarded/allocated → accepted

2. **On My Way**
   - accepted → on_my_way

3. **On Site Pickup**
   - on_my_way → on_site_pickup

4. **Loaded**
   - on_site_pickup → loaded
   - collection handover/evidence must be completed first where required;
   - Collection Pass must be verified first where required.

5. **On My Way Delivery**
   - loaded → in_transit

6. **On Site Delivery**
   - in_transit → on_site_delivery

7. **Delivered**
   - on_site_delivery → delivered
   - multi-drop stops must be complete first.

8. **Complete POD**
   - available only after Delivered.

Never present all lifecycle actions at once.

The UI must refresh server state after every mutation before enabling the next step.

## 11. Collection handover / evidence

When required before Loaded:
- show required collection evidence;
- permit camera/photo upload;
- show Collection Pass requirement and verification state where applicable;
- prevent Loaded until server confirms prerequisites.

No fake client-only “completed” state.

## 12. POD

### 12.1 Entry
POD becomes the primary action after Delivered.

### 12.2 Required fields
According to the current server contract:
- recipient name;
- recipient signature;
- at least one delivery photo.

Supported additional evidence:
- damage photos;
- POD documents;
- delivery status;
- delivered date;
- delivered item count;
- left-at details;
- notes;
- hard-copy POD acknowledgement when required.

### 12.3 Completion
The client uploads files first to authorised XDrive storage, then submits their persistent paths.

The PWA must not treat local device URIs as completed POD evidence.

After successful POD:
- show completed confirmation;
- lock duplicate unsafe submission;
- refresh Booking state.

## 13. Invoice rule

### Owner Driver
After delivery + complete POD, expose a clear **Invoice / Finance** continuation using the canonical XDrive invoicing flow.

Invoice creation must remain gated by server proof that:
- job is delivered/completed/invoiced as required;
- POD is complete;
- recipient name/signature/evidence requirements are satisfied.

### Company Driver
Do not show personal invoice creation.
The company handles invoicing in its authorised workspace.

## 14. More tab

More is intentionally short.

### Common Driver items
- Availability / live presence
- Vehicle
- Documents
- Messages
- Profile
- Settings
- Support

### Owner Driver additions where authorised
- Finance / Invoices
- other genuinely driver-relevant owner functions already supported by XDrive

Do not place desktop administration, team management, fleet administration or irrelevant company settings into PWA More.

## 15. Availability and tracking

Availability is supporting functionality, not a fifth bottom tab.

Expose current availability status from More and optionally a compact status control/indicator in the top shell.

Rules:
- pre-job availability presence and active-job tracking remain separate;
- active job execution tracking follows job state;
- PWA must not promise persistent background GPS after browser/OS suspension;
- stale/denied geolocation must not leave false live availability.

## 16. Visual execution rules

### 16.1 Reference hierarchy
Use existing Courier Exchange reference screenshots/audits to preserve:
- information density;
- route-first hierarchy;
- status clarity;
- visible commercial terms;
- actions beside the transport object;
- progressive disclosure.

Do not copy CX branding or ship CX assets.

### 16.2 XDrive mobile presentation
- full-width cards;
- small radius;
- 1px border;
- little/no decorative shadow;
- strong text contrast;
- route and time larger than secondary metadata;
- no microscopic desktop typography;
- no horizontal table;
- no oversized marketing cards;
- no decorative empty space that pushes operational data below the fold.

### 16.3 Mobile card consistency
Jobs, Quotes and Bookings share:
- same route typography;
- same pickup/delivery structure;
- same vehicle/cargo placement;
- same reference location;
- same status badge position;
- same spacing rhythm.

Only the context zone changes:
- Jobs = quote opportunity;
- Quotes = quote amount/outcome;
- Bookings = execution status/next action.

## 17. Empty/loading/error states

### Loading
Use compact skeleton cards preserving the final card geometry.

### Empty
Plain-language empty state:
- Jobs: “No matching jobs available.”
- Quotes: “You have no quotes in this view.”
- Bookings: “No current bookings.”

No fake sample jobs.

### Error
Show:
- concise problem;
- Retry;
- no destructive state reset.

401/403 must route through the existing authentication/access contract, not silently show an empty feed.

## 18. Connectivity

Operational mutations are online-authoritative.

Do not fake offline completion for:
- quote submission;
- quote edit/withdraw;
- booking status transition;
- collection handover;
- POD;
- invoice creation.

If offline:
- preserve readable already-loaded screen where safe;
- disable mutation CTA;
- show “Connection required”;
- retry only after connectivity returns.

## 19. PWA installation contract

Driver install metadata must launch directly into the Driver PWA, not the marketing homepage.

Target:
- name: XDrive Driver;
- standalone display;
- portrait-first;
- Driver start URL;
- Driver scope where technically appropriate;
- XDrive icons;
- theme/background consistent with Driver shell.

Service worker strategy:
- cache static shell/assets conservatively;
- authenticated operational data remains network-first;
- never serve stale job/quote/booking mutation state as authoritative.

## 20. Recommended component architecture

Create/reuse a small dedicated mobile layer rather than duplicating business logic:

- `DriverPwaShell`
- `DriverPwaBottomNav`
- `DriverTransportCard`
- `DriverRouteBlock`
- `DriverTimingBlock`
- `DriverCargoVehicleBlock`
- `DriverCommercialBlock`
- `DriverStatusBadge`
- `DriverJobDetail`
- `DriverQuoteComposer`
- `DriverQuoteCard`
- `DriverBookingCard`
- `DriverBookingExecution`
- `DriverPodCapture`
- `DriverMoreMenu`

The transport card primitives must be shared across Jobs/Quotes/Bookings.

Do not fork backend rules into UI components.

## 21. Existing backend contracts to reuse

Reuse current XDrive Driver mobile/server contracts rather than inventing parallel APIs:

- Driver jobs listing/detail;
- nearby/marketplace job visibility;
- driver quote submit;
- personal quote history;
- quote edit/withdraw;
- job action transitions;
- stop status / multi-drop;
- evidence upload;
- collection handover / Collection Pass;
- POD;
- attachments;
- availability presence;
- canonical invoice gate.

Where an existing endpoint is feature-flagged as “driver mobile app”, the PWA implementation must deliberately reconcile the flag semantics rather than bypass them client-side.

## 22. Acceptance criteria — Login

PASS only when:
- unauthenticated Driver PWA opens mobile login;
- successful eligible driver login opens Jobs;
- invalid credentials show useful inline error;
- blocked/inactive driver cannot access operational feeds;
- no desktop navigation appears at phone width;
- login works in installed standalone PWA.

## 23. Acceptance criteria — Jobs

PASS only when:
- available jobs render as consistent transport cards;
- route/time/vehicle/cargo/payment terms are readable without opening;
- opening a card reveals complete permitted pre-award detail;
- private execution contact data is not exposed pre-award;
- eligible driver can submit a quote;
- submitted quote persists after refresh;
- already-quoted job reflects Quoted state;
- closed/awarded jobs cannot accept an invalid new quote.

## 24. Acceptance criteria — Quotes

PASS only when:
- only the signed-in driver’s quote history is shown;
- each quote preserves the same job visual identity;
- active quote shows amount and current job availability;
- won quote exposes Open Booking;
- job awarded elsewhere is explicitly Unsuccessful/Awarded elsewhere;
- edit/withdraw appears only while valid;
- refresh does not lose quote status.

## 25. Acceptance criteria — Bookings

PASS only when:
- awarded job appears automatically;
- Accept changes authoritative server state;
- exact execution information becomes available after award;
- only the correct next lifecycle action is enabled;
- invalid/out-of-order transition is blocked;
- collection prerequisites gate Loaded;
- multi-drop completion gates Delivered/POD as required;
- POD requires authoritative evidence;
- completed POD remains visible after refresh;
- Owner Driver gets finance/invoice continuation;
- Company Driver does not get personal invoice action.

## 26. Acceptance criteria — More

PASS only when:
- More contains only driver-relevant supporting functions;
- owner-only items are capability-gated;
- company driver cannot see owner/company admin functions;
- Availability, Vehicle, Documents, Messages, Profile/Settings and Support routes are functional or omitted — never placeholder buttons.

## 27. Responsive/E2E release gate

Minimum target viewport:
- 390 × 844.

Also verify:
- 360px-class Android;
- 430px-class large phone;
- standalone PWA mode.

Required checks:
- no document horizontal overflow;
- bottom nav never overlaps primary CTA/POD controls;
- all interactive controls comfortably tappable;
- no clipped route/date/amount text;
- keyboard does not hide quote submit fields;
- browser back and in-app back do not corrupt state;
- reload restores authoritative quote/booking state.

## 28. Execution order

### Phase 1 — Shell and Login
Build Driver mobile/PWA shell, four-tab bottom nav and mobile login routing.

### Phase 2 — Shared transport card
Implement one canonical Driver transport card and prove it with Jobs.

### Phase 3 — Jobs + Quote
Jobs feed → detail → quote submit → persistence.

### Phase 4 — Quotes
Personal quote history and deterministic outcome states.

### Phase 5 — Bookings
Awarded job list, Accept and full lifecycle.

### Phase 6 — POD + Owner Driver invoice continuation
Evidence, signature, POD persistence, role-gated finance handoff.

### Phase 7 — More
Only verified supporting functions.

### Phase 8 — PWA install/offline safety
Manifest, standalone start, service worker strategy, mobile E2E.

## 29. Final implementation prohibition list

Do not:
- add Home;
- add Alerts;
- add a fifth permanent bottom tab;
- reuse the desktop navbar on phone;
- render desktop tables horizontally;
- invent job data;
- fabricate quote/booking states;
- expose pre-award private contact/instructions;
- show every lifecycle action simultaneously;
- create a second business-logic implementation beside existing APIs;
- allow company drivers to invoice personally;
- claim background GPS guarantees a browser cannot provide;
- mark the PWA complete without authenticated Jobs → Quote → Award → Booking → POD verification.

## 30. Definition of Done

The Driver PWA is complete only when an eligible test driver can, on a phone-sized authenticated session:

**Login → Jobs → Open Job → Quote → see quote in Quotes → receive award → see Booking → Accept → On My Way → On Site Pickup → Loaded → On My Way Delivery → On Site Delivery → Delivered → complete POD → Owner Driver finance/invoice continuation when applicable**

and the same transport object keeps one coherent visual identity throughout the entire chain.
