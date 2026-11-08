# AUDIT TEHNIC SI VIZUAL — XDRIVE DRIVER RESERVE PWA
Date: 2026-11-08, aprox. 18:26–18:32 GMT
Scope: local backup PWA at http://127.0.0.1:5197/driver/reserve-pwa/
Branch: feature/xdrive-driver-reserve-20261108
Baseline inspected: commit 59bf01de. Original 1099, GitHub main and Netlify were not changed.
Evidence: Android Pixel 7 Pro via ADB, Opera desktop screenshot/accessibility tree, repo ReserveApp.tsx, liveApi.ts, reserveLists.ts, DriverMenu.tsx, LiveInvoices.tsx, and source backend routes.

## Verified successes
- Local Vite server HTTP 200; manifest, service worker and favicon URLs return HTTP 200 with correct MIME types.
- ADB Pixel 7 Pro connected, Chrome opens local PWA via USB reverse tcp:5197.
- Pixel real account displays 3 marketplace open loads, 11 historical-only bids, 24 bookings; Quotes lists 28 rows including awarded/assigned (no artificial jobs inserted).
- Pixel UI allows Loads / Quotes / Bookings navigation and Booking -> POD Saved -> Continue to Invoice 9/11.
- Backend protected endpoints use JWT; no unauthorized mutation was tested.
- Separate branch/worktree, active ReserveApp.tsx vs old original App.tsx.

## P0 — operational/billing blockers
P0-01 INVOICE: Create, Issue and Send are a frontend-only staged draft; no POST to backend from ReserveApp invoiceJob(). Backend does offer POST /api/driver/finance/invoices and POST /api/driver/finance/invoices/[id]/submit (role gated), plus draft and PDF preview. Invoice E2E fails by design. Need validated authorized integration and send status.
P0-02 VAT/RATE SEMANTICS: UI labels job.quote as net and auto-adds 20% VAT. Backend submitQuote defines amount as final quoted total including VAT when applicable. Actual tax treatment/issuer VAT status must be obtained; current totals may double-count VAT.
P0-03 POD RESUME: SignaturePad state is volatile; open() clears recipient/signature, and completeDelivery() pod-draft PUT sends no signatureData. On page refresh before final POD, user cannot recover the signature from server, yet status may remain DELIVERED. Must save/retrieve persisted signature/draft and preserve job context.
P0-04 POD FALSE POSITIVE: mapAssigned() sets podRecorded true when podGenerated is true OR deliverySignatureData exists; a signature is not necessarily a finalized POD. Must check authoritative pod_generated/explicit backend completion and load signed POD details.
P0-05 HARDCOPY POD: savePod() sends hardCopyAcknowledged: !j.hardCopyPodRequired. When hard-copy is required, it submits false and there is no checkbox to acknowledge it, leading to 409. Must implement explicit acknowledgement.
P0-06 DELIVERED DATA: POD Saved card shows 'Recorded on the server' for Received By while Left At uses default 'Goods Inwards' from new local state. These are not verified delivery values; must retrieve POD fields from backend, not infer/label false data.
P0-07 STATUS E2E: Job status actions in ReserveApp transition() are not verified on a real live job with authentication and feature flags. The 11-step flow is partly a static list, not 11 validated transaction screens.
P0-08 NO COMMITTED JOB COMPLETION: Completed and invoiced backend states are mapped to 'DELIVERED' in liveApi statusMap; reserve workflow has no real final backend completion state linked to Invoice Send. Booking completion is not tested.

## P1 — functional and navigation
P1-01 SESSION: connected is Boolean(session) even for stale JWT; a new Opera tab displayed all zero while an authenticated Pixel tab showed 3 loads / 24 bookings. Session validity/loading/error state conflated with an empty market. Display explicit auth/refresh/error states and support re-login.
P1-02 QUOTES PAYLOAD: quote ETA is appended to free-text message rather than collectWithinMinutes. Vehicle selector appears to choose a vehicle but only inserts label into message; backend ignores this UI selection for canonical vehicle. Need structured ETA and vehicle source/eligibility validation.
P1-03 COLLECTION: ETA selection not included in handover payload, although API accepts etaMinutes. 'Collected From' field absent, current handover sends only itemCount, weightKg and notes.
P1-04 BOOKING SORT: single list of 24 includes Delivered jobs first, no Incoming/Current/Completed tabs; new offers may be buried.
P1-05 QUOTES ORGANIZATION: 28 records combined without distinct Submitted/Awarded/Unsuccessful. Some assigned jobs also appear in Quotes; no clear outcome/state hierarchy.
P1-06 DOCUMENTS MENU: reproducible on Pixel — tapping Documents opens an empty dialog with only Back to Menu. DriverMenu's Section union does not include 'Documents' even though the outer More page routes to it.
P1-07 RETURN JOURNEYS: outer More page offers Return Journeys but DriverMenu has no such Section/route; resulting module is absent/empty by code.
P1-08 NAVIGATION: No actual Navigate to Collection/Delivery map/Google Maps intent in reserve flow; route labels alone do not provide navigation.
P1-09 FULL BOOKING DETAILS: Approved booking screen should include complete contacts, customer refs, POD requirements, special handling, documents, times and access instructions. Reserve details omit some and do not reliably display contacts/documents.
P1-10 HISTORY: Booking Status History renders static names from steps[] based on a status index, without fetching real event timestamps, therefore is not a real event log.
P1-11 QUOTE EDIT: Card 'View Quote' leads to generic Load Details and shows no original ETA/notes/extras; no proper submitted quote detail.
P1-12 MENU REUSE: DriverMenu is inherited from original main, contrary to full alternate UI; its own permitted sections differ from outer More list.
P1-13 AUTH/LOGOUT: Two logout pathways differ; outer More calls revokeLiveSession, DriverMenu onLogout clears local storage only.
P1-14 FILTERS: Loads search and vehicle only; no approved Map, radius, Save/Find/Clear/return radius controls.
P1-15 PWA OFFLINE: Service worker intentionally has network-only fetch, no offline cached app shell. Installability artifacts exist but offline/retention not validated.
P1-16 COMPANY DRIVER CAPABILITIES: Role string inferred from profile, but Owner Driver vs Company Driver quoting, allocation, finance and document permissions have not been verified E2E by account.

## P2 — UX / presentation
P2-01 Breadcrumb overlap. Pixel: Back to Bookings overlaps 'BOOKINGS / OPERATIONAL WORKFLOW'; Back to POD overlaps 'BOOKINGS / INVOICE' (reproduced).
P2-02 In desktop, narrow centered phone app occupies small portion of viewport and some labels are too small; responsive layout and typography should be QAed.
P2-03 Bottom fixed nav obscures content at some scroll positions until the user scrolls; ensure safe bottom padding on every content page and dialogs.
P2-04 Full street addresses appear twice with postcode/country duplication ('..., BB1 9QL, GB, BB1 9QL'); route labels need normalized town/outcode and proper address formatting.
P2-05 Raw technical labels leak to UI: service_mode 'timed_direct', vehicle strings 'luton_tail_lift', references truncated to 8 chars instead of user-friendly labels.
P2-06 Large job cards and ungrouped completed bookings require excessive scrolling; compact consistent approved job cards/tabs needed.
P2-07 Refresh icon and 'AUTHENTICATED XDRIVE' can imply data freshness even with stale session; explicit last-sync time and error status missing.
P2-08 On phone, no visible Loading skeleton/retry during auto authentication; zero state may appear before fetch completes.

## Reproduced UI paths
A. Pixel: Loads (3), Quotes (28), Bookings (24), More. Capture at D:\XDrive-PWA-RESERVE-20261108-EVIDENCE\xf_Quotes2.png / xf_Bookings2.png / xf_Menu2.png.
B. Pixel: Bookings -> Open Job -> POD Saved -> scroll -> Continue to Invoice -> Create Invoice 9/11. Captures xf_job.png, xf_podscroll.png, xf_invoice9.png.
C. Pixel: More -> Documents -> blank dialog. Capture xf_docs.png.
D. Opera: invoice page 9/11 with overlapped breadcrumbs; screenshot via browser connector; no financial action submitted.
E. API: Local PWA, manifest and worker return 200. Production config endpoint 200. Real write endpoints not exercised during this audit.

## Release gate
FAIL. Do not deploy or replace the approved PWA 1099. Fix P0, then P1/visual, then perform authenticated real-device E2E:
Load -> View Details -> quote (ETA, vehicle, amount) -> award -> Incoming Booking -> Accept -> Collection -> Loaded -> Delivery -> signature -> POD -> invoice create -> PDF A4 -> issue/send -> email confirmation -> completed booking. Verify each backend status and round trip. Retest data isolation for Owner vs Company Driver. No claims of completion from build/unit checks alone.

## Limitations
This is the complete audit of observed screens and inspected code paths, not proof that every runtime branch has executed. Unobserved failures remain possible. Production POST/issue/send were NOT invoked; credentials and user tokens were not copied or exported.
