'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import type { Quote, VehicleType, CargoType } from '../../lib/types/database';

const VEHICLE_TYPES: VehicleType[] = ['bicycle', 'motorbike', 'car', 'van_small', 'van_large', 'luton', 'truck_7_5t', 'truck_18t', 'artic'];
const CARGO_TYPES: CargoType[] = ['documents', 'packages', 'pallets', 'furniture', 'equipment', 'other'];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft: { bg: '#f3f4f6', text: '#6b7280' },
  sent: { bg: '#e0f2fe', text: '#075985' },
  accepted: { bg: '#d1fae5', text: '#065f46' },
  declined: { bg: '#fee2e2', text: '#991b1b' },
};

export default function CustomerPage() {
  const { user, logout } = useAuth();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [formError, setFormError] = useState('');
  const [formData, setFormData] = useState({
    pickup_location: '',
    delivery_location: '',
    vehicle_type: 'van_large' as VehicleType,
    cargo_type: 'packages' as CargoType,
    customer_phone: '',
  });

  const loadQuotes = async () => {
    setLoading(true);
    if (!isSupabaseConfigured || !user?.email) { setLoading(false); return; }
    const { data, error } = await supabase
      .from('quotes')
      .select('*')
      .eq('customer_email', user.email)
      .order('created_at', { ascending: false });
    if (!error && data) setQuotes(data as Quote[]);
    setLoading(false);
  };

  useEffect(() => {
    if (user?.email) loadQuotes();
  }, [user?.email]);

  const handleRequestQuote = async () => {
    setFormError('');
    if (!formData.pickup_location.trim()) { setFormError('Pickup location is required'); return; }
    if (!formData.delivery_location.trim()) { setFormError('Delivery location is required'); return; }
    if (!isSupabaseConfigured || !user?.email) { setFormError('Service unavailable. Please try again later.'); return; }

    const { error } = await supabase.from('quotes').insert([{
      customer_name: user.email.split('@')[0],
      customer_email: user.email,
      customer_phone: formData.customer_phone || null,
      pickup_location: formData.pickup_location,
      delivery_location: formData.delivery_location,
      vehicle_type: formData.vehicle_type,
      cargo_type: formData.cargo_type,
      currency: 'GBP',
      status: 'draft',
    }]);

    if (error) { setFormError(error.message); return; }

    setShowModal(false);
    setFormData({ pickup_location: '', delivery_location: '', vehicle_type: 'van_large', cargo_type: 'packages', customer_phone: '' });
    setSubmitSuccess(true);
    setTimeout(() => setSubmitSuccess(false), 4000);
    loadQuotes();
  };

  const inputStyle = { width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.95rem', boxSizing: 'border-box' as const, backgroundColor: 'white' };
  const labelStyle = { display: 'block', fontSize: '0.9rem', fontWeight: '500' as const, color: '#374151', marginBottom: '0.5rem' };

  return (
    <ProtectedRoute allowedRoles={['customer']}>
      <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6' }}>
        {/* Header */}
        <header style={{ backgroundColor: '#0A2239', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ color: '#93c5fd', fontSize: '0.75rem', margin: 0 }}>Welcome back</p>
            <h1 style={{ color: '#ffffff', fontSize: '1.25rem', fontWeight: '700', margin: 0 }}>Customer Portal</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>{user?.email}</span>
            <button
              onClick={() => logout()}
              style={{ padding: '0.5rem 1rem', backgroundColor: 'transparent', color: '#cbd5e1', border: '1px solid #4b5563', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              Logout
            </button>
          </div>
        </header>

        <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem' }}>
          {submitSuccess && (
            <div style={{ backgroundColor: '#dcfce7', border: '1px solid #1F7A3D', borderRadius: '8px', padding: '1rem 1.5rem', marginBottom: '1.5rem', color: '#14532d', fontWeight: '600' }}>
              ✅ Your quote request has been submitted. We&apos;ll be in touch shortly.
            </div>
          )}

          {/* Action bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937', margin: 0 }}>My Quote Requests</h2>
              <p style={{ color: '#6b7280', margin: '0.25rem 0 0 0', fontSize: '0.9rem' }}>Track and manage your delivery quote requests</p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              style={{ padding: '0.75rem 1.5rem', backgroundColor: '#1F7A3D', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.95rem', fontWeight: '600', cursor: 'pointer' }}
            >
              + Request a Quote
            </button>
          </div>

          {/* Quote list */}
          <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>Loading…</div>
            ) : quotes.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📦</div>
                <p style={{ fontWeight: '600', marginBottom: '0.5rem' }}>No quote requests yet</p>
                <p style={{ fontSize: '0.9rem' }}>Click &quot;Request a Quote&quot; to get started with your first delivery.</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    {['Pickup', 'Delivery', 'Vehicle', 'Cargo', 'Amount', 'Status', 'Date'].map(h => (
                      <th key={h} style={{ padding: '1rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((q, i) => {
                    const sc = STATUS_COLORS[q.status] ?? STATUS_COLORS.draft;
                    return (
                      <tr key={q.id} style={{ borderBottom: i < quotes.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                        <td style={{ padding: '1rem', color: '#1f2937', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.pickup_location || '—'}</td>
                        <td style={{ padding: '1rem', color: '#1f2937', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.delivery_location || '—'}</td>
                        <td style={{ padding: '1rem', color: '#6b7280' }}>{q.vehicle_type?.replace(/_/g, ' ') || '—'}</td>
                        <td style={{ padding: '1rem', color: '#6b7280' }}>{q.cargo_type || '—'}</td>
                        <td style={{ padding: '1rem', fontWeight: '700', color: '#1f2937' }}>{q.amount ? `£${q.amount.toFixed(2)}` : '—'}</td>
                        <td style={{ padding: '1rem' }}><span style={{ backgroundColor: sc.bg, color: sc.text, padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600' }}>{q.status}</span></td>
                        <td style={{ padding: '1rem', color: '#6b7280', fontSize: '0.85rem' }}>{new Date(q.created_at).toLocaleDateString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </main>

        {/* New Quote Modal */}
        {showModal && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
            <div style={{ backgroundColor: 'white', borderRadius: '12px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflow: 'auto' }}>
              <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#1f2937' }}>Request a Quote</h2>
                <button onClick={() => { setShowModal(false); setFormError(''); }} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}>×</button>
              </div>
              <div style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
                {formError && <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '0.75rem', color: '#dc2626', fontSize: '0.9rem' }}>{formError}</div>}
                <div>
                  <label style={labelStyle}>Pickup Location *</label>
                  <input style={inputStyle} value={formData.pickup_location} onChange={e => setFormData({...formData, pickup_location: e.target.value})} placeholder="e.g. London, SW1A 1AA" />
                </div>
                <div>
                  <label style={labelStyle}>Delivery Location *</label>
                  <input style={inputStyle} value={formData.delivery_location} onChange={e => setFormData({...formData, delivery_location: e.target.value})} placeholder="e.g. Manchester, M1 1AE" />
                </div>
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
                <div>
                  <label style={labelStyle}>Phone (optional)</label>
                  <input style={inputStyle} type="tel" value={formData.customer_phone} onChange={e => setFormData({...formData, customer_phone: e.target.value})} placeholder="07123 456789" />
                </div>
              </div>
              <div style={{ padding: '1.5rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button onClick={() => { setShowModal(false); setFormError(''); }} style={{ padding: '0.75rem 1.5rem', backgroundColor: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleRequestQuote} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#1F7A3D', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Submit Request</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
