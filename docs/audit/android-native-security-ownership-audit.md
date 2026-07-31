# Android Native — Security and Operational Ownership Audit

> **Audit type:** Read-only security audit — device, account, session, and job ownership  
> **PR:** #323 — Android native phone app: functional audit and corrective implementation  
> **Branch:** `audit/android-native-phone-app`  
> **Scope:** `android-native/` Kotlin app + Supabase migration contracts  
> **Produced:** 2026-07-31  
> **Status:** No code was changed. Audit only.

---

## Summary of critical findings before detail

| Severity | Finding |
|---|---|
| **HIGH** | No device registration, binding, or trusted-device mechanism exists |
| **HIGH** | Simultaneous login from multiple devices is unrestricted |
| **HIGH** | Logout does not revoke the server-side session |
| **MEDIUM** | Pickup authorization is based on authentication only; no verification code, PIN, or device binding |
| **MEDIUM** | POD PATCH directly to PostgREST returns 0 rows silently when RLS denies — no error thrown in `uploadPodDocument` |
| **LOW** | No logout-all-devices capability |

---

## Finding 1 — Simultaneous multi-device login

**Question:** Can the same driver account be authenticated simultaneously on multiple devices?

**Answer:** YES, unrestricted.

**Evidence:**

`SessionStore.kt` stores the session in `EncryptedSharedPreferences` on the local device:

```kotlin
// SessionStore.kt
private val prefs: SharedPreferences by lazy {
    EncryptedSharedPreferences.create(appContext, "xdrive_secure_session", ...)
}

suspend fun saveSession(session: DriverSession) {
    prefs.edit()
        .putString(Keys.accessToken, session.accessToken)
        .putString(Keys.refreshToken, session.refreshToken)
        ...
        .apply()
}
```

`ApiClient.login()` calls Supabase `/auth/v1/token?grant_type=password`. Supabase issues an independent `access_token` + `refresh_token` pair per login event. It does not invalidate tokens issued to other devices:

```kotlin
// ApiClient.kt:44–83
val request = Request.Builder()
    .url("${supabaseUrl.trimEnd('/')}/auth/v1/token?grant_type=password")
    .addHeader("apikey", supabaseAnonKey)
    ...
    .post(gson.toJson(body).toRequestBody(jsonMediaType))
    .build()
```

No server-side logout of prior devices is triggered. No device or session table is written to on login.

**Current behaviour:** Two devices with the same credentials can log in and both operate independently and concurrently.

**Business impact:** A compromised or shared credential set allows simultaneous operation of a driver account, with no visibility or control from the platform.

**Status:** MISSING

---

## Finding 2 — Device registration, trusted-device and device binding

**Question:** Is there any device registration, trusted-device, or device-binding mechanism?

**Answer:** NO. None exists anywhere in the codebase.

**Evidence — Android:**

No `device_id`, `android_id`, `ANDROID_ID`, `fcm_token`, `firebase`, `FirebaseMessaging`, `push_token`, `registration_id`, or `trusted_device` reference appears in any Kotlin source file:

```
grep result: no match in ApiClient.kt, DriverViewModel.kt, MainActivity.kt, TrackingService.kt, SessionStore.kt
```

The `DriverSession` data model contains only:

```kotlin
// Models.kt
data class DriverSession(
    val accessToken: String,
    val refreshToken: String,
    val userId: String,
    val email: String,
)
```

No `deviceId` field. No device token. No binding.

**Evidence — Supabase:**

No migration file creates a `device_registrations`, `trusted_devices`, `driver_devices`, or equivalent table. No migration policy scopes token validity to a device.

**Current behaviour:** Any device that receives valid credentials becomes immediately operational with no record on the server.

**Business impact:** Lost, stolen, or shared credentials grant unrestricted and undetectable access from any device.

**Status:** MISSING

---

## Finding 3 — Login from new device invalidates previous session

**Question:** Does login from a new device invalidate the previous session?

**Answer:** NO. Supabase issues a fresh token pair per login event. Prior sessions remain valid.

**Evidence:**

`ApiClient.login()` calls the Supabase password grant endpoint. No server-side sign-out or session revocation call is made before or after login:

```kotlin
// ApiClient.kt:44–83
// No pre-login sign-out call
val request = Request.Builder()
    .url("${supabaseUrl.trimEnd('/')}/auth/v1/token?grant_type=password")
    ...
val result = ... // new token pair issued; prior pair still valid
sessionStore.saveSession(session) // saved locally; prior device token not revoked
```

No call to `Supabase /auth/v1/logout` or equivalent appears anywhere in `ApiClient.kt`.

**Current behaviour:** Session on Device A remains valid after Device B logs in with the same credentials.

**Business impact:** No automatic protection against credential reuse on a second device.

**Status:** MISSING

---

## Finding 4 — User approval required before a new device becomes active

**Question:** Is any user approval required before a new device becomes active?

**Answer:** NO. Any device with valid credentials becomes immediately active on login.

**Evidence:**

`DriverViewModel.login()` → `ApiClient.login()` → `sessionStore.saveSession()` → session flow emits → `DriverAppShell` renders immediately. No out-of-band confirmation step:

```kotlin
// DriverViewModel.kt:92–108
fun login(email: String, password: String) {
    viewModelScope.launch {
        val result = api.login(email.trim(), password)
        result.onSuccess { session ->
            sessionStore.saveSession(session) // → immediate authentication
            _uiState.value = _uiState.value.copy(message = "Login successful.")
        }
    }
}
```

No email confirmation, OTP challenge, push notification approval, or device-enrolment flow exists.

**Current behaviour:** Successful credential entry → immediate driver session.

**Status:** MISSING

---

## Finding 5 — Validation of `driver_id`, `device_id`, `session_id` on operational actions

**Question:** Are `driver_id`, `device_id`, `session_id` or equivalent validated on operational actions?

### 5a. `driver_id` validation

**Authorization header — verified correct:**

The `supabaseRequest()` helper sends a valid ****** on every authenticated API call:

```kotlin
// ApiClient.kt:953–961
private fun supabaseRequest(pathAndQuery: String, accessToken: String): Request {
    return Request.Builder()
        .url("${supabaseUrl.trimEnd('/')}$pathAndQuery")
        .addHeader("apikey", supabaseAnonKey)
        .addHeader("Authorization", "******")
        .addHeader("Accept", "application/json")
        .build()
}
```

All 17 call sites in `ApiClient.kt` pass `session.accessToken` as the argument, so `auth.uid()` is correctly set to the authenticated user UUID on every Supabase PostgREST request.

**Server-side driver_id validation chain — active and reachable:**

The `driver_update_job_status_atomic` RPC checks `auth.uid()` against the driver record:

```sql
-- 20260723201400_driver_native_status_rpc.sql:36–40
DECLARE
  v_actor uuid := auth.uid();
...
IF v_actor IS NULL THEN
  RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
END IF;
```

And then validates:

```sql
-- lines 51–54
WHERE d.id = p_driver_id
  AND d.user_id = v_actor      -- binds client-supplied driver_id to authenticated user
  AND COALESCE(d.app_access, true) = true
  AND COALESCE(d.status::text, 'active') = 'active'
```

The `can_driver_access_job()` and `can_driver_update_job()` RLS helper functions similarly bind to `auth.uid()`:

```sql
-- 044_driver_runtime_rls_and_legacy_schema_guard.sql
SELECT EXISTS (
  SELECT 1
    FROM public.jobs j
    JOIN public.drivers d ON d.id = j.assigned_driver_id
   WHERE j.id = jid
     AND d.user_id = auth.uid()
     AND COALESCE(d.app_access, true) = true
     AND COALESCE(d.status, 'active') = 'active'
);
```

**`uploadPodDocument` and `confirmDeliveryRecipient` direct PATCH:**

```kotlin
// ApiClient.kt:891–892
.url("${supabaseUrl.trimEnd('/')}/rest/v1/jobs?id=eq.$encodedJobId&assigned_driver_id=eq.$encodedDriverId")
```

These send a PATCH directly to PostgREST. Under the `jobs_update_assigned_driver` policy, which evaluates `can_driver_update_job()` against the authenticated `auth.uid()`, only rows where the driver is the assigned driver are updated. However `uploadPodDocument` does not check the PATCH response row count — it only checks `!response.isSuccessful` (line 903). A 200 with 0 rows (e.g. when RLS denies) is treated as success (see Gap 10.5).

### 5b. `device_id` validation

NOT PRESENT anywhere. No device identifier is captured, stored, or validated on any operational action.

**Status:** MISSING

### 5c. `session_id` validation

NOT PRESENT. The `DriverSession` model does not include a `sessionId`. No session identifier is validated server-side.

**Status:** MISSING

**Overall Finding 5 status:** PARTIAL (`driver_id` is validated server-side via `auth.uid()` binding, which is correctly established by the ******; `device_id` and `session_id` are MISSING)

---

## Finding 6 — Preventing unauthorised operation of an awarded job after quote acceptance

**Question:** After a quote is accepted, what prevents another person from operating the same job using the same credentials on another phone?

**Answer:** The server-side guard `driver_update_job_status_atomic` validates `d.user_id = auth.uid()` AND `assigned_driver_id = p_driver_id`. Because the app sends a valid ****** on every request, `auth.uid()` is correctly set and the server guard is reachable. The operation is bound to the authenticated Supabase UID.

**Gap that remains:** No per-device or per-session binding. Two devices sharing the same credentials both receive valid JWTs for the same `auth.uid()`, so both devices pass the server guard identically after login.

**Full server-side guard chain:**

```sql
-- 20260723201400_driver_native_status_rpc.sql
v_actor := auth.uid();
-- Checks driver record: d.user_id = v_actor (binds to Supabase UID)
-- Checks job assignment: v_job.assigned_driver_id = p_driver_id (binds to driver row)
-- Checks company match: v_driver.company_id = v_job.awarded_carrier_company_id
```

**Gap:** No per-device or per-session binding. Two devices sharing the same account operate identically once authenticated.

**Status:** PARTIAL (server guard is reachable and correctly binds to user identity; no device-level binding)

---

## Finding 7 — Company reassignment of an awarded job

**Question:** Can a company legitimately reassign an awarded job to another driver?

**Answer:** YES, through the web admin interface, not through the Android app.

**Evidence:**

Migration `033_tighten_driver_rls.sql` creates the `jobs_all_member` policy for non-driver company members (owners, admins, operators):

```sql
-- 033_tighten_driver_rls.sql
CREATE POLICY "jobs_all_member" ON public.jobs
  FOR ALL
  USING (public.is_company_non_driver(company_id))
  WITH CHECK (public.is_company_non_driver(company_id));
```

A company admin with a valid session can PATCH `assigned_driver_id` on a job directly via PostgREST or through admin UI flows. This is the legitimate reassignment path.

**Android app:** Has NO reassignment, transfer, or reposting UI. `DriverViewModel.kt` has no reassignment function. `ApiClient.kt` has no reassignment endpoint call.

**Status:** IMPLEMENTED (server-side for admin role); MISSING (not in Android app — correctly excluded)

---

## Finding 8 — Secure driver reassignment, job transfer, or reposting

**Question:** Is there any implementation for secure driver reassignment, job transfer, or reposting by the carrier company?

**Answer:**

- **Carrier company reassignment:** Available to company admin via the `jobs_all_member` policy and the web admin interface. Audit of that path is outside this Android audit scope.
- **Android app reassignment:** NO implementation exists in the Android app.
- **Job reposting:** No Android function exists to repost a job. Only a company admin can do this via backend.
- **Driver-to-driver transfer:** NOT PRESENT. Once a job is assigned to a driver, only a company admin can change the `assigned_driver_id`.

**Status:** MISSING (in Android app); server-side admin capability EXISTS (outside Android scope)

---

## Finding 9 — Pickup authorization beyond authentication

**Question:** Is pickup authorization tied only to authentication, or also to a specific device, session, vehicle, driver identity, or verification code?

**Answer:** Tied to authentication (Supabase JWT) and `assigned_driver_id` match only. No device binding, no vehicle check at collection, no OTP, no verification code.

**Evidence — client-side guard:**

```kotlin
// Models.kt
fun needsCollectionProof(): Boolean = nextStatus() == "loaded"
fun blockingRequirementFor(next: String = nextStatus()): String? = when (next) {
    "loaded" -> if (hasCollectionProof()) null else "Take or upload a collection photo..."
    ...
}
```

A collection photo is required before moving to "loaded" status. This is enforced client-side. The server-side RPC accepts `p_collection_photo_url` as an optional parameter — it persists the value if provided but does NOT validate that a photo exists before allowing the status transition.

**Evidence — server-side RPC:**

```sql
-- 20260723201400_driver_native_status_rpc.sql (transition loaded)
UPDATE public.jobs j SET
  collection_photo_url = coalesce(nullif(p_collection_photo_url, ''), j.collection_photo_url),
  ...
WHERE j.id = p_job_id AND j.assigned_driver_id = p_driver_id
```

The server does not reject the "loaded" transition if `p_collection_photo_url` is NULL. A caller that bypasses the Android client can advance to "loaded" without a photo by sending the RPC directly with `p_collection_photo_url = NULL`.

**Status:** PARTIAL (authentication + assignment binding when auth works; no device/vehicle/OTP verification; collection proof enforceable client-side only)

---

## Finding 10 — Complete security gap inventory for unauthorised job operation

### Gap 10.1 — HIGH: No device registration or binding

**Files:** All Kotlin source files — no device ID captured or transmitted  
**Effect:** A credential set grants access from any device without any platform record  
**Business impact:** Credential sharing or theft is undetectable and unblockable without a full credential reset  
**Status:** MISSING

### Gap 10.2 — HIGH: Concurrent sessions on multiple devices unrestricted

**File:** `ApiClient.kt` login function; `SessionStore.kt`  
**Effect:** Each new login produces a fresh token pair; prior sessions remain valid  
**Business impact:** Two drivers operating one account simultaneously is operationally possible and undetectable  
**Status:** MISSING

### Gap 10.3 — HIGH: Logout is client-local only — no server-side token revocation

**File:** `DriverViewModel.kt:111–115`

```kotlin
fun logout() {
    viewModelScope.launch {
        liveRefreshJob?.cancel()
        sessionStore.clear()   // ← clears local prefs only
        // NO call to Supabase /auth/v1/logout
    }
}
```

**Effect:** After logout, the access token and refresh token that were in the local store remain valid on the Supabase side until natural expiry. A token intercepted before logout (or from another device) can continue to be used.  
**Business impact:** Logout provides no security guarantee beyond clearing the local device. A token extracted from Device A (e.g. from a backup or forensic copy) remains valid after the user "logs out" on that device.  
**Status:** MISSING

### Gap 10.4 — MEDIUM: Collection proof enforced client-side only

**File:** `Models.kt` → `blockingRequirementFor()` / `needsCollectionProof()`; `ApiClient.kt` → `driver_update_job_status_atomic` call  
**Effect:** The server-side RPC accepts `p_collection_photo_url = NULL` and does not reject the "loaded" transition  
**Business impact:** A caller bypassing the Android client can mark a job as "loaded" without uploading a collection photo  
**Status:** PARTIAL (client enforces; server does not)

### Gap 10.5 — MEDIUM: `uploadPodDocument` does not verify that the PATCH row was accepted

**File:** `ApiClient.kt:900–907`

```kotlin
http.newCall(patchRequest).execute().use { response ->
    val raw = response.body?.string().orEmpty()
    if (!response.isSuccessful) {      // ← only checks HTTP status code
        throw IllegalStateException("POD upload succeeded, but job update failed.")
    }
}
return storagePath  // ← returned even if 0 rows were patched
```

**Effect:** When RLS denies the PATCH (returns HTTP 200 with empty array), the function returns the storage path and the ViewModel reports "Collection proof uploaded." or "Delivery proof uploaded." to the user — a false success. The file exists in storage, but the `jobs` row is not updated.  
**Business impact:** Driver believes POD is attached; backend record has no POD link.  
**Status:** MISSING

### Gap 10.6 — LOW: No logout-all-devices capability

**File:** `ApiClient.kt` — no global logout endpoint  
**Effect:** A driver cannot force-expire all active sessions from the app. An admin cannot remotely invalidate a driver's tokens.  
**Status:** MISSING

---

## Backend ownership validation — server-side guards in place

The following server-side controls are active. They function correctly because the app sends a valid ****** (`"******"`) on every authenticated request:

| Server control | File | What it checks |
|---|---|---|
| `driver_update_job_status_atomic` — auth guard | `20260723201400_driver_native_status_rpc.sql:36–40` | `auth.uid() IS NOT NULL` |
| `driver_update_job_status_atomic` — driver identity | Line 51–54 | `d.user_id = auth.uid()` |
| `driver_update_job_status_atomic` — job assignment | Line 72 | `assigned_driver_id = p_driver_id` |
| `driver_update_job_status_atomic` — company match | Line 74–77 | `v_driver.company_id = v_job.awarded_carrier_company_id` |
| `driver_update_job_status_atomic` — status transition guard | Lines 91–100 | Only valid next status accepted; no skipping |
| `can_driver_access_job()` RLS | `044_driver_runtime_rls_and_legacy_schema_guard.sql` | `d.user_id = auth.uid()` |
| `can_driver_update_job()` RLS | Same file | `d.user_id = auth.uid()` |
| `jobs_update_assigned_driver` WITH CHECK | Same file | `assigned_driver_id = (SELECT d.id FROM drivers WHERE d.user_id = auth.uid())` |
| `jobs_select_assigned_driver` | Same file | Via `can_driver_access_job()` |
| Direct PATCH (`uploadPodDocument`, `confirmDeliveryRecipient`) | `ApiClient.kt:892, 933` | `id=eq.$jobId AND assigned_driver_id=eq.$driverId` URL filter (PostgREST) |

---

## Integrity statement

No source code was modified in this audit. No tests, dependencies, workflows, Supabase migrations, signing configuration, deployment configuration, or production data were changed.

All findings are based exclusively on reading:
- `android-native/app/src/main/java/co/uk/xdrivelogistics/driver/data/ApiClient.kt`
- `android-native/app/src/main/java/co/uk/xdrivelogistics/driver/data/SessionStore.kt`
- `android-native/app/src/main/java/co/uk/xdrivelogistics/driver/data/Models.kt`
- `android-native/app/src/main/java/co/uk/xdrivelogistics/driver/DriverViewModel.kt`
- `android-native/app/src/main/java/co/uk/xdrivelogistics/driver/TrackingService.kt`
- `supabase/migrations/20260723201400_driver_native_status_rpc.sql`
- `supabase/migrations/044_driver_runtime_rls_and_legacy_schema_guard.sql`
- `supabase/migrations/033_tighten_driver_rls.sql`
- `supabase/migrations/029_driver_jobs_rls.sql`
