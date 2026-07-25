'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../AuthContext';
import { resolveActiveCompanyId } from '../../../lib/activeCompany';
import { supabase } from '../../../lib/supabaseClient';
import {
  ActionButton,
  AlertBanner,
  DataTable,
  EmptyState,
  KpiCard,
  KpiGrid,
  PageFrame,
  PageHeader,
  Panel,
  StatusBadge,
} from './WorkspaceUI';

type DiaryJob = {
  id: string;
  company_id: string;
  awarded_carrier_company_id: string | null;
  assigned_company_id: string | null;
  assigned_driver_id: string | null;
  client_name: string | null;
  pickup_location: string | null;
  delivery_location: string | null;
  pickup_datetime: string | null;
  delivery_datetime: string | null;
  vehicle_type: string | null;
  status: string;
  current_status: string | null;
  pod_required: boolean;
  pod_generated: boolean;
  delivery_photos: string[] | null;
  updated_at: string;
};

type Driver = {
  id: string;
  display_name: string | null;
  status: string | null;
  availability_status: string | null;
  app_access: boolean | null;
};

const nextTransition: Record<string, { status: string; label: string; tone: 'primary' | 'success' | 'warning' }> = {
  awarded: { status: 'on_my_way', label: 'Start journey to pickup', tone: 'primary' },
  allocated: { status: 'on_my_way', label: 'Start journey to pickup', tone: 'primary' },
  on_my_way: { status: 'on_site_pickup', label: 'Arrived at pickup', tone: 'warning' },
  on_site_pickup: { status: 'loaded', label: 'Mark loaded', tone: 'success' },
  loaded: { status: 'in_transit', label: 'Start transit to delivery', tone: 'primary' },
  collected: { status: 'in_transit', label: 'Start transit to delivery', tone: 'primary' },
  in_transit: { status: 'on_site_delivery', label: 'Arrived at delivery', tone: 'warning' },
  on_site_delivery: { status: 'delivered', label: 'Mark delivered', tone: 'success' },
  delivered: { status: 'completed', label: 'Complete job', tone: 'success' },
};

const activeStatuses = new Set(['awarded', 'allocated', 'on_my_way', 'on_site_pickup', 'loaded', 'collected', 'in_transit', 'on_site_delivery']);
const finalStatuses = new Set(['delivered', 'completed', 'invoiced', 'paid']);

const formatDateTime = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not set';

export default function OperationsDiaryPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(user?.companyId ?? null);
  const [jobs, setJobs] = useState<DiaryJob[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [driverFilter, setDriverFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, string>>({});
  const [workingJobId, setWorkingJobId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    void resolveActiveCompanyId({ userId: user.id, fallbackCompanyId: user.companyId ?? null })
      .then((resolved) => { if (!cancelled) setCompanyId(resolved); });
    return () => { cancelled = true; };
  }, [user?.companyId, user?.id]);

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    const [jobsResult, driversResult] = await Promise.all([
      supabase
        .from('jobs')
        .select('id, company_id, awarded_carrier_company_id, assigned_company_id, assigned_driver_id, client_name, pickup_location, delivery_location, pickup_datetime, delivery_datetime, vehicle_type, status, current_status, pod_required, pod_generated, delivery_photos, updated_at')
        .or(`company_id.eq.${companyId},assigned_company_id.eq.${companyId},awarded_carrier_company_id.eq.${companyId}`)
        .order('pickup_datetime', { ascending: true })
        .limit(500),
      supabase
        .from('drivers')
        .select('id, display_name, status, availability_status, app_access')
        .eq('company_id', companyId)
        .eq('status', 'active')
        .eq('app_access', true)
        .order('display_name', { ascending: true }),
    ]);

    if (jobsResult.error || driversResult.error) {
      setError(jobsResult.error?.message ?? driversResult.error?.message ?? 'Operations data could not be loaded.');
    }
    setJobs((jobsResult.data ?? []) as DiaryJob[]);
    setDrivers((driversResult.data ?? []) as Driver[]);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { void load(); }, [load]);

  const token = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  };

  const assignDriver = async (job: DiaryJob) => {
    const driverId = assignmentDrafts[job.id] ?? job.assigned_driver_id ?? '';
    if (!driverId) return;
    setWorkingJobId(job.id);
    setError('');
    setMessage('');
    try {
      const accessToken = await token();
      if (!accessToken) throw new Error('Your session has expired.');
      const response = await fetch(`/api/admin/jobs/${job.id}/assign-driver`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId, expectedDriverId: job.assigned_driver_id }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? 'Driver could not be assigned.');
      setMessage('Approved driver assigned successfully.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Driver could not be assigned.');
    } finally {
      setWorkingJobId(null);
    }
  };

  const transition = async (job: DiaryJob, nextStatus: string) => {
    setWorkingJobId(job.id);
    setError('');
    setMessage('');
    try {
      const accessToken = await token();
      if (!accessToken) throw new Error('Your session has expired.');
      const currentStatus = String(job.current_status ?? job.status).toLowerCase();
      const response = await fetch(`/api/admin/jobs/${job.id}/transition`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ nextStatus, expectedStatus: currentStatus }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? 'Job status could not be updated.');
      setMessage(`Job updated to ${nextStatus.replaceAll('_', ' ')}.`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Job status could not be updated.');
    } finally {
      setWorkingJobId(null);
    }
  };

  const filteredJobs = useMemo(() => jobs.filter((job) => {
    const status = String(job.current_status ?? job.status).toLowerCase();
    if (statusFilter === 'active' && !activeStatuses.has(status)) return false;
    if (statusFilter === 'unallocated' && (job.assigned_driver_id || !['draft', 'received', 'posted', 'open', 'awarded'].includes(status))) return false;
    if (statusFilter === 'completed' && !finalStatuses.has(status)) return false;
    if (statusFilter === 'cancelled' && status !== 'cancelled') return false;
    if (driverFilter !== 'all' && job.assigned_driver_id !== driverFilter) return false;
    if (dateFilter !== 'all') {
      if (!job.pickup_datetime) return false;
      const pickup = new Date(job.pickup_datetime);
      const now = new Date();
      if (dateFilter === 'today' && pickup.toDateString() !== now.toDateString()) return false;
      if (dateFilter === 'week' && Math.abs(pickup.getTime() - now.getTime()) > 7 * 86_400_000) return false;
    }
    const term = search.trim().toLowerCase();
    if (term && ![job.id, job.client_name, job.pickup_location, job.delivery_location].some((value) => String(value ?? '').toLowerCase().includes(term))) return false;
    return true;
  }), [dateFilter, driverFilter, jobs, search, statusFilter]);

  const driverName = (id: string | null) => drivers.find((driver) => driver.id === id)?.display_name ?? 'Unassigned';

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Company operations"
        title="Operations Diary"
        description="Allocate approved drivers, filter real bookings and progress each job through one canonical status chain."
        actions={
          <>
            <ActionButton tone="primary" onClick={() => router.push('/admin/jobs')}>Post load</ActionButton>
            <ActionButton tone="secondary" onClick={() => void load()}>Refresh</ActionButton>
          </>
        }
      />
      {error && <AlertBanner tone="danger">{error}</AlertBanner>}
      {message && <AlertBanner tone="success">{message}</AlertBanner>}

      <KpiGrid>
        <KpiCard label="Bookings" value={jobs.length} tone="navy" />
        <KpiCard label="Unallocated" value={jobs.filter((job) => !job.assigned_driver_id && !finalStatuses.has(String(job.current_status ?? job.status))).length} tone="orange" />
        <KpiCard label="Active" value={jobs.filter((job) => activeStatuses.has(String(job.current_status ?? job.status))).length} tone="blue" />
        <KpiCard label="POD ready" value={jobs.filter((job) => job.pod_generated || (job.delivery_photos?.length ?? 0) > 0).length} tone="green" />
        <KpiCard label="Completed" value={jobs.filter((job) => finalStatuses.has(String(job.current_status ?? job.status))).length} tone="green" />
      </KpiGrid>

      <Panel title="Search and filters" description="Every filter below changes the booking register immediately." style={{ marginBottom: '0.9rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1.4fr) repeat(3, minmax(150px, 0.6fr)) auto', gap: '0.65rem', alignItems: 'end' }} className="xdrive-diary-filters">
          <label style={labelStyle}>Route, customer or reference<input value={search} onChange={(event) => setSearch(event.target.value)} style={inputStyle} placeholder="Search bookings" /></label>
          <label style={labelStyle}>View<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={inputStyle}><option value="active">Active</option><option value="all">All</option><option value="unallocated">Unallocated</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>
          <label style={labelStyle}>Pickup date<select value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} style={inputStyle}><option value="all">Any date</option><option value="today">Today</option><option value="week">Within 7 days</option></select></label>
          <label style={labelStyle}>Driver<select value={driverFilter} onChange={(event) => setDriverFilter(event.target.value)} style={inputStyle}><option value="all">Any approved driver</option>{drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.display_name ?? driver.id.slice(0, 8)}</option>)}</select></label>
          <ActionButton tone="secondary" onClick={() => { setSearch(''); setStatusFilter('active'); setDateFilter('all'); setDriverFilter('all'); }}>Clear</ActionButton>
        </div>
      </Panel>

      <Panel title="Booking register" description={`${filteredJobs.length} booking(s) match the current filters.`}>
        <DataTable
          columns={['Reference', 'Customer / route', 'Pickup', 'Driver allocation', 'Status', 'POD', 'Next action', 'Open']}
          rows={filteredJobs.map((job) => {
            const currentStatus = String(job.current_status ?? job.status).toLowerCase();
            const next = nextTransition[currentStatus];
            const selectedDriver = assignmentDrafts[job.id] ?? job.assigned_driver_id ?? '';
            return [
              job.id.slice(0, 8).toUpperCase(),
              <div key="route"><strong style={{ display: 'block' }}>{job.client_name ?? 'Customer'}</strong><span style={{ color: '#64748b' }}>{job.pickup_location ?? 'Collection'} → {job.delivery_location ?? 'Delivery'}</span></div>,
              <div key="time">{formatDateTime(job.pickup_datetime)}<div style={{ color: '#64748b', marginTop: '0.2rem' }}>{job.vehicle_type?.replaceAll('_', ' ') ?? 'Vehicle not set'}</div></div>,
              <div key="driver" style={{ display: 'grid', gap: '0.35rem', minWidth: 190 }}><select value={selectedDriver} onChange={(event) => setAssignmentDrafts((current) => ({ ...current, [job.id]: event.target.value }))} style={inputStyle}><option value="">{driverName(job.assigned_driver_id)}</option>{drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.display_name ?? driver.id.slice(0, 8)} · {driver.availability_status ?? 'unknown'}</option>)}</select>{selectedDriver && selectedDriver !== job.assigned_driver_id && <ActionButton tone="secondary" disabled={workingJobId === job.id} onClick={() => void assignDriver(job)}>Save driver</ActionButton>}</div>,
              <StatusBadge key="status" value={currentStatus} />,
              job.pod_generated || (job.delivery_photos?.length ?? 0) > 0 ? <StatusBadge key="pod" value="ready" tone="green" /> : <StatusBadge key="pod" value={job.pod_required ? 'required' : 'not required'} tone={job.pod_required ? 'orange' : 'grey'} />,
              next ? <ActionButton key="next" tone={next.tone} disabled={workingJobId === job.id || !job.assigned_driver_id} onClick={() => void transition(job, next.status)}>{workingJobId === job.id ? 'Saving…' : next.label}</ActionButton> : '—',
              <ActionButton key="open" tone="secondary" onClick={() => router.push(`/admin/jobs/${job.id}`)}>Open</ActionButton>,
            ];
          })}
          empty={<EmptyState title={loading ? 'Loading bookings…' : 'No bookings match these filters'} />}
        />
      </Panel>

      <style jsx global>{`@media (max-width: 1000px){.xdrive-diary-filters{grid-template-columns:1fr 1fr!important}}@media (max-width: 620px){.xdrive-diary-filters{grid-template-columns:1fr!important}}`}</style>
    </PageFrame>
  );
}

const inputStyle = { width: '100%', border: '1px solid #cbd5e1', borderRadius: 8, padding: '0.55rem 0.65rem', background: '#fff', color: '#0f172a', fontSize: '0.76rem', boxSizing: 'border-box' as const };
const labelStyle = { display: 'grid', gap: '0.3rem', color: '#475569', fontSize: '0.68rem', fontWeight: 800 } as const;
