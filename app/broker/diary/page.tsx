'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthContext';
import { CompanyJobSheetPanel } from '../../components/workspace/CompanyJobSheetPanel';
import { MemberIdentityLink } from '../../components/workspace/MemberProfile';
import { useCompanyWorkspaceData, type WorkspaceJob } from '../../components/workspace/useCompanyWorkspaceData';
import { ActionButton, AlertBanner, EmptyState, PageFrame, PageHeader, StatusBadge } from '../../components/workspace/WorkspaceUI';
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

  const counts = useMemo(() => ({
    all: data.jobs.length,
    unallocated: data.jobs.filter((job) => matchesTab(job, 'unallocated', reviewsByJob[job.id] ?? [], companyId)).length,
    allocated: data.jobs.filter((job) => matchesTab(job, 'allocated', reviewsByJob[job.id] ?? [], companyId)).length,
    in_progress: data.jobs.filter((job) => matchesTab(job, 'in_progress', reviewsByJob[job.id] ?? [], companyId)).length,
    completed: data.jobs.filter((job) => matchesTab(job, 'completed', reviewsByJob[job.id] ?? [], companyId)).length,
    cancelled: data.jobs.filter((job) => matchesTab(job, 'cancelled', reviewsByJob[job.id] ?? [], companyId)).length,
    expired: data.jobs.filter((job) => matchesTab(job, 'expired', reviewsByJob[job.id] ?? [], companyId)).length,
    awaiting_feedback: data.jobs.filter((job) => matchesTab(job, 'awaiting_feedback', reviewsByJob[job.id] ?? [], companyId)).length,
    recent_feedback: data.jobs.filter((job) => matchesTab(job, 'recent_feedback', reviewsByJob[job.id] ?? [], companyId)).length,
  }), [companyId, data.jobs, reviewsByJob]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => { setPage(1); setExpanded(null); setExpandAll(false); }, [tab, reference, customer, carrier, pickup, delivery, date, pageSize]);

  const reset = () => { setReference(''); setCustomer(''); setCarrier(''); setPickup(''); setDelivery(''); setDate(''); };
  const tabs: Array<{ id: DiaryTab; label: string; count?: number }> = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'unallocated', label: 'Unallocated', count: counts.unallocated },
    { id: 'allocated', label: 'Allocated', count: counts.allocated },
    { id: 'in_progress', label: 'In Progress', count: counts.in_progress },
    { id: 'completed', label: 'Completed', count: counts.completed },
    { id: 'cancelled', label: 'Cancelled', count: counts.cancelled },
    { id: 'expired', label: 'Expired', count: counts.expired },
    { id: 'awaiting_feedback', label: 'Awaiting Feedback', count: counts.awaiting_feedback },
    { id: 'recent_feedback', label: 'Recent Feedback', count: counts.recent_feedback },
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

  const labelStyle = { fontSize: 'var(--ws-font-label, 11px)', color: '#64748b', fontWeight: 700 } as const;
  const metaStyle = { color: '#64748b', fontSize: 'var(--ws-font-meta, 11px)' } as const;

  return (
    <PageFrame>
      <PageHeader eyebrow="Broker operations" title="Diary" description="Search, scan and expand every broker-managed booking from one operational register." actions={<ActionButton tone="secondary" onClick={() => { void data.refresh(); void loadReviews(); }}>Refresh</ActionButton>} />
      {data.error && <AlertBanner tone="danger">{data.error}</AlertBanner>}
      {feedbackError && <AlertBanner tone="warning">{feedbackError}</AlertBanner>}
      {notice && <AlertBanner tone="success">{notice}</AlertBanner>}

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
            {tabs.map((item) => <button key={item.id} type="button" data-active={tab === item.id ? 'true' : 'false'} onClick={() => setTab(item.id)}>{item.label}{typeof item.count === 'number' ? ` ${item.count}` : ''}</button>)}
          </div>

          <div className="workspace-record-meta workspace-list-controls" style={{ justifyContent: 'space-between' }}>
            <span><strong>{rows.length}</strong> booking{rows.length === 1 ? '' : 's'} · page {safePage}/{totalPages}</span>
            <span className="workspace-list-controls__right">
              <button type="button" onClick={() => { setExpandAll((current) => !current); setExpanded(null); }} disabled={!visibleRows.length}>{expandAll ? 'Collapse all' : 'Expand all'}</button>
              <label>Per page <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></label>
              <button type="button" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button>
              <span>{rows.length === 0 ? '0' : `${(safePage - 1) * pageSize + 1}-${Math.min(safePage * pageSize, rows.length)} of ${rows.length}`}</span>
              <button type="button" disabled={safePage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next</button>
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
                return (
                  <article className="workspace-operational-row" key={job.id} data-state={normalizedJobStatus(job)}>
                    <div className="workspace-operational-row__top">
                      <div className="workspace-operational-cell"><div style={labelStyle}>FROM</div><strong>{postcodeOrLocation(job.pickup_postcode, job.pickup_location)}</strong><div style={{ ...metaStyle, marginTop: 2 }}>{when(job.pickup_datetime)}</div></div>
                      <div className="workspace-operational-cell"><div style={labelStyle}>TO</div><strong>{postcodeOrLocation(job.delivery_postcode, job.delivery_location)}</strong><div style={{ ...metaStyle, marginTop: 2 }}>{when(job.delivery_datetime)}</div></div>
                      <div className="workspace-operational-cell"><div style={labelStyle}>CUSTOMER / CARRIER</div><strong>{job.client_name || 'Customer not set'}</strong><div style={{ ...metaStyle, marginTop: 2 }}>{carrierCompanyId ? <MemberIdentityLink companyId={carrierCompanyId}>{carrierName}</MemberIdentityLink> : carrierName} · {(job.vehicle_type || 'Vehicle not set').replaceAll('_', ' ')}</div></div>
                      <div className="workspace-operational-cell"><div style={labelStyle}>STATUS / ACTION</div><StatusBadge value={workspaceJobOperationalLabel(job)} /><div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}><ActionButton tone="secondary" onClick={() => { if (expandAll) { setExpandAll(false); setExpanded(null); } else setExpanded(open ? null : job.id); }}>{open ? 'Collapse' : 'Expand'}</ActionButton><ActionButton tone="secondary" onClick={() => router.push(`/broker/jobs?job=${job.id}`)}>Open job</ActionButton><ActionButton tone="secondary" onClick={() => router.push(`/job-replay/${job.id}`)}>Replay</ActionButton>{canLeaveCompanyFeedback && feedbackAvailable && <ActionButton tone="secondary" onClick={() => openFeedback(job)}>{review ? 'Edit Feedback' : 'Leave Feedback'}</ActionButton>}</div></div>
                    </div>
                    <div className="workspace-record-meta"><span>Load #{job.id.slice(0, 8).toUpperCase()}</span>{job.booking_reference && <span>Booking {job.booking_reference}</span>}{job.customer_reference && <span>Customer ref {job.customer_reference}</span>}<span>Delivery photo: {deliveryPhotoAvailable ? 'Available' : 'Not recorded'}</span>{review ? <span>Feedback: {review.rating ?? '—'}/5 · {when(review.created_at)}</span> : feedbackAvailable ? <span>Feedback: Awaiting</span> : null}</div>
                    {open && <CompanyJobSheetPanel jobId={job.id} mode="broker" />}
                  </article>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {feedbackJobId && <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !feedbackSaving) setFeedbackJobId(null); }} style={{ position: 'fixed', inset: 0, zIndex: 1300, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(15, 23, 42, 0.48)' }}>
        <section role="dialog" aria-modal="true" aria-labelledby="broker-feedback-title" style={{ width: 'min(520px, calc(100vw - 32px))', overflow: 'hidden', border: '1px solid #cbd5e1', borderRadius: 4, background: '#fff' }}>
          <header style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0', background: '#f4f6f8' }}><strong id="broker-feedback-title">Carrier feedback</strong><div style={{ marginTop: 2, color: '#64748b', fontSize: 11 }}>Rate the external carrier for this completed broker booking. One company review is kept per booking.</div></header>
          <div style={{ padding: 12, display: 'grid', gap: 10 }}>
            <label style={{ display: 'grid', gap: 5, fontSize: 11, fontWeight: 800, color: '#334155' }}>RATING<select value={feedbackRating} onChange={(event) => setFeedbackRating(Number(event.target.value))} style={{ minHeight: 34, border: '1px solid #cbd5e1', borderRadius: 4, padding: '0 8px', background: '#fff' }}>{[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} / 5</option>)}</select></label>
            <label style={{ display: 'grid', gap: 5, fontSize: 11, fontWeight: 800, color: '#334155' }}>COMMENT<textarea value={feedbackComment} onChange={(event) => setFeedbackComment(event.target.value.slice(0, 2000))} rows={5} placeholder="Operational feedback about this booking" style={{ border: '1px solid #cbd5e1', borderRadius: 4, padding: 8, resize: 'vertical' }} /></label>
          </div>
          <footer style={{ padding: '8px 12px', display: 'flex', justifyContent: 'flex-end', gap: 6, borderTop: '1px solid #e2e8f0', background: '#f4f6f8' }}><ActionButton tone="secondary" disabled={feedbackSaving} onClick={() => setFeedbackJobId(null)}>Cancel</ActionButton><ActionButton tone="success" disabled={feedbackSaving} onClick={() => void saveFeedback()}>{feedbackSaving ? 'Saving...' : 'Save Feedback'}</ActionButton></footer>
        </section>
      </div>}
    </PageFrame>
  );
}
