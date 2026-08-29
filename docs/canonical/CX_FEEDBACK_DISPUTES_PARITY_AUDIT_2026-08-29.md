# CX → XDrive Feedback / Complaints / Disputes Parity Audit

Date: 2026-08-29
Branch: `fix/cx-dashboard-convergence-20260829`
Scope: Customer, Broker, Driver/Owner Driver. No `/super-admin`, schema or RLS changes.

## Verdict

| CX capability | XDrive evidence | Verdict | Notes |
|---|---|---|---|
| Customer raises booking dispute | `/customer/disputes` + `/api/customer/disputes` | KEEP | Job relationship is verified server-side; only terminal/exception jobs are eligible; duplicate active disputes are rejected; dispute is also recorded in job notes. |
| Customer tracks dispute | `/customer/disputes` | KEEP | Open/investigating/resolved state and resolution note are visible. |
| Broker manages disputes | `/broker/disputes` + `/api/broker/disputes/[id]` | KEEP | Broker/company scope is checked before resolve/escalate; management role is required; audit note written to job notes. |
| Driver sees booking feedback | `/driver/history` | KEEP | Real `reviews` rows are displayed and Diary separates awaiting/recent feedback. No fabricated rating is shown. |
| Driver leaves or edits CX-style feedback | `reviews` RLS / Driver Diary | BLOCKED-BY-CONTRACT | Current policy is `reviews_insert_non_driver`; Driver/Owner Driver cannot safely insert a review under the verified policy. Do not add a fake Leave/Edit Feedback action. |
| Trading-partner reputation / aggregate feedback | Member profile | PARTIAL | Existing member profile intentionally reports reputation unavailable where no verified aggregate contract exists. Do not fabricate stars/counts. |
| Complaint / platform moderation workflow | No dedicated verified cross-role complaint case model found | BLOCKED-BY-CONTRACT | `job_disputes` is booking-scoped. A broader membership/platform complaint requires explicit case type, evidence, ownership, escalation and moderation permissions. |

## Customer dispute contract

The Customer API authenticates the bearer token, resolves active company membership, verifies that the selected job belongs to that company, restricts creation to terminal/exception states, rejects a second active dispute for the same job/company, writes `job_disputes`, then appends a `[CUSTOMER_DISPUTE_RAISED]` job note.

## Broker dispute contract

The Broker PATCH endpoint requires an active membership and a manager-level role, verifies that the dispute was raised by the caller company or belongs to a job in that company's scope, then allows only `resolve` or `escalate`. Resolved disputes cannot be changed again through this endpoint.

## Driver feedback blocker

Driver Diary currently reads:
- `reviews.id`
- `reviews.job_id`
- `reviews.rating`
- `reviews.comment`
- `reviews.created_at`

and shows existing feedback. The database hardening policy currently allows review insertion only when `is_company_non_driver(company_id)` is true and the caller is the `reviewer_user_id`. A Driver/Owner Driver feedback composer would therefore be dishonest unless the role contract and RLS are deliberately extended and audited.

## Remaining work

1. Decide whether XDrive wants reciprocal Driver ↔ Customer/Carrier ratings like CX.
2. If yes, design a dedicated reviewed-party identity contract and extend RLS safely rather than weakening the existing policy.
3. Define whether complaints are merely booking disputes or a separate platform-governance case type.
4. Keep member reputation unavailable until aggregate eligibility, visibility and anti-gaming rules are explicit.
