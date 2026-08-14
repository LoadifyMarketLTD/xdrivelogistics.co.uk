'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { supabase } from '../../../lib/supabaseClient';
import { VEHICLE_GROUPS, VEHICLE_TYPE_LABELS } from '../../../lib/vehicleTypes';
import { ActionButton, AlertBanner, EmptyState, StatusBadge } from '../../components/workspace/WorkspaceUI';

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

    if (!response.ok) setError(payload.error || 'Vehicle data could not be loaded.');
    else {
      setVehicles(payload.vehicles ?? []);
      setAssignedVehicleId(payload.assignedVehicleId ?? null);
    }
    setLoading(false);
  }, [getAuthHeader]);

  useEffect(() => { if (user) void load(); }, [load, user]);

  const assignedVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === assignedVehicleId) ?? null,
    [assignedVehicleId, vehicles],
  );

  const equippedCount = useMemo(
    () => vehicles.filter((vehicle) => vehicle.has_tail_lift || vehicle.has_straps || vehicle.has_blankets).length,
    [vehicles],
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
      const responsePayload = await response.json().catch(() => ({})) as { error?: string };
      setError(responsePayload.error || (isEdit ? 'Vehicle changes could not be saved.' : 'The vehicle could not be added.'));
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
      const responsePayload = await response.json().catch(() => ({})) as { error?: string };
      setError(responsePayload.error || 'The assigned vehicle could not be removed.');
      return;
    }

    setNotice('Assigned vehicle removed.');
    await load();
  };

  const readinessRail = (
    <aside className="driver-filter-rail" aria-label="Vehicle readiness">
      <div className="driver-filter-rail__header">Vehicle Readiness</div>
      <div className="driver-filter-rail__body">
        <div className="driver-returns-rail-stat"><span>Fleet vehicles</span><strong>{vehicles.length}</strong></div>
        <div className="driver-returns-rail-stat"><span>Assigned to you</span><strong>{assignedVehicle ? vehicleName(assignedVehicle) : 'None'}</strong></div>
        <div className="driver-returns-rail-stat"><span>Equipped</span><strong>{equippedCount}</strong></div>
        <div className="driver-returns-rail-stat"><span>Payload recorded</span><strong>{vehicles.filter((vehicle) => Boolean(vehicle.payload_kg)).length}</strong></div>
        <ActionButton tone="success" onClick={startAdd}>+ Add vehicle</ActionButton>
      </div>
    </aside>
  );

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell
        subtitle="Vehicle capacity and equipment in a compact register tied to driver readiness."
        headerActions={<ActionButton tone="primary" onClick={() => void load()} disabled={loading}>Refresh</ActionButton>}
      >
        {error && <AlertBanner tone="danger">{error}</AlertBanner>}
        {notice && <AlertBanner tone="success">{notice}</AlertBanner>}

        <div className="driver-board-layout driver-vehicle-board">
          {readinessRail}
          <main className="driver-board-main">
            {showForm && (
              <section className="driver-row-details">
                <div className="driver-detail-tabs"><strong>{editingId ? 'Edit vehicle' : 'Add vehicle'}</strong></div>
                <div className="driver-detail-grid">
                  <label className="driver-filter-field">Vehicle type<select value={form.type} onChange={(event) => setField('type', event.target.value)}>{VEHICLE_GROUPS.map(([group, options]) => <optgroup key={group} label={group}>{options.map(([label, value]) => <option key={value} value={value}>{label}</option>)}</optgroup>)}</select></label>
                  <label className="driver-filter-field">Registration<input value={form.reg_plate} onChange={(event) => setField('reg_plate', event.target.value)} placeholder="e.g. AB12 CDE" /></label>
                  <label className="driver-filter-field">Make<input value={form.make} onChange={(event) => setField('make', event.target.value)} placeholder="e.g. Mercedes" /></label>
                  <label className="driver-filter-field">Model<input value={form.model} onChange={(event) => setField('model', event.target.value)} placeholder="e.g. Sprinter" /></label>
                  <label className="driver-filter-field">Payload (kg)<input type="number" min="0" value={form.payload_kg} onChange={(event) => setField('payload_kg', event.target.value)} /></label>
                  <label className="driver-filter-field">Pallet capacity<input type="number" min="0" value={form.pallets_capacity} onChange={(event) => setField('pallets_capacity', event.target.value)} /></label>
                </div>
                <div className="driver-row-actions" style={{ marginTop: 5, justifyContent: 'flex-start' }}>
                  {(['has_tail_lift', 'has_straps', 'has_blankets'] as const).map((field) => (
                    <label key={field} className="driver-returns-check">
                      <input type="checkbox" checked={form[field]} onChange={(event) => setField(field, event.target.checked)} />
                      <span>{field.replace(/_/g, ' ').replace('has ', '').replace(/\b\w/g, (character) => character.toUpperCase())}</span>
                    </label>
                  ))}
                </div>
                <div className="driver-row-actions" style={{ marginTop: 5 }}>
                  <ActionButton tone="secondary" onClick={cancelForm}>Cancel</ActionButton>
                  <ActionButton tone="primary" onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : editingId ? 'Update vehicle' : 'Add vehicle'}</ActionButton>
                </div>
              </section>
            )}

            <div className="driver-board-summary">
              <span><strong>Vehicle register</strong> · {vehicles.length} record{vehicles.length === 1 ? '' : 's'}</span>
              {!showForm && <ActionButton tone="success" onClick={startAdd}>+ Add vehicle</ActionButton>}
            </div>

            {loading ? (
              <div className="driver-load-row"><EmptyState compact title="Loading vehicles…" /></div>
            ) : vehicles.length === 0 ? (
              <div className="driver-load-row"><EmptyState compact title="No vehicles in this workspace" description="Add a vehicle to provide capacity and equipment information for operations." /></div>
            ) : (
              <div className="driver-load-list">
                {vehicles.map((vehicle) => {
                  const assigned = vehicle.id === assignedVehicleId;
                  const equipment = [vehicle.has_tail_lift && 'Tail lift', vehicle.has_straps && 'Straps', vehicle.has_blankets && 'Blankets'].filter(Boolean).join(' · ') || 'Standard';
                  return (
                    <article key={vehicle.id} className="driver-load-row" data-state={assigned ? 'active' : 'available'}>
                      <div className="driver-load-row__top">
                        <div className="driver-load-cell"><span className="driver-cell-label">Vehicle</span><strong className="driver-cell-primary">{vehicleName(vehicle)}</strong><span className="driver-cell-secondary">{VEHICLE_TYPE_LABELS[vehicle.type ?? ''] ?? vehicle.type?.replace(/_/g, ' ') ?? 'Unknown'}</span></div>
                        <div className="driver-load-cell"><span className="driver-cell-label">Capacity</span><strong className="driver-cell-primary">{vehicle.payload_kg ? `${vehicle.payload_kg} kg` : 'Payload not set'}</strong><span className="driver-cell-secondary">{vehicle.pallets_capacity != null ? `${vehicle.pallets_capacity} pallet positions` : 'Pallet capacity not set'}</span></div>
                        <div className="driver-load-cell"><span className="driver-cell-label">Equipment</span><strong className="driver-cell-primary">{equipment}</strong><span className="driver-cell-secondary">Readiness equipment</span></div>
                        <div className="driver-load-cell"><span className="driver-cell-label">Assignment</span><strong className="driver-cell-primary">{assigned ? 'Assigned to you' : 'Fleet vehicle'}</strong><span className="driver-cell-secondary"><StatusBadge value={assigned ? 'Assigned' : 'Available record'} tone={assigned ? 'green' : 'grey'} /></span></div>
                      </div>
                      <div className="driver-load-row__meta">
                        <span>Vehicle #{vehicle.id.slice(0, 8).toUpperCase()}</span>
                        <div className="driver-row-actions">
                          <ActionButton tone="secondary" onClick={() => startEdit(vehicle)}>Edit</ActionButton>
                          {assigned && <ActionButton tone="danger" onClick={() => void deactivate(vehicle.id)} disabled={deactivatingId === vehicle.id}>{deactivatingId === vehicle.id ? 'Removing…' : 'Unassign'}</ActionButton>}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </main>
        </div>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
