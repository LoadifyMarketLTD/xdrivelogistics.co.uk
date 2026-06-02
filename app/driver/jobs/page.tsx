'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { getMissingColumnFromError } from '../../../lib/supabaseSchemaCompat';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';

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

const pageShellStyle: CSSProperties = {
  minHeight: '100dvh',
  background: 'linear-gradient(180deg, #0A2239 0%, #0f2f4a 220px, #f3f7fb 220px, #f3f7fb 100%)',
  padding: '1.25rem',
};

const cardStyle: CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '18px',
  border: '1px solid #dbe4ee',
  boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)',
  padding: '1rem',
};

const primaryButtonStyle: CSSProperties = {
  backgroundColor: '#1d4ed8',
  color: '#ffffff',
  border: 'none',
  borderRadius: '12px',
  padding: '0.8rem 0.95rem',
  fontWeight: 700,
  cursor: 'pointer',
};

const secondaryButtonStyle: CSSProperties = {
  backgroundColor: '#eff6ff',
  color: '#1d4ed8',
  border: '1px solid #bfdbfe',
  borderRadius: '12px',
  padding: '0.8rem 0.95rem',
  fontWeight: 700,
  cursor: 'pointer',
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
  const previewMode = typeof window !== 'undefined' && window.location.search.includes('mock-dashboard=1');

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
    if (!previewMode || user?.driverId) return;

    setDriverName('Alex Driver');
    setDriverPhone('07700 900123');
    setAvailability('busy');
    setVehicle({
      reg_plate: 'LD24 XDL',
      type: 'van_large',
      payload_kg: 1350,
      has_tail_lift: true,
    });
    setJobs([
      {
        id: 'job-current-001',
        status: 'allocated',
        pickup_location: 'Unit 3, Heathrow Cargo Centre, TW6 3PF',
        delivery_location: '44 Southgate Road, London N1 3JG',
        pickup_contact_name: 'Warehouse Desk',
        pickup_contact_phone: '020 7946 1001',
        delivery_contact_name: 'Site Manager',
        delivery_contact_phone: '020 7946 2002',
        customer_notes: 'Call 20 minutes before arrival.',
        special_instructions: 'Use loading bay B.',
        collection_window_start: new Date().toISOString(),
        collection_window_end: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        delivery_window_start: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        delivery_window_end: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
        budget_amount: 145,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        delivery_photos: null,
      },
      {
        id: 'job-next-002',
        status: 'in_transit',
        pickup_location: 'Bluewater Retail Park, Dartford DA9 9ST',
        delivery_location: '18 Queen Street, Croydon CR0 1SY',
        pickup_contact_name: 'Store Lead',
        pickup_contact_phone: '020 7000 3003',
        delivery_contact_name: 'Receiving',
        delivery_contact_phone: '020 7000 4004',
        customer_notes: 'Fragile load.',
        special_instructions: 'Rear entrance only.',
        collection_window_start: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
        collection_window_end: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
        delivery_window_start: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
        delivery_window_end: new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString(),
        budget_amount: 120,
        created_at: new Date().toISOString(),
        updated_at: new Date(Date.now() + 60 * 1000).toISOString(),
        delivery_photos: null,
      },
      {
        id: 'job-pod-003',
        status: 'delivered',
        pickup_location: 'Barking Depot, IG11 0TT',
        delivery_location: '9 Market Square, Romford RM1 3AB',
        delivery_contact_name: 'Goods In',
        customer_notes: 'POD still required.',
        delivery_window_end: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        budget_amount: 88,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        delivery_photos: [],
      },
    ]);
    setEarnings({ total: 1850, week: 420, count: 18 });
    setLoading(false);
  }, [previewMode, user?.driverId]);

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

  const dashboard = (
      <div style={pageShellStyle}>
        <div style={{ width: '100%', maxWidth: '1180px', margin: '0 auto' }}>
          <header
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '1rem',
              alignItems: 'flex-start',
              color: '#ffffff',
              marginBottom: '1rem',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div style={{ color: '#93c5fd', fontSize: '0.8rem', marginBottom: '0.25rem' }}>Driver Dashboard</div>
              <h1 style={{ margin: 0, fontSize: '1.9rem', fontWeight: 800 }}>{driverName}</h1>
              <div style={{ color: '#bfdbfe', fontSize: '0.92rem', marginTop: '0.35rem' }}>
                {user?.email}
                {driverPhone ? ` · ${driverPhone}` : ''}
              </div>
            </div>
            <button onClick={logout} style={{ ...secondaryButtonStyle, backgroundColor: 'transparent', color: '#bfdbfe', borderColor: '#3b5c7c' }}>
              Logout
            </button>
          </header>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
            <section style={cardStyle}>
              <SectionEyebrow>1. Active Job / Current Job</SectionEyebrow>
              {loading ? (
                <LoadingBlock label="Loading current job…" />
              ) : currentJob ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: '0.76rem', color: '#64748b', marginBottom: '0.2rem' }}>Job reference</div>
                      <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>#{currentJob.id.slice(0, 8).toUpperCase()}</h2>
                    </div>
                    <StatusBadge status={currentJob.status} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginTop: '0.9rem' }}>
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
                </>
              ) : (
                <EmptyBlock title="No active job" description="No current job is assigned right now." />
              )}
            </section>

            <section style={cardStyle}>
              <SectionEyebrow>2. Next Collection</SectionEyebrow>
              {loading ? (
                <LoadingBlock label="Loading next collection…" />
              ) : nextCollection ? (
                <StopCard
                  title={`#${nextCollection.id.slice(0, 8).toUpperCase()}`}
                  address={nextCollection.pickup_location ?? 'Collection not set'}
                  windowLabel={formatTimeWindow(nextCollection.collection_window_start, nextCollection.collection_window_end)}
                  contact={joinContact(nextCollection.pickup_contact_name, nextCollection.pickup_contact_phone)}
                  note={nextCollection.customer_notes || nextCollection.special_instructions || 'No client note.'}
                />
              ) : (
                <EmptyBlock title="No collection queued" description="No collection stop is scheduled right now." />
              )}
            </section>

            <section style={cardStyle}>
              <SectionEyebrow>3. Next Delivery</SectionEyebrow>
              {loading ? (
                <LoadingBlock label="Loading next delivery…" />
              ) : nextDelivery ? (
                <StopCard
                  title={`#${nextDelivery.id.slice(0, 8).toUpperCase()}`}
                  address={nextDelivery.delivery_location ?? 'Delivery not set'}
                  windowLabel={formatTimeWindow(nextDelivery.delivery_window_start, nextDelivery.delivery_window_end)}
                  contact={joinContact(nextDelivery.delivery_contact_name, nextDelivery.delivery_contact_phone)}
                  note={nextDelivery.customer_notes || nextDelivery.special_instructions || 'No client note.'}
                />
              ) : (
                <EmptyBlock title="No delivery queued" description="No delivery stop is scheduled right now." />
              )}
            </section>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(320px, 1fr)', gap: '1rem', marginTop: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <section style={cardStyle}>
                <SectionEyebrow>4. Today&apos;s Jobs</SectionEyebrow>
                {loading ? (
                  <LoadingBlock label="Loading today’s jobs…" />
                ) : todayJobs.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {todayJobs.map((job) => (
                      <button
                        key={job.id}
                        onClick={() => router.push(`/driver/jobs/${job.id}`)}
                        style={{
                          backgroundColor: '#f8fafc',
                          border: '1px solid #dbe4ee',
                          borderRadius: '14px',
                          padding: '0.9rem',
                          textAlign: 'left',
                          cursor: 'pointer',
                          display: 'grid',
                          gridTemplateColumns: '1fr auto',
                          gap: '0.75rem',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 800, color: '#0f172a' }}>#{job.id.slice(0, 8).toUpperCase()}</div>
                          <div style={{ fontSize: '0.88rem', color: '#475569', marginTop: '0.2rem' }}>
                            {job.pickup_location ?? 'Pickup not set'} → {job.delivery_location ?? 'Delivery not set'}
                          </div>
                        </div>
                        <StatusBadge status={job.status} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <EmptyBlock title="No jobs for today" description="No jobs are assigned for today." />
                )}
              </section>

              <section style={cardStyle}>
                <SectionEyebrow>5. Job Actions</SectionEyebrow>
                <input
                  ref={podInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={handlePODUpload}
                />
                <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => void updateJobStatus(currentJob, 'allocated')}
                    disabled={!currentJob || currentJob.status !== 'allocated' || actionLoading}
                    style={buildActionStyle(!currentJob || currentJob.status !== 'allocated' || actionLoading, true)}
                  >
                    Accept Job
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
                    disabled={!currentJob && !pendingPODJobs[0]}
                    style={buildActionStyle((!currentJob && !pendingPODJobs[0]) || actionLoading)}
                  >
                    Upload POD
                  </button>
                  <button
                    onClick={handleViewMap}
                    disabled={!buildMapsAddress(currentJob)}
                    style={buildActionStyle(!buildMapsAddress(currentJob) || actionLoading)}
                  >
                    View on Map
                  </button>
                </div>
                {actionMsg && (
                  <div
                    style={{
                      marginTop: '0.75rem',
                      padding: '0.7rem 0.85rem',
                      borderRadius: '10px',
                      backgroundColor: actionMsg.startsWith('❌') ? '#fef2f2' : '#f0fdf4',
                      color: actionMsg.startsWith('❌') ? '#dc2626' : '#15803d',
                      fontWeight: 700,
                      fontSize: '0.88rem',
                    }}
                  >
                    {actionMsg}
                  </div>
                )}
              </section>

              <section style={cardStyle}>
                <SectionEyebrow>6. POD / ePOD</SectionEyebrow>
                {loading ? (
                  <LoadingBlock label="Loading POD queue…" />
                ) : pendingPODJobs.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {pendingPODJobs.map((job) => (
                      <div key={job.id} style={{ backgroundColor: '#f8fafc', border: '1px solid #dbe4ee', borderRadius: '14px', padding: '0.9rem' }}>
                        <div style={{ fontWeight: 800, color: '#0f172a' }}>#{job.id.slice(0, 8).toUpperCase()}</div>
                        <div style={{ fontSize: '0.88rem', color: '#475569', marginTop: '0.25rem' }}>{job.delivery_location ?? 'Delivery not set'}</div>
                        <button style={{ ...primaryButtonStyle, marginTop: '0.75rem', width: '100%' }} onClick={() => launchPodUpload(job)}>
                          Upload POD
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyBlock title="No pending POD jobs" description="Delivered jobs with missing POD do not remain pending here." />
                )}
              </section>
            </div>

            <aside style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <section style={cardStyle}>
                <SectionEyebrow>7. Assigned Vehicle</SectionEyebrow>
                {vehicle ? (
                  <div style={{ display: 'grid', gap: '0.75rem' }}>
                    <DataBlock label="Registration" value={vehicle.reg_plate ?? 'Not recorded'} />
                    <DataBlock label="Vehicle type" value={VEHICLE_TYPE_LABEL[vehicle.type ?? ''] ?? vehicle.type ?? 'Not recorded'} />
                    <DataBlock label="Payload / capacity" value={vehicle.payload_kg ? `${vehicle.payload_kg} kg` : 'Not recorded'} />
                  </div>
                ) : (
                  <EmptyBlock title="No assigned vehicle" description="No vehicle is currently linked to this driver." />
                )}
              </section>

              <section style={cardStyle}>
                <SectionEyebrow>8. Availability</SectionEyebrow>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {AVAILABILITY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => void handleAvailabilityChange(option.value)}
                      disabled={availabilityLoading}
                      style={{
                        flex: 1,
                        minWidth: '96px',
                        padding: '0.75rem 0.55rem',
                        borderRadius: '12px',
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
                <div style={{ fontSize: '0.84rem', color: currentAvailability.color, marginTop: '0.6rem' }}>
                  Current status: {currentAvailability.label}
                </div>
              </section>

              <section style={cardStyle}>
                <SectionEyebrow>9. Dispatcher / Company Notes</SectionEyebrow>
                {dispatcherNotes.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                    {dispatcherNotes.map((note, index) => (
                      <div key={`${note}-${index}`} style={{ backgroundColor: '#fff7ed', border: '1px solid #fdba74', color: '#9a3412', borderRadius: '14px', padding: '0.85rem' }}>
                        {note}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: '#64748b', fontSize: '0.95rem' }}>No dispatcher notes.</div>
                )}
              </section>
            </aside>
          </div>

          <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #dbe4ee', display: 'grid', gap: '1rem' }}>
            <section style={cardStyle}>
              <SectionEyebrow>History</SectionEyebrow>
              {historyJobs.length > 0 ? (
                <div style={{ display: 'grid', gap: '0.7rem' }}>
                  {historyJobs.map((job) => (
                    <button
                      key={job.id}
                      onClick={() => router.push(`/driver/jobs/${job.id}`)}
                      style={{
                        backgroundColor: '#f8fafc',
                        border: '1px solid #dbe4ee',
                        borderRadius: '14px',
                        padding: '0.85rem',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'grid',
                        gridTemplateColumns: '1fr auto',
                        gap: '0.75rem',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 800, color: '#0f172a' }}>#{job.id.slice(0, 8).toUpperCase()}</div>
                        <div style={{ fontSize: '0.86rem', color: '#475569', marginTop: '0.2rem' }}>
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

            <section style={cardStyle}>
              <SectionEyebrow>Earnings</SectionEyebrow>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                <DataBlock label="Total earned" value={`£${earnings.total.toFixed(2)}`} />
                <DataBlock label="This week" value={`£${earnings.week.toFixed(2)}`} />
                <DataBlock label="Jobs completed" value={String(earnings.count)} />
              </div>
            </section>

            <section style={cardStyle}>
              <SectionEyebrow>Account Security</SectionEyebrow>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ color: '#475569' }}>Manage your password and login security.</div>
                <Link href="/driver/change-password" style={{ ...primaryButtonStyle, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                  Change Password
                </Link>
              </div>
            </section>

            <section style={cardStyle}>
              <SectionEyebrow>Profile / Account Details</SectionEyebrow>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                <DataBlock label="Driver" value={driverName} />
                <DataBlock label="Email" value={user?.email ?? 'Not recorded'} />
                <DataBlock label="Phone" value={driverPhone || 'Not recorded'} />
                <DataBlock label="Availability" value={currentAvailability.label} />
              </div>
            </section>
          </div>
        </div>
      </div>
  );

  return previewMode ? dashboard : <ProtectedRoute allowedRoles={['driver']}>{dashboard}</ProtectedRoute>;
}

function joinContact(name?: string | null, phone?: string | null) {
  if (name && phone) return `${name} · ${phone}`;
  return name || phone || 'No contact provided';
}

function buildActionStyle(disabled: boolean, primary = false): CSSProperties {
  const base = primary ? primaryButtonStyle : secondaryButtonStyle;
  return {
    ...base,
    opacity: disabled ? 0.45 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
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
  contact,
  note,
}: {
  title: string;
  address: string;
  windowLabel: string;
  contact: string;
  note: string;
}) {
  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <DataBlock label="Job reference" value={title} />
      <DataBlock label="Address" value={address} />
      <DataBlock label="Time / window" value={windowLabel} />
      <DataBlock label="Contact / client note" value={`${contact}${note ? `\n${note}` : ''}`} />
    </div>
  );
}
