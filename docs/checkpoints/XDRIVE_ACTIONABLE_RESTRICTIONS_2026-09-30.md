# XDrive actionable restrictions - 30 September 2026

## Scope and release state
Urgent user request: surface the actual blocking condition and a direct recovery action in the operational workspace and failed post/quote flows. This change is LOCAL ONLY, on the existing dirty worktree based on 777e3328. No commit, push, deployment, native Android change, production database write, legal acceptance or real Stripe action was performed by this task. PR #607 and Super Admin were not modified.

## Implementation
- lib/workspaceReadiness.ts: typed, safe recovery actions and role mapping from authenticated database context.
- app/api/workspace/readiness/route.ts: getUser auth, role_in_company, explicit verified company membership, no first-company fallback, no-cache advisory readiness. Independent failures stay visible instead of hiding restrictions.
- WorkspaceRestrictionBanner.tsx: account-specific blockers, direct role-scoped links, refresh on return and failed commercial action, timeout/error/retry states, stale-request cancellation, no automatic submit.
- StripeSetupAction.tsx: retain secure existing onboarding helper; use appropriate post/quote/workspace copy.
- LoadPostingForm.tsx and CompanyMarketplaceExchange.tsx: preserve existing legal/Stripe handling, refresh readiness after a denial, inline remediation including inside the company quote dialog.
- MarketplaceQuoteModal.tsx and driver loads/search/detail pages: display failures and contextual recovery alongside quoting, not behind the modal.
- Onboarding [token] shared page: targeted document row and focused upload control via document query + fragment, including previously uploaded evidence. Existing verification/approval requirements remain authoritative.
- WorkspaceSupportPage.tsx: sanitized restriction context and prefilled support email link; no message is sent automatically.

## Security and honest UX boundaries
The readiness API is advisory, not an authorization grant. Existing transaction gates remain authoritative. An employed driver is never offered personal Stripe setup or company posting permission. A pending/rejected application is not described as automatically approved by an upload. Cross-company and ambiguous records cannot silently select a different company. Missing application recovery uses the existing initializer. Recovery links open separately; no post or quote is submitted automatically.

## Remaining coverage/release work
Some canonical vehicle-document and assignment/permission blockers use contextual support rather than a dedicated vehicle upload/assignment form. Do not claim universal self-service remediation is finished. The legacy specialized legal button on Post Load retains its existing navigation behavior; only the new separate-tab recovery links/Stripe path have the form-preservation contract. No authenticated production E2E, live Stripe flow, full-repository PASS or production build is certified here. Concurrent work in Directory, Live Availability, Settings, Billing and route permissions remains independently owned; do not bulk-stage/reset it.

## Verified checks
- 85 targeted unit tests passed across workspaceReadinessBehavior (35), workspaceRemediation (20), workspaceRecoveryRouteGuards (6), stripeSetupAction (24).
- Full TypeScript check passed; scoped ESLint passed with --max-warnings=0 after extracting our browser cases to e2e/workspace-action-remediation.spec.ts and explicitly importing shared USER.
- Targeted git diff whitespace check passed.
- Direct per-role onboarding document targeting and desktop/mobile banner screenshots were visually inspected.
- Current isolated browser validation evidence: C:\Users\Danny\AppData\Local\Temp\xdrive-remediation-validation-20260930-dsyBkw. Source hashes there match the 13 implementation/test files checked after snapshot. This copy excludes .env files and runs with placeholder public auth and no service-role/Stripe secret.
- A prior shared-port browser run was interrupted by ERR_CONNECTION_REFUSED when the shared dev server disappeared; it is not recorded as passing.

Final isolated browser result is appended after process completion.

## Final isolated browser result
35/35 Chromium tests passed in 2.2 minutes, process exit 0: 12 actionable-restriction cases and 23 workspace recovery regression cases. Viewports include 1440 and 390 pixels. These use real components with mocked services, not production-authenticated accounts.
Current implementation/test source hashes after completion: all 13 checked files match the tested snapshot.
