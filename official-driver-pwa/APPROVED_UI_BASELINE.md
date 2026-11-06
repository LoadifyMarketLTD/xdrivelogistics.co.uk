# XDrive Driver PWA — APPROVED VISUAL BASELINE (05 Nov 2026)

Status: user-approved local design baseline. Preserve this contract during future real-platform integration. This file is a specification, not proof of production integration.

## Non-negotiable UI contract
- Loads, Quotes, Bookings use the same card components, spacing, typography, palette and responsive behavior. Equal gaps between cards and consistent top/bottom/left/right padding.
- Show customer/company, service and vehicle, pickup and delivery locations/times, mileage and journey duration, payment terms, job posting time, notes, status and appropriate actions. Do not silently remove available information when replacing local fixtures with real API data.
- Payment terms displayed as **Terms: 30 days** (or the actual contractual number of days). Never append EOM. Never show SmartPay.
- Display **Posted: HH:MM** using the job's actual creation timestamp from the backend, converted to the appropriate UK time zone. Do not substitute quotation time for posting time.
- Keep the approved navy/white/grey/green palette and consistent buttons. Do not replace the approved layout with legacy platform UI.
- Job lifecycle: Loads -> Quotes after submission -> Bookings after award. Preserve job details throughout.
- Quotes: the driver enters their own price; no prefilled/target price. Customer's suggested price, if any, belongs in notes only.
- Booking workflow advances to the next uncompleted collection or delivery, including multidrop. Camera opens live capture on supported devices; Image selects saved media/documents; Your Ref defaults to a job-specific generated reference.
- View on Map opens the internal map, showing driver position (with permission), collection and delivery stops, and route. Do not present placeholder geography as a verified route.

## Integration acceptance criteria
1. Replace local fixtures with backend data through adapters while keeping the same presentation components and styles.
2. Map API fields for customer, service, vehicle, stops, dates, distance, duration, terms in days, posted_at, notes, status, quote and booking reference. Missing values should be explicitly identified, not fabricated.
3. Compare screenshots of Loads, Quotes, Bookings and Job Details before/after integration at desktop and mobile sizes.
4. Run workflow, lint, build, visual regression and authenticated E2E checks. Do not claim production ready until verified.
5. No changes to main, Netlify or production environment as part of this local-only project without explicit authorization.

## Local baseline
Project: C:\Users\xdriv\OneDrive\Desktop\XDRIVE-DRIVER-PWA-NEW-LOCAL\
Verified in the previous session: lint 0 errors; Vite build PASS; 7/7 workflow tests PASS.
Important: local-only fixtures are fictional; real backend connectivity, geolocation/map routing and device QA are not certified by these checks.
