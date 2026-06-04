'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthContext';
import ProtectedRoute from '../../components/ProtectedRoute';
import { resolveActiveCompanyId } from '../../../lib/activeCompany';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { isMissingColumnError } from '../../../lib/supabaseSchemaCompat';
import type { Vehicle } from '../../../lib/types/database';
import { WorkflowStageStrip } from '../workflowUi';

type FleetDriver = {
  id: string;
  display_name: string;
  availability_status: 'available' | 'busy' | 'offline' | null;
};

type DriverLocationRow = {
  id: string;
  driver_id: string;
  recorded_at: string;
  lat: number | null;
  lng: number | null;
};

type AssignedJobRow = {
  id: string;
  status: string;
  pickup_location: string | null;
  delivery_location: string | null;
  assigned_driver_id: string | null;
};

type VehicleSelectRow = Omit<Vehicle, 'pallets_capacity' | 'has_straps' | 'has_blankets'> &
  Partial<Pick<Vehicle, 'pallets_capacity' | 'has_straps' | 'has_blankets'>>;

type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

const AVAIL_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  available: { label: '🟢 Available', color: '#15803d', bg: '#f0fdf4', border: '#86efac' },
  busy: { label: '🟡 On a Job', color: '#b45309', bg: '#fefce8', border: '#fde68a' },
  offline: { label: '🔴 Offline', color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' },
  unassigned: { label: '⚪ Unassigned', color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
};

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
  posted: 'Needs Dispatch',
  allocated: 'Allocated',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export default function FleetPage() {
  const router = useRouter();
  const { user, hasSupabaseSession } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<FleetDriver[]>([]);
  const [locations, setLocations] = useState<DriverLocationRow[]>([]);
  const [assignedJobs, setAssignedJobs] = useState<AssignedJobRow[]>([]);
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
        setLoading(false);
        setVehicles([]);
        setDrivers([]);
        setLocations([]);
        setAssignedJobs([]);
        return;
      }

      const fullColumns = 'id, company_id, assigned_driver_id, type, reg_plate, make, model, manufacture_year, payload_kg, pallets_capacity, has_tail_lift, has_straps, has_blankets, created_at';
      const coreColumns = 'id, company_id, assigned_driver_id, type, reg_plate, make, model, manufacture_year, payload_kg, has_tail_lift, created_at';

      let vehicleRes: { data: VehicleSelectRow[] | null; error: SupabaseErrorLike | null } = await supabase
        .from('vehicles')
        .select(fullColumns)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (
        isMissingColumnError(vehicleRes.error, 'vehicles', 'pallets_capacity') ||
        isMissingColumnError(vehicleRes.error, 'vehicles', 'has_straps') ||
        isMissingColumnError(vehicleRes.error, 'vehicles', 'has_blankets')
      ) {
        vehicleRes = await supabase
          .from('vehicles')
          .select(coreColumns)
          .eq('company_id', companyId)
          .order('created_at', { ascending: false });
      }

      const [driverRes, locationRes, jobRes] = await Promise.all([
        supabase.from('drivers').select('id, display_name, availability_status').eq('company_id', companyId),
        supabase.from('driver_locations').select('id, driver_id, recorded_at, lat, lng').eq('company_id', companyId).order('recorded_at', { ascending: false }).limit(300),
        supabase.from('jobs').select('id, status, pickup_location, delivery_location, assigned_driver_id').eq('company_id', companyId).in('status', ['allocated', 'in_transit']).order('updated_at', { ascending: false }),
      ]);

      setVehicles(
        (vehicleRes.data ?? []).map((vehicle): Vehicle => ({
          ...vehicle,
          pallets_capacity: vehicle.pallets_capacity ?? null,
          has_straps: vehicle.has_straps ?? false,
          has_blankets: vehicle.has_blankets ?? false,
        }))
      );
      setDrivers((driverRes.data as FleetDriver[]) ?? []);
      setLocations((locationRes.data as DriverLocationRow[]) ?? []);
      setAssignedJobs((jobRes.data as AssignedJobRow[]) ?? []);
      setLoading(false);
    };
    void load();
  }, [companyId]);

  const latestLocationByDriver = useMemo(() => {
    const map = new Map<string, DriverLocationRow>();
    for (const row of locations) {
      if (!map.has(row.driver_id)) map.set(row.driver_id, row);
    }
    return map;
  }, [locations]);

  const driverById = useMemo(() => {
    return new Map(drivers.map((driver) => [driver.id, driver]));
  }, [drivers]);

  const activeJobByDriverId = useMemo(() => {
    const map = new Map<string, AssignedJobRow>();
    for (const job of assignedJobs) {
      if (job.assigned_driver_id && !map.has(job.assigned_driver_id)) {
        map.set(job.assigned_driver_id, job);
      }
    }
    return map;
  }, [assignedJobs]);

  const availCounts = useMemo(() => {
    const counts = { available: 0, busy: 0, offline: 0, unassigned: 0 };
    for (const v of vehicles) {
      if (!v.assigned_driver_id) { counts.unassigned++; continue; }
      const d = driverById.get(v.assigned_driver_id);
      const status = d?.availability_status ?? 'unassigned';
      if (status === 'available') counts.available++;
      else if (status === 'busy') counts.busy++;
      else if (status === 'offline') counts.offline++;
      else counts.unassigned++;
    }
    return counts;
  }, [vehicles, driverById]);

  const btnBase: React.CSSProperties = {
    padding: '0.38rem 0.72rem',
    border: '1px solid #d1d5db',
    borderRadius: '7px',
    background: '#fff',
    cursor: 'pointer',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: '#0f172a',
    whiteSpace: 'nowrap',
  };

  return (
    <ProtectedRoute>
      <div style={{ minHeight: '100vh', background: '#eef2f6', padding: '1rem' }}>
        <div style={{ width: '100%', maxWidth: '1280px', margin: '0 auto' }}>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
            <div>
              <h1 style={{ margin: 0, color: '#111827', fontSize: '1.7rem', fontWeight: 700 }}>Fleet Workspace</h1>
              <p style={{ margin: '0.25rem 0 0 0', color: '#6b7280', fontSize: '0.84rem' }}>Vehicle · Driver · Job — unified operational view.</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button onClick={() => router.push('/admin/drivers')} style={btnBase}>Drivers</button>
              <button onClick={() => router.push('/admin/vehicles')} style={btnBase}>Vehicles</button>
              <button onClick={() => router.push('/admin/documents')} style={btnBase}>Documents</button>
              <button onClick={() => router.push('/admin/diary')} style={{ ...btnBase, background: '#1d4ed8', color: '#fff', borderColor: '#1d4ed8' }}>Open Diary</button>
            </div>
          </div>

          {/* Availability summary bar */}
          {!loading && (
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              {[
                { key: 'available', label: '🟢 Available', count: availCounts.available, color: '#15803d', bg: '#f0fdf4', border: '#86efac' },
                { key: 'busy', label: '🟡 On a Job', count: availCounts.busy, color: '#b45309', bg: '#fefce8', border: '#fde68a' },
                { key: 'offline', label: '🔴 Offline', count: availCounts.offline, color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' },
                { key: 'unassigned', label: '⚪ No Driver', count: availCounts.unassigned, color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
              ].map((s) => (
                <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.75rem', borderRadius: '999px', background: s.bg, border: `1px solid ${s.border}`, fontSize: '0.8rem', fontWeight: 700, color: s.color }}>
                  {s.label} <span style={{ background: s.color, color: '#fff', borderRadius: '999px', padding: '0.05rem 0.45rem', fontSize: '0.72rem' }}>{s.count}</span>
                </div>
              ))}
            </div>
          )}

          <WorkflowStageStrip
            activeStage="track"
            counts={{
              assign: availCounts.available,
              track: vehicles.length,
              complete: availCounts.busy,
            }}
          />

          {/* Operational card grid */}
          {loading ? (
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '2rem', color: '#6b7280' }}>Loading fleet…</div>
          ) : vehicles.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '2rem', color: '#6b7280' }}>No vehicles found.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '0.75rem' }}>
              {vehicles.map((vehicle) => {
                const driver = vehicle.assigned_driver_id ? driverById.get(vehicle.assigned_driver_id) : undefined;
                const latest = vehicle.assigned_driver_id ? latestLocationByDriver.get(vehicle.assigned_driver_id) : undefined;
                const activeJob = vehicle.assigned_driver_id ? activeJobByDriverId.get(vehicle.assigned_driver_id) : undefined;
                const availKey = driver?.availability_status ?? (vehicle.assigned_driver_id ? 'unassigned' : 'unassigned');
                const avail = AVAIL_CONFIG[availKey] ?? AVAIL_CONFIG.unassigned;
                const locationStr = latest?.lat != null && latest?.lng != null
                  ? `${latest.lat.toFixed(4)}, ${latest.lng.toFixed(4)}`
                  : null;
                const trackedAt = latest ? new Date(latest.recorded_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : null;

                return (
                  <div
                    key={vehicle.id}
                    style={{
                      background: '#fff',
                      borderRadius: '12px',
                      border: `1px solid ${avail.border}`,
                      boxShadow: '0 4px 12px rgba(15,23,42,0.06)',
                      padding: '0.9rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.6rem',
                    }}
                  >
                    {/* Card header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a' }}>{vehicle.reg_plate || 'No plate'}</div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.1rem' }}>
                          {VEHICLE_TYPE_LABEL[vehicle.type ?? ''] ?? vehicle.type?.replace(/_/g, ' ') ?? 'Unknown type'}
                          {vehicle.payload_kg ? ` · ${vehicle.payload_kg} kg` : ''}
                        </div>
                      </div>
                      <span style={{ padding: '0.25rem 0.6rem', borderRadius: '999px', background: avail.bg, color: avail.color, fontSize: '0.73rem', fontWeight: 700, border: `1px solid ${avail.border}`, whiteSpace: 'nowrap' }}>
                        {avail.label}
                      </span>
                    </div>

                    {/* Driver row */}
                    <div style={{ fontSize: '0.82rem', color: '#374151' }}>
                      <span style={{ color: '#64748b', fontWeight: 600 }}>Driver: </span>
                      {driver ? (
                        <button
                          onClick={() => router.push('/admin/drivers')}
                          style={{ background: 'none', border: 'none', color: '#1d4ed8', fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: '0.82rem' }}
                        >
                          {driver.display_name}
                        </button>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>No driver assigned</span>
                      )}
                    </div>

                    {/* Location row */}
                    <div style={{ fontSize: '0.8rem', color: '#374151' }}>
                      <span style={{ color: '#64748b', fontWeight: 600 }}>Location: </span>
                      {locationStr ? (
                        <span>{locationStr} <span style={{ color: '#94a3b8' }}>· {trackedAt}</span></span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>Not tracked</span>
                      )}
                    </div>

                    {/* Assigned job row */}
                    {activeJob ? (
                      <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '0.5rem 0.65rem', fontSize: '0.8rem' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.2rem' }}>
                          #{activeJob.id.slice(0, 8).toUpperCase()}
                          <span style={{ marginLeft: '0.4rem', fontSize: '0.72rem', color: '#0369a1', fontWeight: 600 }}>{STATUS_LABEL[activeJob.status] ?? activeJob.status}</span>
                        </div>
                        <div style={{ color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {activeJob.pickup_location ?? 'Pickup TBC'} → {activeJob.delivery_location ?? 'Delivery TBC'}
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>No active job assigned</div>
                    )}

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginTop: '0.1rem' }}>
                      {activeJob && (
                        <button
                          onClick={() => router.push('/admin/jobs')}
                          style={{ ...btnBase, background: '#eff6ff', borderColor: '#bfdbfe', color: '#1d4ed8' }}
                        >
                          View Job →
                        </button>
                      )}
                      <button
                        onClick={() => router.push('/admin/diary')}
                        style={{ ...btnBase, background: '#f0fdf4', borderColor: '#86efac', color: '#15803d' }}
                      >
                        Open Diary
                      </button>
                      {driver && availKey !== 'available' && (
                        <button
                          onClick={() => router.push('/admin/drivers')}
                          style={{ ...btnBase }}
                        >
                          Manage Driver
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
