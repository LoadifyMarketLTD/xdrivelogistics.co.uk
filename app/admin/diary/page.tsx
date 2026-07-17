'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
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
  draft: { label: 'Draft', bg: '#f1f5f9', color: '#475569' },
  received: { label: 'Received', bg: '#fef3c7', color: '#92400e' },
  posted: { label: 'Posted', bg: '#dbeafe', color: '#1e40af' },
  open: { label: 'Open', bg: '#dbeafe', color: '#1e40af' },
  allocated: { label: 'Allocated', bg: '#e0f2fe', color: '#0369a1' },
  on_my_way: { label: 'On My Way To Pickup', bg: '#dbeafe', color: '#1d4ed8' },
  on_site_pickup: { label: 'On Site Pickup', bg: '#fed7aa', color: '#9a3412' },
  loaded: { label: 'Loaded', bg: '#fef9c3', color: '#854d0e' },
  on_site_delivery: { label: 'On Site Delivery', bg: '#ede9fe', color: '#6d28d9' },
  in_transit: { label: 'In Progress', bg: '#fef9c3', color: '#854d0e' },
  on_site: { label: 'On Site', bg: '#fed7aa', color: '#9a3412' },
  delivered: { label: 'Delivered', bg: '#dcfce7', color: '#15803d' },
  completed: { label: 'Completed', bg: '#bbf7d0', color: '#166534' },
  cancelled: { label: 'Cancelled', bg: '#fee2e2', color: '#991b1b' },
  disputed: { label: 'Disputed', bg: '#fef3c7', color: '#92400e' },
};

const ACTION_STYLE: Record<WorkflowAction['tone'], { bg: string; color: string; border: string }> = {
  blue: { bg: '#1d4ed8', color: '#ffffff', border: '#1d4ed8' },
  amber: { bg: '#f59e0b', color: '#111827', border: '#f59e0b' },
  green: { bg: '#16a34a', color: '#ffffff', border: '#16a34a' },
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

  return (
    <ProtectedRoute>
      <div style={{ display: 'flex', height: 'calc(100vh - 89px)', overflow: 'hidden', background: '#f5f7fa' }}>
        <aside style={{ width: '200px', flexShrink: 0, background: '#fff', borderRight: '1px solid #e2e8f0', padding: '0.85rem', overflowY: 'auto', fontSize: '0.78rem' }}>
          <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.6rem', fontSize: '0.8rem' }}>Search Panel</div>
          <div style={{ marginBottom: '0.55rem' }}><div style={labelStyle}>View</div><select style={panelInput}><option>All</option><option>Jobs Sub-contracted</option><option>Our Bookings</option></select></div>
          <div style={{ marginBottom: '0.55rem' }}><div style={labelStyle}>Date</div><select style={panelInput}><option>Anytime</option><option>Today</option><option>This Week</option><option>Last 30 Days</option></select></div>
          <div style={{ marginBottom: '0.55rem' }}><div style={labelStyle}>Pickup Time Within</div><select style={panelInput}><option>Any</option><option>1 hour</option><option>2 hours</option><option>4 hours</option></select></div>
          <div style={{ marginBottom: '0.55rem' }}><div style={labelStyle}>Load ID / Ref</div><input placeholder="Search..." style={panelInput} /></div>
          <div style={{ marginBottom: '0.55rem' }}><div style={labelStyle}>Driver</div><select style={panelInput}><option value="">Any driver</option>{drivers.map((driver) => (<option key={driver.id} value={driver.id}>{driver.display_name}</option>))}</select></div>
          <div style={{ marginBottom: '0.85rem' }}><div style={labelStyle}>Customer Name</div><input placeholder="Search..." style={panelInput} /></div>
          <div style={{ display: 'flex', gap: '0.4rem' }}><button onClick={() => void loadJobs()} style={greenButton}>Search</button><button style={smallGhostButton}>Clear</button></div>
        </aside>

        <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0.45rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: '1rem' }}><div style={{ fontSize: '0.82rem', color: '#374151', fontWeight: 600 }}>Diary - {jobs.length} bookings</div><button onClick={() => void loadJobs()} style={smallGhostButton}>Refresh</button></div>
          <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 0.85rem', display: 'flex', alignItems: 'center', flexShrink: 0, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {[{ key: 'all', label: 'All', count: jobs.length }, ...LANE_CONFIG.map((lane) => ({ key: lane.key, label: lane.label, count: (grouped.get(lane.key) ?? []).length }))].map((tab) => (<button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{ padding: '0.6rem 0.8rem', border: 'none', borderBottom: activeTab === tab.key ? '2px solid #1d4ed8' : '2px solid transparent', background: 'none', cursor: 'pointer', fontSize: '0.73rem', fontWeight: 700, color: activeTab === tab.key ? '#1d4ed8' : '#64748b', whiteSpace: 'nowrap', flexShrink: 0, marginBottom: '-1px' }}>{tab.label}{tab.count > 0 && (<span style={{ marginLeft: '0.3rem', background: activeTab === tab.key ? '#dbeafe' : '#f1f5f9', color: activeTab === tab.key ? '#1d4ed8' : '#64748b', borderRadius: '8px', padding: '0.05rem 0.4rem', fontSize: '0.68rem' }}>{tab.count}</span>)}</button>))}
          </div>
          {message && (<div style={{ margin: '0.5rem 0.85rem', padding: '0.5rem 0.85rem', borderRadius: '6px', background: message.startsWith('Failed') ? '#fee2e2' : '#dcfce7', color: message.startsWith('Failed') ? '#991b1b' : '#166534', fontSize: '0.82rem', fontWeight: 600 }}>{message}</div>)}
          <div style={{ padding: '0.75rem', flex: 1, overflowY: 'auto' }}>
            {loading ? (<div style={emptyCard}>Loading diary...</div>) : filteredJobs.length === 0 ? (<div style={emptyCard}><div style={{ fontSize: '0.88rem' }}>No bookings in this category.</div></div>) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {filteredJobs.map((job) => {
                  const normalizedStatus = normalizeStatus(job.status);
                  const badge = STATUS_BADGE[normalizedStatus] ?? { label: job.status, bg: '#f1f5f9', color: '#475569' };
                  const laneKey = LANE_CONFIG.find((lane) => lane.statuses.includes(normalizedStatus))?.key ?? '';
                  const isUnallocated = laneKey === 'unallocated';
                  const workflowAction = getNextWorkflowAction(job);
                  const actionStyle = workflowAction ? ACTION_STYLE[workflowAction.tone] : null;
                  const workflowBusy = workflowJobId === job.id;
                  return (
                    <div key={job.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderLeft: `3px solid ${badge.color === '#15803d' || badge.color === '#166534' ? '#16a34a' : badge.color === '#991b1b' ? '#ef4444' : '#64748b'}`, borderRadius: '6px', overflow: 'hidden' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.75rem', padding: '0.75rem 1rem', alignItems: 'start' }}>
                        <div><div style={{ display: 'flex', gap: '0.3rem', alignItems: 'baseline' }}><span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 700, minWidth: '28px' }}>From:</span><span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.85rem' }}>{job.client_name || job.booked_by_company_name || 'Contact N/A'}</span></div><div style={{ fontSize: '0.8rem', color: '#374151', marginLeft: '36px', marginTop: '0.1rem' }}>{job.pickup_location || '-'}</div><div style={{ display: 'flex', gap: '0.3rem', alignItems: 'baseline', marginTop: '0.4rem' }}><span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 700, minWidth: '28px' }}>To:</span><span style={{ fontWeight: 600, color: '#374151', fontSize: '0.82rem' }}>{job.delivery_location || '-'}</span></div></div>
                        <div><div style={{ display: 'flex', gap: '0.3rem', alignItems: 'baseline' }}><span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 700, minWidth: '58px' }}>Pickup:</span><span style={{ fontSize: '0.8rem', color: '#374151' }}>{formatDate(job.pickup_datetime ?? job.updated_at)}</span></div><div style={{ display: 'flex', gap: '0.3rem', alignItems: 'baseline', marginTop: '0.2rem' }}><span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 700, minWidth: '58px' }}>Vehicle:</span><span style={{ fontSize: '0.78rem', color: '#64748b' }}>{job.vehicle_type ? job.vehicle_type.replace(/_/g, ' ') : '-'}</span></div><div style={{ marginTop: '0.35rem', fontSize: '0.68rem', color: '#64748b', lineHeight: 1.35 }}>{job.on_my_way_at && <div>On way: {formatDateTime(job.on_my_way_at)}</div>}{job.on_site_pickup_at && <div>Pickup site: {formatDateTime(job.on_site_pickup_at)}</div>}{job.loaded_at && <div>Loaded: {formatDateTime(job.loaded_at)}</div>}{job.on_site_delivery_at && <div>Delivery site: {formatDateTime(job.on_site_delivery_at)}</div>}{job.delivered_at && <div>Delivered: {formatDateTime(job.delivered_at)}</div>}</div></div>
                        <div style={{ minWidth: '140px', textAlign: 'right' }}><span style={{ display: 'inline-block', background: badge.bg, color: badge.color, padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.73rem', fontWeight: 700 }}>{badge.label}</span><div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '0.4rem' }}>Load ID: {(job.load_id || job.id).slice(0, 8).toUpperCase()}</div></div>
                      </div>
                      <div style={{ borderTop: '1px solid #f1f5f9', padding: '0.4rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fafbfc', flexWrap: 'wrap' }}>
                        {isUnallocated && (<><select value={assignmentDrafts[job.id] ?? ''} onChange={(event) => setAssignmentDrafts((prev) => ({ ...prev, [job.id]: event.target.value }))} style={{ padding: '0.28rem 0.5rem', border: '1px solid #e2e8f0', borderRadius: '5px', fontSize: '0.75rem', background: '#fff', color: '#374151', maxWidth: '180px' }}><option value="">Assign driver...</option>{drivers.map((driver) => (<option key={driver.id} value={driver.id}>{driver.display_name}</option>))}</select><button onClick={() => void handleAssignDriver(job)} disabled={!assignmentDrafts[job.id] || assigningJobId === job.id} style={{ padding: '0.28rem 0.65rem', border: 'none', borderRadius: '5px', background: !assignmentDrafts[job.id] ? '#e2e8f0' : '#0f766e', color: !assignmentDrafts[job.id] ? '#94a3b8' : '#fff', cursor: !assignmentDrafts[job.id] ? 'not-allowed' : 'pointer', fontSize: '0.73rem', fontWeight: 700 }}>{assigningJobId === job.id ? 'Assigning...' : 'Assign'}</button><div style={separator} /></>)}
                        {workflowAction && actionStyle && (<button onClick={() => void handleWorkflowAction(job, workflowAction)} disabled={workflowBusy} style={{ padding: '0.28rem 0.7rem', border: `1px solid ${actionStyle.border}`, borderRadius: '5px', background: workflowBusy ? '#e2e8f0' : actionStyle.bg, color: workflowBusy ? '#94a3b8' : actionStyle.color, cursor: workflowBusy ? 'not-allowed' : 'pointer', fontSize: '0.73rem', fontWeight: 800 }}>{workflowBusy ? 'Updating...' : workflowAction.label}</button>)}
                        {normalizeStatus(job.status) === 'delivered' && (<button onClick={() => void openModal('pod', job)} style={greenOutlineButton}>Upload POD</button>)}
                        <div style={separator} />
                        <button onClick={() => void openModal('order', job)} style={smallGhostButton}>Order</button><button onClick={() => void openModal('notes', job)} style={smallGhostButton}>Notes</button><button onClick={() => void openModal('history', job)} style={smallGhostButton}>History</button><button onClick={() => void openModal('documents', job)} style={smallGhostButton}>Documents</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {activeModal && selectedJob && (<div style={modalBackdrop}><div style={modalBox}><div style={modalHeader}><strong>{activeModal === 'order' && `Order - ${(selectedJob.load_id || selectedJob.id).slice(0, 8).toUpperCase()}`}{activeModal === 'notes' && 'Internal Notes'}{activeModal === 'history' && `History - ${(selectedJob.load_id || selectedJob.id).slice(0, 8).toUpperCase()}`}{activeModal === 'documents' && 'Load Documents'}{activeModal === 'pod' && 'Upload POD'}</strong><button onClick={closeModal} style={closeButton}>-</button></div><div style={modalBody}>
        {activeModal === 'order' && (<div style={grid2}><Info label="Load ID" value={selectedJob.load_id || selectedJob.id} /><Info label="Status" value={STATUS_BADGE[normalizeStatus(selectedJob.status)]?.label || selectedJob.status} /><Info label="From" value={selectedJob.pickup_location} /><Info label="To" value={selectedJob.delivery_location} /><Info label="Pickup" value={formatDateTime(selectedJob.pickup_datetime)} /><Info label="Delivery" value={formatDateTime(selectedJob.delivery_datetime)} /><Info label="Customer" value={selectedJob.client_name || selectedJob.booked_by_company_name} /><Info label="Phone" value={selectedJob.client_phone || selectedJob.booked_by_phone} /><Info label="Vehicle" value={selectedJob.vehicle_type || selectedJob.requested_vehicle_type} /><Info label="Agreed Rate" value={money(selectedJob.agreed_rate_gbp ?? selectedJob.agreed_rate)} /><Info label="Customer Ref" value={selectedJob.customer_ref || selectedJob.cust_ref} /><Info label="Your Ref" value={selectedJob.your_ref || selectedJob.load_ref} /><div style={{ gridColumn: '1 / -1' }}><Info label="Load Notes" value={selectedJob.load_notes || '-'} /></div></div>)}
        {activeModal === 'notes' && (<><div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', padding: '0.65rem', borderRadius: '6px', marginBottom: '0.75rem', fontSize: '0.82rem' }}>These notes are internal and are not sent to the customer.</div><textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="Write an internal note..." style={textareaStyle} /><div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}><button onClick={() => void handleSaveNote()} disabled={modalBusy || !noteDraft.trim()} style={greenButton}>{modalBusy ? 'Saving...' : 'Save Note'}</button></div><div style={{ marginTop: '1rem', display: 'grid', gap: '0.55rem' }}>{notes.length === 0 ? <div style={mutedText}>No notes yet.</div> : notes.map((note) => (<div key={note.id} style={listItem}><div style={{ fontSize: '0.78rem', color: '#64748b' }}>{formatDateTime(note.created_at)} - {note.visibility || 'internal'}</div><div style={{ marginTop: '0.25rem', whiteSpace: 'pre-wrap' }}>{note.note}</div></div>))}</div></>)}
        {activeModal === 'history' && (<div style={{ display: 'grid', gap: '0.55rem' }}><TimelineRow label="Current status" value={STATUS_BADGE[normalizeStatus(selectedJob.status)]?.label || selectedJob.status} /><TimelineRow label="On My Way To Pickup" value={formatDateTime(selectedJob.on_my_way_at)} /><TimelineRow label="On Site Pickup" value={formatDateTime(selectedJob.on_site_pickup_at)} /><TimelineRow label="Loaded" value={formatDateTime(selectedJob.loaded_at)} /><TimelineRow label="On Site Delivery" value={formatDateTime(selectedJob.on_site_delivery_at)} /><TimelineRow label="Delivered" value={formatDateTime(selectedJob.delivered_at)} /><TimelineRow label="Completed" value={formatDateTime(selectedJob.completed_at)} />
                  <TimelineRow label="Operational notes" value={selectedJob.delivery_notes || selectedJob.collection_notes || selectedJob.load_notes || '-'} /><div style={{ marginTop: '0.6rem' }}><div style={smallTitle}>Raw status history</div><pre style={preBox}>{JSON.stringify(selectedJob.status_history ?? [], null, 2)}</pre></div></div>)}
        {activeModal === 'documents' && (<><div style={formRow}><input value={documentName} onChange={(event) => setDocumentName(event.target.value)} placeholder="Document name / type" style={textInput} /><input type="file" onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)} style={textInput} /><button onClick={() => void handleUploadDocument()} disabled={modalBusy || !documentFile} style={greenButton}>{modalBusy ? 'Uploading...' : 'Upload'}</button></div><div style={{ marginTop: '1rem', display: 'grid', gap: '0.55rem' }}>{documents.length === 0 ? <div style={mutedText}>No documents uploaded yet.</div> : documents.map((doc) => (<div key={doc.id} style={documentRow}><div><div style={{ fontWeight: 700 }}>{doc.file_type || fileNameFromPath(doc.file_url)}</div><div style={{ fontSize: '0.75rem', color: '#64748b' }}>{formatDateTime(doc.created_at || doc.uploaded_at)}</div></div><div style={{ display: 'flex', gap: '0.4rem' }}><button onClick={() => void handleDownloadDocument(doc)} style={smallGhostButton}>Download</button><button onClick={() => void handleDeleteDocument(doc)} style={dangerButton}>Delete</button></div></div>))}</div></>)}
        {activeModal === 'pod' && (<><div style={grid2}><div><div style={labelStyle}>Delivery photo / POD file</div><input type="file" accept="image/*,.pdf" onChange={(event) => setPodFile(event.target.files?.[0] ?? null)} style={textInput} /></div><div><div style={labelStyle}>Recipient name</div><input value={podRecipientName} onChange={(event) => setPodRecipientName(event.target.value)} placeholder="Name of recipient" style={textInput} /></div><div><div style={labelStyle}>Signature / signed by</div><input value={podSignature} onChange={(event) => setPodSignature(event.target.value)} placeholder="Typed signature" style={textInput} /></div><div><div style={labelStyle}>Existing POD</div><div style={mutedText}>Photos: {safeArray(selectedJob.delivery_photos).length + safeArray(selectedJob.pod_photos).length}</div></div><div style={{ gridColumn: '1 / -1' }}><div style={labelStyle}>Delivery notes</div><textarea value={podNotes} onChange={(event) => setPodNotes(event.target.value)} placeholder="Delivery notes..." style={textareaStyle} /></div></div><div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}><button onClick={() => void handleSavePod()} disabled={modalBusy} style={greenButton}>{modalBusy ? 'Saving...' : 'Save POD'}</button></div></>)}
      </div></div></div>)}
    </ProtectedRoute>
  );
}

function Info({ label, value }: { label: string; value: string | number | null | undefined }) { return (<div style={infoBox}><div style={labelStyle}>{label}</div><div style={{ color: '#0f172a', fontWeight: 650, whiteSpace: 'pre-wrap' }}>{value || '-'}</div></div>); }
function TimelineRow({ label, value }: { label: string; value: string }) { return (<div style={listItem}><div style={{ fontWeight: 800, color: '#0f172a' }}>{label}</div><div style={{ color: value === '-' ? '#94a3b8' : '#334155', marginTop: '0.15rem' }}>{value}</div></div>); }

const labelStyle: CSSProperties = { fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.2rem' };
const panelInput: CSSProperties = { width: '100%', padding: '0.35rem 0.45rem', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '0.76rem', color: '#374151', background: '#fff', marginBottom: '0', boxSizing: 'border-box' };
const greenButton: CSSProperties = { background: '#16a34a', color: '#fff', border: 'none', borderRadius: '5px', padding: '0.5rem 0.75rem', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' };
const greenOutlineButton: CSSProperties = { padding: '0.28rem 0.7rem', border: '1px solid #16a34a', borderRadius: '5px', background: '#fff', cursor: 'pointer', fontSize: '0.73rem', color: '#166534', fontWeight: 800 };
const smallGhostButton: CSSProperties = { padding: '0.28rem 0.6rem', border: '1px solid #e2e8f0', borderRadius: '5px', background: '#fff', cursor: 'pointer', fontSize: '0.73rem', color: '#374151', fontWeight: 600 };
const dangerButton: CSSProperties = { padding: '0.28rem 0.6rem', border: '1px solid #fecaca', borderRadius: '5px', background: '#fff', cursor: 'pointer', fontSize: '0.73rem', color: '#991b1b', fontWeight: 700 };
const separator: CSSProperties = { width: '1px', height: '20px', background: '#e2e8f0' };
const emptyCard: CSSProperties = { background: '#fff', borderRadius: '8px', padding: '2rem', textAlign: 'center', color: '#64748b', border: '1px solid #e2e8f0' };
const modalBackdrop: CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' };
const modalBox: CSSProperties = { width: 'min(900px, 96vw)', maxHeight: '88vh', overflow: 'auto', background: '#fff', borderRadius: '10px', boxShadow: '0 20px 60px rgba(15, 23, 42, 0.35)', border: '1px solid #e2e8f0' };
const modalHeader: CSSProperties = { padding: '0.8rem 1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#0f172a' };
const modalBody: CSSProperties = { padding: '1rem', fontSize: '0.86rem' };
const closeButton: CSSProperties = { border: 'none', background: '#f1f5f9', color: '#334155', borderRadius: '999px', width: '30px', height: '30px', cursor: 'pointer', fontWeight: 900 };
const grid2: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem' };
const infoBox: CSSProperties = { border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.65rem', background: '#f8fafc' };
const textareaStyle: CSSProperties = { width: '100%', minHeight: '110px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0.7rem', boxSizing: 'border-box', fontSize: '0.86rem' };
const textInput: CSSProperties = { width: '100%', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0.55rem', boxSizing: 'border-box', fontSize: '0.84rem' };
const formRow: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.55rem', alignItems: 'center' };
const listItem: CSSProperties = { border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.65rem', background: '#fff' };
const documentRow: CSSProperties = { border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.65rem', background: '#fff', display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' };
const mutedText: CSSProperties = { color: '#64748b', fontSize: '0.82rem' };
const smallTitle: CSSProperties = { fontSize: '0.75rem', color: '#334155', fontWeight: 800, marginBottom: '0.35rem' };
const preBox: CSSProperties = { margin: 0, padding: '0.75rem', background: '#0f172a', color: '#e2e8f0', borderRadius: '8px', overflow: 'auto', fontSize: '0.74rem' };
