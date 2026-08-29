# CX vs XDrive Dashboard Convergence — 2026-08-29

## Scope

This checkpoint records the approved dashboard-convergence workstream for XDrive workspaces. It is intentionally separate from the Driver E2E remediation work and must not change `/super-admin`.

## Baseline

- Repository: `LoadifyMarketLTD/xdrivelogistics.co.uk`
- Baseline branch: `main`
- Baseline commit at audit: `3fe010a68a6107af0496a406f9a98bfe04f5dd54`
- CX reference authority: `docs/ui/cx/**` + measured workspace baseline
- Shared implementation authority: `app/components/workspace/workspace-measured-cx-baseline.css`

## Dashboard audit snapshot

| Workspace | CX-parity audit score | Main issue |
|---|---:|---|
| Carrier / Company | 9.0/10 | Needs unified expandable operational record and stronger inline tracking/POD |
| Driver / Owner-driver | 8.8/10 | Final convergence across Loads / Jobs / Diary / History |
| Broker | 8.5/10 | Too many sequential panels; needs consolidated action canvas |
| Dispatcher | 8.4/10 | KPI-led composition; live positions/exceptions should dominate |
| Customer / Shipper | 8.2/10 | KPI-led composition; needs action centre + activity canvas first |
| Fleet Manager | 8.1/10 | Needs table-first fleet/resource control and above-the-fold exceptions |
| Compliance | 7.9/10 | KPI-led; verification queue should dominate |
| Finance | 7.8/10 | KPI-led; invoice queue should dominate |
| Viewer | 7.5/10 | Read-only role; keep deliberately simple |

## Convergence rule

Do not copy Courier Exchange pixel-for-pixel. Preserve XDrive branding and contracts, but converge on the CX operating grammar:

`CONTROL → OPERATIONAL LIST → EXPAND → ACT`

Avoid reverting to:

`HEADER → LARGE KPI WALL → PANEL → PANEL → PANEL → TABLE`

## Non-negotiable rules

1. `/super-admin` remains untouched.
2. Do not import or resurrect Workspace visual changes from PR #359.
3. Do not mix this convergence work into PR #398 Driver E2E remediation.
4. Preserve the measured baseline tokens: 50px header, 12px page padding, 220px filter rail, 230px structural sidebar, 32px controls, 28px tabs, 36px panel headers, 42px dense table rows, 52px minimum operational record, 13px operational body, 11px metadata.
5. Complex operational records stay content-driven; do not force them to a universal fixed row height.
6. Keep status/permission/data-availability behavior truthful; no fake zeros for unavailable data.

## Execution order

1. Fleet Manager
2. Customer / Shipper
3. Dispatcher
4. Finance
5. Compliance
6. Broker
7. Carrier / Company
8. Driver / Owner-driver final convergence
9. Viewer validation only

## Acceptance target

The dashboard should place the user’s next operational decisions and active work above decorative summary content. Summary metrics remain available but become supporting signals rather than the primary page structure.
