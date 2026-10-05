'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { classifyWorkspaceJobStage, normalizedJobStatus, workspaceJobOperationalLabel, workspaceJobPresentationStatus } from '../../lib/jobs/workspaceJobStage';
import { CompanyJobSheetPanel } from '../components/workspace/CompanyJobSheetPanel';
import { useCompanyWorkspaceData, type WorkspaceJob } from '../components/workspace/useCompanyWorkspaceData';
import {
  ActionButton,
  AlertBanner,
  EmptyState,
  PageFrame,
  PageHeader,
  StatusBadge,
} from '../components/workspace/WorkspaceUI';

const when = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Not set';

const labelStyle = { fontSize: 'var(--ws-font-label, 11px)', color: '#64748b', fontWeight: 700 } as const;
const metaStyle = { color: '#64748b', fontSize: 'var(--ws-font-meta, 11px)' } as const;

function quoteCounts(data: ReturnType<typeof useCompanyWorkspaceData>) {
  const map = new Map<string, { submitted: number; accepted: number; rejected: number; total: number }>();
  for (const bid of data.bids) {
    const row = map.get(bid.job_id) ?? { submitted: 0, accepted: 0, rejected: 0, total: 0 };
    if (bid.status === 'submitted') row.submitted += 1;
    if (bid.status === 'accepted') row.accepted += 1;
    if (bid.status === 'rejected') row.rejected += 1;
    if (['submitted', 'accepted', 'rejected'].includes(bid.status)) row.total += 1;
    map.set(bid.job_id, row);
  }
  return map;
}

type CustomerTrackingSnapshot = {
  tracking_active?: boolean;
  fresh?: boolean;
  eta?: { eta_at?: string | null; remaining_minutes?: number | null; remaining_miles?: number | null; late_by_minutes?: number | null } | null;
  eta_risk?: { level?: string; late_by_minutes?: number | null } | null;
  reason?: string | null;
};

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
  actionHref?: string;
  sheet?: boolean;
}) {
  const router = useRouter();
  const presentationState = workspaceJobPresentationStatus(job);
  const presentationStatus = workspaceJobOperationalLabel(job);
  const openDetails = () => {
    if (sheet) onToggle();
    else router.push(`/customer/jobs/${job.id}`);
  };
  return (
    <article className="workspace-operational-row" data-state={presentationState}>
      <div className="workspace-operational-row__top">
        <div className="workspace-operational-cell"><div style={labelStyle}>FROM</div><strong>{job.pickup_postcode ?? job.pickup_location ?? 'Collection'}</strong><div style={{ ...metaStyle, marginTop: 2 }}>{when(job.pickup_datetime)}</div></div>
        <div className="workspace-operational-cell"><div style={labelStyle}>TO</div><strong>{job.delivery_postcode ?? job.delivery_location ?? 'Delivery'}</strong><div style={{ ...metaStyle, marginTop: 2 }}>{when(job.delivery_datetime)}</div></div>
        <div className="workspace-operational-cell"><div style={labelStyle}>{middleLabel}</div><strong>{middleValue}</strong>{middleMeta ? <div style={{ ...metaStyle, marginTop: 2 }}>{middleMeta}</div> : null}</div>
        <div className="workspace-operational-cell"><div style={labelStyle}>STATUS / ACTION</div><StatusBadge value={presentationStatus} /><div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}><ActionButton tone="secondary" onClick={openDetails}>{sheet && open ? 'Collapse' : sheet ? 'Expand' : 'Details'}</ActionButton>{actionLabel && actionHref ? <ActionButton tone="secondary" onClick={() => router.push(actionHref)}>{actionLabel}</ActionButton> : null}</div></div>
      </div>
      <div className="workspace-record-meta"><span>XDrive XDL-{job.id.slice(0, 8).toUpperCase()}</span>{job.booking_reference && <span>Customer booking ref {job.booking_reference}</span>}{job.customer_reference && <span>Customer ref {job.customer_reference}</span>}<span>Vehicle {(job.vehicle_type ?? 'Not supplied').replaceAll('_', ' ')}</span></div>
      {open && sheet ? <CompanyJobSheetPanel jobId={job.id} mode="customer" /> : null}
    </article>
  );
}

export function CustomerLoadsOperationalPage() {
  const data = useCompanyWorkspaceData();
  const [tab, setTab] = useState<'all' | 'draft' | 'open' | 'awaiting_award' | 'awarded' | 'allocated' | 'in_progress' | 'completed' | 'cancelled'>('all');
  const [reference, setReference] = useState('');
  const [pickup, setPickup] = useState('');
  const [delivery, setDelivery] = useState('');
  const [date, setDate] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const countsByJob = useMemo(() => quoteCounts(data), [data]);

  const matchesTab = (job: WorkspaceJob) => {
    const stage = classifyWorkspaceJobStage(job);
    const submittedQuotes = countsByJob.get(job.id)?.submitted ?? 0;
    if (tab === 'all') return true;
    if (tab === 'draft') return normalizedJobStatus(job) === 'draft';
    if (tab === 'open') return stage === 'open' && normalizedJobStatus(job) !== 'draft' && submittedQuotes === 0;
    if (tab === 'awaiting_award') return stage === 'open' && submittedQuotes > 0;
    if (tab === 'awarded') return stage === 'awarded';
    if (tab === 'allocated') return stage === 'allocated';
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
      .filter((job) => !refNeedle || `${job.id} XDL-${job.id.slice(0, 8)} ${job.booking_reference ?? ''} ${job.customer_reference ?? ''}`.toLowerCase().includes(refNeedle))
      .filter((job) => !pickupNeedle || `${job.pickup_postcode ?? ''} ${job.pickup_location ?? ''}`.toLowerCase().includes(pickupNeedle))
      .filter((job) => !deliveryNeedle || `${job.delivery_postcode ?? ''} ${job.delivery_location ?? ''}`.toLowerCase().includes(deliveryNeedle))
      .filter((job) => !date || String(job.pickup_datetime ?? '').slice(0, 10) === date)
      .sort((a, b) => String(b.updated_at ?? b.created_at ?? '').localeCompare(String(a.updated_at ?? a.created_at ?? '')));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countsByJob, data.jobs, date, delivery, pickup, reference, tab]);

  const tabCount = (target: typeof tab) => data.jobs.filter((job) => {
    const stage = classifyWorkspaceJobStage(job);
    const submittedQuotes = countsByJob.get(job.id)?.submitted ?? 0;
    if (target === 'all') return true;
    if (target === 'draft') return normalizedJobStatus(job) === 'draft';
    if (target === 'open') return stage === 'open' && normalizedJobStatus(job) !== 'draft' && submittedQuotes === 0;
    if (target === 'awaiting_award') return stage === 'open' && submittedQuotes > 0;
    if (target === 'awarded') return stage === 'awarded';
    if (target === 'allocated') return stage === 'allocated';
    if (target === 'in_progress') return stage === 'in_progress';
    if (target === 'completed') return stage === 'completed';
    return stage === 'cancelled';
  }).length;

  const tabs: Array<{ id: typeof tab; label: string }> = [
    { id: 'all', label: 'All' }, { id: 'draft', label: 'Draft' }, { id: 'open', label: 'Open' },
    { id: 'awaiting_award', label: 'Awaiting Award' }, { id: 'awarded', label: 'Awarded' }, { id: 'allocated', label: 'Allocated' },
    { id: 'in_progress', label: 'In Progress' }, { id: 'completed', label: 'Completed' }, { id: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <PageFrame>
      <PageHeader eyebrow="Customer transport" title="Loads" description="One dense operational register from draft and quote activity through award, allocation, execution and delivery." actions={<ActionButton tone="secondary" onClick={() => void data.refresh()}>Refresh</ActionButton>} />
      {data.error && <AlertBanner tone="danger">{data.error}</AlertBanner>}

      <div className="workspace-board-layout">
        <aside className="workspace-filter-rail" aria-label="Customer load filters"><div className="workspace-filter-rail__header">Search Loads</div><div className="workspace-filter-rail__body"><label>DATE<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><label>PICKUP<input value={pickup} onChange={(event) => setPickup(event.target.value)} placeholder="Town / postcode" /></label><label>DELIVERY<input value={delivery} onChange={(event) => setDelivery(event.target.value)} placeholder="Town / postcode" /></label><label>LOAD ID / REF<input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="XDrive, customer booking or customer ref" /></label><ActionButton tone="secondary" onClick={() => { setReference(''); setPickup(''); setDelivery(''); setDate(''); }}>Clear</ActionButton></div></aside>
        <main style={{ minWidth: 0 }}>
          <div className="workspace-tab-strip" role="tablist" aria-label="Customer load states" style={{ display: 'flex', overflowX: 'auto', marginBottom: 4 }}>{tabs.map((item) => <button key={item.id} type="button" data-active={tab === item.id ? 'true' : 'false'} onClick={() => { setTab(item.id); setExpanded(null); }}>{item.label} {tabCount(item.id)}</button>)}</div>
          <div className="workspace-record-meta" style={{ justifyContent: 'space-between' }}><span><strong>{rows.length}</strong> load{rows.length === 1 ? '' : 's'} in this view</span><span>Open details before award; expand the booking sheet after award</span></div>
          {data.loading ? <div className="workspace-panel"><EmptyState compact title="Loading loads…" /></div> : rows.length === 0 ? <div className="workspace-panel"><EmptyState title="No loads in this view" description="Adjust the filters or post a new transport request." /></div> : <div className="workspace-record-list">{rows.map((job) => { const quoteState = countsByJob.get(job.id) ?? { submitted: 0, accepted: 0, rejected: 0, total: 0 }; const open = expanded === job.id; return <CustomerOperationalRow key={job.id} job={job} middleLabel="QUOTES / VEHICLE" middleValue={`${quoteState.total} quote${quoteState.total === 1 ? '' : 's'} recorded`} middleMeta={`${quoteState.submitted} awaiting decision · ${(job.vehicle_type ?? 'Vehicle not supplied').replaceAll('_', ' ')}`} open={open} onToggle={() => setExpanded(open ? null : job.id)} actionLabel={quoteState.submitted > 0 && !job.awarded_carrier_company_id ? 'Review quotes' : classifyWorkspaceJobStage(job) !== 'open' ? 'Open booking' : undefined} actionHref={quoteState.submitted > 0 && !job.awarded_carrier_company_id ? '/customer/quotes' : classifyWorkspaceJobStage(job) !== 'open' ? `/customer/jobs/${job.id}` : undefined} sheet={classifyWorkspaceJobStage(job) !== 'open'} />; })}</div>}
        </main>
      </div>
    </PageFrame>
  );
}

export function CustomerAwardsOperationalPage() {
  const data = useCompanyWorkspaceData();
  const [tab, setTab] = useState<'all' | 'awarded' | 'allocated' | 'in_progress' | 'completed' | 'photo_evidence'>('all');
  const [reference, setReference] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const bookings = useMemo(() => data.jobs.filter((job) => ['awarded', 'allocated', 'in_progress', 'completed'].includes(classifyWorkspaceJobStage(job))), [data.jobs]);
  const rows = useMemo(() => {
    const needle = reference.trim().toLowerCase();
    return bookings.filter((job) => {
      const stage = classifyWorkspaceJobStage(job);
      if (tab === 'awarded' && stage !== 'awarded') return false;
      if (tab === 'allocated' && stage !== 'allocated') return false;
      if (tab === 'in_progress' && stage !== 'in_progress') return false;
      if (tab === 'completed' && stage !== 'completed') return false;
      if (tab === 'photo_evidence' && (job.delivery_photos?.length ?? 0) === 0) return false;
      return !needle || `${job.id} XDL-${job.id.slice(0, 8)} ${job.booking_reference ?? ''} ${job.customer_reference ?? ''}`.toLowerCase().includes(needle);
    });
  }, [bookings, reference, tab]);
  const count = (target: typeof tab) => bookings.filter((job) => {
    const stage = classifyWorkspaceJobStage(job);
    if (target === 'all') return true;
    if (target === 'awarded') return stage === 'awarded';
    if (target === 'allocated') return stage === 'allocated';
    if (target === 'in_progress') return stage === 'in_progress';
    if (target === 'completed') return stage === 'completed';
    return (job.delivery_photos?.length ?? 0) > 0;
  }).length;

  return (
    <PageFrame>
      <PageHeader eyebrow="Customer operations" title="Bookings" description="Awarded transport stays in one booking register from carrier award through driver/vehicle allocation, live execution, POD and completion." actions={<ActionButton tone="secondary" onClick={() => void data.refresh()}>Refresh</ActionButton>} />
      {data.error && <AlertBanner tone="danger">{data.error}</AlertBanner>}
      <div className="workspace-board-layout">
        <aside className="workspace-filter-rail" aria-label="Booking filters"><div className="workspace-filter-rail__header">Search Bookings</div><div className="workspace-filter-rail__body"><label>LOAD ID / REF<input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="XDrive, customer booking or customer ref" /></label><div style={{ fontSize: 11, lineHeight: '15px', color: '#64748b' }}>Awarded means the carrier has won the work. Allocated means a driver and canonical vehicle have been assigned. Expand any booking for the authorised Order, route, contacts, POD, history, documents and invoice data.</div><ActionButton tone="secondary" onClick={() => setReference('')}>Clear</ActionButton></div></aside>
        <main style={{ minWidth: 0 }}><div className="workspace-tab-strip" style={{ display: 'flex', overflowX: 'auto', marginBottom: 4 }}>{(['all', 'awarded', 'allocated', 'in_progress', 'completed', 'photo_evidence'] as const).map((item) => <button key={item} type="button" data-active={tab === item ? 'true' : 'false'} onClick={() => { setTab(item); setExpanded(null); }}>{item === 'all' ? 'All' : item === 'awarded' ? 'Awarded' : item === 'allocated' ? 'Allocated' : item === 'in_progress' ? 'In Progress' : item === 'completed' ? 'Completed' : 'Photo Evidence'} {count(item)}</button>)}</div><div className="workspace-record-meta"><span><strong>{rows.length}</strong> booking{rows.length === 1 ? '' : 's'}</span></div>{rows.length === 0 ? <div className="workspace-panel"><EmptyState title={data.loading ? 'Loading bookings…' : 'No bookings in this view'} /></div> : <div className="workspace-record-list">{rows.map((job) => { const open = expanded === job.id; const hasDeliveryPhotos = (job.delivery_photos?.length ?? 0) > 0; return <CustomerOperationalRow key={job.id} job={job} middleLabel="BOOKING / EVIDENCE" middleValue={job.booking_reference ? `Customer ref ${job.booking_reference}` : `XDL-${job.id.slice(0, 8).toUpperCase()}`} middleMeta={hasDeliveryPhotos ? 'Delivery photo available · open booking for full POD state' : 'No delivery photo recorded · open booking for full POD state'} open={open} onToggle={() => setExpanded(open ? null : job.id)} actionHref={`/customer/jobs/${job.id}`} sheet />; })}</div>}</main>
      </div>
    </PageFrame>
  );
}

export function CustomerDeliveriesOperationalPage() {
  const data = useCompanyWorkspaceData();
  const [tab, setTab] = useState<'all' | 'upcoming' | 'live' | 'delayed' | 'delivered' | 'photo_evidence'>('all');
  const [reference, setReference] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [trackingSnapshots, setTrackingSnapshots] = useState<Record<string, CustomerTrackingSnapshot>>({});

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
      if (tab === 'photo_evidence' && (job.delivery_photos?.length ?? 0) === 0) return false;
      return !needle || `${job.id} XDL-${job.id.slice(0, 8)} ${job.booking_reference ?? ''} ${job.customer_reference ?? ''}`.toLowerCase().includes(needle);
    });
  }, [reference, tab, trackingJobs]);
  const count = (target: typeof tab) => trackingJobs.filter((job) => target === 'all' || target === 'upcoming' ? (target === 'all' || ['awarded', 'allocated'].includes(classifyWorkspaceJobStage(job))) : target === 'live' ? classifyWorkspaceJobStage(job) === 'in_progress' : target === 'delayed' ? isDelayed(job) : target === 'delivered' ? classifyWorkspaceJobStage(job) === 'completed' : (job.delivery_photos?.length ?? 0) > 0).length;

  useEffect(() => {
    let cancelled = false;
    const loadTracking = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        if (!cancelled) setTrackingSnapshots({});
        return;
      }
      const entries = await Promise.all(trackingJobs.map(async (job) => {
        try {
          const response = await fetch(`/api/tracking/jobs/${encodeURIComponent(job.id)}`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
          });
          if (!response.ok) return [job.id, {} as CustomerTrackingSnapshot] as const;
          const payload = await response.json().catch(() => ({})) as CustomerTrackingSnapshot;
          return [job.id, payload] as const;
        } catch {
          return [job.id, {} as CustomerTrackingSnapshot] as const;
        }
      }));
      if (!cancelled) setTrackingSnapshots(Object.fromEntries(entries));
    };
    void loadTracking();
    const timer = window.setInterval(() => void loadTracking(), 60_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [trackingJobs]);

  useEffect(() => { setExpanded(null); }, [tab, reference]);

  return (
    <PageFrame>
      <PageHeader eyebrow="Customer delivery control" title="Tracking" description="Track awarded transport from upcoming collection through live movement, delivery and available delivery-photo evidence." actions={<ActionButton tone="secondary" onClick={() => void data.refresh()}>Refresh</ActionButton>} />
      {data.error && <AlertBanner tone="danger">{data.error}</AlertBanner>}
      <div className="workspace-board-layout">
        <aside className="workspace-filter-rail" aria-label="Tracking filters"><div className="workspace-filter-rail__header">Search Tracking</div><div className="workspace-filter-rail__body"><label>LOAD ID / REF<input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="XDrive, customer booking or customer ref" /></label><div style={{ fontSize: 11, lineHeight: '15px', color: '#64748b' }}>Delayed means an in-progress booking whose recorded delivery time has passed. No location or ETA is fabricated. Full POD state remains in the booking sheet.</div><ActionButton tone="secondary" onClick={() => setReference('')}>Clear</ActionButton></div></aside>
        <main style={{ minWidth: 0 }}><div className="workspace-tab-strip" style={{ display: 'flex', overflowX: 'auto', marginBottom: 4 }}>{(['all', 'upcoming', 'live', 'delayed', 'delivered', 'photo_evidence'] as const).map((item) => <button key={item} type="button" data-active={tab === item ? 'true' : 'false'} onClick={() => setTab(item)}>{item === 'all' ? 'All' : item === 'photo_evidence' ? 'Photo Evidence' : item[0].toUpperCase() + item.slice(1)} {count(item)}</button>)}</div><div className="workspace-record-meta"><span><strong>{rows.length}</strong> tracked booking{rows.length === 1 ? '' : 's'}</span></div>{rows.length === 0 ? <div className="workspace-panel"><EmptyState title={data.loading ? 'Loading tracking…' : 'No tracked bookings in this view'} /></div> : <div className="workspace-record-list">{rows.map((job) => {
          const open = expanded === job.id;
          const delayed = isDelayed(job);
          const hasDeliveryPhotos = (job.delivery_photos?.length ?? 0) > 0;
          const snapshot = trackingSnapshots[job.id];
          const eta = snapshot?.eta;
          const etaText = eta?.eta_at
            ? `ETA ${when(eta.eta_at)}${eta.remaining_minutes != null ? ` · ${Math.round(eta.remaining_minutes)} min` : ''}${eta.remaining_miles != null ? ` · ${Number(eta.remaining_miles).toFixed(1)} mi` : ''}${snapshot?.fresh === false ? ' · last position stale' : ''}`
            : classifyWorkspaceJobStage(job) === 'in_progress'
              ? 'Live ETA unavailable until an approved tracking snapshot is available'
              : `Delivery ${when(job.delivery_datetime)}`;
          const evidenceText = hasDeliveryPhotos ? 'Delivery photo available' : 'Full POD state in booking';
          const trackingState = delayed
            ? <StatusBadge value="Delayed" tone="red" />
            : eta?.eta_at
              ? <StatusBadge value="Live ETA" tone="green" />
              : snapshot?.tracking_active
                ? <StatusBadge value="Tracking active" tone="blue" />
                : <StatusBadge value="Awaiting live position" tone="orange" />;
          return <CustomerOperationalRow key={job.id} job={job} middleLabel="TRACKING / ETA" middleValue={trackingState} middleMeta={`${etaText} · ${evidenceText}`} open={open} onToggle={() => setExpanded(open ? null : job.id)} actionLabel="Open full booking" actionHref={`/customer/jobs/${job.id}`} sheet />;
        })}</div>}</main>
      </div>
    </PageFrame>
  );
}
