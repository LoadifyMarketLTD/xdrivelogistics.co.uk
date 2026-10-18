# DASHBOARD — CX LIVE vs XDRIVE EXECUTION MATRIX
Date: 2026-10-18
Reference: Courier Exchange live authenticated in Opera
Scope: Customer, Broker, Carrier/Admin Company, Fleet Manager, Dispatcher, Owner Driver, Company Driver
Super Admin: excluded

## CX LIVE OBSERVED

Canonical navbar:
Dashboard | Directory | Live Availability | My Fleet | Return Journeys | Loads | Quotes | Diary | Freight Vision | Drivers & Vehicles

Dashboard composition:
LEFT COLUMN
1. Reports & Statistics
   - Gross Margin
   - Sub-contract Spend
   - date range controls
2. Accounts Payable
   - Latest Invoices Received
   - Invoices due for Payment
   - Invoices Awaiting Payment
   - Monthly Totals
3. Reports
   - Bookings Received
   - Bookings Sub-contracted
   - Loads Allocated
   - Return Journeys
4. Feedback in Last 90 Days
   - Payment Performance
   - Delivery Performance
   - Received/Given selectors

RIGHT COLUMN
1. Activity at a glance
   - Latest Bookings
   - View All
   - Member / Driver / ID
   - Location
   - Load ID / Ref
   - route
   - vehicle
   - pickup/delivery
   - customer ref
   - status
   - completed by / timestamp
   - Load ID
   - POD action
2. Compliance - Manage Your Suppliers
   - fully compliant
   - about to expire
   - updates needed
   - watchlist management

## XDRIVE DECISIONS

### Carrier/Admin Company
KEEP:
- Reports & Statistics
- Accounts Payable
- Reports
- Feedback in Last 90 Days
- Activity at a glance
- Compliance/watchlist
- real data loading and permission boundaries

MERGE:
- carrier-specific dashboard CSS into the shared measured dashboard contract where geometry/typography duplicates common styles

REMOVE:
- any 10–13px operational inline typography
- any duplicated finance or operational shortcuts already present in the canonical sections

ADD/FIX:
- 14/18 typography minimum
- 16/20 important values
- same geometry used by Fleet Manager where it resolves to Carrier dashboard

### Fleet Manager
KEEP:
- canonical Carrier/Admin dashboard as home
MOVE:
- fleet resource register and fleet-specific controls remain in My Fleet, not Dashboard
REMOVE:
- duplicate fleet workboards on Dashboard

### Broker
KEEP:
- Reports & Statistics
- Activity at a glance
- broker finance visibility
- attention items that genuinely require broker intervention

MOVE:
- Action Centre remains the detailed intervention queue; Dashboard only surfaces a compact summary
MERGE:
- broker commercial links into the CX-style Accounts Payable / Reports column structure
REMOVE:
- dashboard layout where Needs your attention occupies the canonical Activity column ahead of Activity
ADD/FIX:
- canonical left/right column ordering

### Customer
KEEP:
- Reports & Statistics
- Activity at a glance
- customer finance/POD visibility
- supplier performance where permitted
MOVE:
- detailed attention queue to Action Centre / relevant operational page
MERGE:
- commercial/document shortcuts into compact left-column panels
REMOVE:
- duplicated status information already present in Activity cards

### Dispatcher
KEEP:
- Reports & Statistics
- Activity at a glance
- resource availability
- live exceptions
MOVE:
- detailed fleet allocation/register functions to My Fleet / Drivers & Vehicles
MERGE:
- live exceptions below Activity on the right column, not as a competing independent dashboard shell
ADD/FIX:
- use xdrive-owner-dashboard-grid directly for canonical geometry

### Owner Driver
KEEP:
- Reports & Statistics
- Accounts Payable
- Reports
- Feedback
- Activity at a glance
REMOVE:
- all old inline 10/11/12/13px operational typography
ADD/FIX:
- canonical 14/18 body/actions and 16/20 important values
- shared dashboard geometry/classes instead of local inline layout where possible

### Company Driver
KEEP:
- execution-focused Reports & Statistics
- current assignment
- next booking
- readiness
MOVE:
- commercial tools out unless the role has explicit commercial authority
REMOVE:
- any owner-driver commercial panels from employed driver
ADD/FIX:
- same global typography and panel geometry

## GLOBAL RULES
- no mock data
- no duplicated KPI
- no second copy of My Fleet on Dashboard
- no role-local font shrink
- no 10–13px operational text except 13px top navbar
- page title 20/26/700
- section/panel important titles 16/20/700
- body/labels/meta/actions 14/18
- active/selected 700
- same shared geometry across roles; only content/permissions differ

## EXECUTION ORDER
1. Fix shared typography leaks in Dashboard sources
2. Align Broker to canonical left/right column ordering
3. Align Dispatcher to canonical owner grid
4. Normalize Owner Driver dashboard to shared classes and typography
5. Verify Customer hierarchy and remove duplicated attention/status data
6. Run dashboard contracts
7. TypeScript
8. Authenticated visual verification for all seven roles
9. Only then mark Dashboard PASS and proceed to Directory
