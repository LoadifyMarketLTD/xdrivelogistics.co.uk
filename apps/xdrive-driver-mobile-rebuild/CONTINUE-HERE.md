# CONTINUE HERE — XDrive Driver Visual Parity

If you are the next ChatGPT/agent continuing this work, STOP and read these files before editing code:

1. `docs/checkpoints/XDRIVE_DRIVER_VISUAL_PARITY_CHECKPOINT_2026-09-13.md`
2. `docs/visual-reference/xdrive-driver/approved-bookings-board.svg`
3. `docs/visual-reference/xdrive-driver/approved-quotes-board.svg`

Then inspect PR `#523` on branch `fix/expo-driver-e2e-functional-20260909`.

## Non-negotiable direction
The user approved the visual system represented by the reference boards. Continue converging the XDrive Expo app toward those screens. Do not invent a new UI, do not switch to Kotlin/android-native, and do not replace XDrive data with Courier Exchange sample data.

Canonical app: `apps/xdrive-driver-mobile-rebuild/`.

Keep real XDrive API/auth/compliance/POD/tenant boundaries intact. Visual parity is not permission to weaken backend rules.

## What the user expects
XDrive should display the corresponding functions in the same visual language as the approved boards:
- bottom nav: `Home / Alerts / Quotes / Bookings / More`
- Alerts: `Inbox / Saved / Deleted`, route cards, tags when real, map action, yellow Quote CTA
- Quote Detail / form: route, map, vehicle, distance, cargo, notes, authorised customer context, GBP/extras/collect-within/vehicle/notes
- Bookings: `Current / Past 7 days / Past 14 days`
- Booking Detail: `Summary / Stops / Status`
- multi-stop details/modal
- attachments + Add Document / Add Image
- POD capture/view
- lifecycle through `Delivered (POD)` and `Invoice`
- operational progress CTA green

## Current parity work completed
- Alerts uses the XDrive header, compact approved card scale, numbered blue route markers, yellow Quote CTA and real swipe-right Saved / swipe-left Deleted actions.
- The Alerts map control is actionable and opens the first visible pickup in Maps instead of being decorative.
- Quote Detail is separated from Submit Quote: detail first, then the yellow `Quote` CTA opens the form.
- Quote Detail includes route/map, vehicle, distance, notes, customer context and the approved Feedback card structure without inventing reputation counts.
- Submit Quote follows the approved `MY QUOTE (EXC. VAT)` hierarchy: GBP/amount, additional extras, Total, Will collect within, Vehicle, Notes, Submit Quote.
- Marketplace weight and pallet count are preserved from the existing real mobile API response for presentation.
- Bottom navigation remains visible on load/booking detail screens and navigating to another main tab correctly closes the detail.
- Bottom navigation now includes the approved blue active indicator, compact sizing and calendar-style Bookings icon.
- Bookings uses the XDrive/Bookings header and light `Current / Past 7 days / Past 14 days` pills with navy selected state.
- Quotes list uses the same XDrive header and compact card grammar.
- Booking Detail keeps the approved `Summary / Stops / Status` structure, stop modal, POD paths and status audit timestamps.
- The shared operational progress CTA is the approved wide green rectangular action.
- `UiIcon` uses the complete installed Ionicons glyph set so the approved iconography does not create type errors.

## Validation rule
DO NOT claim the app is finished just because code looks correct. Final PASS requires:
- local TypeScript typecheck PASS
- local Android APK build PASS
- install/render on physical Pixel PASS
- screenshot-by-screenshot comparison against the approved references PASS

## No GitHub Actions
The user explicitly has no GitHub Actions credits and does not want Actions used. Do not inspect, run or rely on GitHub Actions/CI. Use `[skip ci]` on further commits where practical. Validation is local on the user's Windows laptop.

## Local PowerShell workflow
The build helper is `build-local-apk.ps1` in this app directory. It runs `npm ci` when needed, TypeScript typecheck, Expo Android prebuild and Gradle `assembleDebug`.

When the Pixel is connected through adb, the preferred one-command validation is:

```powershell
.\build-local-apk.ps1 -Install -Launch
```

If Android prebuild was already generated and should be preserved:

```powershell
.\build-local-apk.ps1 -SkipPrebuild -Install -Launch
```

After manually navigating the Pixel to each required reference state, capture screenshots with:

```powershell
.\capture-pixel-screen.ps1 -Name 'alerts-inbox'
```

Use distinct names such as `alerts-inbox`, `quote-detail`, `quote-form`, `bookings`, `booking-summary`, `booking-stops`, `booking-stop-modal`, `booking-status`, `pod-view`, and `pod-capture`. Screenshots are saved under `pixel-screenshots/` unless another output directory is supplied.

## PowerShell operating rules
If Desktop Commander is unavailable, work through the user's PowerShell terminal. Give exactly ONE PowerShell block at a time and wait for the output. Never use `exit`. Never use destructive Git such as `git reset --hard` or `git clean`. Preserve unrelated local work. Do not assume the XDrive local path; the known `D:\LoadifyMarket-Release-v4` path is a different project.

## Next mandatory phase
Do not claim visual parity yet. Move to the user's Windows laptop, run local TypeScript validation and the local APK build, install the preview APK on the physical Pixel, then compare the actual rendered screens screenshot-by-screenshot with the two approved boards. Fix any remaining spacing, clipping, status-state or device-specific differences found on the Pixel before calling this complete.
