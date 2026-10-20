# Owner-driver stale landing and access recovery - 2026-10-20

## Incident scope

An approved owner-driver still reported /forbidden after the canonical driver classification fix. Read-only production checks reconfirmed an unbanned Auth identity, active profile/company/owner membership, approved onboarding and active owner_driver with app_access enabled. A transaction-scoped authenticated-role SELECT also confirmed that row-level security exposes only the required own profile/membership/driver evidence. No customer session was impersonated and no customer data was changed.

The original routing fixture differed in signup metadata. A separate real Auth fixture with no app_metadata role, stale fleet/company-admin user metadata and owner_driver_workspace=false passed direct /driver access on the already-published build. That result does not establish what happened inside the customer's browser.

## Additional reproduced defect

The existing /admin landing redirect was unreachable for an owner-operator company: target-workspace selection rejected /admin as workspace_not_enabled before driver classification and the redirect ran. A new regression on unchanged code returned /forbidden instead of /driver. The old 403 Return Home link also went through the SPA's ordinary home redirection rather than explicitly rebuilding its authenticated context.

## Repair

- Only the exact /admin landing, after workspace_not_enabled, can resolve the existing single owner-operator company through /driver. Active profile, matched company, owner/admin membership, canonical owner_driver type, active driver and app_access=true are all still required.
- Nested /admin routes, platform-owner routes, other companies, suspended/pending profiles, disabled/absent drivers and conflicting company-driver classification remain denied. No capabilities or workspaces are enabled by recovery.
- /auth/recover-access verifies the existing browser session with Auth, forces the normal profile/company context refresh, checks the resulting home permission and performs a full navigation. It does not change account status, role, documents, Stripe or approval. Missing/invalid sessions get an explicit sign-in path, not a loop.
- The 403 Return Home link uses a normal full-document navigation to this dedicated recovery page rather than cached SPA home selection.

## Verification

- New /admin regression failed before the fix and passed afterwards.
- 123 focused unit/contract tests passed in eight files. The separate five-file middleware suite passed all 21 tests. Standalone TypeScript with incremental=false passed.
- Exact-metadata browser recovery, production publication and production regression must be confirmed before claiming the new recovery path is live.
- The customer's actual new browser outcome is not established by synthetic tests. Do not claim access was confirmed in that person's session unless it is observed.

## Local browser environment note

The first new local-browser run changed host from 127.0.0.1 to localhost on the Next development redirect, so the host-only cookie was not available at the redirected host; it is not a passing result. The development process later crashed natively under memory pressure. Three obsolete development-server trees from earlier completed tests (ports 3118, 3119 and 3121) were stopped only after verifying their exact task paths and command lines. The recovery run uses localhost consistently. No production process was stopped, and no gate was disabled to accommodate the test.

## Completed local verification

All three browser checks passed on localhost with real synthetic authentication and no intercepted responses: mobile and desktop owner-driver access, old /admin landing recovery, vehicle view, platform-owner denial, full Return Home revalidation and unauthenticated recovery denial. The fixture carries empty server role metadata and stale editable fleet/company-admin metadata. The anonymous assertion was scoped to the main content to exclude Next.js's route-announcer alert; the entire suite was rerun.
