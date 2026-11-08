# XDrive Logistics Driver Reserve PWA

Independent alternative application. This is **not** the approved production Driver PWA 1099.

## Isolation
- Worktree: D:\XDrive-PWA-RESERVE-20261108
- Branch: feature/xdrive-driver-reserve-20261108
- New project: driver-pwa-reserve
- Base path for a future isolated deployment: /driver/reserve-pwa/
- Default original preserved at official-driver-pwa; no edits to main or production.
- Supabase/session storage uses distinct key xdrive-driver-reserve-live-session-v1.
- REST adapter is copied unchanged from main (same production XDrive API with normal role guards).
- Driver must authenticate; no credentials or test accounts are shipped.
- Real authenticated load/quote/booking data only; do not present local examples as live.

## Current scope
Loads, full job details, quote submission, My Quotes, incoming offers, booking acceptance, dispatch statuses, collection, delivery, POD, invoice views, menu, vehicle, documents, alerts and settings use copied real PWA application and adapters.
The reserve-specific visual theme, branding, install manifest, service worker and session key are separate. Because this starts from the current production adapter, known backend issues are not claimed fixed here.

## Verification
Check build, lint, live auth, load list, real bid and booking workflow. No production writes without a controlled real-job validation.
No Netlify publication until separate site and production safety gate are approved.
