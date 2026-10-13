'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import type { Company } from '../../../lib/types/database';
import { useAuth } from '../../components/AuthContext';
import { selectWithMissingColumnFallback } from '../../../lib/supabaseSchemaCompat';
import { registerValidatedCompany } from '../../actions/companies';
import { getAccessToken } from '../_lib/getAccessToken';
import { ActionButton, AlertBanner, EmptyState, OperationalTable } from '../../components/workspace/WorkspaceUI';

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
      <div className="carrier-register-page carrier-register-page--companies">
        <div className="carrier-register-content">
          <div className="carrier-register-toolbar">
            <div>
              <h1 className="carrier-register-title">Companies</h1>
              <p className="carrier-register-subtitle">Manage companies and memberships</p>
            </div>
            {!companyId && (
              <button onClick={() => { setError(''); setShowModal(true); }} className="carrier-register-action">
                + Register Company
              </button>
            )}
          </div>

          {!isSupabaseConfigured ? <AlertBanner tone="warning">Supabase is not configured. Database features are disabled.</AlertBanner> : null}

          <section className="carrier-register-results" aria-label="Company directory">
            <div className="carrier-register-table-wrap">
              <OperationalTable<Company>
                columns={[
                  { id: 'name', header: 'Name', cell: (company) => <strong>{company.name}</strong> },
                  { id: 'number', header: 'Company No.', cell: (company) => company.company_number || '—' },
                  { id: 'email', header: 'Email', cell: (company) => company.email || '—' },
                  { id: 'phone', header: 'Phone', cell: (company) => company.phone || '—' },
                  { id: 'city', header: 'City', cell: (company) => company.city || '—' },
                  { id: 'created', header: 'Created', cell: (company) => new Date(company.created_at).toLocaleDateString('en-GB') },
                  { id: 'actions', header: 'Actions', isAction: true, align: 'right', cell: (company) => <ActionButton tone="secondary" onClick={() => openEditModal(company)}>Edit</ActionButton> },
                ]}
                rows={paginatedCompanies}
                getRowKey={(company) => company.id}
                loading={loading}
                empty={<EmptyState title="No companies yet" description="Create your first company." />}
              />
            </div>
            {companies.length > COMPANIES_PER_PAGE && (
              <div style={{ minHeight: 'var(--ws-meta-h, 22px)', borderTop: '1px solid var(--ws-border-soft, #e2e7ed)', padding: '4px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--ws-font-meta, 11px)', color: '#64748b' }}>
                <span>Showing {safeCompanyPage * COMPANIES_PER_PAGE + 1}–{Math.min((safeCompanyPage + 1) * COMPANIES_PER_PAGE, companies.length)} of {companies.length}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <ActionButton tone="secondary" onClick={() => setCompanyPage((prev) => Math.max(prev - 1, 0))} disabled={safeCompanyPage === 0}>Previous</ActionButton>
                  <ActionButton tone="secondary" onClick={() => setCompanyPage((prev) => Math.min(prev + 1, totalCompanyPages - 1))} disabled={safeCompanyPage >= totalCompanyPages - 1}>Next</ActionButton>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Create Modal */}
        {showModal && (
          <div className="carrier-register-modal-overlay">
            <div className="carrier-register-modal" style={{ maxWidth: '600px' }}>
              <div className="carrier-register-modal__header">
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#1f2937' }}>Register Company</h2>
                <button type="button" aria-label="Close register company dialog" onClick={() => { setShowModal(false); setError(''); }} disabled={registering} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: registering ? 'not-allowed' : 'pointer', color: '#6b7280' }}>×</button>
              </div>
              <div className="carrier-register-modal__body">
                {error ? <AlertBanner tone="danger">{error}</AlertBanner> : null}
                <AlertBanner tone="info">Company identity is verified against Companies House. The registered name is taken from the registry and the company enters the canonical approval workflow.</AlertBanner>
                <div><label style={labelStyle}>Companies House Number *</label><input style={inputStyle} value={formData.company_number} onChange={e => setFormData({ company_number: e.target.value })} placeholder="12345678" autoComplete="off" /></div>
              </div>
              <div className="carrier-register-modal__footer">
                <ActionButton tone="secondary" onClick={() => { setShowModal(false); setError(''); }} disabled={registering}>Cancel</ActionButton>
                <ActionButton tone="success" onClick={handleCreate} disabled={registering}>{registering ? 'Verifying…' : 'Verify & Register'}</ActionButton>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {editingCompany && (
          <div className="carrier-register-modal-overlay">
            <div className="carrier-register-modal" style={{ maxWidth: '600px' }}>
              <div className="carrier-register-modal__header">
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#1f2937' }}>Edit Company</h2>
                <button type="button" aria-label="Close edit company dialog" onClick={() => setEditingCompany(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}>×</button>
              </div>
              <div className="carrier-register-modal__body">
                {editError ? <AlertBanner tone="danger">{editError}</AlertBanner> : null}
                <div><label style={labelStyle}>Company Name *</label><input style={inputStyle} value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} /></div>
                <div className="carrier-register-modal__field-grid">
                  <div><label style={labelStyle}>Companies House Number</label><input style={{ ...inputStyle, backgroundColor: '#f3f4f6', color: '#6b7280' }} value={editData.company_number} readOnly aria-readonly="true" title="Verified company identity cannot be edited here." /></div>
                  <div><label style={labelStyle}>VAT Number</label><input style={inputStyle} value={editData.vat_number} onChange={e => setEditData({...editData, vat_number: e.target.value})} /></div>
                </div>
                <div className="carrier-register-modal__field-grid">
                  <div><label style={labelStyle}>Email</label><input style={inputStyle} type="email" value={editData.email} onChange={e => setEditData({...editData, email: e.target.value})} /></div>
                  <div><label style={labelStyle}>Phone</label><input style={inputStyle} value={editData.phone} onChange={e => setEditData({...editData, phone: e.target.value})} /></div>
                </div>
                <div><label style={labelStyle}>Address</label><input style={inputStyle} value={editData.address_line1} onChange={e => setEditData({...editData, address_line1: e.target.value})} /></div>
                <div className="carrier-register-modal__field-grid">
                  <div><label style={labelStyle}>City</label><input style={inputStyle} value={editData.city} onChange={e => setEditData({...editData, city: e.target.value})} /></div>
                  <div><label style={labelStyle}>Postcode</label><input style={inputStyle} value={editData.postcode} onChange={e => setEditData({...editData, postcode: e.target.value})} /></div>
                </div>
              </div>
              <div className="carrier-register-modal__footer">
                <ActionButton tone="secondary" onClick={() => setEditingCompany(null)} disabled={saving}>Cancel</ActionButton>
                <ActionButton tone="success" onClick={handleUpdate} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</ActionButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
