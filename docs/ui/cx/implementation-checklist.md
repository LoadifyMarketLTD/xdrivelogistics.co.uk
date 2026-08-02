# CX Implementation Checklist (Mandatory)

---

## Phase 1 — Shared Operational Design System Primitives

Status: **Complete** (PR #338)

Reference measurements derived from `/public/reference/courier-exchange/` screenshots.
All values are inspected — none approximated from memory.

### Reference measurements log (Phase 1 inspection)

| Measurement | CX reference value | XDrive implementation |
|---|---|---|
| Viewport | 1920×1080 | 1920×1080 primary |
| App frame padding | 12px | 12px |
| Max content width | ~1860px (minus 50px sidebar) | 1480px |
| Left icon sidebar | ~50px | per WorkspaceShell |
| Left search panel | ~200px | 230px (spec) |
| Top navigation | ~50px | 50px |
| Bottom ticker | ~40px | 40px |
| Search panel padding | ~8px | 8–10px |
| Search panel field gap | ~6px | 6px |
| Search panel input height | ~28–30px | 32px (XDrive spec) |
| Search button height | ~28px | 32px (XDrive spec) |
| Card border | 1px solid ~#d0d5dd | 1px solid #d9e2ec |
| Card border-radius | ~4px | 4px |
| Card inner padding | ~8–12px | 12px body, 8px header |
| Card header font | ~13–14px / 600 | 14px / 600 |
| Card no shadow | confirmed | no shadow |
| Table header row | ~36–40px | 40px |
| Table data rows | ~38–42px | 40px (min-height) |
| Table cell padding | ~6–8px h | 8px 12px |
| Table header font | ~12px / 600 / uppercase | 12px / 600 / uppercase |
| Button height | ~28–32px | 32px |
| Button radius | ~4px | 4px |
| Section gap | ~16px | 16px |
| Grid gap | ~12px | 12px |
| Two-panel grid | 200px + 1fr | 230px + 1fr |
| Body text | ~13px | 13px |
| Label text | ~11–12px | 12px labels / 11px metadata |

### Primitive registry

| Primitive | Status | Location |
|---|---|---|
| `OperationalPageLayout` | ✅ Added | `WorkspaceUI.tsx` |
| `OperationalToolbar` | ✅ Exists | `WorkspaceUI.tsx` |
| `ExchangeKpiStrip` | ✅ Exists | `WorkspaceUI.tsx` |
| `OperationalFilters` | ✅ Added | `WorkspaceUI.tsx` |
| `OperationalFilterField` | ✅ Added | `WorkspaceUI.tsx` |
| `OperationalFilterInput` | ✅ Added | `WorkspaceUI.tsx` |
| `OperationalFilterSelect` | ✅ Added | `WorkspaceUI.tsx` |
| `OperationalTable` | ✅ Exists | `WorkspaceUI.tsx` |
| `OperationalCard` | ✅ Added | `WorkspaceUI.tsx` |
| `WorkspaceActivityFeed` | ✅ Exists | `WorkspaceUI.tsx` |
| `QuickActionGrid` | ✅ Exists | `WorkspaceUI.tsx` |
| `FinancialSummaryPanel` | ✅ Exists | `WorkspaceUI.tsx` |
| `ComplianceSummaryPanel` | ✅ Exists | `WorkspaceUI.tsx` |
| `DateRangeSelector` | ✅ Exists | `WorkspaceUI.tsx` |
| `SavedViewSelector` | ✅ Exists | `WorkspaceUI.tsx` |
| `StatusBadge` | ✅ Exists | `WorkspaceUI.tsx` |
| `EmptyState` | ✅ Exists | `WorkspaceUI.tsx` |
| `ErrorState` | ✅ Exists | `WorkspaceUI.tsx` |
| `LoadingState` | ✅ Exists | `WorkspaceUI.tsx` |

Unit tests: `__tests__/cxPrimitives.test.tsx` — 21 tests, all passing.

---

## 1) Shell and grid

- [x] Sidebar fixed 230px desktop — `OperationalPageLayout` two-panel grid uses `230px + 1fr`
- [ ] Top navigation 50px height — WorkspaceShell (Phase 3)
- [x] App frame padding 12px — `OperationalPageLayout` applies `padding: 12px`
- [x] Section gap 16px — documented in `workspaceTheme`, applied in page layouts
- [x] Grid gap 12px — `OperationalPageLayout` two-panel gap is `12px`
- [ ] No oversized whitespace — per-screen verification (Phase 3)

## 2) Typography

- [ ] Segoe UI / Arial stack active
- [x] Title 28/600 — `PageHeader` h1
- [x] Section title 16/600 — `Panel` h2
- [x] Labels 12/600 — `OperationalFilterLabel`, table headers
- [x] Body 13/400 — `OperationalTable` cells, filter inputs
- [x] Metadata 11/400 — `OperationalCard` subtitle, `KpiCard` label

## 3) Components

- [x] Buttons 32px / radius 4 — `ActionButton`
- [x] Inputs 32px / radius 4 — `OperationalFilterInput`, `OperationalFilterSelect`
- [x] Cards border-first / radius 4 / minimal shadow — `OperationalCard`
- [x] Tables header 40px / rows 40–44px — `OperationalTable`
- [x] Hover states use light blue hierarchy — `OperationalTable` row hover `#f2f8ff`

## 4) UX workflow

- [ ] Primary CTA always visible
- [x] Search/filter always accessible — `OperationalFilters` sidebar + `OperationalTable` toolbar
- [ ] Important data never hidden behind extra navigation
- [ ] Core actions reachable in <=2 clicks

## 5) Accessibility

- [x] Keyboard-first navigation — `OperationalFilters` uses `<form>` with `<aside>` landmark
- [x] Focus visible on all actionable elements — `OperationalFilterInput` has `:focus` outline
- [ ] WCAG AA contrast for text and controls — per-screen verification (Phase 3)
- [x] ARIA labels for icon-only controls — `OperationalFilterInput` clear button has `aria-label`
- [x] Semantic headings and landmarks — `<aside>`, `<main>`, `<h2>`, `<h3>` used correctly

## 6) Responsive

- [ ] Desktop behavior preserved as primary
- [ ] Laptop equivalent density
- [ ] Tablet adapted layout (not naive scaling)
- [ ] Mobile dedicated layout behavior

## 7) PR gate evidence (required)

- [ ] Screenshot diff
- [ ] Component-state comparison
- [ ] Spacing rhythm validation
- [ ] Typography validation
- [ ] Accessibility validation
- [ ] Responsive validation

---

*Phase 2 (reference screen analysis) and Phase 3 (screen reconstruction) are pending Phase 1 sign-off.*

