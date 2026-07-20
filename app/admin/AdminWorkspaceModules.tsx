'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { useCompanyWorkspaceData } from '../components/workspace/useCompanyWorkspaceData';
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
} from '../components/workspace/WorkspaceUI';

const when = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Not set';

const money = (value: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);

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

const daysUntil = (value: string | null | undefined) =>
  value ? Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000) : null;

const isClosedJob = (status: string | null | undefined) =>
  ['cancelled', 'canceled', 'delivered', 'completed', 'closed'].includes((status ?? '').toLowerCase());

export function DriverAvailabilityPage() {
  const data = useCompanyWorkspaceData();
  const router = useRouter();

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Fleet resources"
        title="Driver Availability"
        description="Current and future driver capacity, separated from the commercial load board."
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
          value={data.drivers.filter(
            (driver) => !driver.availability_status || driver.availability_status === 'offline'
          ).length}
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
  const latest = useMemo(() => {
    const map = new Map<string, (typeof locations)[number]>();
    for (const location of locations) {
      if (!map.has(location.driver_id)) map.set(location.driver_id, location);
    }
    return map;
  }, [locations]);

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Fleet tracking"
        title="Live Positions"
        description="Latest driver position, active job and stale-location warnings. The map remains secondary to operational exceptions."
      />
      <Panel title="Position register">
        <DataTable
          columns={['Driver', 'Coordinates', 'Last update', 'Job', 'Status']}
          rows={data.drivers.map((driver) => {
            const location = latest.get(driver.id);
            const timestamp = location?.recorded_at ?? location?.updated_at;
            const stale = !timestamp || Date.now() - new Date(timestamp).getTime() > 20 * 60_000;
            return [
              driver.display_name ?? driver.email ?? 'Driver',
              location ? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}` : 'No location',
              when(timestamp),
              location?.job_id?.slice(0, 8) ?? '—',
              <StatusBadge
                key="status"
                value={stale ? 'stale' : 'live'}
                tone={stale ? 'red' : 'green'}
              />,
            ];
          })}
          empty={<EmptyState title="No drivers available for live tracking" />}
        />
      </Panel>
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
        description="Match job, available driver and suitable vehicle. Final allocation uses the existing controlled Diary workflow."
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
            job.assigned_driver_id?.slice(0, 8) ?? 'Not assigned',
            (job.vehicle_type ?? 'Not specified').replace(/_/g, ' '),
            <StatusBadge key="status" value={job.current_status ?? job.status} />,
            <ActionButton
              key="action"
              tone="secondary"
              onClick={() => router.push(`/admin/jobs?job=${job.id}`)}
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

  const documentState = useMemo(() => {
    const documentsByVehicle = new Map<string, typeof data.vehicleDocuments>();
    for (const document of data.vehicleDocuments) {
      if (!document.vehicle_id) continue;
      const documents = documentsByVehicle.get(document.vehicle_id) ?? [];
      documents.push(document);
      documentsByVehicle.set(document.vehicle_id, documents);
    }

    return new Map(
      data.vehicles.map((vehicle) => {
        const documents = documentsByVehicle.get(vehicle.id) ?? [];
        const expired = documents.some((document) => (daysUntil(document.expiry_date) ?? 1) < 0);
        const dueSoon = documents.some((document) => {
          const days = daysUntil(document.expiry_date);
          return days !== null && days >= 0 && days <= 30;
        });
        const verificationRequired = documents.some((document) =>
          !['approved', 'verified', 'valid', 'active'].includes((document.status ?? '').toLowerCase())
        );

        if (documents.length === 0) {
          return [vehicle.id, { label: 'No documents', tone: 'orange' as const, count: 0 }];
        }
        if (expired) {
          return [vehicle.id, { label: 'Expired document', tone: 'red' as const, count: documents.length }];
        }
        if (verificationRequired) {
          return [vehicle.id, { label: 'Verification required', tone: 'orange' as const, count: documents.length }];
        }
        if (dueSoon) {
          return [vehicle.id, { label: 'Expiry due', tone: 'orange' as const, count: documents.length }];
        }
        return [vehicle.id, { label: 'Documents current', tone: 'green' as const, count: documents.length }];
      })
    );
  }, [data.vehicleDocuments, data.vehicles]);

  const vehiclesRequiringReview = data.vehicles.filter(
    (vehicle) => documentState.get(vehicle.id)?.tone !== 'green'
  ).length;
  const expiredDocuments = data.vehicleDocuments.filter(
    (document) => (daysUntil(document.expiry_date) ?? 1) < 0
  ).length;
  const documentsDueSoon = data.vehicleDocuments.filter((document) => {
    const days = daysUntil(document.expiry_date);
    return days !== null && days >= 0 && days <= 30;
  }).length;

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Vehicle readiness"
        title="Maintenance & Readiness"
        description="This view reports assignment and document readiness from live data. Workshop servicing, defects and repair events are not marked as completed unless a dedicated maintenance record exists."
      />
      <KpiGrid>
        <KpiCard label="Fleet vehicles" value={data.vehicles.length} />
        <KpiCard label="Vehicles requiring review" value={vehiclesRequiringReview} tone="orange" />
        <KpiCard label="Expired documents" value={expiredDocuments} tone="red" />
        <KpiCard label="Documents due in 30 days" value={documentsDueSoon} tone="orange" />
      </KpiGrid>
      <Panel
        title="Vehicle readiness register"
        description="Readiness is based only on records currently available in the company workspace."
      >
        <DataTable
          columns={['Registration', 'Vehicle', 'Assigned driver', 'Document readiness', 'Evidence', 'Action']}
          rows={data.vehicles.map((vehicle) => {
            const readiness = documentState.get(vehicle.id) ?? {
              label: 'Review required',
              tone: 'orange' as const,
              count: 0,
            };
            return [
              <strong key="reg">{vehicle.reg_plate ?? 'No registration'}</strong>,
              `${vehicle.make ?? ''} ${vehicle.model ?? ''}`.trim() ||
                vehicle.type?.replace(/_/g, ' ') ||
                'Vehicle',
              vehicle.assigned_driver_id?.slice(0, 8) ?? 'Not assigned',
              <StatusBadge key="status" value={readiness.label} tone={readiness.tone} />,
              `${readiness.count} document${readiness.count === 1 ? '' : 's'}`,
              <ActionButton
                key="action"
                tone="secondary"
                onClick={() => router.push(`/admin/vehicles?vehicle=${vehicle.id}`)}
              >
                Open vehicle
              </ActionButton>,
            ];
          })}
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
  const sevenDaysFromNow = now + 7 * 86_400_000;

  const futureJobs = data.jobs
    .filter((job) => {
      if (!job.pickup_datetime || isClosedJob(job.current_status ?? job.status)) return false;
      return new Date(job.pickup_datetime).getTime() > now;
    })
    .sort(
      (left, right) =>
        new Date(left.pickup_datetime ?? 0).getTime() -
        new Date(right.pickup_datetime ?? 0).getTime()
    );
  const nextSevenDays = futureJobs.filter(
    (job) => new Date(job.pickup_datetime ?? 0).getTime() <= sevenDaysFromNow
  );
  const availableDrivers = data.drivers.filter(
    (driver) => driver.availability_status === 'available'
  );

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Capacity planning"
        title="Future Availability"
        description="Upcoming booked work and current declared driver capacity. Return journeys remain in their controlled module."
        actions={
          <>
            <ActionButton tone="secondary" onClick={() => router.push('/admin/driver-availability')}>
              Driver Availability
            </ActionButton>
            <ActionButton tone="secondary" onClick={() => router.push('/admin/returns')}>
              Return Journeys
            </ActionButton>
          </>
        }
      />
      <KpiGrid>
        <KpiCard label="Upcoming jobs" value={futureJobs.length} tone="blue" />
        <KpiCard label="Jobs in next 7 days" value={nextSevenDays.length} tone="purple" />
        <KpiCard label="Drivers currently available" value={availableDrivers.length} tone="green" />
        <KpiCard
          label="Unassigned future jobs"
          value={futureJobs.filter((job) => !job.assigned_driver_id).length}
          tone="orange"
        />
      </KpiGrid>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '0.9rem',
        }}
      >
        <Panel title="Upcoming booked work" description="Future jobs ordered by collection time.">
          <DataTable
            columns={['Route', 'Collection', 'Driver', 'Vehicle', 'Status']}
            rows={futureJobs.slice(0, 50).map((job) => [
              <strong key="route">
                {job.pickup_location ?? 'Pickup not set'} → {job.delivery_location ?? 'Delivery not set'}
              </strong>,
              when(job.pickup_datetime),
              job.assigned_driver_id?.slice(0, 8) ?? 'Unassigned',
              (job.vehicle_type ?? 'Not specified').replace(/_/g, ' '),
              <StatusBadge key="status" value={job.current_status ?? job.status} />,
            ])}
            empty={<EmptyState title="No future jobs recorded" />}
          />
        </Panel>
        <Panel title="Declared driver capacity" description="Current availability status from the driver roster.">
          <DataTable
            columns={['Driver', 'Availability', 'Account status']}
            rows={data.drivers.map((driver) => [
              driver.display_name ?? driver.email ?? 'Driver',
              <StatusBadge
                key="availability"
                value={driver.availability_status ?? 'offline'}
                tone={driver.availability_status === 'available' ? 'green' : 'grey'}
              />,
              <StatusBadge key="status" value={driver.status ?? 'unknown'} />,
            ])}
            empty={<EmptyState title="No drivers in the company roster" />}
          />
        </Panel>
      </div>
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
          value={documents.filter((document) => {
            const days = daysUntil(document.expiry_date);
            return days !== null && days >= 0 && days <= 7;
          }).length}
          tone="orange"
        />
        <KpiCard
          label="Due in 30 days"
          value={documents.filter((document) => {
            const days = daysUntil(document.expiry_date);
            return days !== null && days > 7 && days <= 30;
          }).length}
          tone="blue"
        />
      </KpiGrid>
      <Panel>
        <DataTable
          columns={['Document', 'Entity', 'Expiry', 'Days remaining', 'Verification']}
          rows={documents.map((document) => [
            document.doc_type?.replace(/_/g, ' ') ?? 'Document',
            document.driver_id ? 'Driver' : 'Vehicle',
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
  const router = useRouter();

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Operational exceptions"
        title="Incidents"
        description="Accidents, breakdowns, failed deliveries, cargo damage and complaints require a controlled incident record."
        actions={
          <ActionButton tone="secondary" onClick={() => router.push('/admin/disputes')}>
            Open Disputes
          </ActionButton>
        }
      />
      <Panel>
        <EmptyState
          title="No dedicated incident records are loaded"
          description="The current live workspace exposes dispute cases but not a verified incident register. No incident status is inferred or simulated here."
          action={
            <ActionButton tone="secondary" onClick={() => router.push('/admin/disputes')}>
              Review disputes
            </ActionButton>
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
    (invoice) =>
      invoice.payment_status !== 'paid' && !['paid', 'Paid'].includes(invoice.status)
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
  const router = useRouter();
  const total = data.invoices.reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0);
  const paid = data.invoices.filter(
    (invoice) => (invoice.payment_status ?? invoice.status).toLowerCase() === 'paid'
  );
  const outstanding = data.invoices.filter(
    (invoice) => (invoice.payment_status ?? invoice.status).toLowerCase() !== 'paid'
  );

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Finance"
        title="Reports & Summary"
        description="Live company-scoped invoice and balance totals. Export files are not presented until a verified export endpoint is available."
        actions={
          <ActionButton tone="secondary" onClick={() => router.push('/admin/invoices')}>
            Open invoices
          </ActionButton>
        }
      />
      <KpiGrid>
        <KpiCard label="Invoices" value={data.invoices.length} tone="blue" />
        <KpiCard label="Invoice value" value={money(total)} tone="navy" />
        <KpiCard label="Paid" value={paid.length} tone="green" />
        <KpiCard label="Outstanding" value={outstanding.length} tone="orange" />
      </KpiGrid>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '0.9rem',
        }}
      >
        <Panel title="Payment reconciliation">
          <p style={{ margin: '0 0 0.8rem', color: '#64748b', fontSize: '0.78rem' }}>
            {paid.length} paid invoice{paid.length === 1 ? '' : 's'} with a recorded value of{' '}
            {money(paid.reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0))}.
          </p>
          <ActionButton tone="secondary" onClick={() => router.push('/admin/finance/payments')}>
            Review payments
          </ActionButton>
        </Panel>
        <Panel title="Outstanding balances">
          <p style={{ margin: '0 0 0.8rem', color: '#64748b', fontSize: '0.78rem' }}>
            {money(outstanding.reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0))}{' '}
            remains outside the recorded paid state.
          </p>
          <ActionButton tone="secondary" onClick={() => router.push('/admin/finance/balances')}>
            Review balances
          </ActionButton>
        </Panel>
      </div>
    </PageFrame>
  );
}

export function NotificationsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<
    Array<{
      id: string;
      event_type: string;
      entity_type: string;
      status: string;
      created_at: string;
    }>
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
