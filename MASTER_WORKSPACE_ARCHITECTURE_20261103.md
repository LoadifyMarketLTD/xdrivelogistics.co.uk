# XDrive Master Workspace architecture — 2026-11-03

## User-approved immutable architecture
Company/Carrier 3150 is the visual source of truth. One sidebar, one set of shared tab components, one common navigation, one workflow presentation. Customer, Broker, Fleet, Owner Driver, Dispatcher, Driver, Company Driver and Employee Driver are roles/configurations of the same Master Workspace, not independent visual applications. Role/tenant authorization governs capabilities, not layout.

## Implemented in isolated branch
- `app/try-xdrive-demo/components/MasterWorkspace.tsx`: single public role UI entrypoint.
- `app/try-xdrive-demo/components/MasterWorkspacePolicy.ts`: 17 canonical sidebar tabs, explicit role capabilities.
- `app/try-xdrive-demo/components/OperationsDemo.tsx`: the recovered approved Company UI engine, now draws one canonical 17-tab nav for every role.
- Every route `/try-xdrive-demo`, `/try-xdrive-broker-demo`, `/try-xdrive-company-demo`, `/try-xdrive-fleet-demo`, `/try-xdrive-owner-driver-demo`, `/try-xdrive-dispatcher-demo`, `/try-xdrive-driver-demo`, `/try-xdrive-company-driver-demo`, `/try-xdrive-employee-driver-demo` is a simple adapter to the same MasterWorkspace with a role prop; no separate visual implementation.
- Authenticated `/admin` and `/broker` now use MasterWorkspace beneath the existing ProtectedRoute and Company3150LiveProvider. `/customer` and `/driver` authenticated production routes remain native (not yet migrated) to avoid silently removing complex live workflows without authorization/regression tests.
- Master My Fleet has readOnly for unauthorized roles; invoice creation/status controls disabled for non-invoicing roles; Post Load disabled for nonposting roles; quote awards are gated by role; non-admin Network Tools hides API/Keys and administrative settings. These UI gates are not a replacement for API authorization or Supabase RLS.
- Unprivileged public demo roles do not generate Company example fleet/driver lists automatically.
- Previous visual role implementations remain only as historical files in git or unreferenced source; canonical public role route pages now depend directly on one MasterWorkspace.

## Continuous regression guard
- `scripts/verify-master-workspace.mjs`: fails when a role route stops using MasterWorkspace or diverges its canonical 17 tabs, or privileged capabilities appear in driver/customer configs.
- Per protected `AGENTS.md`, GitHub Actions stay disabled. The guard is executed locally with Node + PowerShell and is NOT configured in `.github/workflows`.

## Test evidence / outstanding work
- Full project TypeScript --noEmit and ESLint on touched files: PASS.
- Master route/policy guard: PASS (9 preview routes, 2 authenticated routes, 17 tabs).
- Netlify hosted visual, interaction and mobile E2E for THIS BRANCH: not yet run.
- Production authenticated Customer and Driver dashboards, native Driver PWA and all backend write workflows still require migration/testing before claims of complete real-workspace parity.
- No change to production/main, no Supabase migration, no destructive data changes. This branch is Draft until end-to-end checks.
