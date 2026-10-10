'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { supabase } from '../../../lib/supabaseClient';
import { resolveWorkspaceRole } from '../../../lib/workspaceRole';
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
  type: 'van_large',
  reg_plate: '',
  make: '',
  model: '',
  payload_kg: '',
  pallets_capacity: '',
  has_tail_lift: false,
  has_straps: false,
  has_blankets: false,
};

function vehicleName(vehicle: VehicleRow) {
  const makeModel = [vehicle.make, vehicle.model].filter(Boolean).join(' ');
  return makeModel || VEHICLE_TYPE_LABELS[vehicle.type ?? ''] || vehicle.type?.replace(/_/g, ' ') || 'Vehicle';
}

function vehicleEquipment(vehicle: VehicleRow) {
  return [
    vehicle.has_tail_lift && 'Tail lift',
    vehicle.has_straps && 'Straps',
    vehicle.has_blankets && 'Blankets',
  ].filter(Boolean).join(' / ') || 'Standard equipment';
}

export default function DriverVehiclesPage() {
  const { user } = useAuth();
  const driverId = typeof user?.driverId === 'string' ? user.driverId.trim() : '';
  const ownerDriver = resolveWorkspaceRole(user) === 'owner_driver';

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
      setError('Your session has expired. Sign in again to view your vehicle.');
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

    if (!response.ok) {
      setError(payload.error || 'Vehicle data could not be loaded.');
    } else {
      setVehicles(payload.vehicles ?? []);
      setCanonicalVehicleId(payload.canonicalVehicleId ?? null);
      setCanonicalVehicleSignalAvailable(payload.canonicalVehicleSignalAvailable !== false);
      setCanManageVehicles(payload.canManageVehicles === true);
    }
    setLoading(false);
  }, [getAuthHeader]);

  useEffect(() => {
    if (user) void load();
  }, [load, user]);

  const currentVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === canonicalVehicleId)
      ?? vehicles.find((vehicle) => vehicle.assigned_driver_id === driverId)
      ?? vehicles[0]
      ?? null,
    [canonicalVehicleId, driverId, vehicles],
  );

  const startAdd = () => {
    if (!canManageVehicles || currentVehicle) return;
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
    setNotice('');
    setError('');
  };

  const startEdit = () => {
    if (!canManageVehicles || !currentVehicle) return;
    setEditingId(currentVehicle.id);
    setForm({
      type: currentVehicle.type ?? 'van_large',
      reg_plate: currentVehicle.reg_plate ?? '',
      make: currentVehicle.make ?? '',
      model: currentVehicle.model ?? '',
      payload_kg: currentVehicle.payload_kg != null ? String(currentVehicle.payload_kg) : '',
      pallets_capacity: currentVehicle.pallets_capacity != null ? String(currentVehicle.pallets_capacity) : '',
      has_tail_lift: currentVehicle.has_tail_lift ?? false,
      has_straps: currentVehicle.has_straps ?? false,
      has_blankets: currentVehicle.has_blankets ?? false,
    });
    setShowForm(true);
    setNotice('');
    setError('');
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const setField = (field: keyof VehicleForm, value: string | boolean) =>
    setForm((previous) => ({ ...previous, [field]: value }));

  const save = async () => {
    if (!canManageVehicles) {
      setError('This vehicle is managed by your company.');
      return;
    }
    if (!form.type) {
      setError('Vehicle type is required.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');
    const auth = await getAuthHeader();
    if (!auth) {
      setError('Your session has expired.');
      setSaving(false);
      return;
    }

    const payload = {
      type: form.type,
      reg_plate: form.reg_plate.trim().toUpperCase() || undefined,
      make: form.make.trim() || undefined,
      model: form.model.trim() || undefined,
      payload_kg: form.payload_kg ? Number.parseInt(form.payload_kg, 10) : undefined,
      pallets_capacity: form.pallets_capacity ? Number.parseInt(form.pallets_capacity, 10) : undefined,
      has_tail_lift: form.has_tail_lift,
      has_straps: form.has_straps,
      has_blankets: form.has_blankets,
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

    setNotice(isEdit ? 'Vehicle updated successfully.' : 'Vehicle added successfully.');
    cancelForm();
    await load();
  };

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <section className="page driver-fleet-prototype">
        <div className="subbar">
          <span className="crumb">Workspace &nbsp;/&nbsp; <b>My Vehicle</b></span>
          <div className="sub-actions">
            <button type="button" className="btn" onClick={() => void load()} disabled={loading}>Refresh</button>
            <button type="button" className="btn green" onClick={() => { window.location.href = '/driver/availability'; }}>Update Availability</button>
          </div>
        </div>

        <div className="pagebody" style={{ gridTemplateColumns: '1fr' }}>
          <main className="main">
            <div className="head">
              <div>
                <h1>My Vehicle</h1>
                <p>{ownerDriver
                  ? 'Your sole-trader vehicle, capacity and equipment used for load matching and job execution.'
                  : 'The vehicle currently assigned to your Driver profile.'}</p>
              </div>
              <div className="sub-actions">
                {canManageVehicles && currentVehicle && !showForm ? (
                  <button type="button" className="btn primary" onClick={startEdit}>Edit Vehicle</button>
                ) : null}
                {canManageVehicles && !currentVehicle && !showForm ? (
                  <button type="button" className="btn primary" onClick={startAdd}>Add Vehicle</button>
                ) : null}
              </div>
            </div>

            {error && <div className="vision-note">{error}</div>}
            {notice && <div className="vision-note">{notice}</div>}
            {!canonicalVehicleSignalAvailable && (
              <div className="vision-note">Active vehicle status is temporarily unavailable. Your saved vehicle details remain visible.</div>
            )}

            {showForm && canManageVehicles ? (
              <section className="fleet-inspector">
                <div>
                  <b>{editingId ? 'Edit my vehicle' : 'Add my vehicle'}</b>
                  <span className="meta">Keep the vehicle identity, capacity and equipment accurate for marketplace matching.</span>
                </div>
                <div className="row2">
                  <select className="select" value={form.type} onChange={(event) => setField('type', event.target.value)}>
                    {VEHICLE_GROUPS.flatMap(([, options]) => options).map(([label, value]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <input className="input" value={form.reg_plate} onChange={(event) => setField('reg_plate', event.target.value)} placeholder="Registration" />
                </div>
                <div className="row2">
                  <input className="input" value={form.make} onChange={(event) => setField('make', event.target.value)} placeholder="Make" />
                  <input className="input" value={form.model} onChange={(event) => setField('model', event.target.value)} placeholder="Model" />
                </div>
                <div className="row2">
                  <input className="input" type="number" value={form.payload_kg} onChange={(event) => setField('payload_kg', event.target.value)} placeholder="Payload kg" />
                  <input className="input" type="number" value={form.pallets_capacity} onChange={(event) => setField('pallets_capacity', event.target.value)} placeholder="Pallets" />
                </div>
                <div className="fleet-commandbar">
                  <label className="check"><input type="checkbox" checked={form.has_tail_lift} onChange={(event) => setField('has_tail_lift', event.target.checked)} />Tail lift</label>
                  <label className="check"><input type="checkbox" checked={form.has_straps} onChange={(event) => setField('has_straps', event.target.checked)} />Straps</label>
                  <label className="check"><input type="checkbox" checked={form.has_blankets} onChange={(event) => setField('has_blankets', event.target.checked)} />Blankets</label>
                  <span className="spacer" />
                  <button type="button" className="btn" onClick={cancelForm}>Cancel</button>
                  <button type="button" className="btn primary" onClick={() => void save()} disabled={saving}>
                    {saving ? 'Saving...' : editingId ? 'Update Vehicle' : 'Add Vehicle'}
                  </button>
                </div>
              </section>
            ) : null}

            {loading ? (
              <div className="xd2-calm-empty"><b>Loading vehicle...</b></div>
            ) : currentVehicle ? (
              <section className="fleet-inspector" style={{ display: 'grid', gap: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                  <div>
                    <b style={{ fontSize: 18 }}>{vehicleName(currentVehicle)}</b>
                    <span className="meta">{currentVehicle.reg_plate ?? 'Registration not supplied'}</span>
                  </div>
                  <StatusBadge
                    value={currentVehicle.id === canonicalVehicleId ? 'Active' : 'Assigned'}
                    tone={currentVehicle.id === canonicalVehicleId ? 'green' : 'blue'}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 10 }}>
                  <div className="vision-note"><b>Vehicle type</b><br />{VEHICLE_TYPE_LABELS[currentVehicle.type ?? ''] ?? currentVehicle.type?.replace(/_/g, ' ') ?? 'Not supplied'}</div>
                  <div className="vision-note"><b>Payload</b><br />{currentVehicle.payload_kg != null ? `${currentVehicle.payload_kg} kg` : 'Not supplied'}</div>
                  <div className="vision-note"><b>Pallet capacity</b><br />{currentVehicle.pallets_capacity ?? 'Not supplied'}</div>
                  <div className="vision-note"><b>Equipment</b><br />{vehicleEquipment(currentVehicle)}</div>
                </div>

                <div className="fleet-commandbar">
                  <button type="button" className="btn" onClick={() => { window.location.href = '/driver/documents'; }}>Vehicle Documents</button>
                  <button type="button" className="btn" onClick={() => { window.location.href = '/driver/availability'; }}>Availability</button>
                  <span className="spacer" />
                  {canManageVehicles ? <button type="button" className="btn primary" onClick={startEdit}>Edit Vehicle</button> : null}
                </div>
              </section>
            ) : (
              <div className="xd2-calm-empty">
                <b>No vehicle is linked to this Driver profile</b>
                <span>{ownerDriver
                  ? 'Add your vehicle before quoting or advertising availability.'
                  : 'Ask your company to assign a vehicle to your Driver profile.'}</span>
                {canManageVehicles ? <button type="button" className="btn primary" onClick={startAdd}>Add My Vehicle</button> : null}
              </div>
            )}
          </main>
        </div>
      </section>
    </ProtectedRoute>
  );
}
