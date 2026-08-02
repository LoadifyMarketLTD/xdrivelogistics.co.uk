# Jobs Operational Page — CX Reference Measurement Document

**Status:** Implementation in progress — PR #338
**Reference file:** `public/reference/courier-exchange/Screenshot 2026-05-28 204652.png` (CX Diary / jobs list view)
**Implementation target:** `app/admin/jobs/page.tsx`, `app/components/workspace/JobsOperationalTable.tsx`

---

## 1. Reference Screenshot Analysis

### Screenshot: CX Diary page (204652.png)
**Observed viewport:** 1920 × 1080

#### Page region map (pixel estimates from reference)

| Region | Left | Top | Width | Height | Notes |
|---|---|---|---|---|---|
| Left icon nav | 0 | 0 | 50 | 1080 | Icon-only vertical nav |
| Top navigation bar | 50 | 0 | 1870 | 50 | Tabs + action buttons |
| Left search panel | 50 | 50 | 200 | 990 | Diary search panel |
| Main content area | 250 | 50 | 1620 | 950 | Table/list + toolbar |
| Bottom ticker bar | 0 | 1040 | 1920 | 40 | Activity/status ticker |

#### Left search panel anatomy (CX Diary)
- Width: ~200px (CX); XDrive spec: 232px
- Background: white
- Border: 1px solid (light grey ~#d0d7e0)
- Padding: 8px 10px
- Section header "Contacts": grey, ~12px/600
- "Payment Report" button: full width, ~28px high, grey background
- Radio group (All / Jobs Sub-contracted / Our Bookings): 12px, 20px row height
- Date "Anytime" select: ~28px, full width
- "Pickup Time Within" label (11px/600) + "Any" select (28px)
- "Delivery Time Within" label + select
- "Load ID / Ref" label + text input with × clear (28px)
- "Member / Driver" label + text input with × clear
- "Booked by" label + select
- "Customer Name" label + text input with × clear
- Groups section
- "Save as Default" checkbox row (~24px)
- **Search** button: ~28–30px, full width, green (#35a853 equivalent)
- **Clear** button: ~28px, full width, white/secondary

#### Main content — Diary/Jobs list anatomy
- Tabs row: All, Unallocated, Allocated, In Progress, Completed, Cancelled, Expired, Awaiting Feedback, Recent Feedback
  - Tab bar height: ~36px
  - Active tab: blue underline 2px, font weight 600
  - Font: ~12px/600
  - Horizontal padding per tab: ~10–12px
- Toolbar above items: "Diary at 20:46 BST", List View/Split View radio, Items per Page select, Collapse All/Refresh
  - Height: ~40px (single row)
  - Control height: ~28px
- Job record cards (each):
  - Card border: 1px solid light grey
  - Card background: white (selected: light blue tint)
  - Overall card height: variable (collapsed ~80–90px, expanded much taller)
  - For our operational TABLE target, row height per contract: **42px standard, 52px maximum**
  - Top row: From/To/Pickup/Deliver/Status cols
  - Status chip top-right: ~20–22px height, coloured label
  - Action buttons bottom: ~28px height, left-aligned within card

---

## 2. XDrive Implementation Mapping

### Numeric contract values (Section 10 of mandatory directive)

| Column | Width |
|---|---|
| Status / Priority | 92px |
| Job / Reference | 110px |
| Route (origin → dest) | `minmax(260px, 1.6fr)` |
| Pickup date/time | 150px |
| Delivery date/time | 150px |
| Vehicle type | 110px |
| Customer / Company | 150px |
| Price / Quote | 96px |
| Actions | 92px |

**Row target height:** 42px standard; 52px hard maximum when route cell wraps.
**Route cell internal gap:** 2px between lines.

### Page header (Section 4)
| Property | Value |
|---|---|
| Title font | 20px / 26px line-height / weight 600 |
| Subtitle font | 12px / 16px line-height / weight 400 |
| Title–subtitle gap | 2px |
| Header bottom margin | 8px |
| Primary action height | 32px |
| Action horizontal padding | 12px |

### KPI strip (Section 8)
| Property | Value |
|---|---|
| Tile height target | 72px |
| Tile height maximum | 80px |
| Tile padding | 8px 10px |
| Strip gap | 8px |
| Label font | 11px / 14px / weight 600 |
| Value font | 22px / 26px / weight 700 |
| Accent bar | 3px left border |
| Max tiles visible | 6 |
| Desktop grid | `repeat(auto-fit, minmax(120px, 1fr))` |

### Operational toolbar (Section 5)
| Property | Value |
|---|---|
| Toolbar height | 40px (single row) |
| Horizontal padding | 8px |
| Vertical padding | 4px |
| Control gap | 8px |
| Border | 1px solid #D8DEE8 |
| Radius | 4px |
| Bottom margin | 8px |
| Search input width | 220px |
| Status filter select | 140px |
| Date filter width | 132px |

### Status tabs (Section 12)
| Property | Value |
|---|---|
| Tab bar height | 36px |
| Tab horizontal padding | 12px |
| Font | 12px / weight 600 |
| Active underline | 2px |
| Tab gap | 0px |

### Table (Section 9)
| Property | Value |
|---|---|
| Header height | 36px |
| Header padding | 0 8px |
| Header font | 11px / 700 / uppercase optional |
| Row height (standard) | 42px |
| Row height (max) | 48px |
| Cell vertical padding | 6px |
| Cell horizontal padding | 8px |
| Primary cell text | 12.5px / 17px |
| Metadata text | 11px / 14px |
| Status badge height | 22px |
| Action button height | 28px |
| Row action gap | 4px |

### Pagination (Section 9)
| Property | Value |
|---|---|
| Bar height | 36px |
| Page button | 28 × 28px |
| Button gap | 4px |

---

## 3. XDrive Colour Mapping (Section 15)

| CX semantic | XDrive token | Hex |
|---|---|---|
| Primary background | workspace background | `#F4F6F8` |
| Card background | white | `#FFFFFF` |
| Border | standard border | `#D8DEE8` |
| Divider | divider | `#E5E7EB` |
| Body text | charcoal | `#1A1F2B` |
| Muted text | muted | `#64748B` |
| Primary blue | royal blue | `#1D57D8` |
| Success | success | `#198754` |
| Warning | warning text | `#B76E00` |
| Danger | danger | `#C62828` |
| Hover row | hover row | `#F1F6FF` |
| Selected row | selected row | `#E8F0FF` |
| Orange CTA | action orange | `#F5A300` |

---

## 4. Responsive Transformation

| Breakpoint | Behaviour |
|---|---|
| 1440px | Full 9-column table, all columns visible |
| 1200px | Price/Quote column hidden; Route narrows to minmax(200px,1fr) |
| 1024px | Compact shell; Vehicle column hidden; horizontal scroll if needed |
| 768px | Single-column layout; table scrolls horizontally inside wrapper |
| 390px | Mobile: table replaced by stacked job cards (112–132px each) |

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
- [ ] All 9 columns match widths in Section 10
- [ ] KPI tiles are 72px height, not oversized cards
- [ ] Page title is 20px/600, not 2rem/700
- [ ] No marketing max-width centering container
- [ ] Background is #F4F6F8, not white
- [ ] Screenshots taken at 1440×900, 768×1024, 390×844
- [ ] Remaining deviations documented numerically

---

## 7. Remaining Deviations (to be documented post-implementation)

*To be filled after first implementation pass.*
