# XDrive web legal and Stripe recovery - 30 September 2026

## Scope

Web-only hotfix based on `main` at `b1250728`. No native app, driver marketplace endpoint, payment activation, legal acceptance on behalf of users, or production database mutation is included.

## Confirmed production failures

Netlify production function logs at 21:08 and 21:09 UTC report `ENOENT` for the Inter multilingual font used to generate signed legal PDFs. The previous Next.js signing-route traces contained no WOFF fonts.

At 21:09:14 UTC Stripe rejected live connected-account creation because the XDrive platform profile questionnaire was incomplete. This is a Stripe platform-owner setup requirement, not missing customer account details. Do not bypass it or mark company Stripe readiness as complete.

## Implementation

- Explicitly trace the two existing Inter font files for the legal acceptance and onboarding-init routes. The release gate now rejects builds whose signing traces omit those runtime resources.
- Display the existing signed-PDF metadata in authenticated legal history, enabling the existing download route.
- Read the canonical agreement text inline using native disclosure controls. Reading never accepts a document.
- Require individual document selections and a final package review before the existing explicit signing action.
- Recover unsigned draft selections and signer name from per-tab storage, scoped to user, company and requirement fingerprint, with a 12-hour expiry. Drafts are not acceptance evidence. No refresh, restore or render submits acceptance.
- Integrate the legal step into web customer, broker, fleet and owner-driver onboarding. Verify the application ID and contractual role before allowing the step to report ready. Server-side submission gates remain authoritative.
- Return an actionable Stripe platform-profile error instead of an unhandled non-JSON failure. Keep the existing owner/admin membership authorization. Preserve the current form and provide support/recovery links.

## Validation and continuity

Run `npm run test:unit`, `npm run lint`, `npm run build`, and `node scripts/validate-legal-runtime-assets.mjs`.

Local run evidence is under `C:\Users\Danny\Desktop\XDrive-Local\live-legal-stripe-evidence-20260930`. Browser scenarios use a disposable source copy and mocked services; no real agreement is signed and no Stripe account is created during those tests. Final test/deploy results belong in the hotfix PR record.

Stripe Connect platform activation remains an external owner action in the Stripe Dashboard. Do not treat a successful deploy as proof that Stripe has approved or enabled the platform.
