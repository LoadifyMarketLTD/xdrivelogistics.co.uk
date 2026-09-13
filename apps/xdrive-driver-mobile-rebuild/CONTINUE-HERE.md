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

## Validation rule
DO NOT claim the app is finished just because code looks correct. Final PASS requires:
- local TypeScript typecheck PASS
- local Android APK build PASS
- install/render on physical Pixel PASS
- screenshot-by-screenshot comparison against the approved references PASS

The local build helper is `build-local-apk.ps1` in this app directory.

## No GitHub Actions
The user explicitly has no GitHub Actions credits and does not want Actions used. Do not waste time on CI failures. Prefer `[skip ci]` for further commits where practical. Validation is local on the user's Windows laptop.

## PowerShell operating rules
If Desktop Commander is unavailable, work through the user's PowerShell terminal. Give exactly ONE PowerShell block at a time and wait for the output. Never use `exit`. Never use destructive Git such as `git reset --hard` or `git clean`. Preserve unrelated local work. Do not assume the XDrive local path; the known `D:\LoadifyMarket-Release-v4` path is a different project.

## First action in the next chat
Verify current PR/branch state and inspect the three files above. Continue remaining parity differences only. After the UI work is stable, move immediately to local PowerShell build + Pixel screenshot validation. Do not branch into unrelated website/backend/Loadify work.