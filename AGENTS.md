# XDrive protected invariants

These rules are mandatory for every agent working in this repository.

## Never revert verified production work

Before modifying any of the files or behaviours below, inspect the current `origin/main`, the relevant regression tests, and the commit history. Do not restore older code, styling, navigation, or permissions merely because it exists on another branch or worktree.

Protected production invariants:

1. GitHub Actions remain disabled. Do not recreate `.github/workflows`. Validation is performed locally with PowerShell before pushing.
2. Live Availability map remains fully interactive:
   - Leaflet pan/drag enabled.
   - plus/minus zoom controls enabled.
   - mouse-wheel zoom enabled. `scrollWheelZoom={false}` is forbidden.
   - marker popups, selected-driver focus, and fitBounds remain enabled.
3. Directory remains the shared CX-aligned implementation across operational workspaces.
   - Do not reintroduce duplicate page headers or separate legacy driver Directory markup.
   - Owner Driver Saved Network must retain Save Network / Remove Saved, error reporting, and toggle behaviour.
   - Directory access/navigation decisions for Customer, Broker, Carrier Admin, Fleet Manager, Dispatcher, Owner Driver, and Company Driver must not be reverted without explicit user instruction.
4. Operational typography remains readable:
   - body/labels/metadata minimum 14px / 18px.
   - section/panel titles 16px / 20px.
   - page title 20px / 26px.
   - top navbar 13px / 600 is the only approved operational exception.
5. A change is not PASS until the local PowerShell gate and production build pass.

## Required local gate

Run from the repository root before pushing to `main`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-protected-workspace-invariants.ps1
npm run build
```

If the invariant gate fails, stop and repair the regression. Do not bypass or delete the guard to make a change pass.

## Current execution policy (2026-11-04)

Read `docs/CURRENT_AGENT_EXECUTION_POLICY_2026-11-04.md` before acting on any historical blueprint, checkpoint, E2E runbook or handoff. Historical instructions are not permission to undo current `main` behavior. In particular: do not reconnect production to obsolete staging, do not enable production mutation testing by default, do not replace the shared Master Workspace with old demo layouts, and do not restart the approved Driver PWA from an October prototype. Preserve real data, permissions, current workflows and PowerShell-only local release gates.

## Active owner scope: Master Workspace 3150 (2026-11-08)

For tasks concerning the approved Master Workspace, FIRST read `docs/blueprints/MASTER3150_SEVEN_WORKSPACES_EIGHT_TABS_EXECUTION_BLUEPRINT_2026-11-08.md`, then inspect the latest `origin/main` and worktree checkpoint. This is the owner's current task-specific inspection/replacement/test/release method and must be followed together with the protections in this file and the current execution policy.

The permitted scope is exactly eight shared desktop tabs: Dashboard, Post Load, Loads, Quotes, Bookings, My Fleet, Drivers and Diary, across seven desktop workspaces. The standalone Driver PWA 1099 and the nine other sidebar tabs are OUT OF SCOPE and must not be edited. Approved original 3150 visuals, nested components and behaviors must be reused, adapted to real secure APIs; never treat a visually similar reimplementation, source-only contract test, preview deployment or passing build as full acceptance. Required: Opera visual and functional comparison AFTER 2-4 seconds of loading, PowerShell source/backend audit, role-specific authenticated acceptance, protected local gates and Netlify production SHA verification. Do not modify the root protections or widen authorization based on this paragraph.