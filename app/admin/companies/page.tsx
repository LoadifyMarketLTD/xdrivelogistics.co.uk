'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import type { Company } from '../../../lib/types/database';
import { useAuth } from '../../components/AuthContext';
import { selectWithMissingColumnFallback } from '../../../lib/supabaseSchemaCompat';
import { logRuntimeProof } from '../../../lib/runtimeProof';
import { PageHeader, ActionButton, AlertBanner } from '../../components/workspace/WorkspaceUI';
import cssStyles from '../../components/workspace/WorkspaceUI.module.css';

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

  const totalCompanyPages = Math.max(1, Math.ceil(companies.length / COMPANIES_PER_PAGE));
  const safeCompanyPage = Math.min(companyPage, totalCompanyPages - 1);
  const paginatedCompanies = companies.slice(
    safeCompanyPage * COMPANIES_PER_PAGE,
    (safeCompanyPage + 1) * COMPANIES_PER_PAGE,
  );

  return (
    <ProtectedRoute>
      <PageHeader
        title="Companies"
        description="Manage companies and memberships"
        actions={
          <ActionButton tone="primary" onClick={() => setShowModal(true)}>+ Create Company</ActionButton>
        }
      />

      {companies.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0' }}>
          <label htmlFor="active-company" className={cssStyles.settingsLabel} style={{ marginBottom: 0 }}>Active company</label>
          <select
            id="active-company"
            value={companyId ?? ''}
            onChange={(e) => handleSwitchCompany(e.target.value)}
            className={cssStyles.settingsInput}
            style={{ width: 'auto' }}
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}
      {switchError && <AlertBanner tone="danger">{switchError}</AlertBanner>}
      {!isSupabaseConfigured && <AlertBanner tone="warning">⚠️ Supabase is not configured. Database features are disabled.</AlertBanner>}

      <div className={cssStyles.operationalTableContainer}>
        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#5f6368', fontSize: '12px' }}>Loading…</div>
        ) : companies.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#5f6368', fontSize: '12px' }}>
            <p style={{ margin: 0 }}>No companies yet. Create your first company.</p>
          </div>
        ) : (
          <>
            <div className={cssStyles.operationalTableScroll}>
              <table className={cssStyles.operationalTable}>
                <caption className={cssStyles.operationalTableCaption}>Companies</caption>
                <thead>
                  <tr className={cssStyles.operationalTableHeaderRow}>
                    {['Name', 'Company No.', 'Email', 'Phone', 'City', 'Created', 'Actions'].map(h => (
                      <th key={h} scope="col" className={cssStyles.operationalTableHeadCell}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedCompanies.map((c) => (
                    <tr key={c.id} className={cssStyles.operationalTableRow}>
                      <td className={cssStyles.operationalTableCell} style={{ fontWeight: 600 }}>{c.name}</td>
                      <td className={cssStyles.operationalTableCell}>{c.company_number || '—'}</td>
                      <td className={cssStyles.operationalTableCell}>{c.email || '—'}</td>
                      <td className={cssStyles.operationalTableCell}>{c.phone || '—'}</td>
                      <td className={cssStyles.operationalTableCell}>{c.city || '—'}</td>
                      <td className={cssStyles.operationalTableCell}>{new Date(c.created_at).toLocaleDateString()}</td>
                      <td className={`${cssStyles.operationalTableCell} ${cssStyles.operationalTableActionCell}`}>
                        <ActionButton tone="secondary" onClick={() => openEditModal(c)}>Edit</ActionButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {companies.length > COMPANIES_PER_PAGE && (
              <div className={cssStyles.operationalTableMeta}>
                <span>
                  Showing {safeCompanyPage * COMPANIES_PER_PAGE + 1}–{Math.min((safeCompanyPage + 1) * COMPANIES_PER_PAGE, companies.length)} of {companies.length}
                </span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <ActionButton tone="secondary" disabled={safeCompanyPage === 0} onClick={() => setCompanyPage((prev) => Math.max(prev - 1, 0))}>Previous</ActionButton>
                  <ActionButton tone="secondary" disabled={safeCompanyPage >= totalCompanyPages - 1} onClick={() => setCompanyPage((prev) => Math.min(prev + 1, totalCompanyPages - 1))}>Next</ActionButton>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '4px', border: '1px solid #d9e2ec', width: '90%', maxWidth: '560px', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid #d9e2ec', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '40px' }}>
              <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#202124' }}>Create Company</h2>
              <button type="button" onClick={() => { setShowModal(false); setError(''); }} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#5f6368', lineHeight: 1, padding: '0 4px' }} aria-label="Close">×</button>
            </div>
            <div style={{ padding: '12px 16px', display: 'grid', gap: '8px' }}>
              {error && <AlertBanner tone="danger">{error}</AlertBanner>}
              <div className={cssStyles.settingsFieldRow}>
                <label className={cssStyles.settingsLabel}>Company Name *</label>
                <input className={cssStyles.settingsInput} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Acme Ltd" />
              </div>
              <div className={cssStyles.settingsFieldGrid}>
                <div>
                  <label className={cssStyles.settingsLabel}>Company Number</label>
                  <input className={cssStyles.settingsInput} value={formData.company_number} onChange={e => setFormData({...formData, company_number: e.target.value})} placeholder="12345678" />
                </div>
                <div>
                  <label className={cssStyles.settingsLabel}>VAT Number</label>
                  <input className={cssStyles.settingsInput} value={formData.vat_number} onChange={e => setFormData({...formData, vat_number: e.target.value})} placeholder="GB123456789" />
                </div>
              </div>
              <div className={cssStyles.settingsFieldGrid}>
                <div>
                  <label className={cssStyles.settingsLabel}>Email</label>
                  <input type="email" className={cssStyles.settingsInput} value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="info@company.com" />
                </div>
                <div>
                  <label className={cssStyles.settingsLabel}>Phone</label>
                  <input className={cssStyles.settingsInput} value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="07123456789" />
                </div>
              </div>
              <div className={cssStyles.settingsFieldRow}>
                <label className={cssStyles.settingsLabel}>Address</label>
                <input className={cssStyles.settingsInput} value={formData.address_line1} onChange={e => setFormData({...formData, address_line1: e.target.value})} placeholder="123 High Street" />
              </div>
              <div className={cssStyles.settingsFieldGrid}>
                <div>
                  <label className={cssStyles.settingsLabel}>City</label>
                  <input className={cssStyles.settingsInput} value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} placeholder="London" />
                </div>
                <div>
                  <label className={cssStyles.settingsLabel}>Postcode</label>
                  <input className={cssStyles.settingsInput} value={formData.postcode} onChange={e => setFormData({...formData, postcode: e.target.value})} placeholder="SW1A 1AA" />
                </div>
              </div>
            </div>
            <div style={{ padding: '8px 16px', borderTop: '1px solid #d9e2ec', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <ActionButton tone="secondary" onClick={() => { setShowModal(false); setError(''); }}>Cancel</ActionButton>
              <ActionButton tone="primary" onClick={handleCreate}>Create Company</ActionButton>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingCompany && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '4px', border: '1px solid #d9e2ec', width: '90%', maxWidth: '560px', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid #d9e2ec', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '40px' }}>
              <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#202124' }}>Edit Company</h2>
              <button type="button" onClick={() => setEditingCompany(null)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#5f6368', lineHeight: 1, padding: '0 4px' }} aria-label="Close">×</button>
            </div>
            <div style={{ padding: '12px 16px', display: 'grid', gap: '8px' }}>
              {editError && <AlertBanner tone="danger">{editError}</AlertBanner>}
              <div className={cssStyles.settingsFieldRow}>
                <label className={cssStyles.settingsLabel}>Company Name *</label>
                <input className={cssStyles.settingsInput} value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} />
              </div>
              <div className={cssStyles.settingsFieldGrid}>
                <div>
                  <label className={cssStyles.settingsLabel}>Company Number</label>
                  <input className={cssStyles.settingsInput} value={editData.company_number} onChange={e => setEditData({...editData, company_number: e.target.value})} />
                </div>
                <div>
                  <label className={cssStyles.settingsLabel}>VAT Number</label>
                  <input className={cssStyles.settingsInput} value={editData.vat_number} onChange={e => setEditData({...editData, vat_number: e.target.value})} />
                </div>
              </div>
              <div className={cssStyles.settingsFieldGrid}>
                <div>
                  <label className={cssStyles.settingsLabel}>Email</label>
                  <input type="email" className={cssStyles.settingsInput} value={editData.email} onChange={e => setEditData({...editData, email: e.target.value})} />
                </div>
                <div>
                  <label className={cssStyles.settingsLabel}>Phone</label>
                  <input className={cssStyles.settingsInput} value={editData.phone} onChange={e => setEditData({...editData, phone: e.target.value})} />
                </div>
              </div>
              <div className={cssStyles.settingsFieldRow}>
                <label className={cssStyles.settingsLabel}>Address</label>
                <input className={cssStyles.settingsInput} value={editData.address_line1} onChange={e => setEditData({...editData, address_line1: e.target.value})} />
              </div>
              <div className={cssStyles.settingsFieldGrid}>
                <div>
                  <label className={cssStyles.settingsLabel}>City</label>
                  <input className={cssStyles.settingsInput} value={editData.city} onChange={e => setEditData({...editData, city: e.target.value})} />
                </div>
                <div>
                  <label className={cssStyles.settingsLabel}>Postcode</label>
                  <input className={cssStyles.settingsInput} value={editData.postcode} onChange={e => setEditData({...editData, postcode: e.target.value})} />
                </div>
              </div>
            </div>
            <div style={{ padding: '8px 16px', borderTop: '1px solid #d9e2ec', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <ActionButton tone="secondary" disabled={saving} onClick={() => setEditingCompany(null)}>Cancel</ActionButton>
              <ActionButton tone="primary" disabled={saving} onClick={handleUpdate}>{saving ? 'Saving…' : 'Save Changes'}</ActionButton>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
