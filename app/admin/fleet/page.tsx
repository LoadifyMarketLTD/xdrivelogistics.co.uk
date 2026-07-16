'use client';

import { useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { useAuth } from '../../components/AuthContext';
import ProtectedRoute from '../../components/ProtectedRoute';
import { resolveActiveCompanyId } from '../../../lib/activeCompany';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { isMissingColumnError } from '../../../lib/supabaseSchemaCompat';
import type { Vehicle } from '../../../lib/types/database';
import type { FleetPin } from './_components/FleetMap';
import { coordinatesFromLocation } from '../../../lib/geoLocation';

const FleetMap = lazy(() => import('./_components/FleetMap'));

type FleetDriver = {
  id: string;
  display_name: string;
  availability_status: 'available' | 'busy' | 'offline' | null;
};

type DriverLocationRow = {
  id: string;
  driver_id: string;
  recorded_at: string;
  location: unknown;
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
  available: { label: '🟢 Available', color: '#1D57D8', bg: '#F4F6F8', border: '#1D57D8' },
  busy: { label: '🟡 On a Job', color: '#1A1F2B', bg: '#F4F6F8', border: '#F5A300' },
  offline: { label: '🔴 Offline', color: '#1A1F2B', bg: '#F4F6F8', border: '#F4F6F8' },
  unassigned: { label: '⚪ Unassigned', color: '#0B2F6B', bg: '#F4F6F8', border: '#F4F6F8' },
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

export default function FleetPage() {
  const { user, hasSupabaseSession } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<FleetDriver[]>([]);
  const [locations, setLocations] = useState<DriverLocationRow[]>([]);
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

      const [driverRes, locationRes] = await Promise.all([
        supabase.from('drivers').select('id, display_name, availability_status').eq('company_id', companyId),
        supabase.from('driver_locations').select('id, driver_id, recorded_at, location').order('recorded_at', { ascending: false }).limit(300),
      ]);

      setVehicles(
        (vehicleRes.data ?? []).map((vehicle): Vehicle => ({
          ...vehicle,
          pallets_capacity: vehicle.pallets_capacity ?? null,
          has_straps: vehicle.has_straps ?? false,
          has_blankets: vehicle.has_blankets ?? false,
        }))
      );
      const loadedDrivers = (driverRes.data as FleetDriver[]) ?? [];
      const companyDriverIds = new Set(loadedDrivers.map((driver) => driver.id));
      setDrivers(loadedDrivers);
      setLocations(((locationRes.data as DriverLocationRow[]) ?? []).filter((location) => companyDriverIds.has(location.driver_id)));
      setLoading(false);
    };
    void load();
  }, [companyId]);

  const driverById = useMemo(() => {
    return new Map(drivers.map((driver) => [driver.id, driver]));
  }, [drivers]);

  // ── Realtime: update fleet positions on new driver_locations rows ────────────
  useEffect(() => {
    if (!isSupabaseConfigured || !companyId) return;

    const channel = supabase
      .channel(`fleet-positions-${companyId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'driver_locations',
        },
        (payload: { new: Record<string, unknown> }) => {
          const newRow = payload.new as DriverLocationRow;
          if (!driverById.has(newRow.driver_id)) return;
          setLocations((prev: DriverLocationRow[]) => {
            // Keep at most 300 rows; prepend the new one
            const updated = [newRow, ...prev.filter((r: DriverLocationRow) => r.id !== newRow.id)];
            return updated.slice(0, 300);
          });
        },
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [companyId, driverById]);

  const latestLocationByDriver = useMemo(() => {
    const map = new Map<string, DriverLocationRow>();
    for (const row of locations) {
      if (!map.has(row.driver_id)) map.set(row.driver_id, row);
    }
    return map;
  }, [locations]);

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

  const mapPins = useMemo((): FleetPin[] => {
    const pins: FleetPin[] = [];
    for (const v of vehicles) {
      if (!v.assigned_driver_id) continue;
      const driver = driverById.get(v.assigned_driver_id);
      const loc = latestLocationByDriver.get(v.assigned_driver_id);
      const coordinates = loc ? coordinatesFromLocation(loc.location) : { lat: null, lng: null };
      if (!loc || coordinates.lat == null || coordinates.lng == null) continue;
      pins.push({
        driverId: v.assigned_driver_id,
        driverName: driver?.display_name ?? 'Unknown driver',
        vehicleReg: v.reg_plate ?? '',
        vehicleType: v.type ?? 'unknown',
        availabilityStatus: driver?.availability_status ?? null,
        lat: coordinates.lat,
        lng: coordinates.lng,
        trackedAt: loc.recorded_at,
      });
    }
    return pins;
  }, [vehicles, driverById, latestLocationByDriver]);

  return (
    <ProtectedRoute>
      <div style={{ background: '#F4F6F8', padding: '0.85rem' }}>
        <div style={{ width: '100%', maxWidth: '1280px', margin: '0 auto' }}>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
            <div>
              <h1 style={{ margin: 0, color: '#1A1F2B', fontSize: '1.7rem', fontWeight: 700 }}>Fleet Workspace</h1>
              <p style={{ margin: '0.25rem 0 0 0', color: '#0B2F6B', fontSize: '0.84rem' }}>Live vehicle and driver availability.</p>
            </div>
          </div>

          {/* Live map */}
          {!loading && (
            <Suspense fallback={<div style={{ background: '#F4F6F8', borderRadius: '12px', height: '340px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0B2F6B' }}>Loading map…</div>}>
              <FleetMap
                pins={mapPins}
                style={{ height: '340px', marginBottom: '1rem' }}
              />
            </Suspense>
          )}

          {/* Availability summary bar */}
          {!loading && (
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              {[
                { key: 'available', label: '🟢 Available', count: availCounts.available, color: '#1D57D8', bg: '#F4F6F8', border: '#1D57D8' },
                { key: 'busy', label: '🟡 On a Job', count: availCounts.busy, color: '#1A1F2B', bg: '#F4F6F8', border: '#F5A300' },
                { key: 'offline', label: '🔴 Offline', count: availCounts.offline, color: '#1A1F2B', bg: '#F4F6F8', border: '#F4F6F8' },
                { key: 'unassigned', label: '⚪ No Driver', count: availCounts.unassigned, color: '#0B2F6B', bg: '#F4F6F8', border: '#F4F6F8' },
              ].map((s) => (
                <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.75rem', borderRadius: '999px', background: s.bg, border: `1px solid ${s.border}`, fontSize: '0.8rem', fontWeight: 700, color: s.color }}>
                  {s.label} <span style={{ background: s.color, color: '#FFFFFF', borderRadius: '999px', padding: '0.05rem 0.45rem', fontSize: '0.72rem' }}>{s.count}</span>
                </div>
              ))}
            </div>
          )}

          {/* Operational card grid */}
          {loading ? (
            <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid rgba(11, 47, 107, 0.16)', padding: '2rem', color: '#0B2F6B' }}>Loading fleet…</div>
          ) : vehicles.length === 0 ? (
            <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid rgba(11, 47, 107, 0.16)', padding: '2rem', color: '#0B2F6B' }}>No vehicles found.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '0.75rem' }}>
              {vehicles.map((vehicle) => {
                const driver = vehicle.assigned_driver_id ? driverById.get(vehicle.assigned_driver_id) : undefined;
                const latest = vehicle.assigned_driver_id ? latestLocationByDriver.get(vehicle.assigned_driver_id) : undefined;
                const availKey = driver?.availability_status ?? (vehicle.assigned_driver_id ? 'unassigned' : 'unassigned');
                const avail = AVAIL_CONFIG[availKey] ?? AVAIL_CONFIG.unassigned;
                const latestCoordinates = latest ? coordinatesFromLocation(latest.location) : { lat: null, lng: null };
                const locationStr = latestCoordinates.lat != null && latestCoordinates.lng != null
                  ? `${latestCoordinates.lat.toFixed(4)}, ${latestCoordinates.lng.toFixed(4)}`
                  : null;
                const trackedAt = latest ? new Date(latest.recorded_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : null;

                return (
                  <div
                    key={vehicle.id}
                    style={{
                      background: '#FFFFFF',
                      borderRadius: '12px',
                      border: `1px solid ${avail.border}`,
                      boxShadow: '0 4px 12px rgba(26, 31, 43, 0.06)',
                      padding: '0.9rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.6rem',
                    }}
                  >
                    {/* Card header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#1A1F2B' }}>{vehicle.reg_plate || 'No plate'}</div>
                        <div style={{ fontSize: '0.78rem', color: '#0B2F6B', marginTop: '0.1rem' }}>
                          {VEHICLE_TYPE_LABEL[vehicle.type ?? ''] ?? vehicle.type?.replace(/_/g, ' ') ?? 'Unknown type'}
                          {vehicle.payload_kg ? ` · ${vehicle.payload_kg} kg` : ''}
                        </div>
                      </div>
                      <span style={{ padding: '0.25rem 0.6rem', borderRadius: '999px', background: avail.bg, color: avail.color, fontSize: '0.73rem', fontWeight: 700, border: `1px solid ${avail.border}`, whiteSpace: 'nowrap' }}>
                        {avail.label}
                      </span>
                    </div>

                    {/* Driver row */}
                    <div style={{ fontSize: '0.82rem', color: '#1A1F2B' }}>
                      <span style={{ color: '#0B2F6B', fontWeight: 600 }}>Driver: </span>
                      {driver ? (
                        <span style={{ color: '#1A1F2B', fontWeight: 700 }}>{driver.display_name}</span>
                      ) : (
                        <span style={{ color: '#0B2F6B' }}>No driver assigned</span>
                      )}
                    </div>

                    {/* Location row */}
                    <div style={{ fontSize: '0.8rem', color: '#1A1F2B' }}>
                      <span style={{ color: '#0B2F6B', fontWeight: 600 }}>Location: </span>
                      {locationStr ? (
                        <span>{locationStr} <span style={{ color: '#0B2F6B' }}>· {trackedAt}</span></span>
                      ) : (
                        <span style={{ color: '#0B2F6B' }}>Not tracked</span>
                      )}
                    </div>

                    <div style={{ fontSize: '0.78rem', color: '#0B2F6B' }}>Use Drivers and Jobs modules for assignment workflows.</div>
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
