# CX Fleet / Courier Exchange — Pixel 7 Pro reference audit
Date: 8 November 2026, ~19:58–20:06 GMT
Physical device: Pixel 7 Pro, app package com.transportexchangegroup.cxnw4a
Intent: Inspect the existing CX app on Pixel and compare its UX with the separate XDrive Reserve PWA. No CX quote or job was submitted, deleted, accepted or changed.

## Actual CX screens opened on Pixel
1. CX Fleet home: active vehicle, Tracking (On/Online), Availability (I'm available), large menu tiles Loads / Quotes / Bookings / My Fleet / Journeys. Bright yellow header, white tiles on grey background, explicit state.
2. Loads section: Post Load, Book Direct, Search Live Capacity, Alerts (count shown), Search Loads. These are separate destinations; they are not a set of four statistics cards overlaying posted jobs.
3. Search Loads: location (From Current Location), radius 30 miles, vehicle size from/to (Motorcycle–6 Axle Tractor), Body Type, Date, Freight Type, Member Name/ID; SEARCH and CLEAR at bottom. Long form is a separate screen, not above every job card.
4. Alerts list: Inbox / Saved / Deleted; sender, HOTSHOT/BACKLOAD service, vehicle type, SmartPay Enabled, collection/delivery town + outcode and date, notes, large Quote Now and notification reason. Real user-facing alerts and per-item actions.
5. CX Load Detail for alert load 91346271 (read-only): full sender and customer details, pickup Accrington BB5, delivery Romford RM6, 240.50 miles / 4h 2min, payment terms 14 Days From Invoice, phone/contact, detailed notes, recent pay/delivery feedback, View on Map, Save, Delete, Quote Now. Do not copy private contact data into the reserve repo.
6. Quote Now: job headline and route, distance, Will Pick Up Within, real vehicle registration/model, currency GBP, "My Quotes (£)" input explicitly **price excluding VAT**, Extras + ADD NEW, notes, bottom action. Opened and inspected without sending.
7. Quotes menu: Sent / Received; Sent Quotes has Submitted / Unsuccessful tabs. In observed CX account Submitted empty at time of inspection. Does not prove anything about XDrive quote status.
8. Received view observed empty. Do not infer absence of Bookings or completeness of other CX flows.

## UX takeaways applicable to XDrive Reserve
- Navigation separates discovery/search from reading posted jobs and booking history.
- At-a-glance route, accurate outcodes, explicit times, real notes, customer/payment terms are more valuable than internal UUID or decorative chips.
- Text is readable and status labels distinct. A strong CTA on the job is visually prominent.
- Quote form MUST separate ETA, vehicle, currency, net base quote, VAT semantics, Extras/additional-charge description and driver notes. CX price explicitly excludes VAT; XDrive backend may enforce different price semantics — adapt tax treatment to XDrive commercial contract, do NOT copy semantics blindly.
- Saved/deleted states in CX Alerts refer to saved alert records and should NOT be confused with withdrawing/deleting an already-submitted quotation.
- XDrive Reserve needs real data fields (outcodes, route timings, service type, cargo notes, commercial data, feedback) where authorized; never fabricate CX SmartPay.
- XDrive must retain its own brand, real backend and original PWA unchanged. CX is a visual/reference application, not a replacement XDrive brand.

## Boundaries and verification
- CX screenshot captures stored on device host at D:\XDrive-PWA-RESERVE-20261108-EVIDENCE\cx_*.png.
- Connected actual app package verified with adb dumpsys activity; no API introspection of CX and no transactional testing.
- All temporary attempted CX branding changes to XDrive Reserve were reverted with git restore before this audit. No modifications to XDrive main/Netlify or actual production PWA.
- Audit does NOT establish that all CX Quotes/Bookings tabs have been inspected. This is a grounded partial CX feature and visual comparison.
