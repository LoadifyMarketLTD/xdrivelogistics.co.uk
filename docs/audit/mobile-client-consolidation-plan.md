# XDrive Driver client consolidation plan

Status: corrective architecture decision for PR #301.

## Confirmed duplicate driver clients

The repository currently contains two independent driver user interfaces:

1. `app/m/_components/DriverMobileAppVariant.tsx` rendered by `app/m/driver/page.tsx` — mobile web/PWA driver client.
2. `apps/driver-mobile` — Expo/React Native Android client.

Both contain overlapping authentication, jobs, lifecycle, quotes, POD, profile, documents, messages, notifications and operational logic. This duplication is not the desired final architecture.

## Canonical target

`apps/driver-mobile` is the single canonical driver application intended for Android/Google Play.

`/m` may remain only as a small launcher/download/fallback page. It must not remain a second operational driver application.

## Required consolidation sequence

1. Inventory every working feature in `DriverMobileAppVariant.tsx` and map it to the native app.
2. Reuse the shared backend/API contracts; do not copy database access or duplicate business rules into the native client.
3. Implement missing native parity using the existing native project, preserving working native behaviour.
4. Validate complete parity with authenticated end-to-end tests and Android runtime evidence.
5. After parity is proven, retire the operational `/m/driver` client and remove `DriverMobileAppVariant.tsx` plus routes/components used only by it.
6. Keep `/m` as a launcher/download/deep-link page only.

No production migration, deploy, merge or Play Store publication is authorised by this document.
