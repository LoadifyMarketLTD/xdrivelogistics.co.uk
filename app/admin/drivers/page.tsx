'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import type { Driver, Company } from '../../../lib/types/database';
import { useAuth } from '../../components/AuthContext';
import { getMissingColumnFromError, selectWithMissingColumnFallback } from '../../../lib/supabaseSchemaCompat';
import { logRuntimeProof } from '../../../lib/runtimeProof';
import { useAdminCompanyContext } from '../_hooks/useAdminCompanyContext';
import { usePasswordSetup } from '../_hooks/usePasswordSetup';
import { getAccessToken } from '../_lib/getAccessToken';

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
  const { user } = useAuth();
  const { companyId, companyResolved, companyError } = useAdminCompanyContext();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [companies, setCompanies] = useState<Pick<Company, 'id' | 'name'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [driverPage, setDriverPage] = useState(0);
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'app-disabled'>('all');
  const DRIVERS_PER_PAGE = 15;
  const [showModal, setShowModal] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [formData, setFormData] = useState({ display_name: '', phone: '', email: '' });
  const [editData, setEditData] = useState({ display_name: '', phone: '', status: 'active', app_access: true });
  const [error, setError] = useState('');
  const [editError, setEditError] = useState('');
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const {
    credentials: createdCredentials,
    setCredentials: setCreatedCredentials,
    copiedTemporaryPassword,
    setCopiedTemporaryPassword,
    passwordSetupState,
    setPasswordSetupState,
    passwordSetupCooldownUntil,
    resetSetupState,
    handleCopyTemporaryPassword,
    handleSendPasswordSetup,
  } = usePasswordSetup({ endpoint: '/api/admin/drivers', companyId, membershipId: user?.membershipId });

  const loadDrivers = async (resolvedCompanyId: string) => {
    setLoading(true);
    if (!isSupabaseConfigured) { setLoading(false); return; }

    let orderByCreatedAt = true;
    const { rows, error: queryError } = await selectWithMissingColumnFallback<Driver>({
      table: 'drivers',
      columns: DRIVER_SELECT_COLUMNS,
      execute: async (activeColumns) => {
        let query = supabase
          .from('drivers')
          .select(activeColumns.join(', '))
          .eq('company_id', resolvedCompanyId);

        if (orderByCreatedAt) {
          query = query.order('created_at', { ascending: false });
        }

        const result = await query;
        return {
          data: (result.data ?? []) as unknown as Driver[],
          error: result.error,
        };
      },
      onError: (error) => {
        const missingColumn = getMissingColumnFromError(error, 'drivers');
        if (missingColumn === 'created_at' && orderByCreatedAt) {
          orderByCreatedAt = false;
          return true;
        }
        return false;
      },
    });

    if (queryError) {
      console.error('Failed to load drivers:', queryError.message);
    } else {
      setDrivers(rows);
    }
    setLoading(false);
  };

  const loadCompanies = async (resolvedCompanyId: string) => {
    if (!isSupabaseConfigured) return;

    const { rows, error: queryError } = await selectWithMissingColumnFallback<Record<string, unknown>>({
      table: 'companies',
      columns: ['id', 'name'],
      execute: async (activeColumns) => {
        const companiesRes = await supabase
          .from('companies')
          .select(activeColumns.join(', '))
          .eq('id', resolvedCompanyId)
          .order('name');
        return {
          data: ((companiesRes.data ?? []) as unknown) as Array<Record<string, unknown>>,
          error: companiesRes.error,
        };
      },
    });

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
    if (!companyResolved) return;
    if (!companyId) {
      setDrivers([]);
      setCompanies([]);
      setLoading(false);
      return;
    }
    void Promise.all([loadDrivers(companyId), loadCompanies(companyId)]);
  }, [companyResolved, companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setDriverPage(0);
  }, [activeTab]);

  const handleCreate = async () => {
    if (!formData.display_name.trim()) { setError('Driver name is required'); return; }
    if (!formData.email.trim()) { setError('Driver email is required'); return; }
    if (!companyId) { setError('Company profile is required'); return; }
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
        membershipId: user?.membershipId ?? null,
        displayName: formData.display_name,
        email: formData.email,
        phone: formData.phone || null,
      };
      logRuntimeProof({
        flow: 'Add Driver',
        authUid: user?.id ?? null,
        membershipId: user?.membershipId ?? null,
        companyId,
        payload: requestPayload,
        table: 'drivers',
        rlsPolicy: 'drivers_insert_operator',
      });

      const response = await fetch('/api/admin/drivers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + accessToken,
        },
        body: JSON.stringify(requestPayload),
      });

      const payload = await response.json().catch(() => ({} as {
        error?: string;
        onboardingOutcome?: 'invite_sent' | 'password_setup_required' | 'temporary_password_created';
        temporaryPassword?: string | null;
        inviteFallbackReason?: string | null;
      }));
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
        onboardingOutcome: payload.onboardingOutcome ?? 'invite_sent',
        temporaryPassword: payload.temporaryPassword ?? null,
        inviteFallbackReason: payload.inviteFallbackReason ?? null,
      });
      setCopiedTemporaryPassword(false);
      setPasswordSetupState({ status: 'idle', message: '' });
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

  const handleSuspendDriver = async (driver: Driver) => {
    if (!companyId || !isSupabaseConfigured) return;
    await supabase
      .from('drivers')
      .update({ status: 'suspended', app_access: false })
      .eq('id', driver.id)
      .eq('company_id', companyId);
    await loadDrivers(companyId);
  };

  const handleRemoveDriver = async (driver: Driver) => {
    if (!companyId || !isSupabaseConfigured) return;
    const confirmed = window.confirm(
      `Remove driver "${driver.display_name}"?\n\nThis will permanently delete the driver record. This action cannot be undone.`
    );
    if (!confirmed) return;
    await supabase
      .from('drivers')
      .delete()
      .eq('id', driver.id)
      .eq('company_id', companyId);
    await loadDrivers(companyId);
  };

  const closeModal = () => {
    setShowModal(false);
    setError('');
    resetSetupState();
  };

  const inputStyle = { width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.95rem', boxSizing: 'border-box' as const };
  const labelStyle = { display: 'block', fontSize: '0.9rem', fontWeight: '500' as const, color: '#374151', marginBottom: '0.5rem' };
  const statusColor = (s: string) => s === 'active' ? '#1F7A3D' : s === 'suspended' ? '#92400e' : '#ef4444';
  const statusBg = (s: string) => s === 'active' ? '#d1fae5' : s === 'suspended' ? '#fef3c7' : '#fee2e2';
  const formatDate = (value: string | null | undefined) => {
    if (!value) return '—';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString();
  };

  const activeDriverCount = drivers.filter((driver) => driver.status === 'active').length;
  const inactiveDriverCount = drivers.filter((driver) => driver.status !== 'active').length;
  const appDisabledCount = drivers.filter((driver) => !driver.app_access).length;
  const filteredDrivers = drivers.filter((driver) => {
    if (activeTab === 'active') return driver.status === 'active';
    if (activeTab === 'app-disabled') return !driver.app_access;
    return true;
  });
  const paginatedDrivers = filteredDrivers.slice(driverPage * DRIVERS_PER_PAGE, (driverPage + 1) * DRIVERS_PER_PAGE);

  return (
    <ProtectedRoute>
      <div style={{ background: '#eef2f7', minHeight: '100vh', padding: '1rem' }}>
        <div style={{ background: '#111827', color: '#e5e7eb', borderRadius: '14px', border: '1px solid #1f2937', padding: '0.8rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontWeight: '600' }}>
            <span style={{ width: '0.6rem', height: '0.6rem', borderRadius: '999px', background: '#4ade80' }} />
            Driver Operations Board
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {[
              `All ${drivers.length}`,
              `Active ${activeDriverCount}`,
              `Attention ${inactiveDriverCount}`,
            ].map((item) => (
              <span key={item} style={{ border: '1px solid #374151', borderRadius: '999px', padding: '0.25rem 0.65rem', fontSize: '0.75rem', color: '#cbd5e1' }}>{item}</span>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'minmax(220px, 260px) minmax(0, 1fr)' }}>
          <aside style={{ background: '#f8fafc', border: '1px solid #dbe3ef', borderRadius: '14px', padding: '1rem', display: 'grid', gap: '1rem', alignContent: 'start' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '0.88rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b7280' }}>Driver filters</h2>
              <p style={{ margin: '0.45rem 0 0 0', fontSize: '0.88rem', color: '#64748b' }}>Company: {companies[0]?.name ?? 'Current account company'}</p>
            </div>
            <div style={{ display: 'grid', gap: '0.6rem' }}>
              {[
                { label: 'Total drivers', value: drivers.length.toString() },
                { label: 'App access disabled', value: appDisabledCount.toString() },
                { label: 'Suspended / inactive', value: inactiveDriverCount.toString() },
              ].map((item) => (
                <div key={item.label} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '0.72rem 0.78rem' }}>
                  <div style={{ fontSize: '0.76rem', color: '#6b7280' }}>{item.label}</div>
                  <div style={{ marginTop: '0.3rem', fontSize: '1.15rem', fontWeight: '700', color: '#0f172a' }}>{item.value}</div>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                setCreatedCredentials(null);
                setCopiedTemporaryPassword(false);
                setPasswordSetupState({ status: 'idle', message: '' });
                setError('');
                setShowModal(true);
              }}
              disabled={!companyResolved || !companyId}
              style={{ padding: '0.72rem 0.9rem', backgroundColor: !companyResolved || !companyId ? '#9ca3af' : '#1F7A3D', color: 'white', border: 'none', borderRadius: '10px', fontSize: '0.9rem', fontWeight: '600', cursor: !companyResolved || !companyId ? 'not-allowed' : 'pointer' }}
            >
              + Add Driver
            </button>
          </aside>

          <section style={{ background: '#fff', border: '1px solid #dbe3ef', borderRadius: '14px', overflow: 'hidden' }}>
            <div style={{ borderBottom: '1px solid #e5e7eb', padding: '1rem', display: 'grid', gap: '0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: '1.6rem', color: '#111827' }}>Drivers</h1>
                  <p style={{ margin: '0.35rem 0 0 0', color: '#64748b', fontSize: '0.9rem' }}>Manage driver accounts with board-style visibility.</p>
                </div>
              </div>

              {companyError && (
                <div style={{ backgroundColor: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '10px', padding: '0.85rem', color: '#92400e', fontSize: '0.9rem' }}>
                  {companyError}
                </div>
              )}
              {!isSupabaseConfigured && (
                <div style={{ backgroundColor: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '10px', padding: '0.85rem', color: '#92400e', fontSize: '0.9rem' }}>
                  ⚠️ Supabase is not configured. Database features are disabled.
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {[
                  { key: 'all' as const, label: `All Drivers (${drivers.length})` },
                  { key: 'active' as const, label: `Active (${activeDriverCount})` },
                  { key: 'app-disabled' as const, label: `App Disabled (${appDisabledCount})` },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    style={{
                      border: activeTab === tab.key ? '1px solid #1d4ed8' : '1px solid #d1d5db',
                      background: activeTab === tab.key ? '#eff6ff' : '#f8fafc',
                      color: activeTab === tab.key ? '#1d4ed8' : '#475569',
                      borderRadius: '999px',
                      padding: '0.42rem 0.85rem',
                      fontSize: '0.82rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {!companyResolved || loading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>Loading...</div>
            ) : !companyId ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
                <p>Company profile not available. Drivers are hidden until company access resolves.</p>
              </div>
            ) : filteredDrivers.length === 0 ? (
              <div style={{ padding: '3rem', display: 'grid', placeItems: 'center' }}>
                <div style={{ width: '100%', maxWidth: '560px', border: '1px dashed #cbd5e1', borderRadius: '16px', background: '#f8fafc', padding: '2.2rem', textAlign: 'center', color: '#64748b' }}>
                  <div style={{ fontSize: '2.3rem', marginBottom: '0.85rem' }}>🚚</div>
                  <p style={{ margin: 0, fontWeight: '600', color: '#334155' }}>
                    {drivers.length === 0 ? 'No drivers yet. Add your first driver.' : 'No drivers match this tab filter.'}
                  </p>
                  <p style={{ margin: '0.6rem 0 0 0', fontSize: '0.88rem' }}>
                    Use the Add Driver action to onboard new team members and populate this board.
                  </p>
                </div>
              </div>
            ) : (
              <div style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
                {paginatedDrivers.map((d) => (
                  <article key={d.id} style={{ border: '1px solid #e5e7eb', borderRadius: '12px', background: '#ffffff', padding: '0.9rem', display: 'grid', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontWeight: '700', color: '#0f172a' }}>{d.display_name}</div>
                        <div style={{ color: '#64748b', fontSize: '0.86rem', marginTop: '0.25rem' }}>{d.email || '—'} • {d.phone || 'No phone'}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ backgroundColor: statusBg(d.status), color: statusColor(d.status), padding: '0.25rem 0.7rem', borderRadius: '999px', fontSize: '0.76rem', fontWeight: '600' }}>{d.status}</span>
                        <span style={{ border: '1px solid #d1d5db', borderRadius: '999px', padding: '0.25rem 0.7rem', color: d.app_access ? '#166534' : '#64748b', fontSize: '0.76rem', fontWeight: '600' }}>
                          {d.app_access ? 'App access enabled' : 'App access disabled'}
                        </span>
                        <span style={{ color: '#64748b', fontSize: '0.78rem' }}>Created {formatDate(d.created_at)}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => openEditModal(d)}
                        style={{ padding: '0.4rem 0.8rem', backgroundColor: '#e0f2fe', color: '#075985', border: 'none', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => void handleToggleStatus(d)}
                        style={{ padding: '0.4rem 0.8rem', backgroundColor: d.status === 'active' ? '#fee2e2' : '#d1fae5', color: d.status === 'active' ? '#991b1b' : '#065f46', border: 'none', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}
                      >
                        {d.status === 'active' ? 'Deactivate' : 'Activate'}
                      </button>
                      {d.status !== 'suspended' && (
                        <button
                          onClick={() => void handleSuspendDriver(d)}
                          style={{ padding: '0.4rem 0.8rem', backgroundColor: '#fef3c7', color: '#92400e', border: 'none', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}
                        >
                          Suspend
                        </button>
                      )}
                      <button
                        onClick={() => void handleRemoveDriver(d)}
                        style={{ padding: '0.4rem 0.8rem', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}
                      >
                        Remove
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {filteredDrivers.length > DRIVERS_PER_PAGE && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1rem', borderTop: '1px solid #e5e7eb', background: '#f8fafc' }}>
                <span style={{ fontSize: '0.82rem', color: '#6b7280' }}>
                  Showing {driverPage * DRIVERS_PER_PAGE + 1}–{Math.min((driverPage + 1) * DRIVERS_PER_PAGE, filteredDrivers.length)} of {filteredDrivers.length} drivers
                </span>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button
                    onClick={() => setDriverPage((p) => Math.max(0, p - 1))}
                    disabled={driverPage === 0}
                    style={{ padding: '0.35rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', background: driverPage === 0 ? '#f1f5f9' : '#fff', cursor: driverPage === 0 ? 'not-allowed' : 'pointer', fontSize: '0.82rem', color: '#374151' }}
                  >
                    ← Prev
                  </button>
                  <button
                    onClick={() => setDriverPage((p) => p + 1)}
                    disabled={(driverPage + 1) * DRIVERS_PER_PAGE >= filteredDrivers.length}
                    style={{ padding: '0.35rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', background: (driverPage + 1) * DRIVERS_PER_PAGE >= filteredDrivers.length ? '#f1f5f9' : '#fff', cursor: (driverPage + 1) * DRIVERS_PER_PAGE >= filteredDrivers.length ? 'not-allowed' : 'pointer', fontSize: '0.82rem', color: '#374151' }}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Create Driver Modal */}
        {showModal && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
            <div style={{ backgroundColor: 'white', borderRadius: '12px', width: '90%', maxWidth: '500px', maxHeight: '90vh', overflow: 'auto' }}>
              <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#1f2937' }}>Add Driver</h2>
                <button onClick={closeModal} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}>×</button>
              </div>
              {createdCredentials ? (
                <>
                  <div style={{ padding: '1.5rem', display: 'grid', gap: '0.8rem' }}>
                  <div style={{ backgroundColor: createdCredentials.onboardingOutcome === 'invite_sent' ? '#ecfdf3' : '#eff6ff', border: `1px solid ${createdCredentials.onboardingOutcome === 'invite_sent' ? '#86efac' : '#93c5fd'}`, borderRadius: '8px', padding: '0.9rem', color: createdCredentials.onboardingOutcome === 'invite_sent' ? '#166534' : '#1d4ed8', fontSize: '0.9rem' }}>
                    {createdCredentials.onboardingOutcome === 'invite_sent'
                        ? 'Driver invited successfully. A password setup email was sent.'
                      : createdCredentials.onboardingOutcome === 'temporary_password_created'
                      ? 'Driver created with a temporary password because invite delivery failed.'
                      : 'Driver account linked without sending a fresh invite.'}
                  </div>
                  <div style={{ fontSize: '0.88rem', color: '#334155' }}>
                    <strong>Driver:</strong> {createdCredentials.displayName}
                    <br />
                    <strong>Email:</strong> {createdCredentials.email}
                    {createdCredentials.temporaryPassword ? (
                      <>
                        <br />
                        <strong>Temporary password:</strong> {createdCredentials.temporaryPassword}
                        </>
                      ) : null}
                    </div>
                    {createdCredentials.onboardingOutcome === 'temporary_password_created' ? (
                      <div style={{ backgroundColor: '#fff7ed', border: '1px solid #fdba74', borderRadius: '8px', padding: '0.9rem', color: '#9a3412', fontSize: '0.85rem', lineHeight: 1.6 }}>
                        <strong>Next action:</strong> copy the temporary password now, share it securely with the driver, and require an immediate password change on first sign-in.
                      </div>
                    ) : (
                      <div style={{ backgroundColor: '#eff6ff', border: '1px solid #93c5fd', borderRadius: '8px', padding: '0.9rem', color: '#1d4ed8', fontSize: '0.85rem', lineHeight: 1.6 }}>
                        <strong>Next action:</strong> ask the driver to open their password setup email. If they need a fresh message, use the password setup action below.
                      </div>
                    )}
                    {createdCredentials.inviteFallbackReason ? (
                      <div style={{ backgroundColor: '#fff7ed', border: '1px solid #fdba74', borderRadius: '8px', padding: '0.9rem', color: '#9a3412', fontSize: '0.85rem' }}>
                        {createdCredentials.inviteFallbackReason}
                      </div>
                    ) : null}
                    {passwordSetupState.message ? (
                      <div style={{ backgroundColor: passwordSetupState.status === 'error' ? '#fef2f2' : '#ecfdf3', border: `1px solid ${passwordSetupState.status === 'error' ? '#fca5a5' : '#86efac'}`, borderRadius: '8px', padding: '0.9rem', color: passwordSetupState.status === 'error' ? '#dc2626' : '#166534', fontSize: '0.85rem' }}>
                        {passwordSetupState.message}
                      </div>
                    ) : null}
                    {copiedTemporaryPassword ? (
                      <div style={{ backgroundColor: '#ecfdf3', border: '1px solid #86efac', borderRadius: '8px', padding: '0.9rem', color: '#166534', fontSize: '0.85rem' }}>
                        Temporary password copied.
                      </div>
                    ) : null}
                  </div>
                  <div style={{ padding: '1.5rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {createdCredentials.temporaryPassword ? (
                      <button onClick={handleCopyTemporaryPassword} style={{ padding: '0.75rem 1rem', backgroundColor: '#e0f2fe', color: '#075985', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>
                        Copy temporary password
                      </button>
                    ) : null}
                    <button
                      onClick={handleSendPasswordSetup}
                      disabled={passwordSetupState.status === 'sending' || Date.now() < passwordSetupCooldownUntil}
                      style={{ padding: '0.75rem 1rem', backgroundColor: '#1d4ed8', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: passwordSetupState.status === 'sending' || Date.now() < passwordSetupCooldownUntil ? 'not-allowed' : 'pointer' }}
                    >
                      {passwordSetupState.status === 'sending'
                        ? 'Sending...'
                        : Date.now() < passwordSetupCooldownUntil
                          ? `Retry in ${Math.ceil((passwordSetupCooldownUntil - Date.now()) / 1000)}s`
                          : 'Send password setup email'}
                    </button>
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
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
            <div style={{ backgroundColor: 'white', borderRadius: '12px', width: '90%', maxWidth: '480px', maxHeight: '90vh', overflow: 'auto' }}>
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
