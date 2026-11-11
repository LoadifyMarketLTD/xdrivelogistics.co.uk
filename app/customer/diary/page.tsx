'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CompanyJobSheetPanel, type JobSheetTab } from '../../components/workspace/CompanyJobSheetPanel';
import { CompanyFeedbackDialog } from '../../components/workspace/CompanyFeedbackDialog';
import { MemberIdentityLink } from '../../components/workspace/MemberProfile';
import { useAuth } from '../../components/AuthContext';
import { useCompanyWorkspaceData, type WorkspaceJob } from '../../components/workspace/useCompanyWorkspaceData';
import CxDiaryCard from '../../components/workspace/CxDiaryCard';
import { Broker3150DiaryHeader, Broker3150DiaryTabs } from '../../components/workspace/Broker3150DiaryChrome';
import Master3150OperationsKpis from '../../components/workspace/Master3150OperationsKpis';
import CxDiaryActions, { DIARY_JOB_SHEET_TABS } from '../../components/workspace/CxDiaryActions';
import { AlertBanner, EmptyState, PageFrame } from '../../components/workspace/WorkspaceUI';
import { classifyWorkspaceJobStage, isDiaryBookingJob, normalizedJobStatus, workspaceJobOperationalLabel } from '../../../lib/jobs/workspaceJobStage';
import { getCanonicalDiaryTabs, matchesCanonicalDiaryBucket, type CanonicalDiaryBucket } from '../../../lib/diary/canonicalDiary';
import { supabase } from '../../../lib/supabaseClient';
import { canLeaveCompanyFeedback } from '../../../lib/feedback/canonicalFeedback';

type DiaryTab = CanonicalDiaryBucket;
type ReviewRow = { id: string; job_id: string | null; reviewer_company_id: string | null; rating: number | null; comment: string | null; would_use_again: boolean | null; delivered_promptly: boolean | null; courteous: boolean | null; created_at: string | null };
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
  const [driverFilter, setDriverFilter] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [sortBy, setSortBy] = useState<'earliest'|'latest'>('earliest');
  const [viewMode, setViewMode] = useState<'list'|'calendar'>('list');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detailTabs, setDetailTabs] = useState<Record<string, JobSheetTab>>({});
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
      .select('id, job_id, reviewer_company_id, rating, comment, would_use_again, delivered_promptly, courteous, created_at')
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
      .filter((job) => isDiaryBookingJob(job))
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
      .filter((job) => !driverFilter || job.assigned_driver_id===driverFilter)
      .filter((job) => !vehicleFilter || job.vehicle_type===vehicleFilter)
      .sort((a,b)=>sortBy==='earliest'
        ?String(a.pickup_datetime??a.created_at??'').localeCompare(String(b.pickup_datetime??b.created_at??''))
        :String(b.pickup_datetime??b.created_at??'').localeCompare(String(a.pickup_datetime??a.created_at??'')));
  }, [carrier, companyId, data.jobs, date, delivery, pickup, quoteInfoByJob, reference, reviewsByJob, tab, driverFilter, vehicleFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => { setPage(1); setExpanded(null); setExpandAll(false); }, [tab, reference, pickup, delivery, carrier, date, pageSize]);

  const tabs = CUSTOMER_DIARY_TABS;
  const vehicleTypes=[...new Set(data.jobs.map(job=>job.vehicle_type).filter((type):type is string=>Boolean(type)))].sort();
  const clear = () => { setReference('');setPickup('');setDelivery('');setCarrier('');setDate('');setDriverFilter('');setVehicleFilter('');setTab('all');setPage(1); };

  return (
    <PageFrame>
      <section className="xd3150-broker-diary" data-diary-source="broker-3150">
        <Broker3150DiaryHeader date={date} onDateChange={setDate}/>
        <Broker3150DiaryTabs
          tabs={tabs.map(item=>({
            ...item,
            count:data.jobs.filter(job=>isDiaryBookingJob(job)&&matchesTab(job,item.id,
              (quoteInfoByJob.get(job.id)?.submitted??0)>0,
              (reviewsByJob[job.id]?.length??0)>0,companyId)).length,
          }))}
          selected={tab} onSelect={setTab} label="Customer Diary states"
        />
      <Master3150OperationsKpis jobs={data.jobs} view="diary" />
      {data.error && <AlertBanner tone="danger">{data.error}</AlertBanner>}

      <div className="workspace-board-layout xdrive-admin-marketplace-identity">
        <aside className="workspace-filter-rail cx-diary-filter-rail xd3150-diary-rail" aria-label="Customer diary filters">
          <div className="workspace-filter-rail__header">Find Bookings</div>
          <div className="workspace-filter-rail__body">
            <label>From (Town/Postcode)<input value={pickup} onChange={e=>setPickup(e.target.value)} placeholder="e.g. BB1 or Blackburn"/></label>
            <label>To (Town/Postcode)<input value={delivery} onChange={e=>setDelivery(e.target.value)} placeholder="e.g. LS1 or Leeds"/></label>
            <label>Driver<select value={driverFilter} onChange={e=>setDriverFilter(e.target.value)}><option value="">Any Driver</option>{data.drivers.map(driver=><option key={driver.id} value={driver.id}>{driver.display_name||driver.id.slice(0,8)}</option>)}</select></label>
            <label>Vehicle<select value={vehicleFilter} onChange={e=>setVehicleFilter(e.target.value)}><option value="">Any Vehicle</option>{vehicleTypes.map(type=><option key={type} value={type}>{type.replaceAll('_',' ')}</option>)}</select></label>
            <label>Status<select value={tab} onChange={e=>setTab(e.target.value as DiaryTab)}>{tabs.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <label>Date<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
            <button type="button" className="xd3150-diary-clear" onClick={clear}>Clear Filters</button>
            <button type="button" className="xd3150-diary-search" onClick={()=>setPage(1)}>Search Diary</button>
            <details className="xd3150-diary-extra-filters"><summary>Additional search &amp; tools</summary><div className="xd3150-diary-extra-body">
              <label>Load ID / Ref<input value={reference} onChange={e=>setReference(e.target.value)} placeholder="Job, booking or customer ref"/></label>
              <label>Awarded Carrier / Member<input value={carrier} onChange={e=>setCarrier(e.target.value)} placeholder="Carrier company / owner driver / ID"/></label>
              <div className="cx-diary-rail-nav">
                <ActionButton tone="secondary" onClick={()=>router.push('/customer/network/directory')}>Contacts</ActionButton>
                <ActionButton tone="secondary" onClick={()=>router.push('/customer/invoices')}>Invoices</ActionButton>
              </div>
            </div></details>
          </div>
        </aside>

        <main className="workspace-board-main" style={{ minWidth: 0 }}>
          <div className="workspace-record-meta workspace-list-controls cx-diary-toolbar">
            <span className="cx-diary-toolbar__title"><span className="cx-diary-toolbar__calendar" aria-hidden="true">▣</span><strong>Diary at {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}</strong></span>
            <span className="workspace-list-controls__right">
              <button type="button" className="cx-expand-entries-control" disabled={!visibleRows.length} onClick={() => { setExpandAll((current) => !current); setExpanded(null); }}>{expandAll ? 'Collapse All Entries' : 'Expand All Entries'}</button>
              <ActionButton tone="secondary" onClick={() => void data.refresh()}>Refresh</ActionButton>
            </span>
          </div>
          <div className="xd3150-diary-results-head">
            <h2>{date ? "Selected Day's Diary" : "Diary Bookings"} <small>({rows.length} bookings)</small></h2>
            <div className="xd3150-diary-result-tools">
              <label>Sort by <select value={sortBy} onChange={e=>setSortBy(e.target.value as 'earliest'|'latest')}><option value="earliest">Collection Time (Earliest)</option><option value="latest">Collection Time (Latest)</option></select></label>
              <button type="button" aria-label="List view" aria-pressed={viewMode==='list'} onClick={()=>setViewMode('list')}>≡</button>
              <button type="button" aria-label="Calendar view" aria-pressed={viewMode==='calendar'} onClick={()=>setViewMode('calendar')}>▦</button>
            </div>
          </div>
          <div className="cx-diary-paging-toolbar" aria-label="Diary page controls">
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
            <div className={viewMode==='calendar'?'workspace-record-list xd3150-diary-calendar-view':'workspace-record-list'}>
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
                  <CxDiaryCard
                    key={job.id}
                    from={routeLocationLabel(job.pickup_location, job.pickup_postcode, 'Collection')}
                    to={routeLocationLabel(job.delivery_location, job.delivery_postcode, 'Delivery')}
                    pickup={pickupWhen}
                    delivery={deliveryWhen}
                    band={band}
                    statusLine={carrierCompanyId || awardedOwnerDriverId ? <MemberIdentityLink companyId={carrierCompanyId} driverId={awardedOwnerDriverId}>{carrierName}</MemberIdentityLink> : <strong>{carrierName}</strong>}
                    statusStamp={<>{quoteInfo?.submitted ?? 0} submitted quote{(quoteInfo?.submitted ?? 0) === 1 ? '' : 's'}{job.assigned_driver_id ? ' · executing driver assigned' : ''}</>}
                    loadId={job.id.slice(0, 8).toUpperCase()}
                    vehicle={vehicle}
                    state={normalizedJobStatus(job)}
                    stage={stage}
                    expanded={open}
                    footer={<div className="xd3150-diary-card-actions">
                      <button type="button" onClick={() => { setExpandAll(false); setExpanded(open && !expandAll ? null : job.id); setDetailTabs(current => ({ ...current, [job.id]: 'agreement' })); }} aria-expanded={open}>{open ? 'Collapse Details' : 'View Details'}</button>
                      <button type="button" className="xd3150-diary-booking-action" onClick={() => { setExpandAll(false); setExpanded(job.id); setDetailTabs(current => ({ ...current, [job.id]: 'agreement' })); }}>Booking Details</button>
                      <details className="xd3150-diary-more-actions"><summary>More actions</summary>
                      <CxDiaryActions
                      expanded={open}
                      onToggle={() => { if (expandAll) { setExpandAll(false); setExpanded(null); } else setExpanded(open ? null : job.id); }}
                      onOpenTab={(tab) => { setExpandAll(false); setExpanded(job.id); setDetailTabs(current => ({ ...current, [job.id]: DIARY_JOB_SHEET_TABS[tab] })); }}
                      feedback={canManageFeedback && feedbackAvailable ? <button type="button" className="xdrive-cx-diary-card__feedback" onClick={() => setFeedbackJobId(job.id)}>{review ? 'Edit Feedback' : 'Leave Feedback'}</button> : null}
                    >
                      {stage !== 'open' ? <button type="button" onClick={() => { setExpandAll(false); setExpanded(job.id); setDetailTabs(current => ({ ...current, [job.id]: 'agreement' })); }}>Open booking</button> : null}
                      <button type="button" onClick={() => router.push(`/job-replay/${job.id}`)}>Replay</button>
                    </CxDiaryActions></details></div>}
                    expandedMeta={<>
                      {job.booking_reference && <div><span>Booking:</span><strong>{job.booking_reference}</strong></div>}
                      {job.customer_reference && <div><span>Customer ref:</span><strong>{job.customer_reference}</strong></div>}
                      <div><span>POD:</span><strong>{job.pod_generated || job.has_delivery_evidence ? 'Available' : job.pod_required ? 'Required' : 'Not recorded'}</strong></div>
                      <div><span>Delivery photo:</span><strong>{deliveryPhotoAvailable ? 'Available' : 'Not recorded'}</strong></div>
                      <div><span>Updated:</span><strong>{when(job.updated_at)}</strong></div>
                    </>}
                    expandedContent={<CompanyJobSheetPanel key={`${job.id}:${detailTabs[job.id] ?? 'agreement'}`} jobId={job.id} mode="customer" initialTab={detailTabs[job.id] ?? 'agreement'} />}
                  />
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
        return <CompanyFeedbackDialog jobId={feedbackJobId} companyId={companyId} existing={existing ? { rating: existing.rating, comment: existing.comment, would_use_again: existing.would_use_again, delivered_promptly: existing.delivered_promptly, courteous: existing.courteous } : null} counterpartyLabel={counterpartyLabel} onClose={() => setFeedbackJobId(null)} onSaved={loadReviews} />;
      })() : null}
      </section>
    </PageFrame>
  );
}
