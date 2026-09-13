# XDrive Driver — NEXT CHAT HANDOFF — Visual parity + local Pixel validation

This checkpoint exists so the next ChatGPT/agent continues the exact same XDrive task without redesigning, switching projects, or losing the approved visual direction.

## Conversation starting point to preserve
The user’s governing instruction is:

> "asa trebuie sa afiseze xdrive toate ecranele corespondente functiilor"

Meaning: every XDrive Driver function must render in the same visual language and information hierarchy as the approved reference screens, while using real authorised XDrive data and the existing XDrive backend contracts.

The user then explicitly approved continuing the work and asked for a checkpoint before moving to a new chat.

## APPROVED IMAGES — open these FIRST, before touching code
These repository-native image boards are already committed on the active branch and are the visual baseline. They were created from the approved screen set and must remain the reference target:

1. `docs/visual-reference/xdrive-driver/approved-bookings-board.svg`
2. `docs/visual-reference/xdrive-driver/approved-quotes-board.svg`

Do not substitute another design system. Do not make a generic XDrive redesign. Do not use old green-pill layouts where the approved boards show the newer navy/yellow/blue system.

### Visual grammar locked by the approved images
- navy app/header background: approximately `#292837`
- segmented/tab container: approximately `#3A3949`
- active tab and Quote CTA: yellow approximately `#FFE66A`
- route markers / route actions: blue approximately `#5199D6`
- operational/completed CTA/status: green approximately `#65C653` / `#4CAD3F`
- page background: approximately `#F2F3F7`
- white rounded cards
- Inter-like typography and spacing matching the boards
- bottom navigation labels exactly: `Home / Alerts / Quotes / Bookings / More`

## Current repository / PR state
- repository: `LoadifyMarketLTD/xdrivelogistics.co.uk`
- PR: `#523` — `fix(driver): harden mobile preview functional flows`
- PR state at checkpoint creation: OPEN, DRAFT, MERGEABLE
- base branch: `driver/mobile-master-rebuild-20260907`
- working branch: `fix/expo-driver-e2e-functional-20260909`
- current branch HEAD at checkpoint creation: `71ce184aa1c027378eef34be00898b1c343987ff`
- canonical app: `apps/xdrive-driver-mobile-rebuild/`

Important: an earlier user-visible progress message mentioned HEAD `fd8fbc5c8aa35494e5b8f75a9261afd9be02f084`. That was a historical code-stage HEAD. Documentation/checkpoint commits were added afterward. The next agent must trust the live PR/branch state, not the older quoted SHA.

## Architecture decision — DO NOT DEVIATE
The inspected packaged XDrive preview is Expo / React Native + Hermes. The canonical line for this work is:

`apps/xdrive-driver-mobile-rebuild/`

Do NOT switch this visual parity work to `android-native/`. Do NOT merge the Kotlin app into the canonical Expo app. Kotlin/native code may be useful only as a reference for recovered fields/logic if required, never as the primary UI implementation for this task.

## Data / security rule — presentation parity only
The Courier Exchange screenshots define UX/presentation patterns only.

NEVER hard-code Courier Exchange sample companies, member IDs, load IDs, addresses, prices, phone numbers, feedback counts, POD filenames, or status timestamps into XDrive production UI.

All displayed data must come from real XDrive APIs and existing authorised contracts. Preserve:
- authentication/session rules
- driver role/compliance eligibility
- tenant/privacy boundaries
- assignment/award rules
- quote readiness rules
- POD/evidence rules
- document permissions
- existing XDrive backend status semantics

Visual parity is not permission to weaken backend validation.

## Mobile-only scope for this phase
Allowed by default:
- `apps/xdrive-driver-mobile-rebuild/src/theme/**`
- `apps/xdrive-driver-mobile-rebuild/src/components/**`
- `apps/xdrive-driver-mobile-rebuild/src/screens/**`
- `apps/xdrive-driver-mobile-rebuild/src/types/**` when presentation typing is needed for fields already returned by XDrive APIs
- `apps/xdrive-driver-mobile-rebuild/src/utils/**`
- `apps/xdrive-driver-mobile-rebuild/App.tsx` only if navigation wiring requires it
- local build helper/docs inside the same mobile app

Do NOT modify unless the user explicitly expands scope:
- `app/**` web/backend routes
- `lib/**`
- `android-native/**`
- Supabase migrations
- production Supabase data
- production deployment configuration
- unrelated Loadify Market code

## What has already been implemented on PR #523
Treat these as implemented in source, but NOT finally accepted until fresh local build + Pixel rendering passes:

### Navigation / shell
- bottom nav aligned to `Home / Alerts / Quotes / Bookings / More`
- approved navy/yellow visual direction introduced across the key flow

### Alerts / load board
- `Inbox / Saved / Deleted`
- persistent saved/hidden state
- approved load-card information hierarchy
- blue numbered route markers
- real route times / cargo / distance / notes where API provides them
- yellow `Quote` CTA
- map action
- swipe/save/delete interactions where applicable

### Quote Detail / quote form
- route block changed away from old green/pill style
- marker `1 / 2` blue route grammar
- functional `View Route Map`
- UK/London time formatting aligned to references, e.g. `12:50 BST | 29 Aug`
- vehicle / distance / cargo / notes
- quote form with GBP amount
- extras support
- total
- collect-within field
- vehicle
- notes
- quote readiness/compliance remains governed by XDrive logic

### Bookings
- tabs: `Current / Past 7 days / Past 14 days`
- navy/yellow tab treatment
- customer reference displayed when available
- multi-stop final marker uses the real stop count
- `View POD` appears only when POD is actually completed, not merely requested

### Booking Detail
- tabs: `Summary / Stops / Status`
- ordered multi-stop list
- stop-detail modal
- attachments section
- `Add Document / Add Image` evidence staging
- real XDrive POD capture/view path retained
- POD requires real recipient/evidence/signature conditions as defined by the app/backend

### Status / operational flow
Terminology aligned toward the approved operating sequence:
- `Accepted`
- `On My Way to Collection`
- `On Site (Collection)`
- `Loaded`
- `On My Way to Delivery`
- `On Site (Delivery)`
- `Delivered (POD)`
- `Invoice`

Operational next-step CTAs use the approved green treatment.

## User-approved visual outcome by function
The next agent should compare every corresponding function against the approved image boards, not just individual components.

### Alerts
Must visually support:
- Inbox / Saved / Deleted segmented control
- map action
- company/member context when authorised
- NEW / HOTSHOT / SMARTPAY-style status chips only when the real XDrive data supports equivalent states
- route card with blue 1/2 markers
- pickup/delivery times
- dimensions/weight/cargo where present
- yellow Quote CTA
- swipe save/delete state

### Quote Detail
Must visually support:
- Load ID header
- company/member identity where authorised
- route summary
- `View Route Map`
- vehicle
- distance
- cargo / dimensions / weight / notes
- customer/feedback/terms/contact only where existing XDrive APIs and privacy rules permit it
- yellow Quote CTA

### Submit Quote
Must visually support:
- `MY QUOTE (EXC. VAT)` equivalent XDrive copy
- GBP selector
- amount input
- additional extras
- total
- collect-within
- vehicle
- notes
- Submit Quote disabled/enabled according to real XDrive rules

### Bookings
Must visually support:
- `Current / Past 7 days / Past 14 days`
- completed/current booking cards
- route markers and timing
- distance / duration when available
- customer notes
- relevant status badges
- `View POD` only after real completed POD state

### Booking Detail — Summary
Must visually support:
- customer / Load ID context
- long notes/instructions blocks
- load details / vehicle / cargo
- attachments
- Add Document
- Add Image
- payment section only if real XDrive data supports it

### Booking Detail — Stops
Must visually support:
- ordered pickup / extra stop / delivery rows
- blue numbered stop markers
- company + address + time windows
- stop modal with time/company/address
- green operational CTA at bottom for the real next action

### Booking Detail — Status
Must visually support a vertical completed/current timeline with timestamps derived from real XDrive state/history, including `Delivered (POD)` and `Invoice` only when supportable by canonical XDrive data.

## Local build strategy — GitHub Actions is NOT used
The user explicitly said there are no GitHub Actions credits and does not want Actions used.

Do not spend time diagnosing CI. Do not use CI failure as an acceptance signal. Prefer commit messages with `[skip ci]` where practical.

Authoritative validation is local on the user’s Windows laptop.

The repo contains:

`apps/xdrive-driver-mobile-rebuild/build-local-apk.ps1`

The intended local sequence is:
1. safely locate/sync the XDrive repo and active branch
2. inspect `git status --short` before any risky action
3. run local TypeScript typecheck
4. Expo Android prebuild if required by helper
5. local Gradle `assembleDebug`
6. obtain APK path + SHA256
7. install preview APK on physical Pixel
8. open real XDrive screens
9. capture screenshots
10. compare screen-by-screen against the approved repo images
11. fix remaining measurable differences
12. repeat until PASS

## Physical device / acceptance rule
Do NOT say "done", "perfect", "identical", or "visual parity PASS" just because the source looks correct.

Final acceptance requires all of these after the latest visual changes:
- local TypeScript/typecheck PASS
- local Android APK build PASS
- install on physical Pixel PASS
- actual app opens and renders real XDrive data
- screenshot-by-screenshot comparison against both approved image boards PASS
- no regression to XDrive auth/compliance/POD/security logic

## Windows / PowerShell operating rules
If Desktop Commander is unavailable, use the user’s PowerShell and follow these rules strictly:
- give exactly ONE PowerShell block/step at a time
- wait for the result before giving the next block
- never include `exit`
- if prompt shows `>>`, tell the user `Ctrl+C` first
- no destructive Git: no `git reset --hard`, no `git clean`, no broad checkout/revert
- preserve unrelated local work and untracked files
- inspect `git status --short` before any risky sync/update
- do not assume the local XDrive path
- `D:\LoadifyMarket-Release-v4` belongs to Loadify Market and is the WRONG repository for this task

## Desktop Commander
The previous chat checked Desktop Commander. It was discoverable/installed but execution was disabled in that chat.

In the next chat, check again once. If it is active, prefer safe direct inspection and local commands. If it is still unavailable, immediately continue through PowerShell one step at a time. Do not waste time repeatedly diagnosing why the tool is disabled.

## Exact next-chat opening procedure
The next agent must do the following in this order:

1. Read this file completely.
2. Open both approved visual SVG image boards.
3. Open `apps/xdrive-driver-mobile-rebuild/CONTINUE-HERE.md`.
4. Inspect live PR #523 and confirm branch/head before editing anything.
5. Check whether any new commit appeared after this checkpoint; never overwrite later work.
6. Inspect only the remaining visible gaps in Booking Detail / Stops / Status / POD / Quote Detail / spacing / typography / buttons.
7. Make only demonstrable parity fixes inside the allowed mobile scope.
8. Do not use GitHub Actions.
9. When source parity is stable, move directly to local PowerShell build and Pixel validation.
10. Final PASS only after real device screenshots match the approved images.

## Do not drift
Do NOT:
- start another project
- move back to Loadify Market
- redesign XDrive from scratch
- change XDrive web/backend merely to make screenshots look right
- switch canonical implementation to Kotlin
- fabricate Courier Exchange data
- weaken permission/compliance/POD requirements
- merge PR #523 before physical-device acceptance

The user’s target remains simple and strict: **XDrive Driver must display every corresponding function in the approved screen style, using real XDrive data and real XDrive rules.**
