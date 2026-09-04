# XDrive Legal Contractual Gate — Continuity Checkpoint

**Created:** 2026-09-04 22:15 BST / 21:15 UTC
**Repository:** `LoadifyMarketLTD/xdrivelogistics.co.uk`
**Workstream:** Role-specific contractual gate / legal evidence / re-acceptance
**Active branch:** `legal/role-contractual-gate-20260904`
**PR:** #499 — `Draft: role-specific contractual gate architecture`
**PR state at checkpoint:** OPEN / DRAFT / NOT MERGED / mergeable
**Production/main must remain untouched until preview validation and explicit approval.**

## Canonical repository state

- Real `main` HEAD at checkpoint: `d88661dd4d89a09b9c682e502995a1c4ec072e45`
- PR #499 implementation HEAD before this checkpoint commit: `14dbd9ef98f381d6bf55918db8466c53ff4d1306`
- PR #499 had 13 commits, 10 changed files, 973 additions, 9 deletions before adding this checkpoint.
- After this checkpoint file is committed, the branch HEAD will advance. In the next chat, **verify the real current HEAD of both `main` and PR #499 before making any change; do not assume either has remained static.**

## Non-negotiable constraints

1. Keep PR #499 DRAFT / NOT MERGED until preview and functional validation are complete and the user explicitly approves merge.
2. Do not modify Production or apply Supabase migrations to Production.
3. Do not modify `/super-admin` visuals.
4. Workspace visuals remain untouched unless explicitly requested.
5. Do not fabricate role-specific legal routes or solicitor-reviewed wording. Existing canonical legal routes are used until dedicated wording is approved.
6. Privacy acknowledgement stays separate from contractual acceptance.
7. Legal evidence must be server-side, fail-closed, versioned and append-only; browser metadata alone is not sufficient as the final source of truth.
8. Extend existing `job_commercial_agreements` for job-level contracting rather than creating a second competing commercial-contract source of truth.
9. Final launch wording remains subject to UK commercial/transport/platform solicitor review.
10. User does not want repeated confirmation prompts. When the next action is already agreed, continue autonomously and report only meaningful state changes/blockers.

## Implemented on PR #499

### 1. Legal architecture documentation

`docs/legal/XDRIVE_ROLE_CONTRACTUAL_GATE_ARCHITECTURE_2026-09-04.md`

Defines the layered architecture:
- platform membership / terms of use;
- marketplace / transport trading terms;
- role-specific terms and declarations;
- registration acceptance evidence;
- onboarding/compliance declarations;
- job-level contract evidence;
- re-acceptance when materially changed terms require it.

### 2. Public Legal Centre

`app/legal/page.tsx`

Public legal access was added. Earlier TypeScript failure from a bad company-config import was fixed. Correct canonical import is from `app/config/company.ts` using `../config/company` from `app/legal/page.tsx`.

### 3. Canonical registration agreement definitions

`lib/legal/registrationAgreements.ts`

Registration roles:
- `customer_shipper`
- `transport_broker`
- `owner_operator`
- `fleet_operator`

Existing canonical documents currently used:
- XDrive Platform Terms → `/terms`, document version `2026-09-01`
- Membership & Subscription Terms → `/subscription-terms`, version `2026-09-01`
- Marketplace & Transport Trading Terms → canonical `/terms` until dedicated reviewed route exists
- role-specific logical agreement codes currently resolve to `/terms` rather than inventing non-existent routes.

Legal gate architecture version is `2026-09-04`.

### 4. Role-specific registration gate UI

`app/register/RegistrationAgreementGate.tsx`
`app/register/page.tsx`

The previous single generic checkbox has been replaced with role-specific agreements and declarations.

Current behavior:
- nothing is pre-selected;
- all mandatory confirmations are required before account creation;
- changing role resets legal confirmations;
- Privacy Policy is acknowledged separately, not phrased as contractual acceptance;
- registration metadata carries the legal role, exact agreement list, versions and acceptance timestamps needed for later server validation;
- existing signup/onboarding flow is preserved.

### 5. Registration legal evidence validator

`lib/legal/registrationEvidence.ts`

Server-side validator currently:
- accepts only the four supported registration roles;
- verifies the exact expected agreement list and versions against canonical config;
- validates timestamps;
- requires the authority, role-declaration, privacy and agreement timestamps to represent the same acceptance action;
- checks legal architecture version and privacy version;
- reconstructs canonical acceptance text/declarations server-side rather than trusting arbitrary browser text;
- builds a SHA-256 `evidenceHash` over the canonical evidence payload;
- returns `null` for incomplete or tampered modern legal metadata.

### 6. Immutable registration legal acceptance migration

`supabase/migrations/20260904210500_registration_legal_acceptance_evidence.sql`

Creates `public.registration_legal_acceptances` with fields for:
- `user_id`
- optional `company_id`
- optional `onboarding_application_id`
- `registration_role`
- `legal_version`
- exact agreement JSON snapshot
- acceptance / authority / role / privacy statements
- privacy version
- accepted timestamp
- source
- user agent
- SHA-256 evidence hash
- created timestamp

Integrity/security characteristics:
- FK references use `ON DELETE RESTRICT` to protect evidence from being cascaded away;
- agreement payload must be a JSON array;
- hash format constrained to 64 lowercase hex chars;
- `(user_id, evidence_hash)` unique for idempotency;
- indexes for user, company and onboarding lookups;
- RLS enabled;
- direct `anon` / `authenticated` table access revoked;
- UPDATE and DELETE are blocked by append-only triggers.

**Migration is committed to the preview branch only. It has NOT been applied to Production.**

### 7. Server persistence in onboarding init

`app/api/onboarding/init/route.ts`

The registration legal evidence persistence is integrated with onboarding initialization. Intended/current contract:
- authenticated token is validated server-side;
- server reads auth metadata and reconstructs/validates canonical legal evidence;
- modern legal metadata that is present but incomplete/tampered causes fail-closed behavior rather than silently accepting it;
- valid acceptance is inserted into `registration_legal_acceptances` via trusted server/service-role path;
- duplicate `(user_id, evidence_hash)` is treated idempotently;
- missing migration/schema is surfaced explicitly rather than silently losing evidence;
- onboarding application linkage is stored when available;
- no Production migration has been executed.

### 8. Tests

`__tests__/registrationLegalEvidence.test.ts`

Covers the four roles and negative/tampering cases, including document/version mismatch and inconsistent timestamps. The next chat should inspect this file before changing the evidence contract.

## PR #499 changed files before checkpoint

1. `__tests__/registrationLegalEvidence.test.ts`
2. `app/api/onboarding/init/route.ts`
3. `app/legal/page.tsx`
4. `app/register/RegistrationAgreementGate.tsx`
5. `app/register/page.tsx`
6. `docs/legal/XDRIVE_ROLE_CONTRACTUAL_GATE_ARCHITECTURE_2026-09-04.md`
7. `lib/legal/contractualGate.ts`
8. `lib/legal/registrationAgreements.ts`
9. `lib/legal/registrationEvidence.ts`
10. `supabase/migrations/20260904210500_registration_legal_acceptance_evidence.sql`

This checkpoint becomes an additional changed file after commit.

## Netlify / CI truth at checkpoint

Do **not** carry forward the statement that the newest xdrivelogistics preview is already PASS without rechecking.

At 2026-09-04 21:15 UTC, GitHub status for implementation HEAD `14dbd9ef98f381d6bf55918db8466c53ff4d1306` showed:
- `netlify/xdrivelogistics/deploy-preview` → **PENDING / Deploy Preview processing**
- `netlify/silly-faloodeh-cea857/deploy-preview` → status entry marked success but description says **Deploy Preview canceled**; this is not the canonical xdrivelogistics preview to rely on.

Therefore the canonical Netlify result for `xdrivelogistics` was **PENDING at checkpoint time**. The next chat must re-check the new branch HEAD after the checkpoint commit and verify the canonical xdrivelogistics preview result.

The user reported that GitHub Actions appeared red and failed before any job step. This was **not independently verified in this checkpoint**. Treat it as a lead only; inspect actual workflow runs/jobs before concluding whether it is infrastructure/permission related or a code failure.

## Current product/legal target

The agreed flow is:

`Register contractual gate → immutable server evidence → role-specific onboarding/compliance → membership activation → job-level contractual record → Legal & Agreements history → controlled re-acceptance for material changes`

The registration phase and first server-evidence foundation are now in PR #499. The next work is the user-visible/read-side legal record and re-acceptance architecture, without weakening evidence integrity.

## Exact next steps for the next chat

1. Read this checkpoint in full. **Do not restart the legal audit from zero.**
2. Verify real current `main` HEAD.
3. Verify real PR #499 HEAD, state, changed files and whether anything moved after this checkpoint.
4. Verify canonical `netlify/xdrivelogistics/deploy-preview` for the current PR HEAD. Do not use the canceled `silly-faloodeh-cea857` result as proof of PASS.
5. Inspect GitHub Actions workflow runs/jobs if they are still red; determine whether jobs truly failed pre-step or whether code/tests ran.
6. Inspect the latest `app/api/onboarding/init/route.ts`, `lib/legal/registrationEvidence.ts`, migration and `__tests__/registrationLegalEvidence.test.ts` before modifying them.
7. If preview/build is green, implement **Legal & Agreements read/history server route** with strict user/company scoping. Do not expose direct table reads from the browser.
8. Add the corresponding **Legal & Agreements account/settings UI** only where it fits existing workspace architecture; do not modify `/super-admin` visuals and do not redesign unrelated workspace UI.
9. Show accepted legal role, agreement names/codes, exact versions, accepted date/time, current-vs-superseded status, and evidence record/reference. Do not expose sensitive server metadata unnecessarily.
10. Design the **material-change re-acceptance** mechanism:
   - determine current required document versions from canonical config;
   - compare with latest accepted evidence;
   - fail closed only for changes explicitly classified as requiring re-acceptance;
   - provide controlled login/account gate rather than silently accepting new terms;
   - append a new evidence record; never mutate the historical acceptance row.
11. Before touching job-level contracts, inspect existing `job_commercial_agreements`, especially migrations `126_finance_foundation_0b.sql`, `20260725171000_accept_bid_creates_commercial_agreement.sql`, `20260723111500_invoice_snapshot_integrity.sql`, `20260723170500_fix_commercial_agreement_snapshot_defaults.sql`, and later VAT/payment-term migrations. Extend that source of truth rather than duplicating it.
12. Keep all database work preview-only. **Do not apply hosted Production migrations.**
13. Keep PR #499 DRAFT / NOT MERGED until user has validated preview and explicitly authorises merge.

## Important known wider context

- Existing Stripe Membership E2E was validated separately before this legal workstream. Do not break the validated billing backend while adding Legal & Agreements history.
- Membership billing uses XDrive-owned UI direction with Stripe as billing engine; legal history should eventually expose plan/terms acceptance evidence in the premium XDrive Billing & Membership Centre.
- Existing membership confirmation evidence is a record/receipt, not the master contract.
- Main public legal routes must remain available without login.
- The user rejected childish/cartoonish visual styles. Any new Legal & Agreements UI should be restrained, enterprise logistics, premium, and consistent with XDrive branding.

## First instruction to paste into the next chat

`CONTINUĂ XDRIVE LEGAL CONTRACTUAL GATE EXACT DIN CHECKPOINT: docs/checkpoints/XDRIVE_LEGAL_CONTRACTUAL_GATE_CHECKPOINT_2026-09-04_2215.md. NU RELUA AUDITUL DE LA ZERO. Verifică mai întâi HEAD-ul real al main și PR #499, apoi statusul canonical Netlify xdrivelogistics și GitHub Actions. PR #499 rămâne DRAFT / NOT MERGED, fără Production migration și fără modificări vizuale în /super-admin. După validare, continuă cu Legal & Agreements history/read route + material-change re-acceptance.`
