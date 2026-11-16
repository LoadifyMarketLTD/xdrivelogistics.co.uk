# XDrive CRM — six UK B2B prospect acquisition channels

Status: implementation specification, not a claim that contacts have been imported. Owner-only staging. No automatic outreach.

| Channel | Source | Acquisition method | Provenance required | Restrictions |
| --- | --- | --- | --- | --- |
| 1 | Companies House | Search official company register for relevant active UK freight and supply-chain companies | company number, legal name, registry URL, checked timestamp | Registry listing alone does not establish marketing permission; validate trading relevance separately |
| 2 | Public company websites | Manual verification of freight buyers, warehouses, manufacturers and distributors | exact HTTPS page, observation date, business segment | No bypassing access restrictions; generic inboxes preferred where appropriate |
| 3 | Existing XDrive customers | Import approved existing commercial relationships from internal records | originating customer ID, contract/relationship context, record date | No mixing with other companies' customer data; verify lawful use and suppression |
| 4 | Partner and carrier referrals | Record referred businesses and referral provenance | referring partner, referral date, consent/permission evidence when applicable | A referral does not itself grant permission to send marketing |
| 5 | Inbound enquiries | Capture companies contacting XDrive via website/quote requests | enquiry ID, submitted timestamp, stated purpose, privacy notice version | Separate service response from marketing opt-in |
| 6 | Owner-reviewed CSV research | Structured import of manually verified B2B leads from permitted public or licensed directories | file/source URL, license or permission, verified timestamp, importer | Reject rows lacking provenance; deduplicate by company number/email; check Do Not Contact |

## Required intake pipeline

1. Identify organisation and verify UK legal identity, status, and freight relevance.
2. Save the source URL, checked timestamp, segment and legal form.
3. Keep contact-person data separate from organisation records; minimize personal data.
4. Require a documented lawful basis for named-person records; evaluate UK GDPR and PECR separately before outreach.
5. Normalize emails and E.164 phone numbers; check suppression on every intake.
6. Reject duplicates; record an immutable-ish activity trail and evidence of each owner decision.
7. No automated outbound email, phone calls, scraping, bulk imports, or production migrations until explicit compliance and integration gates pass.

## Implementation sequence

- Companies House lookup adapter (server-side, API credentials required for authenticated endpoints); no fabricated records.
- Owner-only CSV preview and validation, with a no-write dry run.
- Source-specific import adapters with deterministic deduplication and provenance.
- Suppression and legal-basis checks at API and database boundaries.
- E2E with test fixtures for owner, non-owner, unauthenticated, duplicate, and suppressed entries.
- Manual approval before any campaign capability is introduced.

**Current reality:** the CRM has organisation/contact/activity/suppression entry screens. No six-source automated acquisition integration is yet validated and no real lead inventory is claimed.
