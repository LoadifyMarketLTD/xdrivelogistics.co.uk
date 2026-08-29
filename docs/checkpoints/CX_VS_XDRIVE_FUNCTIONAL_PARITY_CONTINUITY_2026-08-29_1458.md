# CX → XDrive Functional Parity Continuity Checkpoint

Date: 2026-08-29 14:58 BST
Repository: `LoadifyMarketLTD/xdrivelogistics.co.uk`
Branch: `fix/cx-dashboard-convergence-20260829`
PR: `#399` — draft / open / mergeable / not merged

## Authority

Continue from:
- `docs/canonical/CX_TO_XDRIVE_FUNCTIONAL_PARITY_MASTER_PLAN_2026-08-29.md`
- `docs/canonical/CX_TO_XDRIVE_PARITY_LEDGER_2026-08-29.md`
- `docs/canonical/CX_PARITY_PROTECTED_CONTRACT_GAPS_2026-08-29.md`

Core rule: **functional parity is role-specific; no universal KPI count exists.** CX documentation supplies workflow/function behaviour; CX screenshots supply information architecture, density and interaction grammar. XDrive branding, privacy, RLS and lifecycle authority remain authoritative.

## Completed / materially advanced in the current execution branch

- Company Marketplace load-type quick tabs use explicit active filter state; stale `setTimeout` search behaviour removed.
- Live Availability uses operational tabs/signals instead of a local forced KPI wall.
- Driver top navigation follows CX-style primary modules plus `More` for secondary tools.
- Carrier/Fleet primary navigation promotes operational modules without granting restricted roles additional capabilities.
- Directory, Event Log, Notifications inboxes and role-specific routes are present.
- Driver and shared notification inboxes recognise load-alert/won-load event classes while explicitly not claiming that the missing producer/preferences backend is complete.
- Customer carrier quote comparison is explicit before award; member identity and lowest-price comparison are present. Reputation/ETA remain un-fabricated protected gaps.
- Broker dispute register is present and discoverable.
- Finance invoice register is dense, status-filtered and keeps real payment-detail actions.
- Finance dashboard now contains a real **Ready to Invoice** queue derived from completed jobs operated by the current company that have no supplier-side invoice linked to the job.
- `Ready to Invoice` does **not** create a new job lifecycle status and does not treat customer-owned jobs awarded to another carrier as supplier receivables.
- Existing secure invoice draft/detail route is reused for invoice creation from that queue.

## Protected gaps — do not fake in UI

The following remain protected until a narrow API/DB/RLS/lifecycle design is approved:

1. true background Load Alerts producer + user preferences + dedupe/channel delivery;
2. generic cross-role Freight Messenger conversation-start authority;
3. company-level reputation aggregation and safe pre-award bidder ETA/distance;
4. true multi-drop / recurrence / Daily Hire posting and execution contract;
5. Book Direct target/authority/booking contract;
6. telematics provider credential/mapping management;
7. advanced invoice upload/batch/query/supplementary actions where no verified contract exists.

## Finance Ready-to-Invoice authority boundary

A job enters the UI-only finance queue only when:
- canonical job presentation stage is `completed`; and
- the current company operated the job (`awarded_carrier_company_id === companyId`, or legacy/direct own-operation where no awarded carrier exists and `job.company_id === companyId`); and
- no supplier-side invoice for the current company is linked to that job.

This queue is derived presentation only. It does not write `ready_to_invoice` to the database.

## Validation state

Source-contract tests have been added/updated, but final PASS is not declared from source inspection alone.

Final release validation remains local Windows PowerShell on the final branch state:
- install using the repository's canonical package command;
- TypeScript typecheck;
- ESLint;
- focused CX parity tests;
- full test suite;
- production build;
- browser/role workflow walkthrough;
- exact diff + `/super-admin` exclusion audit.

Do not merge PR #399 until those final gates are explicitly verified.
