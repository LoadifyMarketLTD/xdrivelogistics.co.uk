# Production Driver-Commercial Reconciliation Runbook

> **Mandatory guardrails**
> - Do **not** apply `/home/runner/work/xdrivelogistics.co.uk/xdrivelogistics.co.uk/supabase/migrations/20260801000000_p0_driver_commercial_columns_catchup.sql` in Production.
> - Do **not** run `supabase db push` against Production for this incident.
> - Do **not** repair migration history or mark migrations as applied.
> - Do **not** rewrite `can_commercial_bid = false` rows to `true` globally.
> - Do **not** mix schema, data, RLS, RPC, and notification changes in one Production execution.
> - Do **not** mark this incident resolved until Production read-only evidence and staging/disposable validation both exist.

## Scope

This runbook replaces the broad catch-up approach with independently reviewable units and a read-only audit-first workflow.

Primary concerns:

1. `public.drivers.driver_type`
2. `public.drivers.can_commercial_bid`
3. `job_bids` active-bid uniqueness indexes
4. `job_bids_exchange_insert` RLS
5. `review_onboarding_application_atomic`
6. company activation / membership side effects
7. `notification_events` emission

Supporting artifacts:

- Read-only Production/staging audit: `/home/runner/work/xdrivelogistics.co.uk/xdrivelogistics.co.uk/supabase/ops/production_driver_commercial_reconciliation_audit.sql`
- False-row worksheet: `/home/runner/work/xdrivelogistics.co.uk/xdrivelogistics.co.uk/supabase/ops/can_commercial_bid_false_row_classification.sql`
- Narrow schema unit: `/home/runner/work/xdrivelogistics.co.uk/xdrivelogistics.co.uk/supabase/migrations/20260801120000_driver_columns_constraints_reconciliation_only.sql`
- Narrow index unit: `/home/runner/work/xdrivelogistics.co.uk/xdrivelogistics.co.uk/supabase/migrations/20260801121000_job_bids_active_uniqueness_indexes_only.sql`
- Narrow RLS unit: `/home/runner/work/xdrivelogistics.co.uk/xdrivelogistics.co.uk/supabase/migrations/20260801122000_job_bids_exchange_insert_policy_only.sql`
- Narrow RPC unit: `/home/runner/work/xdrivelogistics.co.uk/xdrivelogistics.co.uk/supabase/migrations/20260801123000_review_onboarding_application_atomic_business_logic_only.sql`

---

## Related P0 runtime defect ledger — `owner_audit_log.target_type`

This runbook tracks driver-commercial reconciliation, but the same Production incident window also contains a separate P0 runtime defect for `public.owner_audit_log.target_type`. Keep that remediation narrow and evidence-driven:

| Function / concern | Live Production evidence | Repo-canonical evidence | Status | Safest next action |
|---|---|---|---|---|
| `set_company_status_governance(uuid,uuid,text,text,text)` | Live body explicitly inserts `target_type = 'company'` and `target_company_id`. | Consistent with live. | **ALIGNED** | Do not replace this function in the marketplace audit repair. |
| `owner_review_compliance_document(uuid,text,uuid,text,text)` | Live body explicitly inserts `target_type`, `target_id = p_document_id`, and `target_name`; current semantic value is `compliance_document`. | Consistent with live. | **ALIGNED** | Preserve the live semantic contract unless a separate approved change says otherwise. |
| `apply_marketplace_governance_action(uuid,uuid,text,text)` | Live `owner_audit_log` INSERT omits `target_type` and `target_id`; this is the confirmed NOT NULL failure source. | Migration `078` contains the bug; migration `20260801091000` is the staged narrow patch. | **DIVERGENT — PATCH STAGED, NOT YET APPLIED** | Apply only `20260801091000_fix_owner_audit_log_target_type.sql` after staging validation and Platform Owner approval. Full runbook: `supabase/ops/marketplace-governance-production-runbook.md`. |
| `owner_decide_fraud_review_case(uuid,uuid,text,text)` | The Production read-only function query returned no row for this exact signature. Live status is unconfirmed. | Migration `20260730100000` defines the function and its `owner_audit_log` INSERT **omits `target_type` and `target_id`** — same bug class as the marketplace function. | **BLOCKED (PRODUCTION) / DIVERGENT (REPO-CANONICAL)** | Run the single-signature lookup in the incident report. If the function exists in Production and omits `target_type`, author a narrow patch (adding `target_type = 'fraud_case'` and `target_id = p_case_id`). Do not patch without live evidence. |

Single read-only SQL for the remaining unverified function:

```sql
SELECT
  p.oid::regprocedure AS function_signature,
  pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'owner_decide_fraud_review_case'
  AND pg_get_function_identity_arguments(p.oid) = 'uuid, uuid, text, text';
```

---

## Current drift ledger

Status vocabulary: **ALIGNED / PARTIAL / DIVERGENT / NOT PRESENT / BLOCKED**

| Concern | Live evidence currently available | Repo expectation | Status | Safest next action |
|---|---|---|---|---|
| `drivers` column existence / types / defaults / nullability | Platform Owner Production evidence: `drivers.can_commercial_bid → boolean, NOT NULL, default true`; `drivers.driver_type → text, NOT NULL, default 'company_driver'`. | Repo expects `driver_type` canonical defaults/nullability and `can_commercial_bid` boolean default true + NOT NULL. | **ALIGNED** | No Production write needed for this unit; keep reconciliation scoped to remaining independent units. |
| Canonical `drivers_driver_type_check` constraint | Platform Owner Production evidence: no prior constraint referencing `driver_type`; then manually applied `alter table public.drivers add constraint drivers_driver_type_check check (driver_type in ('owner_driver', 'company_driver'));` with success. | Repo expects canonical `driver_type` check constraint. | **ALIGNED** | Treat Unit A as already satisfied in Production; do not re-run broad catch-up migration. |
| Current `driver_type` values | Platform Owner Production evidence: `company_driver → 5`; `owner_driver → 0`; legacy/non-canonical → 0; `NULL → 0`. | Repo expects only canonical values and no NULL. | **ALIGNED** | Proceed to the next independent read-only unit (Unit C preflight). |
| Current `can_commercial_bid` values | Platform Owner Production evidence: `true → 5`; `false → 0`; `NULL → 0`. No intentionally revoked `false` rows currently present. | Repo expects no NULL values and preservation of any existing `false` rows. | **ALIGNED** | Keep Unit B as no-op for current dataset; re-audit before any future data DML. |
| `job_bids_active_company_unique_idx` compatibility | Task instruction says one duplicate submitted bid was changed to `withdrawn` while canonical accepted bid was preserved; no full duplicate scan output yet. | Repo index requires zero active duplicates for `(job_id, company_id)` where `status in ('submitted','accepted')`. | **PARTIAL** | Run audit step C1; only consider unit C if query returns 0 rows. |
| `job_bids_active_null_company_unique_idx` compatibility | No live query result captured. | Repo index requires zero active duplicates for `(job_id, bidder_user_id)` when `company_id IS NULL`. | **BLOCKED** | Run audit step C2 before any index DDL review. |
| `job_bids_exchange_insert` RLS | No live `pg_policies` output captured. | Repo expects policy body aligned to `can_commercial_bid`, active driver status, and exchange/direct invite gating. | **BLOCKED** | Run audit steps D1–D2 and compare raw `with_check` text to unit D. |
| `review_onboarding_application_atomic` | No live `pg_get_functiondef` captured after emergency repair. | Repo expects canonical owner-driver provisioning, company activation, membership upsert, and notification enqueue logic. | **BLOCKED** | Run audit step E1 and compare body hash/definition to unit E. |
| Company / membership activation side effects | No staging or Production runtime evidence captured for approve flow after manual fixes. | Repo expects `set_company_status_governance` call and owner membership upsert on approved linked-company flows. | **BLOCKED** | Run audit steps E2–E3 and perform unit-E staging approval scenario before any Production approval. |
| `notification_events` emission | No live event sample or function-body evidence captured for onboarding review notifications after manual fixes. | Repo expects `onboarding_approved` / `onboarding_review_updated` rows with the canonical payload shape. | **BLOCKED** | Run audit steps F1–F2 and staging runtime validation for both approve and request-changes paths. |

### Emergency manual Production changes that must be reconciled

| Manual Production change | Repo expectation | Current evidence | Status | Safest next action |
|---|---|---|---|---|
| `company_documents.issued_date` added | Repo already defines `issued_date date`. | Task instruction confirms manual add; no live type/default query captured yet. | **PARTIAL** | Run audit step G1 and record exact `information_schema` row. |
| `driver_identity_documents.issued_date` added | Repo already defines `issued_date date`. | Task instruction confirms manual add; no live type/default query captured yet. | **PARTIAL** | Run audit step G1 and record exact `information_schema` row. |
| Duplicate submitted bid withdrawn; canonical accepted bid preserved | Repo uniqueness logic allows `withdrawn` outside active uniqueness set. | Task instruction confirms one targeted repair; no global duplicate audit output yet. | **PARTIAL** | Run audit steps C1–C2 and archive output. |
| `owner_review_compliance_document` corrective function possibly applied | Repo has corrective definitions in `20260801080500` and `20260801091000`. | Task instruction says “if already applied”; live definition unknown. | **BLOCKED** | Run audit step G1 (function definition query) and compare to repo file selected for rollout. |

---

## Unit A — Driver column defaults / constraints reconciliation only

### Exact scope

- `public.drivers.driver_type` default / NOT NULL / canonical check constraint
- `public.drivers.can_commercial_bid` default / NOT NULL
- No row-value updates
- No RLS, RPC, membership, or notification changes

### Prerequisites

- `driver_type` and `can_commercial_bid` columns already exist in the target environment
- No row has `driver_type IS NULL`
- No row has `driver_type NOT IN ('owner_driver','company_driver')`
- No row has `can_commercial_bid IS NULL`

### Read-only preflight

- Audit steps A1–A4

### Idempotent implementation

- Migration: `20260801120000_driver_columns_constraints_reconciliation_only.sql`

### Staging validation

1. Build staging/disposable from a Production-equivalent baseline.
2. Run A1–A4 before applying the unit.
3. Apply the migration on staging only.
4. Re-run A1–A4 and confirm:
   - defaults are present
   - NOT NULL holds
   - constraint text is canonical
5. Run targeted login and driver-session checks on staging.

### Post-apply verification

- `information_schema.columns` shows defaults and `is_nullable = NO`
- `pg_constraint` shows `drivers_driver_type_check`
- Application login remains healthy for company driver / owner driver / company admin

### Rollback / recovery notes

- Drop and recreate the prior check/defaults explicitly if staging proves a regression.
- No row data should need rollback because this unit writes no driver rows.

### Separate Platform Owner approval gate

- Production approval only after raw Production A1–A4 output is attached and staging validation evidence is recorded.

---

## Unit B — `can_commercial_bid` data reconciliation only

### Exact scope

- Row-by-row review of existing `can_commercial_bid = false` drivers
- Preserve every existing `false` unless that exact row is explicitly classified and approved
- No schema change

### Prerequisites

- Unit A drift fully understood
- False-row inventory complete
- Business owner signs off row-by-row classification criteria

### Read-only preflight

- Audit steps B1–B2
- Worksheet: `can_commercial_bid_false_row_classification.sql`

### Idempotent implementation

- **No automatic migration in this PR**
- Targeted DML must be authored later from the approved false-row ledger only

### Staging validation

1. Copy representative false rows into staging/disposable.
2. Validate proposed per-row actions against login, bidding, and admin workflows.
3. Confirm intentionally revoked rows remain `false`.

### Post-apply verification

- Every changed row has an approval record
- No previously unapproved `false` row changed
- Marketplace behavior matches the approved classification list

### Rollback / recovery notes

- Revert only the explicitly approved row updates using the saved pre-change snapshot

### Separate Platform Owner approval gate

- No Production DML until the full false-row ledger is reviewed and signed off line-by-line.

---

## Unit C — Duplicate-safe `job_bids` uniqueness indexes

### Exact scope

- `job_bids_active_company_unique_idx`
- `job_bids_active_null_company_unique_idx`
- No bid-row mutation

### Prerequisites

- C1 returns 0 rows
- C2 returns 0 rows
- Maintenance window reviewed if table size requires it

### Read-only preflight

- Audit steps C1–C3

### Idempotent implementation

- Migration: `20260801121000_job_bids_active_uniqueness_indexes_only.sql`

### Staging validation

1. Run C1–C3 on staging baseline.
2. Apply the migration on staging only.
3. Verify one active quote per identity/company still succeeds and duplicate active submissions fail.

### Post-apply verification

- `pg_indexes` shows both indexes
- No blocking duplicates exist
- Accepted / withdrawn canonical repair remains intact

### Rollback / recovery notes

- Drop only the two indexes if an application regression is found

### Separate Platform Owner approval gate

- Production approval requires archived zero-row C1 and C2 output from the exact Production window.

---

## Unit D — `job_bids_exchange_insert` RLS replacement

### Exact scope

- Replace only the `job_bids_exchange_insert` policy
- No table DDL
- No bid-row mutation

### Prerequisites

- `can_commercial_bid` column exists and semantics are approved
- D1/D2 evidence captured
- Unit C compatibility review complete

### Read-only preflight

- Audit steps D1–D2

### Idempotent implementation

- Migration: `20260801122000_job_bids_exchange_insert_policy_only.sql`

### Staging validation

1. Capture current staging `pg_policies`.
2. Apply the migration on staging.
3. Test:
   - owner-driver direct exchange bid
   - company-driver fleet bid
   - blocked / revoked driver denied
   - direct invite company accepted

### Post-apply verification

- D1 shows the new `with_check` text
- No unrelated `job_bids` policy changed

### Rollback / recovery notes

- Restore the prior Production policy text captured by D1/D2 if runtime behavior regresses

### Separate Platform Owner approval gate

- Production approval requires the exact pre-change policy text and staging pass evidence for all four role paths.

---

## Unit E — `review_onboarding_application_atomic` business-logic replacement

### Exact scope

- Replace only `public.review_onboarding_application_atomic`
- Covers owner-driver provisioning and company/membership activation logic
- No driver-column backfill
- No standalone notification schema change

### Prerequisites

- E1–E3 evidence captured
- Product approval for owner-driver / individual-driver business rules
- Side-effect expectations documented

### Read-only preflight

- Audit steps E1–E3

### Idempotent implementation

- Migration: `20260801123000_review_onboarding_application_atomic_business_logic_only.sql`

### Staging validation

1. Seed staging with representative onboarding applications:
   - owner_driver without company
   - individual_driver without company
   - linked-company applicant requiring membership activation
2. Capture E1–E3 before the change.
3. Apply the migration on staging.
4. Approve / reject / request changes through the real RPC path.
5. Capture resulting driver rows, company status, and membership rows.

### Post-apply verification

- Driver provisioning uses canonical `owner_driver`
- Company activation happens only where expected
- Membership upsert is correct and non-duplicative

### Rollback / recovery notes

- Restore the prior `pg_get_functiondef` body captured by E1 if staging or Production rollout is rejected

### Separate Platform Owner approval gate

- Production approval requires before/after staging evidence for each scenario and archived live pre-change function text.

---

## Unit F — Notification behavior

### Exact scope

- Runtime verification of `notification_events` emission tied to onboarding review flows
- No automatic Production SQL in this PR

### Prerequisites

- F1–F2 evidence captured
- Unit E staging scenario outputs recorded

### Read-only preflight

- Audit steps F1–F2

### Idempotent implementation

- **No notification-specific Production migration in this PR**
- If drift is found, author a separate notification-only change after evidence review

### Staging validation

1. Run the Unit E staging scenarios.
2. For each approve / request-changes action, capture the inserted `notification_events` row.
3. Verify event type, recipient, payload, and downstream bridge behavior independently.

### Post-apply verification

- `notification_events` rows exist only for approved reviewed actions expected by product
- Payload shape matches the recorded contract
- No duplicate notifications emitted

### Rollback / recovery notes

- If notification-only drift is introduced later, revert only that notification change; do not conflate with Unit E approval.

### Separate Platform Owner approval gate

- No Production notification behavior change without runtime evidence for event payloads and counts.

---

## Single safest next action

Run the next independent read-only Unit C statement in Production (one statement only):

```sql
SELECT
  job_id,
  company_id,
  COUNT(*) AS active_bid_count,
  array_agg(id ORDER BY created_at, id) AS bid_ids,
  array_agg(status ORDER BY created_at, id) AS statuses
FROM public.job_bids
WHERE company_id IS NOT NULL
  AND status IN ('submitted', 'accepted')
GROUP BY job_id, company_id
HAVING COUNT(*) > 1
ORDER BY active_bid_count DESC, job_id;
```
