'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CompanyJobSheetPanel } from '../../components/workspace/CompanyJobSheetPanel';
import { MemberIdentityLink } from '../../components/workspace/MemberProfile';
import { useCompanyWorkspaceData, type WorkspaceJob } from '../../components/workspace/useCompanyWorkspaceData';
import { ActionButton, AlertBanner, EmptyState, PageFrame, PageHeader, StatusBadge } from '../../components/workspace/WorkspaceUI';
import { brokerDiaryStage, normalizedJobStatus } from '../../../lib/jobs/workspaceJobStage';

type DiaryTab = 'all' | 'unallocated' | 'allocated' | 'in_progress' | 'completed' | 'cancelled' | 'expired' | 'feedback';
const when = (value: string | null | undefined) => value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not set';
const postcodeOrLocation = (postcode: string | null | undefined, location: string | null | undefined) => postcode || location || 'Not set';

function matchesTab(job: WorkspaceJob, tab: DiaryTab) {
  if (tab === 'all') return true;
  if (tab === 'feedback') return false;
  return brokerDiaryStage(job) === tab;
}

export default function BrokerDiaryPage() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();
  const [tab, setTab] = useState<DiaryTab>('all');
  const [reference, setReference] = useState('');
  const [customer, setCustomer] = useState('');
  const [carrier, setCarrier] = useState('');
  const [pickup, setPickup] = useState('');
  const [delivery, setDelivery] = useState('');
  const [date, setDate] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const acceptedCarrierByJob = useMemo(() => {
    const map = new Map<string, { companyId: string | null; companyName: string | null }>();
    for (const bid of data.bids) {
      if (bid.status !== 'accepted') continue;
      map.set(bid.job_id, {
        companyId: bid.company_id ?? null,
        companyName: bid.companies?.name ?? null,
      });
    }
    return map;
  }, [data.bids]);

  const rows = useMemo(() => {
    const refTerm = reference.trim().toLowerCase();
    const customerTerm = customer.trim().toLowerCase();
    const carrierTerm = carrier.trim().toLowerCase();
    const pickupTerm = pickup.trim().toLowerCase();
    const deliveryTerm = delivery.trim().toLowerCase();
    return data.jobs
      .filter((job) => matchesTab(job, tab))
      .filter((job) => !refTerm || `${job.id} ${job.booking_reference ?? ''} ${job.customer_reference ?? ''}`.toLowerCase().includes(refTerm))
      .filter((job) => !customerTerm || String(job.client_name || '').toLowerCase().includes(customerTerm))
      .filter((job) => {
        if (!carrierTerm) return true;
        const carrierInfo = acceptedCarrierByJob.get(job.id);
        return `${carrierInfo?.companyName ?? ''} ${carrierInfo?.companyId ?? ''} ${job.awarded_carrier_company_id ?? ''}`.toLowerCase().includes(carrierTerm);
      })
      .filter((job) => !pickupTerm || `${job.pickup_postcode || ''} ${job.pickup_location || ''}`.toLowerCase().includes(pickupTerm))
      .filter((job) => !deliveryTerm || `${job.delivery_postcode || ''} ${job.delivery_location || ''}`.toLowerCase().includes(deliveryTerm))
      .filter((job) => !date || String(job.pickup_datetime || '').slice(0, 10) === date)
      .sort((a, b) => String(b.pickup_datetime || b.created_at).localeCompare(String(a.pickup_datetime || a.created_at)));
  }, [acceptedCarrierByJob, carrier, customer, data.jobs, date, delivery, pickup, reference, tab]);

  const counts = useMemo(() => ({
    all: data.jobs.length,
    unallocated: data.jobs.filter((job) => matchesTab(job, 'unallocated')).length,
    allocated: data.jobs.filter((job) => matchesTab(job, 'allocated')).length,
    in_progress: data.jobs.filter((job) => matchesTab(job, 'in_progress')).length,
    completed: data.jobs.filter((job) => matchesTab(job, 'completed')).length,
    cancelled: data.jobs.filter((job) => matchesTab(job, 'cancelled')).length,
    expired: data.jobs.filter((job) => matchesTab(job, 'expired')).length,
  }), [data.jobs]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => { setPage(1); setExpanded(null); }, [tab, reference, customer, carrier, pickup, delivery, date, pageSize]);

  const reset = () => { setReference(''); setCustomer(''); setCarrier(''); setPickup(''); setDelivery(''); setDate(''); };
  const tabs: Array<{ id: DiaryTab; label: string; count?: number }> = [
    { id: 'all', label: 'All', count: counts.all }, { id: 'unallocated', label: 'Unallocated', count: counts.unallocated },
    { id: 'allocated', label: 'Allocated', count: counts.allocated }, { id: 'in_progress', label: 'In Progress', count: counts.in_progress },
    { id: 'completed', label: 'Completed', count: counts.completed }, { id: 'cancelled', label: 'Cancelled', count: counts.cancelled },
    { id: 'expired', label: 'Expired', count: counts.expired }, { id: 'feedback', label: 'Feedback' },
  ];
  const labelStyle = { fontSize: 'var(--ws-font-label, 11px)', color: '#64748b', fontWeight: 700 } as const;
  const metaStyle = { color: '#64748b', fontSize: 'var(--ws-font-meta, 11px)' } as const;

  return (
    <PageFrame>
      <PageHeader eyebrow="Broker operations" title="Diary" description="Search, scan and expand every broker-managed booking from one operational register." actions={<ActionButton tone="secondary" onClick={() => void data.refresh()}>Refresh</ActionButton>} />
      {data.error && <AlertBanner tone="danger">{data.error}</AlertBanner>}

      <div className="workspace-board-layout">
        <aside className="workspace-filter-rail" aria-label="Diary filters">
          <div className="workspace-filter-rail__header">Search Diary</div>
          <div className="workspace-filter-rail__body">
            <label>DATE<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
            <label>PICKUP<input value={pickup} onChange={(event) => setPickup(event.target.value)} placeholder="Town / postcode" /></label>
            <label>DELIVERY<input value={delivery} onChange={(event) => setDelivery(event.target.value)} placeholder="Town / postcode" /></label>
            <label>LOAD ID / REF<input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Job, booking or customer ref" /></label>
            <label>CUSTOMER<input value={customer} onChange={(event) => setCustomer(event.target.value)} placeholder="Customer name" /></label>
            <label>CARRIER / MEMBER<input value={carrier} onChange={(event) => setCarrier(event.target.value)} placeholder="Carrier name / company ID" /></label>
            <div style={{ display: 'grid', gap: 4 }}><span style={metaStyle}>Customer and executing carrier remain separate operational relationships.</span><ActionButton tone="secondary" onClick={reset}>Clear</ActionButton></div>
          </div>
        </aside>

        <main style={{ minWidth: 0 }}>
          <div className="workspace-tab-strip" style={{ display: 'flex', overflowX: 'auto', marginBottom: 4 }}>
            {tabs.map((item) => <button key={item.id} type="button" data-active={tab === item.id ? 'true' : 'false'} onClick={() => setTab(item.id)} title={item.id === 'feedback' ? 'Feedback records require a verified broker feedback source.' : undefined}>{item.label}{typeof item.count === 'number' ? ` ${item.count}` : ''}</button>)}
          </div>

          <div className="workspace-record-meta" style={{ justifyContent: 'space-between' }}>
            <span><strong>{rows.length}</strong> booking{rows.length === 1 ? '' : 's'} · page {safePage}/{totalPages}</span>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>Per page<select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} style={{ minHeight: 28 }}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></label>
          </div>

          {tab === 'feedback' ? (
            <div className="workspace-panel"><EmptyState title="Broker feedback feed not exposed" description="The verified broker workspace contract does not yet expose member-level feedback attribution, so synthetic feedback records are not shown." /></div>
          ) : data.loading ? (
            <div className="workspace-panel"><EmptyState compact title="Loading Diary…" /></div>
          ) : visibleRows.length === 0 ? (
            <div className="workspace-panel"><EmptyState title="No diary records" description="Adjust the filters or select another operational status." /></div>
          ) : (
            <div className="workspace-record-list">
              {visibleRows.map((job) => {
                const open = expanded === job.id;
                const deliveryPhotoAvailable = (job.delivery_photos?.length || 0) > 0;
                const carrierInfo = acceptedCarrierByJob.get(job.id);
                const carrierCompanyId = carrierInfo?.companyId ?? job.awarded_carrier_company_id ?? null;
                const carrierName = carrierInfo?.companyName ?? (carrierCompanyId ? 'Awarded carrier' : 'Not awarded');
                return (
                  <article className="workspace-operational-row" key={job.id} data-state={normalizedJobStatus(job)}>
                    <div className="workspace-operational-row__top">
                      <div className="workspace-operational-cell"><div style={labelStyle}>FROM</div><strong>{postcodeOrLocation(job.pickup_postcode, job.pickup_location)}</strong><div style={{ ...metaStyle, marginTop: 2 }}>{when(job.pickup_datetime)}</div></div>
                      <div className="workspace-operational-cell"><div style={labelStyle}>TO</div><strong>{postcodeOrLocation(job.delivery_postcode, job.delivery_location)}</strong><div style={{ ...metaStyle, marginTop: 2 }}>{when(job.delivery_datetime)}</div></div>
                      <div className="workspace-operational-cell"><div style={labelStyle}>CUSTOMER / CARRIER</div><strong>{job.client_name || 'Customer not set'}</strong><div style={{ ...metaStyle, marginTop: 2 }}>{carrierCompanyId ? <MemberIdentityLink companyId={carrierCompanyId}>{carrierName}</MemberIdentityLink> : carrierName} · {(job.vehicle_type || 'Vehicle not set').replaceAll('_', ' ')}</div></div>
                      <div className="workspace-operational-cell"><div style={labelStyle}>STATUS / ACTION</div><StatusBadge value={job.current_status || job.status} /><div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}><ActionButton tone="secondary" onClick={() => setExpanded(open ? null : job.id)}>{open ? 'Collapse' : 'Details'}</ActionButton><ActionButton tone="secondary" onClick={() => router.push(`/broker/jobs?job=${job.id}`)}>Open job</ActionButton><ActionButton tone="secondary" onClick={() => router.push(`/job-replay/${job.id}`)}>Replay</ActionButton></div></div>
                    </div>
                    <div className="workspace-record-meta"><span>Load #{job.id.slice(0, 8).toUpperCase()}</span>{job.booking_reference && <span>Booking {job.booking_reference}</span>}{job.customer_reference && <span>Customer ref {job.customer_reference}</span>}<span>Delivery photo: {deliveryPhotoAvailable ? 'Available' : 'Not recorded'}</span></div>
                    {open && <CompanyJobSheetPanel jobId={job.id} mode="broker" />}
                  </article>
                );
              })}
            </div>
          )}

          {tab !== 'feedback' && rows.length > pageSize && <div className="workspace-record-meta" style={{ justifyContent: 'center', gap: 8, marginTop: 6 }}><ActionButton tone="secondary" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</ActionButton><span>Page {safePage} / {totalPages}</span><ActionButton tone="secondary" disabled={safePage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next</ActionButton></div>}
        </main>
      </div>
    </PageFrame>
  );
}
