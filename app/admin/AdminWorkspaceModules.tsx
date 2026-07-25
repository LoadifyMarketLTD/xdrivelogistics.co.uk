'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { useCompanyWorkspaceData } from '../components/workspace/useCompanyWorkspaceData';
import FleetPositionMap, { type FleetMapPoint } from './fleet/FleetPositionMap';
import {
  ActionButton,
  DataTable,
  EmptyState,
  KpiCard,
  KpiGrid,
  PageFrame,
  PageHeader,
  Panel,
  StatusBadge,
  TwoColumn,
} from '../components/workspace/WorkspaceUI';

const when = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Not set';
const money = (value: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(
    Number.isFinite(value) ? value : 0
  );
const active = new Set([
  'awarded',
  'allocated',
  'accepted',
  'on_my_way',
  'on_my_way_to_pickup',
  'on_site_pickup',
  'loaded',
  'collected',
  'in_transit',
  'on_my_way_to_delivery',
  'on_site_delivery',
]);
const exceptionStatuses = new Set([
  'cancelled',
  'failed',
  'exception',
  'disputed',
  'collection_failed',
  'delivery_failed',
  'damaged',
  'breakdown',
]);
const daysUntil = (value: string | null | undefined) =>
  value ? Math.ceil((new Date(value).getTime() - Date.now()) / 86400000) : null;

const csvCell = (value: string | number | null | undefined) =>
  `"${String(value ?? '').replace(/"/g, '""')}"`;

const downloadCsv = (
  filename: string,
  columns: string[],
  rows: Array<Array<string | number | null | undefined>>
) => {
  const csv = [columns, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
};

export function DriverAvailabilityPage() {
  const data = useCompanyWorkspaceData();
  const router = useRouter();

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Fleet resources"
        title="Driver Availability"
        description="Current driver capacity, account status and operational readiness."
      />
      <KpiGrid>
        <KpiCard
          label="Available"
          value={data.drivers.filter((driver) => driver.availability_status === 'available').length}
          tone="green"
        />
        <KpiCard
          label="Busy"
          value={data.drivers.filter((driver) => driver.availability_status === 'busy').length}
          tone="purple"
        />
        <KpiCard
          label="Offline"
          value={
            data.drivers.filter(
              (driver) => !driver.availability_status || driver.availability_status === 'offline'
            ).length
          }
          tone="navy"
        />
      </KpiGrid>
      <Panel title="Driver availability register">
        <DataTable
          columns={['Driver', 'Phone', 'Account status', 'Availability', 'Action']}
          rows={data.drivers.map((driver) => [
            <strong key="name">{driver.display_name ?? driver.email ?? 'Driver'}</strong>,
            driver.phone ?? 'Not recorded',
            <StatusBadge key="account" value={driver.status ?? 'unknown'} />,
            <StatusBadge
              key="availability"
              value={driver.availability_status ?? 'offline'}
              tone={
                driver.availability_status === 'available'
                  ? 'green'
                  : driver.availability_status === 'busy'
                    ? 'purple'
                    : 'grey'
              }
            />,
            <ActionButton
              key="action"
              tone="secondary"
              onClick={() => router.push(`/admin/drivers?driver=${driver.id}`)}
            >
              View
            </ActionButton>,
          ])}
          empty={<EmptyState title="No drivers in the company roster" />}
        />
      </Panel>
    </PageFrame>
  );
}

export function FleetPositionsPage() {
  const data = useCompanyWorkspaceData();
  const locations = data.locations;
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const latest = useMemo(() => {
    const map = new Map<string, (typeof locations)[number]>();
    for (const location of locations) {
      if (!map.has(location.driver_id)) map.set(location.driver_id, location);
    }
    return map;
  }, [locations]);

  const points = useMemo<FleetMapPoint[]>(
    () =>
      data.drivers.flatMap((driver) => {
        const location = latest.get(driver.id);
        if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)) return [];
        const timestamp = location.recorded_at ?? location.updated_at;
        const stale = !timestamp || Date.now() - new Date(timestamp).getTime() > 20 * 60_000;
        return [
          {
            driverId: driver.id,
            driverName: driver.display_name ?? driver.email ?? 'Driver',
            lat: location.lat,
            lng: location.lng,
            jobId: location.job_id,
            timestamp,
            stale,
          },
        ];
      }),
    [data.drivers, latest]
  );

  useEffect(() => {
    if (selectedDriverId && points.some((point) => point.driverId === selectedDriverId)) return;
    setSelectedDriverId(points[0]?.driverId ?? null);
  }, [points, selectedDriverId]);

  const liveCount = points.filter((point) => !point.stale).length;
  const staleCount = points.filter((point) => point.stale).length;

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Fleet tracking"
        title="Live Positions"
        description="Latest driver locations, active job links and stale-location warnings on a real operational map."
      />
      <KpiGrid>
        <KpiCard label="Live locations" value={liveCount} tone="green" />
        <KpiCard label="Stale locations" value={staleCount} tone="red" />
        <KpiCard
          label="No location"
          value={Math.max(data.drivers.length - points.length, 0)}
          tone="orange"
        />
      </KpiGrid>
      <TwoColumn rightWidth="minmax(330px, 0.72fr)">
        <Panel
          title="Fleet map"
          description="Green positions updated within 20 minutes; red positions require an operational check."
        >
          {points.length > 0 ? (
            <FleetPositionMap points={points} selectedDriverId={selectedDriverId} />
          ) : (
            <EmptyState
              title="No driver locations available"
              description="The map will populate when the driver application publishes a valid position."
            />
          )}
        </Panel>
        <Panel title="Position register" description="Select a driver to centre the map.">
          <DataTable
            columns={['Driver', 'Last update', 'Job', 'Status', 'Map']}
            rows={data.drivers.map((driver) => {
              const location = latest.get(driver.id);
              const timestamp = location?.recorded_at ?? location?.updated_at;
              const stale = !timestamp || Date.now() - new Date(timestamp).getTime() > 20 * 60_000;
              return [
                <strong key="driver">{driver.display_name ?? driver.email ?? 'Driver'}</strong>,
                when(timestamp),
                location?.job_id?.slice(0, 8).toUpperCase() ?? '—',
                location ? (
                  <StatusBadge key="status" value={stale ? 'stale' : 'live'} tone={stale ? 'red' : 'green'} />
                ) : (
                  <StatusBadge key="status" value="missing" tone="grey" />
                ),
                location ? (
                  <ActionButton
                    key="action"
                    tone="secondary"
                    onClick={() => setSelectedDriverId(driver.id)}
                  >
                    Locate
                  </ActionButton>
                ) : (
                  '—'
                ),
              ];
            })}
            empty={<EmptyState title="No drivers available for live tracking" />}
          />
        </Panel>
      </TwoColumn>
    </PageFrame>
  );
}

export function FleetAssignmentsPage() {
  const data = useCompanyWorkspaceData();
  const router = useRouter();
  const jobs = data.jobs.filter(
    (job) => ['posted', 'awarded'].includes(job.status) && !job.assigned_driver_id
  );

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Fleet allocation"
        title="Assignments"
        description="Match each awarded job with an available driver and a suitable vehicle."
        actions={
          <ActionButton tone="secondary" onClick={() => router.push('/admin/diary')}>
            Open Diary
          </ActionButton>
        }
      />
      <KpiGrid>
        <KpiCard label="Jobs awaiting allocation" value={jobs.length} tone="orange" />
        <KpiCard
          label="Available drivers"
          value={data.drivers.filter((driver) => driver.availability_status === 'available').length}
          tone="green"
        />
        <KpiCard
          label="Unassigned vehicles"
          value={data.vehicles.filter((vehicle) => !vehicle.assigned_driver_id).length}
          tone="blue"
        />
      </KpiGrid>
      <Panel title="Allocation queue">
        <DataTable
          columns={['Route', 'Pickup', 'Vehicle required', 'Available resources', 'Action']}
          rows={jobs.map((job) => [
            <strong key="route">
              {job.pickup_location} → {job.delivery_location}
            </strong>,
            when(job.pickup_datetime),
            (job.vehicle_type ?? 'Not specified').replace(/_/g, ' '),
            `${data.drivers.filter((driver) => driver.availability_status === 'available').length} drivers · ${data.vehicles.length} vehicles`,
            <ActionButton
              key="action"
              tone="success"
              onClick={() => router.push(`/admin/diary?job=${job.id}`)}
            >
              Allocate
            </ActionButton>,
          ])}
          empty={<EmptyState title="No jobs awaiting allocation" />}
        />
      </Panel>
    </PageFrame>
  );
}

export function FleetActiveJobsPage() {
  const data = useCompanyWorkspaceData();
  const router = useRouter();
  const jobs = data.jobs.filter((job) => active.has(job.current_status ?? job.status));

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Fleet operations"
        title="Active Jobs"
        description="Live collections and deliveries with resource and delay visibility."
      />
      <Panel>
        <DataTable
          columns={['Route', 'Pickup', 'Delivery', 'Driver', 'Vehicle', 'Status', 'Action']}
          rows={jobs.map((job) => [
            <strong key="route">
              {job.pickup_location} → {job.delivery_location}
            </strong>,
            when(job.pickup_datetime),
            when(job.delivery_datetime),
            job.assigned_driver_id?.slice(0, 8).toUpperCase() ?? 'Not assigned',
            (job.vehicle_type ?? 'Not specified').replace(/_/g, ' '),
            <StatusBadge key="status" value={job.current_status ?? job.status} />,
            <ActionButton
              key="action"
              tone="secondary"
              onClick={() => router.push(`/admin/jobs/${job.id}`)}
            >
              Open
            </ActionButton>,
          ])}
          empty={<EmptyState title="No active jobs" />}
        />
      </Panel>
    </PageFrame>
  );
}

export function FleetMaintenancePage() {
  const data = useCompanyWorkspaceData();
  const router = useRouter();

  const readiness = data.vehicles.map((vehicle) => {
    const documents = data.vehicleDocuments.filter((document) => document.vehicle_id === vehicle.id);
    const expired = documents.some((document) => (daysUntil(document.expiry_date) ?? 1) < 0);
    const expiring = documents.some((document) => {
      const days = daysUntil(document.expiry_date);
      return days !== null && days >= 0 && days <= 30;
    });
    const state = expired
      ? { value: 'document expired', tone: 'red' as const }
      : expiring
        ? { value: 'attention due', tone: 'orange' as const }
        : documents.length > 0
          ? { value: 'documents current', tone: 'green' as const }
          : { value: 'documents missing', tone: 'grey' as const };
    return { vehicle, documents, state };
  });

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Vehicle readiness"
        title="Maintenance"
        description="Vehicle readiness is based on recorded fleet and compliance data; no vehicle is marked operational without evidence."
      />
      <KpiGrid>
        <KpiCard label="Fleet vehicles" value={data.vehicles.length} />
        <KpiCard
          label="Without assigned driver"
          value={data.vehicles.filter((vehicle) => !vehicle.assigned_driver_id).length}
          tone="orange"
        />
        <KpiCard
          label="Expired documents"
          value={data.vehicleDocuments.filter((document) => (daysUntil(document.expiry_date) ?? 1) < 0).length}
          tone="red"
        />
      </KpiGrid>
      <Panel title="Vehicle readiness register">
        <DataTable
          columns={['Registration', 'Vehicle', 'Assigned driver', 'Evidence', 'Readiness', 'Action']}
          rows={readiness.map(({ vehicle, documents, state }) => [
            <strong key="registration">{vehicle.reg_plate ?? 'No registration'}</strong>,
            `${vehicle.make ?? ''} ${vehicle.model ?? ''}`.trim() ||
              vehicle.type?.replace(/_/g, ' ') ||
              'Vehicle',
            vehicle.assigned_driver_id?.slice(0, 8).toUpperCase() ?? 'Not assigned',
            `${documents.length} document(s)`,
            <StatusBadge key="status" value={state.value} tone={state.tone} />,
            <ActionButton
              key="action"
              tone="secondary"
              onClick={() => router.push(`/admin/vehicles?vehicle=${vehicle.id}`)}
            >
              Open vehicle
            </ActionButton>,
          ])}
          empty={<EmptyState title="No vehicles in the fleet" />}
        />
      </Panel>
    </PageFrame>
  );
}

export function FutureAvailabilityPage() {
  const data = useCompanyWorkspaceData();
  const router = useRouter();
  const now = Date.now();
  const futureJobs = data.jobs
    .filter((job) => {
      const pickup = job.pickup_datetime ? new Date(job.pickup_datetime).getTime() : Number.NaN;
      return Number.isFinite(pickup) && pickup > now && !['cancelled', 'completed'].includes(job.status);
    })
    .sort(
      (left, right) =>
        new Date(left.pickup_datetime ?? 0).getTime() - new Date(right.pickup_datetime ?? 0).getTime()
    );
  const upcomingExpiry = data.driverDocuments
    .concat(data.vehicleDocuments)
    .filter((document) => {
      const days = daysUntil(document.expiry_date);
      return days !== null && days >= 0 && days <= 30;
    });

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Capacity planning"
        title="Future Availability"
        description="Forward workload, currently available resources and upcoming compliance constraints."
        actions={
          <ActionButton tone="secondary" onClick={() => router.push('/admin/returns')}>
            Return Journeys
          </ActionButton>
        }
      />
      <KpiGrid>
        <KpiCard label="Future booked jobs" value={futureJobs.length} tone="blue" />
        <KpiCard
          label="Drivers available now"
          value={data.drivers.filter((driver) => driver.availability_status === 'available').length}
          tone="green"
        />
        <KpiCard
          label="Unassigned future jobs"
          value={futureJobs.filter((job) => !job.assigned_driver_id).length}
          tone="orange"
        />
        <KpiCard label="Compliance due in 30 days" value={upcomingExpiry.length} tone="red" />
      </KpiGrid>
      <TwoColumn>
        <Panel title="Forward job schedule" description="Jobs ordered by planned collection time.">
          <DataTable
            columns={['Route', 'Pickup', 'Delivery', 'Driver', 'Vehicle', 'Status']}
            rows={futureJobs.map((job) => [
              <strong key="route">
                {job.pickup_location ?? 'Collection'} → {job.delivery_location ?? 'Delivery'}
              </strong>,
              when(job.pickup_datetime),
              when(job.delivery_datetime),
              job.assigned_driver_id?.slice(0, 8).toUpperCase() ?? 'Unassigned',
              (job.vehicle_type ?? 'Not specified').replace(/_/g, ' '),
              <StatusBadge key="status" value={job.current_status ?? job.status} />,
            ])}
            empty={<EmptyState title="No future jobs recorded" />}
          />
        </Panel>
        <Panel title="Available resources" description="Current capacity that can be planned against future work.">
          <DataTable
            columns={['Driver', 'Availability', 'Account']}
            rows={data.drivers
              .filter((driver) => driver.availability_status === 'available')
              .map((driver) => [
                driver.display_name ?? driver.email ?? 'Driver',
                <StatusBadge key="availability" value="available" tone="green" />,
                <StatusBadge key="account" value={driver.status ?? 'unknown'} />,
              ])}
            empty={<EmptyState title="No drivers currently marked available" />}
          />
        </Panel>
      </TwoColumn>
    </PageFrame>
  );
}

export function DocumentExpiryPage() {
  const data = useCompanyWorkspaceData();
  const documents = data.driverDocuments
    .concat(data.vehicleDocuments)
    .filter((document) => document.expiry_date)
    .sort(
      (left, right) =>
        new Date(left.expiry_date ?? 0).getTime() - new Date(right.expiry_date ?? 0).getTime()
    );

  const entityName = (driverId?: string | null, vehicleId?: string | null) => {
    if (driverId) {
      const driver = data.drivers.find((row) => row.id === driverId);
      return driver?.display_name ?? driver?.email ?? `Driver ${driverId.slice(0, 8)}`;
    }
    if (vehicleId) {
      const vehicle = data.vehicles.find((row) => row.id === vehicleId);
      return vehicle?.reg_plate ?? `Vehicle ${vehicleId.slice(0, 8)}`;
    }
    return 'Unknown entity';
  };

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Compliance calendar"
        title="Document Expiry"
        description="Expired and expiring driver and vehicle evidence, ordered by urgency."
      />
      <KpiGrid>
        <KpiCard
          label="Expired"
          value={documents.filter((document) => (daysUntil(document.expiry_date) ?? 1) < 0).length}
          tone="red"
        />
        <KpiCard
          label="Due in 7 days"
          value={
            documents.filter((document) => {
              const days = daysUntil(document.expiry_date);
              return days !== null && days >= 0 && days <= 7;
            }).length
          }
          tone="orange"
        />
        <KpiCard
          label="Due in 30 days"
          value={
            documents.filter((document) => {
              const days = daysUntil(document.expiry_date);
              return days !== null && days > 7 && days <= 30;
            }).length
          }
          tone="blue"
        />
      </KpiGrid>
      <Panel>
        <DataTable
          columns={['Document', 'Entity', 'Expiry', 'Days remaining', 'Verification']}
          rows={documents.map((document) => [
            document.doc_type?.replace(/_/g, ' ') ?? 'Document',
            entityName(document.driver_id, document.vehicle_id),
            new Date(document.expiry_date ?? '').toLocaleDateString('en-GB'),
            daysUntil(document.expiry_date),
            <StatusBadge key="status" value={document.status ?? 'pending'} />,
          ])}
          empty={<EmptyState title="No expiry dates recorded" />}
        />
      </Panel>
    </PageFrame>
  );
}

export function IncidentsPage() {
  const data = useCompanyWorkspaceData();
  const router = useRouter();
  const rows = data.jobs
    .map((job) => {
      const status = job.current_status ?? job.status;
      const overdue =
        active.has(status) &&
        Boolean(job.delivery_datetime) &&
        new Date(job.delivery_datetime ?? 0).getTime() < Date.now();
      return { job, status, overdue };
    })
    .filter(({ status, overdue }) => exceptionStatuses.has(status) || overdue);

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Operational exceptions"
        title="Incidents"
        description="A live exception queue derived from failed, disputed, cancelled and overdue jobs."
        actions={
          <ActionButton tone="secondary" onClick={() => router.push('/admin/disputes')}>
            Open Disputes
          </ActionButton>
        }
      />
      <KpiGrid>
        <KpiCard label="Open exceptions" value={rows.length} tone="red" />
        <KpiCard label="Overdue active jobs" value={rows.filter((row) => row.overdue).length} tone="orange" />
        <KpiCard
          label="Failed or cancelled"
          value={rows.filter((row) => exceptionStatuses.has(row.status)).length}
          tone="navy"
        />
      </KpiGrid>
      <Panel title="Exception register">
        <DataTable
          columns={['Job', 'Route', 'Planned delivery', 'Exception', 'Updated', 'Action']}
          rows={rows.map(({ job, status, overdue }) => [
            job.id.slice(0, 8).toUpperCase(),
            <strong key="route">
              {job.pickup_location ?? 'Collection'} → {job.delivery_location ?? 'Delivery'}
            </strong>,
            when(job.delivery_datetime),
            <StatusBadge
              key="status"
              value={overdue && !exceptionStatuses.has(status) ? 'delivery overdue' : status}
              tone={overdue ? 'red' : 'orange'}
            />,
            when(job.updated_at),
            <ActionButton
              key="action"
              tone="secondary"
              onClick={() => router.push(`/admin/jobs/${job.id}`)}
            >
              Investigate
            </ActionButton>,
          ])}
          empty={
            <EmptyState
              title="No operational exceptions"
              description="Failed, disputed, cancelled or overdue jobs will appear automatically."
            />
          }
        />
      </Panel>
    </PageFrame>
  );
}

export function FinancePaymentsPage() {
  const data = useCompanyWorkspaceData();
  return (
    <PageFrame>
      <PageHeader
        eyebrow="Finance"
        title="Payments"
        description="Payment reconciliation is separated from invoice issuance and operational job status."
      />
      <Panel>
        <DataTable
          columns={['Invoice', 'Counterparty', 'Amount', 'Payment status', 'Due']}
          rows={data.invoices.map((invoice) => [
            invoice.invoice_number ?? invoice.id.slice(0, 8),
            invoice.client_name ?? 'Counterparty',
            money(Number(invoice.amount ?? 0)),
            <StatusBadge key="status" value={invoice.payment_status ?? invoice.status} />,
            invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-GB') : 'Not set',
          ])}
          empty={<EmptyState title="No payment records" />}
        />
      </Panel>
    </PageFrame>
  );
}

export function FinanceBalancesPage() {
  const data = useCompanyWorkspaceData();
  const unpaid = data.invoices.filter(
    (invoice) => invoice.payment_status !== 'paid' && !['paid', 'Paid'].includes(invoice.status)
  );

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Finance"
        title="Outstanding Balances"
        description="Amounts owed by customers and amounts payable to carriers."
      />
      <KpiGrid>
        <KpiCard label="Outstanding invoices" value={unpaid.length} tone="orange" />
        <KpiCard
          label="Outstanding value"
          value={money(unpaid.reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0))}
          tone="navy"
        />
      </KpiGrid>
      <Panel>
        <DataTable
          columns={['Invoice', 'Counterparty', 'Amount', 'Due', 'Status']}
          rows={unpaid.map((invoice) => [
            invoice.invoice_number ?? invoice.id.slice(0, 8),
            invoice.client_name ?? 'Counterparty',
            money(Number(invoice.amount ?? 0)),
            invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-GB') : 'Not set',
            <StatusBadge key="status" value={invoice.payment_status ?? invoice.status} />,
          ])}
          empty={<EmptyState title="No outstanding balances" />}
        />
      </Panel>
    </PageFrame>
  );
}

export function FinanceReportsPage() {
  const data = useCompanyWorkspaceData();
  const outstanding = data.invoices.filter(
    (invoice) => invoice.payment_status !== 'paid' && !['paid', 'Paid'].includes(invoice.status)
  );
  const invoiceValue = data.invoices.reduce(
    (sum, invoice) => sum + Number(invoice.amount ?? 0),
    0
  );
  const outstandingValue = outstanding.reduce(
    (sum, invoice) => sum + Number(invoice.amount ?? 0),
    0
  );

  const exportInvoices = () =>
    downloadCsv(
      'xdrive-invoice-register.csv',
      ['Invoice', 'Job', 'Counterparty', 'Amount GBP', 'Due date', 'Status', 'Created'],
      data.invoices.map((invoice) => [
        invoice.invoice_number ?? invoice.id,
        invoice.job_id ?? '',
        invoice.client_name ?? '',
        Number(invoice.amount ?? 0),
        invoice.due_date ?? '',
        invoice.payment_status ?? invoice.status,
        invoice.created_at,
      ])
    );

  const exportBalances = () =>
    downloadCsv(
      'xdrive-outstanding-balances.csv',
      ['Invoice', 'Counterparty', 'Amount GBP', 'Due date', 'Status'],
      outstanding.map((invoice) => [
        invoice.invoice_number ?? invoice.id,
        invoice.client_name ?? '',
        Number(invoice.amount ?? 0),
        invoice.due_date ?? '',
        invoice.payment_status ?? invoice.status,
      ])
    );

  const exportJobs = () =>
    downloadCsv(
      'xdrive-job-commercial-summary.csv',
      ['Job', 'Collection', 'Delivery', 'Pickup', 'Status', 'Customer price GBP'],
      data.jobs.map((job) => [
        job.id,
        job.pickup_location ?? '',
        job.delivery_location ?? '',
        job.pickup_datetime ?? '',
        job.current_status ?? job.status,
        Number(job.budget_amount ?? 0),
      ])
    );

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Finance"
        title="Reports & Exports"
        description="Download company-scoped operational and finance registers as CSV files."
      />
      <KpiGrid>
        <KpiCard label="Invoices" value={data.invoices.length} tone="blue" />
        <KpiCard label="Invoice value" value={money(invoiceValue)} tone="green" />
        <KpiCard label="Outstanding value" value={money(outstandingValue)} tone="orange" />
        <KpiCard label="Jobs in report scope" value={data.jobs.length} tone="navy" />
      </KpiGrid>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '0.9rem',
        }}
      >
        <Panel
          title="Invoice register"
          description="Invoice, job, counterparty, amount, due date and payment status."
          actions={
            <ActionButton tone="secondary" disabled={data.invoices.length === 0} onClick={exportInvoices}>
              Export CSV
            </ActionButton>
          }
        >
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.78rem' }}>
            {data.invoices.length} invoice record(s) in the current company scope.
          </p>
        </Panel>
        <Panel
          title="Outstanding balances"
          description="Only unpaid and overdue balances requiring reconciliation."
          actions={
            <ActionButton tone="secondary" disabled={outstanding.length === 0} onClick={exportBalances}>
              Export CSV
            </ActionButton>
          }
        >
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.78rem' }}>
            {outstanding.length} outstanding record(s), total {money(outstandingValue)}.
          </p>
        </Panel>
        <Panel
          title="Job commercial summary"
          description="Route, planned pickup, operational status and recorded customer price."
          actions={
            <ActionButton tone="secondary" disabled={data.jobs.length === 0} onClick={exportJobs}>
              Export CSV
            </ActionButton>
          }
        >
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.78rem' }}>
            {data.jobs.length} job record(s) in the current company scope.
          </p>
        </Panel>
      </div>
    </PageFrame>
  );
}

export function NotificationsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<
    Array<{ id: string; event_type: string; entity_type: string; status: string; created_at: string }>
  >([]);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('notification_events')
      .select('id,event_type,entity_type,status,created_at')
      .eq('recipient_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => setRows((data ?? []) as typeof rows));
  }, [user?.id]);

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Workspace notifications"
        title="Notifications"
        description="Operational and commercial events addressed to the current user."
      />
      <Panel>
        <DataTable
          columns={['Event', 'Entity', 'Time', 'Delivery status']}
          rows={rows.map((row) => [
            row.event_type.replace(/_/g, ' '),
            row.entity_type,
            when(row.created_at),
            <StatusBadge key="status" value={row.status} />,
          ])}
          empty={<EmptyState title="No notifications" />}
        />
      </Panel>
    </PageFrame>
  );
}
