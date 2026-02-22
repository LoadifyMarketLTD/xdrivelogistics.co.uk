# Manual Test Steps — Danny Courier Ltd Dashboard

These are click-by-click steps for each dashboard feature. Run after deploying with valid Supabase credentials.

---

## Prerequisites
- Supabase project configured with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Schema migrations applied (run all `supabase/migrations/` files)
- At least one user created in Supabase auth dashboard
- App running at `http://localhost:3000` (or deployed URL)

---

## AUTH

### Login
1. Navigate to `http://localhost:3000/login`
2. Enter email + password for a valid Supabase user
3. Click **Sign In**
4. **Expected:** Redirect to `/admin`, sidebar visible, user email shown in footer

### Logout
1. From any admin page, click **Logout** in the sidebar footer
2. **Expected:** Redirect to `/login`, protected pages no longer accessible

### Protected Route (unauthenticated)
1. Log out
2. Navigate directly to `http://localhost:3000/admin/jobs`
3. **Expected:** Redirect to `/login`

---

## COMPANIES

### Create Company
1. Navigate to `/admin/companies`
2. Click **+ Create Company**
3. Fill in **Company Name** (required), optionally fill other fields
4. Click **Create Company**
5. **Expected:** Modal closes, new company appears in table immediately
6. **Verify in Supabase:** `SELECT * FROM companies ORDER BY created_at DESC LIMIT 1`

### List Companies
1. Navigate to `/admin/companies`
2. **Expected:** Table shows rows from Supabase `companies` table (not hardcoded)
3. If no companies exist: empty-state illustration visible

---

## DRIVERS

### Add Driver
1. Navigate to `/admin/drivers`
2. Click **+ Add Driver**
3. Fill **Full Name** (required)
4. Select a company from the **Company** dropdown (populated from DB)
5. Optionally fill Email and Phone
6. Click **Add Driver**
7. **Expected:** Modal closes, new driver appears in table with status `active`
8. **Verify in Supabase:** `SELECT * FROM drivers ORDER BY created_at DESC LIMIT 1`

### Company Dropdown (DB-driven)
1. Open the Add Driver modal
2. **Expected:** The Company dropdown lists real company names from `companies` table, not hardcoded values

---

## VEHICLES

### Add Vehicle
1. Navigate to `/admin/vehicles`
2. Click **+ Add Vehicle**
3. Select a company (required)
4. Select vehicle type, fill Reg Plate, Make, Model, Payload
5. Optionally tick **Has Tail Lift**
6. Click **Add Vehicle**
7. **Expected:** Modal closes, vehicle appears in table
8. **Verify:** `SELECT * FROM vehicles ORDER BY created_at DESC LIMIT 1`

---

## JOBS

### Create Job
1. Navigate to `/admin/jobs`
2. Click **+ Create Job**
3. Fill all required fields: client name, phone, pickup location/date/time, delivery location/date/time
4. Set cargo type and quantity
5. Click **Create Job**
6. **Expected:**
   - Modal closes
   - Filter resets to "All Jobs"
   - New job appears in list with status badge **Posted**
   - Posted tab count increments
7. **Verify:** `SELECT status, load_details FROM jobs ORDER BY created_at DESC LIMIT 1` — should return `status='posted'`

### View Job Detail
1. From `/admin/jobs`, click **View** on any job
2. **Expected:** `/admin/jobs/[id]` loads showing pickup, delivery, cargo, and status from DB (not "Job not found")

### Edit Job
1. On the job detail page, click **Edit**
2. Change Pickup Location, Status, or Cargo Notes
3. Click **Save Changes**
4. **Expected:** Changes persist — reload the page and values remain
5. **Verify:** `SELECT pickup_location, status FROM jobs WHERE id='<uuid>'`

### Delete Job
1. On the job detail page, click **Delete** → confirm
2. **Expected:** Redirect to `/admin/jobs`; deleted job no longer appears in list
3. **Verify:** `SELECT id FROM jobs WHERE id='<uuid>'` → 0 rows

### Status Update (inline)
1. From `/admin/jobs` list, find a job with status **Posted**
2. Change the status dropdown to **Allocated**
3. **Expected:** Badge updates immediately; change persists on page reload

---

## QUOTES

### Create Quote
1. Navigate to `/admin/quotes`
2. Click **+ New Quote**
3. Select a company, fill Customer Name (required), and other fields
4. Enter an Amount
5. Click **Create Quote**
6. **Expected:** Modal closes, quote appears in table with status `draft`
7. **Verify:** `SELECT * FROM quotes ORDER BY created_at DESC LIMIT 1`

---

## BIDS

### View Bids
1. Navigate to `/admin/bids`
2. **Expected:** Table shows bids from `job_bids` table; "No bids yet" if empty

### Accept a Bid
1. Find a bid with status **submitted**
2. Click **Accept**
3. **Expected:** Row status updates to **accepted**; Accept button disappears
4. **Verify:** `SELECT status FROM job_bids WHERE id='<uuid>'`

### Reject a Bid
1. Find a bid with status **submitted**
2. Click **Reject**
3. **Expected:** Row status updates to **rejected**
4. **Verify:** `SELECT status FROM job_bids WHERE id='<uuid>'`

---

## DOCUMENTS

### View Driver Documents
1. Navigate to `/admin/documents`
2. The **Driver Documents** tab should be active
3. **Expected:** Table shows rows from `driver_documents` joined with driver name

### Approve a Document
1. Find a document with status **pending**
2. Click **Approve**
3. **Expected:** Status badge changes to **approved**; Approve button disappears
4. **Verify:** `SELECT status FROM driver_documents WHERE id='<uuid>'`

### Reject a Document
1. Find a document with status **pending**
2. Click **Reject**
3. **Expected:** Status badge changes to **rejected**

### Vehicle Documents Tab
1. Click the **Vehicle Documents** tab
2. **Expected:** Table shows vehicle documents joined with vehicle reg plate

---

## INVOICES (FAKE/STUB — localStorage only)

> ⚠️ Invoices are stored in browser localStorage. Data is not shared across devices or persisted in Supabase.

### Create Invoice
1. Navigate to `/admin/invoices`
2. Click **+ Create New Invoice**
3. Fill invoice fields, click **Save**
4. **Expected:** Invoice appears in list on this device/browser only

---

## SETTINGS (FAKE/STUB — localStorage only)

> ⚠️ Settings are saved to browser localStorage. Not persisted to DB.

### Save Settings
1. Navigate to `/admin/settings`
2. Modify Company Name or VAT rate
3. Click **Save Settings**
4. **Expected:** Green "Settings saved successfully!" banner appears
5. Reload page — fields pre-fill from `COMPANY_CONFIG` defaults (localStorage-saved values not re-loaded; this is a known limitation)

---

## DASHBOARD KPIs

### Verify Counts
1. Navigate to `/admin`
2. **Expected:** 4 KPI cards show counts:
   - **Active Jobs** = jobs with status `posted`, `allocated`, or `in_transit`
   - **Pending Quotes** = quotes with status `draft` or `sent`
   - **Active Drivers** = drivers with status `active`
   - **Completed Today** = jobs with status `delivered` AND `updated_at` >= today (UTC)
3. Create a new job (see Jobs section) → Active Jobs count should increment
4. Deliver a job → Completed Today should increment

### Generate Report
1. On `/admin`, click **Generate Report**
2. **Expected:** CSV file downloads named `danny-courier-report-YYYY-MM-DD.csv`
3. Open CSV — should contain the 4 KPI values from the dashboard
