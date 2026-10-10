'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import DriverInvoicePreviewModal from '../_components/DriverInvoicePreviewModal';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { classifyWorkspaceJobStage, workspaceJobOperationalLabel } from '../../../lib/jobs/workspaceJobStage';
import { getCanonicalDiaryTabs, matchesCanonicalDiaryBucket, type CanonicalDiaryBucket } from '../../../lib/diary/canonicalDiary';
import { hasCompletePodEvidence } from '../../../lib/jobs/podCompletion';
import { MemberIdentityLink } from '../../components/workspace/MemberProfile';
import { CompanyJobSheetPanel } from '../../components/workspace/CompanyJobSheetPanel';
import { CompanyFeedbackDialog } from '../../components/workspace/CompanyFeedbackDialog';
import { ActionButton, AlertBanner, EmptyState } from '../../components/workspace/WorkspaceUI';
import { canLeaveCompanyFeedback } from '../../../lib/feedback/canonicalFeedback';
import { useVisibleRefresh } from '../../components/workspace/useVisibleRefresh';

type CompanyRelation = { name: string } | Array<{ name: string }> | null;
type TimeWindow = 'any' | '2' | '4' | '8' | '24';
type DateRange = 'any' | 'today' | '7d' | '30d';
type ArchiveFilter = 'all' | 'active' | 'closed';
type HistoryFilter = CanonicalDiaryBucket;
type DetailTab = 'pod' | 'order' | 'notes' | 'history' | 'documents' | 'invoice';
type StatusHistoryEntry = { status?: string | null; timestamp?: string | null; at?: string | null };

type HistoryJob = {
  id: string;
  company_id: string;
  assigned_company_id?: string | null;
  awarded_carrier_company_id?: string | null;
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
  delivery_signature_data: unknown;
  client_signature_name: string | null;
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

type ReviewRow = { id: string; job_id: string | null; reviewer_company_id?: string | null; rating: number | null; comment: string | null; created_at: string | null };
type DocumentRow = { id: string; job_id: string | null; file_name: string | null; file_type: string | null; file_url: string | null; uploaded_at: string | null };
type TrackingEventRow = { id: string; job_id: string | null; event_type: string | null; event_time: string | null; user_name: string | null; notes: string | null; message: string | null };
type DiaryMemberRow = { jobId: string; companyId: string | null; name: string | null };
type SearchFilters = { dateRange: DateRange; pickupWithin: TimeWindow; deliveryWithin: TimeWindow; loadRef: string; memberName: string; archive: ArchiveFilter };

const EMPTY_SEARCH: SearchFilters = { dateRange: 'any', pickupWithin: 'any', deliveryWithin: 'any', loadRef: '', memberName: '', archive: 'all' };

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
  const nowMs = Date.now();
  return timestamp >= nowMs - (range === '7d' ? 7 : 30) * 86400000 && timestamp <= nowMs;
}
function groupByJobId<T extends { job_id: string | null }>(rows: T[]) {
  const grouped: Record<string, T[]> = {};
  for (const row of rows) { if (row.job_id) (grouped[row.job_id] ??= []).push(row); }
  return grouped;
}
function isDerivedExpired(job: HistoryJob) {
  return jobStage(job) === 'expired';
}
function hasRecentFeedback(_job: HistoryJob, reviews: ReviewRow[]) {
  return reviews.length > 0;
}
function isClosedRecord(job: HistoryJob) { const stage = jobStage(job); return stage === 'completed' || stage === 'cancelled' || stage === 'expired'; }
function filterMatches(job: HistoryJob, filter: HistoryFilter, reviews: ReviewRow[], reviewerCompanyId?: string | null) {
  return matchesCanonicalDiaryBucket(job, filter, {
    hasFeedback: hasRecentFeedback(job, reviews),
    feedbackEligible: canLeaveCompanyFeedback(job, reviewerCompanyId),
    hasEvidence: hasCompletePodEvidence(job),
  });
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

export default function JobHistoryPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const driverId = typeof user?.driverId === 'string' ? user.driverId.trim() : '';
  const companyId = typeof user?.companyId === 'string' ? user.companyId.trim() : '';
  const canGenerateInvoices = user?.membershipRole === 'owner' || user?.membershipRole === 'admin';
  const canViewCompanyDiary = canGenerateInvoices && Boolean(companyId);
  const [selectedDiaryScope, setSelectedDiaryScope] = useState<'company' | 'mine'>('company');
  const diaryScope: 'company' | 'mine' = canViewCompanyDiary ? selectedDiaryScope : 'mine';
  const feedbackReviewerCompanyId = canViewCompanyDiary && diaryScope === 'company' ? companyId : null;
  const historyFilters = useMemo(() => getCanonicalDiaryTabs(canViewCompanyDiary ? 'owner_driver' : 'driver'), [canViewCompanyDiary]);
  const [jobs, setJobs] = useState<HistoryJob[]>([]);
  const [reviewsByJob, setReviewsByJob] = useState<Record<string, ReviewRow[]>>({});
  const [documentsByJob, setDocumentsByJob] = useState<Record<string, DocumentRow[]>>({});
  const [eventsByJob, setEventsByJob] = useState<Record<string, TrackingEventRow[]>>({});
  const [orderSheetsByJob, setOrderSheetsByJob] = useState<Record<string, OrderSheet | null>>({});
  const [orderLoadingByJob, setOrderLoadingByJob] = useState<Record<string, boolean>>({});
  const [orderErrorsByJob, setOrderErrorsByJob] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const hasLoadedRef = useRef(false);
  const refreshInFlightRef = useRef(false);
  const [error, setError] = useState('');
  const [detailWarning, setDetailWarning] = useState('');
  const [statusFilter, setStatusFilter] = useState<HistoryFilter>('all');
  const [search, setSearch] = useState<SearchFilters>(EMPTY_SEARCH);
  const [appliedSearch, setAppliedSearch] = useState<SearchFilters>(EMPTY_SEARCH);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [page, setPage] = useState(1);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [detailTabs, setDetailTabs] = useState<Record<string, DetailTab>>({});
  const [invoicePreview, setInvoicePreview] = useState<{ id: string; number: string | null } | null>(null);
  const [invoiceCreatingJobId, setInvoiceCreatingJobId] = useState<string | null>(null);
  const [feedbackJobId, setFeedbackJobId] = useState<string | null>(null);

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
    if (!isSupabaseConfigured || authLoading || refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    const finishLoad = () => {
      refreshInFlightRef.current = false;
      hasLoadedRef.current = true;
      setLoading(false);
    };
    if (!driverId) { finishLoad(); return; }
    if (!hasLoadedRef.current) setLoading(true);
    setError(''); setDetailWarning('');

    const { data: sessionData } = await supabase.auth.getSession();
    let token = sessionData.session?.access_token;
    if (!token) {
      const refreshed = await supabase.auth.refreshSession();
      token = refreshed.data.session?.access_token;
    }

    let resolvedJobs: HistoryJob[] = [];
    let companyReviews: ReviewRow[] | null = null;

    if (diaryScope === 'company' && canViewCompanyDiary) {
      if (!token) {
        setError('Your session has expired. Sign in again.');
        finishLoad();
        return;
      }
      try {
        const response = await fetch('/api/driver/diary/company-snapshot', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const payload = await response.json().catch(() => ({})) as {
          jobs?: Array<Omit<HistoryJob, 'companies'> & { companies: CompanyRelation }>;
          reviews?: ReviewRow[];
          warning?: string;
          error?: string;
        };
        if (!response.ok || !Array.isArray(payload.jobs)) throw new Error(payload.error || 'Company Diary could not be loaded.');
        resolvedJobs = payload.jobs.map((job) => ({ ...job, companies: normalizeCompany(job.companies) }));
        companyReviews = Array.isArray(payload.reviews) ? payload.reviews : [];
        if (payload.warning) setDetailWarning(payload.warning);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Company Diary could not be loaded.');
        if (!hasLoadedRef.current) setJobs([]);
        finishLoad();
        return;
      }
    } else {
      const { data, error: fetchError } = await supabase
        .from('jobs')
        .select('id, company_id, status, current_status, assigned_driver_id, pickup_location, pickup_postcode, delivery_location, delivery_postcode, pickup_datetime, delivery_datetime, collection_window_start, delivery_window_start, deadline_at, vehicle_type, requested_vehicle_label, cargo_type, requested_cargo_label, weight_kg, pallets, length_cm, width_cm, height_cm, cargo_value_gbp, load_details, load_notes, collection_notes, delivery_notes, driver_notes, collection_contact_name, collection_contact_phone, delivery_contact_name, delivery_contact_phone, purchase_order_number, special_requirements, access_restrictions, document_checklist, hard_copy_pod, pod_required, pod_generated, pod_generated_at, pod_photos, delivery_photos, delivery_signature_data, client_signature_name, status_history, feedback_status, broker_pod_review_status, broker_pod_review_note, updated_at, created_at, customer_reference, booking_reference, companies:companies!jobs_company_id_fkey(name)')
        .eq('assigned_driver_id', driverId)
        .order('updated_at', { ascending: false })
        .limit(250);

      if (fetchError) {
        setError('Diary records could not be loaded. Please refresh and try again.');
        if (!hasLoadedRef.current) setJobs([]);
        finishLoad();
        return;
      }

      const normalized = ((data ?? []) as unknown as Array<Omit<HistoryJob, 'companies'> & { companies: CompanyRelation }>).map((job) => ({ ...job, companies: normalizeCompany(job.companies) }));
      resolvedJobs = normalized;
      if (token) {
        try {
          const memberResponse = await fetch('/api/driver/diary/company-names', {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
          });
          const memberPayload = await memberResponse.json().catch(() => ({})) as { members?: DiaryMemberRow[] };
          if (memberResponse.ok && Array.isArray(memberPayload.members)) {
            const memberByJob = new Map(memberPayload.members.map((row) => [row.jobId, row]));
            resolvedJobs = normalized.map((job) => {
              if (job.companies?.name) return job;
              const member = memberByJob.get(job.id);
              return member?.name ? { ...job, companies: { name: member.name } } : job;
            });
          }
        } catch {
          setDetailWarning('Diary member names could not be refreshed. Existing booking data remains available.');
        }
      }
    }

    setJobs(resolvedJobs);
    const jobIds = resolvedJobs.map((job) => job.id);
    if (!jobIds.length) {
      setReviewsByJob({}); setDocumentsByJob({}); setEventsByJob({}); finishLoad(); return;
    }

    const [reviewsRes, documentsRes, eventsRes] = await Promise.all([
      companyReviews !== null
        ? Promise.resolve({ data: companyReviews, error: null })
        : supabase.from('reviews').select('id, job_id, rating, comment, created_at').in('job_id', jobIds).order('created_at', { ascending: false }),
      supabase.from('job_documents').select('id, job_id, file_name, file_type, file_url, uploaded_at').in('job_id', jobIds).order('uploaded_at', { ascending: false }),
      supabase.from('job_tracking_events').select('id, job_id, event_type, event_time, user_name, notes, message').in('job_id', jobIds).order('event_time', { ascending: false }),
    ]);
    const warnings: string[] = [];
    if (reviewsRes.error) warnings.push('feedback'); else setReviewsByJob(groupByJobId((reviewsRes.data ?? []) as ReviewRow[]));
    if (documentsRes.error) warnings.push('documents'); else setDocumentsByJob(groupByJobId((documentsRes.data ?? []) as DocumentRow[]));
    if (eventsRes.error) warnings.push('history'); else setEventsByJob(groupByJobId((eventsRes.data ?? []) as TrackingEventRow[]));
    if (warnings.length) setDetailWarning((current) => current || `Some Diary detail data is temporarily unavailable: ${warnings.join(', ')}.`);
    finishLoad();
  }, [authLoading, canViewCompanyDiary, diaryScope, driverId]);

  const createInvoiceForJob = async (job: HistoryJob) => {
    if (!canGenerateInvoices) {
      setDetailWarning('Company owner or admin access is required to create invoices.');
      return;
    }
    if (!hasCompletePodEvidence(job)) {
      setDetailWarning('Complete POD before creating an invoice. POD is mandatory for every job and must include delivery evidence, recipient name and signature.');
      router.push(`/driver/jobs/${job.id}`);
      return;
    }

    setInvoiceCreatingJobId(job.id);
    setDetailWarning('');
    try {
      const { data } = await supabase.auth.getSession();
      let token = data.session?.access_token;
      if (!token) {
        const refreshed = await supabase.auth.refreshSession();
        token = refreshed.data.session?.access_token;
      }
      if (!token) throw new Error('Your session has expired. Sign in again.');

      const response = await fetch(`/api/driver/finance/jobs/${encodeURIComponent(job.id)}/generate-invoice`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ idempotency_key: crypto.randomUUID() }),
      });
      const payload = await response.json().catch(() => null) as { invoice?: { id?: string }; error?: string } | null;
      if (!response.ok || !payload?.invoice?.id) {
        throw new Error(payload?.error ?? 'Invoice could not be created.');
      }

      router.push(`/driver/finance/invoices/${payload.invoice.id}`);
    } catch (reason) {
      setDetailWarning(reason instanceof Error ? reason.message : 'Invoice could not be created.');
    } finally {
      setInvoiceCreatingJobId(null);
    }
  };

  useEffect(() => { void fetchHistory(); }, [fetchHistory]);
  useVisibleRefresh(fetchHistory, { intervalMs: 10_000, minGapMs: 2_500 });

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
  const visibleFiltered = useMemo(() => searchedJobs.filter((job) => filterMatches(job, statusFilter, reviewsByJob[job.id] ?? [], feedbackReviewerCompanyId)), [feedbackReviewerCompanyId, reviewsByJob, searchedJobs, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(visibleFiltered.length / itemsPerPage));
  const safePage = Math.min(page, totalPages);
  const visibleJobs = visibleFiltered.slice((safePage - 1) * itemsPerPage, safePage * itemsPerPage);
  useEffect(() => { setPage(1); }, [statusFilter, appliedSearch, itemsPerPage]);
  useEffect(() => { if (!historyFilters.some((item) => item.id === statusFilter)) setStatusFilter('all'); }, [historyFilters, statusFilter]);

  const allExpanded = visibleJobs.length > 0 && visibleJobs.every((job) => expandedIds.has(job.id));
  const prefetchOrderSheets = useCallback(async (rows: HistoryJob[]) => {
    const ownRows = rows.filter((job) => job.assigned_driver_id === driverId);
    for (let index = 0; index < ownRows.length; index += 4) {
      await Promise.all(ownRows.slice(index, index + 4).map((job) => fetchOrderSheet(job.id)));
    }
  }, [driverId, fetchOrderSheet]);

  const toggleExpandAll = () => {
    const expanding = !allExpanded;
    setExpandedIds((previous) => { const next = new Set(previous); visibleJobs.forEach((job) => { if (expanding) next.add(job.id); else next.delete(job.id); }); return next; });
    if (expanding) void prefetchOrderSheets(visibleJobs);
  };

  const filterRail = (
    <aside className="left driver-filter-rail diary-filter-rail" aria-label="Diary search filters">
      <div className="left-title">Search Panel</div>
      <div className="diary-filter-body">
        <div className="filter"><span className="label">View</span><select value={diaryScope} disabled={!canViewCompanyDiary} aria-label="Diary source" onChange={(e) => setSelectedDiaryScope(e.target.value as 'company' | 'mine')}><option value="company">All bookings</option><option value="mine">My bookings</option></select></div>
        <div className="filter"><span className="label">Date</span><select value={search.dateRange} onChange={(e) => setSearch((current) => ({ ...current, dateRange: e.target.value as DateRange }))}><option value="any">Anytime</option><option value="today">Today</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option></select></div>
        <div className="filter"><span className="label">Pickup Time Within</span><select value={search.pickupWithin} onChange={(e) => setSearch((current) => ({ ...current, pickupWithin: e.target.value as TimeWindow }))}>{TIME_WINDOWS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
        <div className="filter"><span className="label">Delivery Time Within</span><select value={search.deliveryWithin} onChange={(e) => setSearch((current) => ({ ...current, deliveryWithin: e.target.value as TimeWindow }))}>{TIME_WINDOWS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
        <div className="filter"><span className="label">Load ID / Ref</span><input value={search.loadRef} onChange={(e) => setSearch((current) => ({ ...current, loadRef: e.target.value }))} placeholder="Job, booking or ref" /></div>
        <div className="filter"><span className="label">Member Name / ID</span><input value={search.memberName} onChange={(e) => setSearch((current) => ({ ...current, memberName: e.target.value }))} placeholder="Company name" /></div>
        <div className="filter"><span className="label">Archived</span><select value={search.archive} onChange={(e) => setSearch((current) => ({ ...current, archive: e.target.value as ArchiveFilter }))}><option value="all">All records</option><option value="active">Active register</option><option value="closed">Closed records</option></select></div>
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
        <div className="driver-diary-board diary-pagebody">
          {filterRail}
          <main className="driver-board-main main diary-main">
            <div className="diary-toolbar-single">
            <div className="diary-tabs" role="tablist" aria-label="Diary states">
              {historyFilters.map((item) => <button key={item.id} type="button" role="tab" aria-selected={statusFilter === item.id} data-active={statusFilter === item.id ? 'true' : 'false'} onClick={() => setStatusFilter(item.id)}>{item.label} <span>{searchedJobs.filter((job) => filterMatches(job, item.id, reviewsByJob[job.id] ?? [], feedbackReviewerCompanyId)).length}</span></button>)}
            </div>
            <div className="diary-head diary-head-cx">
              <span>{visibleFiltered.length} booking{visibleFiltered.length === 1 ? '' : 's'} · showing {visibleJobs.length}</span>
              <span className="driver-diary-summary-actions">
                <button type="button" onClick={toggleExpandAll} disabled={!visibleJobs.length}>{allExpanded ? 'Collapse all' : 'Expand all'}</button>
                <label>Per page:<select value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></label>
                <button type="button" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>‹</button>
                <span>{visibleFiltered.length === 0 ? '0' : `${(safePage - 1) * itemsPerPage + 1}-${Math.min(safePage * itemsPerPage, visibleFiltered.length)} of ${visibleFiltered.length}`}</span>
                <button type="button" disabled={safePage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>›</button>
              </span>
            </div>
            </div>

            {loading && jobs.length === 0 ? <div className="driver-load-row"><EmptyState compact title="Loading diary…" /></div> : visibleJobs.length === 0 ? <div className="driver-load-row"><EmptyState compact title="No bookings in this view" description="Adjust the status or search filters." /></div> : (
              <div className="diary-bookings">
                {visibleJobs.map((job) => {
                  const expanded = expandedIds.has(job.id); const reviews = reviewsByJob[job.id] ?? [];
                  const documents = documentsByJob[job.id] ?? []; const trackingEvents = eventsByJob[job.id] ?? []; const detailTab = detailTabs[job.id] ?? 'order';
                  const sheet = orderSheetsByJob[job.id]; const orderLoading = orderLoadingByJob[job.id] === true; const orderError = orderErrorsByJob[job.id] || '';
                  const invoice = sheet?.invoices?.[0] ?? null;
                  const podPhotos = Array.isArray(job.pod_photos) ? job.pod_photos : (Array.isArray(job.delivery_photos) ? job.delivery_photos : []);
                  const hasPod = hasCompletePodEvidence(job); const feedbackReceived = hasRecentFeedback(job, reviews); const expired = isDerivedExpired(job);
                  const canManageFeedback = Boolean(feedbackReviewerCompanyId && canLeaveCompanyFeedback(job, feedbackReviewerCompanyId));
                  const currentStatus = effectiveStatus(job);
                  const isOwnAssignedJob = job.assigned_driver_id === driverId;
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
                  const cargoWeight = sheet?.cargo.weightKg ?? job.weight_kg; const cargoPallets = sheet?.cargo.pallets ?? job.pallets;

                  return (
                    <article key={job.id} className="diary-booking driver-diary-entry" data-state={expired ? 'expired' : currentStatus}>
                      <div className="driver-load-row__top driver-diary-entry__top">
                        <div className="driver-load-cell">
                          <div><span className="driver-cell-label">From: </span><strong className="driver-cell-primary">{formatExecutionAddress(job.pickup_location, job.pickup_postcode)}</strong></div>
                          <div style={{ marginTop: 4 }}><span className="driver-cell-label">To: </span><strong className="driver-cell-primary">{formatExecutionAddress(job.delivery_location, job.delivery_postcode)}</strong></div>
                        </div>
                        <div className="driver-load-cell">
                          <div><span className="driver-cell-label">Pickup: </span><strong className="driver-cell-primary">{fmtDate(job.pickup_datetime ?? job.collection_window_start)}</strong></div>
                          <div style={{ marginTop: 4 }}><span className="driver-cell-label">Deliver: </span><strong className="driver-cell-primary">{fmtDate(job.delivery_datetime ?? job.delivery_window_start)}</strong></div>
                          <div className="driver-cell-secondary" style={{ marginTop: 4 }}>{human(job.requested_vehicle_label ?? job.vehicle_type)}</div>
                        </div>
                        <div className="driver-load-cell driver-diary-status-cell">
                          <strong className="driver-diary-status-band">{expired ? 'Expired' : workspaceJobOperationalLabel(job)}</strong>
                          <span className="driver-cell-secondary">Load ID: {job.id.slice(0, 8).toUpperCase()}</span>
                          <span className="driver-cell-secondary">{job.companies?.name ?? 'Member'}</span>
                        </div>
                      </div>

                      <div className="driver-diary-action-rail" role="toolbar" aria-label={`Booking ${job.id} actions`}>
                        {isOwnAssignedJob && currentStatus === 'delivered' && !hasPod ? (
                          <button
                            type="button"
                            data-operation="primary"
                            onClick={() => router.push(`/driver/jobs/${job.id}`)}
                          >
                            Complete POD
                          </button>
                        ) : null}
                        {isOwnAssignedJob && DETAIL_TABS
                          .filter((detailItem) => detailItem.id !== 'invoice' || Boolean(invoice?.id) || (hasPod && canGenerateInvoices))
                          .map((detailItem) => (
                            <button
                              key={detailItem.id}
                              type="button"
                              data-active={expanded && detailTab === detailItem.id ? 'true' : 'false'}
                              disabled={invoiceCreatingJobId === job.id && detailItem.id === 'invoice'}
                              onClick={() => {
                                if (detailItem.id === 'invoice' && invoice?.id) {
                                  setInvoicePreview({ id: invoice.id, number: invoice.number });
                                  return;
                                }
                                if (detailItem.id === 'invoice' && hasPod) {
                                  void createInvoiceForJob(job);
                                  return;
                                }
                                openDetail(job.id, detailItem.id);
                              }}
                            >
                              {detailItem.id === 'documents' && documents.length > 0
                                ? `${detailItem.label} ${documents.length}`
                                : detailItem.id === 'invoice' && invoice?.id
                                  ? 'View invoice (£)'
                                  : detailItem.id === 'invoice' && hasPod
                                    ? (invoiceCreatingJobId === job.id ? 'Creating Invoice…' : 'Create Invoice')
                                    : detailItem.label}
                            </button>
                          ))}
                        {canManageFeedback && <button type="button" onClick={() => setFeedbackJobId(job.id)}>{feedbackReceived ? 'Edit Feedback' : 'Leave Feedback'}</button>}{feedbackReceived && <button type="button" onClick={() => setExpandedIds((current) => new Set(current).add(job.id))}>View feedback</button>}
                      </div>

                      {expanded && !isOwnAssignedJob && (
                        <div className="driver-row-details driver-diary-details"><CompanyJobSheetPanel jobId={job.id} mode="carrier" /></div>
                      )}

                      {expanded && isOwnAssignedJob && (
                        <div className="driver-row-details driver-diary-details">
                          <div className="driver-diary-detail-panel">
                            {detailTab === 'order' && (orderLoading ? <EmptyState compact title="Loading Order confirmation…" /> : (
                              <>
                                {orderError && <AlertBanner tone="warning">{orderError} Available booking details are still shown below.</AlertBanner>}
                                <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr 1fr', gap: 0, border: '1px solid #d8e0ea', background: '#fff' }}>
                                  <div style={{ padding: 10, borderRight: '1px solid #d8e0ea' }}>
                                    <div style={{ marginBottom: 8 }}><span style={{ color: '#64748b' }}>Booked by: </span><strong><MemberIdentityLink companyId={sheet?.postingCompanyId ?? job.company_id}>{sheet?.bookedBy ?? job.companies?.name ?? 'Member'}</MemberIdentityLink></strong></div>
                                    {sheet?.memberPhone && <div style={{ marginBottom: 6 }}><span style={{ color: '#64748b' }}>Phone: </span>{sheet.memberPhone}</div>}
                                    {sheet?.agreedRate != null && <div><span style={{ color: '#64748b' }}>Agreed rate: </span><strong>{money(sheet.agreedRate, sheet.currency)}</strong></div>}
                                  </div>
                                  <div style={{ padding: 10, borderRight: '1px solid #d8e0ea' }}>
                                    <div><span style={{ color: '#64748b' }}>Vehicle: </span><strong>{allocatedVehicleName || requestedVehicle}</strong></div>
                                    {sheet?.distanceMiles != null && <div style={{ marginTop: 6 }}><span style={{ color: '#64748b' }}>Distance: </span>{sheet.distanceMiles} miles</div>}
                                    {(cargoWeight != null || cargoPallets != null) && <div style={{ marginTop: 6 }}><span style={{ color: '#64748b' }}>Cargo: </span>{[cargoWeight != null ? `${cargoWeight} kg` : null, cargoPallets != null ? `${cargoPallets} pallet(s)` : null].filter(Boolean).join(' · ')}</div>}
                                  </div>
                                  <div style={{ padding: 10 }}>
                                    {sheet?.paymentTerms && <div><span style={{ color: '#64748b' }}>Payment terms: </span><strong>{sheet.paymentTerms}</strong></div>}
                                    <div style={{ marginTop: 6 }}><span style={{ color: '#64748b' }}>POD: </span><strong>Digital</strong>{sheet?.hardCopyPod && <span> · Hard-copy {sheet.hardCopyPod}</span>}</div>
                                    {(sheet?.customerReference || job.customer_reference) && <div style={{ marginTop: 6 }}><span style={{ color: '#64748b' }}>Customer ref: </span>{sheet?.customerReference ?? job.customer_reference}</div>}
                                  </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1px solid #d8e0ea', borderTop: 0, background: '#fff' }}>
                                  <div style={{ padding: 10, borderRight: '1px solid #d8e0ea' }}>
                                    <strong>Pickup</strong>
                                    <div>{formatExecutionAddress(pickupAddress, pickupPostcode)}</div>
                                    <div>{transportSchedule(sheet?.pickup.dateTime ?? job.pickup_datetime ?? job.collection_window_start, sheet?.pickup.slot ?? null)}</div>
                                    {(sheet?.pickup.contactName || job.collection_contact_name || sheet?.pickup.contactPhone || job.collection_contact_phone) && <div style={{ marginTop: 5, color: '#64748b' }}>{[sheet?.pickup.contactName ?? job.collection_contact_name, sheet?.pickup.contactPhone ?? job.collection_contact_phone].filter(Boolean).join(' · ')}</div>}
                                  </div>
                                  <div style={{ padding: 10 }}>
                                    <strong>Delivery</strong>
                                    <div>{formatExecutionAddress(deliveryAddress, deliveryPostcode)}</div>
                                    <div>{transportSchedule(sheet?.delivery.dateTime ?? job.delivery_datetime ?? job.delivery_window_start, sheet?.delivery.slot ?? null)}</div>
                                    {(sheet?.delivery.contactName || job.delivery_contact_name || sheet?.delivery.contactPhone || job.delivery_contact_phone) && <div style={{ marginTop: 5, color: '#64748b' }}>{[sheet?.delivery.contactName ?? job.delivery_contact_name, sheet?.delivery.contactPhone ?? job.delivery_contact_phone].filter(Boolean).join(' · ')}</div>}
                                  </div>
                                </div>

                                {(sheet?.publicQuoteNotes || sheet?.executionInstructions || (sheet?.requirements.length ?? 0) > 0) && (
                                  <div style={{ padding: 10, border: '1px solid #d8e0ea', borderTop: 0, background: '#fff' }}>
                                    <strong>Notes / requirements</strong>
                                    {sheet?.publicQuoteNotes && <div style={{ marginTop: 5 }}>{sheet.publicQuoteNotes}</div>}
                                    {sheet?.executionInstructions && <div style={{ marginTop: 5 }}>{sheet.executionInstructions}</div>}
                                    {sheet?.requirements.map((instruction) => <div key={instruction} style={{ marginTop: 5 }}>• {instruction}</div>)}
                                  </div>
                                )}
                              </>
                            ))}

                            {detailTab === 'notes' && (orderLoading ? <EmptyState compact title="Loading notes…" /> : noteRows.length ? <div className="driver-diary-note-list">{noteRows.map(([label, value]) => <div key={label} className="driver-diary-text-block"><strong>{label}</strong><span>{value}</span></div>)}</div> : <EmptyState compact title="No notes recorded" />)}
                            {detailTab === 'history' && (historyRows.length ? <div className="driver-diary-history-list">{historyRows.slice(0, 50).map((row) => <div key={row.key} className="driver-diary-history-row"><strong>{row.label}</strong><span>{fmtDate(row.at)}</span><span>{row.detail}</span></div>)}</div> : <EmptyState compact title="No history events recorded" />)}
                            {detailTab === 'documents' && (documents.length ? <div className="driver-diary-document-list">{documents.map((document) => <div key={document.id} className="driver-diary-document-row"><span><strong>{document.file_name ?? document.file_type ?? 'Document'}</strong><small>{document.file_type ?? 'File'} · {fmtDate(document.uploaded_at)}</small></span>{document.file_url && <button type="button" onClick={() => window.open(document.file_url ?? '', '_blank', 'noopener,noreferrer')}>Open</button>}</div>)}</div> : <EmptyState compact title="No documents attached" />)}
                            {detailTab === 'pod' && <div className="driver-detail-grid"><div className="driver-detail-item"><span>POD required</span><strong>Yes</strong><small>Mandatory for every XDrive job</small></div><div className="driver-detail-item"><span>POD status</span><strong>{hasPod ? 'Captured' : 'Pending'}</strong></div><div className="driver-detail-item"><span>Photos</span><strong>{podPhotos.length}</strong></div><div className="driver-detail-item"><span>Generated</span><strong>{job.pod_generated_at ? fmtDate(job.pod_generated_at) : '—'}</strong></div><div className="driver-detail-item"><span>Broker review</span><strong>{human(job.broker_pod_review_status ?? 'Not reviewed')}</strong></div><div className="driver-detail-item driver-diary-detail-action"><span>Execution record</span><ActionButton tone="secondary" onClick={() => router.push(`/driver/jobs/${job.id}`)}>Open POD / job</ActionButton></div></div>}
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

          </main>
        </div>

        {feedbackJobId && feedbackReviewerCompanyId ? (() => {
          const job = jobs.find((item) => item.id === feedbackJobId);
          const existing = reviewsByJob[feedbackJobId]?.[0] ?? null;
          if (!job) return null;
          const counterpartyLabel = job.company_id === feedbackReviewerCompanyId ? 'Executing carrier' : (job.companies?.name ?? 'Posting company');
          return <CompanyFeedbackDialog jobId={feedbackJobId} companyId={feedbackReviewerCompanyId} existing={existing ? { rating: existing.rating, comment: existing.comment } : null} counterpartyLabel={counterpartyLabel} onClose={() => setFeedbackJobId(null)} onSaved={fetchHistory} />;
        })() : null}
        <DriverInvoicePreviewModal invoiceId={invoicePreview?.id ?? null} invoiceNumber={invoicePreview?.number ?? null} onClose={() => setInvoicePreview(null)} />
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
