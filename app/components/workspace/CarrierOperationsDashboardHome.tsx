'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  getWorkspaceDatasetMetricValue,
  useCompanyWorkspaceData,
  type WorkspaceJob,
} from './useCompanyWorkspaceData';
import {
  ActionButton,
  AlertBanner,
  DataTable,
  EmptyState,
  OperationalCard,
  OperationalFilterField,
  OperationalFilterInput,
  OperationalFilterSelect,
  OperationalFilters,
  OperationalPageLayout,
  OperationalToolbar,
  StatusBadge,
  workspaceTheme,
} from './WorkspaceUI';
import { DashboardHomeHeader } from './DashboardHomePrimitives';
import styles from './WorkspaceUI.module.css';
import {
  activeStatuses,
  daysUntil,
  exceptionStatuses,
  metricValue,
  money,
  unavailable,
  when,
} from './AdminDashboardShared';

type ControlView = 'attention' | 'unallocated' | 'live' | 'pod' | 'exceptions' | 'all';

type ControlSignal = {
  key: ControlView | 'drivers';
  label: string;
  value: ReactNode;
  tone: string;
  active?: boolean;
  onClick: () => void;
};

const CONTROL_VIEWS: Array<{ value: ControlView; label: string }> = [
  { value: 'attention', label: 'Needs attention' },
  { value: 'unallocated', label: 'Unallocated' },
  { value: 'live', label: 'Live jobs' },
  { value: 'pod', label: 'POD outstanding' },
  { value: 'exceptions', label: 'Exceptions' },
  { value: 'all', label: 'All work' },
];

const normalise = (value: string | null | undefined) => String(value ?? '').trim().toLowerCase();

const jobStatus = (job: WorkspaceJob) => normalise(job.current_status ?? job.status);

const isUnallocatedJob = (job: WorkspaceJob) =>
  !job.assigned_driver_id && ['posted', 'awarded'].includes(normalise(job.status));

const isPodOutstandingJob = (job: WorkspaceJob) =>
  ['delivered', 'completed'].includes(jobStatus(job)) && (job.delivery_photos?.length ?? 0) === 0;

const isExceptionJob = (job: WorkspaceJob) => exceptionStatuses.has(jobStatus(job));

const isLiveJob = (job: WorkspaceJob) => activeStatuses.has(jobStatus(job));

export const isCarrierAttentionJob = (job: WorkspaceJob) =>
  isExceptionJob(job) || isUnallocatedJob(job) || isPodOutstandingJob(job);

const attentionScore = (job: WorkspaceJob) => {
  if (isExceptionJob(job)) return 0;
  if (isUnallocatedJob(job)) return 1;
  if (isLiveJob(job)) return 2;
  if (isPodOutstandingJob(job)) return 3;
  return 4;
};

const priorityLabel = (job: WorkspaceJob) => {
  if (isExceptionJob(job)) return 'Exception';
  if (isUnallocatedJob(job)) return 'Allocate';
  if (isLiveJob(job)) return 'Live';
  if (isPodOutstandingJob(job)) return 'POD';
  return 'Routine';
};

const priorityStyle = (job: WorkspaceJob) => {
  if (isExceptionJob(job)) return { color: workspaceTheme.red, background: '#FEF2F2', border: '#FECACA' };
  if (isUnallocatedJob(job)) return { color: '#92400E', background: '#FFFBEB', border: '#FDE68A' };
  if (isLiveJob(job)) return { color: workspaceTheme.blue, background: '#EFF6FF', border: '#BFDBFE' };
  if (isPodOutstandingJob(job)) return { color: '#92400E', background: '#FFF8E8', border: '#FDE68A' };
  return { color: workspaceTheme.muted, background: workspaceTheme.surfaceMuted, border: workspaceTheme.border };
};

const moneyOrDash = (value: number) => (value > 0 ? money(value) : '—');

function CarrierControlSignals({ signals }: { signals: ControlSignal[] }) {
  return (
    <div
      className={styles.carrierControlSignals}
      data-testid="carrier-control-signals"
      aria-label="Carrier control signals"
      style={{
        border: `1px solid ${workspaceTheme.border}`,
        borderRadius: '4px',
        background: workspaceTheme.surface,
        marginBottom: '8px',
      }}
    >
      <div className={styles.carrierControlSignalsGrid}>
        {signals.map((signal) => (
          <button
            className={styles.carrierControlSignal}
            key={signal.key}
            type="button"
            onClick={signal.onClick}
            aria-pressed={signal.active}
            style={{
              minHeight: '54px',
              padding: '6px 9px',
              border: 0,
              borderTop: `3px solid ${signal.tone}`,
              background: signal.active ? '#F1F6FF' : workspaceTheme.surface,
              color: workspaceTheme.text,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span style={{ display: 'block', color: workspaceTheme.muted, fontSize: '10px', lineHeight: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              {signal.label}
            </span>
            <strong style={{ display: 'block', marginTop: '2px', color: signal.active ? workspaceTheme.blue : workspaceTheme.navy, fontSize: '20px', lineHeight: '24px', fontWeight: 800 }}>
              {signal.value}
            </strong>
          </button>
        ))}
      </div>
    </div>
  );
}

function RailMetric({ label, value, onClick }: { label: string; value: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        minHeight: '28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        padding: '5px 0',
        border: 0,
        borderBottom: `1px solid ${workspaceTheme.divider}`,
        background: 'transparent',
        color: workspaceTheme.text,
        cursor: 'pointer',
        textAlign: 'left',
        fontSize: '11px',
      }}
    >
      <span>{label}</span>
      <strong style={{ color: workspaceTheme.navy, fontSize: '12px' }}>{value}</strong>
    </button>
  );
}

function WorkflowLink({ label, detail, onClick }: { label: string; detail: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        display: 'grid',
        gridTemplateColumns: 'minmax(0,1fr) auto',
        alignItems: 'center',
        gap: '8px',
        minHeight: '38px',
        padding: '6px 0',
        border: 0,
        borderBottom: `1px solid ${workspaceTheme.divider}`,
        background: 'transparent',
        color: workspaceTheme.text,
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      <span style={{ minWidth: 0 }}>
        <strong style={{ display: 'block', fontSize: '12px', lineHeight: '16px', fontWeight: 650 }}>{label}</strong>
        <span style={{ display: 'block', color: workspaceTheme.muted, fontSize: '10px', lineHeight: '13px' }}>{detail}</span>
      </span>
      <span aria-hidden="true" style={{ color: workspaceTheme.blue, fontSize: '14px', fontWeight: 800 }}>→</span>
    </button>
  );
}

function CommercialRow({ label, detail, value, onClick }: { label: string; detail: string; value: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        display: 'grid',
        gridTemplateColumns: 'minmax(0,1fr) auto',
        alignItems: 'center',
        gap: '10px',
        minHeight: '42px',
        padding: '6px 0',
        border: 0,
        borderBottom: `1px solid ${workspaceTheme.divider}`,
        background: 'transparent',
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      <span>
        <strong style={{ display: 'block', color: workspaceTheme.text, fontSize: '12px', lineHeight: '16px', fontWeight: 650 }}>{label}</strong>
        <span style={{ display: 'block', color: workspaceTheme.muted, fontSize: '10px', lineHeight: '13px' }}>{detail}</span>
      </span>
      <strong style={{ color: workspaceTheme.navy, fontSize: '13px', whiteSpace: 'nowrap' }}>{value}</strong>
    </button>
  );
}

export default function CarrierOperationsDashboardHome() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();
  const [view, setView] = useState<ControlView>('attention');
  const [searchDraft, setSearchDraft] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [driverFilter, setDriverFilter] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');

  const driverById = useMemo(
    () => new Map(data.drivers.map((driver) => [driver.id, driver.display_name ?? driver.email ?? 'Driver'])),
    [data.drivers],
  );

  const vehicleTypes = useMemo(
    () => Array.from(new Set(data.jobs.map((job) => job.vehicle_type).filter((value): value is string => Boolean(value)))).sort(),
    [data.jobs],
  );

  const metrics = useMemo(() => {
    const companyBids = data.bids.filter((bid) => bid.company_id === data.companyId);
    const carrierInvoices = data.invoices.filter((invoice) => invoice.company_id === data.companyId);
    const unallocatedJobs = data.jobs.filter(isUnallocatedJob);
    const liveJobs = data.jobs.filter(isLiveJob);
    const podOutstanding = data.jobs.filter(isPodOutstandingJob);
    const exceptions = data.jobs.filter(isExceptionJob);
    const attentionJobs = data.jobs
      .filter(isCarrierAttentionJob)
      .sort((a, b) => attentionScore(a) - attentionScore(b));
    const overdueInvoices = carrierInvoices.filter(
      (invoice) =>
        invoice.due_date &&
        new Date(invoice.due_date).getTime() < Date.now() &&
        invoice.payment_status !== 'paid' &&
        !['paid', 'Paid'].includes(invoice.status),
    );
    const overdueExposure = overdueInvoices.reduce((sum, invoice) => sum + Number(invoice.amount ?? invoice.net_amount ?? 0), 0);
    const wonValue = companyBids
      .filter((bid) => bid.status === 'accepted')
      .reduce((sum, bid) => sum + Number(bid.bid_price_gbp ?? bid.amount ?? 0), 0);
    const quotesAwaitingDecision = companyBids.filter((bid) => ['submitted', 'pending'].includes(normalise(bid.status)));
    const availableDrivers = data.drivers.filter((driver) => driver.availability_status === 'available').length;
    const busyDrivers = data.drivers.filter((driver) => driver.availability_status === 'busy').length;
    const unassignedVehicles = data.vehicles.filter((vehicle) => !vehicle.assigned_driver_id).length;
    const expiringDocuments = data.driverDocuments
      .concat(data.vehicleDocuments)
      .filter((document) => {
        const days = daysUntil(document.expiry_date);
        return days !== null && days <= 30;
      }).length;

    return {
      companyBids,
      unallocatedJobs,
      liveJobs,
      podOutstanding,
      exceptions,
      attentionJobs,
      overdueInvoices,
      overdueExposure,
      wonValue,
      quotesAwaitingDecision,
      availableDrivers,
      busyDrivers,
      unassignedVehicles,
      expiringDocuments,
    };
  }, [data]);

  const filteredJobs = useMemo(() => {
    const base = view === 'attention'
      ? metrics.attentionJobs
      : view === 'unallocated'
        ? metrics.unallocatedJobs
        : view === 'live'
          ? metrics.liveJobs
          : view === 'pod'
            ? metrics.podOutstanding
            : view === 'exceptions'
              ? metrics.exceptions
              : data.jobs;

    const query = normalise(searchTerm);

    return base
      .filter((job) => !driverFilter || job.assigned_driver_id === driverFilter)
      .filter((job) => !vehicleFilter || job.vehicle_type === vehicleFilter)
      .filter((job) => {
        if (!query) return true;
        const driver = job.assigned_driver_id ? driverById.get(job.assigned_driver_id) : '';
        const haystack = [
          job.id,
          job.pickup_location,
          job.pickup_postcode,
          job.delivery_location,
          job.delivery_postcode,
          job.client_name,
          job.vehicle_type,
          driver,
          job.status,
          job.current_status,
        ].map(normalise).join(' ');
        return haystack.includes(query);
      })
      .sort((a, b) => {
        const priority = attentionScore(a) - attentionScore(b);
        if (priority !== 0) return priority;
        const aTime = a.pickup_datetime ? new Date(a.pickup_datetime).getTime() : Number.MAX_SAFE_INTEGER;
        const bTime = b.pickup_datetime ? new Date(b.pickup_datetime).getTime() : Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      });
  }, [data.jobs, driverById, driverFilter, metrics, searchTerm, vehicleFilter, view]);

  const jobCount = (compute: (rows: WorkspaceJob[]) => number) =>
    getWorkspaceDatasetMetricValue(data.datasets.jobs, compute);

  const viewCounts: Record<ControlView, ReactNode> = {
    attention: jobCount((rows) => rows.filter(isCarrierAttentionJob).length),
    unallocated: jobCount((rows) => rows.filter(isUnallocatedJob).length),
    live: jobCount((rows) => rows.filter(isLiveJob).length),
    pod: jobCount((rows) => rows.filter(isPodOutstandingJob).length),
    exceptions: jobCount((rows) => rows.filter(isExceptionJob).length),
    all: jobCount((rows) => rows.length),
  };

  const signals: ControlSignal[] = [
    { key: 'attention', label: 'Needs attention', value: viewCounts.attention, tone: workspaceTheme.orange, active: view === 'attention', onClick: () => setView('attention') },
    { key: 'unallocated', label: 'Awaiting allocation', value: viewCounts.unallocated, tone: workspaceTheme.orange, active: view === 'unallocated', onClick: () => setView('unallocated') },
    { key: 'live', label: 'Live jobs', value: viewCounts.live, tone: workspaceTheme.blue, active: view === 'live', onClick: () => setView('live') },
    { key: 'pod', label: 'POD outstanding', value: viewCounts.pod, tone: workspaceTheme.navy, active: view === 'pod', onClick: () => setView('pod') },
    {
      key: 'drivers',
      label: 'Available drivers',
      value: getWorkspaceDatasetMetricValue(data.datasets.drivers, (rows) => rows.filter((driver) => driver.availability_status === 'available').length),
      tone: workspaceTheme.green,
      onClick: () => router.push('/admin/drivers'),
    },
    { key: 'exceptions', label: 'Exceptions', value: viewCounts.exceptions, tone: workspaceTheme.red, active: view === 'exceptions', onClick: () => setView('exceptions') },
  ];

  const activeViewLabel = CONTROL_VIEWS.find((item) => item.value === view)?.label ?? 'Work';

  return (
    <div style={{ width: '100%', padding: '12px 12px 16px' }}>
      <DashboardHomeHeader
        eyebrow="Carrier operations"
        title="Carrier Control Desk"
        badge="Live operations"
        description="A working desk for awarded freight, allocation, live delivery, POD and exceptions. Operational records stay in front of reporting and shortcuts."
        actions={
          <>
            <ActionButton tone="success" onClick={() => router.push('/admin/marketplace')}>Find Loads</ActionButton>
            <ActionButton tone="secondary" onClick={() => router.push('/admin/diary')}>Open Diary</ActionButton>
          </>
        }
      />

      {data.error ? <AlertBanner>{data.error}</AlertBanner> : null}

      <OperationalToolbar>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flexWrap: 'wrap' }}>
          <strong style={{ color: workspaceTheme.navy, fontSize: '12px' }}>Operations</strong>
          <span style={{ color: workspaceTheme.muted, fontSize: '11px' }}>Allocation · execution · POD · exception recovery</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <ActionButton tone="secondary" onClick={() => router.push('/admin/jobs')}>Jobs</ActionButton>
          <ActionButton tone="secondary" onClick={() => router.push('/admin/fleet/positions')}>Live Positions</ActionButton>
          <ActionButton tone="secondary" onClick={() => router.push('/admin/quotes')}>Quotes</ActionButton>
          <ActionButton tone="primary" disabled={data.loading} onClick={() => { void data.refresh(); }}>
            {data.loading ? 'Refreshing…' : 'Refresh'}
          </ActionButton>
        </div>
      </OperationalToolbar>

      <CarrierControlSignals signals={signals} />

      <OperationalPageLayout
        style={{ padding: 0 }}
        searchPanel={
          <OperationalFilters
            title="Control filters"
            onSearch={() => setSearchTerm(searchDraft.trim())}
            onClear={() => {
              setSearchDraft('');
              setSearchTerm('');
              setView('attention');
              setDriverFilter('');
              setVehicleFilter('');
            }}
            footer={
              <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: `1px solid ${workspaceTheme.border}` }}>
                <div style={{ marginBottom: '3px', color: workspaceTheme.navy, fontSize: '10px', lineHeight: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Resource readiness
                </div>
                <RailMetric
                  label="Available drivers"
                  value={getWorkspaceDatasetMetricValue(data.datasets.drivers, (rows) => rows.filter((driver) => driver.availability_status === 'available').length)}
                  onClick={() => router.push('/admin/drivers')}
                />
                <RailMetric
                  label="Busy drivers"
                  value={getWorkspaceDatasetMetricValue(data.datasets.drivers, (rows) => rows.filter((driver) => driver.availability_status === 'busy').length)}
                  onClick={() => router.push('/admin/drivers')}
                />
                <RailMetric
                  label="Unassigned vehicles"
                  value={getWorkspaceDatasetMetricValue(data.datasets.vehicles, (rows) => rows.filter((vehicle) => !vehicle.assigned_driver_id).length)}
                  onClick={() => router.push('/admin/vehicles')}
                />
                <RailMetric
                  label="Document expiry alerts"
                  value={unavailable(data, ['driverDocuments', 'vehicleDocuments']) ? '—' : metrics.expiringDocuments}
                  onClick={() => router.push('/admin/documents/expiry')}
                />
              </div>
            }
          >
            <OperationalFilterField label="Find work" htmlFor="carrier-work-search">
              <OperationalFilterInput
                id="carrier-work-search"
                value={searchDraft}
                onChange={setSearchDraft}
                onClear={() => { setSearchDraft(''); setSearchTerm(''); }}
                placeholder="Ref, route, client"
              />
            </OperationalFilterField>
            <OperationalFilterField label="Work view" htmlFor="carrier-work-view">
              <OperationalFilterSelect
                id="carrier-work-view"
                value={view}
                onChange={(value) => setView(value as ControlView)}
                options={CONTROL_VIEWS}
              />
            </OperationalFilterField>
            <OperationalFilterField label="Driver" htmlFor="carrier-driver-filter">
              <OperationalFilterSelect
                id="carrier-driver-filter"
                value={driverFilter}
                onChange={setDriverFilter}
                options={[
                  { value: '', label: 'All drivers' },
                  ...data.drivers.map((driver) => ({ value: driver.id, label: driver.display_name ?? driver.email ?? 'Driver' })),
                ]}
              />
            </OperationalFilterField>
            <OperationalFilterField label="Vehicle type" htmlFor="carrier-vehicle-filter">
              <OperationalFilterSelect
                id="carrier-vehicle-filter"
                value={vehicleFilter}
                onChange={setVehicleFilter}
                options={[
                  { value: '', label: 'All vehicle types' },
                  ...vehicleTypes.map((vehicle) => ({ value: vehicle, label: vehicle.replace(/_/g, ' ') })),
                ]}
              />
            </OperationalFilterField>
          </OperationalFilters>
        }
      >
        <section
          aria-label="Carrier operational workboard"
          style={{
            background: workspaceTheme.surface,
            border: `1px solid ${workspaceTheme.border}`,
            borderRadius: '4px',
            overflow: 'hidden',
          }}
        >
          <div style={{ minHeight: '40px', padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', borderBottom: `1px solid ${workspaceTheme.border}`, background: workspaceTheme.surfaceMuted, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ margin: 0, color: workspaceTheme.navy, fontSize: '13px', lineHeight: '18px', fontWeight: 800 }}>Operational workboard</h2>
              <p style={{ margin: '1px 0 0', color: workspaceTheme.muted, fontSize: '10px', lineHeight: '13px' }}>{activeViewLabel} · actions remain beside each job</p>
            </div>
            <div style={{ color: workspaceTheme.muted, fontSize: '11px', fontWeight: 650 }}>
              {data.datasets.jobs.availability === 'unavailable' ? 'Job data unavailable' : `${filteredJobs.length} visible`}
            </div>
          </div>

          <div role="tablist" aria-label="Carrier work views" style={{ display: 'flex', alignItems: 'stretch', minHeight: '36px', overflowX: 'auto', borderBottom: `1px solid ${workspaceTheme.border}`, background: workspaceTheme.surface }}>
            {CONTROL_VIEWS.map((item) => {
              const selected = item.value === view;
              return (
                <button
                  key={item.value}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setView(item.value)}
                  style={{
                    height: '36px',
                    padding: '0 10px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    border: 0,
                    borderBottom: `2px solid ${selected ? workspaceTheme.blue : 'transparent'}`,
                    background: selected ? '#F1F6FF' : 'transparent',
                    color: selected ? workspaceTheme.blue : workspaceTheme.muted,
                    fontSize: '11px',
                    fontWeight: selected ? 800 : 650,
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                  }}
                >
                  {item.label}
                  <span style={{ minWidth: '18px', height: '18px', padding: '0 4px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '9px', background: selected ? workspaceTheme.blue : workspaceTheme.surfaceMuted, color: selected ? '#fff' : workspaceTheme.text, fontSize: '10px', fontWeight: 800 }}>
                    {viewCounts[item.value]}
                  </span>
                </button>
              );
            })}
          </div>

          <div style={{ margin: '-1px' }}>
            <DataTable
              columns={['Ref', 'Priority', 'Route', 'Pickup', 'Vehicle', 'Driver', 'Status', 'Action']}
              rows={filteredJobs.slice(0, 10).map((job) => {
                const priority = priorityStyle(job);
                const assignedDriver = job.assigned_driver_id ? driverById.get(job.assigned_driver_id) ?? 'Assigned' : 'Unassigned';
                const actionPath = isUnallocatedJob(job) ? `/admin/diary?job=${job.id}` : `/admin/jobs/${job.id}`;
                return [
                  job.id.slice(0, 8).toUpperCase(),
                  <span key="priority" style={{ display: 'inline-flex', alignItems: 'center', height: '22px', padding: '0 6px', border: `1px solid ${priority.border}`, borderRadius: '4px', background: priority.background, color: priority.color, fontSize: '10px', fontWeight: 800 }}>{priorityLabel(job)}</span>,
                  <span key="route" style={{ display: 'block', minWidth: '220px' }}>
                    <strong style={{ display: 'block', fontSize: '12px', lineHeight: '16px' }}>{job.pickup_location ?? job.pickup_postcode ?? 'Collection'} → {job.delivery_location ?? job.delivery_postcode ?? 'Delivery'}</strong>
                    <span style={{ display: 'block', color: workspaceTheme.muted, fontSize: '10px', lineHeight: '13px' }}>{job.client_name ?? 'Customer not specified'}</span>
                  </span>,
                  when(job.pickup_datetime),
                  (job.vehicle_type ?? 'Not specified').replace(/_/g, ' '),
                  assignedDriver,
                  <StatusBadge key="status" value={job.current_status ?? job.status} tone={isExceptionJob(job) ? 'red' : undefined} />,
                  <button
                    key="action"
                    type="button"
                    onClick={() => router.push(actionPath)}
                    style={{ height: '28px', padding: '0 9px', border: `1px solid ${isUnallocatedJob(job) ? workspaceTheme.green : workspaceTheme.border}`, borderRadius: '4px', background: isUnallocatedJob(job) ? workspaceTheme.green : '#fff', color: isUnallocatedJob(job) ? '#fff' : workspaceTheme.blue, fontSize: '11px', fontWeight: 750, cursor: 'pointer' }}
                  >
                    {isUnallocatedJob(job) ? 'Allocate' : 'Open'}
                  </button>,
                ];
              })}
              empty={
                <EmptyState
                  compact
                  title={unavailable(data, ['jobs']) ? 'Job data unavailable' : 'No work matches this view'}
                  description={unavailable(data, ['jobs']) ? 'Operational job records cannot be confirmed right now.' : 'Change the control view or clear the filters.'}
                />
              }
            />
          </div>

          <div style={{ minHeight: '34px', padding: '0 9px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', borderTop: `1px solid ${workspaceTheme.border}`, background: workspaceTheme.surfaceMuted, color: workspaceTheme.muted, fontSize: '10px', flexWrap: 'wrap' }}>
            <span>Showing {Math.min(filteredJobs.length, 10)} of {filteredJobs.length} matching jobs</span>
            <button type="button" onClick={() => router.push('/admin/jobs')} style={{ border: 0, background: 'transparent', color: workspaceTheme.blue, fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>Open full jobs register →</button>
          </div>
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '12px', marginTop: '12px' }}>
          <OperationalCard title="Commercial position" subtitle="Commercial hand-off without displacing the live workboard.">
            <CommercialRow
              label="Won work value"
              detail="Accepted carrier quotes"
              value={metricValue(data, ['bids'], () => moneyOrDash(metrics.wonValue))}
              onClick={() => router.push('/admin/bids')}
            />
            <CommercialRow
              label="Overdue invoices"
              detail="Past-due carrier receivables"
              value={metricValue(data, ['invoices'], () => metrics.overdueInvoices.length ? `${metrics.overdueInvoices.length} · ${moneyOrDash(metrics.overdueExposure)}` : '0')}
              onClick={() => router.push('/admin/invoices')}
            />
            <CommercialRow
              label="POD follow-up"
              detail="Delivered work still missing proof"
              value={unavailable(data, ['jobs']) ? '—' : metrics.podOutstanding.length}
              onClick={() => router.push('/admin/documents?view=pod')}
            />
            <CommercialRow
              label="Quotes awaiting decision"
              detail="Submitted pricing still open"
              value={getWorkspaceDatasetMetricValue(data.datasets.bids, (rows) => rows.filter((bid) => bid.company_id === data.companyId && ['submitted', 'pending'].includes(normalise(bid.status))).length)}
              onClick={() => router.push('/admin/quotes')}
            />
          </OperationalCard>

          <OperationalCard title="Carrier workflow" subtitle="Shortcuts follow the carrier operating sequence.">
            <WorkflowLink label="1. Find marketplace work" detail="Search suitable loads and lanes" onClick={() => router.push('/admin/marketplace')} />
            <WorkflowLink label="2. Price and review quotes" detail="Manage submitted commercial offers" onClick={() => router.push('/admin/quotes')} />
            <WorkflowLink label="3. Allocate awarded work" detail="Assign driver and vehicle" onClick={() => router.push('/admin/fleet/assignments')} />
            <WorkflowLink label="4. Control live execution" detail="Monitor active jobs and positions" onClick={() => router.push('/admin/fleet/active-jobs')} />
            <WorkflowLink label="5. Close POD and exceptions" detail="Resolve proof, incidents and disputes" onClick={() => router.push('/admin/incidents')} />
          </OperationalCard>
        </div>
      </OperationalPageLayout>
    </div>
  );
}
