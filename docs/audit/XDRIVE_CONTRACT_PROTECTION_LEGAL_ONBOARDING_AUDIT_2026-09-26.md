# XDrive Contract Protection — Legal & Onboarding Audit

Date: 26 September 2026
Branch: `feat/contract-payment-protection-20260926`
Scope: Contract Protection Layer points 1–14, checked across runtime implementation, controlled legal documents, registration/onboarding acceptance, signed evidence and executable tests.

## Audit rule

A control is marked PASS only when the implementation and the user-facing/legal layer required for that control agree. Internal engineering controls that are not contractual promises are marked N/A for Terms/Onboarding rather than being forced into legal copy. Browser-authenticated E2E remains BLOCKED where protected credentials are absent.

## 14-point matrix

| # | Control | Runtime | Terms / signed package | Onboarding | Result |
|---|---|---|---|---|---|
| 1 | Commercial Agreement Snapshot | Immutable buyer/supplier/job/commercial snapshot + SHA-256 | Agreement/evidence history is non-overwriting; hashes exposed in signed package | Exact controlled docs are hashed at acceptance | PASS |
| 2 | Award separated from Carrier Acceptance | Award creates pending booking offer; carrier must explicitly accept | Explicit in controlled transport terms in EN/RO/FR/ES/PL | Explicit transport-control notice before acceptance | PASS |
| 3 | Buyer Payment Obligation acknowledgement | Mandatory per Award, actor/time/version recorded | r2 states separate per-Award acknowledgement and payer responsibility | Explicit in transport-control notice; operational acknowledgement still occurs at Award | PASS |
| 4 | Role-specific legal documents | Customer, Broker, Owner Driver, Carrier/Fleet role mapping | Canonical signed documents now contain material role-specific obligations | Correct document set selected by registration role | PASS |
| 5 | Controlled legal languages | EN/RO/FR/ES/PL controlled documents | Body and new material section headings translated in all five languages | Authority, role, privacy, acceptance lead and buyer-control notice localized | PASS |
| 6 | Acceptance snapshot integrity | Language, translation version, document hash and privacy hash persisted | Exact document identity bound to acceptance | Reacceptance now checks language, translation version, document hash and privacy hash | PASS |
| 7 | Electronic signing | Typed legal name + confirmation evidence + signature payload hash | Exact agreement package represented in signed evidence | Signer name and explicit confirmations required | PASS |
| 8 | My Agreements signed PDF | Private signed PDF package + integrity hashes | Current controlled documents included | Accepted package is available through My Agreements | PASS |
| 9 | Commercial amendments | Immutable versioned amendment chain; proposed/accepted/rejected states | r2 states original agreement is not overwritten and required counterparty acceptance controls effectiveness | Covered by accepted Marketplace/role terms | PASS |
| 10 | Execution extras | Extras remain traceable; approved extras become contractual adjustment/amendment | r2 expressly covers waiting, handball, redelivery, additional stops and other extras | Covered by accepted terms; operational approval occurs in booking flow | PASS |
| 11 | Multiple collection evidence | Verified handover + 1–10 collection photos before Loaded where required | r2 expressly describes verified handover and 1–10 collection photos | Carrier/Owner Driver terms disclose evidence duty | PASS |
| 12 | Unified Booking Detail | Agreement/Route/Progress/Evidence/POD/Invoice/Payment/Dispute/Event Log unified | No need to contractually enumerate UI tabs; underlying records/obligations are covered | N/A as a separate legal acceptance | PASS |
| 13 | Transport Buyer exposure controls | Publish/Award gates; default new-buyer restricted mode; 3 commitments / £2,500 exposure; Platform Owner review/override | r2 expressly discloses current default limits, gate points and that existing payment obligations survive restriction | Explicit buyer-control notice shown before agreement acceptance | PASS |
| 14 | E2E evidence discipline | DB role flows, contract tests, typecheck/build verified | N/A — internal QA discipline, not a user contractual clause | N/A | PARTIAL: browser-authenticated E2E BLOCKED |

## Material legal changes made by this audit

The controlled material legal version is now `2026-09-26-r2`. Privacy remains `2026-09-26` because this audit did not identify a privacy-policy change requiring a new privacy version.

r2 adds explicit user-facing treatment of:
- Buyer Risk at Publish and Award;
- current new-buyer defaults of 3 active commitments and £2,500 outstanding transport exposure;
- authorised Platform Owner review/override;
- separate payment-obligation acknowledgement on each Award;
- Award remaining pending until carrier explicit acceptance;
- immutable/versioned commercial amendments;
- approved waiting/handball/redelivery/additional-stop extras;
- verified collection handover and 1–10 collection photographs where required;
- broker payer/ordering-party responsibilities;
- carrier compliance and subcontracting responsibilities.
## Reacceptance and integrity

The application already supported material reacceptance. This audit strengthened it so a historical acceptance is not considered current merely because its visible version string matches. Current evaluation also checks:
- selected controlled language;
- privacy document hash;
- each material agreement language;
- translation version;
- exact document hash.

Because the contractual version changed to `2026-09-26-r2`, an older `2026-09-26` acceptance is not silently upgraded.

## Executable evidence after remediation

- Contract/legal/onboarding targeted Vitest: **13 files / 101 tests PASS**.
- Real signed PDF generation: **EN/RO/FR/ES/PL PASS**.
- TypeScript: `npm run typecheck` **PASS / exit code 0**.
- Production build: `npm run build` **PASS / exit code 0**, 181 static pages generated.
- Existing Next.js ESLint-plugin warning remains non-fatal and is unrelated to these Contract Protection changes.
- Browser-authenticated Contract Protection master remains **BLOCKED**, not PASS, until approved protected credentials/session exist.

## Closeout interpretation

Points 1–13 are aligned between the implemented Contract Protection behavior and the legal/onboarding surface to the extent that each point creates a user-facing right, duty or restriction. Point 14 remains partially open solely for authenticated browser evidence. This audit verifies product/legal-text consistency; it is not an external solicitor opinion on enforceability.
