# XDrive Driver Visual Parity — Next Chat Handoff

Date: 2026-09-13
Repository: `LoadifyMarketLTD/xdrivelogistics.co.uk`
Primary PR: `#523` — `fix(driver): harden mobile preview functional flows`
Implementation branch: `fix/expo-driver-e2e-functional-20260909`
Implementation HEAD captured by this checkpoint: `7b8d597d8ff0d5ca8733c17eca2956bed61d43d0`
Checkpoint branch: `checkpoint/xdrive-visual-handoff-20260913`

## 1. READ THIS FIRST — DO NOT DEVIATE

This checkpoint exists so the next ChatGPT session continues the exact XDrive Driver task without re-discovering the project or drifting into another implementation.

The checkpoint branch is a READ-ONLY handoff/snapshot branch. Do not continue product development on it. All implementation changes belong on:

`fix/expo-driver-e2e-functional-20260909`

The approved visual references are committed in this checkpoint branch before these instructions, as requested:

- `docs/visual-references/xdrive-approved-bookings-board.svg`
- `docs/visual-references/xdrive-approved-quotes-board.svg`

These two boards are the visual acceptance baseline for the corresponding XDrive Driver functions. They are repo-native SVG mirrors of the approved boards from the conversation, preserving the required layout, hierarchy, colors, labels, and representative content. They are not a license to hard-code the Courier Exchange sample records.

## 2. PRODUCT GOAL

Make the XDrive Driver Android app display all corresponding functions using the same visual grammar and information hierarchy as the approved reference boards, while using REAL XDrive data and the existing XDrive security/auth/backend contracts.

The result must feel visually consistent with the reference product, but must remain XDrive:

- XDrive branding and routes.
- XDrive backend records.
- XDrive tenant/security/privacy rules.
- XDrive canonical lifecycle.
- No Courier Exchange credentials, data, IDs, or backend calls.
- No fabricated production records.

Visual parity is not considered PASS until a locally built APK is installed on the physical Pixel and actual XDrive screenshots are compared screen-by-screen with the approved reference boards.

## 3. CANONICAL MOBILE CODEBASE

Use the Expo / React Native rebuild only:

`apps/xdrive-driver-mobile-rebuild`

The inspected XDrive APK proved the current app lineage is Expo / React Native + Hermes. Do not switch the visual implementation to `android-native` Kotlin. The Kotlin code may be consulted only as a recovery/reference source for richer fields or previously recovered behavior.

Do not merge the two mobile implementations blindly.

## 4. APPROVED VISUAL SYSTEM

Keep this system consistent across every corresponding screen:

- Main dark navy: approximately `#292837`.
- Pale page background: approximately `#F2F3F7`.
- White rounded content cards.
- Active tab / quote emphasis: warm yellow, approximately `#FFE66A` / `#FFD200`.
- Route/action blue: approximately `#5199D6` / `#4D97D5`.
- Operational progression / success green: approximately `#65C653`.
- Muted gray copy/borders matching the reference boards.
- Inter font.
- Rounded segmented controls and large touch targets.

Do not drift back to the older global-green visual language. Green is for operational/status progression. Yellow is the primary quote/active-selection emphasis.

Bottom navigation must be exactly:

`Home / Alerts / Quotes / Bookings / More`

## 5. APPROVED FUNCTION / SCREEN MATRIX

### Bookings board

The app must support and visually match these corresponding functions:

1. Bookings list with `Current / Past 7 days / Past 14 days`.
2. Booking Summary with route, distance, load details, customer notes/instructions.
3. Stop detail modal with Time / Company / Address and Close action; show authorized optional contact data when available.
4. Status timeline with chronological lifecycle evidence and timestamps.
5. Ordered multi-stop view, including extra collections/deliveries.
6. Large green next-operational-action CTA.
7. Attachments section.
8. `Add Document` and `Add Image` evidence actions.
9. `View POD` only when a POD actually exists / is completed.
10. Status trail may include `Delivered (POD)` and `Invoice` when those events truly exist in XDrive data.

### Alerts / Quotes board

The app must support and visually match these corresponding functions:

1. `Inbox / Saved / Deleted` board.
2. Map action in the Alerts header.
3. Load cards showing real company/member code, vehicle, tags, route, timings, cargo/dimensions/weight when supplied, distance, notes, and yellow `Quote` CTA.
4. Saved and deleted state persistence.
5. Swipe-left delete/reveal behavior matching the red delete affordance in the approved board.
6. Quote detail with route, `View Route Map`, vehicle, distance, cargo/notes.
7. Customer/feedback/terms/phone/message panels only where real authorized XDrive data is available.
8. Submit quote form with GBP amount, extras, total, collect-within, vehicle, notes, and Submit Quote.
9. Completed booking card with `View POD` when POD is actually finalized.

## 6. IMPORTANT CURRENT IMPLEMENTATION STATE

At implementation HEAD `7b8d597d8ff0d5ca8733c17eca2956bed61d43d0`, substantial parity work is already present.

### `App.tsx`

Navigation has been normalized to:

`Home / Alerts / Quotes / Bookings / More`

- Alerts uses `LoadsScreen`.
- Quotes uses `QuotesScreen`.
- Bookings uses `BookingsScreen` from `DeliveriesScreen.tsx`.
- Bottom navigation is hidden while a detail/resource page is open.

### `src/screens/LoadsScreen.tsx`

Already present:

- Inbox / Saved / Deleted segmented control.
- AsyncStorage persistence per account for saved/deleted job IDs.
- Navy/yellow visual language.
- White cards.
- Blue 1/2 route markers.
- Company/member code.
- Posted time, vehicle, current-location context.
- Tags.
- Cargo/distance/notes.
- Yellow Quote CTA.

Known remaining gaps:

- The header map icon is currently visual only and is not a functional `Pressable`.
- Save/delete are currently overlay circular actions. The approved reference shows a real swipe-left card state exposing the red delete action. Implement the interaction without adding a new dependency if practical; React Native `PanResponder` is preferable to changing root dependencies.

### `src/screens/DeliveriesScreen.tsx`

Already present:

- Bookings title.
- `Current / Past 7 days / Past 14 days`.
- Real active/history filtering.
- Company/member code.
- Customer reference when available.
- Load ID.
- Completed/current chips.
- Route markers and correct final-stop number.
- Distance/time.
- Notes preview.
- Yellow `View POD` only when `job.status === 'delivered'` AND `job.podCompleted`.

Do not weaken this POD gating merely to match a screenshot.

### `src/components/RouteBlock.tsx`

Already updated to the approved route presentation:

- Blue marker 1.
- Vertical route line.
- Blue marker 2.
- Pickup and delivery places/timings.
- Functional blue `View Route Map` button.
- Opens Google Maps directions through `Linking` using the real XDrive pickup/delivery values.

### `src/screens/LoadDetailScreenV2.tsx`

Already present:

- Load ID header.
- XDrive company/member context.
- Route block with functional `View Route Map`.
- Vehicle, cargo, distance-to-pickup, quote-close time, POD requirement.
- Notes.
- Existing quote summary.
- Quote eligibility/compliance blocking.
- GBP base amount.
- Additional extras.
- Total.
- Collect-within choices.
- Vehicle display.
- Notes.
- Submit Quote.

The quote API contract is real XDrive logic and must remain authoritative.

Known remaining visual/function gap:

The approved reference board includes a customer context / feedback panel with items such as:

- Feedback over a recent period.
- All Feedback.
- Customer.
- Payment terms.
- Phone.
- Message.

DO NOT invent these values. First inspect the existing authorized mobile resource/job/quote payloads. Render only fields already provided safely to the driver. If the data is not available through the current authorized mobile contract, document the gap and ask before expanding backend scope. Do not casually edit backend/web routes in the visual phase.

### `src/screens/JobDetailScreenV2.tsx`

Already present:

- `Summary / Stops / Status` tabs.
- Summary route/distance/load details.
- Notes/instructions.
- Customer attachments.
- `Add Document`.
- `Add Image`.
- Staged POD evidence.
- `View POD` when completed.
- Ordered multi-drop stops.
- Stop detail modal.
- Optional telephone action.
- POD view modal.
- POD capture modal with recipient, images, documents, signature image, driver notes, submit/complete.

Critical wiring issue to fix early:

The Status tab currently calls the timeline with only `status={job.status}`.

`DeliveryTimeline` already accepts `auditTrail` and `podCompleted`, but those props are not currently passed from `JobDetailScreenV2`.

Pass the real job audit data into the timeline so timestamps, POD event, and invoice event can render when supported by actual XDrive audit data. Verify types before committing.

### `src/components/DeliveryTimeline.tsx`

Already supports these stages:

1. Accepted
2. On My Way to Collection
3. On Site (Collection)
4. Loaded
5. On My Way to Delivery
6. On Site (Delivery)
7. Delivered
8. Delivered (POD)
9. Invoice

It can read audit timestamps. Invoice should appear only when a real invoice audit event exists. Do not synthesize an invoice stage just to fill the UI.

### `src/components/ActionButton.tsx`

Latest captured implementation uses the approved operational green (`#65C653`), increased touch height, and larger label text.

## 7. REAL DATA / SECURITY RULES

The current visual phase is mobile-only unless a verified blocker proves otherwise.

Default denylist:

- `app/**` web/backend routes.
- `lib/**` shared backend logic.
- `android-native/**`.
- `supabase/migrations/**`.
- Production Supabase operations.
- Production deployments.
- Root dependency/lockfile changes unless explicitly justified.

Existing XDrive APIs are authoritative.

Do not:

- Copy Courier Exchange backend behavior by guessing.
- Hard-code the sample companies, addresses, load IDs, dates, money, or status timestamps seen in the reference screenshots.
- Relax compliance/quote eligibility/POD security rules for visual parity.
- Expose private fields that the current mobile API deliberately redacts.
- Change tenant boundaries.
- Change production data.

The existing POD backend requires evidence to be uploaded to XDrive storage and verifies storage paths. Keep that behavior.

## 8. COURIER EXCHANGE REFERENCE RULE

Courier Exchange is UX/functionality reference only.

The screenshots establish interaction and visual expectations such as:

- information hierarchy,
- card layout,
- stop presentation,
- status timeline,
- quote entry,
- POD/attachments affordances,
- saved/deleted interactions.

They are not the XDrive database schema.

If a reference screen shows data that the authorized XDrive mobile API does not provide, do not fabricate it. Record the gap first.

## 9. LOCAL VALIDATION — NO GITHUB ACTIONS

The user explicitly does NOT want GitHub Actions used because there are no CI credits.

Do not use GitHub Actions as the validation path.

Do not use EAS cloud build as the default validation path.

Use the user's Windows laptop + PowerShell + local Android build + ADB.

Local build helper already exists:

`apps/xdrive-driver-mobile-rebuild/build-local-apk.ps1`

It performs:

1. `npm ci` if `node_modules` is absent.
2. `npm run typecheck`.
3. `npx expo prebuild --platform android --no-install` unless `-SkipPrebuild` is supplied.
4. `android\gradlew.bat assembleDebug`.
5. Verifies `android\app\build\outputs\apk\debug\app-debug.apk`.
6. Prints SHA256.

Preview Android package:

`co.uk.xdrivelogistics.driver.preview`

This preview package is deliberately separate from production and can coexist with it.

## 10. NEXT CHAT — REQUIRED EXECUTION ORDER

The next agent must follow this order.

### Step A — Try Desktop Commander first

Check whether Remote Desktop Commander is available in the new chat.

If available:

- Use it directly for local repo inspection, PowerShell commands, local build, ADB, screenshots, and file checks.
- Do not make the user manually run commands that the connector can run safely.

If unavailable:

- Work with the user through PowerShell.
- Give exactly ONE PowerShell block/step at a time.
- Wait for the result before the next step.
- Never include `exit`.
- If PowerShell shows the continuation prompt `>>`, tell the user to press `Ctrl+C` before anything else.

### Step B — Locate the local XDrive repo safely

Do NOT assume it is in the Loadify repo path.

Find the real XDrive local working directory.

Before changing anything, inspect:

- `git status --short`
- current branch
- current HEAD
- remotes

Never overwrite/revert unrelated local work.

Never use destructive Git commands such as:

- `git reset --hard`
- `git clean`
- destructive checkout/restores over unrelated work

If there are local changes, preserve them and assess them before pulling/changing branch.

### Step C — Sync implementation branch

Implementation must continue on:

`fix/expo-driver-e2e-functional-20260909`

Checkpoint baseline implementation HEAD:

`7b8d597d8ff0d5ca8733c17eca2956bed61d43d0`

Do not develop on `checkpoint/xdrive-visual-handoff-20260913`.

### Step D — Fix remaining code gaps before device validation

Priority order:

1. Wire `job.auditTrail` and `job.podCompleted` into `DeliveryTimeline` in `JobDetailScreenV2`.
2. Make the Alerts header map action functional, using safe/authorized behavior.
3. Implement true/reference-like swipe delete/save interaction in Alerts without unnecessary dependencies.
4. Audit Quote Detail for authorized customer feedback/contact/terms fields and render only what is safely available.
5. Fine-tune spacing/font/button/card sizing against both approved repo reference boards.
6. Re-check stop modal, attachments, POD capture/view, quote form, and Bookings cards.

Use `[skip ci]` in Git commit messages for these visual-phase commits so we do not intentionally consume GitHub Actions.

### Step E — Local typecheck / APK build

Run local build only after the code audit above.

Use the existing PowerShell helper rather than manually reproducing every command unless debugging a failure.

Do not claim PASS merely because code looks correct in GitHub.

### Step F — Physical Pixel validation

After APK build succeeds:

1. `adb devices -l`
2. Identify the intended Pixel device.
3. Install/upgrade the preview package with `adb install -r` using the generated debug APK.
4. Verify `co.uk.xdrivelogistics.driver.preview` package/version state.
5. Launch the XDrive preview app.
6. Validate against real preview XDrive data.

Do not uninstall other user apps or wipe app/device state without explicit permission.

### Step G — Screenshot-by-screenshot acceptance

Capture actual Pixel screenshots for the corresponding functions and compare them against:

- `docs/visual-references/xdrive-approved-bookings-board.svg`
- `docs/visual-references/xdrive-approved-quotes-board.svg`

Check at minimum:

- navbar labels/order,
- navy/yellow/blue/green hierarchy,
- card radius/spacing,
- typography size/weight,
- tab geometry,
- route markers,
- notes blocks,
- status timeline,
- stop modal,
- multi-stop list,
- action CTA placement,
- attachments,
- POD,
- Alerts board,
- save/delete interaction,
- Quote detail,
- quote form,
- completed booking.

If something differs materially, fix it and rebuild locally.

## 11. PASS / FAIL RULE

Do not say "XDrive is identical", "done", "finished", "production ready", or "visual parity PASS" until all of the following are true for the latest implementation commit:

- Mobile TypeScript/typecheck passes locally.
- Android preview APK builds locally.
- APK installs on the intended Pixel.
- App launches successfully.
- Corresponding functional screens load using real XDrive data.
- Actual screenshots are compared with approved boards.
- Material visual differences are resolved or explicitly accepted by the user.
- Core actions remain functional (quote, navigation, status progression, documents/images/POD as applicable).

GitHub Actions status is NOT part of this acceptance because the user has explicitly disabled that validation path due to credits.

## 12. PRODUCTION SAFETY

Current phase:

- Production database migration: NO.
- Production data modification: NO.
- Production deployment: NO.
- Merge PR #523: NOT YET.

Keep PR #523 Draft until local build/device/screenshot acceptance is complete.

## 13. HISTORICAL SOURCE CONTEXT

Three source archives were previously inspected:

### XDRIVE_VISUAL_RECOVERY_CLEAN.zip

Richest XDrive source/recovery archive. Contains web/API code, Expo driver code, Kotlin recovery project, screenshots/XML, and functional audits.

### xdrive-apk-inspect.zip

Unpacked XDrive preview APK. Confirmed Expo / React Native + Hermes. The packaged app was a preview/side-by-side build, not the production application identity.

### Courier-Exchange-EXTRACTED-20260906-024305.zip

Courier Exchange split APK extraction used for technical UX/reference analysis. Package: `com.transportexchangegroup.cx4a`. It is not an XDrive data source.

Do not repeat the archive analysis unless a new specific question requires it.

## 14. USER WORKING STYLE — FOLLOW IT

The user wants progress, not repeated planning.

- Be concise when reporting routine progress.
- Do not ask unnecessary clarification questions.
- If a safe next step is clear, do it.
- Tell the user if a real blocker appears.
- Never claim a tool action succeeded unless verified.
- Never claim build/device validation if it has not actually been run.
- One PowerShell block at a time when manual local commands are necessary.
- Preserve local work.
- Keep XDrive separate from Loadify Market.

## 15. FIRST ACTION FOR THE NEXT AGENT

Read this file and both approved visual reference SVGs, then inspect the current implementation branch HEAD and the four highest-priority gaps listed in Section 10 Step D.

Do not start from a generic redesign plan. Continue the existing implementation.

The immediate code-level starting point is the `DeliveryTimeline` wiring in `JobDetailScreenV2`, then Alerts map/swipe, then authorized Quote Detail customer context, then local PowerShell build and Pixel comparison.
