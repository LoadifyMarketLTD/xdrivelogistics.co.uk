'use client';

import { useEffect, useMemo, useState } from 'react';
import { downloadXlsx, spreadsheetDate } from '../../lib/spreadsheetExport';
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
const daysUntil = (value: string | null | undefined) =>
  value ? Math.ceil((new Date(value).getTime() - Date.now()) / 86400000) : null;

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
  const reportSubtitle = data.companyId
    ? `Company scope ${data.companyId} · generated ${new Date().toLocaleString('en-GB')}`
    : `Generated ${new Date().toLocaleString('en-GB')}`;

  const invoiceSheet = {
    name: 'Invoices',
    title: 'Invoice Register',
    subtitle: reportSubtitle,
    columns: [
      { header: 'Invoice', key: 'invoice', width: 20 },
      { header: 'Job', key: 'job', width: 22 },
      { header: 'Counterparty', key: 'counterparty', width: 28 },
      { header: 'Invoice date', key: 'invoiceDate', width: 16, format: 'date' as const },
      { header: 'Due date', key: 'dueDate', width: 16, format: 'date' as const },
      { header: 'Net', key: 'net', width: 14, format: 'number' as const },
      { header: 'VAT', key: 'vat', width: 14, format: 'number' as const },
      { header: 'Total', key: 'total', width: 14, format: 'number' as const },
      { header: 'Currency', key: 'currency', width: 10 },
      { header: 'Status', key: 'status', width: 18 },
      { header: 'Created', key: 'created', width: 20, format: 'datetime' as const },
    ],
    rows: data.invoices.map((invoice) => ({
      invoice: invoice.invoice_number ?? invoice.id,
      job: invoice.job_id ?? '',
      counterparty: invoice.client_name ?? '',
      invoiceDate: spreadsheetDate(invoice.invoice_date),
      dueDate: spreadsheetDate(invoice.due_date),
      net: Number(invoice.net_amount ?? invoice.amount ?? 0),
      vat: Number(invoice.vat_amount ?? 0),
      total: Number(invoice.amount ?? 0),
      currency: invoice.currency ?? 'GBP',
      status: invoice.payment_status ?? invoice.status,
      created: spreadsheetDate(invoice.created_at),
    })),
  };

  const outstandingSheet = {
    name: 'Outstanding',
    title: 'Outstanding Balances',
    subtitle: reportSubtitle,
    columns: [
      { header: 'Invoice', key: 'invoice', width: 20 },
      { header: 'Job', key: 'job', width: 22 },
      { header: 'Counterparty', key: 'counterparty', width: 28 },
      { header: 'Due date', key: 'dueDate', width: 16, format: 'date' as const },
      { header: 'Amount', key: 'amount', width: 14, format: 'number' as const },
      { header: 'Currency', key: 'currency', width: 10 },
      { header: 'Status', key: 'status', width: 18 },
    ],
    rows: outstanding.map((invoice) => ({
      invoice: invoice.invoice_number ?? invoice.id,
      job: invoice.job_id ?? '',
      counterparty: invoice.client_name ?? '',
      dueDate: spreadsheetDate(invoice.due_date),
      amount: Number(invoice.amount ?? 0),
      currency: invoice.currency ?? 'GBP',
      status: invoice.payment_status ?? invoice.status,
    })),
  };

  const jobsSheet = {
    name: 'Jobs',
    title: 'Job Commercial & Operations Register',
    subtitle: reportSubtitle,
    columns: [
      { header: 'Job ID', key: 'job', width: 22 },
      { header: 'Booking ref', key: 'bookingReference', width: 18 },
      { header: 'Customer ref', key: 'customerReference', width: 18 },
      { header: 'Customer', key: 'customer', width: 26 },
      { header: 'Collection', key: 'collection', width: 30 },
      { header: 'Collection postcode', key: 'collectionPostcode', width: 18 },
      { header: 'Delivery', key: 'delivery', width: 30 },
      { header: 'Delivery postcode', key: 'deliveryPostcode', width: 18 },
      { header: 'Pickup', key: 'pickup', width: 20, format: 'datetime' as const },
      { header: 'Delivery', key: 'deliveryTime', width: 20, format: 'datetime' as const },
      { header: 'Vehicle', key: 'vehicle', width: 18 },
      { header: 'Status', key: 'status', width: 20 },
      { header: 'Customer price GBP', key: 'customerPrice', width: 20, format: 'currency' as const },
      { header: 'Assigned driver', key: 'driver', width: 22 },
      { header: 'Vehicle ID', key: 'vehicleId', width: 22 },
      { header: 'POD generated', key: 'podGenerated', width: 15 },
    ],
    rows: data.jobs.map((job) => ({
      job: job.id,
      bookingReference: job.booking_reference ?? '',
      customerReference: job.customer_reference ?? '',
      customer: job.client_name ?? '',
      collection: job.pickup_location ?? '',
      collectionPostcode: job.pickup_postcode ?? '',
      delivery: job.delivery_location ?? '',
      deliveryPostcode: job.delivery_postcode ?? '',
      pickup: spreadsheetDate(job.pickup_datetime),
      deliveryTime: spreadsheetDate(job.delivery_datetime),
      vehicle: job.vehicle_type ?? '',
      status: job.current_status ?? job.status,
      customerPrice: Number(job.budget_amount ?? 0),
      driver: job.assigned_driver_id ?? '',
      vehicleId: job.vehicle_id ?? '',
      podGenerated: job.pod_generated === true ? 'Yes' : 'No',
    })),
  };

  const summarySheet = {
    name: 'Summary',
    title: 'XDrive Logistics Report Summary',
    subtitle: reportSubtitle,
    columns: [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 22 },
      { header: 'Notes', key: 'notes', width: 46 },
    ],
    rows: [
      { metric: 'Invoice records', value: data.invoices.length, notes: 'Invoices in current company scope' },
      { metric: 'Invoice value GBP', value: invoiceValue, notes: 'Recorded invoice gross value' },
      { metric: 'Outstanding invoices', value: outstanding.length, notes: 'Invoices not marked paid' },
      { metric: 'Outstanding value GBP', value: outstandingValue, notes: 'Recorded unpaid value' },
      { metric: 'Jobs in scope', value: data.jobs.length, notes: 'Operational jobs available to this workspace' },
    ],
  };

  const exportInvoices = () => downloadXlsx('xdrive-invoice-register.xlsx', [invoiceSheet]);
  const exportBalances = () => downloadXlsx('xdrive-outstanding-balances.xlsx', [outstandingSheet]);
  const exportJobs = () => downloadXlsx('xdrive-job-commercial-summary.xlsx', [jobsSheet]);
  const exportFullWorkbook = () =>
    downloadXlsx('xdrive-reports-and-data.xlsx', [summarySheet, jobsSheet, invoiceSheet, outstandingSheet]);

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Finance / Reports & Data"
        title="Reports & Exports"
        description="Generate company-scoped Excel workbooks from the operational and finance registers."
      />
      <KpiGrid>
        <KpiCard label="Invoices" value={data.invoices.length} tone="blue" />
        <KpiCard label="Invoice value" value={money(invoiceValue)} tone="green" />
        <KpiCard label="Outstanding value" value={money(outstandingValue)} tone="orange" />
        <KpiCard label="Jobs in report scope" value={data.jobs.length} tone="navy" />
      </KpiGrid>
      <div className="workspace-record-meta workspace-list-controls" style={{ justifyContent: 'flex-end' }}>
        <span className="workspace-list-controls__right"><ActionButton tone="secondary" disabled={data.invoices.length === 0 && data.jobs.length === 0} onClick={() => void exportFullWorkbook()}>Export Full Workbook</ActionButton></span>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 'var(--ws-gap-grid, 12px)',
        }}
      >
        <Panel
          title="Invoice register"
          description="Professional XLSX register with invoice, job, counterparty, net, VAT, total, due date and payment status."
          actions={
            <ActionButton tone="secondary" disabled={data.invoices.length === 0} onClick={() => void exportInvoices()}>
              Export XLSX
            </ActionButton>
          }
        >
          <p style={{ margin: 0, color: '#64748b', fontSize: 'var(--ws-font-body, 14px)' }}>
            {data.invoices.length} invoice record(s) in the current company scope.
          </p>
        </Panel>
        <Panel
          title="Outstanding balances"
          description="Excel reconciliation register for unpaid balances requiring finance follow-up."
          actions={
            <ActionButton tone="secondary" disabled={outstanding.length === 0} onClick={() => void exportBalances()}>
              Export XLSX
            </ActionButton>
          }
        >
          <p style={{ margin: 0, color: '#64748b', fontSize: 'var(--ws-font-body, 14px)' }}>
            {outstanding.length} outstanding record(s), total {money(outstandingValue)}.
          </p>
        </Panel>
        <Panel
          title="Job commercial summary"
          description="Operational XLSX register with route, references, dates, vehicle, status, price, allocation and POD readiness."
          actions={
            <ActionButton tone="secondary" disabled={data.jobs.length === 0} onClick={() => void exportJobs()}>
              Export XLSX
            </ActionButton>
          }
        >
          <p style={{ margin: 0, color: '#64748b', fontSize: 'var(--ws-font-body, 14px)' }}>
            {data.jobs.length} job record(s) in the current company scope.
          </p>
        </Panel>
      </div>
    </PageFrame>
  );
}
