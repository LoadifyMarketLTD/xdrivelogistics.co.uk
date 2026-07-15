# Audit 09 — Performance Audit

> Production Certification Phase · Development Freeze Active

## Metadata

| Field | Value |
|---|---|
| Auditor | |
| Date | |
| Web environment | https://www.xdrivelogistics.co.uk |
| APK version | |
| Android test device | |
| Network conditions (web) | Broadband / 4G LTE |
| Browser (web) | Chrome latest |

## Legend

`✅ PASS` · `❌ FAIL` · `⚠️ PARTIAL` · `🔲 N/T` — Severity: `CRITICAL` `MAJOR` `MINOR` `COSMETIC`

---

## PERF-01 · Web Page Load Times

| ID | Page / Endpoint | Method | Acceptable Threshold | Measured | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| PERF-01-01 | Homepage `/` | Browser DevTools → Network → DOMContentLoaded | < 3s | | 🔲 N/T | MAJOR | |
| PERF-01-02 | Customer dashboard `/customer` | Navigation timing | < 3s after auth | | 🔲 N/T | MAJOR | |
| PERF-01-03 | Admin marketplace `/admin/marketplace` | Navigation timing | < 4s (data-heavy page) | | 🔲 N/T | MINOR | |
| PERF-01-04 | Driver loads `/driver/loads` | Navigation timing | < 3s | | 🔲 N/T | MAJOR | |
| PERF-01-05 | Job detail `/customer/jobs/[id]` | Navigation timing | < 3s | | 🔲 N/T | MAJOR | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## PERF-02 · API Response Times

| ID | Endpoint | Method | Acceptable Threshold (p95) | Measured | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| PERF-02-01 | GET `/api/driver/mobile/resources` | DevTools Network / Postman | < 500ms | | 🔲 N/T | MAJOR | |
| PERF-02-02 | GET `/api/driver/mobile/nearby-jobs` | Same | < 800ms | | 🔲 N/T | MAJOR | |
| PERF-02-03 | GET `/api/driver/search-loads` | Same | < 800ms | | 🔲 N/T | MAJOR | |
| PERF-02-04 | GET `/api/driver/mobile/jobs` | Same | < 500ms | | 🔲 N/T | MAJOR | |
| PERF-02-05 | POST `/api/driver/mobile/bids` | Same | < 500ms | | 🔲 N/T | MAJOR | |
| PERF-02-06 | POST `/api/driver/mobile/jobs/[id]/[action]` (status update) | Same | < 500ms | | 🔲 N/T | MAJOR | |
| PERF-02-07 | POST `/api/driver/location` | Same | < 300ms (called frequently) | | 🔲 N/T | MAJOR | |
| PERF-02-08 | GET `/api/super-admin/stats` | Same | < 1000ms | | 🔲 N/T | MINOR | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## PERF-03 · Lighthouse Scores (Web)

| ID | Page | Metric | Acceptable | Measured | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| PERF-03-01 | Homepage `/` — Performance | Chrome Lighthouse | ≥ 70 | | 🔲 N/T | MAJOR | |
| PERF-03-02 | Homepage `/` — Accessibility | Chrome Lighthouse | ≥ 80 | | 🔲 N/T | MAJOR | |
| PERF-03-03 | Homepage `/` — Best Practices | Chrome Lighthouse | ≥ 80 | | 🔲 N/T | MINOR | |
| PERF-03-04 | Homepage `/` — SEO | Chrome Lighthouse | ≥ 80 | | 🔲 N/T | MINOR | |
| PERF-03-05 | Customer dashboard — Performance | Lighthouse (authenticated) | ≥ 60 | | 🔲 N/T | MINOR | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## PERF-04 · Android Memory & CPU

| ID | Scenario | Tool | Acceptable Threshold | Measured | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| PERF-04-01 | RAM at idle (app open, no journey) | Android Studio Profiler or `adb shell dumpsys meminfo` | < 200MB RSS | | 🔲 N/T | MAJOR | |
| PERF-04-02 | RAM during active journey with GPS | Profiler — 30min journey | < 350MB; no sustained growth | | 🔲 N/T | MAJOR | |
| PERF-04-03 | RAM leak — memory growth over 1h session | Profiler timeline | Growth < 50MB over 1h | | 🔲 N/T | MAJOR | |
| PERF-04-04 | CPU during scroll (loads list) | Profiler — CPU chart | Peaks < 70% CPU; no sustained 100% | | 🔲 N/T | MINOR | |
| PERF-04-05 | CPU during POD photo upload | Profiler | < 80% peak CPU; returns to baseline | | 🔲 N/T | MINOR | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## PERF-05 · Android Battery

| ID | Scenario | Tool | Acceptable Threshold | Measured | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| PERF-05-01 | Battery drain — 1h foreground active use | Settings → Battery → App usage | < 15% per hour | | 🔲 N/T | MAJOR | |
| PERF-05-02 | Battery drain — GPS active in background 30min | Settings → Battery | < 8% per 30 min | | 🔲 N/T | MAJOR | |
| PERF-05-03 | Battery usage reported by Android | Settings → Battery → XDrive Driver | Not in "High battery usage" apps | | 🔲 N/T | MINOR | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## PERF-06 · Android Rendering & Smoothness

| ID | Scenario | Tool | Acceptable Threshold | Measured | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| PERF-06-01 | Scroll through 50-item loads list | Visual inspection + Logcat | Smooth; no visible jank | | 🔲 N/T | MAJOR | |
| PERF-06-02 | Open/close quote panel (animation) | Visual inspection | Animation completes in <300ms; no stutter | | 🔲 N/T | MINOR | |
| PERF-06-03 | Screen transition (tab switch) | Visual inspection | Transition < 200ms | | 🔲 N/T | MINOR | |
| PERF-06-04 | Map rendering (fleet/tracking) | Visual inspection | Map tiles load in <2s; no blank map | | 🔲 N/T | MAJOR | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## PERF-07 · ANR & Crash Rates

| ID | Scenario | Tool | Acceptable Threshold | Measured | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| PERF-07-01 | ANR during normal use (30min session) | Logcat / device dialog | 0 ANR occurrences | | 🔲 N/T | CRITICAL | |
| PERF-07-02 | App crashes during normal use | Logcat / crash dialog | 0 unhandled crashes | | 🔲 N/T | CRITICAL | |
| PERF-07-03 | JS errors in React Native | `adb logcat -s ReactNativeJS` | 0 unhandled promise rejections or fatal errors | | 🔲 N/T | CRITICAL | |
| PERF-07-04 | App starts within acceptable time | Stopwatch — cold start | < 4s cold start | | 🔲 N/T | MAJOR | |
| PERF-07-05 | App resumes within acceptable time | Stopwatch — warm start (from background) | < 1s warm start | | 🔲 N/T | MAJOR | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## PERF-08 · Upload & File Transfer

| ID | Scenario | Network | Acceptable Threshold | Measured | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| PERF-08-01 | Upload single POD photo (1MB) | 4G LTE | < 5s | | 🔲 N/T | MAJOR | |
| PERF-08-02 | Upload 5 POD photos (total ~5MB) | 4G LTE | < 20s total | | 🔲 N/T | MAJOR | |
| PERF-08-03 | Generate and download POD PDF | 4G LTE | PDF ready < 5s | | 🔲 N/T | MAJOR | |
| PERF-08-04 | Upload document via web (company doc) | Broadband | < 5s for <5MB file | | 🔲 N/T | MINOR | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## Summary

| Section | Tests | PASS | FAIL | PARTIAL | N/T |
|---|---|---|---|---|---|
| PERF-01 Web Page Load | 5 | | | | |
| PERF-02 API Response Times | 8 | | | | |
| PERF-03 Lighthouse | 5 | | | | |
| PERF-04 Memory & CPU | 5 | | | | |
| PERF-05 Battery | 3 | | | | |
| PERF-06 Rendering | 4 | | | | |
| PERF-07 ANR & Crashes | 5 | | | | |
| PERF-08 Upload & Transfer | 4 | | | | |
| **TOTAL** | **39** | | | | |

**Overall Result:** ☐ PASS ☐ FAIL

**Defects raised:**

| Defect ID | Description | Severity |
|---|---|---|
| | | |
