# XDrive Driver autonomous rebuild checkpoint — 2026-09-06

## Safety boundary

- Canonical phone GOLDEN remains package `co.uk.xdrivelogistics.driver` and must not be uninstalled, overwritten or replaced during this workstream.
- Rebuilt candidate is side-by-side Preview only: `co.uk.xdrivelogistics.driver.preview` / `XDrive Driver Preview`.
- PR #510 remains DRAFT / NOT MERGED.
- No GitHub Actions validation is used for this gate.
- No Production database migration and no Production deployment are permitted from this workstream before the physical-device gate.

## Product direction

Courier Exchange is a functional/UX benchmark only. XDrive rebuilds the useful product architecture using XDrive-owned code, API contracts, data and branding. Do not copy Courier Exchange proprietary source, logo, icon set or trade dress.

Preview target is light-first XDrive: white/light-grey surfaces, navy/royal-blue navigation/actions and sparse orange accent. Fixed top chrome and fixed bottom navigation must remain visually stationary while the bounded screen body scrolls.

## Implemented on isolated branch

1. `DriverMobileAppV2.tsx` contains rebuilt Preview workspace structure: Home, Live Loads/Alerts, Quotes, Bookings, More, load detail, quote form, booking Summary/Stops/Status, lifecycle action, POD, offline queue and utility views.
2. `App.tsx` loads V2 only when `sideBySidePreview === true`; non-preview builds keep the recovered GOLDEN workspace source path.
3. Preview package remains `.preview`; Preview appearance is forced light while non-preview keeps the recovered automatic appearance.
4. SecureStore persistence is chunked below the Android SecureStore warning threshold for long Supabase session payloads.
5. Live Loads now use the device-bound `apiRequest` path so installation identity headers are applied.
6. Already-quoted loads remain on the board and are marked non-quotable instead of being removed; this preserves quote edit/open navigation.
7. Mobile bid API on this branch has canonical GET/POST plus authenticated PATCH/DELETE for submitted quote edit/withdrawal. Withdrawal changes status to `withdrawn`; it does not delete commercial history.
8. Resources requests hydrate personal quote history from the dedicated device-bound bid API because the canonical resources endpoint intentionally returns an empty compatibility quotes array.
9. Booking/job payloads normalize historical/canonical lifecycle aliases to the mobile presentation state union.
10. Existing server booking contracts already provide persistent multi-stop data, operational instructions, signed attachments, POD presentation and evidence-gated lifecycle transitions.

## Static contract tests added

- `__tests__/driverPhoneGoldenPreviewIsolation.test.ts`
- `__tests__/driverMobileBidMutationContract.test.ts`
- `__tests__/driverPhoneGoldenLiveLoadsQuoteState.test.ts`

These tests have been added as source contracts only. They have not been executed through GitHub Actions.

## Known gates still open

- Run local TypeScript validation against the actual app dependency tree.
- Remove/verify the login ghost/double-layer appearance on the physical Pixel; current V2 login still has a deliberately overlapping hero/card layout and must not be declared accepted before visual confirmation.
- Complete native location publishing integration against existing `POST /api/driver/location` contract without introducing a Production migration.
- Complete notification/deep-link and messaging behavior using verified XDrive contracts only.
- Validate quote submit/edit/withdraw against a branch/Deploy Preview backend that includes the new PATCH/DELETE route; do not point those mutation tests at an API version that lacks the branch contract.
- Build Android Preview locally, verify package identity with `aapt`, install/update `.preview` only, and prove the canonical GOLDEN package remains unchanged before and after.
- Perform authenticated physical-device E2E: login, Live Loads, quote flow, booking, lifecycle, multi-stop, pickup evidence, POD, offline replay, location/tracking, alerts/deep links.

## Release rule

No replacement/Production PASS may be declared until the side-by-side Preview passes the relevant physical-device E2E gates and the user accepts the visual result.
