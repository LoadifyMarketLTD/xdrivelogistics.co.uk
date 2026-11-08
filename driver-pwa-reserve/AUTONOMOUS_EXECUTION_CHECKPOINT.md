# XDrive Driver Reserve - execution checkpoint

## 2026-11-08 19:29 - Posted jobs made visible again
- User asked why no posted jobs appeared. Root cause: reserveLists.ts excluded ALL quoted jobs from Loads even when they were still OPEN in the live marketplace.
- New rule: Loads lists ALL OPEN, marketplaceListed live jobs. Quoted jobs show View Quote, not Quote Now; Edit and Withdraw remain exclusively in Quotes. No destructive writes performed.
- Quotes continues to show personal submitted and historical bid records, including withdrawn offers.
- Pixel 7 Pro now shows **3 posted loads** in Loads (Blackburn -> Brighton visible) after fresh login; screenshot: D:\XDrive-PWA-RESERVE-20261108-EVIDENCE\xf_loads_posted_final.png.
- Pixel Quotes -> History showed 12 historical quotes including a withdrawn quote for the first route, explaining why it now appears as AVAILABLE with Quote Now; screenshot: D:\XDrive-PWA-RESERVE-20261108-EVIDENCE\xf_quote_history_current.png.
- Build PASS; 12/12 targeted tests PASS.
- Scope: reserve branch only, GitHub main, Netlify and official PWA unchanged. No quote or invoice write performed.

## Outstanding
- Complete real-device quote / booking / POD / official combined A4 invoice + emailed attachment E2E remains NOT VERIFIED.
