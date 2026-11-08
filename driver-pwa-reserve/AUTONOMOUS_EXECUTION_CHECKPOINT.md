# Reserve PWA checkpoint — 2026-11-08

## 19:11 — Quotes (Pixel 7 Pro)
- User screenshot: 3 available listed loads already QUOTED, therefore all buttons were View Quote and user could not submit a NEW quote to the same jobs.
- Official POST /api/driver/mobile/bids prohibits a second bid per driver/job, returns HTTP 409. Official POST /api/driver/mobile/bids/[id] with action=edit ALLOWS editing existing submitted personal bid before award. No bypass or duplicate offered.
- liveApi.ts now preserves bidId, bidStatus, quoteEtaMinutes and quoteNotes from real quote history.
- ReserveApp.tsx shows Quote Now for unquoted OPEN jobs, Edit Quote for own submitted bids, View Quote for non-editable quotes. Edit uses official /mobile/bids/[id] action edit endpoint with amount/ETA/notes and is not a second quote.
- Quote ETA uses collectWithinMinutes structured API field, sum labeled as total VAT-inclusive where applicable, vehicle shown read-only because backend selects validated registered vehicle.
- Pixel screenshots: D:\XDrive-PWA-RESERVE-20261108-EVIDENCE\xf_quoteedit_after_refresh.png (Edit Quote card) and xf_editquote_form2.png (real edit form). No write performed.
- Removed breadcrumb/heading overlap in quote form.
- Build PASS, selected 14/14 tests PASS. Real quote update write NOT TESTED.



## 19:04 — Loads layout and View on Map verified
- Scope: separate reserve branch only, no changes to GitHub main, official 1099 or Netlify.
- Removed all 4 metric cards from Loads. Confirmed on Pixel 7 Pro screenshot `D:\XDrive-PWA-RESERVE-20261108-EVIDENCE\xf_loads_nometrics_map_button.png` — the first real job follows search and one compact count line.
- Restored `View on Map` button on every Load/Booking card and Load Details; it opens the existing `RouteMap.tsx` from main with Leaflet, OpenStreetMap, geocoding, road routing and GPS; no mock map.
- Confirmed on Pixel map screenshot `D:\XDrive-PWA-RESERVE-20261108-EVIDENCE\xf_map_loads.png`: Blackburn to Brighton visible, location active, distance shown. Back returns to same Loads list.
- Source privacy: before award, map is passed only town/outcode-level `from`/`to` rather than private full addresses; after award full addresses are used.
- `npm run build`: PASS. Selected test suite: 19/19 PASS, including 4 new map/privacy/layout checks.
- Other release blockers from earlier audit, particularly real POD + invoice/email E2E, remain NOT VERIFIED.


Current branch: feature/xdrive-driver-reserve-20261108
Project root: D:\XDrive-PWA-RESERVE-20261108
App: driver-pwa-reserve
Local review URL: http://127.0.0.1:5197/driver/reserve-pwa/

Latest requirements:
[PASS code] Removed 4 obstructive statistics cards from Loads.
[PASS visual] Verified on connected Pixel 7 Pro; search is immediately followed by job list/empty state.
[PASS code] Single official A4 PDF contains invoice, completed POD, recipient signature and all linked collection/delivery/POD photos and PDF evidence.
[PASS code] Backend PDF storage and Resend email use ONE identical combined PDF; stale split-attachment outbox snapshots blocked.
[PASS static tests] 32/32 selected Node tests.
[PASS build] TypeScript + Vite build.
[NOT TESTED] Live invoice PDF rendering with full real evidence, Resend email to a test recipient, received attachment check.
[PASS VISUAL] User screenshot from Pixel 7 Pro at 18:57 confirms 3 actual loads visible and obstructing statistics removed.
[PASS CODE] Load card service label timed_direct now displayed as Timed Direct; full available job reference shown; View Quote opens separate quote details instead of generic Load Details.
[PASS] Latest TypeScript + Vite build, 15/15 targeted regression tests.
[NOT COMPLETE] API quote detail adapter does not expose original ETA/notes; quote details explicitly show that limitation. Live invoice+POD production email unverified.

No production deploy or main merge. No real billing/email side effects.
Next actions: regenerate a real test invoice from an authorised completed job with a stored POD, inspect every PDF page, and confirm one combined email attachment via authorised test workflow. Only after transaction safety and PDF QA consider production update.
