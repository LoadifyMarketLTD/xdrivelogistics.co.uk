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
  assigned_driver_id: string | null;
  client_name: string | null;
  pickup_location: string | null;
  delivery_location: string | null;
  vehicle_type: string | null;
  updated_at: string;
};

type DriverOption = {
  id: string;
  display_name: string;
};

const LANE_CONFIG: Array<{ key: string; label: string; statuses: string[] }> = [
  { key: 'unallocated', label: 'Needs Assigning', statuses: ['draft', 'received', 'posted'] },
  { key: 'allocated', label: 'Assigned', statuses: ['allocated'] },
  { key: 'inProgress', label: 'On The Road', statuses: ['in_transit'] },
  { key: 'completed', label: 'Completed', statuses: ['delivered'] },
  { key: 'cancelled', label: 'Cancelled', statuses: ['cancelled'] },
  { key: 'awaitingFeedback', label: 'Attention', statuses: ['disputed'] },
];

export default function DiaryPage() {
  const router = useRouter();
  const { user, hasSupabaseSession } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<DiaryJob[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, string>>({});
  const [assignmentMessage, setAssignmentMessage] = useState('');
  const [assigningJobId, setAssigningJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasSupabaseSession || !user?.id) return;
    if (user.companyId) {
      setCompanyId(user.companyId);
      return;
    }
    resolveActiveCompanyId({ userId: user.id, fallbackCompanyId: null }).then(setCompanyId);
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
      .select('id, status, assigned_driver_id, client_name, pickup_location, delivery_location, vehicle_type, updated_at')
      .eq('company_id', companyId)
      .order('updated_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error('Failed to load diary jobs:', error.message);
      setJobs([]);
      setLoading(false);
      return;
    }

    setJobs((data as DiaryJob[]) ?? []);
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
          filter: `company_id=eq.${companyId}`,
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

  const grouped = useMemo(() => {
    const map = new Map<string, DiaryJob[]>();
    for (const lane of LANE_CONFIG) map.set(lane.key, []);
    for (const job of jobs) {
      const lane = LANE_CONFIG.find((item) => item.statuses.includes((job.status || '').toLowerCase()));
      if (lane) {
        map.get(lane.key)?.push(job);
      }
    }
    return map;
  }, [jobs]);

  return (
    <ProtectedRoute>
      <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', padding: '1.5rem' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '2rem', color: '#111827' }}>Allocation Diary</h1>
            <p style={{ margin: '0.35rem 0 0 0', color: '#6b7280' }}>Assign work first, then follow each lane through to completion.</p>
          </div>
        </div>
        {assignmentMessage && (
          <div
            style={{
              marginBottom: '1rem',
              borderRadius: '10px',
              padding: '0.8rem 1rem',
              background: assignmentMessage.startsWith('Failed') ? '#fee2e2' : '#dcfce7',
              color: assignmentMessage.startsWith('Failed') ? '#991b1b' : '#166534',
              fontWeight: 600,
            }}
          >
            {assignmentMessage}
          </div>
        )}

        {loading ? (
          <div style={{ background: '#fff', borderRadius: '12px', padding: '2rem', color: '#6b7280' }}>Loading diary…</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.8rem' }}>
            {LANE_CONFIG.map((lane) => {
              const laneJobs = grouped.get(lane.key) ?? [];
              return (
                <section key={lane.key} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '0.8rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.7rem' }}>
                    <h2 style={{ margin: 0, fontSize: '1rem', color: '#111827' }}>{lane.label}</h2>
                    <span style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 600 }}>{laneJobs.length}</span>
                  </div>
                  {laneJobs.length === 0 ? (
                    <div style={{ padding: '0.8rem', borderRadius: '8px', background: '#f9fafb', color: '#6b7280', fontSize: '0.85rem' }}>No jobs in this lane.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: '0.55rem' }}>
                      {laneJobs.map((job) => (
                        <div
                          key={job.id}
                          style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0.65rem', background: '#f8fafc' }}
                        >
                          <button
                            onClick={() => router.push(`/admin/jobs/${job.id}`)}
                            style={{ width: '100%', textAlign: 'left', border: 'none', padding: 0, background: 'transparent', cursor: 'pointer' }}
                          >
                            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{job.client_name || 'No customer'}</div>
                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#111827', marginTop: '0.2rem' }}>{job.pickup_location || '—'} → {job.delivery_location || '—'}</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.35rem', color: '#6b7280', fontSize: '0.72rem' }}>
                              <span>{job.vehicle_type ? job.vehicle_type.replace(/_/g, ' ') : 'Vehicle n/a'}</span>
                              <span>{new Date(job.updated_at).toLocaleDateString('en-GB')}</span>
                            </div>
                          </button>
                          {lane.key === 'unallocated' && (
                            <div style={{ marginTop: '0.7rem', display: 'grid', gap: '0.45rem' }}>
                              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155' }}>Assign driver</label>
                              <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                                <select
                                  value={assignmentDrafts[job.id] ?? ''}
                                  onChange={(event) =>
                                    setAssignmentDrafts((prev) => ({
                                      ...prev,
                                      [job.id]: event.target.value,
                                    }))
                                  }
                                  style={{
                                    flex: 1,
                                    minWidth: '150px',
                                    padding: '0.55rem 0.65rem',
                                    borderRadius: '8px',
                                    border: '1px solid #cbd5e1',
                                    background: '#fff',
                                  }}
                                >
                                  <option value="">Select active driver…</option>
                                  {drivers.map((driver) => (
                                    <option key={driver.id} value={driver.id}>
                                      {driver.display_name}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  disabled={!assignmentDrafts[job.id] || assigningJobId === job.id}
                                  onClick={() => void handleAssignDriver(job)}
                                  style={{
                                    padding: '0.55rem 0.9rem',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: !assignmentDrafts[job.id] || assigningJobId === job.id ? '#cbd5e1' : '#0f766e',
                                    color: '#fff',
                                    cursor: !assignmentDrafts[job.id] || assigningJobId === job.id ? 'not-allowed' : 'pointer',
                                    fontWeight: 700,
                                  }}
                                >
                                  {assigningJobId === job.id ? 'Assigning…' : 'Assign'}
                                </button>
                              </div>
                              {drivers.length === 0 && (
                                <span style={{ fontSize: '0.72rem', color: '#b45309' }}>
                                  No active drivers available for assignment.
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
