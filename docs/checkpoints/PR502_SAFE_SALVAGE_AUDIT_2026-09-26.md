# PR #502 safe salvage audit — 2026-09-26

PR: #502 `Go-live: prepare PostGIS relocation bridge`
Original branch: `go-live-postgis-relocation-bridge-20260905`
Audit base: current `origin/main`

## Decision

Do not merge PR #502 as a whole. The branch is heavily stale and diverged from
current main. Treat it as a historical donor only.

## File classification

| PR #502 file | Classification | Action |
| --- | --- | --- |
| __tests__/goLiveTenantReviewerHardening.test.ts | Superseded by current main | Keep current main |
| __tests__/postgisRelocationBridge.test.ts | Useful contract, stale path | Rewritten against current hosted bridge |
| docs/checkpoints/XDRIVE_POSTGIS_SUPPORT_HANDOFF_2026-09-05.md | Historical / completed | Do not restore |
| scripts/netlify-release-gate.mjs | Superseded by current main | Keep current main |
| supabase/migrations/20260904213946_add_owner_audit_log_target_company_index.sql | Superseded by stronger current version | Keep current main |
| supabase/migrations/20260905005143_restrict_legacy_governance_security_definer_rpcs.sql | Superseded | Keep current main |
| supabase/migrations/20260905005205_restrict_hosted_legacy_broker_governance_rpcs.sql | Superseded | Keep current main |
| supabase/migrations/20260905005259_remove_hosted_broad_invoice_company_rls_drift.sql | Superseded | Keep current main |
| supabase/migrations/20260905005339_close_anonymous_security_definer_rpc_surface.sql | Superseded by stronger executable convergence | Keep current main |
| supabase/migrations/20260905005352_reconcile_service_only_security_definer_privileges.sql | Superseded | Keep current main |
| supabase/migrations/20260905005414_harden_onboarding_reviewer_rls_scope.sql | Superseded by stronger current policy migration | Keep current main |
| supabase/migrations/20260905005440_guard_driver_self_service_protected_fields.sql | Superseded | Keep current main |
| supabase/migrations/20260905005503_harden_pod_storage_operator_insert.sql | Superseded | Keep current main |
| supabase/migrations/20260905012000_reconcile_companies_select_rls.sql | Stale / unsafe to replay directly | Do not restore |
| supabase/migrations/20260905003500_prepare_postgis_schema_relocation_bridge.sql | Duplicate historical canonical bridge | Do not restore |
| supabase/migrations/20260905012522_prepare_postgis_schema_relocation_bridge.sql | Current main contains active bridge | Keep current main |

## Production evidence

PostGIS is now version 3.3.7 in schema `extensions`.
`extensions.spatial_ref_sys` is owned by `supabase_admin`.
`public.driver_locations.location` remains `geography(Point,4326)` and all
63 current rows have a non-null location.

Current Production company SELECT policies are not the stale state described by
PR #502. The old reconciliation migration must therefore not be replayed without
a new role-by-role authorization test.
## Safe salvage applied on audit branch

- Fresh-replay PostGIS install target aligned to `extensions`, while tolerating
  legacy databases where PostGIS is still in `public`.
- Managed PostGIS is never dropped or relocated by application migrations.
- A current relocation-bridge contract test was restored against the hosted
  bridge migration `20260905012522_prepare_postgis_schema_relocation_bridge.sql`.
- No company RLS policy from PR #502 was restored.
- No PR #502 branch merge or rebase was performed.

## Validation

- PostGIS relocation bridge contract: PASS
- PostGIS hardening ownership contract: PASS
- Existing go-live tenant/reviewer hardening tests: PASS
- Combined targeted result: 9/9 tests PASS
- Supabase migration filename/encoding validation: PASS
