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

Further isolated PostgreSQL transaction evidence (2026-11-17): cancellation approval is rejected when the authorised return stop is unfinished; rejected when completed but POD recipient/signature/photo references are absent; succeeds after all required fields are populated; rejects a second approval. The test additionally verifies the job becomes cancelled. These tests use fabricated POD paths, so they prove the database gate but NOT the existence or authenticity of objects in storage.

Security correction: driver-supplied return/redirect dispositions no longer create a follow-up stop or cancel the original stop. All goods-in-custody instructions remain pending until an active authorised carrier dispatcher resolves them through the separate RPC. Isolated transaction test DRIVER_CANNOT_SELF_AUTHORISE_RETURN_OK passes.
Further hardening (2026-11-17): both web and mobile stop completion routes now reject canonicalFinalPod reuse for a return/redirect stop. Return/redirect must submit its own stop-scoped signature and photos, which are verified against the stop evidence storage folder. This closes the loophole where a final return could reuse the original job POD, and avoids SQL cancellation approval being blocked by an absent return signaturePath. This is code-level validation; authenticated hosted-storage E2E is still pending.

2026-11-17 22:55 UTC: strengthened cancellation approval to require return signature and each return photo path to be scoped to the assigned carrier, parent job, and actual return stop. Isolated PostgreSQL: CROSS_JOB_POD_REJECTED_OK, EVIDENCED_RETURN_APPROVAL_OK; 4 migrations PASS; 43/43 Vitest PASS; TypeScript PASS. This does not prove storage object existence or authenticated hosted E2E.

2026-11-17 23:51 UTC: cancellation approval now checks storage.objects in bucket pod-photos for the return stop signature and every return photo, inside the same database transaction as commercial approval. Isolated PGlite tests: missing all objects rejected; missing photo rejected; valid object records approved; 4 migrations PASS; 43/43 Vitest PASS. Storage metadata existence is validated, not image contents or hosted authentication. Hosted schema must expose storage.objects; full hosted E2E remains unverified.

## Additional carrier-identity regression (2026-11-18)

The cancellation decision function previously accepted an assigned active driver as the carrier party without checking that the driver's company matched the request's carrier company. The fallback now requires driver.company_id and job.assigned_company_id to match request.carrier_company_id. Isolated PostgreSQL regression: a driver moved to an unrelated company cannot decide; the correctly assigned carrier driver can reject an owner-initiated request. Four SQL migrations PASS, 43/43 focused Vitest PASS, TypeScript PASS. Full historical schema replay and authenticated storage-backed E2E remain unverified.
2026-11-18 01:49 UTC: added fail-closed guard requiring cancellation request carrier_company_id to match jobs.assigned_company_id for both approval and rejection. Isolated PostgreSQL transaction MISMATCHED_REQUEST_CARRIER_DENIED_OK; all 4 SQL migrations PASS; 43/43 focused Vitest PASS; TypeScript PASS. Hosted full-schema and authenticated evidence E2E remain unverified.
