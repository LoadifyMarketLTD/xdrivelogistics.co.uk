# XDrive Logistics — CX Functional Parity Implementation Instructions

**Checkpoint date:** 25 September 2026 (UK)
**Canonical PR:** #577
**Canonical branch:** `fix/driver-next-professional-page-20260923`
**Baseline HEAD for this plan:** `bdb306e2f8ecdfeccfc07a2aca1c4e54dafaf995`

## 1. Scope

Apply this work only to:
- Broker
- Customer
- Company
- Admin / Company Admin
- Driver
- Owner Driver
- Company Driver

**Explicitly out of scope:** Super Admin.

All work stays in PR #577. Do not merge to `main` without explicit owner approval.

## 2. Evidence used before implementation

This backlog is based on:
1. CX live in Opera on the authenticated Courier Exchange account, including the live Diary structure and controls.
2. Owner-provided CX screenshots, including Settings -> Email Template and the real invoice example.
3. Existing CX reference inventory in `docs/ui/cx/` and prior screen-by-screen CX audits.
4. Current XDrive code at the baseline HEAD above.

CX is a functionality/workflow reference. **Do not copy CX branding or replace the XDrive visual system.** Keep XDrive structure, typography, colours, components and role model.

## 3. Non-negotiable implementation rules

- No fake buttons, fake statuses, fake data, placeholder actions or controls that only look functional.
- If a CX feature needs backend support, implement the backend first or in the same change.
- Every write action must use canonical role/company boundaries and existing server-side authority.
- Preserve Stripe commercial-readiness gates already present on this branch.
- Owner Driver and Company Driver remain distinct:
  - Owner Driver: business owner + driver capabilities.
  - Company Driver: employee/fleet driver; no company ownership, billing or company-admin controls.
- Company Admin may manage operations but cannot silently inherit Owner-only identity controls.
- Do not broaden access to customer, broker or carrier data to imitate CX.
- Reuse XDrive canonical routes/components where they already exist.
- Do not create duplicate routes for the same workflow.
- Verification: PowerShell/local checks + Netlify Deploy Preview. Do not rely on GitHub Actions as the verification gate.
- Required checks for every implementation block: targeted tests, ESLint, TypeScript, `git diff --check`, clean working tree, exact Netlify commit READY before declaring live.
- Never touch Super Admin as part of this plan.

## 4. Confirmed CX capabilities XDrive already has

Do not rebuild these merely for parity:
- Directory: Companies/Drivers, Find Nearest, Profile, Messages, Book Direct.
- Loads: list/search, Interactive Freight Radar Map, Quote Now, View Details.
- Quotes: Submitted, Accepted, Unsuccessful, Archived/Withdrawn, Withdraw/Cancel quote workflow.
- Live Availability: current/nearby/future availability and map/list surfaces.
- Fleet: vehicles, drivers, tracking readiness, future positions, return journeys, document expiry/compliance.
- Diary: All / Jobs Sub-contracted / Our Bookings, date/time/ref/customer/driver filters, List View, Split View, Collapse/Expand, Refresh, status tabs including Awaiting Feedback and Recent Feedback, pagination.
- Job detail: Order, Notes, History, Replay, Documents, POD, Invoice.
- Event Log: search/filter, Download CSV and Print / Save PDF.
- Direct Booking backend and Directory/Live Availability entry points.
- Invoice PDF, POD data, bank snapshots, VAT/payment totals and invoice email sending.
- Messages with `jobId`, `bidId`, `companyId` contextual targeting.

## 5. Confirmed CX gaps — implementation order

### P0 — existing XDrive infrastructure; expose/complete the workflow now

#### Confirmed no-gap: global Book Direct shortcut
CX exposes POST LOAD and BOOK DIRECT together, but XDrive already has the complete Book Direct function in Directory and Live Availability and deliberately keeps the Company/Admin navbar compact. Do **not** add a duplicate global header CTA merely for visual parity.

#### P0.1 Diary Payment Report shortcut
CX exposes Payment Report from Diary.

Implementation:
- Add a Diary shortcut to the canonical Company/Admin finance report surface.
- Do not create a second finance report implementation.

#### P0.2 Diary Track
CX exposes Track on a booking.

Implementation:
- Add Track only where a job is trackable.
- Route to Freight Vision.
- Freight Vision must accept a canonical job query target (for example `?jobId=`) and select/focus that job.
- Never imply live tracking where no live/fresh location exists.

#### P0.3 Diary Message / Freight Messenger
CX exposes job-context communication directly on the booking.

Implementation:
- Add Message action using the existing `/admin/messages?jobId=...` flow.
- Preserve participant/company isolation.
- Do not fabricate read state.

#### P0.4 Diary Edit
CX exposes Edit when the booking can be edited.

Implementation:
- Route to the canonical owner/company job edit surface.
- Respect existing locks after award/quotes/status progression.
- No duplicate edit modal if the canonical edit page already owns the rules.

#### P0.5 Diary Cancel
CX exposes Cancel.

Implementation:
- Use the existing `/api/admin/jobs/[id]/manage` cancel action.
- Preserve atomic cancellation behavior:
  - unassigned job -> canonical cancel;
  - awarded/assigned job -> cancellation request workflow.
- Require a reason where the canonical API requires/benefits from it.
- Never bypass status/ownership checks.

#### P0.6 Diary commercial data density
Expose on the Diary booking card, when real data exists:
- Booked by
- Booked to / awarded carrier
- phone/contact where permitted
- agreed rate
- payment terms
- vehicle reference
- customer reference / booking reference
- hard-copy POD
- load notes

Do not invent unavailable historical data. Render clear "Not supplied" only where useful.

#### P0.7 Diary execution milestones
CX surfaces operational milestones inline instead of forcing History navigation.

Expose canonical milestones when recorded:
- On my way to pickup
- On site pickup
- Loaded
- On my way to delivery
- On site delivery
- Delivered
- Received by
- Left at
- Number of items
- Delivery status
- Driver notes
- Delivery notes

Source milestones from canonical status/timeline/POD data only.

### P1 — real product functions currently missing

#### P1.1 Company Leave Feedback
Diary already detects Awaiting Feedback / Recent Feedback, but Company/Admin does not have the full write workflow.

Implement:
- authorised company feedback create/edit;
- rating + comment;
- one canonical review identity per permitted party/job;
- status/tab refresh after save;
- server/RLS enforcement.

#### P1.2 Booked By filter
Add a real Diary filter for the user/member that created or booked the job.

#### P1.3 Member / Driver filter parity
Extend the current driver-only interpretation so the filter can target the relevant member/company/driver identities represented by the booking, without leaking unrelated directory data.

#### P1.4 Re-book
Implement a controlled clone/prefill flow from an existing booking into the canonical Post Load form.

Rules:
- create a new job; never mutate/reopen the historical booking;
- carry safe operational fields;
- do not copy stale award/bid/driver/POD/invoice/status data;
- re-run Stripe readiness and publishing validation.

#### P1.5 Re-post
For eligible cancelled/expired/unawarded work:
- create a fresh posting from safe source fields;
- do not reactivate the old job row;
- reset commercial/award/execution state;
- re-run current posting validation and Stripe readiness.

#### P1.6 Named Saved Views
XDrive currently supports a single "Save as Default" Diary search. CX reference work also identified Saved Views.

Implement named saved filter views only after defining a simple per-user persistence model; do not overload browser-only localStorage for company-shared settings.

### P2 — backend/data-model work required

#### P2.1 Diary Groups / Add-Edit Groups
Implement a real company-scoped grouping model:
- group CRUD;
- booking membership;
- Diary filter;
- RBAC;
- audit events;
- no cross-company access.

#### P2.2 Company Finance Settings
Expose and persist the existing/required company finance settings in XDrive Settings:
- bank account holder;
- sort code;
- account number;
- invoice prefix;
- VAT defaults/treatment where policy permits;
- canonical payment terms;
- invoice defaults.

Do not store Stripe-controlled bank credentials as a replacement for Stripe Connect. This section is for invoice/remittance metadata only.

#### P2.3 Company-level Invoice Email Template + Preview
Move from invoice-by-invoice editing to a saved company default:
- subject template;
- message template;
- supported token list;
- live preview using XDrive invoice styling/data;
- reset to XDrive default;
- invoice-level override remains possible if authorised.

#### P2.4 Payment Groups
Implement only with a defined business model:
- company-scoped groups;
- payment-term/default mapping;
- assignment to customers/bookings/invoices where appropriate;
- no hidden automatic payment processing.

#### P2.5 Notification Preferences
Current XDrive notifications are an inbox, not preference management.

Add per-user preferences for supported channels/event classes only after defining canonical delivery channels.

#### P2.6 MFA / 2FA
CX reference Settings includes 2FA; XDrive currently only supports password change.

Implement using the authentication provider's supported MFA primitives, including enrolment, challenge, recovery and safe disable rules. Never fake a toggle.

#### P2.7 Departments and role/permission management
XDrive has membership roles but no Department model.

Implement only with:
- company-scoped departments;
- membership assignment;
- explicit role/capability mapping;
- owner/admin boundaries;
- audit log.

Do not replace the canonical role model with free-form permissions.

#### P2.8 Company Profile — Special Services / Capabilities
XDrive already derives some capabilities from real vehicles (ADR, refrigerated, temperature-controlled, tail lift). Add a company-profile service/capability presentation only if backed by real fleet/company data. Avoid duplicate manual claims where the fleet is the canonical source.

#### P2.9 Backload Rate Offered — evidence required before build
Prior CX audit identified "Backload Rate Offered", but the exact commercial semantics are not sufficiently captured in the current live Diary evidence.

Before implementation:
- capture the exact CX screen/conditions;
- identify who offers the rate and at what stage;
- determine interaction with Return Journeys, fixed/proposed price and quote submission;
- then design the XDrive schema/workflow.

Do not implement this from the label alone.

## 6. CX features intentionally not copied blindly

- CX branding, colours, ads, SmartPay branding or promotional surfaces.
- Controls with no XDrive business purpose.
- Duplicate Contacts UI when Directory/Messages already provide the canonical workflow.
- Historical CX fields that are not present in XDrive data.
- Any payment-custody behavior contrary to XDrive's current payment model.
- Any Super Admin behavior.

## 7. Acceptance criteria by phase

### P0 gate
- All P0 actions are visible only to authorised roles/states.
- Every action routes to or calls a real existing backend.
- Diary cards remain dense and scannable.
- No existing Order/Notes/History/Replay/Documents/POD/Invoice actions regress.
- Company Driver does not receive Company Admin/Owner mutations.
- Targeted P0 tests PASS.
- ESLint PASS.
- TypeScript PASS.
- `git diff --check` PASS.
- Netlify preview exact commit READY.
- Visual verification against CX reference behavior while preserving XDrive design.

### P1 gate
- New write flows are server-authorised and company-scoped.
- Re-book/Re-post create new records and never corrupt historical bookings.
- Feedback identity and uniqueness rules are enforced.
- Saved Views are user-scoped and persistent.
- Full P0 regression PASS.

### P2 gate
- Migrations are idempotent and RLS-safe.
- New data models are company/user scoped.
- No secrets or bank credentials are exposed in client-readable tables.
- Settings have real persistence and reload correctly.
- Full role-boundary regression: Company/Admin, Owner Driver, Company Driver, Driver, Broker, Customer.

## 8. Implementation sequence

Execute strictly in this order unless a discovered dependency requires moving one prerequisite earlier:

1. P0.1 Payment Report shortcut
2. P0.2 Track + Freight Vision job targeting
3. P0.3 Message / Freight Messenger job targeting
4. P0.4 Edit
5. P0.5 Cancel
6. P0.6 commercial booking data
7. P0.7 milestones
8. P0 full verification and Deploy Preview
9. P1 features in listed order
10. P1 full verification
11. P2 schema design/migrations first, then UI
12. P2 full verification

If further CX functionality is discovered during live comparison, add it to this document with evidence and priority before implementing it.


## 9. Mandatory surgical CX audit before further implementation

No further parity implementation may start until this audit matrix is completed with evidence for every main CX surface and every discovered sub-surface.

Required top-level CX surfaces:
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

For every surface, capture:
- all visible tabs/subtabs;
- all filters and saved/default-filter behaviour;
- all toolbar actions;
- all row/card actions;
- every modal/drawer/form reachable from the page;
- status taxonomy;
- pagination/list/map/split-view behaviour;
- expand/collapse behaviour;
- messaging/contact shortcuts;
- posting/booking/quote/award/cancel/rebook/repost actions;
- tracking/location behaviour;
- driver/vehicle allocation;
- POD/documents/history/notes/invoice/payment actions;
- group/department/member controls where present;
- role-sensitive behaviour;
- settings opened from the surface;
- empty/loading/error/permission states;
- data displayed on collapsed and expanded records;
- any secondary page opened from the surface.

Each discovered capability must be classified as:
- `MATCH` — XDrive already has an equivalent real workflow;
- `PARTIAL` — XDrive has backend/data but incomplete UI/workflow;
- `GAP-P0` — backend exists; expose or connect now;
- `GAP-P1` — real product workflow missing;
- `GAP-P2` — new schema/backend/security work required;
- `NO-COPY` — CX-specific/advertising/branding/irrelevant to XDrive;
- `UNCONFIRMED` — evidence insufficient; do not implement yet.

Evidence priority:
1. authenticated CX live content in Opera;
2. owner-provided screenshots;
3. repository CX reference captures/docs;
4. public CX bundle structure/routing only for structural confirmation.

Do not label an item MATCH/GAP solely from memory.

### Audit progress
- Loads: live authenticated CX content captured; detailed comparison in progress.
- Diary: live authenticated CX content captured, owner screenshot captured; detailed comparison substantially complete.
- Settings/My Profile: live authenticated CX content captured incidentally; findings retained for P2 Settings work.
- Dashboard: pending complete surgical pass.
- Directory: pending complete surgical pass.
- Live Availability: pending complete surgical pass.
- My Fleet: pending complete surgical pass.
- Return Journeys: pending complete surgical pass.
- Quotes: pending complete surgical pass.
- Freight Vision: pending complete surgical pass.
- Drivers & Vehicles: pending complete surgical pass.

**Implementation remains paused until the ten-surface audit is complete and the backlog in this document is updated from the evidence.**
