# XDrive Driver Mobile (React Native + Expo)

Native Android application for drivers.

## Stack

- React Native
- Expo SDK 57
- TypeScript
- Expo Location
- Expo Document Picker
- Expo Secure Store

## Product Boundary

This app is independent from the Next.js web UI.

- Web platform: admin/customer/dispatcher portals
- Mobile app: native Android driver operations

## Implemented Driver Flows

- Supabase email/password login
- Session persistence in secure storage
- Load driver profile and assigned jobs
- Full status transition actions:
  - on_my_way
  - on_site_pickup
  - loaded
  - in_transit
  - on_site_delivery
  - delivered (requires POD evidence)
- Quick note dispatch to API
- Current location publish to API
- POD upload via native file picker to Supabase Storage
- Driver documents listing
- Driver preferences load/save via auth metadata
- Password update flow via driver API

## Environment

Copy `.env.example` to `.env` and fill values.

## Local run

```bash
npm install
npm run start
```

## Android native build (local machine)

```bash
npm run prebuild
npm run android:native
```

## EAS cloud build outputs

APK (internal/preview):

```bash
eas build --platform android --profile preview
```

AAB (production):

```bash
eas build --platform android --profile production
```

## Functional prelive checks

```bash
npm run typecheck
npm run doctor
```

Then validate in app:

1. Login
2. Refresh jobs
3. Select job and move through statuses
4. Upload POD
5. Mark delivered
6. Send quick note
7. Publish location
8. Save settings and update password
