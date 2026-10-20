'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { readRouteAuthAccessToken } from '../../../lib/routeAuthCookie';
import { VEHICLE_TYPE_LABELS } from '../../../lib/vehicleTypes';
import { StatusBadge } from '../../components/workspace/WorkspaceUI';
import { VehicleRegisterShell } from '../../components/workspace/VehicleRegisterShell';

type VehicleRow = {
  id: string;
  type: string | null;
  reg_plate: string | null;
  make: string | null;
  model: string | null;
  payload_kg: number | null;
  pallets_capacity: number | null;
  has_tail_lift: boolean | null;
  assigned_driver_id: string | null;
};

const vehicleName = (vehicle: VehicleRow) =>
  [vehicle.make, vehicle.model].filter(Boolean).join(' ') || vehicle.reg_plate || 'Vehicle';
export default function DriverDriversVehiclesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const driverId = typeof user?.driverId === 'string' ? user.driverId.trim() : '';
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [canonicalVehicleId, setCanonicalVehicleId] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'users' | 'vehicles' | 'tracking'>('users');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const token = readRouteAuthAccessToken();
    if (!token) {
      setError('Your session has expired.');
      setLoading(false);
      return;
    }
    const response = await fetch('/api/driver/vehicles', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
    const payload = await response.json().catch(() => ({})) as { vehicles?: VehicleRow[]; canonicalVehicleId?: string | null; canManageVehicles?: boolean; error?: string };
    if (!response.ok) {
      setVehicles([]);
      setError(payload.error ?? 'Vehicle data could not be loaded.');
    } else {
      setVehicles(payload.vehicles ?? []);
      setCanonicalVehicleId(payload.canonicalVehicleId ?? null);
      setCanManage(payload.canManageVehicles === true);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return vehicles;
    return vehicles.filter((vehicle) => [vehicle.reg_plate, vehicle.make, vehicle.model, vehicle.type]
      .filter(Boolean).join(' ').toLowerCase().includes(needle));
  }, [search, vehicles]);

  const trackedCount = canonicalVehicleId ? 1 : 0;
  const canManageDrivers = user?.ownerDriverWorkspace === true;

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <VehicleRegisterShell
        title="Drivers & Vehicles"
        subtitle="Driver, vehicle, tracking and document resources."
        actions={<>
          {canManageDrivers && <button type="button" onClick={() => router.push('/driver/drivers')}>Add Driver</button>}
          <button type="button" className="carrier-register-action" disabled={!canManage} onClick={() => router.push('/driver/vehicles?action=add')}>+ Add Vehicle</button>
        </>}
      >
        {error && <div className="xdrive-alert-banner" style={{ marginBottom: 8, backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c' }}>{error}</div>}

        <section className="carrier-register-results" style={{ marginBottom: 8, padding: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px,1fr) auto', gap: 8, alignItems: 'end' }}>
            <label style={{ display: 'grid', gap: 4, color: '#64748b', fontSize: 11, fontWeight: 700 }}>SEARCH
              <input style={{ minHeight: 32, border: '1px solid #cfd7e3', borderRadius: 4, padding: '5px 8px' }} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Driver, vehicle, registration" />
            </label>
            <div className="carrier-register-toolbar__actions">
              <button type="button" data-active={tab === 'users'} onClick={() => setTab('users')}>Users / Drivers</button>
              <button type="button" data-active={tab === 'vehicles'} onClick={() => setTab('vehicles')}>Company Vehicles</button>
              <button type="button" data-active={tab === 'tracking'} onClick={() => setTab('tracking')}>Vehicle Tracking</button>
            </div>
          </div>
        </section>

        {tab === 'users' && <section className="carrier-register-results" aria-label="Users and drivers">
          <div className="carrier-register-table-wrap"><table className="carrier-register-table"><thead><tr><th>Name</th><th>Role</th><th>Mobile Access</th><th>Status</th><th>Actions</th></tr></thead><tbody>
            <tr><td><b>{user?.email ?? 'Current driver'}</b></td><td>{user?.ownerDriverWorkspace ? 'Workspace Owner' : 'Driver'}</td><td>Enabled</td><td><StatusBadge value="Active" tone="green" /></td><td><button type="button" onClick={() => router.push('/driver/account')}>Manage</button></td></tr>
          </tbody></table></div>
        </section>}

        {tab === 'vehicles' && <section className="carrier-register-results" aria-label="Company vehicles">
          {loading ? <div className="carrier-register-empty" style={{ padding: '3rem', textAlign: 'center' }}>Loading...</div> : visible.length === 0 ? <div className="carrier-register-empty" style={{ padding: '3rem', textAlign: 'center' }}>No vehicle records match the current filter.</div> :
          <div className="carrier-register-table-wrap"><table className="carrier-register-table"><thead><tr><th>Vehicle</th><th>Size / Type</th><th>Payload</th><th>Pallets</th><th>Tail Lift</th><th>Assignment</th><th>Actions</th></tr></thead><tbody>
            {visible.map((vehicle) => <tr key={vehicle.id}><td><b>{vehicleName(vehicle)}</b><div style={{ color: '#64748b' }}>{vehicle.reg_plate ?? 'Registration not supplied'}</div></td><td>{VEHICLE_TYPE_LABELS[vehicle.type ?? ''] ?? vehicle.type?.replace(/_/g, ' ') ?? 'Not supplied'}</td><td>{vehicle.payload_kg != null ? vehicle.payload_kg + ' kg' : 'Not supplied'}</td><td>{vehicle.pallets_capacity ?? '-'}</td><td>{vehicle.has_tail_lift == null ? 'Not supplied' : vehicle.has_tail_lift ? 'Yes' : 'No'}</td><td>{vehicle.id === canonicalVehicleId ? <StatusBadge value="Canonical active" tone="green" /> : vehicle.assigned_driver_id === driverId ? <StatusBadge value="Assigned" tone="blue" /> : <StatusBadge value="Fleet record" />}</td><td><button type="button" onClick={() => router.push('/driver/vehicles')}>Open</button></td></tr>)}
          </tbody></table></div>}
        </section>}

        {tab === 'tracking' && <section className="carrier-register-results" aria-label="Vehicle tracking">
          <div className="carrier-register-results__header"><strong>Vehicle Tracking</strong><span style={{ color: '#64748b' }}>{trackedCount} canonical tracked signal</span></div>
          <div className="carrier-register-table-wrap"><table className="carrier-register-table"><thead><tr><th>Vehicle</th><th>Tracking</th></tr></thead><tbody>
            {vehicles.map((vehicle) => <tr key={vehicle.id}><td><b>{vehicle.reg_plate ?? vehicleName(vehicle)}</b><div style={{ color: '#64748b' }}>{vehicleName(vehicle)}</div></td><td><StatusBadge value={vehicle.id === canonicalVehicleId ? 'Canonical' : 'No live signal'} tone={vehicle.id === canonicalVehicleId ? 'green' : 'grey'} /></td></tr>)}
          </tbody></table></div>
        </section>}
      </VehicleRegisterShell>
    </ProtectedRoute>
  );
}
