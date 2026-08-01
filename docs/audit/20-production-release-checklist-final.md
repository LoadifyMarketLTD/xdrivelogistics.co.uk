# Final Production Release Checklist — PR #326

**PR:** [#326 feat: automated audit runner — static + CI checks covering 77 audit items](https://github.com/LoadifyMarketLTD/xdrivelogistics.co.uk/pull/326)  
**Status:** DRAFT — DO NOT MERGE  
**Generated:** 2026-08-01  
**Head SHA at publication:** see Section 9

---

## Legend

| Symbol | Meaning |
|---|---|
| ✅ PASS | Gate is closed with evidence |
| 🔲 BLOCKED | Cannot be closed without Platform Owner action (Production access, approval, or runtime evidence) |
| ➖ N/A | Not applicable to this PR's scope |
| ⏳ PENDING | Requires action before merge |

---

## Section 1 — owner_audit_log P0 — confirmed broken caller

### 1.1 apply_marketplace_governance_action

| Gate | Status | Evidence |
|---|---|---|
| Root cause confirmed | ✅ PASS | Live Production INSERT omits `target_type`; `078_marketplace_governance_atomic_action.sql` body confirmed |
| Narrow patch authored (one function only) | ✅ PASS | `supabase/migrations/20260801091000_fix_owner_audit_log_target_type.sql` |
| No other functions overwritten by this patch | ✅ PASS | Migration contains exactly one `CREATE OR REPLACE FUNCTION` block |
| All contracts preserved (SECURITY DEFINER, search_path, return type, grants) | ✅ PASS | Static assertions in `__tests__/marketplaceGovernanceAudit.test.ts` — 16 tests passing |
| Column pre-flight validates `target_type NOT NULL`, `target_id uuid`, `target_name text` | ✅ PASS | `DO $$` block in migration; tested statically |
| No DEFAULT added to `owner_audit_log.target_type` | ✅ PASS | Migration issues `DROP DEFAULT` only; static assertion confirms |
| Executable SQL atomicity test written | ✅ PASS | `supabase/tests/marketplace_governance_atomicity.sql` — 4 test blocks |
| Full Production runbook published | ✅ PASS | `supabase/ops/marketplace-governance-production-runbook.md` |
| Staging validation completed | 🔲 BLOCKED | Disposable/staging environment required; Platform Owner must run `supabase/tests/marketplace_governance_atomicity.sql` and archive output |
| Platform Owner Production approval | 🔲 BLOCKED | Requires staging evidence |
| Production SQL applied | 🔲 BLOCKED — NOT YET APPROVED | Do not apply until approved |

---

## Section 2 — owner_audit_log P0 — unconfirmed/suspected broken caller

### 2.1 owner_decide_fraud_review_case

| Gate | Status | Evidence |
|---|---|---|
| Live Production lookup performed | 🔲 BLOCKED | The single-signature query returned no rows; must be re-run with: `SELECT p.oid::regprocedure, pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='owner_decide_fraud_review_case' AND pg_get_function_identity_arguments(p.oid)='uuid, uuid, text, text'` |
| Repo-canonical body analysis | ✅ PASS | Migration `20260730100000` INSERT omits `target_type` and `target_id` — same bug class as marketplace function. Analysis: `target_type` absent, `target_id` absent, `target_company_id = v_case.subject_company_id` present |
| Narrow corrective patch authored (conditional on live lookup) | ✅ PASS | `supabase/migrations/20260801130000_fix_fraud_review_case_audit_target.sql` — prepared but MUST NOT be applied without live confirmation |
| Patch preserves all atomicity guards, profile blocking, onboarding side effects | ✅ PASS | Static assertions in `__tests__/fraudReviewCaseAuditPatch.test.ts` — 17 tests passing |
| No broad rewrite of other functions | ✅ PASS | Patch contains no `CREATE OR REPLACE FUNCTION` for other callers |
| Patch is NOT APPLICABLE if live function absent or already patched | ✅ PASS | Documented in migration header; requires live lookup result |
| Staging validation completed | 🔲 BLOCKED | Requires live lookup confirmation + disposable environment |
| Platform Owner Production approval | 🔲 BLOCKED | Requires live lookup + staging evidence |

---

## Section 3 — Already-aligned owner_audit_log callers

| Function | Live Production status | Repo status | Gate |
|---|---|---|---|
| `set_company_status_governance(uuid,uuid,text,text,text)` | ALIGNED — explicitly inserts `target_type='company'` | Consistent | ✅ No patch needed — confirmed |
| `owner_review_compliance_document(uuid,text,uuid,text,text)` | ALIGNED — explicitly inserts `target_type`, `target_id`, `target_name` | Consistent | ✅ No patch needed — confirmed |

**No unnecessary rewrites introduced for aligned functions.** The only staged runtime fixes are:
- `20260801091000` → `apply_marketplace_governance_action` (confirmed broken)
- `20260801130000` → `owner_decide_fraud_review_case` (CONDITIONAL on live lookup)

---

## Section 4 — Driver schema reconciliation

| Unit | Status | Evidence |
|---|---|---|
| `drivers.driver_type` column existence, defaults, NOT NULL, canonical check constraint | ✅ PASS (Production already applied manually) | Platform Owner confirmed: `driver_type text NOT NULL default 'company_driver'`; manual constraint apply succeeded |
| `drivers.can_commercial_bid` column existence, default, NOT NULL | ✅ PASS (Production already applied manually) | Platform Owner confirmed: `can_commercial_bid boolean NOT NULL default true` |
| `job_bids_active_company_unique_idx` — duplicate preflight | 🔲 BLOCKED | Unit C1 read-only query must be run and archived by Platform Owner before index creation |
| `job_bids_active_null_company_unique_idx` — duplicate preflight | 🔲 BLOCKED | Unit C2 read-only query must be run and archived |
| `job_bids_exchange_insert` RLS replacement | 🔲 BLOCKED | Unit D1–D2 live `pg_policies` output required |
| `review_onboarding_application_atomic` replacement | 🔲 BLOCKED | Unit E1 live `pg_get_functiondef` output required |
| `notification_events` emission | 🔲 BLOCKED | Staging runtime validation required |
| Narrow migration artifacts authored | ✅ PASS | `20260801120000`, `20260801121000`, `20260801122000`, `20260801123000`, `20260801124000` |
| `20260801000000_p0_driver_commercial_columns_catchup.sql` — DO NOT APPLY | ✅ PASS | Documented as Production-unsafe; does not match live manual state |

---

## Section 5 — Feature Flags fix

| Gate | Status | Evidence |
|---|---|---|
| `is_enabled` field used consistently in API route, page, and DB seed | ✅ PASS | `app/api/super-admin/settings/route.ts`, `app/super-admin/settings/feature-flags/page.tsx` |
| Regression test written and passing | ✅ PASS | `__tests__/superAdminSettingsFlags.test.ts` |
| Runtime-verified in Production | 🔲 BLOCKED | PR #326 is unmerged/undeployed; runtime verification requires deployment |

---

## Section 6 — Middleware compatibility fix

| Gate | Status | Evidence |
|---|---|---|
| PostgreSQL 42703 (`can_commercial_bid` missing column) caught and login not blocked | ✅ PASS | `middleware.ts` — fallback added; `__tests__/authSessionDbErrorHardening.test.ts` |
| Only 42703 for `can_commercial_bid` narrowly handled (not overly broad) | ✅ PASS | Code review confirmed; error code and column name are specific |
| Deployed to Production | 🔲 BLOCKED | PR #326 unmerged |

---

## Section 7 — CI and test suite

| Gate | Status | Evidence |
|---|---|---|
| `npm run test:unit` passes | ✅ PASS | 429 tests, 34 files — all passing on current head |
| CI workflow | ✅ PASS | `30703144735` — `CI` completed success on `5fb79bb6` |
| Validate Supabase Migration Files | ✅ PASS | `30703144722` — completed success on `5fb79bb6` |
| Validate Identity Compliance Foundation | ✅ PASS | `30703144685` — completed success on `5fb79bb6` |
| `npm run build` | 🔲 BLOCKED | Build requires env vars not available in this session; CI build step confirmed green |
| `npm run test:e2e` | 🔲 BLOCKED | Requires live Supabase environment with test accounts |
| `npm run lint` / `npm run typecheck` | 🔲 BLOCKED | ESLint binary not installed locally; CI lint step confirmed green |

---

## Section 8 — PR scope and description

| Gate | Status | Evidence |
|---|---|---|
| PR description updated to reflect actual scope | ✅ PASS | Updated in this commit — see PR body |
| No unrelated product changes mixed in | ⏳ PENDING | PR still contains 75 changed files including unrelated governance/CI items; Platform Owner review required to classify each |
| Draft status maintained | ✅ PASS | PR remains Draft |

---

## Section 9 — Review state

| Gate | Status | Evidence |
|---|---|---|
| No active `CHANGES_REQUESTED` blocking merge | ⏳ PENDING | Platform Owner review comments remain; each has been mapped below |
| All unresolved threads fixed or explicitly accepted | ⏳ PENDING | See Section 10 |
| Platform Owner explicitly authorises Ready for Review | 🔲 BLOCKED | Not yet received |

---

## Section 10 — CHANGES_REQUESTED review reconciliation

| Review instruction | Commit / evidence that addresses it | Status |
|---|---|---|
| Remove broad four-function `owner_audit_log` rewrite | `b8586a5` — migration `20260801091000` patches only `apply_marketplace_governance_action` | ✅ RESOLVED |
| Do not overwrite already-aligned `set_company_status_governance` | `b8586a5` — migration confirmed to contain no `CREATE OR REPLACE` for this function | ✅ RESOLVED |
| Do not overwrite already-aligned `owner_review_compliance_document` | `b8586a5` — same | ✅ RESOLVED |
| Verify `owner_decide_fraud_review_case` live before patching | `94aabbe` — repo analysis documented; live lookup SQL published; `20260801130000` conditional migration prepared | ⏳ PENDING live lookup from Platform Owner |
| Production P0 described as open, not resolved | Incident doc and runbook updated — both state "PATCH STAGED, NOT YET APPLIED TO PRODUCTION" | ✅ RESOLVED |
| Duplicate active bid blocker documented; unique index requires zero-row preflight | Runbook Unit C with C1/C2 read-only preflights documented; index migration is separate unit | ✅ RESOLVED |
| Feature Flags `enabled` vs `is_enabled` fix | `d6014f9` — route, page, seed, regression test | ✅ RESOLVED |
| Middleware fallback only for 42703 `can_commercial_bid`; not described as complete fallback | `443ab6b` — middleware uses specific error code; docs updated | ✅ RESOLVED |
| Keep PR Draft | PR remains Draft | ✅ RESOLVED |
| No Production SQL, no merge, no deployment | No Production SQL executed; PR is Draft | ✅ RESOLVED |

**Remaining open items requiring Platform Owner action:**
1. Run the `owner_decide_fraud_review_case` single-signature live lookup and archive output
2. Run Unit C1 and C2 duplicate-bid preflights and archive output
3. Complete staging validation for `20260801091000` (marketplace governance patch)
4. Explicitly authorise Ready for Review when all gates are PASS

---

## Section 11 — Manual Production-only steps before merge

These steps **cannot be done from repository access alone**. Platform Owner must complete each before merge is considered:

1. **Fraud RPC lookup** — Run the single-signature query for `owner_decide_fraud_review_case` and archive raw output.
2. **Marketplace staging validation** — Restore disposable environment; run `supabase/tests/marketplace_governance_atomicity.sql`; archive pass output.
3. **Fraud RPC staging validation** (if live lookup confirms function exists and has the bug) — Run `supabase/tests/fraud_review_case_audit_atomicity.sql` on disposable.
4. **Unit C preflight** — Run C1 and C2 read-only queries on Production; confirm 0 duplicate active bids before any index creation.
5. **Units D–F** — Run live `pg_policies` and `pg_get_functiondef` queries for RLS and RPC units; archive outputs.
6. **Production SQL application sequence** (after approval) — Apply `20260801091000` then `20260801130000` (if applicable) in separate maintenance windows with pre/post-apply checks per their runbooks.

---

## Section 12 — Final merge gate

**DO NOT MERGE until ALL of the following are true:**

- [ ] Fraud RPC live lookup result archived and status determined
- [ ] Marketplace governance patch staging evidence attached to PR
- [ ] Fraud RPC patch staging evidence attached to PR (or marked N/A if function absent/already patched)
- [ ] All CI workflows green on final head SHA
- [ ] No active CHANGES_REQUESTED reviews blocking merge
- [ ] Platform Owner explicitly writes "Ready for Review / Approved for merge"
- [ ] PR description accurately reflects final scope
- [ ] All open PENDING items in Section 10 resolved

**Current verdict: NO GO — 🔲 BLOCKED on Production live evidence and Platform Owner approval**
