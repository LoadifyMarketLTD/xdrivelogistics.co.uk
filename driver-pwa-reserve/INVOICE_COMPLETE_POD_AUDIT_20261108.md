# XDrive Driver Reserve — combined Invoice + complete POD
Date: 2026-11-08
Scope: branch feature/xdrive-driver-reserve-20261108 (local only)
Reference generator: https://www.xdrivelogistics.co.uk/driver/finance

## User-approved deliverable
ONE A4 PDF, in this sequence:
1. Official XDrive invoice with canonical invoice number, tax and buyer details.
2. Complete signed Proof of Delivery record sourced from proof_of_delivery.
3. Recipient signature or validated recipient attestation.
4. ALL linked collection images (jobs.pickup_photos plus collection_photo_url).
5. ALL linked delivery/POD/damage images, proof_of_delivery photo URLs, and uploaded PDF evidence.

## Implemented in local branch
- Removed statistics cards Marketplace, Quoted open, Bid history and Bookings from Loads to put jobs immediately below search.
- invoicePdfContext loads the authoritative handover record (received_by, left_at, delivered_on, no_of_items, delivery_status, delivery_notes), recipient signature, pickup_photos, collection_photo_url, delivery_photos, pod_photos, damage_photos and proof_of_delivery.photo_urls.
- Evidence deduplicated by storage path. Missing/misowned evidence stops PDF generation instead of silently dropping it.
- invoicePdf generates the complete POD form after the invoice, followed by signature, collection and delivery photos and uploaded documents.
- Finance preview requires complete POD on job-linked invoices.
- invoiceDelivery stores and emails the SAME combined document as ONE PDF attachment. Previously split invoices + POD snapshots are refused for manual reconciliation; no silent retry or duplicate email.
- Reserve app connects to /driver/finance's official Ready To Invoice -> generate-invoice -> preview -> submit API, with an explicit single-file review/approval step.

## Validation
- npm run build PASS (TypeScript + Vite).
- 32/32 selected unit/contract tests PASS including invoice POD and Loads regression.
- Pixel 7 Pro Chrome visually verified no statistics cards in Loads (capture D:\XDrive-PWA-RESERVE-20261108-EVIDENCE\rv_nostats.png).
- No live invoice, customer email or production deployment was performed.
- Full real PDF render check using genuine uploaded evidence and delivered email reception: NOT YET VERIFIED.
- Current Pixel app displayed 0 loads after fresh Chrome navigation; live feed/session restoration remains a separate unresolved issue.

## Protected scope
Official PWA 1099, GitHub main, Netlify and deployed /driver/finance are UNCHANGED. Backend PDF changes are committed only to the independent reserve worktree branch. Real platform does not have these changes until separately reviewed and deployed.
