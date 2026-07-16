'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import {
  WorkspaceShell,
  WorkspaceAside,
  WorkspaceMain,
  WorkspaceHeader,
  WorkspaceContent,
  WorkspaceStatusBadge,
  WorkspaceFieldLabel,
  LoadingCard,
  EmptyCard,
  ErrorBanner,
  wsInputStyle,
  wsBtnPrimary,
  wsBtnSecondary,
  wsBtnAction,
  type WorkspaceTab,
} from '../../components/workspace';
import { resolveActiveCompanyId } from '../../../lib/activeCompany';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';

type DiaryJob = {
  id: string;
  company_id: string;
  status: string;
  current_status: string | null;
  assigned_driver_id: string | null;
  assigned_company_id: string | null;
  awarded_carrier_company_id: string | null;
  client_name: string | null;
  description: string | null;
  client_email?: string | null;
  client_phone?: string | null;
  pickup_location: string | null;
  delivery_location: string | null;
  pickup_datetime: string | null;
  delivery_datetime: string | null;
  vehicle_type: string | null;
  requested_vehicle_type?: string | null;
  booked_by_company_name?: string | null;
  booked_by_phone?: string | null;
  load_id?: string | null;
  load_ref?: string | null;
  customer_ref?: string | null;
  your_ref?: string | null;
  cust_ref?: string | null;
  agreed_rate?: number | string | null;
  agreed_rate_gbp?: number | string | null;
  payment_terms?: string | null;
  load_notes?: string | null;
  updated_at: string;
  created_at?: string | null;
  status_history: unknown;
  on_my_way_at: string | null;
  on_site_pickup_at: string | null;
  loaded_at: string | null;
  on_site_delivery_at: string | null;
  delivered_at: string | null;
  completed_at: string | null;
  pod_required: boolean;
  pod_generated: boolean;
  pod_generated_at: string | null;
  delivery_photos?: unknown;
  pod_photos?: unknown;
  pickup_photos?: unknown;
  delivery_signature_data?: unknown;
  client_signature_name?: string | null;
  delivery_notes?: string | null;
  collection_notes?: string | null;
};

type DriverOption = { id: string; display_name: string };
type JobNote = { id: string; note: string; visibility: string | null; status: string | null; created_at: string; author_user_id: string | null };
type JobDocument = { id: string; job_id: string; file_url: string | null; file_type: string | null; uploaded_at: string | null; created_at: string | null; uploaded_by: string | null };

type WorkflowAction = {
  label: string;
  nextStatus: string;
  timestampField: 'on_my_way_at' | 'on_site_pickup_at' | 'loaded_at' | 'on_site_delivery_at' | 'delivered_at' | 'completed_at';
  tone: 'blue' | 'amber' | 'green';
};

type ModalName = 'order' | 'notes' | 'history' | 'documents' | 'pod' | null;

const LANE_CONFIG: Array<{ key: string; label: string; statuses: string[] }> = [
  { key: 'unallocated', label: 'Unallocated', statuses: ['draft', 'received', 'posted', 'open'] },
  { key: 'allocated', label: 'Allocated', statuses: ['allocated'] },
  { key: 'inProgress', label: 'In Progress', statuses: ['on_my_way', 'on_site_pickup', 'loaded', 'on_site_delivery', 'in_transit', 'on_site'] },
  { key: 'completed', label: 'Completed', statuses: ['delivered', 'completed'] },
  { key: 'cancelled', label: 'Cancelled', statuses: ['cancelled'] },
  { key: 'attention', label: 'Attention', statuses: ['disputed'] },
];

const STATUS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  draft: { label: 'Draft', bg: '#F4F6F8', color: '#0B2F6B' },
  received: { label: 'Received', bg: '#F4F6F8', color: '#1A1F2B' },
  posted: { label: 'Posted', bg: '#F4F6F8', color: '#1D57D8' },
  open: { label: 'Open', bg: '#F4F6F8', color: '#1D57D8' },
  allocated: { label: 'Allocated', bg: '#F4F6F8', color: '#1D57D8' },
  on_my_way: { label: 'On My Way To Pickup', bg: '#F4F6F8', color: '#1D57D8' },
  on_site_pickup: { label: 'On Site Pickup', bg: '#F4F6F8', color: '#1A1F2B' },
  loaded: { label: 'Loaded', bg: '#F4F6F8', color: '#1A1F2B' },
  on_site_delivery: { label: 'On Site Delivery', bg: '#F4F6F8', color: '#1D57D8' },
  in_transit: { label: 'In Progress', bg: '#F4F6F8', color: '#1A1F2B' },
  on_site: { label: 'On Site', bg: '#F4F6F8', color: '#1A1F2B' },
  delivered: { label: 'Delivered', bg: '#F4F6F8', color: '#1D57D8' },
  completed: { label: 'Completed', bg: '#F4F6F8', color: '#1D57D8' },
  cancelled: { label: 'Cancelled', bg: '#F4F6F8', color: '#1A1F2B' },
  disputed: { label: 'Disputed', bg: '#F4F6F8', color: '#1A1F2B' },
};

const ACTION_STYLE: Record<WorkflowAction['tone'], { bg: string; color: string; border: string }> = {
  blue: { bg: '#1D57D8', color: '#FFFFFF', border: '#1D57D8' },
  amber: { bg: '#F5A300', color: '#1A1F2B', border: '#F5A300' },
  green: { bg: '#1D57D8', color: '#FFFFFF', border: '#1D57D8' },
};

function normalizeStatus(status: string | null | undefined) { return (status || '').toLowerCase(); }
function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatDateTime(value: string | null | undefined) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function money(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return '-';
  const n = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(n)) return String(value);
  return `GBP ${n.toFixed(2)}`;
}
function safeArray(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function fileNameFromPath(path: string | null | undefined) { if (!path) return 'Document'; return path.split('/').pop() || path; }

function getNextWorkflowAction(job: DiaryJob): WorkflowAction | null {
  switch (normalizeStatus(job.status)) {
    case 'allocated': return { label: 'On My Way To Pickup', nextStatus: 'on_my_way', timestampField: 'on_my_way_at', tone: 'blue' };
    case 'on_my_way':
    case 'in_transit': return { label: 'On Site Pickup', nextStatus: 'on_site_pickup', timestampField: 'on_site_pickup_at', tone: 'amber' };
    case 'on_site_pickup':
    case 'on_site': return { label: 'Loaded', nextStatus: 'loaded', timestampField: 'loaded_at', tone: 'green' };
    case 'loaded': return { label: 'On Site Delivery', nextStatus: 'on_site_delivery', timestampField: 'on_site_delivery_at', tone: 'amber' };
    case 'on_site_delivery': return { label: 'Delivered', nextStatus: 'delivered', timestampField: 'delivered_at', tone: 'green' };
    case 'delivered': return { label: 'Mark Completed', nextStatus: 'completed', timestampField: 'completed_at', tone: 'green' };
    default: return null;
  }
}

function appendStatusHistory(existingHistory: unknown, entry: Record<string, unknown>): Array<Record<string, unknown>> {
  if (Array.isArray(existingHistory)) {
    return [...existingHistory.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object'), entry];
  }
  return [entry];
}

export default function DiaryPage() {
  const { user, hasSupabaseSession } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<DiaryJob[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [assigningJobId, setAssigningJobId] = useState<string | null>(null);
  const [workflowJobId, setWorkflowJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [activeModal, setActiveModal] = useState<ModalName>(null);
  const [selectedJob, setSelectedJob] = useState<DiaryJob | null>(null);
  const [notes, setNotes] = useState<JobNote[]>([]);
  const [documents, setDocuments] = useState<JobDocument[]>([]);
  const [noteDraft, setNoteDraft] = useState('');
  const [documentName, setDocumentName] = useState('');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [podFile, setPodFile] = useState<File | null>(null);
  const [podRecipientName, setPodRecipientName] = useState('');
  const [podSignature, setPodSignature] = useState('');
  const [podNotes, setPodNotes] = useState('');
  const [modalBusy, setModalBusy] = useState(false);

  useEffect(() => {
    if (!hasSupabaseSession || !user?.id) return;
    if (user.companyId) { setCompanyId(user.companyId); return; }
    resolveActiveCompanyId({ userId: user.id, fallbackCompanyId: null }).then(setCompanyId);
  }, [hasSupabaseSession, user?.id, user?.companyId]);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    if (!isSupabaseConfigured || !companyId) { setJobs([]); setLoading(false); return; }
    const { data, error } = await supabase
      .from('jobs')
      .select([
        'id','company_id','status','current_status','assigned_driver_id','assigned_company_id','awarded_carrier_company_id',
        'client_name','description','client_email','client_phone','pickup_location','delivery_location','pickup_datetime','delivery_datetime',
        'vehicle_type','requested_vehicle_type','booked_by_company_name','booked_by_phone','load_id','load_ref','customer_ref',
        'your_ref','cust_ref','agreed_rate','agreed_rate_gbp','payment_terms','load_notes','updated_at','created_at','status_history',
        'on_my_way_at','on_site_pickup_at','loaded_at','on_site_delivery_at','delivered_at','completed_at','pod_required',
        'pod_generated','pod_generated_at','pickup_photos','delivery_photos','pod_photos','delivery_signature_data',
        'client_signature_name','delivery_notes','collection_notes'
      ].join(', '))
      .or('company_id.eq.' + companyId + ',assigned_company_id.eq.' + companyId + ',awarded_carrier_company_id.eq.' + companyId)
      .order('updated_at', { ascending: false })
      .limit(200);
    if (error) { console.error('Failed to load diary jobs:', error.message); setJobs([]); setLoading(false); return; }
    setJobs(Array.isArray(data) ? (data as unknown as DiaryJob[]) : []);
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    void loadJobs();
    if (!isSupabaseConfigured || !companyId) return;
    const channel = supabase.channel(`diary-jobs-${companyId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => { void loadJobs(); }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [companyId, loadJobs]);

  useEffect(() => {
    const loadDrivers = async () => {
      if (!isSupabaseConfigured || !companyId) { setDrivers([]); return; }
      const { data, error } = await supabase.from('drivers').select('id, display_name').eq('company_id', companyId).eq('status', 'active').order('display_name', { ascending: true });
      if (error) { console.error('Failed to load diary drivers:', error.message); setDrivers([]); return; }
      setDrivers((data as DriverOption[]) ?? []);
    };
    void loadDrivers();
  }, [companyId]);

  const loadNotes = useCallback(async (jobId: string) => {
    const { data, error } = await supabase.from('job_notes').select('id, note, visibility, status, created_at, author_user_id').eq('job_id', jobId).order('created_at', { ascending: false });
    if (error) { setNotes([]); setMessage(`Failed to load notes: ${error.message}`); return; }
    setNotes(Array.isArray(data) ? (data as unknown as JobNote[]) : []);
  }, []);

  const loadDocuments = useCallback(async (jobId: string) => {
    const { data, error } = await supabase.from('job_documents').select('id, job_id, file_url, file_type, uploaded_at, created_at, uploaded_by').eq('job_id', jobId).order('created_at', { ascending: false });
    if (error) { setDocuments([]); setMessage(`Failed to load documents: ${error.message}`); return; }
    setDocuments(Array.isArray(data) ? (data as unknown as JobDocument[]) : []);
  }, []);

  const openModal = async (modal: Exclude<ModalName, null>, job: DiaryJob) => {
    setSelectedJob(job); setActiveModal(modal); setMessage('');
    if (modal === 'notes') await loadNotes(job.id);
    if (modal === 'documents') await loadDocuments(job.id);
    if (modal === 'pod') { setPodRecipientName(job.client_signature_name ?? ''); setPodSignature(''); setPodNotes(job.delivery_notes ?? ''); }
  };

  const closeModal = () => {
    setActiveModal(null); setSelectedJob(null); setNoteDraft(''); setDocumentName(''); setDocumentFile(null); setPodFile(null); setPodRecipientName(''); setPodSignature(''); setPodNotes(''); setModalBusy(false);
  };

  const handleAssignDriver = async (job: DiaryJob) => {
    const selectedDriverId = assignmentDrafts[job.id] ?? '';
    if (!companyId || !selectedDriverId) return;

    const awardedCarrierCompanyId = job.awarded_carrier_company_id;
    if (awardedCarrierCompanyId && awardedCarrierCompanyId !== companyId) {
      setMessage('Driver assignment is restricted to the awarded carrier company.');
      return;
    }

    setAssigningJobId(job.id); setMessage('');
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) { setMessage('Session expired. Please sign in again.'); setAssigningJobId(null); return; }

    const response = await fetch(`/api/admin/jobs/${job.id}/assign-driver`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ driverId: selectedDriverId, expectedDriverId: job.assigned_driver_id }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) { setMessage(`Failed to assign driver: ${payload.error ?? 'Unknown error'}`); setAssigningJobId(null); return; }
    setAssignmentDrafts((prev) => ({ ...prev, [job.id]: '' })); setMessage('Driver assigned from diary.'); setAssigningJobId(null); await loadJobs();
  };

  const handleWorkflowAction = async (job: DiaryJob, action: WorkflowAction) => {
    if (!companyId) return;
    const now = new Date().toISOString();
    const updatePayload: Record<string, unknown> = { status: action.nextStatus, current_status: action.nextStatus, status_updated_at: now, updated_at: now, [action.timestampField]: now, status_history: appendStatusHistory(job.status_history, { status: action.nextStatus, label: action.label, timestamp: now, actor_user_id: user?.id ?? null }) };
    setWorkflowJobId(job.id); setMessage('');
    const { error } = await supabase.from('jobs').update(updatePayload).eq('id', job.id).or('company_id.eq.' + companyId + ',assigned_company_id.eq.' + companyId + ',awarded_carrier_company_id.eq.' + companyId);
    if (error) { setMessage(`Failed to update job status: ${error.message}`); setWorkflowJobId(null); return; }
    setMessage(`Job updated: ${action.label}.`); setWorkflowJobId(null); await loadJobs();
  };

  const handleSaveNote = async () => {
    if (!selectedJob || !companyId || !noteDraft.trim()) return;
    setModalBusy(true);
    const { error } = await supabase.from('job_notes').insert({ company_id: companyId, job_id: selectedJob.id, load_id: selectedJob.id, author_user_id: user?.id ?? null, created_by: user?.id ?? null, note: noteDraft.trim(), visibility: 'internal', status: 'active' });
    if (error) { setMessage(`Failed to save note: ${error.message}`); setModalBusy(false); return; }
    setNoteDraft(''); await loadNotes(selectedJob.id); setModalBusy(false);
  };

  const handleUploadDocument = async () => {
    if (!selectedJob || !documentFile) return;
    setModalBusy(true);
    const safeName = documentFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${selectedJob.id}/${Date.now()}-${safeName}`;
    const upload = await supabase.storage.from('job-docs').upload(storagePath, documentFile, { cacheControl: '3600', upsert: false });
    if (upload.error) { setMessage(`Failed to upload document: ${upload.error.message}`); setModalBusy(false); return; }
    const { error } = await supabase.from('job_documents').insert({ job_id: selectedJob.id, load_id: selectedJob.id, file_url: storagePath, file_type: documentName.trim() || documentFile.type || 'document', uploaded_by: user?.id ?? null });
    if (error) { setMessage(`Failed to save document record: ${error.message}`); setModalBusy(false); return; }
    setDocumentName(''); setDocumentFile(null); await loadDocuments(selectedJob.id); setModalBusy(false);
  };

  const handleDownloadDocument = async (doc: JobDocument) => {
    if (!doc.file_url) return;
    const { data, error } = await supabase.storage.from('job-docs').createSignedUrl(doc.file_url, 60);
    if (error || !data?.signedUrl) { setMessage(`Failed to open document: ${error?.message ?? 'No signed URL returned.'}`); return; }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const handleDeleteDocument = async (doc: JobDocument) => {
    if (!selectedJob) return;
    setModalBusy(true);
    if (doc.file_url) await supabase.storage.from('job-docs').remove([doc.file_url]);
    const { error } = await supabase.from('job_documents').delete().eq('id', doc.id);
    if (error) { setMessage(`Failed to delete document: ${error.message}`); setModalBusy(false); return; }
    await loadDocuments(selectedJob.id); setModalBusy(false);
  };

  const handleSavePod = async () => {
    if (!selectedJob) return;
    setModalBusy(true);
    const now = new Date().toISOString();
    const existingDeliveryPhotos = safeArray(selectedJob.delivery_photos);
    const existingPodPhotos = safeArray(selectedJob.pod_photos);
    let newPhotoPath: string | null = null;
    if (podFile) {
      const safeName = podFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      newPhotoPath = `${selectedJob.id}/${Date.now()}-${safeName}`;
      const upload = await supabase.storage.from('pod-docs').upload(newPhotoPath, podFile, { cacheControl: '3600', upsert: false });
      if (upload.error) { setMessage(`Failed to upload POD photo: ${upload.error.message}`); setModalBusy(false); return; }
    }
    const nextDeliveryPhotos = newPhotoPath ? [...existingDeliveryPhotos, newPhotoPath] : existingDeliveryPhotos;
    const nextPodPhotos = newPhotoPath ? [...existingPodPhotos, newPhotoPath] : existingPodPhotos;
    const { error } = await supabase.from('jobs').update({ delivery_photos: nextDeliveryPhotos, pod_photos: nextPodPhotos, delivery_signature_data: podSignature.trim() ? { type: 'typed_signature', value: podSignature.trim(), captured_at: now, captured_by: user?.id ?? null } : selectedJob.delivery_signature_data ?? null, client_signature_name: podRecipientName.trim() || selectedJob.client_signature_name || null, delivery_notes: podNotes.trim() || selectedJob.delivery_notes || null, pod_generated: true, pod_generated_at: now, updated_at: now }).eq('id', selectedJob.id);
    if (error) { setMessage(`Failed to save POD: ${error.message}`); setModalBusy(false); return; }
    setMessage('POD saved.'); setModalBusy(false); await loadJobs();
  };

  const grouped = useMemo(() => {
    const map = new Map<string, DiaryJob[]>();
    for (const lane of LANE_CONFIG) map.set(lane.key, []);
    for (const job of jobs) { const lane = LANE_CONFIG.find((item) => item.statuses.includes(normalizeStatus(job.status))); if (lane) map.get(lane.key)?.push(job); }
    return map;
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    if (activeTab === 'all') return jobs;
    const lane = LANE_CONFIG.find((item) => item.key === activeTab);
    if (!lane) return jobs;
    return jobs.filter((job) => lane.statuses.includes(normalizeStatus(job.status)));
  }, [jobs, activeTab]);

  const wsTabs = useMemo<WorkspaceTab[]>(() => [
    { id: 'all', label: 'All', count: jobs.length },
    ...LANE_CONFIG.map((lane) => ({ id: lane.key, label: lane.label, count: (grouped.get(lane.key) ?? []).length })),
  ], [grouped, jobs.length]);

  return (
    <ProtectedRoute>
      <WorkspaceShell>
        <WorkspaceAside title="🔍 Search Diary">
          <div style={{ marginBottom: '0.55rem' }}><WorkspaceFieldLabel>View</WorkspaceFieldLabel><select style={wsInputStyle}><option>All</option><option>Jobs Sub-contracted</option><option>Our Bookings</option></select></div>
          <div style={{ marginBottom: '0.55rem' }}><WorkspaceFieldLabel>Date</WorkspaceFieldLabel><select style={wsInputStyle}><option>Anytime</option><option>Today</option><option>This Week</option><option>Last 30 Days</option></select></div>
          <div style={{ marginBottom: '0.55rem' }}><WorkspaceFieldLabel>Pickup Time Within</WorkspaceFieldLabel><select style={wsInputStyle}><option>Any</option><option>1 hour</option><option>2 hours</option><option>4 hours</option></select></div>
          <div style={{ marginBottom: '0.55rem' }}><WorkspaceFieldLabel>Load ID / Ref</WorkspaceFieldLabel><input placeholder="Search..." style={wsInputStyle} /></div>
          <div style={{ marginBottom: '0.55rem' }}><WorkspaceFieldLabel>Driver</WorkspaceFieldLabel><select style={wsInputStyle}><option value="">Any driver</option>{drivers.map((driver) => (<option key={driver.id} value={driver.id}>{driver.display_name}</option>))}</select></div>
          <div style={{ marginBottom: '0.85rem' }}><WorkspaceFieldLabel>Customer Name</WorkspaceFieldLabel><input placeholder="Search..." style={wsInputStyle} /></div>
          <div style={{ display: 'flex', gap: '0.4rem' }}><button onClick={() => void loadJobs()} style={wsBtnPrimary}>Search</button><button style={wsBtnSecondary}>Clear</button></div>
        </WorkspaceAside>

        <WorkspaceMain>
          <WorkspaceHeader tabs={wsTabs} activeTab={activeTab} onTabChange={setActiveTab} action={<button onClick={() => void loadJobs()} style={wsBtnAction}>↻ Refresh</button>} />
          <WorkspaceContent>
            <div style={{ fontSize: '0.82rem', color: '#1A1F2B', fontWeight: 600, marginBottom: '0.75rem' }}>Diary - {jobs.length} bookings</div>
            {message && (message.startsWith('Failed')
              ? <ErrorBanner msg={message} />
              : <div style={{ marginBottom: '0.75rem', padding: '0.5rem 0.85rem', borderRadius: '6px', background: '#F4F6F8', color: '#1D57D8', fontSize: '0.82rem', fontWeight: 600 }}>{message}</div>)}
            {loading ? <LoadingCard text="Loading diary…" /> : filteredJobs.length === 0 ? <EmptyCard icon="📋" text="No bookings in this category." /> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {filteredJobs.map((job) => {
                  const normalizedStatus = normalizeStatus(job.status);
                  const badge = STATUS_BADGE[normalizedStatus] ?? { label: job.status, bg: '#F4F6F8', color: '#0B2F6B' };
                  const laneKey = LANE_CONFIG.find((lane) => lane.statuses.includes(normalizedStatus))?.key ?? '';
                  const isUnallocated = laneKey === 'unallocated';
                  const workflowAction = getNextWorkflowAction(job);
                  const actionStyle = workflowAction ? ACTION_STYLE[workflowAction.tone] : null;
                  const workflowBusy = workflowJobId === job.id;
                  return (
                    <div key={job.id} style={{ background: '#FFFFFF', border: '1px solid rgba(11, 47, 107, 0.16)', borderLeft: `3px solid ${badge.color === '#1D57D8' || badge.color === '#1D57D8' ? '#1D57D8' : badge.color === '#F5A300' ? '#F5A300' : '#0B2F6B'}`, borderRadius: '6px', overflow: 'hidden' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.75rem', padding: '0.75rem 1rem', alignItems: 'start' }}>
                        <div><div style={{ display: 'flex', gap: '0.3rem', alignItems: 'baseline' }}><span style={{ fontSize: '0.65rem', color: '#0B2F6B', fontWeight: 700, minWidth: '28px' }}>From:</span><span style={{ fontWeight: 700, color: '#1A1F2B', fontSize: '0.85rem' }}>{job.client_name || job.booked_by_company_name || 'Contact N/A'}</span></div><div style={{ fontSize: '0.8rem', color: '#1A1F2B', marginLeft: '36px', marginTop: '0.1rem' }}>{job.pickup_location || '-'}</div><div style={{ display: 'flex', gap: '0.3rem', alignItems: 'baseline', marginTop: '0.4rem' }}><span style={{ fontSize: '0.65rem', color: '#0B2F6B', fontWeight: 700, minWidth: '28px' }}>To:</span><span style={{ fontWeight: 600, color: '#1A1F2B', fontSize: '0.82rem' }}>{job.delivery_location || '-'}</span></div></div>
                        <div><div style={{ display: 'flex', gap: '0.3rem', alignItems: 'baseline' }}><span style={{ fontSize: '0.65rem', color: '#0B2F6B', fontWeight: 700, minWidth: '58px' }}>Pickup:</span><span style={{ fontSize: '0.8rem', color: '#1A1F2B' }}>{formatDate(job.pickup_datetime ?? job.updated_at)}</span></div><div style={{ display: 'flex', gap: '0.3rem', alignItems: 'baseline', marginTop: '0.2rem' }}><span style={{ fontSize: '0.65rem', color: '#0B2F6B', fontWeight: 700, minWidth: '58px' }}>Vehicle:</span><span style={{ fontSize: '0.78rem', color: '#0B2F6B' }}>{job.vehicle_type ? job.vehicle_type.replace(/_/g, ' ') : '-'}</span></div><div style={{ marginTop: '0.35rem', fontSize: '0.68rem', color: '#0B2F6B', lineHeight: 1.35 }}>{job.on_my_way_at && <div>On way: {formatDateTime(job.on_my_way_at)}</div>}{job.on_site_pickup_at && <div>Pickup site: {formatDateTime(job.on_site_pickup_at)}</div>}{job.loaded_at && <div>Loaded: {formatDateTime(job.loaded_at)}</div>}{job.on_site_delivery_at && <div>Delivery site: {formatDateTime(job.on_site_delivery_at)}</div>}{job.delivered_at && <div>Delivered: {formatDateTime(job.delivered_at)}</div>}</div></div>
                        <div style={{ minWidth: '140px', textAlign: 'right' }}><WorkspaceStatusBadge bg={badge.bg} color={badge.color}>{badge.label}</WorkspaceStatusBadge><div style={{ fontSize: '0.68rem', color: '#0B2F6B', marginTop: '0.4rem' }}>Load ID: {(job.load_id || job.id).slice(0, 8).toUpperCase()}</div></div>
                      </div>
                      <div style={{ borderTop: '1px solid rgba(11, 47, 107, 0.16)', padding: '0.4rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#FFFFFF', flexWrap: 'wrap' }}>
                        {isUnallocated && (<><select value={assignmentDrafts[job.id] ?? ''} onChange={(event) => setAssignmentDrafts((prev) => ({ ...prev, [job.id]: event.target.value }))} style={{ padding: '0.28rem 0.5rem', border: '1px solid rgba(11, 47, 107, 0.16)', borderRadius: '5px', fontSize: '0.75rem', background: '#FFFFFF', color: '#1A1F2B', maxWidth: '180px' }}><option value="">Assign driver...</option>{drivers.map((driver) => (<option key={driver.id} value={driver.id}>{driver.display_name}</option>))}</select><button onClick={() => void handleAssignDriver(job)} disabled={!assignmentDrafts[job.id] || assigningJobId === job.id} style={{ padding: '0.28rem 0.65rem', border: 'none', borderRadius: '5px', background: !assignmentDrafts[job.id] ? '#F4F6F8' : '#1D57D8', color: !assignmentDrafts[job.id] ? '#F4F6F8' : '#FFFFFF', cursor: !assignmentDrafts[job.id] ? 'not-allowed' : 'pointer', fontSize: '0.73rem', fontWeight: 700 }}>{assigningJobId === job.id ? 'Assigning...' : 'Assign'}</button><div style={separator} /></>)}
                        {workflowAction && actionStyle && (<button onClick={() => void handleWorkflowAction(job, workflowAction)} disabled={workflowBusy} style={{ padding: '0.28rem 0.7rem', border: `1px solid ${actionStyle.border}`, borderRadius: '5px', background: workflowBusy ? '#F4F6F8' : actionStyle.bg, color: workflowBusy ? '#F4F6F8' : actionStyle.color, cursor: workflowBusy ? 'not-allowed' : 'pointer', fontSize: '0.73rem', fontWeight: 800 }}>{workflowBusy ? 'Updating...' : workflowAction.label}</button>)}
                        {normalizeStatus(job.status) === 'delivered' && (<button onClick={() => void openModal('pod', job)} style={greenOutlineButton}>Upload POD</button>)}
                        <div style={separator} />
                        <button onClick={() => void openModal('order', job)} style={smallGhostButton}>Order</button><button onClick={() => void openModal('notes', job)} style={smallGhostButton}>Notes</button><button onClick={() => void openModal('history', job)} style={smallGhostButton}>History</button><button onClick={() => void openModal('documents', job)} style={smallGhostButton}>Documents</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </WorkspaceContent>
        </WorkspaceMain>
      </WorkspaceShell>

      {activeModal && selectedJob && (<div style={modalBackdrop}><div style={modalBox}><div style={modalHeader}><strong>{activeModal === 'order' && `Order - ${(selectedJob.load_id || selectedJob.id).slice(0, 8).toUpperCase()}`}{activeModal === 'notes' && 'Internal Notes'}{activeModal === 'history' && `History - ${(selectedJob.load_id || selectedJob.id).slice(0, 8).toUpperCase()}`}{activeModal === 'documents' && 'Load Documents'}{activeModal === 'pod' && 'Upload POD'}</strong><button onClick={closeModal} style={closeButton}>-</button></div><div style={modalBody}>
        {activeModal === 'order' && (<div style={grid2}><Info label="Load ID" value={selectedJob.load_id || selectedJob.id} /><Info label="Status" value={STATUS_BADGE[normalizeStatus(selectedJob.status)]?.label || selectedJob.status} /><Info label="From" value={selectedJob.pickup_location} /><Info label="To" value={selectedJob.delivery_location} /><Info label="Pickup" value={formatDateTime(selectedJob.pickup_datetime)} /><Info label="Delivery" value={formatDateTime(selectedJob.delivery_datetime)} /><Info label="Customer" value={selectedJob.client_name || selectedJob.booked_by_company_name} /><Info label="Phone" value={selectedJob.client_phone || selectedJob.booked_by_phone} /><Info label="Vehicle" value={selectedJob.vehicle_type || selectedJob.requested_vehicle_type} /><Info label="Agreed Rate" value={money(selectedJob.agreed_rate_gbp ?? selectedJob.agreed_rate)} /><Info label="Customer Ref" value={selectedJob.customer_ref || selectedJob.cust_ref} /><Info label="Your Ref" value={selectedJob.your_ref || selectedJob.load_ref} /><div style={{ gridColumn: '1 / -1' }}><Info label="Load Notes" value={selectedJob.load_notes || '-'} /></div></div>)}
        {activeModal === 'notes' && (<><div style={{ background: '#F4F6F8', border: '1px solid rgba(11, 47, 107, 0.16)', color: '#1D57D8', padding: '0.65rem', borderRadius: '6px', marginBottom: '0.75rem', fontSize: '0.82rem' }}>These notes are internal and are not sent to the customer.</div><textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="Write an internal note..." style={textareaStyle} /><div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}><button onClick={() => void handleSaveNote()} disabled={modalBusy || !noteDraft.trim()} style={greenButton}>{modalBusy ? 'Saving...' : 'Save Note'}</button></div><div style={{ marginTop: '1rem', display: 'grid', gap: '0.55rem' }}>{notes.length === 0 ? <div style={mutedText}>No notes yet.</div> : notes.map((note) => (<div key={note.id} style={listItem}><div style={{ fontSize: '0.78rem', color: '#0B2F6B' }}>{formatDateTime(note.created_at)} - {note.visibility || 'internal'}</div><div style={{ marginTop: '0.25rem', whiteSpace: 'pre-wrap' }}>{note.note}</div></div>))}</div></>)}
        {activeModal === 'history' && (<div style={{ display: 'grid', gap: '0.55rem' }}><TimelineRow label="Current status" value={STATUS_BADGE[normalizeStatus(selectedJob.status)]?.label || selectedJob.status} /><TimelineRow label="On My Way To Pickup" value={formatDateTime(selectedJob.on_my_way_at)} /><TimelineRow label="On Site Pickup" value={formatDateTime(selectedJob.on_site_pickup_at)} /><TimelineRow label="Loaded" value={formatDateTime(selectedJob.loaded_at)} /><TimelineRow label="On Site Delivery" value={formatDateTime(selectedJob.on_site_delivery_at)} /><TimelineRow label="Delivered" value={formatDateTime(selectedJob.delivered_at)} /><TimelineRow label="Completed" value={formatDateTime(selectedJob.completed_at)} />
                  <TimelineRow label="Operational notes" value={selectedJob.delivery_notes || selectedJob.collection_notes || selectedJob.load_notes || '-'} /><div style={{ marginTop: '0.6rem' }}><div style={smallTitle}>Raw status history</div><pre style={preBox}>{JSON.stringify(selectedJob.status_history ?? [], null, 2)}</pre></div></div>)}
        {activeModal === 'documents' && (<><div style={formRow}><input value={documentName} onChange={(event) => setDocumentName(event.target.value)} placeholder="Document name / type" style={textInput} /><input type="file" onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)} style={textInput} /><button onClick={() => void handleUploadDocument()} disabled={modalBusy || !documentFile} style={greenButton}>{modalBusy ? 'Uploading...' : 'Upload'}</button></div><div style={{ marginTop: '1rem', display: 'grid', gap: '0.55rem' }}>{documents.length === 0 ? <div style={mutedText}>No documents uploaded yet.</div> : documents.map((doc) => (<div key={doc.id} style={documentRow}><div><div style={{ fontWeight: 700 }}>{doc.file_type || fileNameFromPath(doc.file_url)}</div><div style={{ fontSize: '0.75rem', color: '#0B2F6B' }}>{formatDateTime(doc.created_at || doc.uploaded_at)}</div></div><div style={{ display: 'flex', gap: '0.4rem' }}><button onClick={() => void handleDownloadDocument(doc)} style={smallGhostButton}>Download</button><button onClick={() => void handleDeleteDocument(doc)} style={dangerButton}>Delete</button></div></div>))}</div></>)}
        {activeModal === 'pod' && (<><div style={grid2}><div><div style={labelStyle}>Delivery photo / POD file</div><input type="file" accept="image/*,.pdf" onChange={(event) => setPodFile(event.target.files?.[0] ?? null)} style={textInput} /></div><div><div style={labelStyle}>Recipient name</div><input value={podRecipientName} onChange={(event) => setPodRecipientName(event.target.value)} placeholder="Name of recipient" style={textInput} /></div><div><div style={labelStyle}>Signature / signed by</div><input value={podSignature} onChange={(event) => setPodSignature(event.target.value)} placeholder="Typed signature" style={textInput} /></div><div><div style={labelStyle}>Existing POD</div><div style={mutedText}>Photos: {safeArray(selectedJob.delivery_photos).length + safeArray(selectedJob.pod_photos).length}</div></div><div style={{ gridColumn: '1 / -1' }}><div style={labelStyle}>Delivery notes</div><textarea value={podNotes} onChange={(event) => setPodNotes(event.target.value)} placeholder="Delivery notes..." style={textareaStyle} /></div></div><div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}><button onClick={() => void handleSavePod()} disabled={modalBusy} style={greenButton}>{modalBusy ? 'Saving...' : 'Save POD'}</button></div></>)}
      </div></div></div>)}
    </ProtectedRoute>
  );
}

function Info({ label, value }: { label: string; value: string | number | null | undefined }) { return (<div style={infoBox}><div style={labelStyle}>{label}</div><div style={{ color: '#1A1F2B', fontWeight: 650, whiteSpace: 'pre-wrap' }}>{value || '-'}</div></div>); }
function TimelineRow({ label, value }: { label: string; value: string }) { return (<div style={listItem}><div style={{ fontWeight: 800, color: '#1A1F2B' }}>{label}</div><div style={{ color: value === '-' ? '#F4F6F8' : '#1D57D8', marginTop: '0.15rem' }}>{value}</div></div>); }

const labelStyle: CSSProperties = { fontSize: '0.65rem', fontWeight: 700, color: '#0B2F6B', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.2rem' };
const greenButton: CSSProperties = { background: '#1D57D8', color: '#FFFFFF', border: 'none', borderRadius: '5px', padding: '0.5rem 0.75rem', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' };
const greenOutlineButton: CSSProperties = { padding: '0.28rem 0.7rem', border: '1px solid #1D57D8', borderRadius: '5px', background: '#FFFFFF', cursor: 'pointer', fontSize: '0.73rem', color: '#1D57D8', fontWeight: 800 };
const smallGhostButton: CSSProperties = { padding: '0.28rem 0.6rem', border: '1px solid rgba(11, 47, 107, 0.16)', borderRadius: '5px', background: '#FFFFFF', cursor: 'pointer', fontSize: '0.73rem', color: '#1A1F2B', fontWeight: 600 };
const dangerButton: CSSProperties = { padding: '0.28rem 0.6rem', border: '1px solid rgba(11, 47, 107, 0.16)', borderRadius: '5px', background: '#FFFFFF', cursor: 'pointer', fontSize: '0.73rem', color: '#1A1F2B', fontWeight: 700 };
const separator: CSSProperties = { width: '1px', height: '20px', background: '#F4F6F8' };
const modalBackdrop: CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(26, 31, 43, 0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' };
const modalBox: CSSProperties = { width: 'min(900px, 96vw)', maxHeight: '88vh', overflow: 'auto', background: '#FFFFFF', borderRadius: '10px', boxShadow: '0 20px 60px rgba(26, 31, 43, 0.35)', border: '1px solid rgba(11, 47, 107, 0.16)' };
const modalHeader: CSSProperties = { padding: '0.8rem 1rem', borderBottom: '1px solid rgba(11, 47, 107, 0.16)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#1A1F2B' };
const modalBody: CSSProperties = { padding: '1rem', fontSize: '0.86rem' };
const closeButton: CSSProperties = { border: 'none', background: '#F4F6F8', color: '#1D57D8', borderRadius: '999px', width: '30px', height: '30px', cursor: 'pointer', fontWeight: 900 };
const grid2: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem' };
const infoBox: CSSProperties = { border: '1px solid rgba(11, 47, 107, 0.16)', borderRadius: '8px', padding: '0.65rem', background: '#F4F6F8' };
const textareaStyle: CSSProperties = { width: '100%', minHeight: '110px', border: '1px solid rgba(11, 47, 107, 0.16)', borderRadius: '8px', padding: '0.7rem', boxSizing: 'border-box', fontSize: '0.86rem' };
const textInput: CSSProperties = { width: '100%', border: '1px solid rgba(11, 47, 107, 0.16)', borderRadius: '8px', padding: '0.55rem', boxSizing: 'border-box', fontSize: '0.84rem' };
const formRow: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.55rem', alignItems: 'center' };
const listItem: CSSProperties = { border: '1px solid rgba(11, 47, 107, 0.16)', borderRadius: '8px', padding: '0.65rem', background: '#FFFFFF' };
const documentRow: CSSProperties = { border: '1px solid rgba(11, 47, 107, 0.16)', borderRadius: '8px', padding: '0.65rem', background: '#FFFFFF', display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' };
const mutedText: CSSProperties = { color: '#0B2F6B', fontSize: '0.82rem' };
const smallTitle: CSSProperties = { fontSize: '0.75rem', color: '#1D57D8', fontWeight: 800, marginBottom: '0.35rem' };
const preBox: CSSProperties = { margin: 0, padding: '0.75rem', background: '#1A1F2B', color: '#0B2F6B', borderRadius: '8px', overflow: 'auto', fontSize: '0.74rem' };
