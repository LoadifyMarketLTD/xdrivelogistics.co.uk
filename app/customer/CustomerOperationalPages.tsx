'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
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
} from '../components/workspace/WorkspaceUI';

const money = (value: number, currency = 'GBP') =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);

const when = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Not set';

const activeStatuses = new Set([
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
const deliveredStatuses = new Set(['delivered', 'completed', 'invoiced', 'paid']);

const jobStatus = (job: { current_status?: string | null; status: string }) =>
  String(job.current_status ?? job.status).toLowerCase();

const selectStyle = {
  border: '1px solid #D8DEE8',
  borderRadius: '4px',
  minHeight: '32px',
  padding: '0 10px',
  background: '#fff',
  color: '#1A1F2B',
  fontSize: '12px',
  fontWeight: 600,
} as const;

export function CustomerLoadsOperationalPage() {
  const data = useCompanyWorkspaceData();
  const router = useRouter();
  const [filter, setFilter] = useState('all');

  const rows = useMemo(() => {
    const quoteCount = (jobId: string) =>
      data.bids.filter((bid) => bid.job_id === jobId && bid.status === 'submitted').length;

    return data.jobs
      .map((job) => ({
        job,
        status: jobStatus(job),
        quotes: quoteCount(job.id),
        awaitingAward:
          !job.awarded_carrier_company_id &&
          data.bids.some((bid) => bid.job_id === job.id && bid.status === 'submitted'),
      }))
      .filter(({ job, status, awaitingAward }) => {
        if (filter === 'all') return true;
        if (filter === 'draft') return job.status === 'draft';
        if (filter === 'open') return ['posted', 'quoted'].includes(job.status);
        if (filter === 'awaiting_award') return awaitingAward;
        if (filter === 'awarded') return Boolean(job.awarded_carrier_company_id) || upcomingStatuses.has(status);
        if (filter === 'active') return activeStatuses.has(status);
        if (filter === 'delivered') return deliveredStatuses.has(status);
        return true;
      })
      .sort((a, b) =>
        String(b.job.pickup_datetime ?? '').localeCompare(String(a.job.pickup_datetime ?? '')),
      );
  }, [data.bids, data.jobs, filter]);

  const metrics = useMemo(() => {
    const awaitingAward = data.jobs.filter(
      (job) =>
        !job.awarded_carrier_company_id &&
        data.bids.some((bid) => bid.job_id === job.id && bid.status === 'submitted'),
    );
    return {
      total: data.jobs.length,
      draft: data.jobs.filter((job) => job.status === 'draft').length,
      open: data.jobs.filter((job) => ['posted', 'quoted'].includes(job.status)).length,
      awaitingAward: awaitingAward.length,
      active: data.jobs.filter((job) => activeStatuses.has(jobStatus(job))).length,
      delivered: data.jobs.filter((job) => deliveredStatuses.has(jobStatus(job))).length,
    };
  }, [data.bids, data.jobs]);

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Customer transport"
        title="My Loads"
        description="Create, review and control the full customer transport pipeline from draft through delivery."
        actions={
          <>
            <ActionButton tone="secondary" onClick={() => void data.refresh()}>Refresh</ActionButton>
            <ActionButton tone="warning" onClick={() => router.push('/customer/post-load')}>Post Load</ActionButton>
          </>
        }
      />
      {data.error && <AlertBanner tone="danger">{data.error}</AlertBanner>}

      <KpiGrid>
        <KpiCard label="All loads" value={metrics.total} tone="navy" onClick={() => setFilter('all')} />
        <KpiCard label="Draft" value={metrics.draft} tone="blue" onClick={() => setFilter('draft')} />
        <KpiCard label="Open" value={metrics.open} detail="Waiting for carrier response" tone="blue" onClick={() => setFilter('open')} />
        <KpiCard label="Awaiting award" value={metrics.awaitingAward} detail="Customer decision needed" tone="orange" onClick={() => setFilter('awaiting_award')} />
        <KpiCard label="Active" value={metrics.active} detail="Moving now" tone="green" onClick={() => setFilter('active')} />
        <KpiCard label="Delivered" value={metrics.delivered} tone="green" onClick={() => setFilter('delivered')} />
      </KpiGrid>

      <Panel
        title="Load register"
        description="One operational register for draft, open, quoted, awarded, live and delivered transport."
        actions={
          <select value={filter} onChange={(event) => setFilter(event.target.value)} style={selectStyle}>
            <option value="all">All loads</option>
            <option value="draft">Draft</option>
            <option value="open">Open / quoted</option>
            <option value="awaiting_award">Awaiting award</option>
            <option value="awarded">Awarded</option>
            <option value="active">Active deliveries</option>
            <option value="delivered">Delivered / completed</option>
          </select>
        }
      >
        <DataTable
          columns={['Reference', 'Route', 'Pickup', 'Delivery', 'Vehicle', 'Quotes', 'Status', 'Action']}
          rows={rows.map(({ job, quotes }) => [
            job.id.slice(0, 8).toUpperCase(),
            <strong key="route">{job.pickup_postcode ?? job.pickup_location} → {job.delivery_postcode ?? job.delivery_location}</strong>,
            when(job.pickup_datetime),
            when(job.delivery_datetime),
            (job.vehicle_type ?? 'Not specified').replace(/_/g, ' '),
            quotes,
            <StatusBadge key="status" value={job.current_status ?? job.status} />,
            <ActionButton key="action" tone="secondary" onClick={() => router.push(`/customer/jobs/${job.id}`)}>Open</ActionButton>,
          ])}
          empty={<EmptyState title={data.loading ? 'Loading loads…' : 'No loads in this view'} description="Change the filter or post a new transport request." />}
        />
      </Panel>
    </PageFrame>
  );
}

export function CustomerQuotesOperationalPage() {
  const data = useCompanyWorkspaceData();
  const router = useRouter();
  const [working, setWorking] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState('all');

  const allQuotes = useMemo(
    () => data.bids.filter((bid) => ['submitted', 'accepted', 'rejected'].includes(bid.status)),
    [data.bids],
  );

  const grouped = useMemo(
    () => data.jobs
      .map((job) => ({
        job,
        quotes: allQuotes
          .filter((bid) => bid.job_id === job.id && (filter === 'all' || bid.status === filter))
          .sort((a, b) => Number(a.bid_price_gbp ?? a.amount ?? 0) - Number(b.bid_price_gbp ?? b.amount ?? 0)),
      }))
      .filter((group) => group.quotes.length > 0),
    [allQuotes, data.jobs, filter],
  );

  const submitted = allQuotes.filter((bid) => bid.status === 'submitted');
  const accepted = allQuotes.filter((bid) => bid.status === 'accepted');
  const rejected = allQuotes.filter((bid) => bid.status === 'rejected');
  const loadsWithQuotes = new Set(allQuotes.map((bid) => bid.job_id)).size;

  const award = async (id: string) => {
    setWorking(id);
    setMessage('');
    const { data: session } = await supabase.auth.getSession();
    const response = await fetch(`/api/customer/bids/${id}/award`, {
      method: 'POST',
      headers: session.session?.access_token ? { Authorization: `Bearer ${session.session.access_token}` } : {},
    });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    setWorking(null);
    if (!response.ok) {
      setMessage(payload.error ?? 'Unable to award quote.');
      return;
    }
    setMessage('Carrier quote awarded successfully.');
    await data.refresh();
  };

  const reject = async (id: string) => {
    setWorking(id);
    setMessage('');
    const { data: session } = await supabase.auth.getSession();
    const response = await fetch(`/api/customer/bids/${id}/reject`, {
      method: 'POST',
      headers: session.session?.access_token ? { Authorization: `Bearer ${session.session.access_token}` } : {},
    });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    setWorking(null);
    if (!response.ok) {
      setMessage(payload.error ?? 'Unable to reject quote.');
      return;
    }
    setMessage('Carrier quote rejected.');
    await data.refresh();
  };

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Customer commercial"
        title="Quotes"
        description="Compare carrier prices and responses by load, then award or reject without leaving the commercial board."
        actions={<ActionButton tone="secondary" onClick={() => void data.refresh()}>Refresh</ActionButton>}
      />
      {data.error && <AlertBanner tone="danger">{data.error}</AlertBanner>}
      {message && <AlertBanner tone={message.includes('successfully') || message.includes('rejected') ? 'success' : 'danger'}>{message}</AlertBanner>}

      <KpiGrid>
        <KpiCard label="Loads with quotes" value={loadsWithQuotes} tone="navy" onClick={() => setFilter('all')} />
        <KpiCard label="Awaiting decision" value={submitted.length} detail="Award or reject" tone="orange" onClick={() => setFilter('submitted')} />
        <KpiCard label="Accepted" value={accepted.length} tone="green" onClick={() => setFilter('accepted')} />
        <KpiCard label="Rejected" value={rejected.length} tone="red" onClick={() => setFilter('rejected')} />
      </KpiGrid>

      <Panel
        title="Quote comparison"
        description="Lowest price is shown first within each load; final award remains a customer decision."
        actions={
          <select value={filter} onChange={(event) => setFilter(event.target.value)} style={selectStyle}>
            <option value="all">All quote activity</option>
            <option value="submitted">Awaiting decision</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
          </select>
        }
      >
        {grouped.length === 0 ? (
          <EmptyState title={data.loading ? 'Loading quotes…' : 'No quotes in this view'} description="Carrier responses appear here after a load is published." />
        ) : (
          grouped.map(({ job, quotes }) => (
            <div key={job.id} style={{ borderBottom: '1px solid #D8DEE8', paddingBottom: '10px', marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
                <div>
                  <strong style={{ fontSize: '13px' }}>{job.pickup_postcode ?? job.pickup_location} → {job.delivery_postcode ?? job.delivery_location}</strong>
                  <div style={{ color: '#64748B', fontSize: '11px', marginTop: '2px' }}>Pickup {when(job.pickup_datetime)} · Load {job.id.slice(0, 8).toUpperCase()}</div>
                </div>
                <ActionButton tone="secondary" onClick={() => router.push(`/customer/jobs/${job.id}`)}>Open load</ActionButton>
              </div>
              <DataTable
                columns={['Carrier', 'Price', 'Position', 'Message', 'Submitted', 'Status', 'Decision']}
                rows={quotes.map((bid, index) => [
                  <strong key="carrier">{bid.companies?.name ?? 'Carrier'}</strong>,
                  <strong key="price">{money(Number(bid.bid_price_gbp ?? bid.amount ?? 0))}</strong>,
                  index === 0 ? <StatusBadge key="position" value="Best price" tone="green" /> : `#${index + 1}`,
                  bid.message ?? 'No message',
                  when(bid.created_at),
                  <StatusBadge key="status" value={bid.status} />,
                  bid.status === 'submitted' ? (
                    <span key="actions" style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      <ActionButton tone="success" disabled={working === bid.id} onClick={() => void award(bid.id)}>{working === bid.id ? 'Working…' : 'Award'}</ActionButton>
                      <ActionButton tone="danger" disabled={working === bid.id} onClick={() => void reject(bid.id)}>Reject</ActionButton>
                    </span>
                  ) : '—',
                ])}
              />
            </div>
          ))
        )}
      </Panel>
    </PageFrame>
  );
}

export function CustomerAwardsOperationalPage() {
  const data = useCompanyWorkspaceData();
  const router = useRouter();
  const [filter, setFilter] = useState('all');

  const awardedJobs = useMemo(
    () => data.jobs.filter((job) =>
      Boolean(job.awarded_carrier_company_id) ||
      upcomingStatuses.has(jobStatus(job)) ||
      activeStatuses.has(jobStatus(job)) ||
      deliveredStatuses.has(jobStatus(job)),
    ),
    [data.jobs],
  );

  const filtered = useMemo(
    () => awardedJobs.filter((job) => {
      const status = jobStatus(job);
      if (filter === 'all') return true;
      if (filter === 'active') return activeStatuses.has(status);
      if (filter === 'delivered') return deliveredStatuses.has(status);
      if (filter === 'pod_ready') return (job.delivery_photos?.length ?? 0) > 0;
      return true;
    }),
    [awardedJobs, filter],
  );

  const activeCount = awardedJobs.filter((job) => activeStatuses.has(jobStatus(job))).length;
  const deliveredCount = awardedJobs.filter((job) => deliveredStatuses.has(jobStatus(job))).length;
  const podCount = awardedJobs.filter((job) => (job.delivery_photos?.length ?? 0) > 0).length;

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Customer commercial"
        title="Awards"
        description="Awarded transport remains visible through execution and delivery instead of disappearing after allocation."
        actions={<ActionButton tone="secondary" onClick={() => void data.refresh()}>Refresh</ActionButton>}
      />
      {data.error && <AlertBanner tone="danger">{data.error}</AlertBanner>}

      <KpiGrid>
        <KpiCard label="Awards made" value={awardedJobs.length} tone="navy" onClick={() => setFilter('all')} />
        <KpiCard label="Active" value={activeCount} tone="green" onClick={() => setFilter('active')} />
        <KpiCard label="Delivered" value={deliveredCount} tone="green" onClick={() => setFilter('delivered')} />
        <KpiCard label="POD ready" value={podCount} tone="blue" onClick={() => setFilter('pod_ready')} />
      </KpiGrid>

      <Panel
        title="Award register"
        description="Commercial award, execution state and delivery evidence in one customer history."
        actions={
          <select value={filter} onChange={(event) => setFilter(event.target.value)} style={selectStyle}>
            <option value="all">All awards</option>
            <option value="active">Active</option>
            <option value="delivered">Delivered / completed</option>
            <option value="pod_ready">POD ready</option>
          </select>
        }
      >
        <DataTable
          columns={['Load', 'Route', 'Pickup', 'Delivery', 'Status', 'POD', 'Action']}
          rows={filtered.map((job) => [
            job.id.slice(0, 8).toUpperCase(),
            <strong key="route">{job.pickup_postcode ?? job.pickup_location} → {job.delivery_postcode ?? job.delivery_location}</strong>,
            when(job.pickup_datetime),
            when(job.delivery_datetime),
            <StatusBadge key="status" value={job.current_status ?? job.status} />,
            (job.delivery_photos?.length ?? 0) > 0
              ? <StatusBadge key="pod" value="Ready" tone="green" />
              : <StatusBadge key="pod" value="Pending" tone="orange" />,
            <ActionButton key="action" tone="secondary" onClick={() => router.push(`/customer/jobs/${job.id}`)}>Open</ActionButton>,
          ])}
          empty={<EmptyState title={data.loading ? 'Loading awards…' : 'No awarded transport in this view'} />}
        />
      </Panel>
    </PageFrame>
  );
}

export function CustomerDeliveriesOperationalPage() {
  const data = useCompanyWorkspaceData();
  const router = useRouter();
  const [filter, setFilter] = useState('all');

  const deliveryJobs = useMemo(
    () => data.jobs.filter((job) => {
      const status = jobStatus(job);
      return upcomingStatuses.has(status) || activeStatuses.has(status) || deliveredStatuses.has(status);
    }),
    [data.jobs],
  );

  const isDelayed = (job: (typeof data.jobs)[number]) =>
    activeStatuses.has(jobStatus(job)) &&
    Boolean(job.delivery_datetime) &&
    new Date(job.delivery_datetime as string).getTime() < Date.now();

  const filtered = useMemo(
    () => deliveryJobs.filter((job) => {
      const status = jobStatus(job);
      if (filter === 'all') return true;
      if (filter === 'upcoming') return upcomingStatuses.has(status) && !activeStatuses.has(status);
      if (filter === 'active') return activeStatuses.has(status);
      if (filter === 'delayed') return isDelayed(job);
      if (filter === 'delivered') return deliveredStatuses.has(status);
      if (filter === 'pod_ready') return (job.delivery_photos?.length ?? 0) > 0;
      return true;
    }),
    [deliveryJobs, filter],
  );

  const upcomingCount = deliveryJobs.filter((job) => upcomingStatuses.has(jobStatus(job)) && !activeStatuses.has(jobStatus(job))).length;
  const activeCount = deliveryJobs.filter((job) => activeStatuses.has(jobStatus(job))).length;
  const delayedCount = deliveryJobs.filter(isDelayed).length;
  const deliveredCount = deliveryJobs.filter((job) => deliveredStatuses.has(jobStatus(job))).length;
  const podCount = deliveryJobs.filter((job) => (job.delivery_photos?.length ?? 0) > 0).length;

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Customer delivery control"
        title="Deliveries"
        description="Monitor awarded, live, delayed and delivered transport with POD readiness in the same operational register."
        actions={<ActionButton tone="secondary" onClick={() => void data.refresh()}>Refresh</ActionButton>}
      />
      {data.error && <AlertBanner tone="danger">{data.error}</AlertBanner>}

      <KpiGrid>
        <KpiCard label="Upcoming" value={upcomingCount} tone="blue" onClick={() => setFilter('upcoming')} />
        <KpiCard label="Active" value={activeCount} tone="green" onClick={() => setFilter('active')} />
        <KpiCard label="Delayed" value={delayedCount} detail="Past delivery window" tone={delayedCount ? 'red' : 'green'} onClick={() => setFilter('delayed')} />
        <KpiCard label="Delivered" value={deliveredCount} tone="green" onClick={() => setFilter('delivered')} />
        <KpiCard label="POD ready" value={podCount} tone="navy" onClick={() => setFilter('pod_ready')} />
      </KpiGrid>

      <Panel
        title="Delivery board"
        description="Collection, delivery window, live status and proof-of-delivery readiness."
        actions={
          <select value={filter} onChange={(event) => setFilter(event.target.value)} style={selectStyle}>
            <option value="all">All delivery work</option>
            <option value="upcoming">Upcoming</option>
            <option value="active">Active</option>
            <option value="delayed">Delayed</option>
            <option value="delivered">Delivered / completed</option>
            <option value="pod_ready">POD ready</option>
          </select>
        }
      >
        <DataTable
          columns={['Route', 'Collection', 'Delivery', 'Vehicle', 'Status', 'POD', 'Action']}
          rows={filtered.map((job) => [
            <strong key="route">{job.pickup_postcode ?? job.pickup_location} → {job.delivery_postcode ?? job.delivery_location}</strong>,
            when(job.pickup_datetime),
            when(job.delivery_datetime),
            (job.vehicle_type ?? 'Not specified').replace(/_/g, ' '),
            <StatusBadge key="status" value={job.current_status ?? job.status} tone={isDelayed(job) ? 'red' : undefined} />,
            (job.delivery_photos?.length ?? 0) > 0
              ? <StatusBadge key="pod" value="Ready" tone="green" />
              : <StatusBadge key="pod" value="Pending" tone="orange" />,
            <ActionButton key="action" tone="secondary" onClick={() => router.push(`/customer/jobs/${job.id}`)}>Track</ActionButton>,
          ])}
          empty={<EmptyState title={data.loading ? 'Loading deliveries…' : 'No delivery work in this view'} />}
        />
      </Panel>
    </PageFrame>
  );
}
