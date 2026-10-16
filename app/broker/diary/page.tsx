'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthContext';
import { CompanyJobSheetPanel } from '../../components/workspace/CompanyJobSheetPanel';
import { MemberIdentityLink } from '../../components/workspace/MemberProfile';
import { useCompanyWorkspaceData, type WorkspaceJob } from '../../components/workspace/useCompanyWorkspaceData';
import { workspaceVehicleImageSrc } from '../../components/workspace/vehiclePresentation';
import { ActionButton, AlertBanner, EmptyState, PageFrame, WorkspaceDialog } from '../../components/workspace/WorkspaceUI';
import { brokerDiaryStage, normalizedJobStatus, workspaceJobOperationalLabel } from '../../../lib/jobs/workspaceJobStage';
import { supabase } from '../../../lib/supabaseClient';
import { canLeaveCompanyFeedback as isCompanyFeedbackEligible } from '../../../lib/feedback/canonicalFeedback';

type DiaryTab = 'all' | 'unallocated' | 'allocated' | 'in_progress' | 'completed' | 'cancelled' | 'expired' | 'awaiting_feedback' | 'recent_feedback';
type ReviewRow = {
  id: string;
  job_id: string | null;
  reviewer_company_id: string | null;
  rating: number | null;
  comment: string | null;
  created_at: string | null;
};

const when = (value: string | null | undefined) => value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not set';
const cxTimeParts = (value: string | null | undefined) => {
  if (!value) return { primary: 'ASAP', meta: '' };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { primary: 'Not set', meta: '' };
  const zone = new Intl.DateTimeFormat('en-GB', { timeZoneName: 'short' }).formatToParts(date).find((part) => part.type === 'timeZoneName')?.value ?? '';
  return { primary: date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), meta: `${zone ? ` (${zone})` : ''} ${date.toLocaleDateString('en-GB')}` };
};
const postcodeOrLocation = (postcode: string | null | undefined, location: string | null | undefined) => postcode || location || 'Not set';

const hasRecentFeedback = (reviews: ReviewRow[]) => reviews.length > 0;
const isAwaitingFeedback = (job: WorkspaceJob, reviews: ReviewRow[], companyId: string | null) =>
  brokerDiaryStage(job) === 'completed' && isCompanyFeedbackEligible(job, companyId) && !hasRecentFeedback(reviews);

function matchesTab(job: WorkspaceJob, tab: DiaryTab, reviews: ReviewRow[], companyId: string | null) {
  if (tab === 'all') return true;
  if (tab === 'awaiting_feedback') return isAwaitingFeedback(job, reviews, companyId);
  if (tab === 'recent_feedback') return hasRecentFeedback(reviews);
  return brokerDiaryStage(job) === tab;
}

export default function BrokerDiaryPage() {
  const router = useRouter();
  const { user } = useAuth();
  const data = useCompanyWorkspaceData();
  const [tab, setTab] = useState<DiaryTab>('all');
  const [reference, setReference] = useState('');
  const [customer, setCustomer] = useState('');
  const [carrier, setCarrier] = useState('');
  const [pickup, setPickup] = useState('');
  const [delivery, setDelivery] = useState('');
  const [date, setDate] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [expandAll, setExpandAll] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [reviewsByJob, setReviewsByJob] = useState<Record<string, ReviewRow[]>>({});
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');
  const [notice, setNotice] = useState('');
  const [feedbackJobId, setFeedbackJobId] = useState<string | null>(null);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackSaving, setFeedbackSaving] = useState(false);

  const companyId = data.companyId;
  const canLeaveCompanyFeedback = Boolean(user?.membershipRole && ['owner', 'admin', 'dispatcher'].includes(user.membershipRole));

  const loadReviews = useCallback(async () => {
    if (!companyId) {
      setReviewsByJob({});
      setFeedbackLoading(false);
      return;
    }
    setFeedbackLoading(true);
    setFeedbackError('');
    const { data: reviewRows, error } = await supabase
      .from('reviews')
      .select('id,job_id,reviewer_company_id,rating,comment,created_at')
      .eq('reviewer_company_id', companyId)
      .order('created_at', { ascending: false });
    if (error) {
      setReviewsByJob({});
      setFeedbackError('Feedback records are temporarily unavailable. Core Diary operations remain available.');
      setFeedbackLoading(false);
      return;
    }
    const next: Record<string, ReviewRow[]> = {};
    for (const review of (reviewRows ?? []) as ReviewRow[]) {
      if (!review.job_id) continue;
      (next[review.job_id] ??= []).push(review);
    }
    setReviewsByJob(next);
    setFeedbackLoading(false);
  }, [companyId]);

  useEffect(() => { void loadReviews(); }, [loadReviews]);

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
      .filter((job) => matchesTab(job, tab, reviewsByJob[job.id] ?? [], companyId))
      .filter((job) => !refTerm || `${job.id} ${job.booking_reference ?? ''} ${job.customer_reference ?? ''}`.toLowerCase().includes(refTerm))
      .filter((job) => !customerTerm || String(job.client_name || '').toLowerCase().includes(customerTerm))
      .filter((job) => {
        if (!carrierTerm) return true;
        const carrierInfo = acceptedCarrierByJob.get(job.id);
        return `${carrierInfo?.companyName ?? ''} ${carrierInfo?.companyId ?? ''} ${job.awarded_carrier_company_id ?? ''} ${job.assigned_company_id ?? ''}`.toLowerCase().includes(carrierTerm);
      })
      .filter((job) => !pickupTerm || `${job.pickup_postcode || ''} ${job.pickup_location || ''}`.toLowerCase().includes(pickupTerm))
      .filter((job) => !deliveryTerm || `${job.delivery_postcode || ''} ${job.delivery_location || ''}`.toLowerCase().includes(deliveryTerm))
      .filter((job) => !date || String(job.pickup_datetime || '').slice(0, 10) === date)
      .sort((a, b) => String(b.pickup_datetime || b.created_at).localeCompare(String(a.pickup_datetime || a.created_at)));
  }, [acceptedCarrierByJob, carrier, companyId, customer, data.jobs, date, delivery, pickup, reference, reviewsByJob, tab]);


  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => { setPage(1); setExpanded(null); setExpandAll(false); }, [tab, reference, customer, carrier, pickup, delivery, date, pageSize]);

  const reset = () => { setReference(''); setCustomer(''); setCarrier(''); setPickup(''); setDelivery(''); setDate(''); };
  const tabs: Array<{ id: DiaryTab; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'unallocated', label: 'Unallocated' },
    { id: 'allocated', label: 'Allocated' },
    { id: 'in_progress', label: 'In Progress' },
    { id: 'completed', label: 'Completed' },
    { id: 'cancelled', label: 'Cancelled' },
    { id: 'expired', label: 'Expired' },
    { id: 'awaiting_feedback', label: 'Awaiting Feedback' },
    { id: 'recent_feedback', label: 'Recent Feedback' },
  ];

  const openFeedback = (job: WorkspaceJob) => {
    const existing = reviewsByJob[job.id]?.[0];
    setFeedbackJobId(job.id);
    setFeedbackRating(existing?.rating ?? 5);
    setFeedbackComment(existing?.comment ?? '');
    setFeedbackError('');
    setNotice('');
  };

  const saveFeedback = async () => {
    if (!feedbackJobId || !companyId) return;
    setFeedbackSaving(true);
    setFeedbackError('');
    setNotice('');
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error('Session expired.');
      const response = await fetch(`/api/admin/jobs/${encodeURIComponent(feedbackJobId)}/feedback`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, rating: feedbackRating, comment: feedbackComment }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string; updated?: boolean };
      if (!response.ok) throw new Error(payload.error || 'Company feedback could not be saved.');
      setNotice(payload.updated ? 'Company feedback updated.' : 'Company feedback saved.');
      setFeedbackJobId(null);
      await loadReviews();
    } catch (reason) {
      setFeedbackError(reason instanceof Error ? reason.message : 'Company feedback could not be saved.');
    } finally {
      setFeedbackSaving(false);
    }
  };

  const metaStyle = { color: '#64748b', fontSize: 'var(--ws-font-meta, 11px)' } as const;

  return (
    <PageFrame>
      {data.error && <AlertBanner tone="danger">{data.error}</AlertBanner>}
      {feedbackError && <AlertBanner tone="warning">{feedbackError}</AlertBanner>}
      {notice && <AlertBanner tone="success">{notice}</AlertBanner>}

      <div className="workspace-board-layout">
        <aside className="workspace-filter-rail cx-diary-filter-rail" aria-label="Diary filters">
          <div className="cx-diary-rail-nav">
            <ActionButton tone="secondary" onClick={() => router.push('/broker/carrier-network/directory')}>Contacts</ActionButton>
            <ActionButton tone="secondary" onClick={() => router.push('/broker/finance')}>Payment Report</ActionButton>
          </div>
          <div className="workspace-filter-rail__header">Search Panel</div>
          <div className="workspace-filter-rail__body">
            <label>Date:<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
            <label>Pickup:<input value={pickup} onChange={(event) => setPickup(event.target.value)} placeholder="Town / postcode" /></label>
            <label>Delivery:<input value={delivery} onChange={(event) => setDelivery(event.target.value)} placeholder="Town / postcode" /></label>
            <label>Load ID / Ref:<input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Job, booking or customer ref" /></label>
            <label>Customer:<input value={customer} onChange={(event) => setCustomer(event.target.value)} placeholder="Customer name" /></label>
            <label>Carrier / Member:<input value={carrier} onChange={(event) => setCarrier(event.target.value)} placeholder="Carrier name / company ID" /></label>
            <div style={{ display: 'grid', gap: 4 }}><span style={metaStyle}>Customer and executing carrier remain separate operational relationships.</span><div className="workspace-filter-actions"><ActionButton tone="success" onClick={() => setPage(1)}>Search</ActionButton><ActionButton tone="secondary" onClick={reset}>Clear</ActionButton></div></div>
          </div>
        </aside>

        <main style={{ minWidth: 0 }}>
          <div className="workspace-record-meta workspace-list-controls cx-diary-toolbar">
            <span className="cx-diary-toolbar__title"><span className="cx-diary-toolbar__calendar" aria-hidden="true">▣</span><strong>Diary at {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}</strong></span>
            <span className="workspace-list-controls__right">
              <button type="button" className="cx-expand-entries-control" disabled={!visibleRows.length} onClick={() => { setExpandAll((current) => !current); setExpanded(null); }}>{expandAll ? 'Collapse All Entries' : 'Expand All Entries'}</button>
              <ActionButton tone="secondary" onClick={() => { void data.refresh(); void loadReviews(); }}>Refresh</ActionButton>
            </span>
          </div>
          <div className="workspace-tab-strip cx-diary-state-tabs" role="tablist" aria-label="Broker diary states">
            {tabs.map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} data-active={tab === item.id ? 'true' : 'false'} onClick={() => setTab(item.id)}>{item.label}</button>)}
            <span className="cx-diary-pagination">
              <label>Items per Page: <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></label>
              <button type="button" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} aria-label="Previous Diary page">‹</button>
              <span>{rows.length === 0 ? '0' : `${(safePage - 1) * pageSize + 1}-${Math.min(safePage * pageSize, rows.length)} of ${rows.length}`}</span>
              <button type="button" disabled={safePage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} aria-label="Next Diary page">›</button>
            </span>
          </div>

          {feedbackLoading && (tab === 'awaiting_feedback' || tab === 'recent_feedback') ? (
            <div className="workspace-panel"><EmptyState compact title="Loading feedback..." /></div>
          ) : data.loading ? (
            <div className="workspace-panel"><EmptyState compact title="Loading Diary..." /></div>
          ) : visibleRows.length === 0 ? (
            <div className="workspace-panel"><EmptyState title="No diary records" description="Adjust the filters or select another operational status." /></div>
          ) : (
            <div className="workspace-record-list">
              {visibleRows.map((job) => {
                const open = expandAll || expanded === job.id;
                const deliveryPhotoAvailable = (job.delivery_photos?.length || 0) > 0;
                const carrierInfo = acceptedCarrierByJob.get(job.id);
                const carrierCompanyId = carrierInfo?.companyId ?? job.awarded_carrier_company_id ?? job.assigned_company_id ?? null;
                const carrierName = carrierInfo?.companyName ?? (carrierCompanyId ? 'Executing carrier' : 'Not awarded');
                const reviews = reviewsByJob[job.id] ?? [];
                const review = reviews[0];
                const feedbackAvailable = isCompanyFeedbackEligible(job, companyId);
                const stage = brokerDiaryStage(job);
                const pickupWhen = cxTimeParts(job.pickup_datetime);
                const deliveryWhen = cxTimeParts(job.delivery_datetime);
                const vehicle = (job.vehicle_type || 'Vehicle not set').replaceAll('_', ' ');
                const band = stage === 'completed' ? 'Delivered' : workspaceJobOperationalLabel(job);
                return (
                  <article className="workspace-operational-row xdrive-cx-diary-card" key={job.id} data-state={normalizedJobStatus(job)} data-stage={stage}>
                    <div className="xdrive-cx-diary-card__main">
                      <section className="cx-diary-route xdrive-cx-diary-card__route">
                        <div><span>From:</span><strong>{postcodeOrLocation(job.pickup_postcode, job.pickup_location)}</strong></div>
                        <div><span>To:</span><strong>{postcodeOrLocation(job.delivery_postcode, job.delivery_location)}</strong></div>
                      </section>
                      <section className="xdrive-cx-diary-card__times">
                        <div><span>Pickup:</span><span className="cx-diary-datetime"><strong>{pickupWhen.primary}</strong>{pickupWhen.meta ? <span>{pickupWhen.meta}</span> : null}</span></div>
                        <div><span>Deliver:</span><span className="cx-diary-datetime"><strong>{deliveryWhen.primary}</strong>{deliveryWhen.meta ? <span>{deliveryWhen.meta}</span> : null}</span></div>
                      </section>
                      <section className="xdrive-cx-diary-card__status">
                        <div className="xdrive-cx-diary-card__band">{band}</div>
                        <div className="xdrive-cx-diary-card__status-line">{carrierCompanyId ? <MemberIdentityLink companyId={carrierCompanyId}>{carrierName}</MemberIdentityLink> : <strong>{carrierName}</strong>}</div>
                        <div className="xdrive-cx-diary-card__status-stamp">{job.client_name || 'Customer not set'}</div>
                        <div className="xdrive-cx-diary-card__status-meta"><span>Load ID: {job.id.slice(0, 8).toUpperCase()}</span><span className="xdrive-cx-diary-card__vehicle"><img className="xdrive-cx-diary-card__vehicle-image" src={workspaceVehicleImageSrc(vehicle)} alt="" aria-hidden="true" /><strong>{vehicle}</strong></span></div>
                      </section>
                    </div>
                    <div className="xdrive-cx-diary-card__footer">
                      <button type="button" className="xdrive-cx-diary-card__expander" onClick={() => { if (expandAll) { setExpandAll(false); setExpanded(null); } else setExpanded(open ? null : job.id); }} aria-label={open ? 'Collapse booking' : 'Expand booking'}>{open ? '▴' : '▾'}</button>
                      {canLeaveCompanyFeedback && feedbackAvailable && <button type="button" className="xdrive-cx-diary-card__feedback" onClick={() => openFeedback(job)}>{review ? 'Edit Feedback' : 'Leave Feedback'}</button>}
                      <button type="button" onClick={() => router.push(`/broker/jobs?job=${job.id}`)}>Open job</button>
                      <button type="button" onClick={() => router.push(`/job-replay/${job.id}`)}>History</button>
                    </div>
                    {open && <div className="xdrive-cx-diary-card__expanded-meta">
                      {job.booking_reference && <div><span>Booking:</span><strong>{job.booking_reference}</strong></div>}
                      {job.customer_reference && <div><span>Customer ref:</span><strong>{job.customer_reference}</strong></div>}
                      <div><span>Delivery photo:</span><strong>{deliveryPhotoAvailable ? 'Available' : 'Not recorded'}</strong></div>
                      {review ? <div><span>Feedback:</span><strong>{review.rating ?? '—'}/5 · {when(review.created_at)}</strong></div> : feedbackAvailable ? <div><span>Feedback:</span><strong>Awaiting</strong></div> : null}
                    </div>}
                    {open && <CompanyJobSheetPanel jobId={job.id} mode="broker" />}
                  </article>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {feedbackJobId && <WorkspaceDialog
        ariaLabel="Carrier feedback"
        title="Carrier feedback"
        description="Rate the external carrier for this completed broker booking. One company review is kept per booking."
        width={520}
        onDismiss={() => setFeedbackJobId(null)}
        dismissDisabled={feedbackSaving}
        actions={<><ActionButton tone="secondary" disabled={feedbackSaving} onClick={() => setFeedbackJobId(null)}>Cancel</ActionButton><ActionButton tone="success" disabled={feedbackSaving} onClick={() => void saveFeedback()}>{feedbackSaving ? 'Saving...' : 'Save Feedback'}</ActionButton></>}
      >
        <label style={{ display: 'grid', gap: 5, fontSize: 11, fontWeight: 700, color: '#334155' }}>RATING<select value={feedbackRating} onChange={(event) => setFeedbackRating(Number(event.target.value))}>{[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} / 5</option>)}</select></label>
        <label style={{ display: 'grid', gap: 5, fontSize: 11, fontWeight: 700, color: '#334155' }}>COMMENT<textarea value={feedbackComment} onChange={(event) => setFeedbackComment(event.target.value.slice(0, 2000))} rows={5} placeholder="Operational feedback about this booking" /></label>
      </WorkspaceDialog>}
    </PageFrame>
  );
}
