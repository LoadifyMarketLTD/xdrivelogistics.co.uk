# Fleet Driver Workspace audit

Branch: `feature/unified-dashboard-settings-design-system`
PR: #270
Scope: Fleet Driver only (`workspaceRole === driver`).

## Existing pages

- `/driver` — shared driver entry point; currently contains a compact dashboard for Fleet Driver and delegates Owner Driver to `OwnerDriverWorkspaceView`.
- `/driver/jobs` — personal assigned jobs.
- `/driver/jobs/[id]` — personal job execution, persisted lifecycle transitions, status history, collection/delivery photos, signature and POD.
- `/driver/history` — personal job history/diary.
- `/driver/availability` — personal availability, profile radius/persona and availability slots.
- `/driver/vehicles` — assigned personal vehicle.
- `/driver/documents` — personal driver/vehicle document flows.
- `/driver/messages` — driver messages/notifications surface.
- `/driver/profile` — personal account.

Owner Driver-only pages (`/driver/loads`, `/driver/quotes`, `/driver/won-work`, `/driver/returns`, `/driver/finance`) are explicitly guarded and must not be exposed to Fleet Driver.

## Reusable shared components

`app/components/workspace/WorkspaceUI.tsx` already provides:

- `PageFrame`
- `PageHeader`
- `ActionButton`
- `KpiGrid`
- `KpiCard`
- `Panel`
- `TwoColumn`
- `StatusBadge`
- `EmptyState`
- `DataTable`
- `AlertBanner`
- `QuickActions`
- `ProgressSteps`

No new design-system primitives are required.

## Existing workspace hook and persisted sources

`useCompanyWorkspaceData` already supplies company-scoped:

- jobs created by or awarded to the resolved company;
- job bids;
- invoices;
- drivers;
- vehicles;
- driver documents;
- vehicle documents;
- driver locations.

Fleet Driver must further restrict all driver-sensitive records to `user.driverId` / the matching `drivers.user_id` personal record.

## Existing tracking, lifecycle and POD

`/driver/jobs/[id]` already:

- requires the assigned personal driver ID;
- queries the job using `assigned_driver_id`;
- restores persisted `status_history`;
- executes lifecycle transitions through the existing transition flow/RPC;
- captures delivery photos and signature;
- uses signed storage URLs and sanitises displayed photo URLs.

The dashboard must link to this route rather than duplicate execution, tracking or POD logic.

## Existing notifications and activity

- `notification_events` is the existing persisted notification source.
- `job_tracking_events` is the existing persisted lifecycle/activity source.
- `/driver/messages` is the existing driver-facing message route.

The dashboard may read scoped persisted events for summary/activity but must not introduce a second notification system.

## Existing finance boundary

`/driver/finance` requires `owner_driver` plus `invoices.carrier.manage`.
The Fleet Driver role has no invoice capability. No finance KPI, amount, invoice link or payment control belongs on the Fleet Driver dashboard.

## Route and capability guards

- `ProtectedRoute` delegates to the central role/capability route matrix.
- `/driver/jobs` requires `jobs.execute`.
- `/driver/history` requires `jobs.view`.
- `/driver/documents` requires `documents.own.manage`.
- `/driver/availability`, `/driver/vehicles`, `/driver/messages`, `/driver/profile` allow driver and owner-driver roles.
- Fleet Driver capabilities are `jobs.view`, `jobs.execute`, `jobs.track`, and `documents.own.manage`.

## Genuine implementation gap

Only the Fleet Driver dashboard is below the unified enterprise standard. Missing dashboard-level presentation:

- real personal KPI row;
- actionable attention queue;
- strict separation of allocated, accepted/active and completed work;
- personal driver and vehicle readiness;
- current lifecycle progress and real ETA state;
- persisted tracking signal and status history summary;
- POD/document attention without exposing storage paths;
- persisted notifications and recent activity timestamps;
- existing-route quick actions;
- responsive enterprise layout.

Implementation will reuse the shared design system, `useCompanyWorkspaceData`, existing driver routes, lifecycle/POD route, route guards and capability boundaries. No API, schema, migration, RLS or production changes are required.