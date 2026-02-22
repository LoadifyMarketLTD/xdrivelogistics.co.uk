# Dashboard Test Matrix

Legend: ✅ PASS | ❌ FAIL | ⚠️ FAKE/STUB | ➖ MISSING

| Feature | Role | Route | DB Table | Operation | Expected | Result | Evidence | Fix Needed |
|---|---|---|---|---|---|---|---|---|
| **AUTH** | | | | | | | | |
| Login with Supabase credentials | Any | `/login` | `auth.users` | Supabase auth | Redirect to `/admin` | ✅ PASS | `AuthContext.tsx` `supabase.auth.signInWithPassword` | None |
| Login with legacy fallback | Any | `/login` | None | localStorage compare | Redirect to `/admin` | ✅ PASS | `AuthContext.tsx` `LEGACY_CREDENTIALS` | None |
| Logout | Any | `/admin` | `auth.users` | Supabase signOut | Redirect to `/login` | ✅ PASS | `AuthContext.tsx` `logout()` | None |
| Register / Sign up | Any | N/A | N/A | N/A | Create account | ➖ MISSING | No `/register` route exists | Create register page (out of scope for MVP) |
| Role-based routing (mobile vs desktop) | Mobile | `/login` | None | `role` in credentials | Redirect to `/m` | ✅ PASS | `AuthContext.tsx` `role: 'mobile'` | None |
| ProtectedRoute (unauthenticated redirect) | Visitor | Any `/admin/**` | None | Client-side check | Redirect to `/login` | ✅ PASS | `ProtectedRoute.tsx` | None |
| **COMPANIES** | | | | | | | | |
| List companies | Admin | `/admin/companies` | `companies` | SELECT | Show all company rows | ✅ PASS | `companies/page.tsx` `loadCompanies()` | None |
| Create company | Admin | `/admin/companies` | `companies` | INSERT | Row in DB + list refresh | ✅ PASS | `companies/page.tsx` `handleCreate()` error surfaced | None |
| Edit company | Admin | `/admin/companies` | `companies` | UPDATE | — | ➖ MISSING | No edit form/button exists | Add edit flow |
| Delete company | Admin | `/admin/companies` | `companies` | DELETE | — | ➖ MISSING | No delete button exists | Add delete flow |
| **DRIVERS** | | | | | | | | |
| List drivers | Admin | `/admin/drivers` | `drivers` | SELECT | Show all rows | ✅ PASS | `drivers/page.tsx` `loadDrivers()` | None |
| Company dropdown loads from DB | Admin | `/admin/drivers` | `companies` | SELECT | Real company names | ✅ PASS | `drivers/page.tsx` `loadCompanies()` with error log | None |
| Create driver | Admin | `/admin/drivers` | `drivers` | INSERT | Row in DB + list refresh | ✅ PASS | `drivers/page.tsx` `handleCreate()` error surfaced | None |
| Edit driver | Admin | `/admin/drivers` | `drivers` | UPDATE | — | ➖ MISSING | No edit form/button | Add edit flow |
| Delete driver | Admin | `/admin/drivers` | `drivers` | DELETE | — | ➖ MISSING | No delete button | Add delete flow |
| **VEHICLES** | | | | | | | | |
| List vehicles | Admin | `/admin/vehicles` | `vehicles` | SELECT | Show all rows | ✅ PASS | `vehicles/page.tsx` `loadVehicles()` | None |
| Company dropdown loads from DB | Admin | `/admin/vehicles` | `companies` | SELECT | Real company names | ✅ PASS | `vehicles/page.tsx` `loadCompanies()` | None |
| Create vehicle | Admin | `/admin/vehicles` | `vehicles` | INSERT | Row in DB + list refresh | ✅ PASS | `vehicles/page.tsx` `handleCreate()` error surfaced | None |
| Edit vehicle | Admin | `/admin/vehicles` | `vehicles` | UPDATE | — | ➖ MISSING | No edit form/button | Add edit flow |
| Delete vehicle | Admin | `/admin/vehicles` | `vehicles` | DELETE | — | ➖ MISSING | No delete button | Add delete flow |
| **JOBS** | | | | | | | | |
| List jobs | Admin | `/admin/jobs` | `jobs` | SELECT | All jobs loaded from DB | ✅ PASS | `jobs/page.tsx` `loadJobs()` | None |
| Create job | Admin | `/admin/jobs` | `jobs` | INSERT | Row with `status='posted'`, visible in Posted tab | ✅ PASS | `jobs/page.tsx` `handleCreateJob()` — errors surfaced, companyId guard, status filter reset | None |
| Status filter tabs | Admin | `/admin/jobs` | — | Client filter | Correct counts | ✅ PASS | `jobs/page.tsx` `filterJobs()` | None |
| Post job (draft→posted) | Admin | `/admin/jobs` | `jobs` | UPDATE | Status changes in DB | ✅ PASS | `jobs/page.tsx` `handlePostJob()` error surfaced | None |
| Update job status (inline select) | Admin | `/admin/jobs` | `jobs` | UPDATE | DB row updated | ✅ PASS | `jobs/page.tsx` `handleStatusChange()` | None |
| View job detail | Admin | `/admin/jobs/[id]` | `jobs` | SELECT single | Job loads from DB | ✅ PASS (after fix) | `jobs/[id]/page.tsx` `loadJob()` — **was FAIL: localStorage only** | ✅ Fixed |
| Edit job (save) | Admin | `/admin/jobs/[id]` | `jobs` | UPDATE | DB row updated | ✅ PASS (after fix) | `jobs/[id]/page.tsx` `handleSave()` — **was FAIL: localStorage only** | ✅ Fixed |
| Delete job | Admin | `/admin/jobs/[id]` | `jobs` | DELETE | Row removed from DB | ✅ PASS (after fix) | `jobs/[id]/page.tsx` `handleDelete()` — **was FAIL: localStorage only** | ✅ Fixed |
| Generate invoice from job | Admin | `/admin/jobs/[id]` | — | localStorage temp | Navigate to invoice create | ⚠️ FAKE | Uses `localStorage.setItem('temp_invoice_data', ...)` then `router.push('/admin/invoices/new')` — invoice not in DB | Depends on invoices DB table (MISSING) |
| **QUOTES** | | | | | | | | |
| List quotes | Admin | `/admin/quotes` | `quotes` | SELECT | All rows from DB | ✅ PASS | `quotes/page.tsx` `loadQuotes()` | None |
| Create quote | Admin | `/admin/quotes` | `quotes` | INSERT | Row in DB + list refresh | ✅ PASS | `quotes/page.tsx` `handleCreate()` error surfaced | None |
| Update quote status | Admin | `/admin/quotes` | `quotes` | UPDATE | — | ➖ MISSING | No accept/decline button in quotes UI | Add action buttons |
| **BIDS** | | | | | | | | |
| List bids | Admin | `/admin/bids` | `job_bids` | SELECT | All bids from DB | ✅ PASS | `bids/page.tsx` `loadBids()` | None |
| Accept bid | Admin | `/admin/bids` | `job_bids` | UPDATE `status='accepted'` | DB row updated | ✅ PASS (after fix) | `bids/page.tsx` `updateStatus()` — **was FAIL: silent error** | ✅ Fixed |
| Reject bid | Admin | `/admin/bids` | `job_bids` | UPDATE `status='rejected'` | DB row updated | ✅ PASS (after fix) | `bids/page.tsx` `updateStatus()` — **was FAIL: silent error** | ✅ Fixed |
| **DOCUMENTS** | | | | | | | | |
| List driver documents | Admin | `/admin/documents` | `driver_documents` | SELECT + JOIN `drivers` | Docs with driver name | ✅ PASS | `documents/page.tsx` `loadDocs()` | None |
| List vehicle documents | Admin | `/admin/documents` | `vehicle_documents` | SELECT + JOIN `vehicles` | Docs with reg plate | ✅ PASS | `documents/page.tsx` `loadDocs()` | None |
| Approve document | Admin | `/admin/documents` | `driver_documents` / `vehicle_documents` | UPDATE `status='approved'` | DB row updated | ✅ PASS (after fix) | `documents/page.tsx` `updateStatus()` — **was FAIL: silent error** | ✅ Fixed |
| Reject document | Admin | `/admin/documents` | `driver_documents` / `vehicle_documents` | UPDATE `status='rejected'` | DB row updated | ✅ PASS (after fix) | `documents/page.tsx` `updateStatus()` — **was FAIL: silent error** | ✅ Fixed |
| Upload new document | Admin | `/admin/documents` | — | — | Store file + DB row | ➖ MISSING | No upload form in documents UI | Add upload component |
| **INVOICES** | | | | | | | | |
| List invoices | Admin | `/admin/invoices` | `invoices` (DB) | SELECT | Invoices from DB | ⚠️ FAKE | Reads from `localStorage` only; no `invoices` table in Supabase schema | Requires `invoices` table + migration |
| Create invoice | Admin | `/admin/invoices/new` | `invoices` (DB) | INSERT | Row in DB | ⚠️ FAKE | Saves to `localStorage` only | Requires `invoices` table + migration |
| View invoice detail | Admin | `/admin/invoices/[id]` | `invoices` (DB) | SELECT | Load from DB | ⚠️ FAKE | Reads from `localStorage` | Requires `invoices` table + migration |
| **SETTINGS** | | | | | | | | |
| View settings | Admin | `/admin/settings` | — | — | Load company settings | ⚠️ FAKE | Pre-fills from hardcoded `COMPANY_CONFIG`; no DB read | Add `company_settings` table |
| Save settings | Admin | `/admin/settings` | — | localStorage | Persist to localStorage | ⚠️ FAKE | Uses `localStorage.setItem('danny_admin_settings', ...)` — not persisted to DB | Add `company_settings` table |
| **DASHBOARD KPIs** | | | | | | | | |
| Active Jobs count | Admin | `/admin` | `jobs` | COUNT WHERE status IN (`posted`,`allocated`,`in_transit`) | Correct count | ✅ PASS | `admin/page.tsx` `Promise.all` query | None |
| Pending Quotes count | Admin | `/admin` | `quotes` | COUNT WHERE status IN (`draft`,`sent`) | Correct count | ✅ PASS | `admin/page.tsx` | None |
| Active Drivers count | Admin | `/admin` | `drivers` | COUNT WHERE status=`active` | Correct count | ✅ PASS | `admin/page.tsx` | None |
| Completed Today count | Admin | `/admin` | `jobs` | COUNT WHERE status=`delivered` AND `updated_at` >= today | Correct count | ✅ PASS | `admin/page.tsx` | None |
| Generate Report (CSV) | Admin | `/admin` | — | CSV download | Downloads real KPI data | ✅ PASS | `admin/page.tsx` `generateReport()` — uses live `stats` state | None |
