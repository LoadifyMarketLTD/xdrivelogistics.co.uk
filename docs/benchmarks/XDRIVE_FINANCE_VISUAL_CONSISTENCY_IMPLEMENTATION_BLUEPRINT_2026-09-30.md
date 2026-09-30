# XDrive Finance Workspace Visual Implementation Blueprint
Date: 2026-09-30
Status: FINAL ROLE EXECUTION SPEC
Required base: XDRIVE_OPERATIONAL_ROLE_VISUAL_SYSTEM_MASTER_2026-09-30.md

## 1. Scope
Primary nav target:
Dashboard / Customer Invoices / Carrier Invoices / Payments / Balances / Reports / Settings / More.

## 2. Dashboard mission
Invoice readiness, receivables, settlement status and reporting.
XDrive does not hold funds or provide SmartPay-style settlement.

## 3. Current defect
Current Finance dashboard has 7 signal cells.
Shared operational contract allows maximum 6.
Final dashboard consolidates financial values without losing information.

## 4. Dashboard exact target
Page header: 78px.
Signals: exactly 6 x 56px:
1. Ready to Invoice
2. Draft
3. Unpaid
4. Overdue
5. Due 7d
6. Outstanding Value
Paid Value moves to Financial Exposure; do not keep a seventh signal.
Gap after signals: 12px.
Use master Dashboard grid 1.9fr / .75fr.

Main:
- Ready to Invoice
- Receivables Requiring Attention
- Recently Settled
Aside:
- Financial Exposure
- Finance Actions
All panel headers 44px.
All tables 36px header / 44px rows.
Financial Exposure contains exactly 3 rows x 56px: Outstanding / Overdue Exposure / Settled Value.
Finance Actions uses 32px buttons.

## 5. Secondary pages
Customer Invoices: 220px filter rail + 12px gap + invoice table; table header 36px, rows 44px.
Carrier Invoices: same geometry as Customer Invoices.
Payments: 36px/44px table, 40px toolbar.
Balances: summary signals 56px + 36px/44px table.
Reports: 44px panels; controls 32px; each primary chart body is exactly 280px high; secondary chart body is 220px high.
Settings: 220px settings rail.

## 6. Truth rules
No exact total when invoice data is unavailable or partial.
No platform-held funds language.
No payout/escrow UI.
Ready-to-Invoice remains a derived queue, not a new lifecycle state.

## 7. Acceptance
No 7-cell Finance strip.
Finance uses the same operational geometry as Dispatcher, Compliance and Fleet.

