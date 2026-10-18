# XDRIVE — CX MASTER BLUEPRINT / NEXT CHAT HANDOFF
**Updated:** 2026-10-19  
**Canonical production base:** `main@b783297`  
**Status:** ACTIVE / PARTIALLY IMPLEMENTED / CONTINUE FROM HERE  
**Scope:** 7 operational workspaces. Super Admin excluded.  
**Reference:** Courier Exchange live is the final external UI/flow reference; XDrive rules remain authoritative for identity, permissions, compliance, Stripe, POD/invoice lifecycle and branding.

---

## 0. WHY THIS DOCUMENT EXISTS

This document replaces/supersedes the partially implemented blueprint created on 2026-10-18:

`XDRIVE_CX_NAVBAR_GLOBAL_TYPOGRAPHY_MASTER_BLUEPRINT_2026-10-18.md`

The previous blueprint was implemented only in part. This handoff records exactly:

1. what has been implemented and verified;
2. what is only partially aligned;
3. what remains to be completed;
4. the exact order for the next chat;
5. the non-negotiable production gates;
6. the anti-revert rules that must protect completed work.

Do not restart the project from zero. Continue from the verified production base.

---

# 1. NON-NEGOTIABLE GLOBAL RULES

## 1.1 Reference
Courier Exchange live is the final reference for:
- page responsibility;
- information order;
- tab/subtab structure;
- filter discipline;
- operational density;
- interaction patterns;
- list/map relationships;
- visual hierarchy.

Do **not** copy:
- Courier Exchange / TEG branding;
- SmartPay;
- proprietary product names;
- private or irrelevant fields;
- typography below the XDrive readability contract.

## 1.2 Workspaces
Verify and propagate across:
1. Customer
2. Broker
3. Carrier / Admin Company
4. Fleet Manager
5. Dispatcher
6. Owner Driver
7. Company / Employed Driver

Super Admin is excluded from this blueprint.

## 1.3 Typography contract
Hard global operational contract:
- Page title: **20px / 26px / 700**
- Section title: **16px / 20px / 700**
- Panel / important title: **16px / 20px / 700**
- Body / route / value: **14px / 18px**
- Labels: **14px / 18px / 600**
- Metadata / refs / badges: **14px / 18px minimum**
- Buttons / links / tabs / filters: **14px / 18px / 600**
- Active / selected: **700**
- Top navbar only: **13px / 600**
- Important record names/values: **16px / 20px / 700**

No operational 10px/11px/12px text.

## 1.4 Validation policy
GitHub Actions are forbidden and disabled.

All validation is local through PowerShell.

Before any push to `main`:
- protected invariant PowerShell gate;
- `git diff --check`;
- targeted tests;
- TypeScript;
- lint where relevant;
- authenticated browser/E2E where relevant;
- production `npm run build`;
- visual desktop + reduced viewport check.

Do not declare PASS before the production build completes.

## 1.5 Anti-revert
Protected files/rules:
- `AGENTS.md`
- `scripts/verify-protected-workspace-invariants.ps1`
- no `.github/workflows`;
- Live Availability wheel zoom must remain enabled;
- Directory Saved Network must remain functional;
- operational typography minimums must remain intact;
- shared component work must not be replaced by old role-local copies.

Always inspect `origin/main` before editing and before pushing.

---

# 2. CANONICAL NAVBAR EXECUTION ORDER

The canonical audit/implementation sequence remains:

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

XDrive-specific surfaces remain permitted only when they do not duplicate canonical functions:
- Action Centre
- Jobs / My Jobs
- Settings
- More

---

# 3. CURRENT PRODUCTION STATE — IMPLEMENTED / VERIFIED

## 3.1 Dashboard — PASS
**Status:** VERIFIED / IN MAIN / PRODUCTION

Implemented:
- driver dashboard structure aligned with verified CX dashboard hierarchy;
- duplicate Company Driver Dashboard header removed;
- Refresh moved into Reports & Statistics;
- role-specific dashboard content preserved;
- shared visual hierarchy retained.

Key commit:
- `f1d977c – Align driver dashboards with verified CX dashboard layout`

Verification performed:
- authenticated Owner Driver + Company Driver;
- seven-role dashboard coverage in prior audit;
- targeted tests;
- TypeScript;
- clean-main visual verification.

### Do not reopen Dashboard unless:
- a regression is found;
- a new shared global change affects it.

---

## 3.2 Directory — PASS WITH PROTECTED FUNCTIONALITY
**Status:** VERIFIED / IN MAIN / PRODUCTION

Implemented:
- shared CX-aligned Directory structure;
- explicit Companies and Drivers sections;
- CX-style search/filter structure;
- Find My Nearest;
- role-aware routes;
- Owner Driver Saved Network;
- no fabricated combined result claim;
- shared component across applicable workspaces;
- human/business identity presentation;
- global postcode area autodetection now also applies to postcode/outcode inputs.

Key commits:
- `9762375 – Align Directory with CX across operational workspaces`
- `cd8add6 – Restore saved network action and unblock production build`
- `b783297 – Autodetect postcode areas across operational workspaces`

Protected functionality:
- Save Network / Remove Saved;
- `toggleSavedCompany`;
- Saved Network error state;
- Companies / Drivers separation;
- role access boundaries.

Important history:
The first Directory production batch introduced unused-code lint failures. Those were repaired. Do not reintroduce those orphan declarations.

---

## 3.3 Live Availability — PASS FOR CURRENT DEFINED SCOPE
**Status:** VERIFIED / IN MAIN / PRODUCTION

Implemented:
- map remains visible even with zero results;
- pan / drag;
- zoom +/-;
- mouse-wheel zoom;
- marker popup;
- selected-driver focus;
- fitBounds;
- audience controls;
- Live / Future structure;
- nearest logic;
- readable global typography;
- map made visually dominant;
- excessive helper prose removed;
- CX-style compact filter discipline;
- canonical marketplace vehicle-size options;
- postcode/outcode area autodetection;
- same operational logic propagated to owner-driver/company/fleet views where applicable.

Key commits:
- `21e0061 – Enforce readable Live Availability typography`
- `29ff678 – Enable full Live Availability map interaction`
- `8dd6e82 – Refine operational workspace visual hierarchy globally`
- `abe50c2 – Refine Live Availability filters against CX`
- `b783297 – Autodetect postcode areas across operational workspaces`

Protected:
- `scrollWheelZoom` enabled;
- `setView`;
- `fitBounds`;
- marker Popup;
- 14px minimum readable UI;
- global postcode resolver.

### Current UX rules
Remove unnecessary descriptive copy between controls. Prefer:
- label;
- control;
- live resolved value/state only.

Do not re-add explanatory text such as:
- “OFF by default. Maximum 8 hours...”
- “Only you. Your position...”
unless legally or operationally essential.

---

## 3.4 Global visual hierarchy — PASS AS FOUNDATION
**Status:** IMPLEMENTED / PRODUCTION

Implemented globally:
- stronger title hierarchy;
- shared card/panel density;
- search rail widened;
- consistent 32px controls;
- table density normalized;
- map height increased;
- cleaner top navigation geometry;
- common operational background/borders;
- mobile/reduced viewport collapse logic.

Key commit:
- `8dd6e82 – Refine operational workspace visual hierarchy globally`

This is a foundation, not proof that every page below is functionally complete.

---

## 3.5 Global postcode/outcode area autodetection — PASS
**Status:** IMPLEMENTED / PRODUCTION

Production commit:
- `b783297 – Autodetect postcode areas across operational workspaces`

Rule:
Any operational text/search input identified as postcode/outcode receives automatic area resolution through the shared shell resolver.

Shared endpoint:
- `/api/location/postcode-area`

Shared client:
- `OperationalPostcodeAreaResolver.tsx`

Protected invariant:
New operational postcode/outcode fields should inherit the resolver automatically.

Where a page has a dedicated postcode resolver already, it may opt out of the global resolver to avoid duplicate labels.

---

# 4. PARTIALLY IMPLEMENTED — MUST NOT BE CALLED FINAL PASS

## 4.1 My Fleet — PARTIAL
**Current state:** existing implementation predates the current strict blueprint gate.

Known implementation:
- fleet vehicles page exists;
- fleet resources exist;
- active fleet data/actions exist;
- shared shell/navigation exists;
- typography/global visual hierarchy now applies.

Not yet completed under the 2026-10-18/19 canonical gate:
- fresh CX live screenshot + measurement;
- exact active operational fleet responsibilities;
- duplicate audit against Drivers & Vehicles;
- clear separation of operational use vs master register;
- all applicable role views;
- desktop/reduced viewport visual parity;
- authenticated E2E after current global changes.

### Next task
Audit:
- `/admin/fleet/vehicles`
- corresponding CX My Fleet live screen
- role applicability: Carrier/Admin, Fleet Manager, Dispatcher where permitted.

Required decision matrix:
`Function | My Fleet | Drivers & Vehicles | Duplicate | Decision`

Do not duplicate master forms inside My Fleet.

---

## 4.2 Return Journeys — PARTIAL
**Current state:** functionality exists; final CX blueprint audit not completed.

Existing:
- page exists;
- create/edit/delete logic exists;
- route fields;
- availability windows;
- vehicle;
- matching/operational relationship.

Must still verify:
- exact CX live geometry;
- origin/destination UX;
- radius behavior;
- active/expired states;
- match relationship to Loads;
- integration with Diary;
- integration with Live Availability;
- removal of any duplicate return-availability surfaces;
- postcode/outcode area autodetection on FROM/TO;
- role permissions;
- reduced viewport.

Do not create a second independent availability system.

---

## 4.3 Loads — ADVANCED PARTIAL
**Current state:** substantial prior work exists, but it has not been re-certified against the current final blueprint after all recent global changes.

Existing work includes:
- CX-like collapsed/expanded cards;
- route hierarchy;
- refresh positioning;
- card density;
- load notes;
- operational details;
- quick search;
- map synchronization;
- shared vehicle imagery/presentation;
- shared marketplace component;
- Quote Now integration.

Historical commits include:
- `cb50225 – Match CX Loads collapsed and expanded data layout`
- `d68ede0 – Place Loads refresh inside results header`
- `b04bbd7 – Refine CX Loads card height label order and footer`
- `d3621f9 – Align Loads cards with CX status header and notes`
- `741fcb9 – Synchronize Loads quick search with map and reset filters`
- `dbcbae0 – Unify Loads Quotes Diary with Admin Marketplace identity`
- `884e894 – Unify Quote Now across operational workspaces`

Still required:
- re-open CX live Loads;
- current 1:1 filter inventory;
- current toolbar inventory;
- current state/subtab inventory;
- current card measurement;
- permissions on all applicable roles;
- customer/broker/carrier/owner-driver differences;
- full postcode area behavior;
- map/radar if present;
- remove any old helper/filler copy;
- full current build/E2E/visual PASS.

Do not assume historical visual work equals final PASS.

---

## 4.4 Quotes — ADVANCED PARTIAL
Existing:
- shared quote workflow/card;
- unified Quote Now;
- marketplace identity work;
- multiple role surfaces.

Still required:
- current CX live state tabs;
- Received / Submitted / Unsuccessful / Archived;
- awarded/accepted XDrive lifecycle mapping;
- one shared quote record presentation;
- one shared modal;
- eliminate repeated company/status/amount blocks;
- permission audit;
- customer/broker/carrier/owner-driver role differences;
- E2E quote submission and response;
- current visual verification.

---

## 4.5 Diary — PARTIAL / IMPORTANT REMAINING CLEANUP
Typography and shared identity are improved, but Diary still needs the blueprint’s functional cleanup.

Mandatory remaining items:
- remove duplicated Booking Ref / Customer Ref / PO fabricated repetitions;
- remove duplicate Pickup/Delivery blocks;
- remove duplicated POD blocks;
- remove carrier profile links from Diary;
- move cargo/account/profile detail into Order/Job Details;
- remove redundant Open Booking where Order/Job detail already serves purpose;
- final action bar target:

`Leave Feedback | POD | Order | Notes | History | Documents | View invoice (£)`

Search rail target:
- Contacts
- Payment Report (permission-based)
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

Diary remains an operational register, not Job Details.

---

## 4.6 Freight Vision — PARTIAL
Existing page and map/tracking capabilities predate final blueprint.

Must still verify:
- CX live Freight Vision;
- execution-only responsibility;
- active jobs;
- list/map synchronization;
- vehicle/driver positions by permission;
- job overlays;
- status filters;
- no availability discovery duplication;
- no duplicate Return Journey management;
- no duplicate driver register;
- authenticated role verification;
- desktop/reduced viewport.

Boundary:
- Live Availability = available capacity.
- Freight Vision = active execution/tracking.

---

## 4.7 Drivers & Vehicles — PARTIAL
Existing:
- resources page;
- driver/vehicle administration;
- status/compliance/readiness data.

Must still complete:
- current CX live Drivers & Vehicles audit;
- split/merge decisions for Drivers and Vehicles registers;
- remove duplicate master pages/routes;
- ensure My Fleet does not duplicate master-data management;
- assignment relationship;
- compliance/readiness;
- add/edit;
- role permissions;
- visual parity;
- E2E.

Boundary:
- Drivers & Vehicles = master-data/register/admin.
- My Fleet = current operational fleet use.

---

# 5. GLOBAL UX CLEANUP STILL REQUIRED

The following global rule was requested after visual review and must be checked across all remaining pages:

## 5.1 Remove empty intermediate action rows
Do not render:
`Page Header → empty bordered toolbar → real toolbar → content`

Target:
`Page Header → real content toolbar → content`

If a toolbar contains only right-side actions and no meaningful left content:
- merge those actions into the next real toolbar/section header;
- remove empty border/background/min-height/padding.

This must be applied globally where the shared architecture allows it.

## 5.2 Remove unnecessary helper prose
Operational interfaces should not explain obvious controls.

Remove filler copy that:
- repeats the selected state;
- pushes controls downward;
- describes ordinary behavior;
- adds no safety/legal/compliance value.

Keep only:
- validation;
- error;
- live resolved state;
- legal/compliance warning;
- essential permission reason.

## 5.3 Controls over prose
Filter rails should prioritize:
- label;
- control;
- action.

Not:
- label;
- paragraph;
- paragraph;
- control;
- more explanation.

## 5.4 Postcode
Every operational postcode/outcode input must:
- normalize input;
- auto-resolve its area;
- display resolved area compactly;
- never require duplicate manual town entry when postcode already provides it;
- never make postcode recognition page-specific when shared behavior is possible.

---

# 6. XDRIVE-SPECIFIC FUNCTIONAL RULES

## Action Centre
Intervention only:
- POD review;
- quote decision;
- compliance issue;
- invoice/payment issue;
- dispute;
- acknowledgement.

Do not duplicate Notifications.

## Jobs / My Jobs
Purpose:
- execution after award/allocation.

Do not duplicate:
- marketplace;
- Diary.

## More
Secondary tools only.

Do not place canonical navbar functions again under More.

---

# 7. DUPLICATE AUDIT — REQUIRED FOR EVERY REMAINING PAGE

For every role/workspace:

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
- Booking / Customer / PO refs;
- POD state/action/detail repetition;
- Pickup/Delivery repetition;
- profile links in Diary;
- Open Booking vs Order/Job Details.

---

# 8. REQUIRED EXECUTION METHOD FOR NEXT CHAT

For each remaining navbar page, **do not skip steps**:

1. Fetch latest `origin/main`.
2. Verify no protected work was reverted.
3. Open authenticated CX live.
4. Capture screenshot.
5. Measure geometry.
6. Inventory tabs/subtabs.
7. Inventory filters.
8. Inventory actions.
9. Inventory states.
10. Open corresponding XDrive production/local page.
11. Compare 1:1.
12. Mark KEEP / MOVE / MERGE / REMOVE / ADD.
13. Fix shared component first.
14. Propagate to applicable roles.
15. Run protected invariant PowerShell gate.
16. Run `git diff --check`.
17. Run targeted tests.
18. Run TypeScript.
19. Run lint for touched files.
20. Run authenticated E2E.
21. Verify desktop + reduced viewport visually.
22. Run full production `npm run build`.
23. Commit only the verified batch.
24. Fetch `origin/main` again before push.
25. Reconcile any concurrent agent changes.
26. Push only if the batch is still clean.
27. Verify `origin/main` contains the commit.
28. Verify Netlify Production deploy.
29. Move immediately to the next page.

No long silent gaps. Report meaningful checkpoints while continuing execution.

---

# 9. NEXT CHAT — EXACT START POINT

**Do not restart Dashboard, Directory or Live Availability.**

Start with:

## PHASE A — MY FLEET
1. Open CX live My Fleet.
2. Capture/measure exact structure.
3. Open XDrive `/admin/fleet/vehicles`.
4. Compare:
   - vehicle list;
   - drivers;
   - availability;
   - current allocation;
   - location/status;
   - readiness;
   - filters;
   - actions.
5. Build duplicate matrix against Drivers & Vehicles.
6. Fix shared component.
7. Propagate by role.
8. Full gate.
9. Push PASS immediately.

Then:

## PHASE B — RETURN JOURNEYS
Full CX audit + integration with Live Availability / Loads / Diary.

## PHASE C — LOADS
Re-certify current shared Loads implementation against **current CX live**, not old screenshots.

## PHASE D — QUOTES
Re-certify shared quote workflow and all states.

## PHASE E — DIARY
Perform the major duplicate/function cleanup listed in section 4.5.

## PHASE F — FREIGHT VISION
Re-certify tracking/execution responsibilities.

## PHASE G — DRIVERS & VEHICLES
Re-certify master register and remove overlap with My Fleet.

---

# 10. CURRENT PRODUCTION COMMIT ANCHORS

Relevant verified/important production history:

- `f1d977c` — Align driver dashboards with verified CX dashboard layout
- `9762375` — Align Directory with CX across operational workspaces
- `cd8add6` — Restore saved network action and unblock production build
- `4f37f28` — Disable GitHub Actions and require PowerShell validation
- `29ff678` — Enable full Live Availability map interaction
- `8dd6e82` — Refine operational workspace visual hierarchy globally
- `abe50c2` — Refine Live Availability filters against CX
- `b783297` — Autodetect postcode areas across operational workspaces

At creation of this handoff, canonical production base is:
**`main@b783297`**

---

# 11. PRODUCTION/EMAIL/INVOICE WORK DONE OUTSIDE THE NAVBAR BLUEPRINT

Do not accidentally revert these while implementing UI work.

Recent production work includes:
- human external references instead of UUIDs in notifications;
- functional transactional email channels;
- issuer/company branding on invoices;
- canonical invoice attachment path;
- removal of XDrive/platform identifiers where issuer invoice must belong to issuer;
- invoice PDF metadata/layout improvements.

Relevant commits:
- `f0ab38a`
- `685325d`
- `f6571db`
- `12ee020`

These are not completion evidence for the CX navbar pages, but they are protected production behavior.

---

# 12. PASS MATRIX

| Canonical page | Current state | Next action |
|---|---|---|
| Dashboard | **PASS** | Protect only |
| Directory | **PASS** | Protect only |
| Live Availability | **PASS** | Protect only |
| My Fleet | **PARTIAL** | Next page to execute |
| Return Journeys | **PARTIAL** | Execute after My Fleet |
| Loads | **ADVANCED PARTIAL** | Re-certify against current CX |
| Quotes | **ADVANCED PARTIAL** | Re-certify against current CX |
| Diary | **PARTIAL / CLEANUP REQUIRED** | Major duplicate/function cleanup |
| Freight Vision | **PARTIAL** | Full current CX audit |
| Drivers & Vehicles | **PARTIAL** | Full current CX audit + dedupe |

---

# 13. FINAL INSTRUCTION TO THE NEXT AGENT

Continue execution. Do not ask the user to repeat known requirements.

Do not declare something PASS because:
- the page exists;
- old tests pass;
- TypeScript passes;
- it resembles CX;
- a historical commit touched it.

A canonical page is PASS only after:
- current CX live comparison;
- current XDrive verification;
- role/access verification;
- duplicate audit;
- functional verification;
- visual verification;
- local PowerShell gate;
- production build;
- production deploy.

Protect completed work from concurrent agents. Fetch before editing, fetch before pushing, inspect overlapping commits.

The immediate next task is **My Fleet**.
