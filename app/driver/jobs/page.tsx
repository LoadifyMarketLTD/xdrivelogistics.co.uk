'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { getMissingColumnFromError } from '../../../lib/supabaseSchemaCompat';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { COMPANY_CONFIG } from '../../config/company';

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
  delivery_photos?: string[] | null;
  status_history?: Array<{ status: string; timestamp: string }> | null;
};

const ACTIVE_STATUSES = ['allocated', 'in_transit'];
const HISTORY_STATUSES = ['delivered', 'cancelled', 'disputed'];

const STATUS_LABEL: Record<string, string> = {
  draft: 'Received',
  posted: 'Posted',
  allocated: 'Allocated',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  disputed: 'Disputed',
  driver_declined: 'Declined',
};

const STATUS_COLORS: Record<string, { fg: string; bg: string }> = {
  allocated: { fg: '#1d4ed8', bg: '#dbeafe' },
  in_transit: { fg: '#b45309', bg: '#fef3c7' },
  delivered: { fg: '#15803d', bg: '#dcfce7' },
  cancelled: { fg: '#dc2626', bg: '#fee2e2' },
  disputed: { fg: '#7c3aed', bg: '#ede9fe' },
  posted: { fg: '#6d28d9', bg: '#f3e8ff' },
  draft: { fg: '#374151', bg: '#e5e7eb' },
  driver_declined: { fg: '#b91c1c', bg: '#fee2e2' },
};

const AVAILABILITY_OPTIONS: Array<{ value: AvailabilityStatus; label: string; color: string; bg: string }> = [
  { value: 'available', label: 'Available', color: '#15803d', bg: '#f0fdf4' },
  { value: 'busy', label: 'On a Job', color: '#b45309', bg: '#fffbeb' },
  { value: 'offline', label: 'Offline', color: '#dc2626', bg: '#fef2f2' },
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

const DRIVER_MENU_ITEMS = [
  { id: 'dashboard', label: 'Dashboard',        icon: '🏠', href: '/driver/jobs' },
  { id: 'todays-run', label: "Today's Run",     icon: '🚚', href: '/driver/jobs#todays-run' },
  { id: 'history',   label: 'History',          icon: '📚', href: '/driver/history' },
  { id: 'security',  label: 'Account Security', icon: '🔐', href: '/driver/change-password' },
];

const ENTERPRISE_THEME = {
  pageBg: '#eef2f6',
  shellBg: '#1e293b',
  shellBorder: '#334155',
  shellMuted: '#94a3b8',
  shellText: '#f1f5f9',
  cardBg: '#ffffff',
  cardBorder: '#d7e0ea',
  cardShadow: '0 6px 16px rgba(15, 23, 42, 0.08)',
  radius: '10px',
  spacing: {
    xs: '0.5rem',
    sm: '0.75rem',
    md: '1rem',
    lg: '1.25rem',
  },
  colors: {
    success: '#15803d',
    warning: '#c2410c',
    danger: '#b91c1c',
    live: '#1d4ed8',
    accent: '#7c3aed',
    text: '#0f172a',
    muted: '#475569',
  },
};

const sectionCardStyle: CSSProperties = {
  backgroundColor: ENTERPRISE_THEME.cardBg,
  padding: ENTERPRISE_THEME.spacing.lg,
  borderRadius: ENTERPRISE_THEME.radius,
  border: `1px solid ${ENTERPRISE_THEME.cardBorder}`,
  boxShadow: ENTERPRISE_THEME.cardShadow,
};

const primaryButtonStyle: CSSProperties = {
  backgroundColor: ENTERPRISE_THEME.colors.live,
  color: '#ffffff',
  border: `1px solid ${ENTERPRISE_THEME.colors.live}`,
  borderRadius: '8px',
  padding: '0.72rem 0.95rem',
  fontWeight: 700,
  cursor: 'pointer',
  minHeight: '44px',
};

const secondaryButtonStyle: CSSProperties = {
  backgroundColor: '#ffffff',
  color: ENTERPRISE_THEME.colors.text,
  border: `1px solid ${ENTERPRISE_THEME.cardBorder}`,
  borderRadius: '8px',
  padding: '0.72rem 0.95rem',
  fontWeight: 700,
  cursor: 'pointer',
  minHeight: '44px',
};

function toDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateTime(value?: string | null) {
  const date = toDate(value);
  if (!date) return value ?? 'Not scheduled';
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

function getPrimaryJobTimeWindow(job?: JobRow | null) {
  if (!job) return 'Time window not set';
  if (job.status === 'allocated') return formatTimeWindow(job.collection_window_start, job.collection_window_end);
  if (job.status === 'in_transit') return formatTimeWindow(job.delivery_window_start, job.delivery_window_end);
  return formatTimeWindow(
    job.collection_window_start ?? job.delivery_window_start ?? job.deadline_at,
    job.collection_window_end ?? job.delivery_window_end ?? null,
  );
}

function getJobOrderTimestamp(job: JobRow) {
  return (
    toDate(job.collection_window_start)?.getTime() ??
    toDate(job.delivery_window_start)?.getTime() ??
    toDate(job.deadline_at)?.getTime() ??
    toDate(job.updated_at)?.getTime() ??
    toDate(job.created_at)?.getTime() ??
    0
  );
}

function isToday(value?: string | null) {
  const date = toDate(value);
  if (!date) return false;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return date >= start && date < end;
}

function isJobForToday(job: JobRow) {
  return (
    ACTIVE_STATUSES.includes(job.status) ||
    isToday(job.collection_window_start) ||
    isToday(job.collection_window_end) ||
    isToday(job.delivery_window_start) ||
    isToday(job.delivery_window_end) ||
    isToday(job.deadline_at) ||
    isToday(job.created_at) ||
    isToday(job.updated_at)
  );
}

function isPODPending(job: JobRow) {
  return job.status === 'delivered' && (!Array.isArray(job.delivery_photos) || job.delivery_photos.length === 0);
}

function buildMapsAddress(job?: JobRow | null) {
  if (!job) return null;
  if (job.status === 'in_transit') return job.delivery_location ?? null;
  return job.pickup_location ?? job.delivery_location ?? null;
}

export default function DriverJobsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [driverId, setDriverId] = useState('');
  const [driverName, setDriverName] = useState('Driver');
  const [driverPhone, setDriverPhone] = useState('');
  const [availability, setAvailability] = useState<AvailabilityStatus>('available');
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [vehicle, setVehicle] = useState<VehicleRow | null>(null);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [earnings, setEarnings] = useState({ total: 0, week: 0, count: 0 });
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState('');
  const [selectedPodJobId, setSelectedPodJobId] = useState<string | null>(null);
  const podInputRef = useRef<HTMLInputElement>(null);
  const [hydrated, setHydrated] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentHash, setCurrentHash] = useState('');

  useEffect(() => {
    setHydrated(true);

    const updateIsMobile = () => setIsMobile(window.innerWidth <= 1024);
    updateIsMobile();
    window.addEventListener('resize', updateIsMobile);
    return () => window.removeEventListener('resize', updateIsMobile);
  }, []);

  useEffect(() => {
    if (!isMobile) setSidebarOpen(false);
  }, [isMobile]);

  useEffect(() => {
    const updateHash = () => setCurrentHash(window.location.hash || '');
    updateHash();
    window.addEventListener('hashchange', updateHash);
    return () => window.removeEventListener('hashchange', updateHash);
  }, []);
  const loadDriverProfile = useCallback(async () => {
    if (!user?.driverId || !isSupabaseConfigured) return;

    const driverRes = await supabase
      .from('drivers')
      .select('phone, status, availability_status, display_name')
      .eq('id', user.driverId)
      .maybeSingle();

    let driver = driverRes.data as DriverRow | null;
    if (driverRes.error && getMissingColumnFromError(driverRes.error, 'drivers') === 'availability_status') {
      const fallbackRes = await supabase
        .from('drivers')
        .select('phone, status, display_name')
        .eq('id', user.driverId)
        .maybeSingle();
      driver = fallbackRes.data as DriverRow | null;
    }

    if (driver?.phone) setDriverPhone(driver.phone);
    if (driver?.display_name) setDriverName(driver.display_name);

    const currentAvailability = driver?.availability_status ?? driver?.status ?? '';
    if (currentAvailability === 'available' || currentAvailability === 'busy' || currentAvailability === 'offline') {
      setAvailability(currentAvailability);
    }

    const vehicleRes = await supabase
      .from('vehicles')
      .select('type, reg_plate, payload_kg, has_tail_lift')
      .eq('assigned_driver_id', user.driverId)
      .maybeSingle();

    if (!vehicleRes.error) {
      setVehicle((vehicleRes.data as VehicleRow | null) ?? null);
    }
  }, [user?.driverId]);

  const loadDashboard = useCallback(async () => {
    if (!driverId || !isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [{ data: jobsData, error: jobsError }, { data: deliveredJobs }] = await Promise.all([
      supabase
        .from('jobs')
        .select(
          'id, status, pickup_location, delivery_location, pickup_contact_name, pickup_contact_phone, delivery_contact_name, delivery_contact_phone, customer_notes, special_instructions, deadline_at, collection_window_start, collection_window_end, delivery_window_start, delivery_window_end, budget_amount, updated_at, created_at, delivery_photos, status_history',
        )
        .eq('assigned_driver_id', driverId)
        .order('updated_at', { ascending: false })
        .limit(50),
      supabase
        .from('jobs')
        .select('budget_amount, updated_at')
        .eq('assigned_driver_id', driverId)
        .eq('status', 'delivered'),
    ]);

    if (!jobsError) {
      const nextJobs = ((jobsData ?? []) as JobRow[]).slice().sort((a, b) => getJobOrderTimestamp(a) - getJobOrderTimestamp(b));
      setJobs(nextJobs);
    }

    const delivered = (deliveredJobs ?? []) as Array<{ budget_amount?: number | null; updated_at?: string | null }>;
    const total = delivered.reduce((sum, job) => sum + (job.budget_amount ?? 0), 0);
    const week = delivered
      .filter((job) => Boolean(job.updated_at && job.updated_at >= oneWeekAgo))
      .reduce((sum, job) => sum + (job.budget_amount ?? 0), 0);
    setEarnings({ total, week, count: delivered.length });
    setLoading(false);
  }, [driverId]);

  useEffect(() => {
    if (!user?.driverId) return;
    setDriverId(user.driverId);
  }, [user?.driverId]);

  useEffect(() => {
    void loadDriverProfile();
  }, [loadDriverProfile]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!driverId || !isSupabaseConfigured) return;

    const channel = supabase
      .channel(`driver-dashboard-${driverId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs',
          filter: `assigned_driver_id=eq.${driverId}`,
        },
        () => {
          void loadDashboard();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [driverId, loadDashboard]);

  const todayJobs = useMemo(
    () => jobs.filter((job) => isJobForToday(job) && job.status !== 'driver_declined'),
    [jobs],
  );

  const currentJob = useMemo(
    () => todayJobs.find((job) => ACTIVE_STATUSES.includes(job.status)) ?? todayJobs[0] ?? null,
    [todayJobs],
  );

  const nextCollection = useMemo(
    () =>
      todayJobs.find(
        (job) =>
          job.pickup_location &&
          !['delivered', 'cancelled', 'disputed', 'driver_declined'].includes(job.status),
      ) ?? null,
    [todayJobs],
  );

  const nextDelivery = useMemo(
    () =>
      todayJobs.find(
        (job) =>
          job.delivery_location &&
          !['cancelled', 'disputed', 'driver_declined'].includes(job.status),
      ) ?? null,
    [todayJobs],
  );

  const pendingPODJobs = useMemo(() => jobs.filter((job) => isPODPending(job)), [jobs]);
  const historyJobs = useMemo(
    () =>
      jobs
        .filter((job) => HISTORY_STATUSES.includes(job.status))
        .slice()
        .sort((a, b) => getJobOrderTimestamp(b) - getJobOrderTimestamp(a))
        .slice(0, 6),
    [jobs],
  );
  const dispatcherNotes = useMemo(() => {
    const sources = [currentJob, nextCollection, nextDelivery].filter(Boolean) as JobRow[];
    const notes = sources
      .flatMap((job) => [job.special_instructions, job.customer_notes])
      .filter((note): note is string => Boolean(note && note.trim()));
    return Array.from(new Set(notes)).slice(0, 4);
  }, [currentJob, nextCollection, nextDelivery]);

  const podActionJob = useMemo(
    () => jobs.find((job) => job.id === selectedPodJobId) ?? currentJob ?? pendingPODJobs[0] ?? null,
    [currentJob, jobs, pendingPODJobs, selectedPodJobId],
  );

  const setTemporaryMessage = (message: string) => {
    setActionMsg(message);
    window.setTimeout(() => setActionMsg(''), 3500);
  };

  const handleAvailabilityChange = async (next: AvailabilityStatus) => {
    if (!driverId || !isSupabaseConfigured || availabilityLoading) return;
    setAvailabilityLoading(true);
    setAvailability(next);

    const updateRes = await supabase.from('drivers').update({ availability_status: next }).eq('id', driverId);
    if (updateRes.error && getMissingColumnFromError(updateRes.error, 'drivers') === 'availability_status') {
      await supabase.from('drivers').update({ status: next }).eq('id', driverId);
    }

    setAvailabilityLoading(false);
  };

  const appendStatusHistory = async (jobId: string, newStatus: string) => {
    const { data } = await supabase.from('jobs').select('status_history').eq('id', jobId).maybeSingle();
    const history = Array.isArray((data as { status_history?: unknown } | null)?.status_history)
      ? ((data as { status_history: Array<{ status: string; timestamp: string }> }).status_history)
      : [];
    return [...history, { status: newStatus, timestamp: new Date().toISOString() }];
  };

  const updateJobStatus = async (job: JobRow | null, newStatus: string, extraFields: Record<string, unknown> = {}) => {
    if (!job || !driverId || !isSupabaseConfigured) return;
    setActionLoading(true);
    setActionMsg('');

    const statusHistory = await appendStatusHistory(job.id, newStatus);
    const { error } = await supabase
      .from('jobs')
      .update({ status: newStatus, status_history: statusHistory, ...extraFields })
      .eq('id', job.id)
      .eq('assigned_driver_id', driverId);

    if (error) {
      setActionMsg(`❌ ${error.message}`);
    } else {
      await loadDashboard();
      setTemporaryMessage(`✅ ${STATUS_LABEL[newStatus] ?? newStatus}`);
    }

    setActionLoading(false);
  };

  const handleDeclineJob = async () => {
    if (!currentJob || !driverId || !isSupabaseConfigured || currentJob.status !== 'allocated') return;
    if (!window.confirm('Decline this job and return it to dispatch?')) return;

    setActionLoading(true);
    setActionMsg('');

    const statusHistory = await appendStatusHistory(currentJob.id, 'driver_declined');
    const { error } = await supabase
      .from('jobs')
      .update({ assigned_driver_id: null, status: 'posted', status_history: statusHistory })
      .eq('id', currentJob.id)
      .eq('assigned_driver_id', driverId);

    if (error) {
      setActionMsg(`❌ ${error.message}`);
    } else {
      await loadDashboard();
      setTemporaryMessage('✅ Job declined');
    }

    setActionLoading(false);
  };

  const launchPodUpload = (job: JobRow | null) => {
    if (!job || actionLoading) return;
    setSelectedPodJobId(job.id);
    podInputRef.current?.click();
  };

  const handlePODUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const targetJob = podActionJob;
    if (!file || !targetJob || !driverId || !isSupabaseConfigured) return;

    setActionLoading(true);
    setActionMsg('');

    let uploadedUrl: string;
    const companyId = user?.companyId ?? null;
    if (companyId) {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${companyId}/${targetJob.id}/pod-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('pod-photos').upload(path, file, { upsert: true });

      if (!uploadError) {
        const { data: signed } = await supabase.storage.from('pod-photos').createSignedUrl(path, 60 * 60 * 24 * 365);
        uploadedUrl = signed?.signedUrl ?? path;
      } else {
        uploadedUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (loadEvent) => resolve(loadEvent.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }
    } else {
      uploadedUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (loadEvent) => resolve(loadEvent.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    const { data } = await supabase.from('jobs').select('delivery_photos').eq('id', targetJob.id).maybeSingle();
    const existing = Array.isArray((data as { delivery_photos?: unknown } | null)?.delivery_photos)
      ? ((data as { delivery_photos: string[] }).delivery_photos)
      : [];

    const { error } = await supabase
      .from('jobs')
      .update({ delivery_photos: [...existing, uploadedUrl] })
      .eq('id', targetJob.id)
      .eq('assigned_driver_id', driverId);

    if (error) {
      setActionMsg(`❌ ${error.message}`);
    } else {
      await loadDashboard();
      setTemporaryMessage('✅ POD uploaded');
    }

    if (podInputRef.current) podInputRef.current.value = '';
    setSelectedPodJobId(null);
    setActionLoading(false);
  };

  const handleViewMap = () => {
    const address = buildMapsAddress(currentJob);
    if (!address) return;
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`, '_blank', 'noopener,noreferrer');
  };

  const currentAvailability = AVAILABILITY_OPTIONS.find((option) => option.value === availability) ?? AVAILABILITY_OPTIONS[0];
  const summaryCards = [
    {
      label: 'Active Job',
      value: currentJob ? `#${currentJob.id.slice(0, 8).toUpperCase()}` : 'No job',
      subtitle: currentJob ? STATUS_LABEL[currentJob.status] ?? currentJob.status : 'No live assignment',
      icon: '🚚',
      color: ENTERPRISE_THEME.colors.live,
      urgent: Boolean(currentJob && currentJob.status === 'allocated'),
    },
    {
      label: 'Next Collection',
      value: nextCollection ? formatDateTime(nextCollection.collection_window_start ?? nextCollection.created_at) : 'Not scheduled',
      subtitle: nextCollection?.pickup_location ?? 'No collection queued',
      icon: '📦',
      color: ENTERPRISE_THEME.colors.warning,
      urgent: false,
    },
    {
      label: 'POD Queue',
      value: String(pendingPODJobs.length),
      subtitle: pendingPODJobs.length > 0 ? 'Deliveries waiting for proof' : 'No pending POD items',
      icon: '📷',
      color: pendingPODJobs.length > 0 ? ENTERPRISE_THEME.colors.warning : ENTERPRISE_THEME.colors.success,
      urgent: pendingPODJobs.length > 0,
    },
    {
      label: 'This Week',
      value: `£${earnings.week.toFixed(2)}`,
      subtitle: `${earnings.count} completed jobs total`,
      icon: '💷',
      color: ENTERPRISE_THEME.colors.success,
      urgent: false,
    },
  ];

  if (!hydrated) {
    return <div style={{ minHeight: '100vh', backgroundColor: ENTERPRISE_THEME.pageBg }} />;
  }

  const dashboard = (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: ENTERPRISE_THEME.pageBg }}>
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(2, 6, 23, 0.5)', zIndex: 30 }}
        />
      )}

      <aside
        style={{
          width: isMobile ? '270px' : '228px',
          backgroundColor: ENTERPRISE_THEME.shellBg,
          color: ENTERPRISE_THEME.shellText,
          display: 'flex',
          flexDirection: 'column',
          borderRight: `1px solid ${ENTERPRISE_THEME.shellBorder}`,
          position: isMobile ? 'fixed' : 'relative',
          inset: isMobile ? '0 auto 0 0' : undefined,
          zIndex: isMobile ? 40 : undefined,
          transform: isMobile ? (sidebarOpen ? 'translateX(0)' : 'translateX(-100%)') : 'translateX(0)',
          transition: 'transform 0.2s ease',
        }}
      >
        <div style={{ padding: '1.1rem 1rem', borderBottom: `1px solid ${ENTERPRISE_THEME.shellBorder}` }}>
          <h1 style={{ fontSize: '1.02rem', fontWeight: 700, margin: 0, color: ENTERPRISE_THEME.shellText, lineHeight: 1.35 }}>{COMPANY_CONFIG.legalName}</h1>
          <p style={{ fontSize: '0.74rem', margin: '0.3rem 0 0 0', color: ENTERPRISE_THEME.shellMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Driver Console
          </p>
          <div style={{ marginTop: '0.55rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#93c5fd', backgroundColor: 'rgba(59,130,246,0.2)', padding: '0.1rem 0.55rem', borderRadius: '999px' }}>
              Driver
            </span>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '0.5rem', overflowY: 'auto' }}>
          {DRIVER_MENU_ITEMS.map((item) => {
            const isRunLink = item.href.includes('#todays-run');
            const isActive = isRunLink
              ? pathname === '/driver/jobs' && currentHash === '#todays-run'
              : pathname === item.href || (item.href === '/driver/jobs' && pathname.startsWith('/driver/jobs') && currentHash !== '#todays-run');
            return (
              <button
                key={item.id}
                onClick={() => {
                  router.push(item.href);
                  if (isMobile) setSidebarOpen(false);
                }}
                style={{
                  width: '100%',
                  padding: '0.6rem 0.8rem',
                  backgroundColor: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                  color: isActive ? '#ffffff' : ENTERPRISE_THEME.shellMuted,
                  borderTop: 'none',
                  borderRight: 'none',
                  borderBottom: 'none',
                  borderLeft: isActive ? `3px solid #3b82f6` : '3px solid transparent',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.55rem',
                  fontSize: '0.87rem',
                  fontWeight: isActive ? 700 : 500,
                  borderRadius: '6px',
                  marginBottom: '0.2rem',
                }}
              >
                <span
                  style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '6px',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: '0.85rem',
                    backgroundColor: isActive ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.08)',
                    flexShrink: 0,
                  }}
                >
                  {item.icon}
                </span>
                {item.label}
              </button>
            );
          })}
        </nav>

        <div style={{ padding: '0.9rem', borderTop: `1px solid ${ENTERPRISE_THEME.shellBorder}` }}>
          <div style={{ fontSize: '0.74rem', color: ENTERPRISE_THEME.shellMuted, marginBottom: '0.35rem' }}>{driverName}</div>
          <div style={{ fontSize: '0.74rem', color: ENTERPRISE_THEME.shellMuted, marginBottom: '0.6rem', wordBreak: 'break-word' }}>
            {user?.email ?? driverPhone ?? 'Driver account'}
          </div>
          <button
            onClick={logout}
            style={{
              width: '100%',
              padding: '0.52rem',
              backgroundColor: 'rgba(239,68,68,0.15)',
              color: '#fca5a5',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '6px',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Sign out
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, padding: isMobile ? '0.9rem' : '1.2rem' }}>
        {isMobile && (
          <button
            onClick={() => setSidebarOpen(true)}
            style={{
              padding: '0.5rem 0.72rem',
              borderRadius: '8px',
              border: `1px solid ${ENTERPRISE_THEME.cardBorder}`,
              backgroundColor: '#ffffff',
              color: ENTERPRISE_THEME.colors.text,
              fontWeight: 700,
              marginBottom: '0.85rem',
              cursor: 'pointer',
              fontSize: '0.83rem',
            }}
          >
            ☰ Modules
          </button>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: ENTERPRISE_THEME.colors.text, margin: '0 0 0.2rem 0' }}>Driver Dashboard</h2>
            <p style={{ color: ENTERPRISE_THEME.colors.muted, margin: 0, maxWidth: '760px', fontSize: '0.86rem' }}>
              Live view of today&apos;s work, upcoming stops, POD tasks, earnings and account actions.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Availability toggle — always visible in header */}
            <div style={{ display: 'flex', gap: '0.35rem', padding: '0.22rem', background: '#f1f5f9', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              {AVAILABILITY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => void handleAvailabilityChange(option.value)}
                  disabled={availabilityLoading}
                  style={{
                    padding: '0.32rem 0.65rem',
                    borderRadius: '7px',
                    border: availability === option.value ? `1px solid ${option.color}` : '1px solid transparent',
                    backgroundColor: availability === option.value ? option.bg : 'transparent',
                    color: availability === option.value ? option.color : '#64748b',
                    fontWeight: 700,
                    cursor: availabilityLoading ? 'not-allowed' : 'pointer',
                    fontSize: '0.78rem',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => currentJob && router.push(`/driver/jobs/${currentJob.id}`)}
              disabled={!currentJob}
              style={buildToolbarButton(!currentJob, true)}
            >
              Open active job
            </button>
            <Link href="/driver/change-password" style={{ ...buildToolbarLinkStyle(), textDecoration: 'none' }}>
              Change password
            </Link>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
          {summaryCards.map((card) => (
            <div
              key={card.label}
              style={{
                backgroundColor: card.urgent ? '#fff7ed' : ENTERPRISE_THEME.cardBg,
                padding: '0.75rem',
                borderRadius: ENTERPRISE_THEME.radius,
                borderTop: `1px solid ${card.urgent ? '#fb923c' : ENTERPRISE_THEME.cardBorder}`,
                borderRight: `1px solid ${card.urgent ? '#fb923c' : ENTERPRISE_THEME.cardBorder}`,
                borderBottom: `1px solid ${card.urgent ? '#fb923c' : ENTERPRISE_THEME.cardBorder}`,
                boxShadow: ENTERPRISE_THEME.cardShadow,
                borderLeft: `3px solid ${card.color}`,
                minHeight: '110px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.45rem' }}>
                <div>
                  <div style={{ fontSize: '0.8rem', color: ENTERPRISE_THEME.colors.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{card.label}</div>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '0.12rem', lineHeight: 1.4 }}>{card.subtitle}</div>
                </div>
                <span style={{ fontSize: '1.1rem', width: '26px', height: '26px', borderRadius: '8px', backgroundColor: '#f1f5f9', display: 'grid', placeItems: 'center' }}>{card.icon}</span>
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: card.urgent ? card.color : ENTERPRISE_THEME.colors.text }}>
                {loading ? '…' : card.value}
              </div>
            </div>
          ))}
        </div>

        <input
          ref={podInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handlePODUpload}
        />

        {actionMsg && (
          <div
            style={{
              backgroundColor: actionMsg.startsWith('❌') ? '#fef2f2' : '#f0fdf4',
              border: actionMsg.startsWith('❌') ? '1px solid #fecaca' : '1px solid #bbf7d0',
              borderRadius: '8px',
              padding: '0.75rem 0.9rem',
              marginBottom: '0.75rem',
              color: actionMsg.startsWith('❌') ? '#b91c1c' : '#15803d',
              fontWeight: 600,
              fontSize: '0.83rem',
            }}
          >
            {actionMsg}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem', alignItems: 'start' }}>
          <section id="todays-run" style={{ ...sectionCardStyle, gridColumn: isMobile ? 'auto' : 'span 2' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
              <SectionEyebrow>Today&apos;s Run Sheet</SectionEyebrow>
              <span style={{ fontSize: '0.75rem', color: ENTERPRISE_THEME.colors.muted, fontWeight: 600 }}>
                {todayJobs.length} job{todayJobs.length !== 1 ? 's' : ''} today
              </span>
            </div>
            {loading ? (
              <LoadingBlock label="Loading run sheet…" />
            ) : todayJobs.length === 0 ? (
              <EmptyBlock title="No jobs today" description="No jobs are scheduled or active for today." />
            ) : (
              <div style={{ display: 'grid', gap: '0.55rem' }}>
                {todayJobs.map((job, idx) => {
                  const isActive = ACTIVE_STATUSES.includes(job.status);
                  const isCompleted = ['delivered', 'cancelled', 'disputed'].includes(job.status);
                  const mapAddress = buildMapsAddress(job);
                  return (
                    <div
                      key={job.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr auto',
                        gap: '0.75rem',
                        alignItems: 'start',
                        padding: '0.75rem',
                        borderRadius: '10px',
                        background: isActive ? '#f0f9ff' : isCompleted ? '#f0fdf4' : '#f8fafc',
                        border: isActive ? '1px solid #bae6fd' : isCompleted ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                        borderLeft: isActive ? `3px solid ${ENTERPRISE_THEME.colors.live}` : isCompleted ? '3px solid #15803d' : '3px solid #e2e8f0',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.72rem', color: ENTERPRISE_THEME.colors.muted, fontWeight: 600 }}>#{idx + 1}</span>
                          <span style={{ fontWeight: 800, fontSize: '0.88rem', color: ENTERPRISE_THEME.colors.text }}>
                            {job.id.slice(0, 8).toUpperCase()}
                          </span>
                          <StatusBadge status={job.status} />
                          {job.budget_amount != null && (
                            <span style={{ fontSize: '0.72rem', color: '#15803d', fontWeight: 700 }}>£{job.budget_amount.toFixed(2)}</span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#374151', marginBottom: '0.2rem' }}>
                          <span style={{ fontWeight: 600 }}>Collection: </span>
                          {job.pickup_location ?? 'Not set'}
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#374151', marginBottom: '0.2rem' }}>
                          <span style={{ fontWeight: 600 }}>Delivery: </span>
                          {job.delivery_location ?? 'Not set'}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: ENTERPRISE_THEME.colors.muted, marginBottom: '0.35rem' }}>
                          {getPrimaryJobTimeWindow(job)}
                        </div>
                        {(job.pickup_contact_phone || job.delivery_contact_phone) && (
                          <div style={{ fontSize: '0.78rem', marginBottom: '0.1rem' }}>
                            {job.pickup_contact_phone && (
                              <a href={`tel:${job.pickup_contact_phone}`} style={{ color: ENTERPRISE_THEME.colors.live, fontWeight: 600, textDecoration: 'none', marginRight: '0.75rem' }}>
                                📞 {job.pickup_contact_name ?? job.pickup_contact_phone}
                              </a>
                            )}
                            {job.delivery_contact_phone && (
                              <a href={`tel:${job.delivery_contact_phone}`} style={{ color: ENTERPRISE_THEME.colors.live, fontWeight: 600, textDecoration: 'none' }}>
                                📞 {job.delivery_contact_name ?? job.delivery_contact_phone}
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                      {/* Inline actions attached to job */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: '130px' }}>
                        {job.status === 'allocated' && (
                          <>
                            <button onClick={() => void updateJobStatus(job, 'in_transit')} disabled={actionLoading} style={buildActionStyle(actionLoading, true)}>
                              Mark Collected
                            </button>
                            <button onClick={() => void handleDeclineJob()} disabled={job.id !== currentJob?.id || actionLoading} style={buildActionStyle(job.id !== currentJob?.id || actionLoading)}>
                              Decline
                            </button>
                          </>
                        )}
                        {job.status === 'in_transit' && (
                          <button onClick={() => void updateJobStatus(job, 'delivered')} disabled={actionLoading} style={buildActionStyle(actionLoading, true)}>
                            Mark Delivered
                          </button>
                        )}
                        {isPODPending(job) && (
                          <button onClick={() => launchPodUpload(job)} disabled={actionLoading} style={buildActionStyle(actionLoading)}>
                            Upload POD
                          </button>
                        )}
                        {mapAddress && (
                          <button
                            onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapAddress)}`, '_blank', 'noopener,noreferrer')}
                            disabled={actionLoading}
                            style={buildActionStyle(actionLoading)}
                          >
                            Navigate
                          </button>
                        )}
                        {!isCompleted && (
                          <button onClick={() => router.push(`/driver/jobs/${job.id}`)} style={buildActionStyle(false)}>
                            Open →
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section style={{ ...sectionCardStyle, gridColumn: isMobile ? 'auto' : 'span 2' }}>
            <SectionEyebrow>Active Job</SectionEyebrow>
            {loading ? (
              <LoadingBlock label="Loading active job…" />
            ) : currentJob ? (
              <div style={{ display: 'grid', gap: '0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: '0.76rem', color: '#64748b', marginBottom: '0.2rem' }}>Job reference</div>
                    <h3 style={{ margin: 0, fontSize: '1.28rem', fontWeight: 800, color: '#0f172a' }}>#{currentJob.id.slice(0, 8).toUpperCase()}</h3>
                  </div>
                  <StatusBadge status={currentJob.status} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                  <DataBlock label="Pickup address" value={currentJob.pickup_location ?? 'Pickup not set'} />
                  <DataBlock label="Delivery address" value={currentJob.delivery_location ?? 'Delivery not set'} />
                  <DataBlock label="Time window" value={getPrimaryJobTimeWindow(currentJob)} />
                  <DataBlock
                    label="Assigned vehicle"
                    value={
                      vehicle
                        ? `${vehicle.reg_plate ?? 'Registration pending'} · ${VEHICLE_TYPE_LABEL[vehicle.type ?? ''] ?? vehicle.type ?? 'Vehicle'}`
                        : 'No assigned vehicle'
                    }
                  />
                </div>
                {dispatcherNotes.length > 0 && (
                  <div style={{ display: 'grid', gap: '0.55rem' }}>
                    {dispatcherNotes.map((note, index) => (
                      <div key={`${note}-${index}`} style={{ backgroundColor: '#fff7ed', border: '1px solid #fdba74', color: '#9a3412', borderRadius: '8px', padding: '0.7rem 0.8rem', fontSize: '0.84rem' }}>
                        {note}
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.65rem' }}>
                  <button
                    onClick={() => currentJob && router.push(`/driver/jobs/${currentJob.id}`)}
                    disabled={!currentJob || currentJob.status !== 'allocated' || actionLoading}
                    style={buildActionStyle(!currentJob || currentJob.status !== 'allocated' || actionLoading, true)}
                  >
                    Open Job
                  </button>
                  <button
                    onClick={() => void handleDeclineJob()}
                    disabled={!currentJob || currentJob.status !== 'allocated' || actionLoading}
                    style={buildActionStyle(!currentJob || currentJob.status !== 'allocated' || actionLoading)}
                  >
                    Decline Job
                  </button>
                  <button
                    onClick={() => void updateJobStatus(currentJob, 'in_transit')}
                    disabled={!currentJob || currentJob.status !== 'allocated' || actionLoading}
                    style={buildActionStyle(!currentJob || currentJob.status !== 'allocated' || actionLoading)}
                  >
                    Mark Collected
                  </button>
                  <button
                    onClick={() => void updateJobStatus(currentJob, 'delivered')}
                    disabled={!currentJob || currentJob.status !== 'in_transit' || actionLoading}
                    style={buildActionStyle(!currentJob || currentJob.status !== 'in_transit' || actionLoading)}
                  >
                    Mark Delivered
                  </button>
                  <button
                    onClick={() => launchPodUpload(currentJob ?? pendingPODJobs[0] ?? null)}
                    disabled={(!currentJob && !pendingPODJobs[0]) || actionLoading}
                    style={buildActionStyle((!currentJob && !pendingPODJobs[0]) || actionLoading)}
                  >
                    Upload POD
                  </button>
                  <button
                    onClick={handleViewMap}
                    disabled={!buildMapsAddress(currentJob) || actionLoading}
                    style={buildActionStyle(!buildMapsAddress(currentJob) || actionLoading)}
                  >
                    View on Map
                  </button>
                </div>
              </div>
            ) : (
              <EmptyBlock title="No active job" description="No current job is assigned right now." />
            )}
          </section>

          <section style={sectionCardStyle}>
            <SectionEyebrow>Next Collection</SectionEyebrow>
            {loading ? (
              <LoadingBlock label="Loading next collection…" />
            ) : nextCollection ? (
              <StopCard
                title={`#${nextCollection.id.slice(0, 8).toUpperCase()}`}
                address={nextCollection.pickup_location ?? 'Collection not set'}
                windowLabel={formatTimeWindow(nextCollection.collection_window_start, nextCollection.collection_window_end)}
                contactName={nextCollection.pickup_contact_name}
                contactPhone={nextCollection.pickup_contact_phone}
                note={nextCollection.customer_notes || nextCollection.special_instructions || 'No client note.'}
              />
            ) : (
              <EmptyBlock title="No collection queued" description="No collection stop is scheduled right now." />
            )}
          </section>

          <section style={sectionCardStyle}>
            <SectionEyebrow>Next Delivery</SectionEyebrow>
            {loading ? (
              <LoadingBlock label="Loading next delivery…" />
            ) : nextDelivery ? (
              <StopCard
                title={`#${nextDelivery.id.slice(0, 8).toUpperCase()}`}
                address={nextDelivery.delivery_location ?? 'Delivery not set'}
                windowLabel={formatTimeWindow(nextDelivery.delivery_window_start, nextDelivery.delivery_window_end)}
                contactName={nextDelivery.delivery_contact_name}
                contactPhone={nextDelivery.delivery_contact_phone}
                note={nextDelivery.customer_notes || nextDelivery.special_instructions || 'No client note.'}
              />
            ) : (
              <EmptyBlock title="No delivery queued" description="No delivery stop is scheduled right now." />
            )}
          </section>

          <section style={sectionCardStyle}>
            <SectionEyebrow>Vehicle</SectionEyebrow>
            {vehicle ? (
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                <DataBlock label="Registration" value={vehicle.reg_plate ?? 'Not recorded'} />
                <DataBlock label="Vehicle type" value={VEHICLE_TYPE_LABEL[vehicle.type ?? ''] ?? vehicle.type ?? 'Not recorded'} />
                <DataBlock label="Payload / capacity" value={vehicle.payload_kg ? `${vehicle.payload_kg} kg` : 'Not recorded'} />
                <DataBlock label="Tail lift" value={vehicle.has_tail_lift ? 'Equipped' : 'Not recorded'} />
              </div>
            ) : (
              <EmptyBlock title="No assigned vehicle" description="No vehicle is currently linked to this driver." />
            )}
          </section>

          <section style={sectionCardStyle}>
            <SectionEyebrow>Availability</SectionEyebrow>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.55rem' }}>
              {AVAILABILITY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => void handleAvailabilityChange(option.value)}
                  disabled={availabilityLoading}
                  style={{
                    minHeight: '48px',
                    padding: '0.8rem 0.7rem',
                    borderRadius: '8px',
                    border: availability === option.value ? `2px solid ${option.color}` : '1px solid #dbe4ee',
                    backgroundColor: availability === option.value ? option.bg : '#f8fafc',
                    color: availability === option.value ? option.color : '#475569',
                    fontWeight: 700,
                    cursor: availabilityLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div style={{ fontSize: '0.84rem', color: currentAvailability.color, marginTop: '0.7rem', fontWeight: 600 }}>
              Current status: {currentAvailability.label}
            </div>
          </section>

          <section style={sectionCardStyle}>
            <SectionEyebrow>POD Queue</SectionEyebrow>
            {loading ? (
              <LoadingBlock label="Loading POD queue…" />
            ) : pendingPODJobs.length > 0 ? (
              <div style={{ display: 'grid', gap: '0.6rem' }}>
                {pendingPODJobs.map((job) => (
                  <div key={job.id} style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.8rem' }}>
                    <div style={{ fontWeight: 700, color: ENTERPRISE_THEME.colors.text, marginBottom: '0.2rem' }}>#{job.id.slice(0, 8).toUpperCase()}</div>
                    <div style={{ fontSize: '0.8rem', color: ENTERPRISE_THEME.colors.muted, marginBottom: '0.65rem' }}>{job.delivery_location ?? 'Delivery not set'}</div>
                    <button style={{ ...primaryButtonStyle, width: '100%' }} onClick={() => launchPodUpload(job)}>
                      Upload POD
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyBlock title="No pending POD jobs" description="Delivered jobs with missing POD do not remain pending here." />
            )}
          </section>

          <section id="history" style={{ ...sectionCardStyle, gridColumn: isMobile ? 'auto' : 'span 2' }}>
            <SectionEyebrow>History</SectionEyebrow>
            {historyJobs.length > 0 ? (
              <div style={{ display: 'grid', gap: '0.6rem' }}>
                {historyJobs.map((job) => (
                  <button
                    key={job.id}
                    onClick={() => router.push(`/driver/jobs/${job.id}`)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      gap: '0.75rem',
                      alignItems: 'center',
                      width: '100%',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      backgroundColor: '#f8fafc',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, color: ENTERPRISE_THEME.colors.text }}>#{job.id.slice(0, 8).toUpperCase()}</div>
                      <div style={{ fontSize: '0.8rem', color: ENTERPRISE_THEME.colors.muted, marginTop: '0.18rem' }}>
                        {job.pickup_location ?? 'Pickup not set'} → {job.delivery_location ?? 'Delivery not set'}
                      </div>
                    </div>
                    <StatusBadge status={job.status} />
                  </button>
                ))}
              </div>
            ) : (
              <EmptyBlock title="No history yet" description="Completed or closed jobs will appear here." />
            )}
          </section>

          <section style={sectionCardStyle}>
            <SectionEyebrow>Earnings</SectionEyebrow>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <DataBlock label="Total earned" value={`£${earnings.total.toFixed(2)}`} />
              <DataBlock label="This week" value={`£${earnings.week.toFixed(2)}`} />
              <DataBlock label="Jobs completed" value={String(earnings.count)} />
            </div>
          </section>

          <section style={sectionCardStyle}>
            <SectionEyebrow>Account Security</SectionEyebrow>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <DataBlock label="Driver" value={driverName} />
              <DataBlock label="Email" value={user?.email ?? 'Not recorded'} />
              <DataBlock label="Phone" value={driverPhone || 'Not recorded'} />
              <DataBlock label="Availability" value={currentAvailability.label} />
              <Link href="/driver/change-password" style={{ ...primaryButtonStyle, textDecoration: 'none', display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }}>
                Change Password
              </Link>
            </div>
          </section>
        </div>
      </main>
    </div>
  );

  return <ProtectedRoute allowedRoles={['driver']}>{dashboard}</ProtectedRoute>;
}


function buildActionStyle(disabled: boolean, primary = false): CSSProperties {
  const base = primary ? primaryButtonStyle : secondaryButtonStyle;
  return {
    ...base,
    opacity: disabled ? 0.45 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

function buildToolbarButton(disabled: boolean, primary = false): CSSProperties {
  const base = primary ? primaryButtonStyle : secondaryButtonStyle;
  return {
    ...base,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: disabled ? 0.45 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

function buildToolbarLinkStyle(): CSSProperties {
  return {
    ...secondaryButtonStyle,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
}

function SectionEyebrow({ children }: { children: string }) {
  return (
    <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '0.45rem' }}>
      {children}
    </div>
  );
}

function LoadingBlock({ label }: { label: string }) {
  return <div style={{ color: '#64748b', fontSize: '0.95rem' }}>{label}</div>;
}

function EmptyBlock({ title, description }: { title: string; description: string }) {
  return (
    <div style={{ backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '14px', padding: '1rem' }}>
      <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem' }}>{title}</div>
      <div style={{ color: '#64748b', fontSize: '0.92rem' }}>{description}</div>
    </div>
  );
}

function DataBlock({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ backgroundColor: '#f8fafc', borderRadius: '14px', padding: '0.85rem' }}>
      <div style={{ fontSize: '0.74rem', color: '#64748b', marginBottom: '0.25rem' }}>{label}</div>
      <div style={{ color: '#0f172a', fontWeight: 800, lineHeight: 1.4 }}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors = getStatusPresentation(status);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.bg,
        color: colors.fg,
        borderRadius: '999px',
        padding: '0.32rem 0.65rem',
        fontSize: '0.72rem',
        fontWeight: 800,
      }}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function StopCard({
  title,
  address,
  windowLabel,
  contactName,
  contactPhone,
  note,
}: {
  title: string;
  address: string;
  windowLabel: string;
  contactName?: string | null;
  contactPhone?: string | null;
  note: string;
}) {
  const displayName = contactName || contactPhone || 'No contact provided';
  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <DataBlock label="Job reference" value={title} />
      <DataBlock label="Address" value={address} />
      <DataBlock label="Time / window" value={windowLabel} />
      <div style={{ backgroundColor: '#f8fafc', borderRadius: '14px', padding: '0.85rem' }}>
        <div style={{ fontSize: '0.74rem', color: '#64748b', marginBottom: '0.25rem' }}>Contact / client note</div>
        {contactPhone ? (
          <a href={`tel:${contactPhone}`} style={{ color: '#1d4ed8', fontWeight: 700, textDecoration: 'none', fontSize: '0.9rem' }}>
            📞 {displayName}
          </a>
        ) : (
          <div style={{ color: '#0f172a', fontWeight: 800, lineHeight: 1.4 }}>{displayName}</div>
        )}
        {note && note !== 'No client note.' && (
          <div style={{ marginTop: '0.35rem', color: '#9a3412', fontSize: '0.8rem', whiteSpace: 'pre-line' }}>{note}</div>
        )}
      </div>
    </div>
  );
}
