# Fleet Workspace refinement

## Scope

Fleet Workspace was audited against the existing company-scoped operational model. No schema, migration, RLS, API contract, lifecycle rule or allocation business rule was changed.

## Source-of-truth rules

- Driver readiness uses `drivers.status`, `drivers.availability_status`, active `jobs.assigned_driver_id`, and the existing company driver document records.
- Vehicle readiness uses `vehicles.assigned_driver_id` and existing company vehicle document status/expiry records. The UI calls this **allocation ready**, not generic availability, because the repository does not expose a separate persisted vehicle availability field through the shared workspace query.
- Awarded, Allocated, Active and Delivered are mutually presented from persisted `jobs.status`, `jobs.current_status` and `jobs.assigned_driver_id`.
- Tracking uses `driver_locations` and `job_tracking_events`; missing signals are stated explicitly.
- POD remains on existing secure signed-URL flows and raw private paths are not rendered.
- Finance remains on existing `/admin/invoices` routes and persisted invoice/payment status fields.

## Existing actions preserved

- Allocation continues through `/admin/diary?job=<id>`.
- Driver creation and account management remain in `/admin/drivers` and its existing authorised API/Supabase actions.
- Vehicle management remains in `/admin/vehicles`.
- Documents remain in `/admin/documents` and `/admin/documents/expiry`.
- Finance remains in `/admin/invoices`.
- Job details remain in `/admin/jobs?job=<id>`.

## Permission boundaries

The existing `WorkspaceShell`, route guards and capability filtering remain unchanged. Fleet views do not expose Customer quote award controls, Broker customer commercial controls, platform administration or another company's records.

## Routes refined

- `/admin/fleet`
- `/admin/fleet/assignments`
- `/admin/driver-availability`
- `/admin/fleet/maintenance`
- `/admin/fleet/active-jobs`

## Routes audited and intentionally preserved

- `/admin/drivers`
- `/admin/vehicles`
- `/admin/fleet/positions`
- `/admin/jobs`
- `/admin/diary`
- `/admin/documents`
- `/admin/documents/expiry`
- `/admin/incidents`
- `/admin/disputes`
- `/admin/invoices`
- `/admin/notifications`
- `/admin/settings`
