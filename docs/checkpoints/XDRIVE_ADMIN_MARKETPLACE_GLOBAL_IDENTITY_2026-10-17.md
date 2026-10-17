# XDrive — Admin Marketplace Global Identity
Date: 2026-10-17

## Baseline
Final XDrive white-workspace visual baseline for Loads / Quotes / Diary:
https://www.xdrivelogistics.co.uk/admin/marketplace

Measured at 1680x900:
- page content left: 12 px
- page content width: 1656 px
- filter rail: 165 px
- rail-to-main gap: 10 px
- main content: 1481 px
- filter controls: 27 px
- results toolbar: 32 px
- secondary tabs: 29 px
- record list gap: 8 px
- populated Loads card: 134 px

## Implementation
A shared final-cascade stylesheet is used:
app/components/workspace/admin-marketplace-identity.css

It is imported last by:
- app/admin/layout.tsx
- app/customer/layout.tsx
- app/broker/layout.tsx
- app/driver/layout.tsx

The identity marker is applied to the allowed Loads / Quotes / Diary implementations for:
- Customer
- Broker
- Operations/Admin
- Fleet Manager
- Owner Driver
- Carrier Admin / Company Admin
- Company Driver

Role-specific data, filters, actions, compliance banners and access rights remain role-specific.

Super Admin is excluded.

## Verification
Pre-push verification:
- git diff --check: PASS
- Admin Marketplace global identity contract: PASS
- Shared Loads / Quotes / Diary renderer contract: PASS
- Loads / Quotes / Diary visual identity contract: PASS
- Seven operational workspace shell contract: PASS
- Loads / Quotes dense workspace contract: PASS
- Diary dense booking card contract: PASS
- Total focused contract tests: 35/35 PASS
- Local E2E: 7/7 PASS after identity application
- E2E runtime assertions include:
  - identity marker present
  - display flex
  - gap 10 px
  - left edge 12 px
  - total width 1656 px
  - rail width 165 px
  - main width 1481 px
  - filter control height 27 px where present
- production build: PASS, exit code 0

## Access model
Operations/Dispatcher and Fleet Manager keep their existing capability restrictions. Visual identity is global only for pages the role is allowed to access. Rights are not broadened to manufacture visual parity.

## Rule
Do not add role-specific CSS that overrides the shared Loads / Quotes / Diary identity. Any future visual adjustment to these pages must be made against Admin Marketplace and propagated through the common identity layer.
