'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../AuthContext';
import { resolveActiveCompanyId } from '../../../lib/activeCompany';
import { classifyWorkspaceJobStage, workspaceJobPresentationStatus } from '../../../lib/jobs/workspaceJobStage';
import { supabase } from '../../../lib/supabaseClient';
import { CompanyJobSheetPanel, type JobSheetTab } from './CompanyJobSheetPanel';
import { useOperationsIntelligence, type OperationsTrackingEvent } from './useOperationsIntelligence';
import {
  ActionButton,
  AlertBanner,
  EmptyState,
  PageFrame,
  PageHeader,
  StatusBadge,
} from './WorkspaceUI';

type DiaryViewMode = 'list' | 'split';
type DiaryTab = 'all' | 'unallocated' | 'allocated' | 'in_progress' | 'completed' | 'cancelled' | 'expired' | 'awaiting_feedback' | 'recent_feedback' | 'evidence';
type JobRow = {
  id: string;
  company_id: string | null;
  assigned_company_id: string | null;
  awarded_carrier_company_id: string | null;
  assigned_driver_id: string | null;
  status: string;
  current_status: string | null;
  pickup_location: string | null;
  pickup_postcode: string | null;
  pickup_datetime: string | null;
  pickup_time_slot: string | null;
  delivery_location: string | null;
  delivery_postcode: string | null;
  delivery_datetime: string | null;
  delivery_time_slot: string | null;
  vehicle_type: string | null;
  requested_vehicle_type: string | null;
  requested_vehicle_label: string | null;
  cargo_type: string | null;
  requested_cargo_label: string | null;
  weight_kg: number | string | null;
  pallets: number | null;
  length_cm: number | string | null;
  width_cm: number | string | null;
  height_cm: number | string | null;
  job_distance_miles: number | string | null;
  distance_miles: number | string | null;
  pod_required: boolean | null;
  hard_copy_pod: string | null;
  special_requirements: string | null;
  access_restrictions: string | null;
  client_name: string | null;
  customer_reference: string | null;
  booking_reference: string | null;
  pod_generated: boolean | null;
  pod_generated_at: string | null;
  delivery_photos: string[] | null;
  updated_at: string | null;
  created_at: string | null;
};

type DriverRow = {
  id: string;
  display_name: string | null;
  email: string | null;
  status: string | null;
  availability_status: string | null;
};

type ReviewRow = {
  id: string;
  job_id: string | null;
  reviewer_company_id: string | null;
  rating: number | null;
  comment: string | null;
  created_at: string | null;
};

type SearchState = {
  scope: 'all' | 'ours' | 'subcontracted';
  from: string;
  to: string;
  reference: string;
  customer: string;
  driver: string;
  bookedBy: string;
  pickupWindow: 'any' | 'morning' | 'afternoon' | 'evening';
  deliveryWindow: 'any' | 'morning' | 'afternoon' | 'evening';
  dateFrom: string;
  dateTo: string;
};

type DiarySavedViewRow = {
  id: string;
  name: string;
  filters: Partial<SearchState> | null;
  updated_at: string | null;
};

type DiaryGroupRow = { id: string; name: string; created_at: string | null; updated_at: string | null };
type DiaryGroupJobRow = { group_id: string; job_id: string };

const EMPTY_SEARCH: SearchState = { scope: 'all', from: '', to: '', reference: '', customer: '', driver: '', bookedBy: '', pickupWindow: 'any', deliveryWindow: 'any', dateFrom: '', dateTo: '' };
const TABS: Array<{ id: DiaryTab; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'unallocated', label: 'Unallocated' },
  { id: 'allocated', label: 'Allocated' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'expired', label: 'Expired' },
  { id: 'awaiting_feedback', label: 'Awaiting Feedback' },
  { id: 'recent_feedback', label: 'Recent Feedback' },
  { id: 'evidence', label: 'POD / Evidence' },
];

const normalise = (value: string | null | undefined) => String(value ?? '').trim().toLowerCase();
const when = (value: string | null | undefined) => value
  ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  : 'Not set';
const timeWindowMatches = (value: string | null | undefined, window: SearchState['pickupWindow']) => {
  if (window === 'any') return true;
  if (!value) return false;
  const hour = new Date(value).getHours();
  if (Number.isNaN(hour)) return false;
  if (window === 'morning') return hour < 12;
  if (window === 'afternoon') return hour >= 12 && hour < 17;
  return hour >= 17;
};
const numberLabel = (value: number | string | null | undefined, suffix: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toLocaleString('en-GB') + suffix : null;
};
const dimensionsLabel = (job: JobRow) => {
  const values = [job.length_cm, job.width_cm, job.height_cm].map((value) => Number(value));
  return values.every((value) => Number.isFinite(value)) ? values.map((value) => value.toLocaleString('en-GB')).join(' × ') + ' cm' : null;
};
const moneyLabel = (value: number | null | undefined, currency = 'GBP') => {
  if (value == null || !Number.isFinite(value)) return null;
  try { return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value); }
  catch { return `£${value.toFixed(2)}`; }
};
const MILESTONE_LABELS: Record<string, string> = {
  on_my_way_to_pickup: 'On my way to pickup',
  on_site_pickup: 'On site pickup',
  loaded: 'Loaded',
  on_my_way_to_delivery: 'On my way to delivery',
  on_site_delivery: 'On site delivery',
  delivered: 'Delivered',
};
const diaryMilestones = (events: OperationsTrackingEvent[]) => events
  .filter((event) => Boolean(MILESTONE_LABELS[event.eventType]))
  .filter((event, index, list) => list.findIndex((candidate) => candidate.eventType === event.eventType) === index)
  .slice(0, 6);

// Client-side account-state filter only. Full driver + canonical vehicle
// operational eligibility is revalidated by the authorised allocation endpoint.
const isActiveDriverAccount = (driver: DriverRow) => normalise(driver.status) === 'active';

function effectiveStatus(job: JobRow) {
  return workspaceJobPresentationStatus(job);
}

function isOperatingCompanyJob(job: JobRow, companyId: string) {
  if (job.awarded_carrier_company_id) return job.awarded_carrier_company_id === companyId;
  if (job.assigned_company_id) return job.assigned_company_id === companyId;
  if (job.company_id !== companyId) return false;
  const stage = classifyWorkspaceJobStage(job);
  // A company can execute its own transport when no separate carrier is
  // awarded, but draft/posted/quoted customer-marketplace records are not an
  // operational Diary merely because company_id matches.
  return Boolean(job.assigned_driver_id) || !['open', 'draft'].includes(stage);
}

function hasRecentFeedback(reviews: ReviewRow[]) {
  return reviews.length > 0;
}

function isAwaitingFeedback(job: JobRow, reviews: ReviewRow[]) {
  return classifyWorkspaceJobStage(job) === 'completed' && !hasRecentFeedback(reviews);
}

function matchesTab(job: JobRow, tab: DiaryTab, reviews: ReviewRow[] = []) {
  if (tab === 'all') return true;
  const stage = classifyWorkspaceJobStage(job);
  if (tab === 'unallocated') return (stage === 'awarded' || stage === 'allocated') && !job.assigned_driver_id;
  if (tab === 'allocated') return (stage === 'awarded' || stage === 'allocated') && Boolean(job.assigned_driver_id);
  if (tab === 'in_progress') return stage === 'in_progress';
  if (tab === 'completed') return stage === 'completed';
  if (tab === 'cancelled') return stage === 'cancelled' || stage === 'disputed';
  if (tab === 'expired') return stage === 'expired';
  if (tab === 'awaiting_feedback') return isAwaitingFeedback(job, reviews);
  if (tab === 'recent_feedback') return hasRecentFeedback(reviews);
  return stage === 'completed' && (job.pod_generated === true || (job.delivery_photos?.length ?? 0) > 0);
}

function stageTone(job: JobRow): 'green' | 'blue' | 'orange' | 'red' | 'grey' | 'purple' {
  const stage = classifyWorkspaceJobStage(job);
  if (stage === 'completed') return 'green';
  if (stage === 'in_progress') return 'orange';
  if (stage === 'awarded' || stage === 'allocated') return 'blue';
  if (stage === 'disputed') return 'purple';
  if (stage === 'cancelled' || stage === 'expired') return 'red';
  return 'grey';
}

export default function OperationsDiaryPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const companyId = resolveActiveCompanyId(user);
  const intelligence = useOperationsIntelligence(companyId);
  const deepJob = searchParams.get('job');
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [reviewsByJob, setReviewsByJob] = useState<Record<string, ReviewRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<DiaryTab>('all');
  const [viewMode, setViewMode] = useState<DiaryViewMode>('list');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(deepJob);
  const [search, setSearch] = useState<SearchState>(EMPTY_SEARCH);
  const [appliedSearch, setAppliedSearch] = useState<SearchState>(EMPTY_SEARCH);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set(deepJob ? [deepJob] : []));
  const [assigning, setAssigning] = useState<string | null>(null);
  const [managingJobId, setManagingJobId] = useState<string | null>(null);
  const [driverSelections, setDriverSelections] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [detailTabByJob, setDetailTabByJob] = useState<Record<string, JobSheetTab>>({});
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [feedbackJobId, setFeedbackJobId] = useState<string | null>(null);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [savedViews, setSavedViews] = useState<DiarySavedViewRow[]>([]);
  const [selectedSavedViewId, setSelectedSavedViewId] = useState('');
  const [savedViewName, setSavedViewName] = useState('');
  const [groups, setGroups] = useState<DiaryGroupRow[]>([]);
  const [groupJobs, setGroupJobs] = useState<DiaryGroupJobRow[]>([]);
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('');
  const [groupManagerOpen, setGroupManagerOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [groupNameDrafts, setGroupNameDrafts] = useState<Record<string, string>>({});
  const [groupWorking, setGroupWorking] = useState(false);
  const canManageCompanyBookings = Boolean(user?.membershipRole && ['owner', 'admin', 'dispatcher'].includes(user.membershipRole));
  const canLeaveCompanyFeedback = canManageCompanyBookings;

  const load = useCallback(async () => {
    if (!companyId || !user?.id) { setJobs([]); setDrivers([]); setReviewsByJob({}); setSavedViews([]); setGroups([]); setGroupJobs([]); setLoading(false); return; }
    setLoading(true); setError('');
    const [jobsResult, driversResult, reviewsResult, savedViewsResult, groupsResult, groupJobsResult] = await Promise.all([
      supabase
        .from('jobs')
        .select('id, company_id, assigned_company_id, awarded_carrier_company_id, assigned_driver_id, status, current_status, pickup_location, pickup_postcode, pickup_datetime, pickup_time_slot, delivery_location, delivery_postcode, delivery_datetime, delivery_time_slot, vehicle_type, requested_vehicle_type, requested_vehicle_label, cargo_type, requested_cargo_label, weight_kg, pallets, length_cm, width_cm, height_cm, job_distance_miles, distance_miles, pod_required, hard_copy_pod, special_requirements, access_restrictions, client_name, customer_reference, booking_reference, pod_generated, pod_generated_at, delivery_photos, updated_at, created_at')
        .or(`company_id.eq.${companyId},assigned_company_id.eq.${companyId},awarded_carrier_company_id.eq.${companyId}`)
        .order('pickup_datetime', { ascending: true })
        .limit(300),
      supabase
        .from('drivers')
        .select('id, display_name, email, status, availability_status')
        .eq('company_id', companyId)
        .order('display_name', { ascending: true }),
      supabase
        .from('reviews')
        .select('id, job_id, reviewer_company_id, rating, comment, created_at')
        .eq('reviewer_company_id', companyId)
        .order('created_at', { ascending: false }),
      supabase
        .from('diary_saved_views')
        .select('id, name, filters, updated_at')
        .eq('company_id', companyId)
        .eq('user_id', user.id)
        .order('name', { ascending: true }),
      supabase
        .from('diary_groups')
        .select('id, name, created_at, updated_at')
        .eq('company_id', companyId)
        .order('name', { ascending: true }),
      supabase
        .from('diary_group_jobs')
        .select('group_id, job_id')
        .eq('company_id', companyId),
    ]);

    if (jobsResult.error) {
      setError('Diary jobs could not be loaded.');
      setJobs([]);
    } else {
      const scoped = ((jobsResult.data ?? []) as JobRow[]).filter((job) => isOperatingCompanyJob(job, companyId));
      setJobs(scoped);
    }
    if (driversResult.error) {
      setError((current) => current || 'Driver roster could not be loaded.');
      setDrivers([]);
    } else {
      setDrivers((driversResult.data ?? []) as DriverRow[]);
    }
    if (reviewsResult.error) {
      setReviewsByJob({});
      setNotice('Feedback records are temporarily unavailable. Core Diary operations remain available.');
    } else {
      const grouped: Record<string, ReviewRow[]> = {};
      for (const review of (reviewsResult.data ?? []) as ReviewRow[]) {
        if (!review.job_id) continue;
        (grouped[review.job_id] ??= []).push(review);
      }
      setReviewsByJob(grouped);
    }
    if (savedViewsResult.error) {
      setSavedViews([]);
      setNotice((current) => current || 'Saved Diary views are temporarily unavailable. Core Diary operations remain available.');
    } else {
      setSavedViews((savedViewsResult.data ?? []) as DiarySavedViewRow[]);
    }
    if (groupsResult.error || groupJobsResult.error) {
      setGroups([]);
      setGroupJobs([]);
      setNotice((current) => current || 'Diary groups are temporarily unavailable. Core Diary operations remain available.');
    } else {
      setGroups((groupsResult.data ?? []) as DiaryGroupRow[]);
      setGroupJobs((groupJobsResult.data ?? []) as DiaryGroupJobRow[]);
      setGroupNameDrafts(Object.fromEntries(((groupsResult.data ?? []) as DiaryGroupRow[]).map((group) => [group.id, group.name])));
    }
    setLoading(false);
  }, [companyId, user?.id]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!deepJob) return;
    setExpandedIds((current) => {
      const next = new Set(current);
      next.add(deepJob);
      return next;
    });
    setSelectedJobId(deepJob);
  }, [deepJob]);

  const activeAccountDrivers = useMemo(() => drivers.filter(isActiveDriverAccount), [drivers]);
  const driverById = useMemo(() => new Map(drivers.map((driver) => [driver.id, driver])), [drivers]);
  const groupIdsByJob = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const membership of groupJobs) {
      const list = map.get(membership.job_id) ?? [];
      list.push(membership.group_id);
      map.set(membership.job_id, list);
    }
    return map;
  }, [groupJobs]);
  const groupById = useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups]);

  const filtered = useMemo(() => {
    const from = appliedSearch.from.trim().toLowerCase();
    const to = appliedSearch.to.trim().toLowerCase();
    const reference = appliedSearch.reference.trim().toLowerCase();
    const customer = appliedSearch.customer.trim().toLowerCase();
    const memberDriver = appliedSearch.driver.trim().toLowerCase();
    const bookedBy = appliedSearch.bookedBy.trim().toLowerCase();
    const fromDate = appliedSearch.dateFrom ? new Date(`${appliedSearch.dateFrom}T00:00:00`).getTime() : null;
    const toDate = appliedSearch.dateTo ? new Date(`${appliedSearch.dateTo}T23:59:59`).getTime() : null;

    return jobs
      .filter((job) => matchesTab(job, tab, reviewsByJob[job.id] ?? []))
      .filter((job) => !selectedGroupFilter || (groupIdsByJob.get(job.id) ?? []).includes(selectedGroupFilter))
      .filter((job) => appliedSearch.scope === 'all' || (appliedSearch.scope === 'ours' ? job.company_id === companyId : job.company_id !== companyId))
      .filter((job) => !from || `${job.pickup_location ?? ''} ${job.pickup_postcode ?? ''}`.toLowerCase().includes(from))
      .filter((job) => !to || `${job.delivery_location ?? ''} ${job.delivery_postcode ?? ''}`.toLowerCase().includes(to))
      .filter((job) => !reference || `${job.id} ${job.customer_reference ?? ''} ${job.booking_reference ?? ''}`.toLowerCase().includes(reference))
      .filter((job) => !customer || String(job.client_name ?? '').toLowerCase().includes(customer))
      .filter((job) => {
        if (!memberDriver) return true;
        const detail = intelligence.jobDetailById.get(job.id);
        const driver = job.assigned_driver_id ? driverById.get(job.assigned_driver_id) : undefined;
        return [
          job.assigned_driver_id,
          driver?.display_name,
          driver?.email,
          detail?.ownerCompanyName,
          detail?.awardedCompanyName,
          detail?.executionCompanyName,
        ].filter(Boolean).join(' ').toLowerCase().includes(memberDriver);
      })
      .filter((job) => {
        if (!bookedBy) return true;
        const detail = intelligence.jobDetailById.get(job.id);
        return [detail?.createdByUserId, detail?.createdByName, detail?.createdByEmail]
          .filter(Boolean).join(' ').toLowerCase().includes(bookedBy);
      })
      .filter((job) => timeWindowMatches(job.pickup_datetime, appliedSearch.pickupWindow))
      .filter((job) => timeWindowMatches(job.delivery_datetime, appliedSearch.deliveryWindow))
      .filter((job) => {
        if (!fromDate && !toDate) return true;
        if (!job.pickup_datetime) return false;
        const timestamp = new Date(job.pickup_datetime).getTime();
        if (Number.isNaN(timestamp)) return false;
        if (fromDate && timestamp < fromDate) return false;
        if (toDate && timestamp > toDate) return false;
        return true;
      });
  }, [appliedSearch, companyId, driverById, groupIdsByJob, intelligence.jobDetailById, jobs, reviewsByJob, selectedGroupFilter, tab]);

  const counts = useMemo(() => Object.fromEntries(TABS.map((item) => [item.id, jobs.filter((job) => matchesTab(job, item.id, reviewsByJob[job.id] ?? [])).length])) as Record<DiaryTab, number>, [jobs, reviewsByJob]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const allVisibleExpanded = visible.length > 0 && visible.every((job) => expandedIds.has(job.id));
  useEffect(() => { setPage(1); }, [tab, appliedSearch, pageSize, selectedGroupFilter]);
  useEffect(() => {
    if (viewMode !== 'split') return;
    if (selectedJobId && visible.some((job) => job.id === selectedJobId)) return;
    setSelectedJobId(visible[0]?.id ?? null);
  }, [selectedJobId, viewMode, visible]);

  const toggleExpandAll = () => {
    const shouldExpand = !allVisibleExpanded;
    setExpandedIds((current) => {
      const next = new Set(current);
      for (const job of visible) {
        if (shouldExpand) next.add(job.id);
        else next.delete(job.id);
      }
      return next;
    });
  };

  const toggleJob = (jobId: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  const openJobTab = (jobId: string, tabId: JobSheetTab) => {
    setDetailTabByJob((current) => ({ ...current, [jobId]: tabId }));
    setSelectedJobId(jobId);
    setExpandedIds((current) => {
      const next = new Set(current);
      next.add(jobId);
      return next;
    });
  };

  const assignDriver = async (job: JobRow) => {
    const driverId = driverSelections[job.id];
    if (!driverId) { setError('Choose an active driver account before allocation. Full operational eligibility is verified by the server.'); return; }
    setAssigning(job.id); setError(''); setNotice('');
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error('Session expired.');
      const response = await fetch(`/api/admin/jobs/${encodeURIComponent(job.id)}/assign-driver`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId, expectedDriverId: job.assigned_driver_id ?? null }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Driver allocation failed.');
      setNotice('Driver allocated successfully.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Driver allocation failed.');
    } finally { setAssigning(null); }
  };

  const cancelJob = async (job: JobRow) => {
    if (!companyId || job.company_id !== companyId) {
      setError('Only the load-owning company can cancel this booking.');
      return;
    }
    const reason = window.prompt('Cancellation reason (optional; minimum 5 characters if supplied):', '')?.trim();
    if (reason === undefined) return;
    if (reason.length > 0 && reason.length < 5) {
      setError('Cancellation reason must be at least 5 characters when supplied.');
      return;
    }
    if (!window.confirm('Confirm cancellation for this booking? Awarded or assigned work may create a cancellation request instead of cancelling immediately.')) return;

    setManagingJobId(job.id);
    setError('');
    setNotice('');
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error('Session expired.');
      const response = await fetch(`/api/admin/jobs/${encodeURIComponent(job.id)}/manage`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', companyId, ...(reason ? { reason } : {}) }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string; cancellationRequested?: boolean };
      if (!response.ok) throw new Error(payload.error || 'Booking cancellation failed.');
      setNotice(payload.cancellationRequested ? 'Cancellation request submitted for the awarded / assigned booking.' : 'Booking cancelled successfully.');
      await load();
    } catch (reasonValue) {
      setError(reasonValue instanceof Error ? reasonValue.message : 'Booking cancellation failed.');
    } finally {
      setManagingJobId(null);
    }
  };

  const openFeedback = (job: JobRow) => {
    const existing = reviewsByJob[job.id]?.[0];
    setFeedbackJobId(job.id);
    setFeedbackRating(existing?.rating ?? 5);
    setFeedbackComment(existing?.comment ?? '');
    setError('');
  };

  const saveFeedback = async () => {
    if (!feedbackJobId || !companyId) return;
    setFeedbackSaving(true);
    setError('');
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
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Company feedback could not be saved.');
    } finally {
      setFeedbackSaving(false);
    }
  };

  const applySavedView = (viewId: string) => {
    setSelectedSavedViewId(viewId);
    if (!viewId) return;
    const view = savedViews.find((item) => item.id === viewId);
    if (!view) return;
    const restored = { ...EMPTY_SEARCH, ...(view.filters ?? {}) } as SearchState;
    setSearch(restored);
    setAppliedSearch(restored);
    setNotice(`Saved view “${view.name}” applied.`);
  };

  const saveNamedView = async () => {
    if (!companyId || !user?.id) return;
    const name = savedViewName.trim();
    if (!name) {
      setError('Enter a name for the saved Diary view.');
      return;
    }
    setError('');
    const now = new Date().toISOString();
    const { data, error: saveError } = await supabase
      .from('diary_saved_views')
      .upsert({ company_id: companyId, user_id: user.id, name, filters: search, updated_at: now }, { onConflict: 'company_id,user_id,name' })
      .select('id, name, filters, updated_at')
      .single();
    if (saveError || !data) {
      setError('Saved Diary view could not be stored.');
      return;
    }
    const saved = data as DiarySavedViewRow;
    setSavedViews((current) => [...current.filter((item) => item.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name)));
    setSelectedSavedViewId(saved.id);
    setSavedViewName('');
    setNotice(`Saved view “${saved.name}” stored for your account.`);
  };

  const deleteSavedView = async () => {
    if (!selectedSavedViewId || !companyId || !user?.id) return;
    const selected = savedViews.find((item) => item.id === selectedSavedViewId);
    if (!selected || !window.confirm(`Delete saved view “${selected.name}”?`)) return;
    const { error: deleteError } = await supabase
      .from('diary_saved_views')
      .delete()
      .eq('id', selectedSavedViewId)
      .eq('company_id', companyId)
      .eq('user_id', user.id);
    if (deleteError) {
      setError('Saved Diary view could not be deleted.');
      return;
    }
    setSavedViews((current) => current.filter((item) => item.id !== selectedSavedViewId));
    setSelectedSavedViewId('');
    setNotice(`Saved view “${selected.name}” deleted.`);
  };

  const createDiaryGroup = async () => {
    if (!companyId || !user?.id || !canManageCompanyBookings) return;
    const name = newGroupName.trim();
    if (!name) { setError('Enter a group name.'); return; }
    setGroupWorking(true); setError('');
    const { data, error: createError } = await supabase
      .from('diary_groups')
      .insert({ company_id: companyId, name, created_by: user.id })
      .select('id, name, created_at, updated_at')
      .single();
    setGroupWorking(false);
    if (createError || !data) {
      setError(createError?.code === '23505' ? 'A Diary group with this name already exists.' : 'Diary group could not be created.');
      return;
    }
    const group = data as DiaryGroupRow;
    setGroups((current) => [...current, group].sort((a, b) => a.name.localeCompare(b.name)));
    setGroupNameDrafts((current) => ({ ...current, [group.id]: group.name }));
    setNewGroupName('');
    setNotice(`Diary group “${group.name}” created.`);
  };

  const renameDiaryGroup = async (groupId: string) => {
    if (!companyId || !canManageCompanyBookings) return;
    const name = (groupNameDrafts[groupId] ?? '').trim();
    if (!name) { setError('Group name cannot be empty.'); return; }
    setGroupWorking(true); setError('');
    const { data, error: renameError } = await supabase
      .from('diary_groups')
      .update({ name, updated_at: new Date().toISOString() })
      .eq('id', groupId).eq('company_id', companyId)
      .select('id, name, created_at, updated_at').single();
    setGroupWorking(false);
    if (renameError || !data) {
      setError(renameError?.code === '23505' ? 'A Diary group with this name already exists.' : 'Diary group could not be renamed.');
      return;
    }
    const updated = data as DiaryGroupRow;
    setGroups((current) => current.map((group) => group.id === groupId ? updated : group).sort((a, b) => a.name.localeCompare(b.name)));
    setNotice(`Diary group renamed to “${updated.name}”.`);
  };

  const deleteDiaryGroup = async (groupId: string) => {
    if (!companyId || !canManageCompanyBookings) return;
    const group = groups.find((item) => item.id === groupId);
    if (!group || !window.confirm(`Delete Diary group “${group.name}”? Bookings will not be deleted.`)) return;
    setGroupWorking(true); setError('');
    const { error: deleteError } = await supabase.from('diary_groups').delete().eq('id', groupId).eq('company_id', companyId);
    setGroupWorking(false);
    if (deleteError) { setError('Diary group could not be deleted.'); return; }
    setGroups((current) => current.filter((item) => item.id !== groupId));
    setGroupJobs((current) => current.filter((item) => item.group_id !== groupId));
    setGroupNameDrafts((current) => { const next = { ...current }; delete next[groupId]; return next; });
    if (selectedGroupFilter === groupId) setSelectedGroupFilter('');
    setNotice(`Diary group “${group.name}” deleted.`);
  };

  const addJobToGroup = async (jobId: string, groupId: string) => {
    if (!groupId || !companyId || !user?.id || !canManageCompanyBookings) return;
    const { error: addError } = await supabase.from('diary_group_jobs').upsert(
      { group_id: groupId, job_id: jobId, company_id: companyId, added_by: user.id },
      { onConflict: 'group_id,job_id', ignoreDuplicates: true },
    );
    if (addError) { setError('Booking could not be added to this Diary group.'); return; }
    setGroupJobs((current) => current.some((item) => item.group_id === groupId && item.job_id === jobId) ? current : [...current, { group_id: groupId, job_id: jobId }]);
    setNotice('Booking added to Diary group.');
  };

  const removeJobFromGroup = async (jobId: string, groupId: string) => {
    if (!companyId || !canManageCompanyBookings) return;
    const { error: removeError } = await supabase.from('diary_group_jobs').delete()
      .eq('group_id', groupId).eq('job_id', jobId).eq('company_id', companyId);
    if (removeError) { setError('Booking could not be removed from this Diary group.'); return; }
    setGroupJobs((current) => current.filter((item) => !(item.group_id === groupId && item.job_id === jobId)));
    setNotice('Booking removed from Diary group.');
  };

  const applySearch = () => {
    setAppliedSearch(search);
    if (saveAsDefault) window.localStorage.setItem('xdrive:operations-diary:default-search', JSON.stringify(search));
  };
  const clearSearch = () => { setSearch(EMPTY_SEARCH); setAppliedSearch(EMPTY_SEARCH); };
  const toggleDefaultSearch = (checked: boolean) => {
    setSaveAsDefault(checked);
    if (checked) window.localStorage.setItem('xdrive:operations-diary:default-search', JSON.stringify(search));
    else window.localStorage.removeItem('xdrive:operations-diary:default-search');
  };

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Operations"
        title="Diary"
        description="Post-award bookings, allocation, evidence and authorised job records in one operating register."
        actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/finance/reports')}>Payment Report</ActionButton>}
      />
      {error && <AlertBanner tone="danger">{error}</AlertBanner>}
      {notice && <AlertBanner tone="success">{notice}</AlertBanner>}

      <div className="workspace-board-layout">
        <aside className="workspace-filter-rail" aria-label="Diary search filters">
          <div className="workspace-filter-rail__header">Search Panel</div>
          <div className="workspace-filter-rail__body">
            <label>SAVED VIEWS<select value={selectedSavedViewId} onChange={(event) => applySavedView(event.target.value)}><option value="">Select saved view</option>{savedViews.map((view) => <option key={view.id} value={view.id}>{view.name}</option>)}</select></label>
            <label>SAVE CURRENT VIEW<input value={savedViewName} onChange={(event) => setSavedViewName(event.target.value.slice(0, 80))} placeholder="e.g. Tomorrow unallocated" /></label>
            <div className="workspace-filter-actions"><ActionButton tone="secondary" onClick={() => void saveNamedView()}>Save View</ActionButton><ActionButton tone="secondary" disabled={!selectedSavedViewId} onClick={() => void deleteSavedView()}>Delete</ActionButton></div>
            <label>GROUPS<select value={selectedGroupFilter} onChange={(event) => setSelectedGroupFilter(event.target.value)}><option value="">All groups</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
            {canManageCompanyBookings && <ActionButton tone="secondary" onClick={() => setGroupManagerOpen(true)}>Add / Edit Groups</ActionButton>}
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}><legend style={{ fontSize: 11, fontWeight: 800, color: '#334155', marginBottom: 4 }}>BOOKING SCOPE</legend><label style={{ display: 'flex', flexDirection: 'row', gap: 6, alignItems: 'center' }}><input type="radio" name="diary-booking-scope" value="all" checked={search.scope === 'all'} onChange={() => setSearch((current) => ({ ...current, scope: 'all' }))} /> All</label><label style={{ display: 'flex', flexDirection: 'row', gap: 6, alignItems: 'center' }}><input type="radio" name="diary-booking-scope" value="subcontracted" checked={search.scope === 'subcontracted'} onChange={() => setSearch((current) => ({ ...current, scope: 'subcontracted' }))} /> Jobs Sub-contracted</label><label style={{ display: 'flex', flexDirection: 'row', gap: 6, alignItems: 'center' }}><input type="radio" name="diary-booking-scope" value="ours" checked={search.scope === 'ours'} onChange={() => setSearch((current) => ({ ...current, scope: 'ours' }))} /> Our Bookings</label></fieldset>
            <label>FROM<input value={search.from} onChange={(event) => setSearch((current) => ({ ...current, from: event.target.value }))} placeholder="Pickup town / postcode" /></label>
            <label>TO<input value={search.to} onChange={(event) => setSearch((current) => ({ ...current, to: event.target.value }))} placeholder="Delivery town / postcode" /></label>
            <label>PICKUP TIME WITHIN<select value={search.pickupWindow} onChange={(event) => setSearch((current) => ({ ...current, pickupWindow: event.target.value as SearchState['pickupWindow'] }))}><option value="any">Any</option><option value="morning">Morning</option><option value="afternoon">Afternoon</option><option value="evening">Evening</option></select></label>
            <label>DELIVERY TIME WITHIN<select value={search.deliveryWindow} onChange={(event) => setSearch((current) => ({ ...current, deliveryWindow: event.target.value as SearchState['deliveryWindow'] }))}><option value="any">Any</option><option value="morning">Morning</option><option value="afternoon">Afternoon</option><option value="evening">Evening</option></select></label>
            <label>LOAD ID / REF<input value={search.reference} onChange={(event) => setSearch((current) => ({ ...current, reference: event.target.value }))} placeholder="Job, customer or booking ref" /></label>
            <label>CUSTOMER NAME<input value={search.customer} onChange={(event) => setSearch((current) => ({ ...current, customer: event.target.value }))} placeholder="Customer name" /></label>
            <label>MEMBER / DRIVER<input value={search.driver} onChange={(event) => setSearch((current) => ({ ...current, driver: event.target.value }))} placeholder="Member, driver or ID" /></label>
            <label>BOOKED BY<input value={search.bookedBy} onChange={(event) => setSearch((current) => ({ ...current, bookedBy: event.target.value }))} placeholder="Name, email or user ID" /></label>
            <label>DATE FROM<input type="date" value={search.dateFrom} onChange={(event) => setSearch((current) => ({ ...current, dateFrom: event.target.value }))} /></label>
            <label>DATE TO<input type="date" value={search.dateTo} onChange={(event) => setSearch((current) => ({ ...current, dateTo: event.target.value }))} /></label>
            <label style={{ display: 'flex', flexDirection: 'row', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={saveAsDefault} onChange={(event) => toggleDefaultSearch(event.target.checked)} /> Save as Default</label>
            <div className="workspace-filter-actions"><ActionButton tone="success" onClick={applySearch}>Search</ActionButton><ActionButton tone="secondary" onClick={clearSearch}>Clear</ActionButton></div>
          </div>
        </aside>

        <main className="workspace-board-main" style={{ minWidth: 0 }}>
          <div className="workspace-record-meta" style={{ justifyContent: 'space-between', minHeight: 34, marginBottom: 4 }}>
            <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <strong>Diary</strong>
              <span role="group" aria-label="Diary view mode" style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                <label style={{ display: 'inline-flex', gap: 4, alignItems: 'center', cursor: 'pointer' }}><input type="radio" name="diary-view-mode" checked={viewMode === 'list'} onChange={() => setViewMode('list')} /> List View</label>
                <label style={{ display: 'inline-flex', gap: 4, alignItems: 'center', cursor: 'pointer' }}><input type="radio" name="diary-view-mode" checked={viewMode === 'split'} onChange={() => setViewMode('split')} /> Split View</label>
              </span>
            </span>
            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={toggleExpandAll}
                disabled={!visible.length}
                aria-label={allVisibleExpanded ? 'Collapse all visible Diary records' : 'Expand all visible Diary records'}
                style={{ minHeight: 26, border: '1px solid var(--ws-border)', borderRadius: 4, background: '#fff', color: '#0B2F6B', padding: '0 9px', fontSize: 11, fontWeight: 700, cursor: visible.length ? 'pointer' : 'not-allowed' }}
              >
                {allVisibleExpanded ? 'Collapse all' : 'Expand all'}
              </button>
              <ActionButton tone="secondary" disabled={loading} onClick={() => void load()}>{loading ? 'Refreshing…' : 'Refresh'}</ActionButton>
            </span>
          </div>
          <div className="workspace-tab-strip" role="tablist" aria-label="Diary states" style={{ display: 'flex', overflowX: 'auto', marginBottom: 4 }}>
            {TABS.map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} data-active={tab === item.id ? 'true' : 'false'} onClick={() => setTab(item.id)}>{item.label} <span>{counts[item.id]}</span></button>)}
          </div>
          <div className="workspace-record-meta" style={{ justifyContent: 'space-between', minHeight: 32 }}>
            <span>{filtered.length} matching booking{filtered.length === 1 ? '' : 's'} · {visible.length} shown</span>
            <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>Items per Page <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} style={{ height: 26 }}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></label>
              <button type="button" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} aria-label="Previous Diary page" style={viewModeButtonStyle(false)}>‹</button>
              <span>{filtered.length === 0 ? '0' : `${(safePage - 1) * pageSize + 1}-${Math.min(safePage * pageSize, filtered.length)}`} of {filtered.length}</span>
              <button type="button" disabled={safePage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} aria-label="Next Diary page" style={viewModeButtonStyle(false)}>›</button>
            </span>
          </div>

          {loading ? (
            <div className="workspace-panel"><EmptyState compact title="Loading Diary…" /></div>
          ) : visible.length === 0 ? (
            <div className="workspace-panel"><EmptyState compact title="No bookings in this view" description="Adjust the status or search filters." /></div>
          ) : viewMode === 'split' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(360px,0.82fr) minmax(520px,1.18fr)', gap: 8, alignItems: 'start' }}>
              <div className="workspace-record-list" aria-label="Diary split booking list">
                {visible.map((job) => {
                  const stage = classifyWorkspaceJobStage(job);
                  const status = effectiveStatus(job);
                  const driver = job.assigned_driver_id ? driverById.get(job.assigned_driver_id) : undefined;
                  const selected = selectedJobId === job.id;
                  return (
                    <article key={job.id} className="workspace-operational-row" data-state={status} style={{ outline: selected ? '2px solid #1d57d8' : 'none', outlineOffset: selected ? -2 : 0 }}>
                      <button type="button" onClick={() => setSelectedJobId(job.id)} aria-pressed={selected} style={{ width: '100%', border: 0, background: 'transparent', padding: 8, textAlign: 'left', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                          <span style={{ minWidth: 0 }}>
                            <strong style={{ display: 'block', fontSize: 12 }}>{job.pickup_postcode ?? job.pickup_location ?? 'Collection'} → {job.delivery_postcode ?? job.delivery_location ?? 'Delivery'}</strong>
                            <span style={{ display: 'block', color: '#64748b', fontSize: 11, marginTop: 2 }}>#{job.id.slice(0, 8).toUpperCase()} · {when(job.pickup_datetime)}</span>
                            <span style={{ display: 'block', color: '#64748b', fontSize: 11, marginTop: 2 }}>{driver?.display_name ?? driver?.email ?? (job.assigned_driver_id ? 'Assigned driver' : 'Unallocated')} · {(job.vehicle_type ?? 'Vehicle not supplied').replace(/_/g, ' ')}</span>
                          </span>
                          <StatusBadge value={status || stage} tone={stageTone(job)} />
                        </div>
                      </button>
                      {!job.assigned_driver_id && (stage === 'awarded' || stage === 'allocated') && (
                        <div style={{ display: 'flex', gap: 4, padding: '0 8px 8px', alignItems: 'center' }}>
                          <select value={driverSelections[job.id] ?? ''} onChange={(event) => setDriverSelections((current) => ({ ...current, [job.id]: event.target.value }))} style={{ height: 28, minWidth: 0, flex: 1, border: '1px solid var(--ws-border)', borderRadius: 4 }}>
                            <option value="">Choose active driver</option>
                            {activeAccountDrivers.map((item) => <option key={item.id} value={item.id}>{item.display_name ?? item.email ?? 'Driver'} · {item.availability_status ?? 'availability unknown'}</option>)}
                          </select>
                          <ActionButton tone="success" disabled={assigning === job.id} onClick={() => void assignDriver(job)}>{assigning === job.id ? 'Allocating…' : 'Allocate'}</ActionButton>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
              <section className="workspace-panel" aria-label="Diary split booking detail" style={{ minWidth: 0 }}>
                {selectedJobId ? <CompanyJobSheetPanel jobId={selectedJobId} mode="carrier" initialTab={detailTabByJob[selectedJobId] ?? 'order'} /> : <EmptyState compact title="Select a booking" description="Choose a booking from the list to inspect its authorised operational detail." />}
              </section>
            </div>
          ) : (
            <div className="workspace-record-list" style={{ gap: 6 }}>
              {visible.map((job) => {
                const open = expandedIds.has(job.id);
                const stage = classifyWorkspaceJobStage(job);
                const status = effectiveStatus(job);
                const driver = job.assigned_driver_id ? driverById.get(job.assigned_driver_id) : undefined;
                const evidenceCount = job.delivery_photos?.length ?? 0;
                const distance = numberLabel(job.job_distance_miles ?? job.distance_miles, ' mi');
                const weight = numberLabel(job.weight_kg, ' kg');
                const dimensions = dimensionsLabel(job);
                const cargo = job.requested_cargo_label || job.cargo_type?.replace(/_/g, ' ') || 'Cargo not supplied';
                const requestedVehicle = job.requested_vehicle_label || job.requested_vehicle_type?.replace(/_/g, ' ') || job.vehicle_type?.replace(/_/g, ' ') || 'Vehicle not supplied';
                const operationalNotes = [job.special_requirements, job.access_restrictions].filter(Boolean).join(' · ');
                const detail = intelligence.jobDetailById.get(job.id) ?? null;
                const milestones = diaryMilestones(intelligence.eventsByJob.get(job.id) ?? []);
                const agreedRate = moneyLabel(detail?.agreedRate, detail?.currency ?? 'GBP');
                const bookedTo = detail?.awardedCompanyName ?? detail?.executionCompanyName ?? null;
                const counterpartyPhone = job.company_id === companyId ? detail?.awardedCompanyPhone : detail?.ownerCompanyPhone;
                const feedbackAvailable = Boolean(job.company_id === companyId && (job.awarded_carrier_company_id || (job.assigned_company_id && job.assigned_company_id !== companyId)) && ['completed', 'cancelled'].includes(stage));
                const assignedGroupIds = groupIdsByJob.get(job.id) ?? [];
                const assignedGroups = assignedGroupIds.map((groupId) => groupById.get(groupId)).filter((group): group is DiaryGroupRow => Boolean(group));
                const availableGroups = groups.filter((group) => !assignedGroupIds.includes(group.id));
                return (
                  <article key={job.id} className="workspace-operational-row" data-state={status} style={{ overflow: 'hidden' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'stretch' }}>
                      <section style={{ flex: '1.15 1 260px', minWidth: 0, padding: '9px 10px', borderRight: '1px solid var(--ws-border)' }}>
                        <span className="driver-cell-label">ROUTE</span>
                        <strong style={{ display: 'block', fontSize: 13, marginTop: 2 }}>{job.pickup_location ?? job.pickup_postcode ?? 'Collection not supplied'}</strong>
                        <div style={{ color: '#64748b', fontSize: 11 }}>{job.pickup_postcode ?? 'Postcode not supplied'}</div>
                        <span style={{ display: 'block', color: '#94a3b8', margin: '3px 0' }}>↓</span>
                        <strong style={{ display: 'block', fontSize: 13 }}>{job.delivery_location ?? job.delivery_postcode ?? 'Delivery not supplied'}</strong>
                        <div style={{ color: '#64748b', fontSize: 11 }}>{job.delivery_postcode ?? 'Postcode not supplied'}</div>
                      </section>
                      <section style={{ flex: '1 1 230px', minWidth: 0, padding: '9px 10px', borderRight: '1px solid var(--ws-border)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '58px 1fr', gap: '3px 6px', fontSize: 11 }}><span style={{ color: '#64748b' }}>Pickup</span><strong>{when(job.pickup_datetime)}{job.pickup_time_slot ? ' · ' + job.pickup_time_slot : ''}</strong><span style={{ color: '#64748b' }}>Deliver</span><strong>{when(job.delivery_datetime)}{job.delivery_time_slot ? ' · ' + job.delivery_time_slot : ''}</strong></div>
                        <div style={{ marginTop: 6, fontSize: 11 }}><strong>{cargo}</strong>{weight ? <span style={{ color: '#64748b' }}> · {weight}</span> : null}{job.pallets != null ? <span style={{ color: '#64748b' }}> · {job.pallets} pallet{job.pallets === 1 ? '' : 's'}</span> : null}</div>
                        <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>{[distance, dimensions].filter(Boolean).join(' · ') || 'Distance / dimensions not supplied'}</div>
                      </section>
                      <section style={{ flex: '.9 1 220px', minWidth: 0, padding: '9px 10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'flex-start' }}><StatusBadge value={status || stage} tone={stageTone(job)} /><strong style={{ fontSize: 11 }}>{requestedVehicle}</strong></div>
                        <div style={{ marginTop: 5, fontSize: 11 }}><strong>{driver?.display_name ?? driver?.email ?? (job.assigned_driver_id ? 'Assigned driver' : 'Unallocated')}</strong>{detail?.vehicleRegistration ? <span style={{ color: '#64748b' }}> · {detail.vehicleRegistration}</span> : null}</div>
                        <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>Load #{job.id.slice(0, 8).toUpperCase()} · {job.client_name ?? 'Customer not supplied'}</div>
                        {detail?.ownerCompanyName && <div style={{ color: '#475569', fontSize: 10, marginTop: 3 }}>Posted by <strong>{detail.ownerCompanyName}</strong>{bookedTo ? <> · Booked to <strong>{bookedTo}</strong></> : null}{counterpartyPhone ? <> · <a href={`tel:${counterpartyPhone.replace(/\s+/g, '')}`} style={{ color: '#1d57d8', fontWeight: 800, textDecoration: 'none' }}>{counterpartyPhone}</a></> : null}</div>}
                        {(agreedRate || detail?.paymentTerms) && <div style={{ color: '#475569', fontSize: 10, marginTop: 2 }}>{agreedRate ? <>Agreed rate <strong>{agreedRate}</strong></> : null}{agreedRate && detail?.paymentTerms ? ' · ' : ''}{detail?.paymentTerms ? <>Payment terms <strong>{detail.paymentTerms}</strong></> : null}</div>}
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 5 }}>{job.pod_generated ? <StatusBadge value="POD generated" tone="green" /> : evidenceCount > 0 ? <StatusBadge value={String(evidenceCount) + ' evidence file(s)'} tone="blue" /> : job.pod_required ? <StatusBadge value="POD pending" tone="orange" /> : null}{isAwaitingFeedback(job, reviewsByJob[job.id] ?? []) && <StatusBadge value="Awaiting feedback" tone="orange" />}{hasRecentFeedback(reviewsByJob[job.id] ?? []) && <StatusBadge value="Recent feedback" tone="green" />}</div>
                      </section>
                    </div>
                    <div className="workspace-record-meta" style={{ minHeight: 28 }}>
                      {job.booking_reference && <span>Booking: {job.booking_reference}</span>}
                      {job.customer_reference && <span>Customer ref: {job.customer_reference}</span>}
                      {job.hard_copy_pod && <span>Hard-copy POD: {job.hard_copy_pod}</span>}
                      {detail?.itemCount != null && <span>Items: {detail.itemCount}</span>}
                      {detail?.receivedBy && <span>Received by: {detail.receivedBy}</span>}
                      {detail?.leftAt && <span>Left at: {detail.leftAt}</span>}
                      {detail?.deliveredAt && <span>Delivered: {when(detail.deliveredAt)}</span>}
                      {assignedGroups.map((group) => <span key={`${job.id}-group-${group.id}`} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><strong>Group:</strong> {group.name}{canManageCompanyBookings && <button type="button" onClick={() => void removeJobFromGroup(job.id, group.id)} aria-label={`Remove booking from ${group.name}`} style={{ border: 0, background: 'transparent', color: '#b91c1c', cursor: 'pointer', fontWeight: 900, padding: 0 }}>×</button>}</span>)}
                      {operationalNotes && <span style={{ flex: '1 1 320px' }}><strong>Load notes:</strong> {operationalNotes}</span>}
                    </div>
                    {(milestones.length > 0 || detail?.driverNotes || detail?.deliveryNotes) && <div className="workspace-record-meta" style={{ minHeight: 28, borderTop: '1px solid #edf2f7' }}>
                      {milestones.map((milestone) => <span key={`${job.id}-${milestone.eventType}`}><strong>{MILESTONE_LABELS[milestone.eventType]}</strong> {when(milestone.createdAt)}</span>)}
                      {detail?.driverNotes && <span style={{ flex: '1 1 260px' }}><strong>Driver notes:</strong> {detail.driverNotes}</span>}
                      {detail?.deliveryNotes && <span style={{ flex: '1 1 260px' }}><strong>Delivery notes:</strong> {detail.deliveryNotes}</span>}
                    </div>}
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap', minHeight: 36, padding: '4px 8px', borderTop: '1px solid var(--ws-border)', background: '#fbfdff' }}>
                      <button type="button" onClick={() => toggleJob(job.id)} aria-label={open ? 'Collapse booking' : 'Expand booking'} style={{ width: 28, height: 26, border: '1px solid var(--ws-border)', borderRadius: 3, background: '#fff', cursor: 'pointer', fontWeight: 900 }}>{open ? '▴' : '▾'}</button>
                      {!job.assigned_driver_id && (stage === 'awarded' || stage === 'allocated') && <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><select value={driverSelections[job.id] ?? ''} onChange={(event) => setDriverSelections((current) => ({ ...current, [job.id]: event.target.value }))} style={{ height: 28, border: '1px solid var(--ws-border)', borderRadius: 4 }}><option value="">Choose active driver</option>{activeAccountDrivers.map((item) => <option key={item.id} value={item.id}>{item.display_name ?? item.email ?? 'Driver'} · {item.availability_status ?? 'availability unknown'}</option>)}</select><ActionButton tone="success" disabled={assigning === job.id} onClick={() => void assignDriver(job)}>{assigning === job.id ? 'Allocating…' : 'Allocate'}</ActionButton></span>}
                      {canManageCompanyBookings && availableGroups.length > 0 && <select value="" aria-label="Add booking to Diary group" onChange={(event) => { const groupId = event.target.value; if (groupId) void addJobToGroup(job.id, groupId); }} style={{ height: 28, border: '1px solid var(--ws-border)', borderRadius: 4, background: '#fff' }}><option value="">Add to group…</option>{availableGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select>}
                      {!['completed', 'cancelled', 'expired'].includes(stage) && <ActionButton tone="secondary" onClick={() => router.push(`/admin/freight-vision?jobId=${encodeURIComponent(job.id)}`)}>Track</ActionButton>}
                      <ActionButton tone="secondary" onClick={() => router.push(`/admin/messages?jobId=${encodeURIComponent(job.id)}`)}>Message</ActionButton>
                      {canManageCompanyBookings && job.company_id === companyId && <ActionButton tone="secondary" onClick={() => router.push(`/admin/jobs/${encodeURIComponent(job.id)}`)}>Edit</ActionButton>}
                      {canManageCompanyBookings && job.company_id === companyId && !['completed', 'cancelled', 'expired'].includes(stage) && <ActionButton tone="danger" disabled={managingJobId === job.id} onClick={() => void cancelJob(job)}>{managingJobId === job.id ? 'Cancelling…' : 'Cancel'}</ActionButton>}
                      {canManageCompanyBookings && job.company_id === companyId && ['completed', 'cancelled', 'expired'].includes(stage) && <ActionButton tone="secondary" onClick={() => router.push(`/admin/post-load?sourceJob=${encodeURIComponent(job.id)}&sourceAction=rebook`)}>Re-book</ActionButton>}
                      {canManageCompanyBookings && job.company_id === companyId && ['cancelled', 'expired'].includes(stage) && <ActionButton tone="secondary" onClick={() => router.push(`/admin/post-load?sourceJob=${encodeURIComponent(job.id)}&sourceAction=repost`)}>Re-post</ActionButton>}
                      {canLeaveCompanyFeedback && feedbackAvailable && <ActionButton tone="secondary" onClick={() => openFeedback(job)}>{reviewsByJob[job.id]?.length ? 'Edit Feedback' : 'Leave Feedback'}</ActionButton>}
                      {(['order','notes','history','documents','pod','invoice','replay'] as JobSheetTab[]).map((tabId) => <ActionButton key={tabId} tone={detailTabByJob[job.id] === tabId && open ? 'primary' : 'secondary'} onClick={() => openJobTab(job.id, tabId)}>{tabId === 'pod' ? 'POD' : tabId.charAt(0).toUpperCase() + tabId.slice(1)}</ActionButton>)}
                    </div>
                    {open && <CompanyJobSheetPanel jobId={job.id} mode="carrier" initialTab={detailTabByJob[job.id] ?? 'order'} />}
                  </article>
                );
              })}
            </div>

          )}

        </main>
      </div>

      {groupManagerOpen && <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !groupWorking) setGroupManagerOpen(false); }} style={{ position: 'fixed', inset: 0, zIndex: 1290, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(15, 23, 42, 0.48)' }}>
        <section role="dialog" aria-modal="true" aria-labelledby="diary-groups-title" style={{ width: 'min(620px, calc(100vw - 32px))', maxHeight: 'min(720px, calc(100vh - 32px))', overflow: 'auto', border: '1px solid #cbd5e1', borderRadius: 4, background: '#fff', boxShadow: '0 16px 48px rgba(15, 23, 42, 0.22)' }}>
          <header style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0', background: '#f4f6f8' }}><strong id="diary-groups-title">Add / Edit Groups</strong><div style={{ marginTop: 2, color: '#64748b', fontSize: 11 }}>Groups organise bookings inside this company workspace only.</div></header>
          <div style={{ padding: 12, display: 'grid', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 6 }}><input value={newGroupName} onChange={(event) => setNewGroupName(event.target.value.slice(0, 80))} placeholder="New group name" aria-label="New Diary group name" style={{ minHeight: 34, border: '1px solid #cbd5e1', borderRadius: 4, padding: '0 8px' }} /><ActionButton tone="success" disabled={groupWorking || !newGroupName.trim()} onClick={() => void createDiaryGroup()}>Add Group</ActionButton></div>
            {groups.length === 0 ? <EmptyState compact title="No Diary groups yet" description="Create a group to organise bookings for your company team." /> : <div style={{ display: 'grid', gap: 6 }}>{groups.map((group) => <div key={group.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto auto', gap: 6, alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: 4, padding: 6 }}><input value={groupNameDrafts[group.id] ?? group.name} onChange={(event) => setGroupNameDrafts((current) => ({ ...current, [group.id]: event.target.value.slice(0, 80) }))} aria-label={`Rename ${group.name}`} style={{ minHeight: 32, border: '1px solid #cbd5e1', borderRadius: 4, padding: '0 8px' }} /><ActionButton tone="secondary" disabled={groupWorking || !(groupNameDrafts[group.id] ?? '').trim() || (groupNameDrafts[group.id] ?? '').trim() === group.name} onClick={() => void renameDiaryGroup(group.id)}>Save</ActionButton><ActionButton tone="danger" disabled={groupWorking} onClick={() => void deleteDiaryGroup(group.id)}>Delete</ActionButton></div>)}</div>}
          </div>
          <footer style={{ padding: '8px 12px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', background: '#f4f6f8' }}><ActionButton tone="secondary" disabled={groupWorking} onClick={() => setGroupManagerOpen(false)}>Close</ActionButton></footer>
        </section>
      </div>}

      {feedbackJobId && <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !feedbackSaving) setFeedbackJobId(null); }} style={{ position: 'fixed', inset: 0, zIndex: 1300, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(15, 23, 42, 0.48)' }}>
        <section role="dialog" aria-modal="true" aria-labelledby="company-feedback-title" style={{ width: 'min(520px, calc(100vw - 32px))', overflow: 'hidden', border: '1px solid #cbd5e1', borderRadius: 4, background: '#fff', boxShadow: '0 16px 48px rgba(15, 23, 42, 0.22)' }}>
          <header style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0', background: '#f4f6f8' }}><strong id="company-feedback-title">Company feedback</strong><div style={{ marginTop: 2, color: '#64748b', fontSize: 11 }}>Rate the external carrier for this completed booking. One company review is kept per booking.</div></header>
          <div style={{ padding: 12, display: 'grid', gap: 10 }}>
            <label style={{ display: 'grid', gap: 5, fontSize: 11, fontWeight: 800, color: '#334155' }}>RATING<select value={feedbackRating} onChange={(event) => setFeedbackRating(Number(event.target.value))} style={{ minHeight: 34, border: '1px solid #cbd5e1', borderRadius: 4, padding: '0 8px', background: '#fff' }}>{[5,4,3,2,1].map((rating) => <option key={rating} value={rating}>{rating} / 5</option>)}</select></label>
            <label style={{ display: 'grid', gap: 5, fontSize: 11, fontWeight: 800, color: '#334155' }}>COMMENT<textarea value={feedbackComment} onChange={(event) => setFeedbackComment(event.target.value.slice(0, 2000))} rows={5} placeholder="Operational feedback about this booking" style={{ border: '1px solid #cbd5e1', borderRadius: 4, padding: 8, resize: 'vertical' }} /></label>
          </div>
          <footer style={{ padding: '8px 12px', display: 'flex', justifyContent: 'flex-end', gap: 6, borderTop: '1px solid #e2e8f0', background: '#f4f6f8' }}><ActionButton tone="secondary" disabled={feedbackSaving} onClick={() => setFeedbackJobId(null)}>Cancel</ActionButton><ActionButton tone="success" disabled={feedbackSaving} onClick={() => void saveFeedback()}>{feedbackSaving ? 'Saving…' : 'Save Feedback'}</ActionButton></footer>
        </section>
      </div>}
    </PageFrame>
  );
}
const viewModeButtonStyle = (active: boolean) => ({
  minHeight: 24,
  border: '1px solid var(--ws-border)',
  borderRadius: 4,
  background: active ? '#eef4ff' : '#fff',
  color: active ? '#0b2f6b' : '#64748b',
  padding: '0 8px',
  fontSize: 11,
  fontWeight: active ? 800 : 650,
  cursor: 'pointer',
}) as const;
