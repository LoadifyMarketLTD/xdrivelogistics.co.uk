# XDrive Driver PWA release gate for Monday 2 November 2026

## Target
Source: LoadifyMarketLTD/xdrivelogistics.co.uk -> Netlify site xdrivelogistics (Next.js); real Supabase jqxlauexhkonixtjvljw.
Isolation: D:\XDrive-Driver-Release-9to11-20261031; do not edit the unrelated repository.
Device acceptance: OPPO CPH2125. Pixel is visual-only.

## P0 delivery critical
- [ ] Real authentication, persistent session, Owner Driver permissions.
- [ ] Loads (Available/Map/Filter), future unexpired jobs, correct details, quote submit.
- [ ] My Quotes submitted, decline/withdraw, award arrival; acceptance persisted in Supabase.
- [ ] Bookings Current + Details real addresses, contacts, map & Navigate Collection/Delivery.
- [ ] Lifecycle: On My Way Pickup -> On Site -> Loaded -> In Transit -> On Site Delivery -> POD -> Completed.
- [ ] Optional pickup photos/documents; mandatory complete POD evidence with signature, real uploads, resume offline/interruption.
- [ ] No impact to existing seven workspaces, no operations on commercial jobs during tests.

## P1 after delivery path
- [ ] Real invoice draft/PDF, fiscal numbering, recipient review, explicit send, payment tracking.
- [ ] Invoice never auto-sent as part of job completion; no fake issued/sent state.

## Release sequence
1. Reconcile all working tree changes, preserve source; ensure demo previews are never production workflows.
2. Fix UIs & lifecycle bugs; add automated tests for every transition and auth/ownership denial.
3. Pass ESLint, TypeScript, unit/integration, production build and Android OPPO end-to-end.
4. Commit to isolated release branch; push to GitHub, PR with Netlify deploy preview; inspect and retest.
5. Deploy to production only with authenticated E2E passing on private test jobs; verify site, login/PWA install on OPPO, rollback-ready.
6. Prepare Monday operational dispatch and fallback: 17 routes, driver assignments, contact and POD contingency.

## Evidence 31 October
- Corrected demo bottom nav Jobs/Quotes/Bookings -> Loads/My Quotes/Bookings.
- Targeted ESLint and TypeScript PASS (exit 0). This does not verify real live workflow.
- Current OPPO browser is connected to localhost:3265 preview; not independent production deployment.
