# XDrive Driver — reference UI radiography

Date: 2026-09-06
Workstream: `driver/phone-golden-20260718-modernization`
PR: #510 (DRAFT / NOT MERGED)

## Purpose

This document converts the user-supplied courier-exchange screenshots into an implementation specification for XDrive Driver. The screenshots are a functional and interaction benchmark, not a license to copy CX branding, logo, trade dress, yellow-dominant palette, exact iconography, wording, or proprietary visual identity.

XDrive visual identity has priority: light-first surfaces, white/light-grey content, XDrive navy/royal-blue structure, sparse orange accent, clear status colours.

## 1. Global mobile shell

The key benchmark is a native-feeling fixed shell, not a web page inside a phone.

- Status-bar region sits over a dark/navy top chrome where applicable.
- Main header / segmented control is visually fixed at the top of the screen.
- Bottom navigation is fixed and always visible on primary screens.
- Only the central content viewport scrolls.
- Never wrap the entire application shell in one global `ScrollView`.
- No full-screen vertical rubber-band effect where header and bottom navigation move with content.
- Detail screens may have a fixed top segmented control and fixed bottom primary action while the body scrolls independently.
- Main content background is very light grey; information cards are white with subtle border/shadow and rounded corners.
- Horizontal screen padding is visually consistent, roughly 4–5% of screen width.
- Primary cards occupy almost the full available width with 16–24dp-style gutters and 16–24dp corner radii.

## 2. Primary navigation model

Benchmark IA shown in the supplied references:

1. Home / Live work
2. Alerts
3. Quotes
4. Bookings / My Jobs
5. More

For XDrive the semantics should remain XDrive-native but the hierarchy should be equally obvious. Bottom navigation must use stable icons + labels and an active-state treatment. Badge counts may appear on Alerts.

## 3. Home screen anatomy

Top hero / operational panel:

- Compact XDrive Driver mark centered or strongly anchored.
- Driver/profile access on one side; messaging/communication entry on the other.
- Current day/date displayed below branding.
- Driver/vehicle card showing driver identity and assigned vehicle.
- Tracking card showing whether location/tracking is active.
- Availability/status row with a clear CTA to update driver status.

Below the hero:

- Three quick actions in rounded pills: Search, Nearby / network discovery, Journeys / return-load intelligence.
- Light-grey content area.
- Large white information/status card below when needed.

XDrive adaptation:

- Use navy/royal blue instead of CX charcoal/yellow trade dress.
- Orange may indicate attention but must not dominate.
- Keep the same information density and clear operational hierarchy.

## 4. Live Loads / Inbox anatomy

Top control row:

- Segmented control for active boards such as Live / Saved / Hidden.
- A compact location/map action on the right.
- The segmented control remains visually anchored while the list scrolls.

Each live-load card should contain:

### Company header
- trust/verified indicator where legitimately available;
- posting company name;
- member/company reference where available;
- posted time/date;
- required vehicle class;
- origin context such as home-location / distance-to-pickup when available.

### Status tags
Use small pills only for real data, e.g.:
- NEW;
- priority/hot job;
- payment/financial protection state;
- fixed-price / quote-only;
- other XDrive-specific verified flags.

Do not fabricate tags.

### Route block
- clear numbered stop 1 and stop 2 markers;
- pickup town/outcode and delivery town/outcode in strong type;
- collection/delivery windows below each stop;
- dotted vertical route connector;
- support multi-stop jobs by extending the same numbered pattern.

### Load summary
- cargo description;
- pallets / dimensions / weight where available;
- special requirements / ADR / tail-lift / equipment where applicable;
- truncate long notes in list view, with full detail on open.

### Primary action
- full-width high-visibility XDrive CTA such as `Quote` / `View Job`;
- use XDrive royal blue for normal primary action, green only for positive/completed states, orange for sparse attention states.

## 5. Quotes

Top segmented views should distinguish at least:

- Submitted / Active
- Accepted / Awarded where useful
- Unsuccessful / Closed

Quote card anatomy:

- company + job reference;
- vehicle;
- route block;
- quote state badge;
- driver's quoted amount;
- clear accepted / rejected / withdrawn / expired result.

Empty states:

- centered illustration/icon;
- short title;
- one concise explanatory sentence;
- keep bottom navigation fixed.

## 6. Bookings / My Jobs

Top title remains stable.

Time filters:

- Current
- Past 7 days
- Past 14 days
- optionally broader history via horizontal filter strip.

Booking card:

- company + load reference;
- lifecycle/payment tags;
- route block;
- journey distance/time;
- job notes preview;
- POD action when relevant.

Empty booking state should be visually intentional rather than an empty blank list.

## 7. Booking / job detail

Top segmented control:

- Summary
- Stops
- Status

This top control remains fixed/anchored while detail content scrolls.

### Summary
- company name and load/job ID;
- Call and Message actions only after allocation when contact access is permitted;
- route block;
- View on Map/navigation action;
- distance + ETA;
- vehicle/equipment/load details;
- notes in a distinct light-grey panel;
- long notes remain readable through internal body scrolling, without moving the whole app shell.

### Stops
- sequential numbered stops;
- support 2-stop and multi-stop jobs;
- each stop shows time, company/site, public/full address according to allocation privacy;
- tap a stop for a focused detail view;
- stop detail view supports copy-address and close/back interaction.

### Status
Use a vertical lifecycle timeline with clear completed/current/future states. XDrive canonical lifecycle:

1. Awarded / Allocated
2. Accepted where contract requires it
3. On My Way to Pickup
4. On Site Pickup
5. Loaded
6. On My Way to Delivery
7. On Site Delivery
8. Delivered / POD
9. Invoice / financial completion when applicable

Completed stages use green confirmation; current stage is visually prominent; future stages remain neutral.

## 8. POD / evidence behaviour

The screenshots show POD as a first-class job object. XDrive should keep:

- pickup evidence before Loaded where required;
- delivery evidence;
- recipient/signature capture;
- POD photos/documents;
- CMR/document attachment where required;
- View POD from completed booking;
- immutable server-confirmed state before displaying a successful completion.

Never report POD/status success solely because an offline queue accepted a local action.

## 9. More screen

Use a calm two-column utility grid of large white tiles on light-grey background.

Candidate XDrive modules:

- Earnings / SmartPay equivalent
- Directory / Network
- Documents
- Vehicle
- Availability
- Performance
- Offline queue
- Help & Support
- Settings

Avoid turning More into a long dark dashboard.

## 10. Behaviour / motion rules

- Navigation should feel fixed and deterministic.
- No draggable-looking entire page.
- No double-render / ghost page behind current content.
- Do not stack two visible full-screen shells.
- Cards scroll inside the content viewport.
- Bottom nav does not scroll.
- Fixed bottom CTA on job execution screens may sit above bottom nav.
- Horizontal segmented controls may scroll only if their own width requires it.
- Swipe actions are allowed only when deliberate and discoverable; never make the entire screen feel movable.

## 11. XDrive visual system derived from the references

The benchmark qualities to preserve:

- high contrast;
- big tap targets;
- rounded cards;
- short labels;
- clear route hierarchy;
- visible job state;
- generous but not wasteful spacing;
- fixed navigation;
- dense operational information without looking like a desktop admin dashboard.

XDrive colours:

- App background: `#F4F6F8`
- Surface/card: `#FFFFFF`
- Primary navy: `#0B2F6B`
- Royal blue: `#1D57D8`
- Secondary blue: `#0E3FA9`
- Orange accent: `#F5A300` (sparse)
- Main text: `#1A1F2B`
- Muted text: `#667085`
- Border: `#D8E0EA`
- Success: green family
- Danger: red family

Do not use yellow as XDrive's dominant interaction colour.

## 12. Data contract requirements exposed by the screenshots

Live-load cards need the API to provide, when available:

- posting company name + verified/member metadata;
- created/posted timestamp;
- vehicle requirement;
- origin/destination public areas before allocation;
- collection/delivery windows;
- cargo description;
- pallet/weight/dimension fields;
- equipment/special requirements;
- public price only when publication rules permit it;
- job distance and distance-to-pickup;
- quoteability and quote state;
- expiry and priority flags.

Allocated booking details may additionally reveal:

- full addresses;
- site/company contacts;
- telephone;
- notes;
- stop-level instructions;
- navigation coordinates;
- POD requirements;
- lifecycle history.

Privacy rule: private stop/contact details remain hidden until allocation/authorization.

## 13. Acceptance gates for the next Preview

The next XDrive Driver Preview is rejected unless all of these are true:

1. GOLDEN package remains installed and untouched.
2. Preview remains `co.uk.xdrivelogistics.driver.preview`.
3. No visible double page / ghost layer.
4. Application is light-first, not dark-first.
5. Bottom navigation is fixed.
6. Header/segmented controls are fixed or independently anchored.
7. Only the intended body region scrolls.
8. Live Loads show real backend jobs when eligible jobs exist.
9. Live Loads failure cannot be caused by an unrelated Resources request failing.
10. Job cards expose route, vehicle, time and relevant load metadata with correct privacy masking.
11. Multi-stop jobs render as a real sequence, not only pickup + delivery.
12. Quotes have submitted/accepted/closed semantics.
13. Bookings support current/history filters.
14. Job detail provides Summary / Stops / Status structure.
15. Lifecycle matches the XDrive operational state machine.
16. POD/evidence remains server-confirmed.
17. No CX branding, logo, dominant yellow palette, wording or exact trade dress is copied.
18. Physical-device E2E must pass before any production replacement decision.

## 14. Implementation priority

1. Split marketplace load retrieval from driver-resource bootstrap so Live Loads cannot disappear because profile/resources fail.
2. Replace the global shell `ScrollView` with fixed header + body viewport + fixed bottom navigation.
3. Remove double-render/ghost-layer defects.
4. Build the light XDrive shell and component primitives.
5. Rebuild Live Loads cards and route blocks.
6. Rebuild Quotes and Bookings.
7. Rebuild job detail Summary / Stops / Status.
8. Add/verify multi-stop support and POD detail.
9. Rebuild and install only the side-by-side Preview.
10. Run physical-device authenticated E2E.
