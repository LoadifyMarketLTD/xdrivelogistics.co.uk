'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { readRouteAuthHeader } from '../../../lib/routeAuthCookie';
import { VEHICLE_GROUPS, VEHICLE_TYPE_LABELS } from '../../../lib/vehicleTypes';
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

  const getAuthHeader = useCallback(async () => readRouteAuthHeader(), []);

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

  useEffect(() => {
    if (canManageVehicles && new URLSearchParams(window.location.search).get('action') === 'add') {
      setEditingId(null); setForm(EMPTY_FORM); setShowForm(true);
    }
  }, [canManageVehicles]);

  const assignedVehicles = useMemo(
    () => driverId ? vehicles.filter((vehicle) => vehicle.assigned_driver_id === driverId) : [],
    [driverId, vehicles],
  );
  const canonicalVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === canonicalVehicleId) ?? null,
    [canonicalVehicleId, vehicles],
  );

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
      <VehicleRegisterShell
        title="My Vehicle"
        subtitle={<>{vehicles.length} vehicle{vehicles.length === 1 ? '' : 's'} · {assignedVehicles.length} assigned · {canonicalVehicle ? '1 active' : 'no active vehicle'}</>}
        actions={<><button type="button" onClick={() => void load()} disabled={loading}>Refresh</button>{canManageVehicles && !showForm && <button type="button" onClick={startAdd} className="carrier-register-action">+ Add Vehicle</button>}</>}
      >
          {error && <div className="xdrive-alert-banner" style={{ marginBottom: 8, backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c' }}>{error}</div>}
          {notice && <div className="xdrive-alert-banner" style={{ marginBottom: 8, backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534' }}>{notice}</div>}
          {!canonicalVehicleSignalAvailable && <div className="xdrive-alert-banner" style={{ marginBottom: 8 }}>Canonical active-vehicle signal is temporarily unavailable. Vehicle records remain visible.</div>}

          {showForm && canManageVehicles && (
            <section className="carrier-register-results" aria-label={editingId ? 'Edit vehicle' : 'Add vehicle'} style={{ marginBottom: 8, padding: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
                <label style={labelStyle}>Vehicle Type<select style={inputStyle} value={form.type} onChange={(event) => setField('type', event.target.value)}>{VEHICLE_GROUPS.flatMap(([, options]) => options).map(([label,value]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label style={labelStyle}>Registration<input style={inputStyle} value={form.reg_plate} onChange={(event) => setField('reg_plate', event.target.value)} /></label>
                <label style={labelStyle}>Make<input style={inputStyle} value={form.make} onChange={(event) => setField('make', event.target.value)} /></label>
                <label style={labelStyle}>Model<input style={inputStyle} value={form.model} onChange={(event) => setField('model', event.target.value)} /></label>
                <label style={labelStyle}>Payload (kg)<input style={inputStyle} type="number" value={form.payload_kg} onChange={(event) => setField('payload_kg', event.target.value)} /></label>
                <label style={labelStyle}>Pallets<input style={inputStyle} type="number" value={form.pallets_capacity} onChange={(event) => setField('pallets_capacity', event.target.value)} /></label>
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
                <label><input type="checkbox" checked={form.has_tail_lift} onChange={(event) => setField('has_tail_lift', event.target.checked)} /> Tail lift</label>
                <label><input type="checkbox" checked={form.has_straps} onChange={(event) => setField('has_straps', event.target.checked)} /> Straps</label>
                <label><input type="checkbox" checked={form.has_blankets} onChange={(event) => setField('has_blankets', event.target.checked)} /> Blankets</label>
                <span style={{ flex: 1 }} />
                <button type="button" onClick={cancelForm}>Cancel</button>
                <button type="button" className="carrier-register-action" onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : editingId ? 'Update Vehicle' : 'Add Vehicle'}</button>
              </div>
            </section>
          )}

          <section className="carrier-register-results" aria-label="Vehicle directory">
            {loading ? (
              <div className="carrier-register-empty" style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>Loading...</div>
            ) : vehicles.length === 0 ? (
              <div className="carrier-register-empty" style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
                <p>{canManageVehicles ? 'No vehicles yet. Add your first vehicle.' : 'No vehicle is assigned to this Driver profile.'}</p>
              </div>
            ) : (
              <div className="carrier-register-table-wrap">
                <table className="carrier-register-table">
                  <thead><tr>{['Reg Plate','Type','Make / Model','Payload (kg)','Equipment','Status','Actions'].map((heading)=><th key={heading}>{heading}</th>)}</tr></thead>
                  <tbody>
                    {vehicles.map((vehicle) => {
                      const assigned = Boolean(driverId) && vehicle.assigned_driver_id === driverId;
                      const canonical = vehicle.id === canonicalVehicleId;
                      const equipment = [vehicle.has_tail_lift && 'Tail lift', vehicle.has_straps && 'Straps', vehicle.has_blankets && 'Blankets'].filter(Boolean).join(' · ') || 'Standard';
                      return <tr key={vehicle.id}>
                        <td style={{ fontWeight: 700 }}>{vehicle.reg_plate ?? '—'}</td>
                        <td>{VEHICLE_TYPE_LABELS[vehicle.type ?? ''] ?? vehicle.type?.replace(/_/g, ' ') ?? 'Unknown'}</td>
                        <td>{[vehicle.make, vehicle.model].filter(Boolean).join(' ') || '—'}</td>
                        <td>{vehicle.payload_kg != null ? vehicle.payload_kg : '—'}</td>
                        <td>{equipment}</td>
                        <td><StatusBadge value={canonical ? 'Active' : assigned ? 'Assigned' : 'Recorded'} tone={canonical ? 'green' : assigned ? 'blue' : 'grey'} /></td>
                        <td><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><button type="button" onClick={() => startEdit(vehicle)} disabled={!canManageVehicles}>Edit</button>{assigned && canManageVehicles && <button type="button" onClick={() => void deactivate(vehicle.id)} disabled={deactivatingId === vehicle.id}>{deactivatingId === vehicle.id ? 'Removing…' : 'Unassign'}</button>}</div></td>
                      </tr>;
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
      </VehicleRegisterShell>
    </ProtectedRoute>
  );
}

const inputStyle = { width: '100%', minHeight: 32, border: '1px solid #cfd7e3', borderRadius: 4, padding: '5px 8px', background: '#fff', color: '#172033', fontSize: 12, boxSizing: 'border-box' as const };
const labelStyle = { display: 'grid', gap: 4, color: '#64748b', fontSize: 11, fontWeight: 700 } as const;
