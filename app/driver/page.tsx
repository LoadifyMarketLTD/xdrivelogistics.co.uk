'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthContext';
import { resolveWorkspaceRole } from '../../lib/workspaceRole';
import { canonicalJobStatus, filterJobsForDriver, recentCompletedJobs } from '../../lib/driverDashboard';
import { useCompanyWorkspaceData } from '../components/workspace/useCompanyWorkspaceData';
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';
import DriverWorkspaceShell from './_components/DriverWorkspaceShell';
import {
  ActionButton,
  AlertBanner,
  EmptyState,
  KpiCard,
  KpiGrid,
  Panel,
  StatusBadge,
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

const BID_STATUS_TONE: Record<string, 'green' | 'orange' | 'red' | 'purple'> = {
  accepted: 'green',
  submitted: 'orange',
  rejected: 'red',
  withdrawn: 'purple',
};

function money(value: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);
}

function formatDateTime(value: string | null | undefined) {
  return value
    ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Not set';
}

export default function DriverDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const workspaceRole = resolveWorkspaceRole(user);
  const ownerDriver = workspaceRole === 'owner_driver';
  const data = useCompanyWorkspaceData();

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

  useEffect(() => {
    void fetchOwnerBids();
  }, [fetchOwnerBids]);

  const myJobs = useMemo(
    () => filterJobsForDriver(data.jobs, { driverId: user?.driverId, ownerDriver }),
    [data.jobs, ownerDriver, user?.driverId]
  );

  const currentJob = myJobs.find((job) => activeStatuses.has(canonicalJobStatus(job.current_status, job.status)));
  const todaysJobs = myJobs
    .filter((job) => job.pickup_datetime && new Date(job.pickup_datetime).toDateString() === new Date().toDateString())
    .sort((a, b) => String(a.pickup_datetime ?? '').localeCompare(String(b.pickup_datetime ?? '')));
  const upcomingJobs = myJobs
    .filter((job) => {
      const status = canonicalJobStatus(job.current_status, job.status);
      return upcomingStatuses.has(status) && Boolean(job.pickup_datetime) && new Date(job.pickup_datetime as string).getTime() > Date.now();
    })
    .sort((a, b) => String(a.pickup_datetime ?? '').localeCompare(String(b.pickup_datetime ?? '')));
  const recentCompleted = recentCompletedJobs(myJobs);

  const myQuotes = data.bids;
  const myDocuments = data.driverDocuments.filter((document) => !user?.driverId || document.driver_id === user.driverId);
  const expiringDocuments = myDocuments.filter((document) => document.expiry_date && new Date(document.expiry_date).getTime() < Date.now() + 30 * 86_400_000);
  const completedJobs = myJobs.filter((job) => completedStatuses.has(canonicalJobStatus(job.current_status, job.status))).length;
  const submittedQuotes = myQuotes.filter((quote) => quote.status === 'submitted').length;
  const wonWork = myQuotes.filter((quote) => quote.status === 'accepted').length;
  const pendingInvoices = data.invoices.filter((invoice) => !['paid', 'Paid'].includes(invoice.status) && invoice.payment_status !== 'paid').length;
  const pendingInvoiceValue = data.invoices
    .filter((invoice) => !['paid', 'Paid'].includes(invoice.status) && invoice.payment_status !== 'paid')
    .reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0);

  return (
    <DriverWorkspaceShell
      personaLabel={ownerDriver ? 'Owner-driver business' : 'Driver operations'}
      driverName={ownerDriver ? 'Owner Driver Dashboard' : 'Driver Dashboard'}
      subtitle={ownerDriver
        ? 'Find work, manage quotes, execute jobs, capture POD and move completed work into finance from one operational workspace.'
        : 'Today’s assigned work, next driver action, availability and document readiness in one operational workspace.'}
      headerActions={
        <>
          {ownerDriver && <ActionButton tone="success" onClick={() => router.push('/driver/loads')}>Find loads</ActionButton>}
          <ActionButton tone="secondary" onClick={() => router.push('/driver/availability')}>Availability</ActionButton>
          <ActionButton tone="secondary" onClick={() => router.push('/driver/documents')}>Documents</ActionButton>
        </>
      }
    >
      {data.error && <AlertBanner tone="danger">{data.error}</AlertBanner>}

      <KpiGrid>
        <KpiCard label="Jobs today" value={todaysJobs.length} detail="Scheduled collections" tone="blue" onClick={() => router.push('/driver/jobs')} />
        <KpiCard label="Active job" value={currentJob ? 1 : 0} detail="Current execution" tone={currentJob ? 'green' : 'navy'} onClick={currentJob ? () => router.push(`/driver/jobs/${currentJob.id}`) : undefined} />
        <KpiCard label="Awaiting start" value={upcomingJobs.length} detail="Allocated upcoming work" tone="orange" onClick={() => router.push('/driver/jobs')} />
        <KpiCard label="Completed" value={completedJobs} detail="Delivered or invoiced" tone="navy" onClick={() => router.push('/driver/history')} />
        <KpiCard label="Documents expiring" value={expiringDocuments.length} detail="Within 30 days" tone={expiringDocuments.length ? 'red' : 'green'} onClick={() => router.push('/driver/documents')} />
        <KpiCard label={ownerDriver ? 'Quotes submitted' : 'Availability'} value={ownerDriver ? submittedQuotes : 'Open'} detail={ownerDriver ? 'Awaiting customer decision' : 'Update working status'} tone={ownerDriver ? 'purple' : 'green'} onClick={() => router.push(ownerDriver ? '/driver/quotes' : '/driver/availability')} />
      </KpiGrid>

      <div className="driver-ops-grid-2">
        <Panel
          title={currentJob ? 'Current execution' : 'Next operational work'}
          description="The active job is the primary source for route, timing, status and next action."
          actions={<ActionButton tone="secondary" onClick={() => router.push('/driver/jobs')}>All jobs</ActionButton>}
        >
          {currentJob ? (
            <div>
              <div className="driver-current-route">
                <div className="driver-route-stop">
                  <span className="driver-cell-label">Pickup</span>
                  <strong className="driver-cell-primary">{currentJob.pickup_location ?? 'Collection'}</strong>
                  <span className="driver-cell-secondary">{formatDateTime(currentJob.pickup_datetime)}</span>
                </div>
                <span className="driver-route-arrow">→</span>
                <div className="driver-route-stop">
                  <span className="driver-cell-label">Delivery</span>
                  <strong className="driver-cell-primary">{currentJob.delivery_location ?? 'Delivery'}</strong>
                  <span className="driver-cell-secondary">{formatDateTime(currentJob.delivery_datetime)}</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingTop: '6px', borderTop: '1px solid #e5e7eb', flexWrap: 'wrap' }}>
                <StatusBadge value={currentJob.current_status ?? currentJob.status} />
                <div style={{ marginLeft: 'auto' }}><ActionButton tone="success" onClick={() => router.push(`/driver/jobs/${currentJob.id}`)}>Open job & actions</ActionButton></div>
              </div>
            </div>
          ) : (
            <EmptyState compact title="No active job" description="Allocated work appears here as soon as it becomes active." />
          )}
        </Panel>

        <Panel title="Today's schedule" description="Collections scheduled today in pickup-time order." flush>
          {todaysJobs.length === 0 ? (
            <div style={{ padding: '10px' }}><EmptyState compact title="No jobs scheduled today" description="Keep availability current so dispatch can see your working status." /></div>
          ) : (
            <div className="driver-ops-table-wrap">
              <table className="driver-ops-table">
                <thead><tr><th>Route</th><th>Pickup</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {todaysJobs.map((job) => (
                    <tr key={job.id}>
                      <td><strong>{job.pickup_location ?? 'Collection'} → {job.delivery_location ?? 'Delivery'}</strong></td>
                      <td>{formatDateTime(job.pickup_datetime)}</td>
                      <td><StatusBadge value={job.current_status ?? job.status} /></td>
                      <td><ActionButton tone="secondary" onClick={() => router.push(`/driver/jobs/${job.id}`)}>Open</ActionButton></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      {ownerDriver && (
        <div className="driver-ops-grid-3">
          <Panel title="Commercial pipeline" description="Quick owner-driver marketplace position.">
            <div className="driver-detail-grid">
              <div className="driver-detail-item"><span>Submitted quotes</span><strong>{submittedQuotes}</strong></div>
              <div className="driver-detail-item"><span>Won work</span><strong>{wonWork}</strong></div>
              <div className="driver-detail-item"><span>Pending invoices</span><strong>{pendingInvoices}</strong></div>
              <div className="driver-detail-item"><span>Invoice value</span><strong>{money(pendingInvoiceValue)}</strong></div>
            </div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
              <ActionButton tone="secondary" onClick={() => router.push('/driver/quotes')}>Quotes</ActionButton>
              <ActionButton tone="secondary" onClick={() => router.push('/driver/finance')}>Invoices</ActionButton>
              <ActionButton tone="secondary" onClick={() => router.push('/driver/returns')}>Return journeys</ActionButton>
            </div>
          </Panel>

          <Panel title="Recent marketplace activity" description="Latest owner-driver quote outcomes." flush>
            {ownerBids.length === 0 ? (
              <div style={{ padding: '10px' }}><EmptyState compact title="No quotes yet" description="Browse available loads and submit your first quote." /></div>
            ) : (
              <div className="driver-ops-table-wrap">
                <table className="driver-ops-table">
                  <thead><tr><th>Route</th><th>Quote</th><th>Result</th></tr></thead>
                  <tbody>
                    {ownerBids.slice(0, 5).map((bid) => {
                      const job = Array.isArray(bid.jobs) ? bid.jobs[0] : bid.jobs;
                      return (
                        <tr key={bid.id}>
                          <td><strong>{job?.pickup_location ?? 'Collection'} → {job?.delivery_location ?? 'Delivery'}</strong></td>
                          <td>{money(Number(bid.bid_price_gbp ?? 0))}</td>
                          <td><StatusBadge value={bid.status} tone={BID_STATUS_TONE[bid.status]} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title="Readiness attention" description="Items that can block the next shift.">
            <div style={{ display: 'grid', gap: '6px' }}>
              <button type="button" onClick={() => router.push('/driver/documents')} style={{ minHeight: '42px', display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: '8px', border: '1px solid #d8dee8', borderRadius: '4px', background: '#fff', padding: '6px 8px', textAlign: 'left', cursor: 'pointer' }}><span><strong style={{ display: 'block', fontSize: '12px' }}>Documents expiring</strong><small style={{ color: '#64748b', fontSize: '10px' }}>Within 30 days</small></span><StatusBadge value={String(expiringDocuments.length)} tone={expiringDocuments.length ? 'orange' : 'green'} /></button>
              <button type="button" onClick={() => router.push('/driver/availability')} style={{ minHeight: '42px', display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: '8px', border: '1px solid #d8dee8', borderRadius: '4px', background: '#fff', padding: '6px 8px', textAlign: 'left', cursor: 'pointer' }}><span><strong style={{ display: 'block', fontSize: '12px' }}>Availability</strong><small style={{ color: '#64748b', fontSize: '10px' }}>Marketplace working status</small></span><span aria-hidden="true" style={{ color: '#1d57d8' }}>→</span></button>
              <button type="button" onClick={() => router.push('/driver/vehicles')} style={{ minHeight: '42px', display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: '8px', border: '1px solid #d8dee8', borderRadius: '4px', background: '#fff', padding: '6px 8px', textAlign: 'left', cursor: 'pointer' }}><span><strong style={{ display: 'block', fontSize: '12px' }}>Vehicle profile</strong><small style={{ color: '#64748b', fontSize: '10px' }}>Capacity and equipment</small></span><span aria-hidden="true" style={{ color: '#1d57d8' }}>→</span></button>
            </div>
          </Panel>
        </div>
      )}

      <Panel title="Recent completed work" description="Delivered jobs with direct access to the full record and POD." flush>
        {recentCompleted.length === 0 ? (
          <div style={{ padding: '10px' }}><EmptyState compact title="No completed jobs yet" /></div>
        ) : (
          <div className="driver-ops-table-wrap">
            <table className="driver-ops-table">
              <thead><tr><th>Route</th><th>Delivered</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {recentCompleted.slice(0, 6).map((job) => (
                  <tr key={job.id}>
                    <td><strong>{job.pickup_location ?? 'Collection'} → {job.delivery_location ?? 'Delivery'}</strong></td>
                    <td>{formatDateTime(job.delivery_datetime)}</td>
                    <td><StatusBadge value={job.current_status ?? job.status} /></td>
                    <td><ActionButton tone="secondary" onClick={() => router.push(`/driver/jobs/${job.id}`)}>Open</ActionButton></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </DriverWorkspaceShell>
  );
}
