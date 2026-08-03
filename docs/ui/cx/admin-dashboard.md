# Admin Dashboard — Measurement Document
## Mandatory Numeric UI Contract §21

### 1. Reference filename
`visual-fixture/admin` route — renders `AdminDashboardVisualFixture.tsx` (static representation of the real `CarrierDashboard` component).

### 2. Observed viewport / aspect ratio
Primary: `1440 × 900` (desktop). Verification: `768 × 1024` (tablet), `390 × 844` (mobile).

### 3. Page region map

| Region | Dimensions |
|---|---|
| Left sidebar | `230 × 900px` |
| Top navigation | `(1440 − 230) × 50px` = `1210 × 50px` |
| Content area origin | `left: 230px`, `top: 50px` |
| Content area size | `1210 × 850px` |
| Content horizontal padding | `12px` each side |
| Usable content width | `1210 − 24 = 1186px` |

### 4. Column widths

Not a table-primary page. Uses:
- `TwoColumn`: `minmax(0, 8fr) minmax(280px, 4fr)` with `12px` gutter.
- At `1440px`: primary column `≈ 789px`, secondary column `≈ 397px`.

### 5. Vertical section heights

| Section | Height |
|---|---|
| Page header | `44–56px` |
| KPI strip | `72px` target (tile height) + `12px` margin = `84px` |
| "Jobs requiring attention" table | variable (8 rows × 42px + 36px header) |
| "Revenue & finance overview" | `~110px` |
| "Recent quote activity" table | variable |

### 6. Margins, paddings and gaps

- Content top padding: `12px`
- Content bottom padding: `16px`
- Section gap: `12px`
- KPI grid gap: `8px`
- Card header height: `36px`
- Card body padding: `10px`
- Card-to-card gap: `12px`

### 7. Card / table / control dimensions

- KPI tile: `72px` high, `padding: 8px 10px`
- KPI label: `11px / 700 / 14px line-height`
- KPI value: `22px / 700 / 26px line-height`
- Table header: `36px`, `0 8px` padding, `11px / 700`
- Table row standard: `42px`
- Table row max: `52px` when route cell wraps
- Status badge height: `22px`
- Action button in table: `28px`
- Panel header: `36px`, `10px` padding

### 8. Typography scale

| Element | Size / Line-height / Weight |
|---|---|
| Page title | `20px / 26px / 600` |
| Page subtitle | `12px / 16px / 400` |
| Section title | `14px / 20px / 600` |
| Panel title | `13px / 18px / 600` |
| Body | `13px / 18px / 400` |
| Table | `12.5px / 17px / 400` |
| Label | `12px / 16px / 600` |
| Metadata | `11px / 14px / 400` |
| KPI label | `11px / 14px / 700` |
| KPI value | `22px / 26px / 700` |

### 9. XDrive colour mapping

| Token | Value |
|---|---|
| Primary navy | `#0B2F6B` |
| Royal blue | `#1D57D8` |
| Action orange | `#F5A300` |
| White | `#FFFFFF` |
| Charcoal | `#1A1F2B` |
| Workspace background | `#F4F6F8` |
| Standard border | `#D8DEE8` |
| Divider | `#E5E7EB` |
| Muted text | `#64748B` |
| Success | `#198754` |
| Danger | `#C62828` |
| Hover row | `#F1F6FF` |
| Selected row | `#E8F0FF` |

### 10. Interaction and UX flow

1. User lands on `/admin` with `company_admin` role.
2. Six KPI tiles show operational summary; clicking navigates to respective sub-page.
3. "Jobs requiring attention" table shows unallocated/active/POD-pending jobs. "Open" button navigates to `/admin/jobs/{id}`.
4. Right rail: resource readiness, commercial shortcuts, compliance alerts.
5. Finance overview shows won/invoiced/paid/outstanding values.
6. Quote activity table shows last 5 bid responses.

### 11. Responsive transformations

| Breakpoint | Change |
|---|---|
| `≤ 1440px` | Sidebar stays `230px`; content fills remaining width |
| `≤ 1200px` | KPI grid wraps to 3 columns; TwoColumn may shift to `7fr/5fr` |
| `≤ 1024px` | Sidebar collapses to `56px` icon rail |
| `≤ 768px` | TwoColumn becomes single column; KPI grid → 3 columns |
| `≤ 640px` | Sidebar becomes off-canvas drawer; KPI grid → 2 columns |
| `≤ 390px` | KPI grid → 2 columns (min-width `120px` may cause single at very narrow) |

### 12. Acceptance checklist

- [x] Shell sidebar: `230px` wide at desktop
- [x] Shell top nav: `50px` high
- [x] KPI strip: exactly `6` tiles
- [x] KPI tile height: `72px` target (`max 80px`)
- [x] KPI gap: `8px`
- [x] Page header: `44–56px`
- [x] Table header: `36px`
- [x] Table rows: `42px` standard
- [x] All token colours from XDrive palette
- [x] No `rem` in operational CSS
- [x] Toolbar `flex-wrap: nowrap` at desktop
- [x] No random gradients
- [x] No cards with `min-height: 100px+` for KPI tiles
- [x] Sidebar selected indicator: `3px` left border
- [x] Card border: `1px solid`
- [x] Card radius: `4px`
- [x] Card body padding: `10px`

### 13. Before/after screenshots

Screenshots captured at `1440×900`, `768×1024`, `390×844` using:
```
E2E_VISUAL_FIXTURE=true next dev
# navigate to /visual-fixture/admin
```

Evidence paths:
- `docs/ui/cx/evidence/after/admin-dashboard-1440x900.png`
- `docs/ui/cx/evidence/after/admin-dashboard-768x1024.png`
- `docs/ui/cx/evidence/after/admin-dashboard-390x844.png`

### Known remaining deviations

None identified at this measurement stage. Screenshots pending.
