'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { supabase } from '../../../lib/supabaseClient';
import { VEHICLE_GROUPS, VEHICLE_TYPE_LABELS } from '../../../lib/vehicleTypes';
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
  has_straps: boolean | null;
  has_blankets: boolean | null;
  assigned_driver_id: string | null;
};

type VehicleForm = {
  type: string;
  reg_plate: string;
  make: string;
  model: string;
  payload_kg: string;
  pallets_capacity: string;
  has_tail_lift: boolean;
  has_straps: boolean;
  has_blankets: boolean;
};

const EMPTY_FORM: VehicleForm = {
  type: 'van_large', reg_plate: '', make: '', model: '', payload_kg: '', pallets_capacity: '',
  has_tail_lift: false, has_straps: false, has_blankets: false,
};

function vehicleName(vehicle: VehicleRow) {
  const makeModel = [vehicle.make, vehicle.model].filter(Boolean).join(' ');
  return `${vehicle.reg_plate ?? 'No plate'}${makeModel ? ` · ${makeModel}` : ''}`;
}

export default function DriverVehiclesPage() {
  const { user } = useAuth();
  const driverId = typeof user?.driverId === 'string' ? user.driverId.trim() : '';
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [canonicalVehicleId, setCanonicalVehicleId] = useState<string | null>(null);
  const [canonicalVehicleSignalAvailable, setCanonicalVehicleSignalAvailable] = useState(true);
  const [canManageVehicles, setCanManageVehicles] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<VehicleForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);

  const getAuthHeader = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    return token ? `Bearer ${token}` : null;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const auth = await getAuthHeader();
    if (!auth) {
      setError('Your session has expired. Sign in again to view vehicle information.');
      setLoading(false);
      return;
    }

    const response = await fetch('/api/driver/vehicles', { headers: { Authorization: auth } });
    const payload = (await response.json().catch(() => ({}))) as {
      vehicles?: VehicleRow[];
      canonicalVehicleId?: string | null;
      canonicalVehicleSignalAvailable?: boolean;
      canManageVehicles?: boolean;
      error?: string;
    };

    if (!response.ok) setError(payload.error || 'Vehicle data could not be loaded.');
    else {
      setVehicles(payload.vehicles ?? []);
      setCanonicalVehicleId(payload.canonicalVehicleId ?? null);
      setCanonicalVehicleSignalAvailable(payload.canonicalVehicleSignalAvailable !== false);
      setCanManageVehicles(payload.canManageVehicles === true);
      if (payload.canManageVehicles !== true) {
        setShowForm(false);
        setEditingId(null);
      }
    }
    setLoading(false);
  }, [getAuthHeader]);

  useEffect(() => { if (user) void load(); }, [load, user]);

  const assignedVehicles = useMemo(
    () => driverId ? vehicles.filter((vehicle) => vehicle.assigned_driver_id === driverId) : [],
    [driverId, vehicles],
  );
  const canonicalVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === canonicalVehicleId) ?? null,
    [canonicalVehicleId, vehicles],
  );
  const equippedCount = useMemo(() => vehicles.filter((vehicle) => vehicle.has_tail_lift || vehicle.has_straps || vehicle.has_blankets).length, [vehicles]);

  const startAdd = () => {
    if (!canManageVehicles) return;
    setEditingId(null); setForm(EMPTY_FORM); setShowForm(true); setNotice(''); setError('');
  };
  const startEdit = (vehicle: VehicleRow) => {
    if (!canManageVehicles) return;
    setEditingId(vehicle.id);
    setForm({
      type: vehicle.type ?? 'van_large', reg_plate: vehicle.reg_plate ?? '', make: vehicle.make ?? '', model: vehicle.model ?? '',
      payload_kg: vehicle.payload_kg != null ? String(vehicle.payload_kg) : '',
      pallets_capacity: vehicle.pallets_capacity != null ? String(vehicle.pallets_capacity) : '',
      has_tail_lift: vehicle.has_tail_lift ?? false, has_straps: vehicle.has_straps ?? false, has_blankets: vehicle.has_blankets ?? false,
    });
    setShowForm(true); setNotice(''); setError('');
  };
  const cancelForm = () => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); };
  const setField = (field: keyof VehicleForm, value: string | boolean) => setForm((previous) => ({ ...previous, [field]: value }));

  const save = async () => {
    if (!canManageVehicles) { setError('Your company fleet is managed by an owner/admin or fleet manager.'); return; }
    if (!form.type) { setError('Vehicle type is required.'); return; }
    setSaving(true); setError(''); setNotice('');
    const auth = await getAuthHeader();
    if (!auth) { setError('Your session has expired.'); setSaving(false); return; }
    const payload = {
      type: form.type,
      reg_plate: form.reg_plate.trim().toUpperCase() || undefined,
      make: form.make.trim() || undefined,
      model: form.model.trim() || undefined,
      payload_kg: form.payload_kg ? Number.parseInt(form.payload_kg, 10) : undefined,
      pallets_capacity: form.pallets_capacity ? Number.parseInt(form.pallets_capacity, 10) : undefined,
      has_tail_lift: form.has_tail_lift, has_straps: form.has_straps, has_blankets: form.has_blankets,
    };
    const isEdit = Boolean(editingId);
    const response = await fetch('/api/driver/vehicles', {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify(isEdit ? { ...payload, id: editingId } : payload),
    });
    setSaving(false);
    if (!response.ok) {
      const responsePayload = await response.json().catch(() => ({})) as { error?: string };
      setError(responsePayload.error || (isEdit ? 'Vehicle changes could not be saved.' : 'The vehicle could not be added.'));
      return;
    }
    setNotice(isEdit ? 'Vehicle updated successfully.' : 'Vehicle added successfully.'); cancelForm(); await load();
  };

  const deactivate = async (vehicleId: string) => {
    if (!canManageVehicles) { setError('Assignment changes are managed by your company.'); return; }
    if (!window.confirm('Unassign this vehicle from your driver profile?')) return;
    setDeactivatingId(vehicleId); setError(''); setNotice('');
    const auth = await getAuthHeader();
    if (!auth) { setError('Your session has expired.'); setDeactivatingId(null); return; }
    const response = await fetch('/api/driver/vehicles', {
      method: 'PATCH', headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ vehicleId, action: 'deactivate' }),
    });
    setDeactivatingId(null);
    if (!response.ok) {
      const responsePayload = await response.json().catch(() => ({})) as { error?: string };
      setError(responsePayload.error || 'The assigned vehicle could not be removed.'); return;
    }
    setNotice('Assigned vehicle removed.'); await load();
  };

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <section className="page driver-fleet-prototype">
        <div className="subbar">
          <span className="crumb">Workspace &nbsp;/&nbsp; <b>My Fleet</b></span>
          <div className="sub-actions">
            <button type="button" className="btn" onClick={() => void load()} disabled={loading}>Refresh Tracking</button>
            <button type="button" className="btn" disabled={!canManageVehicles} onClick={startAdd}>+ Add Vehicle</button>
            <button type="button" className="btn green" onClick={() => window.location.href = '/driver/availability'}>Advertise Availability</button>
          </div>
        </div>
        <div className="pagebody">
          <aside className="left">
            <div className="left-title">Fleet Filters</div>
            <div className="filter"><span className="label">Quick search</span><input className="input" placeholder="Vehicle, driver, registration" onChange={(event) => {
              const needle = event.target.value.trim().toLowerCase();
              document.querySelectorAll<HTMLElement>('.fleet-row').forEach((row) => {
                row.style.display = !needle || (row.dataset.search ?? '').includes(needle) ? '' : 'none';
              });
            }} /></div>
            <div className="filter">
              <div className="linkrow active">All fleet<span className="count">{vehicles.length}</span></div>
              <div className="linkrow">Assigned to me<span className="count">{assignedVehicles.length}</span></div>
              <div className="linkrow">Canonical active<span className="count">{canonicalVehicle ? 1 : 0}</span></div>
            </div>
            <div className="filter"><span className="label">Capacity</span><label className="check"><input type="checkbox" checked={equippedCount > 0} readOnly />Equipment recorded</label></div>
          </aside>
          <main className="main">
            <div className="head"><div><h1>My Fleet</h1><p>Operational fleet control with inline status, assignment, capacity and readiness</p></div></div>
            {error && <div className="vision-note">{error}</div>}
            {notice && <div className="vision-note">{notice}</div>}
            {!canonicalVehicleSignalAvailable && <div className="vision-note">Canonical active-vehicle signal is temporarily unavailable. Vehicle records remain visible.</div>}
            <div className="fleet-cx-toolbar">
              <div>
                <strong>Company Vehicles</strong>
                <span>{vehicles.length} vehicle{vehicles.length === 1 ? '' : 's'} · {assignedVehicles.length} assigned to you · {canonicalVehicle ? '1 active' : 'no active vehicle'}</span>
              </div>
              <div className="fleet-cx-toolbar__actions">
                <button type="button" className="btn" onClick={() => void load()} disabled={loading}>Refresh</button>
                {canManageVehicles && !showForm && <button type="button" className="btn green" onClick={startAdd}>Add Vehicle</button>}
              </div>
            </div>
            {showForm && canManageVehicles && <section className="fleet-inspector">
              <div><b>{editingId ? 'Edit vehicle' : 'Add vehicle'}</b><span className="meta">Save real vehicle capacity and equipment data.</span></div>
              <div className="row2"><select className="select" value={form.type} onChange={(event) => setField('type', event.target.value)}>{VEHICLE_GROUPS.flatMap(([, options]) => options).map(([label,value]) => <option key={value} value={value}>{label}</option>)}</select><input className="input" value={form.reg_plate} onChange={(event) => setField('reg_plate', event.target.value)} placeholder="Registration" /></div>
              <div className="row2"><input className="input" value={form.make} onChange={(event) => setField('make', event.target.value)} placeholder="Make" /><input className="input" value={form.model} onChange={(event) => setField('model', event.target.value)} placeholder="Model" /></div>
              <div className="row2"><input className="input" type="number" value={form.payload_kg} onChange={(event) => setField('payload_kg', event.target.value)} placeholder="Payload kg" /><input className="input" type="number" value={form.pallets_capacity} onChange={(event) => setField('pallets_capacity', event.target.value)} placeholder="Pallets" /></div>
              <div className="fleet-commandbar"><label className="check"><input type="checkbox" checked={form.has_tail_lift} onChange={(event) => setField('has_tail_lift', event.target.checked)} />Tail lift</label><label className="check"><input type="checkbox" checked={form.has_straps} onChange={(event) => setField('has_straps', event.target.checked)} />Straps</label><label className="check"><input type="checkbox" checked={form.has_blankets} onChange={(event) => setField('has_blankets', event.target.checked)} />Blankets</label><span className="spacer" /><button type="button" className="btn" onClick={cancelForm}>Cancel</button><button type="button" className="btn primary" onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : editingId ? 'Update vehicle' : 'Add vehicle'}</button></div>
            </section>}
            <div className="tablewrap fleet-tablewrap fleet-tablewrap--compact">
              <table className="fleet-table fleet-table--compact">
                <thead><tr><th>Name</th><th>Size / Type</th><th>Payload</th><th>Equipment</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {vehicles.map((vehicle) => {
                    const assigned = Boolean(driverId) && vehicle.assigned_driver_id === driverId;
                    const canonical = vehicle.id === canonicalVehicleId;
                    const equipment = [vehicle.has_tail_lift && 'Tail lift', vehicle.has_straps && 'Straps', vehicle.has_blankets && 'Blankets'].filter(Boolean).join(' · ') || 'Standard';
                    return <tr key={vehicle.id} className="fleet-row" data-id={vehicle.id} data-search={`${vehicleName(vehicle)} ${vehicle.reg_plate ?? ''} ${vehicle.type ?? ''}`.toLowerCase()}>
                      <td><div className="fleet-name"><div><b>{vehicleName(vehicle)}</b><span className="meta">{assigned ? 'Assigned to current driver' : 'Company fleet record'}</span></div></div></td>
                      <td>{VEHICLE_TYPE_LABELS[vehicle.type ?? ''] ?? vehicle.type?.replace(/_/g, ' ') ?? 'Unknown'}</td>
                      <td>{vehicle.payload_kg != null ? `${vehicle.payload_kg} kg` : 'Not supplied'}</td>
                      <td>{equipment}</td>
                      <td><StatusBadge value={canonical ? 'Active' : assigned ? 'Assigned' : 'Recorded'} tone={canonical ? 'green' : assigned ? 'blue' : 'grey'} /></td>
                      <td><button type="button" className="rowbtn blue" onClick={() => startEdit(vehicle)} disabled={!canManageVehicles}>Open</button>{assigned && canManageVehicles && <button type="button" className="rowbtn" onClick={() => void deactivate(vehicle.id)} disabled={deactivatingId === vehicle.id}>{deactivatingId === vehicle.id ? 'Removing…' : 'Unassign'}</button>}</td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
            {!loading && vehicles.length === 0 && <div className="xd2-calm-empty"><b>No vehicle records</b><span>{canManageVehicles ? 'Add a real vehicle to the workspace.' : 'No vehicle is assigned to this Driver profile.'}</span></div>}
          </main>
        </div>
      </section>
    </ProtectedRoute>
  );
}
