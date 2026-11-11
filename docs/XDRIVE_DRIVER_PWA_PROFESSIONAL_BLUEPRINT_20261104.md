# XDRIVE DRIVER PWA — PROFESSIONAL BOOKING & POD REMEDIATION BLUEPRINT
Date: 2026-11-04 | Status: IMPLEMENTATION GATED — AUDIT FIRST
Repository: LoadifyMarketLTD/xdrivelogistics.co.uk | Target: Driver PWA, production XDrive
Reference: 19 user-provided Courier Exchange screenshots, functional reference only. Never import reference job/company/driver data.

## 0. Non-negotiable rules
- Maintain the approved XDrive visual identity, mobile header, navigation, cards and existing Master Workspace architecture. Do not copy Courier Exchange styling or redesign Post Load.
- Real production Supabase records only. No demo, mock API, fabricated booking, seeded job, simulated POD or silent success.
- Keep all production data, original status history and uploaded documents intact. No irreversible schema or status changes without migration/rollback.
- Scope to Driver PWA booking workflow and its shared backend contracts. Do not alter unrelated Invoice Pro, native app, staging, or other workspaces without a proven dependency.
- Every step must be authorized by backend role/assignment, not only hidden in UI.
- Separate GitHub commit, Netlify deployment and tested live behavior; never call one proof of the others.
- Do not publish further functional changes before the baseline audit and acceptance tests. Use isolated branch/working tree; preserve local uncommitted work.

## 1. Baseline inventory and release safety
1. Record production main SHA, Netlify deployed SHA, route list, Supabase production project identity and API contracts (never log secrets).
2. Inventory actual components and duplicate entry points: app/components/workspace/DriverJobExecutionPage.tsx, app/driver-pwa-fresh/bookings/[id]/workflow/*, bookings list, API routes, CSS and service worker. Determine which components render on actual live URLs; do not assume unused workflow components are live.
3. Reproduce and document every reported failure on a real assigned booking without changing completed live jobs; use read-only checks first.
4. Audit changes already committed for pickup/gallery and mandatory delivery document. Confirm backend acceptance matches UI. Revert or repair any premature validation that could block legitimate delivery.
5. Establish isolated worktree, baseline typecheck, lint, unit tests, build and E2E. Record all pre-existing failures and fix regressions before release.
6. Confirm deployment and cache strategy, including installed Pixel PWA vs website version.

## 2. Functional specification: state machine
Received / Awarded (acceptance required) -> Accepted -> On My Way to Pickup -> On Site (Pickup) -> Loaded -> On My Way to Delivery -> On Site (Delivery) -> Delivered -> POD Submitted -> Invoice eligible.
- Only one primary green next-action CTA at each stage. Accept and Decline are separate, mutually exclusive, permission-checked actions on received offers.
- Every transition is persisted by server, idempotent, guarded against double tap, and acknowledged before UI advances.
- Preserve recorded timestamps, actor, reference, customer reference, item count and weight where supplied. Do not invent values.
- Show current status and chronological recorded timeline with completed checkmarks, times and details; no duplicate history blocks.
- Undo: only last reversible transition, with server authorization and audit event; never delete history, POD, invoice or another actor's updates. Disable if backend has no supported reversal.
- Handle multi-stop jobs: pickup/delivery evidence and timestamps belong to correct stop, not one generic job record.
- Display actionable errors, retry and offline/network states; no silent state changes.

## 3. Booking card and detail requirements
- Card: company, booking reference, assigned driver, current status, pickup and delivery town/outcode/time, route distance/time only when actually available, notes, payment terms, and current CTA.
- Map button opens the approved XDrive embedded/internal route map, not a redundant duplicate. Full pickup/delivery addresses and contacts only for authorized awarded bookings.
- Booking Details: actual company/driver/vehicle, rate, payment terms, cargo and requirements, all stops, contact actions, instructions, attached documents and real status history.
- No fabricated SmartPay indicator or Courier Exchange payment branding. No unverified prices/distances/feedback.
- Preserve one orange XDrive header with consistent height and accessible back navigation.

## 4. Pickup: optional evidence
- On Site Pickup: save arrival notes without requiring a photo or document.
- Loaded: Your Ref, Customer Ref, number of items, weight (if supplied), delivery ETA date/time, cargo details and driver's notes. Validate formats without making optional fields mandatory.
- Provide BOTH camera capture and saved-file selection for pickup photos AND pickup documents; PDFs supported in saved-file flow.
- Attachments are optional at all collection stops. Camera permission denial must not block the status transition.
- Show upload progress, filenames/previews, count/size/type limits, remove/retry and persisted backend attachments.

## 5. Delivery: mandatory POD, not fabricated evidence
- At delivery: camera capture AND saved gallery for photos, camera document scanning AND saved document/PDF selection.
- Require genuine delivery evidence according to approved policy: at least one delivery document/image attachment, recipient full name, signature, delivery date/time, item count and delivery status. Clearly distinguish a photograph that counts as a POD document from a second separate file; avoid accidentally requiring duplicate uploads.
- Include Left At, delivery notes, weight and job details; retain relevant backend-provided fields.
- Ensure evidence persists against correct job/stop before Send POD; validate MIME/size/total, server storage paths, permissions and RLS.
- Submit POD once; only show successful completion after server confirms saved POD and required files. Reopen/retry safely after network interruption. Enable Invoice only after real completed workflow.
- Never require a photo/document at pickup.

## 6. UX and accessibility
- One action per stage; 48px minimum touch targets, readable mobile labels, compact cards, clear progress, loading and error states.
- Camera input capture=environment as progressive enhancement, fallback to device picker where unavailable; saved photos and PDFs remain selectable.
- No duplicate buttons, nested dead links, overlapping navbars, lost Map/Filter controls, stale PWA pages or unwanted desktop layout.
- Validate on Android Pixel installed PWA and browser, including camera permission denied, gallery, PDF, multiple files, cancellation and back navigation.

## 7. Required test matrix (evidence, not assumptions)
A. Static: TypeScript, ESLint, build, relevant unit tests; compare baseline and patched branch.
B. API: assigned driver vs unassigned driver, company role, invalid/expired JWT, RLS isolation, allowed/forbidden transitions, duplicate submit, out-of-order statuses, Undo.
C. Pickup: no attachments succeeds; camera photo, saved image, scanned document, PDF, multiple stops, invalid type/size and failed upload.
D. Delivery: zero evidence fails; missing recipient/signature fails; camera and saved files succeed; persisted file accessible only to authorized actors; POD status and invoice eligibility follow backend confirmation.
E. UI/E2E: received Accept/Decline, complete state sequence, status timeline and timestamps, map, notes, Loaded form, delivery form, invoice handoff.
F. Regression: Loads, Quotes, Bookings, Diary and other role workspaces; no fake data or API fallback.
G. Deployment: Netlify production commit equals tested commit; hard refresh and installed PWA update; authenticated real booking test with user-authorized safe fixture or non-destructive test account. No fabricated production job.
H. Device: Pixel/Android camera, saved gallery, PDF picker, signatures, navigation and offline recovery.

## 8. Implementation phases and release gates
Phase 0 — Baseline audit and written defect inventory. Gate: real rendered component and backend contract confirmed.
Phase 1 — State machine and API/RLS fixes. Gate: permission + transition tests pass.
Phase 2 — Booking card, details, timeline, map and safe Undo. Gate: visual parity and E2E.
Phase 3 — Optional pickup notes, photos/documents, Loaded form. Gate: pickup works with zero attachments and camera/gallery.
Phase 4 — Mandatory delivery evidence, signature, POD submission. Gate: positive/negative backend tests, upload persistence, no duplicate requirement.
Phase 5 — Regression, build, Pixel testing and Netlify production deploy. Gate: all tests pass and live deployed SHA matches approved SHA.
Do not advance to next phase if a release-blocking defect remains. Document precise failures and remediation, not generic PASS.

## 9. Known baseline issue requiring immediate investigation
The previous isolated worktree typecheck exited 2: app/driver-pwa-fresh/messages/page.tsx line 48, type '"loads"' not assignable to '"jobs" | "quotes" | "bookings"'. Must verify whether still present on current main and fix before claiming build success.
Prior UI-only mandatory document checks may diverge from backend enforcement. Confirm live component actually uses workflow step components before making any further edits.

## 10. Acceptance criteria and final evidence
Release only when: all state transitions persist; real history survives refresh; pickup without documents succeeds; delivery without required POD fails; camera/gallery/PDF and signature work on Pixel; files persist and respect permissions; no demo content; no duplicate UI; typecheck/lint/build/E2E pass; Netlify production SHA verified; live PWA checked.
Final report must include SHA, exact tests and results, deployment ID/time, screenshots or device evidence, defects repaired and any remaining BLOCKED items. Never mark unrun tests PASS.
