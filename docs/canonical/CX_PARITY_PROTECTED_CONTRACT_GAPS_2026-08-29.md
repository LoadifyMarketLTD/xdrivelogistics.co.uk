# CX → XDrive Protected Contract Gaps

Date: 2026-08-29
Branch: `fix/cx-dashboard-convergence-20260829`
Status: ACTIVE IMPACT AUDIT — NO HOSTED/DB CHANGES AUTHORISED BY THIS DOCUMENT

This document records CX parity items that cannot be completed honestly as UI-only work. The rule is **protected by default, not immutable**: do not weaken RLS, lifecycle, privacy or API authority merely to expose a button. Each item needs a narrow contract decision before implementation.

Before implementing any row below:
1. identify the authoritative data model;
2. audit existing RLS/API permission boundaries;
3. define the narrowest required role/capability change;
4. identify web/mobile/customer/broker/carrier impact;
5. add contract tests for auth, company isolation and negative paths;
6. obtain explicit approval for the protected change;
7. implement separately and then resume UI parity.

## 1. Book Direct

### CX behaviour confirmed
Official TEG guidance exposes **Book Direct** from Directory, Live Availability, Return Journeys, Loads, Quotes, Diary and Freight Vision. The booking flow can target an Exchange Member, Driver/Subcontractor or Company Vehicle and ends with a booking confirmation.

### XDrive evidence
- `jobs.exchange_visibility` and `jobs.direct_invite_company_id` already exist and Company Marketplace already honours direct visibility.
- `/api/marketplace/company` can read direct invitations when `exchange_visibility = direct` and `direct_invite_company_id` matches the viewer company.
- `/api/jobs/create` currently accepts only `publish: boolean` and writes `exchange_visibility = exchange|private`; it does **not** accept a direct target or a direct-booking authority model.
- Current posting UI has no Book Direct target selector.

### Verdict
`BLOCKED-BY-CONTRACT` for a complete implementation. Do not fake Book Direct by navigating to Post Load or by publishing to the open Exchange.

### Required narrow change when approved
1. Extend authenticated job-creation contract with an explicit posting mode: `draft | exchange | direct`.
2. Require a verified direct target type and identifier.
3. Validate caller company authority.
4. Validate the target is an active permitted member/resource and is not the posting company where inappropriate.
5. Preserve exact pre-award privacy boundary.
6. Decide whether direct booking creates a direct invitation first or immediately creates an awarded/allocated booking. This must use the canonical award/allocation path rather than ad-hoc status writes.
7. Emit recipient-scoped notification/confirmation through the existing notification architecture.
8. Add audit/event history and idempotency coverage.

## 2. Load Alerts and notification preferences

### CX behaviour confirmed
CX load alerts can be driven by current GPS position, home/base location and return journeys; users can opt in/out of alert classes such as multi-drop/daily-hire and receive alert cards/notifications.

### XDrive evidence
- XDrive has `notification_events` as an event/outbox layer and `notifications` as recipient-scoped inbox state.
- Existing bridged event types include job assignment, bid acceptance, POD, tracking ETA and invoice events.
- Marketplace search, nearby availability, driver position and return journeys exist.
- Driver and shared company notification inboxes now expose a first-class **Load Alerts** view for real alert records when they exist.
- Current `company_settings` persists only four email flags: new job, status change, invoice paid and bid received.
- No canonical `load_alert` producer or persisted granular alert-preference contract was found.

### Verdict
Inbox discoverability is `PARTIAL/KEEP`; background/push matching and granular preferences are `BLOCKED-BY-CONTRACT`. A UI toggle must not claim to control alerts until the server producer consumes it.

### Required narrow change when approved
1. Define alert preferences/defaults per user/driver, including load type/multi-drop and location source.
2. Define eligible live-load matching using existing public marketplace fields and server-side private driver position where authorised.
3. Define dedupe/idempotency so the same load is not repeatedly alerted.
4. Bridge matched alerts into `notification_events`/`notifications` with `recipient_user_id`.
5. Preserve pre-award location/member privacy.
6. Add channel selection only where a real delivery channel exists.

## 3. Generic Freight Messenger parity

### CX behaviour confirmed
Freight Messenger is accessible from Directory, Live Availability, Diary, user/driver lists and booking contexts; current TEG Messenger also supports group messaging and message actions.

### XDrive evidence
- `/api/driver/messages` is intentionally participant-scoped and safe: a Driver can load only conversations in which they are already a participant and may reply only to an existing verified one-counterpart conversation.
- The endpoint explicitly prevents arbitrary user discovery/contact.
- No equally narrow generic company/customer/broker conversation-start authority contract has been established.

### Verdict
`BLOCKED-BY-CONTRACT` for generic cross-role start-message parity. Keep Driver messaging intact. Do not broaden the Driver service-role endpoint to arbitrary recipients.

### Required narrow change when approved
Define contextual conversation-start permissions separately for Directory, live availability, booked job, quote and invoice contexts, with participant verification, company authority, audit history and recipient privacy.

## 4. Customer carrier comparison — reputation and ETA/distance

### CX behaviour confirmed
Carrier selection surfaces include member identity, feedback/reputation and operational comparison information before booking.

### XDrive evidence
- Customer quote comparison now shows verified member identity/profile link, quote price, delta versus the lowest visible quote, message/terms and submission time.
- Member Profile exposes safe public business identity.
- Company Member Profile currently returns feedback as explicitly unavailable.
- Existing `reviews` semantics do not provide a verified reviewed-company reputation aggregate contract.
- No safe pre-award bidder live-position/ETA contract was found for Customer quote comparison.

### Verdict
`PARTIAL / BLOCKED-BY-CONTRACT` for reputation and bidder ETA/distance. Price, bidder identity, message, quote state and award remain valid.

### Required narrow change when approved
Define reviewed-member subject semantics and safe aggregation before publishing ratings. Define any pre-award ETA/distance signal from coarse/authorised operational data without exposing exact driver position.

## 5. Multi-drop / Regular Load / Daily Hire posting

### CX behaviour confirmed
CX supports On Demand, Regular Load and Daily Hire, with multi-drop flows. Up to 10 stops can expose stop structure; larger daily-hire/multi-drop jobs use a different contract and do not expose all delivery addresses pre-booking.

### XDrive evidence
- Marketplace can classify/display On Demand, Regular Load and Daily Hire from service-mode data.
- Search quick-tabs for those classifications are now deterministic.
- Current `LoadPostingForm` and `/api/jobs/create` create a single collection + single delivery job.
- `/api/jobs/create` has no `serviceMode`, recurrence or stops input.
- No canonical stops/recurrence/daily-hire creation contract was found.

### Verdict
`BLOCKED-BY-CONTRACT` for true posting parity. Do not add decorative Regular/Daily Hire or Multi-Drop controls that still create a normal one-stop job.

### Required narrow change when approved
Choose a canonical model for repeat schedule and multi-stop execution, including stop order, per-stop contacts/evidence/status, pre-award privacy, mobile execution, tracking, POD, invoice and cancellation semantics.

## 6. Ready to Invoice eligibility queue

### CX behaviour confirmed
Accounting includes an explicit work queue for completed bookings that are ready to invoice after the required operational evidence is available.

### XDrive evidence
- Company invoice register supports Draft, Sent/Awaiting Payment, Overdue, Paid, Disputed and Cancelled.
- Invoice detail supports lifecycle and payment history.
- Driver finance already has a driver-specific eligible-jobs invoice-generation endpoint.
- No audited company-wide eligibility projection was found that combines completed lifecycle state, POD/evidence readiness, invoice ownership and absence of an existing invoice.

### Verdict
`BLOCKED-BY-CONTRACT` for a company-wide Ready to Invoice queue. Do not infer readiness from `completed` alone.

### Required narrow change when approved
Define whether readiness is customer-invoice, carrier-invoice or both; required POD/document conditions; duplicate prevention; credit-note/supplementary-invoice interaction; and role authority.

## 7. SmartPay-derived advanced finance behaviours

### CX behaviour confirmed
Relevant functional patterns include draft/create/upload, batch invoices, supplementary invoices, credit notes, open invoice queries, payment groups, external invoice upload and statements/export.

### XDrive evidence
- XDrive has invoice lifecycle, customer/carrier invoice registers, balances, payments, secure preview and CSV reports/exports.
- Event Log CSV export exists but is not a finance statement.
- No verified invoice-register contract was found for arbitrary external invoice upload, supplementary/credit-note creation or batch mutation.

### Verdict
Audit each action independently. Do not copy SmartPay brand/payment-rail assumptions. Existing invoice/payment/reporting features remain `KEEP`; unsupported advanced mutations remain `BLOCKED-BY-CONTRACT`.

### Required narrow change when approved
Define invoice/document ownership, audit trail, payment reconciliation semantics, mutation authority and idempotency for each advanced action before exposing it.

## 8. Customer/carrier/driver complaints and Report Abuse

### CX behaviour confirmed
Feedback policy and trading-member workflows include complaint/abuse escalation tied to member behaviour and booking evidence.

### XDrive evidence
- Broker `job_disputes` is a real workflow with resolve/escalate operations.
- Authenticated `/api/support/tickets` can create billing, operations, technical, compliance and general tickets.
- Platform-owner complaint/support tooling under `/super-admin` is intentionally excluded from this branch.
- No verified customer/carrier/driver `Report Abuse` contract links a trading relationship/job/review to moderation ownership and evidence.

### Verdict
Broker disputes are `KEEP`; generic cross-role Report Abuse is `BLOCKED-BY-CONTRACT`.

### Required narrow change when approved
Define allowed reporters/subjects, booking/member linkage, evidence, moderation state, notifications, abuse-rate controls and handoff to platform administration without exposing `/super-admin` internals.

## 9. Telematics provider management

### CX behaviour confirmed
Fleet tracking can be enriched by integrated vehicle/telematics data sources.

### XDrive evidence
- XDrive live driver positions, Live Availability and Freight Vision work with existing first-party location data.
- No audited provider credential/configuration contract is established for third-party telematics integrations.

### Verdict
`BLOCKED-BY-CONTRACT`.

### Required narrow change when approved
Define provider credentials/secrets, company ownership, vehicle identity matching, source precedence, freshness/retention and fail-closed behaviour before adding provider UI.

## Execution rule

UI-only work continues around these gaps. When one of the items above becomes the next blocking parity item, perform the explicit API/DB/RLS/lifecycle impact review and obtain the required approval before mutating the protected contract. No gap is to be silently downgraded, faked or marked KEEP.
