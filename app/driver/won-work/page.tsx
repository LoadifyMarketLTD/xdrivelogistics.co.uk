'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';

//  Types

type WonJob = {
  id: string;
  pickup_location: string | null;
  delivery_location: string | null;
  pickup_datetime: string | null;
  vehicle_type: string | null;
  cargo_type: string | null;
  status: string;
  currency: string;
  budget_amount: number | null;
  company_id: string;
  awarded_carrier_company_id: string | null;
  created_at: string;
  companies: { name: string } | null;
  assigned_driver_id: string | null;
};

//  Helpers

const STATUS_LABELS: Record<string, string> = {
  draft:     'Received',
  posted:    'Posted',
  allocated: 'Allocated',
  in_transit:'In Transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  disputed:  'Disputed',
};

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  draft:     { bg: '#f3f4f6', color: '#374151' },
  posted:    { bg: '#ede9fe', color: '#6d28d9' },
  allocated: { bg: '#dbeafe', color: '#1d4ed8' },
  in_transit:{ bg: '#fef3c7', color: '#b45309' },
  delivered: { bg: '#dcfce7', color: '#15803d' },
  cancelled: { bg: '#fee2e2', color: '#dc2626' },
  disputed:  { bg: '#ede9fe', color: '#7c3aed' },
};

const VEHICLE_LABELS: Record<string, string> = {
  bicycle: 'Bicycle', motorbike: 'Motorbike', car: 'Car',
  van_small: 'Small Van', van_large: 'Large Van', luton: 'Luton Van',
  truck_7_5t: '7.5t Truck', truck_18t: '18t Truck', artic: 'Artic',
};

function fmtDate(value: string | null) {
  if (!value) return '-';
  try { return new Date(value).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  catch { return value; }
}

const card: CSSProperties = {
  backgroundColor: '#ffffff',
  border: '1px solid #d7e0ea',
  borderRadius: '10px',
  padding: '1rem',
  boxShadow: '0 2px 8px rgba(15,23,42,0.06)',
};

//  Component

export default function WonWorkPage() {
  const { user } = useAuth();
  const router = useRouter();  const driverId = typeof user?.driverId === 'string' ? user.driverId.trim() : '';

  const [jobs, setJobs] = useState<WonJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchWonWork = useCallback(async () => {
    if (!isSupabaseConfigured || !driverId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');

    const { data, error: fetchError } = await supabase
      .from('jobs')
      .select('id, pickup_location, delivery_location, pickup_datetime, vehicle_type, cargo_type, status, currency, budget_amount, company_id, awarded_carrier_company_id, created_at, assigned_driver_id, companies:companies!jobs_company_id_fkey(name)')
      .eq('assigned_driver_id', driverId)
      .in('status', ['allocated', 'collected', 'in_transit', 'delivered'])
      .order('pickup_datetime', { ascending: false })
      .limit(100);

    if (fetchError) {
      setError(`Failed to load jobs: ${fetchError.message}`);
    } else {
      const normalized = ((data ?? []) as unknown as WonJob[]).map((job) => ({
        ...job,
        companies: Array.isArray(job.companies)
          ? ((job.companies as Array<{ name: string }>)[0] ?? null)
          : (job.companies as { name: string } | null),
      }));
      setJobs(normalized);
    }
    setLoading(false);
  }, [driverId]);
  useEffect(() => {
    void fetchWonWork();
  }, [fetchWonWork]);

  // Pipeline summary counts
  const pipelineCounts = {
    active: jobs.filter((j) => ['allocated', 'collected', 'in_transit'].includes(j.status)).length,
    pending: 0,
    completed: jobs.filter((j) => j.status === 'delivered').length,
    total: jobs.length,
  };

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell
        subtitle="Active and completed jobs assigned to you."
      >
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.35rem', fontWeight: 700, color: '#0f172a' }}>Jobs</h2>

        {/* Pipeline summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.65rem', marginBottom: '1rem' }}>
          {[
            { label: 'Active',     value: pipelineCounts.active,    color: '#1d4ed8', bg: '#dbeafe' },
            { label: 'Pending',    value: pipelineCounts.pending,   color: '#b45309', bg: '#fef3c7' },
            { label: 'Completed',  value: pipelineCounts.completed, color: '#15803d', bg: '#dcfce7' },
            { label: 'Total',  value: pipelineCounts.total,     color: '#374151', bg: '#f3f4f6' },
          ].map((item) => (
            <div key={item.label} style={{ ...card, borderTop: `3px solid ${item.color}`, textAlign: 'center', padding: '0.8rem' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: item.color }}>{loading ? '...' : item.value}</div>
              <div style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 600, marginTop: '0.15rem' }}>{item.label}</div>
            </div>
          ))}
        </div>

        {error && (
          <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '8px', padding: '0.7rem', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ color: '#64748b', padding: '2rem', textAlign: 'center' }}>Loading jobs...</div>
        ) : jobs.length === 0 ? (
          <div style={{ ...card, textAlign: 'center', padding: '2.5rem' }}>
            <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.3rem' }}>No jobs yet</div>
            <div style={{ fontSize: '0.84rem', color: '#64748b' }}>
              Assigned work will appear here when it is ready.
            </div>
            <button
              onClick={() => router.push('/driver/loads')}
              style={{ marginTop: '1rem', padding: '0.55rem 1.2rem', backgroundColor: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '7px', fontWeight: 700, cursor: 'pointer' }}
            >
              Open Loads
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '0.7rem' }}>
            {jobs.map((job) => {
              const statusStyle = STATUS_STYLES[job.status] ?? { bg: '#f3f4f6', color: '#374151' };
              const isActive = ['allocated', 'in_transit'].includes(job.status);
              return (
                <div key={job.id} style={{ ...card, borderLeft: `3px solid ${statusStyle.color}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.65rem' }}>
                    <div>
                      <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.92rem' }}>#{job.id.slice(0, 8).toUpperCase()}</span>
                      <span style={{ marginLeft: '0.5rem', fontSize: '0.72rem', fontWeight: 700, backgroundColor: statusStyle.bg, color: statusStyle.color, padding: '0.12rem 0.45rem', borderRadius: '999px' }}>
                        {STATUS_LABELS[job.status] ?? job.status}
                      </span>
                      {job.companies?.name && (
                        <span style={{ marginLeft: '0.4rem', fontSize: '0.72rem', color: '#64748b' }}>- {job.companies.name}</span>
                      )}
                    </div>
                    {job.budget_amount != null && (
                      <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#15803d' }}>GBP {job.budget_amount.toFixed(2)}</span>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.55rem', marginBottom: '0.65rem' }}>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginBottom: '0.1rem' }}>Pickup</div>
                      <div style={{ fontSize: '0.83rem', color: '#0f172a', fontWeight: 600 }}>{job.pickup_location ?? '-'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginBottom: '0.1rem' }}>Delivery</div>
                      <div style={{ fontSize: '0.83rem', color: '#0f172a', fontWeight: 600 }}>{job.delivery_location ?? '-'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginBottom: '0.1rem' }}>Date</div>
                      <div style={{ fontSize: '0.83rem', color: '#0f172a' }}>{fmtDate(job.pickup_datetime)}</div>
                    </div>
                    {job.vehicle_type && (
                      <div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginBottom: '0.1rem' }}>Vehicle</div>
                        <div style={{ fontSize: '0.83rem', color: '#0f172a' }}>{VEHICLE_LABELS[job.vehicle_type] ?? job.vehicle_type}</div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {isActive && (
                      <button
                        onClick={() => router.push(`/driver/jobs/${job.id}`)}
                        style={{ padding: '0.45rem 0.9rem', backgroundColor: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}
                      >
                        Open Active Job
                      </button>
                    )}
                    <button
                      onClick={() => router.push('/driver/jobs')}
                      style={{ padding: '0.45rem 0.9rem', backgroundColor: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.82rem' }}
                    >
                      View Active Jobs
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
