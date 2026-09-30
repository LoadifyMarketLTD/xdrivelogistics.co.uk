# Actionable account restrictions - isolated release

Date: 2026-09-30
Base: d5714053 (main's existing commercial-readiness hotfix).
Branch: fix/actionable-workspace-recovery-20260930.
Working copy: C:/Users/Danny/Desktop/XDrive-Local/hotfix-actionable-recovery-20260930.

## Scope
- One authenticated, tenant-scoped readiness evaluator and one workspace banner; legacy endpoint delegates rather than duplicating the checks.
- Direct role-scoped Stripe, legal and onboarding/document actions, visible failures, retry and refresh on return; submitted forms are not cleared or automatically submitted.
- Quote restrictions remain visible inside the open quote dialog.
- Direct exact-vehicle MOT/insurance upload and driver assignment recovery. Company drivers can submit evidence for their own assigned vehicle, not assign vehicles or configure company Stripe.
- Uploads use private storage, exact active driver/company/vehicle ownership, validated file content, current dates, random paths, pending verification and cleanup on recording failure.
- Assignment changes remain company-owner/admin-only; conditional writes preserve tenant/driver ownership and the deployed unique active-assignment index. Existing job/quote commitments block unassignment.
- No commercial gate is relaxed. No legal acceptance, Stripe transaction, production document, vehicle assignment or transport record was created during validation.
- No Carrier visual branch, native app, Super Admin or PR #607 changes.

## Verification
- Full unit suite initial run: 394 files / 2458 tests passed. Final rerun recorded externally.
- Targeted security/behavioral suite: 106 tests passed.
- TypeScript: exit 0; targeted ESLint: exit 0, zero warnings.
- Isolated Chromium recovery suite: 18/18 passed, including owner/company-driver exact document upload, pending review, direct assignment, error retry, role-specific actions and form preservation.
- Additional blocked-post/quote and production build checks are release gates; their final results must be checked before merge.
- Live Supabase read-only schema checks confirmed private vehicle-docs/driver-docs buckets, exact document columns and vehicles_one_active_assignment_per_driver_uidx. No migration required.

## Evidence and release policy
Evidence logs: C:/Users/Danny/AppData/Local/Temp/xdrive-recovery-*.log and xdrive-post-quote-final.log.
UI screenshots: test-results/ (not committed).
Browser services are mocked. This is not a claim of authenticated production E2E or a real payment.
GitHub hosted checks on the base were not started because the account is locked due to a billing issue. The repository already defines Netlify as the primary production build gate; do not disable checks or use an administrator merge override.
Never bulk-stage or reset the separate dirty carrier-visual worktree. Merge/deploy only this reviewed hotfix after final tests and the canonical Netlify preview pass.
