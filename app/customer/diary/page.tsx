'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CompanyJobSheetPanel } from '../../components/workspace/CompanyJobSheetPanel';
import { MemberIdentityLink } from '../../components/workspace/MemberProfile';
import { useCompanyWorkspaceData, type WorkspaceJob } from '../../components/workspace/useCompanyWorkspaceData';
import { ActionButton, AlertBanner, EmptyState, PageFrame, PageHeader, StatusBadge } from '../../components/workspace/WorkspaceUI';
import { classifyWorkspaceJobStage, normalizedJobStatus } from '../../../lib/jobs/workspaceJobStage';

type DiaryTab = 'all' | 'open' | 'awaiting_award' | 'awarded' | 'in_progress' | 'delivered' | 'cancelled';
const when = (value: string | null | undefined) => value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not set';

function matchesTab(job: WorkspaceJob, tab: DiaryTab, hasSubmittedQuote: boolean) {
  if (tab === 'all') return true;
  const stage = classifyWorkspaceJobStage(job);
  if (tab === 'open') return stage === 'open' && !hasSubmittedQuote;
  if (tab === 'awaiting_award') return stage === 'open' && hasSubmittedQuote;
  if (tab === 'awarded') return stage === 'awarded' || stage === 'allocated';
  if (tab === 'in_progress') return stage === 'in_progress';
  if (tab === 'delivered') return stage === 'completed';
  return stage === 'cancelled';
}

export default function CustomerDiaryPage() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();
  const [tab, setTab] = useState<DiaryTab>('all');
  const [reference, setReference] = useState('');
  const [pickup, setPickup] = useState('');
  const [delivery, setDelivery] = useState('');
  const [carrier, setCarrier] = useState('');
  const [date, setDate] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const quoteInfoByJob = useMemo(() => {
    const map = new Map<string, {
      submitted: number;
      acceptedCompanyId: string | null;
      acceptedCompanyName: string | null;
      acceptedDriverId: string | null;
    }>();
    for (const bid of data.bids) {
      const row = map.get(bid.job_id) ?? {
        submitted: 0,
        acceptedCompanyId: null,
        acceptedCompanyName: null,
        acceptedDriverId: null,
      };
      if (bid.status === 'submitted') row.submitted += 1;
      if (bid.status === 'accepted') {
        row.acceptedCompanyId = bid.company_id ?? null;
        row.acceptedCompanyName = bid.companies?.name ?? null;
        row.acceptedDriverId = bid.bidder_driver_id ?? null;
      }
      map.set(bid.job_id, row);
    }
    return map;
  }, [data.bids]);

  const rows = useMemo(() => {
    const refNeedle = reference.trim().toLowerCase();
    const pickupNeedle = pickup.trim().toLowerCase();
    const deliveryNeedle = delivery.trim().toLowerCase();
    const carrierNeedle = carrier.trim().toLowerCase();
    return data.jobs
      .filter((job) => matchesTab(job, tab, (quoteInfoByJob.get(job.id)?.submitted ?? 0) > 0))
      .filter((job) => !refNeedle || `${job.id} ${job.booking_reference ?? ''} ${job.customer_reference ?? ''}`.toLowerCase().includes(refNeedle))
      .filter((job) => !pickupNeedle || `${job.pickup_postcode ?? ''} ${job.pickup_location ?? ''}`.toLowerCase().includes(pickupNeedle))
      .filter((job) => !deliveryNeedle || `${job.delivery_postcode ?? ''} ${job.delivery_location ?? ''}`.toLowerCase().includes(deliveryNeedle))
      .filter((job) => {
        if (!carrierNeedle) return true;
        const info = quoteInfoByJob.get(job.id);
        return `${info?.acceptedCompanyName ?? ''} ${info?.acceptedCompanyId ?? ''} ${info?.acceptedDriverId ?? ''} ${info?.acceptedDriverId && !info.acceptedCompanyId ? 'owner driver' : ''} ${job.awarded_carrier_company_id ?? ''}`.toLowerCase().includes(carrierNeedle);
      })
      .filter((job) => !date || String(job.pickup_datetime ?? '').slice(0, 10) === date)
      .sort((a, b) => String(b.updated_at ?? b.created_at ?? '').localeCompare(String(a.updated_at ?? a.created_at ?? '')));
  }, [carrier, data.jobs, date, delivery, pickup, quoteInfoByJob, reference, tab]);

  const counts = useMemo(() => {
    const count = (target: DiaryTab) => data.jobs.filter((job) => matchesTab(job, target, (quoteInfoByJob.get(job.id)?.submitted ?? 0) > 0)).length;
    return {
      all: data.jobs.length,
      open: count('open'),
      awaiting_award: count('awaiting_award'),
      awarded: count('awarded'),
      in_progress: count('in_progress'),
      delivered: count('delivered'),
      cancelled: count('cancelled'),
    };
  }, [data.jobs, quoteInfoByJob]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => { setPage(1); setExpanded(null); }, [tab, reference, pickup, delivery, carrier, date, pageSize]);

  const tabs: Array<{ id: DiaryTab; label: string; count: number }> = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'open', label: 'Open', count: counts.open },
    { id: 'awaiting_award', label: 'Awaiting Award', count: counts.awaiting_award },
    { id: 'awarded', label: 'Awarded', count: counts.awarded },
    { id: 'in_progress', label: 'In Progress', count: counts.in_progress },
    { id: 'delivered', label: 'Delivered', count: counts.delivered },
    { id: 'cancelled', label: 'Cancelled', count: counts.cancelled },
  ];
  const clear = () => { setReference(''); setPickup(''); setDelivery(''); setCarrier(''); setDate(''); };
  const labelStyle = { fontSize: 'var(--ws-font-label, 11px)', color: '#64748b', fontWeight: 700 } as const;
  const metaStyle = { color: '#64748b', fontSize: 'var(--ws-font-meta, 11px)' } as const;

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Customer operations"
        title="Diary"
        description="Search, scan and expand every transport booking from quote activity through delivery, POD and invoice."
        actions={<ActionButton tone="secondary" onClick={() => void data.refresh()}>Refresh</ActionButton>}
      />
      {data.error && <AlertBanner tone="danger">{data.error}</AlertBanner>}

      <div className="workspace-board-layout">
        <aside className="workspace-filter-rail" aria-label="Customer diary filters">
          <div className="workspace-filter-rail__header">Search Diary</div>
          <div className="workspace-filter-rail__body">
            <label>DATE<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
            <label>PICKUP<input value={pickup} onChange={(event) => setPickup(event.target.value)} placeholder="Town / postcode" /></label>
            <label>DELIVERY<input value={delivery} onChange={(event) => setDelivery(event.target.value)} placeholder="Town / postcode" /></label>
            <label>LOAD ID / REF<input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Job, booking or customer ref" /></label>
            <label>AWARDED CARRIER / MEMBER<input value={carrier} onChange={(event) => setCarrier(event.target.value)} placeholder="Carrier company / owner driver / ID" /></label>
            <div style={{ display: 'grid', gap: 4 }}><span style={metaStyle}>Filters apply as you type.</span><ActionButton tone="secondary" onClick={clear}>Clear</ActionButton></div>
          </div>
        </aside>

        <main style={{ minWidth: 0 }}>
          <div className="workspace-tab-strip" role="tablist" aria-label="Customer diary states" style={{ display: 'flex', overflowX: 'auto', marginBottom: 4 }}>
            {tabs.map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} data-active={tab === item.id ? 'true' : 'false'} onClick={() => setTab(item.id)}>{item.label} {item.count}</button>)}
          </div>

          <div className="workspace-record-meta" style={{ justifyContent: 'space-between' }}>
            <span><strong>{rows.length}</strong> booking{rows.length === 1 ? '' : 's'} · page {safePage}/{totalPages}</span>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>Per page<select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} style={{ minHeight: 28 }}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></label>
          </div>

          {data.loading ? (
            <div className="workspace-panel"><EmptyState compact title="Loading diary…" /></div>
          ) : visibleRows.length === 0 ? (
            <div className="workspace-panel"><EmptyState title="No bookings in this view" description="Adjust the filters or select another operational state." /></div>
          ) : (
            <div className="workspace-record-list">
              {visibleRows.map((job) => {
                const quoteInfo = quoteInfoByJob.get(job.id);
                const open = expanded === job.id;
                const deliveryPhotoAvailable = (job.delivery_photos?.length ?? 0) > 0;
                const carrierCompanyId = quoteInfo?.acceptedCompanyId ?? job.awarded_carrier_company_id ?? null;
                const awardedDriverId = quoteInfo?.acceptedDriverId ?? null;
                const awardedOwnerDriverId = !carrierCompanyId ? awardedDriverId : null;
                const carrierName = quoteInfo?.acceptedCompanyName ?? (carrierCompanyId ? 'Awarded carrier' : awardedOwnerDriverId ? 'Owner Driver' : 'Not awarded');
                return (
                  <article key={job.id} className="workspace-operational-row" data-state={normalizedJobStatus(job)}>
                    <div className="workspace-operational-row__top">
                      <div className="workspace-operational-cell"><div style={labelStyle}>FROM</div><strong>{job.pickup_postcode ?? job.pickup_location ?? 'Collection'}</strong><div style={{ ...metaStyle, marginTop: 2 }}>{when(job.pickup_datetime)}</div></div>
                      <div className="workspace-operational-cell"><div style={labelStyle}>TO</div><strong>{job.delivery_postcode ?? job.delivery_location ?? 'Delivery'}</strong><div style={{ ...metaStyle, marginTop: 2 }}>{when(job.delivery_datetime)}</div></div>
                      <div className="workspace-operational-cell"><div style={labelStyle}>AWARDED CARRIER / MEMBER</div><strong>{carrierCompanyId || awardedOwnerDriverId ? <MemberIdentityLink companyId={carrierCompanyId} driverId={awardedOwnerDriverId}>{carrierName}</MemberIdentityLink> : carrierName}</strong><div style={{ ...metaStyle, marginTop: 2 }}>{quoteInfo?.submitted ?? 0} submitted quote{(quoteInfo?.submitted ?? 0) === 1 ? '' : 's'}{job.assigned_driver_id ? ' · executing driver assigned' : ''}</div></div>
                      <div className="workspace-operational-cell"><div style={labelStyle}>STATUS / ACTION</div><StatusBadge value={job.current_status ?? job.status} /><div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}><ActionButton tone="secondary" onClick={() => setExpanded(open ? null : job.id)}>{open ? 'Collapse' : 'Details'}</ActionButton><ActionButton tone="secondary" onClick={() => router.push(`/customer/jobs/${job.id}`)}>Open booking</ActionButton><ActionButton tone="secondary" onClick={() => router.push(`/job-replay/${job.id}`)}>Replay</ActionButton></div></div>
                    </div>
                    <div className="workspace-record-meta"><span>Load #{job.id.slice(0, 8).toUpperCase()}</span>{job.booking_reference && <span>Booking {job.booking_reference}</span>}{job.customer_reference && <span>Customer ref {job.customer_reference}</span>}<span>Delivery photo: {deliveryPhotoAvailable ? 'Available' : 'Not recorded'}</span><span>Updated {when(job.updated_at)}</span></div>
                    {open && <CompanyJobSheetPanel jobId={job.id} mode="customer" />}
                  </article>
                );
              })}
            </div>
          )}

          {rows.length > pageSize && <div className="workspace-record-meta" style={{ justifyContent: 'center', gap: 8, marginTop: 6 }}><ActionButton tone="secondary" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</ActionButton><span>Page {safePage} / {totalPages}</span><ActionButton tone="secondary" disabled={safePage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next</ActionButton></div>}
        </main>
      </div>
    </PageFrame>
  );
}
