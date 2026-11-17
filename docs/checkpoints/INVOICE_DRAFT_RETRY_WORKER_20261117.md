# XDrive Invoice Draft retry worker: isolated hotfix

Date: 17 November 2026. Source `origin/main` at `2f0dcfd8`, isolated branch `fix/invoice-draft-retry-worker-20261117`. No Production deployment, migration, payment, or email dispatch.

## Failure and remediation

A legacy database trigger inserts a pending row in `invoice_delivery_outbox` as soon as an invoice is generated in Draft. The deployed `/api/internal/invoice-deliveries` worker originally selected any due, unfinished row; cron calls it every five minutes. That can initiate email delivery without the owner's explicit Send command.

The route now selects pending rows **only** when both a frozen `payload` and `first_provider_attempt_at` are non-null, in addition to due/unfinished filters. These fields exist in the existing invoice delivery schema and are recorded by the explicit delivery implementation. A newly generated Draft alone cannot qualify for a retry.

## Verification

- Targeted static contract: 3/3 PASS.
- Isolated runtime route mocks: 3/3 PASS. Unauthorized secret returns 401 without queue access; an unattempted Draft yields an empty worker result with no send; a previously attempted explicit delivery remains retryable.
- TypeScript `tsc --noEmit --pretty false` exited 0 on the isolated worktree; patch diff check exit 0.
- Only runtime route and two test files changed versus `origin/main`. No Supabase migration, cron edits, email provider changes, or business data writes.
- Local evidence: `invoice-worker-runtime-recheck-20261117.log` and `invoice-worker-hotfix-tsc-20261117.log`.

## Release gate remains closed

This is a **code fix on a draft hotfix branch**, not a claim of Production protection. Production still runs the old worker until the exact branch SHA is reviewed, merged, deployed, and authenticated worker behavior checked against hosted schema. Do **not** create or send test invoices merely to verify this fix before that release gate.
