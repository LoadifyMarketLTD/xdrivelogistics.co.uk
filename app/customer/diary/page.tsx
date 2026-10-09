'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CompanyJobSheetPanel } from '../../components/workspace/CompanyJobSheetPanel';
import { CompanyFeedbackDialog } from '../../components/workspace/CompanyFeedbackDialog';
import { MemberIdentityLink } from '../../components/workspace/MemberProfile';
import { useAuth } from '../../components/AuthContext';
import { useCompanyWorkspaceData, type WorkspaceJob } from '../../components/workspace/useCompanyWorkspaceData';
import { ActionButton, AlertBanner, EmptyState, PageFrame, PageHeader, StatusBadge } from '../../components/workspace/WorkspaceUI';
import { classifyWorkspaceJobStage, normalizedJobStatus, workspaceJobOperationalLabel } from '../../../lib/jobs/workspaceJobStage';
import { getCanonicalDiaryTabs, matchesCanonicalDiaryBucket, type CanonicalDiaryBucket } from '../../../lib/diary/canonicalDiary';
import { supabase } from '../../../lib/supabaseClient';
import { canLeaveCompanyFeedback } from '../../../lib/feedback/canonicalFeedback';

type DiaryTab = CanonicalDiaryBucket;
type ReviewRow = { id: string; job_id: string | null; reviewer_company_id: string | null; rating: number | null; comment: string | null; created_at: string | null };
const CUSTOMER_DIARY_TABS = getCanonicalDiaryTabs('customer');
const when = (value: string | null | undefined) => value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not set';

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

  const counts = useMemo(() => Object.fromEntries(
    CUSTOMER_DIARY_TABS.map((item) => [
      item.id,
      data.jobs.filter((job) => matchesTab(
        job,
        item.id,
        (quoteInfoByJob.get(job.id)?.submitted ?? 0) > 0,
        (reviewsByJob[job.id]?.length ?? 0) > 0,
        companyId,
      )).length,
    ]),
  ) as Record<DiaryTab, number>, [companyId, data.jobs, quoteInfoByJob, reviewsByJob]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => { setPage(1); setExpanded(null); setExpandAll(false); }, [tab, reference, pickup, delivery, carrier, date, pageSize]);

  const tabs = CUSTOMER_DIARY_TABS.map((item) => ({ ...item, count: counts[item.id] ?? 0 }));
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

          <div className="workspace-record-meta workspace-list-controls" style={{ justifyContent: 'space-between' }}>
            <span><strong>{rows.length}</strong> booking{rows.length === 1 ? '' : 's'} · page {safePage}/{totalPages}</span>
            <span className="workspace-list-controls__right">
              <button type="button" onClick={() => { setExpandAll((current) => !current); setExpanded(null); }} disabled={!visibleRows.length}>{expandAll ? 'Collapse all' : 'Expand all'}</button>
              <label>Per page <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></label>
              <button type="button" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>‹</button>
              <span>{rows.length === 0 ? '0' : `${(safePage - 1) * pageSize + 1}-${Math.min(safePage * pageSize, rows.length)} of ${rows.length}`}</span>
              <button type="button" disabled={safePage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>›</button>
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
                return (
                  <article key={job.id} className="workspace-operational-row" data-state={normalizedJobStatus(job)}>
                    <div className="workspace-operational-row__top">
                      <div className="workspace-operational-cell"><div style={labelStyle}>FROM</div><strong>{job.pickup_postcode ?? job.pickup_location ?? 'Collection'}</strong><div style={{ ...metaStyle, marginTop: 2 }}>{when(job.pickup_datetime)}</div></div>
                      <div className="workspace-operational-cell"><div style={labelStyle}>TO</div><strong>{job.delivery_postcode ?? job.delivery_location ?? 'Delivery'}</strong><div style={{ ...metaStyle, marginTop: 2 }}>{when(job.delivery_datetime)}</div></div>
                      <div className="workspace-operational-cell"><div style={labelStyle}>AWARDED CARRIER / MEMBER</div><strong>{carrierCompanyId || awardedOwnerDriverId ? <MemberIdentityLink companyId={carrierCompanyId} driverId={awardedOwnerDriverId}>{carrierName}</MemberIdentityLink> : carrierName}</strong><div style={{ ...metaStyle, marginTop: 2 }}>{quoteInfo?.submitted ?? 0} submitted quote{(quoteInfo?.submitted ?? 0) === 1 ? '' : 's'}{job.assigned_driver_id ? ' · executing driver assigned' : ''}</div></div>
                      <div className="workspace-operational-cell"><div style={labelStyle}>STATUS / ACTION</div><StatusBadge value={workspaceJobOperationalLabel(job)} /><div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}><ActionButton tone="secondary" onClick={() => { if (expandAll) { setExpandAll(false); setExpanded(null); } else setExpanded(open ? null : job.id); }}>{open ? 'Collapse' : 'Expand'}</ActionButton>{classifyWorkspaceJobStage(job) !== 'open' ? <ActionButton tone="secondary" onClick={() => router.push(`/customer/jobs/${job.id}`)}>Open full booking</ActionButton> : null}<ActionButton tone="secondary" onClick={() => router.push(`/job-replay/${job.id}`)}>Replay</ActionButton>{canManageFeedback && feedbackAvailable ? <ActionButton tone="secondary" onClick={() => setFeedbackJobId(job.id)}>{review ? 'Edit Feedback' : 'Leave Feedback'}</ActionButton> : null}</div></div>
                    </div>
                    <div className="workspace-record-meta"><span>Load #{job.id.slice(0, 8).toUpperCase()}</span>{job.booking_reference && <span>Booking {job.booking_reference}</span>}{job.customer_reference && <span>Customer ref {job.customer_reference}</span>}<span>Delivery photo: {deliveryPhotoAvailable ? 'Available' : 'Not recorded'}</span><span>Updated {when(job.updated_at)}</span></div>
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
