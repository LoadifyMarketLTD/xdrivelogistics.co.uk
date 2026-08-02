# CX Implementation Checklist (Mandatory)

## 1) Shell and grid
- [ ] Sidebar fixed 230px desktop
- [ ] Top navigation 50px height
- [ ] App frame padding 12px
- [ ] Section gap 16px
- [ ] Grid gap 12px
- [ ] No oversized whitespace

## 2) Typography
- [ ] Segoe UI / Arial stack active
- [ ] Title 28/600
- [ ] Section title 16/600
- [ ] Labels 12/600
- [ ] Body 13/400
- [ ] Metadata 11/400

## 3) Components
- [ ] Buttons 32px / radius 4
- [ ] Inputs 32px / radius 4
- [ ] Cards border-first / radius 4 / minimal shadow
- [ ] Tables header 40px / rows 40–44px
- [ ] Hover states use light blue hierarchy

## 4) UX workflow
- [ ] Primary CTA always visible
- [ ] Search/filter always accessible
- [ ] Important data never hidden behind extra navigation
- [ ] Core actions reachable in <=2 clicks

## 5) Accessibility
- [ ] Keyboard-first navigation verified
- [ ] Focus visible on all actionable elements
- [ ] WCAG AA contrast for text and controls
- [ ] ARIA labels for icon-only controls
- [ ] Semantic headings and landmarks present

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
