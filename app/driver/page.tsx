'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthContext';
import { resolveWorkspaceRole } from '../../lib/workspaceRole';
import { useCompanyWorkspaceData } from '../components/workspace/useCompanyWorkspaceData';
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';
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

const BID_STATUS_TONE: Record<string, 'green' | 'orange' | 'red' | 'purple'> = {
  accepted: 'green',
  submitted: 'orange',
  rejected: 'red',
  withdrawn: 'purple',
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
    () => data.jobs.filter((job) => !user?.driverId || job.assigned_driver_id === user.driverId || ownerDriver),
    [data.jobs, ownerDriver, user?.driverId]
  );
  const currentJob = myJobs.find((job) => activeStatuses.has(job.current_status ?? job.status));
  const todaysJobs = myJobs.filter((job) =>
    job.pickup_datetime && new Date(job.pickup_datetime).toDateString() === new Date().toDateString()
  );
  const upcomingJobs = myJobs.filter((job) =>
    upcomingStatuses.has(job.current_status ?? job.status) &&
    job.pickup_datetime &&
    new Date(job.pickup_datetime).toDateString() !== new Date().toDateString() &&
    new Date(job.pickup_datetime).getTime() > Date.now()
  ).sort((a, b) => String(a.pickup_datetime).localeCompare(String(b.pickup_datetime)));

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
  const completedJobs = myJobs.filter((job) => ['delivered', 'completed', 'invoiced', 'paid'].includes(job.status)).length;

  const submittedQuotes = myQuotes.filter((q) => q.status === 'submitted').length;
  const wonWork = myQuotes.filter((q) => q.status === 'accepted').length;
  const pendingInvoices = data.invoices.filter(
    (inv) => inv.company_id === data.companyId && !['paid', 'Paid'].includes(inv.status) && inv.payment_status !== 'paid'
  ).length;
  const pendingInvoiceValue = data.invoices
    .filter((inv) => inv.company_id === data.companyId && !['paid', 'Paid'].includes(inv.status) && inv.payment_status !== 'paid')
    .reduce((sum, inv) => sum + Number(inv.amount ?? 0), 0);

  return (
    <PageFrame>
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
        <KpiCard label="Jobs today" value={todaysJobs.length} detail="Scheduled collections" onClick={() => router.push('/driver/jobs')} />
        <KpiCard label="Active job" value={currentJob ? 1 : 0} detail="Current execution" tone="green" onClick={currentJob ? () => router.push(`/driver/jobs/${currentJob.id}`) : undefined} />
        <KpiCard label="Awaiting start" value={myJobs.filter((job) => upcomingStatuses.has(job.current_status ?? job.status)).length} detail="Allocated, not yet active" tone="orange" />
        <KpiCard label="Completed" value={completedJobs} detail="Delivered or invoiced" tone="navy" onClick={() => router.push('/driver/history')} />
        <KpiCard label="Documents expiring" value={expiringDocuments.length} detail="Within 30 days" tone={expiringDocuments.length ? 'red' : 'green'} onClick={() => router.push('/driver/documents')} />
        {ownerDriver && <KpiCard label="Quotes submitted" value={submittedQuotes} detail="Awaiting customer decision" tone="purple" onClick={() => router.push('/driver/quotes')} />}
        {ownerDriver && <KpiCard label="Won work" value={wonWork} detail="Accepted quotes" tone="green" onClick={() => router.push('/driver/won-work')} />}
        {ownerDriver && pendingInvoices > 0 && <KpiCard label="Pending invoices" value={pendingInvoices} detail={money(pendingInvoiceValue)} tone="orange" onClick={() => router.push('/driver/finance')} />}
      </KpiGrid>

      <TwoColumn>
        <Panel
          title={currentJob ? 'Current job' : 'Next operational work'}
          description="The job card shows the authoritative route, timing and next driver action."
          actions={<ActionButton tone="secondary" onClick={() => router.push('/driver/jobs')}>All jobs</ActionButton>}
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

        <Panel title="Today's schedule" description="All collections scheduled for today in pickup-time order.">
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
        </Panel>
      </TwoColumn>

      {upcomingJobs.length > 0 && (
        <Panel title="Upcoming allocated work" description="Jobs already allocated to you scheduled for future dates." actions={<ActionButton tone="secondary" onClick={() => router.push('/driver/jobs')}>All jobs</ActionButton>}>
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
        </Panel>
      )}

      {ownerDriver && (
        <TwoColumn>
          <Panel
            title="Recent marketplace activity"
            description="Your latest quote submissions and their commercial outcomes."
            actions={<ActionButton tone="secondary" onClick={() => router.push('/driver/quotes')}>All quotes</ActionButton>}
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
          </Panel>

          <div style={{ display: 'grid', gap: '0.9rem' }}>
            <Panel title="Business summary" description="Financial and operational position for your owner-driver account.">
              <div style={{ display: 'grid', gap: '0.55rem' }}>
                {[
                  ['Quotes submitted', submittedQuotes, '/driver/quotes'],
                  ['Won work (accepted)', wonWork, '/driver/won-work'],
                  ['Pending invoices', pendingInvoices, '/driver/finance'],
                  ['Return journeys', null, '/driver/returns'],
                  ['Documents & compliance', null, '/driver/documents'],
                ].map(([label, value, href]) => (
                  <button
                    key={String(href)}
                    onClick={() => router.push(String(href))}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: '8px', padding: '0.62rem 0.7rem', cursor: 'pointer', color: '#0f172a', fontSize: '0.76rem' }}
                  >
                    <span>{label}</span>
                    {value !== null && <strong>{value}</strong>}
                  </button>
                ))}
              </div>
            </Panel>

            {expiringDocuments.length > 0 && (
              <Panel title="Document expiry alerts" description="Take action before these documents expire.">
                {expiringDocuments.slice(0, 4).map((doc) => {
                  const days = Math.ceil((new Date(doc.expiry_date!).getTime() - Date.now()) / 86_400_000);
                  return (
                    <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', padding: '0.5rem 0', borderBottom: '1px solid #eef2f6', fontSize: '0.76rem' }}>
                      <span>{doc.doc_type?.replace(/_/g, ' ') ?? 'Document'}</span>
                      <StatusBadge value={days <= 0 ? 'Expired' : `${days} days`} tone={days <= 7 ? 'red' : 'orange'} />
                    </div>
                  );
                })}
                <div style={{ marginTop: '0.6rem' }}><ActionButton tone="secondary" onClick={() => router.push('/driver/documents')}>Manage documents</ActionButton></div>
              </Panel>
            )}
          </div>
        </TwoColumn>
      )}

      {!ownerDriver && expiringDocuments.length > 0 && (
        <Panel title="Document expiry alerts" description="Action required before these documents expire." actions={<ActionButton tone="secondary" onClick={() => router.push('/driver/documents')}>Manage</ActionButton>}>
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
        </Panel>
      )}
    </PageFrame>
  );
}
