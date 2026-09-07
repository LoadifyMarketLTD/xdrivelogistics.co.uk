# CX benchmark → XDrive connected workspaces

Date: 2026-09-06

Purpose: preserve the useful operating patterns observed in the authenticated Courier Exchange account and official Transport Exchange Group documentation, then adapt them to XDrive without copying proprietary visual design or weakening XDrive tenant/privacy controls.

## Rules

- CX is a product benchmark, not a UI template.
- XDrive keeps its own visual language, role boundaries, status model and evidence ledger.
- Never expose unrelated drivers' exact private GPS positions to Customer/Broker roles.
- Never fabricate Delivery/Payment ratings, GPS state, read receipts, invoice state or compliance status.
- Reuse one canonical job/quote/award/driver/vehicle/invoice record across dashboards instead of creating role-specific copies.
- Direct booking must use one audited award/invite workflow and cannot bypass eligibility, compliance, tenant or finance gates.

## Authenticated CX extraction

### Dashboard / Driver Home

Observed: manual availability with 60-minute expiry; Available / Unavailable / Maybe Available; current location; operational intent such as Waiting for next job / Going home empty / On a journey / Go anywhere; Return Journey creation; optional ETA; capacity state Empty Vehicle / Co-load Possible / Fully Loaded; recent bookings; feedback; Who's Nearby; documents and expiry; Freight Messenger.

XDrive adaptation: Driver and Fleet use canonical availability presence + live execution tracking; future position and Return Journey remain separate but connected capacity sources. Customer/Broker see only role-authorised capacity/tracking, never unrelated exact driver coordinates.

### Directory

Observed: Companies and Drivers; member ID; location; phone; Delivery and Payment reputation columns; Chat; Book; country/member/location/radius/vehicle/body type/contact/specialist-service filters; Find My Nearest.

XDrive adaptation: one Member Directory shared by Driver, Carrier, Broker and Customer with privacy-scoped business identity. Reputation must be evidence-backed and split only when XDrive has separate delivery/payment evidence. Direct booking remains a future audited workflow until the existing `direct_invite_company_id` and award contracts are reconciled.

### Loads / Freight Radar

Observed: List View + interactive map; UK & ROI / Euro; All Live / On Demand / Regular Load / Daily Hire; origin/destination radius; vehicle-size range; body type; date; freight type; member; load age; pickup/delivery windows; distance; weight; packaging; dimensions; requested equipment/body; hard-copy POD requirement; payment terms; notes; member identity/contact.

XDrive adaptation: keep one marketplace query contract and expose different role views. Driver/Carrier use vehicle-fit discovery; Customer/Broker use owned-posting and sourcing views; Super Admin uses read-only marketplace oversight. Map clusters, route context and ULEZ/toll/access requirements are useful future refinements.

### Quotes

Observed: Received / Archived / Submitted / Unsuccessful; pickup/delivery time filters; load reference; booked-by filter; quote decisions connected to the load.

XDrive adaptation: retain canonical bids and atomic award workflow; enrich decision surfaces with carrier identity, vehicle capability, reputation evidence, price, ETA/distance and message access when those fields are real. Quote acceptance must flow into the same awarded job used by Fleet and Driver.

### Diary / Bookings

Observed: All / Unallocated / Allocated / In Progress / Completed / Cancelled / Expired / Awaiting Feedback / Recent Feedback; archived bookings; subcontracted/own booking filters; lifecycle timestamps; agreed rate; payment terms; POD; Replay; Order; Notes; History; Documents; Invoice; feedback; received-by/left-at/item count/delivery notes.

XDrive adaptation: Diary is the cross-role historical job record. It must point to canonical lifecycle, POD/signature/photos, documents, commercial terms, invoice state, messages and event history rather than copying those data into separate stores.

### Event Log / Replay

Observed/documented: tracking history, account login/logout history, date-scoped reports and export; Replay for tracked bookings with route trail, locations/times, standby/detours, average speed and report export.

XDrive adaptation: current user-scoped Event Log stays immutable/searchable/exportable. A future job Replay should read canonical tracking samples and remain available only to job participants and authorised operations/platform roles.

### Freight Messenger

Observed/documented: centralised participant messaging reachable from Directory, live availability, Diary and member/driver contexts; modern conversation controls and cross-device synchronisation.

XDrive adaptation: current participant-scoped messaging stays fail-closed and immutable. Add context entry points from job, quote, directory and tracking surfaces; do not invent arbitrary recipients or read-state until the data contract supports them.

### Finance / Accounts Receivable and Payable

Observed/documented: AR stages Dashboard / All / Ready to Invoice / Awaiting Payment / Paid / Customers / Archive / Statements; customer grouping; net/VAT/gross; bulk document/print/mark-paid actions; batch invoicing; AP approval/payment scheduling; off-platform payment reconciliation; supplementary invoices and credit notes; accounting integrations.

XDrive adaptation: connect completed job → POD readiness → invoice eligibility → invoice → payment history/ledger. Broker, Customer, Carrier/Driver and Super Admin must see the same invoice truth through role-specific financial views. No automatic refund/payout/transfer is introduced by this benchmark work.

### Reputation / Trust / Secure loads

Observed/documented: separate Delivery and Payment feedback; feedback visible in Directory/Loads/availability contexts; formal complaints distinct from feedback; Trustd-style identity/document verification and secure-load credentials.

XDrive adaptation: do not label generic reviews as Delivery or Payment until separate evidence exists. Build separate reliability signals from verified delivery and payment facts. Secure-load identity/credential handoff is a later capability built on XDrive compliance and evidence controls.

### TMS / integrations

Official TEG documentation describes REST API integration for automated posting, real-time webhooks, tracking and document management.

XDrive adaptation: preserve API-first canonical records and event-driven integration points so Broker/Customer/Carrier/Fleet/Driver/Super Admin dashboards consume the same state instead of becoming isolated products.

## Connected dashboard contract

Every role home now gets a role-aware Connected Exchange panel. It is navigation/orchestration, not a second data source.

- Broker: Directory → Loads → Quotes → Live execution → Diary → Messages → Event Log → Finance.
- Customer: Directory → Loads → Quotes → authorised live tracking → Bookings → Diary → Messages → Event Log → Invoices.
- Driver: Directory → Availability → Return Journeys → Who's Nearby → Loads → Quotes → Diary → Messages → Event Log → Payment Report.
- Fleet: Live Availability → Drivers & Vehicles → Return Journeys → Jobs → Diary → Freight Vision → Messages → Event Log → Finance.
- Carrier/Admin: Directory → Live Availability → My Fleet → Return Journeys → Loads → Quotes → Diary → Messages → Event Log → Finance.
- Super Admin: Directory → Live Capacity → Marketplace → Operations → Fleet → Finance → Compliance → Audit Logs → Support.

## Official sources reviewed

- Transport Exchange Group: Live availability map.
- Transport Exchange Group: How do I post loads? / Book Direct.
- Transport Exchange Group: Allocating loads.
- Transport Exchange Group: Freight Messenger overview.
- Transport Exchange Group: The event log.
- Transport Exchange Group: The replay feature.
- Transport Exchange Group: How does feedback work? / Feedback policy.
- Transport Exchange Group: SmartPay Accounts Receivable / Accounts Payable / Raise an invoice / off-platform payments.
- Transport Exchange Group: How to integrate a new TMS with TEG.
