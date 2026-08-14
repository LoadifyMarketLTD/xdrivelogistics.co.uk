'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { classifyWorkspaceJobStage, normalizedJobStatus } from '../../lib/jobs/workspaceJobStage';
import { CompanyJobSheetPanel } from '../components/workspace/CompanyJobSheetPanel';
import { useCompanyWorkspaceData, type WorkspaceJob } from '../components/workspace/useCompanyWorkspaceData';
import { MemberIdentityLink } from '../components/workspace/MemberProfile';
import {
  ActionButton,
  AlertBanner,
  DataTable,
  EmptyState,
  PageFrame,
  PageHeader,
  StatusBadge,
} from '../components/workspace/WorkspaceUI';

const money = (value: number, currency = 'GBP') =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);

const when = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Not set';

const labelStyle = { fontSize: 'var(--ws-font-label, 11px)', color: '#64748b', fontWeight: 700 } as const;
const metaStyle = { color: '#64748b', fontSize: 'var(--ws-font-meta, 11px)' } as const;

function routeLabel(job: WorkspaceJob) {
  return `${job.pickup_postcode ?? job.pickup_location ?? 'Collection'} → ${job.delivery_postcode ?? job.delivery_location ?? 'Delivery'}`;
}

function quoteCounts(data: ReturnType<typeof useCompanyWorkspaceData>) {
  const map = new Map<string, { submitted: number; accepted: number; rejected: number }>();
  for (const bid of data.bids) {
    const row = map.get(bid.job_id) ?? { submitted: 0, accepted: 0, rejected: 0 };
    if (bid.status === 'submitted') row.submitted += 1;
    if (bid.status === 'accepted') row.accepted += 1;
    if (bid.status === 'rejected') row.rejected += 1;
    map.set(bid.job_id, row);
  }
  return map;
}

function CustomerOperationalRow({
  job,
  middleLabel,
  middleValue,
  middleMeta,
  open,
  onToggle,
  actionLabel = 'Open booking',
  actionHref,
  sheet = false,
}: {
  job: WorkspaceJob;
  middleLabel: string;
  middleValue: React.ReactNode;
  middleMeta?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  actionLabel?: string;
  actionHref: string;
  sheet?: boolean;
}) {
  const router = useRouter();
  return (
    <article className="workspace-operational-row" data-state={normalizedJobStatus(job)}>
      <div className="workspace-operational-row__top">
        <div className="workspace-operational-cell"><div style={labelStyle}>FROM</div><strong>{job.pickup_postcode ?? job.pickup_location ?? 'Collection'}</strong><div style={{ ...metaStyle, marginTop: 2 }}>{when(job.pickup_datetime)}</div></div>
        <div className="workspace-operational-cell"><div style={labelStyle}>TO</div><strong>{job.delivery_postcode ?? job.delivery_location ?? 'Delivery'}</strong><div style={{ ...metaStyle, marginTop: 2 }}>{when(job.delivery_datetime)}</div></div>
        <div className="workspace-operational-cell"><div style={labelStyle}>{middleLabel}</div><strong>{middleValue}</strong>{middleMeta ? <div style={{ ...metaStyle, marginTop: 2 }}>{middleMeta}</div> : null}</div>
        <div className="workspace-operational-cell"><div style={labelStyle}>STATUS / ACTION</div><StatusBadge value={job.current_status ?? job.status} /><div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}><ActionButton tone="secondary" onClick={onToggle}>{open ? 'Collapse' : 'Details'}</ActionButton><ActionButton tone="secondary" onClick={() => router.push(actionHref)}>{actionLabel}</ActionButton></div></div>
      </div>
      <div className="workspace-record-meta"><span>Load #{job.id.slice(0, 8).toUpperCase()}</span>{job.booking_reference && <span>Booking {job.booking_reference}</span>}{job.customer_reference && <span>Customer ref {job.customer_reference}</span>}<span>Vehicle {(job.vehicle_type ?? 'Not supplied').replaceAll('_', ' ')}</span></div>
      {open && sheet ? <CompanyJobSheetPanel jobId={job.id} mode="customer" /> : null}
    </article>
  );
}

export function CustomerLoadsOperationalPage() {
  const data = useCompanyWorkspaceData();
  const router = useRouter();
  const [tab, setTab] = useState<'all' | 'draft' | 'open' | 'awaiting_award' | 'awarded' | 'in_progress' | 'completed' | 'cancelled'>('all');
  const [reference, setReference] = useState('');
  const [pickup, setPickup] = useState('');
  const [delivery, setDelivery] = useState('');
  const [date, setDate] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const countsByJob = useMemo(() => quoteCounts(data), [data]);

  const matchesTab = (job: WorkspaceJob) => {
    const stage = classifyWorkspaceJobStage(job);
    const quotes = countsByJob.get(job.id)?.submitted ?? 0;
    if (tab === 'all') return true;
    if (tab === 'draft') return normalizedJobStatus(job) === 'draft';
    if (tab === 'open') return stage === 'open' && normalizedJobStatus(job) !== 'draft' && quotes === 0;
    if (tab === 'awaiting_award') return stage === 'open' && quotes > 0;
    if (tab === 'awarded') return stage === 'awarded' || stage === 'allocated';
    if (tab === 'in_progress') return stage === 'in_progress';
    if (tab === 'completed') return stage === 'completed';
    return stage === 'cancelled';
  };

  const rows = useMemo(() => {
    const refNeedle = reference.trim().toLowerCase();
    const pickupNeedle = pickup.trim().toLowerCase();
    const deliveryNeedle = delivery.trim().toLowerCase();
    return data.jobs
      .filter(matchesTab)
      .filter((job) => !refNeedle || `${job.id} ${job.booking_reference ?? ''} ${job.customer_reference ?? ''}`.toLowerCase().includes(refNeedle))
      .filter((job) => !pickupNeedle || `${job.pickup_postcode ?? ''} ${job.pickup_location ?? ''}`.toLowerCase().includes(pickupNeedle))
      .filter((job) => !deliveryNeedle || `${job.delivery_postcode ?? ''} ${job.delivery_location ?? ''}`.toLowerCase().includes(deliveryNeedle))
      .filter((job) => !date || String(job.pickup_datetime ?? '').slice(0, 10) === date)
      .sort((a, b) => String(b.updated_at ?? b.created_at ?? '').localeCompare(String(a.updated_at ?? a.created_at ?? '')));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countsByJob, data.jobs, date, delivery, pickup, reference, tab]);

  const tabCount = (target: typeof tab) => data.jobs.filter((job) => {
    const previous = tab;
    const stage = classifyWorkspaceJobStage(job);
    const quotes = countsByJob.get(job.id)?.submitted ?? 0;
    if (target === 'all') return true;
    if (target === 'draft') return normalizedJobStatus(job) === 'draft';
    if (target === 'open') return stage === 'open' && normalizedJobStatus(job) !== 'draft' && quotes === 0;
    if (target === 'awaiting_award') return stage === 'open' && quotes > 0;
    if (target === 'awarded') return stage === 'awarded' || stage === 'allocated';
    if (target === 'in_progress') return stage === 'in_progress';
    if (target === 'completed') return stage === 'completed';
    void previous;
    return stage === 'cancelled';
  }).length;

  const tabs: Array<{ id: typeof tab; label: string }> = [
    { id: 'all', label: 'All' }, { id: 'draft', label: 'Draft' }, { id: 'open', label: 'Open' },
    { id: 'awaiting_award', label: 'Awaiting Award' }, { id: 'awarded', label: 'Awarded' },
    { id: 'in_progress', label: 'In Progress' }, { id: 'completed', label: 'Completed' }, { id: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <PageFrame>
      <PageHeader eyebrow="Customer transport" title="Loads" description="One dense operational register from draft and quote activity through award, execution and delivery." actions={<><ActionButton tone="secondary" onClick={() => void data.refresh()}>Refresh</ActionButton><ActionButton tone="warning" onClick={() => router.push('/customer/post-load')}>Post Load</ActionButton></>} />
      {data.error && <AlertBanner tone="danger">{data.error}</AlertBanner>}

      <div className="workspace-board-layout">
        <aside className="workspace-filter-rail" aria-label="Customer load filters"><div className="workspace-filter-rail__header">Search Loads</div><div className="workspace-filter-rail__body"><label>DATE<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><label>PICKUP<input value={pickup} onChange={(event) => setPickup(event.target.value)} placeholder="Town / postcode" /></label><label>DELIVERY<input value={delivery} onChange={(event) => setDelivery(event.target.value)} placeholder="Town / postcode" /></label><label>LOAD ID / REF<input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Load, booking or customer ref" /></label><ActionButton tone="secondary" onClick={() => { setReference(''); setPickup(''); setDelivery(''); setDate(''); }}>Clear</ActionButton></div></aside>
        <main style={{ minWidth: 0 }}>
          <div className="workspace-tab-strip" role="tablist" aria-label="Customer load states" style={{ display: 'flex', overflowX: 'auto', marginBottom: 4 }}>{tabs.map((item) => <button key={item.id} type="button" data-active={tab === item.id ? 'true' : 'false'} onClick={() => { setTab(item.id); setExpanded(null); }}>{item.label} {tabCount(item.id)}</button>)}</div>
          <div className="workspace-record-meta" style={{ justifyContent: 'space-between' }}><span><strong>{rows.length}</strong> load{rows.length === 1 ? '' : 's'} in this view</span><span>Expand a row for the booking sheet after award</span></div>
          {data.loading ? <div className="workspace-panel"><EmptyState compact title="Loading loads…" /></div> : rows.length === 0 ? <div className="workspace-panel"><EmptyState title="No loads in this view" description="Adjust the filters or post a new transport request." /></div> : <div className="workspace-record-list">{rows.map((job) => { const quotes = countsByJob.get(job.id)?.submitted ?? 0; const open = expanded === job.id; return <CustomerOperationalRow key={job.id} job={job} middleLabel="QUOTES / VEHICLE" middleValue={`${quotes} quote${quotes === 1 ? '' : 's'}`} middleMeta={(job.vehicle_type ?? 'Vehicle not supplied').replaceAll('_', ' ')} open={open} onToggle={() => setExpanded(open ? null : job.id)} actionLabel={quotes > 0 && !job.awarded_carrier_company_id ? 'Review quotes' : 'Open booking'} actionHref={quotes > 0 && !job.awarded_carrier_company_id ? '/customer/quotes' : `/customer/jobs/${job.id}`} sheet={classifyWorkspaceJobStage(job) !== 'open'} />; })}</div>}
        </main>
      </div>
    </PageFrame>
  );
}

export function CustomerQuotesOperationalPage() {
  const data = useCompanyWorkspaceData();
  const router = useRouter();
  const [working, setWorking] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'accepted' | 'rejected'>('all');
  const [reference, setReference] = useState('');
  const [carrierSearch, setCarrierSearch] = useState('');

  const allQuotes = useMemo(() => data.bids.filter((bid) => ['submitted', 'accepted', 'rejected'].includes(bid.status)), [data.bids]);
  const grouped = useMemo(() => {
    const refNeedle = reference.trim().toLowerCase();
    const carrierNeedle = carrierSearch.trim().toLowerCase();
    return data.jobs.map((job) => ({
      job,
      quotes: allQuotes
        .filter((bid) => bid.job_id === job.id && (statusFilter === 'all' || bid.status === statusFilter))
        .filter((bid) => !carrierNeedle || `${bid.companies?.name ?? ''} ${bid.company_id ?? ''}`.toLowerCase().includes(carrierNeedle))
        .sort((a, b) => Number(a.bid_price_gbp ?? a.amount ?? 0) - Number(b.bid_price_gbp ?? b.amount ?? 0)),
    })).filter((group) => group.quotes.length > 0)
      .filter(({ job }) => !refNeedle || `${job.id} ${job.booking_reference ?? ''} ${job.customer_reference ?? ''}`.toLowerCase().includes(refNeedle));
  }, [allQuotes, carrierSearch, data.jobs, reference, statusFilter]);

  const award = async (id: string) => {
    setWorking(id); setMessage('');
    const { data: session } = await supabase.auth.getSession();
    const response = await fetch(`/api/customer/bids/${id}/award`, { method: 'POST', headers: session.session?.access_token ? { Authorization: `Bearer ${session.session.access_token}` } : {} });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    setWorking(null);
    if (!response.ok) { setMessage(payload.error ?? 'Unable to award quote.'); return; }
    setMessage('Carrier quote awarded successfully.');
    await data.refresh();
  };

  const reject = async (id: string) => {
    setWorking(id); setMessage('');
    const { data: session } = await supabase.auth.getSession();
    const response = await fetch(`/api/customer/bids/${id}/reject`, { method: 'POST', headers: session.session?.access_token ? { Authorization: `Bearer ${session.session.access_token}` } : {} });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    setWorking(null);
    if (!response.ok) { setMessage(payload.error ?? 'Unable to reject quote.'); return; }
    setMessage('Carrier quote rejected.');
    await data.refresh();
  };

  const counts = { all: allQuotes.length, submitted: allQuotes.filter((bid) => bid.status === 'submitted').length, accepted: allQuotes.filter((bid) => bid.status === 'accepted').length, rejected: allQuotes.filter((bid) => bid.status === 'rejected').length };

  return (
    <PageFrame>
      <PageHeader eyebrow="Customer commercial" title="Quotes" description="Compare carrier responses by load, inspect the member profile, then award or reject from the same operational board." actions={<ActionButton tone="secondary" onClick={() => void data.refresh()}>Refresh</ActionButton>} />
      {data.error && <AlertBanner tone="danger">{data.error}</AlertBanner>}{message && <AlertBanner tone={message.includes('successfully') || message.includes('rejected') ? 'success' : 'danger'}>{message}</AlertBanner>}
      <div className="workspace-board-layout">
        <aside className="workspace-filter-rail" aria-label="Customer quote filters"><div className="workspace-filter-rail__header">Search Quotes</div><div className="workspace-filter-rail__body"><label>LOAD ID / REF<input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Load or reference" /></label><label>CARRIER / MEMBER<input value={carrierSearch} onChange={(event) => setCarrierSearch(event.target.value)} placeholder="Company name or member" /></label><label>STATUS<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}><option value="all">All quote activity</option><option value="submitted">Awaiting decision</option><option value="accepted">Accepted</option><option value="rejected">Rejected</option></select></label><ActionButton tone="secondary" onClick={() => { setReference(''); setCarrierSearch(''); setStatusFilter('all'); }}>Clear</ActionButton></div></aside>
        <main style={{ minWidth: 0 }}>
          <div className="workspace-tab-strip" style={{ display: 'flex', overflowX: 'auto', marginBottom: 4 }}>{(['all', 'submitted', 'accepted', 'rejected'] as const).map((status) => <button key={status} type="button" data-active={statusFilter === status ? 'true' : 'false'} onClick={() => setStatusFilter(status)}>{status === 'all' ? 'All' : status === 'submitted' ? 'Awaiting Decision' : status[0].toUpperCase() + status.slice(1)} {counts[status]}</button>)}</div>
          <div className="workspace-record-meta" style={{ justifyContent: 'space-between' }}><span><strong>{grouped.length}</strong> load{grouped.length === 1 ? '' : 's'} with matching quotes</span><span>Lowest visible price shown first per load</span></div>
          {grouped.length === 0 ? <div className="workspace-panel"><EmptyState title={data.loading ? 'Loading quotes…' : 'No quotes in this view'} description="Carrier responses appear here after a load is published." /></div> : grouped.map(({ job, quotes }) => <section key={job.id} className="workspace-panel" style={{ marginBottom: 8 }}><div className="workspace-record-meta" style={{ justifyContent: 'space-between' }}><span><strong>{routeLabel(job)}</strong> · Pickup {when(job.pickup_datetime)} · Load {job.id.slice(0, 8).toUpperCase()}</span><ActionButton tone="secondary" onClick={() => router.push(`/customer/jobs/${job.id}`)}>Open load</ActionButton></div><DataTable columns={['Carrier', 'Price', 'Position', 'Message', 'Submitted', 'Status', 'Decision']} rows={quotes.map((bid, index) => [<strong key="carrier"><MemberIdentityLink companyId={bid.company_id}>{bid.companies?.name ?? 'Carrier'}</MemberIdentityLink></strong>, <strong key="price">{money(Number(bid.bid_price_gbp ?? bid.amount ?? 0), bid.currency ?? 'GBP')}</strong>, index === 0 ? <StatusBadge key="position" value="Best price" tone="green" /> : `#${index + 1}`, bid.message ?? 'No message', when(bid.created_at), <StatusBadge key="status" value={bid.status} />, bid.status === 'submitted' ? <span key="actions" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}><ActionButton tone="success" disabled={working === bid.id} onClick={() => void award(bid.id)}>{working === bid.id ? 'Working…' : 'Award'}</ActionButton><ActionButton tone="danger" disabled={working === bid.id} onClick={() => void reject(bid.id)}>Reject</ActionButton></span> : '—'])} /></section>)}
        </main>
      </div>
    </PageFrame>
  );
}

export function CustomerAwardsOperationalPage() {
  const data = useCompanyWorkspaceData();
  const [tab, setTab] = useState<'all' | 'allocated' | 'in_progress' | 'completed' | 'pod_ready'>('all');
  const [reference, setReference] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const bookings = useMemo(() => data.jobs.filter((job) => ['awarded', 'allocated', 'in_progress', 'completed'].includes(classifyWorkspaceJobStage(job))), [data.jobs]);
  const rows = useMemo(() => {
    const needle = reference.trim().toLowerCase();
    return bookings.filter((job) => {
      const stage = classifyWorkspaceJobStage(job);
      if (tab === 'allocated' && !['awarded', 'allocated'].includes(stage)) return false;
      if (tab === 'in_progress' && stage !== 'in_progress') return false;
      if (tab === 'completed' && stage !== 'completed') return false;
      if (tab === 'pod_ready' && (job.delivery_photos?.length ?? 0) === 0) return false;
      return !needle || `${job.id} ${job.booking_reference ?? ''} ${job.customer_reference ?? ''}`.toLowerCase().includes(needle);
    });
  }, [bookings, reference, tab]);
  const count = (target: typeof tab) => bookings.filter((job) => target === 'all' || target === 'allocated' ? (target === 'all' || ['awarded', 'allocated'].includes(classifyWorkspaceJobStage(job))) : target === 'in_progress' ? classifyWorkspaceJobStage(job) === 'in_progress' : target === 'completed' ? classifyWorkspaceJobStage(job) === 'completed' : (job.delivery_photos?.length ?? 0) > 0).length;

  return (
    <PageFrame>
      <PageHeader eyebrow="Customer operations" title="Bookings" description="Awarded transport stays in one booking register from carrier award through live execution, POD and completion." actions={<ActionButton tone="secondary" onClick={() => void data.refresh()}>Refresh</ActionButton>} />
      {data.error && <AlertBanner tone="danger">{data.error}</AlertBanner>}
      <div className="workspace-board-layout">
        <aside className="workspace-filter-rail" aria-label="Booking filters"><div className="workspace-filter-rail__header">Search Bookings</div><div className="workspace-filter-rail__body"><label>LOAD ID / REF<input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Load, booking or customer ref" /></label><div style={{ fontSize: 11, lineHeight: '15px', color: '#64748b' }}>Expand any booking to review the authorised Order, route, contacts, POD, history, documents and invoice data.</div><ActionButton tone="secondary" onClick={() => setReference('')}>Clear</ActionButton></div></aside>
        <main style={{ minWidth: 0 }}><div className="workspace-tab-strip" style={{ display: 'flex', overflowX: 'auto', marginBottom: 4 }}>{(['all', 'allocated', 'in_progress', 'completed', 'pod_ready'] as const).map((item) => <button key={item} type="button" data-active={tab === item ? 'true' : 'false'} onClick={() => { setTab(item); setExpanded(null); }}>{item === 'all' ? 'All' : item === 'allocated' ? 'Awarded / Allocated' : item === 'in_progress' ? 'In Progress' : item === 'completed' ? 'Completed' : 'POD Ready'} {count(item)}</button>)}</div><div className="workspace-record-meta"><span><strong>{rows.length}</strong> booking{rows.length === 1 ? '' : 's'}</span></div>{rows.length === 0 ? <div className="workspace-panel"><EmptyState title={data.loading ? 'Loading bookings…' : 'No bookings in this view'} /></div> : <div className="workspace-record-list">{rows.map((job) => { const open = expanded === job.id; return <CustomerOperationalRow key={job.id} job={job} middleLabel="BOOKING / POD" middleValue={job.booking_reference ?? `XDL-${job.id.slice(0, 8).toUpperCase()}`} middleMeta={(job.delivery_photos?.length ?? 0) > 0 ? 'POD captured' : 'POD pending'} open={open} onToggle={() => setExpanded(open ? null : job.id)} actionHref={`/customer/jobs/${job.id}`} sheet />; })}</div>}</main>
      </div>
    </PageFrame>
  );
}

export function CustomerDeliveriesOperationalPage() {
  const data = useCompanyWorkspaceData();
  const [tab, setTab] = useState<'all' | 'upcoming' | 'live' | 'delayed' | 'delivered' | 'pod_ready'>('all');
  const [reference, setReference] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const trackingJobs = useMemo(() => data.jobs.filter((job) => ['awarded', 'allocated', 'in_progress', 'completed'].includes(classifyWorkspaceJobStage(job))), [data.jobs]);
  const isDelayed = (job: WorkspaceJob) => classifyWorkspaceJobStage(job) === 'in_progress' && Boolean(job.delivery_datetime) && new Date(job.delivery_datetime as string).getTime() < Date.now();
  const rows = useMemo(() => {
    const needle = reference.trim().toLowerCase();
    return trackingJobs.filter((job) => {
      const stage = classifyWorkspaceJobStage(job);
      if (tab === 'upcoming' && !['awarded', 'allocated'].includes(stage)) return false;
      if (tab === 'live' && stage !== 'in_progress') return false;
      if (tab === 'delayed' && !isDelayed(job)) return false;
      if (tab === 'delivered' && stage !== 'completed') return false;
      if (tab === 'pod_ready' && (job.delivery_photos?.length ?? 0) === 0) return false;
      return !needle || `${job.id} ${job.booking_reference ?? ''} ${job.customer_reference ?? ''}`.toLowerCase().includes(needle);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference, tab, trackingJobs]);
  const count = (target: typeof tab) => trackingJobs.filter((job) => target === 'all' || target === 'upcoming' ? (target === 'all' || ['awarded', 'allocated'].includes(classifyWorkspaceJobStage(job))) : target === 'live' ? classifyWorkspaceJobStage(job) === 'in_progress' : target === 'delayed' ? isDelayed(job) : target === 'delivered' ? classifyWorkspaceJobStage(job) === 'completed' : (job.delivery_photos?.length ?? 0) > 0).length;

  useEffect(() => { setExpanded(null); }, [tab, reference]);

  return (
    <PageFrame>
      <PageHeader eyebrow="Customer delivery control" title="Tracking" description="Track awarded transport from upcoming collection through live movement, delivery and POD readiness." actions={<ActionButton tone="secondary" onClick={() => void data.refresh()}>Refresh</ActionButton>} />
      {data.error && <AlertBanner tone="danger">{data.error}</AlertBanner>}
      <div className="workspace-board-layout">
        <aside className="workspace-filter-rail" aria-label="Tracking filters"><div className="workspace-filter-rail__header">Search Tracking</div><div className="workspace-filter-rail__body"><label>LOAD ID / REF<input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Load, booking or customer ref" /></label><div style={{ fontSize: 11, lineHeight: '15px', color: '#64748b' }}>Delayed means an in-progress booking whose recorded delivery time has passed. No location or ETA is fabricated.</div><ActionButton tone="secondary" onClick={() => setReference('')}>Clear</ActionButton></div></aside>
        <main style={{ minWidth: 0 }}><div className="workspace-tab-strip" style={{ display: 'flex', overflowX: 'auto', marginBottom: 4 }}>{(['all', 'upcoming', 'live', 'delayed', 'delivered', 'pod_ready'] as const).map((item) => <button key={item} type="button" data-active={tab === item ? 'true' : 'false'} onClick={() => setTab(item)}>{item === 'all' ? 'All' : item === 'pod_ready' ? 'POD Ready' : item[0].toUpperCase() + item.slice(1)} {count(item)}</button>)}</div><div className="workspace-record-meta"><span><strong>{rows.length}</strong> tracked booking{rows.length === 1 ? '' : 's'}</span></div>{rows.length === 0 ? <div className="workspace-panel"><EmptyState title={data.loading ? 'Loading tracking…' : 'No tracked bookings in this view'} /></div> : <div className="workspace-record-list">{rows.map((job) => { const open = expanded === job.id; const delayed = isDelayed(job); return <CustomerOperationalRow key={job.id} job={job} middleLabel="TRACKING / POD" middleValue={delayed ? <StatusBadge value="Delayed" tone="red" /> : <StatusBadge value={classifyWorkspaceJobStage(job)} />} middleMeta={(job.delivery_photos?.length ?? 0) > 0 ? 'POD captured' : `Delivery ${when(job.delivery_datetime)}`} open={open} onToggle={() => setExpanded(open ? null : job.id)} actionLabel="Open booking" actionHref={`/customer/jobs/${job.id}`} sheet />; })}</div>}</main>
      </div>
    </PageFrame>
  );
}
