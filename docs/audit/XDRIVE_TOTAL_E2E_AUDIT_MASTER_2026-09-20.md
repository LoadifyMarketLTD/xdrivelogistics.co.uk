# XDrive Logistics — Total E2E Functional Audit Master
Date: 2026-09-20
Scope: full platform, fresh audit from zero.
Rule: no historical PASS is inherited. Every PASS requires fresh evidence from this audit run.

## Audit evidence standard
Each test must record: test ID, role/account, preconditions, action, expected result, observed result, status, severity, evidence and repair reference.
Statuses: N/T, PASS, FAIL, PARTIAL, BLOCKED.
Severity: CRITICAL, MAJOR, MINOR, COSMETIC.
Evidence can include route/page, screenshot, API request/response, database before/after rows, browser console, server log, Android logcat, notification receipt and Git commit.
Any confirmed defect is repaired in the canonical source and regression-tested where practical before it can move to PASS.

## Discovered platform surface
Fresh code inventory: 277 page routes, 185 API routes, 22 existing Playwright specs and 279 unit-test files.
Canonical business workspaces: Owner Operator (/driver), Shipper (/customer), Broker (/broker), Carrier/Fleet (/admin), plus Platform Owner (/super-admin).
Canonical onboarding account types: Customer/Shipper, Broker/Shipper, Fleet/Courier Company, Owner Operator, Company Driver.
Workspace roles to test: Platform Owner, Company Owner, Company Admin, Carrier Admin, Broker, Customer, Fleet Manager, Dispatcher, Driver, Owner Driver, Finance, Compliance, Viewer.
Generated inventories:
- docs/audit/XDRIVE_PAGE_ROUTE_INVENTORY_2026-09-20.csv
- docs/audit/XDRIVE_API_ROUTE_INVENTORY_2026-09-20.csv
## Phase 0 — Technical baseline and environment integrity
T0-01 Git branch/status and uncommitted-file inventory.
T0-02 TypeScript typecheck from clean current source.
T0-03 ESLint full repository.
T0-04 Unit tests full repository.
T0-05 Production Next.js build and Supabase environment validation.
T0-06 Netlify configuration/release gate inspection; no CI Actions required.
T0-07 Supabase migrations, schema drift, security/performance advisors.
T0-08 Route inventory versus protected-route registry; unknown protected routes must fail closed.
T0-09 API inventory: HTTP methods, authentication, role checks, tenant checks and input validation.
T0-10 Client bundle secret scan: service-role/private keys must never be exposed.
T0-11 Browser console/network baseline for public and protected workspaces.
T0-12 Database referential-integrity/orphan checks on critical entities.

## Phase 1 — Public site, registration and account lifecycle
AUTH-01 Public landing/navigation/footer/legal pages.
AUTH-02 Register entry points and account-type selection.
AUTH-03 Customer/Shipper public registration.
AUTH-04 Broker/Shipper public registration.
AUTH-05 Fleet/Courier Company public registration.
AUTH-06 Owner Operator public registration.
AUTH-07 Company Driver direct public registration must be blocked; invite-only path required.
AUTH-08 Email verification/confirmation and post-confirmation redirect.
AUTH-09 Login success and invalid-credential handling.
AUTH-10 Password reset request, reset completion and expired-link behavior.
AUTH-11 Logout invalidates usable session state.
AUTH-12 Expired/revoked session behavior and protected-route redirect.
AUTH-13 Duplicate email/company/registration conflict handling.
AUTH-14 Terms/privacy/legal acceptance evidence is persisted.
## Phase 2 — Onboarding and approval
ONB-CUST-01 Customer/Shipper company creation and immediate workspace activation.
ONB-CUST-02 Customer profile/company details edit and persistence.
ONB-BROKER-01 Broker company details, required company-registration/public-liability documents and conditional VAT evidence.
ONB-BROKER-02 Broker pending-review gate, request-changes path, approval and rejection path.
ONB-FLEET-01 Fleet company details and required compliance documents.
ONB-FLEET-02 Vehicles, insurance, Goods in Transit and conditional operator-licence/VAT rules.
ONB-FLEET-03 Pending approval, request changes, approval, rejection and resubmission.
ONB-OWNER-01 Owner Operator identity/business onboarding and company workspace creation.
ONB-OWNER-02 Driving licence, proof of address, right-to-work and conditional CPC/visa rules.
ONB-OWNER-03 Canonical owner vehicle and vehicle-insurance readiness.
ONB-DRIVER-01 Fleet invitation to Company Driver.
ONB-DRIVER-02 Invitation acceptance, password setup and company binding.
ONB-DRIVER-03 Required identity documents and review workflow.
ONB-DRIVER-04 Company Driver cannot gain unrelated company/commercial access.
ONB-NEG-01 Incomplete required fields/documents cannot incorrectly activate restricted workspaces.
ONB-NEG-02 Suspended/rejected company/account cannot bypass approval gates.
## Phase 3 — Role and permission matrix
RBAC-01 Test every protected route for each applicable workspace role.
RBAC-02 Platform Owner only access to /super-admin.
RBAC-03 Company Owner/Admin full permitted carrier controls.
RBAC-04 Carrier Admin commercial/operations controls without owner-only escalation.
RBAC-05 Fleet Manager fleet/jobs only according to capability map.
RBAC-06 Dispatcher allocate/dispatch/track only according to capability map.
RBAC-07 Finance finance/invoice/payment/margin access only.
RBAC-08 Compliance driver/vehicle/document/incident access only.
RBAC-09 Viewer read-only and no mutation endpoints.
RBAC-10 Broker isolated to broker workspace and its customer/carrier relationships.
RBAC-11 Customer isolated to shipper workspace and own company data.
RBAC-12 Driver requires active account + active company + active driver + app_access.
RBAC-13 Company Driver commercial bid restrictions are enforced.
RBAC-14 Owner Driver commercial workspace behavior and billing access.
RBAC-15 Cross-workspace URL tampering returns forbidden/redirect and no data leak.
RBAC-16 Direct API privilege escalation attempts return 401/403/409 as appropriate.
## Phase 4 — Customer/Shipper E2E
CUS-01 Dashboard metrics/actions match server state.
CUS-02 Post Load: pickup/delivery addresses, date/time windows, contacts and references.
CUS-03 Cargo: pallets, dimensions, weight, stackable/value/requirements.
CUS-04 Vehicle requirement and loading options including tail lift/handball/forklift.
CUS-05 Attachments/document upload on posting.
CUS-06 Draft/save/edit/publish/cancel/repost behavior.
CUS-07 Own Loads filters/status/actions.
CUS-08 Quotes inbox receives eligible carrier/owner-driver bids.
CUS-09 Quote comparison shows correct bidder/company/vehicle/price/terms.
CUS-10 Award one quote atomically; losing quotes cannot remain awardable.
CUS-11 Booking created exactly once from award.
CUS-12 Tracking reflects driver lifecycle and live GPS/ETA when available.
CUS-13 Diary/event log reflect canonical events and ordering.
CUS-14 Messages use real thread context and tenant-safe participants.
CUS-15 POD/document review shows real server evidence.
CUS-16 Invoice view matches commercial agreement and awarded quote.
CUS-17 Dispute creation, evidence, status and resolution workflow.
CUS-18 Directory/network interactions and direct-booking behavior if enabled.
CUS-19 Notifications remain operational-domain correct; finance events stay in finance.
CUS-20 Account/settings/team/membership billing persistence.
## Phase 5 — Carrier/Fleet E2E
CAR-01 Marketplace search/filter/radius/vehicle and saved/dismissed behavior.
CAR-02 Submit quote, edit/withdraw where allowed and duplicate-bid prevention.
CAR-03 Won/accepted work appears once and commercial terms are immutable.
CAR-04 Fleet dashboard metrics reconcile with jobs/drivers/vehicles.
CAR-05 Driver CRUD/invite/activation/suspension.
CAR-06 Vehicle CRUD, assignment, readiness and document status.
CAR-07 Allocate/reallocate job to eligible driver.
CAR-08 Operations Centre/active jobs/status tracking.
CAR-09 Fleet positions and live-location privacy.
CAR-10 Driver availability/future positions.
CAR-11 Maintenance/compliance/document expiry workflows.
CAR-12 Return Journey marketplace and match behavior.
CAR-13 Diary reflects jobs and operational changes.
CAR-14 POD review/download and evidence integrity.
CAR-15 Carrier invoice generation/register/status/payment-history.
CAR-16 Finance balances/reports/payment controls.
CAR-17 Company members, dispatchers, roles and invitations.
CAR-18 Incidents/disputes and resolution.
CAR-19 Notifications/settings/account/billing.
CAR-20 Broker invitations/network relationships where enabled.
## Phase 6 — Driver / Owner Driver / Company Driver E2E
DRV-01 Login/device-session binding and stale-session revocation.
DRV-02 Driver dashboard/Today and active-job priority.
DRV-03 Available Loads authorization, distance and vehicle matching.
DRV-04 Quote submit/status/withdraw and owner-driver commercial eligibility.
DRV-05 Awarded/Won Work/booking receipt.
DRV-06 Explicit accept semantics if required by canonical backend contract.
DRV-07 On My Way to Collection -> On Site Collection -> Loaded.
DRV-08 Collection evidence upload and server-authoritative validation.
DRV-09 Multi-stop ordered execution: arrived/completed per stop and blocked out-of-order transitions.
DRV-10 On My Way to Delivery -> On Site Delivery.
DRV-11 Google Maps/Waze stage navigation and permanent full-route map.
DRV-12 POD: recipient, signature, required photo(s), notes and persisted evidence.
DRV-13 Delivered state, immutable history and auto-invoice behavior.
DRV-14 My Quotes, History/Diary, Event Log.
DRV-15 Messages are real API threads, never local-only.
DRV-16 Documents/Profile/Vehicle use server data and secure upload/preview.
DRV-17 Availability Private/Fleet/Exchange and auto-expiry.
DRV-18 Who's Nearby privacy: exact own-fleet, rounded exchange location.
DRV-19 Smart Load Alerts and notification channel preferences.
DRV-20 Future Position and Return Journeys persistence/matching.
DRV-21 Offline status queue ordering/dedupe/replay; commercial/POD uploads remain fail-safe.
DRV-22 Tracking foreground service, GPS denied/degraded behavior and reconnection.
DRV-23 Push registration/deep link when production Firebase config is available.
## Phase 7 — Broker E2E
BRK-01 Broker dashboard/action centre.
BRK-02 Customer creation/linking and customer isolation.
BRK-03 Enquiry -> Post Load on behalf of correct customer.
BRK-04 Load publication and carrier sourcing.
BRK-05 Carrier Network/Directory eligibility and relationship controls.
BRK-06 Receive/compare carrier quotes.
BRK-07 Margin calculation and commercial separation of customer price/carrier cost.
BRK-08 Award and job creation.
BRK-09 Job tracking/diary/POD review.
BRK-10 Customer invoices and carrier costs.
BRK-11 Finance/margins reconciliation.
BRK-12 Disputes/incidents.
BRK-13 Team/account/settings/billing/notifications.
BRK-14 Broker cannot access unrelated customer/company data.

## Phase 8 — Finance and billing
FIN-01 Transport invoice lifecycle: draft/submitted/approved/paid/void/disputed as supported.
FIN-02 Auto-generated invoice after qualifying delivered/POD workflow is idempotent.
FIN-03 Invoice items/VAT/payment terms/totals match commercial agreement.
FIN-04 Customer AR and carrier AP visibility boundaries.
FIN-05 Payment history cannot be forged or duplicated.
FIN-06 Stripe Connect company binding and direct-charge audit projection if enabled.
FIN-07 Transport funds are separate from XDrive membership billing.
FIN-08 Membership subscription create/renew/cancel/status/webhook idempotency.
FIN-09 Billing role access and invoice/document download authorization.
FIN-10 Finance events never contaminate operational Driver Alerts.
## Phase 9 — Admin and Platform Owner
ADM-01 Carrier admin dashboard and action centre.
ADM-02 Company/member/driver/vehicle administration boundaries.
ADM-03 Compliance queues and document verification/request changes.
ADM-04 Job intervention actions are server-authoritative and audited.
ADM-05 Disputes/incidents/cancellations.
ADM-06 Notifications and support operations.
ADM-07 Settings and company identity changes.
SA-01 Platform Owner dashboard and global metrics.
SA-02 Companies/users/onboarding review.
SA-03 Platform cases and append-only case events.
SA-04 Fraud/document fingerprints/review cases.
SA-05 Feature flags/runtime settings behavior.
SA-06 Platform document requests and POD reviews.
SA-07 Finance reconciliations and membership subscriptions.
SA-08 Support tickets.
SA-09 Global audit trail records actor, target, action and timestamp.
SA-10 Platform Owner mutations cannot silently bypass domain invariants.
## Phase 10 — Notifications, messaging, support and documents
COMMS-01 In-app notification creation/recipient isolation/read state.
COMMS-02 Operational versus finance notification-domain separation.
COMMS-03 Email triggers for registration/onboarding/awards/job events where configured.
COMMS-04 Push device registration, revoke and deep-link behavior.
COMMS-05 Message thread creation/reply participant authorization.
COMMS-06 Job-context messages cannot leak across companies.
DOC-01 Driver/vehicle/company/job/POD/invoice document buckets and metadata.
DOC-02 MIME/magic-byte/size validation.
DOC-03 Cross-company storage access denied.
DOC-04 Signed URLs expire and cannot be repurposed for another document.
DOC-05 Document verification/rejection/risk/expiry states.
SUP-01 Support ticket create/update/attachment/log archive where implemented.
SUP-02 Complaints/contact/public support paths persist or dispatch correctly.

## Phase 11 — Data, security and resilience
SEC-01 RLS state and policies on all application tables.
SEC-02 Tenant isolation for jobs/bids/invoices/messages/documents/tracking.
SEC-03 Unauthenticated and wrong-role API calls.
SEC-04 Input validation, mass assignment and IDOR checks on mutations.
SEC-05 Session/device binding, logout and token refresh.
SEC-06 Storage authorization and signed URLs.
SEC-07 Secret exposure scan.
SEC-08 Rate-limit/abuse controls where configured.
SEC-09 Audit-log completeness for high-risk mutations.
DB-01 FK/orphan/invariant checks.
DB-02 Status enum and lifecycle transition integrity.
DB-03 RPC/trigger idempotency and concurrency behavior.
DB-04 Migration history/drift/duplicate migration checks.
DB-05 Index/performance advisor review.
DB-06 Realtime publications/subscriptions where product relies on them.
RES-01 Network failures/timeouts return safe UI errors and no duplicate business mutations.
RES-02 Refresh/back/re-login never regress server state.
## Phase 12 — Android, responsive, accessibility and performance
AND-01 Every Android page/button/input/back path.
AND-02 Pixel 7 and Pixel 10 real-device smoke.
AND-03 Light/night mode and font scaling.
AND-04 Camera/file picker/location/notification permission flows.
AND-05 Background tracking notification/service lifecycle.
AND-06 Offline/reconnect queue and location buffering.
AND-07 Crash/ANR/logcat sweep.
WEB-01 Desktop/mobile responsive layouts for all primary workspaces.
WEB-02 Keyboard navigation/focus labels/form validation.
WEB-03 Empty/loading/error states use real data and no fake placeholders.
WEB-04 Browser console/network errors.
PERF-01 Key dashboard/API response timings.
PERF-02 Long lists/filter performance.
PERF-03 Tracking update cadence and resource use.
PERF-04 Build bundle/runtime warnings with production impact.

## Release gate
GO is allowed only when there are zero unresolved CRITICAL defects, zero unresolved security/tenant-isolation defects, and all core E2E commercial flows pass with fresh evidence.
Core flow A: Customer posts -> carrier/owner-driver quotes -> customer awards -> booking -> allocation -> driver execution -> tracking -> POD -> invoice.
Core flow B: Broker customer enquiry -> post -> carrier bid -> margin/award -> execution -> POD -> customer/carrier finance.
Core flow C: Fleet company invites driver -> driver onboarding -> vehicle/driver readiness -> assignment -> execution.
Core flow D: Owner Operator onboarding -> marketplace -> quote -> won work -> self-execution -> invoice.
All negative authorization/cross-company variants of these flows must also pass.

## Baseline findings opened before execution
SEC-BASE-01: Supabase advisor reports RLS disabled on public.spatial_ref_sys. Do not change automatically; determine whether this PostGIS table is intentionally exposed and document the chosen policy/remediation.
Current repository had pre-existing untracked audit/typecheck files before this audit; they must not be overwritten or mistaken for fresh evidence.
