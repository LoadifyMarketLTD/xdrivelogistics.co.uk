# Audit 15 — Notification Audit

> Production Certification Phase · Development Freeze Active
> Verify that the right notifications are sent, at the right time, to the right users.

## Metadata

| Field | Value |
|---|---|
| Auditor | |
| Date | |
| Environment | https://www.xdrivelogistics.co.uk |
| Email provider | (e.g. Resend / SendGrid) |
| Push notification provider | (e.g. Expo / FCM) |

## Legend

`✅ PASS` · `❌ FAIL` · `⚠️ PARTIAL` · `🔲 N/T` — Severity: `CRITICAL` `MAJOR` `MINOR` `COSMETIC`

---

## NOT-01 · In-App Notifications (Web)

| ID | Event | Recipient | Channel | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|---|
| NOT-01-01 | New bid received on job | Customer / Broker | In-app notification bell | Bell badge increments; notification listed | | 🔲 N/T | MAJOR | |
| NOT-01-02 | Bid awarded | Driver | In-app notification | "You won a job" notification appears | | 🔲 N/T | CRITICAL | |
| NOT-01-03 | Bid rejected (another driver awarded) | Driver | In-app notification | "Bid unsuccessful" notification | | 🔲 N/T | MAJOR | |
| NOT-01-04 | Job cancelled by customer | Driver with bid | In-app notification | "Job cancelled" notification | | 🔲 N/T | MAJOR | |
| NOT-01-05 | Driver arrived at collection | Customer | In-app notification | Status update notification | | 🔲 N/T | MINOR | |
| NOT-01-06 | Driver loaded | Customer | In-app notification | Status update notification | | 🔲 N/T | MINOR | |
| NOT-01-07 | Driver on my way | Customer | In-app notification | Status update notification | | 🔲 N/T | MINOR | |
| NOT-01-08 | Driver arrived at delivery | Customer | In-app notification | Status update notification | | 🔲 N/T | MINOR | |
| NOT-01-09 | POD submitted — delivery complete | Customer | In-app notification | "Delivery confirmed" notification | | 🔲 N/T | CRITICAL | |
| NOT-01-10 | Invoice created | Driver | In-app notification | "Invoice created" notification (migration 116) | | 🔲 N/T | MAJOR | |
| NOT-01-11 | Company approved by admin | Customer / Fleet owner | In-app notification | "Account approved" notification | | 🔲 N/T | CRITICAL | |
| NOT-01-12 | Company rejected by admin | Applicant | In-app notification | "Application rejected" with reason | | 🔲 N/T | MAJOR | |
| NOT-01-13 | Dispute resolved | Driver + Customer | In-app notification | "Dispute resolved" notification | | 🔲 N/T | MAJOR | |
| NOT-01-14 | Notification bell — mark as read | Click notification | Badge decrements; notification marked read | | 🔲 N/T | MINOR | |
| NOT-01-15 | Notification bell — mark all as read | "Mark all read" button | All notifications cleared; badge = 0 | | 🔲 N/T | MINOR | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## NOT-02 · Email Notifications

| ID | Event | Recipient | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| NOT-02-01 | Registration | New user | Verification email received within 2 min | | 🔲 N/T | CRITICAL | |
| NOT-02-02 | Password reset | User | Reset email received within 2 min | | 🔲 N/T | CRITICAL | |
| NOT-02-03 | Onboarding submitted | Applicant | Confirmation email received | | 🔲 N/T | MAJOR | |
| NOT-02-04 | Company approved | Company owner | Approval email received | | 🔲 N/T | CRITICAL | |
| NOT-02-05 | Company rejected | Applicant | Rejection email with reason | | 🔲 N/T | MAJOR | |
| NOT-02-06 | Bid awarded | Driver | "You won job X" email | | 🔲 N/T | MAJOR | |
| NOT-02-07 | Delivery completed + POD | Customer | Delivery confirmation email with POD link | | 🔲 N/T | MAJOR | |
| NOT-02-08 | Email readiness check | Admin | GET `/api/super-admin/email-readiness` returns OK | | 🔲 N/T | CRITICAL | |
| NOT-02-09 | Email sender domain configured | Email headers | Sent from correct domain (not placeholder) | | 🔲 N/T | CRITICAL | |
| NOT-02-10 | Email not in spam | Real mailbox test | Email delivered to inbox (not spam/junk) | | 🔲 N/T | MAJOR | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## NOT-03 · Push Notifications (Android APK)

| ID | Event | Recipient | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| NOT-03-01 | Device token registered on login | Driver | POST `/api/driver/mobile/device-token` called; token saved | | 🔲 N/T | CRITICAL | |
| NOT-03-02 | Push notification: bid awarded | Driver (app in background) | Push notification received in Android tray | | 🔲 N/T | CRITICAL | |
| NOT-03-03 | Push notification: bid awarded (app foreground) | Driver (app open) | In-app banner or alert shown | | 🔲 N/T | MAJOR | |
| NOT-03-04 | Tap notification → deep link | Driver taps push | App opens to relevant screen (Active Job) | | 🔲 N/T | MAJOR | |
| NOT-03-05 | Push notification: new nearby job available | Driver | Push received when new job posted | | 🔲 N/T | MINOR | |
| NOT-03-06 | Push notification delivery when app killed | Force-stop app; trigger event | Push received after app restart | | 🔲 N/T | MAJOR | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## NOT-04 · Realtime Notifications (Supabase Realtime)

| ID | Check | Method | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| NOT-04-01 | New bid on job received in realtime | Insert bid; observe customer browser | `POSTGRES_CHANGES` event received in <2s | | 🔲 N/T | CRITICAL | |
| NOT-04-02 | Job status change received in realtime | Update job status; observe browser | Status updates without page refresh | | 🔲 N/T | CRITICAL | |
| NOT-04-03 | Driver location update received in realtime | Driver posts location; observe customer tracking | Pin moves on map in <2s | | 🔲 N/T | CRITICAL | |
| NOT-04-04 | Realtime subscription scoped to authenticated user | Compare events received vs expected | No notifications from other companies' data | | 🔲 N/T | CRITICAL | |
| NOT-04-05 | Realtime reconnects after temporary disconnect | Disable/re-enable network | Subscription re-established; no missed events | | 🔲 N/T | MAJOR | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## NOT-05 · Admin Notification Tools

| ID | Check | Route / Action | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| NOT-05-01 | Admin notification log | `/super-admin/notifications` | All platform notifications listed with recipient and timestamp | | 🔲 N/T | MAJOR | |
| NOT-05-02 | Admin send manual notification | Broadcast action | Notification delivered to target user | | 🔲 N/T | MINOR | |
| NOT-05-03 | Email trigger settings (migration 115) | `SELECT * FROM notification_email_settings` | Trigger settings configurable per event type | | 🔲 N/T | MINOR | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## Summary

| Section | Tests | PASS | FAIL | PARTIAL | N/T |
|---|---|---|---|---|---|
| NOT-01 In-App (Web) | 15 | | | | |
| NOT-02 Email | 10 | | | | |
| NOT-03 Push (Android) | 6 | | | | |
| NOT-04 Realtime | 5 | | | | |
| NOT-05 Admin Tools | 3 | | | | |
| **TOTAL** | **39** | | | | |

**Overall Result:** ☐ PASS ☐ FAIL

**Defects raised:**

| Defect ID | Description | Severity |
|---|---|---|
| | | |
