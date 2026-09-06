# XDrive Driver — Full Work Order plan

Date: 2026-09-06
PR: #510
Branch: `driver/phone-golden-20260718-modernization`

## Non-negotiable execution rule

Before award, marketplace details remain privacy-protected. After award and assignment to the authenticated driver, the mobile app must expose every verified operational and commercial detail the driver needs to execute the job without relying on another system.

The mobile Work Order must distinguish three identities that can be different:

1. contracting / posting company — who gave the work;
2. collection site/company — where and from whom cargo is collected;
3. delivery site/company — where and to whom cargo is delivered.

Collection and delivery contacts must never collapse into one generic contact.

## Sources used for this plan

- physical CX screenshots supplied by the user, including load details, quote states, bookings, stop detail, status history, POD, attachments and left/right swipe behaviours;
- inspected CX APK split pack and its functional modules;
- XDrive web driver job sheet and execution source in `main`, especially the canonical assigned-job sheet contract;
- current XDrive Driver V3 client and `/api/driver/mobile/jobs/[id]` contract in PR #510.

The goal is functional completeness, not visual imitation. Existing XDrive information architecture remains canonical: `Overview / Route / Progress`, `Loads / Offers / History / Account`.

## Phase 1 — assigned-job server contract

Enrich `/api/driver/mobile/jobs/[id]` only after strict assigned-driver authorization with:

- XDrive, booking, customer and PO references;
- posting company name, member code and operational phone where verified;
- agreed rate, currency and payment terms where a verified commercial source exists;
- customer/end-client identity where verified and operationally relevant;
- exact collection and delivery addresses, time windows and independent contacts;
- persistent multi-stop route, including stop-specific company, contact, phone and instructions;
- requested and allocated vehicle details;
- cargo type, weight, dimensions, pallet count/type, stackability and cargo value;
- forklift, tail-lift, handball, direct-delivery and other requirements;
- full customer/execution/collection/delivery instructions without truncation;
- document checklist and attached job documents;
- server-confirmed operational timeline with timestamps;
- POD summary for completed work orders;
- explicit `partial` truth flag when any enrichment source is unavailable.

No marketplace endpoint is allowed to inherit these private assigned-job details.

## Phase 2 — mobile Work Order presentation

### Overview

Show:

- `WORK ORDER` identity;
- `Booked by` / contracting company;
- XDrive ref + booking/customer/PO refs;
- agreed rate and payment terms;
- full route summary;
- requested/allocated vehicle;
- cargo details and requirements;
- full instructions;
- document checklist + attached files;
- completed POD summary when available.

### Route

Show every stop in server sequence. Each stop must expose:

- stop type and sequence;
- company/site;
- exact address/postcode;
- time window;
- contact name;
- phone;
- stop-specific instructions;
- call and navigate actions.

A later UX pass may add copy-address and dedicated stop-detail drill-down while retaining the XDrive design language.

### Progress

Retain the XDrive lifecycle language and `DONE / NOW / NEXT`, but add server-confirmed timestamps and event notes/evidence where available.

### Completed work

Expose a read-only evidence/POD summary and a later `View POD` drill-down without exposing raw private storage paths.

## Phase 3 — discovery / parity improvements

After the full assigned-job gate passes:

- swipe right → Star/Unstar;
- swipe left → Dismiss/Restore;
- server-synchronised marketplace preferences if a canonical contract is added;
- load search and XDrive-specific filters;
- richer Return IQ destination controls;
- live availability visibility when driver is `Ready for work`;
- alerts centre;
- richer route/ETA map;
- secure messaging only when a real production contract exists.

## Safety / release gates

- PR #510 remains DRAFT / NOT MERGED.
- no Production DB migration;
- no Netlify Production deploy;
- no changes to `main`;
- GOLDEN package must remain byte-identical;
- preview remains side-by-side `.preview`;
- no final PASS until physical authenticated E2E is completed on the assigned-job flow.

## Full Work Order E2E acceptance gate

An assigned driver must be able to answer, using only the XDrive Driver app:

- Who gave me this job?
- What is the agreed commercial deal?
- Where exactly do I collect?
- Which company/site am I collecting from?
- Who is my collection contact and how do I call them?
- What exactly am I collecting?
- What equipment or paperwork do I need?
- Are there extra stops, and in what order?
- Where exactly do I deliver?
- Which company/site am I delivering to?
- Who is my delivery contact?
- What are the complete instructions?
- What documents are attached?
- What operational step am I on and when were previous steps confirmed?
- What POD/evidence exists after completion?

If any answer requires guessing or another application, the assigned-job gate is not PASS.
