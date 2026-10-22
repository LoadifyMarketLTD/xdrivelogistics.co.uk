# Approved Owner Driver workspace routing - 2026-10-20

## Incident

An approved owner-driver has an active driver profile, active owner membership and an active owner_driver company, but can land on /forbidden after signing in. The old client and middleware resolved the provider workspace only from signup app_metadata. They ignored the authoritative scoped drivers.driver_type. Without the old workspace flag, the owner membership resolved to company_owner and the client selected /admin; that carrier-fleet surface is not enabled for the owner_driver company. Return Home could re-enter the same route loop.

## Change

- Shared hasDriverProviderWorkspaceEvidence uses the driver row already scoped to the authenticated user and selected company.
- A recorded driver_type wins over stale/missing signup flags. Metadata remains a compatibility fallback only when the scoped record has no classification; editable user metadata is still ignored.
- Client role/home selection and server middleware use the same classification. Middleware now reads driver_type and preserves the existing missing-column fallback.
- Pending/suspended identities, disabled driver access, cross-company driver rows and platform-owner routes keep their existing protections. No customer status, metadata, Stripe account, vehicle, contract, approval or database schema is changed by this patch.

## Verification

- The new ten-case regression initially failed in three cases: client owner-driver classification, server classification, and a company driver carrying stale provider metadata. All ten pass after the patch.
- 100 focused tests across 18 files passed. Standalone TypeScript (incremental false) passed. A wider run found three pre-existing navigation/Directory expectation failures; the same three were reproduced in the unchanged 8b6a497 worktree. They were not edited or included in the passing test count. A concurrency-related middleware import timeout passed in the serial rerun.
- A disposable active routing fixture reproduced /admin -> /forbidden on the old published build. An initial fixture lacked the identity registry prerequisite and was correctly made inactive by the database; the corrected fixture explicitly supplies its own synthetic identity prerequisite without disabling triggers.
- Browser coverage targets real auth, own driver dashboard/reload/vehicle page, denial of super-admin, and Return Home recovery at mobile and desktop widths. No customer credentials or sessions are used. This is a routing test, not a full compliance/transport E2E.
- One old baseline fixture hit the active-driver deletion guard during cleanup. Cleanup order in the test now deactivates the synthetic driver before deletion and removes any trigger-created onboarding record after profile unlinking. Remaining old fixture cleanup must be verified separately.
- Local webpack compilation and type validation completed, but the Windows full-build worker exited natively (3221226505) during static generation. A concurrently running Playwright worker also ran out of memory; neither failed attempt is reported as a passing run. Repeat browser validation serially and require the Netlify production build/release gate before declaring the patch live.
- Publication and production browser results must be confirmed separately.
