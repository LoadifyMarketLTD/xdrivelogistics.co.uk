# PR #714 — rollback safety evidence (29 October 2026)

Scope: `integrate/xdrive-driver-real-20261029` only. This is a **Draft** PR, not merged.
- Baseline commit: `a6020b2d1b071d907d25a1c5697189e0c0555e46` (merge-base with `origin/main` at preparation).
- Verified PR HEAD at preview launch: `2c907bffc95314c659900c73b8f9aac3416a1c7b`.
- Isolated working tree: `D:\XDrive-Driver-Real-Integration-20261029`.
- Original working trees `D:\XDrive-CX-Debug`, `D:\XDrive-Bookings-Showcase-20261029` and `D:\XDrive-Booking-11-Sandbox` were not changed by this integration.
- Netlify successful **Deploy Preview** for HEAD `2c907bf`: `https://deploy-preview-714--xdrivelogistics.netlify.app`. This does not represent a production deploy or validation of authenticated operations.
- `git diff --stat origin/main..HEAD` covered only Driver PWA screens, approved shared mobile-only booking presentation, new contracts and automation controller. No migration files modified.

## Pre-merge rollback (current authorized state)
1. Do not merge PR #714. Current production is already isolated.
2. Close or retain the Draft PR and stop using its Netlify preview; the production main branch is unaffected. 
3. If asked to abandon the local changes later, preserve current commit SHA and backup patch before removing isolated worktree. No automatic deletion or branch reset is enabled.
4. No schema or customer/driver data rollback is necessary because integration tests made no production database writes.

## If a future merge were separately authorized
Back up target SHA and database migration state first. Revert only the integration commits (not unrelated main changes), deploy to preview, run seven-workspace/Super Admin and booking regression suites, then obtain separate production permission. This scenario has **not** been executed; no post-merge rollback claim is made.

## Tests and gaps
- Preview protected pages redirect to sign-in and anonymous booking-offer GET/POST and driver APIs fail closed: 7/7 new Playwright guard checks passed.
- Existing Playwright role/super-admin suites: 34 passed, **17 skipped**, therefore no claim of authenticated E2E pass.
- Scoped Vitest 47/47 passed; targeted ESLint and TypeScript pass.
- Physical OPPO loads preview login page; authenticated booking UI, quote, map and lifecycle are not device-verified without a controlled preview test session.
- Full authenticated test flow with isolated nonproduction accounts and job fixtures is a **release blocker**. No production job records were mutated.
