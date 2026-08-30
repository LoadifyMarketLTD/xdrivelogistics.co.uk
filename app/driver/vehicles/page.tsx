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
  status: string | null;
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
  const [assigningId, setAssigningId] = useState<string | null>(null);
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
    setNotice(isEdit ? 'Vehicle updated successfully.' : 'Vehicle added successfully. Assign it to your Driver profile if this is the vehicle you operate.'); cancelForm(); await load();
  };

  const assignToMe = async (vehicleId: string) => {
    if (!canManageVehicles) { setError('Assignment changes are managed by your company.'); return; }
    setAssigningId(vehicleId); setError(''); setNotice('');
    const auth = await getAuthHeader();
    if (!auth) { setError('Your session has expired.'); setAssigningId(null); return; }
    const response = await fetch('/api/driver/vehicles', {
      method: 'PATCH', headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ vehicleId, action: 'assign_to_me' }),
    });
    setAssigningId(null);
    if (!response.ok) {
      const responsePayload = await response.json().catch(() => ({})) as { error?: string };
      setError(responsePayload.error || 'The vehicle could not be assigned to your Driver profile.');
      return;
    }
    setNotice('Vehicle assigned to your Driver profile. MOT and Insurance on this vehicle now contribute to canonical operational eligibility.');
    await load();
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

  const assignedRelationshipSummary = assignedVehicles.length === 0
    ? 'None'
    : assignedVehicles.length === 1
      ? vehicleName(assignedVehicles[0])
      : `${assignedVehicles.length} assigned vehicle records`;
  const canonicalSummary = !canonicalVehicleSignalAvailable
    ? 'Unavailable'
    : canonicalVehicle
      ? vehicleName(canonicalVehicle)
      : 'None';

  const vehicleSignalRail = (
    <aside className="driver-filter-rail" aria-label="Vehicle assignment signals">
      <div className="driver-filter-rail__header">Vehicle Signals</div>
      <div className="driver-filter-rail__body">
        <div className="driver-returns-rail-stat"><span>{canManageVehicles ? 'Company vehicles' : 'Assigned vehicle records'}</span><strong>{vehicles.length}</strong></div>
        <div className="driver-returns-rail-stat"><span>Assigned relationship</span><strong>{assignedRelationshipSummary}</strong></div>
        <div className="driver-returns-rail-stat"><span>Canonical active vehicle</span><strong>{canonicalSummary}</strong></div>
        <div className="driver-returns-rail-stat"><span>Equipment recorded</span><strong>{equippedCount}</strong></div>
        <div className="driver-returns-rail-stat"><span>Payload recorded</span><strong>{vehicles.filter((vehicle) => Boolean(vehicle.payload_kg)).length}</strong></div>
        <span style={{ fontSize: 11, lineHeight: '15px', color: '#64748b' }}>Exactly one active vehicle must be assigned to your Driver profile before it can become the canonical execution vehicle.</span>
        {canManageVehicles ? <ActionButton tone="success" onClick={startAdd}>+ Add vehicle</ActionButton> : <span style={{ fontSize: 11, lineHeight: '15px', color: '#64748b' }}>Company drivers have read-only access to vehicle records assigned to their profile. Fleet changes are managed by the company.</span>}
      </div>
    </aside>
  );

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell
        subtitle="Vehicle records, assignment relationships and the canonical active-vehicle signal. Full operational eligibility remains server-authoritative."
        headerActions={<ActionButton tone="primary" onClick={() => void load()} disabled={loading}>Refresh</ActionButton>}
      >
        {error && <AlertBanner tone="danger">{error}</AlertBanner>}
        {notice && <AlertBanner tone="success">{notice}</AlertBanner>}
        {!canonicalVehicleSignalAvailable && <AlertBanner tone="warning">Canonical active-vehicle signal is temporarily unavailable. Vehicle records and assignment relationships remain visible.</AlertBanner>}
        {canManageVehicles && vehicles.length > 0 && assignedVehicles.length === 0 && <AlertBanner tone="warning">Your company has vehicle records, but none is assigned to your Driver profile. Choose the vehicle you operate and select Assign to me.</AlertBanner>}
        <div className="driver-board-layout driver-vehicle-board">
          {vehicleSignalRail}
          <main className="driver-board-main">
            {showForm && canManageVehicles && (
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
                  {(['has_tail_lift', 'has_straps', 'has_blankets'] as const).map((field) => <label key={field} className="driver-returns-check"><input type="checkbox" checked={form[field]} onChange={(event) => setField(field, event.target.checked)} /><span>{field.replace(/_/g, ' ').replace('has ', '').replace(/\b\w/g, (character) => character.toUpperCase())}</span></label>)}
                </div>
                <div className="driver-row-actions" style={{ marginTop: 5 }}><ActionButton tone="secondary" onClick={cancelForm}>Cancel</ActionButton><ActionButton tone="primary" onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : editingId ? 'Update vehicle' : 'Add vehicle'}</ActionButton></div>
              </section>
            )}
            <div className="driver-board-summary"><span><strong>Vehicle register</strong> · {vehicles.length} record{vehicles.length === 1 ? '' : 's'}</span>{canManageVehicles && !showForm ? <ActionButton tone="success" onClick={startAdd}>+ Add vehicle</ActionButton> : null}</div>
            {loading ? <div className="driver-load-row"><EmptyState compact title="Loading vehicles…" /></div> : vehicles.length === 0 ? <div className="driver-load-row"><EmptyState compact title={canManageVehicles ? 'No vehicles in this workspace' : 'No vehicle assigned to you'} description={canManageVehicles ? 'Add a vehicle to provide capacity and equipment information for operations.' : 'Your company fleet manager can assign a vehicle to your driver profile.'} /></div> : (
              <div className="driver-load-list">{vehicles.map((vehicle) => {
                const assigned = Boolean(driverId) && vehicle.assigned_driver_id === driverId;
                const assignedElsewhere = Boolean(vehicle.assigned_driver_id) && !assigned;
                const active = String(vehicle.status ?? '').toLowerCase() === 'active';
                const canonical = vehicle.id === canonicalVehicleId;
                const equipment = [vehicle.has_tail_lift && 'Tail lift', vehicle.has_straps && 'Straps', vehicle.has_blankets && 'Blankets'].filter(Boolean).join(' · ') || 'Standard';
                return (
                  <article key={vehicle.id} className="driver-load-row" data-state={canonical ? 'active' : assigned ? 'assigned' : 'recorded'}>
                    <div className="driver-load-row__top">
                      <div className="driver-load-cell"><span className="driver-cell-label">Vehicle</span><strong className="driver-cell-primary">{vehicleName(vehicle)}</strong><span className="driver-cell-secondary">{VEHICLE_TYPE_LABELS[vehicle.type ?? ''] ?? vehicle.type?.replace(/_/g, ' ') ?? 'Unknown'}</span></div>
                      <div className="driver-load-cell"><span className="driver-cell-label">Capacity</span><strong className="driver-cell-primary">{vehicle.payload_kg ? `${vehicle.payload_kg} kg` : 'Payload not set'}</strong><span className="driver-cell-secondary">{vehicle.pallets_capacity != null ? `${vehicle.pallets_capacity} pallet positions` : 'Pallet capacity not set'}</span></div>
                      <div className="driver-load-cell"><span className="driver-cell-label">Equipment</span><strong className="driver-cell-primary">{equipment}</strong><span className="driver-cell-secondary">Recorded equipment</span></div>
                      <div className="driver-load-cell"><span className="driver-cell-label">Assignment</span><strong className="driver-cell-primary">{canonical ? 'Canonical active vehicle' : assigned ? 'Assigned relationship' : assignedElsewhere ? 'Assigned to another Driver' : 'Company fleet record'}</strong><span className="driver-cell-secondary"><StatusBadge value={canonical ? 'Canonical active' : assigned ? 'Assigned relation' : active ? 'Available' : vehicle.status || 'Recorded'} tone={canonical ? 'blue' : 'grey'} /></span></div>
                    </div>
                    <div className="driver-load-row__meta">
                      <span>Vehicle #{vehicle.id.slice(0, 8).toUpperCase()}</span>
                      {canManageVehicles ? <div className="driver-row-actions">
                        <ActionButton tone="secondary" onClick={() => startEdit(vehicle)}>Edit</ActionButton>
                        {!assigned && !assignedElsewhere && active && <ActionButton tone="success" onClick={() => void assignToMe(vehicle.id)} disabled={assigningId === vehicle.id}>{assigningId === vehicle.id ? 'Assigning…' : 'Assign to me'}</ActionButton>}
                        {assigned && <ActionButton tone="danger" onClick={() => void deactivate(vehicle.id)} disabled={deactivatingId === vehicle.id}>{deactivatingId === vehicle.id ? 'Removing…' : 'Unassign'}</ActionButton>}
                      </div> : <span>Read only</span>}
                    </div>
                  </article>
                );
              })}</div>
            )}
          </main>
        </div>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
