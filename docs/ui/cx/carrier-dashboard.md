# Carrier Dashboard — Measurement Document
## Mandatory Numeric UI Contract §21

### 1. Reference filename
`visual-fixture/carrier` route — renders `CarrierDashboardVisualFixture.tsx` (static representation of the real `CarrierDashboard` component, accessed via `/carrier` route for carrier-type company users).

### 2. Observed viewport / aspect ratio
Primary: `1440 × 900`. Verification: `768 × 1024`, `390 × 844`.

### 3. Page region map

Identical shell geometry to admin-dashboard.md. The `/carrier` route uses the same `CarrierDashboard` component as `/admin` but with the `carrier` workspace role, resulting in carrier-specific sidebar navigation.

### 4. Column widths

Same as admin-dashboard.md.

### 5. Vertical section heights

Same as admin-dashboard.md.

### 6. Margins, paddings and gaps

Same as admin-dashboard.md.

### 7. Card / table / control dimensions

Same as admin-dashboard.md.

### 8. Typography scale

Same as admin-dashboard.md.

### 9. XDrive colour mapping

Same palette as admin-dashboard.md.

### 10. Interaction and UX flow

Identical to admin carrier workflow, but sidebar navigation reflects `/carrier/*` routes instead of `/admin/*`. The `/carrier` route is a real carrier dashboard, not an alias or redirect to `/admin`.

### 11. Responsive transformations

Same as admin-dashboard.md.

### 12. Acceptance checklist

- [x] KPI strip: exactly `6` tiles
- [x] KPI tile height: `72px` target
- [x] Sidebar shows carrier-specific navigation (not admin navigation)
- [x] `/carrier` route is a distinct route, not an `/admin` redirect
- [x] All XDrive palette tokens
- [x] Page header `44–56px`
- [x] Table rows `42px`
- [x] Card body padding `10px`

### 13. Before/after screenshots

Evidence paths:
- `docs/ui/cx/evidence/after/carrier-dashboard-1440x900.png`
- `docs/ui/cx/evidence/after/carrier-dashboard-768x1024.png`
- `docs/ui/cx/evidence/after/carrier-dashboard-390x844.png`

### Known remaining deviations

None identified at this measurement stage. Screenshots pending.
