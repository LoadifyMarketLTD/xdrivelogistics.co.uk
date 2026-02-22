'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import type { Quote, VehicleType, CargoType } from '../../../lib/types/database';

const VEHICLE_TYPES: VehicleType[] = ['bicycle', 'motorbike', 'car', 'van_small', 'van_large', 'luton', 'truck_7_5t', 'truck_18t', 'artic'];
const CARGO_TYPES: CargoType[] = ['documents', 'packages', 'pallets', 'furniture', 'equipment', 'other'];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft: { bg: '#f3f4f6', text: '#6b7280' },
  sent: { bg: '#e0f2fe', text: '#075985' },
  accepted: { bg: '#d1fae5', text: '#065f46' },
  declined: { bg: '#fee2e2', text: '#991b1b' },
};

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    company_id: '', customer_name: '', customer_email: '', customer_phone: '',
    pickup_location: '', delivery_location: '',
    vehicle_type: 'van_large' as VehicleType, cargo_type: 'packages' as CargoType,
    amount: '', currency: 'GBP',
  });
  const [error, setError] = useState('');

  useEffect(() => { loadQuotes(); }, []);

  const loadQuotes = async () => {
    setLoading(true);
    if (!isSupabaseConfigured) { setLoading(false); return; }
    const { data, error } = await supabase.from('quotes').select('*').order('created_at', { ascending: false });
    if (!error && data) setQuotes(data as Quote[]);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!formData.company_id.trim()) { setError('Company ID is required'); return; }
    if (!formData.customer_name.trim()) { setError('Customer name is required'); return; }
    if (!isSupabaseConfigured) { setError('Supabase is not configured'); return; }
    const { error } = await supabase.from('quotes').insert([{ ...formData, amount: formData.amount ? parseFloat(formData.amount) : null }]);
    if (error) { setError(error.message); return; }
    setShowModal(false);
    setFormData({ company_id: '', customer_name: '', customer_email: '', customer_phone: '', pickup_location: '', delivery_location: '', vehicle_type: 'van_large', cargo_type: 'packages', amount: '', currency: 'GBP' });
    setError('');
    loadQuotes();
  };

  const inputStyle = { width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.95rem', boxSizing: 'border-box' as const, backgroundColor: 'white' };
  const labelStyle = { display: 'block', fontSize: '0.9rem', fontWeight: '500' as const, color: '#374151', marginBottom: '0.5rem' };

  return (
    <ProtectedRoute>
      <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', padding: '2rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <div>
              <h1 style={{ fontSize: '2rem', fontWeight: '700', color: '#1f2937', margin: 0 }}>Quotes</h1>
              <p style={{ color: '#6b7280', margin: '0.5rem 0 0 0' }}>Create and manage price quotes</p>
            </div>
            <button onClick={() => setShowModal(true)} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#1F7A3D', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.95rem', fontWeight: '600', cursor: 'pointer' }}>
              + New Quote
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
            ) : quotes.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💬</div>
                <p>No quotes yet. Create your first quote.</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    {['Customer', 'Pickup', 'Delivery', 'Vehicle', 'Amount', 'Status', 'Created'].map(h => (
                      <th key={h} style={{ padding: '1rem', textAlign: 'left', fontSize: '0.85rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((q, i) => {
                    const sc = STATUS_COLORS[q.status] ?? STATUS_COLORS.draft;
                    return (
                      <tr key={q.id} style={{ borderBottom: i < quotes.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                        <td style={{ padding: '1rem', fontWeight: '600', color: '#1f2937' }}>{q.customer_name || '—'}</td>
                        <td style={{ padding: '1rem', color: '#6b7280' }}>{q.pickup_location || '—'}</td>
                        <td style={{ padding: '1rem', color: '#6b7280' }}>{q.delivery_location || '—'}</td>
                        <td style={{ padding: '1rem', color: '#6b7280' }}>{q.vehicle_type?.replace(/_/g, ' ') || '—'}</td>
                        <td style={{ padding: '1rem', fontWeight: '700', color: '#1f2937' }}>{q.amount ? `£${q.amount.toFixed(2)}` : '—'}</td>
                        <td style={{ padding: '1rem' }}><span style={{ backgroundColor: sc.bg, color: sc.text, padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600' }}>{q.status}</span></td>
                        <td style={{ padding: '1rem', color: '#6b7280' }}>{new Date(q.created_at).toLocaleDateString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {showModal && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
            <div style={{ backgroundColor: 'white', borderRadius: '12px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflow: 'auto' }}>
              <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#1f2937' }}>New Quote</h2>
                <button onClick={() => { setShowModal(false); setError(''); }} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}>×</button>
              </div>
              <div style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
                {error && <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '0.75rem', color: '#dc2626', fontSize: '0.9rem' }}>{error}</div>}
                <div><label style={labelStyle}>Company ID *</label><input style={inputStyle} value={formData.company_id} onChange={e => setFormData({...formData, company_id: e.target.value})} placeholder="UUID of company" /></div>
                <div><label style={labelStyle}>Customer Name *</label><input style={inputStyle} value={formData.customer_name} onChange={e => setFormData({...formData, customer_name: e.target.value})} placeholder="John Smith" /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div><label style={labelStyle}>Email</label><input style={inputStyle} type="email" value={formData.customer_email} onChange={e => setFormData({...formData, customer_email: e.target.value})} placeholder="customer@email.com" /></div>
                  <div><label style={labelStyle}>Phone</label><input style={inputStyle} value={formData.customer_phone} onChange={e => setFormData({...formData, customer_phone: e.target.value})} placeholder="07123456789" /></div>
                </div>
                <div><label style={labelStyle}>Pickup Location</label><input style={inputStyle} value={formData.pickup_location} onChange={e => setFormData({...formData, pickup_location: e.target.value})} placeholder="London, SW1A 1AA" /></div>
                <div><label style={labelStyle}>Delivery Location</label><input style={inputStyle} value={formData.delivery_location} onChange={e => setFormData({...formData, delivery_location: e.target.value})} placeholder="Manchester, M1 1AE" /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={labelStyle}>Vehicle Type</label>
                    <select style={inputStyle} value={formData.vehicle_type} onChange={e => setFormData({...formData, vehicle_type: e.target.value as VehicleType})}>
                      {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Cargo Type</label>
                    <select style={inputStyle} value={formData.cargo_type} onChange={e => setFormData({...formData, cargo_type: e.target.value as CargoType})}>
                      {CARGO_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div><label style={labelStyle}>Amount (£)</label><input style={inputStyle} type="number" step="0.01" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} placeholder="250.00" /></div>
              </div>
              <div style={{ padding: '1.5rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button onClick={() => { setShowModal(false); setError(''); }} style={{ padding: '0.75rem 1.5rem', backgroundColor: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleCreate} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#1F7A3D', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Create Quote</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
