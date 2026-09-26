# Post Load: direct Stripe setup recovery

Date: 2026-09-26
Repository: LoadifyMarketLTD/xdrivelogistics.co.uk
Branch: fix/post-load-stripe-setup-action-20260926
PR: #596
Implementation commit: 31757e00ae75a189bff369430dcac5b9121ee589
Base: main at 1c69c36f7ff0ffcec355b594b71d80c021a04811

## Change
The shared Post Load form now offers `Set up / activate Stripe` beneath the posting-company Stripe readiness rejection. A user click calls the existing authenticated company onboarding endpoint and opens the returned Stripe-hosted onboarding link in a new tab. The original form remains open and is neither reset nor submitted by this action.
The server response identifies the posting company. A Direct Booking carrier's readiness failure does not offer setup for the wrong company. Existing owner/admin authorization and server-side publishing gates remain unchanged.

## Verified locally through PowerShell
- Targeted and regression suite: 72/72 tests PASS across 8 files, including 25 new action/recovery tests.
- Full TypeScript check: PASS (exit 0).
- ESLint for all changed code/test files: PASS (exit 0).
- Git diff whitespace validation: PASS.
- Tests cover direct endpoint/company binding, fresh session token, popup blocking, safe Stripe destination, network/timeout/errors, closed popup, initial rendering, and no automatic publication.

## Remaining acceptance evidence
At this checkpoint, the local production build is running. Netlify preview and authenticated browser-to-Stripe handoff are not yet accepted. Unit tests use controlled responses and are not a claim of real Stripe E2E success. No real Stripe account, payment, or job was created by the tests. Production/main is unchanged.

## Deployment constraint
Use `[skip actions]` in subsequent commit messages to suppress GitHub push/pull-request workflows without suppressing Netlify. Do not use `[skip ci]` in the PR title: Netlify also interprets it as a request to skip the preview. No GitHub Actions run was started for the implementation commit.
