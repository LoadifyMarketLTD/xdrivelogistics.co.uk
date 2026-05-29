'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { resolveActiveCompanyId } from '../../../lib/activeCompany';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { isMissingColumnError } from '../../../lib/supabaseSchemaCompat';

type DriverRow = {
  id: string;
  display_name: string;
  status: string;
  created_at: string;
};

type VehicleRow = {
  id: string;
  reg_plate: string | null;
  type: string | null;
  make: string | null;
  model: string | null;
  manufacture_year: number | null;
  payload_kg: number | null;
  has_tail_lift: boolean | null;
  assigned_driver_id: string | null;
  created_at: string;
};

type TrackingRow = {
  id: string;
  driver_id: string;
  lat: number;
  lng: number;
  recorded_at: string;
};

type TabId = 'drivers' | 'vehicles' | 'tracking';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'drivers', label: 'Users / Drivers' },
  { id: 'vehicles', label: 'Company Vehicles' },
  { id: 'tracking', label: 'Vehicle Tracking' },
];

export default function DriversVehiclesPage() {
  const router = useRouter();
  const { user, hasSupabaseSession } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('drivers');
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [tracking, setTracking] = useState<TrackingRow[]>([]);
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
        setDrivers([]);
        setVehicles([]);
        setTracking([]);
        setLoading(false);
        return;
      }

      const [driversRes, vehiclesRes] = await Promise.all([
        supabase.from('drivers').select('id, display_name, status, created_at').eq('company_id', companyId).order('created_at', { ascending: false }).limit(30),
        supabase.from('vehicles').select('id, reg_plate, type, make, model, manufacture_year, payload_kg, has_tail_lift, assigned_driver_id, created_at').eq('company_id', companyId).order('created_at', { ascending: false }).limit(50),
      ]);
      let trackingRes = await supabase
        .from('driver_locations')
        .select('id, driver_id, lat, lng, recorded_at')
        .eq('company_id', companyId)
        .order('recorded_at', { ascending: false })
        .limit(50);

      if (isMissingColumnError(trackingRes.error, 'driver_locations', 'company_id')) {
        trackingRes = await supabase
          .from('driver_locations')
          .select('id, driver_id, lat, lng, recorded_at')
          .order('recorded_at', { ascending: false })
          .limit(50);
      }

      setDrivers((driversRes.data as DriverRow[]) ?? []);
      setVehicles((vehiclesRes.data as VehicleRow[]) ?? []);
      const driverIds = new Set(((driversRes.data as DriverRow[] | null) ?? []).map((row) => row.id));
      const trackingRows = ((trackingRes.data as TrackingRow[]) ?? []).filter((row) => driverIds.has(row.driver_id));
      setTracking(trackingRows);
      setLoading(false);
    };
    void load();
  }, [companyId]);

  const driverNameById = useMemo(() => new Map(drivers.map((driver) => [driver.id, driver.display_name])), [drivers]);

  return (
    <ProtectedRoute>
      <div style={{ minHeight: '100vh', background: '#f3f4f6', padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h1 style={{ margin: 0, color: '#111827', fontSize: '2rem' }}>Drivers & Vehicles</h1>
            <p style={{ margin: '0.35rem 0 0 0', color: '#6b7280' }}>Separate management area for users, vehicles, and tracking.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <button onClick={() => router.push('/admin/drivers')} style={{ padding: '0.6rem 0.9rem', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>Open Drivers Manager</button>
            <button onClick={() => router.push('/admin/vehicles')} style={{ padding: '0.6rem 0.9rem', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>Open Vehicles Manager</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.9rem', flexWrap: 'wrap' }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '0.55rem 0.85rem',
                borderRadius: '8px',
                border: activeTab === tab.id ? '1px solid #2563eb' : '1px solid #d1d5db',
                background: activeTab === tab.id ? '#eff6ff' : '#fff',
                color: activeTab === tab.id ? '#1d4ed8' : '#374151',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '0.9rem', overflowX: 'auto' }}>
          {loading ? (
            <div style={{ padding: '1rem', color: '#6b7280' }}>Loading…</div>
          ) : activeTab === 'drivers' ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  {['Name', 'Status', 'Created'].map((h) => <th key={h} style={{ padding: '0.8rem', textAlign: 'left', fontSize: '0.8rem', color: '#6b7280' }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {drivers.length === 0 ? (
                  <tr><td colSpan={3} style={{ padding: '1rem', color: '#6b7280' }}>No drivers found for this company. Use the <strong>Open Drivers Manager</strong> button above to add drivers.</td></tr>
                ) : (
                  drivers.map((driver, idx) => (
                    <tr key={driver.id} style={{ borderBottom: idx < drivers.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                      <td style={{ padding: '0.8rem', color: '#111827', fontWeight: 600 }}>{driver.display_name || '—'}</td>
                      <td style={{ padding: '0.8rem', color: '#374151' }}>{driver.status || '—'}</td>
                      <td style={{ padding: '0.8rem', color: '#6b7280' }}>{new Date(driver.created_at).toLocaleDateString('en-GB')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : activeTab === 'vehicles' ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '980px' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  {['Reg Plate', 'Type', 'Make / Model', 'Manufacture Year', 'Payload KG', 'Tail Lift', 'Assigned Driver', 'Created', 'Actions'].map((h) => (
                    <th key={h} style={{ padding: '0.8rem', textAlign: 'left', fontSize: '0.8rem', color: '#6b7280' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vehicles.map((vehicle, idx) => (
                  <tr key={vehicle.id} style={{ borderBottom: idx < vehicles.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                    <td style={{ padding: '0.8rem', color: '#111827', fontWeight: 600 }}>{vehicle.reg_plate || '—'}</td>
                    <td style={{ padding: '0.8rem', color: '#374151' }}>{vehicle.type?.replace(/_/g, ' ') || '—'}</td>
                    <td style={{ padding: '0.8rem', color: '#374151' }}>{[vehicle.make, vehicle.model].filter(Boolean).join(' ') || '—'}</td>
                    <td style={{ padding: '0.8rem', color: '#374151' }}>{vehicle.manufacture_year ?? '—'}</td>
                    <td style={{ padding: '0.8rem', color: '#374151' }}>{vehicle.payload_kg ?? '—'}</td>
                    <td style={{ padding: '0.8rem', color: '#374151' }}>{vehicle.has_tail_lift ? 'Yes' : 'No'}</td>
                    <td style={{ padding: '0.8rem', color: '#374151' }}>{vehicle.assigned_driver_id ? (driverNameById.get(vehicle.assigned_driver_id) || 'Assigned') : '—'}</td>
                    <td style={{ padding: '0.8rem', color: '#6b7280' }}>{new Date(vehicle.created_at).toLocaleDateString('en-GB')}</td>
                    <td style={{ padding: '0.8rem' }}>
                      <button onClick={() => router.push('/admin/vehicles')} style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: '0.8rem' }}>
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div>
              <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #f59e0b', borderRadius: '6px', padding: '0.25rem 0.6rem', fontSize: '0.8rem', fontWeight: 700 }}>⚠️ NOT IMPLEMENTED</span>
                <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>Live vehicle tracking via GPS is not yet active. Rows below require data from the <code>driver_locations</code> table.</span>
              </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  {['Driver', 'Last Position', 'Recorded'].map((h) => <th key={h} style={{ padding: '0.8rem', textAlign: 'left', fontSize: '0.8rem', color: '#6b7280' }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {tracking.length === 0 ? (
                  <tr><td colSpan={3} style={{ padding: '1rem', color: '#6b7280' }}>No tracking data available. GPS tracking integration required.</td></tr>
                ) : (
                  tracking.map((row, idx) => (
                    <tr key={row.id} style={{ borderBottom: idx < tracking.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                      <td style={{ padding: '0.8rem', color: '#111827', fontWeight: 600 }}>{driverNameById.get(row.driver_id) || 'Driver'}</td>
                      <td style={{ padding: '0.8rem', color: '#374151' }}>{row.lat.toFixed(4)}, {row.lng.toFixed(4)}</td>
                      <td style={{ padding: '0.8rem', color: '#6b7280' }}>{new Date(row.recorded_at).toLocaleString('en-GB')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
