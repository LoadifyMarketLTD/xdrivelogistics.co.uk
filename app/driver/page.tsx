'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthContext';
import { resolveWorkspaceRole } from '../../lib/workspaceRole';
import { useCompanyWorkspaceData } from '../components/workspace/useCompanyWorkspaceData';
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
  TwoColumn,
} from '../components/workspace/WorkspaceUI';

const formatDateTime = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Not set';

const activeStatuses = new Set([
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

export default function DriverDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const workspaceRole = resolveWorkspaceRole(user);
  const ownerDriver = workspaceRole === 'owner_driver';
  const data = useCompanyWorkspaceData();

  const myJobs = useMemo(
    () => data.jobs.filter((job) => !user?.driverId || job.assigned_driver_id === user.driverId || ownerDriver),
    [data.jobs, ownerDriver, user?.driverId]
  );
  const currentJob = myJobs.find((job) => activeStatuses.has(job.current_status ?? job.status));
  const todaysJobs = myJobs.filter((job) =>
    job.pickup_datetime && new Date(job.pickup_datetime).toDateString() === new Date().toDateString()
  );
  const myQuotes = data.bids.filter((bid) => bid.company_id === data.companyId);
  const myDocuments = data.driverDocuments.filter(
    (document) => !user?.driverId || document.driver_id === user.driverId
  );
  const expiringDocuments = myDocuments.filter(
    (document) => document.expiry_date && new Date(document.expiry_date).getTime() < Date.now() + 30 * 86_400_000
  ).length;
  const completedJobs = myJobs.filter((job) => ['delivered', 'completed', 'invoiced', 'paid'].includes(job.status)).length;

  return (
    <PageFrame>
      <PageHeader
        eyebrow={ownerDriver ? 'Owner-driver business' : 'Driver operations'}
        title={ownerDriver ? 'Owner Driver Dashboard' : 'Driver Dashboard'}
        description={
          ownerDriver
            ? 'Find work, manage quotes, execute jobs, capture POD and move completed work into finance.'
            : 'See today’s assigned work, the next required action, availability and document readiness.'
        }
        actions={
          <>
            {ownerDriver && <ActionButton tone="success" onClick={() => router.push('/driver/loads')}>Find loads</ActionButton>}
            <ActionButton tone="secondary" onClick={() => router.push('/driver/availability')}>Availability</ActionButton>
            <ActionButton tone="secondary" onClick={() => router.push('/driver/documents')}>Documents</ActionButton>
          </>
        }
      />

      {data.error && <AlertBanner tone="danger">{data.error}</AlertBanner>}

      <KpiGrid>
        <KpiCard label="Jobs today" value={todaysJobs.length} detail="Scheduled collections" />
        <KpiCard label="Active job" value={currentJob ? 1 : 0} detail="Current execution" tone="green" />
        <KpiCard label="Awaiting start" value={myJobs.filter((job) => ['awarded', 'allocated'].includes(job.status)).length} detail="Ready for driver action" tone="orange" />
        <KpiCard label="Completed work" value={completedJobs} detail="Delivered or invoiced" tone="navy" />
        <KpiCard label="Documents expiring" value={expiringDocuments} detail="Within 30 days" tone={expiringDocuments ? 'red' : 'green'} />
        {ownerDriver && <KpiCard label="Quotes submitted" value={myQuotes.filter((quote) => quote.status === 'submitted').length} tone="purple" />}
        {ownerDriver && <KpiCard label="Won work" value={myQuotes.filter((quote) => quote.status === 'accepted').length} tone="green" />}
      </KpiGrid>

      <TwoColumn>
        <Panel
          title={currentJob ? 'Current job' : 'Next operational work'}
          description="The job card shows the authoritative route, timing and next driver action."
        >
          {currentJob ? (
            <div style={{ display: 'grid', gap: '0.8rem' }}>
              <div>
                <strong style={{ display: 'block', fontSize: '1rem', color: '#0f172a' }}>
                  {currentJob.pickup_location ?? 'Collection'} → {currentJob.delivery_location ?? 'Delivery'}
                </strong>
                <span style={{ display: 'block', color: '#64748b', fontSize: '0.78rem', marginTop: '0.3rem' }}>
                  Pickup {formatDateTime(currentJob.pickup_datetime)} · Delivery {formatDateTime(currentJob.delivery_datetime)}
                </span>
              </div>
              <StatusBadge value={currentJob.current_status ?? currentJob.status} />
              <ActionButton tone="success" onClick={() => router.push(`/driver/jobs/${currentJob.id}`)}>
                Open job and actions
              </ActionButton>
            </div>
          ) : (
            <EmptyState title="No active job" description="Assigned work appears here as soon as it is allocated." />
          )}
        </Panel>

        <Panel title="Today’s schedule" description="All collections scheduled for today in pickup-time order.">
          <DataTable
            columns={['Route', 'Pickup', 'Delivery', 'Status', 'Action']}
            rows={[...todaysJobs]
              .sort((a, b) => String(a.pickup_datetime ?? '').localeCompare(String(b.pickup_datetime ?? '')))
              .map((job) => [
                <strong key="route">{job.pickup_location ?? 'Collection'} → {job.delivery_location ?? 'Delivery'}</strong>,
                formatDateTime(job.pickup_datetime),
                formatDateTime(job.delivery_datetime),
                <StatusBadge key="status" value={job.current_status ?? job.status} />,
                <ActionButton key="action" tone="secondary" onClick={() => router.push(`/driver/jobs/${job.id}`)}>Open</ActionButton>,
              ])}
            empty={<EmptyState title="No jobs scheduled today" description="Use availability to keep dispatch informed." />}
          />
        </Panel>
      </TwoColumn>
    </PageFrame>
  );
}
