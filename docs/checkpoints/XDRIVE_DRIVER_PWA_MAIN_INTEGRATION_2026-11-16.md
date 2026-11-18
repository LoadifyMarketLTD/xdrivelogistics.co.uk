# XDrive Driver Reserve PWA → main integration gate (2026-11-16)

## Identity and scope
- Base: `origin/main` at `450ad1ce63284f7826e784ee3e8b74b773a2ad63`.
- Integration branch: `integration/driver-reserve-qa-into-main-20261116` in independent worktree `C:\Users\xdriv\Desktop\XDrive-Driver-PWA-Main-Integration-20261116`.
- QA source: local `XDrive-Driver-Reserve-Only-QA-20261116/driver-pwa-reserve`, visually inspected on Pixel 7 Pro at local `127.0.0.1:5226`.
- Deliberate scope: `driver-pwa-reserve` source/tests and public PWA assets plus 7 related backend route updates. No `apps/xdrive-driver-phone-golden`, no unrelated OwnerDriver/Official PWA styling changes, no database migrations.
- Rebuild Vite with `VITE_XDRIVE_DRIVER_APPROVED_LIVE_WRITES=1` **only** for candidate Production bundle. `qaNetworkGuard` still blocks writes at all local and preview origins and requires exact public origin `https://www.xdrivelogistics.co.uk` to enable genuine business actions. This safeguard is not backend authorization.

## Candidate bundle
- Public entry `public/driver/reserve-pwa/index.html` points to versioned `assets/index-ZI0m5cv1.js` and `assets/index-C1qRks56.css`.
- Includes fixed XD icons (192/512 px), installation manifest, new public-shell-only offline service worker, and the official XDrive logo.
- Keeps old hashed assets in the repo for non-atomic cache/rollback compatibility.
- No screenshots, QA logs, ZIP archives, credentials, local test sessions, or `dist` directory shipped under public production paths.
- SQL guard `docs/proposals/BOOKING_OFFER_PENDING_BID_GUARD_QA_ONLY.sql` remains a **proposal ONLY**, never applied.

## Validated
- Full integrated PWA Node test suite: 35 test files, **197 tests PASS, 0 FAIL**.
- Integrated Vite production-format build: PASS.
- PWA lint: 0 errors, 3 pre-existing warnings.
- Physical Pixel 7 Pro: compiled candidate loaded on localhost:5234; logo, navigation and auth UI displayed (not a production-backed write-path test).
- QA asset GETs: PWA index, manifest, and 512px icon HTTP 200.
- Earlier QA suite: 195 PASS, with status/Undo mock and physical synthetic test, hard-copy POD checkbox, and read-only Owner/Company isolation against real backend.

## IMPORTANT release blockers
1. Unmerged QA source and the public main PWA are currently separate. Release via PR after review of full diff and Netlify Preview; do not assume main is changed yet.
2. Production status/Undo and full positive signed POD/invoice mutation require a separate authorized non-Production database. Current Supabase preview branches have `MIGRATIONS_FAILED`; their real DB transaction gate is NOT satisfied.
3. Backend `mobile/jobs/[id]/confirmation` evolves from legacy typed signature attestation to drawn signature. This may be backward-incompatible for older driver clients; perform explicit compatibility/release gate before merging.
4. Netlify Preview deployment and physical Pixel full login/workflow of that preview are not yet certified.
5. Production rollback plan: restore prior `public/driver/reserve-pwa/index.html` pointing at `index-BqyZYZCR.js` and `index-BrXknV6w.css`, plus compatible backend routes, via a reviewed revert commit. Avoid deleting existing hashed assets.
6. No GitHub Actions used for validation. No Production SQL migrations. No live booking, POD, invoice, status, Undo or payment mutations performed.

## Decision
- Candidate preparation GO. Production merge/deploy remains gated until positive transaction E2E and API compatibility verification, even if all local tests pass.
