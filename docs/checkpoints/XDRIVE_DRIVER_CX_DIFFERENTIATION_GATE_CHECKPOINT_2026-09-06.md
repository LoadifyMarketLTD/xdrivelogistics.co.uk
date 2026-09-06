# XDrive Driver — CX differentiation gate checkpoint — 2026-09-06

## Canonical scope

- Repo: `LoadifyMarketLTD/xdrivelogistics.co.uk`
- Branch: `driver/phone-golden-20260718-modernization`
- PR: #510 — `Driver phone GOLDEN recovery and modernization`
- PR remains DRAFT / NOT MERGED.
- No GitHub Actions are part of validation.
- No Production DB migration.
- No Production Netlify deployment.
- Do not modify `main`.
- Do not import PR #503 or `android-native`.
- GOLDEN package `co.uk.xdrivelogistics.driver` remains protected.
- Preview package remains `co.uk.xdrivelogistics.driver.preview` side-by-side.

## Physical gates already passed before differentiation

- Preview side-by-side installation: PASS.
- GOLDEN SHA before/after Preview installation remained canonical and byte-identical:
  `81f0e825a5899c90c34cd6a34af8104ce37c8be42ca4b3dcf9a7b978ee916f74`.
- Login ghost/double-layer gate: PASS on physical Pixel.
- Authenticated login: PASS on physical Pixel.
- Fixed shell: PASS, user-confirmed physically.

These physical results applied to the superseded V2 Preview. V3 must be rebuilt and visually re-approved before final PASS.

## CX comparison — identified expressive similarities in V2

Public Courier Exchange references and the physical V2 Preview showed an unnecessarily close combination of UI expression and information architecture:

1. Bottom navigation used the same visible sequence: `Home / Alerts / Quotes / Bookings / More`.
2. Home used a similar driver/vehicle + tracking + status hierarchy.
3. Home then used a similar quick-action row: `Search / Network / Journeys`, with CX using Search / Who's Nearby / Journeys.
4. Load alerts used `Inbox / Saved / Hidden`, close to CX Inbox / Saved / Deleted.
5. Load cards used a numbered pickup/delivery route presentation plus a Quote CTA.
6. Quote workflow used familiar Quote naming and Submitted / Accepted / Closed buckets.
7. Bookings used period buckets (`Current / Past 7 / Past 14 / All`).
8. Job detail used `Summary / Stops / Status` tabs and a familiar milestone timeline.
9. More used a two-column utility tile grid.

Common logistics functionality such as load matching, GPS tracking, status updates, proof-of-delivery, signatures, photographs and commercial offers is retained where required. The differentiation gate targets the product's expressive UI, wording, hierarchy and navigation rather than removing necessary operational capability.

## V3 differentiation implemented

Preview runtime is now `apps/xdrive-driver-phone-golden/src/app/DriverMobileAppV3.tsx`.
`App.tsx` loads V3 only for side-by-side Preview; non-preview still loads recovered GOLDEN `DriverMobileApp`.

### Primary information architecture

Old V2:
- Home
- Alerts
- Quotes
- Bookings
- More

V3:
- Overview
- Loads
- Offers
- History
- Account

### Overview

V3 no longer uses the V2/CX-like date-centred header, driver/vehicle tile, tracking tile, status row and Search/Network/Journeys pill row.
It now uses:
- `XDRIVE / DRIVER CONTROL`
- driver identity + vehicle
- one Work State / Location Link rail
- a dedicated `Find available work` Load Board card
- a single operational snapshot for Available loads / Active work / Open offers

### Load Board

V3 terminology and structure:
- `Load Board`
- `Available / Starred / Dismissed`
- `COLLECT -> DELIVER` route panels rather than numbered 1/2 markers
- `Make offer`, not Quote CTA
- existing-offer state remains visible and non-repeatable

### Offers

V3:
- `Offers`
- `Active / Won / Archived`
- `Make offer / Send offer / Retract / Open work order`

Backend bid/quote contracts are intentionally unchanged.

### History

`Bookings` is removed from the V3 navigation.
`History` is a full chronological operational log:
- no Past 7 days
- no Past 14 days
- no period buckets
- current and completed work are merged into one full list

### Work Order

V3 replaces `Summary / Stops / Status` with:
- `Overview / Route / Progress`

Route presentation uses COLLECT / DELIVER work blocks.
Progress uses rectangular state rows (`DONE / NOW / NEXT` semantics) instead of the V2 milestone-dot timeline.

### Lifecycle UI wording

Backend endpoints remain unchanged. Visible driver actions were independently worded as:
- Head to collection
- Confirm collection arrival
- Confirm cargo loaded
- Start delivery leg
- Confirm delivery arrival

V3 progress labels are:
- Assigned
- Heading to collection
- At collection point
- Cargo loaded
- Delivery leg active
- At delivery point
- Completed

### Account

V3 removes the two-column `More` tile grid and uses grouped vertical account/operations rows.

## Superseded source

`apps/xdrive-driver-phone-golden/src/app/DriverMobileAppV2.tsx` was removed from the current branch after V3 became the Preview runtime. Git history preserves it, but it is no longer current/canonical source.

## Runtime issue still open

Before V3 differentiation, the physical Preview showed:
- 0 Live Loads
- 0 submitted quotes

Read-only Production DB/API analysis indicated eligible marketplace data existed. V3 therefore keeps an explicit Load Board error state and Refresh action so the next physical build exposes the actual runtime failure instead of silently presenting an empty board.

Do not declare the marketplace/offer gate PASS until the V3 physical build shows the expected data or a specific error has been diagnosed and fixed.

## Remaining gate order

1. Pull exact latest PR #510 HEAD into isolated worktree.
2. App-local `npm run typecheck`.
3. Static V3 differentiation contract checks.
4. Build Preview `.preview` using stable local Preview signing identity.
5. Verify package/label before install.
6. Verify canonical GOLDEN SHA before Preview change.
7. Replace ONLY `.preview` if signing identity requires it.
8. Reverify GOLDEN SHA after install.
9. Physical V3 visual approval.
10. Authenticated Overview / Loads / Offers / History / Account E2E.
11. Diagnose the existing 0-load / 0-offer runtime discrepancy.
12. Quote/offer submit, edit, retract and duplicate-blocking physical gate.
13. Work Order lifecycle physical E2E.
14. Pickup evidence camera gate.
15. POD recipient/signature/photo/completion gate.
16. Offline queue/replay gate.
17. Active-job location publisher gate.
18. Notification/deep-link gate.
19. Messaging only after a verified production messaging contract exists.
20. User final visual approval.
21. Only then consider replacement/release planning.

## Legal-position note

This checkpoint records an engineering differentiation review, not a legal opinion or clearance. The goal is to avoid unnecessarily copying distinctive UI expression, wording and information architecture while retaining legitimate transport/logistics functionality. Formal IP clearance requires qualified legal counsel if a legal opinion is required.
