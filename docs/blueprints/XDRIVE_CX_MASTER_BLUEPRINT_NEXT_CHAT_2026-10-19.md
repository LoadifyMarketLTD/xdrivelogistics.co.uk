# XDRIVE â€” CX MASTER BLUEPRINT / NEXT CHAT HANDOFF
**Updated:** 2026-10-19
**Canonical production base:** `main@c9da8e6`
**Status:** ACTIVE / PARTIALLY IMPLEMENTED / CONTINUE FROM HERE
**Scope:** 7 operational workspaces. Super Admin excluded.
**Reference:** Courier Exchange live is the final external UI/flow reference; XDrive remains authoritative for identity, permissions, compliance, Stripe, POD/invoice lifecycle, email, document ownership and branding.

---

# 0. PURPOSE OF THIS DOCUMENT

This document updates and supersedes the previous partial handoff:

`docs/blueprints/XDRIVE_CX_MASTER_BLUEPRINT_NEXT_CHAT_2026-10-19.md`

The prior version was based on `main@b783297`. Production has since advanced to `main@c9da8e6`.

This handoff records, from the real current repository state:

1. what is fully implemented and protected;
2. what has advanced since the previous handoff;
3. what is still only partially implemented;
4. what still requires current Courier Exchange live verification;
5. the exact execution order for the next chat;
6. the mandatory PowerShell/build/deploy gate;
7. anti-revert rules for concurrent agents;
8. protected production behavior outside the navbar/CX visual project.

Do **not** restart from zero. Continue from current `origin/main`.

---

# 1. NON-NEGOTIABLE GLOBAL RULES

## 1.1 Final reference

Courier Exchange live is the final external reference for:

- responsibility of each page;
- navbar/tab/subtab hierarchy;
- filter discipline;
- information order;
- map/list relationship;
- action placement;
- operational density;
- table/card scanning;
- empty/loading/error states;
- page boundaries.

Do **not** copy:

- Courier Exchange / TEG branding;
- SmartPay or other proprietary product names;
- private or irrelevant CX fields;
- sub-14px operational typography;
- CX-specific commercial advertising rails.

XDrive-specific rules always win for:

- permissions;
- legal/compliance gates;
- Stripe;
- POD;
- invoices;
- documents;
- email;
- issuer branding;
- customer/broker/carrier/driver lifecycle.

---

## 1.2 Workspaces in scope

Verify and propagate across:

1. Customer
2. Broker
3. Carrier / Admin Company
4. Fleet Manager
5. Dispatcher
6. Owner Driver
7. Company / Employed Driver

**Super Admin is excluded.**

Do not add pages/functions to a role merely to make its navbar visually match another role.

---

## 1.3 Typography contract

Global operational contract:

- Page title: **20px / 26px / 700**
- Section title: **16px / 20px / 700**
- Panel / important operational title: **16px / 20px / 700**
- Body / route / operational values: **14px / 18px**
- Labels: **14px / 18px / 600**
- Metadata / refs / badges: **14px / 18px minimum**
- Buttons / links / tabs / filters: **14px / 18px / 600**
- Active / selected: **700**
- Top navbar only: **13px / 600**
- Important names / record values: **16px / 20px / 700**

No 10px/11px/12px operational UI.

Never solve layout problems by shrinking typography below this contract.

---

## 1.4 Validation policy

**GitHub Actions are forbidden and disabled.**

Do not recreate `.github/workflows`.

Validation is local through PowerShell.

Before pushing any implementation batch to `main`:

1. fetch latest `origin/main`;
2. inspect overlapping concurrent-agent commits;
3. run protected invariant PowerShell gate;
4. run `git diff --check`;
5. run targeted tests;
6. run TypeScript;
7. run lint for touched files;
8. run authenticated browser/E2E where relevant;
9. verify desktop;
10. verify reduced viewport;
11. run full production `npm run build`;
12. commit only the verified batch;
13. fetch `origin/main` again before push;
14. reconcile overlap if another agent changed the same files;
15. push only after the branch is still clean;
16. verify `origin/main` contains the commit;
17. verify Netlify Production deploy.

Do not declare PASS before the production build and deploy are demonstrated.

---

## 1.5 Anti-revert policy

Protected production rules:

- `AGENTS.md` must remain;
- `scripts/verify-protected-workspace-invariants.ps1` must remain;
- `.github/workflows` must remain absent;
- Live Availability wheel zoom stays enabled;
- map pan, +/- zoom, marker popup, `setView`, `fitBounds` stay enabled;
- Directory Saved Network remains functional;
- Directory Companies / Drivers separation remains;
- operational typography minimums remain;
- shared components must not be replaced by old role-local copies;
- global postcode resolver/autocomplete must not be bypassed with duplicate local behavior unless explicitly opted out to avoid duplicate UI;
- My Fleet must not regain vehicle-document/compliance master-data blocks that belong in Drivers & Vehicles / resource administration;
- external notifications must not expose raw UUIDs;
- issuer invoices must not be rebranded as XDrive invoices.

Always inspect `origin/main` before editing and before pushing.

---

# 2. CANONICAL EXECUTION ORDER

The canonical page order remains:

1. Dashboard
2. Directory
3. Live Availability
4. My Fleet
5. Return Journeys
6. Loads
7. Quotes
8. Diary
9. Freight Vision
10. Drivers & Vehicles

XDrive-specific surfaces remain allowed only when they do not duplicate canonical functions:

- Action Centre
- Jobs / My Jobs
- Settings
- More

---

# 3. COMPLETED / VERIFIED FOUNDATIONS

## 3.1 Dashboard â€” PASS

**Status:** VERIFIED / IN MAIN / PRODUCTION

Implemented:

- driver dashboard aligned with verified CX dashboard hierarchy;
- duplicate Company Driver Dashboard header removed;
- Refresh moved inside Reports & Statistics;
- role-specific dashboard content preserved;
- shared visual hierarchy retained;
- seven-workspace dashboard behavior already audited in prior phase.

Key commit:

- `f1d977c â€” Align driver dashboards with verified CX dashboard layout`

Do not reopen Dashboard unless:

- a regression is found;
- a new shared global change affects it.

---

## 3.2 Directory â€” PASS WITH PROTECTED FUNCTIONALITY

**Status:** VERIFIED / IN MAIN / PRODUCTION

Implemented:

- shared CX-aligned Directory;
- Companies and Drivers sections separated;
- CX-style search/filter discipline;
- Find My Nearest;
- role-aware routes;
- Owner Driver Saved Network;
- Save Network / Remove Saved;
- Saved Network error state;
- no false claim that companies/drivers are mixed â€œas in CXâ€;
- no legacy separate Driver Directory branch;
- human/business identity presentation;
- postcode/outcode recognition inherited from global resolver.

Key commits:

- `9762375 â€” Align Directory with CX across operational workspaces`
- `cd8add6 â€” Restore saved network action and unblock production build`
- `b783297 â€” Autodetect postcode areas across operational workspaces`
- `c9da8e6 â€” Add global operational postcode autocomplete`

Protected:

- `toggleSavedCompany`;
- Save Network / Remove Saved;
- Saved Network error reporting;
- Companies / Drivers separation;
- role access boundaries.

Historical warning:
The first Directory batch introduced unused declarations that broke Netlify lint/build. Those were repaired. Never reintroduce orphan imports/state.

---

## 3.3 Live Availability â€” PASS FOR CURRENT DEFINED SCOPE

**Status:** VERIFIED / IN MAIN / PRODUCTION

Implemented:

- map visible even when result count is zero;
- pan / drag;
- +/- zoom;
- mouse-wheel zoom;
- marker popup;
- selected-driver focus;
- `fitBounds`;
- audience controls;
- Live / Future structure;
- nearest logic;
- readable global typography;
- map made visually dominant;
- compact CX-style filtering;
- unnecessary explanatory prose removed;
- canonical marketplace vehicle-size options;
- postcode/outcode area resolution;
- global postcode autocomplete integration.

Key commits:

- `21e0061 â€” Enforce readable Live Availability typography`
- `29ff678 â€” Enable full Live Availability map interaction`
- `8dd6e82 â€” Refine operational workspace visual hierarchy globally`
- `abe50c2 â€” Refine Live Availability filters against CX`
- `b783297 â€” Autodetect postcode areas across operational workspaces`
- `c9da8e6 â€” Add global operational postcode autocomplete`

Current UX rule:

Prefer:
- label;
- control;
- live resolved state.

Do not re-add filler text such as:
- â€œOFF by default. Maximum 8 hours...â€
- â€œOnly you. Your position...â€
unless legally, operationally or safety critical.

---

## 3.4 Global operational visual hierarchy â€” PASS AS FOUNDATION

**Status:** IMPLEMENTED / PRODUCTION

Implemented globally:

- stronger page-title hierarchy;
- shared card/panel density;
- wider filter/search rail;
- consistent control heights;
- normalized table density;
- stronger section contrast;
- improved navbar geometry;
- larger map presence;
- reduced-viewport collapse logic;
- consistent readable typography.

Key commit:

- `8dd6e82 â€” Refine operational workspace visual hierarchy globally`

This is a **foundation**, not proof that every remaining page is functionally final.

---

## 3.5 Global postcode/outcode area resolution â€” PASS

**Status:** IMPLEMENTED / PRODUCTION

Implemented in:

- `b783297 â€” Autodetect postcode areas across operational workspaces`
- `669aa8b â€” Align My Fleet and dedupe operational postcode presentation`
- `c9da8e6 â€” Add global operational postcode autocomplete`

Shared endpoint:

- `/api/location/postcode-area`

Shared client:

- `OperationalPostcodeAreaResolver.tsx`

Related shared field:

- `PostcodeAddressField.tsx`

Global rule:

Any operational postcode/outcode input should:

- normalize the value;
- resolve the UK area automatically;
- show the resolved area compactly;
- support autocomplete/address lookup where applicable;
- avoid duplicate manual town entry when postcode already provides the area;
- avoid duplicate `Town, postcode, postcode` presentation;
- inherit shared behavior automatically.

A page with a dedicated resolver may explicitly opt out of the global resolver only to prevent duplicate UI.

Protected new behavior:

- global resolver is shell-level;
- new operational postcode inputs should inherit behavior without custom page code;
- location presentation uses shared de-duplication logic.

---

# 4. ADVANCED / PARTIAL PAGES

## 4.1 My Fleet â€” ADVANCED IMPLEMENTATION / FINAL RE-CERTIFICATION REQUIRED

**Status:** SUBSTANTIALLY IMPLEMENTED AFTER PREVIOUS BLUEPRINT
**Do not mark final PASS yet without the final current-CX/role/viewports gate.**

Major new implementation since previous handoff:

- `669aa8b â€” Align My Fleet and dedupe operational postcode presentation`

What changed:

- removed MOT / insurance / document signal from My Fleet;
- removed master-document logic from operational fleet page;
- My Fleet now focuses on **fleet availability**, not master-data compliance;
- columns now prioritize:
  - Driver
  - Phone
  - Vehicle Size
  - Vehicle
  - Current Position
  - Location Received
  - Availability
- map remains rendered even when zero results;
- Other Drivers result count integrated into panel title;
- excessive helper descriptions removed;
- availability labels normalized;
- shared location presentation de-duplicates postcode/location text;
- shared vehicle fallback behavior hardened.

This is directionally correct and matches the core blueprint boundary:

**My Fleet = current operational fleet use**
**Drivers & Vehicles = master register/admin/compliance**

### What still prevents final PASS

Need one final current-CX certification:

1. open authenticated CX My Fleet now;
2. capture current screenshot;
3. measure layout;
4. inventory all current tabs/subtabs;
5. inventory search/filter controls;
6. inventory row/column fields;
7. verify map/list relationship;
8. compare `/admin/fleet/vehicles` 1:1;
9. verify Carrier/Admin;
10. verify Fleet Manager;
11. verify Dispatcher only where role permits;
12. confirm no master-data duplication;
13. desktop visual check;
14. reduced viewport check;
15. authenticated E2E;
16. build;
17. production deploy.

### Required duplicate matrix

`Function | My Fleet | Drivers & Vehicles | Duplicate | Decision`

Expected boundary:

- live/current position â†’ My Fleet;
- current availability â†’ My Fleet;
- operational assignment signal â†’ My Fleet;
- registration identity â†’ may be displayed, but not administered here;
- MOT/insurance/documents â†’ Drivers & Vehicles / compliance;
- add/edit vehicle â†’ Drivers & Vehicles;
- driver master profile â†’ Drivers & Vehicles.

### Next-chat first task

**Do not rebuild My Fleet from zero.**
Perform final re-certification of the `669aa8b` implementation.
If PASS, record it and move immediately to Return Journeys.

---

## 4.2 Return Journeys â€” PARTIAL / NEXT FULL PAGE AFTER MY FLEET CERTIFICATION

Existing:

- page exists;
- create/edit/delete logic;
- FROM / TO;
- availability windows;
- vehicle;
- matching relationship;
- postcode/outcode area support inherited globally.

Still required:

- current CX live screenshot and measurement;
- exact origin/destination UX;
- radius behavior;
- active/expired/future states;
- relationship to Loads;
- relationship to Diary;
- relationship to Live Availability;
- remove duplicate return-availability surfaces;
- role permissions;
- reduced viewport;
- E2E;
- production build/deploy.

Critical rule:

Return Journeys must not become a second independent availability engine.

---

## 4.3 Loads â€” ADVANCED PARTIAL / RE-CERTIFICATION REQUIRED

Historical work already exists:

- CX-like collapsed/expanded cards;
- route hierarchy;
- refresh positioning;
- card density;
- load notes;
- operational details;
- quick search;
- map synchronization;
- shared vehicle imagery;
- shared marketplace component;
- Quote Now integration;
- location/postcode de-duplication now shared.

Historical commits include:

- `cb50225 â€” Match CX Loads collapsed and expanded data layout`
- `d68ede0 â€” Place Loads refresh inside results header`
- `b04bbd7 â€” Refine CX Loads card height label order and footer`
- `d3621f9 â€” Align Loads cards with CX status header and notes`
- `741fcb9 â€” Synchronize Loads quick search with map and reset filters`
- `dbcbae0 â€” Unify Loads Quotes Diary with Admin Marketplace identity`
- `884e894 â€” Unify Quote Now across operational workspaces`
- `669aa8b â€” Align My Fleet and dedupe operational postcode presentation`

Still required:

- re-open **current CX live Loads**;
- current filter inventory;
- current toolbar inventory;
- current state/subtab inventory;
- exact card measurement;
- role-specific permissions;
- Customer/Broker/Carrier/Owner Driver differences;
- current postcode/autocomplete behavior;
- map/radar relationship if present;
- remove old helper/filler copy;
- current authenticated E2E;
- desktop/reduced viewport;
- production build/deploy.

Do not assume historical parity is current parity.

---

## 4.4 Quotes â€” ADVANCED PARTIAL

Existing:

- shared quote workflow;
- unified Quote Now;
- marketplace identity;
- multiple role surfaces;
- shared location presentation.

Still required:

- current CX live quote states;
- Received;
- Submitted;
- Unsuccessful;
- Archived;
- awarded/accepted mapping to XDrive lifecycle;
- one shared quote record presentation;
- one shared modal;
- remove repeated company/status/amount blocks;
- permission audit;
- customer/broker/carrier/owner-driver differences;
- quote submission E2E;
- quote response E2E;
- current visual verification;
- build/deploy.

---

## 4.5 Diary â€” PARTIAL / MAJOR CLEANUP STILL REQUIRED

Typography and shared identity are improved.

Mandatory remaining cleanup:

- remove fabricated repeated Booking Ref / Customer Ref / PO values;
- remove duplicate Pickup/Delivery blocks;
- remove duplicate POD blocks;
- remove carrier-profile links from Diary;
- move cargo/account/profile details to Order / Job Details;
- remove redundant Open Booking where Order/Job already serves the detail function.

Final action bar target:

`Leave Feedback | POD | Order | Notes | History | Documents | View invoice (Â£)`

Search rail target:

- Contacts
- Payment Report (permission based)
- All
- Jobs Sub-contracted
- Our Bookings
- Date
- Pickup Time Within
- Delivery Time Within
- Load ID / Ref
- Member / Driver
- Booked by
- Customer Name
- Groups
- Save as Default
- Search
- Clear
- View Archived Bookings

Toolbar target:

- List View / Split View
- Expand / Collapse All
- Refresh
- state tabs
- items/page
- pagination

Rule:

**Diary = operational register, not Job Details.**

---

## 4.6 Freight Vision â€” PARTIAL

Existing:

- page;
- map/tracking capabilities;
- operational execution data.

Still required:

- current CX Freight Vision live audit;
- execution-only responsibility;
- active jobs;
- list/map synchronization;
- vehicle/driver positions by permission;
- job overlays;
- status filters;
- no availability-discovery duplication;
- no Return Journey management duplication;
- no driver-register duplication;
- role verification;
- desktop/reduced viewport;
- E2E;
- build/deploy.

Boundary:

**Live Availability = available capacity**
**Freight Vision = active execution/tracking**

---

## 4.7 Drivers & Vehicles â€” PARTIAL

Existing:

- resources page;
- driver/vehicle administration;
- status/compliance/readiness data.

Still required:

- current CX Drivers & Vehicles audit;
- split/merge decision for driver and vehicle registers;
- remove duplicate master pages/routes;
- ensure My Fleet does not regain master-data management;
- assignment relationship;
- compliance/readiness;
- add/edit flows;
- role permissions;
- visual parity;
- E2E;
- build/deploy.

Boundary:

**Drivers & Vehicles = master-data / register / admin**
**My Fleet = operational fleet availability/use**

---

# 5. GLOBAL UX CLEANUP STILL REQUIRED

## 5.1 Remove empty intermediate action rows

User explicitly identified this pattern as wrong:

`Page Header â†’ empty bordered action row â†’ real toolbar â†’ content`

Target:

`Page Header â†’ real content toolbar â†’ content`

If a row contains only right-side actions and no meaningful left content:

- move those actions into the next real toolbar/section header;
- remove the empty bordered spacer;
- remove unnecessary min-height/padding/background/border.

This must be checked globally, not only Live Availability.

---

## 5.2 Remove unnecessary helper prose

Operational screens must not explain obvious controls.

Remove text that:

- repeats the selected state;
- pushes controls downward;
- explains ordinary UI behavior;
- adds no legal/safety/operational value.

Keep only:

- validation;
- error;
- live resolved state;
- legal/compliance warning;
- essential permission reason.

---

## 5.3 Controls over prose

Search/filter rail structure should be:

- label;
- control;
- action.

Avoid:

- label;
- explanatory paragraph;
- second paragraph;
- control;
- another explanatory paragraph.

---

## 5.4 Postcode/autocomplete

This is now a global protected capability.

Every operational postcode/outcode input must:

- normalize input;
- resolve area;
- display area compactly;
- support autocomplete/address selection where relevant;
- avoid duplicate town/postcode display;
- use shared resolver, not page-specific duplicated fetch logic unless strictly necessary.

---

## 5.5 Vehicle taxonomy

Where a field is **Vehicle Size**, it must use the canonical marketplace vehicle taxonomy, not values derived only from currently loaded records.

Do not show â€œAny vehicleâ€ as if it were the only meaningful choice when the page should provide actual vehicle categories.

Keep the shared marketplace vehicle-size options authoritative.

---

# 6. XDRIVE-SPECIFIC FUNCTIONAL BOUNDARIES

## Action Centre

Intervention items only:

- POD review;
- quote decision;
- compliance issue;
- invoice/payment issue;
- dispute;
- acknowledgement.

Do not duplicate Notifications.

---

## Jobs / My Jobs

Purpose:

- execution after award/allocation.

Do not duplicate:

- marketplace;
- Diary.

---

## More

Secondary tools only.

Do not duplicate canonical navbar functions inside More.

---

# 7. DUPLICATE AUDIT REQUIRED ON EVERY REMAINING PAGE

Use:

`Function | Navbar | More | Dashboard | Page | Duplicate | Decision`

Allowed decisions:

- KEEP
- MOVE
- MERGE
- REMOVE

Known duplicate risks:

- Availability under More vs Live Availability;
- Return Journeys duplicate routes;
- Drivers / Vehicles duplicate register pages;
- Booking / Customer / PO repeated refs;
- POD state/action/detail repetition;
- Pickup/Delivery repetition;
- profile links in Diary;
- Open Booking vs Order/Job Details;
- My Fleet compliance/master data vs Drivers & Vehicles.

---

# 8. PROTECTED PRODUCTION WORK OUTSIDE THE CX NAVBAR BLUEPRINT

Do not revert these while implementing UI work.

## External references / notifications

- raw UUIDs removed from external operational notifications;
- human references used instead.

Commit:
- `f0ab38a â€” Use human references in external notifications`

## Transactional email channels

Commits:
- `685325d â€” Route transactional email through functional XDrive senders`
- `5f566f5 â€” Align transactional email channels and public contacts`

## Invoice/document ownership

Commits:
- `f6571db â€” Use issuer branding and attach invoices from the canonical delivery path`
- `12ee020 â€” Remove platform identifiers from issuer invoices and fix PDF metadata layout`
- `74e27bd â€” Use neutral operational document footer`
- `868c9f7 â€” Add remittance advice and issuer invoice copies`

## POD / booking document delivery

Commits:
- `c7619af â€” Attach booking and POD documents to operational emails`
- `de20453 â€” Clean booking documents and date-only POD timestamps`

Rules:

- issuer invoice belongs visually/legal to issuer;
- XDrive must not rebrand issuer invoices;
- POD/booking documents must remain attached through the canonical path;
- external emails must not leak database UUIDs.

---

# 9. EXACT EXECUTION METHOD FOR NEXT CHAT

For each remaining canonical page:

1. fetch latest `origin/main`;
2. verify protected invariants;
3. inspect concurrent-agent commits touching the same files;
4. open authenticated CX live;
5. capture screenshot;
6. measure geometry;
7. inventory tabs/subtabs;
8. inventory filters;
9. inventory actions;
10. inventory states;
11. open XDrive production/local equivalent;
12. compare 1:1;
13. mark KEEP / MOVE / MERGE / REMOVE / ADD;
14. fix shared component first;
15. propagate by applicable role;
16. run duplicate audit;
17. run protected PowerShell gate;
18. run `git diff --check`;
19. run targeted tests;
20. run TypeScript;
21. run lint for touched files;
22. run authenticated E2E;
23. verify desktop;
24. verify reduced viewport;
25. run full production `npm run build`;
26. commit only verified files;
27. fetch `origin/main` again;
28. reconcile overlapping concurrent changes;
29. push only if still clean;
30. verify `origin/main` SHA;
31. verify Netlify Production deploy;
32. continue immediately to the next canonical page.

Do not wait for the user to remind you to continue.

Do not leave long silent gaps. Report only meaningful checkpoints while continuing execution.

---

# 10. NEXT CHAT â€” EXACT START POINT

## PHASE A â€” MY FLEET FINAL CERTIFICATION

Do **not** rebuild.

Start from current implementation:

- `669aa8b â€” Align My Fleet and dedupe operational postcode presentation`

Exact steps:

1. open CX live My Fleet;
2. capture current screenshot;
3. measure structure;
4. inventory tabs/filters/actions/columns;
5. open XDrive `/admin/fleet/vehicles`;
6. compare current implementation;
7. build My Fleet vs Drivers & Vehicles duplicate matrix;
8. verify Carrier/Admin;
9. verify Fleet Manager;
10. verify Dispatcher only where permitted;
11. verify map remains visible at zero results;
12. verify current-position interaction;
13. verify vehicle size taxonomy;
14. verify postcode/location presentation;
15. desktop;
16. reduced viewport;
17. E2E;
18. PowerShell gate;
19. build;
20. deploy.

If PASS:
- mark My Fleet PASS;
- do not keep changing it;
- immediately continue to Return Journeys.

---

## PHASE B â€” RETURN JOURNEYS

Perform full current-CX audit and integration check with:

- Live Availability;
- Loads;
- Diary.

Main focus:
- FROM/TO UX;
- radius;
- vehicle;
- active/future/expired;
- matching;
- no duplicate availability engine;
- postcode/autocomplete;
- role permissions.

---

## PHASE C â€” LOADS

Re-certify the current shared implementation against **current CX live**, not old screenshots.

Focus:
- filters;
- card geometry;
- expand/collapse;
- map/radar relationship;
- route hierarchy;
- actions;
- role-specific permissions;
- postcode/autocomplete;
- mobile/reduced viewport.

---

## PHASE D â€” QUOTES

Re-certify:

- state tabs;
- shared modal;
- shared record card;
- awarded/accepted lifecycle;
- role-specific permissions;
- quote submit/respond E2E.

---

## PHASE E â€” DIARY

Perform major duplicate/function cleanup from section 4.5.

Do not stop at visual changes.

---

## PHASE F â€” FREIGHT VISION

Re-certify tracking/execution boundary and remove overlap with availability/register pages.

---

## PHASE G â€” DRIVERS & VEHICLES

Re-certify master register, compliance/readiness, add/edit, assignments, permissions and remove overlap with My Fleet.

---

# 11. CURRENT PRODUCTION COMMIT ANCHORS

Current canonical base:

**`main@c9da8e6`**

Important production history:

- `f1d977c` â€” Dashboard alignment
- `9762375` â€” Directory alignment
- `cd8add6` â€” Saved Network/build repair
- `4f37f28` â€” GitHub Actions disabled / PowerShell validation
- `29ff678` â€” full Live Availability map interaction
- `8dd6e82` â€” global operational visual hierarchy
- `abe50c2` â€” Live Availability CX filter refinement
- `b783297` â€” global postcode area autodetection
- `669aa8b` â€” My Fleet alignment + location presentation de-duplication
- `c9da8e6` â€” global operational postcode autocomplete

---

# 12. CURRENT PASS MATRIX

| Canonical page | Current state | Next action |
|---|---|---|
| Dashboard | **PASS** | Protect only |
| Directory | **PASS** | Protect only |
| Live Availability | **PASS** | Protect only |
| My Fleet | **ADVANCED / FINAL RE-CERTIFICATION REQUIRED** | First task next chat |
| Return Journeys | **PARTIAL** | Full current-CX audit |
| Loads | **ADVANCED PARTIAL** | Re-certify current CX |
| Quotes | **ADVANCED PARTIAL** | Re-certify current CX |
| Diary | **PARTIAL / CLEANUP REQUIRED** | Major duplicate/function cleanup |
| Freight Vision | **PARTIAL** | Full current-CX audit |
| Drivers & Vehicles | **PARTIAL** | Full current-CX audit + dedupe |

---

# 13. FINAL INSTRUCTION TO THE NEXT AGENT

Continue execution autonomously.

Do not ask the user to repeat requirements already in this blueprint.

Do not call something PASS because:

- the page exists;
- an old test passes;
- TypeScript passes;
- a historical commit touched it;
- it looks similar to CX;
- another agent said it was done.

A canonical page is PASS only after:

- current CX live comparison;
- current XDrive verification;
- role/access verification;
- duplicate audit;
- functional verification;
- desktop verification;
- reduced viewport verification;
- PowerShell invariant gate;
- tests;
- TypeScript;
- lint where applicable;
- production build;
- production deploy.

Protect completed work from concurrent agents:

- fetch before editing;
- fetch before pushing;
- inspect overlap;
- never blindly reset/cherry-pick old branches over current main.

**Immediate next task: My Fleet final certification, then Return Journeys.**
