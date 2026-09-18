'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import type { Company } from '../../../lib/types/database';
import { useAuth } from '../../components/AuthContext';
import { selectWithMissingColumnFallback } from '../../../lib/supabaseSchemaCompat';
import { registerValidatedCompany } from '../../actions/companies';
import { getAccessToken } from '../_lib/getAccessToken';

export default function CompaniesPage() {
  const { user, hasSupabaseSession } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [formData, setFormData] = useState({ company_number: '' });
  const [editData, setEditData] = useState({
    name: '', company_number: '', vat_number: '', email: '', phone: '',
    address_line1: '', city: '', postcode: '',
  });
  const [error, setError] = useState('');
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);
  const [registering, setRegistering] = useState(false);
  const COMPANIES_PER_PAGE = 12;
  const [companyPage, setCompanyPage] = useState(0);

  const loadCompanies = async () => {
    setLoading(true);
    if (!isSupabaseConfigured || !companyId) { setLoading(false); return; }
    const companyIds = [companyId];

    const { rows, missingColumns, error: companyError } = await selectWithMissingColumnFallback<Record<string, unknown>>({
      table: 'companies',
      columns: ['id', 'name', 'company_number', 'vat_number', 'email', 'phone', 'address_line1', 'city', 'postcode', 'created_at'],
      execute: async (activeColumns) => {
        const companyRes = await supabase
          .from('companies')
          .select(activeColumns.join(', '))
          .in('id', companyIds)
          .order('created_at', { ascending: false });
        return {
          data: ((companyRes.data ?? []) as unknown) as Array<Record<string, unknown>>,
          error: companyRes.error,
        };
      },
    });

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
  useEffect(() => {
    setCompanyPage(0);
  }, [companies.length]);

  const handleCreate = async () => {
    if (!formData.company_number.trim()) { setError('Companies House number is required.'); return; }
    if (!isSupabaseConfigured) { setError('Supabase is not configured'); return; }
    if (!user?.id) { setError('Session expired. Please sign in again.'); return; }

    setRegistering(true);
    setError('');
    try {
      const { accessToken, error: accessTokenError } = await getAccessToken();
      if (accessTokenError || !accessToken) {
        setError(accessTokenError ?? 'Session expired. Please sign in again.');
        return;
      }

      const result = await registerValidatedCompany(formData.company_number, accessToken);
      if (!result.success || !result.companyId) {
        setError(result.error ?? 'Verified company registration failed.');
        return;
      }

      setCompanyId(result.companyId);
      setShowModal(false);
      setFormData({ company_number: '' });
      setError('');
    } finally {
      setRegistering(false);
    }
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
      vat_number: editData.vat_number.trim() || null,
      email: editData.email.trim() || null,
      phone: editData.phone.trim() || null,
      address_line1: editData.address_line1.trim() || null,
      city: editData.city.trim() || null,
      postcode: editData.postcode.trim() || null,
    };
    const { accessToken, error: tokenError } = await getAccessToken();
    if (tokenError || !accessToken) {
      setSaving(false);
      setEditError(tokenError ?? 'Session expired. Please sign in again.');
      return;
    }
    const response = await fetch(`/api/admin/companies/${encodeURIComponent(editingCompany.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(updatePayload),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    setSaving(false);
    if (!response.ok) { setEditError(payload.error ?? 'Failed to update company.'); return; }
    setEditingCompany(null);
    await loadCompanies();
  };

  const inputStyle = {
    width: '100%', padding: '0.75rem', border: '1px solid #d1d5db',
    borderRadius: '6px', fontSize: '0.95rem', boxSizing: 'border-box' as const,
  };
  const labelStyle = { display: 'block', fontSize: '0.9rem', fontWeight: '500' as const, color: '#374151', marginBottom: '0.5rem' };
  const totalCompanyPages = Math.max(1, Math.ceil(companies.length / COMPANIES_PER_PAGE));
  const safeCompanyPage = Math.min(companyPage, totalCompanyPages - 1);
  const paginatedCompanies = companies.slice(
    safeCompanyPage * COMPANIES_PER_PAGE,
    (safeCompanyPage + 1) * COMPANIES_PER_PAGE,
  );

  return (
    <ProtectedRoute>
      <div style={{ background: '#f5f7fa', padding: '0.85rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h1 style={{ fontSize: '2rem', fontWeight: '700', color: '#1f2937', margin: 0 }}>Companies</h1>
              <p style={{ color: '#6b7280', margin: '0.5rem 0 0 0' }}>Manage companies and memberships</p>
            </div>
            {!companyId && (
              <button onClick={() => { setError(''); setShowModal(true); }} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#1F7A3D', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.95rem', fontWeight: '600', cursor: 'pointer' }}>
                + Register Company
              </button>
            )}
          </div>

          {!isSupabaseConfigured && (
            <div style={{ backgroundColor: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', color: '#92400e' }}>
              ⚠️ Supabase is not configured. Database features are disabled.
            </div>
          )}

          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
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
                      <th key={h} style={{ padding: '0.8rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedCompanies.map((c, i) => (
                    <tr key={c.id} style={{ borderBottom: i < paginatedCompanies.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                      <td style={{ padding: '0.8rem', fontWeight: '600', color: '#1f2937' }}>{c.name}</td>
                      <td style={{ padding: '0.8rem', color: '#6b7280' }}>{c.company_number || '—'}</td>
                      <td style={{ padding: '0.8rem', color: '#6b7280' }}>{c.email || '—'}</td>
                      <td style={{ padding: '0.8rem', color: '#6b7280' }}>{c.phone || '—'}</td>
                      <td style={{ padding: '0.8rem', color: '#6b7280' }}>{c.city || '—'}</td>
                      <td style={{ padding: '0.8rem', color: '#6b7280' }}>{new Date(c.created_at).toLocaleDateString()}</td>
                      <td style={{ padding: '0.8rem' }}>
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
            {companies.length > COMPANIES_PER_PAGE && (
              <div style={{ borderTop: '1px solid #e5e7eb', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: '#6b7280' }}>
                <span>
                  Showing {safeCompanyPage * COMPANIES_PER_PAGE + 1}–{Math.min((safeCompanyPage + 1) * COMPANIES_PER_PAGE, companies.length)} of {companies.length}
                </span>
                <div style={{ display: 'flex', gap: '0.45rem' }}>
                  <button
                    onClick={() => setCompanyPage((prev) => Math.max(prev - 1, 0))}
                    disabled={safeCompanyPage === 0}
                    style={{ padding: '0.3rem 0.7rem', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: safeCompanyPage === 0 ? '#f9fafb' : '#fff', cursor: safeCompanyPage === 0 ? 'not-allowed' : 'pointer' }}
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCompanyPage((prev) => Math.min(prev + 1, totalCompanyPages - 1))}
                    disabled={safeCompanyPage >= totalCompanyPages - 1}
                    style={{ padding: '0.3rem 0.7rem', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: safeCompanyPage >= totalCompanyPages - 1 ? '#f9fafb' : '#fff', cursor: safeCompanyPage >= totalCompanyPages - 1 ? 'not-allowed' : 'pointer' }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Create Modal */}
        {showModal && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ backgroundColor: 'white', borderRadius: '12px', width: '90%', maxWidth: '600px', maxHeight: '90vh', overflow: 'auto' }}>
              <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#1f2937' }}>Register Company</h2>
                <button onClick={() => { setShowModal(false); setError(''); }} disabled={registering} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: registering ? 'not-allowed' : 'pointer', color: '#6b7280' }}>?</button>
              </div>
              <div style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
                {error && <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '0.75rem', color: '#dc2626', fontSize: '0.9rem' }}>{error}</div>}
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.8rem', color: '#1e3a8a', fontSize: '0.88rem' }}>
                  Company identity is verified against Companies House. The registered name is taken from the registry and the company enters the canonical approval workflow.
                </div>
                <div><label style={labelStyle}>Companies House Number *</label><input style={inputStyle} value={formData.company_number} onChange={e => setFormData({ company_number: e.target.value })} placeholder="12345678" autoComplete="off" /></div>
              </div>
              <div style={{ padding: '1.5rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button onClick={() => { setShowModal(false); setError(''); }} disabled={registering} style={{ padding: '0.75rem 1.5rem', backgroundColor: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.95rem', cursor: registering ? 'not-allowed' : 'pointer' }}>Cancel</button>
                <button onClick={handleCreate} disabled={registering} style={{ padding: '0.75rem 1.5rem', backgroundColor: registering ? '#9ca3af' : '#1F7A3D', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.95rem', fontWeight: '600', cursor: registering ? 'not-allowed' : 'pointer' }}>{registering ? 'Verifying?' : 'Verify & Register'}</button>
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
                  <div><label style={labelStyle}>Companies House Number</label><input style={{ ...inputStyle, backgroundColor: '#f3f4f6', color: '#6b7280' }} value={editData.company_number} readOnly aria-readonly="true" title="Verified company identity cannot be edited here." /></div>
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
