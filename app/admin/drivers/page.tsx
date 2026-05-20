'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import type { Driver, Company } from '../../../lib/types/database';
import { useAuth } from '../../components/AuthContext';

export default function DriversPage() {
  const { user, hasSupabaseSession } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [companies, setCompanies] = useState<Pick<Company, 'id' | 'name'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ display_name: '', phone: '', email: '', company_id: '' });
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{
    displayName: string;
    email: string;
    temporaryPassword: string;
    sequenceNumber: number;
  } | null>(null);
  const [copyStatus, setCopyStatus] = useState('');

  const loadCompanyId = async (userId: string) => {
    const { data } = await supabase.rpc('get_or_create_company_for_user');
    if (data) {
      setCompanyId(data as string);
      return;
    }
    const { data: membership } = await supabase
      .from('company_memberships')
      .select('company_id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();
    setCompanyId((membership?.company_id as string) ?? null);
  };

  const loadDrivers = async () => {
    setLoading(true);
    if (!isSupabaseConfigured || !companyId) { setLoading(false); return; }
    const { data, error } = await supabase
      .from('drivers')
      .select('id, company_id, user_id, display_name, phone, email, status, app_access, temporary_password_seq, must_change_password, temp_password_generated_at, last_app_login, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (!error && data) setDrivers(data as Driver[]);
    setLoading(false);
  };

  const loadCompanies = async () => {
    if (!isSupabaseConfigured || !companyId) return;
    const { data, error } = await supabase
      .from('companies')
      .select('id, name')
      .eq('id', companyId)
      .order('name');
    if (error) { console.error('Failed to load companies:', error.message); return; }
    if (data) setCompanies(data as Pick<Company, 'id' | 'name'>[]);
  };

  useEffect(() => {
    if (hasSupabaseSession && user?.id) {
      loadCompanyId(user.id);
    }
  }, [hasSupabaseSession, user?.id]);

  useEffect(() => {
    if (!companyId) return;
    setFormData((prev) => ({ ...prev, company_id: companyId }));
    loadDrivers();
    loadCompanies();
  }, [companyId]);

  const handleCreate = async () => {
    if (!formData.display_name.trim()) { setError('Driver name is required'); return; }
    if (!formData.email.trim()) { setError('Driver email is required'); return; }
    if (!companyId) { setError('Company profile is required'); return; }
    if (!isSupabaseConfigured) { setError('Supabase is not configured'); return; }
    setCreating(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        setError('Session not found. Please sign in again.');
        return;
      }

      const response = await fetch('/api/admin/drivers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          companyId,
          displayName: formData.display_name,
          email: formData.email,
          phone: formData.phone || null,
        }),
      });

      const payload = await response.json().catch(() => ({} as { error?: string; temporaryPassword?: string; sequenceNumber?: number }));
      if (!response.ok) {
        setError(payload.error || 'Failed to create driver account.');
        return;
      }

      setCreatedCredentials({
        displayName: formData.display_name.trim(),
        email: formData.email.trim().toLowerCase(),
        temporaryPassword: payload.temporaryPassword || '',
        sequenceNumber: Number(payload.sequenceNumber) || 0,
      });
      setCopyStatus('');
      setFormData({ display_name: '', phone: '', email: '', company_id: companyId });
      setError('');
      loadDrivers();
    } finally {
      setCreating(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setError('');
    setCopyStatus('');
    setCreatedCredentials(null);
  };

  const copyTemporaryPassword = async () => {
    if (!createdCredentials?.temporaryPassword) return;
    try {
      await navigator.clipboard.writeText(createdCredentials.temporaryPassword);
      setCopyStatus('Temporary password copied.');
    } catch {
      setCopyStatus('Could not copy automatically. Please copy manually.');
    }
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
            <button onClick={() => { setCreatedCredentials(null); setCopyStatus(''); setError(''); setShowModal(true); }} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#1F7A3D', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.95rem', fontWeight: '600', cursor: 'pointer' }}>
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
                <button onClick={closeModal} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}>×</button>
              </div>
              {createdCredentials ? (
                <>
                  <div style={{ padding: '1.5rem', display: 'grid', gap: '0.8rem' }}>
                    <div style={{ backgroundColor: '#ecfdf3', border: '1px solid #86efac', borderRadius: '8px', padding: '0.9rem', color: '#166534', fontSize: '0.9rem' }}>
                      Driver account created. Copy this temporary password now — it will not be shown again.
                    </div>
                    <div style={{ fontSize: '0.88rem', color: '#334155' }}>
                      <strong>Driver:</strong> {createdCredentials.displayName}
                      <br />
                      <strong>Email:</strong> {createdCredentials.email}
                      <br />
                      <strong>Sequence:</strong> #{String(createdCredentials.sequenceNumber).padStart(3, '0')}
                    </div>
                    <div style={{ backgroundColor: '#0f172a', color: '#f8fafc', borderRadius: '8px', padding: '0.9rem', fontFamily: 'monospace', fontSize: '1rem', fontWeight: 700 }}>
                      {createdCredentials.temporaryPassword}
                    </div>
                    {copyStatus && <div style={{ color: '#0f766e', fontSize: '0.85rem' }}>{copyStatus}</div>}
                  </div>
                  <div style={{ padding: '1.5rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                    <button onClick={copyTemporaryPassword} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#0ea5e9', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Copy Password</button>
                    <button onClick={closeModal} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#1F7A3D', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Done</button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
                    {error && <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '0.75rem', color: '#dc2626', fontSize: '0.9rem' }}>{error}</div>}
                    <div><label style={labelStyle}>Full Name *</label><input style={inputStyle} value={formData.display_name} onChange={e => setFormData({...formData, display_name: e.target.value})} placeholder="John Smith" /></div>
                    <div>
                      <label style={labelStyle}>Company *</label>
                      <select style={inputStyle} value={formData.company_id} onChange={e => setFormData({...formData, company_id: e.target.value})}>
                        <option value="">Select a company…</option>
                        {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div><label style={labelStyle}>Email *</label><input style={inputStyle} type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="driver@email.com" /></div>
                    <div><label style={labelStyle}>Phone</label><input style={inputStyle} value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="07123456789" /></div>
                  </div>
                  <div style={{ padding: '1.5rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                    <button onClick={closeModal} disabled={creating} style={{ padding: '0.75rem 1.5rem', backgroundColor: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', cursor: creating ? 'not-allowed' : 'pointer' }}>Cancel</button>
                    <button onClick={handleCreate} disabled={creating} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#1F7A3D', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: creating ? 'not-allowed' : 'pointer' }}>{creating ? 'Creating...' : 'Add Driver'}</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
