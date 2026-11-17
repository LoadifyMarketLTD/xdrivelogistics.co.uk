# XDrive CRM #818 — implementation continuation checkpoint (2026-11-17)

## Source of truth
- Repo: `LoadifyMarketLTD/xdrivelogistics.co.uk`.
- Working branch: `feature/business-development-crm-818`; PR #819 DRAFT, issue #818.
- Worktree: `D:\XDrive-CRM-818-20261117` (isolated clone).
- DO NOT merge main, deploy Production, apply Production migrations, use GitHub Actions, send unsolicited marketing, create synthetic live members/jobs, or alter the existing approved Super Admin design.

## Work delivered on branch
1. Existing base: owner-only CRUD for sourced organisations, business contacts, manual events, suppressions; owner navigation.
2. New defensive `_lib/server.ts`: exact Supabase-origin match and explicit isolated-staging gates for every CRM mutation, server-approved environment status.
3. Organisation management: source categories, source references, company-number/domain normalization, status transitions with database audit, owner assignment, priority, follow-up date, duplicate prevention. Conversion cannot be selected as a normal status.
4. Read-only Companies House lookup by registered number **and** company search, requiring independently configured `COMPANIES_HOUSE_API_KEY`. Public records are not automatically imported or contacted.
5. CSV preview: 100-row read-only dry run, hash, source/duplicate checks by company number and website domain. Isolated-staging import only after full owner confirmation and matching file hash; no contacts imported.
6. Draft-only campaigns; legal review evidence required to approve content; no send route, provider, scheduling or recipient export.
7. Contact review: classification, LIA evidence, corporate subscriber, privacy notice, TPS/CTPS flags, retention queue, manual email/phone eligibility checks. Eligibility is not permission to send.
8. Privacy requests: access, erasure and immediate opt-out/objection suppression; reviewed contact data export remains owner-only; erasure requires verified identity, review, explicit decision evidence, no legal hold, and an atomic SQL routine.
9. CRM scorecard uses live CRM table counts, never fabricated business activity.
10. Verified onboarding link requires active member, matching company registration number and approved onboarding application. No inferred job or booking from membership.
11. CRM UI integrates all new sections under the isolated business-development page; existing Super Admin layout is unchanged.

## Source intake scope — six categories
- Companies House: official API search and lookup, manual verification before CRM record creation.
- Public company websites: provenance-based **manual** entry; no unauthorized scraping.
- Existing XDrive customers: canonical `/super-admin/members-directory` and `/super-admin/companies` remain the only directory screens; CRM uses a verified source UUID and staging-only source capture. Registration alone is not a customer relationship.
- Partner referrals: manual referral evidence; referral alone does not authorize marketing.
- Inbound enquiries: canonical `/super-admin/xdrive-logistics` retains service-request/quote-to-job operations; CRM accepts the verified quote UUID as provenance only, never as automatic marketing consent.
- Owner CSV research: strict preview and staging import only.

These are owner-controlled intake channels, **not six validated autonomous acquisition integrations**. No real target list of 100, contacts or conversions has been imported.

## Database / rollout
- Existing unapplied CRM migrations: `20261116191000_b2b_crm_private_staging.sql`, `20261116192900_crm_contact_suppression_guard.sql`.
- New source-only migration: `20261117060000_crm_workflows_isolated_staging.sql`.
- **None of these migrations has been applied to Production.**
- The Supabase CLI installation on the connected Windows device returned `spawn UNKNOWN`. We added reproducible `npm run test:crm:sql`: in-memory PostgreSQL (PGlite) with minimal `auth.users` and `companies` fixtures, all three CRM migrations replayed successfully (19 SQL assertions PASS). This is **not** a full replay of the complete historical XDrive schema or hosted Supabase E2E; staging clean replay and advisors are still required.
- Require `XDRIVE_CRM_STAGING_WRITES=enabled`, `XDRIVE_CRM_DATABASE_SCOPE=isolated_staging`, and `XDRIVE_CRM_STAGING_SUPABASE_URL=https://<isolated-ref>.supabase.co` matching the actual Next.js Supabase origin; never point to Production or deploy preview. The existing XDrive and separate Loadify Production origins are also explicitly denied by the write gate.
- `COMPANIES_HOUSE_API_KEY` is server-only and optional; without it, registry search returns 503 with a clear message.
- `XDRIVE_CRM_PREVIEW_SIGNING_SECRET` must be at least 32 characters, server-only and configured in isolated staging. Owner CSV preview issues a 15-minute HMAC token bound to the owner ID and exact SHA-256 file hash; import rejects missing, tampered, expired, cross-owner or unsigned previews.

## Verified local source checks
- TypeScript noEmit PASS (twice during implementation), scoped ESLint PASS, Git whitespace checks PASS.
- CRM target unit tests PASS: 37/37 (20 isolated write-gate, 11 outreach eligibility, 6 signed CSV review token tests, via `__tests__`).
- SQL source-only ephemeral PostgreSQL replay PASS: 3 migrations and 19 assertions. Found and repaired the shared audit-protection trigger which incorrectly accessed a contact_id field on campaign audit rows. Erasure now redacts contact-linked activity notes while retaining restricted metadata. Retention legal-hold denials tested.
- These checks do **not** count as SQL clean replay, authenticated E2E, production readiness or real commercial transactions.

## Continuation after owner reanalysis — implementation-only sweep

The following implementation was added **after** the previously recorded 37 unit /
19 SQL assertion runs. Do not claim those old checks cover the newly added modules.

1. **Manual commercial action and follow-up engine:** new owner-only
   `GET/POST /api/super-admin/business-development/follow-ups`, overdue/today/
   next-seven-days/unscheduled queue, evidence note, optional contact link and
   future action date; staging-only transactional
   `crm_record_prospect_action` writes the real activity and updates prospect
   status, follow-up, and audit together. A call attempt never counts as a reply.
   New **unapplied** migration:
   `20261117072000_crm_prospect_followup_workflow.sql`.
2. **No fake response statuses:** direct edits only cover initial research stages;
   qualification/reply/onboarding/disqualification require evidenced atomic action.
   The parallel stand-alone activity POST editor was removed; CRM event history is read-only and the evidenced atomic follow-up route owns new activity.
3. **Campaign audience review:** new read-only API, privacy/suppression and legal
   flag screening for a bounded, explicitly incomplete candidate sample; no
   recipient export and no dispatch. CRM UI presents counts and denial reasons.
4. **Owner-reviewed internal source capture:** new staging-only API verifies
   active registered-member record and exact company registration, or an XDrive
   public quote source. Requires legal identity, public verification URL, and
   owner evidence. Never copies tenant contacts or assumes marketing consent.
5. **Companies House targeted industry research:** read-only advanced API query
   for selected SIC sectors, active UK companies, five pages of up to 20
   candidates, CRM company-number deduplication and owner verification/pre-fill.
   Requires `COMPANIES_HOUSE_API_KEY`; **no real candidates imported yet**.
6. **Observed activity metrics:** recorded manual replies, call attempts and
   meetings plus verified active-member CRM conversions; no shipments inferred.
7. **UK B2B compliance workbook:** `docs/legal/XDRIVE_CRM_B2B_LEGAL_REVIEW_WORKBOOK.md`
   contains LIA, source transparency and outbound approval templates; no legal
   signoff or automatic permission to contact anyone.
8. **Canonical job and finance evidence:** removed redundant `commercial-evidence` API and CRM job table. CRM now links to the existing `/super-admin/operations/jobs`, `/super-admin/operations/pods` and `/super-admin/finance/revenue` screens. Test job records are never automatically reported as real commercial revenue.

Scoped TypeScript noEmit and ESLint passed for these source changes, but the
**fourth SQL migration, new API integrations and authenticated end-to-end
workflows have not been run against hosted staging**. Full E2E acceptance remains
deferred until owner-requested implementation completion. Neither Production
nor `main` was changed.

## Canonical Super Admin deduplication — 2026-11-17

Owner requested an explicit duplicate-screen audit against current main before
further implementation. Existing Super Admin modules were verified in current
GitHub main and in the checked-out source:

- Public XDrive enquiries and pricing/accepted-quote-to-job: `/super-admin/xdrive-logistics`.
- Existing XDrive registered member directory: `/super-admin/members-directory`.
- Company governance: `/super-admin/companies`.
- Onboarding decisions: existing `/api/super-admin/onboarding`.
- Canonical platform jobs, POD and Finance: `/super-admin/operations/jobs`,
  `/super-admin/operations/pods`, `/super-admin/finance/revenue`.
- Control-plane analytics and notifications already have their own modules.

Actions in this PR:
- Removed redundant CRM public enquiry/member/job list UI and the three
  corresponding read-only API endpoints `inbound-enquiries`, `existing-members`
  and `commercial-evidence`; their platform source data remains untouched.
- CRM now links to canonical Super Admin pages, with separately verified
  stage-only source UUID capture for business provenance, not personal data.
- Removed the extra Command Centre quick-action link introduced by this PR;
  existing approved Super Admin page stays byte-equivalent to current main.
  CRM remains accessible by direct owner-only route during DRAFT development.
- Removed duplicate independent CRM activity editor; retained read-only
  activity history and owner-only atomic action/follow-up workflow.
- Generic prospect CRUD must not masquerade as an independently verified
  inbound enquiry or registered customer; such source types require canonical
  source-capture verification. Preserve verified source evidence on edits.
- Keep truly distinct prospect records, lawful-basis/suppression compliance,
  B2B research, pipeline actions and draft-only campaign review in the CRM.

Additional PR checks:
- [PR #431](https://github.com/LoadifyMarketLTD/xdrivelogistics.co.uk/pull/431):
  legacy Super Admin visual rebuild, CLOSED/NOT MERGED, marked SUPERSEDED;
  its 138-file historical diff must not be cherry-picked wholesale.
- [PR #689](https://github.com/LoadifyMarketLTD/xdrivelogistics.co.uk/pull/689):
  canonical Super Admin authorization/touch-accessibility remediation, MERGED.
  Reuse existing `verifyPlatformOwner` guards and enterprise primitives.
- Other PRs sampled around #815–#829 primarily concern Driver/POD/Finance,
  not a replacement Super Admin CRM. This does not prove no other historical
  branch or PR exists; do not make assumptions about unknown agent work.

Do not merge or deploy. This audit compared repository code and PR metadata,
not a complete authenticated production-browser visual inspection.

## Remaining gates before claiming production readiness
- Full XDrive historical-schema replay (local fixtures covered CRM migration contracts only), hosted **isolated staging** verification, security advisors and actual authenticated REST/RLS checks. Local SQL RLS/trigger/erasure contracts and TypeScript/lint pass.
- An independently verified healthy isolated staging Supabase project and real authenticated owner/non-owner/anonymous E2E evidence. Only XDrive Production plus branches marked `MIGRATIONS_FAILED` were found in connector inspection; none qualifies as a safe CRM staging target. Do not create billable branch or project without cost approval.
- CSV duplicates, source integrity, privacy request verification, race conditions and campaign denial validation.
- Legal review of PECR/UK GDPR, LIA template, external-sourced contact privacy notice and data retention before live outreach.
- Live commercial data: first 100 manually verified UK organisations with provenance; no messages without explicit separate legal sign-off.
- No user-facing claim of live marketplace liquidity, verified replies, bookings or delivery metrics until independently proven.
- Avoid merging until acceptance gates and user approval. Keep PR #819 DRAFT.

## Important distinctions
- A draft campaign approval never allows dispatch; no send action is implemented.
- An approved onboarding application and an active company are not evidence of a completed shipment.
- GDPR erasure may be limited by lawful audit retention; review associated free-text notes and legal exemptions before declaring all personal data deleted.
- Unit/static validation and isolated in-memory PostgreSQL smoke were run; authenticated end-to-end tests involving user sessions and hosted Supabase remain unexecuted. Do not label these local results as full E2E.
