# XDRIVE DRIVER / CX CONTINUITY CHECKPOINT — 2026-09-07 01:10Z

## Purpose
This is the canonical continuation checkpoint for the XDrive Driver mobile app vs Courier Exchange (CX) workstream.
Do not restart the audit from zero. Continue from this file.

## Repository / branch / PR
- Repository: `LoadifyMarketLTD/xdrivelogistics.co.uk`
- Working branch: `driver/phone-golden-20260718-modernization`
- PR: `#510 — Driver phone GOLDEN recovery and modernization`
- PR state: OPEN / DRAFT / NOT MERGED
- Base: `main`
- Parent HEAD before this checkpoint: `c9531ee6f8f1ef30fd03a234044981abff59b18c`
- Parent commit title: `feat(driver): redesign home as XDrive road ops`
- Checkpoint commit: the commit containing this file on the PR #510 branch.

## Non-negotiable safety rules
- Do NOT modify `main` directly.
- Do NOT merge PR #510 until final physical authenticated E2E gates pass.
- Do NOT use GitHub Actions for validation.
- Do NOT deploy Netlify Production.
- Do NOT run Production DB migrations.
- Do NOT import PR #503.
- Do NOT use `android-native` as a base.
- Do NOT copy CX pixel-for-pixel or recreate its visual identity.
- Preserve XDrive visual identity and functional differentiation.
## Phone / APK safety
- Physical device: Pixel 10 Pro XL.
- ADB serial: `57311FDCQ00BGS`.
- GOLDEN package: `co.uk.xdrivelogistics.driver`.
- Preview package: `co.uk.xdrivelogistics.driver.preview`.
- Preview label: `XDrive Driver Preview`.
- Canonical GOLDEN SHA-256: `81f0e825a5899c90c34cd6a34af8104ce37c8be42ca4b3dcf9a7b978ee916f74`.
- Never uninstall, overwrite, resign, or modify GOLDEN.
- Side-by-side testing must target only `.preview`.

## Checkout safety
- Isolated verification checkout: `C:\Users\Danny\xg-preview-gate`.
- It was clean and detached at `c9531ee6...` before writing this checkpoint.
- Remote PR branch was also exactly `c9531ee6...` before writing this checkpoint.
- Original checkout: `C:\Users\Danny\xg`.
- Do NOT reset/stash/restore/remove anything in the original checkout.
- Original checkout has its own local state and must remain untouched.
- The original local branch commit `bffee2bb...` is an ancestor of remote `c9531ee6...`; remote PR #510 is newer.

## Saved XDrive Home redesign
The new Preview Home is already committed in PR #510 and physically proved on the Pixel.
Main source: `apps/xdrive-driver-phone-golden/src/app/DriverMobileAppV3.tsx`.
Confirmed visible markers:
- `DISPATCH NOW`
- `Operational desk`
- `MARKET ACCESS`
- `Open Live Load Board`
- `OPEN OFFERS`
- `WORK LOG`
- `DRIVER AVAILABILITY`
- `Change work state`
## Physical Home gate already passed
Evidence directory from the successful side-by-side run:
`C:\Users\Danny\Desktop\xdrive-home-gate-20260907-012729`

Observed in the earlier captured Preview screenshot:
- New XDrive Road Ops Home rendered correctly.
- UIAutomator markers for `Operational desk`, `Open Live Load Board`, and `Change work state` were present.
- GOLDEN hash before and after Preview install remained the canonical hash above.
- Therefore the Home differentiation itself is physically proven on Preview.

## IMPORTANT correction: vehicle / live jobs
An earlier ADB screenshot caught the Preview showing `Vehicle not assigned` and `0 LIVE`.
The user then confirmed that on the currently displayed XDrive app the assigned vehicle and six jobs were visible.
Therefore:
- `Vehicle not assigned` is NOT a confirmed defect.
- `0 LIVE` is NOT a confirmed defect.
- Do NOT "fix" vehicle assignment or live-load count based only on that earlier screenshot.
- Treat that screenshot as a transient/loading-state observation unless fresh physical evidence proves otherwise.
- Before declaring any data defect, wait for auth/refresh completion and verify the actual current screen.

Known expected real data from the user:
- active driver account
- assigned real vehicle `KM57CXL`
- six eligible marketplace jobs
- real offers/bids
- Profile / Vehicle / Documents backend data available
## Preview build caveat still unresolved
The prepared script `C:\Users\Danny\Desktop\xdrive_home_rebuild_install.ps1` successfully reached a Gradle build after setting the Android SDK path, but its APK identity validator has an array `-notmatch` bug.
Manual `aapt dump badging` proved the APK package/label were correct.

A later inspection found the generated JS bundle contained the Production API URL and not the PR #510 Preview URL, consistent with Gradle having treated the bundle task as up-to-date.
A clean rebuild with explicit Preview bundle verification was started, then immediately terminated when the user said STOP.
Do NOT resume that clean rebuild automatically.
If rebuilding later, first verify:
- target is only `.preview`
- expected PR #510 API base is embedded in the new bundle
- GOLDEN hash is checked before and after
- installed Preview is physically verified

This is a build-gate concern, not proof that the current live jobs/vehicle data are broken.

## Active entrypoint separation
`apps/xdrive-driver-phone-golden/App.tsx` explicitly loads:
- `DriverMobileAppV3` when `sideBySidePreview === true`
- legacy `DriverMobileApp` otherwise
This separation is intentional. Do not accidentally move V3 Preview behavior into GOLDEN during comparison work.

## Public marketplace location requirement
Available jobs should expose public route locations as `TOWN, OUTCODE`, e.g. `BLACKBURN, BB1` / `NOTTINGHAM, NG2`.
Do not replace that with vague `Approx. area` wording when town/outcode can be derived.
Street-level/private contact details remain protected until award/allocation.
## Functionality already present in XDrive V3
Do not reimplement these merely because CX has equivalents:
- Live Load Board with Available / Starred / Dismissed feeds.
- Star / Dismiss / Restore actions.
- Make offer flow and active-offer blocking.
- Offers buckets and edit/retract/open won work order behavior.
- History as a chronological work log without CX-style date buckets.
- Full work order overview with commercial references.
- Requested and allocated vehicle data.
- Cargo, dimensions, weight, pallets, requirements, special instructions.
- Multi-stop route rendering in server sequence.
- Per-stop company/contact/telephone/site notes when revealed.
- External navigation per stop and full driving route.
- Server-confirmed lifecycle/progress timeline.
- POD receiver name and electronic signature.
- Camera/gallery evidence.
- Signed document/PDF upload.
- `MAX_POD_DOCUMENTS = 10`.
- POD completed/evidence summary.
- Offline sync queue/retry.
- Profile, Vehicle, Documents, Earnings, Work State and Support utility screens.

## Legacy-only / not yet clearly exposed in V3
Read-only source comparison indicated some richer legacy functions still live mainly in `DriverMobileApp.tsx`, including Search, Alerts, Nearby/Directory-style utilities and some utility screens.
Do NOT blindly port legacy UI. Recover only missing functionality, redesigned in XDrive V3 language/architecture after confirming a real gap.
## CX audit completed so far — read-only
CX Android package: `com.transportexchangegroup.cx4a`.
No CX data-changing action was intentionally executed.
Only navigation/viewing was used after foreground verification.

### CX Home
Confirmed mobile Home contains:
- vehicle identity/status area
- Tracking
- Update Your Status
- Search
- Who's Nearby
- Journeys
- bottom nav: Home / Alerts / Quotes / Bookings / More
- What's New content references calendar, camera improvements and integrated navigation.

### CX Alerts
Confirmed tabs:
- Inbox
- Saved
- Deleted
`Saved` empty-state observed.
`Deleted` showed real historical cards with route, vehicle, status/badges, timing, rate and notes.
Do not infer XDrive must copy the presentation; only preserve equivalent useful workflow where appropriate.

### CX Quotes
Confirmed mobile tabs:
- Submitted
- Unsuccessful
`Unsuccessful` preserves route, vehicle, notes, quoted amount and outcome.
### CX Bookings / Diary
Confirmed mobile booking-range controls:
- Current
- Past 7 days
- Past 14 days
- when moving further back, Past 28 days becomes available
Completed booking cards show route, timings, distance/ETA, notes and `View POD`.

CX web Diary additionally confirmed status filters:
- All
- Unallocated
- Allocated
- In Progress
- Completed
- Cancelled
- Expired
- Awaiting Feedback
- Recent Feedback

A completed CX web booking exposed:
- booked-by company/contact
- agreed rate
- distance/weight/packaging/dimensions
- requested vehicle
- payment terms / POD requirement
- load notes
- lifecycle timestamps
- POD / Order / Notes / History / Documents / View invoice

### CX Loads / Quotes / Directory on web
Loads supports list and Freight Radar map views, quick search, posted-within filter and public `TOWN, OUTCODE` routes.
Quotes web states include Received / Archived / Submitted / Unsuccessful.
Directory exposes companies/drivers, location, delivery/payment ratings, contact/chat and booking actions.
## Next continuation order
Resume from here, without redoing completed checks:
1. Re-verify CX is actually foreground (`topResumedActivity` + fresh UI dump together).
2. Continue a completed CX booking in read-only mode.
3. Inspect Summary / Stops / Status / View POD and any non-mutating detail variants.
4. Inspect an active booking if one exists, without changing status.
5. Inspect `More` and its sub-screens.
6. Inspect Search in mobile CX.
7. Inspect Who's Nearby in mobile CX.
8. Inspect Journeys / return-journey behavior.
9. Inspect Alerts conditional states and any safe swipe affordances without executing Save/Delete unless using disposable test data.
10. Inspect invoice/details/history/document views read-only where available.
11. Compare every confirmed CX capability against V3 source/runtime.
12. Implement only real functional gaps in V3, preserving XDrive design.
13. After each coherent change: typecheck/lint/local validation, commit to PR #510 branch, then side-by-side Preview physical verification.
14. Keep PR #510 DRAFT / NOT MERGED until final gate.

## Phone control lesson from this session
At one point an old UI dump looked like CX while Android foreground was still Loadify Market.
A navigation tap therefore landed in Loadify.
No data was changed, but from now on ALWAYS verify both:
- `dumpsys activity activities` shows `com.transportexchangegroup.cx4a/.MainActivity` as top resumed
- a fresh UI dump from the same moment contains CX navigation
before sending any coordinate tap.
Never trust a stale UI dump.
## Cross-workstream isolation
- This checkpoint is ONLY for XDrive Driver / CX.
- Do not touch Loadify Market from this workstream.
- Other agents/processes may be working on Loadify in parallel.
- Do not kill unrelated blocked terminal sessions or browser workstreams just because they are present.

## Current stopping point
The current chat developed an `error in message stream`, so the user requested a repository checkpoint and a clean restart in a new chat.
At the stopping point the user stated that CX is physically present on the phone display.
No further phone taps should be issued from this old chat.

## Exact continuation instruction for next chat
Read this checkpoint first and continue from `## Next continuation order`.
Do NOT restart the audit.
Do NOT reinterpret the transient `Vehicle not assigned / 0 LIVE` screenshot as a confirmed defect.
Do NOT rebuild or reinstall Preview before checking current state and the unresolved bundle-cache caveat.
Do NOT modify GOLDEN.
Do NOT merge PR #510.

## Required truth standard
- No PASS without physical evidence when the gate requires device proof.
- No claim that an APK is new merely because source is new.
- No claim that data is missing merely because a loading/transient screenshot showed empty state.
- Before every write, verify repository, branch, HEAD and intended target.
- Keep functional parity goals separate from CX visual identity; copy workflows, not protected presentation.
