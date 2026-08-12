'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import {
  ActionButton,
  AlertBanner,
  EmptyState,
  KpiCard,
  KpiGrid,
  Panel,
  StatusBadge,
} from '../../components/workspace/WorkspaceUI';

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

type HistoryFilter = 'all' | 'delivered' | 'cancelled' | 'disputed' | 'driver_declined';

const FILTERS: Array<{ id: HistoryFilter; label: string }> = [
  { id: 'all', label: 'All history' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'disputed', label: 'Disputed' },
  { id: 'driver_declined', label: 'Declined' },
];

const STATUS_LABELS: Record<string, string> = {
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  disputed: 'Disputed',
  driver_declined: 'Declined',
};

const STATUS_TONES: Record<string, 'green' | 'red' | 'purple' | 'orange'> = {
  delivered: 'green',
  cancelled: 'red',
  disputed: 'purple',
  driver_declined: 'orange',
};

function fmtDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function money(value: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);
}

export default function JobHistoryPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const driverId = typeof user?.driverId === 'string' ? user.driverId.trim() : '';

  const [jobs, setJobs] = useState<HistoryJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<HistoryFilter>('all');

  const fetchHistory = useCallback(async () => {
    if (!isSupabaseConfigured || authLoading) return;
    if (!driverId) {
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
      setError('Job history could not be loaded. Please refresh and try again.');
      setJobs([]);
    } else {
      setJobs((data ?? []) as HistoryJob[]);
    }
    setLoading(false);
  }, [authLoading, driverId]);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  const deliveredJobs = useMemo(() => jobs.filter((job) => job.status === 'delivered'), [jobs]);
  const totalEarned = useMemo(
    () => deliveredJobs.reduce((sum, job) => sum + Number(job.budget_amount ?? 0), 0),
    [deliveredJobs]
  );
  const withPod = useMemo(
    () => deliveredJobs.filter((job) => Array.isArray(job.delivery_photos) && job.delivery_photos.length > 0).length,
    [deliveredJobs]
  );
  const visibleJobs = statusFilter === 'all' ? jobs : jobs.filter((job) => job.status === statusFilter);

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell
        subtitle="Completed, cancelled, disputed and declined work in one compact operational register."
        headerActions={<ActionButton tone="primary" onClick={() => void fetchHistory()} disabled={loading}>Refresh</ActionButton>}
      >
        {error && <AlertBanner tone="danger">{error}</AlertBanner>}

        <KpiGrid>
          <KpiCard label="Delivered" value={deliveredJobs.length} detail="Completed jobs" tone="green" />
          <KpiCard label="Recorded earnings" value={money(totalEarned)} detail="Delivered job values" tone="blue" />
          <KpiCard label="POD captured" value={withPod} detail={`${deliveredJobs.length ? Math.round((withPod / deliveredJobs.length) * 100) : 0}% of delivered`} tone="navy" />
          <KpiCard label="Cancelled" value={jobs.filter((job) => job.status === 'cancelled').length} detail="Closed without delivery" tone="orange" />
          <KpiCard label="Disputed" value={jobs.filter((job) => job.status === 'disputed').length} detail="Requires review" tone="red" />
          <KpiCard label="All history" value={jobs.length} detail="Closed work records" tone="purple" />
        </KpiGrid>

        <div className="driver-status-tabs" aria-label="History filters">
          {FILTERS.map((item) => (
            <button key={item.id} type="button" data-active={statusFilter === item.id} onClick={() => setStatusFilter(item.id)}>
              {item.label} {item.id === 'all' ? jobs.length : jobs.filter((job) => job.status === item.id).length}
            </button>
          ))}
        </div>

        <Panel
          title="Job history"
          description="Open any row for the complete job record, POD and execution history."
          actions={<ActionButton tone="secondary" onClick={() => router.push('/driver/jobs')}>Current jobs</ActionButton>}
          flush
        >
          {loading ? (
            <div style={{ padding: '20px' }}><EmptyState title="Loading job history" /></div>
          ) : visibleJobs.length === 0 ? (
            <div style={{ padding: '20px' }}><EmptyState title="No jobs in this status" description="Closed work will appear here when it matches this filter." /></div>
          ) : (
            <div className="driver-ops-table-wrap">
              <table className="driver-ops-table">
                <thead>
                  <tr>
                    <th>Job</th>
                    <th>Route</th>
                    <th>Closed</th>
                    <th>Value</th>
                    <th>POD</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleJobs.map((job) => {
                    const hasPod = Array.isArray(job.delivery_photos) && job.delivery_photos.length > 0;
                    const jobDate = job.updated_at ?? job.deadline_at ?? job.delivery_window_start ?? job.created_at;
                    return (
                      <tr key={job.id}>
                        <td><strong>#{job.id.slice(0, 8).toUpperCase()}</strong></td>
                        <td><strong>{job.pickup_location ?? 'Collection'} → {job.delivery_location ?? 'Delivery'}</strong></td>
                        <td>{fmtDate(jobDate)}</td>
                        <td>{job.budget_amount != null ? money(job.budget_amount) : '—'}</td>
                        <td>{hasPod ? <StatusBadge value="Captured" tone="green" /> : <span style={{ color: '#64748b' }}>—</span>}</td>
                        <td><StatusBadge value={STATUS_LABELS[job.status] ?? job.status} tone={STATUS_TONES[job.status]} /></td>
                        <td><ActionButton tone="secondary" onClick={() => router.push(`/driver/jobs/${job.id}`)}>Open</ActionButton></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
