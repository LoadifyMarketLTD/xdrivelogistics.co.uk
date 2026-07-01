# XDrive Driver Mobile App

Expo React Native app for XDrive drivers.  
Monorepo path: `apps/driver-mobile`  
Backend APIs: `app/api/driver/mobile/`

This is a **native mobile deliverable**, not a Next.js mobile route, not `/m`, and not a PWA.

## Architecture

- **Expo SDK 51** + React Native + TypeScript
- **Expo Router** (file-based navigation)
- **Supabase** auth (same project as web platform)
- **Backend is source of truth** — no business logic on the client
- **Offline queue** — status updates are saved locally and synced on reconnect

## MVP Screens

| Screen | Route | Description |
|--------|-------|-------------|
| Login | `/(auth)/login` | Email/password via Supabase |
| Active Job | `/(app)/active-job` | Default home if job in progress |
| My Jobs | `/(app)/my-jobs` | Tabbed list: Active / Upcoming / Completed |
| Job Detail | `/(app)/job/[id]` | Full job info, contacts, timeline |
| Execution Flow | `/(app)/job/[id]/execution` | One-action-at-a-time status advancement |
| POD Capture | `/(app)/job/[id]/pod` | Photo / signature / document capture |
| Notifications | `/(app)/notifications` | Critical alerts inbox |
| Profile | `/(app)/profile` | User info + logout |

## Driver Execution Flow

```
awarded
  └─ on-my-way-pickup   → allocated
       └─ arrived-pickup → allocated
            └─ loaded     → collected
                 └─ on-my-way-delivery → in_transit
                      └─ arrived-delivery → in_transit
                           └─ [POD captured if required]
                                └─ delivered
```

## Backend API Contract

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/driver/mobile/jobs?scope=active\|upcoming\|completed` | List jobs |
| GET | `/api/driver/mobile/jobs/:id` | Job detail + tracking events |
| POST | `/api/driver/mobile/jobs/:id/status` | Atomic status transition |
| POST | `/api/driver/mobile/jobs/:id/pod` | POD upload (multipart) |
| POST | `/api/driver/mobile/device-token` | Register push token |

## Setup

```bash
cd apps/driver-mobile
cp .env.example .env
# fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
npm install
npm start
```

## Native Build Targets

```bash
cd apps/driver-mobile
npm install
npm run build:android:apk
npm run build:android:aab
```

The Expo config already includes:
- Android package: `co.uk.xdrivelogistics.driver`
- iOS bundle ID: `co.uk.xdrivelogistics.driver`
- camera + photo permissions for POD capture
- EAS build profiles in `eas.json` for APK and AAB output

## Offline Mode

Status updates attempted offline are saved to `AsyncStorage` with state:
- **Pending sync** — waiting for connectivity
- **Syncing** — upload in progress
- **Synced** — confirmed by server
- **Failed, retry** — server returned an error

The sync is retried automatically on app resume or manual pull-to-refresh.
