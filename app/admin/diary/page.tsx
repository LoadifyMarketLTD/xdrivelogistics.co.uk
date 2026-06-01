'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { resolveActiveCompanyId } from '../../../lib/activeCompany';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';

type DiaryJob = {
  id: string;
  status: string;
  client_name: string | null;
  pickup_location: string | null;
  delivery_location: string | null;
  vehicle_type: string | null;
  updated_at: string;
};

const LANE_CONFIG: Array<{ key: string; label: string; statuses: string[] }> = [
  { key: 'unallocated', label: 'Unallocated', statuses: ['draft', 'received', 'posted'] },
  { key: 'allocated', label: 'Allocated', statuses: ['allocated'] },
  { key: 'inProgress', label: 'In Progress', statuses: ['in_transit'] },
  { key: 'completed', label: 'Completed', statuses: ['delivered'] },
  { key: 'cancelled', label: 'Cancelled', statuses: ['cancelled'] },
  { key: 'awaitingFeedback', label: 'Awaiting Feedback', statuses: ['disputed'] },
];

export default function DiaryPage() {
  const router = useRouter();
  const { user, hasSupabaseSession } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<DiaryJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasSupabaseSession || !user?.id) return;
    if (user.companyId) {
      setCompanyId(user.companyId);
      return;
    }
    resolveActiveCompanyId({ userId: user.id, fallbackCompanyId: null }).then(setCompanyId);
  }, [hasSupabaseSession, user?.id, user?.companyId]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      if (!isSupabaseConfigured || !companyId) {
        setJobs([]);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('jobs')
        .select('id, status, client_name, pickup_location, delivery_location, vehicle_type, updated_at')
        .eq('company_id', companyId)
        .order('updated_at', { ascending: false })
        .limit(200);
      setJobs((data as DiaryJob[]) ?? []);
      setLoading(false);
    };
    void load();

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
          void load();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [companyId]);

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '2rem', color: '#111827' }}>Diary / Operations</h1>
            <p style={{ margin: '0.35rem 0 0 0', color: '#6b7280' }}>Live working board grouped by operational status.</p>
          </div>
          <button onClick={() => router.push('/admin/jobs')} style={{ padding: '0.65rem 1rem', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer', background: '#fff', color: '#0f172a', fontWeight: 600 }}>
            Open Jobs / Loads
          </button>
        </div>

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
                        <button
                          key={job.id}
                          onClick={() => router.push(`/admin/jobs/${job.id}`)}
                          style={{ textAlign: 'left', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0.65rem', background: '#f8fafc', cursor: 'pointer' }}
                        >
                          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{job.client_name || 'No customer'}</div>
                          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#111827', marginTop: '0.2rem' }}>{job.pickup_location || '—'} → {job.delivery_location || '—'}</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.35rem', color: '#6b7280', fontSize: '0.72rem' }}>
                            <span>{job.vehicle_type ? job.vehicle_type.replace(/_/g, ' ') : 'Vehicle n/a'}</span>
                            <span>{new Date(job.updated_at).toLocaleDateString('en-GB')}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
