# XDrive — Master Dashboard 5301

Mandate approved 19 November 2026, 22:38 UK: the Owner Driver workspace at http://localhost:5301/driver is the Master Dashboard for every applicable workspace, individually adapted to role, data and permissions. No further intermediate design approval is required.

## Source of truth

Verified source worktree: XDrive-PR807-CX-Recovered-Preview-20261116 (commit 8dc5d102c at inspection).
- app/driver/page.tsx: commercial and execution dashboard layouts, grouped cards, period controls and latest booking register.
- app/components/workspace/OwnerDriverSidebar.tsx and OwnerDriverSidebar.module.css: sidebar reference; official sidebar asset public/xdrive-logo-company-3150.png.
- app/driver/xdrive-operational-dashboard-v2.css: primary commercial grid geometry (.87fr / 1.13fr), 12px gap, 10px column gap, 9px cards and single-column responsive layout.

MAIN remains the source of truth for live data, business rules, capabilities, RLS, canonical IDs, actions and routes. Never copy Driver mutation handlers, session authority or account data into a different role. A master dashboard is a presentation and UX contract, not a shared permission grant.

## Applicability

| Role | Approved home / adaptation |
| --- | --- |
| Owner Driver | Reference, preserve source |
| Driver | Execution-only master variant; assigned jobs, current/next assignment, readiness and authorized POD |
| Company Owner, Company Admin, Carrier Admin | Commercial and operational master variant, company-scoped datasets |
| Fleet Manager | Fleet/resource indicators and authorized operations only |
| Dispatcher | Allocation, exceptions, tracking, operations |
| Broker | Broker-specific commercial and booking controls |
| Customer | Customer-owned loads, quotes, bookings and invoicing where authorized |
| Finance | Authorized finance registers, reconciliation and reporting |
| Compliance | Authorized documents, expiry and verification |
| Viewer | Read-only authorized data; no mutation controls |
| Platform Owner / Super Admin | Excluded; protected existing dashboard, no changes |

Preserve existing 3118 My Fleet and Drivers, canonical company register routes and the approved consolidated My Fleet hub. Do not copy demo data. Do not remove complementary role-specific capabilities merely because they are absent from the driver reference. Keep the commercial core visually consistent; place additional company-only panels as complementary content.

## Acceptance

Compare actual rendered source and adapted screens at desktop and mobile, validate all existing actions and destinations, prove permission isolation and data completeness, run regressions and authenticate with the relevant role before declaring RELEASE READY. Incremental release does not imply complete acceptance. Never alter parallel agent worktrees or platform owner routes. Apply G01–G08 and retain verifiable checkpoints.
