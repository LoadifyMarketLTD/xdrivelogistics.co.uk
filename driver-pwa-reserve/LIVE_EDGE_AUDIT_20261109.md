# XDrive Driver Reserve 5197 - Live Edge audit - 2026-11-09

Target: http://127.0.0.1:5197/driver/reserve-pwa/?hide-expired=v2
Device: XDriveLogistics, Microsoft Edge existing authenticated tabs, accessed through Windows UI Automation. Local development server running.
Scope: Read-only navigation and visual inspections; no forged signature, status mutation, invoice issuance or email sending.

## Live observed
- Edge Reserve tab #1 displayed Booking OPEN after partial live feed and reported Booking offers timeout at 12 seconds.
- Edge Reserve tab #2 Loaded real authenticated Loads, Quotes (Submitted/Awarded/History), Bookings Delivered, status timeline, POD page, invoice register and menus.
- Job XDL-090CD41C: Delivery status DELIVERED, two photos, POD not finalized. Signed POD page restored the recipient name, but did NOT have a saved signature. Correct instruction now requests recipient signature. No fabricated signature entered.
- Map: initial duplicated address (e.g. `..., BB1 9QL, GB, BB1 9QL`) could not be geocoded. Nominatim lookup confirmed normalized version succeeds. After fix Edge showed markers 1 and 2 and no missing-stop warning.
- Invoices register loaded real invoices and PDF download actions; PDFs not downloaded in this audit.
- My Profile, My Vehicle (vehicle plus approved compliance documents), Availability, Notifications, Load Alerts, Settings opened with live authenticated content. No save actions invoked.
- Documents tab was empty. After correction it displays the same authorized documents from /api/driver/documents, including secure view buttons.
- Return Journeys tab was empty. After correction it shows /api/driver/return-journeys?scope=mine records. The visible record has null from/to/date/vehicle in production DB despite status 'available'; now labeled Incomplete record and warned not to use operationally.
- Notification inbox showed 100 returned, 62 unread; reading content only, no marks.
- User-facing GPS browser permission is no longer requested automatically on new map mounts; explicit Show my GPS position is required.

## Code changes in this audit
- src/ReserveApp.tsx: POD page no duplicate outer route/title; Save action no longer remains in busy state during subsequent feed refresh; existing lifecycle and POD server-confirmation safeguards retained.
- src/DeliveryHandover.tsx: POD 08/11 label, correct delivered badge, evidence count-aware guidance and precise missing fields.
- src/RouteMap.tsx: normalize duplicated UK country/postcodes for geocoding, postcode fallback; GPS opt-in, only show GPS button when no position.
- src/DriverMenu.tsx: functional Documents and Return Journeys authenticated views; incomplete return records clearly flagged.
- tests/reserve-entry.test.mjs: expanded to 11 relevant contracts.

## Verification
- npm run build (TypeScript + Vite): PASS.
- node --test tests/reserve-entry.test.mjs: 11/11 PASS.
- Live Edge: POD layout, 2 photo state, route map markers, document list, return journey warning verified.
- Not verified: real recipient signature submission, backend atomic POD completion, invoice generation/PDF/email chain. Incomplete POD on XDL-090CD41C remains a genuine blocker.
- No commit, GitHub main merge or Netlify deployment conducted by this audit; local port 5197 only.

## Outstanding risks
- Backend mobile mapJob / hasPod() can report podGenerated when only photos exist; Reserve client now relies on complete POD server verification, but backend contract should be aligned.
- Partial booking offers requests may time out; app guards against losing cached delivered state but root backend latency remains to diagnose.
- Incomplete return journey data in production DB should be corrected through authorized operational workflow, not generated artificially.
