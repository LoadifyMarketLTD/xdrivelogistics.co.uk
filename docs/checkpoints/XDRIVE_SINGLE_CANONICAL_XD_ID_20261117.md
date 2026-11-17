# XDrive — ONE canonical commercial XD ID
## Controlled implementation checkpoint — 17 November 2026

### Invariant
- ONE official commercial XDrive ID for each independently contracting Owner Driver, sole trader, carrier company, fleet operator, broker, and customer.
- Company Drivers / Employed Drivers log in individually for audit, but transport work is under their employing carrier company's commercial XD ID.
- Owner Driver personal workspace and member profile MUST share the same one commercial XD ID. No second ID is issued for another role.
- Posted job reference (XDL-...) is an independent job identifier, not another commercial member ID. Customer's private reference stays distinct.

### Findings from live READ-ONLY Supabase audit
- Verified Owner Driver company XD-001834 / personal XD-001563: 28 jobs, 20 invoices. Preserve XD-001834 as canonical, store XD-001563 only as a restricted historical alias.
- Verified Owner Driver company XD-001878 / personal XD-001872: no commercial transactions; preserve original XD-001872, archive old XD-001878 as alias.
- Verified Owner Driver company XD-001907 / personal XD-001906: no commercial transactions; preserve original XD-001906, archive old XD-001907 as alias.
- Unapproved/invited Owner Driver company XD-001903 is NOT automatically activated/reconciled.
- Historical orphan owner-driver shell XD-001839: no jobs, invoices, members or assigned drivers, no active verified identity registry. Hidden from member-facing Directory; retain for a separate full FK and historical reference audit, DO NOT delete or reassign blindly.
- No invoice, POD or job snapshot is rewritten by the new migration.

### Code prepared
1. Migration 20261117083531_unify_owner_driver_public_identity: new Owner Driver personal companies inherit creator's immutable XD ID; same creator cannot create duplicate personal company; company-type reclassification fail closed; historical alias table protected by RLS and grants.
2. Migration 20261117083939_reconcile_verified_owner_driver_legacy_ids: guarded transactional reconciliation restricted to independently verified Owner Drivers, with collision/alias checks, temporary immutable-trigger suspension and restoration, registry activation gate.
3. Collection API: server-derived job ID and assigned carrier public ID; Owner Driver must have matching profile/company XD ID, while Company Driver acts under the employing company XD ID. The driver cannot edit either ID.
4. Driver PWA: exactly TWO immutable identity fields — XDrive Job Reference and Transport Operator XDrive ID.
5. Directory, driver public member profiles, web/mobile assigned-job lists and job sheet: prefer the commercial company's XD ID and never substitute a staff user's profile ID for a company job.
6. Previous proposed PR #830 was closed unmerged because choosing between two different active IDs was wrong. Existing PR #829 auto-fill is retained. POD PR #827 remains independent.

### Verification
- Vitest: 81/81 PASS (including PR #831 historical job search) in 12 suites.
- Driver PWA Node: 168/168 PASS.
- Root TypeScript and PWA TypeScript: no errors.
- Read-only Git merge test with latest main and POD PR #827: no code conflicts.
- NO production database modifications, invoice or POD changes, emails, payments, deployments, or GitHub Actions.

### Mandatory gates to release
- Apply both migrations FIRST to a clean isolated staging database with representative test fixtures; verify Postgres SQL, trigger order, RLS, concurrency, new signups, all three reconciliations and legacy alias lookup.
- Current main and two existing Supabase preview branches report MIGRATIONS_FAILED; they are not valid staging proof.
- Verify every alias and historic invoice snapshot and complete a FK audit for orphan XD-001839.
- Only AFTER hosted DB proof, publish API, compile versioned Driver PWA assets with approved live-writes gate, run actual authenticated OPPO test of both Owner Driver and Company Driver flows, and verify Netlify Production.
- Never merge code that rejects Owner Driver mismatches before database reconciliation; legitimate current Production entries would be blocked.
