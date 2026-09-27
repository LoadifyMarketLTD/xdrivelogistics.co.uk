# XDrive Logistics — CX Role & Function Full Audit

**Audit date:** 27 September 2026  
**Canonical blueprint:** `docs/benchmarks/CX_ROLE_FUNCTION_MASTER_BLUEPRINT_2026-09-25.md`  
**Scope:** Customer, Broker, Carrier / Company, Fleet Manager, Owner Driver, Fleet Employed Driver, Driver Base, cross-role marketplace / matching / tracking / POD / invoice / messaging, database security and production readiness.  
**Benchmark rule:** Courier Exchange functional direction, excluding SmartPay / escrow / platform-held settlement by explicit XDrive product decision.

## Executive status

This audit does **not** certify production launch completion yet.

Verified automated baseline after remediation:

- **81 / 81 automated audit checks PASS**
- **330 / 330 Vitest files PASS**
- **2067 / 2067 tests PASS**
- TypeScript: **PASS, 0 errors**
- ESLint: **PASS, 0 warnings/errors**
- Production Next.js build: **PASS, exit 0**
- `git diff --check`: **PASS**

The audit found and repaired real role-boundary, availability, matching, notification, encoding, test-contract and Fleet Manager persistence defects. Remaining blockers are listed below and must not be represented as closed until live/manual evidence exists.

---

## 1. Driver Base — status

### Verified in code/contracts
- Available Loads / search / filters.
- Quote flow where commercial permission is granted.
- Server-authoritative commercial access using `can_commercial_bid`.
- Load alert matching foundation.
- Availability.
- Destination priority and radius.
- Future position.
- Return Journey matching.
- Who's Nearby / nearby jobs.
- Jobs / booking history.
- Canonical lifecycle.
- GPS tracking.
- POD/evidence backend.
- Documents.
- Contextual messages.
- Notifications and notification preferences.
- Diary/history.
- Event Log.
- Traffic-aware ETA contracts.
- Market intelligence / PPM contracts.
- Directory/direct-booking contracts.
- Telematics ingestion contract.

### Remediations made during blueprint implementation
- Browser-side direct availability/matching profile writes replaced by authenticated server authority.
- Production radius constraint aligned to 10/20/30 miles.
- Return IQ now uses persisted destination-priority preferences.
- Marketplace discovery APIs fail closed when commercial bidding is revoked.
- Notification worker no longer marks requested push successful if push transport is unavailable.
- Driver Dashboard mojibake removed.
- Stale notification UI caveat removed now that preferences/matching backend exists.

### Still requires physical evidence
- Android multi-image collection/delivery evidence selection and upload on a real Pixel.
- Native navigation/ETA interaction on device.
- Hardware Back behaviour through the full execution lifecycle.

---

## 2. Fleet Employed Driver — status

### Verified
- Assigned-work boundary.
- Operational job access.
- Job notes restricted to the authenticated assigned Driver.
- Availability schedule bound to approved Driver identity.
- Owner/company finance denied.
- Billing/company admin denied.
- Company-wide Drivers/Vehicles denied.
- Commercial discovery hidden and backend-denied unless company explicitly enables `can_commercial_bid`.
- Own vehicle/documents/messages/event history remain available.

### Physical validation still required
- Receive assignment → accept → pickup → multi-evidence → loaded → delivery → multi-POD → signature/recipient → complete, on a connected physical device.

---

## 3. Owner Driver — status

### Verified
- Driver Base capability inheritance.
- Marketplace / quote / matching / alerts.
- Availability / future position / Return Journeys.
- Who's Nearby and Directory.
- Owner-only finance surface.
- Invoice detail/draft/documents/disputes/payment history/preview/email defaults/submit all require canonical Owner Driver / company-admin finance authority.
- POD/invoice lifecycle contracts.
- Owner Driver commercial dashboard position.

### Finance product rule
XDrive records invoice, POD, due/overdue/paid/disputed state and payment history. It does not hold funds or implement SmartPay/escrow.

---

## 4. Fleet Manager — major audit finding and remediation

### Finding
Before this audit, `fleet_manager` existed conceptually in workspace/UI code but was **not a real persisted production company membership role**. Production membership constraints and key fleet RPCs recognised owner/admin/dispatcher, not Fleet Manager.

That meant visual Fleet Manager parity did not equal authoritative end-to-end Fleet Manager access.

### Remediation prepared in this branch
- Added persisted `fleet_manager` domain/database role.
- Added explicit Fleet Manager operational capability set.
- Removed company-owner `settings.manage` from Fleet Manager.
- Added Fleet Manager provisioning UI/API, owner/admin only.
- Added dedicated Fleet operator server boundary: owner/admin/fleet_manager/dispatcher.
- Added Fleet Manager access to:
  - Jobs
  - Assignments
  - Drivers
  - Vehicles
  - Availability
  - Future Availability
  - Live Positions
  - Return Journeys
  - Maintenance
  - Exceptions
  - Diary operational groups
  - Freight Vision
  - Messages
  - Event Log
  - operational Finance visibility
  - Compliance
- Kept company membership management, billing, company settings and owner controls outside Fleet Manager.
- Extended allocation/reallocation and vehicle advertising DB authority to Fleet Manager.
- Extended relevant operational APIs to the dedicated Fleet operator boundary.
- Kept commercial booking ownership actions separated from Fleet Manager.

### Production step pending
Migration `20260926180000_fleet_manager_persisted_role_foundation.sql` must be applied after merge and then production constraints/RPC/RLS must be re-verified.

---

## 5. Carrier / Company — status

Verified contracts/surfaces exist for:
- Marketplace / Find Loads.
- Matching/load alerts.
- Quotes and Won Work.
- Jobs.
- Driver/vehicle allocation.
- Drivers/Vehicles.
- Live Availability.
- Live Positions.
- Return Journeys.
- Directory.
- Freight Vision.
- POD.
- Invoices/accounts.
- Compliance.
- Messages.
- Notifications.
- Event Log.
- PPM/lane market intelligence.
- Direct Booking / available-capacity discovery.
- Telematics ingest.

Full live multi-user E2E remains required after Fleet Manager production role migration.

---

## 6. Customer — status

Verified surfaces/contracts exist for:
- Post Load.
- Edit/cancel lifecycle.
- Quotes.
- Comparison.
- Award.
- Bookings.
- Tracking / ETA.
- POD/evidence.
- Documents.
- Invoices.
- Disputes.
- Diary.
- Directory/Network.
- Messages.
- Notifications.
- Event Log.

Required remaining proof: a real two-party E2E from Customer post through Carrier/Driver execution, POD and invoice.

---

## 7. Broker — status

Verified surfaces/contracts exist for:
- Enquiries.
- Post Load / customer loads.
- Carrier quotes and compare/award.
- Carrier directory/sourcing.
- Jobs/tracking.
- POD review.
- Customer invoices.
- Carrier costs.
- Margins.
- Disputes.
- Messages.
- Diary.
- Event Log.
- Reporting surfaces.

Required remaining proof: live Broker → Carrier → Driver → POD → customer invoice/carrier cost/margin E2E.

---

## 8. Cross-role CX parity checks

### Verified by automated contracts
- Traffic-aware ETA.
- Load-alert matching.
- Availability-gated matching.
- Future-position and Return Journey matching.
- Who's Nearby.
- Contextual messaging.
- PPM/lane intelligence.
- Directory direct booking.
- Telematics ingestion.
- POD/invoice linkage.
- Booking history.
- Role boundaries.

### Explicitly excluded
- SmartPay.
- Escrow.
- Platform-held member funds.
- XDrive settlement/guaranteed payment.

---

## 9. Production Supabase security advisor

Latest production advisor snapshot during this audit:

### Security
- `rls_enabled_no_policy`: **42 INFO**
  - RLS is enabled but no direct client policy exists. Many of these may intentionally be service-only/closed-by-default tables; each must be classified before adding any policy.
- `function_search_path_mutable`: **1 WARN**
  - `public.fn_notification_event_class(text)`.
  - Remediation prepared in `20260927003000_notification_event_class_search_path.sql`.
- `authenticated_security_definer_function_executable`: **30 WARN**
  - These require function-by-function review. Do **not** bulk revoke because several are intentionally authenticated RPC authority gates.

### Performance
- `unindexed_foreign_keys`: **95 INFO**
- `auth_rls_initplan`: **156 WARN**
- `no_primary_key`: **1 INFO** — historical backup table `backup_20260721221000_auth_users_metadata`.
- `unused_index`: **77 INFO**
- `multiple_permissive_policies`: **180 WARN**
- Auth DB connection allocation: **1 INFO**

These performance warnings are real production optimisation debt, but they are not evidence by themselves of broken role functionality. RLS-policy changes and index removal must be benchmarked and reconciled rather than applied blindly.

---

## 10. Automated audit runner defect found and repaired

The audit runner was incorrectly using Unix `tail` pipelines on Windows for ESLint, TypeScript and Vitest. This produced false FAIL results.

Remediation:
- removed shell `tail` dependencies;
- added a larger child-process output buffer;
- direct ESLint/TypeScript/Vitest execution now works on the Windows audit host.

Final result: **81 PASS / 0 FAIL**.

---

## 11. Remaining launch blockers / manual evidence

The following remain open and must prevent a false “platform fully complete” statement:

1. **Fleet Manager production migration and post-migration verification.**
2. **Physical Android Driver E2E**, including multi-image pickup/delivery POD on Pixel.
3. **Two-session cross-company RLS/isolation E2E** with real role accounts.
4. **Full Customer → Carrier/Owner Driver → POD → Invoice live workflow.**
5. **Full Broker → Carrier → Driver → POD → margin/invoice live workflow.**
6. **Live GPS/ETA/realtime evidence under an executing job.**
7. **Production PostGIS privileged relocation** by Supabase Support; PR #502 remains blocked until this is completed and verified.
8. **Security Definer authenticated-RPC review** (30 advisor warnings).
9. **RLS performance optimisation review** (auth initplan / overlapping policies) with regression tests before changes.

---

## 12. Audit rule going forward

No role or feature is marked DONE from page existence alone.

Required evidence remains:

**UI → role permission → real data → mutation/action → backend authority → DB/RLS → persistence → related modules → notifications → audit trail → mobile/desktop → error/retry → E2E.**

The current audit provides a clean automated engineering baseline, not a substitute for the remaining production/manual evidence.
