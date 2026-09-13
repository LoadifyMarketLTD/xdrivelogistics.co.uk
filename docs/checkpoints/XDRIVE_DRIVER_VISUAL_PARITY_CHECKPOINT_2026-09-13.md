# XDrive Driver — Visual Parity Checkpoint — 2026-09-13

This is the authoritative handoff for the next chat/agent. Read it before changing code. The target is NOT a generic redesign: the Expo XDrive Driver app must match the approved XDrive reference screens while using real authorised XDrive data.

## Repo state
- Repository: `LoadifyMarketLTD/xdrivelogistics.co.uk`
- PR: `#523` — open, Draft, mergeable. Do not mark ready or merge yet.
- Base: `driver/mobile-master-rebuild-20260907`
- Branch: `fix/expo-driver-e2e-functional-20260909`
- Code checkpoint before reference docs: `7b8d597d8ff0d5ca8733c17eca2956bed61d43d0`
- Visual-reference anchor: `0322eaaea7975606e702f9d58dbc5c0a1fbf3d75`
- Canonical mobile app: `apps/xdrive-driver-mobile-rebuild/`

## Approved visual references — open these first
- `docs/visual-reference/xdrive-driver/approved-bookings-board.svg`
- `docs/visual-reference/xdrive-driver/approved-quotes-board.svg`

These are repo-native visual anchors derived from the approved boards/screenshots. Do not replace them with another design system.

Visual grammar: navy `#292837`; segmented container about `#3A3949`; active tab / quote CTA yellow `#FFE66A`; route/actions blue about `#5199D6`; operational CTA/completed state green about `#65C653` / `#4CAD3F`; page background `#F2F3F7`; white rounded cards; Inter typography. Bottom navigation labels must be exactly `Home / Alerts / Quotes / Bookings / More`.

## Architecture and data rules
The inspected packaged XDrive preview is Expo / React Native + Hermes. Continue the Expo app. Do not move this work to `android-native` and do not merge the Kotlin implementation into the canonical mobile line.

The approved Courier Exchange-style screens define UX/presentation only. Never hard-code its sample companies, load IDs, addresses, prices, phone numbers, feedback counts or POD filenames into XDrive. Existing XDrive APIs remain authoritative. Preserve auth, role, compliance, assignment, POD evidence and tenant/privacy rules.

Scope is mobile-only unless the user explicitly expands it: `apps/xdrive-driver-mobile-rebuild/src/theme/**`, `components/**`, `screens/**`, `types/**` for presentation typing, `utils/**`, and `App.tsx` only when navigation wiring is needed. Do not modify web/backend routes, `lib/**`, `android-native/**`, Supabase migrations or production deployment for this visual phase.

## Implemented in source on PR #523
Treat these as implemented but not finally accepted until a fresh local build/device check passes:
- bottom nav -> `Home / Alerts / Quotes / Bookings / More`;
- Alerts board -> `Inbox / Saved / Deleted`, approved cards, persistent saved/hidden state;
- blue numbered route markers, timing, cargo/distance/notes and yellow Quote CTA;
- Bookings -> `Current / Past 7 days / Past 14 days` with approved navy/yellow tabs;
- booking cards: customer reference, real final stop number for multi-stop, `View POD` only when POD actually completed;
- UK/London booking time formatting such as `12:50 BST | 29 Aug`;
- Quote Detail: approved route layout + functional `View Route Map`;
- Quote form: GBP amount, extras, total, collect-within, vehicle, notes, while retaining XDrive quote-readiness rules;
- Booking Detail: `Summary / Stops / Status`;
- ordered multi-stop list and stop-detail modal;
- customer attachments plus `Add Document` / `Add Image` evidence staging;
- real XDrive POD capture flow with recipient, evidence and signature-image validation;
- status terminology aligned to `Delivered (POD)` plus an `Invoice` stage;
- operational buttons restyled to the approved green.

Recent parity commits after route-block alignment: `8dd076d2` route map action; `c6f2007e` POD timeline; `ba793b34` Delivered (POD) label; `80dd73bc` booking card/POD state; `1f12859d` UK time; `6d1ce8b2` booking tabs; `4075a6b0` invoice stage; `7b8d597d` operational CTA green.

## Not yet proven — do not claim DONE
After the latest visual commits the branch still needs fresh LOCAL validation on the user's Windows laptop: sync branch safely, run TypeScript typecheck, Expo Android prebuild, local Gradle `assembleDebug`, install preview APK on Pixel, open real XDrive screens, capture screenshots, compare screen-by-screen to the approved references, fix any remaining visual/interaction differences, then and only then call visual parity PASS.

The repo contains `apps/xdrive-driver-mobile-rebuild/build-local-apk.ps1`. It runs dependency install if needed, `npm run typecheck`, Expo Android prebuild, Gradle `assembleDebug`, then prints the APK path and SHA256.

## No GitHub Actions
The user explicitly said not to use GitHub Actions because there are no credits. Do not diagnose CI or use it as an acceptance gate. Prefer `[skip ci]` on further branch commits where practical. Local PowerShell + local APK + physical Pixel are authoritative.

## Laptop / PowerShell rules
- exactly ONE PowerShell block/step at a time, then wait for output;
- never include `exit`;
- no destructive Git: no `git reset --hard`, `git clean`, broad checkout/revert or deleting backups;
- inspect `git status --short` before risky actions and preserve unrelated work;
- if the prompt is stuck at `>>`, tell the user `Ctrl+C` first;
- do not assume the XDrive clone path; `D:\LoadifyMarket-Release-v4` is Loadify Market and is the WRONG project.

Desktop Commander was discoverable in the previous chat but execution was disabled there. Check again in the next chat. If active, prefer safe direct inspection/commands. If not, use the user's PowerShell one step at a time.

## Acceptance map
Alerts: Inbox/Saved/Deleted + map action + XDrive load cards + yellow Quote. Quote detail: Load ID, company/member where authorised, route/timing, map, vehicle/distance/cargo/notes, customer context only if API permits, submit quote form. Bookings: Current/Past 7/Past 14, route/time/distance/notes, POD action. Booking detail: Summary/Stops/Status, attachments/evidence, multi-drop stop modal, green next-action CTA, timeline/timestamps/Invoice.

Next action in the next chat: open this checkpoint and both visual boards, inspect current PR/branch, continue only demonstrable remaining parity fixes, then move to local PowerShell build and Pixel screenshot comparison. Do not start another redesign or another project.