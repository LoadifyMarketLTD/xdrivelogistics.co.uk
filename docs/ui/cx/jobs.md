# Jobs Operational Page — CX Reference Measurement Document

**Status:** Implementation in progress — PR #338
**Reference files:**
- `public/reference/courier-exchange/Screenshot 2026-05-28 204652.png` — CX Diary / jobs list view (primary)
- `public/reference/courier-exchange/Screenshot 2026-05-28 204621.png` — CX Diary overview
- `public/reference/courier-exchange/Screenshot 2026-05-28 204639.png` — CX Diary record detail

**Implementation target:** `app/admin/jobs/page.tsx`, `app/components/workspace/JobsOperationalTable.tsx`

---

## Dimension classification key

Every numeric value in this document is classified as one of:

| Code | Meaning |
|---|---|
| `REFERENCE_OBSERVED` | Directly estimated from a named reference screenshot; filename, source image dimensions, measured pixel region, and scaling method documented |
| `XDRIVE_TARGET` | Deliberate XDrive implementation target; not claimed to be a CX pixel-perfect measurement |
| `EXISTING_CONTRACT` | An established repository value that must remain compatible |
| `RESPONSIVE_DERIVATION` | Calculated from one of the above with the derivation rule shown |

> **Important:** The numeric contract supplied in the owner directives comment on PR #338 represents an `XDRIVE_TARGET` baseline.
> It was not produced by pixel-perfect measurement of the CX screenshots and must not be described as such.

---

## 1. Reference Screenshot Analysis

### Primary reference: `Screenshot 2026-05-28 204652.png`

**Classification: REFERENCE_OBSERVED**
**Source image dimensions:** 1920 × 1080 (full HD screenshot, no scaling applied)
**Scaling method:** Direct pixel region estimation at 1:1 on a 96 dpi display

#### Page region map (estimated from reference at 1920 × 1080)

| Region | Left | Top | Width | Height | Classification | Notes |
|---|---|---|---|---|---|---|
| Left icon nav | 0 | 0 | ~50 | 1080 | REFERENCE_OBSERVED | Icon-only vertical nav strip |
| Top navigation bar | 50 | 0 | ~1870 | ~50 | REFERENCE_OBSERVED | Tabs + action buttons |
| Left search panel | 50 | 50 | ~200 | ~990 | REFERENCE_OBSERVED | Diary search panel |
| Main content area | ~250 | 50 | ~1620 | ~950 | REFERENCE_OBSERVED | Table/list + toolbar |
| Bottom ticker bar | 0 | ~1040 | 1920 | ~40 | REFERENCE_OBSERVED | Activity/status ticker |

> Pixel estimates carry ±5px uncertainty due to JPEG compression and visual estimation. They inform `XDRIVE_TARGET` values; they are not hard pixel measurements.

#### Left search panel anatomy (CX Diary reference observations)

| Element | Observed value | Classification |
|---|---|---|
| Panel width | ~200px | REFERENCE_OBSERVED |
| Background | white | REFERENCE_OBSERVED |
| Border | 1px solid ~#d0d7e0 | REFERENCE_OBSERVED |
| Padding | ~8px 10px | REFERENCE_OBSERVED |
| Section header font | ~12px/600 | REFERENCE_OBSERVED |
| Control height (selects/inputs) | ~28px | REFERENCE_OBSERVED |
| Search button height | ~28–30px | REFERENCE_OBSERVED |
| Radio row height | ~20px | REFERENCE_OBSERVED |
| Checkbox row height | ~24px | REFERENCE_OBSERVED |

#### Main content — Diary/Jobs list anatomy (CX reference observations)

| Element | Observed value | Classification |
|---|---|---|
| Tab bar height | ~36px | REFERENCE_OBSERVED |
| Active tab underline | ~2px | REFERENCE_OBSERVED |
| Tab font | ~12px/600 | REFERENCE_OBSERVED |
| Tab horizontal padding | ~10–12px | REFERENCE_OBSERVED |
| Toolbar height (single row) | ~40px | REFERENCE_OBSERVED |
| Toolbar control height | ~28px | REFERENCE_OBSERVED |
| Job card (collapsed) height | ~80–90px | REFERENCE_OBSERVED |
| Status chip height | ~20–22px | REFERENCE_OBSERVED |
| Action button height | ~28px | REFERENCE_OBSERVED |

---

## 2. XDrive Implementation Mapping

> All values below are `XDRIVE_TARGET` unless otherwise classified.
> They are selected to be consistent with the CX reference observations but are deliberate XDrive design decisions, not claimed pixel-perfect CX measurements.

### Shell geometry (contract already implemented and tested)

| Property | Value | Classification |
|---|---|---|
| Fixed left sidebar width | 230px | EXISTING_CONTRACT (set on branch, tested) |
| Top header height | 50px | EXISTING_CONTRACT (set on branch, tested) |
| Main content left edge | 230px | EXISTING_CONTRACT |
| Main content top edge | 50px | EXISTING_CONTRACT |

### Table column widths

| Column | Width | Classification |
|---|---|---|
| Status / Priority | 92px | XDRIVE_TARGET |
| Job / Reference | 110px | XDRIVE_TARGET |
| Route (origin → dest) | `minmax(260px, 1.6fr)` | XDRIVE_TARGET |
| Pickup date/time | 150px | XDRIVE_TARGET |
| Delivery date/time | 150px | XDRIVE_TARGET |
| Vehicle type | 110px | XDRIVE_TARGET |
| Customer / Company | 150px | XDRIVE_TARGET |
| Price / Quote | 96px | XDRIVE_TARGET |
| Actions | 92px | XDRIVE_TARGET |

**Row target height:** 42px standard — `XDRIVE_TARGET` (informed by REFERENCE_OBSERVED ~80–90px collapsed CX card, but this is a table row, not a card)
**Row hard maximum:** 52px when route cell wraps — `XDRIVE_TARGET`
**Route cell internal gap:** 2px between lines — `XDRIVE_TARGET`

### Content area padding/gap

| Property | Value | Classification |
|---|---|---|
| Main content horizontal padding | 12px | XDRIVE_TARGET |
| Main content top padding | 12px | XDRIVE_TARGET |
| Main content bottom padding | 16px | XDRIVE_TARGET |
| Primary section gap | 12px | XDRIVE_TARGET |
| Secondary/internal gap | 8px | XDRIVE_TARGET |
| Micro gap | 4px | XDRIVE_TARGET |

### Page header

| Property | Value | Classification |
|---|---|---|
| Title font | 20px / 26px line-height / weight 600 | XDRIVE_TARGET |
| Subtitle font | 12px / 16px line-height / weight 400 | XDRIVE_TARGET |
| Title–subtitle gap | 2px | XDRIVE_TARGET |
| Header bottom margin | 8px | XDRIVE_TARGET |
| Primary action height | 32px | XDRIVE_TARGET |
| Action horizontal padding | 12px | XDRIVE_TARGET |

### KPI strip

| Property | Value | Classification |
|---|---|---|
| Tile height target | 72px | XDRIVE_TARGET |
| Tile height maximum | 80px | XDRIVE_TARGET |
| Tile padding | 8px 10px | XDRIVE_TARGET |
| Strip gap | 8px | XDRIVE_TARGET |
| Label font | 11px / 14px / weight 600 | XDRIVE_TARGET |
| Value font | 22px / 26px / weight 700 | XDRIVE_TARGET |
| Accent bar | 3px left border | XDRIVE_TARGET |
| Max tiles visible | 6 | XDRIVE_TARGET |
| Desktop grid | `repeat(auto-fit, minmax(120px, 1fr))` | XDRIVE_TARGET |

### Operational toolbar

| Property | Value | Classification |
|---|---|---|
| Toolbar height | 40px (single row) | XDRIVE_TARGET (consistent with REFERENCE_OBSERVED ~40px) |
| Horizontal padding | 8px | XDRIVE_TARGET |
| Vertical padding | 4px | XDRIVE_TARGET |
| Control gap | 8px | XDRIVE_TARGET |
| Border | 1px solid #D8DEE8 | XDRIVE_TARGET |
| Radius | 4px | XDRIVE_TARGET |
| Bottom margin | 8px | XDRIVE_TARGET |
| Search input width | 220px | XDRIVE_TARGET |
| Status filter select | 140px | XDRIVE_TARGET |
| Date filter width | 132px | XDRIVE_TARGET |

### Status tabs

| Property | Value | Classification |
|---|---|---|
| Tab bar height | 36px | XDRIVE_TARGET (consistent with REFERENCE_OBSERVED ~36px) |
| Tab horizontal padding | 12px | XDRIVE_TARGET |
| Font | 12px / weight 600 | XDRIVE_TARGET (consistent with REFERENCE_OBSERVED ~12px/600) |
| Active underline | 2px | XDRIVE_TARGET (consistent with REFERENCE_OBSERVED ~2px) |
| Tab gap | 0px | XDRIVE_TARGET |

### Table dimensions

| Property | Value | Classification |
|---|---|---|
| Header height | 36px | XDRIVE_TARGET |
| Header padding | 0 8px | XDRIVE_TARGET |
| Header font | 11px / 700 / uppercase optional | XDRIVE_TARGET |
| Row height (standard) | 42px | XDRIVE_TARGET |
| Row height (max) | 48px | XDRIVE_TARGET |
| Cell vertical padding | 6px | XDRIVE_TARGET |
| Cell horizontal padding | 8px | XDRIVE_TARGET |
| Primary cell text | 12.5px / 17px | XDRIVE_TARGET |
| Metadata text | 11px / 14px | XDRIVE_TARGET |
| Status badge height | 22px | XDRIVE_TARGET (consistent with REFERENCE_OBSERVED ~20–22px) |
| Action button height | 28px | XDRIVE_TARGET (consistent with REFERENCE_OBSERVED ~28px) |
| Row action gap | 4px | XDRIVE_TARGET |

### Pagination

| Property | Value | Classification |
|---|---|---|
| Bar height | 36px | XDRIVE_TARGET |
| Page button | 28 × 28px | XDRIVE_TARGET |
| Button gap | 4px | XDRIVE_TARGET |

---

## 3. XDrive Colour Mapping

> All colour values are `XDRIVE_TARGET` — selected from the XDrive palette to approximate CX semantic roles; not claimed to be identical to CX hex values.

| Semantic role | XDrive token | Hex | Classification |
|---|---|---|---|
| Page background | workspace background | `#F4F6F8` | XDRIVE_TARGET |
| Card/panel background | white | `#FFFFFF` | XDRIVE_TARGET |
| Standard border | standard border | `#D8DEE8` | XDRIVE_TARGET |
| Divider | divider | `#E5E7EB` | XDRIVE_TARGET |
| Body text | charcoal | `#1A1F2B` | XDRIVE_TARGET |
| Muted text | muted | `#64748B` | XDRIVE_TARGET |
| Primary blue | royal blue | `#1D57D8` | XDRIVE_TARGET |
| Success | success | `#198754` | XDRIVE_TARGET |
| Warning text | warning | `#B76E00` | XDRIVE_TARGET |
| Danger | danger | `#C62828` | XDRIVE_TARGET |
| Row hover | hover row | `#F1F6FF` | XDRIVE_TARGET |
| Row selected | selected row | `#E8F0FF` | XDRIVE_TARGET |
| Primary CTA | action orange | `#F5A300` | XDRIVE_TARGET |

---

## 4. Responsive Transformation

| Breakpoint | Behaviour | Classification |
|---|---|---|
| 1440px | Full 9-column table, all columns visible | XDRIVE_TARGET |
| 1200px | Price/Quote column hidden; Route narrows to `minmax(200px,1fr)` | XDRIVE_TARGET |
| 1024px | Compact shell (56px sidebar); Vehicle column hidden; horizontal scroll if needed | RESPONSIVE_DERIVATION from shell breakpoint EXISTING_CONTRACT |
| 768px | Single-column layout; table scrolls horizontally inside wrapper; filters collapsible | XDRIVE_TARGET |
| 390px | Mobile: table replaced by stacked job cards (112–132px each) | XDRIVE_TARGET |

---

## 5. Interaction / UX Flow

1. User lands on Jobs page → sees KPI strip (All / Received / Posted / Allocated / Delivered)
2. Status tabs filter the table without page reload
3. Toolbar: free-text search (220px input) + status select (140px) + date filter (132px) + results count
4. Table rows: click row to navigate to job detail
5. "View" action in last column: navigate to job detail
6. "Invite" action: opens Direct Carrier Invitation modal (kept in existing page.tsx)
7. "+ New Job" header button: opens multi-step creation modal (kept in existing page.tsx)

---

## 6. Acceptance Checklist

- [ ] Table starts within 150px of application header bottom edge
- [ ] Toolbar + header consume ≤ 92px vertical before table
- [ ] 10–14 job rows visible at 1440×900 without scrolling (42px rows + 36px header = 504px for 12 rows)
- [ ] Row height 42px standard; no row exceeds 52px when route wraps
- [ ] All 9 columns match widths in section 2
- [ ] KPI tiles are 72px height, not oversized cards
- [ ] Page title is 20px/600, not 2rem/700
- [ ] No marketing max-width centering container
- [ ] Background is #F4F6F8, not white
- [ ] Screenshots taken at 1440×900, 768×1024, 390×844 (before/after)
- [ ] Remaining deviations documented numerically
- [ ] All dimension values correctly labelled as REFERENCE_OBSERVED vs XDRIVE_TARGET

---

## 7. Screenshots

*Before/after screenshots at 1440×900, 768×1024, and 390×844 to be captured after Jobs implementation pass is complete.*

---

## 8. Remaining Deviations

*To be filled after Jobs implementation pass — document any numerical gaps between XDRIVE_TARGET values and rendered output.*

---

## 9. Driver Filter & Restored Information Fields

### 9.1 Driver filter — canonical source

| Field | Classification | Notes |
|---|---|---|
| `jobs.assigned_driver_id` | `EXISTING_CONTRACT` | FK → `public.drivers(id)`, set by `assign_job_driver_atomic` RPC (migration 069). Null = unassigned. |
| Driver name | `XDRIVE_TARGET` | Resolved at render time from `drivers` table via `company_id` scoped query: `display_name`. |

**Implementation:** The parent (`app/admin/jobs/page.tsx`) loads company-scoped drivers (status = `active`) into state and passes them as `drivers: Array<{id, displayName}>` to `JobsOperationalTable`. A `<select>` control appears in the toolbar when at least one driver exists. Filtering applies `job.assignedDriverId === driverFilter` and resets pagination. The pure helper `filterJobsByDriver(jobs, driverFilter)` is exported and unit-tested independently.

**Blocker note:** Driver names are stored in `drivers.display_name`. There is no `driver_name` on the jobs row. If `assigned_driver_id` is present but the driver no longer exists in the loaded list, the component falls back to displaying the first 8 chars of the UUID with an ellipsis. This is defensive and does not fabricate data.

### 9.2 Restored information fields

The following fields were present in the pre-refactor Jobs presentation and have been restored as of this PR:

| Field | Restoration mechanism | Classification |
|---|---|---|
| Created date | Shown as a secondary line in the Ref column (below the job reference) | `XDRIVE_TARGET` |
| Cargo type + quantity | Shown as a secondary line in the Vehicle column | `XDRIVE_TARGET` |
| Client phone | Shown as a secondary line in the Customer column | `XDRIVE_TARGET` |
| Exchange visibility | Shown as a small label below the status badge (only when non-private) | `XDRIVE_TARGET` |
| Client email, payment terms, awarded carrier, cargo notes, load detail summary, assigned driver | Accessible via per-row expand toggle (▼) which opens an inline detail row | `XDRIVE_TARGET` |

**Intentional UX decision:** Full client email, payment terms, and load detail summary are placed in the expandable detail row rather than a main column to avoid making the table unreadable at 1060px. The information remains one click away and is visible without navigation to the job detail page.

### 9.3 `assigned_driver_id` in `DbJob` interface

`lib/types/database.ts` → `DbJob.assigned_driver_id: string | null` added to match the schema column defined in migration `017_complete_idempotent_setup.sql` and confirmed present in migrations `003`, `020`, and `069`.
