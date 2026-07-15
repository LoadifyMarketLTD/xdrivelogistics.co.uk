# Audit 17 — GPS & Location Audit

> Production Certification Phase · Development Freeze Active
> Must be tested on a physical Android device in real movement conditions where possible.

## Metadata

| Field | Value |
|---|---|
| Auditor | |
| Date | |
| APK version | |
| Android test device | |
| Location API endpoint | POST `/api/driver/location` |
| Location table | `driver_locations` |

## Legend

`✅ PASS` · `❌ FAIL` · `⚠️ PARTIAL` · `🔲 N/T` — Severity: `CRITICAL` `MAJOR` `MINOR` `COSMETIC`

---

## GPS-01 · Permission Handling

| ID | Scenario | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|
| GPS-01-01 | First Start Journey — permission prompt shown | Android permission dialog appears | | 🔲 N/T | CRITICAL | |
| GPS-01-02 | Permission granted — tracking starts | Location sent to server; `driver_locations` updated | | 🔲 N/T | CRITICAL | |
| GPS-01-03 | Permission denied — graceful degradation | Error message shown; driver can still progress manually | | 🔲 N/T | MAJOR | |
| GPS-01-04 | Permission denied then granted (settings change) | App responds to permission grant without restart | | 🔲 N/T | MAJOR | |
| GPS-01-05 | "Allow only while using app" permission | Location sent only in foreground | | 🔲 N/T | MINOR | |
| GPS-01-06 | "Allow all the time" permission | Location sent in background | | 🔲 N/T | MAJOR | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## GPS-02 · Location Accuracy & Frequency

| ID | Check | Method | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| GPS-02-01 | Location update frequency during journey | Monitor `driver_locations` inserts | Updated at least every 30s during active journey | | 🔲 N/T | MAJOR | |
| GPS-02-02 | Location accuracy within acceptable range | Compare GPS coords to actual position | Accuracy ≤ 50m | | 🔲 N/T | MAJOR | |
| GPS-02-03 | Location stops updating after journey ends | After POD submit | No new `driver_locations` rows for that driver's journey | | 🔲 N/T | MINOR | |
| GPS-02-04 | Latitude and longitude stored correctly | Check `driver_locations` table | Valid coordinates (not 0,0; not null) | | 🔲 N/T | CRITICAL | |
| GPS-02-05 | Updated_at timestamp is current | Check `driver_locations.updated_at` | Within expected interval of last update | | 🔲 N/T | MINOR | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## GPS-03 · Backend API (`POST /api/driver/location`)

| ID | Check | Method | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| GPS-03-01 | Valid location POST accepted | POST with valid JWT + lat/lng | 200 OK; row upserted in `driver_locations` | | 🔲 N/T | CRITICAL | |
| GPS-03-02 | Location POST without auth | POST without Authorization header | 401 | | 🔲 N/T | CRITICAL | |
| GPS-03-03 | Location POST with invalid coordinates | POST with lat=999, lng=999 | Validation error; row not stored | | 🔲 N/T | MAJOR | |
| GPS-03-04 | Location POST with missing fields | POST without lat or lng | Validation error | | 🔲 N/T | MAJOR | |
| GPS-03-05 | Location POST uses canonical URL | Check app API client config | `https://www.xdrivelogistics.co.uk/api/driver/location` | | 🔲 N/T | CRITICAL | |
| GPS-03-06 | Response time acceptable | Measure POST response time | < 300ms p95 | | 🔲 N/T | MAJOR | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## GPS-04 · Customer Tracking View (Web)

| ID | Check | Route | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| GPS-04-01 | Customer tracking page shows driver position | `/customer/jobs/[id]` → tracking | Map with driver pin displayed | | 🔲 N/T | CRITICAL | |
| GPS-04-02 | Driver pin moves in realtime | Realtime subscription | Pin updates without page refresh when driver moves | | 🔲 N/T | CRITICAL | |
| GPS-04-03 | Tracking starts when driver starts journey | `start_journey` action | Map becomes active; pin appears | | 🔲 N/T | MAJOR | |
| GPS-04-04 | Tracking stops after delivery | After POD submit | Tracking view shows "Delivered" state | | 🔲 N/T | MINOR | |
| GPS-04-05 | Admin fleet map shows all active drivers | `/admin/fleet` | All drivers with active journeys visible | | 🔲 N/T | MAJOR | |
| GPS-04-06 | Super-admin fleet positions page | `/super-admin/operations/fleet-positions` | Same as admin fleet map | | 🔲 N/T | MINOR | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## GPS-05 · Background & Offline GPS

| ID | Scenario | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|
| GPS-05-01 | GPS updates while app in background (screen off) | `driver_locations` continues to update | | 🔲 N/T | CRITICAL | |
| GPS-05-02 | GPS updates while phone locked | Same | | 🔲 N/T | CRITICAL | |
| GPS-05-03 | GPS with no internet — queue and retry | Location stored locally; sent on reconnect | | 🔲 N/T | MAJOR | |
| GPS-05-04 | GPS resume after brief connectivity loss | Updates resume automatically | | 🔲 N/T | MAJOR | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## GPS-06 · Database — `driver_locations` Table

| ID | Check | SQL | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| GPS-06-01 | Table exists with correct columns (migration 119) | `\d driver_locations` | driver_id, latitude, longitude, updated_at, accuracy (optional) | | 🔲 N/T | CRITICAL | |
| GPS-06-02 | RLS enabled on `driver_locations` | `SELECT rowsecurity FROM pg_class WHERE relname='driver_locations'` | `true` | | 🔲 N/T | CRITICAL | |
| GPS-06-03 | Driver can only write own location | Auth as Driver B; insert row for Driver A's ID | Rejected by RLS | | 🔲 N/T | CRITICAL | |
| GPS-06-04 | Realtime replication enabled | Supabase → Database → Replication | `driver_locations` in publication | | 🔲 N/T | CRITICAL | |
| GPS-06-05 | No orphaned location rows | `SELECT count(*) FROM driver_locations WHERE driver_id NOT IN (SELECT id FROM drivers)` | 0 | | 🔲 N/T | MINOR | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## Summary

| Section | Tests | PASS | FAIL | PARTIAL | N/T |
|---|---|---|---|---|---|
| GPS-01 Permission Handling | 6 | | | | |
| GPS-02 Accuracy & Frequency | 5 | | | | |
| GPS-03 Backend API | 6 | | | | |
| GPS-04 Customer Tracking View | 6 | | | | |
| GPS-05 Background & Offline | 4 | | | | |
| GPS-06 Database | 5 | | | | |
| **TOTAL** | **32** | | | | |

**Overall Result:** ☐ PASS ☐ FAIL

**Defects raised:**

| Defect ID | Description | Severity |
|---|---|---|
| | | |
