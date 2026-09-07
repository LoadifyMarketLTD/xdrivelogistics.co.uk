# XDrive Mobile Rebuild Checkpoint — 2026-09-07 17:38 BST

## Canonical workstream
- Repo: `LoadifyMarketLTD/xdrivelogistics.co.uk`
- Branch: `driver/mobile-master-rebuild-20260907`
- Source app: `apps/xdrive-driver-mobile-rebuild`
- Build mirror only: `C:\Users\Danny\xm`
- Visual authority: XDrive Mobile Master Build Pack / Delivery Information Mobile App UI Kit only.

## Visual lock
- ZERO visual reuse from the uninstalled legacy XDrive preview.
- ZERO Courier Exchange visual/code asset reuse.
- Legacy XDrive reuse is limited to non-visual technical contracts only.
- New screens must extend the Delivery Information / Detail / Order design language.

## Current app state
- Android package: `co.uk.xdrivelogistics.driver.preview`
- Version: `1.0.0`, versionCode `1`
- Canonical package `co.uk.xdrivelogistics.driver` remains installed and untouched.
- New preview is installed on the connected Pixel 10 Pro XL.
- Standalone Release preview boots without Metro and reaches the Login screen.

## Validation completed
- TypeScript: PASS (`tsc --noEmit`).
- Expo Android prebuild: PASS.
- Release JS bundle: PASS, 734 modules / 37 assets.
- Release Android build: `BUILD SUCCESSFUL`.
- `expo-asset` added explicitly and registered in Expo plugins.
- `newArchEnabled=false` for the stable preview build path.
- Bootstrap has a fail-safe auth timeout so the app cannot remain on the loader indefinitely.

## Current Release preview artifact
- APK: `C:\Users\Danny\xm\android\app\build\outputs\apk\release\app-release.apk`
- Size: 61,127,654 bytes.
- SHA-256: `D254F19CB9068B2C0202DF013035908970AC1187A8B740FDCDDF71F67878A66F`
- This is a preview/test Release artifact, not the final Play Store signing artifact.

## Next continuation order
1. Authenticate with the real XDrive account without hardcoding credentials.
2. Verify Home / Deliveries / Wallet / Profile using real backend data.
3. Verify recovered profile and vehicle data are represented from backend facts.
4. Validate job detail and status actions against server-authoritative endpoints.
5. Continue the remaining MASTER Build Pack screens/functions in the locked visual language.
6. Run mobile QA, permissions, offline/POD gates, then prepare Play Store AAB/signing separately.
