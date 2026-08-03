# CX Screenshot Inventory

All reference screenshots were measured from `/public/reference/courier-exchange`.

| # | File | Size |
|---:|---|---|
| 1 | Screenshot 2026-05-28 204621.png | 1920x1080 |
| 2 | Screenshot 2026-05-28 204639.png | 1920x1080 |
| 3 | Screenshot 2026-05-28 204652.png | 1920x1080 |
| 4 | Screenshot 2026-05-28 204700.png | 1920x1080 |
| 5 | Screenshot 2026-05-28 204707.png | 1920x1080 |
| 6 | Screenshot 2026-05-28 204715.png | 1920x1080 |
| 7 | Screenshot 2026-05-28 204726.png | 1920x1080 |
| 8 | Screenshot 2026-05-28 204749.png | 1920x1080 |
| 9 | Screenshot 2026-05-28 204757.png | 1920x1080 |
| 10 | Screenshot 2026-05-28 204833.png | 1920x1080 |
| 11 | Screenshot 2026-06-04 063434.png | 1920x1080 |
| 12 | Screenshot 2026-06-04 063451.png | 1920x1080 |
| 13 | Screenshot 2026-06-04 063515.png | 1920x1080 |
| 14 | Screenshot 2026-06-04 063533.png | 1920x1080 |
| 15 | Screenshot 2026-06-04 063617.png | 1920x1080 |
| 16 | Screenshot 2026-06-04 063706.png | 1920x1080 |
| 17 | Screenshot 2026-06-04 063730.png | 1920x1080 |
| 18 | Screenshot 2026-06-04 063807.png | 1920x1080 |
| 19 | Screenshot 2026-06-04 063820.png | 1920x1080 |
| 20 | Screenshot 2026-06-04 063834.png | 1920x1080 |
| 21 | Screenshot 2026-06-04 063844.png | 1920x1080 |

## Inspection checklist per screen
- Layout geometry: sidebar, top nav, toolbar, content panel ratios
- Information hierarchy: route, pickup/delivery, vehicle, company/reference, actions
- Density and spacing: 4px rhythm alignment
- Interactive states: hover, focus, disabled, active
- Table/card composition and scan speed
- Search/filter panel visibility and priority order
- Accessibility markers and keyboard navigability

---

## Phase 3 — Per-Route Screen Map

### `/admin/marketplace` — Marketplace / Load Exchange

- **Reference files**: refs 6–10 (Screenshot 2026-05-28 204715 through 204833)
- **XDrive route**: `/admin/marketplace`
- **Viewport**: 1920×1080
- **Geometry**:
  - Outer layout: `OperationalPageLayout` with `OperationalFilters` left panel (220px)
  - Filter panel width: 220px
  - Tab bar height: 40px, font 13px/600
  - Load cards: 4px radius, 1px solid #d9e2ec border, 8px 12px padding
  - Bid modal: 4px radius, 13px font, 32px inputs
- **Intentional XDrive differences**: XDrive uses #1d57d8 brand blue instead of CX green/orange accent; load card layout uses 3-col grid (route / details / actions)
- **Status**: ✅ Applied

---

### `/admin/quotes` — Quotes Management

- **Reference files**: ref 4 (Screenshot 2026-05-28 204700)
- **XDrive route**: `/admin/quotes`
- **Viewport**: 1920×1080
- **Geometry**:
  - Outer layout: `OperationalPageLayout` with `OperationalFilters` left panel (220px)
  - Tab bar: 40px height, 13px/600 font, #1d57d8 active indicator
  - Table header: 36px height, 11px/700/uppercase
  - Table rows: 40px height, 13px font, 0 12px padding
  - Status badges: 999px radius pill, 11px/700
  - Action buttons: 26px height, 4px radius
  - New Quote modal: 4px radius, 16px/600 title, 32px controls, 8px grid gap
- **Status**: ✅ Applied

---

### `/admin/vehicles` — Vehicle Management

- **Reference files**: ref 2 (Screenshot 2026-05-28 204639)
- **XDrive route**: `/admin/vehicles`
- **Viewport**: 1920×1080
- **Geometry**:
  - Outer layout: `PageFrame` + `PageHeader` (no filter panel — vehicles use full-width table)
  - Page title: 24px/600/30px line-height via `PageHeader`
  - Add Vehicle button: 32px height, 4px radius, #1d57d8
  - Table container: 4px radius, 1px solid #d9e2ec
  - Table header: 36px height, 11px/700/uppercase, #f5f7fa background
  - Table rows: 40px height, 0 12px padding, 13px font
  - Advertising state select: 4px radius, 12px font, semantic background colors
  - Action buttons: 26px height, 4px radius
  - Modals: 4px radius, 16px/600 title, 32px controls, 8px gap
- **Status**: ✅ Applied

---

### `/admin/drivers` — Driver Management

- **Reference files**: ref 1 (Screenshot 2026-05-28 204621)
- **XDrive route**: `/admin/drivers`
- **Viewport**: 1920×1080
- **Geometry**:
  - Outer layout: `OperationalPageLayout` with `OperationalFilters` sidebar (220px)
  - Sidebar: driver count stats (4px radius cards), Add Driver button (32px, 4px radius)
  - Tab bar: 40px height, 13px/600, #1d57d8 active underline
  - Driver rows: structured rows with 10px 12px padding, name 13px/600, meta 12px
  - Status badges: 999px radius pill, 11px/700
  - Action buttons: 26px height, 4px radius
  - Dark "Driver Operations Board" header removed (was dark #111827)
  - Add/Edit Driver modals: 4px radius, 16px/600 title, 32px controls, 8px gap
- **Intentional XDrive differences**: Driver rows use structured stacked layout (not a full table) to accommodate the password setup flow and status management inline
- **Status**: ✅ Applied

---

### Super-Admin Shell (`/super-admin/*`)

- **Reference files**: refs 11–21 (operational shell reference)
- **XDrive routes**: all `/super-admin/` routes
- **Geometry**:
  - Sidebar: 230px (was 254px), 50px logo header, 4px nav button radius
  - Background: #f5f7fa (was dark #0f172a)
  - Cards: #ffffff, 1px solid #d9e2ec, 4px radius
  - Table header: 36px, 11px/700/uppercase, #f5f7fa background
  - Table rows: 40px, 13px font
  - Section titles: 16px/600
  - SuperAdminLiveTablePage, SuperAdminModulePage, SuperAdminUserListPage: all rewritten
- **Status**: ✅ Applied
