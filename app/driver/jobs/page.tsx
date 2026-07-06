'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, CheckCircle2, Clock3, MapPin, Navigation, PackageCheck, RefreshCw, Truck } from 'lucide-react';
import ProtectedRoute from '../../components/ProtectedRoute';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { VEHICLE_TYPE_LABELS } from '../../../lib/vehicleTypes';
import { useDriverLocationPublisher } from '../../hooks/useDriverLocationPublisher';

type DriverRow = {
  id: string;
  display_name: string | null;
  availability_status: string | null;
  status: string | null;
};

type JobRow = {
  id: string;
  status: string;
  pickup_location: string | null;
  pickup_postcode: string | null;
  pickup_datetime: string | null;
  delivery_location: string | null;
  delivery_postcode: string | null;
  delivery_datetime: string | null;
  vehicle_type: string | null;
  cargo_type: string | null;
  load_details: string | null;
  assigned_driver_id: string | null;
  collection_photo_url: string | null;
  delivery_photos: string[] | null;
  status_history: Array<{ status: string; timestamp: string }> | null;
};

const ACTIVE_STATUSES = ['allocated', 'collected', 'in_transit'];
const TODAY_STATUSES = ['allocated', 'collected', 'in_transit', 'delivered'];

const STATUS_LABELS: Record<string, string> = {
  allocated: 'Ready for pickup',
  collected: 'Loaded',
  in_transit: 'On route',
  delivered: 'Delivered',
  driver_en_route: 'On route',
  arrived_pickup: 'Arrived pickup',
  arrived_delivery: 'Arrived delivery',
};

const VEHICLE_LABELS = VEHICLE_TYPE_LABELS;

function fmtTime(value: string | null) {
  if (!value) return 'TBC';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'TBC';
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(value: string | null) {
  if (!value) return 'TBC';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'TBC';
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
}

function sameDay(value: string | null, today = new Date()) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
}

function hasEvent(job: JobRow | null, event: string) {
  return Array.isArray(job?.status_history) && job.status_history.some((entry) => entry.status === event);
}

export default function DriverHomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const driverId = typeof user?.driverId === 'string' ? user.driverId.trim() : '';

  const [driver, setDriver] = useState<DriverRow | null>(null);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadHome = useCallback(async () => {
    if (!isSupabaseConfigured || !driverId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');

    const [driverRes, jobsRes] = await Promise.all([
      supabase
        .from('drivers')
        .select('id, display_name, availability_status, status')
        .eq('id', driverId)
        .maybeSingle(),
      supabase
        .from('jobs')
        .select('id, status, pickup_location, pickup_postcode, pickup_datetime, delivery_location, delivery_postcode, delivery_datetime, vehicle_type, cargo_type, load_details, assigned_driver_id, collection_photo_url, delivery_photos, status_history')
        .eq('assigned_driver_id', driverId)
        .in('status', TODAY_STATUSES)
        .order('pickup_datetime', { ascending: true })
        .limit(20),
    ]);

    if (driverRes.error) setError(`Driver profile could not be loaded: ${driverRes.error.message}`);
    else setDriver(driverRes.data as DriverRow | null);

    if (jobsRes.error) {
      setError(`Jobs could not be loaded: ${jobsRes.error.message}`);
      setJobs([]);
    } else {
      setJobs((jobsRes.data ?? []) as JobRow[]);
    }

    setLoading(false);
  }, [driverId]);

  useEffect(() => {
    void loadHome();
  }, [loadHome]);

  const activeJob = useMemo(
    () => jobs.find((job) => ACTIVE_STATUSES.includes(job.status)) ?? null,
    [jobs]
  );
  useDriverLocationPublisher(activeJob?.status, Boolean(activeJob));

  const todaysJobs = useMemo(
    () => jobs.filter((job) => sameDay(job.pickup_datetime) || sameDay(job.delivery_datetime) || ACTIVE_STATUSES.includes(job.status)),
    [jobs]
  );

  const updateJob = async (job: JobRow, nextStatus: string, eventOnly = false) => {
    if (!driverId || actionLoading) return;
    setActionLoading(true);
    setError('');
    setMessage('');

    const history = Array.isArray(job.status_history) ? job.status_history : [];
    const nextHistory = [...history, { status: nextStatus, timestamp: new Date().toISOString() }];
    const update = eventOnly ? { status_history: nextHistory } : { status: nextStatus, status_history: nextHistory };

    const { error: updateError } = await supabase
      .from('jobs')
      .update(update)
      .eq('id', job.id)
      .eq('assigned_driver_id', driverId);

    if (updateError) {
      setError(updateError.message);
    } else {
      setMessage(`${STATUS_LABELS[nextStatus] ?? nextStatus} recorded`);
      await loadHome();
      window.setTimeout(() => setMessage(''), 3000);
    }
    setActionLoading(false);
  };

  const driverStatus = driver?.availability_status ?? driver?.status ?? 'active';
  const vehicleLabel = activeJob?.vehicle_type ? (VEHICLE_LABELS[activeJob.vehicle_type] ?? activeJob.vehicle_type) : 'Not assigned';

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell driverName={driver?.display_name ?? undefined} availabilityLabel={driverStatus}>
        <section style={{ display: 'grid', gap: '0.85rem' }}>
          {error && <Notice tone="error" text={error} />}
          {message && <Notice tone="success" text={message} />}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
            <div>
              <p style={{ margin: 0, color: '#facc15', fontSize: '0.72rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Active work</p>
              <h1 style={{ margin: '0.1rem 0 0', color: '#f8fafc', fontSize: '1.45rem', lineHeight: 1.1 }}>What is next?</h1>
            </div>
            <button onClick={() => void loadHome()} disabled={loading} aria-label="Refresh" style={{ width: '44px', height: '44px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', background: '#111d2f', color: '#facc15', display: 'grid', placeItems: 'center', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.55 : 1 }}>
              <RefreshCw size={20} />
            </button>
          </div>

          <div style={{ borderRadius: '24px', border: '1px solid rgba(250,204,21,0.22)', background: activeJob ? 'linear-gradient(145deg, #18243a, #101b2d)' : '#111d2f', padding: '1rem', boxShadow: '0 18px 40px rgba(0,0,0,0.28)' }}>
            {loading ? (
              <div style={{ color: '#94a3b8', padding: '2rem 0', textAlign: 'center', fontWeight: 700 }}>Loading work</div>
            ) : activeJob ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div>
                    <span style={{ display: 'inline-flex', color: '#0b1524', background: '#facc15', borderRadius: '999px', padding: '0.22rem 0.55rem', fontSize: '0.72rem', fontWeight: 900 }}>{STATUS_LABELS[activeJob.status] ?? activeJob.status}</span>
                    <h2 style={{ margin: '0.65rem 0 0', color: '#f8fafc', fontSize: '1.35rem', lineHeight: 1.15 }}>{activeJob.pickup_location ?? 'Pickup TBC'}</h2>
                    <p style={{ margin: '0.25rem 0 0', color: '#94a3b8', fontWeight: 700 }}>to {activeJob.delivery_location ?? 'Delivery TBC'}</p>
                  </div>
                  <button onClick={() => router.push(`/driver/jobs/${activeJob.id}`)} style={{ alignSelf: 'flex-start', minHeight: '42px', borderRadius: '14px', border: 'none', background: '#f8fafc', color: '#0b1524', padding: '0 0.85rem', fontWeight: 900, cursor: 'pointer' }}>Open</button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', marginBottom: '1rem' }}>
                  <MiniMetric icon={<Clock3 size={18} />} label="Pickup" value={`${fmtDate(activeJob.pickup_datetime)} ${fmtTime(activeJob.pickup_datetime)}`} />
                  <MiniMetric icon={<MapPin size={18} />} label="Delivery" value={`${fmtDate(activeJob.delivery_datetime)} ${fmtTime(activeJob.delivery_datetime)}`} />
                  <MiniMetric icon={<Truck size={18} />} label="Vehicle" value={vehicleLabel} />
                  <MiniMetric icon={<Navigation size={18} />} label="Tracking" value={driverStatus} />
                </div>

                <div style={{ display: 'grid', gap: '0.55rem' }}>
                  <QuickAction label="On Route" icon={<Navigation size={20} />} disabled={actionLoading || hasEvent(activeJob, 'driver_en_route')} onClick={() => updateJob(activeJob, 'driver_en_route', true)} />
                  <QuickAction label="Arrived" icon={<MapPin size={20} />} disabled={actionLoading || hasEvent(activeJob, activeJob.status === 'in_transit' ? 'arrived_delivery' : 'arrived_pickup')} onClick={() => updateJob(activeJob, activeJob.status === 'in_transit' ? 'arrived_delivery' : 'arrived_pickup', true)} />
                  <QuickAction label="Loaded" icon={<PackageCheck size={20} />} disabled={actionLoading || activeJob.status !== 'allocated'} onClick={() => updateJob(activeJob, 'collected')} />
                  <QuickAction label="Delivered / POD" icon={<Camera size={20} />} disabled={actionLoading} onClick={() => router.push(`/driver/jobs/${activeJob.id}`)} />
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '2.25rem 0.5rem' }}>
                <CheckCircle2 size={42} color="#86efac" />
                <h2 style={{ color: '#f8fafc', margin: '0.7rem 0 0.25rem', fontSize: '1.25rem' }}>No active job</h2>
                <p style={{ color: '#94a3b8', margin: 0, lineHeight: 1.45 }}>You are clear right now. New work will appear here first.</p>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
            <StatusTile label="Today" value={todaysJobs.length} />
            <StatusTile label="Vehicle" value={vehicleLabel} />
          </div>

          <section style={{ display: 'grid', gap: '0.55rem' }}>
            <h2 style={{ color: '#f8fafc', fontSize: '1rem', margin: '0.25rem 0 0' }}>Today's jobs</h2>
            {todaysJobs.length === 0 ? (
              <div style={{ color: '#94a3b8', background: '#111d2f', borderRadius: '18px', padding: '1rem', border: '1px solid rgba(255,255,255,0.08)' }}>No jobs scheduled for today.</div>
            ) : (
              todaysJobs.map((job) => (
                <button key={job.id} onClick={() => router.push(`/driver/jobs/${job.id}`)} style={{ border: '1px solid rgba(255,255,255,0.08)', background: '#111d2f', color: '#f8fafc', borderRadius: '18px', padding: '0.85rem', textAlign: 'left', display: 'grid', gap: '0.35rem', cursor: 'pointer' }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' }}>
                    <strong style={{ fontSize: '0.95rem' }}>{job.pickup_location ?? 'Pickup TBC'}</strong>
                    <span style={{ color: '#facc15', fontWeight: 900, fontSize: '0.78rem' }}>{fmtTime(job.pickup_datetime)}</span>
                  </span>
                  <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>to {job.delivery_location ?? 'Delivery TBC'}</span>
                </button>
              ))
            )}
          </section>
        </section>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}

function Notice({ tone, text }: { tone: 'error' | 'success'; text: string }) {
  const isError = tone === 'error';
  return <div style={{ background: isError ? 'rgba(239,68,68,0.14)' : 'rgba(34,197,94,0.14)', border: `1px solid ${isError ? 'rgba(248,113,113,0.35)' : 'rgba(134,239,172,0.35)'}`, color: isError ? '#fecaca' : '#bbf7d0', borderRadius: '16px', padding: '0.75rem 0.85rem', fontSize: '0.85rem', fontWeight: 800 }}>{text}</div>;
}

function MiniMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '18px', padding: '0.75rem', minHeight: '82px' }}>
      <div style={{ color: '#facc15', marginBottom: '0.35rem' }}>{icon}</div>
      <div style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ color: '#f8fafc', fontWeight: 900, fontSize: '0.88rem', marginTop: '0.15rem' }}>{value}</div>
    </div>
  );
}

function QuickAction({ icon, label, disabled, onClick }: { icon: React.ReactNode; label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ minHeight: '54px', borderRadius: '18px', border: 'none', background: disabled ? 'rgba(148,163,184,0.14)' : '#facc15', color: disabled ? '#64748b' : '#0b1524', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.55rem', fontWeight: 900, fontSize: '0.95rem', cursor: disabled ? 'default' : 'pointer' }}>
      {icon}{label}
    </button>
  );
}

function StatusTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ background: '#111d2f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '18px', padding: '0.85rem' }}>
      <div style={{ color: '#94a3b8', fontSize: '0.72rem', fontWeight: 900, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ color: '#f8fafc', fontSize: '1.05rem', fontWeight: 900, marginTop: '0.2rem' }}>{value}</div>
    </div>
  );
}
