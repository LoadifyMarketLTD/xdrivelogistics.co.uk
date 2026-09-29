# XDrive Logistics — Master Handoff
Date: 2026-09-28
Repository: `LoadifyMarketLTD/xdrivelogistics.co.uk`

## 0. Canonical repository state

Verified `main` at handoff creation:

- `a7d2d1ceacce9db69de4dada0ec8d2f3e61cd9f0`
- latest merge on `main`: PR #633 — Fix Super Admin Complaints review column
- PR #626 is merged into `main`
- PR #614 is closed, unmerged
- PR #615 is closed, unmerged
- do not revive closed PRs blindly; recover only proven unique work after a current-main diff audit

## 1. Current open PRs

| PR | Purpose | State | Head | Ahead / Behind vs current main | Finalization disposition |
|---|---|---|---|---|---|
| #634 | Super Admin visual polish / sparse states | Draft, open | `f0ded5b163a1ca0450e67d4605d4194450c7e7c9` | 4 ahead / 0 behind | Active; finish authenticated visual/E2E gate, then merge if PASS |
| #632 | Consolidate public funnel + carrier/fleet closeout | Draft, open | `0059601f5442bf1861421998bff607457c2e59f7` | 54 ahead / 3 behind | Active integration PR; must reconcile current main and latest #622 before release |
| #629 | Carrier/Fleet CX operational convergence | Draft, open | `05bc537f39d059b819b815de847371c645416ccb` | 4 ahead / 60 behind | Do not merge directly; treat as source PR for #632 and close only after content-proof |
| #622 | Homepage/Login/Onboarding hardening + recovery | Draft, open | `644d5642336696638f81408a7c9c5bd53ede1714` | 14 ahead / 0 behind | Active; finish independently, then feed exact final head into #632 |
| #607 | GitHub namespace migration prep | Open | `a9e6bb956cd32b868b910355803d613e2cf7d9a0` | 8 ahead / 60 behind | BLOCKED; do not touch/merge until GitHub rename actually happens |

## 2. Global operating rules

1. Work autonomously once the next technical step is clear.
2. Defect workflow: reproduce → isolate cause → repair → local verification → E2E/runtime retest → only then close.
3. Do not use paid GitHub Actions. Use local PowerShell, repository tests, Netlify and real environments.
4. Never call a PR final/PASS from source inspection only.
5. No merge to `main` unless all gates for that PR are PASS.
6. Production data must not be edited merely to make an audit appear clean.
7. Preserve role boundaries and company isolation.
8. Never expose secrets or `.env.local` values.
9. Netlify canonical project is `xdrivelogistics`; ignore/cancel the unrelated `silly-faloodeh-cea857` context.
10. PR #607 remains untouched until the actual namespace rename event.

## 3. PR #622 — Public funnel / onboarding / recovery

### Current verified state

- branch is current with main: 0 behind
- Netlify canonical Deploy Preview is SUCCESS
- latest Netlify Lighthouse reported:
  - Performance 99
  - Accessibility 100
  - Best Practices 83
  - SEO 100
  - PWA 100
- prior user acceptance target remains at least the production-quality gate:
  - Performance 100
  - Accessibility >=97
  - Best Practices >=92
  - SEO 100
  - PWA green/100
- PR body is stale and still cites older verification at `def53544`; it must be updated before merge.

### Onboarding findings carried from active chat

Production Supabase audit established:
- 39 onboarding applications total
- 6 approved
- 22 draft
- 9 in_progress
- 1 invited
- 1 request_changes
- 32 unfinished
- 30 stale >7 days
- unfinished mix includes 18 Owner Driver, 12 Fleet, 2 Individual Driver, 1 Broker
- old onboarding allowed users to reach `review_summary` / 100% without satisfying canonical completeness

Concrete examples retained as evidence:
- Sean Michael Kisby / HNR Express Solutions — Fleet: review summary / 100%, but no company binding and no required company documents
- Paul Gatley — Owner Driver: review summary / 100%, missing Driving Licence + Right to Work, legacy right-to-work value `other`
- Gurmeet Singh — Owner Driver: review summary / 100%, identity documents exist, but registration/make/model remain incomplete

### Required recovery behavior

Do NOT reset existing users or delete progress.

Implement/retain a Legacy Onboarding Recovery flow that:
- preserves valid payload, uploaded documents and identity/company bindings
- recalculates progress from the canonical contract
- derives `missingFields`, `missingDocuments`, and `blockingReasons`
- resumes the existing application instead of creating a new one
- presents only missing requirements to the applicant
- supports secure completion-request email / regenerated resume token where required
- supports notification classes such as `onboarding_completion_required` and `onboarding_reminder`
- provides a Super Admin recovery queue showing progress, blockers, last activity, reminder state and completion state
- does not spam stale/test/duplicate accounts blindly; classify cohorts first
- keeps Production state changes controlled and auditable

### #622 final gate

1. Re-run exact local validation on latest head:
   - TypeScript
   - ESLint
   - onboarding/recovery tests
   - relevant auth/public-funnel suites
   - production build
2. Re-run Netlify preview checks:
   - homepage
   - login
   - register
   - onboarding resume
   - security headers / CSP
   - manifest/service worker/PWA
   - mobile rendering
3. Authenticated E2E for:
   - Customer onboarding
   - Broker onboarding
   - Fleet/Company onboarding
   - Owner Driver onboarding
   - Company Driver / invited driver
   - legacy incomplete user recovery
   - request-changes recovery
   - Super Admin Recovery Queue
   - completion-request/reminder path
4. Verify no cross-role or cross-company onboarding leakage.
5. Repair Lighthouse to the agreed gate; Best Practices 83 is not accepted.
6. Update PR body with current head, exact PASS evidence and known limits.
7. Keep Draft until all of the above are proven.
8. Only after #622 is final should #632 absorb its exact final head/content.

## 4. PR #634 — Super Admin visual polish

### Current state

- 0 behind current main
- 4 commits ahead
- canonical Netlify preview SUCCESS
- local evidence in PR body: TypeScript, ESLint, diff check and 37 focused tests PASS

### Final gate

1. Authenticated visual pass on the canonical Netlify preview.
2. Traverse all 59 Super Admin sidebar destinations, not only the edited pages.
3. Verify:
   - no dead/duplicate information blocks
   - no excessive white space
   - consistent KPI/card hierarchy
   - tables remain readable and operational
   - sparse/empty states are purposeful
   - Global Search initial state is useful
   - Return Journeys no longer renders raw JSON
   - responsive/mobile behavior
4. Run functional smoke on actions present on polished pages so visual work did not break behavior.
5. Re-run TypeScript, ESLint, focused suite and production build after any final polish.
6. If authenticated visual + functional gate PASS, remove Draft and merge.
7. After merge, verify production shell and key Super Admin pages once.

## 5. PR #629 — Carrier/Fleet CX convergence

### Current state

- 60 commits behind current main
- source changes are only 4 commits ahead
- targeted validation on its historical head was strong, but it is too stale to merge directly
- PR #632 was created specifically to consolidate its useful work with #622 on a newer base

### Finalization instruction

Do NOT rebase-and-merge #629 as a standalone release.

1. Compare #629 changed files/commits against:
   - current main
   - #632
2. Prove every still-desired unique behavior exists in #632 or current main:
   - carrier dashboard reports/activity
   - carrier-awarded booking register
   - drivers/vehicles consolidated resources
   - vehicle metadata
   - future positions
   - return journeys
   - tracking handoff
   - vehicle advertising
   - notify-when-tracked
   - company profile schema-backed fields
   - fleet-manager operational boundaries
3. If any unique valid change is missing, port only that change into #632 on top of current main.
4. Once content parity is proven, close #629 as superseded by #632.
5. Never merge its 60-behind branch directly.

## 6. PR #632 — Consolidation / release candidate

### Current state

- 54 commits ahead / 3 behind current main
- canonical Netlify preview SUCCESS
- body states that it consolidates #622 + #629
- it was created before the latest #622 head and before the latest current-main movement
- therefore its body/evidence is not sufficient for release now

### Required reconciliation

1. Rebase/reconcile #632 onto current main `a7d2d1ce...`.
2. Do not manually re-create #622 logic from memory.
3. Wait until #622 reaches its final accepted head, then integrate that exact final state.
4. Re-audit #629 unique content and port only proven still-missing pieces.
5. Preserve current-main work from merged PRs #626, #630, #631, #633 and later main changes.
6. Resolve overlaps semantically, not by preferring one whole branch blindly.
7. After reconciliation, compare resulting tree/file SHAs against:
   - current main
   - final #622
   - unique accepted #629 content
8. Update #632 body to identify exact source SHAs and superseded PRs.

### #632 full release gate

Run on the reconciled head:
- TypeScript PASS
- ESLint PASS
- relevant focused tests PASS
- full Vitest suite PASS
- production build PASS
- migration inventory/duplicate/version checks where Supabase files changed
- Netlify canonical preview SUCCESS
- public-funnel smoke
- authenticated role E2E:
  - Platform Owner/Super Admin
  - Customer
  - Broker
  - Carrier/Company
  - Fleet Manager
  - Owner Driver
  - Fleet Driver
- cross-company negative authorization checks
- canonical job lifecycle smoke where touched
- mobile/responsive smoke on public/onboarding and operational surfaces
- no regression in merged Super Admin surfaces

Only after all gates PASS:
1. take #632 out of Draft;
2. merge #632 to main;
3. verify production;
4. close superseded #629;
5. close #622 only if its full content is proven merged and no independent follow-up remains.

## 7. PR #607 — GitHub namespace migration

Hard block.

- do not touch
- do not merge
- current branch is 60 behind main, which is expected while the rename is deferred
- only resume when the GitHub namespace/account rename to `XDriveLogisticsLtd` is actually being executed

At rename time:
1. confirm new namespace resolves;
2. verify Netlify repo linkage/deploy hooks;
3. verify Supabase/Firebase/Resend and other repo-identity-dependent integrations;
4. verify CODEOWNERS / ownership behavior;
5. reconcile the branch to then-current main;
6. run local gate using the renamed repository URL;
7. only then merge and retest deployment.

## 8. Recommended execution order

1. Finish #634 authenticated visual/functional gate and merge if PASS.
2. Finish #622 completely, including legacy onboarding recovery and Lighthouse gate.
3. Reconcile #632 onto the then-current main and exact final #622.
4. Audit #629 content into #632; close #629 when proven superseded.
5. Run the full #632 release gate and merge only if PASS.
6. Keep #607 blocked until the namespace rename event.

This order minimizes overlapping branch churn and prevents stale PRs from overwriting already-merged work.
