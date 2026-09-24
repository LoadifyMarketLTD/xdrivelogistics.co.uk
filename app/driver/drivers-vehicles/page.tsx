'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { supabase } from '../../../lib/supabaseClient';
import { VEHICLE_TYPE_LABELS } from '../../../lib/vehicleTypes';
import { StatusBadge } from '../../components/workspace/WorkspaceUI';

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
  const [tab, setTab] = useState<'users' | 'vehicles' | 'tracking' | 'documents' | 'events'>('vehicles');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
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

  const assignedCount = vehicles.filter((vehicle) => vehicle.assigned_driver_id === driverId).length;
  const canonicalCount = canonicalVehicleId ? 1 : 0;

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <section className="page driver-drivers-vehicles-prototype">
        <div className="subbar">
          <span className="crumb">Workspace &nbsp;/&nbsp; <b>Drivers & Vehicles</b></span>
          <div className="sub-actions">
            <button type="button" className="btn primary" disabled={!canManage} onClick={() => router.push('/driver/vehicles')}>Add Vehicle</button>
          </div>
        </div>
        <div className="pagebody">
          <aside className="left">
            <div className="left-title">Search</div>
            <div className="filter"><span className="label">Vehicle Search</span><input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Vehicle, registration, type" /></div>
            <div className="filter"><span className="label">Current state</span>
              <div className="check">Current driver · active</div>
              <div className="check">Canonical vehicle · {canonicalCount ? 'configured' : 'not configured'}</div>
              <div className="check">Assigned vehicles · {assignedCount}</div>
            </div>
          </aside>
          <main className="main">
            <div className="head"><div><h1>Drivers & Vehicles</h1><p>Review driver identity, vehicles, tracking readiness, documents and audit history</p></div></div>
            {error && <div className="vision-note">{error}</div>}
            <div className="subtabs">
              <button type="button" className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>Users / Drivers</button>
              <button type="button" className={tab === 'vehicles' ? 'active' : ''} onClick={() => setTab('vehicles')}>Company Vehicles</button>
              <button type="button" className={tab === 'tracking' ? 'active' : ''} onClick={() => setTab('tracking')}>Vehicle Tracking</button>
              <button type="button" className={tab === 'documents' ? 'active' : ''} onClick={() => setTab('documents')}>Documents</button>
              <button type="button" className={tab === 'events' ? 'active' : ''} onClick={() => setTab('events')}>Event Log</button>
            </div>
            {tab === 'users' && <div className="dv-panel active">
              <div className="toolbar"><b>Users / Drivers</b><span className="spacer" /></div>
              <div className="tablewrap"><table style={{ minWidth: 900 }}><thead><tr><th>Name</th><th>Role</th><th>Mobile Access</th><th>Status</th><th>Actions</th></tr></thead><tbody>
                <tr><td><b>{user?.email ?? 'Current driver'}</b></td><td>{user?.ownerDriverWorkspace ? 'Workspace Owner' : 'Driver'}</td><td>Enabled</td><td><StatusBadge value="Active" tone="green" /></td><td><button type="button" className="rowbtn blue" onClick={() => router.push('/driver/account')}>Manage</button></td></tr>
              </tbody></table></div>
            </div>}

            {tab === 'vehicles' && <div className="dv-panel active">
              <div className="dv-integration"><div><b>Company Vehicles</b><span>Keep vehicles, capacity, documents and tracking readiness in one place.</span></div><button type="button" className="btn" onClick={() => router.push('/driver/vehicles')}>Open Vehicle Manager</button></div>
              <div className="tablewrap"><table style={{ minWidth: 1180 }}><thead><tr><th>Name</th><th>Size / Type</th><th>Payload</th><th>Pallets</th><th>Tail Lift</th><th>Assignment</th><th>Actions</th></tr></thead><tbody>
                {visible.map((vehicle) => <tr key={vehicle.id} className="dv-row"><td><b>{vehicleName(vehicle)}</b><span className="meta">{vehicle.reg_plate ?? 'Registration not supplied'}</span></td><td>{VEHICLE_TYPE_LABELS[vehicle.type ?? ''] ?? vehicle.type?.replace(/_/g, ' ') ?? 'Not supplied'}</td><td>{vehicle.payload_kg != null ? `${vehicle.payload_kg} kg` : 'Not supplied'}</td><td>{vehicle.pallets_capacity ?? '—'}</td><td>{vehicle.has_tail_lift == null ? 'Not supplied' : vehicle.has_tail_lift ? 'Yes' : 'No'}</td><td>{vehicle.id === canonicalVehicleId ? <StatusBadge value="Canonical active" tone="green" /> : vehicle.assigned_driver_id === driverId ? <StatusBadge value="Assigned" tone="blue" /> : <StatusBadge value="Fleet record" />}</td><td><button type="button" className="rowbtn blue" onClick={() => router.push('/driver/vehicles')}>Open</button></td></tr>)}
              </tbody></table></div>
              {!loading && visible.length === 0 && <div className="xd2-calm-empty"><b>No vehicle records</b><span>No real vehicle record matches the current filter.</span></div>}
            </div>}
            {tab === 'tracking' && <div className="dv-panel active">
              <div className="toolbar"><b>Vehicle Tracking Readiness</b><span className="spacer muted small">{canonicalCount} canonical vehicle configured</span><button type="button" className="btn" onClick={() => router.push('/driver/freight-vision')}>Open Freight Vision</button></div>
              <div className="split"><div className="splitlist">{vehicles.map((vehicle) => <div key={vehicle.id} className="listrow"><div className="grow"><b>{vehicle.reg_plate ?? vehicleName(vehicle)}</b><span className="meta">{vehicleName(vehicle)}</span></div><StatusBadge value={vehicle.id === canonicalVehicleId ? 'Canonical vehicle' : 'Fleet record'} tone={vehicle.id === canonicalVehicleId ? 'green' : 'grey'} /></div>)}</div><div className="splitmain"><div className="map"><div className="mapnote">Canonical vehicle assignment is not treated as a live tracking signal. Open Freight Vision for authorised job tracking and ETA data.</div></div></div></div>
            </div>}

            {tab === 'documents' && <div className="dv-panel active"><div className="toolbar"><b>Vehicle & Driver Documents</b><span className="spacer" /><button type="button" className="btn primary" onClick={() => router.push('/driver/documents')}>Open Documents</button></div><div className="xd2-calm-empty"><b>Documents remain server-authoritative</b><span>Open the Driver Documents register to review or upload real records.</span></div></div>}

            {tab === 'events' && <div className="dv-panel active"><div className="toolbar"><b>Event Log</b><span className="spacer" /><button type="button" className="btn" onClick={() => router.push('/driver/event-log')}>Open Event Log</button></div><div className="xd2-calm-empty"><b>Operational history</b><span>Open the real Event Log; no prototype events are injected here.</span></div></div>}
          </main>
        </div>
      </section>
    </ProtectedRoute>
  );
}
