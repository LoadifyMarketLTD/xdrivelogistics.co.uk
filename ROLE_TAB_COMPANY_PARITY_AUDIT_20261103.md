# Company 3150 visual/workflow parity — 2026-11-03

## User-approved rule
Use the existing Company/Carrier 3150 boards as the source of truth for common sidebar tabs across role workspaces. Do not redraw. Do not grant Company admin/finance permissions to employed drivers. Preserve role-specific operations, authentication and RLS.

## Changes (branch feature/role-tab-company-parity-20261103)
- Company board identity and CSS reused for Customer, Broker, Fleet and Owner Driver; same existing `ops-demo` presentation and `company-layout-stability.css` (not rewritten).
- Customer: Company Quotes, Bookings, Network & Tools and Company Dashboard original components for corresponding existing tabs; role-specific Post Load, Tracking and Documents retained.
- Broker DEMO: Company Quotes, Bookings, Network & Tools and Dashboard for respective tabs, while Broker My Loads, Awards, Diary, POD Review and Post Load remain specialized.
- Authenticated /broker: original Broker workspace layout mirrored from improved DEMO source; `ProtectedRoute` retained and `Company3150LiveProvider` tenant-scoped data added. Real award / booking / post-load buttons use /broker/awards, /broker/jobs/:id and /broker/post-load, never demo API writes. Actual signed-in functionality NOT yet tested.
- Fleet: Company Dashboard, Quotes (sent-only, no award), Bookings, Network & Tools (restricted non-admin), My Fleet and Live Availability original boards; fleet-specific tools retained.
- Owner Driver: Company Quotes styling for sent-only, Bookings and Network & Tools without admin/API tabs; My Fleet, Drivers, Invoices, Return Journeys, Freight Vision, Messages, Reports remain recovered originals. Owner Driver workflow actions retained in Booking details.
- Driver and Company Driver: Company Quotes styling (sent-only and no award), Bookings and role-restricted operational Network & Tools; Alerts, driver route/POD tools and assignments remain role specific.
- Dispatcher: original Company Network & Tools board substituted for generic panel, with restricted admin tabs; Dispatch Board, Allocations, Diary, Messages and Reports retain role behavior.
- Employee Driver remains isolated role preview; no implicit company admin access.
- DemoCompanyDashboard has opt-in workspaceLabel and suppressPreview props. Defaults exactly preserve Company existing behavior. No automatic fake sample fallback for other role dashboards with no jobs.
- Original Company Quotes and Network & Tools accept opt-in role-aware props. Company default unchanged.
- Non-company Network & Tools hides API Access/Keys and Network Settings including quick actions, instead of exposing irrelevant Company administration.

## Security and verification
- No Supabase schema mutation; no credentials or API keys added.
- The public /try-xdrive-* routes are role visual previews, not authenticated production E2E. Authenticated Broker remains protected; write actions redirected to native Broker routes.
- Full TypeScript `--noEmit --incremental` PASS (Node 2 GB heap); ESLint on modified components/pages PASS; git diff --check PASS.
- Hosted visual + mobile E2E / pixel comparison / authenticated RLS and full real write workflows are still pending. Do not merge into main or call production ready until verified.

## Paths
Worktree: D:\XDrive-7-Workspaces-Boards-20261103
Original approved 3118 components: D:\XDrive-3118-Transfer-Complete-20261102\app\try-xdrive-demo\components
Previous PR #757: nine route previews and original board inventory.
