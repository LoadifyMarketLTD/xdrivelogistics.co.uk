# XDrive Full E2E Remediation Continuity Checkpoint — 2026-08-30 21:40 BST

## Purpose

This is the canonical handoff for the next chat. Continue the FULL XDrive platform remediation from the real current state. Do **not** restart the audit, do **not** re-audit already closed P0 items from zero, and do **not** ask the user to repeat screenshots or completed runtime checks.

The working rule is strict: **one defect at a time, close it completely, then move to the next defect.** A point is only CLOSED when the production state is correct, the durable code/schema fix exists in GitHub, runtime/transactional proof is complete where possible, the exact PR HEAD has a successful canonical Netlify preview, the PR is merged, and post-merge `main` + production invariants are rechecked.

The user wants autonomous execution and only final results per completed point. Ask the user only when a product/business decision is genuinely required or when a physical-device/runtime action cannot be performed with available tools.

---

# 1. Repository / production anchors

Repo: `LoadifyMarketLTD/xdrivelogistics.co.uk`

Production Supabase project: `jqxlauexhkonixtjvljw`

Canonical web/main at checkpoint:
- `main`: `b5d632492b98006423679d0b1eaa7bdf8765950d`
- merge message: `Reconcile company compliance onboarding contract (#419)`

Driver mobile canonical app remains:
- `apps/driver-mobile`
- Expo / React Native
- **do not reintroduce Android-native/Kotlin as the primary Driver app**

Current branch protection truth at checkpoint:
- `main.protected = false`
- no required status checks enforced

GitHub Actions truth:
- jobs have repeatedly failed before runner startup (`runner_id: 0`, `steps: []`)
- this is **not application test failure** and must never be called PASS either
- canonical Netlify preview is the current deploy gate available through connected tooling

---

# 2. Non-negotiable product / engineering boundaries

1. No PR #359 Workspace visual imports.
2. Do not broadly alter `/super-admin` visuals/layout without fresh explicit product authorization.
3. The earlier explicit authorization was narrow: Super Admin → Compliance → Document Review may expose the existing canonical onboarding approval control. Do not extrapolate that permission to unrelated Super Admin redesign.
4. Never weaken RLS, ACLs, Driver eligibility, compliance gates, invoice validation, or SECURITY DEFINER boundaries just to make legacy data pass.
5. Do not use real third-party/private user accounts as mutation fixtures. In particular, do not use `Dola Self Employed` or other real users for testing.
6. Prefer rollback-only generated fixtures or clearly synthetic `Visual Audit` / `example.test` data when a real hosted proof is required.
7. Never delete historical/company/vehicle/document records only because they look like test/legacy data; establish provenance first.
8. Do not claim runtime PASS from static code review.
9. Do not claim GitHub Actions PASS when the runner never started.
10. Posted loads remain immutable after posting; operational changes are append-only Driver instructions/messages (#406 policy).

---

# 3. Role of the assistant in this workstream

Act as:
- Technical Lead
- Principal Engineer
- Database/Security Auditor
- Release Gatekeeper

The user is Product Owner / final product decision-maker. The assistant owns the technical diagnosis, safe fix design, GitHub/Supabase implementation, hosted proof, PR hygiene, deploy gate and merge decision where connected tooling permits.

---

# 4. Closed remediation points — DO NOT reopen without new evidence

## P0-01 — Driver ↔ Vehicle ↔ Company integrity — CLOSED / PASS

Canonical PR: #408

Result:
- orphan vehicle company refs: 0
- cross-company Driver/Vehicle assignments: 0
- Drivers with >1 ACTIVE assigned vehicle: 0
- `vehicles.company_id -> companies.id` validated FK
- one-active-assignment partial unique index
- cross-company assignment trigger
- transactional proof for FK / unique / company guard

Superseded PR: #407, closed without merge.

## P0-02 — Canonical Driver identity gate — CLOSED / PASS

Canonical PR: #409

Result:
- enum-safe Driver/profile fail-closed states
- historical Drivers without active verified identity made non-operational, not fabricated/approved
- approval remains the positive identity activation event
- identity hold/ban/close propagates fail-closed access
- active Driver/app/profile/membership without verified canonical Driver identity: 0

## P0-03 — Company membership governance integrity — CLOSED / PASS

Canonical PR: #410

Result:
- ACTIVE membership only valid inside ACTIVE company
- pending company memberships stay `invited`
- rejected/suspended/inactive company memberships become `disabled`
- transition away from ACTIVE revokes active memberships transactionally
- active memberships on non-active companies: 0

## P0-04 — Company governance activation compliance — CLOSED / PASS

Canonical PR: #411

Result:
- DB governance RPC itself calls canonical company compliance gate before ACTIVE
- service-role direct caller cannot bypass HTTP route compliance checks
- failed activation does not change status or create false audit event

## P0-05 — Legacy `accept_bid` authority bypass — CLOSED / PASS

Canonical PR: #412

Result:
- legacy `accept_bid(uuid)` and old overload retired
- canonical `accept_job_bid_atomic(uuid,uuid)` remains sole award RPC in that family
- client roles cannot execute canonical award RPC directly

## P0-06 — Storage object-path RLS — CLOSED / PASS

Canonical PR: #413

Result:
- repaired policies that resolved object path from `drivers.name` instead of `storage.objects.name`
- load/POD/vehicle private object authorization repaired
- POD Driver insert tightened to exact assigned job/company
- restricted evidence tables remain non-readable directly by `authenticated`
- helper predicates used instead of raw table grants
- `storage.foldername(d.name)` policy definitions: 0
- real authenticated-role read proof passed for assigned Driver and denied unrelated Customer

## P0-07 — Onboarding submission authority — CLOSED / PASS

Canonical evolution:
- #414 first bound submission to authenticated owner
- #416 finalized actor-bound/service-only authority and canonical submit-state normalization

Result:
- browser `authenticated` cannot execute privileged submit RPCs directly
- service actor-bound path verifies target owner
- private base implementation remains non-client callable
- stale `submitted` state normalized to canonical `under_review`

## P0-08 — Awarded/assigned job lifecycle integrity — CLOSED / PASS

Canonical PR: #417

Superseded PR: #415, closed without merge.

Result:
- historical marked test jobs carrying award/assignment authority while still pre-award were reconciled
- DB prevents award/assignment fields on `draft/open/received/posted/quoted`
- accepted bid requires carrier award
- assigned company must equal awarded carrier
- Driver assignment requires company assignment
- current impossible pre-award authority rows: 0

## P0-09 — Finance/VAT snapshot integrity — CLOSED / PASS

Canonical PR: #418

Result:
- historical non-VAT test commercial agreements/invoice reconciled
- payable test invoice: £28 net / £0 VAT / £28 total / `not_registered`
- old zero-value orphan test invoice retained as `void`, not fabricated into a payable invoice
- duplicate money fields synchronized
- VAT treatment semantics aligned with app, including reverse-charge semantics
- commercial agreement immutability restored after repair window
- company settings / agreements / invoice inconsistency counters: 0 / 0 / 0

## P0-10 — Company compliance contract convergence — CLOSED / PASS

Canonical PR: #419

Merged `main` at checkpoint: `b5d632492b98006423679d0b1eaa7bdf8765950d`

Hosted migrations include:
- `reconcile_company_compliance_contract`
- `verify_company_compliance_contract_runtime`
- `harden_company_compliance_identity_gate`
- `verify_company_compliance_identity_gate_runtime`

Final result:
- Owner Driver required identity docs exactly: `driving_licence`, `proof_of_address`, `right_to_work`
- Personal / Driver Insurance is optional and never an Owner Driver activation blocker
- Vehicle Insurance remains separate canonical vehicle compliance
- Fleet required company docs exactly: `company_registration`, `goods_in_transit`, `public_liability`, `vehicle_insurance`
- `fleet_operator` requirement alias mirrors `fleet_courier`
- obsolete `motor_fleet_insurance` requirement/doc naming normalized to `vehicle_insurance`
- every company activation resolves linked onboarding and calls full onboarding compliance assertion
- Owner Driver cannot bypass identity evidence during company activation
- Broker/Fleet remain fail-closed on company evidence
- helper is unavailable to anon/authenticated
- rollback-only generated `@example.test` proof used; no private third-party fixture

---

# 5. CURRENT ACTIVE POINT — P0-11

## Title
Legacy Fleet onboarding convergence / binding

## PR
- PR: #420 — `Converge legacy Fleet onboarding bindings`
- state at checkpoint: OPEN
- draft: false
- mergeable: true
- merged: false
- base: `main`
- base SHA: `b5d632492b98006423679d0b1eaa7bdf8765950d`
- branch: `fix/legacy-fleet-onboarding-convergence-20260830`
- HEAD: `8dc1bc26c4999f68fae0b54f5e77fef574198ef8`
- changed files: 4
- commits: 4

## Exact Netlify status on #420 HEAD at checkpoint

For `8dc1bc26c4999f68fae0b54f5e77fef574198ef8`:
- `netlify/xdrivelogistics/deploy-preview`: **SUCCESS**
- canonical preview URL: `https://deploy-preview-420--xdrivelogistics.netlify.app`
- secondary Netlify preview: **SUCCESS**

Therefore #420 is currently at the final merge gate, subject to verifying HEAD/base have not changed in the next chat.

## Production work already applied for P0-11

Hosted migrations already applied:
- `reconcile_legacy_fleet_onboarding_bindings`
- `verify_legacy_fleet_onboarding_convergence`

Production truth after hosted repair:
- legacy `onboarding_applications.account_type='fleet_operator'`: 0
- all 9 historical Fleet applications now persist `fleet_courier`
- 4 strong pending-company bindings reconciled using redundant evidence
- those 4 companies remain `pending_approval`
- those 4 owner memberships remain `invited`
- those 4 companies normalized from legacy `standard` to canonical `carrier`
- each lacks exactly the four canonical required Fleet company docs: `company_registration`, `goods_in_transit`, `public_liability`, `vehicle_insurance`
- 2 legacy Fleet applications associated historically with active companies remain intentionally unbound because evidence is insufficient
- 3 Fleet applications have no company and remain intentionally unbound
- no membership was activated
- no company was approved
- no approved document was fabricated

## Mandatory first action in next chat

1. Read this checkpoint in full.
2. Verify real `main` HEAD.
3. Verify PR #420 exact state and exact HEAD.
4. Verify canonical Netlify status for that exact HEAD.
5. If still HEAD `8dc1bc26...`, base still current and canonical Netlify remains SUCCESS, merge #420 with SHA guard.
6. Post-merge verify new `main` and production P0-11 invariants.
7. Only after that mark P0-11 CLOSED / PASS and continue.

If `main` advanced or #420 HEAD changed, do **not** blindly merge. Recalculate diff/mergeability and replay/rebase on current main if needed, then require a fresh canonical preview success.

---

# 6. Immediate next problem after P0-11 — P0-12

## Remaining legacy Fleet/company binding cohort

P0-11 deliberately did not guess ambiguous historical ownership.

After #420 closes, audit and resolve the remaining 5 Fleet applications one by one:
- 2 have a legacy active company but no proven profile/company binding and no membership
- 3 have no company at all

Required method:
- establish provenance from auth user, profile history, company creator, onboarding payload, memberships, owner audit log, company registration audit, job/quote/invoice history and any relevant historical migration evidence
- classify each record `KEEP / REPAIR / MIGRATE / REMOVE`
- never infer company binding merely from email/name similarity
- do not downgrade/activate/approve a real company merely to make onboarding consistent
- do not use a real private user as mutation fixture

Close P0-12 only when every remaining legacy Fleet application has a justified canonical state or is intentionally retained with an explicit reason and cannot create authority ambiguity.

---

# 7. Old PR #405 — IMPORTANT

PR #405 is still:
- OPEN
- DRAFT
- NOT MERGED
- current reported head: `f2cd0a25028505b38ee05e0942d6f38cab4ad80c`
- 31 commits / 23 files
- stale base and stale PR body relative to current production/main

**DO NOT MERGE #405 wholesale.**

Much of its original Owner Driver / vehicle / identity / compliance problem has now been solved canonically by later P0 PRs (#408–#420).

After the remaining data/security P0 series is stable:
1. compare #405 against current main;
2. identify anything still unique and genuinely needed;
3. particularly check the narrowly authorized Super Admin onboarding review queue feature;
4. if still required, port only the minimal unique feature onto a fresh branch from current main;
5. runtime test using the Platform Owner’s own Owner Driver case or a generated synthetic fixture, never Dola/another private user;
6. close #405 as superseded once any required unique code has been safely replayed.

PR #400 is already CLOSED / NOT MERGED.

---

# 8. Remaining critical release/governance work from FULL audit

These were not invalidated by P0-01…P0-11 and remain open unless new evidence proves otherwise.

## Release governance
- `main` currently unprotected
- required status checks are not enforced
- GitHub Actions runner startup remains broken/infrastructure-blocked
- restore executable CI, then protect `main` and enforce relevant checks
- never mark application CI failed or passed when the job never started

## Residual security sweep
After all current DDL:
- rerun Supabase security + performance advisors
- re-audit remaining `SECURITY DEFINER` functions executable by client roles
- re-audit Storage policies after each related schema change
- keep `spatial_ref_sys` treated as PostGIS-managed; do not blindly enable/change RLS there without PostGIS/Supabase-specific justification

## Schema/authority consolidation
Still audit for real consumers before retirement:
- `company_members` vs canonical `company_memberships`
- duplicate `updated_at` / invoice-number / other legacy triggers
- historical parallel models (`loads` vs jobs where applicable, generic documents vs domain document tables, notification queue vs inbox semantics, generic audit vs owner audit)
- remove only after producer/consumer dependency map is proven

---

# 9. Runtime E2E gates still not truthfully PASS

Do not call these PASS from source existence alone.

1. Customer → Driver append-only operational instruction end-to-end
2. physical Expo Multi-drop stop progression
3. canonical POD upload/signature/recipient/customer visibility
4. current live Driver GPS tracking (historical July rows are not current live proof)
5. ETA snapshot + tracking-share-token flow
6. real telematics provider binding and ingest
7. Smart Load Alerts opt-in → matcher → dedupe → notification/push
8. authenticated PAF postcode lookup in live environment
9. push delivery end-to-end
10. Return Journey full lifecycle fresh runtime
11. payment lifecycle after canonical invoice
12. disputes workflow with safe fixture
13. reviews/reputation workflow
14. support ticket workflow

Physical Expo testing may ultimately require the user/device. Do not ask for it until all server/static prerequisites for that exact gate are complete.

---

# 10. Super Admin / operational UX backlog from FULL audit

Do not start broad visual redesign until functional/data truth is stable.

Still requires dedicated audit/remediation:
- Platform Health: HTTP success must not always equal Healthy when latency is severe
- Integration Readiness: configured env secret != implemented integration != successful runtime health
- Company Approval readiness: must use canonical onboarding/compliance truth, not a parallel score
- Document Review: approved/verified rows should not expose ambiguous Approve/Reject semantics; use explicit revoke/reopen/supersede workflow if product wants reversals
- Drivers Governance: present company/identity/compliance/vehicle/app-access truth, not only availability/location
- Companies Governance: distinguish governance status from compliance/readiness status
- Compliance navigation/information architecture overlap
- Driver-facing compliance language should be human operational language, not internal canonical/remediation terminology

Visual direction from user screenshots:
- current Super Admin is too sparse/technical/generic-table-like
- redesign should be coherent platform-wide, not one page at a time
- preserve XDrive branding and light operational design
- do not import PR #359 Workspace visual differences

---

# 11. Finance/legal backlog after P0-09

P0-09 fixed canonical VAT/money integrity, but separate product/legal items remain:
- invoice email/template contains a hard-coded £25/week overdue-charge statement in existing UI code; do not retain as universal hard-coded policy unless confirmed by company terms/legal policy
- Terms page language around CPC/tachograph requirements may be overly universal across vehicle/work types
- Terms/payment/late-fee wording should be reviewed before final launch

Do not weaken DB finance guards while reviewing copy/policy.

---

# 12. Production cleanup backlog

Potential cleanup candidates exist, including Visual Audit/example.test records and unreferenced Storage objects.

Rules:
- classify first
- preserve audit/legal/financial evidence
- do not delete because a record name looks synthetic
- for clearly synthetic records, verify no jobs/invoices/POD/finance/audit dependency before removal

Previously observed unreferenced object debt existed in Driver/vehicle document buckets; re-count after current migrations before any cleanup.

---

# 13. FULL E2E final release gate

After all defects and P1/P2 consolidation work, run one fresh role-complete journey:

- Customer registration/onboarding/workspace
- Broker registration/onboarding/workspace
- Fleet company registration/onboarding/compliance/approval
- Company Driver invitation/onboarding/identity/vehicle assignment
- Owner Driver onboarding/compliance
- Post Load / Multi-drop
- quote / bid
- award
- allocation
- Driver mobile execution
- live tracking
- Driver instruction/change message
- POD
- invoice
- payment/reconciliation
- dispute/review/support as applicable
- Platform Owner oversight/audit

Release PASS requires UI ↔ API ↔ DB ↔ Storage ↔ notifications ↔ mobile agreement, not just static tests.

---

# 14. Continuation command for the next chat

Use this exact intent:

> CONTINUE XDRIVE FULL E2E REMEDIATION EXACTLY FROM `docs/checkpoints/XDRIVE_FULL_E2E_REMEDIATION_CONTINUITY_CHECKPOINT_2026-08-30_2140.md`. Read it fully first. Verify current `main`, PR #420 and hosted Supabase before any write. Continue strictly one defect at a time: finish #420/P0-11 first, then P0-12 and the remaining audit backlog in checkpoint order. Do not reopen already closed P0 items without new evidence. Do not merge stale PR #405 wholesale. Keep Expo/React Native canonical, no PR #359 Workspace visuals, no RLS/security relaxation, no private third-party fixtures. Work autonomously and report only completed-point results unless a genuine product/physical-device decision is required.

---

# 15. Checkpoint truth summary

At checkpoint creation:
- P0-01 through P0-10: CLOSED / PASS / merged
- current `main`: `b5d632492b98006423679d0b1eaa7bdf8765950d`
- P0-11 PR #420: OPEN / non-draft / mergeable / NOT MERGED
- #420 HEAD: `8dc1bc26c4999f68fae0b54f5e77fef574198ef8`
- #420 canonical Netlify preview on that exact HEAD: SUCCESS
- P0-11 hosted production migrations and verification: already applied successfully
- next action: reverify exact state, merge #420 if unchanged/green, post-merge verify, then start P0-12
- #405 remains stale OPEN/DRAFT and must not be merged wholesale
- `main` branch protection remains OFF
- GitHub Actions runner-start problem remains unresolved
- multiple physical/runtime E2E gates remain open

This checkpoint is documentation-only. Do not merge it as product code merely to continue the work; it exists to preserve continuity.
