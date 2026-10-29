# XDrive Driver autonomous local controller

## Verified state (29 October 2026)
- Task Scheduler task `XDrive-Driver-Real-Integration-Watchdog` runs every hour; manual scheduled start yielded exit code 0 and next run was 02:35.
- Local mutex `Local\\XDriveDriverRealIntegrationWatchdog20261029` prevents duplicate watchdog instances.
- The watchdog validates the three project directories, Git branch, tracked/untracked status and `AUTONOMOUS_EXECUTION_CHECKPOINT.md` before running.
- A simulated lost process (PID 999999) was detected and logged `RECOVER_INTERRUPTED`.
- It executed a real queued Node.js task, `recovery-probe-001`, which wrote an idempotent state fixture. Task status persisted as `complete`.
- A second invocation during `-HoldLock` wrote `SKIP_DUPLICATE`.
- The queued runner has a two-attempt ceiling, limits scripts to `automation/tests/*.cjs` and `automation/tasks/*.cjs`, and records stdout/stderr and task outcomes.
- A bounded lint of changed real-PWA TSX sources runs on each check; no destructive resets or production API requests.
- Log paths: `automation/logs/watchdog.log`, `automation/logs/queued-tasks.log` and per-task/per-lint logs.
- State: `automation/state/run-state.json`, `queue.json` and `recovery-proof.json`.
- Installer: `automation/install-watchdog.ps1`; safe local smoke check: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File automation/watchdog.ps1 -DryRun`.

## Limits / security
**This is a deterministic local runner and monitor, not a self-continuing ChatGPT agent.** No authenticated code-generating agent executable was available on the Windows machine. It cannot independently reason about new bugs, write arbitrary implementation patches, or recreate the assistant session. Future source edits must be staged as reviewed idempotent code tasks or executed by an authorized agent. Never mark that capability as complete.

Task Scheduler is configured under the current Windows user's available permissions. Hourly execution depends on Windows Task Scheduler conditions and the machine being powered on. No automatic merge, deploy, production DB mutation, invoice creation, or test notification is permitted.

## Resume procedure for an agent
1. Inspect the checkpoint and Git branch/diff in `D:\\XDrive-Driver-Real-Integration-20261029`.
2. Read `automation/state/queue.json`, `run-state.json`, and the end of `watchdog.log`.
3. Verify that source repo `D:\\XDrive-CX-Debug` has unrelated dirty state; do not reset it.
4. Confirm unit tests/typecheck and diagnose new failures.
5. Execute the next listed checkpoint task safely, retest and update checkpoint.
6. Use isolated deploy previews, not live production.
