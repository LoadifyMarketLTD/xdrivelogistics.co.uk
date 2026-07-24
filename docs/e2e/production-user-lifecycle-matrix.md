# Production user lifecycle E2E matrix

Target: `https://xdrivelogistics.co.uk`

Branch: `audit/production-e2e-user-lifecycle`

This matrix is evidence-driven. A scenario may be marked PASS only when the browser flow, resulting database rows, route, navigation and authorization checks all pass for a new dedicated E2E account. Existing collaborators and internal/legacy accounts are excluded.

## Status legend

- `NOT RUN`: no production evidence yet.
- `BLOCKED`: required dedicated credential or test mailbox is unavailable.
- `FAIL`: executed and a defect was reproduced.
- `PASS`: executed with exact evidence for all required assertions.

## Scenario matrix

| ID | Scenario | Account creation | Email verification | Onboarding save/resume | Submission | Approval | Profile | Company | Membership | Route/navigation | API/RLS | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| S1 | Individual driver | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | N/A expected | N/A expected | NOT RUN | NOT RUN | BLOCKED |
| S2 | Owner-driver without own workspace | FAIL (not represented by current registration UI) | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | FAIL |
| S3 | Owner-driver with own workspace | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | BLOCKED |
| S4 | Company/carrier owner | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | BLOCKED |
| N1 | Incomplete onboarding cannot be approved | NOT RUN | N/A | NOT RUN | N/A | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | BLOCKED |
| N2 | Unsubmitted application cannot be approved | NOT RUN | N/A | NOT RUN | N/A | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | BLOCKED |
| N3 | Repeated submit/click is idempotent | NOT RUN | N/A | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | BLOCKED |
| N4 | Refresh during provisioning is idempotent | NOT RUN | N/A | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | BLOCKED |
| N5 | Inactive membership remains blocked | N/A | N/A | N/A | N/A | N/A | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | BLOCKED |
| N6 | Suspended membership remains blocked | N/A | N/A | N/A | N/A | N/A | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | BLOCKED |
| N7 | Pending company has no full workspace access | N/A | N/A | N/A | N/A | N/A | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | BLOCKED |
| N8 | Missing membership cannot access foreign workspace | N/A | N/A | N/A | N/A | N/A | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | BLOCKED |
| N9 | Multiple active workspaces are prevented | N/A | N/A | N/A | N/A | N/A | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | BLOCKED |
| N10 | Unauthorized dashboard routes are denied | N/A | N/A | N/A | N/A | N/A | NOT RUN | N/A | N/A | NOT RUN | NOT RUN | BLOCKED |

## Confirmed static defect

The current registration page exposes only `Customer / Shipper`, `Transport Broker`, `Fleet Operator`, and `Owner Operator`. `Owner Operator` is hard-wired to `account_type=owner_driver`, `workspace_mode=owner_driver`, and `owner_driver_workspace=true`. There is no UI path for either an individual driver or an owner-driver who does not want a dedicated workspace. Therefore S1 and S2 cannot both be represented by the production registration UI as currently implemented.

## Evidence required per production account

Record the dedicated test email, auth user id, profile id/role/status/company_id, onboarding id/account_type/workspace/status/progress/submitted_at, company id/status/created_by, membership id/role/status, final URL, visible navigation assertions, forbidden route assertions, and RLS/API response codes.

No real collaborator record may be changed. Any fixture created for a negative test must use an `e2e+...` address, be documented before mutation, and be removed or retained as an explicitly internal test account after evidence collection.