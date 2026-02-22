'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import type { Vehicle, VehicleType } from '../../../lib/types/database';

const VEHICLE_TYPES: VehicleType[] = ['bicycle', 'motorbike', 'car', 'van_small', 'van_large', 'luton', 'truck_7_5t', 'truck_18t', 'artic'];

export default function VehiclesPage() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ company_id: '', type: 'van_large' as VehicleType, reg_plate: '', make: '', model: '', payload_kg: '', has_tail_lift: false });
  const [error, setError] = useState('');

  useEffect(() => {
    loadVehicles();
    if (isSupabaseConfigured) {
      supabase.from('companies').select('id,name').then(({ data, error }) => {
        if (!error && data) setCompanies(data);
      });
    }
  }, []);

  const loadVehicles = async () => {
    setLoading(true);
    if (!isSupabaseConfigured) { setLoading(false); return; }
    const { data, error } = await supabase.from('vehicles').select('*').order('created_at', { ascending: false });
    if (!error && data) setVehicles(data as Vehicle[]);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!formData.company_id.trim()) { setError('Company is required'); return; }
    if (!isSupabaseConfigured) { setError('Supabase is not configured'); return; }
    const { error } = await supabase.from('vehicles').insert([{ ...formData, payload_kg: formData.payload_kg ? parseFloat(formData.payload_kg) : null }]);
    if (error) { setError(error.message); return; }
    setShowModal(false);
    setFormData({ company_id: '', type: 'van_large', reg_plate: '', make: '', model: '', payload_kg: '', has_tail_lift: false });
    setError('');
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
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={() => router.push('/admin')} style={{ padding: '0.75rem 1.5rem', backgroundColor: 'white', color: '#0A2239', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.95rem', fontWeight: '600', cursor: 'pointer' }}>
                ← Back to Admin
              </button>
              <button onClick={() => setShowModal(true)} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#1F7A3D', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.95rem', fontWeight: '600', cursor: 'pointer' }}>
                + Add Vehicle
              </button>
            </div>
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
                    {['Reg Plate', 'Type', 'Make / Model', 'Payload (kg)', 'Tail Lift', 'Created'].map(h => (
                      <th key={h} style={{ padding: '1rem', textAlign: 'left', fontSize: '0.85rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map((v, i) => (
                    <tr key={v.id} style={{ borderBottom: i < vehicles.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                      <td style={{ padding: '1rem', fontWeight: '600', color: '#1f2937' }}>{v.reg_plate || '—'}</td>
                      <td style={{ padding: '1rem', color: '#6b7280' }}>{v.type.replace('_', ' ')}</td>
                      <td style={{ padding: '1rem', color: '#6b7280' }}>{[v.make, v.model].filter(Boolean).join(' ') || '—'}</td>
                      <td style={{ padding: '1rem', color: '#6b7280' }}>{v.payload_kg ?? '—'}</td>
                      <td style={{ padding: '1rem' }}>{v.has_tail_lift ? '✅' : '—'}</td>
                      <td style={{ padding: '1rem', color: '#6b7280' }}>{new Date(v.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {showModal && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ backgroundColor: 'white', borderRadius: '12px', width: '90%', maxWidth: '500px' }}>
              <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#1f2937' }}>Add Vehicle</h2>
                <button onClick={() => { setShowModal(false); setError(''); }} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}>×</button>
              </div>
              <div style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
                {error && <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '0.75rem', color: '#dc2626', fontSize: '0.9rem' }}>{error}</div>}
                <div>
                  <label style={labelStyle}>Company *</label>
                  {companies.length > 0 ? (
                    <select style={inputStyle} value={formData.company_id} onChange={e => setFormData({...formData, company_id: e.target.value})}>
                      <option value="">— Select company —</option>
                      {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  ) : (
                    <input style={inputStyle} value={formData.company_id} onChange={e => setFormData({...formData, company_id: e.target.value})} placeholder="Company UUID" />
                  )}
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
      </div>
    </ProtectedRoute>
  );
}
