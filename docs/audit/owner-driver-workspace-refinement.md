# Owner Driver Workspace refinement

## Scope

This phase refines the existing `/driver` Owner Driver experience without changing schema, migrations, RLS, API contracts, lifecycle rules or production configuration.

## Routes audited

- `/driver`
- `/driver/loads`
- `/driver/quotes`
- `/driver/won-work`
- `/driver/jobs`
- `/driver/jobs/[id]`
- `/driver/history`
- `/driver/returns`
- `/driver/availability`
- `/driver/vehicles`
- `/driver/documents`
- `/driver/finance`
- `/driver/messages`
- `/driver/profile`

Only `/driver` was changed in this phase. Existing downstream routes, actions and secure document/POD flows were retained.

## Real KPI sources

- Quotes: `job_bids.company_id`, `job_bids.status`, `job_bids.created_at`
- Awarded work: accepted personal company bid plus `jobs.awarded_carrier_company_id`, with no personal driver allocation
- Allocated work: `jobs.assigned_driver_id` and persisted `jobs.status` / `jobs.current_status`
- Active work: persisted accepted-through-delivery lifecycle statuses
- Missing POD: delivered/completed job plus persisted `jobs.delivery_photos`
- Unpaid/overdue invoices: `invoices.company_id`, `invoices.status`, `invoices.payment_status`, `invoices.amount`, `invoices.due_date`, `invoices.job_id`

No available-load count is fabricated because the shared company workspace query is not the marketplace feed. Available Loads remains a direct quick action to the existing `/driver/loads` route.

## Personal readiness

Driver readiness uses:

- authenticated `user.driverId`, falling back to a matching `drivers.user_id` only when available;
- `drivers.status`;
- `drivers.availability_status`;
- active personal assignment from `jobs.assigned_driver_id`;
- `driver_documents.status`;
- `driver_documents.expiry_date`.

Vehicle readiness uses:

- vehicles assigned to the resolved personal driver through `vehicles.assigned_driver_id`;
- active personal job state;
- `vehicle_documents.status`;
- `vehicle_documents.expiry_date`.

A record is not treated as available merely because it exists. Missing document records are shown explicitly rather than silently treated as compliant.

## Lifecycle, tracking and POD

Lifecycle source:

- `jobs.status`
- `jobs.current_status`
- `jobs.pickup_datetime`
- `jobs.delivery_datetime`
- `jobs.updated_at`

Tracking and activity source:

- `driver_locations.driver_id`
- `driver_locations.lat`
- `driver_locations.lng`
- `driver_locations.recorded_at`
- `driver_locations.updated_at`
- `job_tracking_events.event_type`
- `job_tracking_events.message`
- `job_tracking_events.created_at`
- `notification_events.created_at`

POD source:

- persisted `jobs.delivery_photos`
- existing `/driver/jobs/[id]` secure POD and delivery workflow

No live position, status history or POD is simulated.

## Finance

The dashboard exposes existing carrier invoice records only and navigates to `/driver/finance`. It does not calculate estimated earnings, profit, driver pay or inferred amounts.

## Permissions and isolation

The phase retains:

- company scoping in `useCompanyWorkspaceData`;
- personal driver filtering for assigned jobs and documents;
- accepted owner-driver bid relationship for won work;
- existing route and capability guards;
- existing invoice, allocation, secure document and POD APIs;
- separation from Fleet, Customer, Broker, Admin and Super Admin controls.

No database or security-policy files were modified.
