# XDrive Go-Live Security Continuity Checkpoint

**Checkpoint UTC:** 2026-09-05 01:10Z  
**Repository:** `LoadifyMarketLTD/xdrivelogistics.co.uk`  
**Do not restart the audit from zero. Continue from this exact state.**

## Non-negotiable validation rule

For this workstream, **GitHub Actions are OUT of the validation equation**. Do not query them, do not report them, and do not use them for PASS/FAIL.

Canonical validation is:

1. exact PR HEAD;
2. canonical Netlify site `xdrivelogistics` Deploy Preview;
3. migration-file validation inside the Netlify build;
4. targeted ESLint inside the Netlify build;
5. targeted Vitest inside the Netlify build;
6. TypeScript typecheck;
7. production Next.js build;
8. Netlify deploy state `READY` on the exact HEAD;
9. Supabase Preview for DB clean replay / RLS / runtime DB checks.

No visual changes are part of this workstream. Do not touch the Super Admin visual branch.

---

# 1. Git state at checkpoint

## `main`

`main` is still:

`90d06dc628d163755257a6e3ec5e783ac22812cc`

This is the squash merge of PR #501 (`[skip actions] Go-live reviewer and broker RPC hardening`).

## PR #502

PR: **#502 — `Go-live: prepare PostGIS relocation bridge`**  
Branch: `go-live-postgis-relocation-bridge-20260905`  
HEAD: `bf19e83237b57c8fb44716cc7d561507584b0457`  
State: **OPEN / DRAFT / NOT MERGED / mergeable**  
Changed files at last verified state: 6.

**Do not merge PR #502 yet.**

PR #502 contains the PostGIS pre-relocation compatibility bridge, company SELECT RLS reconciliation, contract tests, and migration-history reconciliation scaffolding. It does **not** perform the actual PostGIS relocation.

---

# 2. Netlify gate for PR #502 — PASS

Exact HEAD validated:

`bf19e83237b57c8fb44716cc7d561507584b0457`

Canonical Netlify site: `xdrivelogistics`  
Deploy Preview ID: `6a9b63eebc0cca0009dccc01`  
State: **READY**

The full release gate ran successfully on that exact HEAD:

- migration filename/BOM validation;
- targeted ESLint;
- targeted Vitest;
- TypeScript typecheck;
- production Next.js build;
- secret scan: 1,873 files, 0 matches.

The previous Netlify failure was not a PostGIS or build problem. It was a unit-test assertion that scanned explanatory SQL comments for a legacy predicate. The test was corrected to inspect executable SQL after stripping comments; the subsequent full exact-head gate passed.

If the PR HEAD moves in the next chat, this PASS no longer validates the new HEAD. Re-run canonical Netlify and require `READY` again.

---

# 3. Supabase Preview state for PR #502

Preview branch: `go-live-postgis-relocation-bridge-20260905`  
Preview project ref: `fzkydngxkohpyjvdlxgs`  
Branch ID: `f002a4ed-0193-42c2-a16e-6be91c8e1266`  
Status at last check: `ACTIVE_HEALTHY` / functions deployed.

Verified in Preview:

- `20260905003500_prepare_postgis_schema_relocation_bridge` is present;
- `20260905012000_reconcile_companies_select_rls` is present;
- the two XDrive runtime functions with direct PostGIS name resolution have `search_path = public, extensions, pg_catalog`;
- `companies_select_authorized` is `TO authenticated` and implements creator / active membership / active Platform Owner read semantics.

## Authenticated tenant-isolation probe in Preview — PASS

A rollback-forced authenticated runtime probe created temporary Company A / Company B fixtures, memberships, jobs and invoices, then executed under Company A authenticated JWT claims.

PASS conditions held:

- A could read its own company, membership, job and invoice;
- A could not read B's company, membership, job or invoice;
- A could not update B's job or invoice;
- A could not insert a job into B's company.

After forced rollback / cleanup, Preview counts were verified at zero for test `auth.users`, companies, memberships, jobs and invoices.

## Preview migration-history caveat

An earlier probe was accidentally recorded by the branch migration endpoint as:

`20260905004800_ephemeral_probe_cross_company_job_update_isolation`

It has **no repository migration file**, no remaining business/test rows, and no Production effect.

The connector's reset/delete operation reported `Preview branch not found` for this GitHub-created preview branch even though `list_branches` still reports it healthy. Therefore do not claim a perfectly pristine migration-history replay until that branch-history artifact is either removed through a supported path or the preview is replaced/recreated and replayed.

---

# 4. Production Supabase state

Production project ref:

`jqxlauexhkonixtjvljw`

## Leaked Password Protection

**RESOLVED.**

The user enabled `Prevent use of leaked passwords` in Supabase Auth. Subsequent Production security advisor runs no longer report the leaked-password warning.

## Production hardening applied from already-merged `main`

These are **not PR #502 migrations**. They came from hardening source already merged into `main`, were applied only after precondition checks, and were post-verified.

Production migration history currently records the following actual execution versions:

- `20260904213946` — `add_owner_audit_log_target_company_index`
- `20260905005143` — `restrict_legacy_governance_security_definer_rpcs`
- `20260905005205` — `restrict_hosted_legacy_broker_governance_rpcs`
- `20260905005259` — `remove_hosted_broad_invoice_company_rls_drift`
- `20260905005339` — `close_anonymous_security_definer_rpc_surface`
- `20260905005352` — `reconcile_service_only_security_definer_privileges`
- `20260905005414` — `harden_onboarding_reviewer_rls_scope`
- `20260905005440` — `guard_driver_self_service_protected_fields`
- `20260905005503` — `harden_pod_storage_operator_insert`

### Important migration-history drift warning

The eight hardening migrations applied around 00:51–00:55Z were executed through `apply_migration`, so Production recorded **execution-time versions** (`20260905005xxx`) rather than the repository filename versions such as:

- `20260904222500_restrict_legacy_governance_security_definer_rpcs.sql`
- `20260904223500_remove_hosted_broad_invoice_company_rls_drift.sql`
- `20260904225000_guard_driver_self_service_protected_fields.sql`
- `20260904230000_harden_pod_storage_operator_insert.sql`
- `20260904231500_close_anonymous_security_definer_rpc_surface.sql`
- `20260904232000_reconcile_service_only_security_definer_privileges.sql`
- `20260904233000_restrict_hosted_legacy_broker_governance_rpcs.sql`
- `20260904233500_harden_onboarding_reviewer_rls_scope.sql`

**This version/name parity must be reconciled before a future migration promotion flow.** Do not rewrite `supabase_migrations.schema_migrations` blindly. First compare repository migration validator expectations, Production history, and the idempotency of each source migration. Prefer a deliberate reconciliation plan that preserves audit truth.

## Production effects verified

### Legacy governance RPCs

The following hosted legacy SECURITY DEFINER functions were changed to `service_role` execution only:

- `approve_company`
- `reject_company`
- `submit_company_for_review`
- `create_driver_invite`
- `approve_broker`
- `reject_broker`

Post-verification confirmed `anon=false`, `authenticated=false`, `service_role=true` for these functions.

### Hosted broad RLS drift removed

Removed hosted-only permissive policies included broad invoice membership/authenticated mutation paths, `companies_update_member`, broad job authenticated mutation paths, broad vehicle authenticated insert/update paths, and legacy onboarding applicant paths that weakened the canonical lifecycle contract.

Canonical role-aware policies remained.

### SECURITY DEFINER hardening

Non-PostGIS anonymous SECURITY DEFINER RPC exposure was closed for the targeted functions, trigger-only functions were made non-client callable, and sensitive service-only helpers were reconciled to service-role execution only.

Authenticated SECURITY DEFINER warnings still exist for functions whose client/RLS-helper role may be intentional. These require classification rather than bulk revoke.

### Onboarding reviewer scope

Legacy reviewer policies that treated a generic `admin` profile role as globally privileged were replaced. Global visibility is for active Platform Owner; company owner/admin visibility is constrained to the same active tenant.

### Driver self-service protected fields

A trigger backstop now prevents a driver using the direct self-update path to modify protected fields such as tenant binding, access state, status, password-control fields, international approval, driver type or commercial-bid authority.

### POD Storage

The `pod_photos_insert_operator_for_accessible_job` path was hardened so the operator path requires actual `is_company_operator(...)` authority. Assigned drivers retain their separate exact-assignment upload path.

---

# 5. Production tenant-isolation evidence

## Read-only authenticated Production probe — PASS

A read-only authenticated RLS probe used an existing active non-platform-owner Company A and a distinct Company B with real jobs/invoices.

Under Company A JWT claims, Production verified:

- A can read its own company and own job;
- A cannot read B's company;
- A cannot read B's memberships;
- A cannot read B's jobs;
- A cannot read B's invoices.

The probe deliberately raised `PROBE_PASS_ROLLBACK`. It performed no business-row writes. A follow-up check confirmed no `ephemeral_readonly_production_tenant_isolation_probe` migration-history entry.

**Still pending:** final authenticated **write-path/application smoke** in Production through the real application/authenticated flow, not a destructive DB-only shortcut.

---

# 6. PostGIS / `spatial_ref_sys` — hard blocker remains

Production still has:

- PostGIS version `3.3.7`;
- extension installed in schema `public`;
- extension owner `supabase_admin`;
- `public.spatial_ref_sys` owner `supabase_admin`;
- RLS OFF on `public.spatial_ref_sys`;
- Supabase advisor `rls_disabled_in_public` ERROR;
- Supabase advisor `extension_in_public` WARN;
- PostGIS `st_estimatedextent(...)` SECURITY DEFINER overloads exposed to anon/authenticated because the extension is in the exposed `public` schema.

A prior safe attempt to enable RLS on `spatial_ref_sys` failed with:

`ERROR 42501: must be owner of table spatial_ref_sys`

The transaction rolled back.

XDrive has a real PostGIS dependency:

`public.driver_locations.location` → `geography(Point,4326)`

The repository has a compatibility bridge in PR #502 that prepares runtime name resolution for a Support-assisted move from `public` to `extensions`.

## Absolute PostGIS safety rule

Do **NOT** execute in Production:

- `DROP EXTENSION postgis CASCADE`
- direct `UPDATE pg_extension`
- an unplanned `ALTER EXTENSION postgis SET SCHEMA ...`
- destructive type/table rewrites to force relocation.

The intended path is Supabase Support-assisted relocation/hardening with backup/rollback confirmation and dependency preservation.

Official Supabase reference:

https://supabase.com/docs/guides/database/extensions/postgis

---

# 7. Production advisor state after hardening

Latest Production security advisor still reports:

1. **ERROR** — `public.spatial_ref_sys` RLS disabled.
2. **WARN** — PostGIS extension installed in `public`.
3. **WARN** — PostGIS `st_estimatedextent(...)` SECURITY DEFINER overloads callable from exposed roles.
4. Multiple `authenticated_security_definer_function_executable` warnings for application/RLS helper functions such as membership, job access, invoice/storage helpers, driver flows, etc. These must be classified function-by-function as CLIENT_REQUIRED / RLS_HELPER / SERVER_ONLY / RETIRED. Do not bulk revoke authenticated execution.
5. Multiple `rls_enabled_no_policy` INFO findings. Many of these tables are intentionally fail-closed/internal and should not automatically receive permissive policies. Classify each table by intended exposure and grants before changing anything.

Leaked-password warning is gone.

---

# 8. PR #502 migrations are NOT in Production

Production migration history currently does **not** include the PR #502 source migrations:

- `20260905003500_prepare_postgis_schema_relocation_bridge`
- `20260905012000_reconcile_companies_select_rls`

Do not state or imply they were promoted.

PR #502 remains DRAFT / NOT MERGED until the remaining gate is closed.

---

# 9. Immediate continuation order for the next chat

Start by re-reading this checkpoint, then do the following without asking routine approval:

1. **Verify real current `main` HEAD and PR #502 HEAD/state.** Do not assume neither moved.
2. **Do not use GitHub Actions at all.**
3. **Audit the Production migration-history version mismatch** between repo filenames and the `apply_migration` execution-time versions recorded above. Produce a safe reconciliation plan; do not directly edit migration history as a shortcut.
4. **Preserve PR #502 exact-head evidence.** If HEAD moves, rerun canonical Netlify `xdrivelogistics` and require READY again.
5. **Resolve PostGIS through Supabase Support-assisted relocation/hardening.** Before execution, confirm backup/rollback, downtime, dependency handling and exact target schema.
6. **After Support relocation:** verify `driver_locations.location`, location sync/update functions, tracking, load-alert distance logic, and any `ST_*` callers. Rerun security advisors.
7. **Run final authenticated application write-path smoke** for Company A vs Company B after the schema/security state is final. Include negative cross-tenant INSERT/UPDATE/DELETE, not just SELECT, but avoid destructive changes to real business rows; use controlled test fixtures and rollback/cleanup.
8. **Continue SECURITY DEFINER classification** of remaining authenticated warnings. Revoke only functions proven SERVER_ONLY/RETIRED; preserve client-required and RLS helper contracts with caller-bound checks.
9. **Classify `rls_enabled_no_policy` INFO tables** as internal/fail-closed vs intentionally client-readable. Do not create blanket policies.
10. Only after the above: rerun full security/performance advisors, canonical Netlify exact-head validation, Supabase Preview, and issue the final GO/NO-GO verdict.

---

# 10. Rules for the next chat

- Work autonomously; do not repeatedly ask the user for `OK`.
- Never claim a test/deploy/migration passed unless verified with direct evidence.
- Production mutations must be named explicitly after execution.
- No business-row mutation unless necessary for a controlled E2E fixture with rollback/cleanup.
- No visual changes.
- PR #502 remains DRAFT / NOT MERGED until the remaining security gates close.
- The Super Admin visual branch is out of scope.
- XDrive supports all transport classes; do not introduce a 7.5t platform limit.

## Suggested first message for the next chat

`CONTINUĂ XDRIVE GO-LIVE SECURITY EXACT DIN CHECKPOINT docs/checkpoints/XDRIVE_GO_LIVE_SECURITY_CONTINUITY_CHECKPOINT_2026-09-05_0110Z.md. NU RELUA AUDITUL DE LA ZERO. Verifică mai întâi HEAD-ul real al main și PR #502. GitHub Actions sunt complet excluse din validare. Continuă cu reconcilierea migration-history Production vs repo, apoi PostGIS Support-assisted relocation și final authenticated cross-company write-path smoke. PR #502 rămâne DRAFT / NOT MERGED până la gate final.`
