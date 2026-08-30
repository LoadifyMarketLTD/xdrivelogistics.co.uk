'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import DriverInvoicePreviewModal from '../_components/DriverInvoicePreviewModal';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { classifyWorkspaceJobStage } from '../../../lib/jobs/workspaceJobStage';
import { MemberIdentityLink } from '../../components/workspace/MemberProfile';
import { ActionButton, AlertBanner, EmptyState, StatusBadge } from '../../components/workspace/WorkspaceUI';

type CompanyRelation = { name: string } | Array<{ name: string }> | null;
type TimeWindow = 'any' | '2' | '4' | '8' | '24';
type DateRange = 'any' | 'today' | '7d' | '30d';
type ArchiveFilter = 'all' | 'active' | 'closed';
type FeedbackMode = 'all' | 'awaiting' | 'recent';
type HistoryFilter = 'all' | 'unallocated' | 'allocated' | 'in_progress' | 'completed' | 'cancelled' | 'expired' | 'feedback';
type DetailTab = 'pod' | 'order' | 'notes' | 'history' | 'documents' | 'invoice';
type StatusHistoryEntry = { status?: string | null; timestamp?: string | null; at?: string | null };

type HistoryJob = {
  id: string;
  company_id: string;
  status: string;
  current_status: string | null;
  assigned_driver_id: string | null;
  pickup_location: string | null;
  pickup_postcode: string | null;
  delivery_location: string | null;
  delivery_postcode: string | null;
  pickup_datetime: string | null;
  delivery_datetime: string | null;
  collection_window_start: string | null;
  delivery_window_start: string | null;
  deadline_at: string | null;
  vehicle_type: string | null;
  requested_vehicle_label: string | null;
  cargo_type: string | null;
  requested_cargo_label: string | null;
  weight_kg: number | null;
  pallets: number | null;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  cargo_value_gbp: number | null;
  load_details: string | null;
  load_notes: string | null;
  collection_notes: string | null;
  delivery_notes: string | null;
  driver_notes: string | null;
  collection_contact_name: string | null;
  collection_contact_phone: string | null;
  delivery_contact_name: string | null;
  delivery_contact_phone: string | null;
  purchase_order_number: string | null;
  special_requirements: string | null;
  access_restrictions: string | null;
  document_checklist: string[] | null;
  hard_copy_pod: string | null;
  pod_required: boolean | null;
  pod_generated: boolean | null;
  pod_generated_at: string | null;
  pod_photos: unknown[] | null;
  delivery_photos: string[] | null;
  status_history: StatusHistoryEntry[] | null;
  feedback_status: string | null;
  broker_pod_review_status: string | null;
  broker_pod_review_note: string | null;
  updated_at: string | null;
  created_at: string | null;
  customer_reference: string | null;
  booking_reference: string | null;
  companies: { name: string } | null;
};

type OrderSheet = {
  reference: string;
  loadId: string;
  status: string;
  bookedAt: string | null;
  postingCompanyId: string | null;
  bookedBy: string;
  memberCode: string | null;
  memberPhone: string | null;
  executingCompanyId: string | null;
  driverId: string;
  driverName: string | null;
  agreedRate: number | null;
  agreedGross: number | null;
  vatRate: number | null;
  vatAmount: number | null;
  currency: string;
  paymentTerms: string | null;
  paymentDueDays: number | null;
  commercialSnapshotAvailable: boolean;
  customerName: string | null;
  customerReference: string | null;
  purchaseOrderNumber: string | null;
  bookingReference: string | null;
  distanceMiles: number | null;
  requestedVehicle: string | null;
  allocatedVehicle: {
    id: string | null;
    ref: string | null;
    type: string | null;
    make: string | null;
    model: string | null;
    payloadKg: number | null;
    palletsCapacity: number | null;
    hasTailLift: boolean | null;
    source: 'job' | 'driver_current' | 'none';
  };
  cargo: {
    type: string | null;
    weightKg: number | null;
    pallets: number | null;
    lengthCm: number | null;
    widthCm: number | null;
    heightCm: number | null;
    cargoValueGbp: number | null;
    palletType: string | null;
    stackable: boolean | null;
  };
  requirements: string[];
  hardCopyPod: string;
  podRequired: boolean;
  pickup: {
    address: string | null;
    postcode: string | null;
    dateTime: string | null;
    slot: string | null;
    contactName: string | null;
    contactPhone: string | null;
    notes: string | null;
  };
  delivery: {
    address: string | null;
    postcode: string | null;
    dateTime: string | null;
    slot: string | null;
    contactName: string | null;
    contactPhone: string | null;
    notes: string | null;
  };
  publicQuoteNotes: string | null;
  executionInstructions: string | null;
  driverNotes: string | null;
  documentChecklist: string[];
  timeline: Array<{ id?: string | null; eventType: string; message?: string | null; createdAt: string | null }>;
  documents: Array<{ id: string | null; type: string; fileName: string | null; filePath: string | null; createdAt: string | null }>;
  invoices: Array<{ id: string | null; number: string | null; status: string | null; paymentStatus: string | null; amount: number | null; currency: string; dueDate: string | null }>;
  partial: boolean;
  unavailable: { bodyType: string; extras: string; bookingFooter: string };
};

type ReviewRow = { id: string; job_id: string | null; rating: number | null; comment: string | null; created_at: string | null };
type DocumentRow = { id: string; job_id: string | null; file_name: string | null; file_type: string | null; file_url: string | null; uploaded_at: string | null };
type TrackingEventRow = { id: string; job_id: string | null; event_type: string | null; event_time: string | null; user_name: string | null; notes: string | null; message: string | null };
type SearchFilters = { dateRange: DateRange; pickupWithin: TimeWindow; deliveryWithin: TimeWindow; loadRef: string; memberName: string; archive: ArchiveFilter };

const EMPTY_SEARCH: SearchFilters = { dateRange: 'any', pickupWithin: 'any', deliveryWithin: 'any', loadRef: '', memberName: '', archive: 'all' };
const FILTERS: Array<{ id: HistoryFilter; label: string }> = [
  { id: 'all', label: 'All' }, { id: 'unallocated', label: 'Unallocated' }, { id: 'allocated', label: 'Allocated' },
  { id: 'in_progress', label: 'In Progress' }, { id: 'completed', label: 'Completed' }, { id: 'cancelled', label: 'Cancelled' },
  { id: 'expired', label: 'Expired' }, { id: 'feedback', label: 'Feedback' },
];
const DETAIL_TABS: Array<{ id: DetailTab; label: string }> = [
  { id: 'pod', label: 'POD' }, { id: 'order', label: 'Order' }, { id: 'notes', label: 'Notes' },
  { id: 'history', label: 'History' }, { id: 'documents', label: 'Documents' }, { id: 'invoice', label: 'Invoice' },
];
const TIME_WINDOWS: Array<{ value: TimeWindow; label: string }> = [
  { value: 'any', label: 'Any' }, { value: '2', label: '2 hours' }, { value: '4', label: '4 hours' }, { value: '8', label: '8 hours' }, { value: '24', label: '24 hours' },
];
const STATUS_LABELS: Record<string, string> = {
  posted: 'Posted', quoted: 'Quoted', awarded: 'Awarded', allocated: 'Allocated', accepted: 'Accepted',
  on_my_way: 'On my way to pickup', on_my_way_to_pickup: 'On my way to pickup', on_site_pickup: 'On site pickup',
  collected: 'Loaded', loaded: 'Loaded', in_transit: 'In transit', on_my_way_to_delivery: 'On my way to delivery', on_site_delivery: 'On site delivery',
  delivered: 'Delivered', completed: 'Completed', invoiced: 'Invoiced', paid: 'Paid', cancelled: 'Cancelled', disputed: 'Disputed',
  driver_declined: 'Declined', expired: 'Expired',
};

function normalizeCompany(value: CompanyRelation) { return !value ? null : Array.isArray(value) ? (value[0] ?? null) : value; }
function fmtDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function rawDateLabel(value: string | null) {
  const raw = value?.trim();
  if (!raw) return 'Date not supplied';
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return fmtDate(value);
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString('en-GB', { dateStyle: 'medium' });
}
function transportSchedule(dateTime: string | null, slot: string | null) {
  const cleanSlot = slot?.trim();
  if (!cleanSlot) return fmtDate(dateTime);
  if (/^\d{1,2}:\d{2}(?:\s*[-–]\s*\d{1,2}:\d{2})?$/.test(cleanSlot) || cleanSlot.toUpperCase() === 'ASAP') {
    return `${rawDateLabel(dateTime)} · ${cleanSlot}`;
  }
  return `${fmtDate(dateTime)} · ${cleanSlot}`;
}
function normalizeComparable(value: string | null | undefined) { return (value ?? '').trim().replace(/[,.]+$/g, '').replace(/\s+/g, ' ').toUpperCase(); }
function formatExecutionAddress(address: string | null, postcode: string | null) {
  const cleanAddress = address?.trim() || '';
  const cleanPostcode = postcode?.trim() || '';
  if (!cleanAddress) return cleanPostcode || 'Not supplied';
  if (!cleanPostcode) return cleanAddress;
  return normalizeComparable(cleanAddress).includes(normalizeComparable(cleanPostcode)) ? cleanAddress : `${cleanAddress}, ${cleanPostcode}`;
}
function postcodeSecondary(address: string | null, postcode: string | null) {
  if (!postcode) return '—';
  return normalizeComparable(address).includes(normalizeComparable(postcode)) ? 'Route address' : postcode;
}
function money(value: number, currency = 'GBP') { return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value); }
function human(value: string | null | undefined) { return value ? value.replace(/_/g, ' ') : 'Not supplied'; }
function effectiveStatus(job: HistoryJob) { return String(job.current_status || job.status || '').trim().toLowerCase(); }
function jobStage(job: HistoryJob) { return classifyWorkspaceJobStage(job); }
function withinHours(value: string | null, window: TimeWindow) {
  if (window === 'any') return true;
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return !Number.isNaN(timestamp) && timestamp >= Date.now() && timestamp <= Date.now() + Number(window) * 60 * 60 * 1000;
}
function withinDateRange(value: string | null, range: DateRange) {
  if (range === 'any') return true;
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return false;
  const now = new Date();
  if (range === 'today') {
    const target = new Date(value);
    return target.getFullYear() === now.getFullYear() && target.getMonth() === now.getMonth() && target.getDate() === now.getDate();
  }
  return timestamp >= Date.now() - (range === '7d' ? 7 : 30) * 86400000;
}
function groupByJobId<T extends { job_id: string | null }>(rows: T[]) {
  const grouped: Record<string, T[]> = {};
  for (const row of rows) { if (row.job_id) (grouped[row.job_id] ??= []).push(row); }
  return grouped;
}
function isDerivedExpired(job: HistoryJob) {
  return jobStage(job) === 'expired';
}
function hasRecentFeedback(job: HistoryJob, reviews: ReviewRow[]) {
  return reviews.length > 0 || ['received', 'completed', 'submitted', 'left', 'recent'].includes((job.feedback_status ?? '').toLowerCase());
}
function isAwaitingFeedback(job: HistoryJob, reviews: ReviewRow[]) { return jobStage(job) === 'completed' && !hasRecentFeedback(job, reviews); }
function isClosedRecord(job: HistoryJob) { const stage = jobStage(job); return stage === 'completed' || stage === 'cancelled' || stage === 'expired'; }
function feedbackMatches(job: HistoryJob, reviews: ReviewRow[], mode: FeedbackMode) {
  const awaiting = isAwaitingFeedback(job, reviews); const recent = hasRecentFeedback(job, reviews);
  return mode === 'awaiting' ? awaiting : mode === 'recent' ? recent : awaiting || recent;
}
function filterMatches(job: HistoryJob, filter: HistoryFilter, reviews: ReviewRow[], feedbackMode: FeedbackMode = 'all') {
  if (filter === 'all') return true;
  if (filter === 'feedback') return feedbackMatches(job, reviews, feedbackMode);
  const stage = jobStage(job);
  if (filter === 'unallocated') return stage === 'open' || stage === 'awarded';
  if (filter === 'allocated') return stage === 'allocated';
  if (filter === 'in_progress') return stage === 'in_progress';
  if (filter === 'completed') return stage === 'completed';
  if (filter === 'cancelled') return stage === 'cancelled';
  return stage === 'expired';
}
function statusTone(job: HistoryJob): 'blue' | 'green' | 'red' | 'purple' | 'orange' | 'grey' {
  const stage = jobStage(job);
  if (stage === 'expired') return 'grey';
  if (stage === 'completed') return 'green';
  if (stage === 'cancelled') return 'red';
  if (stage === 'disputed') return 'purple';
  if (stage === 'awarded' || stage === 'allocated' || stage === 'in_progress') return 'blue';
  return 'orange';
}
function parsePrivateNotes(value: string | null) {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return raw;
    const object = parsed as Record<string, unknown>;
    const candidate = object.executionInstructions ?? object.notes;
    return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null;
  } catch { return raw; }
}
function cargoDimensions(sheet: OrderSheet | null | undefined, job: HistoryJob) {
  const cargo = sheet?.cargo;
  const values = [cargo?.lengthCm ?? job.length_cm, cargo?.widthCm ?? job.width_cm, cargo?.heightCm ?? job.height_cm];
  return values.every((value) => value == null) ? 'Not supplied' : `${values.map((value) => value == null ? '—' : value).join(' × ')} cm`;
}

export default function JobHistoryPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const driverId = typeof user?.driverId === 'string' ? user.driverId.trim() : '';
  const [jobs, setJobs] = useState<HistoryJob[]>([]);
  const [reviewsByJob, setReviewsByJob] = useState<Record<string, ReviewRow[]>>({});
  const [documentsByJob, setDocumentsByJob] = useState<Record<string, DocumentRow[]>>({});
  const [eventsByJob, setEventsByJob] = useState<Record<string, TrackingEventRow[]>>({});
  const [orderSheetsByJob, setOrderSheetsByJob] = useState<Record<string, OrderSheet | null>>({});
  const [orderLoadingByJob, setOrderLoadingByJob] = useState<Record<string, boolean>>({});
  const [orderErrorsByJob, setOrderErrorsByJob] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detailWarning, setDetailWarning] = useState('');
  const [statusFilter, setStatusFilter] = useState<HistoryFilter>('all');
  const [feedbackMode, setFeedbackMode] = useState<FeedbackMode>('all');
  const [search, setSearch] = useState<SearchFilters>(EMPTY_SEARCH);
  const [appliedSearch, setAppliedSearch] = useState<SearchFilters>(EMPTY_SEARCH);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [page, setPage] = useState(1);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [detailTabs, setDetailTabs] = useState<Record<string, DetailTab>>({});
  const [invoicePreview, setInvoicePreview] = useState<{ id: string; number: string | null } | null>(null);

  const fetchOrderSheet = useCallback(async (jobId: string) => {
    if (orderSheetsByJob[jobId] !== undefined || orderLoadingByJob[jobId]) return;
    setOrderLoadingByJob((current) => ({ ...current, [jobId]: true }));
    setOrderErrorsByJob((current) => ({ ...current, [jobId]: '' }));
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Session expired.');
      const response = await fetch(`/api/driver/jobs/${encodeURIComponent(jobId)}/sheet`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const payload = await response.json().catch(() => ({})) as { sheet?: OrderSheet; error?: string };
      if (!response.ok || !payload.sheet) throw new Error(payload.error || 'Order confirmation is unavailable.');
      setOrderSheetsByJob((current) => ({ ...current, [jobId]: payload.sheet ?? null }));
    } catch (reason) {
      setOrderSheetsByJob((current) => ({ ...current, [jobId]: null }));
      setOrderErrorsByJob((current) => ({ ...current, [jobId]: reason instanceof Error ? reason.message : 'Order confirmation is unavailable.' }));
    } finally {
      setOrderLoadingByJob((current) => ({ ...current, [jobId]: false }));
    }
  }, [orderLoadingByJob, orderSheetsByJob]);

  const openDetail = useCallback((jobId: string, tab: DetailTab) => {
    setExpandedIds((current) => new Set(current).add(jobId));
    setDetailTabs((current) => ({ ...current, [jobId]: tab }));
    if (tab === 'order' || tab === 'notes' || tab === 'invoice') void fetchOrderSheet(jobId);
  }, [fetchOrderSheet]);

  const fetchHistory = useCallback(async () => {
    if (!isSupabaseConfigured || authLoading) return;
    if (!driverId) { setLoading(false); return; }
    setLoading(true); setError(''); setDetailWarning('');

    const { data, error: fetchError } = await supabase
      .from('jobs')
      .select('id, company_id, status, current_status, assigned_driver_id, pickup_location, pickup_postcode, delivery_location, delivery_postcode, pickup_datetime, delivery_datetime, collection_window_start, delivery_window_start, deadline_at, vehicle_type, requested_vehicle_label, cargo_type, requested_cargo_label, weight_kg, pallets, length_cm, width_cm, height_cm, cargo_value_gbp, load_details, load_notes, collection_notes, delivery_notes, driver_notes, collection_contact_name, collection_contact_phone, delivery_contact_name, delivery_contact_phone, purchase_order_number, special_requirements, access_restrictions, document_checklist, hard_copy_pod, pod_required, pod_generated, pod_generated_at, pod_photos, delivery_photos, status_history, feedback_status, broker_pod_review_status, broker_pod_review_note, updated_at, created_at, customer_reference, booking_reference, companies:companies!jobs_company_id_fkey(name)')
      .eq('assigned_driver_id', driverId)
      .order('updated_at', { ascending: false })
      .limit(250);

    if (fetchError) {
      setError('Diary records could not be loaded. Please refresh and try again.'); setJobs([]); setLoading(false); return;
    }
    const normalized = ((data ?? []) as unknown as Array<Omit<HistoryJob, 'companies'> & { companies: CompanyRelation }>).map((job) => ({ ...job, companies: normalizeCompany(job.companies) }));
    setJobs(normalized);
    const jobIds = normalized.map((job) => job.id);
    if (!jobIds.length) {
      setReviewsByJob({}); setDocumentsByJob({}); setEventsByJob({}); setLoading(false); return;
    }

    const [reviewsRes, documentsRes, eventsRes] = await Promise.all([
      supabase.from('reviews').select('id, job_id, rating, comment, created_at').in('job_id', jobIds).order('created_at', { ascending: false }),
      supabase.from('job_documents').select('id, job_id, file_name, file_type, file_url, uploaded_at').in('job_id', jobIds).order('uploaded_at', { ascending: false }),
      supabase.from('job_tracking_events').select('id, job_id, event_type, event_time, user_name, notes, message').in('job_id', jobIds).order('event_time', { ascending: false }),
    ]);
    const warnings: string[] = [];
    if (reviewsRes.error) warnings.push('feedback'); else setReviewsByJob(groupByJobId((reviewsRes.data ?? []) as ReviewRow[]));
    if (documentsRes.error) warnings.push('documents'); else setDocumentsByJob(groupByJobId((documentsRes.data ?? []) as DocumentRow[]));
    if (eventsRes.error) warnings.push('history'); else setEventsByJob(groupByJobId((eventsRes.data ?? []) as TrackingEventRow[]));
    if (warnings.length) setDetailWarning(`Some Diary detail data is temporarily unavailable: ${warnings.join(', ')}.`);
    setLoading(false);
  }, [authLoading, driverId]);

  useEffect(() => { void fetchHistory(); }, [fetchHistory]);

  const searchedJobs = useMemo(() => jobs.filter((job) => {
    const refDate = job.pickup_datetime ?? job.collection_window_start ?? job.updated_at ?? job.created_at;
    if (!withinDateRange(refDate, appliedSearch.dateRange)) return false;
    if (!withinHours(job.pickup_datetime ?? job.collection_window_start, appliedSearch.pickupWithin)) return false;
    if (!withinHours(job.delivery_datetime ?? job.delivery_window_start, appliedSearch.deliveryWithin)) return false;
    if (appliedSearch.archive === 'active' && isClosedRecord(job)) return false;
    if (appliedSearch.archive === 'closed' && !isClosedRecord(job)) return false;
    const refNeedle = appliedSearch.loadRef.trim().toLowerCase(); const memberNeedle = appliedSearch.memberName.trim().toLowerCase();
    if (refNeedle && ![job.id, job.customer_reference, job.booking_reference].filter(Boolean).join(' ').toLowerCase().includes(refNeedle)) return false;
    if (memberNeedle && !(job.companies?.name ?? '').toLowerCase().includes(memberNeedle)) return false;
    return true;
  }), [appliedSearch, jobs]);
  const visibleFiltered = useMemo(() => searchedJobs.filter((job) => filterMatches(job, statusFilter, reviewsByJob[job.id] ?? [], feedbackMode)), [feedbackMode, reviewsByJob, searchedJobs, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(visibleFiltered.length / itemsPerPage));
  const safePage = Math.min(page, totalPages);
  const visibleJobs = visibleFiltered.slice((safePage - 1) * itemsPerPage, safePage * itemsPerPage);
  useEffect(() => { setPage(1); }, [statusFilter, feedbackMode, appliedSearch, itemsPerPage]);

  const allExpanded = visibleJobs.length > 0 && visibleJobs.every((job) => expandedIds.has(job.id));
  const toggleExpandAll = () => {
    const expanding = !allExpanded;
    setExpandedIds((previous) => { const next = new Set(previous); visibleJobs.forEach((job) => { if (expanding) next.add(job.id); else next.delete(job.id); }); return next; });
    if (expanding) visibleJobs.forEach((job) => void fetchOrderSheet(job.id));
  };

  const filterRail = (
    <aside className="driver-filter-rail driver-diary-filter-rail" aria-label="Diary search filters">
      <div className="driver-filter-rail__header">Search Diary</div>
      <div className="driver-filter-rail__body">
        <div className="driver-filter-field"><label>Source</label><select value="assigned" disabled aria-label="Diary source"><option value="assigned">Assigned driver jobs</option></select></div>
        <div className="driver-filter-field"><label>Date</label><select value={search.dateRange} onChange={(e) => setSearch((current) => ({ ...current, dateRange: e.target.value as DateRange }))}><option value="any">Anytime</option><option value="today">Today</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option></select></div>
        <div className="driver-filter-field"><label>Pickup window</label><select value={search.pickupWithin} onChange={(e) => setSearch((current) => ({ ...current, pickupWithin: e.target.value as TimeWindow }))}>{TIME_WINDOWS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
        <div className="driver-filter-field"><label>Delivery window</label><select value={search.deliveryWithin} onChange={(e) => setSearch((current) => ({ ...current, deliveryWithin: e.target.value as TimeWindow }))}>{TIME_WINDOWS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
        <div className="driver-filter-field"><label>Load ID / reference</label><input value={search.loadRef} onChange={(e) => setSearch((current) => ({ ...current, loadRef: e.target.value }))} placeholder="Job, booking or ref" /></div>
        <div className="driver-filter-field"><label>Company / member</label><input value={search.memberName} onChange={(e) => setSearch((current) => ({ ...current, memberName: e.target.value }))} placeholder="Company name" /></div>
        <div className="driver-filter-field"><label>Archive</label><select value={search.archive} onChange={(e) => setSearch((current) => ({ ...current, archive: e.target.value as ArchiveFilter }))}><option value="all">All records</option><option value="active">Active register</option><option value="closed">Closed records</option></select></div>
        <div className="driver-filter-actions"><ActionButton tone="success" onClick={() => setAppliedSearch(search)}>Search</ActionButton><ActionButton tone="secondary" onClick={() => { setSearch(EMPTY_SEARCH); setAppliedSearch(EMPTY_SEARCH); }}>Clear</ActionButton></div>
        <ActionButton tone="secondary" onClick={() => router.push('/driver/finance')}>Payment Report</ActionButton>
      </div>
    </aside>
  );

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell subtitle="Search, scan and expand every assigned booking from one operational diary." headerActions={<ActionButton tone="primary" onClick={() => void fetchHistory()} disabled={loading}>Refresh</ActionButton>}>
        {error && <AlertBanner tone="danger">{error}</AlertBanner>}
        {detailWarning && <AlertBanner tone="warning">{detailWarning}</AlertBanner>}
        <div className="driver-board-layout driver-diary-board">
          {filterRail}
          <main className="driver-board-main">
            <div className="driver-tab-strip driver-diary-status-strip" role="tablist" aria-label="Diary states">
              {FILTERS.map((item) => <button key={item.id} type="button" role="tab" aria-selected={statusFilter === item.id} data-active={statusFilter === item.id ? 'true' : 'false'} onClick={() => setStatusFilter(item.id)}>{item.label} <span>{searchedJobs.filter((job) => filterMatches(job, item.id, reviewsByJob[job.id] ?? [], 'all')).length}</span></button>)}
            </div>
            <div className="driver-board-summary driver-diary-toolbar">
              <span>{visibleFiltered.length} booking{visibleFiltered.length === 1 ? '' : 's'} · showing {visibleJobs.length}</span>
              <span className="driver-diary-summary-actions">
                {statusFilter === 'feedback' && <label>Feedback:<select value={feedbackMode} onChange={(e) => setFeedbackMode(e.target.value as FeedbackMode)}><option value="all">All feedback</option><option value="awaiting">Awaiting feedback</option><option value="recent">Recent feedback</option></select></label>}
                <button type="button" onClick={toggleExpandAll} disabled={!visibleJobs.length}>{allExpanded ? 'Collapse all' : 'Expand all'}</button>
                <label>Per page:<select value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></label>
              </span>
            </div>

            {loading ? <div className="driver-load-row"><EmptyState compact title="Loading diary…" /></div> : visibleJobs.length === 0 ? <div className="driver-load-row"><EmptyState compact title="No bookings in this view" description="Adjust the status or search filters." /></div> : (
              <div className="driver-load-list driver-diary-list">
                {visibleJobs.map((job) => {
                  const expanded = expandedIds.has(job.id); const reviews = reviewsByJob[job.id] ?? [];
                  const documents = documentsByJob[job.id] ?? []; const trackingEvents = eventsByJob[job.id] ?? []; const detailTab = detailTabs[job.id] ?? 'order';
                  const sheet = orderSheetsByJob[job.id]; const orderLoading = orderLoadingByJob[job.id] === true; const orderError = orderErrorsByJob[job.id] || '';
                  const invoice = sheet?.invoices?.[0] ?? null;
                  const podPhotos = Array.isArray(job.pod_photos) ? job.pod_photos : (Array.isArray(job.delivery_photos) ? job.delivery_photos : []);
                  const hasPod = Boolean(job.pod_generated || podPhotos.length > 0); const feedbackReceived = hasRecentFeedback(job, reviews); const awaitingFeedback = isAwaitingFeedback(job, reviews); const expired = isDerivedExpired(job);
                  const currentStatus = effectiveStatus(job);
                  const historyRows = [
                    ...(Array.isArray(job.status_history) ? job.status_history.map((entry, index) => ({ key: `status-${index}`, label: STATUS_LABELS[entry.status ?? ''] ?? entry.status ?? 'Status update', at: entry.timestamp ?? entry.at ?? null, detail: 'Job status history' })) : []),
                    ...trackingEvents.map((event) => ({ key: event.id, label: event.event_type ? (STATUS_LABELS[event.event_type] ?? event.event_type.replace(/_/g, ' ')) : 'Tracking event', at: event.event_time, detail: event.message ?? event.notes ?? event.user_name ?? 'Operational event' })),
                  ].sort((a, b) => new Date(b.at ?? 0).getTime() - new Date(a.at ?? 0).getTime());
                  const noteRows = [
                    ['Public quote notes', sheet?.publicQuoteNotes],
                    ['Private execution instructions', sheet?.executionInstructions ?? job.load_notes ?? parsePrivateNotes(job.load_details)],
                    ['Collection notes', sheet?.pickup.notes ?? job.collection_notes],
                    ['Delivery notes', sheet?.delivery.notes ?? job.delivery_notes],
                    ['Driver notes', sheet?.driverNotes ?? job.driver_notes],
                    ['POD review note', job.broker_pod_review_note],
                  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
                  const requestedVehicle = human(sheet?.requestedVehicle ?? job.requested_vehicle_label ?? job.vehicle_type);
                  const allocatedVehicleName = [sheet?.allocatedVehicle.make, sheet?.allocatedVehicle.model].filter(Boolean).join(' ') || human(sheet?.allocatedVehicle.type ?? null);
                  const pickupAddress = sheet?.pickup.address ?? job.pickup_location; const pickupPostcode = sheet?.pickup.postcode ?? job.pickup_postcode;
                  const deliveryAddress = sheet?.delivery.address ?? job.delivery_location; const deliveryPostcode = sheet?.delivery.postcode ?? job.delivery_postcode;
                  const cargoType = human(sheet?.cargo.type ?? job.requested_cargo_label ?? job.cargo_type);
                  const cargoWeight = sheet?.cargo.weightKg ?? job.weight_kg; const cargoPallets = sheet?.cargo.pallets ?? job.pallets; const cargoValue = sheet?.cargo.cargoValueGbp ?? job.cargo_value_gbp;

                  return (
                    <article key={job.id} className="driver-load-row driver-diary-entry" data-state={expired ? 'expired' : currentStatus}>
                      <div className="driver-load-row__top driver-diary-entry__top">
                        <div className="driver-load-cell"><span className="driver-cell-label">From</span><strong className="driver-cell-primary">{formatExecutionAddress(job.pickup_location, job.pickup_postcode)}</strong><span className="driver-cell-secondary">{postcodeSecondary(job.pickup_location, job.pickup_postcode)}</span></div>
                        <div className="driver-load-cell"><span className="driver-cell-label">To</span><strong className="driver-cell-primary">{formatExecutionAddress(job.delivery_location, job.delivery_postcode)}</strong><span className="driver-cell-secondary">{postcodeSecondary(job.delivery_location, job.delivery_postcode)}</span></div>
                        <div className="driver-load-cell"><span className="driver-cell-label">Timing / load</span><strong className="driver-cell-primary">Pickup {fmtDate(job.pickup_datetime ?? job.collection_window_start)}</strong><span className="driver-cell-secondary">Deliver {fmtDate(job.delivery_datetime ?? job.delivery_window_start)} · {human(job.vehicle_type)}</span></div>
                        <div className="driver-load-cell"><span className="driver-cell-label">Status / member</span><strong className="driver-cell-primary">{expired ? 'Expired' : (STATUS_LABELS[currentStatus] ?? human(currentStatus))}</strong><span className="driver-cell-secondary"><MemberIdentityLink companyId={job.company_id}>{job.companies?.name ?? 'Member not supplied'}</MemberIdentityLink> · Commercial terms in Order</span></div>
                      </div>
                      <div className="driver-load-row__meta">
                        <span>Load #{job.id.slice(0, 8).toUpperCase()}</span>{job.booking_reference && <span>Booking: {job.booking_reference}</span>}{job.customer_reference && <span>Customer ref: {job.customer_reference}</span>}
                        <StatusBadge value={expired ? 'Expired' : (STATUS_LABELS[currentStatus] ?? human(currentStatus))} tone={expired ? 'grey' : statusTone(job)} />{hasPod && <StatusBadge value="POD captured" tone="green" />}{awaitingFeedback && <StatusBadge value="Awaiting feedback" tone="orange" />}{feedbackReceived && <StatusBadge value="Feedback received" tone="green" />}
                        <div className="driver-row-actions"><ActionButton tone="secondary" onClick={() => { const willExpand = !expanded; setExpandedIds((previous) => { const next = new Set(previous); if (next.has(job.id)) next.delete(job.id); else next.add(job.id); return next; }); if (willExpand) void fetchOrderSheet(job.id); }}>{expanded ? 'Collapse' : 'Details'}</ActionButton><ActionButton tone="secondary" onClick={() => router.push(`/driver/jobs/${job.id}`)}>Open job</ActionButton></div>
                      </div>

                      <div className="driver-diary-action-rail" role="toolbar" aria-label={`Booking ${job.id} actions`}>
                        {DETAIL_TABS.map((detailItem) => (
                          <button
                            key={detailItem.id}
                            type="button"
                            data-active={expanded && detailTab === detailItem.id ? 'true' : 'false'}
                            onClick={() => {
                              if (detailItem.id === 'invoice' && invoice?.id) {
                                setInvoicePreview({ id: invoice.id, number: invoice.number });
                                return;
                              }
                              openDetail(job.id, detailItem.id);
                            }}
                          >
                            {detailItem.id === 'documents' && documents.length > 0 ? `${detailItem.label} ${documents.length}` : detailItem.id === 'invoice' && invoice?.id ? 'View invoice (£)' : detailItem.label}
                          </button>
                        ))}
                        {feedbackReceived && <button type="button" onClick={() => setExpandedIds((current) => new Set(current).add(job.id))}>View feedback</button>}
                      </div>

                      {expanded && (
                        <div className="driver-row-details driver-diary-details">
                          <div className="driver-diary-detail-panel">
                            {detailTab === 'order' && (orderLoading ? <EmptyState compact title="Loading Order confirmation…" /> : (
                              <>
                                {orderError && <AlertBanner tone="warning">{orderError} Existing assigned-job fields remain visible; unavailable commercial fields are not fabricated.</AlertBanner>}
                                {sheet?.partial && <AlertBanner tone="warning">Part of this execution sheet could not be enriched. Verified job data is shown and missing values stay explicit.</AlertBanner>}
                                <div className="driver-detail-grid">
                                  <div className="driver-detail-item"><span>Booking / job reference</span><strong>{sheet?.bookingReference ?? job.booking_reference ?? sheet?.reference ?? `XDL-${job.id.slice(0, 8).toUpperCase()}`}</strong></div>
                                  <div className="driver-detail-item"><span>Booked / allocated</span><strong>{sheet?.bookedAt ? fmtDate(sheet.bookedAt) : 'Timestamp not supplied'}</strong></div>
                                  <div className="driver-detail-item"><span>Requested vehicle</span><strong>{requestedVehicle}</strong></div>
                                  <div className="driver-detail-item"><span>{sheet?.allocatedVehicle.source === 'driver_current' ? 'Current driver vehicle' : 'Allocated vehicle'}</span><strong>{allocatedVehicleName}</strong><small>{sheet?.allocatedVehicle.ref ? `Vehicle ref: ${sheet.allocatedVehicle.ref}` : 'Vehicle ref not supplied'}{sheet?.allocatedVehicle.source === 'driver_current' ? ' · no job-level vehicle snapshot' : ''}</small></div>
                                  <div className="driver-detail-item"><span>Body type</span><strong>Not supplied</strong><small>{sheet?.unavailable.bodyType ?? 'Not available for this booking.'}</small></div>
                                  <div className="driver-detail-item"><span>Subcontracted by</span><strong><MemberIdentityLink companyId={sheet?.postingCompanyId ?? job.company_id}>{sheet?.bookedBy ?? job.companies?.name ?? 'Not supplied'}</MemberIdentityLink></strong><small>{[sheet?.memberCode ? `Company no. ${sheet.memberCode}` : null, sheet?.memberPhone].filter(Boolean).join(' · ') || 'Business contact not supplied'}</small></div>
                                  <div className="driver-detail-item"><span>Executing driver / carrier</span><strong>{sheet?.driverName ?? 'Assigned driver'}</strong><small>{sheet?.executingCompanyId ? <MemberIdentityLink companyId={sheet.executingCompanyId}>Open executing carrier profile</MemberIdentityLink> : 'Executing company not supplied'}</small></div>
                                  <div className="driver-detail-item"><span>Agreed rate</span><strong>{sheet?.agreedRate != null ? money(sheet.agreedRate, sheet.currency) : 'Not supplied'}</strong><small>{sheet?.agreedGross != null ? `Gross ${money(sheet.agreedGross, sheet.currency)}${sheet.vatRate != null ? ` · VAT ${sheet.vatRate}%` : ''}` : sheet?.commercialSnapshotAvailable ? 'Agreed rate recorded at award' : 'Historical agreed-rate record unavailable'}</small></div>
                                  <div className="driver-detail-item"><span>Extras</span><strong>Not supplied</strong><small>{sheet?.unavailable.extras ?? 'No historical extras record is available for this booking.'}</small></div>
                                  <div className="driver-detail-item"><span>Payment terms</span><strong>{sheet?.paymentTerms ?? 'Historical terms unavailable'}</strong><small>{sheet?.paymentDueDays != null ? `${sheet.paymentDueDays} day(s)` : 'Due-day value not supplied'}</small></div>
                                  <div className="driver-detail-item"><span>Hard-copy POD</span><strong>{sheet?.hardCopyPod ?? job.hard_copy_pod ?? (job.pod_required ? 'Required' : 'Requirement not supplied')}</strong></div>
                                  <div className="driver-detail-item"><span>Customer</span><strong>{sheet?.customerName ?? 'Not supplied'}</strong></div>
                                  <div className="driver-detail-item"><span>Customer ref</span><strong>{sheet?.customerReference ?? job.customer_reference ?? 'Not supplied'}</strong></div>
                                  <div className="driver-detail-item"><span>PO number</span><strong>{sheet?.purchaseOrderNumber ?? job.purchase_order_number ?? 'Not supplied'}</strong></div>
                                  <div className="driver-detail-item"><span>Distance</span><strong>{sheet?.distanceMiles != null ? `${sheet.distanceMiles} miles` : 'Not supplied'}</strong></div>
                                  <div className="driver-detail-item"><span>Cargo</span><strong>{cargoType}</strong><small>{cargoWeight != null ? `${cargoWeight} kg` : 'Weight not supplied'}{cargoPallets != null ? ` · ${cargoPallets} pallet(s)` : ''}</small></div>
                                  <div className="driver-detail-item"><span>Dimensions</span><strong>{cargoDimensions(sheet, job)}</strong></div>
                                  <div className="driver-detail-item"><span>Cargo value</span><strong>{cargoValue != null ? money(cargoValue) : 'Not supplied'}</strong></div>
                                </div>

                                <div className="driver-diary-note-list">
                                  <div className="driver-diary-text-block"><strong>Pickup</strong><span>{formatExecutionAddress(pickupAddress, pickupPostcode)} · {transportSchedule(sheet?.pickup.dateTime ?? job.pickup_datetime ?? job.collection_window_start, sheet?.pickup.slot ?? null)}</span><span>Company context: {sheet?.bookedBy ?? job.companies?.name ?? 'Not separately supplied'}</span><span>Contact: {sheet?.pickup.contactName ?? job.collection_contact_name ?? 'Not supplied'} · {sheet?.pickup.contactPhone ?? job.collection_contact_phone ?? 'Phone not supplied'}</span>{sheet?.pickup.notes && <span>Notes: {sheet.pickup.notes}</span>}</div>
                                  <div className="driver-diary-text-block"><strong>Delivery</strong><span>{formatExecutionAddress(deliveryAddress, deliveryPostcode)} · {transportSchedule(sheet?.delivery.dateTime ?? job.delivery_datetime ?? job.delivery_window_start, sheet?.delivery.slot ?? null)}</span><span>Company context: {sheet?.customerName ?? 'Not separately supplied'}</span><span>Contact: {sheet?.delivery.contactName ?? job.delivery_contact_name ?? 'Not supplied'} · {sheet?.delivery.contactPhone ?? job.delivery_contact_phone ?? 'Phone not supplied'}</span>{sheet?.delivery.notes && <span>Notes: {sheet.delivery.notes}</span>}</div>
                                </div>
                                {(sheet?.publicQuoteNotes || sheet?.executionInstructions) && <div className="driver-diary-note-list">{sheet.publicQuoteNotes && <div className="driver-diary-text-block"><strong>Public quote notes</strong><span>{sheet.publicQuoteNotes}</span></div>}{sheet.executionInstructions && <div className="driver-diary-text-block"><strong>Private execution instructions</strong><span>{sheet.executionInstructions}</span></div>}</div>}
                                {((sheet?.requirements.length ?? 0) > 0 || (sheet?.documentChecklist.length ?? 0) > 0) && <div className="driver-diary-text-block"><strong>Working &amp; paperwork requirements</strong>{sheet?.requirements.map((instruction) => <span key={instruction}>{instruction}</span>)}{sheet?.documentChecklist.length ? <span>Paperwork: {sheet.documentChecklist.join(' · ')}</span> : null}<span>POD: {sheet?.hardCopyPod ?? 'Not supplied'}</span></div>}
                                <div className="driver-diary-text-block"><strong>Booking footer / working instructions</strong><span>{sheet?.unavailable.bookingFooter ?? 'Not available for this historical booking.'}</span></div>
                              </>
                            ))}

                            {detailTab === 'notes' && (orderLoading ? <EmptyState compact title="Loading notes…" /> : noteRows.length ? <div className="driver-diary-note-list">{noteRows.map(([label, value]) => <div key={label} className="driver-diary-text-block"><strong>{label}</strong><span>{value}</span></div>)}</div> : <EmptyState compact title="No notes recorded" />)}
                            {detailTab === 'history' && (historyRows.length ? <div className="driver-diary-history-list">{historyRows.slice(0, 50).map((row) => <div key={row.key} className="driver-diary-history-row"><strong>{row.label}</strong><span>{fmtDate(row.at)}</span><span>{row.detail}</span></div>)}</div> : <EmptyState compact title="No history events recorded" />)}
                            {detailTab === 'documents' && (documents.length ? <div className="driver-diary-document-list">{documents.map((document) => <div key={document.id} className="driver-diary-document-row"><span><strong>{document.file_name ?? document.file_type ?? 'Document'}</strong><small>{document.file_type ?? 'File'} · {fmtDate(document.uploaded_at)}</small></span>{document.file_url && <button type="button" onClick={() => window.open(document.file_url ?? '', '_blank', 'noopener,noreferrer')}>Open</button>}</div>)}</div> : <EmptyState compact title="No documents attached" />)}
                            {detailTab === 'pod' && <div className="driver-detail-grid"><div className="driver-detail-item"><span>POD required</span><strong>{(sheet?.podRequired ?? job.pod_required) ? 'Yes' : 'No'}</strong></div><div className="driver-detail-item"><span>POD status</span><strong>{hasPod ? 'Captured' : 'Pending'}</strong></div><div className="driver-detail-item"><span>Photos</span><strong>{podPhotos.length}</strong></div><div className="driver-detail-item"><span>Generated</span><strong>{job.pod_generated_at ? fmtDate(job.pod_generated_at) : '—'}</strong></div><div className="driver-detail-item"><span>Broker review</span><strong>{human(job.broker_pod_review_status ?? 'Not reviewed')}</strong></div><div className="driver-detail-item driver-diary-detail-action"><span>Execution record</span><ActionButton tone="secondary" onClick={() => router.push(`/driver/jobs/${job.id}`)}>Open POD / job</ActionButton></div></div>}
                            {detailTab === 'invoice' && (orderLoading ? <EmptyState compact title="Loading carrier invoice…" /> : orderError ? <div className="driver-diary-empty-action"><AlertBanner tone="warning">{orderError}</AlertBanner><ActionButton tone="secondary" onClick={() => router.push('/driver/finance')}>Open Finance</ActionButton></div> : invoice ? <div className="driver-detail-grid"><div className="driver-detail-item"><span>Invoice</span><strong>{invoice.number ?? invoice.id?.slice(0, 8).toUpperCase() ?? 'Invoice'}</strong></div><div className="driver-detail-item"><span>Amount</span><strong>{invoice.amount != null ? money(invoice.amount, invoice.currency) : 'Not supplied'}</strong></div><div className="driver-detail-item"><span>Status</span><strong>{human(invoice.status)}</strong></div><div className="driver-detail-item"><span>Payment</span><strong>{human(invoice.paymentStatus)}</strong></div><div className="driver-detail-item"><span>Due</span><strong>{invoice.dueDate ? fmtDate(invoice.dueDate) : '—'}</strong></div>{invoice.id && <div className="driver-detail-item driver-diary-detail-action"><span>Invoice record</span><ActionButton tone="secondary" onClick={() => setInvoicePreview({ id: invoice.id as string, number: invoice.number })}>View invoice (£)</ActionButton></div>}</div> : <div className="driver-diary-empty-action"><EmptyState compact title="No carrier invoice generated for this booking" /><ActionButton tone="secondary" onClick={() => router.push('/driver/finance')}>Open Finance</ActionButton></div>)}
                          </div>

                          {reviews.length > 0 && <div className="driver-diary-feedback-list" aria-label="Booking feedback">{reviews.map((review) => <div key={review.id} className="driver-diary-feedback-row"><strong>{review.rating != null ? `${review.rating}/5` : 'Feedback received'}</strong><span>{review.comment?.trim() || 'No written comment supplied.'}</span><small>{fmtDate(review.created_at)}</small></div>)}</div>}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}

            {visibleFiltered.length > itemsPerPage && <div className="driver-board-summary driver-diary-pagination"><ActionButton tone="secondary" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</ActionButton><span>Page {safePage} / {totalPages}</span><ActionButton tone="secondary" disabled={safePage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next</ActionButton></div>}
          </main>
        </div>

        <DriverInvoicePreviewModal invoiceId={invoicePreview?.id ?? null} invoiceNumber={invoicePreview?.number ?? null} onClose={() => setInvoicePreview(null)} />
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
