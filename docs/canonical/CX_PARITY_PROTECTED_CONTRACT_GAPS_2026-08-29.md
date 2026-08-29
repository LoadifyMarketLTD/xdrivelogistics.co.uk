# CX → XDrive Protected Contract Gaps

Date: 2026-08-29
Branch: `fix/cx-dashboard-convergence-20260829`
Status: ACTIVE IMPACT AUDIT — NO HOSTED/DB CHANGES AUTHORISED BY THIS DOCUMENT

This document records CX parity items that cannot be completed honestly as UI-only work. The rule is **protected by default, not immutable**: do not weaken RLS, lifecycle, privacy or API authority merely to expose a button. Each item needs a narrow contract decision before implementation.

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
- No canonical `load_alert` producer or persisted alert-preference contract was found.

### Verdict
`BLOCKED-BY-CONTRACT` for background/push alert parity. The notification inbox can be repaired independently, but a UI preference toggle must not claim to control alerts until the server producer consumes it.

### Required narrow change when approved
1. Define alert preferences and defaults per user/driver, including load type/multi-drop and location source.
2. Define eligible live-load matching using existing public marketplace fields and server-side private driver position where authorised.
3. Define dedupe/idempotency so the same load is not repeatedly alerted.
4. Bridge matched alerts into `notification_events`/`notifications` with recipient_user_id.
5. Preserve pre-award location and member privacy.
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
- Customer quote comparison already resolves bidder company/person identity and price.
- Member Profile exposes safe public business identity.
- Company Member Profile currently returns feedback as explicitly unavailable.
- Existing `reviews` semantics do not provide a verified company-level reputation aggregate contract.
- No safe pre-award bidder live-position/ETA contract was found for Customer quote comparison.

### Verdict
`PARTIAL / BLOCKED-BY-CONTRACT` for reputation and bidder ETA/distance. Price, bidder identity, message, quote state and award/reject remain valid.

### Required narrow change when approved
Define reviewed-member subject semantics and safe aggregation before publishing ratings. Define any pre-award ETA/distance signal from coarse/authorised operational data without exposing exact driver position.

## 5. Multi-drop / Regular Load / Daily Hire posting

### CX behaviour confirmed
CX supports On Demand, Regular Load and Daily Hire, with multi-drop flows. Up to 10 stops can expose stop structure; larger daily-hire/multi-drop jobs use a different contract and do not expose all delivery addresses pre-booking.

### XDrive evidence
- Marketplace can classify/display On Demand, Regular Load and Daily Hire from service-mode data.
- Current `LoadPostingForm` and `/api/jobs/create` create a single collection + single delivery job.
- No canonical stops/recurrence/daily-hire creation contract was found.

### Verdict
`BLOCKED-BY-CONTRACT` for true posting parity. Do not add decorative Regular/Daily Hire tabs that still create a normal one-stop job.

### Required narrow change when approved
Choose a canonical model for repeat schedule and multi-stop execution, including stop order, per-stop contacts/evidence/status, pre-award privacy, mobile execution, tracking, POD, invoice and cancellation semantics.

## 6. SmartPay-derived advanced finance behaviours

### CX behaviour confirmed
Relevant functional patterns include Ready to Invoice, draft/create/upload, batch invoices, supplementary invoices, credit notes, open invoice queries, payment groups and external invoice upload.

### XDrive evidence
XDrive already has invoice lifecycle, customer/carrier invoice registers, balances, payments, reports and secure invoice preview. Some advanced actions are not present as verified contracts.

### Verdict
Audit each action independently. Do not copy SmartPay brand/payment-rail assumptions. Supplementary invoices, credit notes, batch mutation, external upload and invoice-query workflow require explicit data/permission contracts before action buttons are enabled.

## Execution rule

UI-only work continues around these gaps. When one of the items above becomes the next blocking parity item, perform the explicit API/DB/RLS/lifecycle impact review and obtain the required approval before mutating the protected contract. No gap is to be silently downgraded, faked or marked KEEP.
