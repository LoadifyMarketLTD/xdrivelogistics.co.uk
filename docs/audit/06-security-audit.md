# Audit 06 — Security Audit

## Audit Metadata

| Field | Value |
|---|---|
| Audit date | 2026-08-01 |
| Commit SHA | `38977d4d06bfb9fbaf55803f8a480262d8d3f262` |
| Branch | `copilot/audit-intreg-repository-loadifymarketltd` |
| Verification mode | Static repository audit plus committed/generated automation evidence |
| Overall disposition | PARTIAL — static controls are strong, but runtime isolation/session/storage verification is still required. |

## Scope

Route protection, secrets hygiene, RLS coverage, webhook verification, storage privacy, session handling and platform hardening.

## Evidence Basis

- `docs/audit/automated-audit-report.md` — latest automated run: 77 PASS, 0 FAIL, 4 MANUAL.
- `middleware.ts` — protected prefixes, login redirects, role checks, canonical host logic and secure cookie flags.
- `app/robots.ts` — authenticated surfaces explicitly disallowed from indexing.
- `supabase/functions/send-email/index.ts`, `supabase/functions/notify-operational-event/index.ts` — HMAC/secret verification.

## Findings

| ID | Finding | Disposition | Evidence |
|---|---|---|---|
| SEC-06-01 | Automated audit confirms migration integrity, RLS presence, storage bucket definitions, middleware route protection and env-secret hygiene. | PASS — runtime script evidence | `docs/audit/automated-audit-report.md` |
| SEC-06-02 | Protected web surfaces are enforced in middleware and private route prefixes are mirrored in robots disallow rules. | PASS — static evidence only | `middleware.ts`, `app/robots.ts` |
| SEC-06-03 | Webhook/email edge functions implement constant-time secret comparison or HMAC validation before processing. | PASS — static evidence only | `supabase/functions/send-email/index.ts`, `supabase/functions/notify-operational-event/index.ts` |
| SEC-06-04 | Cross-company read/write isolation, session invalidation behaviour, cookie flags on the deployed site and private bucket behaviour need live verification. | BLOCKED | `docs/audit/20-production-release-checklist.md` security criteria |
| SEC-06-05 | Security audit cannot be signed off while release-blocking defects remain open. | FAIL | `docs/audit/11-defect-report.md` |

## Release Gate Impact

- Linked defects: DEF-004, DEF-006
- Launch blocker: Yes
- Auditor decision: PARTIAL — static controls are strong, but runtime isolation/session/storage verification is still required.
