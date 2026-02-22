# Supabase Schema Setup — Danny Courier Ltd

## Instrucțiuni pentru Supabase SQL Editor / Asistent AI

Urmărește pașii de mai jos **în ordine** pentru a verifica și aplica schema completă a bazei de date.

---

## PASUL 1 — Deschide Supabase SQL Editor

1. Mergi la [https://app.supabase.com](https://app.supabase.com)
2. Selectează proiectul **Danny Courier Ltd**
3. În meniul din stânga, apasă pe **SQL Editor**

---

## PASUL 2 — Rulează Health Check (verificare ce lipsește)

Copiază scriptul de mai jos în SQL Editor și apasă **Run**.
Acesta este *read-only* — nu modifică nimic, doar raportează ce lipsește.

```sql
-- ============================================================
-- Danny Courier Ltd — SCHEMA HEALTH CHECK (read-only)
-- ============================================================

-- 1) TABELE LIPSĂ
SELECT 'TABEL LIPSĂ' AS problema, t AS tabel
FROM (VALUES
  ('profiles'), ('companies'), ('company_memberships'),
  ('drivers'), ('vehicles'), ('driver_documents'), ('vehicle_documents'),
  ('jobs'), ('job_documents'), ('job_notes'), ('job_tracking_events'),
  ('job_bids'), ('driver_locations'), ('job_driver_distance_cache'),
  ('quotes'), ('diary_events'), ('return_journeys')
) AS necesar(t)
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = t
);

-- 2) COLOANE LIPSĂ PE TABELE EXISTENTE
SELECT 'COLOANĂ LIPSĂ' AS problema, c.tabel, c.coloana
FROM (VALUES
  ('profiles',            'email'),
  ('profiles',            'role'),
  ('profiles',            'company_id'),
  ('companies',           'address_line1'),
  ('companies',           'status'),
  ('companies',           'company_type'),
  ('jobs',                'distance_to_pickup_miles'),
  ('job_bids',            'amount'),
  ('job_bids',            'bid_price_gbp'),
  ('job_bids',            'bidder_user_id'),
  ('job_bids',            'bidder_id'),
  ('driver_locations',    'company_id'),
  ('driver_locations',    'updated_at'),
  ('quotes',              'vehicle_type'),
  ('quotes',              'cargo_type'),
  ('quotes',              'currency'),
  ('quotes',              'status'),
  ('return_journeys',     'status'),
  ('job_notes',           'id')
) AS c(tabel, coloana)
WHERE EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = c.tabel
)
AND NOT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = c.tabel
    AND column_name  = c.coloana
);

-- 3) TIPURI ENUM LIPSĂ
SELECT 'ENUM LIPSĂ' AS problema, e AS tip_enum
FROM (VALUES
  ('company_role'), ('membership_status'), ('doc_status'),
  ('job_status'), ('cargo_type'), ('vehicle_type'), ('tracking_event_type')
) AS e(e)
WHERE NOT EXISTS (
  SELECT 1 FROM pg_type
  WHERE typname = e
    AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
);

-- 4) FUNCȚII LIPSĂ
SELECT 'FUNCȚIE LIPSĂ' AS problema, f AS functie
FROM (VALUES
  ('is_company_member'), ('is_company_admin'), ('sync_job_bid_price')
) AS f(f)
WHERE NOT EXISTS (
  SELECT 1 FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = f
);

-- 5) RLS STATUS
SELECT tablename,
       CASE WHEN rowsecurity THEN '✅ RLS ACTIV' ELSE '❌ RLS INACTIV' END AS stare_rls
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles','companies','company_memberships','drivers','vehicles',
    'driver_documents','vehicle_documents','jobs','job_documents',
    'job_notes','job_tracking_events','job_bids','driver_locations',
    'job_driver_distance_cache','quotes','diary_events','return_journeys'
  )
ORDER BY tablename;

-- 6) REZULTAT FINAL
SELECT 'VERIFICARE COMPLETĂ' AS status,
       'Sănătos = secțiunile 1-5 și 7 returnează 0 rânduri; secțiunea 6 arată RLS ACTIV.' AS nota;
```

### ✅ Rezultat așteptat
- Secțiunile 1–5 și 7 trebuie să returneze **0 rânduri** (nimic lipsă).
- Secțiunea 6 trebuie să arate **✅ RLS ACTIV** pentru toate tabelele.

---

## PASUL 3 — Aplică Schema Completă (dacă lipsesc tabele / coloane)

Dacă Health Check-ul de la Pasul 2 a găsit probleme:

1. În SQL Editor, deschide un **New Query** (tab nou)
2. Mergi la GitHub: `supabase/migrations/006_complete_schema.sql`
3. Copiază **tot conținutul** fișierului
4. Lipește în SQL Editor
5. Apasă **Run**
6. Verifică că mesajul de jos afișează: **`Success. No rows returned`**
7. **Rulează din nou** Health Check (scriptul din `007_verify_schema.sql`) pentru a confirma că totul este în regulă — secțiunile 1–5 și 7 trebuie să returneze 0 rânduri

---

## PASUL 4 — Instrucțiuni pentru Asistentul AI Supabase

Dacă folosești Asistentul AI din Supabase (butonul **Ask AI** din SQL Editor), trimite-i următorul prompt:

---

> **Prompt pentru Asistentul Supabase:**
>
> Verifica schema bazei de date publice si asigura-te ca urmatoarele tabele exista cu toate coloanele necesare:
>
> **Tabele necesare:**
> `profiles`, `companies`, `company_memberships`, `drivers`, `vehicles`,
> `driver_documents`, `vehicle_documents`, `jobs`, `job_documents`, `job_notes`,
> `job_tracking_events`, `job_bids`, `driver_locations`, `job_driver_distance_cache`,
> `quotes`, `diary_events`, `return_journeys`
>
> **Tipuri enum necesare:**
> `company_role` ('owner','admin','dispatcher','viewer'),
> `membership_status` ('invited','active','suspended'),
> `doc_status` ('pending','approved','rejected','expired'),
> `job_status` ('draft','posted','allocated','in_transit','delivered','cancelled','disputed'),
> `cargo_type` ('documents','packages','pallets','furniture','equipment','other'),
> `vehicle_type` ('bicycle','motorbike','car','van_small','van_large','luton','truck_7_5t','truck_18t','artic'),
> `tracking_event_type` ('created','allocated','driver_en_route','arrived_pickup','collected','in_transit','arrived_delivery','delivered','failed','cancelled','note')
>
> **Coloane critice de verificat:**
> - `quotes` trebuie sa aiba: `vehicle_type`, `cargo_type`, `currency`, `status`
> - `profiles` trebuie sa aiba: `email`, `role`, `company_id`
> - `companies` trebuie sa aiba: `address_line1`, `address_line2`, `city`, `postcode`, `status`, `company_type`
> - `jobs` trebuie sa aiba: `distance_to_pickup_miles`
> - `job_bids` trebuie sa aiba: `amount`, `bid_price_gbp`, `bidder_user_id`, `bidder_id`
> - `driver_locations` trebuie sa aiba: `company_id`, `updated_at`
> - `return_journeys` trebuie sa aiba: `status`
>
> **Functii necesare:**
> - `public.is_company_member(cid uuid) RETURNS boolean SECURITY DEFINER`
> - `public.is_company_admin(cid uuid) RETURNS boolean SECURITY DEFINER`
>
> **Row Level Security:**
> - RLS activat pe toate tabelele de mai sus
> - Politici bazate pe `is_company_member()` si `is_company_admin()`
>
> Genereaza un script SQL idempotent (folosind IF NOT EXISTS si ADD COLUMN IF NOT EXISTS) care creeaza ce lipseste fara sa stearga date existente.

---

## PASUL 5 — Verificare finală

După aplicarea schemei, rulează din nou Health Check (Pasul 2).
Toate secțiunile 1–4 trebuie să returneze **0 rânduri**.

---

## Structura completă a bazei de date

```
public
├── Enums
│   ├── company_role
│   ├── membership_status
│   ├── doc_status
│   ├── job_status
│   ├── cargo_type
│   ├── vehicle_type
│   └── tracking_event_type
│
├── Tables
│   ├── companies           ← firma (multi-tenant root)
│   ├── profiles            ← utilizatori extinsi din auth.users
│   ├── company_memberships ← cine face parte din ce firma
│   ├── drivers             ← soferi
│   ├── vehicles            ← vehicule
│   ├── driver_documents    ← documente sofer (permis, etc.)
│   ├── vehicle_documents   ← documente vehicul (RCA, ITP, etc.)
│   ├── jobs                ← curse / livrari
│   ├── job_documents       ← documente atasate la cursa
│   ├── job_notes           ← note interne pe cursa
│   ├── job_tracking_events ← istoricul statusului cursei
│   ├── job_bids            ← oferte de pret pentru curse
│   ├── driver_locations    ← locatia live a soferilor
│   ├── job_driver_distance_cache ← cache distante sofer-cursa
│   ├── quotes              ← oferte de pret pentru clienti
│   ├── diary_events        ← planificator / agenda
│   └── return_journeys     ← curse de intoarcere disponibile
│
├── Functions
│   ├── is_company_member(uuid) → boolean
│   ├── is_company_admin(uuid)  → boolean
│   └── sync_job_bid_price()    → trigger function
│
└── Triggers
    └── trg_sync_job_bid_price  (on job_bids)
```

---

## Fișiere relevante în repository

| Fișier | Descriere |
|--------|-----------|
| `supabase/migrations/006_complete_schema.sql` | **Schema completă** — rulează asta dacă ai probleme |
| `supabase/migrations/007_verify_schema.sql` | **Health check** — verifică ce lipsește |
| `supabase/migrations/005_fix_quotes_columns.sql` | Fix specific pentru coloana `cargo_type` pe `quotes` |
| `supabase/migrations/003_auto_fix.sql` | Script de reparare automată (versiune veche) |
