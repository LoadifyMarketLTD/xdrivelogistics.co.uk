# Multi-workspace implementation map

## Canonical entities reused
- `companies` remains the organisation entity.
- `company_memberships` remains the canonical membership source.
- No `organisations` / `organisation_members` duplicate tables were introduced.

## Workspace model decisions
- Added explicit, separate workspace model in `lib/businessWorkspace.ts`:
  - `BusinessWorkspace`: `owner_operator | shipper | broker | carrier_fleet`
  - `MembershipRole`: `owner | admin | dispatcher | finance | compliance | driver | member | viewer`
- Membership role and business workspace are resolved independently (`resolveBusinessWorkspaces`).

## Active company and switching
- Added active company preference helpers in `lib/activeCompany.ts`:
  - `setPreferredActiveCompanyId`
  - `getPreferredActiveCompanyId`
  - `resolvePreferredCompanyId`
- Resolution now validates preferred company IDs against active `company_memberships`.

## Shared shell updates
- `WorkspaceShell` now includes:
  - Active company selector (membership-backed).
  - Workspace selector (`BusinessWorkspace`-aware).
  - Unified search contract entry point (job/reference/address/vehicle registration query input).
  - Messages, notifications, Help Centre, and profile actions in the top bar.

## Current gap notes
- Existing server APIs and route guards were preserved; this change focuses on shared switching infrastructure and company selection safety.
- Wider per-endpoint active-company propagation and additional RLS policy hardening should be implemented incrementally endpoint-by-endpoint to avoid regressions.
