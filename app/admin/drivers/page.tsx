'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import type { Driver, Company } from '../../../lib/types/database';
import { useAuth } from '../../components/AuthContext';
import { getMissingColumnFromError } from '../../../lib/supabaseSchemaCompat';
import { logRuntimeProof } from '../../../lib/runtimeProof';

const DRIVER_SELECT_COLUMNS = [
  'id',
  'company_id',
  'user_id',
  'display_name',
  'phone',
  'email',
  'status',
  'app_access',
  'temporary_password_seq',
  'must_change_password',
  'temp_password_generated_at',
  'last_app_login',
  'created_at',
];

export default function DriversPage() {
  const { user, hasSupabaseSession } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyResolved, setCompanyResolved] = useState(false);
  const [companyError, setCompanyError] = useState('');
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [companies, setCompanies] = useState<Pick<Company, 'id' | 'name'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [formData, setFormData] = useState({ display_name: '', phone: '', email: '' });
  const [editData, setEditData] = useState({ display_name: '', phone: '', status: 'active', app_access: true });
  const [error, setError] = useState('');
  const [editError, setEditError] = useState('');
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{
    displayName: string;
    email: string;
    invited: boolean;
  } | null>(null);

  const loadDrivers = async (resolvedCompanyId: string) => {
    setLoading(true);
    if (!isSupabaseConfigured) { setLoading(false); return; }

    const activeColumns = [...DRIVER_SELECT_COLUMNS];
    let data: Driver[] | null = null;
    let queryError: { message?: string | null } | null = null;
    let orderByCreatedAt = true;

    while (activeColumns.length > 0) {
      let query = supabase
        .from('drivers')
        .select(activeColumns.join(', '))
        .eq('company_id', resolvedCompanyId);

      if (orderByCreatedAt) {
        query = query.order('created_at', { ascending: false });
      }

      const result = await query;

      if (!result.error) {
        data = (result.data ?? []) as unknown as Driver[];
        queryError = null;
        break;
      }

      const missingColumn = getMissingColumnFromError(result.error, 'drivers');
      if (missingColumn === 'created_at' && orderByCreatedAt) {
        orderByCreatedAt = false;
        queryError = result.error;
        continue;
      }
      if (missingColumn && activeColumns.includes(missingColumn)) {
        activeColumns.splice(activeColumns.indexOf(missingColumn), 1);
        queryError = result.error;
        continue;
      }

      queryError = result.error;
      break;
    }

    if (queryError) {
      console.error('Failed to load drivers:', queryError.message);
    } else if (data) {
      setDrivers(data);
    }
    setLoading(false);
  };

  const loadCompanies = async (resolvedCompanyId: string) => {
    if (!isSupabaseConfigured) return;

    const requestedColumns = ['id', 'name'];
    const activeColumns = [...requestedColumns];
    let rows: Array<Record<string, unknown>> = [];
    let queryError: { message?: string | null } | null = null;

    while (activeColumns.length > 0) {
      const companiesRes = await supabase
        .from('companies')
        .select(activeColumns.join(', '))
        .eq('id', resolvedCompanyId)
        .order('name');
      if (!companiesRes.error) {
        rows = ((companiesRes.data ?? []) as unknown) as Array<Record<string, unknown>>;
        queryError = null;
        break;
      }
      const missingColumn = getMissingColumnFromError(companiesRes.error, 'companies');
      if (missingColumn && activeColumns.includes(missingColumn)) {
        activeColumns.splice(activeColumns.indexOf(missingColumn), 1);
        queryError = companiesRes.error;
        continue;
      }
      queryError = companiesRes.error;
      break;
    }

    if (queryError) {
      console.error('Failed to load companies:', queryError.message);
      return;
    }

    const normalizedCompanies = rows
      .map((row) => {
        const id = row.id as string | undefined;
        if (!id) return null;
        const name = (row.name as string | null | undefined)?.trim();
        return { id, name: name && name.length > 0 ? name : `Company ${id.slice(0, 8)}` };
      })
      .filter((company): company is Pick<Company, 'id' | 'name'> => Boolean(company));

    setCompanies(normalizedCompanies);
  };

  useEffect(() => {
    if (!hasSupabaseSession || !user?.id) {
      setCompanyId(null);
      setCompanyResolved(false);
      setCompanyError('');
      setDrivers([]);
      setCompanies([]);
      setLoading(true);
      return;
    }

    setCompanyError('');
    if (user.companyId) {
      setCompanyId(user.companyId);
      setCompanyResolved(true);
      return;
    }

    setCompanyId(null);
    setCompanyResolved(true);
    setCompanyError('Company profile not available. Drivers are hidden until company access resolves.');
  }, [hasSupabaseSession, user?.id, user?.companyId]);

  useEffect(() => {
    if (!companyResolved) return;
    if (!companyId) {
      setDrivers([]);
      setCompanies([]);
      setLoading(false);
      return;
    }
    void Promise.all([loadDrivers(companyId), loadCompanies(companyId)]);
  }, [companyResolved, companyId]);

  const getAccessToken = async (): Promise<{ accessToken: string | null; error: string | null }> => {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) return { accessToken: null, error: sessionError.message };
    if (sessionData.session?.access_token) return { accessToken: sessionData.session.access_token, error: null };
    return { accessToken: null, error: 'Session expired. Please sign in again.' };
  };

  const createDriverWithToken = async (
    accessToken: string,
    payload: {
      companyId: string;
      membershipId: string | null;
      displayName: string;
      email: string;
      phone: string | null;
    }
  ) => fetch('/api/admin/drivers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + accessToken,
    },
    body: JSON.stringify(payload),
  });

  const handleCreate = async () => {
    if (!formData.display_name.trim()) { setError('Driver name is required'); return; }
    if (!formData.email.trim()) { setError('Driver email is required'); return; }
    if (!companyId) { setError('Company profile is required'); return; }
    if (!user?.membershipId) { setError('Membership context is required. Please sign in again.'); return; }
    if (!isSupabaseConfigured) { setError('Supabase is not configured'); return; }
    setCreating(true);
    try {
      const { accessToken, error: accessTokenError } = await getAccessToken();
      if (accessTokenError || !accessToken) {
        setError(accessTokenError ?? 'Session expired. Please sign in again.');
        return;
      }

      const requestPayload = {
        companyId,
        membershipId: user.membershipId,
        displayName: formData.display_name,
        email: formData.email,
        phone: formData.phone || null,
      };
      logRuntimeProof({
        flow: 'Add Driver',
        authUid: user?.id ?? null,
        membershipId: user.membershipId,
        companyId,
        payload: requestPayload,
        table: 'drivers',
        rlsPolicy: 'drivers_insert_operator',
      });

      const response = await createDriverWithToken(accessToken, requestPayload);

      const payload = await response.json().catch(() => ({} as { error?: string; invited?: boolean }));
      if (!response.ok) {
        setError(
          response.status === 401
            ? (payload.error || 'Authentication failed. Please sign out and sign in again.')
            : response.status === 403
            ? (payload.error || 'You do not have permission to create drivers.')
            : (payload.error || 'Failed to create driver account.')
        );
        return;
      }

      setCreatedCredentials({
        displayName: formData.display_name.trim(),
        email: formData.email.trim().toLowerCase(),
        invited: Boolean(payload.invited),
      });
      setFormData({ display_name: '', phone: '', email: '' });
      setError('');
      await loadDrivers(companyId);
    } finally {
      setCreating(false);
    }
  };

  const openEditModal = (driver: Driver) => {
    setEditingDriver(driver);
    setEditData({
      display_name: driver.display_name,
      phone: driver.phone ?? '',
      status: driver.status,
      app_access: driver.app_access ?? false,
    });
    setEditError('');
  };

  const handleUpdate = async () => {
    if (!editingDriver || !companyId || !isSupabaseConfigured) return;
    if (!editData.display_name.trim()) { setEditError('Name is required'); return; }
    setSaving(true);
    const { error } = await supabase
      .from('drivers')
      .update({
        display_name: editData.display_name.trim(),
        phone: editData.phone.trim() || null,
        status: editData.status,
        app_access: editData.app_access,
      })
      .eq('id', editingDriver.id)
      .eq('company_id', companyId);
    setSaving(false);
    if (error) { setEditError(error.message); return; }
    setEditingDriver(null);
    await loadDrivers(companyId);
  };

  const handleToggleStatus = async (driver: Driver) => {
    if (!companyId || !isSupabaseConfigured) return;
    const newStatus = driver.status === 'active' ? 'inactive' : 'active';
    await supabase
      .from('drivers')
      .update({ status: newStatus })
      .eq('id', driver.id)
      .eq('company_id', companyId);
    await loadDrivers(companyId);
  };

  const closeModal = () => {
    setShowModal(false);
    setError('');
    setCreatedCredentials(null);
  };

  const inputStyle = { width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.95rem', boxSizing: 'border-box' as const };
  const labelStyle = { display: 'block', fontSize: '0.9rem', fontWeight: '500' as const, color: '#374151', marginBottom: '0.5rem' };
  const statusColor = (s: string) => s === 'active' ? '#1F7A3D' : '#ef4444';
  const formatDate = (value: string | null | undefined) => {
    if (!value) return '—';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString();
  };

  return (
    <ProtectedRoute>
      <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', padding: '2rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <div>
              <h1 style={{ fontSize: '2rem', fontWeight: '700', color: '#1f2937', margin: 0 }}>Drivers</h1>
              <p style={{ color: '#6b7280', margin: '0.5rem 0 0 0' }}>Manage drivers for your company</p>
            </div>
            <button
              onClick={() => { setCreatedCredentials(null); setError(''); setShowModal(true); }}
              disabled={!companyResolved || !companyId}
              style={{ padding: '0.75rem 1.5rem', backgroundColor: !companyResolved || !companyId ? '#9ca3af' : '#1F7A3D', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.95rem', fontWeight: '600', cursor: !companyResolved || !companyId ? 'not-allowed' : 'pointer' }}
            >
              + Add Driver
            </button>
          </div>

          {companyError && (
            <div style={{ backgroundColor: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', color: '#92400e' }}>
              {companyError}
            </div>
          )}

          {!isSupabaseConfigured && (
            <div style={{ backgroundColor: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', color: '#92400e' }}>
              ⚠️ Supabase is not configured. Database features are disabled.
            </div>
          )}

          <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            {!companyResolved || loading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>Loading...</div>
            ) : !companyId ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
                <p>Company profile not available. Drivers are hidden until company access resolves.</p>
              </div>
            ) : drivers.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚚</div>
                <p>No drivers yet. Add your first driver.</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    {['Name', 'Email', 'Phone', 'Status', 'App Access', 'Created', 'Actions'].map(h => (
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
                      <td style={{ padding: '1rem' }}>
                        <span style={{ backgroundColor: d.status === 'active' ? '#d1fae5' : '#fee2e2', color: statusColor(d.status), padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600' }}>{d.status}</span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ color: d.app_access ? '#1F7A3D' : '#9ca3af', fontWeight: '600', fontSize: '0.875rem' }}>{d.app_access ? '✓ Yes' : '✗ No'}</span>
                      </td>
                      <td style={{ padding: '1rem', color: '#6b7280' }}>{formatDate(d.created_at)}</td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            onClick={() => openEditModal(d)}
                            style={{ padding: '0.35rem 0.75rem', backgroundColor: '#e0f2fe', color: '#075985', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleToggleStatus(d)}
                            style={{ padding: '0.35rem 0.75rem', backgroundColor: d.status === 'active' ? '#fee2e2' : '#d1fae5', color: d.status === 'active' ? '#991b1b' : '#065f46', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}
                          >
                            {d.status === 'active' ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Create Driver Modal */}
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
                      Driver invited successfully. A password setup email was sent.
                    </div>
                    <div style={{ fontSize: '0.88rem', color: '#334155' }}>
                      <strong>Driver:</strong> {createdCredentials.displayName}
                      <br />
                      <strong>Email:</strong> {createdCredentials.email}
                    </div>
                  </div>
                  <div style={{ padding: '1.5rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                    <button onClick={closeModal} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#1F7A3D', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Done</button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
                    {error && <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '0.75rem', color: '#dc2626', fontSize: '0.9rem' }}>{error}</div>}
                    <div><label style={labelStyle}>Full Name *</label><input style={inputStyle} value={formData.display_name} onChange={e => setFormData({...formData, display_name: e.target.value})} placeholder="John Smith" /></div>
                    <div>
                      <label style={labelStyle}>Company</label>
                      <input
                        style={{ ...inputStyle, backgroundColor: '#f9fafb', color: '#6b7280' }}
                        value={companies[0]?.name ?? 'Company linked to your account'}
                        disabled
                        readOnly
                      />
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

        {/* Edit Driver Modal */}
        {editingDriver && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ backgroundColor: 'white', borderRadius: '12px', width: '90%', maxWidth: '480px' }}>
              <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#1f2937' }}>Edit Driver</h2>
                <button onClick={() => setEditingDriver(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}>×</button>
              </div>
              <div style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
                {editError && <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '0.75rem', color: '#dc2626', fontSize: '0.9rem' }}>{editError}</div>}
                <div><label style={labelStyle}>Full Name *</label><input style={inputStyle} value={editData.display_name} onChange={e => setEditData({...editData, display_name: e.target.value})} /></div>
                <div><label style={labelStyle}>Phone</label><input style={inputStyle} value={editData.phone} onChange={e => setEditData({...editData, phone: e.target.value})} /></div>
                <div>
                  <label style={labelStyle}>Status</label>
                  <select style={inputStyle} value={editData.status} onChange={e => setEditData({...editData, status: e.target.value})}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <input
                    type="checkbox"
                    id="app_access"
                    checked={editData.app_access}
                    onChange={e => setEditData({...editData, app_access: e.target.checked})}
                    style={{ width: '1.1rem', height: '1.1rem', cursor: 'pointer' }}
                  />
                  <label htmlFor="app_access" style={{ fontSize: '0.9rem', fontWeight: '500', color: '#374151', cursor: 'pointer' }}>App Access (driver can log in to driver portal)</label>
                </div>
              </div>
              <div style={{ padding: '1.5rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button onClick={() => setEditingDriver(null)} disabled={saving} style={{ padding: '0.75rem 1.5rem', backgroundColor: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', cursor: saving ? 'not-allowed' : 'pointer' }}>Cancel</button>
                <button onClick={handleUpdate} disabled={saving} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#1F7A3D', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
