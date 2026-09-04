# Android Native <- Expo Preview: useful parity audit

Date: 2026-09-04

## Canonical ownership

- Production Android application: `android-native/`
- Production package: `co.uk.xdrivelogistics.driver`
- Expo/React Native application: `apps/driver-mobile/`
- Expo package: `co.uk.xdrivelogistics.driver.preview`
- Expo is a reference source only. It must not become a second production client.

## Porting rule

Port useful behaviour, not implementation. Kotlin/Jetpack Compose remains the owner. Do not copy Expo security/session/storage assumptions over the stronger native contracts. Do not port shells/placeholders whose backend lifecycle is incomplete.

## Current parity decisions

| Capability observed in Expo preview | Native status on current main | Decision |
|---|---|---|
| Driver login/session | Present, with encrypted session/device binding | KEEP NATIVE |
| Live loads/search/filtering | Present, including Live/Pinned/Hidden and delivery-zone distance filtering | KEEP NATIVE |
| Quote entry/history | Present | KEEP NATIVE |
| Job lifecycle/status progression | Present | KEEP NATIVE |
| POD document/photo/recipient confirmation | Present | KEEP NATIVE |
| Push/deep-link foundation | Present in native FCM/deep-link architecture | KEEP NATIVE; physical-device acceptance remains separate |
| Offline status recovery | Present via pending status store/scheduler | KEEP NATIVE |
| Offline POD recovery | Present via pending POD store/scheduler | KEEP NATIVE |
| Offline quote recovery | Present via pending quote store/scheduler | KEEP NATIVE |
| Bookings/current/history | Present as `BookingsScreen` | KEEP NATIVE |
| Journey / return journey | Present in native Profile and canonical backend | KEEP NATIVE |
| Payment/invoice summary | Present as `SmartPayScreen` / XDrive Pay data | KEEP NATIVE |
| Alerts/notifications screen | Present with All/Unread/Important and mark-read/delete | KEEP NATIVE |
| Unread notification indicator in persistent navigation/header | Expo computes unread count; native has authoritative `readAt` data but does not surface the count in bottom navigation | PORT — useful, low risk |
| Who's Nearby discoverability | Expo reference exposes Who's Nearby; native already fetches `nearbyDrivers` but current UI does not render them | PORT — useful; render privacy-safe identity/vehicle/recency only, not raw coordinates |
| Local-only notification/settings toggles | Expo shell had local state but incomplete persistence/API sync | DO NOT PORT as fake functionality |
| Support/What's New shell entries without completed route wiring | Reference shell only | DO NOT PORT until real routes/contracts are confirmed |
| Quote withdrawal | Native UI still lacks withdrawal; this is a platform gap, not a safe Expo copy because a driver-scoped mutation contract must be verified first | HOLD for server-authority audit |
| In-app map/polyline | Not proven as a complete Expo production contract | DO NOT PORT blindly |

## First implementation pass

1. Surface authoritative unread notification count from `DriverUiState.notifications` in native persistent navigation.
2. Surface already-fetched `nearbyDrivers` in the native driver experience without exposing raw latitude/longitude.
3. Add native unit/contract coverage for both additions.
4. Re-run the Android-native build/test gate available in CI.
5. Only after parity extraction is complete, quarantine/remove `apps/driver-mobile/` and correct stale root documentation/scripts that still point mobile development at Expo.

## Non-goals

- No Play Store submission in this change.
- No production signing changes.
- No Supabase production migration.
- No `/super-admin` visual changes.
- No wholesale copy of Expo source into Kotlin.
