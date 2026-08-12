'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { supabase } from '../../../lib/supabaseClient';
import { VEHICLE_GROUPS, VEHICLE_TYPE_LABELS } from '../../../lib/vehicleTypes';
import { ActionButton, AlertBanner, EmptyState, KpiCard, KpiGrid, Panel, StatusBadge } from '../../components/workspace/WorkspaceUI';

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

const fieldStyle = {
  width: '100%',
  height: '32px',
  padding: '0 8px',
  border: '1px solid #d8dee8',
  borderRadius: '4px',
  background: '#fff',
  color: '#1a1f2b',
  fontSize: '12px',
} as const;

const labelStyle = {
  display: 'grid',
  gap: '3px',
  color: '#64748b',
  fontSize: '10px',
  lineHeight: '14px',
  fontWeight: 700,
  letterSpacing: '.03em',
  textTransform: 'uppercase' as const,
};

function vehicleName(vehicle: VehicleRow) {
  const makeModel = [vehicle.make, vehicle.model].filter(Boolean).join(' ');
  return `${vehicle.reg_plate ?? 'No plate'}${makeModel ? ` · ${makeModel}` : ''}`;
}

export default function DriverVehiclesPage() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [assignedVehicleId, setAssignedVehicleId] = useState<string | null>(null);
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
      setError('Your session has expired. Sign in again to manage vehicles.');
      setLoading(false);
      return;
    }

    const response = await fetch('/api/driver/vehicles', { headers: { Authorization: auth } });
    const payload = (await response.json().catch(() => ({}))) as {
      vehicles?: VehicleRow[];
      assignedVehicleId?: string | null;
      error?: string;
    };

    if (!response.ok) {
      setError('Vehicle data could not be loaded.');
    } else {
      setVehicles(payload.vehicles ?? []);
      setAssignedVehicleId(payload.assignedVehicleId ?? null);
    }
    setLoading(false);
  }, [getAuthHeader]);

  useEffect(() => {
    if (user) void load();
  }, [load, user]);

  const assignedVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === assignedVehicleId) ?? null,
    [assignedVehicleId, vehicles]
  );

  const equippedCount = useMemo(
    () => vehicles.filter((vehicle) => vehicle.has_tail_lift || vehicle.has_straps || vehicle.has_blankets).length,
    [vehicles]
  );

  const startAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
    setNotice('');
    setError('');
  };

  const startEdit = (vehicle: VehicleRow) => {
    setEditingId(vehicle.id);
    setForm({
      type: vehicle.type ?? 'van_large',
      reg_plate: vehicle.reg_plate ?? '',
      make: vehicle.make ?? '',
      model: vehicle.model ?? '',
      payload_kg: vehicle.payload_kg != null ? String(vehicle.payload_kg) : '',
      pallets_capacity: vehicle.pallets_capacity != null ? String(vehicle.pallets_capacity) : '',
      has_tail_lift: vehicle.has_tail_lift ?? false,
      has_straps: vehicle.has_straps ?? false,
      has_blankets: vehicle.has_blankets ?? false,
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

  const setField = (field: keyof VehicleForm, value: string | boolean) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const save = async () => {
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
      setError(isEdit ? 'Vehicle changes could not be saved.' : 'The vehicle could not be added.');
      return;
    }

    setNotice(isEdit ? 'Vehicle updated successfully.' : 'Vehicle added successfully.');
    cancelForm();
    await load();
  };

  const deactivate = async (vehicleId: string) => {
    if (!window.confirm('Unassign this vehicle from your driver profile?')) return;

    setDeactivatingId(vehicleId);
    setError('');
    setNotice('');

    const auth = await getAuthHeader();
    if (!auth) {
      setError('Your session has expired.');
      setDeactivatingId(null);
      return;
    }

    const response = await fetch('/api/driver/vehicles', {
      method: 'PATCH',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ vehicleId, action: 'deactivate' }),
    });

    setDeactivatingId(null);
    if (!response.ok) {
      setError('The assigned vehicle could not be removed.');
      return;
    }

    setNotice('Assigned vehicle removed.');
    await load();
  };

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell
        subtitle="Vehicle capacity and equipment in a compact fleet register tied to driver readiness."
        headerActions={<ActionButton tone="primary" onClick={() => void load()} disabled={loading}>Refresh</ActionButton>}
      >
        {error && <AlertBanner tone="danger">{error}</AlertBanner>}
        {notice && <AlertBanner tone="success">{notice}</AlertBanner>}

        <KpiGrid>
          <KpiCard label="Fleet vehicles" value={vehicles.length} detail="Visible to this workspace" tone="blue" />
          <KpiCard label="Assigned to you" value={assignedVehicle ? 1 : 0} detail={assignedVehicle ? vehicleName(assignedVehicle) : 'No current assignment'} tone={assignedVehicle ? 'green' : 'orange'} />
          <KpiCard label="Equipped vehicles" value={equippedCount} detail="Tail lift, straps or blankets" tone="navy" />
          <KpiCard label="Payload recorded" value={vehicles.filter((vehicle) => Boolean(vehicle.payload_kg)).length} detail="Capacity available for matching" tone="purple" />
        </KpiGrid>

        {showForm && (
          <Panel
            title={editingId ? 'Edit vehicle' : 'Add vehicle'}
            description="Keep the vehicle profile accurate so load matching and operational readiness use the correct capacity."
            actions={<ActionButton tone="secondary" onClick={cancelForm}>Cancel</ActionButton>}
          >
            <div className="driver-detail-grid" style={{ marginBottom: '8px' }}>
              <label style={labelStyle}>
                Vehicle type
                <select value={form.type} onChange={(event) => setField('type', event.target.value)} style={fieldStyle}>
                  {VEHICLE_GROUPS.map(([group, options]) => (
                    <optgroup key={group} label={group}>
                      {options.map(([label, value]) => <option key={value} value={value}>{label}</option>)}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label style={labelStyle}>Registration<input value={form.reg_plate} onChange={(event) => setField('reg_plate', event.target.value)} placeholder="e.g. AB12 CDE" style={fieldStyle} /></label>
              <label style={labelStyle}>Make<input value={form.make} onChange={(event) => setField('make', event.target.value)} placeholder="e.g. Mercedes" style={fieldStyle} /></label>
              <label style={labelStyle}>Model<input value={form.model} onChange={(event) => setField('model', event.target.value)} placeholder="e.g. Sprinter" style={fieldStyle} /></label>
              <label style={labelStyle}>Payload (kg)<input type="number" min="0" value={form.payload_kg} onChange={(event) => setField('payload_kg', event.target.value)} placeholder="e.g. 1000" style={fieldStyle} /></label>
              <label style={labelStyle}>Pallet capacity<input type="number" min="0" value={form.pallets_capacity} onChange={(event) => setField('pallets_capacity', event.target.value)} placeholder="e.g. 4" style={fieldStyle} /></label>
            </div>
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '8px', fontSize: '11px' }}>
              {(['has_tail_lift', 'has_straps', 'has_blankets'] as const).map((field) => (
                <label key={field} style={{ display: 'flex', gap: '5px', alignItems: 'center', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form[field]} onChange={(event) => setField(field, event.target.checked)} />
                  {field.replace(/_/g, ' ').replace('has ', '').replace(/\b\w/g, (character) => character.toUpperCase())}
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <ActionButton tone="primary" onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : editingId ? 'Update vehicle' : 'Add vehicle'}</ActionButton>
            </div>
          </Panel>
        )}

        <Panel
          title="Vehicle register"
          description="Assigned state, capacity and equipment at a glance."
          actions={!showForm ? <ActionButton tone="success" onClick={startAdd}>+ Add vehicle</ActionButton> : undefined}
          flush
        >
          {loading ? (
            <div style={{ padding: '20px' }}><EmptyState compact title="Loading vehicles…" /></div>
          ) : vehicles.length === 0 ? (
            <div style={{ padding: '20px' }}><EmptyState title="No vehicles in this workspace" description="Add a vehicle to provide capacity and equipment information for operations." action={<ActionButton tone="success" onClick={startAdd}>Add first vehicle</ActionButton>} /></div>
          ) : (
            <div className="driver-ops-table-wrap">
              <table className="driver-ops-table">
                <thead>
                  <tr>
                    <th>Vehicle</th>
                    <th>Type</th>
                    <th>Payload</th>
                    <th>Pallets</th>
                    <th>Equipment</th>
                    <th>Assignment</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map((vehicle) => {
                    const assigned = vehicle.id === assignedVehicleId;
                    const equipment = [vehicle.has_tail_lift && 'Tail lift', vehicle.has_straps && 'Straps', vehicle.has_blankets && 'Blankets'].filter(Boolean).join(' · ') || 'Standard';
                    return (
                      <tr key={vehicle.id}>
                        <td><strong>{vehicleName(vehicle)}</strong></td>
                        <td>{VEHICLE_TYPE_LABELS[vehicle.type ?? ''] ?? vehicle.type?.replace(/_/g, ' ') ?? 'Unknown'}</td>
                        <td>{vehicle.payload_kg ? `${vehicle.payload_kg} kg` : '—'}</td>
                        <td>{vehicle.pallets_capacity ?? '—'}</td>
                        <td>{equipment}</td>
                        <td>{assigned ? <StatusBadge value="Assigned to you" tone="green" /> : <StatusBadge value="Fleet vehicle" tone="grey" />}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            <ActionButton tone="secondary" onClick={() => startEdit(vehicle)}>Edit</ActionButton>
                            {assigned && <ActionButton tone="danger" onClick={() => void deactivate(vehicle.id)} disabled={deactivatingId === vehicle.id}>{deactivatingId === vehicle.id ? 'Removing…' : 'Unassign'}</ActionButton>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
