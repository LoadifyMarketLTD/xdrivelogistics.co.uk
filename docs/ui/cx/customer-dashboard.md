# Customer Dashboard — Measurement Document
## Mandatory Numeric UI Contract §21

### 1. Reference filename
`visual-fixture/customer` route — renders `CustomerDashboardVisualFixture.tsx` (static representation of the real `CustomerDashboard` component).

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

- `TwoColumn`: `minmax(0, 8fr) minmax(280px, 4fr)`, `12px` gutter.

### 5. Vertical section heights

| Section | Height |
|---|---|
| Page header | `44–56px` |
| KPI strip | `72px` tile + `12px` margin |
| "Award decisions" table | `36px` header + rows × `42px` |
| "Active deliveries" + right rail | variable |

### 6. Margins, paddings and gaps

Same as admin-dashboard.md.

### 7. Card / table / control dimensions

Same as admin-dashboard.md.

### 8. Typography scale

Same as admin-dashboard.md.

### 9. XDrive colour mapping

Same palette as admin-dashboard.md.

### 10. Interaction and UX flow

1. User lands on `/customer`.
2. KPI strip (6 tiles): open loads, quotes received, awaiting award, active deliveries, delayed, POD ready.
3. "Awaiting award" panel prompts comparison and selection of carrier quotes.
4. `TwoColumn`: active deliveries table (left) + commercial summary / outstanding invoices / quick actions (right).
5. Commercial summary includes displaced tiles: draft loads, unpaid invoices count, invoices due soon.
6. Outstanding invoices panel shows amount and due date for each unpaid invoice.

### 11. Responsive transformations

| Breakpoint | Change |
|---|---|
| `≤ 1024px` | Sidebar collapses to `56px` |
| `≤ 768px` | TwoColumn → single column; KPI → 3 columns |
| `≤ 640px` | Sidebar off-canvas; KPI → 2 columns |

### 12. Acceptance checklist

- [x] KPI strip: exactly `6` tiles (reduced from `8`)
- [x] KPI tile height: `72px` target
- [x] Displaced tiles (draft loads, unpaid invoices) in Commercial summary panel
- [x] All XDrive palette tokens
- [x] Page header `44–56px`
- [x] Table rows `42px`
- [x] Card body padding `10px`

### 13. Before/after screenshots

Evidence paths:
- `docs/ui/cx/evidence/after/customer-dashboard-1440x900.png`
- `docs/ui/cx/evidence/after/customer-dashboard-768x1024.png`
- `docs/ui/cx/evidence/after/customer-dashboard-390x844.png`

### Known remaining deviations

None identified at this measurement stage. Screenshots pending.
