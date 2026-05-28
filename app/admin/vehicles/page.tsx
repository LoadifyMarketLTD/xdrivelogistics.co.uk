'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import type { Vehicle, VehicleType, Company } from '../../../lib/types/database';

const VEHICLE_TYPES: VehicleType[] = ['bicycle', 'motorbike', 'car', 'van_small', 'van_large', 'luton', 'truck_7_5t', 'truck_18t', 'artic'];

interface DriverOption { id: string; display_name: string; }

export default function VehiclesPage() {
  const { user, hasSupabaseSession } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [formData, setFormData] = useState({ company_id: '', type: 'van_large' as VehicleType, reg_plate: '', make: '', model: '', payload_kg: '', has_tail_lift: false, assigned_driver_id: '' });
  const [editData, setEditData] = useState({ type: 'van_large' as VehicleType, reg_plate: '', make: '', model: '', payload_kg: '', has_tail_lift: false, assigned_driver_id: '' });
  const [error, setError] = useState('');
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);

  const loadCompanyId = async (userId: string, authCompanyId: string | null) => {
    let resolvedCompanyId = authCompanyId;

    // Refresh auth user to ensure session context is up to date before fallback queries.
    await supabase.auth.getUser();

    if (!resolvedCompanyId) {
      const { data: membership } = await supabase
        .from('company_memberships')
        .select('company_id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      resolvedCompanyId = (membership?.company_id as string) ?? null;
    }

    if (!resolvedCompanyId) {
      const { data } = await supabase.rpc('get_or_create_company_for_user');
      if (data) {
        resolvedCompanyId = data as string;
      }
    }

    setCompanyId(resolvedCompanyId);
  };

  const loadVehicles = async () => {
    setLoading(true);
    if (!isSupabaseConfigured) { setLoading(false); return; }
    if (!companyId) { setVehicles([]); setLoading(false); return; }
    const { data, error } = await supabase
      .from('vehicles')
      .select('id, company_id, type, reg_plate, make, model, payload_kg, has_tail_lift, assigned_driver_id, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (!error && data) setVehicles(data as Vehicle[]);
    setLoading(false);
  };

  const loadCompanies = async () => {
    if (!isSupabaseConfigured || !companyId) return;
    const { data, error } = await supabase.from('companies').select('id, name').eq('id', companyId).order('name');
    if (error) { console.error('Failed to load companies:', error.message); return; }
    if (data) setCompanies(data as Company[]);
  };

  const loadDrivers = async () => {
    if (!isSupabaseConfigured || !companyId) return;
    const { data } = await supabase
      .from('drivers')
      .select('id, display_name')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .order('display_name');
    if (data) setDrivers(data as DriverOption[]);
  };

  useEffect(() => {
    if (hasSupabaseSession && user?.id) {
      loadCompanyId(user.id, user.companyId);
    }
  }, [hasSupabaseSession, user?.id, user?.companyId]);

  useEffect(() => {
    if (!companyId) return;
    setFormData((prev) => ({ ...prev, company_id: companyId }));
    loadVehicles();
    loadCompanies();
    loadDrivers();
  }, [companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async () => {
    if (!companyId) { setError('Company is required'); return; }
    if (!isSupabaseConfigured) { setError('Supabase is not configured'); return; }
    const { data: authCtx } = await supabase.auth.getUser();
    const resolvedCompanyId = companyId;
    const insertPayload = {
      ...formData,
      company_id: resolvedCompanyId,
      payload_kg: formData.payload_kg ? parseFloat(formData.payload_kg) : null,
      assigned_driver_id: formData.assigned_driver_id || null,
    };
    console.debug('[XDrive Vehicles] insert attempt', {
      authUid: authCtx.user?.id ?? null,
      resolvedCompanyId,
      userRole: user?.role ?? null,
      payloadCompanyId: insertPayload.company_id,
      payloadAssignedDriverId: insertPayload.assigned_driver_id,
    });
    const { error } = await supabase.from('vehicles').insert([insertPayload]);
    if (error) {
      console.error('[XDrive Vehicles] insert failed', {
        authUid: authCtx.user?.id ?? null,
        resolvedCompanyId,
        userRole: user?.role ?? null,
        payloadCompanyId: insertPayload.company_id,
        payloadAssignedDriverId: insertPayload.assigned_driver_id,
        errorCode: error.code ?? null,
        errorMessage: error.message,
        errorDetails: error.details ?? null,
      });
      setError(error.message);
      return;
    }
    setShowModal(false);
    setFormData({ company_id: companyId ?? '', type: 'van_large', reg_plate: '', make: '', model: '', payload_kg: '', has_tail_lift: false, assigned_driver_id: '' });
    setError('');
    loadVehicles();
  };

  const openEditModal = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setEditData({
      type: vehicle.type,
      reg_plate: vehicle.reg_plate ?? '',
      make: vehicle.make ?? '',
      model: vehicle.model ?? '',
      payload_kg: vehicle.payload_kg != null ? String(vehicle.payload_kg) : '',
      has_tail_lift: vehicle.has_tail_lift ?? false,
      assigned_driver_id: vehicle.assigned_driver_id ?? '',
    });
    setEditError('');
  };

  const handleUpdate = async () => {
    if (!editingVehicle || !companyId || !isSupabaseConfigured) return;
    setSaving(true);
    const { error } = await supabase
      .from('vehicles')
      .update({
        type: editData.type,
        reg_plate: editData.reg_plate.trim() || null,
        make: editData.make.trim() || null,
        model: editData.model.trim() || null,
        payload_kg: editData.payload_kg ? parseFloat(editData.payload_kg) : null,
        has_tail_lift: editData.has_tail_lift,
        assigned_driver_id: editData.assigned_driver_id || null,
      })
      .eq('id', editingVehicle.id)
      .eq('company_id', companyId);
    setSaving(false);
    if (error) { setEditError(error.message); return; }
    setEditingVehicle(null);
    loadVehicles();
  };

  const handleDelete = async (vehicleId: string) => {
    if (!companyId || !isSupabaseConfigured) return;
    await supabase.from('vehicles').delete().eq('id', vehicleId).eq('company_id', companyId);
    setShowDeleteConfirm(null);
    loadVehicles();
  };

  const inputStyle = { width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.95rem', boxSizing: 'border-box' as const, backgroundColor: 'white' };
  const labelStyle = { display: 'block', fontSize: '0.9rem', fontWeight: '500' as const, color: '#374151', marginBottom: '0.5rem' };

  return (
    <ProtectedRoute>
      <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', padding: '2rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <div>
              <h1 style={{ fontSize: '2rem', fontWeight: '700', color: '#1f2937', margin: 0 }}>Vehicles</h1>
              <p style={{ color: '#6b7280', margin: '0.5rem 0 0 0' }}>Manage fleet vehicles</p>
            </div>
            <button onClick={() => setShowModal(true)} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#1F7A3D', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.95rem', fontWeight: '600', cursor: 'pointer' }}>
              + Add Vehicle
            </button>
          </div>

          {!isSupabaseConfigured && (
            <div style={{ backgroundColor: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', color: '#92400e' }}>
              ⚠️ Supabase is not configured. Database features are disabled.
            </div>
          )}

          <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>Loading...</div>
            ) : vehicles.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚛</div>
                <p>No vehicles yet. Add your first vehicle.</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    {['Reg Plate', 'Type', 'Make / Model', 'Payload (kg)', 'Tail Lift', 'Assigned Driver', 'Created', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '1rem', textAlign: 'left', fontSize: '0.85rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map((v, i) => {
                    const assignedDriver = drivers.find(d => d.id === v.assigned_driver_id);
                    return (
                      <tr key={v.id} style={{ borderBottom: i < vehicles.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                        <td style={{ padding: '1rem', fontWeight: '600', color: '#1f2937' }}>{v.reg_plate || '—'}</td>
                        <td style={{ padding: '1rem', color: '#6b7280' }}>{v.type.replace(/_/g, ' ')}</td>
                        <td style={{ padding: '1rem', color: '#6b7280' }}>{[v.make, v.model].filter(Boolean).join(' ') || '—'}</td>
                        <td style={{ padding: '1rem', color: '#6b7280' }}>{v.payload_kg ?? '—'}</td>
                        <td style={{ padding: '1rem' }}>{v.has_tail_lift ? '✅' : '—'}</td>
                        <td style={{ padding: '1rem', color: '#6b7280' }}>{assignedDriver?.display_name ?? '—'}</td>
                        <td style={{ padding: '1rem', color: '#6b7280' }}>{new Date(v.created_at).toLocaleDateString()}</td>
                        <td style={{ padding: '1rem' }}>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              onClick={() => openEditModal(v)}
                              style={{ padding: '0.35rem 0.75rem', backgroundColor: '#e0f2fe', color: '#075985', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setShowDeleteConfirm(v.id)}
                              style={{ padding: '0.35rem 0.75rem', backgroundColor: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Create Modal */}
        {showModal && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ backgroundColor: 'white', borderRadius: '12px', width: '90%', maxWidth: '500px', maxHeight: '90vh', overflow: 'auto' }}>
              <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#1f2937' }}>Add Vehicle</h2>
                <button onClick={() => { setShowModal(false); setError(''); }} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}>×</button>
              </div>
              <div style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
                {error && <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '0.75rem', color: '#dc2626', fontSize: '0.9rem' }}>{error}</div>}
                <div>
                  <label style={labelStyle}>Company *</label>
                  <select style={inputStyle} value={companyId ?? ''} disabled>
                    <option value="">Select a company…</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Vehicle Type *</label>
                  <select style={inputStyle} value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as VehicleType})}>
                    {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div><label style={labelStyle}>Reg Plate</label><input style={inputStyle} value={formData.reg_plate} onChange={e => setFormData({...formData, reg_plate: e.target.value})} placeholder="AB12 CDE" /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div><label style={labelStyle}>Make</label><input style={inputStyle} value={formData.make} onChange={e => setFormData({...formData, make: e.target.value})} placeholder="Ford" /></div>
                  <div><label style={labelStyle}>Model</label><input style={inputStyle} value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} placeholder="Transit" /></div>
                </div>
                <div><label style={labelStyle}>Payload (kg)</label><input style={inputStyle} type="number" value={formData.payload_kg} onChange={e => setFormData({...formData, payload_kg: e.target.value})} placeholder="1000" /></div>
                <div>
                  <label style={labelStyle}>Assign Driver</label>
                  <select style={inputStyle} value={formData.assigned_driver_id} onChange={e => setFormData({...formData, assigned_driver_id: e.target.value})}>
                    <option value="">— Unassigned —</option>
                    {drivers.map(d => <option key={d.id} value={d.id}>{d.display_name}</option>)}
                  </select>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.95rem' }}>
                  <input type="checkbox" checked={formData.has_tail_lift} onChange={e => setFormData({...formData, has_tail_lift: e.target.checked})} />
                  Has Tail Lift
                </label>
              </div>
              <div style={{ padding: '1.5rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button onClick={() => { setShowModal(false); setError(''); }} style={{ padding: '0.75rem 1.5rem', backgroundColor: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleCreate} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#1F7A3D', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Add Vehicle</button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {editingVehicle && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ backgroundColor: 'white', borderRadius: '12px', width: '90%', maxWidth: '500px', maxHeight: '90vh', overflow: 'auto' }}>
              <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#1f2937' }}>Edit Vehicle</h2>
                <button onClick={() => setEditingVehicle(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}>×</button>
              </div>
              <div style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
                {editError && <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '0.75rem', color: '#dc2626', fontSize: '0.9rem' }}>{editError}</div>}
                <div>
                  <label style={labelStyle}>Vehicle Type *</label>
                  <select style={inputStyle} value={editData.type} onChange={e => setEditData({...editData, type: e.target.value as VehicleType})}>
                    {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div><label style={labelStyle}>Reg Plate</label><input style={inputStyle} value={editData.reg_plate} onChange={e => setEditData({...editData, reg_plate: e.target.value})} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div><label style={labelStyle}>Make</label><input style={inputStyle} value={editData.make} onChange={e => setEditData({...editData, make: e.target.value})} /></div>
                  <div><label style={labelStyle}>Model</label><input style={inputStyle} value={editData.model} onChange={e => setEditData({...editData, model: e.target.value})} /></div>
                </div>
                <div><label style={labelStyle}>Payload (kg)</label><input style={inputStyle} type="number" value={editData.payload_kg} onChange={e => setEditData({...editData, payload_kg: e.target.value})} /></div>
                <div>
                  <label style={labelStyle}>Assign Driver</label>
                  <select style={inputStyle} value={editData.assigned_driver_id} onChange={e => setEditData({...editData, assigned_driver_id: e.target.value})}>
                    <option value="">— Unassigned —</option>
                    {drivers.map(d => <option key={d.id} value={d.id}>{d.display_name}</option>)}
                  </select>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.95rem' }}>
                  <input type="checkbox" checked={editData.has_tail_lift} onChange={e => setEditData({...editData, has_tail_lift: e.target.checked})} />
                  Has Tail Lift
                </label>
              </div>
              <div style={{ padding: '1.5rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button onClick={() => setEditingVehicle(null)} disabled={saving} style={{ padding: '0.75rem 1.5rem', backgroundColor: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', cursor: saving ? 'not-allowed' : 'pointer' }}>Cancel</button>
                <button onClick={handleUpdate} disabled={saving} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#1F7A3D', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirm */}
        {showDeleteConfirm && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '2rem', maxWidth: '400px', width: '90%', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚠️</div>
              <h3 style={{ color: '#1f2937', marginBottom: '0.75rem' }}>Delete Vehicle?</h3>
              <p style={{ color: '#6b7280', marginBottom: '1.5rem', fontSize: '0.9rem' }}>This action cannot be undone.</p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <button onClick={() => setShowDeleteConfirm(null)} style={{ padding: '0.75rem 1.5rem', backgroundColor: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
                <button onClick={() => handleDelete(showDeleteConfirm)} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Delete</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
