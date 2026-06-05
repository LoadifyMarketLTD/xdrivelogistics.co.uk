'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';

// ── Types ─────────────────────────────────────────────────────────────────────

type HistoryJob = {
  id: string;
  status: string;
  pickup_location: string | null;
  delivery_location: string | null;
  collection_window_start: string | null;
  delivery_window_start: string | null;
  deadline_at: string | null;
  budget_amount: number | null;
  updated_at: string | null;
  created_at: string | null;
  delivery_photos: string[] | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  delivered: 'Delivered', cancelled: 'Cancelled', disputed: 'Disputed', driver_declined: 'Declined',
};

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  delivered:       { bg: '#dcfce7', color: '#15803d' },
  cancelled:       { bg: '#fee2e2', color: '#dc2626' },
  disputed:        { bg: '#ede9fe', color: '#7c3aed' },
  driver_declined: { bg: '#fee2e2', color: '#b91c1c' },
};

function fmtDate(value: string | null) {
  if (!value) return '—';
  try { return new Date(value).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return value; }
}

const card: CSSProperties = {
  backgroundColor: '#ffffff',
  border: '1px solid #d7e0ea',
  borderRadius: '10px',
  padding: '1rem',
  boxShadow: '0 2px 8px rgba(15,23,42,0.06)',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function JobHistoryPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [driverId, setDriverId] = useState('');
  const [jobs, setJobs] = useState<HistoryJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Totals
  const [earnings, setEarnings] = useState({ total: 0, delivered: 0 });

  const fetchHistory = useCallback(async () => {
    if (!driverId || !isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');

    const { data, error: fetchError } = await supabase
      .from('jobs')
      .select('id, status, pickup_location, delivery_location, collection_window_start, delivery_window_start, deadline_at, budget_amount, updated_at, created_at, delivery_photos')
      .eq('assigned_driver_id', driverId)
      .in('status', ['delivered', 'cancelled', 'disputed', 'driver_declined'])
      .order('updated_at', { ascending: false })
      .limit(200);

    if (fetchError) {
      setError(`Failed to load history: ${fetchError.message}`);
    } else {
      const rows = (data ?? []) as HistoryJob[];
      setJobs(rows);
      const total = rows
        .filter((j) => j.status === 'delivered')
        .reduce((sum, j) => sum + (j.budget_amount ?? 0), 0);
      setEarnings({ total, delivered: rows.filter((j) => j.status === 'delivered').length });
    }
    setLoading(false);
  }, [driverId]);

  useEffect(() => {
    if (user?.driverId) setDriverId(user.driverId);
  }, [user?.driverId]);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  const visibleJobs = statusFilter === 'all' ? jobs : jobs.filter((j) => j.status === statusFilter);

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell
        subtitle="Full record of all completed, cancelled, and closed jobs."
      >
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.35rem', fontWeight: 700, color: '#0f172a' }}>Job History</h2>

        {/* Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.65rem', marginBottom: '1rem' }}>
          {[
            { label: 'Completed',     value: earnings.delivered, color: '#15803d' },
            { label: 'Total earned',  value: `£${earnings.total.toFixed(2)}`, color: '#1d4ed8' },
            { label: 'All history',   value: jobs.length, color: '#374151' },
          ].map((item) => (
            <div key={item.label} style={{ ...card, borderTop: `3px solid ${item.color}`, padding: '0.8rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: item.color }}>{loading ? '…' : item.value}</div>
              <div style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 600, marginTop: '0.15rem' }}>{item.label}</div>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.85rem' }}>
          {[
            { id: 'all',            label: 'All' },
            { id: 'delivered',      label: 'Delivered' },
            { id: 'cancelled',      label: 'Cancelled' },
            { id: 'disputed',       label: 'Disputed' },
            { id: 'driver_declined',label: 'Declined' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              style={{
                padding: '0.4rem 0.8rem',
                borderRadius: '7px',
                border: statusFilter === f.id ? '1.5px solid #1d4ed8' : '1px solid #e2e8f0',
                backgroundColor: statusFilter === f.id ? '#eff6ff' : '#ffffff',
                color: statusFilter === f.id ? '#1d4ed8' : '#374151',
                fontWeight: statusFilter === f.id ? 700 : 500,
                cursor: 'pointer',
                fontSize: '0.8rem',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {error && (
          <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '8px', padding: '0.7rem', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ color: '#64748b', padding: '2rem', textAlign: 'center' }}>Loading history…</div>
        ) : visibleJobs.length === 0 ? (
          <div style={{ ...card, textAlign: 'center', padding: '2.5rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📚</div>
            <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.3rem' }}>No history</div>
            <div style={{ fontSize: '0.84rem', color: '#64748b' }}>Completed and closed jobs will appear here.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '0.65rem' }}>
            {visibleJobs.map((job) => {
              const statusStyle = STATUS_STYLES[job.status] ?? { bg: '#f3f4f6', color: '#374151' };
              const hasPOD = Array.isArray(job.delivery_photos) && job.delivery_photos.length > 0;
              const jobDate = job.updated_at ?? job.deadline_at ?? job.delivery_window_start ?? job.created_at;
              return (
                <button
                  key={job.id}
                  onClick={() => router.push(`/driver/jobs/${job.id}`)}
                  style={{
                    ...card,
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: '0.75rem',
                    alignItems: 'center',
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                    borderLeft: `3px solid ${statusStyle.color}`,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem' }}>#{job.id.slice(0, 8).toUpperCase()}</span>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, backgroundColor: statusStyle.bg, color: statusStyle.color, padding: '0.1rem 0.4rem', borderRadius: '999px' }}>
                        {STATUS_LABELS[job.status] ?? job.status}
                      </span>
                      {hasPOD && <span style={{ fontSize: '0.7rem', color: '#15803d', fontWeight: 600 }}>📷 POD</span>}
                      {job.budget_amount != null && (
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#15803d' }}>£{job.budget_amount.toFixed(2)}</span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#374151' }}>
                      {job.pickup_location ?? '—'} → {job.delivery_location ?? '—'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.15rem' }}>{fmtDate(jobDate)}</div>
                  </div>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>→</span>
                </button>
              );
            })}
          </div>
        )}
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
