'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CompanyJobSheetPanel } from '../../components/workspace/CompanyJobSheetPanel';
import { CompanyFeedbackDialog } from '../../components/workspace/CompanyFeedbackDialog';
import { MemberIdentityLink } from '../../components/workspace/MemberProfile';
import { useAuth } from '../../components/AuthContext';
import { useCompanyWorkspaceData, type WorkspaceJob } from '../../components/workspace/useCompanyWorkspaceData';
import { workspaceVehicleImageSrc } from '../../components/workspace/vehiclePresentation';
import { ActionButton, AlertBanner, EmptyState, PageFrame } from '../../components/workspace/WorkspaceUI';
import { classifyWorkspaceJobStage, normalizedJobStatus, workspaceJobOperationalLabel } from '../../../lib/jobs/workspaceJobStage';
import { getCanonicalDiaryTabs, matchesCanonicalDiaryBucket, type CanonicalDiaryBucket } from '../../../lib/diary/canonicalDiary';
import { supabase } from '../../../lib/supabaseClient';
import { canLeaveCompanyFeedback } from '../../../lib/feedback/canonicalFeedback';

type DiaryTab = CanonicalDiaryBucket;
type ReviewRow = { id: string; job_id: string | null; reviewer_company_id: string | null; rating: number | null; comment: string | null; created_at: string | null };
const CUSTOMER_DIARY_TABS = getCanonicalDiaryTabs('customer');
const when = (value: string | null | undefined) => value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not set';
const cxTimeParts = (value: string | null | undefined) => {
  if (!value) return { primary: 'ASAP', meta: '' };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { primary: 'Not set', meta: '' };
  const zone = new Intl.DateTimeFormat('en-GB', { timeZoneName: 'short' }).formatToParts(date).find((part) => part.type === 'timeZoneName')?.value ?? '';
  return { primary: date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), meta: `${zone ? ` (${zone})` : ''} ${date.toLocaleDateString('en-GB')}` };
};
const routeLocationLabel = (location: string | null | undefined, postcode: string | null | undefined, fallback: string) => {
  const place = location?.trim() ?? '';
  const code = postcode?.trim() ?? '';
  if (place && code) return place.toUpperCase().includes(code.toUpperCase()) ? place : place + ', ' + code;
  return place || code || fallback;
};

function matchesTab(job: WorkspaceJob, tab: DiaryTab, hasSubmittedQuote: boolean, hasFeedback: boolean, companyId: string | null) {
  return matchesCanonicalDiaryBucket(job, tab, {
    hasSubmittedQuote,
    hasFeedback,
    feedbackEligible: canLeaveCompanyFeedback(job, companyId),
    hasEvidence: job.pod_generated === true || job.has_delivery_evidence === true || (job.delivery_photos?.length ?? 0) > 0 || (job.pod_photos?.length ?? 0) > 0,
  });
}

export default function CustomerDiaryPage() {
  const router = useRouter();
  const { user } = useAuth();
  const data = useCompanyWorkspaceData();
  const [tab, setTab] = useState<DiaryTab>('all');
  const [reference, setReference] = useState('');
  const [pickup, setPickup] = useState('');
  const [delivery, setDelivery] = useState('');
  const [carrier, setCarrier] = useState('');
  const [date, setDate] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [expandAll, setExpandAll] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [reviewsByJob, setReviewsByJob] = useState<Record<string, ReviewRow[]>>({});
  const [feedbackJobId, setFeedbackJobId] = useState<string | null>(null);

  const companyId = data.companyId;
  const canManageFeedback = Boolean(user?.membershipRole && ['owner', 'admin', 'dispatcher', 'fleet_manager'].includes(user.membershipRole));

  const loadReviews = useCallback(async () => {
    const jobIds = data.jobs.map((job) => job.id).filter(Boolean);
    if (!companyId || !jobIds.length) {
      setReviewsByJob({});
      return;
    }
    const { data: reviews, error } = await supabase
      .from('reviews')
      .select('id, job_id, reviewer_company_id, rating, comment, created_at')
      .eq('reviewer_company_id', companyId)
      .in('job_id', jobIds)
      .order('created_at', { ascending: false });
    if (error) return;
    const grouped: Record<string, ReviewRow[]> = {};
    for (const review of (reviews ?? []) as ReviewRow[]) {
      if (!review.job_id) continue;
      (grouped[review.job_id] ??= []).push(review);
    }
    setReviewsByJob(grouped);
  }, [companyId, data.jobs]);

  useEffect(() => { void loadReviews(); }, [loadReviews]);

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
      .filter((job) => matchesTab(job, tab, (quoteInfoByJob.get(job.id)?.submitted ?? 0) > 0, (reviewsByJob[job.id]?.length ?? 0) > 0, companyId))
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
  }, [carrier, companyId, data.jobs, date, delivery, pickup, quoteInfoByJob, reference, reviewsByJob, tab]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => { setPage(1); setExpanded(null); setExpandAll(false); }, [tab, reference, pickup, delivery, carrier, date, pageSize]);

  const tabs = CUSTOMER_DIARY_TABS;
  const clear = () => { setReference(''); setPickup(''); setDelivery(''); setCarrier(''); setDate(''); };
  const metaStyle = { color: '#64748b', fontSize: 'var(--ws-font-meta, 11px)' } as const;

  return (
    <PageFrame>
      {data.error && <AlertBanner tone="danger">{data.error}</AlertBanner>}

      <div className="workspace-board-layout">
        <aside className="workspace-filter-rail cx-diary-filter-rail" aria-label="Customer diary filters">
          <div className="cx-diary-rail-nav">
            <ActionButton tone="secondary" onClick={() => router.push('/customer/network/directory')}>Contacts</ActionButton>
            <ActionButton tone="secondary" onClick={() => router.push('/customer/invoices')}>Invoices</ActionButton>
          </div>
          <div className="workspace-filter-rail__header">Search Panel</div>
          <div className="workspace-filter-rail__body">
            <label>Date:<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
            <label>Pickup:<input value={pickup} onChange={(event) => setPickup(event.target.value)} placeholder="Town / postcode" /></label>
            <label>Delivery:<input value={delivery} onChange={(event) => setDelivery(event.target.value)} placeholder="Town / postcode" /></label>
            <label>Load ID / Ref:<input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Job, booking or customer ref" /></label>
            <label>Awarded Carrier / Member:<input value={carrier} onChange={(event) => setCarrier(event.target.value)} placeholder="Carrier company / owner driver / ID" /></label>
            <div style={{ display: 'grid', gap: 4 }}><span style={metaStyle}>Filters apply as you type.</span><div className="workspace-filter-actions"><ActionButton tone="success" onClick={() => setPage(1)}>Search</ActionButton><ActionButton tone="secondary" onClick={clear}>Clear</ActionButton></div></div>
          </div>
        </aside>

        <main style={{ minWidth: 0 }}>
          <div className="workspace-record-meta workspace-list-controls cx-diary-toolbar">
            <span className="cx-diary-toolbar__title"><span className="cx-diary-toolbar__calendar" aria-hidden="true">▣</span><strong>Diary at {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}</strong></span>
            <span className="workspace-list-controls__right">
              <button type="button" className="cx-expand-entries-control" disabled={!visibleRows.length} onClick={() => { setExpandAll((current) => !current); setExpanded(null); }}>{expandAll ? 'Collapse All Entries' : 'Expand All Entries'}</button>
              <ActionButton tone="secondary" onClick={() => void data.refresh()}>Refresh</ActionButton>
            </span>
          </div>
          <div className="workspace-tab-strip cx-diary-state-tabs" role="tablist" aria-label="Customer diary states">
            {tabs.map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} data-active={tab === item.id ? 'true' : 'false'} onClick={() => setTab(item.id)}>{item.label}</button>)}
            <span className="cx-diary-pagination">
              <label>Items per Page: <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></label>
              <button type="button" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} aria-label="Previous Diary page">‹</button>
              <span>{rows.length === 0 ? '0' : `${(safePage - 1) * pageSize + 1}-${Math.min(safePage * pageSize, rows.length)} of ${rows.length}`}</span>
              <button type="button" disabled={safePage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} aria-label="Next Diary page">›</button>
            </span>
          </div>

          {data.loading ? (
            <div className="workspace-panel"><EmptyState compact title="Loading diary…" /></div>
          ) : visibleRows.length === 0 ? (
            <div className="workspace-panel"><EmptyState title="No bookings in this view" description="Adjust the filters or select another operational state." /></div>
          ) : (
            <div className="workspace-record-list">
              {visibleRows.map((job) => {
                const quoteInfo = quoteInfoByJob.get(job.id);
                const open = expandAll || expanded === job.id;
                const deliveryPhotoAvailable = (job.delivery_photos?.length ?? 0) > 0;
                const carrierCompanyId = quoteInfo?.acceptedCompanyId ?? job.awarded_carrier_company_id ?? null;
                const awardedDriverId = quoteInfo?.acceptedDriverId ?? null;
                const awardedOwnerDriverId = !carrierCompanyId ? awardedDriverId : null;
                const carrierName = quoteInfo?.acceptedCompanyName ?? (carrierCompanyId ? 'Awarded carrier' : awardedOwnerDriverId ? 'Owner Driver' : 'Not awarded');
                const review = reviewsByJob[job.id]?.[0] ?? null;
                const feedbackAvailable = canLeaveCompanyFeedback(job, companyId);
                const stage = classifyWorkspaceJobStage(job);
                const pickupWhen = cxTimeParts(job.pickup_datetime);
                const deliveryWhen = cxTimeParts(job.delivery_datetime);
                const vehicle = (job.vehicle_type ?? 'Not supplied').replaceAll('_', ' ');
                const band = stage === 'completed' ? 'Delivered' : workspaceJobOperationalLabel(job);
                return (
                  <article key={job.id} className="workspace-operational-row xdrive-cx-diary-card" data-state={normalizedJobStatus(job)} data-stage={stage}>
                    <div className="xdrive-cx-diary-card__main">
                      <section className="cx-diary-route xdrive-cx-diary-card__route">
                        <div><span>From:</span><strong>{routeLocationLabel(job.pickup_location, job.pickup_postcode, 'Collection')}</strong></div>
                        <div><span>To:</span><strong>{routeLocationLabel(job.delivery_location, job.delivery_postcode, 'Delivery')}</strong></div>
                      </section>
                      <section className="xdrive-cx-diary-card__times">
                        <div><span>Pickup:</span><span className="cx-diary-datetime"><strong>{pickupWhen.primary}</strong>{pickupWhen.meta ? <span>{pickupWhen.meta}</span> : null}</span></div>
                        <div><span>Deliver:</span><span className="cx-diary-datetime"><strong>{deliveryWhen.primary}</strong>{deliveryWhen.meta ? <span>{deliveryWhen.meta}</span> : null}</span></div>
                      </section>
                      <section className="xdrive-cx-diary-card__status">
                        <div className="xdrive-cx-diary-card__band">{band}</div>
                        <div className="xdrive-cx-diary-card__status-line">{carrierCompanyId || awardedOwnerDriverId ? <MemberIdentityLink companyId={carrierCompanyId} driverId={awardedOwnerDriverId}>{carrierName}</MemberIdentityLink> : <strong>{carrierName}</strong>}</div>
                        <div className="xdrive-cx-diary-card__status-stamp">{quoteInfo?.submitted ?? 0} submitted quote{(quoteInfo?.submitted ?? 0) === 1 ? '' : 's'}{job.assigned_driver_id ? ' · executing driver assigned' : ''}</div>
                        <div className="xdrive-cx-diary-card__status-meta"><span>Load ID: {job.id.slice(0, 8).toUpperCase()}</span><span className="xdrive-cx-diary-card__vehicle"><img className="xdrive-cx-diary-card__vehicle-image" src={workspaceVehicleImageSrc(vehicle)} alt="" aria-hidden="true" /><strong>{vehicle}</strong></span></div>
                      </section>
                    </div>
                    <div className="xdrive-cx-diary-card__footer">
                      <button type="button" className="xdrive-cx-diary-card__expander" onClick={() => { if (expandAll) { setExpandAll(false); setExpanded(null); } else setExpanded(open ? null : job.id); }} aria-label={open ? 'Collapse booking' : 'Expand booking'}>{open ? '▴' : '▾'}</button>
                      {canManageFeedback && feedbackAvailable ? <button type="button" className="xdrive-cx-diary-card__feedback" onClick={() => setFeedbackJobId(job.id)}>{review ? 'Edit Feedback' : 'Leave Feedback'}</button> : null}
                      {stage !== 'open' ? <button type="button" onClick={() => router.push(`/customer/jobs/${job.id}`)}>Open booking</button> : null}
                      <button type="button" onClick={() => router.push(`/job-replay/${job.id}`)}>History</button>
                    </div>
                    {open && <div className="xdrive-cx-diary-card__expanded-meta">
                      {job.booking_reference && <div><span>Booking:</span><strong>{job.booking_reference}</strong></div>}
                      {job.customer_reference && <div><span>Customer ref:</span><strong>{job.customer_reference}</strong></div>}
                      <div><span>POD:</span><strong>{job.pod_generated || job.has_delivery_evidence ? 'Available' : job.pod_required ? 'Required' : 'Not recorded'}</strong></div>
                      <div><span>Delivery photo:</span><strong>{deliveryPhotoAvailable ? 'Available' : 'Not recorded'}</strong></div>
                      <div><span>Updated:</span><strong>{when(job.updated_at)}</strong></div>
                    </div>}
                    {open && <CompanyJobSheetPanel jobId={job.id} mode="customer" />}
                  </article>
                );
              })}
            </div>
          )}


        </main>
      </div>
      {feedbackJobId && companyId ? (() => {
        const job = data.jobs.find((item) => item.id === feedbackJobId);
        const quoteInfo = job ? quoteInfoByJob.get(job.id) : null;
        const counterpartyLabel = quoteInfo?.acceptedCompanyName ?? (job?.awarded_carrier_company_id ? 'Awarded carrier' : 'Executing carrier');
        const existing = reviewsByJob[feedbackJobId]?.[0] ?? null;
        return <CompanyFeedbackDialog jobId={feedbackJobId} companyId={companyId} existing={existing ? { rating: existing.rating, comment: existing.comment } : null} counterpartyLabel={counterpartyLabel} onClose={() => setFeedbackJobId(null)} onSaved={loadReviews} />;
      })() : null}
    </PageFrame>
  );
}
