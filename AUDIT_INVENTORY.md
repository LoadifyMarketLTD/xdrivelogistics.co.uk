# Audit Inventory — Danny Courier Ltd Dashboard

## 1. Routes (all `app/**/page.tsx`)

| Route | File | Type |
|---|---|---|
| `/` | `app/page.tsx` | Marketing landing page |
| `/login` | `app/login/page.tsx` | Auth – login only (no register) |
| `/admin` | `app/admin/page.tsx` | Dashboard home + KPIs |
| `/admin/jobs` | `app/admin/jobs/page.tsx` | Jobs list + create modal |
| `/admin/jobs/[id]` | `app/admin/jobs/[id]/page.tsx` | Job detail, edit, delete |
| `/admin/companies` | `app/admin/companies/page.tsx` | Companies list + create modal |
| `/admin/drivers` | `app/admin/drivers/page.tsx` | Drivers list + create modal |
| `/admin/vehicles` | `app/admin/vehicles/page.tsx` | Vehicles list + create modal |
| `/admin/quotes` | `app/admin/quotes/page.tsx` | Quotes list + create modal |
| `/admin/bids` | `app/admin/bids/page.tsx` | Job bids list + accept/reject |
| `/admin/documents` | `app/admin/documents/page.tsx` | Driver & vehicle doc review/approve |
| `/admin/invoices` | `app/admin/invoices/page.tsx` | Invoices list (localStorage only) |
| `/admin/invoices/[id]` | `app/admin/invoices/[id]/page.tsx` | Invoice create/edit/view (localStorage only) |
| `/admin/settings` | `app/admin/settings/page.tsx` | Settings form (localStorage only) |
| `/m` | `app/m/page.tsx` | Mobile driver dashboard |
| `/m/jobs` | `app/m/jobs/page.tsx` | Mobile jobs list |
| `/m/jobs/[id]` | `app/m/jobs/[id]/page.tsx` | Mobile job detail |
| `/privacy` | `app/privacy/page.tsx` | Privacy policy (static) |
| `/terms` | `app/terms/page.tsx` | Terms of service (static) |
| `/cookies` | `app/cookies/page.tsx` | Cookie policy (static) |

**MISSING routes:**
- `/register` — No sign-up/registration page exists.

---

## 2. Sidebar Menu Items (from `app/admin/page.tsx`)

| Menu ID | Label | Route |
|---|---|---|
| `dashboard` | Dashboard | stays on `/admin` |
| `invoices` | Invoices | `/admin/invoices` |
| `jobs` | Jobs | `/admin/jobs` |
| `companies` | Companies | `/admin/companies` |
| `drivers` | Drivers | `/admin/drivers` |
| `vehicles` | Vehicles | `/admin/vehicles` |
| `documents` | Documents | `/admin/documents` |
| `bids` | Bids | `/admin/bids` |
| `quotes` | Quotes | `/admin/quotes` |
| `settings` | Settings | `/admin/settings` |

All routes exist as real pages. No broken `router.push` destinations.

---

## 3. Supabase Table Interactions

| Table | Operations | Page |
|---|---|---|
| `jobs` | SELECT, INSERT, UPDATE, DELETE | `admin/jobs/page.tsx`, `admin/jobs/[id]/page.tsx` |
| `companies` | SELECT, INSERT | `admin/companies/page.tsx` |
| `drivers` | SELECT, INSERT | `admin/drivers/page.tsx` |
| `vehicles` | SELECT, INSERT | `admin/vehicles/page.tsx` |
| `quotes` | SELECT, INSERT | `admin/quotes/page.tsx` |
| `job_bids` | SELECT, UPDATE (status) | `admin/bids/page.tsx` |
| `driver_documents` | SELECT, UPDATE (status) | `admin/documents/page.tsx` |
| `vehicle_documents` | SELECT, UPDATE (status) | `admin/documents/page.tsx` |
| `company_memberships` | SELECT | `admin/jobs/page.tsx` (get companyId) |
| `auth.users` | Supabase auth | `lib/supabaseClient.ts`, `AuthContext.tsx` |

**No Supabase interaction (localStorage / hardcoded):**
- `invoices` — stored in `localStorage` only; no DB table in schema
- Settings — stored in `localStorage` only; no DB table in schema

---

## 4. Database Tables (from `supabase/migrations/001_initial_schema.sql`)

| Table | Key Columns | Notes |
|---|---|---|
| `profiles` | `id`, `full_name`, `role`, `company_id` | Linked to `auth.users` |
| `companies` | `id`, `name`, `company_number`, `status`, `company_type` | |
| `company_memberships` | `company_id`, `user_id`, `role_in_company`, `status` | |
| `drivers` | `id`, `company_id`, `display_name`, `status` | |
| `vehicles` | `id`, `company_id`, `type` (ENUM), `reg_plate` | |
| `driver_documents` | `id`, `driver_id`, `doc_type`, `status` (ENUM) | |
| `vehicle_documents` | `id`, `vehicle_id`, `doc_type`, `status` (ENUM) | |
| `jobs` | `id`, `company_id`, `status` (ENUM `job_status`) | ENUM: `draft`, `posted`, `allocated`, `in_transit`, `delivered`, `cancelled`, `disputed` |
| `job_bids` | `id`, `job_id`, `bidder_user_id`, `amount`, `status` | |
| `job_tracking_events` | `id`, `job_id`, `event_type` | |
| `job_driver_distance_cache` | `job_id`, `driver_id` | |
| `quotes` | `id`, `company_id`, `customer_name`, `amount`, `status` | |
| `diary_events` | `id`, `company_id`, `title`, `start_at` | UI not implemented |
| `return_journeys` | `id`, `company_id`, `from_postcode`, `to_postcode` | UI not implemented |
| `driver_locations` | `driver_id`, `lat`, `lng` | UI not implemented |

**Table referenced in UI but absent from schema:**
- `invoices` — does NOT exist in DB; invoice UI uses localStorage only

---

## 5. ENUMs (Supabase)

| ENUM | Values |
|---|---|
| `job_status` | `draft`, `posted`, `allocated`, `in_transit`, `delivered`, `cancelled`, `disputed` |
| `vehicle_type` | `bicycle`, `motorbike`, `car`, `van_small`, `van_large`, `luton`, `truck_7_5t`, `truck_18t`, `artic` |
| `cargo_type` | `documents`, `packages`, `pallets`, `furniture`, `equipment`, `other` |
| `tracking_event_type` | `created`, `allocated`, `driver_en_route`, `arrived_pickup`, `collected`, `in_transit`, `arrived_delivery`, `delivered`, `failed`, `cancelled`, `note` |

**Config alias (`app/config/company.ts`):**
```
JOB_STATUS.RECEIVED = 'draft'
JOB_STATUS.POSTED   = 'posted'
JOB_STATUS.ALLOCATED = 'allocated'
JOB_STATUS.DELIVERED = 'delivered'
```

---

## 6. RLS Policies (from `supabase/migrations/001_initial_schema.sql`)

| Table | Policy | Rule |
|---|---|---|
| `profiles` | `profiles_select_own` | SELECT own row only |
| `companies` | `companies_select_member` | SELECT if member |
| `companies` | `companies_insert_admin` | INSERT if authenticated |
| `company_memberships` | `memberships_select_member` | SELECT if member |
| `company_memberships` | `memberships_insert_admin` | INSERT if company admin |
| `drivers` | `drivers_select_member` | SELECT if member |
| `drivers` | `drivers_all_admin` | ALL if company admin |
| `vehicles` | `vehicles_select_member` | SELECT if member |
| `vehicles` | `vehicles_all_admin` | ALL if company admin |
| `driver_documents` | `driver_docs_select_member` | SELECT via driver |
| `driver_documents` | `driver_docs_all_admin` | ALL via driver admin |
| `vehicle_documents` | `vehicle_docs_select_member` | SELECT via vehicle |
| `vehicle_documents` | `vehicle_docs_all_admin` | ALL via vehicle admin |
| `jobs` | `jobs_all_member` | ALL if company member |
| `job_bids` | `bids_all_member` | ALL if company member (or null company) |
| `quotes` | `quotes_all_member` | ALL if company member |

**RLS Risk:** `jobs_all_member` uses `USING` (not `WITH CHECK`) for INSERT — this means inserts with a `company_id` the user is NOT a member of will fail silently (no row returned, no explicit error in some drivers). The `companyId` guard in `handleCreateJob` prevents null IDs.
