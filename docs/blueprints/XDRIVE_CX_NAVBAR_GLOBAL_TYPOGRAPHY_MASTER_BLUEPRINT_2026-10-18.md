# XDRIVE — CX NAVBAR MASTER BLUEPRINT + GLOBAL TYPOGRAPHY CONTRACT
**Date:** 2026-10-18  
**Status:** CANONICAL / EXECUTABLE  
**Scope:** all 7 operational workspaces; Super Admin excluded  
**Reference:** Courier Exchange live + XDrive-approved operational rules

## 0. Authority
This document supersedes older operational typography guidance that allowed 10px, 11px or 12px workspace text.
If another operational workspace document, CSS fallback, test or component contradicts this contract, this document wins.

The target navbar sequence is:

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

XDrive-specific Action Centre, Jobs/My Jobs, Settings and More remain permitted only when they do not duplicate a canonical navbar function.

---

## 1. GLOBAL TYPOGRAPHY — HARD CONTRACT

### Canonical operational scale
- Page title: **20px / 26px / 700**
- Section title: **16px / 20px / 700**
- Panel / important operational title: **16px / 20px / 700**
- Operational body / route / values: **14px / 18px**
- Labels: **14px / 18px / 600**
- Metadata / secondary / refs / badges: **14px / 18px minimum**
- Buttons / links / dropdowns / filters / tabs / subtabs: **14px / 18px / 600**
- Active / selected / primary interactive state: **700**
- Top navbar only: **13px / 600** measured shell exception
- Important values and record titles: **16px / 20px / 700**
- KPI/large metric value may exceed 16px when it is a true metric, not ordinary workspace copy.

### Forbidden
No operational workspace source may use:
- 10px text
- 11px text
- 12px text
- fractional equivalents such as 10.4px, 10.8px, 11.2px, 12.5px
- role-local typography that shrinks below this contract
- density achieved by reducing readable text

Density must be created through:
- compact spacing
- controlled row height
- correct rail width
- information hierarchy
- wrapping
- overflow management

### Shared tokens
The shared measured workspace layer owns:
- --ws-font-body: 14px
- --ws-font-label: 14px
- --ws-font-meta: 14px
- --ws-font-micro: 14px
- --ws-interactive-font-size: 14px
- --ws-interactive-line-height: 18px
- --ws-interactive-font-weight: 600
- section/panel titles: 16px
- page title: 20px

No role stylesheet may redefine these smaller.

---

## 2. GLOBAL SHELL / NAVBAR

Canonical order:
Dashboard → Directory → Live Availability → My Fleet → Return Journeys → Loads → Quotes → Diary → Freight Vision → Drivers & Vehicles

Rules:
- one function = one navigation location
- no Live Availability + Availability duplicate
- no duplicate Return Journeys
- no duplicate Drivers / Vehicles routes under different labels
- More contains secondary tools only
- Settings is not duplicated if already accessible from the account/settings control
- active navbar item uses the shared underline/active state
- navbar text remains 13px / 600
- page begins immediately under the navbar; no decorative gap

Header actions are permission driven:
- Post Load only for roles allowed to post
- Book Direct only where permitted
- Notifications
- account / sign out

---

## 3. DASHBOARD

### Purpose
Operational overview, not a second copy of every module.

### CX structure to preserve
- Reports & Statistics
- operational KPIs
- Accounts Payable / finance shortcuts where relevant
- Reports shortcuts
- Latest Bookings / current operational activity
- feedback / performance summary
- compliance / supplier readiness where role permits

### XDrive rules
KEEP:
- meaningful KPIs
- current bookings/jobs requiring attention
- operational shortcuts
- finance summary where permitted
- compliance summary where permitted

REMOVE / MERGE:
- duplicate KPIs
- same status shown in multiple panels
- filler cards
- decorative empty regions
- role-specific dashboard typography

Typography:
- page 20/26/700
- panel titles 16/20/700
- body/meta 14/18
- KPI labels 14/18
- true KPI values may remain larger

---

## 4. DIRECTORY

### Purpose
Search and evaluate members, companies and drivers.

### Search rail
- Country
- Member Name / ID
- Location
- Radius
- Vehicle Size
- Minimum / Exact
- Body Type
- Tail Lift
- Livery where applicable
- Hiab / Trailer / Moffett where applicable
- Electric Vehicle
- Phone
- Email
- Specialist Services
- Search
- Clear
- Find My Nearest

### Results
- Company / Member
- Member ID
- Location
- capability
- vehicle/service
- delivery reliability
- payment reliability where allowed
- actions: Call / Message / Book Direct / View profile by permission

REMOVE:
- duplicated filters
- private information not required for business operation
- profile data repeated in every result
- tiny helper copy

Typography:
- filters 14/18/600 labels
- values/results 14/18
- member/company name 16/20/700
- actions 14/18/600

---

## 5. LIVE AVAILABILITY

### Purpose
Who is available, where, with what vehicle and until when.

Required:
- map visible even with zero drivers
- list + map relationship
- driver/member identity
- vehicle
- current/declared location
- availability window
- status
- refresh
- nearest logic
- route / return availability where relevant

REMOVE:
- duplicate Return Journey cards
- second Availability route under More
- mock drivers
- map disappearing when empty
- colour/style shift on refresh

Do not turn Live Availability into Freight Vision.

Typography:
- map/list controls 14/18/600
- driver/vehicle values 14/18
- primary driver/member name 16/20/700

---

## 6. MY FLEET

### Purpose
Operational use of the company's active fleet.

Include:
- drivers
- vehicles
- availability
- assignment state
- readiness
- location/status where allowed
- active allocation
- filters
- direct actions required for current operations

Boundary:
- My Fleet = current operational usage
- Drivers & Vehicles = master register / administration

REMOVE:
- duplicate master-data forms
- duplicate vehicle/driver registers
- same action in My Fleet and Drivers & Vehicles without a clear operational reason

Typography:
- lists/body 14/18
- labels/actions 14/18/600
- primary vehicle/driver identifier 16/20/700

---

## 7. RETURN JOURNEYS

### Purpose
Publish/manage vehicle return availability and match relevant work.

Include:
- origin
- destination
- available from
- available until/date
- vehicle
- route/radius
- active/expired state
- matching loads
- create/edit/delete where permitted

Integrate with:
- Live Availability
- Loads
- Diary

REMOVE:
- duplicated journey cards
- multiple Return Journey navigation entries
- independent availability logic that conflicts with Live Availability

Typography:
- route/value 14/18
- important route/vehicle 16/20/700
- filters/actions 14/18/600

---

## 8. LOADS

### Purpose
Live freight marketplace / load discovery and posting context.

### Search/filter rail
Preserve CX discipline:
- Save as Default where useful
- region
- From + radius
- To + radius
- Vehicle Size
- Body Type
- Date
- Freight Type
- Member Name / ID
- job/service requirements

### Toolbar
- results timestamp
- List View
- map/radar view where implemented
- state/subtabs
- Quick Search
- recent-posting filter
- Collapse/Expand All
- Refresh
- Items per Page
- pagination

### Card structure
LEFT:
- From
- To

CENTRE:
- Pickup
- Deliver
- Distance
- Weight
- Packaging
- Dimensions

RIGHT:
- posting/status band
- Posted by
- timestamp
- Load ID
- requested vehicle
- vehicle presentation
- Payment Terms
- POD requirement

BOTTOM:
- Load Notes
- View Details
- member/company context
- Quote Now when permitted

XDrive-specific:
- Town + postcode area
- XD company/member ID
- XDL job ID
- SWB/LWB/XLWB/Luton imagery
- Stripe/legal/compliance gating before posting
- no SmartPay
- no TEG branding
- no Deliver Direct / Timed Direct product labels

Typography:
- body/meta 14/18
- route/important values 16/20/700 where emphasis is needed
- tabs/filters/actions 14/18/600

---

## 9. QUOTES

### Purpose
One quote workflow, not separate visual systems per role.

Core states:
- Received
- Submitted
- Unsuccessful
- Archived
- awarded/accepted states where XDrive workflow requires them

Search:
- Pickup Time Within
- Delivery Time Within
- Load ID / Ref
- Booked by
- Search
- Clear

Quote record:
- load/job identity
- route
- pickup/delivery
- vehicle
- member/company
- quote amount
- collection commitment
- timestamp
- quote status
- allowed actions

Rules:
- one shared Quote card
- one shared Quote Now modal
- no repeated company block
- no repeated quote amount/status
- no role-specific font shrink

Typography:
- body 14/18
- important quote/route values 16/20/700
- tabs/actions 14/18/600

---

## 10. DIARY

### Purpose
Compact operational register. Diary is not Job Details.

State tabs:
- All
- Unallocated
- Allocated
- In Progress
- Completed
- Cancelled
- Expired
- Awaiting Feedback
- Recent Feedback

Search rail:
- Contacts
- Payment Report where allowed
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

Card:
LEFT:
- From / To
- booked/subcontracted by
- contact
- agreed rate
- ref

CENTRE:
- Pickup / Deliver
- distance
- weight
- packaging
- dimensions

RIGHT:
- status
- completed/delivered by
- timestamps
- Load ID
- requested vehicle
- allocated vehicle/ref
- payment terms
- POD requirement/status

Timeline:
- On My Way to Collection
- On Site Collection
- Loaded
- On My Way to Delivery
- On Site Delivery
- Delivered
- received by / evidence as applicable

Action bar:
Leave Feedback | POD | Order | Notes | History | Documents | View invoice (£)

REMOVE:
- Open booking duplicate
- duplicated Pickup/Delivery blocks
- duplicated POD blocks
- Booking Ref = Customer Ref = PO Number fabricated repetition
- carrier profile links inside Diary
- cargo/account/profile detail that belongs to Order/Job Details

Typography:
- operational text 14/18
- important values/status titles 16/20/700
- actions/tabs/filters 14/18/600

---

## 11. FREIGHT VISION

### Purpose
Execution visibility / tracking, not availability discovery.

Include:
- active jobs
- map
- vehicle/driver positions where authorised
- execution status
- job overlays
- filters
- route/status relationships
- list/map interaction

Boundary:
- Live Availability = available capacity
- Freight Vision = active operational execution

REMOVE:
- duplicated availability board
- duplicate driver register
- duplicate return-journey management

Typography:
- controls/filters 14/18/600
- list/meta 14/18
- important job/status 16/20/700

---

## 12. DRIVERS & VEHICLES

### Purpose
Master-data register and administration.

Include:
- Drivers register
- Vehicles register
- add/edit
- status
- compliance/readiness
- vehicle details
- driver details
- assignment relationships where relevant

Boundary:
- Drivers & Vehicles = register / administration
- My Fleet = operational fleet use

REMOVE:
- duplicate Drivers page with identical function
- duplicate Vehicles page with identical function
- duplicate master forms inside My Fleet

Typography:
- register rows 14/18
- labels/actions 14/18/600
- driver/vehicle primary name 16/20/700

---

## 13. XDRIVE-SPECIFIC SURFACES

### Action Centre
Keep only real intervention items:
- POD review
- quote decision
- compliance problem
- invoice/payment issue
- dispute
- acknowledgement

It must not duplicate Notifications.

### Jobs / My Jobs
Purpose:
- execution after award/allocation
- not marketplace
- not Diary duplicate

States may include:
- Awarded / Allocated
- Active
- Loaded
- In Transit
- Completed

### More
Only secondary capabilities not already present in the navbar.

---

## 14. DUPLICATE AUDIT — MANDATORY

For every workspace build a matrix:

Function | Navbar | More | Dashboard | Page | Duplicate | Decision

Every duplicate must receive one decision:
- KEEP
- MOVE
- MERGE
- REMOVE

Known examples to eliminate:
- Live Availability + More/Availability
- duplicate Return Journeys
- repeated booking/customer/PO reference with the same fabricated value
- repeated POD state/detail/action
- repeated Pickup/Delivery in Diary
- profile links embedded in Diary
- Open booking redundant with Order/Job details

---

## 15. SEVEN-WORKSPACE PROPAGATION

Verify:
1. Customer
2. Broker
3. Carrier/Admin Company
4. Fleet Manager
5. Dispatcher
6. Owner Driver
7. Company/Employed Driver

Same shared typography and component identity.
Differences permitted only for:
- data
- role permissions
- actions legitimately unavailable

Super Admin is excluded.

---

## 16. DATA / COMPLIANCE RULES

- no mock data
- no SmartPay
- no TEG branding
- no fabricated refs
- no fabricated PO numbers
- no fabricated POD state
- Stripe/legal/compliance gating remains XDrive-specific
- Company Driver cannot post loads
- POD required before invoice in the operational lifecycle
- Invoice follows POD
- XDrive does not collect transport payment on behalf of the parties

---

## 17. EXECUTION ORDER

For every navbar page:

1. Open CX live
2. Capture screenshot
3. Measure geometry
4. Inventory tabs/subtabs
5. Inventory filters
6. Inventory actions
7. Inventory states
8. Open corresponding XDrive page
9. Compare 1:1
10. Mark KEEP / MOVE / MERGE / REMOVE / ADD
11. Fix shared component first
12. Propagate to all applicable roles
13. Run contract/unit tests
14. Run TypeScript
15. Run authenticated E2E
16. Verify desktop + reduced viewport visually
17. Continue to next tab

Order:
Dashboard → Directory → Live Availability → My Fleet → Return Journeys → Loads → Quotes → Diary → Freight Vision → Drivers & Vehicles

---

## 18. TYPOGRAPHY GUARD

Build/test must fail if an active operational source under:
- app/admin
- app/broker
- app/customer
- app/driver
- app/components/workspace

introduces 10px, 11px or 12px font-size text or old ws-font fallbacks.

Allowed exception:
- top navbar 13px / 600
- Super Admin is outside this contract

---

## 19. PASS / PUSH RULE

Do not declare PASS if:
- old 10–12px operational typography exists
- a workspace differs visually
- duplicate functionality remains
- function is in the wrong page
- text clips or overflows
- permission/action is wrong
- mock data appears
- TypeScript fails
- tests fail
- authenticated E2E fails

Push to main only after the current batch is verified.

---

## 20. FINAL AGENT INSTRUCTION

Do not recreate Courier Exchange superficially and do not make seven role-specific copies.

Use CX to understand page responsibility, information order, density and workflow.
Use XDrive rules for identity, permissions, Stripe/legal/compliance and lifecycle.

The typography contract is now fixed:
**14px / 18px is the operational minimum, 16px / 20px for important titles/values, 20px / 26px for page titles, 13px / 600 only for the top navbar.**

No older operational typography contract may override this document.
