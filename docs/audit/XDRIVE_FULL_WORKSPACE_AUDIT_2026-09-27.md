# XDrive Logistics — Full Workspace Audit

**Status:** IN PROGRESS — not a final closeout
**Audit date:** 2026-09-27
**Canonical code baseline:** main @ `a33cf84c` (PR #612 merged)
**Audit branch:** `audit/full-workspaces-20260927`

## Scope

This audit covers the complete workspace architecture, not only reported defects:

- Platform Owner / Super Admin
- Company Owner / Carrier Admin
- Fleet Manager / Dispatcher
- Finance / Compliance / Viewer
- Broker
- Customer / Shipper
- Owner Driver
- Fleet-employed Driver
- shared authentication, membership, onboarding and workspace resolution
- navigation and protected-route boundaries
- Marketplace / Post Load / Quotes / Award / acceptance
- allocation, Driver execution, tracking, collection evidence and POD
- diary, messages, notifications and Event Log
- invoices, finance and disputes
- documents and compliance
- Supabase RLS / RPC / production-schema convergence
- cross-workspace lifecycle continuity

## Verification rules

A surface is not considered PASS merely because a page or route exists. Defects follow:

**reproduce → identify cause → repair → local tests → build → authenticated E2E where available**.

Missing live credentials or browser control is recorded as **BLOCKED**, never PASS.

## Current verified baseline

- Navigation inventory: **158 discovered navigation hrefs; 0 missing page routes**.
- Full unit/contract suite after reconciliation: **334/334 test files PASS; 2078/2078 tests PASS**.
- TypeScript: **PASS**.
- Targeted ESLint for modified workspace/runtime code: **PASS**.
- Production Next.js build: **PASS**; 172/172 static pages generated during build.
- Known non-fatal build warnings remain: Next.js ESLint plugin not detected; local build has no `SUPABASE_SERVICE_ROLE_KEY`, therefore admin operations are disabled during static build evaluation.

## Confirmed defects repaired in audit branch

### 1. Customer/Broker prototype navigation hid canonical functions

**Cause:** `TopWorkspaceShell` returned dedicated prototype navigation directly for Customer and Broker, so newer canonical modules could exist but remain absent from the rendered workspace navigation.

**Repair:** prototype navigation is now reconciled with canonical navigation; missing canonical destinations are retained under a role-specific **More** group.

This preserves the approved Customer/Broker prototype layout while retaining current functional modules such as tracking/diary/messages/event log and Broker enquiry/operational surfaces.

### 2. Driver Availability and Who's Nearby were conflated

**Cause:** `/driver/nearby` was labelled as Live Availability even though it is the exchange-visible nearby-resource discovery surface.

**Repair:** Driver navigation now explicitly separates:

- **Availability** → `/driver/availability` (personal operational availability)
- **Who's Nearby** → `/driver/nearby` (commercial/exchange discovery)

`My Jobs` is also first-class in Driver navigation. Who's Nearby remains commercial-access controlled; personal Availability remains available to the employed Driver workspace.

### 3. Driver dashboard/runtime encoding corruption

Removed confirmed mojibake from the Driver dashboard, including malformed middle-dot, ellipsis, em-dash and arrow sequences. Runtime encoding sanity contract is green.

### 4. Driver invoice-preview authorization drift

**Cause:** the Driver invoice PDF preview route had its own owner/admin membership check instead of using the canonical Driver Finance authorization boundary used by the other Driver Finance endpoints.

**Risk:** duplicated authorization logic could drift from active Driver/app-access requirements.

**Repair:** preview now delegates to `requireDriverFinanceAccess(request)` and scopes the invoice to the authorized company.

### 5. Stale contract tests contradicted current canonical behavior

Several failing tests described retired prototypes or old business rules rather than current code. These were reconciled only after checking the current implementation and canonical contracts. Examples include:

- retired `xd2-*` Driver dashboard layout vs current compact operations register;
- old single “Live Availability” Driver navigation;
- Customer/Broker route matrices predating Messages/Event Log;
- Post Load Stripe-readiness requirement, which contradicts the direct-party Post Load contract;
- outdated notification preference placeholders after `user_notification_preferences` became real;
- outdated Super Admin map palette assertions.

### 6. Customer/Broker Team invitation contract was not functional

**Cause:** both Customer Team and Broker Team used `POST /api/customer/team`, but the route attempted an upsert with `onConflict: 'company_id,invited_email'` even though Production has no unique constraint/index on that pair. The route also only persisted an `invited` membership row; it did not send an Auth invitation or bind the invitation to a real Auth user.

A second Production drift existed in the same flow: Team UI/API used membership status `suspended`, while the live canonical `company_memberships_status_check` allows `active | invited | disabled`.

**Repair in audit branch:**

- Customer and Broker now identify the requested workspace explicitly to the shared Team API.
- The server verifies that the caller's authoritative profile workspace matches that request (Platform Owner remains the explicit cross-workspace exception).
- New accounts receive a Supabase Auth email invitation.
- Existing compatible accounts receive a non-creating email magic link.
- Existing active membership in another company and conflicting profile/company identity fail closed.
- Membership persistence uses the real `(company_id,user_id)` unique contract.
- Optional Department assignment is verified against the same company before write.
- Customer/Broker membership disable/reactivate now uses the live canonical `disabled ↔ active` vocabulary.
- A dedicated Team invitation contract test is PASS.

This repair is code-only at this stage and has **not** been exercised as a mutating Production E2E invitation.

## P0 production database finding — NOT YET APPLIED

Production `public.jobs` RLS does not currently converge with the repository's canonical privacy contract.

Observed in Production:

1. `jobs_select_all_authenticated_drivers` exists and gives a broad raw jobs SELECT path to an authenticated user with a Driver identity.
2. `jobs_preaward_marketplace_privacy_guard` is **PERMISSIVE** in Production although the canonical migration defines it as **RESTRICTIVE**.
3. `jobs_awarded_carrier_select` is absent in Production although the canonical award workflow defines the winning-carrier full-row access path.

A forward-only repair is prepared locally:

`supabase/migrations/20260927005322_reconcile_jobs_workspace_rls.sql`

It removes the broad Driver policy, restores the restrictive pre-award privacy boundary and restores the winning-carrier read path. A dedicated convergence contract test is PASS.

**Production mutation status:** NOT APPLIED. This remains a P0 closeout item until migration review, application and post-migration verification are complete.

## Additional RPC hardening prepared — NOT YET APPLIED

Production advisor review identified two internal compliance helpers directly executable by `authenticated` even though the current application does not call them directly: `driver_has_valid_cpc(uuid)` and `get_expiring_vehicle_documents(integer)`. The notification classifier `fn_notification_event_class(text)` also had a mutable `search_path` warning.

A forward-only hardening migration is prepared locally:

`supabase/migrations/20260927010354_harden_workspace_rpc_exposure.sql`

It pins the notification classifier search path, removes direct authenticated execution from the two internal compliance helpers, and hardens the legacy `driver_go_online()` SECURITY DEFINER RPC so only an active profile with an active Driver row and `app_access=true` can mark itself available. `driver_has_valid_cpc(uuid)` remains available to server-side/internal callers; the unused `get_expiring_vehicle_documents(integer)` helper is no longer directly executable by authenticated users. Dedicated contract tests are PASS.

**Production mutation status:** NOT APPLIED.

## Authenticated live Customer evidence

Opera reconnected during the audit and the authenticated Customer account successfully loaded both `https://www.xdrivelogistics.co.uk/customer` and `https://www.xdrivelogistics.co.uk/customer/invoices`. The direct Customer dashboard rendered the real Customer Workspace navigation, Post Load, Action Centre, My Loads, Tracking, Quotes, Bookings, POD & bookings, Invoices, Messages and Event Log surfaces. This is direct evidence that the earlier blanket Customer 403 is no longer affecting the protected Customer workspace after PR #612. Deeper non-mutating subroute traversal is still pending because the Browser Connector disconnected again during the next navigation sequence.

## Production schema / Contract Protection gap

The live database currently exposes `accept_job_bid_atomic` but the newer separate Award → Carrier Acceptance RPCs from the Contract Protection branch are not present in Production. This confirms that the Contract Protection migration stack has not yet been merged/applied as part of this workspace audit.

Therefore the workspace audit must not describe the new Award → Carrier Acceptance lifecycle as live until that feature branch is integrated and production-verified.

## Data integrity checks completed

No checked orphan relationships were found for:

- job bids without jobs;
- invoices referencing missing jobs;
- disputes referencing missing jobs;
- assignments referencing missing Driver/Vehicle records.

Identity consistency checks also returned no active-driver/profile company mismatch and no approved-onboarding/profile company mismatch in the checks performed.

Six profile/company relationships lacked an active membership but currently correspond to invited membership states; these remain lifecycle-review items rather than automatically classified defects.

## P0 membership-helper authorization finding — NOT YET APPLIED

Production `is_company_member`, `is_company_admin`, `is_company_operator` and `is_company_non_driver` currently accept any membership whose status is not `suspended`. That includes `invited` memberships. These helpers are referenced by a large number of RLS policies covering companies, memberships, drivers, vehicles, jobs, documents, invoices, payments, messages, reviews and related operational tables.

The live data check found six non-active memberships, including five `owner / invited` memberships. Under the current helper semantics, an invited owner can satisfy owner/admin/member-style RLS predicates before membership activation.

A forward-only repair is prepared locally:

`supabase/migrations/20260927011514_harden_active_membership_helpers.sql`

It restores the original active-membership contract (`status = 'active'`), also requires the company itself to be active, pins helper search paths, and removes anonymous/PUBLIC execution while preserving authenticated/service-role RLS evaluation. Dedicated contract tests are PASS.

**Production mutation status:** NOT APPLIED. This is a P0 authorization closeout item.

## Supabase advisor findings requiring classification

The Production advisor is not clean. Current findings include:

- multiple RLS-enabled tables with no policy (many are intentionally service-only/internal and must be classified before changes);
- one mutable function search_path warning for `fn_notification_event_class`;
- multiple authenticated-executable SECURITY DEFINER functions requiring per-function intent/authorization review;
- performance advisories including foreign keys without covering indexes.

These advisories are **not** being bulk-fixed blindly. Each workspace-relevant item must be classified as intentional service-only behavior, performance debt, or a real authorization defect.

## Current closeout gates still open

- classify workspace-relevant Supabase advisor findings;
- complete API authorization consistency review;
- verify cross-workspace lifecycle continuity against the live schema;
- integrate/validate the Contract Protection Award → Carrier Acceptance stack separately;
- apply and verify the jobs RLS convergence migration only after controlled review;
- authenticated browser E2E for Customer, Broker, Carrier/Fleet, Owner Driver/Driver and Platform Owner;
- verify live deployment behavior after all accepted fixes reach main/production.

**FULL WORKSPACE AUDIT IS NOT CLOSED YET.**
