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
import {
  ActionButton,
  AlertBanner,
  OperationalFilterField,
  OperationalFilters,
  OperationalPageLayout,
  PageHeader,
  StatusBadge,
} from '../../components/workspace/WorkspaceUI';
import cssStyles from '../../components/workspace/WorkspaceUI.module.css';

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
  }, [companyResolved, companyId]);

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

  const sidePanel = (
    <OperationalFilters
      title="Driver filters"
      onClear={undefined}
    >
      <div style={{ fontSize: '11px', color: '#5f6368', marginBottom: '8px', fontWeight: 600 }}>Company: {companies[0]?.name ?? 'Current account company'}</div>
      <div style={{ display: 'grid', gap: '4px', marginBottom: '8px' }}>
        {[
          { label: 'Total drivers', value: drivers.length.toString() },
          { label: 'App access disabled', value: appDisabledCount.toString() },
          { label: 'Suspended / inactive', value: inactiveDriverCount.toString() },
        ].map((item) => (
          <div key={item.label} className={cssStyles.settingsInfoCard}>
            <div className={cssStyles.settingsInfoCardLabel}>{item.label}</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#202124' }}>{item.value}</div>
          </div>
        ))}
      </div>
      <OperationalFilterField label="">
        <ActionButton
          tone="primary"
          disabled={!companyResolved || !companyId}
          onClick={() => {
            setCreatedCredentials(null);
            setCopiedTemporaryPassword(false);
            setPasswordSetupState({ status: 'idle', message: '' });
            setError('');
            setShowModal(true);
          }}
        >
          + Add Driver
        </ActionButton>
      </OperationalFilterField>
    </OperationalFilters>
  );

  return (
    <ProtectedRoute>
      <OperationalPageLayout searchPanel={sidePanel}>
        <PageHeader
          title="Drivers"
          description="Manage driver accounts and app access."
        />

        {companyError && <AlertBanner tone="warning">{companyError}</AlertBanner>}
        {!isSupabaseConfigured && <AlertBanner tone="warning">⚠️ Supabase is not configured. Database features are disabled.</AlertBanner>}

        {/* Tab bar — Section 9: 36px row */}
        <div className={cssStyles.jobsStatusTabs} role="tablist" aria-label="Filter drivers by status" style={{ marginBottom: '8px' }}>
          {[
            { key: 'all' as const, label: `All (${drivers.length})` },
            { key: 'active' as const, label: `Active (${activeDriverCount})` },
            { key: 'app-disabled' as const, label: `App Disabled (${appDisabledCount})` },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              className={`${cssStyles.jobsStatusTab} ${activeTab === tab.key ? cssStyles.jobsStatusTabActive : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Driver list — card-style rows */}
        <div className={cssStyles.operationalTableContainer}>
          {!companyResolved || loading ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#5f6368', fontSize: '12px' }}>Loading…</div>
          ) : !companyId ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#5f6368', fontSize: '12px' }}>
              <p style={{ margin: 0 }}>Company profile not available. Drivers are hidden until company access resolves.</p>
            </div>
          ) : filteredDrivers.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#5f6368', fontSize: '12px' }}>
              <p style={{ margin: '0', fontWeight: 600, color: '#202124' }}>
                {drivers.length === 0 ? 'No drivers yet. Add your first driver.' : 'No drivers match this tab filter.'}
              </p>
            </div>
          ) : (
            <div>
              {paginatedDrivers.map((d) => (
                <div key={d.id} style={{ borderBottom: '1px solid #f1f5f9', padding: '8px 12px', minHeight: '42px', display: 'grid', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: '#202124', fontSize: '12px' }}>{d.display_name}</div>
                      <div style={{ color: '#5f6368', fontSize: '11px', marginTop: '2px' }}>{d.email || '—'} · {d.phone || 'No phone'}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <StatusBadge value={d.status} />
                      <StatusBadge value={d.app_access ? 'App enabled' : 'App disabled'} tone={d.app_access ? 'green' : 'grey'} />
                      <span style={{ color: '#5f6368', fontSize: '11px' }}>Created {formatDate(d.created_at)}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    <ActionButton tone="secondary" onClick={() => openEditModal(d)}>Edit</ActionButton>
                    <ActionButton
                      tone={d.status === 'active' ? 'danger' : 'success'}
                      onClick={() => void handleToggleStatus(d)}
                    >
                      {d.status === 'active' ? 'Deactivate' : 'Activate'}
                    </ActionButton>
                    {d.status !== 'suspended' && (
                      <ActionButton tone="warning" onClick={() => void handleSuspendDriver(d)}>Suspend</ActionButton>
                    )}
                    <ActionButton tone="danger" onClick={() => void handleRemoveDriver(d)}>Remove</ActionButton>
                  </div>
                </div>
              ))}
            </div>
          )}

          {filteredDrivers.length > DRIVERS_PER_PAGE && (
            <div className={cssStyles.operationalTableMeta}>
              <span>
                Showing {driverPage * DRIVERS_PER_PAGE + 1}–{Math.min((driverPage + 1) * DRIVERS_PER_PAGE, filteredDrivers.length)} of {filteredDrivers.length} drivers
              </span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <ActionButton tone="secondary" disabled={driverPage === 0} onClick={() => setDriverPage((p) => Math.max(0, p - 1))}>
                  ← Prev
                </ActionButton>
                <ActionButton tone="secondary" disabled={(driverPage + 1) * DRIVERS_PER_PAGE >= filteredDrivers.length} onClick={() => setDriverPage((p) => p + 1)}>
                  Next →
                </ActionButton>
              </div>
            </div>
          )}
        </div>

        {/* Create Driver Modal */}
        {showModal && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
            <div style={{ backgroundColor: 'white', borderRadius: '4px', border: '1px solid #d9e2ec', width: '90%', maxWidth: '500px', maxHeight: '90vh', overflow: 'auto' }}>
              <div style={{ padding: '10px 16px', borderBottom: '1px solid #d9e2ec', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '40px' }}>
                <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#202124' }}>Add Driver</h2>
                <button type="button" onClick={closeModal} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#5f6368', lineHeight: 1, padding: '0 4px' }} aria-label="Close">×</button>
              </div>
              {createdCredentials ? (
                <>
                  <div style={{ padding: '12px 16px', display: 'grid', gap: '8px' }}>
                    <AlertBanner tone={createdCredentials.onboardingOutcome === 'invite_sent' ? 'success' : 'info'}>
                      {createdCredentials.onboardingOutcome === 'invite_sent'
                        ? 'Driver invited successfully. A password setup email was sent.'
                        : createdCredentials.onboardingOutcome === 'temporary_password_created'
                        ? 'Driver created with a temporary password because invite delivery failed.'
                        : 'Driver account linked without sending a fresh invite.'}
                    </AlertBanner>
                    <div style={{ fontSize: '12px', color: '#202124' }}>
                      <strong>Driver:</strong> {createdCredentials.displayName}<br />
                      <strong>Email:</strong> {createdCredentials.email}
                      {createdCredentials.temporaryPassword && (
                        <><br /><strong>Temporary password:</strong> {createdCredentials.temporaryPassword}</>
                      )}
                    </div>
                    {createdCredentials.onboardingOutcome === 'temporary_password_created' ? (
                      <AlertBanner tone="warning">
                        <strong>Next action:</strong> copy the temporary password now, share it securely with the driver, and require an immediate password change on first sign-in.
                      </AlertBanner>
                    ) : (
                      <AlertBanner tone="info">
                        <strong>Next action:</strong> ask the driver to open their password setup email. If they need a fresh message, use the password setup action below.
                      </AlertBanner>
                    )}
                    {createdCredentials.inviteFallbackReason && (
                      <AlertBanner tone="warning">{createdCredentials.inviteFallbackReason}</AlertBanner>
                    )}
                    {passwordSetupState.message && (
                      <AlertBanner tone={passwordSetupState.status === 'error' ? 'danger' : 'success'}>
                        {passwordSetupState.message}
                      </AlertBanner>
                    )}
                    {copiedTemporaryPassword && <AlertBanner tone="success">Temporary password copied.</AlertBanner>}
                  </div>
                  <div style={{ padding: '8px 16px', borderTop: '1px solid #d9e2ec', display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
                    {createdCredentials.temporaryPassword && (
                      <ActionButton tone="secondary" onClick={handleCopyTemporaryPassword}>Copy temporary password</ActionButton>
                    )}
                    <ActionButton
                      tone="primary"
                      disabled={passwordSetupState.status === 'sending' || Date.now() < passwordSetupCooldownUntil}
                      onClick={handleSendPasswordSetup}
                    >
                      {passwordSetupState.status === 'sending'
                        ? 'Sending…'
                        : Date.now() < passwordSetupCooldownUntil
                          ? `Retry in ${Math.ceil((passwordSetupCooldownUntil - Date.now()) / 1000)}s`
                          : 'Send password setup email'}
                    </ActionButton>
                    <ActionButton tone="success" onClick={closeModal}>Done</ActionButton>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ padding: '12px 16px', display: 'grid', gap: '8px' }}>
                    {error && <AlertBanner tone="danger">{error}</AlertBanner>}
                    <div className={cssStyles.settingsFieldRow}>
                      <label className={cssStyles.settingsLabel}>Full Name *</label>
                      <input className={cssStyles.settingsInput} value={formData.display_name} onChange={e => setFormData({...formData, display_name: e.target.value})} placeholder="John Smith" />
                    </div>
                    <div className={cssStyles.settingsFieldRow}>
                      <label className={cssStyles.settingsLabel}>Company</label>
                      <input className={`${cssStyles.settingsInput} ${cssStyles.settingsInputReadonly}`} value={companies[0]?.name ?? 'Company linked to your account'} disabled readOnly />
                    </div>
                    <div className={cssStyles.settingsFieldRow}>
                      <label className={cssStyles.settingsLabel}>Email *</label>
                      <input type="email" className={cssStyles.settingsInput} value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="driver@email.com" />
                    </div>
                    <div className={cssStyles.settingsFieldRow}>
                      <label className={cssStyles.settingsLabel}>Phone</label>
                      <input className={cssStyles.settingsInput} value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="07123456789" />
                    </div>
                  </div>
                  <div style={{ padding: '8px 16px', borderTop: '1px solid #d9e2ec', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <ActionButton tone="secondary" disabled={creating} onClick={closeModal}>Cancel</ActionButton>
                    <ActionButton tone="success" disabled={creating} onClick={handleCreate}>{creating ? 'Creating…' : 'Add Driver'}</ActionButton>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Edit Driver Modal */}
        {editingDriver && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
            <div style={{ backgroundColor: 'white', borderRadius: '4px', border: '1px solid #d9e2ec', width: '90%', maxWidth: '480px', maxHeight: '90vh', overflow: 'auto' }}>
              <div style={{ padding: '10px 16px', borderBottom: '1px solid #d9e2ec', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '40px' }}>
                <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#202124' }}>Edit Driver</h2>
                <button type="button" onClick={() => setEditingDriver(null)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#5f6368', lineHeight: 1, padding: '0 4px' }} aria-label="Close">×</button>
              </div>
              <div style={{ padding: '12px 16px', display: 'grid', gap: '8px' }}>
                {editError && <AlertBanner tone="danger">{editError}</AlertBanner>}
                <div className={cssStyles.settingsFieldRow}>
                  <label className={cssStyles.settingsLabel}>Full Name *</label>
                  <input className={cssStyles.settingsInput} value={editData.display_name} onChange={e => setEditData({...editData, display_name: e.target.value})} />
                </div>
                <div className={cssStyles.settingsFieldRow}>
                  <label className={cssStyles.settingsLabel}>Phone</label>
                  <input className={cssStyles.settingsInput} value={editData.phone} onChange={e => setEditData({...editData, phone: e.target.value})} />
                </div>
                <div className={cssStyles.settingsFieldRow}>
                  <label className={cssStyles.settingsLabel}>Status</label>
                  <select className={cssStyles.settingsInput} value={editData.status} onChange={e => setEditData({...editData, status: e.target.value})}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: '#202124' }}>
                  <input
                    type="checkbox"
                    id="app_access"
                    checked={editData.app_access}
                    onChange={e => setEditData({...editData, app_access: e.target.checked})}
                    style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#1D57D8' }}
                  />
                  App Access (driver can log in to driver portal)
                </label>
              </div>
              <div style={{ padding: '8px 16px', borderTop: '1px solid #d9e2ec', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <ActionButton tone="secondary" disabled={saving} onClick={() => setEditingDriver(null)}>Cancel</ActionButton>
                <ActionButton tone="primary" disabled={saving} onClick={handleUpdate}>{saving ? 'Saving…' : 'Save Changes'}</ActionButton>
              </div>
            </div>
          </div>
        )}
      </OperationalPageLayout>
    </ProtectedRoute>
  );
}
