'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../components/AuthContext';
import ProtectedRoute from '../../components/ProtectedRoute';
import { resolveActiveCompanyId } from '../../../lib/activeCompany';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { isMissingColumnError } from '../../../lib/supabaseSchemaCompat';
import type { Vehicle } from '../../../lib/types/database';

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

      // Try full column set first; fall back gracefully if optional columns are missing
      const fullColumns = 'id, company_id, assigned_driver_id, type, reg_plate, make, model, manufacture_year, payload_kg, pallets_capacity, has_tail_lift, has_straps, has_blankets, created_at';
      const coreColumns = 'id, company_id, assigned_driver_id, type, reg_plate, make, model, manufacture_year, payload_kg, has_tail_lift, created_at';

      let vehicleRes = await supabase
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
        supabase.from('driver_locations').select('id, driver_id, recorded_at, lat, lng').eq('company_id', companyId).order('recorded_at', { ascending: false }).limit(300),
      ]);

      setVehicles((vehicleRes.data as Vehicle[]) ?? []);
      setDrivers((driverRes.data as FleetDriver[]) ?? []);
      setLocations((locationRes.data as DriverLocationRow[]) ?? []);
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

  return (
    <ProtectedRoute>
      <div style={{ minHeight: '100vh', background: '#f3f4f6', padding: '1rem' }}>
        <div style={{ width: '100%' }}>
          <h1 style={{ margin: 0, color: '#111827', fontSize: '2rem' }}>Fleet</h1>
          <p style={{ margin: '0.4rem 0 1rem 0', color: '#6b7280' }}>Operational vehicle availability and tracking status.</p>
        </div>
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflowX: 'auto', width: '100%' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '920px' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Vehicle', 'Type / Size', 'Status', 'Current / Last Tracked', 'Future Journey / Position', 'Tracked Notify'].map((h) => (
                  <th key={h} style={{ padding: '0.9rem', textAlign: 'left', fontSize: '0.8rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: '2rem', color: '#6b7280' }}>Loading fleet…</td></tr>
              ) : vehicles.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '2rem', color: '#6b7280' }}>No vehicles found.</td></tr>
              ) : (
                vehicles.map((vehicle, idx) => {
                  const driver = vehicle.assigned_driver_id ? driverById.get(vehicle.assigned_driver_id) : undefined;
                  const latest = vehicle.assigned_driver_id ? latestLocationByDriver.get(vehicle.assigned_driver_id) : undefined;
                  const currentLocation = latest?.lat != null && latest?.lng != null ? `${latest.lat.toFixed(4)}, ${latest.lng.toFixed(4)}` : 'Not tracked';
                  const status = driver?.availability_status ?? (vehicle.assigned_driver_id ? 'allocated' : 'unassigned');
                  return (
                    <tr key={vehicle.id} style={{ borderBottom: idx < vehicles.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                      <td style={{ padding: '0.9rem' }}>
                        <div style={{ fontWeight: 700, color: '#111827' }}>{vehicle.reg_plate || 'No reg plate'}</div>
                        <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{[vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'No make/model'}</div>
                      </td>
                      <td style={{ padding: '0.9rem', color: '#374151' }}>{vehicle.type?.replace(/_/g, ' ') || '—'}</td>
                      <td style={{ padding: '0.9rem', color: '#374151' }}>{status}</td>
                      <td style={{ padding: '0.9rem' }}>
                        <div style={{ color: '#111827', fontWeight: 600 }}>{currentLocation}</div>
                        <div style={{ color: '#6b7280', fontSize: '0.78rem' }}>{latest ? new Date(latest.recorded_at).toLocaleString('en-GB') : 'No tracking timestamp'}</div>
                      </td>
                      <td style={{ padding: '0.9rem', color: '#374151' }}>{driver?.display_name ? `Assigned: ${driver.display_name}` : 'No assigned future journey'}</td>
                      <td style={{ padding: '0.9rem', color: latest ? '#047857' : '#6b7280', fontWeight: 600 }}>{latest ? 'Tracked' : 'Notify when tracked'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </ProtectedRoute>
  );
}
