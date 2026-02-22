# Audit Report — Danny Courier Ltd Dashboard

Generated: 2026-02-22

---

## Summary

| Category | Count |
|---|---|
| **PASS** | 28 |
| **FAIL (fixed in this PR)** | 5 |
| **FAKE / STUB** | 5 |
| **MISSING** | 7 |

---

## 1. Per-Feature Results

### 1.1 Auth / Accounts

| Feature | Result | Evidence |
|---|---|---|
| Login (Supabase) | ✅ PASS | `app/login/page.tsx` → `AuthContext.tsx::login()` → `supabase.auth.signInWithPassword` |
| Login (legacy fallback) | ✅ PASS | `AuthContext.tsx` `LEGACY_CREDENTIALS` array |
| Logout | ✅ PASS | `AuthContext.tsx::logout()` → `supabase.auth.signOut()` + redirect `/login` |
| Register / Sign up | ➖ MISSING | No `/register` route. No sign-up page. Only manual Supabase user creation possible. |
| ProtectedRoute | ✅ PASS | `ProtectedRoute.tsx` — redirects unauthenticated users to `/login` |
| Role routing (mobile vs desktop) | ✅ PASS | `AuthContext.tsx` `role: 'mobile'` → `/m`, else → `/admin` |

### 1.2 Companies

| Feature | Result | Evidence |
|---|---|---|
| List companies from DB | ✅ PASS | `admin/companies/page.tsx::loadCompanies()` — `supabase.from('companies').select('*')` |
| Create company | ✅ PASS | `handleCreate()` — `supabase.from('companies').insert([formData])` — error shown in UI |
| Edit company | ➖ MISSING | No edit button or form in UI |
| Delete company | ➖ MISSING | No delete button in UI |

### 1.3 Drivers

| Feature | Result | Evidence |
|---|---|---|
| List drivers from DB | ✅ PASS | `admin/drivers/page.tsx::loadDrivers()` |
| Company dropdown from DB | ✅ PASS | `loadCompanies()` with `console.error` on failure |
| Create driver | ✅ PASS | `handleCreate()` — insert + error surfaced |
| Edit driver | ➖ MISSING | No edit button in UI |
| Delete driver | ➖ MISSING | No delete button in UI |

### 1.4 Vehicles

| Feature | Result | Evidence |
|---|---|---|
| List vehicles | ✅ PASS | `admin/vehicles/page.tsx::loadVehicles()` |
| Company dropdown from DB | ✅ PASS | `loadCompanies()` |
| Create vehicle | ✅ PASS | `handleCreate()` — insert + error surfaced |
| Edit vehicle | ➖ MISSING | No edit button in UI |
| Delete vehicle | ➖ MISSING | No delete button in UI |

### 1.5 Jobs

| Feature | Result | Evidence |
|---|---|---|
| List jobs from DB | ✅ PASS | `admin/jobs/page.tsx::loadJobs()` — `supabase.from('jobs').select('*')` |
| Create job (`status='posted'`) | ✅ PASS | `handleCreateJob()` — companyId guard, errors surfaced, filter reset |
| Status filter tabs | ✅ PASS | `filterJobs()` client-side |
| Inline status update | ✅ PASS | `handleStatusChange()` — `supabase.update({status})` with error log |
| **View job detail** | ✅ PASS **(fixed)** | **Was FAIL:** `jobs/[id]/page.tsx::loadJob()` only used localStorage; Supabase jobs showed "Job not found". **Fixed:** now queries Supabase first. |
| **Edit job (save)** | ✅ PASS **(fixed)** | **Was FAIL:** `handleSave()` wrote to localStorage only; Supabase rows never updated. **Fixed:** updates Supabase, maps UI fields to DB columns. |
| **Delete job** | ✅ PASS **(fixed)** | **Was FAIL:** `handleDelete()` filtered localStorage only; Supabase row not deleted. **Fixed:** calls `supabase.from('jobs').delete().eq('id', jobId)`. |
| Generate invoice from job | ⚠️ FAKE | Stores data in `localStorage('temp_invoice_data')` then navigates to `/admin/invoices/new`. Works as UI handoff but invoices have no DB persistence. |

### 1.6 Quotes

| Feature | Result | Evidence |
|---|---|---|
| List quotes from DB | ✅ PASS | `admin/quotes/page.tsx::loadQuotes()` |
| Create quote | ✅ PASS | `handleCreate()` — insert + error surfaced |
| Update quote status (accept/decline) | ➖ MISSING | No action buttons in quotes list UI |

### 1.7 Bids

| Feature | Result | Evidence |
|---|---|---|
| List bids from DB | ✅ PASS | `admin/bids/page.tsx::loadBids()` |
| **Accept bid** | ✅ PASS **(fixed)** | **Was FAIL:** `updateStatus()` called `supabase.update(...)` without capturing `{error}` — silent failures. **Fixed:** captures error, logs to console, bails on failure. |
| **Reject bid** | ✅ PASS **(fixed)** | Same as above. |

### 1.8 Documents

| Feature | Result | Evidence |
|---|---|---|
| List driver documents (with driver name) | ✅ PASS | `admin/documents/page.tsx::loadDocs()` — SELECT with JOIN |
| List vehicle documents (with reg plate) | ✅ PASS | `loadDocs()` — SELECT with JOIN |
| **Approve document** | ✅ PASS **(fixed)** | **Was FAIL:** `updateStatus()` silent failure on Supabase error. **Fixed:** captures and logs error. |
| **Reject document** | ✅ PASS **(fixed)** | Same as above. |
| Upload new document | ➖ MISSING | No upload form or Supabase Storage integration in UI |

### 1.9 Invoices

| Feature | Result | Evidence |
|---|---|---|
| List invoices | ⚠️ FAKE/STUB | `admin/invoices/page.tsx` reads from `localStorage.getItem('dannycourier_invoices')`. No `invoices` table in Supabase schema. |
| Create invoice | ⚠️ FAKE/STUB | `admin/invoices/[id]/page.tsx` saves to `localStorage`. |
| View invoice detail / print | ⚠️ FAKE/STUB | Reads from `localStorage`. Uses `InvoiceTemplate` component for rendering (real template, fake storage). |

### 1.10 Settings

| Feature | Result | Evidence |
|---|---|---|
| View settings | ⚠️ FAKE/STUB | Pre-fills from `COMPANY_CONFIG` constants. No DB read. |
| Save settings | ⚠️ FAKE/STUB | `handleSave()` → `localStorage.setItem('danny_admin_settings', ...)`. Saved data is not shared across devices/users. |

### 1.11 Dashboard KPIs

| Feature | Result | Evidence |
|---|---|---|
| Active Jobs count | ✅ PASS | `admin/page.tsx` — `supabase.from('jobs').select(...count...).in('status',['posted','allocated','in_transit'])` |
| Pending Quotes count | ✅ PASS | `.in('status',['draft','sent'])` |
| Active Drivers count | ✅ PASS | `.eq('status','active')` |
| Completed Today count | ✅ PASS | `.eq('status','delivered').gte('updated_at', todayUtc)` |
| Generate Report (CSV) | ✅ PASS | Downloads CSV with live KPI values. Uses `Blob` + `URL.createObjectURL`. |

---

## 2. Fixes Applied

### Fix 1 — `app/admin/jobs/[id]/page.tsx` (CRITICAL)

**Problem:** `loadJob()`, `handleSave()`, `handleDelete()` used localStorage exclusively. Jobs created in Supabase (UUIDs) were never found in localStorage → "Job not found" on every view.

**Changes:**
- Added `import { supabase, isSupabaseConfigured }` 
- `loadJob()` made async; queries `supabase.from('jobs').select('*').eq('id', jobId).single()` first; maps DB row to UI `Job` shape; falls back to localStorage if not configured
- `handleSave()` made async; updates Supabase with mapped fields (`load_details`, `pickup_location`, `pickup_datetime`, `delivery_location`, `delivery_datetime`, `cargo_type`, `items`, `status`, `updated_at`); falls back to localStorage; errors surfaced via `setSaveMessage`
- `handleDelete()` made async; calls `supabase.from('jobs').delete().eq('id', jobId)`; falls back to localStorage; errors surfaced

### Fix 2 — `app/admin/bids/page.tsx`

**Problem:** `updateStatus()` called `await supabase.from('job_bids').update(...)` without capturing `{error}` — any DB error (RLS denial, network) was silently ignored.

**Change:** Capture `const { error } = await supabase...`; add `if (error) { console.error(...); return; }` before `loadBids()`.

### Fix 3 — `app/admin/documents/page.tsx`

**Problem:** Same silent-error pattern in `updateStatus()` for `driver_documents` and `vehicle_documents`.

**Change:** Same pattern — capture error, log, bail before re-loading.

---

## 3. Remaining Known Issues / Next Priorities

| Priority | Feature | Issue | Recommended Action |
|---|---|---|---|
| HIGH | Invoices | Entirely localStorage — no Supabase table. Data lost on clear or across devices. | Add `invoices` migration + update page to read/write Supabase |
| HIGH | Settings | localStorage only — not shared across logins/devices. | Add `company_settings` table + migration |
| HIGH | Register | No sign-up page. Admins must manually create users in Supabase dashboard. | Add `/register` page using `supabase.auth.signUp()` |
| MEDIUM | Companies/Drivers/Vehicles | No Edit or Delete UI | Add inline edit modals and delete confirmation |
| MEDIUM | Document Upload | No file upload form; `driver_documents` / `vehicle_documents` rows can only be approved/rejected if created externally | Add upload form with Supabase Storage bucket |
| MEDIUM | Quotes | No accept/decline buttons — status stuck at `draft` | Add action buttons with `supabase.update({status})` |
| LOW | Jobs `[id]` — `handleGenerateInvoice` | Passes data via `localStorage('temp_invoice_data')` which invoice page doesn't currently read; handoff is one-way | Read `temp_invoice_data` in `/admin/invoices/new` OR pass via URL params |
| LOW | Return Journeys | Table exists in DB but no UI | Implement if required |
| LOW | Diary Events | Table exists in DB but no UI | Implement if required |
| LOW | Driver Locations | Table exists in DB but no UI map | Implement if required |
