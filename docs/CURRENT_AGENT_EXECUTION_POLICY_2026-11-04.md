# CURRENT XDRIVE AGENT EXECUTION POLICY — 2026-11-04

This document supersedes conflicting historical blueprints, checkpoints, runbooks and handoffs. Older material is historical evidence, not authorization to execute obsolete instructions. The actual origin/main implementation and latest explicit owner instructions take precedence.

## Protected current state
- One approved Master Workspace visual/component architecture across roles; permissions and data visibility vary by role. Do not replace it with legacy separate demo layouts.
- Production operational data source: the authorized real XDrive Supabase project. Never silently redirect a live workspace to an old staging project, mock data or a demo backend.
- No fabricated jobs, quotes, companies, drivers, vehicles, invoices, POD, messages or notifications in real operations.
- Preserve the approved Post Load behavior; ensure parity for roles permitted to post. Company Driver must not gain unauthorized trading or administration.
- Preserve the currently approved Driver PWA and its complete booking, multistop, POD and invoice workflow; do not restart from an October prototype or prohibit testing on physical devices.
- Keep Invoice Pro separate from the platform unless explicitly authorized to integrate it.
- Preserve GitHub Actions disabled and run verification locally through PowerShell.

## Safe execution
1. Fetch and inspect current origin/main, worktree changes, existing tests, migrations and deployment state before editing. Never overwrite newer production fixes with an older handoff.
2. Inspect -> reproduce -> fix root cause -> focused tests -> TypeScript/ESLint -> relevant regressions -> production build -> inspect diff -> publish approved changes -> verify published SHA and deployment separately.
3. Never force push, hard reset dirty trees, delete unrelated branches, modify production schema, or remove existing user data as a shortcut.
4. Never perform synthetic CRUD, send test emails, create invoices or payments, or run destructive E2E flows against real production data. Production is read-only for QA unless the owner separately authorizes a precisely scoped transaction with safeguards. Do not enable E2E_ALLOW_PRODUCTION_MUTATION as a routine setup step.
5. Use isolated local tests and mocked fixtures for mutation scenarios; if real authenticated mutation cannot be safely isolated, mark BLOCKED, not PASS. Do not assert end-to-end verification from unit tests alone.
6. Validate UI, API, persistence, tenant isolation/RLS, role authorization, multistop transitions, camera AND gallery upload, notifications and real-data visibility. Do not bypass tests to achieve PASS.
7. Never print, commit or copy secrets from local env files. No service-role credentials for proving ordinary user access.
8. Historical staging references are not instructions to reconnect production to staging. A separately authorized isolated test environment may be used only after its identity and isolation are verified.

## Precedence and supersession
- This policy and AGENTS.md override obsolete directives in docs/DRIVER_PWA_AUTHORITATIVE_INSTRUCTIONS.md, docs/e2e/production-e2e-runbook.md, old blueprints, checkpoints and audit ledgers.
- Historical records may be read for context but MUST NOT be executed as current plans. Where the current implementation or permission is uncertain, inspect and mark the action BLOCKED rather than guessing.
