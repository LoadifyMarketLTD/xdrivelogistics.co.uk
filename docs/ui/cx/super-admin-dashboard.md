# Super-Admin Dashboard — Measurement Document
## Mandatory Numeric UI Contract §21

### 1. Reference filename
`visual-fixture/super-admin` route — renders `SuperAdminDashboardVisualFixture.tsx` (static representation of the real `SuperAdminDashboardPage` component).

### 2. Observed viewport / aspect ratio
Primary: `1440 × 900`. Verification: `768 × 1024`, `390 × 844`.

### 3. Page region map

| Region | Dimensions |
|---|---|
| Left sidebar | `230 × 900px` |
| Top navigation | `1210 × 50px` |
| Content area origin | `left: 230px`, `top: 50px` |
| Usable content width | `1186px` |

### 4. Column widths

- Company register table: `100%` of primary column.
- `TwoColumn`: `minmax(0, 8fr) minmax(280px, 4fr)`.

### 5. Vertical section heights

| Section | Height |
|---|---|
| Page header | `44–56px` |
| KPI strip | `72px` tile + `12px` margin |
| Company register table | `36px` header + rows × `42px` |

### 6. Margins, paddings and gaps

Same as admin-dashboard.md.

### 7. Card / table / control dimensions

Same as admin-dashboard.md.

### 8. Typography scale

Same as admin-dashboard.md.

### 9. XDrive colour mapping

Same palette as admin-dashboard.md.

### 10. Interaction and UX flow

1. User lands on `/super-admin`.
2. KPI strip (6 tiles): total companies, active companies, pending approval, open jobs, delivered jobs, unpaid invoices.
3. Company register table shows all companies with type, status, jobs count, users, "Open" action.
4. Right rail: platform financial metrics, pending approvals, live platform activity feed.
5. Approvals panel fast-links to approval review; activity feed shows last 5 events.

### 11. Responsive transformations

| Breakpoint | Change |
|---|---|
| `≤ 1024px` | Sidebar collapses to `56px` |
| `≤ 768px` | TwoColumn → single column; KPI → 3 columns |
| `≤ 640px` | Sidebar off-canvas; KPI → 2 columns |

### 12. Acceptance checklist

- [x] KPI strip: exactly `6` tiles (already compliant in real route)
- [x] KPI tile height: `72px` target
- [x] All XDrive palette tokens
- [x] Page header `44–56px`
- [x] Table rows `42px`
- [x] Card body padding `10px`
- [x] Distinct super-admin composition (not a copy of admin/carrier dashboard)

### 13. Before/after screenshots

Evidence paths:
- `docs/ui/cx/evidence/after/super-admin-dashboard-1440x900.png`
- `docs/ui/cx/evidence/after/super-admin-dashboard-768x1024.png`
- `docs/ui/cx/evidence/after/super-admin-dashboard-390x844.png`

### Known remaining deviations

None identified at this measurement stage. Screenshots pending.
