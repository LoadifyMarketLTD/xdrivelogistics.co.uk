# Carrier Dashboard regression closure and preview verification

Scope: PR #647 / `feat/carrier-visual-convergence-20260930`. PR #607 and Super Admin are excluded.

## Diagnosis

The earlier eight failures described a superseded workboard layout. The current committed Dashboard (`2b5d416d`, retained in `777e3328`) uses the CX Reports & Statistics / Accounts Payable / Reports / Feedback / Activity / Compliance composition. The visual reference inspected for this closure is `C:\Users\Danny\OneDrive\Imagini\CX IMAGE\Screenshot (41).png`.

An interim reconciliation already existed in the working copy and independently passed 2445 unit tests at the start of this verification. That alone did not establish correct runtime behaviour. Further inspection found real defects and an overly permissive structural assertion, which were corrected:

- Loading, omitted and partial booking data must not become a healthy empty list. Partial returned bookings remain visible with an explicit incompleteness warning.
- Loading metrics do not momentarily display exact zeroes.
- Accounts Payable uses received, customer-visible invoices for the active buyer company, not the carrier's issued receivables. Draft, voided and cancelled invoices do not enter the payable queue; settled invoices are excluded from awaiting-payment counts.
- The overdue-invoice metric displays a count, not an invoice-face-value sum incorrectly represented as an outstanding balance without payment allocation data.
- A real semantic H1 and labelled regions/buttons replace a test that mistakenly treated the page wrapper itself as a page heading. The H1 is visually hidden to preserve the CX panel layout.

No invoice data, legal evidence, Stripe data, database schema or permissions were mutated for this repair. The existing canonical invoice visibility/status helpers are reused.

## Evidence

Evidence root: `C:\Users\Danny\Desktop\XDrive-Local\carrier-preview-closure-20260930`.

- Initial full unit suite: 2445/2445 passed, recorded in `baseline-unit.json`.
- Strengthened Dashboard regression batch: 51/51 passed, recorded in `dashboard-unit.json`.
- TypeScript after the Dashboard changes: exit 0, `typecheck.log`.
- Browser coverage exercises the real Dashboard with isolated services, including the CX panels at six widths, failed service responses, real allocation navigation and the canonical navbar order.

Full release-source verification and the deployed preview revision are recorded below after execution. A local fixture PASS is not represented as a production-authenticated business transaction.

## Verified source gates before preview publication

- Full unit suite: 2455/2455 passed, zero failed, zero pending (`v2-unit.json`).
- Full TypeScript and ESLint: exit 0 (`v2-gates.json`).
- Semgrep 1.178.0: 89 rules, 36 changed application files scanned, zero findings and zero parsing errors (`v2-security-gate.json`). JSX text normalization preserves rendered labels while removing partial-parser coverage gaps.
- The full optimized build and isolated browser run are retained in `v2-build.log`, `browser-results.json` and their gate files. Hosted preview acceptance is recorded in PR #647 after deployment.
- This is a preview branch, not a main/production merge. GitHub-hosted jobs previously reported an account billing lock; a runner that did not start is not represented as a passed test.

## Hosted preview prerequisite found and addressed

The deployed preview was opened in the user's normal Opera session. The workspace correctly reported missing onboarding, current legal evidence and Stripe setup; none of those requirements was bypassed or accepted by the agent. Opening legal review for an account without an authoritative contractual role exposed a generic `legal_contractual_role_unavailable` screen.

Operational Legal & Agreements pages now turn that specific prerequisite into a direct **Complete / recover account setup** action to the existing server-resolved `/onboarding/resume` flow and a workspace-scoped support link. The backend still decides the legal role; no role is guessed, no agreements are accepted automatically, and Company Driver is not granted company-signing authority. General service failures are not misclassified as missing onboarding. Super Admin is not changed.

`e2e/legal-context-recovery.spec.ts` covers Carrier, Customer, Broker, Owner Driver and Company Driver, plus a service-failure negative case. The final source is captured in `source-manifest-v3.json`. The earlier Dashboard fault-injection test now waits for the data client's 503 retries to settle instead of assuming an unavailable result within five seconds; its no-false-zero/no-healthy-empty assertions remain unchanged.
