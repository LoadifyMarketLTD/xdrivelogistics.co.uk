# Supabase AI Assistant — XDrive Logistics Prompt

> ⚠️ **DO NOT paste this `.md` file into the Supabase SQL Editor.**
> Markdown headings (`#`) are not valid SQL and will cause a syntax error.
>
> **To run the SQL directly**, open the file:
> ```
> supabase/migrations/017_complete_idempotent_setup.sql
> ```
> Copy its entire contents and paste them into the Supabase **SQL Editor**, then click **Run**.
> That file is pure SQL with no Markdown — it is safe to run as-is.
>
> **To use the Supabase AI assistant instead:**
> 1. Open your Supabase project → **SQL Editor** → click the **"Supabase AI"** button (✨ icon).
> 2. Copy the text from **"PROMPT START"** to **"PROMPT END"** below and paste it into the AI chat.
> 3. Let the assistant generate any missing SQL, then click **Run** on the SQL it produces.
> 4. After the AI responds, run **`supabase/health_check.sql`** in the SQL Editor to verify
>    column presence, then run either **`supabase/complete_fix.sql`** or
>    **`supabase/migrations/017_complete_idempotent_setup.sql`** to apply all missing objects.
>    All three files contain pure SQL and can be pasted directly into the SQL Editor.

---

## ─── PROMPT START ───────────────────────────────────────────────────────────

You are helping me set up the Supabase PostgreSQL database for **XDrive Logistics**
— a UK courier management platform (xdrivelogistics.co.uk).

The site has three interfaces:
- **Admin portal** (`/admin/*`) — company owners manage jobs, drivers, vehicles,
  quotes, invoices, documents, and bids.
- **Mobile dispatcher** (`/m/*`) — simplified view for mobile operators.
- **Driver app** (`/driver/*`) — PIN-based app for drivers to view jobs, record
  collection photos, delivery photos, and client signatures.

Please do the following:

1. **Check** whether each table and column listed below exists in `public` schema.
2. **Generate idempotent SQL** (`IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`) to
   create or add anything that is missing.
3. **Ensure RLS is enabled** on every table and the correct policies exist.
4. End with `NOTIFY pgrst, 'reload schema';` so PostgREST picks up the changes.

### Expected ENUMs

| Type name | Values |
|---|---|
| `vehicle_type` | `bicycle`, `motorbike`, `car`, `van_small`, `van_large`, `luton`, `truck_7_5t`, `truck_18t`, `artic` |
| `cargo_type` | `documents`, `packages`, `pallets`, `furniture`, `equipment`, `other` |
| `job_status` | `draft`, `posted`, `allocated`, `in_transit`, `delivered`, `cancelled`, `disputed` |
| `company_role` | `owner`, `admin`, `dispatcher`, `viewer` |
| `membership_status` | `invited`, `active`, `suspended` |
| `doc_status` | `pending`, `approved`, `rejected`, `expired` |
| `tracking_event_type` | `created`, `allocated`, `driver_en_route`, `arrived_pickup`, `collected`, `in_transit`, `arrived_delivery`, `delivered`, `failed`, `cancelled`, `note` |
| `invoice_status` | `Pending`, `Paid`, `Overdue` |

### Expected Tables & Required Columns

#### `public.profiles`
Extends `auth.users` (1-to-1, same PK).

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` | REFERENCES `auth.users(id)` ON DELETE CASCADE |
| `full_name` | `text` | |
| `phone` | `text` | |
| `email` | `text` | |
| `role` | `text` | e.g. `'viewer'` |
| `company_id` | `uuid` | REFERENCES `companies(id)` ON DELETE SET NULL |
| `is_driver` | `boolean` | DEFAULT false |
| `created_at` | `timestamptz` | DEFAULT now() |
| `updated_at` | `timestamptz` | DEFAULT now() |

#### `public.companies`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` | DEFAULT gen_random_uuid() |
| `name` | `text NOT NULL` | |
| `company_number` | `text` | |
| `vat_number` | `text` | |
| `email` | `text` | |
| `phone` | `text` | |
| `address_line1` | `text` | |
| `address_line2` | `text` | |
| `city` | `text` | |
| `postcode` | `text` | |
| `country` | `text` | DEFAULT `'UK'` |
| `status` | `text` | DEFAULT `'active'` |
| `company_type` | `text` | DEFAULT `'standard'` |
| `created_by` | `uuid` | REFERENCES `auth.users(id)` |
| `created_at` | `timestamptz` | DEFAULT now() |

#### `public.company_memberships`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` | |
| `company_id` | `uuid NOT NULL` | REFERENCES `companies(id)` ON DELETE CASCADE |
| `user_id` | `uuid` | REFERENCES `auth.users(id)` ON DELETE CASCADE |
| `invited_email` | `text` | |
| `role_in_company` | `public.company_role` | DEFAULT `'viewer'` |
| `status` | `public.membership_status` | DEFAULT `'invited'` |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |
| UNIQUE | `(company_id, user_id)` | |

#### `public.drivers`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` | |
| `company_id` | `uuid NOT NULL` | REFERENCES `companies(id)` ON DELETE CASCADE |
| `user_id` | `uuid` | REFERENCES `auth.users(id)` ON DELETE SET NULL |
| `display_name` | `text NOT NULL` | **used by Add Driver form** |
| `phone` | `text` | |
| `email` | `text` | |
| `status` | `text` | DEFAULT `'active'` |
| `login_pin` | `text` | PIN for driver app login |
| `app_access` | `boolean NOT NULL` | DEFAULT false |
| `last_app_login` | `timestamptz` | updated on each driver login |
| `device_token` | `text` | for push notifications |
| `created_at` | `timestamptz` | DEFAULT now() |

#### `public.vehicles`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` | |
| `company_id` | `uuid NOT NULL` | REFERENCES `companies(id)` ON DELETE CASCADE — **used by Add Vehicle form** |
| `assigned_driver_id` | `uuid` | REFERENCES `drivers(id)` ON DELETE SET NULL |
| `type` | `public.vehicle_type NOT NULL` | |
| `reg_plate` | `text` | |
| `make` | `text` | |
| `model` | `text` | |
| `payload_kg` | `numeric` | |
| `pallets_capacity` | `int` | |
| `has_tail_lift` | `boolean` | DEFAULT false |
| `has_straps` | `boolean` | DEFAULT false |
| `has_blankets` | `boolean` | DEFAULT false |
| `created_at` | `timestamptz` | DEFAULT now() |

#### `public.driver_documents`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` | |
| `driver_id` | `uuid NOT NULL` | REFERENCES `drivers(id)` ON DELETE CASCADE |
| `doc_type` | `text NOT NULL` | |
| `file_path` | `text` | Storage path |
| `issued_date` | `date` | |
| `expiry_date` | `date` | |
| `status` | `public.doc_status` | DEFAULT `'pending'` |
| `rejection_reason` | `text` | |
| `verified_by` | `uuid` | REFERENCES `auth.users(id)` |
| `verified_at` | `timestamptz` | |
| `created_at` | `timestamptz` | DEFAULT now() |

#### `public.vehicle_documents`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` | |
| `vehicle_id` | `uuid NOT NULL` | REFERENCES `vehicles(id)` ON DELETE CASCADE |
| `doc_type` | `text NOT NULL` | |
| `file_path` | `text` | |
| `issued_date` | `date` | |
| `expiry_date` | `date` | |
| `status` | `public.doc_status` | DEFAULT `'pending'` |
| `rejection_reason` | `text` | |
| `verified_by` | `uuid` | REFERENCES `auth.users(id)` |
| `verified_at` | `timestamptz` | |
| `created_at` | `timestamptz` | DEFAULT now() |

#### `public.jobs`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` | |
| `company_id` | `uuid NOT NULL` | REFERENCES `companies(id)` ON DELETE CASCADE |
| `created_by` | `uuid` | REFERENCES `auth.users(id)` |
| `assigned_driver_id` | `uuid` | REFERENCES `drivers(id)` ON DELETE SET NULL — **used by driver app** |
| `status` | `public.job_status` | DEFAULT `'draft'` |
| `vehicle_type` | `public.vehicle_type` | |
| `cargo_type` | `public.cargo_type` | |
| `pickup_location` | `text` | |
| `pickup_postcode` | `text` | |
| `pickup_lat` | `double precision` | |
| `pickup_lng` | `double precision` | |
| `pickup_datetime` | `timestamptz` | |
| `delivery_location` | `text` | |
| `delivery_postcode` | `text` | |
| `delivery_lat` | `double precision` | |
| `delivery_lng` | `double precision` | |
| `delivery_datetime` | `timestamptz` | |
| `pallets` | `int` | |
| `boxes` | `int` | |
| `bags` | `int` | |
| `items` | `int` | |
| `weight_kg` | `numeric` | |
| `length_cm` | `numeric` | |
| `width_cm` | `numeric` | |
| `height_cm` | `numeric` | |
| `currency` | `text` | DEFAULT `'GBP'` |
| `budget_amount` | `numeric` | |
| `is_fixed_price` | `boolean` | DEFAULT false |
| `load_details` | `text` | |
| `special_requirements` | `text` | |
| `access_restrictions` | `text` | |
| `job_distance_miles` | `numeric` | |
| `job_distance_minutes` | `int` | |
| `distance_to_pickup_miles` | `numeric` | |
| `collection_photo_url` | `text` | uploaded by driver at pickup |
| `delivery_photos` | `text[]` | array of data-URLs / Storage paths |
| `delivery_signature_data` | `text` | base-64 canvas PNG |
| `status_history` | `jsonb` | DEFAULT `'[]'` — array of `{status, timestamp}` |
| `driver_notes` | `text` | |
| `client_signature_name` | `text` | |
| `created_at` | `timestamptz` | DEFAULT now() |
| `updated_at` | `timestamptz` | DEFAULT now() |

#### `public.job_bids`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` | |
| `job_id` | `uuid NOT NULL` | REFERENCES `jobs(id)` ON DELETE CASCADE |
| `company_id` | `uuid` | REFERENCES `companies(id)` ON DELETE CASCADE |
| `bidder_user_id` | `uuid` | REFERENCES `auth.users(id)` |
| `bidder_id` | `uuid` | Legacy alias of `bidder_user_id` — kept for backwards compatibility; the `sync_job_bid_price` trigger keeps both in sync |
| `bidder_driver_id` | `uuid` | REFERENCES `drivers(id)` |
| `amount` | `numeric(12,2)` | |
| `bid_price_gbp` | `numeric(12,2)` | Legacy alias of `amount` — kept for backwards compatibility; the `sync_job_bid_price` trigger keeps both in sync |
| `currency` | `text` | DEFAULT `'GBP'` |
| `message` | `text` | |
| `status` | `text` | DEFAULT `'pending'` |
| `created_at` | `timestamptz` | DEFAULT now() |

#### `public.job_notes`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` | |
| `job_id` | `uuid NOT NULL` | REFERENCES `jobs(id)` ON DELETE CASCADE |
| `company_id` | `uuid NOT NULL` | REFERENCES `companies(id)` ON DELETE CASCADE |
| `created_by` | `uuid` | REFERENCES `auth.users(id)` |
| `note` | `text NOT NULL` | |
| `created_at` | `timestamptz` | DEFAULT now() |

#### `public.job_documents`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` | |
| `job_id` | `uuid NOT NULL` | REFERENCES `jobs(id)` ON DELETE CASCADE |
| `uploaded_by` | `uuid` | REFERENCES `auth.users(id)` |
| `doc_type` | `text NOT NULL` | |
| `file_path` | `text` | |
| `created_at` | `timestamptz` | DEFAULT now() |

#### `public.job_tracking_events`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` | |
| `job_id` | `uuid NOT NULL` | REFERENCES `jobs(id)` ON DELETE CASCADE |
| `event_type` | `public.tracking_event_type NOT NULL` | |
| `created_by` | `uuid` | REFERENCES `auth.users(id)` |
| `note` | `text` | |
| `lat` | `double precision` | |
| `lng` | `double precision` | |
| `created_at` | `timestamptz` | DEFAULT now() |

#### `public.driver_locations`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` | |
| `driver_id` | `uuid NOT NULL` | REFERENCES `drivers(id)` ON DELETE CASCADE |
| `company_id` | `uuid` | REFERENCES `companies(id)` ON DELETE SET NULL |
| `job_id` | `uuid` | REFERENCES `jobs(id)` ON DELETE SET NULL |
| `lat` | `double precision NOT NULL` | |
| `lng` | `double precision NOT NULL` | |
| `heading` | `double precision` | |
| `speed_mph` | `double precision` | |
| `recorded_at` | `timestamptz NOT NULL` | DEFAULT now() |
| `updated_at` | `timestamptz NOT NULL` | DEFAULT now() |

#### `public.job_driver_distance_cache`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` | |
| `job_id` | `uuid NOT NULL` | REFERENCES `jobs(id)` ON DELETE CASCADE |
| `driver_id` | `uuid NOT NULL` | REFERENCES `drivers(id)` ON DELETE CASCADE |
| `distance_miles` | `numeric` | |
| `duration_minutes` | `int` | |
| `calculated_at` | `timestamptz` | DEFAULT now() |

#### `public.quotes`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` | |
| `company_id` | `uuid NOT NULL` | REFERENCES `companies(id)` ON DELETE CASCADE — **used by New Quote form** |
| `created_by` | `uuid` | REFERENCES `auth.users(id)` |
| `customer_name` | `text` | |
| `customer_email` | `text` | |
| `customer_phone` | `text` | |
| `pickup_location` | `text` | |
| `delivery_location` | `text` | |
| `vehicle_type` | `public.vehicle_type` | |
| `cargo_type` | `public.cargo_type` | |
| `amount` | `numeric` | |
| `currency` | `text` | DEFAULT `'GBP'` |
| `status` | `text` | DEFAULT `'draft'` |
| `created_at` | `timestamptz` | DEFAULT now() |

#### `public.diary_events`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` | |
| `company_id` | `uuid NOT NULL` | REFERENCES `companies(id)` ON DELETE CASCADE |
| `driver_id` | `uuid` | REFERENCES `drivers(id)` ON DELETE SET NULL |
| `vehicle_id` | `uuid` | REFERENCES `vehicles(id)` ON DELETE SET NULL |
| `title` | `text NOT NULL` | |
| `start_at` | `timestamptz NOT NULL` | |
| `end_at` | `timestamptz` | |
| `meta` | `jsonb` | |
| `created_at` | `timestamptz` | DEFAULT now() |

#### `public.return_journeys`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` | |
| `company_id` | `uuid NOT NULL` | REFERENCES `companies(id)` ON DELETE CASCADE |
| `driver_id` | `uuid` | REFERENCES `drivers(id)` ON DELETE SET NULL |
| `vehicle_type` | `public.vehicle_type` | |
| `from_postcode` | `text` | |
| `to_postcode` | `text` | |
| `available_from` | `timestamptz` | |
| `available_to` | `timestamptz` | |
| `notes` | `text` | |
| `status` | `text` | DEFAULT `'available'` |
| `created_at` | `timestamptz` | DEFAULT now() |

#### `public.invoices`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` | |
| `company_id` | `uuid NOT NULL` | REFERENCES `companies(id)` ON DELETE CASCADE |
| `created_by` | `uuid` | REFERENCES `auth.users(id)` |
| `invoice_number` | `text NOT NULL` | UNIQUE per company |
| `job_ref` | `text NOT NULL` | |
| `job_id` | `uuid` | REFERENCES `jobs(id)` ON DELETE SET NULL |
| `invoice_date` | `date NOT NULL` | DEFAULT CURRENT_DATE |
| `due_date` | `date NOT NULL` | |
| `status` | `public.invoice_status NOT NULL` | DEFAULT `'Pending'` |
| `client_name` | `text NOT NULL` | |
| `client_address` | `text` | |
| `client_email` | `text` | |
| `pickup_location` | `text` | |
| `pickup_datetime` | `timestamptz` | |
| `delivery_location` | `text` | |
| `delivery_datetime` | `timestamptz` | |
| `delivery_recipient` | `text` | |
| `service_description` | `text` | |
| `amount` | `numeric NOT NULL` | DEFAULT 0 |
| `net_amount` | `numeric NOT NULL` | DEFAULT 0 |
| `vat_amount` | `numeric NOT NULL` | DEFAULT 0 |
| `vat_rate` | `smallint NOT NULL` | CHECK IN (0, 5, 20), DEFAULT 0 |
| `currency` | `text NOT NULL` | DEFAULT `'GBP'` |
| `payment_terms` | `text NOT NULL` | DEFAULT `'14 days'` |
| `late_fee` | `text` | |
| `pod_photos` | `text[]` | proof-of-delivery photo URLs |
| `signature` | `text` | base-64 signature image |
| `recipient_name` | `text` | |
| `created_at` | `timestamptz NOT NULL` | DEFAULT now() |
| `updated_at` | `timestamptz NOT NULL` | DEFAULT now() |

### Required Helper Functions

| Function | Purpose |
|---|---|
| `public.is_company_member(cid uuid) → boolean` | Returns true if `auth.uid()` is a non-suspended member of `cid` |
| `public.is_company_admin(cid uuid) → boolean` | Returns true if member has role `owner` or `admin` |
| `public.get_or_create_company_for_user() → uuid` | Auto-provisions a company for first-time users |
| `public.next_invoice_number(p_company_id uuid) → text` | Returns next `INV-YYYYMM-NNN` string |
| `public.sync_job_bid_price()` | TRIGGER fn — keeps `amount` ↔ `bid_price_gbp` and `bidder_id` ↔ `bidder_user_id` in sync |
| `public.set_invoices_updated_at()` | TRIGGER fn — sets `updated_at = now()` on invoice updates |

### Required RLS Policies (for every table)

Every table must have RLS **enabled**. The pattern is:
- `SELECT` / `ALL` allowed for non-suspended company members (`is_company_member`)
- `INSERT` / `UPDATE` / `DELETE` for company admins/owners (`is_company_admin`)
- Exceptions: `profiles` is self-access only; `companies` also allows access by `created_by`

Please generate idempotent SQL (using `IF NOT EXISTS`) to create any missing
tables, columns, enums, functions, triggers, and policies.

## ─── PROMPT END ─────────────────────────────────────────────────────────────

---

## Health Check SQL

Run this in the **SQL Editor** to see what's actually present in your database.
Copy the output and paste it back into the Supabase AI chat if you want a
personalised fix.

> **Note:** This query only checks column existence. To verify ENUMs, functions,
> triggers, and RLS policies are also present, run the **Complete Fix SQL** below
> — every statement is idempotent, so it's safe to run even when everything already
> exists.

Copy the contents of **`supabase/health_check.sql`** and paste into the SQL Editor,
or open that file and run it directly.

---

## Complete Fix SQL

This is the same idempotent SQL that the migrations provide. It is safe to run
on **any** database — existing columns and tables are silently skipped.

Copy the contents of **`supabase/complete_fix.sql`** and paste into the SQL Editor,
or open that file and run it directly.

> ✅ **Expected result:** `Success. No rows returned`
