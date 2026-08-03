# Driver Dashboard — CX Reference Measurement Document

**Status:** implementation in progress — PR #338  
**XDrive surface:** `/driver`

## Reference mapping

- **CX reference filename:** `Screenshot 2026-06-04 063434.png`
- **Observed analogue:** compact execution workspace with left control rail, dense schedule table, and immediate next-action card

## Region measurements

| Region | Target |
|---|---:|
| Shell sidebar | `230px` desktop / `56px` tablet / `280px` drawer mobile |
| Top header | `50px` |
| Main content padding | `12px 12px 16px` |
| Page header block | `44–56px` |
| Left control rail | `220px` |
| Primary section gap | `12px` |
| Internal card gap | `8px` |
| Micro gap | `4px` |
| KPI height | `72px` target / `80px` max |
| Panel header | `36px` minimum |
| Panel body padding | `10px` |
| Standard table row | `42px` target / `52px` max |

## Typography and control contract

| Element | Target |
|---|---|
| Eyebrow | `11px / 16px / 700 uppercase` |
| Page title | `20px / 26px / 600` |
| Page description | `12px / 16px / 400` |
| Panel title | `13px / 18px / 600` |
| Summary button label | `12px / 16px / 600` |
| Current job route | `13px / 18px / 600` |
| Current job meta | `11px / 14px / 400` |
| Controls | `32px` height |

## Layout notes

- Shift-picture rail now uses the shared `OperationalMetricList` instead of route-local inline rows.
- Readiness and owner-driver business summaries now use the shared dashboard summary button contract.
- Current-job card now uses explicit route/meta classes with the approved XDrive text tokens.
- Owner-driver document-expiry rows now use shared compact list-row styling and keep the real document/action behaviour.
- The owner-driver KPI strip is now hard-capped at **6 visible tiles**: `Jobs today`, `Active job`, `Awaiting start`, `Completed`, `Documents expiring`, `Quotes submitted`.
- Lower-priority owner-driver finance metrics (`Won work`, `Pending invoices`) stay navigable in the right-rail `Business summary` instead of the KPI strip.

## Responsive transformation

| Viewport | Required behaviour |
|---|---|
| `1440×900` | left rail visible, compact current-job card and today schedule stay above the fold, no body horizontal overflow |
| `768×1024` | collapsed `56px` sidebar, rail stacks above dashboard content, tables own horizontal scroll if needed |
| `390×844` | drawer sidebar, page header/actions wrap, summary buttons remain compact and keyboard reachable |

## Evidence

| Viewport | Before | After |
|---|---|---|
| `1440×900` | `docs/ui/cx/evidence/before/driver-dashboard-1440x900-before.jpeg` | `docs/ui/cx/evidence/after/driver-dashboard-1440x900-after.jpeg` |
| `768×1024` | `docs/ui/cx/evidence/before/driver-dashboard-768x1024-before.jpeg` | `docs/ui/cx/evidence/after/driver-dashboard-768x1024-after.jpeg` |
| `390×844` | `docs/ui/cx/evidence/before/driver-dashboard-390x844-before.jpeg` | `docs/ui/cx/evidence/after/driver-dashboard-390x844-after.jpeg` |

## Numerical deviation record

| Metric | Contract | Previous state | Current state | Status |
|---|---:|---:|---:|---|
| Owner-driver KPI tile count | `<= 6` visible | `7–8` depending on pending invoices | `6` fixed | closed |
| Desktop shell | `230px sidebar / 50px header` | referenced only in docs | rendered validation at `230px / 50px` | closed |
| Tablet shell | `56px sidebar` | referenced only in docs | rendered validation at `56px` | closed |
| Mobile shell | `280px drawer` | referenced only in docs | rendered validation confirms off-canvas drawer with no body overflow | closed |
| Page header actions | `32px` controls | referenced only in docs | rendered validation `30–34px` tolerance | closed |
| Panel header | `>= 36px` | referenced only in docs | rendered validation `>= 36px` | closed |
| KPI height | `72px target / 80px max` | referenced only in docs | rendered validation `72–80px` | closed |
| Two-column collapse | single column at `<=768px` | referenced only in docs | rendered validation confirms stacked layout at `768×1024` and `390×844` | closed |
| Body overflow | none | referenced only in docs | rendered validation confirms none at all mandatory viewports | closed |
| Shift-picture control rail rows | shared compact rail | route-local inline rows with `#202124` / `#EEF2F6` | shared `OperationalMetricList` | closed |
| Summary shortcut buttons | shared `12px / 16px / 600`, `8px 10px`, token border | route-local inline buttons with `#D9E2EC` / `#202124` | shared summary button contract | closed |
| Current-job route block | `13px / 18px / 600` | route-local `1rem` / legacy text color | explicit operational class | closed |
| Current-job metadata | `11px / 14px / 400` | route-local `0.78rem` / legacy muted token | explicit operational class | closed |
| Owner-driver expiry rows | compact shared row styling | route-local inline rows | shared list-row contract | closed |

## Acceptance checklist

- [x] Real `/driver` functionality retained for fleet-driver and owner-driver variants
- [x] Shared `230px / 50px` shell contract retained
- [x] Left rail uses shared compact metric primitive
- [x] Current-job card uses explicit operational typography tokens
- [x] Summary buttons and expiry rows use shared compact dashboard styling
- [x] Before/after evidence referenced for `1440×900`, `768×1024`, `390×844`
- [x] Owner-driver KPI strip capped at six visible tiles
- [x] Rendered validation covers sidebar geometry, header height, KPI height/count, stacked layout and overflow at `1440×900`, `768×1024`, `390×844`
- [ ] Remaining non-driver dashboards still require their own route-by-route closure
