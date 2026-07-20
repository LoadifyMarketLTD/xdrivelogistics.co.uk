'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ActionButton,
  AlertBanner,
  DataTable,
  EmptyState,
  KpiCard,
  KpiGrid,
  PageFrame,
  PageHeader,
  Panel,
  StatusBadge,
} from '../components/workspace/WorkspaceUI';
import {
  useCompanyWorkspaceData,
  type WorkspaceDocument,
  type WorkspaceVehicle,
} from '../components/workspace/useCompanyWorkspaceData';

const DAY_MS = 86_400_000;

const money = (value: number) =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(value);

const when = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'Not set';

const daysUntil = (value: string | null | undefined) =>
  value ? Math.ceil((new Date(value).getTime() - Date.now()) / DAY_MS) : null;

const isClosedJob = (status: string | null | undefined) =>
  ['cancelled', 'canceled', 'delivered', 'completed', 'closed'].includes(
    (status ?? '').toLowerCase()
  );

type ReadinessTone = 'green' | 'orange' | 'red';

type VehicleReadiness = {
  label: string;
  tone: ReadinessTone;
  documentCount: number;
};

const evaluateVehicleReadiness = (
  vehicle: WorkspaceVehicle,
  documents: WorkspaceDocument[]
): VehicleReadiness => {
  const vehicleDocuments = documents.filter(
    (document) => document.vehicle_id === vehicle.id
  );

  if (vehicleDocuments.length === 0) {
    return {
      label: 'No documents',
      tone: 'orange',
      documentCount: 0,
    };
  }

  const hasExpiredDocument = vehicleDocuments.some(
    (document) => (daysUntil(document.expiry_date) ?? 1) < 0
  );

  if (hasExpiredDocument) {
    return {
      label: 'Expired document',
      tone: 'red',
      documentCount: vehicleDocuments.length,
    };
  }

  const requiresVerification = vehicleDocuments.some(
    (document) =>
      !['approved', 'verified', 'valid', 'active'].includes(
        (document.status ?? '').toLowerCase()
      )
  );

  if (requiresVerification) {
    return {
      label: 'Verification required',
      tone: 'orange',
      documentCount: vehicleDocuments.length,
    };
  }

  const hasDocumentDueSoon = vehicleDocuments.some((document) => {
    const days = daysUntil(document.expiry_date);
    return days !== null && days >= 0 && days <= 30;
  });

  if (hasDocumentDueSoon) {
    return {
      label: 'Expiry due',
      tone: 'orange',
      documentCount: vehicleDocuments.length,
    };
  }

  return {
    label: 'Documents current',
    tone: 'green',
    documentCount: vehicleDocuments.length,
  };
};

export function HardenedFleetMaintenancePage() {
  const data = useCompanyWorkspaceData();
  const router = useRouter();

  const readinessByVehicle = useMemo(() => {
    const result = new Map<string, VehicleReadiness>();

    for (const vehicle of data.vehicles) {
      result.set(
        vehicle.id,
        evaluateVehicleReadiness(vehicle, data.vehicleDocuments)
      );
    }

    return result;
  }, [data.vehicleDocuments, data.vehicles]);

  const vehiclesRequiringReview = data.vehicles.filter(
    (vehicle) => readinessByVehicle.get(vehicle.id)?.tone !== 'green'
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
        description="This view reports assignment and document readiness from live company data. It does not claim that workshop servicing, defects or repairs are complete without a dedicated maintenance record."
      />

      {data.error && <AlertBanner>{data.error}</AlertBanner>}

      <KpiGrid>
        <KpiCard label="Fleet vehicles" value={data.vehicles.length} />
        <KpiCard
          label="Vehicles requiring review"
          value={vehiclesRequiringReview}
          tone="orange"
        />
        <KpiCard
          label="Expired documents"
          value={expiredDocuments}
          tone="red"
        />
        <KpiCard
          label="Due in 30 days"
          value={documentsDueSoon}
          tone="orange"
        />
      </KpiGrid>

      <Panel
        title="Vehicle readiness register"
        description="Readiness is based only on evidence currently available in this company workspace."
      >
        <DataTable
          columns={[
            'Registration',
            'Vehicle',
            'Assigned driver',
            'Document readiness',
            'Evidence',
            'Action',
          ]}
          rows={data.vehicles.map((vehicle) => {
            const readiness = readinessByVehicle.get(vehicle.id) ?? {
              label: 'Review required',
              tone: 'orange' as const,
              documentCount: 0,
            };

            return [
              <strong key="registration">
                {vehicle.reg_plate ?? 'No registration'}
              </strong>,
              `${vehicle.make ?? ''} ${vehicle.model ?? ''}`.trim() ||
                vehicle.type?.replace(/_/g, ' ') ||
                'Vehicle',
              vehicle.assigned_driver_id?.slice(0, 8) ?? 'Not assigned',
              <StatusBadge
                key="readiness"
                value={readiness.label}
                tone={readiness.tone}
              />,
              `${readiness.documentCount} document${
                readiness.documentCount === 1 ? '' : 's'
              }`,
              <ActionButton
                key="action"
                tone="secondary"
                onClick={() =>
                  router.push(`/admin/vehicles?vehicle=${vehicle.id}`)
                }
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

export function HardenedFutureAvailabilityPage() {
  const data = useCompanyWorkspaceData();
  const router = useRouter();
  const now = Date.now();
  const sevenDaysFromNow = now + 7 * DAY_MS;

  const futureJobs = data.jobs
    .filter((job) => {
      if (!job.pickup_datetime) return false;
      if (isClosedJob(job.current_status ?? job.status)) return false;
      return new Date(job.pickup_datetime).getTime() > now;
    })
    .sort(
      (left, right) =>
        new Date(left.pickup_datetime ?? 0).getTime() -
        new Date(right.pickup_datetime ?? 0).getTime()
    );

  const jobsInNextSevenDays = futureJobs.filter(
    (job) =>
      new Date(job.pickup_datetime ?? 0).getTime() <= sevenDaysFromNow
  );

  const availableDrivers = data.drivers.filter(
    (driver) => driver.availability_status === 'available'
  );

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Capacity planning"
        title="Future Availability"
        description="Upcoming booked work and current declared driver capacity, based on live company-scoped records."
        actions={
          <>
            <ActionButton
              tone="secondary"
              onClick={() => router.push('/admin/driver-availability')}
            >
              Driver Availability
            </ActionButton>
            <ActionButton
              tone="secondary"
              onClick={() => router.push('/admin/returns')}
            >
              Return Journeys
            </ActionButton>
          </>
        }
      />

      {data.error && <AlertBanner>{data.error}</AlertBanner>}

      <KpiGrid>
        <KpiCard label="Upcoming jobs" value={futureJobs.length} />
        <KpiCard
          label="Jobs in next 7 days"
          value={jobsInNextSevenDays.length}
          tone="purple"
        />
        <KpiCard
          label="Drivers currently available"
          value={availableDrivers.length}
          tone="green"
        />
        <KpiCard
          label="Unassigned future jobs"
          value={
            futureJobs.filter((job) => !job.assigned_driver_id).length
          }
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
        <Panel
          title="Upcoming booked work"
          description="Future jobs ordered by collection time."
        >
          <DataTable
            columns={['Route', 'Collection', 'Driver', 'Vehicle', 'Status']}
            rows={futureJobs.slice(0, 50).map((job) => [
              <strong key="route">
                {job.pickup_location ?? 'Pickup not set'} →{' '}
                {job.delivery_location ?? 'Delivery not set'}
              </strong>,
              when(job.pickup_datetime),
              job.assigned_driver_id?.slice(0, 8) ?? 'Unassigned',
              (job.vehicle_type ?? 'Not specified').replace(/_/g, ' '),
              <StatusBadge
                key="status"
                value={job.current_status ?? job.status}
              />,
            ])}
            empty={<EmptyState title="No future jobs recorded" />}
          />
        </Panel>

        <Panel
          title="Declared driver capacity"
          description="Current availability status from the driver roster."
        >
          <DataTable
            columns={['Driver', 'Availability', 'Account status']}
            rows={data.drivers.map((driver) => [
              driver.display_name ?? driver.email ?? 'Driver',
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
              <StatusBadge
                key="account-status"
                value={driver.status ?? 'unknown'}
              />,
            ])}
            empty={<EmptyState title="No drivers in the company roster" />}
          />
        </Panel>
      </div>
    </PageFrame>
  );
}

export function HardenedIncidentsPage() {
  const router = useRouter();

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Operational exceptions"
        title="Incidents"
        description="Accidents, breakdowns, failed deliveries, cargo damage and complaints require a controlled incident record."
        actions={
          <ActionButton
            tone="secondary"
            onClick={() => router.push('/admin/disputes')}
          >
            Open Disputes
          </ActionButton>
        }
      />

      <Panel>
        <EmptyState
          title="No dedicated incident records are loaded"
          description="The current live workspace exposes dispute cases but not a verified incident register. No incident status is inferred or simulated here."
          action={
            <ActionButton
              tone="secondary"
              onClick={() => router.push('/admin/disputes')}
            >
              Review disputes
            </ActionButton>
          }
        />
      </Panel>
    </PageFrame>
  );
}

export function HardenedFinanceReportsPage() {
  const data = useCompanyWorkspaceData();
  const router = useRouter();

  const totalInvoiceValue = data.invoices.reduce(
    (sum, invoice) => sum + Number(invoice.amount ?? 0),
    0
  );

  const paidInvoices = data.invoices.filter(
    (invoice) =>
      (invoice.payment_status ?? invoice.status).toLowerCase() === 'paid'
  );

  const outstandingInvoices = data.invoices.filter(
    (invoice) =>
      (invoice.payment_status ?? invoice.status).toLowerCase() !== 'paid'
  );

  const paidValue = paidInvoices.reduce(
    (sum, invoice) => sum + Number(invoice.amount ?? 0),
    0
  );

  const outstandingValue = outstandingInvoices.reduce(
    (sum, invoice) => sum + Number(invoice.amount ?? 0),
    0
  );

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Finance"
        title="Reports & Summary"
        description="Live company-scoped invoice and balance totals. Export files are not presented until a verified export endpoint is available."
        actions={
          <ActionButton
            tone="secondary"
            onClick={() => router.push('/admin/invoices')}
          >
            Open invoices
          </ActionButton>
        }
      />

      {data.error && <AlertBanner>{data.error}</AlertBanner>}

      <KpiGrid>
        <KpiCard label="Invoices" value={data.invoices.length} />
        <KpiCard
          label="Invoice value"
          value={money(totalInvoiceValue)}
          tone="navy"
        />
        <KpiCard label="Paid" value={paidInvoices.length} tone="green" />
        <KpiCard
          label="Outstanding"
          value={outstandingInvoices.length}
          tone="orange"
        />
      </KpiGrid>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '0.9rem',
        }}
      >
        <Panel title="Payment reconciliation">
          <p
            style={{
              margin: '0 0 0.8rem',
              color: '#64748b',
              fontSize: '0.78rem',
              lineHeight: 1.5,
            }}
          >
            {paidInvoices.length} paid invoice
            {paidInvoices.length === 1 ? '' : 's'} with a recorded value of{' '}
            {money(paidValue)}.
          </p>
          <ActionButton
            tone="secondary"
            onClick={() => router.push('/admin/finance/payments')}
          >
            Review payments
          </ActionButton>
        </Panel>

        <Panel title="Outstanding balances">
          <p
            style={{
              margin: '0 0 0.8rem',
              color: '#64748b',
              fontSize: '0.78rem',
              lineHeight: 1.5,
            }}
          >
            {money(outstandingValue)} remains outside the recorded paid state.
          </p>
          <ActionButton
            tone="secondary"
            onClick={() => router.push('/admin/finance/balances')}
          >
            Review balances
          </ActionButton>
        </Panel>
      </div>
    </PageFrame>
  );
}
