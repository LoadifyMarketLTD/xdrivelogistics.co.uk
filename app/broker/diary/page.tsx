'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthContext';
import { CompanyJobSheetPanel, type JobSheetTab } from '../../components/workspace/CompanyJobSheetPanel';
import { MemberIdentityLink } from '../../components/workspace/MemberProfile';
import { useCompanyWorkspaceData, type WorkspaceJob } from '../../components/workspace/useCompanyWorkspaceData';
import CxDiaryCard from '../../components/workspace/CxDiaryCard';
import '../../components/workspace/broker-3150-diary.css';
import Master3150OperationsKpis from '../../components/workspace/Master3150OperationsKpis';
import CxDiaryActions, { DIARY_JOB_SHEET_TABS } from '../../components/workspace/CxDiaryActions';
import { ActionButton, AlertBanner, EmptyState, PageFrame, WorkspaceDialog } from '../../components/workspace/WorkspaceUI';
import { brokerDiaryStage, classifyWorkspaceJobStage, isDiaryBookingJob, normalizedJobStatus, workspaceJobOperationalLabel } from '../../../lib/jobs/workspaceJobStage';
import { supabase } from '../../../lib/supabaseClient';
import { canLeaveCompanyFeedback as isCompanyFeedbackEligible } from '../../../lib/feedback/canonicalFeedback';

type DiaryTab = 'all' | 'unallocated' | 'allocated' | 'in_progress' | 'completed' | 'cancelled' | 'expired' | 'awaiting_feedback' | 'recent_feedback';
type ReviewRow = {
  id: string;
  job_id: string | null;
  reviewer_company_id: string | null;
  rating: number | null;
  comment: string | null;
  would_use_again: boolean | null;
  delivered_promptly: boolean | null;
  courteous: boolean | null;
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
const verifiedBrokerBookingStage = (job: WorkspaceJob) =>
  classifyWorkspaceJobStage(job) === 'awarded' ? 'unallocated' as const : brokerDiaryStage(job);
const isAwaitingFeedback = (job: WorkspaceJob, reviews: ReviewRow[], companyId: string | null) =>
  verifiedBrokerBookingStage(job) === 'completed' && isCompanyFeedbackEligible(job, companyId) && !hasRecentFeedback(reviews);

function matchesTab(job: WorkspaceJob, tab: DiaryTab, reviews: ReviewRow[], companyId: string | null) {
  if (!isDiaryBookingJob(job)) return false;
  if (tab === 'all') return true;
  if (tab === 'awaiting_feedback') return isAwaitingFeedback(job, reviews, companyId);
  if (tab === 'recent_feedback') return hasRecentFeedback(reviews);
  return verifiedBrokerBookingStage(job) === tab;
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
  const [driverFilter, setDriverFilter] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [selectedDetailsJobId, setSelectedDetailsJobId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'earliest' | 'latest'>('earliest');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detailTabs, setDetailTabs] = useState<Record<string, JobSheetTab>>({});
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
  const [feedbackWouldUseAgain, setFeedbackWouldUseAgain] = useState(true);
  const [feedbackDeliveredPromptly, setFeedbackDeliveredPromptly] = useState(true);
  const [feedbackCourteous, setFeedbackCourteous] = useState(true);
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [diaryClock, setDiaryClock] = useState('');

  useEffect(() => {
    const updateClock = () => setDiaryClock(
      new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }),
    );
    updateClock();
    const timer = window.setInterval(updateClock, 60_000);
    return () => window.clearInterval(timer);
  }, []);

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
      .select('id,job_id,reviewer_company_id,rating,comment,would_use_again,delivered_promptly,courteous,created_at')
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
      .filter((job) => isDiaryBookingJob(job))
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
      .filter((job) => !driverFilter || job.assigned_driver_id === driverFilter)
      .filter((job) => !vehicleFilter || job.vehicle_id === vehicleFilter)
      .filter((job) => !date || String(job.pickup_datetime || '').slice(0, 10) === date)
      .sort((a, b) => sortBy === 'earliest'
        ? String(a.pickup_datetime || a.created_at).localeCompare(String(b.pickup_datetime || b.created_at))
        : String(b.pickup_datetime || b.created_at).localeCompare(String(a.pickup_datetime || a.created_at)));
  }, [acceptedCarrierByJob, carrier, companyId, customer, data.jobs, date, delivery, pickup, reference, reviewsByJob, tab, driverFilter, vehicleFilter, sortBy]);


  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => { setPage(1); setExpanded(null); setExpandAll(false); }, [tab, reference, customer, carrier, pickup, delivery, date, pageSize, driverFilter, vehicleFilter, sortBy]);

  const reset = () => { setReference(''); setCustomer(''); setCarrier(''); setPickup(''); setDelivery(''); setDate(''); setDriverFilter(''); setVehicleFilter(''); setTab('all'); };
  const changeDay = (delta: number) => {
    const base = date || new Date().toISOString().slice(0, 10);
    const value = new Date(base + 'T12:00:00');
    value.setDate(value.getDate() + delta);
    setDate(value.toISOString().slice(0, 10));
  };
  const tabCount = (value: DiaryTab) => data.jobs.filter((job) => isDiaryBookingJob(job) && matchesTab(job, value, reviewsByJob[job.id] ?? [], companyId)).length;
  const sortedDrivers = [...data.drivers].sort((a, b) => (a.display_name || '').localeCompare(b.display_name || ''));
  const sortedVehicles = [...data.vehicles].sort((a, b) => (a.reg_plate || '').localeCompare(b.reg_plate || ''));
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
    setFeedbackWouldUseAgain(existing?.would_use_again ?? true);
    setFeedbackDeliveredPromptly(existing?.delivered_promptly ?? true);
    setFeedbackCourteous(existing?.courteous ?? true);
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
        body: JSON.stringify({
          companyId,
          rating: feedbackRating,
          comment: feedbackComment,
          wouldUseAgain: feedbackWouldUseAgain,
          deliveredPromptly: feedbackDeliveredPromptly,
          courteous: feedbackCourteous,
        }),
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
      <section className="xd3150-broker-diary">
        <header className="xd3150-diary-header">
          <div><h1>Diary</h1><p>Bookings & Operations Schedule</p></div>
          <nav className="xd3150-diary-date-nav" aria-label="Diary date navigation">
            <button type="button" aria-label="Previous day" onClick={() => changeDay(-1)}>‹</button>
            <input type="date" aria-label="Selected diary date" value={date} onChange={(event) => setDate(event.target.value)} />
            <button type="button" aria-label="Next day" onClick={() => changeDay(1)}>›</button>
            <button type="button" className="xd3150-diary-today" onClick={() => setDate(new Date().toISOString().slice(0, 10))}>Today</button>
            {date && <button type="button" onClick={() => setDate('')}>All dates</button>}
          </nav>
        </header>
        <div className="xd3150-diary-status-tabs" role="tablist" aria-label="Broker diary states">
          {tabs.map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>{item.label}<span>{tabCount(item.id)}</span></button>)}
        </div>
      <Master3150OperationsKpis jobs={data.jobs} view="diary" />
      {data.error && <AlertBanner tone="danger">{data.error}</AlertBanner>}
      {feedbackError && <AlertBanner tone="warning">{feedbackError}</AlertBanner>}
      {notice && <AlertBanner tone="success">{notice}</AlertBanner>}

      <div className="workspace-board-layout xdrive-admin-marketplace-identity">
        <aside className="workspace-filter-rail cx-diary-filter-rail xd3150-diary-rail" aria-label="Diary filters">
          <div className="workspace-filter-rail__header">Find Bookings</div>
          <div className="workspace-filter-rail__body">

            <label>From (Town/Postcode)<input value={pickup} onChange={(event) => setPickup(event.target.value)} placeholder="e.g. BB1 or Blackburn" /></label>
            <label>To (Town/Postcode)<input value={delivery} onChange={(event) => setDelivery(event.target.value)} placeholder="e.g. DA8 or Erith" /></label>
            <label>Driver<select value={driverFilter} onChange={(event) => setDriverFilter(event.target.value)}><option value="">Any Driver</option>{sortedDrivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.display_name || driver.id.slice(0, 8)}</option>)}</select></label>
            <label>Vehicle<select value={vehicleFilter} onChange={(event) => setVehicleFilter(event.target.value)}><option value="">Any Vehicle</option>{sortedVehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.reg_plate || vehicle.type || vehicle.id.slice(0, 8)}</option>)}</select></label>
            <label>Status<select value={tab} onChange={(event) => setTab(event.target.value as DiaryTab)}>{tabs.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <label>Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
            <button type="button" className="xd3150-diary-clear" onClick={reset}>↻ Clear Filters</button>
            <button type="button" className="xd3150-diary-search" onClick={() => setPage(1)}>⌕ Search Diary</button>
            <details className="xd3150-diary-extra-filters"><summary>Additional search & tools</summary><div className="xd3150-diary-extra-body">
            <label>Load ID / Ref:<input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Job, booking or customer ref" /></label>
            <label>Customer:<input value={customer} onChange={(event) => setCustomer(event.target.value)} placeholder="Customer name" /></label>
            <label>Carrier / Member:<input value={carrier} onChange={(event) => setCarrier(event.target.value)} placeholder="Carrier name / company ID" /></label>
            <div style={{ display: 'grid', gap: 4 }}><span style={metaStyle}>Customer and executing carrier remain separate operational relationships.</span><button type="button" onClick={() => router.push('/broker/carrier-network/directory')}>Contacts</button><button type="button" onClick={() => router.push('/broker/finance')}>Payment Report</button></div>
            </div></details>
          </div>
        </aside>

        <main style={{ minWidth: 0 }}>
          <div className="xd3150-diary-results-head">
            <h2>{date ? 'Selected Day’s Diary' : 'Diary Bookings'} <small>({rows.length} bookings)</small></h2>
            <div className="xd3150-diary-result-tools">
              <label>Sort by <select value={sortBy} onChange={(event) => setSortBy(event.target.value as 'earliest' | 'latest')}><option value="earliest">Collection Time (Earliest)</option><option value="latest">Collection Time (Latest)</option></select></label>
              <button type="button" aria-label="List view" aria-pressed={viewMode === 'list'} onClick={() => setViewMode('list')}>☷</button>
              <button type="button" aria-label="Calendar view" aria-pressed={viewMode === 'calendar'} onClick={() => setViewMode('calendar')}>▦</button>
            </div>
          </div>
          <details className="xd3150-diary-paging">
            <summary>{diaryClock ? 'Updated at ' + diaryClock : 'Diary records'} · {rows.length ? ((safePage - 1) * pageSize + 1) : 0}–{Math.min(safePage * pageSize, rows.length)} of {rows.length} · More tools</summary>
            <div>
              <button type="button" disabled={!visibleRows.length} onClick={() => {setExpandAll((current) => !current);setExpanded(null);}}>{expandAll ? 'Collapse all' : 'Expand all'}</button>
              <button type="button" onClick={() => {void data.refresh();void loadReviews();}}>Refresh</button>
              <label>Items per page <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></label>
              <button type="button" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button>
              <button type="button" disabled={safePage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next</button>
            </div>
          </details>

          {feedbackLoading && (tab === 'awaiting_feedback' || tab === 'recent_feedback') ? (
            <div className="workspace-panel"><EmptyState compact title="Loading feedback..." /></div>
          ) : data.loading ? (
            <div className="workspace-panel"><EmptyState compact title="Loading Diary..." /></div>
          ) : visibleRows.length === 0 ? (
            <div className="workspace-panel"><EmptyState title="No diary records" description="Adjust the filters or select another operational status." /></div>
          ) : (
            <div className={viewMode === 'calendar' ? 'workspace-record-list xd3150-diary-calendar-view' : 'workspace-record-list'}>
              {visibleRows.map((job) => {
                const open = expandAll || expanded === job.id;
                const deliveryPhotoAvailable = (job.delivery_photos?.length || 0) > 0;
                const carrierInfo = acceptedCarrierByJob.get(job.id);
                const carrierCompanyId = carrierInfo?.companyId ?? job.awarded_carrier_company_id ?? job.assigned_company_id ?? null;
                const carrierName = carrierInfo?.companyName ?? (carrierCompanyId ? 'Executing carrier' : 'Not awarded');
                const reviews = reviewsByJob[job.id] ?? [];
                const review = reviews[0];
                const feedbackAvailable = isCompanyFeedbackEligible(job, companyId);
                const stage = verifiedBrokerBookingStage(job);
                const pickupWhen = cxTimeParts(job.pickup_datetime);
                const deliveryWhen = cxTimeParts(job.delivery_datetime);
                const vehicle = (job.vehicle_type || 'Vehicle not set').replaceAll('_', ' ');
                const band = stage === 'completed' ? 'Delivered' : workspaceJobOperationalLabel(job);
                return (
                  <CxDiaryCard
                    key={job.id}
                    from={postcodeOrLocation(job.pickup_postcode, job.pickup_location)}
                    to={postcodeOrLocation(job.delivery_postcode, job.delivery_location)}
                    pickup={pickupWhen}
                    delivery={deliveryWhen}
                    band={band}
                    statusLine={carrierCompanyId ? <MemberIdentityLink companyId={carrierCompanyId}>{carrierName}</MemberIdentityLink> : <strong>{carrierName}</strong>}
                    statusStamp={job.client_name || 'Customer not set'}
                    loadId={job.id.slice(0, 8).toUpperCase()}
                    vehicle={vehicle}
                    state={normalizedJobStatus(job)}
                    stage={stage}
                    expanded={open}
                    footer={<div className="xd3150-diary-card-actions">
                      <button type="button" onClick={() => setSelectedDetailsJobId(job.id)}>View Details</button>
                      <button type="button" className="xd3150-diary-booking-action" onClick={() => setSelectedDetailsJobId(job.id)}>Booking Details</button>
                      <details className="xd3150-diary-more-actions">
                        <summary>More actions</summary>
                        <CxDiaryActions
                          expanded={open}
                          onToggle={() => { if (expandAll) { setExpandAll(false); setExpanded(null); } else setExpanded(open ? null : job.id); }}
                          onOpenTab={(actionTab) => { setExpanded(job.id); setDetailTabs(current => ({ ...current, [job.id]: DIARY_JOB_SHEET_TABS[actionTab] })); }}
                          feedback={canLeaveCompanyFeedback && feedbackAvailable ? <button type="button" className="xdrive-cx-diary-card__feedback" onClick={() => openFeedback(job)}>{review ? 'Edit Feedback' : 'Leave Feedback'}</button> : null}
                        >
                          <button type="button" onClick={() => router.push(`/broker/jobs?job=${job.id}`)}>Open booking</button>
                          <button type="button" onClick={() => router.push(`/job-replay/${job.id}`)}>Replay</button>
                        </CxDiaryActions>
                      </details>
                    </div>}
                    expandedMeta={<>
                      {job.booking_reference && <div><span>Booking:</span><strong>{job.booking_reference}</strong></div>}
                      {job.customer_reference && <div><span>Customer ref:</span><strong>{job.customer_reference}</strong></div>}
                      <div><span>Delivery photo:</span><strong>{deliveryPhotoAvailable ? 'Available' : 'Not recorded'}</strong></div>
                      {review ? <div><span>Feedback:</span><strong>{review.rating ?? '—'}/5 · {when(review.created_at)}</strong></div> : feedbackAvailable ? <div><span>Feedback:</span><strong>Awaiting</strong></div> : null}
                    </>}
                    expandedContent={<CompanyJobSheetPanel jobId={job.id} mode="broker" initialTab={detailTabs[job.id] ?? 'agreement'} />}
                  />
                );
              })}
            </div>
          )}
        </main>
      </div>

      {selectedDetailsJobId && <WorkspaceDialog
        ariaLabel="Verified 3150 transport details"
        title="Transport Details"
        width={1024}
        maxHeight={820}
        onDismiss={() => setSelectedDetailsJobId(null)}
        actions={<ActionButton tone="secondary" onClick={() => setSelectedDetailsJobId(null)}>Close Details</ActionButton>}
      ><CompanyJobSheetPanel jobId={selectedDetailsJobId} mode="broker" initialTab="agreement" /></WorkspaceDialog>}

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
        <div style={{ display: 'grid', gap: 8 }}>
          <label style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', fontSize: 12, fontWeight: 700, color: '#334155' }}><span>Would use again</span><input type="checkbox" checked={feedbackWouldUseAgain} onChange={(event) => setFeedbackWouldUseAgain(event.target.checked)} /></label>
          <label style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', fontSize: 12, fontWeight: 700, color: '#334155' }}><span>Delivered promptly</span><input type="checkbox" checked={feedbackDeliveredPromptly} onChange={(event) => setFeedbackDeliveredPromptly(event.target.checked)} /></label>
          <label style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', fontSize: 12, fontWeight: 700, color: '#334155' }}><span>Courteous / professional</span><input type="checkbox" checked={feedbackCourteous} onChange={(event) => setFeedbackCourteous(event.target.checked)} /></label>
        </div>
        <label style={{ display: 'grid', gap: 5, fontSize: 11, fontWeight: 700, color: '#334155' }}>COMMENT<textarea value={feedbackComment} onChange={(event) => setFeedbackComment(event.target.value.slice(0, 2000))} rows={5} placeholder="Operational feedback about this booking" /></label>
      </WorkspaceDialog>}
      </section>
    </PageFrame>
  );
}
