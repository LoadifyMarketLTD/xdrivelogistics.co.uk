# XDrive Logistics — CX Surgical Audit Matrix

**Date:** 25 September 2026 (UK)  
**Canonical PR:** #577  
**Branch:** `fix/driver-next-professional-page-20260923`  
**Purpose:** evidence-led inventory before any further CX-parity implementation.

## Classification

- **MATCH** — XDrive already has a real equivalent workflow.
- **PARTIAL** — backend/data exists but the workflow/UI is incomplete.
- **GAP-P0** — XDrive infrastructure exists; wire/expose it now.
- **GAP-P1** — real product workflow is missing.
- **GAP-P2** — schema/backend/security model required.
- **NO-COPY** — CX-specific advertising/branding or irrelevant behavior.
- **UNCONFIRMED** — insufficient evidence; do not implement.

## Evidence policy

Priority:
1. authenticated CX live content in Opera;
2. owner screenshots;
3. repository CX reference docs/contracts;
4. public CX bundle/routing for structural confirmation.

This matrix is **not final** until all ten CX top-level surfaces and reachable sub-surfaces are live-validated.

---

# 1. Dashboard

**Current evidence:** repository CX measurement documents + XDrive carrier dashboard source/contracts.  
**Live CX pass:** pending final live validation.

### Confirmed XDrive equivalents
- **MATCH** — operational control desk / jobs requiring attention.
- **MATCH** — unallocated, live, evidence/POD attention and exception signals.
- **MATCH** — driver/vehicle filters.
- **MATCH** — carrier-awarded work boundary.
- **MATCH** — direct allocation/open-job actions.
- **MATCH** — resource readiness: available/busy drivers, unassigned vehicles, document expiry.
- **MATCH** — recent bookings.
- **MATCH** — commercial/finance entry points.
- **MATCH** — quotes workflow shortcut.
- **MATCH** — Return Journeys shortcut.
- **MATCH** — responsive dense operational layout.

### Gaps
- **UNCONFIRMED** — any CX dashboard-only widgets/actions not present in retained screenshots/docs.
- **NO-COPY** — promotional/advertising blocks if encountered live.

---

# 2. Directory

**Current evidence:** XDrive Directory source + CX-informed contracts.  
**Live CX pass:** pending final live validation.

### Confirmed XDrive equivalents
- **MATCH** — Companies and Drivers views.
- **MATCH** — country, vehicle size, body type, phone, email, specialist service and tail-lift filters.
- **MATCH** — Find My Nearest by postcode/outcode + radius.
- **MATCH** — broad member/company location privacy.
- **MATCH** — Profile action.
- **MATCH** — Messages action.
- **MATCH** — Book Direct from authorised Broker / Customer / Carrier contexts.
- **MATCH** — server-validated direct booking target.
- **MATCH** — direct invite stays private rather than public Exchange broadcast.
- **MATCH** — delivery/payment reputation from real operational evidence.
- **MATCH** — minimum verified Delivery / Payment reliability filters.

### Gaps
- **UNCONFIRMED** — CX Directory-specific Groups behavior and whether it is the same grouping model as Diary Groups.
- **UNCONFIRMED** — any saved-directory-view behavior not retained in current evidence.
- **UNCONFIRMED** — all profile overlay secondary actions until live pass is repeated.

---

# 3. Live Availability

**Current evidence:** XDrive Live Availability source/contracts.  
**Live CX pass:** pending final live validation.

### Confirmed XDrive equivalents
- **MATCH** — Live Fleet.
- **MATCH** — Future positions.
- **MATCH** — Nearby Exchange.
- **MATCH** — Available / Busy / Fresh locations / Stale or missing / Future positions / conflicts signals.
- **MATCH** — postcode/outcode + radius nearest discovery.
- **MATCH** — location-distance sorting.
- **MATCH** — Exchange privacy boundary hides driver identity.
- **MATCH** — Message.
- **MATCH** — Book Direct.
- **MATCH** — Save Default / Load Default / Clear.
- **MATCH** — existing future-position/availability data model.

### Gaps
- **UNCONFIRMED** — CX map-specific controls, clustering, pin actions and secondary dialogs until live pass.
- **UNCONFIRMED** — whether CX supports named saved views here beyond a single default.
- **UNCONFIRMED** — any availability advertising controls not already covered by My Fleet.

---

# 4. My Fleet

**Current evidence:** XDrive fleet dashboard and CX-informed contracts.  
**Live CX pass:** pending final live validation.

### Confirmed XDrive equivalents
- **MATCH** — dense fleet resource register.
- **MATCH** — drivers and vehicles canonical registers.
- **MATCH** — current/tracked location.
- **MATCH** — Future Position.
- **MATCH** — Return Journey.
- **MATCH** — Advertise capability.
- **MATCH** — tracking alerts.
- **MATCH** — compliance alerts.
- **MATCH** — assignments.
- **MATCH** — positions.
- **MATCH** — compliance.
- **MATCH** — canonical server-side fleet eligibility.
- **MATCH** — truthful unavailable tracking/compliance states.

### Gaps
- **UNCONFIRMED** — exact CX per-row secondary actions and context menus.
- **UNCONFIRMED** — maintenance workflow parity until CX live subpage review.
- **UNCONFIRMED** — whether CX exposes additional fleet availability calendars beyond XDrive Future Availability.

---

# 5. Return Journeys

**Current evidence:** XDrive page/API/RPC + CX-informed management contract.  
**Live CX pass:** pending final validation.

### Confirmed XDrive equivalents
- **MATCH** — Publish Return Journey.
- **MATCH** — Publish / Update.
- **MATCH** — Close Return.
- **MATCH** — authorised owner/admin/dispatcher operation.
- **MATCH** — same-company active-driver enforcement.
- **MATCH** — canonical atomic replacement rather than delete-first UI writes.
- **MATCH** — PostgreSQL driver/company binding.

### Gaps
- **UNCONFIRMED** — CX search/filter/map details and any discovery-market behavior on this surface.
- **UNCONFIRMED** — **Backload Rate Offered** commercial semantics.
- **UNCONFIRMED** — whether CX can attach a proposed commercial rate directly to return capacity.

---

# 6. Loads

**Current evidence:** authenticated CX live Loads page + XDrive Company Marketplace source/API.  
**Live CX pass:** started and partially complete.

### Confirmed matches
- **MATCH** — FROM + radius.
- **MATCH** — TO + radius.
- **MATCH** — vehicle size.
- **MATCH** — body/equipment.
- **MATCH** — freight type.
- **MATCH** — member name / ID.
- **MATCH** — advanced search.
- **MATCH** — pickup date range.
- **MATCH** — result-size control.
- **MATCH** — recent/default searches.
- **MATCH** — All Live / On Demand / Regular Load / Daily Hire.
- **MATCH** — List View.
- **MATCH** — Map / Freight Radar-style view.
- **MATCH** — expand/collapse.
- **MATCH** — Quote Now.
- **MATCH** — route details.
- **MATCH** — poster/member identity.
- **MATCH** — quote state on the load.
- **MATCH** — proposed/fixed budget display when present.
- **MATCH** — quote message.
- **MATCH** — electronic quote submission and withdrawal lifecycle.

### Confirmed gaps
- **GAP-P2** — Groups / Add-Edit Groups: no canonical group model exists.
- **PARTIAL** — poster phone exists in API projection but is not consistently surfaced in Company Marketplace UI.
- **PARTIAL** — Payment Terms exist in job/commercial data but are not exposed on the Company Marketplace load card.
- **PARTIAL** — Hard-copy POD exists canonically but is not exposed on the Company Marketplace load card.
- **UNCONFIRMED** — CX rule allowing poster to disable electronic quotes and require telephone contact. XDrive has no confirmed equivalent policy/workflow yet.
- **UNCONFIRMED** — exact UK & ROI / Euro region tab semantics versus XDrive country/radius filtering.
- **UNCONFIRMED** — any CX group-specific saved search behavior.

---

# 7. Quotes

**Current evidence:** XDrive Exchange Quotes source + CX-informed contracts.  
**Live CX pass:** pending final live validation.

### Confirmed XDrive equivalents
- **MATCH** — dedicated primary Quotes route.
- **MATCH** — marketplace quote lifecycle separated from Customer Quotes.
- **MATCH** — All.
- **MATCH** — Submitted.
- **MATCH** — Accepted / Won.
- **MATCH** — Unsuccessful.
- **MATCH** — Archived derived from withdrawn state without inventing DB status.
- **MATCH** — Pickup Time Within.
- **MATCH** — Delivery Time Within.
- **MATCH** — Load ID / Ref.
- **MATCH** — Booked by.
- **MATCH** — expand/collapse.
- **MATCH** — real pickup/delivery times.
- **MATCH** — legitimate submitted quote withdrawal.
- **MATCH** — quote commercial note and amount.

### Gaps
- **UNCONFIRMED** — all CX quote detail secondary actions until live pass.
- **UNCONFIRMED** — whether CX permits quote amendment after submit and under which states.
- **UNCONFIRMED** — any per-quote phone-only/manual quote mode tied to Loads electronic-quote suppression.

---

# 8. Diary

**Current evidence:** authenticated CX live Diary + owner screenshot + XDrive Diary source.  
**Live CX pass:** substantially complete, sub-actions still require final pass.

### Confirmed XDrive equivalents
- **MATCH** — All / Jobs Sub-contracted / Our Bookings.
- **MATCH** — date/time/ref/customer/driver search.
- **MATCH** — List / Split View.
- **MATCH** — Collapse/Expand.
- **MATCH** — Refresh.
- **MATCH** — status buckets including Awaiting Feedback and Recent Feedback.
- **MATCH** — Order.
- **MATCH** — Notes.
- **MATCH** — History.
- **MATCH** — Replay.
- **MATCH** — Documents.
- **MATCH** — POD.
- **MATCH** — Invoice.
- **MATCH** — load notes.
- **MATCH** — hard-copy POD data.
- **MATCH** — driver allocation.

### Confirmed/strong gaps
- **GAP-P0** — Payment Report shortcut from Diary.
- **GAP-P0** — Track shortcut to Freight Vision with job targeting.
- **GAP-P0** — Message / Freight Messenger shortcut with job context.
- **GAP-P0** — Edit shortcut to canonical job editor.
- **GAP-P0** — Cancel action using canonical server workflow.
- **GAP-P0** — expose Booked by / Booked to / phone / agreed rate / payment terms / vehicle ref directly on booking card where authorised.
- **GAP-P0** — expose execution milestones inline from canonical timeline/POD data.
- **GAP-P1** — Company Leave Feedback write workflow.
- **GAP-P1** — Booked By filter.
- **GAP-P1** — full Member / Driver filter semantics.
- **GAP-P1** — Re-book as safe clone/prefill to new job.
- **GAP-P1** — Re-post as safe new posting from historical work.
- **GAP-P1** — named Saved Views.
- **GAP-P2** — Diary Groups / Add-Edit Groups.

### Still unconfirmed
- **UNCONFIRMED** — exact CX Decline state/authority rules.
- **UNCONFIRMED** — Archived Bookings semantics versus ordinary status/history.
- **UNCONFIRMED** — any CX side-panel Contacts behavior that provides functionality not already in Directory/Messages.

---

# 9. Freight Vision

**Current evidence:** XDrive Freight Vision source/contracts.  
**Live CX pass:** pending final live validation.

### Confirmed XDrive equivalents
- **MATCH** — Active jobs.
- **MATCH** — On time.
- **MATCH** — Behind ETA.
- **MATCH** — Late.
- **MATCH** — Not tracking.
- **MATCH** — Not started.
- **MATCH** — each state acts as a filter.
- **MATCH** — fleet position map.
- **MATCH** — exception register.
- **MATCH** — operational timeline.
- **MATCH** — open full job.
- **MATCH** — contextual Message.
- **MATCH** — auto-refresh every 60 seconds.

### Gaps
- **GAP-P0** — canonical `?jobId=` targeting/focus from Diary Track shortcut is not yet confirmed in Freight Vision.
- **UNCONFIRMED** — CX map marker secondary actions / route replay / breadcrumb controls.
- **UNCONFIRMED** — exact stale-location warning thresholds versus CX.

---

# 10. Drivers & Vehicles

**Current evidence:** XDrive consolidated Resources page/contracts.  
**Live CX pass:** pending final live validation.

### Confirmed XDrive equivalents
- **MATCH** — consolidated Drivers & Vehicles destination.
- **MATCH** — Drivers Register.
- **MATCH** — Vehicles Register.
- **MATCH** — direct navigation to canonical driver register.
- **MATCH** — direct navigation to canonical vehicle register.
- **MATCH** — Live Availability connection.
- **MATCH** — Return Journeys connection.
- **MATCH** — separate My Fleet and Drivers & Vehicles concepts.
- **MATCH** — capability-gated driver/vehicle access.

### Gaps
- **UNCONFIRMED** — exact CX driver detail subpages and actions.
- **UNCONFIRMED** — exact CX vehicle detail subpages and actions.
- **UNCONFIRMED** — vehicle tracking settings subflow.
- **UNCONFIRMED** — mobile account management relationship to drivers.
- **UNCONFIRMED** — document/expiry actions from individual driver/vehicle detail.

---

# Cross-surface Settings findings already confirmed live

These were exposed by authenticated CX live Settings/My Profile while entering the internal app. They are not part of the ten primary tabs but affect parity planning.

- **GAP-P2** — MFA / 2FA enrolment, method change, challenge/recovery.
- **GAP-P2** — Departments model.
- **GAP-P2** — Notification Preferences model.
- **GAP-P2** — Groups model.
- **UNCONFIRMED** — Blocked Members business rules.
- **PARTIAL** — roles exist in XDrive but CX exposes finer account-role toggles; do not copy free-form toggles without XDrive capability design.
- **PARTIAL** — profile/messenger settings exist in pieces; exact parity requires dedicated Settings audit.
- **MATCH** — Event Log CSV + Print/Save PDF already exists; do not add duplicate export functions.

---

# Implementation gate

**Do not begin the next parity implementation block until all ten primary surfaces have completed live CX validation.**

Current live-audit status:
- Dashboard — repository-confirmed, live final pass pending.
- Directory — repository-confirmed, live final pass pending.
- Live Availability — repository-confirmed, live final pass pending.
- My Fleet — repository-confirmed, live final pass pending.
- Return Journeys — repository-confirmed, live final pass pending.
- Loads — live pass started; detailed gap comparison in progress.
- Quotes — repository-confirmed, live final pass pending.
- Diary — live pass substantially complete.
- Freight Vision — repository-confirmed, live final pass pending.
- Drivers & Vehicles — repository-confirmed, live final pass pending.

