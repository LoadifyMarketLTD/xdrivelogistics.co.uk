'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';

type LifecycleGroup = 'upcoming' | 'active' | 'completed' | 'cancelled' | 'other';

type WonJob = {
  id: string;
  reference: string;
  pickupLocation: string | null;
  deliveryLocation: string | null;
  pickupTime: string | null;
  vehicleType: string | null;
  cargoType: string | null;
  canonicalStatus: string;
  lifecycleGroup: LifecycleGroup;
  agreedRateAmount: number | null;
  currency: string;
  postingCompanyName: string | null;
};

type WonWorkResponse = {
  jobs?: WonJob[];
  commercialRatePartial?: boolean;
  error?: string;
};

const STATUS_LABELS: Record<string, string> = {
  awarded: 'Awarded',
  allocated: 'Allocated',
  on_my_way: 'On my way to pickup',
  on_site_pickup: 'On site pickup',
  loaded: 'Loaded',
  in_transit: 'In transit',
  on_site_delivery: 'On site delivery',
  delivered: 'Delivered',
  completed: 'Completed',
};

const GROUP_STYLES: Record<LifecycleGroup, { bg: string; color: string }> = {
  upcoming: { bg: '#dbeafe', color: '#1d4ed8' },
  active: { bg: '#fef3c7', color: '#b45309' },
  completed: { bg: '#dcfce7', color: '#15803d' },
  cancelled: { bg: '#fee2e2', color: '#dc2626' },
  other: { bg: '#f3f4f6', color: '#374151' },
};

const VEHICLE_LABELS: Record<string, string> = {
  bicycle: 'Bicycle',
  motorbike: 'Motorbike',
  car: 'Car',
  van_small: 'Small Van',
  van_large: 'Large Van',
  swb_van: 'SWB Van',
  mwb_van: 'MWB Van',
  lwb_van: 'LWB Van',
  xlwb_van: 'XLWB Van',
  luton: 'Luton Van',
  luton_tail_lift: 'Luton Tail Lift',
  truck_7_5t: '7.5t Truck',
  truck_18t: '18t Truck',
  artic: 'Artic',
};

function fmtDate(value: string | null) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

function fmtRate(value: number | null, currency: string) {
  if (value == null || !Number.isFinite(value) || value <= 0) return 'Agreed rate TBC';
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency || 'GBP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `GBP ${value.toFixed(2)}`;
  }
}

const card: CSSProperties = {
  backgroundColor: '#ffffff',
  border: '1px solid #d7e0ea',
  borderRadius: '4px',
  padding: '0.75rem',
};

export default function WonWorkPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<WonJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [commercialRatePartial, setCommercialRatePartial] = useState(false);

  const fetchWonWork = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError('Driver jobs are unavailable because authentication is not configured.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (sessionError || !token) throw new Error('Your session has expired. Please sign in again.');

      const response = await fetch('/api/driver/jobs?scope=all&limit=100', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => ({}))) as WonWorkResponse;
      if (!response.ok) throw new Error(payload.error || 'Failed to load won work.');

      // Won Work is the execution/history surface for successfully awarded work.
      // Cancelled/unknown rows are not silently relabelled as active or completed.
      setJobs((payload.jobs ?? []).filter((job) => ['upcoming', 'active', 'completed'].includes(job.lifecycleGroup)));
      setCommercialRatePartial(payload.commercialRatePartial === true);
    } catch (fetchError) {
      setJobs([]);
      setCommercialRatePartial(false);
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load won work.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchWonWork();
  }, [fetchWonWork]);

  const pipelineCounts = useMemo(() => ({
    upcoming: jobs.filter((job) => job.lifecycleGroup === 'upcoming').length,
    active: jobs.filter((job) => job.lifecycleGroup === 'active').length,
    completed: jobs.filter((job) => job.lifecycleGroup === 'completed').length,
    total: jobs.length,
  }), [jobs]);

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell subtitle="Work you have won and that is assigned to your driver account.">
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '20px', lineHeight: '26px', fontWeight: 700, color: '#0f172a' }}>
          Won Work
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.65rem', marginBottom: '0.75rem' }}>
          {[
            { label: 'Upcoming', value: pipelineCounts.upcoming, color: '#1d4ed8' },
            { label: 'Active', value: pipelineCounts.active, color: '#b45309' },
            { label: 'Completed', value: pipelineCounts.completed, color: '#15803d' },
            { label: 'Total', value: pipelineCounts.total, color: '#374151' },
          ].map((item) => (
            <div key={item.label} style={{ ...card, borderTop: `3px solid ${item.color}`, textAlign: 'center', padding: '0.6rem' }}>
              <div style={{ fontSize: '18px', lineHeight: '22px', fontWeight: 800, color: item.color }}>{loading ? '...' : item.value}</div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginTop: '2px' }}>{item.label}</div>
            </div>
          ))}
        </div>

        {error && (
          <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '4px', padding: '8px 10px', fontSize: '12px', marginBottom: '0.75rem' }}>
            {error}
          </div>
        )}

        {!error && commercialRatePartial && (
          <div style={{ backgroundColor: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412', borderRadius: '4px', padding: '8px 10px', fontSize: '12px', marginBottom: '0.75rem' }}>
            Some agreed-rate records could not be verified. Unverified amounts are shown as TBC; customer budget is never used as a substitute.
          </div>
        )}

        {loading ? (
          <div style={{ color: '#64748b', padding: '2rem', textAlign: 'center', fontSize: '13px' }}>Loading won work...</div>
        ) : jobs.length === 0 ? (
          <div style={{ ...card, textAlign: 'center', padding: '2rem' }}>
            <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '4px', fontSize: '13px' }}>No won work yet</div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              Jobs will appear here after your quote is accepted and the work is assigned to you.
            </div>
            <button
              onClick={() => router.push('/driver/loads')}
              style={{ marginTop: '12px', minHeight: '32px', padding: '0 12px', backgroundColor: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}
            >
              Open Loads
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '8px' }}>
            {jobs.map((job) => {
              const statusStyle = GROUP_STYLES[job.lifecycleGroup] ?? GROUP_STYLES.other;
              const canOpenExecution = job.lifecycleGroup === 'upcoming' || job.lifecycleGroup === 'active';
              return (
                <div key={job.id} style={{ ...card, borderLeft: `3px solid ${statusStyle.color}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                    <div>
                      <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '13px' }}>{job.reference}</span>
                      <span style={{ marginLeft: '6px', fontSize: '11px', fontWeight: 700, backgroundColor: statusStyle.bg, color: statusStyle.color, padding: '2px 6px', borderRadius: '999px' }}>
                        {STATUS_LABELS[job.canonicalStatus] ?? job.canonicalStatus.replaceAll('_', ' ')}
                      </span>
                      {job.postingCompanyName && (
                        <span style={{ marginLeft: '6px', fontSize: '11px', color: '#64748b' }}>· {job.postingCompanyName}</span>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: job.agreedRateAmount == null ? '11px' : '13px', fontWeight: 800, color: job.agreedRateAmount == null ? '#64748b' : '#15803d' }}>
                        {fmtRate(job.agreedRateAmount, job.currency)}
                      </div>
                      {job.agreedRateAmount != null && (
                        <div style={{ fontSize: '10px', color: '#64748b', marginTop: '1px' }}>Accepted quote / agreed carrier rate</div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '2px' }}>Pickup</div>
                      <div style={{ fontSize: '13px', color: '#0f172a', fontWeight: 600 }}>{job.pickupLocation ?? '-'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '2px' }}>Delivery</div>
                      <div style={{ fontSize: '13px', color: '#0f172a', fontWeight: 600 }}>{job.deliveryLocation ?? '-'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '2px' }}>Collection</div>
                      <div style={{ fontSize: '13px', color: '#0f172a' }}>{fmtDate(job.pickupTime)}</div>
                    </div>
                    {job.vehicleType && (
                      <div>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '2px' }}>Vehicle</div>
                        <div style={{ fontSize: '13px', color: '#0f172a' }}>{VEHICLE_LABELS[job.vehicleType] ?? job.vehicleType}</div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {canOpenExecution && (
                      <button
                        onClick={() => router.push(`/driver/jobs/${job.id}`)}
                        style={{ minHeight: '32px', padding: '0 10px', backgroundColor: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}
                      >
                        Open Job
                      </button>
                    )}
                    <button
                      onClick={() => router.push('/driver/jobs')}
                      style={{ minHeight: '32px', padding: '0 10px', backgroundColor: '#fff', color: '#374151', border: '1px solid #d7e0ea', borderRadius: '4px', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}
                    >
                      Active Jobs
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
