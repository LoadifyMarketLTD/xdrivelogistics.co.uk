# XDrive PR #405 — Compliance Remediation Continuity Checkpoint

Date: 2026-08-30
Repo: `LoadifyMarketLTD/xdrivelogistics.co.uk`

## Resume target

Continue from PR **#405 — Repair Owner Driver vehicle assignment and compliance remediation**.

Working branch:
`fix/owner-driver-remediation-main-20260830`

Verified PR head before this checkpoint branch was created:
`e0f1dcab432672f5c427083059953e1fc22bb676`

Base `main` at that point:
`82db18de37b564b4dfc7a5df6141bb902afb5b82`

This checkpoint itself is intentionally stored on the separate documentation branch:
`docs/pr405-handoff-20260830`

Do **not** move PR #405 to this docs branch and do not add this checkpoint file to #405 merely for continuity.

## PR #405 status

- OPEN
- DRAFT
- MERGEABLE
- NOT MERGED
- canonical Netlify preview on the verified PR head was SUCCESS
- runtime verdict: **NOT PASS — DO NOT MERGE YET**
- PR #400 remains stale and must eventually be closed as **Superseded by #405**, but only after #405 actually passes and merges.

PR #406 is already merged into `main` and established the policy that posted load details are locked and later changes are communicated through append-only Driver messages.

## Protected boundaries

Keep all existing project constraints:

- do not touch or weaken `/super-admin`;
- do not import PR #359 Workspace visual changes;
- do not weaken RLS/security to make tests pass;
- Expo/React Native remains the canonical Driver app;
- do not resurrect Android-native/Kotlin;
- do not call a runtime gate PASS without real evidence;
- GitHub Actions jobs that fail before runner startup (`runner_id=0`, empty/no steps) are infrastructure NOT EXECUTED, not application failures and not PASS.

## What the user's screenshots proved

### 1. `/driver/vehicles` — assignment sub-gate PASS

Authenticated Owner Driver runtime on PR #405 preview showed the existing Mercedes Sprinter as:

- `Canonical active vehicle`
- `Canonical Active`
- action `Unassign` rather than `Assign to me`.

Production recheck confirmed the vehicle remained ACTIVE and assigned to the same Owner Driver and that simply viewing the page did not mutate the assignment.

Conclusion: **Owner Driver ↔ Vehicle assignment and canonical vehicle relationship are PASS.**

### 2. `/driver/loads` — operational eligibility FAIL

Authenticated runtime showed the red banner:

`Your driver and vehicle must be fully verified and operationally eligible before you can quote.`

At the same time the UI still allowed `Quote Now` to open an editable quote form and showed an active `Submit Quote` action.

Server-side quote submission remains fail-closed through canonical bid eligibility, so this is not proof of a backend authorization bypass. It is a real frontend/runtime contradiction and must not be called PASS.

### 3. Driver Finance invoice — separate real defect

Invoice `INV-202608-001` rendered:

- Net £28.00
- VAT £5.60 (20%)
- Total £33.60

but the UI displayed:

`Invoice VAT treatment/totals are invalid. Fix the Draft before previewing.`

Production inspection confirmed internally inconsistent invoice data:

- `net_amount = 28`
- `vat_amount = 5.60`
- `amount = 33.60`
- but `subtotal = 0`
- `total = 0`
- `agreed_gross_amount = 0`
- `vat_treatment = 'not_registered'` while VAT is present.

This Finance defect is real but outside the narrow #405 vehicle/compliance remediation delta. Track/fix it separately rather than silently expanding #405.

## Production compliance truth discovered

The authenticated Owner Driver is not the only affected record. Production contains **three active Drivers with `app_access=true` and `can_commercial_bid=true` that have neither a `platform_identity_registry` row nor an `onboarding_applications` row**.

Therefore this is a **legacy-user migration/remediation gap**, not an isolated error in one user's account.

The canonical onboarding migrations introduced identity gating after these legacy Driver records already existed. Current production trigger `trg_drivers_identity_gate` is fail-closed for future relevant updates, but historical records can still be active without canonical identity/onboarding history.

Do not solve this by fabricating `approved` onboarding rows or verified identities.

## Critical model fragmentation

### Driver document page is not the canonical identity-document model

Current `/driver/documents` UI and `POST /api/driver/documents` use:

- `driver_documents`
- storage bucket `driver-docs`.

Canonical operational eligibility instead evaluates identity/onboarding through:

- `onboarding_applications`
- `driver_identity_documents`
- `platform_identity_registry`.

There is no verified bridge that makes an upload to `driver_documents` automatically satisfy `driver_identity_documents` or onboarding compliance.

Therefore a Driver can upload a Driving Licence in the current Driver Documents page yet still remain blocked by canonical onboarding eligibility.

This is a core E2E fragmentation to repair.

## MOT / vehicle-document finding

The user explicitly reported that **MOT is not available in Driver Documents**. This is confirmed by source.

`app/driver/documents/page.tsx` currently offers only:

- Driving Licence
- Insurance Certificate
- DBS Certificate
- CPC Card
- Tacho Card
- Medical Certificate
- Other.

There is no MOT option there because that page writes Driver documents, not vehicle compliance documents.

Canonical vehicle eligibility checks `vehicle_documents` for valid approved vehicle evidence such as MOT / vehicle insurance.

The repository has a separate `vehicle-docs` bucket and `vehicle_documents` table, but the Driver Workspace does not currently present a complete, obvious E2E MOT/vehicle-insurance remediation flow in the tested UI.

### Additional RLS/flow inconsistency

Production storage policies for `driver-docs` still require `drivers.app_access = true` for the Driver's own INSERT/SELECT/DELETE operations.

That conflicts with #405's intended remediation idea that `/driver/documents` should remain usable while `app_access=false`: route access alone is not enough if storage upload remains blocked by RLS.

Likewise the historical assigned-driver `vehicle-docs` policies require `app_access=true`.

Inspect and repair these policies only with narrowly scoped remediation permissions; do not globally relax Driver storage RLS.

### Potential `vehicle-docs` policy name-resolution bug to verify

Historical migration:
`supabase/migrations/20260723201100_driver_vehicle_document_self_upload.sql`

uses inside a subquery:
`storage.foldername(name)`

while the joined `drivers` table also has a `name` column. Production `pg_policies` rendering indicates the expression may resolve as `storage.foldername(d.name)` rather than the outer `storage.objects.name`.

Treat this as a suspected policy bug until verified with a safe runtime/SQL test. If confirmed, qualify the outer storage object path explicitly in a new migration. Do not edit historical applied migrations in place.

## User's requested shortcut — do not falsify compliance

The user asked to approve the existing Owner Driver test account directly so tests can continue, stating that Insurance, Driving Licence and Hire & Reward exist but MOT is currently unavailable to upload.

Do **not** write an `approved` onboarding identity, verified MOT, verified insurance or full compliant status unless those states are actually supported by evidence and the canonical review contract.

The existing production account may be used for authenticated observation of its own state, but do not manufacture compliance evidence just to make the red banner disappear.

For test-only progression, use a dedicated E2E fixture/account or an explicitly internal/test-scoped mechanism that cannot grant real production commercial privileges and cannot weaken production RLS. The repository's own E2E matrix says existing real/legacy users are not test fixtures and dedicated `e2e+...` accounts should be used for lifecycle tests.

## #405 exact current code scope before further remediation

The clean #405 branch was 1 commit ahead / 0 behind the post-#406 main and changed exactly these five files:

1. `app/api/driver/vehicles/route.ts`
2. `app/driver/vehicles/page.tsx`
3. `lib/roleCapabilities.ts`
4. `supabase/migrations/20260830020916_repair_owner_driver_document_storage_contract.sql`
5. `__tests__/ownerDriverRemediationContract.test.ts`

Vehicle assignment works, but newly discovered compliance fragmentation may require deliberate expansion of #405 or a follow-on PR. Decide based on cohesion; do not silently broaden scope.

## Recommended continuation order

1. Re-read this checkpoint and re-fetch current `main`, PR #405 and its head before any write.
2. Confirm #405 has not moved since `e0f1dcab432672f5c427083059953e1fc22bb676`.
3. Keep #405 NOT PASS until runtime evidence is complete.
4. Map the canonical remediation contract for legacy Drivers:
   - create/resume an **unapproved** onboarding application for legacy Driver identities;
   - connect uploads to canonical `driver_identity_documents` rather than leaving them only in `driver_documents`;
   - preserve Platform Review/verification semantics;
   - never auto-create an active `platform_identity_registry` row from an upload.
5. Build/repair a real Driver Workspace vehicle-document path for the assigned canonical vehicle:
   - MOT;
   - vehicle insurance / Hire & Reward as applicable;
   - issue/expiry dates;
   - upload to `vehicle-docs`;
   - insert `vehicle_documents` as pending;
   - review/approval remains authoritative.
6. Repair remediation RLS narrowly so a Driver blocked only by compliance can upload/read their own remediation documents while other Driver commercial/execution access remains denied.
7. Verify the suspected `vehicle-docs` path-policy `name` resolution issue and repair through a **new** migration if confirmed.
8. Feed the canonical eligibility result into `/driver/loads` UI so an ineligible Driver cannot open `Quote Now` / active `Submit Quote`; keep backend fail-closed regardless.
9. Use a dedicated E2E test fixture for complete lifecycle proof. Do not impersonate private customer/driver accounts.
10. Runtime proof after remediation:
    - remediation document upload works;
    - records land in the canonical tables/storage paths;
    - pending docs do not falsely unlock commercial operations;
    - after legitimate review/approval, eligibility transitions correctly;
    - `Quote Now` UI agrees with backend eligibility;
    - no RLS/security regression.
11. Only then mark #405 PASS and merge it if its scope remains coherent; otherwise merge the narrow assignment PR only after carving the newly discovered compliance remediation into an explicit follow-on PR.
12. Close #400 as `Superseded by #405` only after the replacement work is truly merged.
13. Track the Finance VAT inconsistency as a separate remediation item after #405/compliance is stabilized.

## Next-chat instruction

Paste exactly:

> **CONTINUĂ XDRIVE PR #405 EXACT DIN CHECKPOINT-UL `docs/checkpoints/XDRIVE_PR405_COMPLIANCE_REMEDIATION_HANDOFF_2026-08-30_1358.md` DE PE BRANCH-UL `docs/pr405-handoff-20260830`.** Repo: `LoadifyMarketLTD/xdrivelogistics.co.uk`. Citește checkpoint-ul integral, verifică mai întâi `main`, PR #405 și HEAD-ul real al branch-ului `fix/owner-driver-remediation-main-20260830`. Nu declara PASS și nu face merge până nu este reparat și demonstrat E2E lanțul compliance/remediation. Nu folosi conturi private ale altor useri ca fixture. Nu falsifica identity/onboarding/MOT/insurance approval. Continuă autonom în ordinea checkpoint-ului: legacy remediation contract → canonical identity document bridge → MOT/vehicle insurance upload path → remediation RLS → Quote UI eligibility → runtime E2E → merge gate. Păstrează `/super-admin`, RLS, Expo/React Native și interdicția PR #359 UI intacte.
