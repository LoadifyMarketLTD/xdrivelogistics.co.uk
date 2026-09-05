# XDrive Driver — Phone Golden Provenance

This directory is the canonical source line for the XDrive Driver application extracted from the physical phone and verified on 5 September 2026.

## Canonical binary identity

- Package: `co.uk.xdrivelogistics.driver`
- Version: `1.0.0`
- Version code: `1`
- Phone-extracted APK: `XDrive-Driver-INSTALLED-base.apk`
- Size: `64,396,350` bytes
- SHA-256: `81f0e825a5899c90c34cd6a34af8104ce37c8be42ca4b3dcf9a7b978ee916f74`
- Historical phone/build reference: 18 July 2026, 15:37

## Recovered source provenance

The source tree in this directory was recovered byte-for-byte at Git object level from the historical `apps/driver-mobile` subtree at commit:

`37483a6743f5ee8e52354d24efaae4dd1344b080`

The recovered UI includes the phone-matching login identity:

- `BUILT FOR THE ROAD`
- `Move with confidence.`
- `Live loads, clear updates and every delivery step in one place.`
- `UK-wide driver network`

## Isolation rules

1. This directory is the only Driver application source to modernize on this workstream.
2. Do **not** import or restore the deleted root `android-native` implementation.
3. Do **not** re-create the deleted path `apps/driver-mobile` as an active application.
4. PR #503 is archived historical work and is **not** an implementation base.
5. Courier Exchange is a functional/UX benchmark only. Do not copy its logo, exact colour system, icon set, branded badges, or trade dress.
6. Preserve XDrive identity and the phone app's established visual character while improving functionality and UX.
7. Do not replace the installed phone application until a new candidate has passed physical-device validation.

## Modernization gate order

1. Authentication/configuration and session integrity.
2. Driver jobs / marketplace / quotes / bookings contracts.
3. Status lifecycle and multi-stop execution.
4. POD/evidence durability and server compatibility.
5. Offline queue isolation, FIFO replay, idempotency and recovery.
6. GPS/tracking, availability, maps/navigation and ETA.
7. Push alerts, messaging and deep links.
8. CX-level UX architecture using XDrive visual identity.
9. Physical-device E2E before any replacement of the golden phone APK.
