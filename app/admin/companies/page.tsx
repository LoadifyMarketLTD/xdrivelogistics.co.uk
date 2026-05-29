'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import type { Company } from '../../../lib/types/database';
import { useAuth } from '../../components/AuthContext';
import { getMissingColumnFromError } from '../../../lib/supabaseSchemaCompat';
import { logRuntimeProof } from '../../../lib/runtimeProof';

export default function CompaniesPage() {
  const { user, hasSupabaseSession } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [formData, setFormData] = useState({
    name: '', company_number: '', vat_number: '', email: '', phone: '',
    address_line1: '', city: '', postcode: '',
  });
  const [editData, setEditData] = useState({
    name: '', company_number: '', vat_number: '', email: '', phone: '',
    address_line1: '', city: '', postcode: '',
  });
  const [error, setError] = useState('');
  const [editError, setEditError] = useState('');
  const [switchError, setSwitchError] = useState('');
  const [saving, setSaving] = useState(false);

  const loadCompanies = async () => {
    setLoading(true);
    if (!isSupabaseConfigured || !companyId) { setLoading(false); return; }
    const companyIds = [companyId];

    const requestedColumns = ['id', 'name', 'company_number', 'vat_number', 'email', 'phone', 'address_line1', 'city', 'postcode', 'created_at'];
    const activeColumns = [...requestedColumns];
    const missingColumns = new Set<string>();
    let rows: Array<Record<string, unknown>> = [];
    let companyError: { message?: string | null } | null = null;

    while (activeColumns.length > 0) {
      const companyRes = await supabase
        .from('companies')
        .select(activeColumns.join(', '))
        .in('id', companyIds)
        .order('created_at', { ascending: false });
      if (!companyRes.error) {
        rows = ((companyRes.data ?? []) as unknown) as Array<Record<string, unknown>>;
        companyError = null;
        break;
      }

      const missingColumn = getMissingColumnFromError(companyRes.error, 'companies');
      if (missingColumn && activeColumns.includes(missingColumn)) {
        missingColumns.add(missingColumn);
        activeColumns.splice(activeColumns.indexOf(missingColumn), 1);
        companyError = companyRes.error;
        continue;
      }

      companyError = companyRes.error;
      break;
    }

    if (!companyError) {
      setCompanies(rows.map((row) => ({
        ...row,
        email: missingColumns.has('email') ? null : (row.email as string | null | undefined) ?? null,
        phone: missingColumns.has('phone') ? null : (row.phone as string | null | undefined) ?? null,
      })) as Company[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!hasSupabaseSession || !user?.id) {
      setCompanyId(null);
      return;
    }
    setCompanyId(user.companyId ?? null);
  }, [hasSupabaseSession, user?.id, user?.companyId]);

  useEffect(() => {
    if (!companyId) return;
    loadCompanies();
  }, [companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async () => {
    if (!formData.name.trim()) { setError('Company name is required'); return; }
    if (!isSupabaseConfigured) { setError('Supabase is not configured'); return; }
    if (!user?.id) { setError('Session expired. Please sign in again.'); return; }
    const payload: Record<string, string> = { ...formData, created_by: user.id };
    logRuntimeProof({
      flow: 'Create Company',
      authUid: user.id,
      membershipId: user.membershipId,
      companyId: user.companyId ?? null,
      payload,
      table: 'companies',
      rlsPolicy: 'companies_insert_authenticated',
    });
    const insertRes = await supabase.from('companies').insert([payload]).select('id').single();
    const createdCompanyId: string | null = insertRes.error
      ? null
      : ((insertRes.data?.id as string | undefined) ?? null);
    if (insertRes.error) { setError(insertRes.error.message ?? 'Failed to create company.'); return; }
    if (!createdCompanyId) { setError('Failed to resolve newly created company.'); return; }

    const { error: membershipError } = await supabase
      .from('company_memberships')
      .upsert(
        {
          company_id: createdCompanyId,
          user_id: user.id,
          role_in_company: 'owner',
          status: 'active',
        },
        { onConflict: 'company_id,user_id' }
      );
    logRuntimeProof({
      flow: 'Create Company',
      authUid: user.id,
      membershipId: user.membershipId,
      companyId: createdCompanyId,
      payload: {
        company_id: createdCompanyId,
        user_id: user.id,
        role_in_company: 'owner',
        status: 'active',
      },
      table: 'company_memberships',
      rlsPolicy: 'memberships_insert_admin',
    });
    if (membershipError) { setError(membershipError.message ?? 'Failed to attach owner membership.'); return; }

    setCompanyId(createdCompanyId);
    setShowModal(false);
    setFormData({ name: '', company_number: '', vat_number: '', email: '', phone: '', address_line1: '', city: '', postcode: '' });
    setError('');
    loadCompanies();
  };

  const handleSwitchCompany = async (nextCompanyId: string) => {
    if (!isSupabaseConfigured || !user?.id) return;
    setSwitchError('');
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ company_id: nextCompanyId })
      .eq('user_id', user.id);
    if (updateError) {
      setSwitchError(updateError.message);
      return;
    }
    setCompanyId(nextCompanyId);
    loadCompanies();
  };

  const openEditModal = (company: Company) => {
    setEditingCompany(company);
    setEditData({
      name: company.name ?? '',
      company_number: company.company_number ?? '',
      vat_number: company.vat_number ?? '',
      email: company.email ?? '',
      phone: company.phone ?? '',
      address_line1: company.address_line1 ?? '',
      city: company.city ?? '',
      postcode: company.postcode ?? '',
    });
    setEditError('');
  };

  const handleUpdate = async () => {
    if (!editingCompany || !isSupabaseConfigured) return;
    if (!editData.name.trim()) { setEditError('Company name is required'); return; }
    setSaving(true);
    const updatePayload: Record<string, string | null> = {
      name: editData.name.trim(),
      company_number: editData.company_number.trim() || null,
      vat_number: editData.vat_number.trim() || null,
      email: editData.email.trim() || null,
      phone: editData.phone.trim() || null,
      address_line1: editData.address_line1.trim() || null,
      city: editData.city.trim() || null,
      postcode: editData.postcode.trim() || null,
    };
    let error: { message?: string | null } | null = null;
    const updateRes = await supabase
      .from('companies')
      .update(updatePayload)
      .eq('id', editingCompany.id);
    if (updateRes.error) { error = updateRes.error; }
    setSaving(false);
    if (error) { setEditError(error.message ?? 'Failed to update company.'); return; }
    setEditingCompany(null);
    loadCompanies();
  };

  const inputStyle = {
    width: '100%', padding: '0.75rem', border: '1px solid #d1d5db',
    borderRadius: '6px', fontSize: '0.95rem', boxSizing: 'border-box' as const,
  };
  const labelStyle = { display: 'block', fontSize: '0.9rem', fontWeight: '500' as const, color: '#374151', marginBottom: '0.5rem' };

  return (
    <ProtectedRoute>
      <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', padding: '2rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <div>
              <h1 style={{ fontSize: '2rem', fontWeight: '700', color: '#1f2937', margin: 0 }}>Companies</h1>
              <p style={{ color: '#6b7280', margin: '0.5rem 0 0 0' }}>Manage companies and memberships</p>
              {companies.length > 1 && (
                <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <label htmlFor="active-company" style={{ fontSize: '0.85rem', color: '#374151', fontWeight: '600' }}>Active company</label>
                  <select
                    id="active-company"
                    value={companyId ?? ''}
                    onChange={(e) => handleSwitchCompany(e.target.value)}
                    style={{ padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.85rem' }}
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {switchError && <p style={{ color: '#dc2626', margin: '0.5rem 0 0 0', fontSize: '0.85rem' }}>{switchError}</p>}
            </div>
            <button onClick={() => setShowModal(true)} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#1F7A3D', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.95rem', fontWeight: '600', cursor: 'pointer' }}>
              + Create Company
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
            ) : companies.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏢</div>
                <p>No companies yet. Create your first company.</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    {['Name', 'Company No.', 'Email', 'Phone', 'City', 'Created', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '1rem', textAlign: 'left', fontSize: '0.85rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {companies.map((c, i) => (
                    <tr key={c.id} style={{ borderBottom: i < companies.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                      <td style={{ padding: '1rem', fontWeight: '600', color: '#1f2937' }}>{c.name}</td>
                      <td style={{ padding: '1rem', color: '#6b7280' }}>{c.company_number || '—'}</td>
                      <td style={{ padding: '1rem', color: '#6b7280' }}>{c.email || '—'}</td>
                      <td style={{ padding: '1rem', color: '#6b7280' }}>{c.phone || '—'}</td>
                      <td style={{ padding: '1rem', color: '#6b7280' }}>{c.city || '—'}</td>
                      <td style={{ padding: '1rem', color: '#6b7280' }}>{new Date(c.created_at).toLocaleDateString()}</td>
                      <td style={{ padding: '1rem' }}>
                        <button
                          onClick={() => openEditModal(c)}
                          style={{ padding: '0.35rem 0.75rem', backgroundColor: '#e0f2fe', color: '#075985', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Create Modal */}
        {showModal && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ backgroundColor: 'white', borderRadius: '12px', width: '90%', maxWidth: '600px', maxHeight: '90vh', overflow: 'auto' }}>
              <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#1f2937' }}>Create Company</h2>
                <button onClick={() => { setShowModal(false); setError(''); }} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}>×</button>
              </div>
              <div style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
                {error && <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '0.75rem', color: '#dc2626', fontSize: '0.9rem' }}>{error}</div>}
                <div><label style={labelStyle}>Company Name *</label><input style={inputStyle} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Acme Ltd" /></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                  <div><label style={labelStyle}>Company Number</label><input style={inputStyle} value={formData.company_number} onChange={e => setFormData({...formData, company_number: e.target.value})} placeholder="12345678" /></div>
                  <div><label style={labelStyle}>VAT Number</label><input style={inputStyle} value={formData.vat_number} onChange={e => setFormData({...formData, vat_number: e.target.value})} placeholder="GB123456789" /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                  <div><label style={labelStyle}>Email</label><input style={inputStyle} type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="info@company.com" /></div>
                  <div><label style={labelStyle}>Phone</label><input style={inputStyle} value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="07123456789" /></div>
                </div>
                <div><label style={labelStyle}>Address</label><input style={inputStyle} value={formData.address_line1} onChange={e => setFormData({...formData, address_line1: e.target.value})} placeholder="123 High Street" /></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                  <div><label style={labelStyle}>City</label><input style={inputStyle} value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} placeholder="London" /></div>
                  <div><label style={labelStyle}>Postcode</label><input style={inputStyle} value={formData.postcode} onChange={e => setFormData({...formData, postcode: e.target.value})} placeholder="SW1A 1AA" /></div>
                </div>
              </div>
              <div style={{ padding: '1.5rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button onClick={() => { setShowModal(false); setError(''); }} style={{ padding: '0.75rem 1.5rem', backgroundColor: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.95rem', cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleCreate} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#1F7A3D', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.95rem', fontWeight: '600', cursor: 'pointer' }}>Create Company</button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {editingCompany && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ backgroundColor: 'white', borderRadius: '12px', width: '90%', maxWidth: '600px', maxHeight: '90vh', overflow: 'auto' }}>
              <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#1f2937' }}>Edit Company</h2>
                <button onClick={() => setEditingCompany(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}>×</button>
              </div>
              <div style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
                {editError && <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '0.75rem', color: '#dc2626', fontSize: '0.9rem' }}>{editError}</div>}
                <div><label style={labelStyle}>Company Name *</label><input style={inputStyle} value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                  <div><label style={labelStyle}>Company Number</label><input style={inputStyle} value={editData.company_number} onChange={e => setEditData({...editData, company_number: e.target.value})} /></div>
                  <div><label style={labelStyle}>VAT Number</label><input style={inputStyle} value={editData.vat_number} onChange={e => setEditData({...editData, vat_number: e.target.value})} /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div><label style={labelStyle}>Email</label><input style={inputStyle} type="email" value={editData.email} onChange={e => setEditData({...editData, email: e.target.value})} /></div>
                  <div><label style={labelStyle}>Phone</label><input style={inputStyle} value={editData.phone} onChange={e => setEditData({...editData, phone: e.target.value})} /></div>
                </div>
                <div><label style={labelStyle}>Address</label><input style={inputStyle} value={editData.address_line1} onChange={e => setEditData({...editData, address_line1: e.target.value})} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div><label style={labelStyle}>City</label><input style={inputStyle} value={editData.city} onChange={e => setEditData({...editData, city: e.target.value})} /></div>
                  <div><label style={labelStyle}>Postcode</label><input style={inputStyle} value={editData.postcode} onChange={e => setEditData({...editData, postcode: e.target.value})} /></div>
                </div>
              </div>
              <div style={{ padding: '1.5rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button onClick={() => setEditingCompany(null)} disabled={saving} style={{ padding: '0.75rem 1.5rem', backgroundColor: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.95rem', cursor: saving ? 'not-allowed' : 'pointer' }}>Cancel</button>
                <button onClick={handleUpdate} disabled={saving} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#1F7A3D', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.95rem', fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
