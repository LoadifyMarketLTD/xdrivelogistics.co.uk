'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ProtectedRoute from '../components/ProtectedRoute';
import { useAuth } from '../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { getMissingColumnFromError } from '../../lib/supabaseSchemaCompat';

type AvailabilityStatus = 'available' | 'busy' | 'offline';

type DriverRow = {
  phone?: string | null;
  status?: string | null;
  availability_status?: string | null;
  display_name?: string | null;
};

type VehicleRow = {
  type: string | null;
  reg_plate: string | null;
  payload_kg?: number | null;
  has_tail_lift?: boolean | null;
};

type JobRow = {
  id: string;
  status: string;
  pickup_location?: string | null;
  delivery_location?: string | null;
  pickup_contact_name?: string | null;
  pickup_contact_phone?: string | null;
  delivery_contact_name?: string | null;
  delivery_contact_phone?: string | null;
  customer_notes?: string | null;
  special_instructions?: string | null;
  deadline_at?: string | null;
  collection_window_start?: string | null;
  collection_window_end?: string | null;
  delivery_window_start?: string | null;
  delivery_window_end?: string | null;
  budget_amount?: number | null;
  updated_at?: string | null;
  created_at?: string | null;
};

const AVAILABILITY_OPTIONS: { value: AvailabilityStatus; label: string; color: string; bg: string }[] = [
  { value: 'available', label: '🟢 Available', color: '#15803d', bg: '#f0fdf4' },
  { value: 'busy', label: '🟡 On a Job', color: '#b45309', bg: '#fffbeb' },
  { value: 'offline', label: '🔴 Offline', color: '#dc2626', bg: '#fef2f2' },
];

const VEHICLE_TYPE_LABEL: Record<string, string> = {
  bicycle: 'Bicycle',
  motorbike: 'Motorbike',
  car: 'Car',
  van_small: 'Small Van',
  van_large: 'Large Van',
  luton: 'Luton Van',
  truck_7_5t: '7.5t Truck',
  truck_18t: '18t Truck',
  artic: 'Artic',
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Received',
  posted: 'Posted',
  allocated: 'Allocated',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  disputed: 'Disputed',
};

const STATUS_COLORS: Record<string, { fg: string; bg: string }> = {
  allocated: { fg: '#1d4ed8', bg: '#dbeafe' },
  in_transit: { fg: '#b45309', bg: '#fef3c7' },
  delivered: { fg: '#15803d', bg: '#dcfce7' },
  cancelled: { fg: '#dc2626', bg: '#fee2e2' },
  disputed: { fg: '#7c3aed', bg: '#ede9fe' },
  posted: { fg: '#6d28d9', bg: '#f3e8ff' },
  draft: { fg: '#374151', bg: '#e5e7eb' },
};

const baseCardStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '18px',
  border: '1px solid #dbe4ee',
  boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)',
  padding: '1rem',
};

function formatDateTime(value?: string | null) {
  if (!value) return 'Not scheduled';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTimeWindow(start?: string | null, end?: string | null) {
  if (!start && !end) return 'Time window not set';
  if (start && end) return `${formatDateTime(start)} → ${formatDateTime(end)}`;
  return formatDateTime(start ?? end);
}

function getStatusPresentation(status: string) {
  return STATUS_COLORS[status] ?? { fg: '#374151', bg: '#e5e7eb' };
}

function inferNextAction(job?: JobRow | null) {
  if (!job) return 'No active job assigned';
  if (job.status === 'allocated') return 'Proceed to collection';
  if (job.status === 'in_transit') return 'Proceed to delivery';
  if (job.status === 'posted') return 'Awaiting assignment';
  return STATUS_LABEL[job.status] ?? job.status;
}

export default function DriverEntryPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [stats, setStats] = useState({ active: 0, history: 0, weekEarnings: 0 });
  const [loadingStats, setLoadingStats] = useState(true);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [driverPhone, setDriverPhone] = useState('');
  const [driverName, setDriverName] = useState('Driver');
  const [vehicle, setVehicle] = useState<VehicleRow | null>(null);
  const [availability, setAvailability] = useState<AvailabilityStatus>('available');
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [todayJobs, setTodayJobs] = useState<JobRow[]>([]);
  const [activeJob, setActiveJob] = useState<JobRow | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [schemaWarnings, setSchemaWarnings] = useState<string[]>([]);

  const quickActions = [
    { label: 'Active Jobs', description: 'Open current deliveries', emoji: '🚚', href: '/driver/jobs?tab=active', highlight: true },
    { label: 'History', description: 'Review completed jobs', emoji: '📋', href: '/driver/jobs?tab=history', highlight: false },
    { label: 'Earnings', description: 'View totals and weekly income', emoji: '💷', href: '/driver/jobs?tab=earnings', highlight: false },
    { label: 'Account Security', description: 'Change login password', emoji: '🔒', href: '/driver/change-password', highlight: false },
  ] as const;

  const loadDriverProfile = useCallback(async () => {
    if (!user?.driverId || !isSupabaseConfigured) return;
    let driver: DriverRow | null = null;
    const warnings: string[] = [];

    const driverRes = await supabase
      .from('drivers')
      .select('phone, status, availability_status, display_name')
      .eq('id', user.driverId)
      .maybeSingle();

    if (driverRes.error && getMissingColumnFromError(driverRes.error, 'drivers') === 'availability_status') {
      const fallbackRes = await supabase
        .from('drivers')
        .select('phone, status, display_name')
        .eq('id', user.driverId)
        .maybeSingle();
      if (!fallbackRes.error) {
        driver = fallbackRes.data as DriverRow | null;
        warnings.push('drivers.availability_status missing; using drivers.status as fallback.');
      }
    } else if (!driverRes.error) {
      driver = driverRes.data as DriverRow | null;
    }

    if (driver) {
      if (driver.phone) setDriverPhone(driver.phone);
      if (driver.display_name) setDriverName(driver.display_name);
      const s = (driver.availability_status ?? driver.status) as string;
      if (s === 'available' || s === 'busy' || s === 'offline') setAvailability(s);
    }

    const vehicleRes = await supabase
      .from('vehicles')
      .select('type, reg_plate, payload_kg, has_tail_lift')
      .eq('assigned_driver_id', user.driverId)
      .maybeSingle();

    if (!vehicleRes.error && vehicleRes.data) {
      setVehicle(vehicleRes.data as VehicleRow);
    }

    setSchemaWarnings((prev) => Array.from(new Set([...prev, ...warnings])));
  }, [user?.driverId]);

  const loadDashboard = useCallback(async () => {
    if (!user?.driverId || !isSupabaseConfigured) {
      setLoadingStats(false);
      setDashboardLoading(false);
      return;
    }

    setDashboardLoading(true);

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfTomorrow = new Date(startOfDay);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

    const [activeRes, historyRes, earningsRes, jobsRes] = await Promise.all([
      supabase
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_driver_id', user.driverId)
        .in('status', ['allocated', 'in_transit']),
      supabase
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_driver_id', user.driverId)
        .in('status', ['delivered', 'cancelled', 'disputed']),
      supabase
        .from('jobs')
        .select('budget_amount, updated_at')
        .eq('assigned_driver_id', user.driverId)
        .eq('status', 'delivered')
        .gte('updated_at', oneWeekAgo),
      supabase
        .from('jobs')
        .select('id, status, pickup_location, delivery_location, pickup_contact_name, pickup_contact_phone, delivery_contact_name, delivery_contact_phone, customer_notes, special_instructions, deadline_at, collection_window_start, collection_window_end, delivery_window_start, delivery_window_end, budget_amount, updated_at, created_at')
        .eq('assigned_driver_id', user.driverId)
        .order('updated_at', { ascending: false })
        .limit(12),
    ]);

    const weekEarnings = (earningsRes.data ?? []).reduce(
      (s: number, j: { budget_amount?: number | null }) => s + (j.budget_amount ?? 0),
      0,
    );
    setStats({ active: activeRes.count ?? 0, history: historyRes.count ?? 0, weekEarnings });
    setLoadingStats(false);

    const jobs = ((jobsRes.data ?? []) as JobRow[]).slice();
    setTodayJobs(jobs);
    setActiveJob(jobs.find((job) => ['allocated', 'in_transit'].includes(job.status)) ?? jobs[0] ?? null);

    const derivedNotes = jobs
      .flatMap((job) => [job.customer_notes, job.special_instructions])
      .filter((note): note is string => Boolean(note && note.trim()))
      .slice(0, 4);
    setNotes(derivedNotes);

    const warnings: string[] = [];
    if (jobsRes.error) {
      warnings.push(`jobs query fallback required: ${jobsRes.error.message}`);
    }
    if (!jobs.length) {
      warnings.push('No operational jobs returned for this driver.');
    }
    if (vehicle === null) {
      warnings.push('No assigned vehicle found for this driver.');
    }
    setSchemaWarnings((prev) => Array.from(new Set([...prev, ...warnings])));

    setDashboardLoading(false);
  }, [user?.driverId, vehicle]);

  useEffect(() => {
    loadDriverProfile();
  }, [loadDriverProfile]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // ── Supabase Realtime: refresh dashboard when any of the driver's jobs change ──
  useEffect(() => {
    if (!user?.driverId || !isSupabaseConfigured) return;

    const channel = supabase
      .channel(`driver-jobs-${user.driverId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs',
          filter: `assigned_driver_id=eq.${user.driverId}`,
        },
        () => {
          void loadDashboard();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.driverId, loadDashboard]);

  const handleAvailabilityChange = async (next: AvailabilityStatus) => {
    if (!user?.driverId || !isSupabaseConfigured || availabilityLoading) return;
    setAvailabilityLoading(true);
    setAvailability(next);
    const updateRes = await supabase.from('drivers').update({ availability_status: next }).eq('id', user.driverId);
    if (updateRes.error && getMissingColumnFromError(updateRes.error, 'drivers') === 'availability_status') {
      await supabase.from('drivers').update({ status: next }).eq('id', user.driverId);
    }
    setAvailabilityLoading(false);
  };

  const currentAvail = AVAILABILITY_OPTIONS.find((o) => o.value === availability) ?? AVAILABILITY_OPTIONS[0];
  const nextJob = useMemo(() => todayJobs.find((job) => job.id !== activeJob?.id) ?? null, [todayJobs, activeJob?.id]);
  const podOutstanding = useMemo(
    () => todayJobs.filter((job) => job.status === 'in_transit' || job.status === 'allocated').slice(0, 3),
    [todayJobs],
  );

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <div
        style={{
          minHeight: '100dvh',
          background: 'linear-gradient(180deg, #0A2239 0%, #102f4d 240px, #f3f7fb 240px, #f3f7fb 100%)',
          padding: '1.25rem',
        }}
      >
        <div style={{ width: '100%', maxWidth: '1180px', margin: '0 auto' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '1rem',
              color: '#fff',
              marginBottom: '1rem',
              flexWrap: 'wrap',
            }}
          >
            <div data-testid="driver-header">
              <div style={{ fontSize: '0.8rem', color: '#93c5fd', marginBottom: '0.25rem' }}>Driver Operations Dashboard</div>
              <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800 }}>{driverName}</h1>
              <div style={{ fontSize: '0.92rem', color: '#bfdbfe', marginTop: '0.35rem' }}>
                {user?.email}
                {driverPhone ? ` · ${driverPhone}` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => router.push('/driver/jobs?tab=active')}
                style={{
                  backgroundColor: '#1d4ed8',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '0.8rem 1rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                data-testid="driver-open-active-jobs"
              >
                Open Active Jobs
              </button>
              <button
                onClick={logout}
                style={{
                  backgroundColor: 'transparent',
                  color: '#bfdbfe',
                  border: '1px solid #3b5c7c',
                  borderRadius: '12px',
                  padding: '0.8rem 1rem',
                  cursor: 'pointer',
                }}
                data-testid="driver-logout"
              >
                Logout
              </button>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '0.85rem',
              marginBottom: '1rem',
            }}
          >
            <div style={{ ...baseCardStyle, backgroundColor: '#eff6ff' }} data-testid="driver-stat-active">
              <div style={{ fontSize: '0.8rem', color: '#1d4ed8', marginBottom: '0.2rem' }}>Active jobs</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a' }}>{loadingStats ? '…' : stats.active}</div>
            </div>
            <div style={{ ...baseCardStyle, backgroundColor: '#f0fdf4' }} data-testid="driver-stat-completed">
              <div style={{ fontSize: '0.8rem', color: '#15803d', marginBottom: '0.2rem' }}>Completed jobs</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a' }}>{loadingStats ? '…' : stats.history}</div>
            </div>
            <div style={{ ...baseCardStyle, backgroundColor: '#fffbeb' }} data-testid="driver-stat-earnings">
              <div style={{ fontSize: '0.8rem', color: '#b45309', marginBottom: '0.2rem' }}>This week</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a' }}>{loadingStats ? '…' : `£${stats.weekEarnings.toFixed(0)}`}</div>
            </div>
          </div>

          {schemaWarnings.length > 0 && (
            <div
              style={{
                ...baseCardStyle,
                backgroundColor: '#fff7ed',
                border: '1px solid #fdba74',
                marginBottom: '1rem',
              }}
              data-testid="driver-operations-alerts"
            >
              <div style={{ fontWeight: 800, color: '#9a3412', marginBottom: '0.45rem' }}>Operational alerts</div>
              <ul style={{ margin: 0, paddingLeft: '1rem', color: '#7c2d12' }}>
                {schemaWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(300px, 1fr)', gap: '1rem', alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <section style={baseCardStyle} data-testid="driver-active-job-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start', marginBottom: '0.8rem', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '0.25rem' }}>
                      Active job
                    </div>
                    <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                      {activeJob ? `#${activeJob.id.slice(0, 8).toUpperCase()}` : 'No active job assigned'}
                    </h2>
                  </div>
                  {activeJob && (
                    <span
                      style={{
                        backgroundColor: getStatusPresentation(activeJob.status).bg,
                        color: getStatusPresentation(activeJob.status).fg,
                        borderRadius: '999px',
                        padding: '0.35rem 0.7rem',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                      }}
                    >
                      {STATUS_LABEL[activeJob.status] ?? activeJob.status}
                    </span>
                  )}
                </div>

                {dashboardLoading ? (
                  <div style={{ color: '#64748b' }}>Loading active operation…</div>
                ) : activeJob ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '0.9rem' }}>
                      <div style={{ backgroundColor: '#f8fafc', borderRadius: '14px', padding: '0.85rem' }}>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.25rem' }}>Collection</div>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{activeJob.pickup_location ?? 'Collection TBC'}</div>
                        <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '0.35rem' }}>
                          Window: {formatTimeWindow(activeJob.collection_window_start, activeJob.collection_window_end)}
                        </div>
                        {(activeJob.pickup_contact_name || activeJob.pickup_contact_phone) && (
                          <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '0.35rem' }}>
                            {activeJob.pickup_contact_name ?? 'Pickup contact'}{activeJob.pickup_contact_phone ? ` · ${activeJob.pickup_contact_phone}` : ''}
                          </div>
                        )}
                      </div>
                      <div style={{ backgroundColor: '#f8fafc', borderRadius: '14px', padding: '0.85rem' }}>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.25rem' }}>Delivery</div>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{activeJob.delivery_location ?? 'Delivery TBC'}</div>
                        <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '0.35rem' }}>
                          Window: {formatTimeWindow(activeJob.delivery_window_start, activeJob.delivery_window_end)}
                        </div>
                        {(activeJob.delivery_contact_name || activeJob.delivery_contact_phone) && (
                          <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '0.35rem' }}>
                            {activeJob.delivery_contact_name ?? 'Delivery contact'}{activeJob.delivery_contact_phone ? ` · ${activeJob.delivery_contact_phone}` : ''}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '0.85rem' }}>
                      <InfoChip label="Next action" value={inferNextAction(activeJob)} testId="driver-active-job-next-action" />
                      <InfoChip label="Deadline" value={formatDateTime(activeJob.deadline_at)} testId="driver-active-job-deadline" />
                      <InfoChip label="Budget" value={activeJob.budget_amount != null ? `£${activeJob.budget_amount.toFixed(2)}` : 'Budget not set'} testId="driver-active-job-budget" />
                    </div>

                    <div style={{ backgroundColor: '#f8fafc', borderRadius: '14px', padding: '0.85rem' }} data-testid="driver-active-job-notes">
                      <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.3rem' }}>Customer / dispatcher notes</div>
                      <div style={{ color: '#475569', fontSize: '0.92rem' }}>
                        {activeJob.customer_notes || activeJob.special_instructions || 'No customer or dispatcher notes for this job.'}
                      </div>
                    </div>
                  </>
                ) : (
                  <EmptyOpsBlock
                    title="No active job assigned"
                    description="You do not currently have an allocated or in-transit job. Stay visible to dispatch and check the active jobs queue."
                    testId="driver-empty-active-job"
                  />
                )}
              </section>

              <section style={baseCardStyle} data-testid="driver-next-stop-card">
                <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '0.25rem' }}>
                  Next collection / delivery
                </div>
                {nextJob ? (
                  <>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>{nextJob.status === 'allocated' ? 'Collection stop' : 'Delivery stop'}</div>
                    <div style={{ marginTop: '0.45rem', color: '#334155' }}>
                      {nextJob.status === 'allocated' ? nextJob.pickup_location ?? 'Collection TBC' : nextJob.delivery_location ?? 'Delivery TBC'}
                    </div>
                    <div style={{ marginTop: '0.45rem', fontSize: '0.86rem', color: '#64748b' }}>
                      {nextJob.status === 'allocated'
                        ? formatTimeWindow(nextJob.collection_window_start, nextJob.collection_window_end)
                        : formatTimeWindow(nextJob.delivery_window_start, nextJob.delivery_window_end)}
                    </div>
                    <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginTop: '0.9rem' }}>
                      <button onClick={() => router.push('/driver/jobs?tab=active')} style={primaryButtonStyle} data-testid="driver-next-stop-open-jobs">
                        Open jobs list
                      </button>
                      <button onClick={() => router.push('/driver/jobs?tab=active')} style={secondaryButtonStyle} data-testid="driver-next-stop-navigation">
                        View route / map
                      </button>
                    </div>
                  </>
                ) : (
                  <EmptyOpsBlock
                    title="No collections scheduled today"
                    description="There is no next collection or delivery queued from the jobs currently assigned to you."
                    testId="driver-empty-next-stop"
                  />
                )}
              </section>

              <section style={baseCardStyle} data-testid="driver-today-timeline-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div>
                    <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '0.25rem' }}>
                      Today's jobs / timeline
                    </div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>Operational queue</div>
                  </div>
                  <Link href="/driver/jobs?tab=active" style={{ color: '#1d4ed8', fontWeight: 700, textDecoration: 'none' }}>
                    View all
                  </Link>
                </div>
                {todayJobs.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                    {todayJobs.map((job) => {
                      const colors = getStatusPresentation(job.status);
                      return (
                        <button
                          key={job.id}
                          onClick={() => router.push(`/driver/jobs/${job.id}`)}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'auto 1fr auto',
                            gap: '0.8rem',
                            alignItems: 'center',
                            backgroundColor: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '14px',
                            padding: '0.8rem',
                            textAlign: 'left',
                            cursor: 'pointer',
                          }}
                          data-testid={`driver-timeline-job-${job.id}`}
                        >
                          <div style={{ width: '10px', height: '10px', borderRadius: '999px', backgroundColor: colors.fg }} />
                          <div>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>#{job.id.slice(0, 8).toUpperCase()}</div>
                            <div style={{ fontSize: '0.87rem', color: '#475569', marginTop: '0.2rem' }}>
                              {job.pickup_location ?? 'Collection TBC'} → {job.delivery_location ?? 'Delivery TBC'}
                            </div>
                          </div>
                          <span
                            style={{
                              backgroundColor: colors.bg,
                              color: colors.fg,
                              borderRadius: '999px',
                              padding: '0.28rem 0.55rem',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                            }}
                          >
                            {STATUS_LABEL[job.status] ?? job.status}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyOpsBlock
                    title="No operational jobs for today"
                    description="No jobs are currently assigned to your timeline. Dispatch can allocate new work once you are available."
                    testId="driver-empty-timeline"
                  />
                )}
              </section>

              <section style={baseCardStyle} data-testid="driver-job-actions-card">
                <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '0.25rem' }}>
                  Job actions
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.8rem' }}>Primary workflow controls</div>
                <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
                  <button style={primaryButtonStyle} onClick={() => router.push('/driver/jobs?tab=active')} data-testid="driver-action-start-job">Accept / start</button>
                  <button style={secondaryButtonStyle} onClick={() => router.push('/driver/jobs?tab=active')} data-testid="driver-action-on-site">On site</button>
                  <button style={secondaryButtonStyle} onClick={() => router.push('/driver/jobs?tab=active')} data-testid="driver-action-collected">Collected</button>
                  <button style={secondaryButtonStyle} onClick={() => router.push('/driver/jobs?tab=active')} data-testid="driver-action-delivered">Delivered</button>
                  <button style={secondaryButtonStyle} onClick={() => router.push('/driver/jobs?tab=active')} data-testid="driver-action-pod">Upload POD</button>
                  <button style={secondaryButtonStyle} onClick={() => router.push('/driver/jobs?tab=active')} data-testid="driver-action-map">View on map</button>
                </div>
              </section>
            </div>

            <aside style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <section style={baseCardStyle} data-testid="driver-pod-queue-card">
                <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '0.25rem' }}>
                  POD / ePOD
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.8rem' }}>Outstanding POD queue</div>
                {podOutstanding.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                    {podOutstanding.map((job) => (
                      <div key={job.id} style={{ backgroundColor: '#f8fafc', borderRadius: '14px', padding: '0.8rem', border: '1px solid #e2e8f0' }} data-testid={`driver-pod-job-${job.id}`}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>#{job.id.slice(0, 8).toUpperCase()}</div>
                        <div style={{ fontSize: '0.84rem', color: '#475569', marginTop: '0.25rem' }}>
                          {job.delivery_location ?? 'Delivery location pending'}
                        </div>
                        <button style={{ ...primaryButtonStyle, width: '100%', marginTop: '0.7rem' }} onClick={() => router.push('/driver/jobs?tab=active')}>
                          Upload POD now
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyOpsBlock
                    title="No POD outstanding"
                    description="There are no in-flight jobs currently waiting for POD / ePOD upload."
                    testId="driver-empty-pod"
                  />
                )}
              </section>

              <section style={baseCardStyle} data-testid="driver-vehicle-card">
                <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '0.25rem' }}>
                  Vehicle assignment
                </div>
                {vehicle ? (
                  <>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                      {VEHICLE_TYPE_LABEL[vehicle.type ?? ''] ?? vehicle.type ?? 'Assigned vehicle'}
                    </div>
                    <div style={{ color: '#334155', marginTop: '0.4rem' }}>{vehicle.reg_plate ?? 'Registration pending'}</div>
                    <div style={{ fontSize: '0.86rem', color: '#64748b', marginTop: '0.45rem' }}>
                      Payload: {vehicle.payload_kg ? `${vehicle.payload_kg} kg` : 'Not recorded'}
                    </div>
                    <div style={{ fontSize: '0.86rem', color: vehicle.has_tail_lift ? '#15803d' : '#64748b', marginTop: '0.25rem' }}>
                      {vehicle.has_tail_lift ? 'Tail lift equipped' : 'No tail lift flagged'}
                    </div>
                  </>
                ) : (
                  <EmptyOpsBlock
                    title="No assigned vehicle"
                    description="Dispatch has not linked a vehicle to your account yet. Vehicle and capacity details will appear here when assigned."
                    testId="driver-empty-vehicle"
                  />
                )}
              </section>

              <section style={baseCardStyle} data-testid="driver-availability-card">
                <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '0.25rem' }}>
                  Availability
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {AVAILABILITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleAvailabilityChange(opt.value)}
                      disabled={availabilityLoading}
                      style={{
                        flex: 1,
                        minWidth: '96px',
                        padding: '0.7rem 0.55rem',
                        borderRadius: '12px',
                        border: availability === opt.value ? `2px solid ${opt.color}` : '1px solid #dbe4ee',
                        backgroundColor: availability === opt.value ? opt.bg : '#f8fafc',
                        color: availability === opt.value ? opt.color : '#475569',
                        fontWeight: 700,
                        cursor: availabilityLoading ? 'not-allowed' : 'pointer',
                      }}
                      data-testid={`driver-availability-${opt.value}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: '0.82rem', color: currentAvail.color, marginTop: '0.55rem' }}>
                  Status visible to dispatch: {currentAvail.label}
                </div>
              </section>

              <section style={baseCardStyle} data-testid="driver-notes-card">
                <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '0.25rem' }}>
                  Dispatcher / company notes
                </div>
                {notes.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {notes.map((note, index) => (
                      <div key={`${note}-${index}`} style={{ backgroundColor: '#fff7ed', border: '1px solid #fdba74', color: '#9a3412', borderRadius: '14px', padding: '0.85rem' }} data-testid={`driver-dispatch-note-${index}`}>
                        {note}
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyOpsBlock
                    title="No dispatcher messages"
                    description="There are no urgent dispatch or company notes attached to your current operational workload."
                    testId="driver-empty-notes"
                  />
                )}
              </section>

              <section style={baseCardStyle} data-testid="driver-secondary-actions-card">
                <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '0.25rem' }}>
                  Secondary widgets
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                  {quickActions.map((action) => (
                    <button
                      key={action.label}
                      onClick={() => router.push(action.href)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '0.9rem 1rem',
                        backgroundColor: action.highlight ? '#eff6ff' : '#f8fafc',
                        color: '#0f172a',
                        border: action.highlight ? '1px solid #93c5fd' : '1px solid #e2e8f0',
                        borderRadius: '14px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.85rem',
                      }}
                      data-testid={`driver-secondary-${action.label.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <span style={{ fontSize: '1.3rem' }}>{action.emoji}</span>
                      <div>
                        <div style={{ fontWeight: 800 }}>{action.label}</div>
                        <div style={{ fontSize: '0.82rem', color: '#64748b' }}>{action.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

function EmptyOpsBlock({ title, description, testId }: { title: string; description: string; testId: string }) {
  return (
    <div
      style={{
        backgroundColor: '#f8fafc',
        border: '1px dashed #cbd5e1',
        borderRadius: '14px',
        padding: '1rem',
      }}
      data-testid={testId}
    >
      <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: '0.3rem' }}>{title}</div>
      <div style={{ color: '#64748b', fontSize: '0.92rem' }}>{description}</div>
    </div>
  );
}

function InfoChip({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div style={{ backgroundColor: '#f8fafc', borderRadius: '14px', padding: '0.8rem' }} data-testid={testId}>
      <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.25rem' }}>{label}</div>
      <div style={{ fontWeight: 800, color: '#0f172a' }}>{value}</div>
    </div>
  );
}

const primaryButtonStyle: React.CSSProperties = {
  backgroundColor: '#1d4ed8',
  color: '#ffffff',
  border: 'none',
  borderRadius: '12px',
  padding: '0.8rem 0.95rem',
  fontWeight: 700,
  cursor: 'pointer',
};

const secondaryButtonStyle: React.CSSProperties = {
  backgroundColor: '#eff6ff',
  color: '#1d4ed8',
  border: '1px solid #bfdbfe',
  borderRadius: '12px',
  padding: '0.8rem 0.95rem',
  fontWeight: 700,
  cursor: 'pointer',
};
