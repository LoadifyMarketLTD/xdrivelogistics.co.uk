# Dashboard Home Surfaces — CX Reference Measurement Document

**Status:** implementation in progress — PR #338  
**XDrive targets covered:** `/admin`, `/broker`, `/customer`, `/driver`, carrier / fleet dashboards in `app/components/workspace/RoleDashboards.tsx`, `/super-admin`

## Reference mapping

| XDrive surface | CX reference filename | Primary observed analogue |
|---|---|---|
| Admin / carrier / fleet | `Screenshot 2026-05-28 204652.png` | diary / control-desk table + left rail |
| Broker | `Screenshot 2026-05-28 204700.png` | quote / allocation workboard |
| Customer | `Screenshot 2026-05-28 204707.png` | transport list with decision rail |
| Driver | `Screenshot 2026-06-04 063434.png` | compact execution workspace |
| Super Admin | `Screenshot 2026-06-04 063844.png` | dense operational governance console |

## Numeric implementation baseline

### Shell and page geometry

| Property | Value |
|---|---:|
| Desktop sidebar width | `230px` |
| Tablet collapsed sidebar width | `56px` |
| Mobile drawer width | `280px` |
| Top header height | `50px` |
| Main content padding | `12px 12px 16px` |
| Primary section gap | `12px` |
| Secondary gap | `8px` |
| Micro gap | `4px` |
| Decorative whitespace maximum | `16px` |

### Dashboard panel contract

| Element | Value |
|---|---:|
| Search / control rail width | `220px` |
| Panel radius | `4px` |
| Panel header height | `36px` minimum |
| Panel header padding | `8px 10px` |
| Panel body padding | `10px` |
| Button / select / input height | `32px` |
| KPI tile height target | `72px` |
| KPI tile hard maximum | `80px` |
| KPI tile padding | `8px 10px` |
| KPI accent bar | `3px` |
| Table header height | `36px` |
| Table row target | `42px` |
| Table row hard maximum | `52px` |

### Jobs column geometry retained inside dashboard system

`92 / 110 / minmax(260px,1.6fr) / 150 / 150 / 110 / 150 / 96 / 92px`

## Typography

| Role | Value |
|---|---|
| Eyebrow | `11px / 700 / uppercase / 16px` |
| Page title | `20px / 600 / 26px` |
| Page description | `12px / 400 / 16px` |
| Panel title | `13px / 600 / 18px` |
| Metric / metadata | `11px–12px` |
| Body text | `12px–12.5px` |

## XDrive colour mapping

| Semantic role | Token / hex |
|---|---|
| Page background | `#F4F6F8` |
| Surface | `#FFFFFF` |
| Border | `#D8DEE8` |
| Header / muted surface | `#F4F6F8` |
| Divider | `#E5E7EB` |
| Primary text | `#1A1F2B` |
| Muted text | `#64748B` |
| Primary action | `#1D57D8` |
| Success | `#35A853` |
| Warning | `#F5A300` |
| Danger | `#D93025` |
| Platform navy | `#0B2F6B` |

## Responsive transformation

| Viewport | Required behaviour |
|---|---|
| `1440×900` | full shell, left control rail visible, dense KPI strip, table-first dashboard flow |
| `1920×1080` | same geometry, additional whitespace must remain below decorative maximum |
| `768×1024` | `56px` sidebar, control rail stacks above content, no body-level horizontal overflow |
| `390×844` | drawer sidebar, page header wraps, controls remain `32px` tall, operational tables may scroll inside their own region only |

## Rendered evidence set

| Surface | Viewport | Before | After |
|---|---|---|---|
| `/admin` | `1440×900` | `docs/ui/cx/evidence/before/admin-dashboard-1440x900-before.jpeg` | `docs/ui/cx/evidence/after/admin-dashboard-1440x900-after.jpeg` |
| `/admin` | `768×1024` | `docs/ui/cx/evidence/before/admin-dashboard-768x1024-before.jpeg` | `docs/ui/cx/evidence/after/admin-dashboard-768x1024-after.jpeg` |
| `/admin` | `390×844` | `docs/ui/cx/evidence/before/admin-dashboard-390x844-before.jpeg` | `docs/ui/cx/evidence/after/admin-dashboard-390x844-after.jpeg` |
| `/broker` | `1440×900` | `docs/ui/cx/evidence/before/broker-dashboard-1440x900-before.jpeg` | `docs/ui/cx/evidence/after/broker-dashboard-1440x900-after.jpeg` |
| `/broker` | `768×1024` | `docs/ui/cx/evidence/before/broker-dashboard-768x1024-before.jpeg` | `docs/ui/cx/evidence/after/broker-dashboard-768x1024-after.jpeg` |
| `/broker` | `390×844` | `docs/ui/cx/evidence/before/broker-dashboard-390x844-before.jpeg` | `docs/ui/cx/evidence/after/broker-dashboard-390x844-after.jpeg` |
| `/customer` | `1440×900` | `docs/ui/cx/evidence/before/customer-dashboard-1440x900-before.jpeg` | `docs/ui/cx/evidence/after/customer-dashboard-1440x900-after.jpeg` |
| `/customer` | `768×1024` | `docs/ui/cx/evidence/before/customer-dashboard-768x1024-before.jpeg` | `docs/ui/cx/evidence/after/customer-dashboard-768x1024-after.jpeg` |
| `/customer` | `390×844` | `docs/ui/cx/evidence/before/customer-dashboard-390x844-before.jpeg` | `docs/ui/cx/evidence/after/customer-dashboard-390x844-after.jpeg` |
| `/driver` | `1440×900` | `docs/ui/cx/evidence/before/driver-dashboard-1440x900-before.jpeg` | `docs/ui/cx/evidence/after/driver-dashboard-1440x900-after.jpeg` |
| `/driver` | `768×1024` | `docs/ui/cx/evidence/before/driver-dashboard-768x1024-before.jpeg` | `docs/ui/cx/evidence/after/driver-dashboard-768x1024-after.jpeg` |
| `/driver` | `390×844` | `docs/ui/cx/evidence/before/driver-dashboard-390x844-before.jpeg` | `docs/ui/cx/evidence/after/driver-dashboard-390x844-after.jpeg` |
| `carrier / fleet` | `1440×900` | `docs/ui/cx/evidence/before/carrier-dashboard-1440x900-before.jpeg` | `docs/ui/cx/evidence/after/carrier-dashboard-1440x900-after.jpeg` |
| `carrier / fleet` | `768×1024` | `docs/ui/cx/evidence/before/carrier-dashboard-768x1024-before.jpeg` | `docs/ui/cx/evidence/after/carrier-dashboard-768x1024-after.jpeg` |
| `carrier / fleet` | `390×844` | `docs/ui/cx/evidence/before/carrier-dashboard-390x844-before.jpeg` | `docs/ui/cx/evidence/after/carrier-dashboard-390x844-after.jpeg` |
| `/super-admin` | `1440×900` | `docs/ui/cx/evidence/before/super-admin-dashboard-1440x900-before.jpeg` | `docs/ui/cx/evidence/after/super-admin-dashboard-1440x900-after.jpeg` |
| `/super-admin` | `768×1024` | `docs/ui/cx/evidence/before/super-admin-dashboard-768x1024-before.jpeg` | `docs/ui/cx/evidence/after/super-admin-dashboard-768x1024-after.jpeg` |
| `/super-admin` | `390×844` | `docs/ui/cx/evidence/before/super-admin-dashboard-390x844-before.jpeg` | `docs/ui/cx/evidence/after/super-admin-dashboard-390x844-after.jpeg` |

## Numerical deviation record

| Surface scope | Metric | Contract | Before | After | Status |
|---|---:|---:|---:|---:|---|
| Shared dashboard primitives | Panel title font size | `13px` | `14px` | `13px` | closed |
| Shared dashboard primitives | Panel title line height | `18px` | `18px` | `18px` | retained |
| Shared dashboard primitives | Panel body padding | `10px` | `10px` | `10px` | retained |
| Shared dashboard primitives | Primary text token | `#1A1F2B` | `#202124` | `#1A1F2B` | closed |
| Shared dashboard primitives | Standard border token | `#D8DEE8` | `#D9E2EC` | `#D8DEE8` | closed |
| Shared dashboard primitives | Divider token | `#E5E7EB` | `#EEF2F6` | `#E5E7EB` | closed |
| Shared dashboard primitives | Workspace background token | `#F4F6F8` | `#F5F7FA` | `#F4F6F8` | closed |
| Shared dashboard primitives | Muted text token | `#64748B` | mixed legacy muted tokens | `#64748B` | closed |

## Acceptance checklist

- [x] Shared `230px / 50px` shell retained
- [x] Compact dashboard headers retained
- [x] Dashboard panel headers aligned to `36px` minimum and `8px 10px` padding
- [x] Panel bodies tightened to `10px`
- [x] KPI tiles remain within `72px` target / `80px` maximum
- [x] Super Admin home surface converted to control-rail + table-first operational layout
- [x] Visual fixture gate extended to cover carrier and super-admin dashboard surfaces
- [x] Before/after screenshot set attached at `1440×900`, `768×1024`, `390×844`
- [x] Numerical deviations recorded for the shared primitive correction pass
- [ ] Numerical deviations fully closed on every principal dashboard route

## Deviation log

| Surface | Current deviation | Planned closure |
|---|---|---|
| `/broker` | right-rail summary blocks still use route-specific content ordering | continue route-by-route tightening |
| `/customer` | invoice / quote summary cards still retain mixed inline row styles | migrate remaining rows to shared compact primitives |
| `/driver` | owner-driver KPI cap and rendered evidence pass completed; remaining follow-up is parity work on other role dashboards | keep follow-up work focused on other dashboard surfaces, not a separate driver visual system |
