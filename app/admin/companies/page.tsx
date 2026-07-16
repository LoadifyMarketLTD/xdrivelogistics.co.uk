'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import type { Company } from '../../../lib/types/database';
import { useAuth } from '../../components/AuthContext';
import { selectWithMissingColumnFallback } from '../../../lib/supabaseSchemaCompat';
import { logRuntimeProof } from '../../../lib/runtimeProof';
import {
  WorkspaceShell,
  WorkspaceMain,
  WorkspaceHeader,
  WorkspaceContent,
  WorkspaceTable,
  WorkspaceTableTr,
  WorkspaceTableTd,
  WorkspaceFieldLabel,
  LoadingCard,
  EmptyCard,
  ErrorBanner,
  wsInputStyle,
  wsBtnPrimary,
  wsBtnSecondary,
  wsBtnAction,
  type WorkspaceTab,
} from '../../components/workspace';

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

  const inputStyle = {
    ...wsInputStyle,
    padding: '0.75rem',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '0.95rem',
    marginBottom: 0,
  };
  const totalCompanyPages = Math.max(1, Math.ceil(companies.length / COMPANIES_PER_PAGE));
  const safeCompanyPage = Math.min(companyPage, totalCompanyPages - 1);
  const paginatedCompanies = companies.slice(
    safeCompanyPage * COMPANIES_PER_PAGE,
    (safeCompanyPage + 1) * COMPANIES_PER_PAGE,
  );
  const headerTabs: WorkspaceTab[] = [{
    id: 'companies',
    label: 'Companies',
    count: companies.length,
  }];

  return (
    <ProtectedRoute>
      <WorkspaceShell>
        <WorkspaceMain>
          <WorkspaceHeader
            tabs={headerTabs}
            activeTab="companies"
            onTabChange={() => {}}
            action={(
              <button
                onClick={() => setShowModal(true)}
                style={{ ...wsBtnPrimary, flex: '0 0 auto', padding: '0.55rem 1rem' }}
              >
                + Create Company
              </button>
            )}
          />
          <WorkspaceContent>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
              <p style={{ color: '#6b7280', margin: '0 0 1rem 0', fontSize: '0.9rem' }}>
                Manage companies and memberships.
              </p>

              {companies.length > 1 && (
                <div style={{ marginBottom: '1rem', maxWidth: '320px' }}>
                  <label htmlFor="active-company" style={{ display: 'block' }}>
                    <WorkspaceFieldLabel>Active company</WorkspaceFieldLabel>
                  </label>
                  <select
                    id="active-company"
                    value={companyId ?? ''}
                    onChange={(e) => handleSwitchCompany(e.target.value)}
                    style={{ ...wsInputStyle, marginBottom: 0, borderRadius: '6px', fontSize: '0.85rem', padding: '0.5rem 0.75rem' }}
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {!isSupabaseConfigured && (
                <ErrorBanner msg="Supabase is not configured. Database features are disabled." />
              )}
              {switchError && <ErrorBanner msg={switchError} />}

              {loading ? (
                <LoadingCard text="Loading companies…" />
              ) : companies.length === 0 ? (
                <EmptyCard icon="🏢" text="No companies yet. Create your first company." />
              ) : (
                <WorkspaceTable
                  columns={['Name', 'Company No.', 'Email', 'Phone', 'City', 'Created', 'Actions']}
                  pagination={{
                    page: safeCompanyPage,
                    total: companies.length,
                    perPage: COMPANIES_PER_PAGE,
                    onPrev: () => setCompanyPage((prev) => Math.max(prev - 1, 0)),
                    onNext: () => setCompanyPage((prev) => Math.min(prev + 1, totalCompanyPages - 1)),
                  }}
                >
                  {paginatedCompanies.map((c, i) => (
                    <WorkspaceTableTr key={c.id} last={i === paginatedCompanies.length - 1}>
                      <WorkspaceTableTd style={{ fontWeight: 600, color: '#1f2937' }}>{c.name}</WorkspaceTableTd>
                      <WorkspaceTableTd style={{ color: '#6b7280' }}>{c.company_number || '—'}</WorkspaceTableTd>
                      <WorkspaceTableTd style={{ color: '#6b7280' }}>{c.email || '—'}</WorkspaceTableTd>
                      <WorkspaceTableTd style={{ color: '#6b7280' }}>{c.phone || '—'}</WorkspaceTableTd>
                      <WorkspaceTableTd style={{ color: '#6b7280' }}>{c.city || '—'}</WorkspaceTableTd>
                      <WorkspaceTableTd style={{ color: '#6b7280' }}>{new Date(c.created_at).toLocaleDateString()}</WorkspaceTableTd>
                      <WorkspaceTableTd>
                        <button
                          onClick={() => openEditModal(c)}
                          style={{ ...wsBtnAction, padding: '0.35rem 0.75rem', backgroundColor: '#e0f2fe', border: 'none', color: '#075985', fontWeight: 600 }}
                        >
                          Edit
                        </button>
                      </WorkspaceTableTd>
                    </WorkspaceTableTr>
                  ))}
                </WorkspaceTable>
              )}
            </div>
          </WorkspaceContent>

          {showModal && (
            <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div style={{ backgroundColor: 'white', borderRadius: '12px', width: '90%', maxWidth: '600px', maxHeight: '90vh', overflow: 'auto' }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#1f2937' }}>Create Company</h2>
                  <button onClick={() => { setShowModal(false); setError(''); }} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}>×</button>
                </div>
                <div style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
                  {error && <ErrorBanner msg={error} />}
                  <div>
                    <WorkspaceFieldLabel>Company Name *</WorkspaceFieldLabel>
                    <input style={inputStyle} value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Acme Ltd" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                    <div>
                      <WorkspaceFieldLabel>Company Number</WorkspaceFieldLabel>
                      <input style={inputStyle} value={formData.company_number} onChange={e => setFormData({ ...formData, company_number: e.target.value })} placeholder="12345678" />
                    </div>
                    <div>
                      <WorkspaceFieldLabel>VAT Number</WorkspaceFieldLabel>
                      <input style={inputStyle} value={formData.vat_number} onChange={e => setFormData({ ...formData, vat_number: e.target.value })} placeholder="GB123456789" />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                    <div>
                      <WorkspaceFieldLabel>Email</WorkspaceFieldLabel>
                      <input style={inputStyle} type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="info@company.com" />
                    </div>
                    <div>
                      <WorkspaceFieldLabel>Phone</WorkspaceFieldLabel>
                      <input style={inputStyle} value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="07123456789" />
                    </div>
                  </div>
                  <div>
                    <WorkspaceFieldLabel>Address</WorkspaceFieldLabel>
                    <input style={inputStyle} value={formData.address_line1} onChange={e => setFormData({ ...formData, address_line1: e.target.value })} placeholder="123 High Street" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                    <div>
                      <WorkspaceFieldLabel>City</WorkspaceFieldLabel>
                      <input style={inputStyle} value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} placeholder="London" />
                    </div>
                    <div>
                      <WorkspaceFieldLabel>Postcode</WorkspaceFieldLabel>
                      <input style={inputStyle} value={formData.postcode} onChange={e => setFormData({ ...formData, postcode: e.target.value })} placeholder="SW1A 1AA" />
                    </div>
                  </div>
                </div>
                <div style={{ padding: '1.5rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                  <button onClick={() => { setShowModal(false); setError(''); }} style={{ ...wsBtnSecondary, padding: '0.75rem 1.5rem', fontSize: '0.95rem' }}>Cancel</button>
                  <button onClick={handleCreate} style={{ ...wsBtnPrimary, flex: '0 0 auto', padding: '0.75rem 1.5rem', fontSize: '0.95rem' }}>Create Company</button>
                </div>
              </div>
            </div>
          )}

          {editingCompany && (
            <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div style={{ backgroundColor: 'white', borderRadius: '12px', width: '90%', maxWidth: '600px', maxHeight: '90vh', overflow: 'auto' }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#1f2937' }}>Edit Company</h2>
                  <button onClick={() => setEditingCompany(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}>×</button>
                </div>
                <div style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
                  {editError && <ErrorBanner msg={editError} />}
                  <div>
                    <WorkspaceFieldLabel>Company Name *</WorkspaceFieldLabel>
                    <input style={inputStyle} value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                    <div>
                      <WorkspaceFieldLabel>Company Number</WorkspaceFieldLabel>
                      <input style={inputStyle} value={editData.company_number} onChange={e => setEditData({ ...editData, company_number: e.target.value })} />
                    </div>
                    <div>
                      <WorkspaceFieldLabel>VAT Number</WorkspaceFieldLabel>
                      <input style={inputStyle} value={editData.vat_number} onChange={e => setEditData({ ...editData, vat_number: e.target.value })} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                    <div>
                      <WorkspaceFieldLabel>Email</WorkspaceFieldLabel>
                      <input style={inputStyle} type="email" value={editData.email} onChange={e => setEditData({ ...editData, email: e.target.value })} />
                    </div>
                    <div>
                      <WorkspaceFieldLabel>Phone</WorkspaceFieldLabel>
                      <input style={inputStyle} value={editData.phone} onChange={e => setEditData({ ...editData, phone: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <WorkspaceFieldLabel>Address</WorkspaceFieldLabel>
                    <input style={inputStyle} value={editData.address_line1} onChange={e => setEditData({ ...editData, address_line1: e.target.value })} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                    <div>
                      <WorkspaceFieldLabel>City</WorkspaceFieldLabel>
                      <input style={inputStyle} value={editData.city} onChange={e => setEditData({ ...editData, city: e.target.value })} />
                    </div>
                    <div>
                      <WorkspaceFieldLabel>Postcode</WorkspaceFieldLabel>
                      <input style={inputStyle} value={editData.postcode} onChange={e => setEditData({ ...editData, postcode: e.target.value })} />
                    </div>
                  </div>
                </div>
                <div style={{ padding: '1.5rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                  <button onClick={() => setEditingCompany(null)} disabled={saving} style={{ ...wsBtnSecondary, padding: '0.75rem 1.5rem', fontSize: '0.95rem', cursor: saving ? 'not-allowed' : 'pointer' }}>Cancel</button>
                  <button onClick={handleUpdate} disabled={saving} style={{ ...wsBtnPrimary, flex: '0 0 auto', padding: '0.75rem 1.5rem', fontSize: '0.95rem', cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving...' : 'Save Changes'}</button>
                </div>
              </div>
            </div>
          )}
        </WorkspaceMain>
      </WorkspaceShell>
    </ProtectedRoute>
  );
}
