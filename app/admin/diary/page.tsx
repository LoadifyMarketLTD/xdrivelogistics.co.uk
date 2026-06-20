'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { resolveActiveCompanyId } from '../../../lib/activeCompany';
import { buildDriverAssignmentUpdate } from '../../../lib/jobAssignment';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';

type DiaryJob = {
  id: string;
  status: string;
  current_status: string | null;
  assigned_driver_id: string | null;
  assigned_company_id: string | null;
  awarded_carrier_company_id: string | null;
  client_name: string | null;
  pickup_location: string | null;
  delivery_location: string | null;
  pickup_datetime: string | null;
  delivery_datetime: string | null;
  vehicle_type: string | null;
  updated_at: string;
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
};

type DriverOption = {
  id: string;
  display_name: string;
};

type WorkflowAction = {
  label: string;
  nextStatus: string;
  timestampField:
    | 'on_my_way_at'
    | 'on_site_pickup_at'
    | 'loaded_at'
    | 'on_site_delivery_at'
    | 'delivered_at'
    | 'completed_at';
  tone: 'blue' | 'amber' | 'green';
};

const LANE_CONFIG: Array<{ key: string; label: string; statuses: string[] }> = [
  { key: 'unallocated', label: 'Unallocated', statuses: ['draft', 'received', 'posted', 'open'] },
  { key: 'allocated', label: 'Allocated', statuses: ['allocated'] },
  {
    key: 'inProgress',
    label: 'In Progress',
    statuses: ['on_my_way', 'on_site_pickup', 'loaded', 'on_site_delivery', 'in_transit', 'on_site'],
  },
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

function normalizeStatus(status: string | null | undefined) {
  return (status || '').toLowerCase();
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getNextWorkflowAction(job: DiaryJob): WorkflowAction | null {
  switch (normalizeStatus(job.status)) {
    case 'allocated':
      return {
        label: 'On My Way To Pickup',
        nextStatus: 'on_my_way',
        timestampField: 'on_my_way_at',
        tone: 'blue',
      };
    case 'on_my_way':
    case 'in_transit':
      return {
        label: 'On Site Pickup',
        nextStatus: 'on_site_pickup',
        timestampField: 'on_site_pickup_at',
        tone: 'amber',
      };
    case 'on_site_pickup':
    case 'on_site':
      return {
        label: 'Loaded',
        nextStatus: 'loaded',
        timestampField: 'loaded_at',
        tone: 'green',
      };
    case 'loaded':
      return {
        label: 'On Site Delivery',
        nextStatus: 'on_site_delivery',
        timestampField: 'on_site_delivery_at',
        tone: 'amber',
      };
    case 'on_site_delivery':
      return {
        label: 'Delivered',
        nextStatus: 'delivered',
        timestampField: 'delivered_at',
        tone: 'green',
      };
    case 'delivered':
      return {
        label: 'Mark Completed',
        nextStatus: 'completed',
        timestampField: 'completed_at',
        tone: 'green',
      };
    default:
      return null;
  }
}

function appendStatusHistory(
  existingHistory: unknown,
  entry: Record<string, unknown>,
): Array<Record<string, unknown>> {
  if (Array.isArray(existingHistory)) {
    return [
      ...existingHistory.filter(
        (item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object',
      ),
      entry,
    ];
  }

  return [entry];
}

export default function DiaryPage() {
  const router = useRouter();
  const { user, hasSupabaseSession } = useAuth();

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<DiaryJob[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, string>>({});
  const [assignmentMessage, setAssignmentMessage] = useState('');
  const [assigningJobId, setAssigningJobId] = useState<string | null>(null);
  const [workflowJobId, setWorkflowJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    if (!hasSupabaseSession || !user?.id) return;

    if (user.companyId) {
      setCompanyId(user.companyId);
      return;
    }

    resolveActiveCompanyId({
      userId: user.id,
      fallbackCompanyId: null,
    }).then(setCompanyId);
  }, [hasSupabaseSession, user?.id, user?.companyId]);

  const loadJobs = useCallback(async () => {
    setLoading(true);

    if (!isSupabaseConfigured || !companyId) {
      setJobs([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('jobs')
      .select(
        [
          'id',
          'status',
          'current_status',
          'assigned_driver_id',
          'assigned_company_id',
          'awarded_carrier_company_id',
          'client_name',
          'pickup_location',
          'delivery_location',
          'pickup_datetime',
          'delivery_datetime',
          'vehicle_type',
          'updated_at',
          'status_history',
          'on_my_way_at',
          'on_site_pickup_at',
          'loaded_at',
          'on_site_delivery_at',
          'delivered_at',
          'completed_at',
          'pod_required',
          'pod_generated',
          'pod_generated_at',
        ].join(', ')
      )
      .or(
        'company_id.eq.' +
          companyId +
          ',assigned_company_id.eq.' +
          companyId +
          ',awarded_carrier_company_id.eq.' +
          companyId
      )
      .order('updated_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error('Failed to load diary jobs:', error.message);
      setJobs([]);
      setLoading(false);
      return;
    }

    setJobs(Array.isArray(data) ? (data as unknown as DiaryJob[]) : []);
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    void loadJobs();

    if (!isSupabaseConfigured || !companyId) return;

    const channel = supabase
      .channel(`diary-jobs-${companyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs',
        },
        () => {
          void loadJobs();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [companyId, loadJobs]);

  useEffect(() => {
    const loadDrivers = async () => {
      if (!isSupabaseConfigured || !companyId) {
        setDrivers([]);
        return;
      }

      const { data, error } = await supabase
        .from('drivers')
        .select('id, display_name')
        .eq('company_id', companyId)
        .eq('status', 'active')
        .order('display_name', { ascending: true });

      if (error) {
        console.error('Failed to load diary drivers:', error.message);
        setDrivers([]);
        return;
      }

      setDrivers((data as DriverOption[]) ?? []);
    };

    void loadDrivers();
  }, [companyId]);

  const handleAssignDriver = async (job: DiaryJob) => {
    const selectedDriverId = assignmentDrafts[job.id] ?? '';
    if (!companyId || !selectedDriverId) return;

    setAssigningJobId(job.id);
    setAssignmentMessage('');

    const { error } = await supabase
      .from('jobs')
      .update(
        buildDriverAssignmentUpdate({
          assignedDriverId: selectedDriverId,
          currentStatus: job.status,
        })
      )
      .eq('id', job.id)
      .eq('company_id', companyId);

    if (error) {
      console.error('Failed to assign driver from diary:', error.message);
      setAssignmentMessage(`Failed to assign driver: ${error.message}`);
      setAssigningJobId(null);
      return;
    }

    setAssignmentDrafts((prev) => ({ ...prev, [job.id]: '' }));
    setAssignmentMessage('Driver assigned from diary.');
    setAssigningJobId(null);
    await loadJobs();
  };

  const handleWorkflowAction = async (job: DiaryJob, action: WorkflowAction) => {
    if (!companyId) return;

    const now = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      status: action.nextStatus,
      current_status: action.nextStatus,
      status_updated_at: now,
      updated_at: now,
      [action.timestampField]: now,
      status_history: appendStatusHistory(job.status_history, {
        status: action.nextStatus,
        label: action.label,
        timestamp: now,
        actor_user_id: user?.id ?? null,
      }),
    };

    setWorkflowJobId(job.id);
    setAssignmentMessage('');

    const { error } = await supabase
      .from('jobs')
      .update(updatePayload)
      .eq('id', job.id)
      .or(
        'company_id.eq.' +
          companyId +
          ',assigned_company_id.eq.' +
          companyId +
          ',awarded_carrier_company_id.eq.' +
          companyId
      );

    if (error) {
      console.error('Failed to update workflow status:', error.message);
      setAssignmentMessage(`Failed to update job status: ${error.message}`);
      setWorkflowJobId(null);
      return;
    }

    setAssignmentMessage(`Job updated: ${action.label}.`);
    setWorkflowJobId(null);
    await loadJobs();
  };

  const grouped = useMemo(() => {
    const map = new Map<string, DiaryJob[]>();

    for (const lane of LANE_CONFIG) map.set(lane.key, []);

    for (const job of jobs) {
      const lane = LANE_CONFIG.find((item) => item.statuses.includes(normalizeStatus(job.status)));
      if (lane) {
        map.get(lane.key)?.push(job);
      }
    }

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
        {/* Left panel: Search */}
        <aside style={{ width: '200px', flexShrink: 0, background: '#fff', borderRight: '1px solid #e2e8f0', padding: '0.85rem', overflowY: 'auto', fontSize: '0.78rem' }}>
          <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.6rem', fontSize: '0.8rem' }}>📋 Search Panel</div>

          <div style={{ marginBottom: '0.55rem' }}>
            <div style={labelStyle}>View</div>
            <select style={panelInput}>
              <option>All</option>
              <option>Jobs Sub-contracted</option>
              <option>Our Bookings</option>
            </select>
          </div>

          <div style={{ marginBottom: '0.55rem' }}>
            <div style={labelStyle}>Date</div>
            <select style={panelInput}>
              <option>Anytime</option>
              <option>Today</option>
              <option>This Week</option>
              <option>Last 30 Days</option>
            </select>
          </div>

          <div style={{ marginBottom: '0.55rem' }}>
            <div style={labelStyle}>Pickup Time Within</div>
            <select style={panelInput}>
              <option>Any</option>
              <option>1 hour</option>
              <option>2 hours</option>
              <option>4 hours</option>
            </select>
          </div>

          <div style={{ marginBottom: '0.55rem' }}>
            <div style={labelStyle}>Load ID / Ref</div>
            <input placeholder="Search…" style={panelInput} />
          </div>

          <div style={{ marginBottom: '0.55rem' }}>
            <div style={labelStyle}>Driver</div>
            <select style={panelInput}>
              <option value="">Any driver</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>{driver.display_name}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '0.85rem' }}>
            <div style={labelStyle}>Customer Name</div>
            <input placeholder="Search…" style={panelInput} />
          </div>

          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              onClick={() => void loadJobs()}
              style={{ flex: 1, background: '#16a34a', color: '#fff', border: 'none', borderRadius: '5px', padding: '0.5rem', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}
            >
              Search
            </button>
            <button
              style={{ padding: '0.5rem 0.65rem', border: '1px solid #e2e8f0', borderRadius: '5px', background: '#fff', cursor: 'pointer', fontSize: '0.78rem', color: '#64748b' }}
            >
              Clear
            </button>
          </div>
        </aside>

        {/* Main diary content */}
        <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          {/* Header bar */}
          <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0.45rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: '1rem' }}>
            <div style={{ fontSize: '0.82rem', color: '#374151', fontWeight: 600 }}>
              📅 Diary — {jobs.length} bookings
            </div>
            <button
              onClick={() => void loadJobs()}
              style={{ padding: '0.28rem 0.6rem', border: '1px solid #e2e8f0', borderRadius: '5px', background: '#fff', cursor: 'pointer', fontSize: '0.73rem', color: '#64748b' }}
            >
              ↻ Refresh
            </button>
          </div>

          {/* Status tab bar */}
          <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 0.85rem', display: 'flex', alignItems: 'center', flexShrink: 0, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {[{ key: 'all', label: 'All', count: jobs.length }, ...LANE_CONFIG.map((lane) => ({ key: lane.key, label: lane.label, count: (grouped.get(lane.key) ?? []).length }))].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '0.6rem 0.8rem',
                  border: 'none',
                  borderBottom: activeTab === tab.key ? '2px solid #1d4ed8' : '2px solid transparent',
                  background: 'none',
                  cursor: 'pointer',
                  fontSize: '0.73rem',
                  fontWeight: 700,
                  color: activeTab === tab.key ? '#1d4ed8' : '#64748b',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  marginBottom: '-1px',
                }}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span style={{ marginLeft: '0.3rem', background: activeTab === tab.key ? '#dbeafe' : '#f1f5f9', color: activeTab === tab.key ? '#1d4ed8' : '#64748b', borderRadius: '8px', padding: '0.05rem 0.4rem', fontSize: '0.68rem' }}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Assignment / workflow message */}
          {assignmentMessage && (
            <div style={{ margin: '0.5rem 0.85rem', padding: '0.5rem 0.85rem', borderRadius: '6px', background: assignmentMessage.startsWith('Failed') ? '#fee2e2' : '#dcfce7', color: assignmentMessage.startsWith('Failed') ? '#991b1b' : '#166534', fontSize: '0.82rem', fontWeight: 600 }}>
              {assignmentMessage}
            </div>
          )}

          {/* Job list */}
          <div style={{ padding: '0.75rem', flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ background: '#fff', borderRadius: '8px', padding: '2rem', textAlign: 'center', color: '#64748b', border: '1px solid #e2e8f0' }}>Loading diary…</div>
            ) : filteredJobs.length === 0 ? (
              <div style={{ background: '#fff', borderRadius: '8px', padding: '2.5rem', textAlign: 'center', color: '#64748b', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</div>
                <div style={{ fontSize: '0.88rem' }}>No bookings in this category.</div>
              </div>
            ) : (
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
                      {/* Job details — 3 columns */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.75rem', padding: '0.75rem 1rem', alignItems: 'start' }}>
                        {/* Column 1: From / To */}
                        <div>
                          <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'baseline' }}>
                            <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 700, minWidth: '28px' }}>From:</span>
                            <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.85rem' }}>{job.client_name || 'Contact N/A'}</span>
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#374151', marginLeft: '36px', marginTop: '0.1rem' }}>{job.pickup_location || '—'}</div>
                          <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'baseline', marginTop: '0.4rem' }}>
                            <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 700, minWidth: '28px' }}>To:</span>
                            <span style={{ fontWeight: 600, color: '#374151', fontSize: '0.82rem' }}>{job.delivery_location || '—'}</span>
                          </div>
                        </div>

                        {/* Column 2: Dates / workflow timestamps */}
                        <div>
                          <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'baseline' }}>
                            <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 700, minWidth: '58px' }}>Pickup:</span>
                            <span style={{ fontSize: '0.8rem', color: '#374151' }}>{formatDate(job.pickup_datetime ?? job.updated_at)}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'baseline', marginTop: '0.2rem' }}>
                            <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 700, minWidth: '58px' }}>Vehicle:</span>
                            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>{job.vehicle_type ? job.vehicle_type.replace(/_/g, ' ') : '—'}</span>
                          </div>
                          <div style={{ marginTop: '0.35rem', fontSize: '0.68rem', color: '#64748b', lineHeight: 1.35 }}>
                            {job.on_my_way_at && <div>On way: {formatDateTime(job.on_my_way_at)}</div>}
                            {job.on_site_pickup_at && <div>Pickup site: {formatDateTime(job.on_site_pickup_at)}</div>}
                            {job.loaded_at && <div>Loaded: {formatDateTime(job.loaded_at)}</div>}
                            {job.on_site_delivery_at && <div>Delivery site: {formatDateTime(job.on_site_delivery_at)}</div>}
                            {job.delivered_at && <div>Delivered: {formatDateTime(job.delivered_at)}</div>}
                          </div>
                        </div>

                        {/* Column 3: Status badge + load ID */}
                        <div style={{ minWidth: '140px', textAlign: 'right' }}>
                          <span style={{ display: 'inline-block', background: badge.bg, color: badge.color, padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.73rem', fontWeight: 700 }}>
                            {badge.label}
                          </span>
                          <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '0.4rem' }}>
                            Load ID: {job.id.slice(0, 8).toUpperCase()}
                          </div>
                        </div>
                      </div>

                      {/* Footer: assign driver + action buttons */}
                      <div style={{ borderTop: '1px solid #f1f5f9', padding: '0.4rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fafbfc', flexWrap: 'wrap' }}>
                        {isUnallocated && (
                          <>
                            <select
                              value={assignmentDrafts[job.id] ?? ''}
                              onChange={(event) => setAssignmentDrafts((prev) => ({ ...prev, [job.id]: event.target.value }))}
                              style={{ padding: '0.28rem 0.5rem', border: '1px solid #e2e8f0', borderRadius: '5px', fontSize: '0.75rem', background: '#fff', color: '#374151', maxWidth: '180px' }}
                            >
                              <option value="">Assign driver…</option>
                              {drivers.map((driver) => (
                                <option key={driver.id} value={driver.id}>{driver.display_name}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => void handleAssignDriver(job)}
                              disabled={!assignmentDrafts[job.id] || assigningJobId === job.id}
                              style={{ padding: '0.28rem 0.65rem', border: 'none', borderRadius: '5px', background: !assignmentDrafts[job.id] ? '#e2e8f0' : '#0f766e', color: !assignmentDrafts[job.id] ? '#94a3b8' : '#fff', cursor: !assignmentDrafts[job.id] ? 'not-allowed' : 'pointer', fontSize: '0.73rem', fontWeight: 700 }}
                            >
                              {assigningJobId === job.id ? 'Assigning…' : 'Assign'}
                            </button>
                            <div style={{ width: '1px', height: '20px', background: '#e2e8f0' }} />
                          </>
                        )}

                        {workflowAction && actionStyle && (
                          <button
                            onClick={() => void handleWorkflowAction(job, workflowAction)}
                            disabled={workflowBusy}
                            style={{ padding: '0.28rem 0.7rem', border: `1px solid ${actionStyle.border}`, borderRadius: '5px', background: workflowBusy ? '#e2e8f0' : actionStyle.bg, color: workflowBusy ? '#94a3b8' : actionStyle.color, cursor: workflowBusy ? 'not-allowed' : 'pointer', fontSize: '0.73rem', fontWeight: 800 }}
                          >
                            {workflowBusy ? 'Updating…' : workflowAction.label}
                          </button>
                        )}

                        {normalizeStatus(job.status) === 'delivered' && (
                          <button
                            onClick={() => router.push(`/admin/jobs/${job.id}`)}
                            style={{ padding: '0.28rem 0.7rem', border: '1px solid #16a34a', borderRadius: '5px', background: '#fff', cursor: 'pointer', fontSize: '0.73rem', color: '#166534', fontWeight: 800 }}
                          >
                            Upload POD
                          </button>
                        )}

                        <div style={{ width: '1px', height: '20px', background: '#e2e8f0' }} />

                        {[
                          { label: 'Order', href: `/admin/jobs/${job.id}` },
                          { label: 'Notes', href: `/admin/jobs/${job.id}` },
                          { label: 'History', href: `/admin/jobs/${job.id}` },
                          { label: 'Documents', href: `/admin/documents` },
                        ].map(({ label, href }) => (
                          <button
                            key={label}
                            onClick={() => router.push(href)}
                            style={{ padding: '0.28rem 0.6rem', border: '1px solid #e2e8f0', borderRadius: '5px', background: '#fff', cursor: 'pointer', fontSize: '0.73rem', color: '#374151', fontWeight: 600 }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: '0.65rem',
  fontWeight: 700,
  color: '#94a3b8',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: '0.2rem',
};

const panelInput: React.CSSProperties = {
  width: '100%',
  padding: '0.35rem 0.45rem',
  border: '1px solid #e2e8f0',
  borderRadius: '4px',
  fontSize: '0.76rem',
  color: '#374151',
  background: '#fff',
  marginBottom: '0',
  boxSizing: 'border-box',
};

