'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import type { Driver } from '../../../lib/types/database';

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ display_name: '', phone: '', email: '', company_id: '' });
  const [error, setError] = useState('');

  useEffect(() => { loadDrivers(); }, []);

  const loadDrivers = async () => {
    setLoading(true);
    if (!isSupabaseConfigured) { setLoading(false); return; }
    const { data, error } = await supabase.from('drivers').select('*').order('created_at', { ascending: false });
    if (!error && data) setDrivers(data as Driver[]);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!formData.display_name.trim()) { setError('Driver name is required'); return; }
    if (!formData.company_id.trim()) { setError('Company ID is required'); return; }
    if (!isSupabaseConfigured) { setError('Supabase is not configured'); return; }
    const { error } = await supabase.from('drivers').insert([formData]);
    if (error) { setError(error.message); return; }
    setShowModal(false);
    setFormData({ display_name: '', phone: '', email: '', company_id: '' });
    setError('');
    loadDrivers();
  };

  const inputStyle = { width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.95rem', boxSizing: 'border-box' as const };
  const labelStyle = { display: 'block', fontSize: '0.9rem', fontWeight: '500' as const, color: '#374151', marginBottom: '0.5rem' };
  const statusColor = (s: string) => s === 'active' ? '#1F7A3D' : '#ef4444';

  return (
    <ProtectedRoute>
      <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', padding: '2rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <div>
              <h1 style={{ fontSize: '2rem', fontWeight: '700', color: '#1f2937', margin: 0 }}>Drivers</h1>
              <p style={{ color: '#6b7280', margin: '0.5rem 0 0 0' }}>Manage drivers for your company</p>
            </div>
            <button onClick={() => setShowModal(true)} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#1F7A3D', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.95rem', fontWeight: '600', cursor: 'pointer' }}>
              + Add Driver
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
            ) : drivers.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚚</div>
                <p>No drivers yet. Add your first driver.</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    {['Name', 'Email', 'Phone', 'Status', 'Created'].map(h => (
                      <th key={h} style={{ padding: '1rem', textAlign: 'left', fontSize: '0.85rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {drivers.map((d, i) => (
                    <tr key={d.id} style={{ borderBottom: i < drivers.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                      <td style={{ padding: '1rem', fontWeight: '600', color: '#1f2937' }}>{d.display_name}</td>
                      <td style={{ padding: '1rem', color: '#6b7280' }}>{d.email || '—'}</td>
                      <td style={{ padding: '1rem', color: '#6b7280' }}>{d.phone || '—'}</td>
                      <td style={{ padding: '1rem' }}><span style={{ backgroundColor: d.status === 'active' ? '#d1fae5' : '#fee2e2', color: statusColor(d.status), padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600' }}>{d.status}</span></td>
                      <td style={{ padding: '1rem', color: '#6b7280' }}>{new Date(d.created_at).toLocaleDateString()}</td>
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
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#1f2937' }}>Add Driver</h2>
                <button onClick={() => { setShowModal(false); setError(''); }} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}>×</button>
              </div>
              <div style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
                {error && <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '0.75rem', color: '#dc2626', fontSize: '0.9rem' }}>{error}</div>}
                <div><label style={labelStyle}>Full Name *</label><input style={inputStyle} value={formData.display_name} onChange={e => setFormData({...formData, display_name: e.target.value})} placeholder="John Smith" /></div>
                <div><label style={labelStyle}>Company ID *</label><input style={inputStyle} value={formData.company_id} onChange={e => setFormData({...formData, company_id: e.target.value})} placeholder="UUID of company" /></div>
                <div><label style={labelStyle}>Email</label><input style={inputStyle} type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="driver@email.com" /></div>
                <div><label style={labelStyle}>Phone</label><input style={inputStyle} value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="07123456789" /></div>
              </div>
              <div style={{ padding: '1.5rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button onClick={() => { setShowModal(false); setError(''); }} style={{ padding: '0.75rem 1.5rem', backgroundColor: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleCreate} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#1F7A3D', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Add Driver</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
