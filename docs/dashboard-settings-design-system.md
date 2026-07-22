# XDrive Unified Dashboard and Settings Design System

Priority: Highest

This branch and pull request are dedicated exclusively to dashboard and settings standardisation across XDrive Logistics.

## Official templates

### Dashboard Template

Applies to:

- Customer Workspace
- Broker Workspace
- Fleet Workspace
- Owner Driver Workspace
- Fleet Driver Workspace
- Admin Workspace
- Super Admin / Platform Owner Console

Required structure:

1. Compact page header with role and company context
2. Primary action area
3. KPI row using real backend data
4. Attention queue containing only actionable records
5. Operational table or workspace module cards
6. Quick actions linked to real routes
7. Recent activity using real event timestamps
8. Notifications with real unread state
9. Responsive mobile and desktop layouts
10. Shared status labels, badges and lifecycle formatting

### Settings Template

Applies to:

- Company settings
- User profile
- Members and permissions
- Driver profile
- Vehicle profile
- Documents and compliance
- Billing and finance settings
- Notifications
- Security
- Integrations
- Support and contact pages

Required structure:

1. Compact title and description
2. Secondary settings navigation on the left
3. Clear content panel on the right
4. Grouped form sections
5. Consistent labels, inputs, validation and save actions
6. Compact warning and error banners
7. No nested card clutter or decorative gradients
8. Reusable enterprise layout components

## Customer Workspace priority fixes

- Format raw statuses such as `posted` as human-readable labels
- Use real event timestamps in Recent Updates
- Reconcile Awarded and Active Delivery lifecycle metrics
- Ensure POD actions use the secure private document endpoint
- Link unpaid invoice metrics to the real filtered invoice register
- Replace static notification badges with real unread notifications
- Restrict the attention table to actionable loads only
- Add waiting time, incidents, cancellations, failed delivery and disputes
- Add visual transport progress
- Add live tracking and ETA where data exists
- Add warnings for loads approaching pickup without quotes

## Visual direction

The approved visual direction is the existing enterprise-style Settings screen:

- white application shell
- compact top navigation
- light grey page background
- restrained borders and shadows
- two-column settings layout
- clear typographic hierarchy
- XDrive navy, royal blue and orange accents
- dense enough for operational use without visual clutter

Courier Exchange may be used only as a reference for information density, load-board filtering and fast navigation. The implementation must retain XDrive identity and must not copy CX branding or UI directly.

## Scope restrictions

This PR must not include:

- canonical job lifecycle migrations from PR #247
- unrelated onboarding changes
- Android release engineering
- production database changes
- unrelated finance or notification backend rewrites

Backend changes are permitted only when required to make dashboard data real and correct.

## Release gates

- lint passes
- TypeScript passes
- production build passes
- public smoke tests pass
- all role dashboards render without runtime errors
- customer dashboard metrics are reconciled against source records
- settings pages use the shared template
- no direct production deployment or database migration without explicit approval
