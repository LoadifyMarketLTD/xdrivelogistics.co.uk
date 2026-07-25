# Mobile Application Identity Matrix

**Generated**: 2026-07-25  
**Scope**: Expo/React Native (`apps/driver-mobile`) vs Native Android (`android-native`)

---

## 1. Identity Summary

| Dimension | Expo Driver Mobile | Native Android |
|---|---|---|
| **Location** | `apps/driver-mobile/` | `android-native/` |
| **Framework** | Expo SDK 53 / React Native 0.79.6 | Kotlin / Jetpack Compose / Material 3 |
| **Package ID (Android)** | `co.uk.xdrivelogistics.driver.preview` | `co.uk.xdrivelogistics.driver` |
| **iOS Bundle ID** | `co.uk.xdrivelogistics.driver.preview` | N/A |
| **Version** | 1.1.0-preview.1 (versionCode 2) | 1.0.0 (versionCode 1) |
| **EAS Project ID** | c19b0bdf-567a-488e-b78f-d36b84f25c99 | N/A |
| **Distribution** | EAS internal (APK preview) + Play Store (AAB) | Manual Gradle build |
| **CI build support** | eas.json with preview and production profiles | Gradle only — no CI pipeline |
| **Status** | **CANONICAL** | **ACTIVE (migration baseline)** |

---

## 2. Backend Architecture

| Dimension | Expo Driver Mobile | Native Android |
|---|---|---|
| **Auth** | Bootstrap from `/api/driver/mobile/config` → Supabase anon key + URL; falls back to EAS secrets | Direct Supabase auth REST (`/auth/v1/token`) using BuildConfig.SUPABASE_URL + SUPABASE_ANON_KEY |
| **API base** | `https://www.xdrivelogistics.co.uk` (EXPO_PUBLIC_API_BASE_URL) | `https://www.xdrivelogistics.co.uk` (XDRIVE_BASE_URL from gradle.properties) |
| **Primary data path** | `/api/driver/mobile/resources` (single aggregated response) | Supabase REST direct + XDrive API endpoints |
| **Job actions** | POST `/api/driver/mobile/jobs/[id]/[action]` | POST `{baseUrl}/api/driver/mobile/jobs/{id}/{action}` |
| **Job lifecycle** | Server-enforced transitions via API | Server-enforced via same API endpoints |
| **Location tracking** | `expo-network` + POST `/api/driver/location` | Foreground service `TrackingService.kt` + POST `/api/driver/location` |
| **Document upload** | POST `/api/driver/mobile/resources` (base64) | FileProvider + Supabase Storage REST multipart |
| **Password change** | POST `/api/driver/password` | POST `/api/driver/password` |
| **Notes** | POST `/api/driver/jobs/[jobId]/notes` | POST `/api/driver/jobs/{jobId}/notes` |

---

## 3. Notification Model

| Dimension | Expo Driver Mobile | Native Android |
|---|---|---|
| **Table read** | `notification_events` via `/api/driver/mobile/resources` → `alerts[]` | `notifications` via direct Supabase REST `/rest/v1/notifications?user_id=eq.xxx` |
| **Status** | CANONICAL (reads active event outbox) | **BROKEN** (reads zombie table — no writers exist) |
| **Push model** | Expo Notifications (`expo-notifications`), token stored via `/api/driver/mobile/device-token` | FCM: **NOT IMPLEMENTED** (README lists as future work) |
| **Mark as read** | No mark-read endpoint wired | `markNotificationRead` PATCH to `/rest/v1/notifications` |
| **Delete** | No delete endpoint | `deleteNotification` DELETE from `/rest/v1/notifications` |
| **Deep link** | AsyncStorage timestamp-based unread badge count | `xdrive://job`, `xdrive://notification`, `xdrive://documents`, `xdrive://profile` |

**⚠️ LAUNCH BLOCKER**: Android reads `notifications` (no writers). All platform events go to `notification_events`. Android drivers see zero notifications.  
**FIX**: Migration `20260725160000_notification_events_to_notifications_bridge.sql` adds a trigger that bridges `notification_events` inserts → `notifications` inserts when `recipient_user_id IS NOT NULL`.

---

## 4. Job State Model

| State | Expo (via API) | Native Android (driverStatusKey mapping) |
|---|---|---|
| `allocated` | ✓ canonical | maps `assigned`, `accepted` → `allocated` |
| `on_my_way` | ✓ | ✓ |
| `on_site_pickup` | ✓ | maps `arrived_pickup` → `on_site_pickup` |
| `loaded` | ✓ | maps `collected` → `loaded` |
| `in_transit` | ✓ | maps `on_route_delivery`, `on_my_way_to_delivery` → `in_transit` |
| `on_site_delivery` | ✓ | maps `arrived_delivery` → `on_site_delivery` |
| `delivered` | ✓ | ✓ |
| `completed` | ✓ | ✓ |

**Assessment**: The mapping is display-side only (`driverStatusKey()` in `Models.kt`). Android sends canonical action names to the server. Status drift risk is LOW if the server transition API validates state.

---

## 5. POD Implementation

| Dimension | Expo Driver Mobile | Native Android |
|---|---|---|
| **Collection photo** | expo-image-picker → base64 → `/api/driver/mobile/resources` POST | Camera intent → FileProvider → Supabase Storage REST multipart to `pod-docs` bucket |
| **Delivery photos** | Same pattern | Same pattern |
| **Signature** | `react-native-signature-canvas` | Compose Canvas with touch path recording |
| **Recipient name** | Input field | Input field |
| **POD completeness guard** | Client-side check before transition | `hasDeliveryConfirmation()` in `DriverJob.kt` |
| **Storage bucket** | `pod-docs` | `pod-docs` |

---

## 6. Active vs Legacy vs Canonical Decision

| Application | Verdict | Rationale |
|---|---|---|
| **Expo Driver Mobile** | **CANONICAL** | Has EAS production build profile (AAB/Play Store), EAS project ID c19b0bdf, proper bundle ID, full mobile API integration, Expo push notifications, CI-ready structure |
| **Native Android** | **ACTIVE** | Has complete job lifecycle, GPS tracking, POD, and foreground service — but no CI pipeline, no FCM push, notification model is broken (reads wrong table), package ID lacks `.preview` suffix suggesting it may have been the original production build |

**Recommendation**: Do not archive either application yet.  
- Native Android requires: (1) FCM push implementation, (2) notification model fix (bridge migration enables this), (3) CI pipeline.  
- Expo mobile requires: verified production APK/AAB in drivers' hands.  
- Determine which APK is currently installed on active driver devices before archiving either application.

---

## 7. Comparison Matrices

### 7a. Driver Web vs Expo Driver Mobile

| Feature | Driver Web (/driver/) | Expo Mobile |
|---|---|---|
| Jobs list | ✓ supabase direct | ✓ via resources API |
| Bid submission | ✓ supabase direct | ✓ via /api/driver/mobile/bids |
| Job lifecycle transitions | ✗ (admin-only on web) | ✓ via /api/driver/mobile/jobs/[id]/[action] |
| POD upload | ✓ (admin/broker view) | ✓ full capture |
| GPS tracking | POST /api/driver/location | POST /api/driver/location |
| Notifications | NotificationBell → notification_events | resources API → notification_events |
| Finance/invoices | ✓ full finance workspace | ✓ via resources API |
| Documents | ✓ driver documents | ✓ via resources API |

### 7b. Driver Web vs Native Android

| Feature | Driver Web (/driver/) | Native Android |
|---|---|---|
| Jobs list | ✓ supabase direct | ✓ Supabase REST direct |
| Job transitions | ✗ | ✓ via XDrive API |
| Notifications | notification_events (NotificationBell) | notifications (BROKEN — empty table) |
| GPS tracking | POST /api/driver/location | TrackingService → POST /api/driver/location |
| POD | ✓ view | ✓ full capture |
| Push | Web push (not confirmed) | FCM — NOT IMPLEMENTED |

### 7c. Expo Mobile vs Native Android

| Feature | Expo Mobile | Native Android |
|---|---|---|
| Notification source | notification_events ✓ | notifications ✗ BROKEN |
| Push | expo-notifications | FCM — NOT IMPLEMENTED |
| GPS | expo-network | Foreground service (more robust) |
| Auth | /api/driver/mobile/config bootstrap | Direct Supabase auth REST |
| Offline resilience | AsyncStorage queue | PendingLocationStore (DataStore) |
| CI | EAS build profiles | Gradle only |
| Status | CANONICAL | ACTIVE/BROKEN notifications |

---

## 8. Can the two applications produce inconsistent data?

**YES — confirmed risk**:

1. **Notification state**: Android marks rows in `notifications` as read. Expo shows rows from `notification_events`. Same event appears as "read" in Android but "still pending" in web — after bridge trigger these are separate rows so mark-read in Android does not propagate to `notification_events.status`.

2. **POD storage path**: Both apps write to `pod-docs` bucket but with different path conventions. Android uses Supabase Storage multipart; Expo uses base64 via API. Path collision is unlikely (different UUID generation) but not provably impossible without storage policy review.

3. **Status aliases**: Android's `driverStatusKey()` maps legacy status names. If server sends a status that exists only in legacy form, Android may display it differently than Expo. Risk is LOW currently.

**Required action**: Verify which APK is on driver devices. Apply bridge migration. Add FCM to Android or confirm Expo is the only active driver app.
