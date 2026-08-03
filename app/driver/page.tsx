'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthContext';
import { resolveWorkspaceRole } from '../../lib/workspaceRole';
import { canonicalJobStatus, filterJobsForDriver, recentCompletedJobs } from '../../lib/driverDashboard';
import { useCompanyWorkspaceData } from '../components/workspace/useCompanyWorkspaceData';
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';
import styles from '../components/workspace/WorkspaceUI.module.css';
import {
  ActionButton,
  AlertBanner,
  DataTable,
  EmptyState,
  KpiCard,
  KpiGrid,
  OperationalCard,
  OperationalFilterField,
  OperationalFilters,
  OperationalMetricList,
  OperationalPageLayout,
  PageHeader,
  QuickActionGrid,
  StatusBadge,
  TwoColumn,
} from '../components/workspace/WorkspaceUI';

type OwnerBid = {
  id: string;
  job_id: string;
  bid_price_gbp: number | null;
  status: string;
  created_at: string;
  jobs?: {
    pickup_location: string | null;
    delivery_location: string | null;
    pickup_datetime: string | null;
    status: string;
  }[] | null;
};

const money = (value: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);

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

const upcomingStatuses = new Set(['awarded', 'allocated', 'accepted']);
const completedStatuses = new Set(['delivered', 'completed', 'invoiced', 'paid']);

const BID_STATUS_TONE: Record<string, 'green' | 'orange' | 'red' | 'grey'> = {
  accepted: 'green',
  submitted: 'orange',
  rejected: 'red',
  withdrawn: 'grey',
};

export default function DriverDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const workspaceRole = resolveWorkspaceRole(user);
  const ownerDriver = workspaceRole === 'owner_driver';
  const data = useCompanyWorkspaceData();

  // Owner drivers: fetch their own bids directly by user ID (no company required)
  const [ownerBids, setOwnerBids] = useState<OwnerBid[]>([]);
  const fetchOwnerBids = useCallback(async () => {
    if (!ownerDriver || !user?.id || !isSupabaseConfigured) return;
    const { data: rows } = await supabase
      .from('job_bids')
      .select('id, job_id, bid_price_gbp, status, created_at, jobs(pickup_location, delivery_location, pickup_datetime, status)')
      .eq('bidder_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setOwnerBids((rows ?? []) as OwnerBid[]);
  }, [ownerDriver, user?.id]);

  useEffect(() => { void fetchOwnerBids(); }, [fetchOwnerBids]);

  const myJobs = useMemo(
    () => filterJobsForDriver(data.jobs, { driverId: user?.driverId, ownerDriver }),
    [data.jobs, ownerDriver, user?.driverId]
  );
  const currentJob = myJobs.find((job) => activeStatuses.has(canonicalJobStatus(job.current_status, job.status)));
  const todaysJobs = myJobs.filter((job) =>
    job.pickup_datetime && new Date(job.pickup_datetime).toDateString() === new Date().toDateString()
  );
  const upcomingJobs = myJobs.filter((job) =>
    upcomingStatuses.has(canonicalJobStatus(job.current_status, job.status)) &&
    job.pickup_datetime &&
    new Date(job.pickup_datetime).toDateString() !== new Date().toDateString() &&
    new Date(job.pickup_datetime).getTime() > Date.now()
  ).sort((a, b) => String(a.pickup_datetime).localeCompare(String(b.pickup_datetime)));
  const recentCompleted = recentCompletedJobs(myJobs);

  // Use direct owner bids for owner drivers; fall back to company bids for fleet drivers
  const myQuotes = ownerDriver
    ? ownerBids
    : data.bids.filter((bid) => bid.company_id === data.companyId);

  const myDocuments = data.driverDocuments.filter(
    (document) => !user?.driverId || document.driver_id === user.driverId
  );
  const expiringDocuments = myDocuments.filter(
    (document) => document.expiry_date && new Date(document.expiry_date).getTime() < Date.now() + 30 * 86_400_000
  );
  const completedJobs = myJobs.filter((job) => completedStatuses.has(canonicalJobStatus(job.current_status, job.status))).length;

  const submittedQuotes = myQuotes.filter((q) => q.status === 'submitted').length;
  const wonWork = myQuotes.filter((q) => q.status === 'accepted').length;
  const pendingInvoices = data.invoices.filter(
    (inv) => inv.company_id === data.companyId && !['paid', 'Paid'].includes(inv.status) && inv.payment_status !== 'paid'
  ).length;
  const dashboardKpis: Array<{
    label: string;
    value: number;
    detail: string;
    tone?: 'blue' | 'green' | 'orange' | 'red' | 'navy';
    onClick?: () => void;
  }> = [
    { label: 'Jobs today', value: todaysJobs.length, detail: 'Scheduled collections', onClick: () => router.push('/driver/jobs') },
    {
      label: 'Active job',
      value: currentJob ? 1 : 0,
      detail: 'Current execution',
      tone: 'green',
      onClick: currentJob ? () => router.push(`/driver/jobs/${currentJob.id}`) : undefined,
    },
    { label: 'Awaiting start', value: myJobs.filter((job) => upcomingStatuses.has(job.current_status ?? job.status)).length, detail: 'Allocated, not yet active', tone: 'orange' },
    { label: 'Completed', value: completedJobs, detail: 'Delivered or invoiced', tone: 'navy', onClick: () => router.push('/driver/history') },
    {
      label: 'Documents expiring',
      value: expiringDocuments.length,
      detail: 'Within 30 days',
      tone: expiringDocuments.length ? 'red' : 'green',
      onClick: () => router.push('/driver/documents'),
    },
    ...(ownerDriver
      ? [{
        label: 'Quotes submitted',
        value: submittedQuotes,
        detail: 'Awaiting customer decision',
        tone: 'blue' as const,
        onClick: () => router.push('/driver/quotes'),
      }]
      : []),
  ];

  return (
    <OperationalPageLayout
      searchPanel={(
        <OperationalFilters title={ownerDriver ? 'Owner-driver control desk' : 'Driver control desk'}>
          <OperationalFilterField label="Shift picture">
            <OperationalMetricList
              items={[
                { label: 'Jobs today', value: todaysJobs.length, tone: todaysJobs.length ? 'green' : 'grey' },
                { label: 'Current job', value: currentJob ? 1 : 0, tone: currentJob ? 'green' : 'grey' },
                { label: 'Upcoming work', value: upcomingJobs.length, tone: upcomingJobs.length ? 'orange' : 'green' },
                { label: 'Documents expiring', value: expiringDocuments.length, tone: expiringDocuments.length ? 'red' : 'green' },
              ]}
            />
          </OperationalFilterField>
          <OperationalFilterField label="Quick actions">
            <QuickActionGrid
              actions={[
                ...(ownerDriver ? [{ key: 'find-loads', label: 'Find loads', onClick: () => router.push('/driver/loads') }] : []),
                { key: 'jobs', label: 'Open jobs', onClick: () => router.push('/driver/jobs') },
                { key: 'availability', label: 'Update availability', onClick: () => router.push('/driver/availability') },
                { key: 'documents', label: 'Manage documents', onClick: () => router.push('/driver/documents') },
              ]}
            />
          </OperationalFilterField>
        </OperationalFilters>
      )}
    >
      <PageHeader
        eyebrow={ownerDriver ? 'Owner-driver business' : 'Driver operations'}
        title={ownerDriver ? 'Owner Driver Dashboard' : 'Driver Dashboard'}
        description={
          ownerDriver
            ? 'Find work, manage quotes, execute jobs, capture POD and move completed work into finance.'
            : 'See today\'s assigned work, the next required action, availability and document readiness.'
        }
        actions={
          <>
            {ownerDriver && <ActionButton tone="success" onClick={() => router.push('/driver/loads')}>Find loads</ActionButton>}
            <ActionButton tone="secondary" onClick={() => router.push('/driver/availability')}>Availability</ActionButton>
            <ActionButton tone="secondary" onClick={() => router.push('/driver/documents')}>Documents</ActionButton>
          </>
        }
      />

      {data.error && !ownerDriver && <AlertBanner tone="danger">{data.error}</AlertBanner>}

      <KpiGrid>
        {dashboardKpis.map((kpi) => (
          <KpiCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            detail={kpi.detail}
            tone={kpi.tone}
            onClick={kpi.onClick}
          />
        ))}
      </KpiGrid>

      <TwoColumn>
        <OperationalCard
          title={currentJob ? 'Current job' : 'Next operational work'}
          subtitle="The job card shows the authoritative route, timing and next driver action."
          actions={<ActionButton tone="secondary" onClick={() => router.push('/driver/jobs')}>All jobs</ActionButton>}
        >
          {currentJob ? (
            <div className={styles.driverDashboardCurrentJob}>
              <div>
                <strong className={styles.driverDashboardRoute}>
                  {currentJob.pickup_location ?? 'Collection'} → {currentJob.delivery_location ?? 'Delivery'}
                </strong>
                <span className={styles.driverDashboardMeta}>
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
        </OperationalCard>

        <OperationalCard title="Today's schedule" subtitle="All collections scheduled for today in pickup-time order." flush>
          <DataTable
            columns={['Route', 'Pickup', 'Status', 'Action']}
            rows={[...todaysJobs]
              .sort((a, b) => String(a.pickup_datetime ?? '').localeCompare(String(b.pickup_datetime ?? '')))
              .map((job) => [
                <strong key="route">{job.pickup_location ?? 'Collection'} → {job.delivery_location ?? 'Delivery'}</strong>,
                formatDateTime(job.pickup_datetime),
                <StatusBadge key="status" value={job.current_status ?? job.status} />,
                <ActionButton key="action" tone="secondary" onClick={() => router.push(`/driver/jobs/${job.id}`)}>Open</ActionButton>,
              ])}
            empty={<EmptyState title="No jobs scheduled today" description="Use availability to keep dispatch informed." />}
          />
        </OperationalCard>
      </TwoColumn>

      <TwoColumn>
        <OperationalCard title="Readiness summary" subtitle="Operational shortcuts and account readiness for the next shift.">
          <div className={styles.roleDashboardSummaryList}>
            {[
              ['Upcoming allocated work', upcomingJobs.length, '/driver/jobs'],
              ['Jobs completed', completedJobs, '/driver/history'],
              ['Documents expiring', expiringDocuments.length, '/driver/documents'],
              [ownerDriver ? 'Quote pipeline' : 'Vehicle & profile', ownerDriver ? submittedQuotes + wonWork : null, ownerDriver ? '/driver/quotes' : '/driver/vehicles'],
            ].map(([label, value, href]) => (
              <button
                key={String(label)}
                type="button"
                onClick={() => router.push(String(href))}
                className={styles.roleDashboardSummaryButton}
              >
                <span>{label}</span>
                {value !== null && <strong>{value}</strong>}
              </button>
            ))}
          </div>
        </OperationalCard>

        <OperationalCard title="Recent completed work" subtitle="Delivered jobs and POD-ready history." flush>
          <DataTable
            columns={['Route', 'Delivered', 'Status', 'Action']}
            rows={recentCompleted.map((job) => [
              <strong key="route">{job.pickup_location ?? 'Collection'} → {job.delivery_location ?? 'Delivery'}</strong>,
              formatDateTime(job.delivery_datetime),
              <StatusBadge key="status" value={job.current_status ?? job.status} />,
              <ActionButton key="action" tone="secondary" onClick={() => router.push(`/driver/jobs/${job.id}`)}>Open</ActionButton>,
            ])}
            empty={<EmptyState title="No completed jobs yet" description="Finished work appears here once delivery is confirmed." />}
          />
        </OperationalCard>
      </TwoColumn>

      {upcomingJobs.length > 0 && (
        <OperationalCard title="Upcoming allocated work" subtitle="Jobs already allocated to you scheduled for future dates." actions={<ActionButton tone="secondary" onClick={() => router.push('/driver/jobs')}>All jobs</ActionButton>} flush>
          <DataTable
            columns={['Route', 'Pickup date', 'Vehicle', 'Status', 'Action']}
            rows={upcomingJobs.slice(0, 6).map((job) => [
              <strong key="route">{job.pickup_location ?? 'Collection'} → {job.delivery_location ?? 'Delivery'}</strong>,
              formatDateTime(job.pickup_datetime),
              (job.vehicle_type ?? 'Not specified').replace(/_/g, ' '),
              <StatusBadge key="status" value={job.current_status ?? job.status} />,
              <ActionButton key="action" tone="secondary" onClick={() => router.push(`/driver/jobs/${job.id}`)}>Open</ActionButton>,
            ])}
            empty={<EmptyState title="No upcoming allocated work" />}
          />
        </OperationalCard>
      )}

      {ownerDriver && (
        <TwoColumn>
          <OperationalCard
            title="Recent marketplace activity"
            subtitle="Your latest quote submissions and their commercial outcomes."
            actions={<ActionButton tone="secondary" onClick={() => router.push('/driver/quotes')}>All quotes</ActionButton>}
            flush
          >
            <DataTable
            columns={['Route', 'Your quote', 'Submitted', 'Result']}
              rows={myQuotes.slice(0, 6).map((bid) => {
                const ownerBid = bid as OwnerBid;
                const job = Array.isArray(ownerBid.jobs) ? ownerBid.jobs[0] : ownerBid.jobs;
                return [
                  <strong key="route">{job?.pickup_location ?? 'Collection'} → {job?.delivery_location ?? 'Delivery'}</strong>,
                  money(Number(bid.bid_price_gbp ?? 0)),
                  formatDateTime(bid.created_at),
                  <StatusBadge key="status" value={bid.status} tone={BID_STATUS_TONE[bid.status]} />,
                ];
              })}
              empty={<EmptyState title="No quotes yet" description="Browse available loads and submit your first quote." action={<ActionButton tone="success" onClick={() => router.push('/driver/loads')}>Find loads</ActionButton>} />}
            />
          </OperationalCard>

          <div className={styles.roleDashboardColumn}>
            <OperationalCard title="Business summary" subtitle="Financial and operational position for your owner-driver account.">
              <div className={styles.roleDashboardSummaryList}>
                {[
                  ['Quotes submitted', submittedQuotes, '/driver/quotes'],
                  ['Won work (accepted)', wonWork, '/driver/won-work'],
                  ['Pending invoices', pendingInvoices, '/driver/finance'],
                  ['Return journeys', null, '/driver/returns'],
                  ['Documents & compliance', null, '/driver/documents'],
                ].map(([label, value, href]) => (
                  <button
                    key={String(href)}
                    type="button"
                    onClick={() => router.push(String(href))}
                    className={styles.roleDashboardSummaryButton}
                  >
                    <span>{label}</span>
                    {value !== null && <strong>{value}</strong>}
                  </button>
                ))}
              </div>
            </OperationalCard>

            {expiringDocuments.length > 0 && (
              <OperationalCard title="Document expiry alerts" subtitle="Take action before these documents expire.">
                <div className={styles.driverDashboardAlertList}>
                {expiringDocuments.slice(0, 4).map((doc) => {
                  const days = Math.ceil((new Date(doc.expiry_date!).getTime() - Date.now()) / 86_400_000);
                  return (
                    <div key={doc.id} className={styles.roleDashboardListRow}>
                      <span>{doc.doc_type?.replace(/_/g, ' ') ?? 'Document'}</span>
                      <StatusBadge value={days <= 0 ? 'Expired' : `${days} days`} tone={days <= 7 ? 'red' : 'orange'} />
                    </div>
                  );
                })}
                </div>
                <div className={styles.driverDashboardAlertAction}><ActionButton tone="secondary" onClick={() => router.push('/driver/documents')}>Manage documents</ActionButton></div>
              </OperationalCard>
            )}
          </div>
        </TwoColumn>
      )}

      {!ownerDriver && expiringDocuments.length > 0 && (
        <OperationalCard title="Document expiry alerts" subtitle="Action required before these documents expire." actions={<ActionButton tone="secondary" onClick={() => router.push('/driver/documents')}>Manage</ActionButton>} flush>
          <DataTable
            columns={['Document', 'Expires']}
            rows={expiringDocuments.slice(0, 5).map((doc) => {
              const days = Math.ceil((new Date(doc.expiry_date!).getTime() - Date.now()) / 86_400_000);
              return [
                doc.doc_type?.replace(/_/g, ' ') ?? 'Document',
                <StatusBadge key="exp" value={days <= 0 ? 'Expired' : `${days} days`} tone={days <= 7 ? 'red' : 'orange'} />,
              ];
            })}
            empty={<EmptyState title="No expiry alerts" />}
          />
        </OperationalCard>
      )}
    </OperationalPageLayout>
  );
}
