# PR #840 — custody resolution PostgreSQL verification (2026-11-17)

Target: `fix/pr835-custody-resolution-20261117`, base PR #835. No production DB writes.

## Reproducible isolated database test

A fresh in-memory PostgreSQL-compatible PGlite database was created on the authorised Windows workstation, with minimal tables matching the referenced schema contracts. Four migrations were executed as PostgreSQL statements: `20261117132500`, `20261117142000`, `20261117174000`, `20261117175000`. All four passed.

Tests executed and passed: awaiting-instructions custody record; unauthorised actor denied; authorised dispatcher creates return stop and cancels source in a single RPC; duplicate custody resolution denied; exactly three stops remain (one new return); dispatcher cannot impersonate assigned driver; original stop's custody resolution flag is closed.

Reproduce in isolated directory: `npm install --no-save --ignore-scripts @electric-sql/pglite`; run `node docs/verification/pr840-custody-postgres-validation.cjs` with Node module resolution configured for the isolated dependency directory. The harness has no production credentials or network access. It uses stubbed base tables and is **not** a clean replay of the complete historical migration chain, nor an authenticated browser E2E.

## Remaining release gates

- Verify hosted schema compatibility read-only; run full migration replay in an isolated database with actual schema, not just stubs.
- Exercise authenticated mobile and web UI, actual evidence uploads and POD, and cancellation approval with completed/unfinished return.
- Do not merge PR #840 or #835 or apply migrations to Production until gates are verified.
Additional verification: terminal delivered bookings reject both driver stop cancellation and dispatcher custody resolution; the mobile and web route guards also reject delivered/disputed/paid statuses.

Cancellation approval now additionally requires a completed return/redirect stop with completion timestamp, recipient, signature path, and at least one photo path. This SQL guard passed isolated migration execution; full authenticated approval/POD storage E2E remains unverified.
