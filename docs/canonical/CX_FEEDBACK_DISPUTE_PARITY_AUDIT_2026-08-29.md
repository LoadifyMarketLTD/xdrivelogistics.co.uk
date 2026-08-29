# CX → XDrive Feedback / Dispute Parity Audit

Date: 2026-08-29
Branch: `fix/cx-dashboard-convergence-20260829`
Status: ACTIVE CONTRACT AUDIT

## Broker disputes — KEEP

Verified existing XDrive contract:
- `app/broker/disputes/page.tsx` provides a broker-scoped dispute register with `Open`, `Investigating`, `Resolved`, search/filter controls, resolution notes, Resolve and Escalate actions.
- `app/api/broker/disputes/[id]/route.ts` authenticates the caller, requires active company membership and a manager role, verifies the dispute belongs to the broker company's job scope, and records dispute actions in `job_notes`.
- `supabase/migrations/108_p0_p1_launch_hardening.sql` adds bilateral SELECT visibility for the job owner company and awarded carrier company.
- `supabase/migrations/097_job_disputes_resolution_columns.sql` defines the base member insert/update policies and resolution fields.

Verdict: `KEEP` for the broker dispute-management workflow. This is a real operational contract and must not be replaced by a cosmetic complaint form.

## Customer dispute workflow — BLOCKED-BY-CONTRACT for safe creation UI

The database allows a member to insert a `job_disputes` row when `raised_by_company_id = auth_company_id()`, but that INSERT policy alone does not verify that the supplied `job_id` belongs to or is otherwise legitimately visible to the raising company.

The later bilateral SELECT policy verifies job relationship for reads, but there is no verified customer-specific server route in the audited surface that validates the job relationship before creating a dispute.

Verdict: do not expose a Customer `Raise dispute` UI directly against the table. A narrow authenticated API must first verify the caller company and job relationship, then insert the dispute. No RLS weakening is required.

## Feedback / reputation — PARTIAL / BLOCKED-BY-CONTRACT

Verified evidence:
- Driver diary/dashboard read review data.
- `app/api/member-profile/[companyId]/route.ts` and `app/components/workspace/MemberProfile.tsx` exist for member identity/profile presentation.
- Existing audit already established that company-level feedback aggregation is not a verified public reputation contract for Customer quote comparison.

Verdict:
- Keep verified driver feedback reads.
- Do not fabricate company rating, review count, or reputation score in Customer/Broker quote comparison.
- Do not equate generic product feedback/support forms with trading-partner feedback.

## Required next contract for full CX-style parity

1. Define review subject semantics: driver, company, or both.
2. Define who can review whom and only after which completed/eligible booking.
3. Enforce one review per eligible commercial relationship/job unless an explicit edit policy exists.
4. Define public aggregate fields and moderation/visibility rules.
5. Define abuse/reporting relationship to disputes without conflating the two workflows.
6. Add customer dispute creation through a job-scoped authenticated API before exposing the action.

No `/super-admin` implementation changes are authorised by this audit.
