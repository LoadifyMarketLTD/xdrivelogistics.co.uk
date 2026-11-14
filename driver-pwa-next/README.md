# XDrive Driver NEXT — isolated PWA

This is a separate installable PWA containing the CX-informed Driver booking rebuild, copied from the Reserve implementation at commit `641df7c5` (its source still includes the prior booking reconstruction commits).

- Route: `/driver/reserve-next/` (not `/driver/reserve-pwa/`).
- Independent manifest ID, start URL, scope, service worker, session storage names, preferences, and offline evidence IndexedDB.
- Production-hosted builds use the existing authenticated XDrive `/api/driver` backend on `www.xdrivelogistics.co.uk`.
- Local Vite dev uses `/xdrive-api` proxy; local Vite production preview explicitly proxies `/api/driver` to XDrive. These proxies do not affect the deployed site.
- This is NOT a fake-data sandbox: signing in or acting on bookings may operate on actual XDrive records. Use controlled test records for any state-changing validation.
- The existing Reserve PWA and Super Admin are not modified by this copy.

## Build and preview

From `driver-pwa-next`: `npm ci`, `npm run build`, `npm run preview -- --host 127.0.0.1 --port 5206`. To publish under Next.js, copy the `dist` directory contents to `public/driver/reserve-next` and deploy a branch preview. The production root API is expected to be provided by Next.js.

## Verification performed

Vite/TypeScript build PASS. `__tests__/driverNextIsolation.test.ts` PASS. Browser owner-driver sign-in through local preview PASS: config 200, Supabase auth 200, Loads/Bookings shown. Physical Pixel 7 Pro Chrome CDP owner-driver sign-in PASS, with a screenshot saved only in the desktop QA workspace. Full real bookings/POD/Invoice/email E2E remains a release gate; simulated E2E is not proof of production completion.
