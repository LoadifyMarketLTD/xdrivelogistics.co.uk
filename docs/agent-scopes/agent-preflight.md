# Agent Preflight Contract

Every agent or automated task that modifies files in this repository **must** declare the following before making any change. This declaration must appear in the PR description or the first commit message body.

---

## Preflight declaration template

```
AGENT PREFLIGHT
───────────────────────────────────────────────────────────────────
Target product:      <WEB | EXPO_DRIVER | ANDROID_NATIVE_DRIVER | SUPABASE | CROSS>
Scope document:      docs/agent-scopes/<web|expo-driver|android-driver|supabase>.md
Base branch:         main
HEAD SHA:            <sha>
───────────────────────────────────────────────────────────────────
Intended file list
  - <path/to/file1>  (<reason>)
  - <path/to/file2>  (<reason>)
───────────────────────────────────────────────────────────────────
Allowlist (paths this task is permitted to touch):
  - <path pattern>
Denylist (paths this task must NOT touch):
  - <path pattern>
───────────────────────────────────────────────────────────────────
Shared-contract impact:
  Root package.json:        <yes — reason | no>
  Root lockfile:            <yes — reason | no>
  middleware.ts:            <yes — reason | no>
  Supabase migrations:      <yes — reason | no>
  Shared lib/ helpers:      <yes — reason | no>
  GitHub Actions workflows: <yes — reason | no>
───────────────────────────────────────────────────────────────────
Required checks:
  - [ ] lint
  - [ ] typecheck
  - [ ] unit tests
  - [ ] build
  - [ ] <product-specific checks>
───────────────────────────────────────────────────────────────────
Production safety:
  Supabase migration applied to production:  NO
  Production data operation:                 NO
```

---

## Rules

1. **One active PR per product per phase.** Before opening a new PR, confirm no in-progress PR exists for the same product and phase.
2. **Declare before modifying.** An agent must not create or edit files before completing this preflight.
3. **Stop on scope violation.** If a task cannot be completed without touching a denylisted path, stop and request Platform Owner approval instead of proceeding.
4. **No opportunistic fixes.** An agent must not modify root-level shared files (lockfiles, shared CI, shared Auth) simply to make one product's CI green without a separate declared scope.
5. **Separate commits for cross-product changes.** If a task unavoidably touches two product scopes, each product's changes must be in a separate, clearly-named commit with a documented dependency chain.
6. **No generic "audit everything" tasks.** A task that cannot declare a specific product scope and an exact file list must not proceed to implementation.
7. **Reuse the existing branch.** Unless a separate PR is explicitly required, corrections and follow-ups must be committed to the existing branch rather than opening a new one.

---

## Scope document references

| Product | Scope document |
|---|---|
| WEB | `docs/agent-scopes/web.md` |
| EXPO_DRIVER | `docs/agent-scopes/expo-driver.md` |
| ANDROID_NATIVE_DRIVER | `docs/agent-scopes/android-driver.md` |
| SUPABASE | `docs/agent-scopes/supabase.md` |
