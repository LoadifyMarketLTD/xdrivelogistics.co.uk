# XDrive Logistics — Driver Reserve PWA

A **separate, parallel alternative** to the official Driver PWA 1099. The original PWA is untouched.

## Run locally
```powershell
cd D:\XDrive-PWA-RESERVE-20261108\driver-pwa-reserve
npm ci
npm run dev -- --host 127.0.0.1 --port 5197 --strictPort
```
Open: http://127.0.0.1:5197/driver/reserve-pwa/

## Production data integration
This project reuses the authenticated production XDrive driver API adapter and Supabase authentication, with the SAME user accounts and company authorization rules. Requests are sent through the local Vite proxy to https://www.xdrivelogistics.co.uk/api. It is not populated with fake jobs. Driver authentication is required to see the real Loads, Quotes, Bookings, Documents and Invoices.

## Independent application
The reserve has its own source tree, package, build, visual design (Reserve.css), browser PWA manifest, worker, local browser session key, preferences, drafts and IndexedDB store. Both applications can run at the same time. The production application and the main branch must not be replaced.

## Operational modules
Loads / details / submit quote / My Quotes / incoming award / accept or decline / live Booking / collection / delivery / POD / invoice read/download / menu / vehicle documents / alerts / settings.

## Known limitations (not PASS yet)
A complete authenticated end-to-end job run must still be verified. Invoice creation/issue/send is not implemented in the inherited live adapter; existing invoices are read-only/downloadable. Do not mislabel this as fully operational or send simulated invoice confirmations.

## Verification
- npm run build — PASS
- npm run lint — 0 errors, 19 inherited warnings
- selected Node unit tests — 12/12 PASS
- local browser loads login form — PASS
- live configuration API 200 OK — PASS
- guarded resource APIs 401 without authentication — PASS
- real authenticated workflow — NOT YET TESTED

Project checkpoint: AUTONOMOUS_EXECUTION_CHECKPOINT.md
