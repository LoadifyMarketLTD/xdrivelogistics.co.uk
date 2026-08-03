# Broker Dashboard — Measurement Document
## Mandatory Numeric UI Contract §21

### 1. Reference filename
`visual-fixture/broker` route — renders `BrokerDashboardVisualFixture.tsx` (static representation of the real `BrokerDashboard` component).

### 2. Observed viewport / aspect ratio
Primary: `1440 × 900`. Verification: `768 × 1024`, `390 × 844`.

### 3. Page region map

| Region | Dimensions |
|---|---|
| Left sidebar | `230 × 900px` |
| Top navigation | `1210 × 50px` |
| Content area origin | `left: 230px`, `top: 50px` |
| Usable content width | `1186px` (after `12px` each side padding) |

### 4. Column widths

- `TwoColumn`: `minmax(0, 8fr) minmax(280px, 4fr)`, `12px` gutter.
- At `1440px`: primary `≈ 789px`, secondary `≈ 397px`.

### 5. Vertical section heights

| Section | Height |
|---|---|
| Page header | `44–56px` |
| KPI strip | `72px` tile + `12px` margin |
| "Award decisions needed" table | `36px` header + rows × `42px` |
| "Active jobs" + right rail | variable |

### 6. Margins, paddings and gaps

Same as admin-dashboard.md — shared shell and WorkspaceUI primitives apply.

### 7. Card / table / control dimensions

Same as admin-dashboard.md.

### 8. Typography scale

Same as admin-dashboard.md.

### 9. XDrive colour mapping

Same palette as admin-dashboard.md.

### 10. Interaction and UX flow

1. User lands on `/broker`.
2. KPI strip (6 tiles) shows open loads, quotes, awaiting award, active jobs, POD missing, gross margin.
3. "Award decisions needed" table surfaces loads with ready quotes — decision CTA.
4. `TwoColumn`: active jobs table (left) + commercial summary / recent loads / quick actions (right).
5. Commercial summary panel includes the displaced financial KPIs: draft loads, awaiting payment, due within 7 days, overdue invoices.
6. Quick actions link to post-load, compare quotes, disputes, carrier network, invoices, margins.

### 11. Responsive transformations

| Breakpoint | Change |
|---|---|
| `≤ 1024px` | Sidebar collapses to `56px` |
| `≤ 768px` | TwoColumn → single column; KPI → 3 columns |
| `≤ 640px` | Sidebar off-canvas; KPI → 2 columns |

### 12. Acceptance checklist

- [x] KPI strip: exactly `6` tiles (reduced from `10`)
- [x] KPI tile height: `72px` target
- [x] Displaced tiles (draft loads, awaiting payment, overdue) surfaced in Commercial summary panel
- [x] All XDrive palette tokens
- [x] Page header `44–56px`
- [x] Table rows `42px`
- [x] Card body padding `10px`
- [x] No decorative shadows

### 13. Before/after screenshots

Evidence paths:
- `docs/ui/cx/evidence/after/broker-dashboard-1440x900.png`
- `docs/ui/cx/evidence/after/broker-dashboard-768x1024.png`
- `docs/ui/cx/evidence/after/broker-dashboard-390x844.png`

### Known remaining deviations

None identified at this measurement stage. Screenshots pending.
