'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { supabase } from '../../../lib/supabaseClient';
import { VEHICLE_GROUPS, VEHICLE_TYPE_LABELS } from '../../../lib/vehicleTypes';

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

const card: CSSProperties = {
  backgroundColor: '#ffffff',
  border: '1px solid #d7e0ea',
  borderRadius: '12px',
  padding: '1rem',
  boxShadow: '0 2px 8px rgba(15,23,42,0.06)',
};

const fieldStyle: CSSProperties = {
  border: '1px solid #cbd5e1',
  borderRadius: '8px',
  padding: '0.55rem 0.68rem',
  fontSize: '0.82rem',
  color: '#0f172a',
  background: '#fff',
  width: '100%',
};

const labelStyle: CSSProperties = {
  display: 'grid',
  gap: '0.28rem',
  color: '#334155',
  fontSize: '0.72rem',
  fontWeight: 800,
};

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

  const getAuthHeader = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    return token ? 'Bearer ' + token : null;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const auth = await getAuthHeader();
    if (!auth) { setLoading(false); return; }
    const response = await fetch('/api/driver/vehicles', { headers: { Authorization: auth } });
    const payload = (await response.json().catch(() => ({}))) as {
      vehicles?: VehicleRow[];
      assignedVehicleId?: string | null;
      error?: string;
    };
    if (!response.ok) {
      setError(payload.error ?? 'Unable to load vehicles.');
    } else {
      setVehicles(payload.vehicles ?? []);
      setAssignedVehicleId(payload.assignedVehicleId ?? null);
    }
    setLoading(false);
  }, [getAuthHeader]);

  useEffect(() => {
    if (user) void load();
  }, [load, user]);

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

  const cancelForm = () => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); };

  const save = async () => {
    if (!form.type) { setError('Vehicle type is required.'); return; }
    setSaving(true);
    setError('');
    const auth = await getAuthHeader();
    if (!auth) { setError('Session expired.'); setSaving(false); return; }

    const payload = {
      type: form.type,
      reg_plate: form.reg_plate.trim().toUpperCase() || undefined,
      make: form.make.trim() || undefined,
      model: form.model.trim() || undefined,
      payload_kg: form.payload_kg ? parseInt(form.payload_kg, 10) : undefined,
      pallets_capacity: form.pallets_capacity ? parseInt(form.pallets_capacity, 10) : undefined,
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
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    setSaving(false);
    if (!response.ok) { setError(result.error ?? 'Save failed.'); return; }
    setNotice(isEdit ? 'Vehicle updated successfully.' : 'Vehicle added successfully.');
    cancelForm();
    await load();
  };

  const setField = (field: keyof VehicleForm, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell subtitle="Company vehicle fleet — add, edit and view assigned vehicles.">
        <div style={{ display: 'grid', gap: '1rem', maxWidth: '960px' }}>
          {error && (
            <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '8px', padding: '0.75rem', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}
          {notice && (
            <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', borderRadius: '8px', padding: '0.75rem', fontSize: '0.85rem' }}>
              {notice}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.35rem', color: '#0f172a' }}>Vehicles</h1>
              <p style={{ margin: '0.3rem 0 0', color: '#64748b', fontSize: '0.84rem' }}>
                Company fleet vehicles. Your dispatcher manages assignments; you can add vehicles for the company fleet.
              </p>
            </div>
            {!showForm && (
              <button
                type="button"
                onClick={startAdd}
                style={{ background: '#1d57d8', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.55rem 0.9rem', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer' }}
              >
                + Add vehicle
              </button>
            )}
          </div>

          {showForm && (
            <div style={{ ...card, border: '1px solid #1d57d8' }}>
              <h2 style={{ margin: '0 0 0.9rem', fontSize: '1rem', color: '#0f172a' }}>{editingId ? 'Edit vehicle' : 'Add vehicle'}</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <label style={labelStyle}>
                  Vehicle type *
                  <select value={form.type} onChange={(e) => setField('type', e.target.value)} style={fieldStyle}>
                    {VEHICLE_GROUPS.map(([group, options]) => (
                      <optgroup key={group} label={group}>
                        {options.map(([label, value]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
                <label style={labelStyle}>
                  Registration plate
                  <input value={form.reg_plate} onChange={(e) => setField('reg_plate', e.target.value)} placeholder="e.g. AB12 CDE" style={fieldStyle} />
                </label>
                <label style={labelStyle}>
                  Make
                  <input value={form.make} onChange={(e) => setField('make', e.target.value)} placeholder="e.g. Mercedes" style={fieldStyle} />
                </label>
                <label style={labelStyle}>
                  Model
                  <input value={form.model} onChange={(e) => setField('model', e.target.value)} placeholder="e.g. Sprinter" style={fieldStyle} />
                </label>
                <label style={labelStyle}>
                  Payload (kg)
                  <input type="number" min="0" value={form.payload_kg} onChange={(e) => setField('payload_kg', e.target.value)} placeholder="e.g. 1000" style={fieldStyle} />
                </label>
                <label style={labelStyle}>
                  Pallet capacity
                  <input type="number" min="0" value={form.pallets_capacity} onChange={(e) => setField('pallets_capacity', e.target.value)} placeholder="e.g. 12" style={fieldStyle} />
                </label>
              </div>
              <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.9rem', flexWrap: 'wrap' }}>
                {(['has_tail_lift', 'has_straps', 'has_blankets'] as const).map((field) => (
                  <label key={field} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.8rem', color: '#334155', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form[field]} onChange={(e) => setField(field, e.target.checked)} />
                    {field.replace(/_/g, ' ').replace('has ', '').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </label>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" disabled={saving} onClick={() => void save()} style={{ background: '#1d57d8', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.55rem 0.9rem', fontSize: '0.78rem', fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Saving…' : editingId ? 'Update vehicle' : 'Add vehicle'}
                </button>
                <button type="button" onClick={cancelForm} style={{ background: '#f8fafc', color: '#0f172a', border: '1px solid #d7e0ea', borderRadius: '8px', padding: '0.55rem 0.9rem', fontSize: '0.78rem', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div style={card}>
              <div style={{ color: '#64748b', fontSize: '0.9rem' }}>Loading vehicles…</div>
            </div>
          ) : vehicles.length === 0 ? (
            <div style={{ ...card, textAlign: 'center', borderStyle: 'dashed' }}>
              <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem' }}>No vehicles in fleet</div>
              <div style={{ color: '#64748b', fontSize: '0.85rem' }}>Add the first vehicle to get started.</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.85rem' }}>
              {vehicles.map((vehicle) => (
                <div key={vehicle.id} style={{ ...card, border: vehicle.id === assignedVehicleId ? '1px solid #1d57d8' : '1px solid #d7e0ea' }}>
                  {vehicle.id === assignedVehicleId && (
                    <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#1d57d8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>
                      ✓ Your assigned vehicle
                    </div>
                  )}
                  <div style={{ fontWeight: 700, fontSize: '0.94rem', color: '#0f172a', marginBottom: '0.2rem' }}>
                    {vehicle.reg_plate ?? 'No plate'}{vehicle.make ? ` · ${vehicle.make}` : ''}{vehicle.model ? ` ${vehicle.model}` : ''}
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.78rem', marginBottom: '0.6rem' }}>
                    {VEHICLE_TYPE_LABELS[vehicle.type ?? ''] ?? vehicle.type ?? 'Unknown type'}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.65rem' }}>
                    {vehicle.payload_kg && <span style={{ fontSize: '0.7rem', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '0.15rem 0.4rem' }}>{vehicle.payload_kg}kg</span>}
                    {vehicle.pallets_capacity && <span style={{ fontSize: '0.7rem', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '0.15rem 0.4rem' }}>{vehicle.pallets_capacity} pallets</span>}
                    {vehicle.has_tail_lift && <span style={{ fontSize: '0.7rem', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '0.15rem 0.4rem' }}>Tail lift</span>}
                    {vehicle.has_straps && <span style={{ fontSize: '0.7rem', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '0.15rem 0.4rem' }}>Straps</span>}
                    {vehicle.has_blankets && <span style={{ fontSize: '0.7rem', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '0.15rem 0.4rem' }}>Blankets</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => startEdit(vehicle)}
                    style={{ width: '100%', background: 'none', border: '1px solid #d7e0ea', borderRadius: '6px', padding: '0.35rem', fontSize: '0.72rem', color: '#475569', cursor: 'pointer' }}
                  >
                    Edit
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
