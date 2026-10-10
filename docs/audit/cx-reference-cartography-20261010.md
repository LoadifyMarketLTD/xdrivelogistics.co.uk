# CX Reference Cartography — XDrive Visual & Functional Baseline

Date: 2026-10-10
Scope: all operational XDrive workspaces except Super Admin
PR context: #675 — Owner Driver / Sole Trader reconstruction

## 1. Source inventory

### Local CX library
- Source: `C:\Users\Danny\OneDrive\Imagini\CX IMAGE`
- 70 image files
- 60 unique SHA-256 images after deduplication
- Includes CX web and mobile references across Loads, Diary, Quotes, Bookings, More, route/map, POD/documents and alerts.

### GitHub reference library
- 112 image assets in repository
- 81 explicitly CX/reference/evidence assets
- 21 canonical CX web screenshots under `docs/reference/courier-exchange/`
- 21 after-state XDrive evidence assets
- 21 before-state XDrive evidence assets
- 18 comparison assets

The 21 canonical CX screenshots were reviewed individually. The local library was used as a second source for later CX states and mobile behaviour.

## 2. Measurement policy

Screenshot-derived CSS values are estimates unless the original CX stylesheet is available. The values below therefore distinguish:
- **Observed CX range** — derived visually from reference screenshots.
- **XDrive canonical value** — exact value adopted in the XDrive shared visual baseline.

## 3. Shared desktop visual contract

| Token | Observed CX | XDrive canonical |
|---|---:|---:|
| Workspace header | ~50–56 px | 54 px |
| Primary navbar | ~40–44 px | 42 px |
| Nav font | ~12–14 px | 13 px |
| Nav weight | ~500–600 | 600 |
| Nav line-height | ~17–19 px | 18 px |
| Nav lateral padding | ~10–15 px | 13 px |
| Active underline | ~1–2 px | 2 px |
| Responsive nav floor | ~12 px | 12.5 px |
| Primary value | ~11.5–13 px | 12 px / 600 |
| Town | ~12–13 px | 12.5 px / 700 |
| Postcode | ~11.5–12.5 px | 12 px / 450 |
| Label | ~10–11 px | 10.8 px / 450–500 |
| Posted-by name | ~12 px | 12 px / 700 |
| Metadata/timestamp | ~9.5–10.5 px | 10 px / 400 |
| Status/type badge | ~11–13 px | 12 px / 650 |
| Vehicle | ~10.5–11.5 px | 11 px / 600 |
| Quick-fact label | ~10–11 px | 10.5 px / 500 |
| Quick-fact value | ~10.5–11.5 px | 11 px / 450 |
| Standard operational row min-height | ~50–58 px | 54 px |
| Operational cell padding | ~7–10 px | 8 px × 10 px |
| Detail item min-height | ~40–48 px | 44 px |
| Status badge min-height | ~18–22 px | 20 px |
| Borders | 1 px, square/near-square | 1 px, radius 0 |
| Dominant body colour | neutral charcoal/gray | #303842 |
| Secondary label colour | neutral slate | #5e6874 |
| Metadata colour | muted slate | #6f7985 |

Rule: `font-weight: 800` is not part of the shared operational-card hierarchy. Strong emphasis is normally 600–700.

## 4. Global CX desktop navigation

Observed CX top-level IA:
- Dashboard
- Directory
- Live Availability
- My Fleet
- Return Journeys
- Loads
- Quotes
- Diary
- Freight Vision
- Drivers & Vehicles

Global actions:
- Post Load
- Book Direct
- account/profile
- settings
- notification/menu affordances

XDrive rule: visual grammar is shared, but role IA remains role-specific. Sole Trader does **not** inherit Fleet or Drivers & Vehicles merely for visual parity.

## 5. Loads cartography

### Toolbar
Tabs/options:
- All Live
- On Demand
- Regular Load
- Daily Hire
- Quick Search
- Show loads posted within last
- List View
- Map/Radar view where supported
- Expand/Collapse all entries
- Refresh
- Items per page
- Pagination

### Left search/filter rail
- UK & ROI / Euro
- From
- pickup radius
- To
- destination radius
- Vehicle Size
- Body Type
- Date
- Freight Type
- Member Name / ID
- Job Description
- Same Day — Timed
- Same Day — Non Timed
- Next Day — Timed
- Next Day — Non Timed
- Groups
- Save as Default

### Card — row 1
Column A:
- From
- town + postcode/outcode
- To
- town + postcode/outcode
- Stops when applicable

Column B:
- Pickup
- Deliver

Column C:
- job timing/type badge
- Posted by
- posted timestamp + timezone
- Load ID
- vehicle icon/type

### Card — expanded facts
- Distance
- Weight
- Packaging
- Dimensions
- Requested vehicle / body
- Payment Terms
- Hard-copy POD
- SmartPay status

### Notes/footer
- Load Notes
- Quote Now
- Backload Rate Offered where applicable
- View Details
- Member ID
- Company
- Phone

### Observed badges/states
- Deliver Direct
- Same Day - Timed
- Same Day - Non Timed
- Next Day - Timed
- Next Day - Non Timed
- Other / notes-defined work
- SOLD
- cancellation state
- SmartPay Enabled

### XDrive privacy rule
Pre-award marketplace card may expose town + outcode but not exact private address/full postcode. Full address remains post-award/authorised data.

## 6. Quotes cartography

Tabs:
- Received
- Archived
- Submitted
- Unsuccessful

Shared card grammar:
- route
- pickup/deliver
- status/type
- vehicle
- payment terms
- member identity
- load ID

Quote-specific states/actions:
- Cancel Quote
- quoted amount
- unsuccessful quote state
- SOLD / awarded state
- View Details
- feedback/reputation indicators
- distance

Empty state is rendered inside the same workspace frame rather than as a separate product surface.

## 7. Diary cartography

### Header modes
- List View
- Split View
- Expand/Collapse All Entries
- Refresh
- Items per page
- Pagination

### State tabs
- All
- Unallocated
- Allocated
- In Progress
- Completed
- Cancelled
- Expired
- Awaiting Feedback
- Recent Feedback

### Search rail
- Contacts
- Payment Report
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
- archived bookings access

### Core card
Diary deliberately inherits Loads grammar:
- route column
- pickup/delivery column
- status / operator / Load ID / vehicle column
- commercial facts
- notes
- action footer

### Operational/commercial information
- Booked by
- phone
- Agreed Rate
- Requested vehicle
- Vehicle Ref
- Payment Terms
- POD requirement
- SmartPay

### Lifecycle/timeline fields
- On my Way to Pickup
- On Site (Pickup) At
- Loaded At
- Your Ref
- Cust Ref
- Items
- Driver Notes
- On Site (Delivery) At
- Delivered On
- Received By
- Left At
- No of Items
- Delivery Status
- Delivery Notes

### State-dependent actions
Allocated/accepted/in-progress:
- On my Way to Pickup
- Decline
- Track
- Order
- Edit
- Re-book
- Cancel / Request cancellation
- Notes
- History
- Documents

Completed/delivered:
- Leave Feedback
- POD
- Order
- View Feedback
- Notes
- History
- Documents
- View invoice (£)

Cancelled:
- Re-post
- Notes
- History
- Documents

XDrive contract: Diary is **Loads + lifecycle/execution data**, not a visually unrelated module.

## 8. My Fleet cartography

Columns/controls:
- Search
- update fleet status
- Name
- Size
- Status
- Current Location / Last Tracked
- Future Vehicle Position
- Future Journey
- Advertise vehicle status to
- Notify When Tracked
- Add Future Position
- Add journey
- exchange scope selector

This is a fleet workspace feature. It is not copied into Sole Trader IA merely to mirror CX.

## 9. Drivers & Vehicles / Company Vehicles cartography

Left tabs:
- Users / Drivers
- Company Vehicles
- Vehicle Tracking

Controls:
- Search
- Add Vehicle
- Items per page
- Pagination

Vehicle table:
- Name
- Size / Type
- Year
- Max Weight (kg)
- Notify When Tracked
- Event Log
- Documents
- Edit
- Delete

Owner Driver / Sole Trader XDrive rule: single assigned vehicle management is retained; fleet/staff administration remains outside Sole Trader scope.

## 10. Member profile / reputation cartography

Member modal tabs observed:
- Member Details
- Feedback
- Users
- Specialist Services
- Charges
- Booking Footer
- Business Documents

Member Details:
- member ID
- company name
- phone
- main contact
- email
- Company Registration Number
- VAT Number
- postcode
- Operator Licence
- Fleet Details
- Payment Terms
- Billing Address
- About

Feedback:
- Delivery Performance
- Payment Performance
- Complaints
- All Feedback
- Delivery Feedback
- Payment Feedback
- Positive / Negative filters
- historical entries + pagination

Principle: member identity is an actionable trust/reputation entry point, not plain text.

## 11. Settings cartography

Top product tabs:
- Freight Exchange
- SmartPay
- Integrations

Observed settings navigation:
- Get Started
- Company Profile
- Business Docs
- Experience & Record
- My Profile
- Users / Drivers
- Company Vehicles
- Vehicle Tracking
- Mobile Accounts
- Departments
- Notifications
- Blocked Members
- Groups

Settings data/controls:
- personal profile
- login credentials
- phone/email
- timezone
- language
- 2FA
- messenger settings
- notification bar
- auto matching map
- en-route alert interval/radius
- roles
- company/trading details
- company registration
- Operator Licence
- payment terms
- billing address
- home location
- directory location
- vehicle details and dimensions
- booking footer
- delivery-note footer/details
- specialist services
- About
- user/company logo
- waiting/loading/cancellation/other charges
- member charter acceptance
- driver/carrier confirmation
- load reminders
- electronic quote preferences
- SmartPay-only quote preference
- quote email notifications
- full postcode visibility for own posted loads
- feedback-view window

## 12. SmartPay / Accounts Receivable cartography

Tabs:
- Dashboard
- All
- Ready To Invoice
- Awaiting Payment
- Paid
- Customers
- Archive

Dashboard:
- Pending approval
- Awaiting payment
- Paid on platform
- Pay me now
- Requiring attention
- Shortcuts
- invoices without Load ID

## 13. Dashboard cartography

Observed CX panels:
- Reports & Statistics
- Gross Margin
- Sub-contract Spend
- Accounts Payable
- Reports
- Feedback in Last 90 Days
- Activity at a glance
- Latest Bookings
- Compliance — Manage Your Suppliers
- watchlist/compliance status

XDrive maps these by role and capability, not as a universal dashboard.

## 14. Mobile CX cartography

Bottom navigation:
- Home
- Alerts
- Quotes
- Bookings
- More

Home:
- vehicle
- tracking
- Update Your Status
- Search
- Who's Nearby
- Journeys

More:
- SmartPay
- Directory

Alerts:
- Inbox
- Saved
- Deleted
- map/location filter
- member verification
- timestamp
- vehicle
- home/current-location context
- NEW / HOTSHOT / CHARGES / SMARTPAY badges
- route stops
- Quote CTA
- swipe-to-delete

Quotes:
- Submitted
- Unsuccessful
- empty state
- load detail
- quote amount/currency
- additional extras
- total
- Will collect within
- vehicle
- notes
- Submit Quote

Bookings:
- Current
- Past 7 days
- Past 14 days
- completed badge
- SmartPay
- route
- distance
- notes
- View POD

Booking detail:
- Summary
- Stops
- Status
- stop detail: Time / Company / Address / Contact
- document attachments
- Add Document
- Add Image

Route:
- Distance to Collection
- Load Distance
- travel time
- suggested route based on real-time traffic

Load detail:
- member/customer identity
- terms
- phone
- Message
- feedback summary
- dimensions/weight
- Quote

## 15. Cross-role XDrive visual mapping

The following share the same visual identity baseline:
- Customer
- Broker
- Carrier
- Fleet Manager
- Dispatcher
- Owner Driver
- Driver

Shared:
- header geometry
- navbar typography/density
- active state
- card borders
- label/value/metadata hierarchy
- status badge geometry
- operational row density
- spacing
- line-height
- muted/primary text hierarchy

Role-specific:
- routes
- permissions
- tabs
- actions
- commercial data
- fleet controls
- execution controls
- finance controls

Excluded:
- **Super Admin** remains on its own platform administration visual contract.

## 16. PR #675 verification snapshot

Automated verification completed on 2026-10-10:
- full Vitest suite: 2,884 / 2,884 PASS
- TypeScript typecheck: PASS
- ESLint: PASS
- automated audit: 81 / 81 automatable checks PASS
- Next.js production build: PASS
- PR branch is 51 commits ahead of main and 0 commits behind at verification time

Live database checks:
- required `jobs`, `drivers`, `vehicles`, `company_memberships` columns used by #675 exist
- RLS is enabled on all four core tables
- jobs: 12 policies
- vehicles: 10 policies
- drivers: 8 policies
- company_memberships: 6 policies

Migration-history note:
- 513 migration versions live
- 478 migration files in repo
- 35 live-only versions
- 0 repo-only versions
- #675 itself adds no database migrations
- this drift must be treated as a separate migration-history reconciliation gate; do not recreate the 35 versions blindly.

Security-advisor note:
- production still reports informational RLS-enabled/no-policy tables and warnings for authenticated-executable SECURITY DEFINER functions.
- these require a dedicated function/table authority review; they are not silently treated as resolved by #675.

## 17. Acceptance rule

A role may differ in **what it can do**, but not in the basic visual language used to communicate:
- hierarchy
- density
- labels
- values
- metadata
- badges
- spacing
- card structure
- navigation rhythm

This document is the visual/function map for subsequent parity work. Super Admin is intentionally excluded from the shared operational-workspace baseline.
