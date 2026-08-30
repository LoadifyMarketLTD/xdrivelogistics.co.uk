# CX → XDrive Finance / Accounting Parity Audit

Date: 2026-08-29
Branch: `fix/cx-dashboard-convergence-20260829`
Scope: finance/accounting only. No `/super-admin`, schema, RLS or lifecycle changes.

## Verdict

| CX capability | XDrive evidence | Verdict | Notes |
|---|---|---|---|
| Ready to Invoice | `FinanceControlDashboardHome.tsx` derives completed operated jobs without supplier invoice | KEEP | Derived finance queue only; does not invent a job lifecycle status. `Create invoice` opens `/admin/invoices/new` with job prefill. |
| Invoice lifecycle | `/admin/invoices`, invoice detail | KEEP | Draft, sent/awaiting payment, overdue, paid, disputed/cancelled presentation; detail also supports send, void and credit-note actions through existing backend contracts. |
| POD / order association | Driver Diary, job/invoice prefill, invoice detail | KEEP | Existing invoice flow links job and commercial data; no new document model introduced here. |
| Awaiting payment / overdue | Invoice register and Finance dashboard | KEEP | Explicit lifecycle filters/signals and receivable exposure. |
| Off-platform reconciliation / mark paid | `/api/admin/invoices/[id]/payment-history` + invoice detail | KEEP | Role-checked, idempotent payment records with settlement method, external reference, paid date and note. Overpayment is rejected. |
| Statements / export | `/admin/finance/statements`, `/admin/finance/reports` | KEEP | Company-scoped statement CSV with counterparty/date filters plus invoice, balances and job CSV exports. No mutation. |
| External invoice upload | No verified storage/schema/workflow contract found | BLOCKED-BY-CONTRACT | Do not expose fake upload UI. Requires evidence model, storage ownership, duplicate detection, invoice binding and permissions. |
| Batch actions | No safe atomic batch mutation contract verified | BLOCKED-BY-CONTRACT | Do not add batch settle/void/send controls until idempotency, partial-failure and audit semantics exist. |

## Security / authority findings

The existing payment-history endpoint validates bearer auth, active company membership, `canRecordInvoicePayments`, positive amount, idempotency key and overpayment protection before writing `invoice_payment_history`. The UI records settlement method and external reference rather than directly mutating a job lifecycle.

The new Statements surface reads only `useCompanyWorkspaceData().invoices`, filters locally and exports CSV. It does not write invoices, payments or jobs.

## Remaining finance work

Only the two CX-style advanced items above remain intentionally blocked: external invoice upload and batch mutation. They require protected contract work rather than UI-only imitation. Runtime validation remains pending final local PowerShell gate.
