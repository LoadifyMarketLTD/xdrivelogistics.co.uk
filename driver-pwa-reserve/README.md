# XDrive Driver Reserve — Independent Alternative PWA

This is the new **alternative UI implementation**, not a themed copy of the original application. Entry point `src/main.tsx` loads `src/ReserveApp.tsx`, a separate React app with `src/ReserveApp.css`. Legacy files copied from main remain inactive reference modules. The original `official-driver-pwa` and production site have not been modified.

## Local review
`http://127.0.0.1:5197/driver/reserve-pwa/`

## User journeys
1. Loads: live authenticated marketplace data, search/filter, job cards, full Load Details.
2. Quote Now: ETA, vehicle, amount, notes; real authenticated quote API.
3. Quotes: current submitted quote history from real API.
4. Bookings: incoming awarded offer appears BEFORE detailed booking and acceptance.
5. View Booking: full awarded details, contacts and payment terms.
6. Accept or Decline: real booking-offer API.
7. Collection: On My Way -> On Site -> Complete Collection / Loaded (handover API).
8. Delivery: In Transit -> On Site -> Complete Delivery (Received By, signature immediately below, Left At, items, condition and notes).
9. POD: reuse same signature, collect delivery photo/docs, upload evidence and submit signed POD through real API.
10. Invoice: read/download existing A4 invoices from authenticated API. **Create/issue/send not yet available; never simulated as success.**
11. Menu: profile, vehicles, documents and other account sections use authenticated driver endpoints.

There are NO fake job records injected and NO prefilled production contacts/signatures. Real login is mandatory. The UI may show empty states when no live jobs qualify.

## Isolation
- Own worktree: `D:\XDrive-PWA-RESERVE-20261108`
- Own branch: `feature/xdrive-driver-reserve-20261108`
- Own app dir: `driver-pwa-reserve`
- Own localhost port: 5197
- Own install manifest, service worker, login/session key and local draft keys
- Real API via Vite proxy: `/xdrive-api` → XDrive production `/api`
- No changes to GitHub main, Netlify, or the approved PWA 1099

## Verified
- TypeScript + Vite build PASS
- Unit/API/quote/workflow suite 17/17 PASS
- Independent entrypoint/flow checks 3/3 PASS
- Lint 0 errors, inherited warnings remain
- Local browser loaded the independent React UI; authenticated live Loads UI rendered in Opera
- Without authentication, protected endpoints return 401, config returns 200

## NOT yet certified
Complete real booking lifecycle including a client signature and POD upload; physical device; invoice issue/email; production deployment.
