'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useCompanyWorkspaceData } from './useCompanyWorkspaceData';
import {
  ActionButton,
  AlertBanner,
  DataTable,
  EmptyState,
  FinancialSummaryPanel,
  KpiCard,
  KpiGrid,
  OperationalLinkList,
  Panel,
  QuickActionGrid,
  StatusBadge,
  TwoColumn,
  workspaceTheme,
} from './WorkspaceUI';
import { DashboardHomeHeader } from './DashboardHomePrimitives';
import {
  activeStatuses,
  daysUntil,
  exceptionStatuses,
  metricDetail,
  metricTone,
  metricValue,
  money,
  terminalStatuses,
  unavailable,
  when,
} from './AdminDashboardShared';
import { getWorkspaceDatasetMetricValue } from './useCompanyWorkspaceData';

export default function CarrierOperationsDashboardHome() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();

  const metrics = useMemo(() => {
    const companyBids = data.bids.filter((bid) => bid.company_id === data.companyId);
    const carrierInvoices = data.invoices.filter((invoice) => invoice.company_id === data.companyId);
    const podOutstanding = data.jobs.filter(
      (job) =>
        ['delivered', 'completed'].includes(job.current_status ?? job.status) &&
        (job.delivery_photos?.length ?? 0) === 0,
    );
    const exceptions = data.jobs.filter((job) =>
      exceptionStatuses.has(job.current_status ?? job.status),
    );
    const overdueInvoices = carrierInvoices.filter(
      (invoice) =>
        invoice.due_date &&
        new Date(invoice.due_date).getTime() < Date.now() &&
        invoice.payment_status !== 'paid' &&
        !['paid', 'Paid'].includes(invoice.status),
    );
    const wonValue = companyBids
      .filter((bid) => bid.status === 'accepted')
      .reduce((sum, bid) => sum + Number(bid.bid_price_gbp ?? bid.amount ?? 0), 0);

    return {
      podOutstanding,
      exceptions,
      overdueInvoices,
      wonValue,
      availableDrivers: data.drivers.filter((driver) => driver.availability_status === 'available').length,
      busyDrivers: data.drivers.filter((driver) => driver.availability_status === 'busy').length,
      availableVehicles: data.vehicles.filter((vehicle) => !vehicle.assigned_driver_id).length,
      expiringDocuments: data.driverDocuments
        .concat(data.vehicleDocuments)
        .filter((document) => {
          const days = daysUntil(document.expiry_date);
          return days !== null && days <= 30;
        }).length,
    };
  }, [data]);

  const attentionJobs = useMemo(
    () =>
      data.jobs
        .filter((job) => !terminalStatuses.has(job.current_status ?? job.status))
        .sort((a, b) => {
          const score = (job: typeof a) => {
            const status = job.current_status ?? job.status;
            if (exceptionStatuses.has(status)) return 0;
            if (!job.assigned_driver_id && ['posted', 'awarded'].includes(job.status)) return 1;
            if (activeStatuses.has(status)) return 2;
            return 3;
          };
          return score(a) - score(b);
        }),
    [data.jobs],
  );

  return (
    <div style={{ width: '100%', padding: '12px 12px 16px' }}>
      <DashboardHomeHeader
        eyebrow="Carrier operations"
        title="Carrier Dashboard"
        badge="Operations control"
        description="Find work, price opportunities, allocate resources and run delivery through POD and invoicing. Exceptions and unallocated work stay ahead of reporting."
        actions={
          <>
            <ActionButton tone="success" onClick={() => router.push('/admin/marketplace')}>Find Loads</ActionButton>
            <ActionButton tone="secondary" onClick={() => router.push('/admin/diary')}>Open Diary</ActionButton>
          </>
        }
      />

      {data.error ? <AlertBanner>{data.error}</AlertBanner> : null}

      <KpiGrid>
        <KpiCard
          label="Quotes submitted"
          value={getWorkspaceDatasetMetricValue(data.datasets.bids, (rows) => rows.filter((bid) => bid.company_id === data.companyId && ['submitted', 'pending'].includes(bid.status)).length)}
          detail={metricDetail(data, ['bids'], 'Awaiting commercial decision')}
          tone="blue"
          onClick={() => router.push('/admin/quotes')}
        />
        <KpiCard
          label="Won work"
          value={getWorkspaceDatasetMetricValue(data.datasets.bids, (rows) => rows.filter((bid) => bid.company_id === data.companyId && bid.status === 'accepted').length)}
          detail={metricDetail(data, ['bids'], 'Accepted quotes')}
          tone={metricTone(data, ['bids'], 'green')}
          onClick={() => router.push('/admin/bids')}
        />
        <KpiCard
          label="Awaiting allocation"
          value={getWorkspaceDatasetMetricValue(data.datasets.jobs, (rows) => rows.filter((job) => ['posted', 'awarded'].includes(job.status) && !job.assigned_driver_id).length)}
          detail={metricDetail(data, ['jobs'], 'Driver and vehicle required')}
          tone={metricTone(data, ['jobs'], 'orange')}
          onClick={() => router.push('/admin/fleet/assignments')}
        />
        <KpiCard
          label="Active jobs"
          value={getWorkspaceDatasetMetricValue(data.datasets.jobs, (rows) => rows.filter((job) => activeStatuses.has(job.current_status ?? job.status)).length)}
          detail={metricDetail(data, ['jobs'], 'Collections and deliveries')}
          tone={metricTone(data, ['jobs'], 'green')}
          onClick={() => router.push('/admin/fleet/active-jobs')}
        />
        <KpiCard
          label="POD outstanding"
          value={getWorkspaceDatasetMetricValue(data.datasets.jobs, (rows) => rows.filter((job) => ['delivered', 'completed'].includes(job.current_status ?? job.status) && (job.delivery_photos?.length ?? 0) === 0).length)}
          detail={metricDetail(data, ['jobs'], 'Delivered without proof')}
          tone={metricTone(data, ['jobs'], metrics.podOutstanding.length ? 'red' : 'navy')}
          onClick={() => router.push('/admin/documents?view=pod')}
        />
        <KpiCard
          label="Exceptions"
          value={getWorkspaceDatasetMetricValue(data.datasets.jobs, (rows) => rows.filter((job) => exceptionStatuses.has(job.current_status ?? job.status)).length)}
          detail={metricDetail(data, ['jobs'], 'Failed or disputed work')}
          tone={metricTone(data, ['jobs'], metrics.exceptions.length ? 'red' : 'green')}
          onClick={() => router.push('/admin/incidents')}
        />
      </KpiGrid>

      <Panel
        title="Jobs requiring attention"
        description="Exceptions, unallocated work and live jobs are ordered before routine records."
        actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/jobs')}>All jobs</ActionButton>}
        style={{ marginTop: '12px' }}
      >
        <DataTable
          columns={['Route', 'Pickup', 'Vehicle', 'Assignment', 'Status', 'Action']}
          rows={attentionJobs.slice(0, 9).map((job) => [
            <strong key="route">{job.pickup_location ?? job.pickup_postcode ?? 'Collection'} → {job.delivery_location ?? job.delivery_postcode ?? 'Delivery'}</strong>,
            when(job.pickup_datetime),
            (job.vehicle_type ?? 'Not specified').replace(/_/g, ' '),
            job.assigned_driver_id ? 'Assigned' : 'Needs allocation',
            <StatusBadge key="status" value={job.current_status ?? job.status} tone={exceptionStatuses.has(job.current_status ?? job.status) ? 'red' : undefined} />,
            <ActionButton key="action" tone={!job.assigned_driver_id ? 'success' : 'secondary'} onClick={() => router.push(!job.assigned_driver_id ? `/admin/diary?job=${job.id}` : `/admin/jobs/${job.id}`)}>
              {!job.assigned_driver_id ? 'Allocate' : 'Open'}
            </ActionButton>,
          ])}
          empty={<EmptyState compact title={unavailable(data, ['jobs']) ? 'Job data unavailable' : 'No jobs require attention'} />}
        />
      </Panel>

      <TwoColumn>
        <Panel
          title="Resource readiness"
          description="Driver and vehicle capacity available to the carrier."
          style={{ marginTop: '12px' }}
        >
          <OperationalLinkList
            showTrailingArrow={false}
            items={[
              { key: 'available-drivers', label: 'Available drivers', value: unavailable(data, ['drivers']) ? '—' : metrics.availableDrivers, onClick: () => router.push('/admin/drivers') },
              { key: 'busy-drivers', label: 'Busy drivers', value: unavailable(data, ['drivers']) ? '—' : metrics.busyDrivers, onClick: () => router.push('/admin/drivers') },
              { key: 'available-vehicles', label: 'Unassigned vehicles', value: unavailable(data, ['vehicles']) ? '—' : metrics.availableVehicles, onClick: () => router.push('/admin/vehicles') },
              { key: 'expiry', label: 'Document expiry alerts', value: unavailable(data, ['driverDocuments', 'vehicleDocuments']) ? '—' : metrics.expiringDocuments, onClick: () => router.push('/admin/documents/expiry') },
            ]}
          />
        </Panel>

        <div style={{ display: 'grid', gap: '12px', marginTop: '12px' }}>
          <Panel title="Commercial position" description="Finance stays visible without displacing operational work.">
            <FinancialSummaryPanel
              items={[
                {
                  label: 'Won work value',
                  detail: 'Accepted quote total',
                  value: metricValue(data, ['bids'], () => money(metrics.wonValue)),
                  color: workspaceTheme.green,
                  background: '#F0FDF4',
                },
                {
                  label: 'Overdue invoices',
                  detail: 'Past due carrier invoices',
                  value: unavailable(data, ['invoices']) ? '—' : metrics.overdueInvoices.length,
                  color: metrics.overdueInvoices.length ? workspaceTheme.red : workspaceTheme.green,
                  background: metrics.overdueInvoices.length ? '#FEF2F2' : '#F0FDF4',
                },
                {
                  label: 'POD follow-up',
                  detail: 'Delivered work missing proof',
                  value: unavailable(data, ['jobs']) ? '—' : metrics.podOutstanding.length,
                  color: metrics.podOutstanding.length ? workspaceTheme.orange : workspaceTheme.navy,
                  background: metrics.podOutstanding.length ? '#FFF8E8' : workspaceTheme.surfaceMuted,
                },
              ]}
            />
          </Panel>

          <Panel title="Carrier actions" description="Commercial, fleet and finance shortcuts for this role.">
            <QuickActionGrid
              actions={[
                { key: 'marketplace', label: 'Find marketplace loads', onClick: () => router.push('/admin/marketplace') },
                { key: 'quotes', label: 'Review my quotes', onClick: () => router.push('/admin/quotes') },
                { key: 'allocate', label: 'Allocate awarded work', onClick: () => router.push('/admin/fleet/assignments') },
                { key: 'positions', label: 'Live fleet positions', onClick: () => router.push('/admin/fleet/positions') },
                { key: 'invoices', label: 'Invoices', onClick: () => router.push('/admin/invoices') },
                { key: 'incidents', label: 'Incidents', onClick: () => router.push('/admin/incidents') },
              ]}
            />
          </Panel>
        </div>
      </TwoColumn>
    </div>
  );
}
