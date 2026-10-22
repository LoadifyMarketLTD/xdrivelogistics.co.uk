# Pending onboarding login and document self-service - 2026-10-20

## Confirmed incident

A submitted Owner Driver applicant can authenticate with Supabase, but the previous XDrive login handler treated an `account_pending` profile as a failed login unless onboarding was still a draft. An `under_review` applicant therefore could not reach document correction or the pending-approval page through sign-in.

The previous submit routine also created empty document placeholders after actual uploads. The database-only prevention migration was applied at version 20261020181513. Existing empty duplicate placeholders on the reported application were removed earlier; uploaded files were retained.

## Changes in this release

- Route authenticated pending applicants with submitted/review status to `/pending-approval`. Do not create an operational user or activate any profile/company/membership.
- Expose `/onboarding/documents` as authenticated self-service, with server-side `auth.getUser` verification and applicant-scoped document lookup.
- Offer explicit View, Replace, selected-file confirmation and upload state on mobile and desktop. Resume from the login deep link.
- Serialize document replacement in the database. Archive prior records in private revision history; preserve original storage files and fingerprints. New evidence is unverified and a submitted application stays under review.
- Maintain duplicate-file/fraud controls, file size/type restrictions and cross-applicant isolation. Only the service role can call the storage transaction after HTTP authentication.
- Show a real secure-preview link after the administrator requests it, rather than programmatically opening a new window after an asynchronous fetch. No-file placeholders cannot be approved or viewed.
- Add self-service links to pending approval, onboarding and the applicable driver/company document workspaces.

## Validation completed locally

- 71 targeted unit/contract tests passed across 10 files, including auth stability, identity isolation, review governance and document replacement.
- 10 Playwright UI/unauthenticated endpoint checks passed: four document-bearing account types at 390/1440px plus pending-page navigation and unauthenticated denial. Document requests in the eight UI cases are intercepted; these are not production uploads.
- 2 real authentication integration tests passed on a disposable pending Auth/application identity at 390/1440px: sign-in -> pending approval -> own document management -> refresh; operational `/driver/loads` remains inaccessible. The synthetic account and application were removed after the run.
- Earlier production SQL transaction tests covered replacement and no access elevation for four account types using synthetic records rolled back at the end.
- The migration files use the exact versions already recorded in production: 20261020181513 and 20261020184144. Do not replay them under a different version.

## Release verification required

Production publication and a repeat of the real pending-login integration test must be confirmed separately. A local PASS or an uploaded commit is not evidence of a completed Netlify publication.

## Separate remaining commercial setup problem

The approval mutation requires Stripe readiness, while the existing Stripe setup page/API requires an active owner/admin membership. A pending owner with an invited membership cannot satisfy both. This release does not waive Stripe, change its commercial policy, or activate the applicant. A scoped pre-approval Stripe setup flow remains a separate fix. Do not manually approve or activate the applicant to bypass it.

The user reported an incorrect right-to-work document. Do not treat the existing Verified flag as proof that the uploaded document is correct. The applicant must choose the correct replacement; this release never approves replacement evidence automatically.
