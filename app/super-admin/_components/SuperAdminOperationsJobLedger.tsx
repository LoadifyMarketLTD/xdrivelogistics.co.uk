'use client';

import PlatformEntityLink from './control-plane/PlatformEntityLink';
import SuperAdminLiveTablePage, { type TableColumn } from './SuperAdminLiveTablePage';
import { StatusChip, formatDateTime, routeSummary } from './superAdminFormatters';

export type OperationsJobLedgerMode = 'all' | 'active' | 'pending' | 'completed' | 'allocations' | 'deliveries';

type Row = {
  id: string;
  status: string;
  company_id: string;
  posting_company_name: string;
  awarded_carrier_company_id: string | null;
  awarded_company_name: string | null;
  assigned_driver_id: string | null;
  assigned_driver_name: string | null;
  assigned_driver_company_id: string | null;
  assigned_driver_company_name: string | null;
  bids_count: number;
  created_at: string;
  pickup_location: string | null;
  pickup_postcode: string | null;
  delivery_location: string | null;
  delivery_postcode: string | null;
  pickup_datetime: string | null;
  delivery_datetime: string | null;
  pod_photos_count: number;
  pod_signature_present: boolean;
};
const modeCopy: Record<OperationsJobLedgerMode, { title: string; description: string; section: string; empty: string }> = {
  all: { title: 'All Jobs', description: 'Platform-wide jobs ledger with lifecycle, commercial parties and canonical inspection.', section: 'jobs', empty: 'No jobs found.' },
  active: { title: 'Active Jobs', description: 'Jobs currently in execution with assigned resources and pickup timing.', section: 'active-jobs', empty: 'No active jobs found.' },
  pending: { title: 'Pending Jobs', description: 'Posted, quoted or awarded jobs awaiting the next execution step.', section: 'pending-jobs', empty: 'No pending jobs found.' },
  completed: { title: 'Completed Jobs', description: 'Delivered, invoiced or paid jobs with carrier and driver context.', section: 'completed-jobs', empty: 'No completed jobs found.' },
  allocations: { title: 'All Allocations', description: 'Allocated jobs with assigned driver, carrier and posting company context.', section: 'allocations', empty: 'No allocated jobs found.' },
  deliveries: { title: 'All Deliveries', description: 'Delivery lifecycle across allocated, in-transit and delivered work with POD evidence.', section: 'deliveries', empty: 'No delivery records found.' },
};

const routeColumn: TableColumn<Row> = {
  key: 'route', label: 'Route',
  render: (row) => routeSummary(row.pickup_location, row.pickup_postcode, row.delivery_location, row.delivery_postcode),
};
const statusColumn: TableColumn<Row> = { key: 'status', label: 'Status', render: (row) => <StatusChip value={row.status} /> };
const postingColumn: TableColumn<Row> = {
  key: 'posting', label: 'Posting company',
  render: (row) => row.company_id ? <PlatformEntityLink entityType="company" entityId={row.company_id} compact>{row.posting_company_name}</PlatformEntityLink> : row.posting_company_name,
};
const carrierColumn: TableColumn<Row> = {
  key: 'carrier', label: 'Carrier',
  render: (row) => row.awarded_carrier_company_id
    ? <PlatformEntityLink entityType="company" entityId={row.awarded_carrier_company_id} compact>{row.awarded_company_name ?? 'Carrier'}</PlatformEntityLink>
    : '—',
};
const driverColumn: TableColumn<Row> = {
  key: 'driver', label: 'Driver',
  render: (row) => row.assigned_driver_id
    ? <PlatformEntityLink entityType="driver" entityId={row.assigned_driver_id} compact>{row.assigned_driver_name ?? 'Driver'}</PlatformEntityLink>
    : '—',
};
const driverCompanyColumn: TableColumn<Row> = {
  key: 'driver-company', label: 'Driver company',
  render: (row) => row.assigned_driver_company_id
    ? <PlatformEntityLink entityType="company" entityId={row.assigned_driver_company_id} compact>{row.assigned_driver_company_name ?? 'Company'}</PlatformEntityLink>
    : '—',
};
const inspectColumn: TableColumn<Row> = {
  key: 'inspect', label: 'Inspect',
  render: (row) => <PlatformEntityLink entityType="job" entityId={row.id} compact>Open</PlatformEntityLink>,
};

function columnsFor(mode: OperationsJobLedgerMode): TableColumn<Row>[] {
  const created: TableColumn<Row> = { key: 'created', label: mode === 'pending' ? 'Posted' : 'Created', render: (row) => formatDateTime(row.created_at) };
  const pickup: TableColumn<Row> = { key: 'pickup', label: 'Pickup', render: (row) => formatDateTime(row.pickup_datetime) };
  const bids: TableColumn<Row> = { key: 'bids', label: 'Bids', render: (row) => row.bids_count };
  const pod: TableColumn<Row> = { key: 'pod', label: 'POD evidence', render: (row) => `${row.pod_signature_present ? 'Signature' : 'No signature'} · ${row.pod_photos_count} photos` };
  if (mode === 'all') return [routeColumn, statusColumn, postingColumn, carrierColumn, bids, created, inspectColumn];
  if (mode === 'active') return [routeColumn, statusColumn, driverColumn, driverCompanyColumn, postingColumn, pickup, inspectColumn];
  if (mode === 'pending') return [routeColumn, statusColumn, postingColumn, bids, pickup, created, inspectColumn];
  if (mode === 'completed') return [routeColumn, statusColumn, postingColumn, carrierColumn, driverColumn, created, inspectColumn];
  if (mode === 'allocations') return [routeColumn, statusColumn, driverColumn, driverCompanyColumn, postingColumn, created, inspectColumn];
  return [routeColumn, statusColumn, driverColumn, driverCompanyColumn, postingColumn, pod, inspectColumn];
}

export default function SuperAdminOperationsJobLedger({ mode }: { mode: OperationsJobLedgerMode }) {
  const copy = modeCopy[mode];
  return (
    <SuperAdminLiveTablePage<Row>
      icon="operations"
      title={copy.title}
      sectionLabel="Operations"
      description={copy.description}
      endpoint={`/api/super-admin/operations?section=${copy.section}`}
      pageSize={50}
      searchPlaceholder="Search route or postcode"
      emptyMessage={copy.empty}
      columns={columnsFor(mode)}
    />
  );
}
