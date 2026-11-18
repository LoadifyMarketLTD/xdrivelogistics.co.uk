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
