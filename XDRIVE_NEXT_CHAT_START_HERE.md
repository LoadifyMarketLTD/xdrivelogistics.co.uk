# XDrive — Next Chat Start Here

This branch is a READ-ONLY checkpoint for handoff. Do not develop here.

Implementation continues on:

`fix/expo-driver-e2e-functional-20260909`

Implementation HEAD captured by this checkpoint:

`7b8d597d8ff0d5ca8733c17eca2956bed61d43d0`

Primary PR:

`#523` — Draft — XDrive Driver visual parity / functional hardening

## Read in this order

1. `docs/checkpoints/XDRIVE_DRIVER_VISUAL_HANDOFF_2026-09-13.md`
2. `docs/visual-references/xdrive-approved-bookings-board.svg`
3. `docs/visual-references/xdrive-approved-quotes-board.svg`

## Non-negotiable rules

- Use real XDrive data; Courier Exchange is UX/reference only.
- Canonical mobile app is `apps/xdrive-driver-mobile-rebuild` (Expo/React Native).
- Do not switch the UI implementation to `android-native`.
- Do not modify production Supabase, run migrations, deploy production, or merge PR #523 during the visual-validation phase.
- Do not use GitHub Actions CI; user has no CI credits.
- Build locally on the Windows laptop with PowerShell and Gradle.
- Try Desktop Commander first in the new chat; if unavailable, give the user exactly ONE PowerShell block at a time.
- Preserve all unrelated local work; no destructive Git commands.
- Use `[skip ci]` for visual-phase commits.
- No visual PASS until the latest APK is installed on the physical Pixel and actual screenshots are compared against both approved boards.

## Immediate implementation order

1. Fix `JobDetailScreenV2` to pass the real `job.auditTrail` and `job.podCompleted` into `DeliveryTimeline`.
2. Make the Alerts header map action functional.
3. Implement reference-like swipe delete/reveal in Alerts without unnecessary dependencies.
4. Inspect existing authorized XDrive mobile data for Quote Detail feedback/customer/terms/phone/message; render only fields actually provided safely.
5. Fine-tune remaining visual spacing/typography/components.
6. Run `apps/xdrive-driver-mobile-rebuild/build-local-apk.ps1` locally.
7. Install `co.uk.xdrivelogistics.driver.preview` on the intended Pixel with ADB.
8. Capture and compare every corresponding screen before declaring PASS.

If any instruction here conflicts with the detailed handoff, the detailed handoff is authoritative.
