# XDrive post-consolidation + compliance checkpoint — 2026-08-30

## Canonical repository state

Repository: `LoadifyMarketLTD/xdrivelogistics.co.uk`

Checkpoint parent `main` before this documentation commit:

`bbc8bb1149c8992540f8323bd378a98d502ef92c`

That commit is:

`Merge PR #404: fix compliance document enum review`

The branch state before PR #404 was:

`7e96adc349387899f52462b007ceda6845afb9fb`

which is:

`Merge PR #403: fix Driver compliance document upload`

## Consolidation disposition

### PR #395

- `CLOSED`
- `NOT MERGED`
- `SUPERSEDED`
- do not resurrect `android-native/**/*.kt` as the Driver application
- safe rich-quote concepts were rebuilt on the canonical Expo/server path
- Collection Pass from #395 remains intentionally not ported because the branch did not contain a complete verifier workflow

### PR #398

- `CLOSED`
- `NOT MERGED`
- `SUPERSEDED`
- its stronger E2E/security fixes were selectively absorbed into #399

### PR #399

- `CLOSED`
- `MERGED`
- merge commit: `47936816984df9ef7cfceac9ffb36b5d37afd278`
- this is the completed CX-close operational convergence consolidation

Canonical consolidation matrix:

`docs/canonical/PR395_PR398_TO_PR399_CONSOLIDATION_MATRIX_2026-08-30.md`

## Major #399 capabilities now in main

Among the consolidated contracts:

- Multi-drop Post Load + ordered `job_stops`
- authorised multi-stop job-sheet projection
- Expo Driver multi-stop execution foundation
- staged/server-authoritative POD evidence + durable offline queue
- signed POD/documents and audit/history presentation
- device-bound Expo requests and logout revocation
- tracking tenant isolation
- canonical atomic Return Journey replacement
- structured rich quote metadata + server-validated vehicle snapshot
- carrier-company active quote protection
- Exchange visibility + expiry guards across Driver/Company Marketplace surfaces
- Customer owner Edit/Delete pre-award contract
- post-award append-only Driver Instructions
- PAF postcode-address provider integration contract
- Driver Smart Load Alerts foundation
- provider-neutral telematics foundation

Expo / React Native remains the canonical Driver application.

## PR #403 — Driver compliance upload repair

PR #403 is `MERGED` at:

`7e96adc349387899f52462b007ceda6845afb9fb`

Problem repaired:

- browser could upload a file to `driver-docs`
- subsequent browser insert into `public.driver_documents` failed because the table is intentionally browser read-only

Canonical repair:

- keep storage RLS and browser DB ACL hardening
- upload file under existing Driver storage contract
- persist the `driver_documents` row through authenticated server authority
- validate Driver ownership/path/file content
- idempotent retry and compensation on failure

No browser `INSERT` grant and no RLS relaxation were introduced.

## PR #404 — urgent Super Admin compliance review repair

PR #404 is `MERGED` at:

`bbc8bb1149c8992540f8323bd378a98d502ef92c`

Production incident observed in:

`/super-admin/compliance/documents`

Symptom when Platform Owner pressed `Approve` on a Driver document:

`column "status" is of type doc_status but expression is of type text`

PDF secure preview worked; only review mutation failed.

### Production root cause

`public.driver_documents.status` is enum:

`public.doc_status`

Allowed values confirmed:

- `pending`
- `approved`
- `rejected`
- `expired`

Other compliance status columns are text:

- `vehicle_documents.status` -> `text`
- `company_documents.status` -> `text`
- `driver_identity_documents.verification_status` -> `text`

The RPC:

`public.owner_review_compliance_document(...)`

used dynamic SQL:

`SET status = $2`

where `$2` was a PL/pgSQL `text` value. PostgreSQL correctly rejected that assignment for `driver_documents.status`.

### Hosted production repair

Applied directly to production project:

`jqxlauexhkonixtjvljw` (`xdrivelogistics`)

Hosted migration:

`20260830105007_repair_owner_compliance_doc_status_enum_cast`

Repair:

- polymorphic status read explicitly casts to text
- Driver-family status write explicitly uses `$2::public.doc_status`
- vehicle/company/identity text contracts remain unchanged
- audit behavior is preserved
- no RLS/ACL relaxation

Hosted function verification confirmed both:

- Driver enum cast present
- status read cast present

RPC ACL verification after repair:

`{postgres=X/postgres,service_role=X/postgres}`

Therefore `anon` and `authenticated` do not receive direct EXECUTE access to the `SECURITY DEFINER` RPC.

Repository alignment:

- migration `supabase/migrations/20260830105007_repair_owner_compliance_doc_status_enum_cast.sql`
- regression contract `supabase/tests/owner_review_compliance_doc_status_enum_contract.sql`

## Current production compliance inventory immediately after the repair

Observed production Driver inventory:

- 4 active Driver records total
- 3 active Drivers have `app_access=true`
- 1 active Driver has `app_access=false`

Pending Driver-document inventory:

- 2 `driver_documents` rows are `pending`
- both pending rows belong to 1 Driver
- no automatic approval was performed by the remediation

Important separation:

The one Driver with `app_access=false` has **zero** Driver documents in pending/approved/rejected states. That access flag is therefore a separate state and must not be blindly enabled as part of the document-review hotfix.

## Compliance review operational rule

The Platform Owner must still make the compliance decision after viewing the document.

Do **not** bulk approve or programmatically auto-approve compliance documents simply to unlock accounts.

The repaired action path is:

1. Platform Owner opens secure document preview.
2. Platform Owner chooses Approve or Reject.
3. `/api/super-admin/compliance/documents` calls the service-role-only RPC.
4. RPC performs typed status mutation and records review metadata/audit.
5. UI reloads the compliance table.

## Immediate browser runtime re-test

Not yet claimed PASS at checkpoint creation.

Re-test one genuinely reviewed pending Driver document in:

`/super-admin/compliance/documents`

Expected result after pressing Approve:

- no `doc_status` / `text` error
- row changes from `pending` to `approved`
- `verified_by` is populated
- `verified_at` is populated
- `rejection_reason` is null for approval
- `owner_audit_log` receives `document_approved`

For Reject:

- row changes to `rejected`
- rejection reason is preserved
- audit entry records rejection

If the browser still shows the old error, first confirm the request is hitting production Supabase project `jqxlauexhkonixtjvljw`; the RPC repair itself is already hosted and does not require a Netlify UI redeploy.

## Netlify / GitHub Actions truth

PR #399 had a canonical green Netlify build before consolidation merge.

PR #403 had canonical Netlify SUCCESS before merge.

PR #404 is migration/test-only; its production DB repair was already hosted before repository merge. Runtime compliance review therefore does not depend on a new web bundle.

At the time of this checkpoint, the new `main` merge commit had not yet received a commit-status result.

GitHub Actions availability remains a separate infrastructure/billing condition. Do not reinterpret runner-not-started jobs as application-test failures and do not claim them as executed PASS.

## Remaining operational validation from the #399 consolidation

These remain runtime/configuration/device proofs, not source-PR fragmentation:

1. Owner Edit/Delete on a disposable unawarded test load.
2. Post-award append-only Driver Instruction observed in Driver Special Instructions + inbox.
3. PAF postcode lookup visibly returns the correct address list with configured provider credentials.
4. Physical Expo multi-drop Arrived -> Completed ordering and final POD/delivery gate.
5. Real telematics provider binding + signed ingest/replay/revocation test.
6. Real Driver Smart Load Alert preference -> matcher -> dedupe -> delivery test.
7. Compliance review browser re-test after migration `20260830105007`.

## Protected architecture

- Expo/React Native is the Driver app base.
- Do not resurrect Android-native/Kotlin as the application.
- Do not import PR #359 Workspace visual changes.
- Do not relax RLS or browser DB privileges to solve application errors.
- Do not expose exact pre-award execution addresses/coordinates.
- Super Admin changes should remain server-authoritative and audited.

## Continuation order

1. Re-test one real reviewed Driver document Approve/Reject in Super Admin.
2. Verify the corresponding `driver_documents` row and `owner_audit_log` entry read-only in production.
3. Re-evaluate the affected Driver's operational eligibility after document approval.
4. Keep the independent `app_access=false` Driver case separate unless evidence shows it is stale/incorrect.
5. Resume remaining post-consolidation runtime gates listed above.

This checkpoint supersedes the pre-merge PR #399 checkpoint for continuation from `main`.
