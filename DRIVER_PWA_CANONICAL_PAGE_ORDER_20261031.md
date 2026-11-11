# XDrive Driver PWA â€” ordinea canonica a paginilor (31.10.2026)

**Pagina 0 este LOADS, nu Accept Job.** Numerotarea de mai jos exprima un flux cap-coada; unele trepte sunt stari/formulare in aceeasi ruta si NU pagini Next.js separate. Nu redenumi rutele existente fara integrare si teste.

| Nr | Ecran / stare | Ruta sau componenta din proiectul actual | Tranzitie necesara |
|---|---|---|---|
| 0 | LOADS â€” Available / Map / Filter | /driver-pwa-fresh/jobs (LoadsClient) | Tap pe card -> 1 |
| 1 | LOAD DETAILS â€” informatii despre marfa, ruta, companie, payment terms | /driver-pwa-fresh/jobs/[id] | Quote Now / formular -> 2 |
| 2 | SUBMIT QUOTE â€” suma, interval, note, confirmare | Formular integrat in /driver-pwa-fresh/jobs/[id], API /api/driver/bids | Submit reusit -> 3 |
| 3 | MY QUOTES â€” oferte pending / won / lost | /driver-pwa-fresh/quotes | Selecteaza oferta -> 4; award/offer -> 5 (Bookings pending offer) |
| 4 | QUOTE DETAILS â€” vizualizare si anulare | /driver-pwa-fresh/jobs/[id]?history=1, /api/driver/bids/[id]/withdraw | Intoarcere Quotes sau asteapta award |
| 5 | BOOKINGS - Current / Last week / Last month; pending offers, current jobs | /driver-pwa-fresh/bookings | Pending offer -> 6; accepted booking -> 7 |
| 6 | ACCEPT JOB - offer details, map, accept/decline | /driver-pwa-fresh/bookings/offers/[id] | Accept -> 7; Decline -> 5 |
| 7 | BOOKING DETAILS â€” acceptat, adrese, contacte, plata, stops | /driver-pwa-fresh/bookings/[id]; BookingDetailsStep | On My Way to Pickup -> 8 |
| 8 | ON MY WAY TO PICKUP â€” pickup address, navigatie | OnMyWayToPickupStep | On Site at Pickup -> 9 |
| 9 | ON SITE PICKUP â€” cargo, count, condition, fotografii/documente optionale | OnSitePickupStep + evidence/handover API | Confirm Loaded -> 10, doar dupa verificarea dovezilor |
| 10 | LOADED â€” colectare confirmata, urmatoarea oprire | LoadedCollectedStep | On My Way to Delivery -> 11 |
| 11 | IN TRANSIT / ON MY WAY TO DELIVERY â€” adresa, navigatie | InTransitDeliveryStep | On Site Delivery -> 12 |
| 12 | ON SITE DELIVERY â€” verificare cargo/dovezi | OnSiteDeliveryStep | Complete POD -> 13 |
| 13 | COMPLETE POD â€” recipient, semnatura, atasamente, Submit | /driver-pwa-fresh/bookings/[id]/pod; ProofOfDeliveryStep | POD valid -> 14 |
| 14 | POD RECORDED / COMPLETED DELIVERY â€” confirmare finalizare | PodRecordedStep | Invoice optional -> 15 |
| 15 | CREATE INVOICE / DRAFT â€” VAT, valori, preview si salvare | InvoiceDraftStep; preview actual page-9 foloseste localStorage | Issue Invoice -> 16 numai dupa integrare fiscala reala |
| 16 | INVOICE ISSUED â€” numar, PDF/preview, trimitere controlata | InvoiceIssuedStep (preview) | Trimitere verificata -> 17 |
| 17 | INVOICE SENT / PAYMENT TRACKING â€” Sent / Awaiting Payment / Paid | InvoicePaymentTrackingStep (preview) | Final, cu istoric |

## Corespondenta machetelor existente (NU renumerotare realizata)
Macheta veche workflow/page-0 (Accept Job) -> canonica 6; page-1 (Booking Details) -> 7; page-2 -> 8; page-3 -> 9; page-4 -> 10; page-5 -> 11; page-6 -> 12; page-7 -> 13; page-8 -> 14; page-9 -> 15; page-10 -> 16; page-11 -> 17.

## Constatari verificate in surse
- Loads, Load Details, My Quotes si Bookings au pagini Next.js reale; Submit Quote este in Load Details; Quote Details refoloseste aceeasi pagina cu history=1.
- Accept Job real este la bookings/offers/[id], cu POST /api/booking-offers/[id]/respond. In macheta veche Accept Job era pagina 0 cu date demonstrative si localStorage; NU este etapa de intrare in aplicatie.
- Booking Details real este la bookings/[id] si foloseste DriverJobExecutionPage. POD are ruta dedicata.
- Pagina de invoice din visual-preview este demonstrativa si foloseste localStorage. Nu exista aici dovada emitere PDF fiscala si trimitere email live.
- Lista Bookings contine inca textul 'Open Booking & Action', anterior cerut eliminat.
- Ordinea 3 -> 5 -> 6 depinde de award/offer. Lista Bookings este punct de navigare si nu un pas cronologic obligatoriu: in aplicatie, oferta apare in Bookings, se accepta in 6, apoi jobul in Bookings Current.
- Pentru multi-stop, 10/11/12 se repeta pentru fiecare oprire conform tipului stopului; nu presupune mereu exact un pickup si un delivery.
- Testarea cap-coada pe sesiuni autentificate, integrarea finala Invoice si verificarile pe OPPO raman obligatorii. Nu confunda preview vizual cu aplicatia functionala.

## Regula de implementare
Header portocaliu XDrive si bottom navigation LOADS / MY QUOTES / BOOKINGS consistente in toate ecranele. O singura numerotare canonica, pagina ZERO=LOADS. Nu distruge pagina reala pentru a renumerota machete: aliniaza intai rutele si state transitions, apoi actualizeaza preview si valideaza pe OPPO, apoi E2E si regresiile.
