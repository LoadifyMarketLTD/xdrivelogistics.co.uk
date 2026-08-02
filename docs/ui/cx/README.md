# CX UI/UX Reference Implementation (XDrive)

Status: Mandatory implementation baseline.

## Scope
- Screenshots source: `/public/reference/courier-exchange`
- Applies to: admin, broker, customer, driver, super-admin operational surfaces.
- Excludes: third-party branding/assets.

## Operational layout baseline
- Reference viewport: 1920x1080
- App padding: 12px
- Section gap: 16px
- Grid gap: 12px
- Card gap: 10px
- Sidebar width: 230px (desktop fixed)
- Top navigation: 50px
- Toolbar controls: 32px height
- Search panel: 230px

## Typography baseline
- Primary: Segoe UI, Arial, sans-serif
- Page title: 28/600
- Section title: 16/600
- Card header: 14/600
- Label: 12/600
- Body: 13/400
- Metadata: 11/400
- Line height: 1.35

## Color baseline (XDrive)
- Navy `#0B2F6B`
- Blue `#1D57D8`
- Background `#F5F7FA`
- Card `#FFFFFF`
- Border `#D9E2EC`
- Divider `#E5EAF0`
- Hover `#F2F8FF`
- Success `#35A853`
- Warning `#F5A300`
- Danger `#D93025`
- Primary text `#202124`
- Secondary text `#5F6368`
- Muted text `#70757A`

## Component sizing baseline
- Button: 32px height, 8px 14px padding, radius 4px
- Input/select: 32px height, 8px inner padding, radius 4px
- Card: 12px inner padding, radius 4px, border-first, minimal shadow
- Table header: 40px
- Table rows: 40–44px

## Accessibility baseline
- Keyboard reachable controls
- Visible focus states
- WCAG AA contrast
- ARIA labels for icon-only controls
- Logical tab order

## Acceptance gate (required per PR)
1. Screenshot diff included
2. Spacing + typography validation included
3. Component-state comparison included
4. Accessibility checks included
5. Responsive checks (desktop/laptop/tablet/mobile) included

See also:
- `docs/ui/cx/screen-inventory.md`
- `docs/ui/cx/implementation-checklist.md`
- `docs/ui/cx/jobs.md`
- `docs/ui/cx/dashboard-home-surfaces.md`
