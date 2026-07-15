# Audit 16 — File Management Audit

> Production Certification Phase · Development Freeze Active
> Verify all file upload, storage, retrieval, and deletion flows.

## Metadata

| Field | Value |
|---|---|
| Auditor | |
| Date | |
| Environment | https://www.xdrivelogistics.co.uk |
| Storage provider | Supabase Storage |
| Buckets | `driver-docs`, `vehicle-docs`, `pod-photos` |

## Legend

`✅ PASS` · `❌ FAIL` · `⚠️ PARTIAL` · `🔲 N/T` — Severity: `CRITICAL` `MAJOR` `MINOR` `COSMETIC`

---

## FILE-01 · Driver Documents

| ID | Check | Bucket | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| FILE-01-01 | Upload driver licence (PDF) | `driver-docs` | File uploaded; URL stored in DB; preview available | | 🔲 N/T | MAJOR | |
| FILE-01-02 | Upload driving licence (JPG image) | `driver-docs` | Same | | 🔲 N/T | MAJOR | |
| FILE-01-03 | Upload file > 10MB | `driver-docs` | Rejected; `file_size_limit` enforced | | 🔲 N/T | MAJOR | |
| FILE-01-04 | Upload unsupported type (.docx) | `driver-docs` | Rejected; `allowed_mime_types` enforced | | 🔲 N/T | MAJOR | |
| FILE-01-05 | Expiry date recorded with document | Upload with expiry | Expiry stored; viewable in driver profile | | 🔲 N/T | MAJOR | |
| FILE-01-06 | Document visible in admin panel | Admin → drivers → documents | Admin can view/download driver's documents | | 🔲 N/T | MAJOR | |
| FILE-01-07 | Driver can view own documents | `/driver/documents` | Own documents listed with status | | 🔲 N/T | MAJOR | |
| FILE-01-08 | Driver cannot access another driver's documents | Direct path access as other driver | 403 | | 🔲 N/T | CRITICAL | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## FILE-02 · Vehicle Documents

| ID | Check | Bucket | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| FILE-02-01 | Upload vehicle insurance (PDF) | `vehicle-docs` | File uploaded; stored against vehicle record | | 🔲 N/T | MAJOR | |
| FILE-02-02 | Upload MOT/ITP certificate | `vehicle-docs` | File uploaded; expiry date stored | | 🔲 N/T | MAJOR | |
| FILE-02-03 | Upload file > 10MB | `vehicle-docs` | Rejected | | 🔲 N/T | MAJOR | |
| FILE-02-04 | Expiry alert generated for near-expiry vehicle doc | Expiry < 30 days | Alert/notification created | | 🔲 N/T | MAJOR | |
| FILE-02-05 | Company A cannot access Company B's vehicle docs | Storage path access | 403 | | 🔲 N/T | CRITICAL | |
| FILE-02-06 | Vehicle documents visible to fleet manager | Fleet view | Documents listed with expiry | | 🔲 N/T | MAJOR | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## FILE-03 · Company Documents (Onboarding)

| ID | Check | Bucket / API | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| FILE-03-01 | Upload company document during onboarding | POST `/api/onboarding/documents` | File stored; session updated | | 🔲 N/T | CRITICAL | |
| FILE-03-02 | Company document visible to admin after onboarding | Admin → companies → documents | Document accessible | | 🔲 N/T | CRITICAL | |
| FILE-03-03 | Document upload adds to invoice | POST `/api/driver/finance/invoices/[id]/documents` | Document attached to invoice | | 🔲 N/T | MAJOR | |
| FILE-03-04 | Company A cannot see Company B's onboarding docs | Auth as Company A | 403 or 0 rows | | 🔲 N/T | CRITICAL | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## FILE-04 · POD Photos

| ID | Check | Bucket | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| FILE-04-01 | Upload POD photo (JPEG) | `pod-photos` | Photo stored; URL linked to job | | 🔲 N/T | CRITICAL | |
| FILE-04-02 | Upload POD photo (PNG) | `pod-photos` | Same | | 🔲 N/T | CRITICAL | |
| FILE-04-03 | Upload multiple POD photos (5+) | `pod-photos` | All photos stored; all linked to POD record | | 🔲 N/T | CRITICAL | |
| FILE-04-04 | Upload oversized photo (>10MB) | `pod-photos` | Rejected | | 🔲 N/T | MAJOR | |
| FILE-04-05 | POD photos visible to customer after delivery | Customer job detail | Photos viewable | | 🔲 N/T | CRITICAL | |
| FILE-04-06 | POD photos included in PDF | PDF download | All submitted photos appear in POD PDF | | 🔲 N/T | CRITICAL | |
| FILE-04-07 | Company A cannot access Company B's POD photos | Direct URL as Company A | 403 | | 🔲 N/T | CRITICAL | |
| FILE-04-08 | POD signature saved | Submit signature on POD | Signature stored as image; appears in PDF | | 🔲 N/T | CRITICAL | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## FILE-05 · PDF Generation

| ID | Check | Method | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| FILE-05-01 | POD PDF generated after submission | View POD on delivered job | PDF downloadable; valid format | | 🔲 N/T | CRITICAL | |
| FILE-05-02 | POD PDF content correct | Open PDF | Job reference, driver, customer, date, images, signature all present | | 🔲 N/T | CRITICAL | |
| FILE-05-03 | Invoice PDF generated | Download invoice | PDF downloadable; valid format | | 🔲 N/T | MAJOR | |
| FILE-05-04 | Invoice PDF content correct | Open PDF | Invoice number, amount, VAT (if applicable), company details correct | | 🔲 N/T | MAJOR | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## FILE-06 · Storage Security

| ID | Check | Method | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| FILE-06-01 | `driver-docs` bucket is private | Supabase Dashboard → Storage | `public = false` | | 🔲 N/T | CRITICAL | |
| FILE-06-02 | `vehicle-docs` bucket is private | Supabase Dashboard | `public = false` | | 🔲 N/T | CRITICAL | |
| FILE-06-03 | `pod-photos` bucket is private | Supabase Dashboard | `public = false` | | 🔲 N/T | CRITICAL | |
| FILE-06-04 | Direct unauthenticated URL rejected | GET `storage/v1/object/driver-docs/...` | 403 | | 🔲 N/T | CRITICAL | |
| FILE-06-05 | Signed URLs expire correctly | Wait past expiry | URL returns 403 | | 🔲 N/T | MAJOR | |
| FILE-06-06 | Storage RLS policies validated | Supabase Dashboard → Storage → Policies | Policies present for all 3 buckets | | 🔲 N/T | CRITICAL | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## Summary

| Section | Tests | PASS | FAIL | PARTIAL | N/T |
|---|---|---|---|---|---|
| FILE-01 Driver Documents | 8 | | | | |
| FILE-02 Vehicle Documents | 6 | | | | |
| FILE-03 Company Documents | 4 | | | | |
| FILE-04 POD Photos | 8 | | | | |
| FILE-05 PDF Generation | 4 | | | | |
| FILE-06 Storage Security | 6 | | | | |
| **TOTAL** | **36** | | | | |

**Overall Result:** ☐ PASS ☐ FAIL

**Defects raised:**

| Defect ID | Description | Severity |
|---|---|---|
| | | |
