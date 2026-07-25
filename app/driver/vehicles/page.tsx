'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { VEHICLE_TYPE_LABELS } from '../../../lib/vehicleTypes';

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
  created_at: string;
};

type FormState = {
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

const BLANK_FORM: FormState = {
  type: '',
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
  backgroundColor: '#fff',
  border: '1px solid #d7e0ea',
  borderRadius: '12px',
  padding: '1.25rem',
  boxShadow: '0 2px 8px rgba(15,23,42,0.06)',
};

const lbl: CSSProperties = {
  display: 'block',
  fontSize: '0.72rem',
  fontWeight: 700,
  color: '#475569',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: '0.3rem',
};

const inp: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '0.5rem 0.75rem',
  border: '1px solid #cbd5e1',
  borderRadius: '6px',
  fontSize: '0.88rem',
  color: '#0f172a',
  background: '#f8fafc',
};

const btnPrimary: CSSProperties = {
  background: '#0f172a', color: '#fff', border: 'none', borderRadius: '7px',
  padding: '0.55rem 1.15rem', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
};
const btnDanger: CSSProperties = { ...btnPrimary, background: '#ef4444' };
const btnSecondary: CSSProperties = {
  ...btnPrimary, background: 'transparent', color: '#475569', border: '1px solid #cbd5e1',
};

async function getToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export default function DriverVehiclesPage() {
  void isSupabaseConfigured;

  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [deactivating, setDeactivating] = useState<string | null>(null);

  const loadVehicles = useCallback(async () => {
    setLoading(true);
    setError('');
    const token = await getToken();
    if (!token) { setLoading(false); return; }
    const res = await fetch('/api/driver/vehicles', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json().catch(() => ({})) as { vehicles?: VehicleRow[]; error?: string };
    if (!res.ok) { setError(body.error ?? 'Failed to load vehicles.'); }
    else { setVehicles(body.vehicles ?? []); }
    setLoading(false);
  }, []);

  useEffect(() => { void loadVehicles(); }, [loadVehicles]);

  const openCreate = () => { setEditingId(null); setForm(BLANK_FORM); setShowForm(true); setResult(''); };
  const openEdit = (v: VehicleRow) => {
    setEditingId(v.id);
    setForm({
      type: v.type ?? '', reg_plate: v.reg_plate ?? '', make: v.make ?? '',
      model: v.model ?? '', payload_kg: v.payload_kg != null ? String(v.payload_kg) : '',
      pallets_capacity: v.pallets_capacity != null ? String(v.pallets_capacity) : '',
      has_tail_lift: v.has_tail_lift ?? false, has_straps: v.has_straps ?? false,
      has_blankets: v.has_blankets ?? false,
    });
    setShowForm(true); setResult('');
  };

  const save = async () => {
    if (!form.type || !form.reg_plate) return;
    setSaving(true); setResult('');
    const token = await getToken();
    const headers: HeadersInit = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    const payload = {
      type: form.type, reg_plate: form.reg_plate, make: form.make || undefined,
      model: form.model || undefined,
      payload_kg: form.payload_kg ? Number(form.payload_kg) : null,
      pallets_capacity: form.pallets_capacity ? Number(form.pallets_capacity) : null,
      has_tail_lift: form.has_tail_lift, has_straps: form.has_straps, has_blankets: form.has_blankets,
    };
    const res = editingId
      ? await fetch('/api/driver/vehicles', { method: 'PATCH', headers, body: JSON.stringify({ vehicleId: editingId, ...payload }) })
      : await fetch('/api/driver/vehicles', { method: 'POST', headers, body: JSON.stringify(payload) });
    const body = await res.json().catch(() => ({})) as { error?: string };
    if (!res.ok) { setResult(`Error: ${body.error ?? 'Save failed.'}`); }
    else { setResult(editingId ? 'Vehicle updated.' : 'Vehicle registered.'); setShowForm(false); await loadVehicles(); }
    setSaving(false);
  };

  const deactivate = async (vehicleId: string, regPlate: string | null) => {
    if (!window.confirm(`Remove assignment for ${regPlate ?? vehicleId}?`)) return;
    setDeactivating(vehicleId); setResult('');
    const token = await getToken();
    const res = await fetch('/api/driver/vehicles', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ vehicleId, action: 'deactivate' }),
    });
    const body = await res.json().catch(() => ({})) as { error?: string };
    if (!res.ok) { setResult(`Error: ${body.error ?? 'Failed.'}`); }
    else { setResult('Vehicle unassigned.'); await loadVehicles(); }
    setDeactivating(null);
  };

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell subtitle="Manage your assigned vehicles — register, update or remove.">
        <div style={{ display: 'grid', gap: '1rem', maxWidth: '920px' }}>
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>Vehicle workspace</div>
                <h1 style={{ margin: 0, fontSize: '1.35rem', color: '#0f172a' }}>My Vehicles</h1>
              </div>
              <button style={btnPrimary} onClick={openCreate}>+ Register vehicle</button>
            </div>
          </div>

          {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '8px', padding: '0.75rem', fontSize: '0.85rem' }}>{error}</div>}
          {result && <div style={{ background: result.startsWith('Error') ? '#fef2f2' : '#f0fdf4', border: `1px solid ${result.startsWith('Error') ? '#fecaca' : '#bbf7d0'}`, color: result.startsWith('Error') ? '#b91c1c' : '#15803d', borderRadius: '8px', padding: '0.75rem', fontSize: '0.85rem' }}>{result}</div>}

          {showForm && (
            <div style={{ ...card, borderColor: '#94a3b8' }}>
              <h2 style={{ margin: '0 0 1rem', fontSize: '1rem', color: '#0f172a' }}>{editingId ? 'Edit vehicle' : 'Register new vehicle'}</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div><span style={lbl}>Vehicle type *</span>
                  <select style={inp} value={form.type} onChange={(e) => setField('type', e.target.value)}>
                    <option value="">— select —</option>
                    {Object.entries(VEHICLE_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div><span style={lbl}>Registration plate *</span><input style={inp} value={form.reg_plate} onChange={(e) => setField('reg_plate', e.target.value)} placeholder="AB12 CDE" /></div>
                <div><span style={lbl}>Make</span><input style={inp} value={form.make} onChange={(e) => setField('make', e.target.value)} placeholder="Ford" /></div>
                <div><span style={lbl}>Model</span><input style={inp} value={form.model} onChange={(e) => setField('model', e.target.value)} placeholder="Transit" /></div>
                <div><span style={lbl}>Payload (kg)</span><input style={inp} type="number" value={form.payload_kg} onChange={(e) => setField('payload_kg', e.target.value)} placeholder="1000" /></div>
                <div><span style={lbl}>Pallet capacity</span><input style={inp} type="number" value={form.pallets_capacity} onChange={(e) => setField('pallets_capacity', e.target.value)} placeholder="6" /></div>
              </div>
              <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                {(['has_tail_lift', 'has_straps', 'has_blankets'] as const).map((key) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form[key] as boolean} onChange={(e) => setField(key, e.target.checked)} />
                    {key.replace('has_', '').replace('_', ' ')}
                  </label>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button style={{ ...btnPrimary, opacity: saving || !form.type || !form.reg_plate ? 0.5 : 1 }} onClick={() => void save()} disabled={saving || !form.type || !form.reg_plate}>
                  {saving ? 'Saving…' : editingId ? 'Save changes' : 'Register vehicle'}
                </button>
                <button style={btnSecondary} onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </div>
          )}

          <div style={card}>
            <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.8rem' }}>Assigned vehicles</div>
            {loading ? <div style={{ color: '#64748b' }}>Loading…</div> : vehicles.length === 0 ? (
              <div style={{ border: '1px dashed #cbd5e1', borderRadius: '10px', padding: '1.25rem', textAlign: 'center', background: '#f8fafc' }}>
                <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem' }}>No vehicles registered</div>
                <div style={{ color: '#64748b', fontSize: '0.85rem' }}>Use &quot;Register vehicle&quot; to add your first vehicle.</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {vehicles.map((v) => (
                  <div key={v.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', alignItems: 'start' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.3rem' }}>
                        {v.reg_plate ?? 'No plate'} — {VEHICLE_TYPE_LABELS[v.type ?? ''] ?? v.type ?? 'Unknown'}
                      </div>
                      <div style={{ color: '#475569', fontSize: '0.82rem' }}>
                        {[v.make, v.model].filter(Boolean).join(' ') || 'Make/model not set'}
                        {v.payload_kg ? ` · ${v.payload_kg} kg` : ''}
                        {v.has_tail_lift ? ' · Tail lift' : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button style={{ ...btnSecondary, fontSize: '0.78rem', padding: '0.35rem 0.7rem' }} onClick={() => openEdit(v)}>Edit</button>
                      <button style={{ ...btnDanger, fontSize: '0.78rem', padding: '0.35rem 0.7rem', opacity: deactivating === v.id ? 0.5 : 1 }} onClick={() => void deactivate(v.id, v.reg_plate)} disabled={deactivating === v.id}>
                        {deactivating === v.id ? '…' : 'Remove'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ ...card, background: '#fffbeb', borderColor: '#fde68a' }}>
            <div style={{ fontWeight: 700, color: '#92400e', marginBottom: '0.25rem', fontSize: '0.88rem' }}>Vehicle compliance</div>
            <p style={{ margin: 0, color: '#78350f', fontSize: '0.82rem', lineHeight: 1.6 }}>
              Ensure vehicle documents (MOT, insurance, operator licence) are uploaded and up to date under your profile.
            </p>
          </div>
        </div>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
