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
  OperationalFilterField,
  OperationalFilters,
  OperationalPageLayout,
  PageHeader,
} from '../../components/workspace/WorkspaceUI';

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

  const inputStyle = { width: '100%', height: '32px', padding: '0 8px', border: '1px solid #d9e2ec', borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box' as const };
  const labelStyle = { display: 'block', fontSize: '12px', fontWeight: '600' as const, color: '#5f6368', marginBottom: '4px' };
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

  const sidePanel = (
    <OperationalFilters
      title="Driver filters"
      onClear={undefined}
    >
      <div style={{ fontSize: '12px', color: '#5f6368', marginBottom: '8px' }}>Company: {companies[0]?.name ?? 'Current account company'}</div>
      <div style={{ display: 'grid', gap: '4px', marginBottom: '12px' }}>
        {[
          { label: 'Total drivers', value: drivers.length.toString() },
          { label: 'App access disabled', value: appDisabledCount.toString() },
          { label: 'Suspended / inactive', value: inactiveDriverCount.toString() },
        ].map((item) => (
          <div key={item.label} style={{ background: '#fff', border: '1px solid #d9e2ec', borderRadius: '4px', padding: '8px 10px' }}>
            <div style={{ fontSize: '11px', color: '#5f6368', fontWeight: 600 }}>{item.label}</div>
            <div style={{ marginTop: '2px', fontSize: '16px', fontWeight: 700, color: '#202124' }}>{item.value}</div>
          </div>
        ))}
      </div>
      <OperationalFilterField label="">
        <button
          onClick={() => {
            setCreatedCredentials(null);
            setCopiedTemporaryPassword(false);
            setPasswordSetupState({ status: 'idle', message: '' });
            setError('');
            setShowModal(true);
          }}
          disabled={!companyResolved || !companyId}
          style={{ width: '100%', height: '32px', backgroundColor: !companyResolved || !companyId ? '#9ca3af' : '#1d57d8', color: 'white', border: 'none', borderRadius: '4px', fontSize: '13px', fontWeight: 600, cursor: !companyResolved || !companyId ? 'not-allowed' : 'pointer' }}
        >
          + Add Driver
        </button>
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

        {companyError && (
          <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '4px', padding: '8px 12px', marginBottom: '8px', color: '#92400e', fontSize: '13px' }}>
            {companyError}
          </div>
        )}
        {!isSupabaseConfigured && (
          <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '4px', padding: '8px 12px', marginBottom: '8px', color: '#92400e', fontSize: '13px' }}>
            ⚠️ Supabase is not configured. Database features are disabled.
          </div>
        )}

        <div style={{ background: '#fff', border: '1px solid #d9e2ec', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ borderBottom: '1px solid #d9e2ec', padding: '0 12px', display: 'flex', alignItems: 'center', height: '40px', gap: '4px' }}>
            {[
              { key: 'all' as const, label: `All (${drivers.length})` },
              { key: 'active' as const, label: `Active (${activeDriverCount})` },
              { key: 'app-disabled' as const, label: `App Disabled (${appDisabledCount})` },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  height: '40px',
                  padding: '0 10px',
                  border: 'none',
                  borderBottom: activeTab === tab.key ? '2px solid #1d57d8' : '2px solid transparent',
                  background: 'none',
                  color: activeTab === tab.key ? '#1d57d8' : '#5f6368',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  marginBottom: '-1px',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {!companyResolved || loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#5f6368', fontSize: '13px' }}>Loading...</div>
          ) : !companyId ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#5f6368', fontSize: '13px' }}>
              <p>Company profile not available. Drivers are hidden until company access resolves.</p>
            </div>
          ) : filteredDrivers.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#5f6368', fontSize: '13px' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🚚</div>
              <p style={{ margin: 0, fontWeight: 600, color: '#202124' }}>
                {drivers.length === 0 ? 'No drivers yet. Add your first driver.' : 'No drivers match this tab filter.'}
              </p>
            </div>
          ) : (
            <div>
              {paginatedDrivers.map((d) => (
                <div key={d.id} style={{ borderBottom: '1px solid #f1f5f9', padding: '10px 12px', display: 'grid', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: '#202124', fontSize: '13px' }}>{d.display_name}</div>
                      <div style={{ color: '#5f6368', fontSize: '12px', marginTop: '2px' }}>{d.email || '—'} • {d.phone || 'No phone'}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ backgroundColor: statusBg(d.status), color: statusColor(d.status), padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 700 }}>{d.status}</span>
                      <span style={{ border: '1px solid #d9e2ec', borderRadius: '999px', padding: '2px 8px', color: d.app_access ? '#166534' : '#5f6368', fontSize: '11px', fontWeight: 700 }}>
                        {d.app_access ? 'App enabled' : 'App disabled'}
                      </span>
                      <span style={{ color: '#5f6368', fontSize: '11px' }}>Created {formatDate(d.created_at)}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => openEditModal(d)}
                      style={{ height: '26px', padding: '0 8px', backgroundColor: '#e0f2fe', color: '#075985', border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => void handleToggleStatus(d)}
                      style={{ height: '26px', padding: '0 8px', backgroundColor: d.status === 'active' ? '#fee2e2' : '#d1fae5', color: d.status === 'active' ? '#991b1b' : '#065f46', border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      {d.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                    {d.status !== 'suspended' && (
                      <button
                        onClick={() => void handleSuspendDriver(d)}
                        style={{ height: '26px', padding: '0 8px', backgroundColor: '#fffbeb', color: '#92400e', border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Suspend
                      </button>
                    )}
                    <button
                      onClick={() => void handleRemoveDriver(d)}
                      style={{ height: '26px', padding: '0 8px', backgroundColor: '#d93025', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {filteredDrivers.length > DRIVERS_PER_PAGE && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderTop: '1px solid #d9e2ec' }}>
              <span style={{ fontSize: '12px', color: '#5f6368' }}>
                Showing {driverPage * DRIVERS_PER_PAGE + 1}–{Math.min((driverPage + 1) * DRIVERS_PER_PAGE, filteredDrivers.length)} of {filteredDrivers.length} drivers
              </span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  onClick={() => setDriverPage((p) => Math.max(0, p - 1))}
                  disabled={driverPage === 0}
                  style={{ height: '28px', padding: '0 10px', border: '1px solid #d9e2ec', borderRadius: '4px', background: driverPage === 0 ? '#f5f7fa' : '#fff', cursor: driverPage === 0 ? 'not-allowed' : 'pointer', fontSize: '12px', color: '#202124' }}
                >
                  ← Prev
                </button>
                <button
                  onClick={() => setDriverPage((p) => p + 1)}
                  disabled={(driverPage + 1) * DRIVERS_PER_PAGE >= filteredDrivers.length}
                  style={{ height: '28px', padding: '0 10px', border: '1px solid #d9e2ec', borderRadius: '4px', background: (driverPage + 1) * DRIVERS_PER_PAGE >= filteredDrivers.length ? '#f5f7fa' : '#fff', cursor: (driverPage + 1) * DRIVERS_PER_PAGE >= filteredDrivers.length ? 'not-allowed' : 'pointer', fontSize: '12px', color: '#202124' }}
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Create Driver Modal */}
        {showModal && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
            <div style={{ backgroundColor: 'white', borderRadius: '4px', border: '1px solid #d9e2ec', width: '90%', maxWidth: '500px', maxHeight: '90vh', overflow: 'auto' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #d9e2ec', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#202124', lineHeight: '22px' }}>Add Driver</h2>
                <button onClick={closeModal} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#5f6368', lineHeight: 1 }}>×</button>
              </div>
              {createdCredentials ? (
                <>
                  <div style={{ padding: '16px', display: 'grid', gap: '8px' }}>
                  <div style={{ backgroundColor: createdCredentials.onboardingOutcome === 'invite_sent' ? '#f0fdf4' : '#eff6ff', border: `1px solid ${createdCredentials.onboardingOutcome === 'invite_sent' ? '#86efac' : '#93c5fd'}`, borderRadius: '4px', padding: '10px 12px', color: createdCredentials.onboardingOutcome === 'invite_sent' ? '#166534' : '#1d4ed8', fontSize: '13px' }}>
                    {createdCredentials.onboardingOutcome === 'invite_sent'
                        ? 'Driver invited successfully. A password setup email was sent.'
                      : createdCredentials.onboardingOutcome === 'temporary_password_created'
                      ? 'Driver created with a temporary password because invite delivery failed.'
                      : 'Driver account linked without sending a fresh invite.'}
                  </div>
                  <div style={{ fontSize: '13px', color: '#202124' }}>
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
                      <div style={{ backgroundColor: '#fff7ed', border: '1px solid #fdba74', borderRadius: '4px', padding: '10px 12px', color: '#9a3412', fontSize: '13px', lineHeight: 1.6 }}>
                        <strong>Next action:</strong> copy the temporary password now, share it securely with the driver, and require an immediate password change on first sign-in.
                      </div>
                    ) : (
                      <div style={{ backgroundColor: '#eff6ff', border: '1px solid #93c5fd', borderRadius: '4px', padding: '10px 12px', color: '#1d4ed8', fontSize: '13px', lineHeight: 1.6 }}>
                        <strong>Next action:</strong> ask the driver to open their password setup email. If they need a fresh message, use the password setup action below.
                      </div>
                    )}
                    {createdCredentials.inviteFallbackReason ? (
                      <div style={{ backgroundColor: '#fff7ed', border: '1px solid #fdba74', borderRadius: '4px', padding: '10px 12px', color: '#9a3412', fontSize: '13px' }}>
                        {createdCredentials.inviteFallbackReason}
                      </div>
                    ) : null}
                    {passwordSetupState.message ? (
                      <div style={{ backgroundColor: passwordSetupState.status === 'error' ? '#fef2f2' : '#f0fdf4', border: `1px solid ${passwordSetupState.status === 'error' ? '#fca5a5' : '#86efac'}`, borderRadius: '4px', padding: '10px 12px', color: passwordSetupState.status === 'error' ? '#dc2626' : '#166534', fontSize: '13px' }}>
                        {passwordSetupState.message}
                      </div>
                    ) : null}
                    {copiedTemporaryPassword ? (
                      <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #86efac', borderRadius: '4px', padding: '10px 12px', color: '#166534', fontSize: '13px' }}>
                        Temporary password copied.
                      </div>
                    ) : null}
                  </div>
                  <div style={{ padding: '12px 16px', borderTop: '1px solid #d9e2ec', display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
                    {createdCredentials.temporaryPassword ? (
                      <button onClick={handleCopyTemporaryPassword} style={{ height: '32px', padding: '0 12px', backgroundColor: '#e0f2fe', color: '#075985', border: 'none', borderRadius: '4px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>
                        Copy temporary password
                      </button>
                    ) : null}
                    <button
                      onClick={handleSendPasswordSetup}
                      disabled={passwordSetupState.status === 'sending' || Date.now() < passwordSetupCooldownUntil}
                      style={{ height: '32px', padding: '0 12px', backgroundColor: '#1d57d8', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 600, cursor: passwordSetupState.status === 'sending' || Date.now() < passwordSetupCooldownUntil ? 'not-allowed' : 'pointer', fontSize: '13px' }}
                    >
                      {passwordSetupState.status === 'sending'
                        ? 'Sending...'
                        : Date.now() < passwordSetupCooldownUntil
                          ? `Retry in ${Math.ceil((passwordSetupCooldownUntil - Date.now()) / 1000)}s`
                          : 'Send password setup email'}
                    </button>
                    <button onClick={closeModal} style={{ height: '32px', padding: '0 12px', backgroundColor: '#35a853', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>Done</button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ padding: '16px', display: 'grid', gap: '8px' }}>
                    {error && <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '4px', padding: '8px 12px', color: '#dc2626', fontSize: '13px' }}>{error}</div>}
                    <div><label style={labelStyle}>Full Name *</label><input style={inputStyle} value={formData.display_name} onChange={e => setFormData({...formData, display_name: e.target.value})} placeholder="John Smith" /></div>
                    <div>
                      <label style={labelStyle}>Company</label>
                      <input
                        style={{ ...inputStyle, backgroundColor: '#f5f7fa', color: '#5f6368' }}
                        value={companies[0]?.name ?? 'Company linked to your account'}
                        disabled
                        readOnly
                      />
                    </div>
                    <div><label style={labelStyle}>Email *</label><input style={inputStyle} type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="driver@email.com" /></div>
                    <div><label style={labelStyle}>Phone</label><input style={inputStyle} value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="07123456789" /></div>
                  </div>
                  <div style={{ padding: '12px 16px', borderTop: '1px solid #d9e2ec', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button onClick={closeModal} disabled={creating} style={{ height: '32px', padding: '0 16px', backgroundColor: 'white', color: '#202124', border: '1px solid #d9e2ec', borderRadius: '4px', cursor: creating ? 'not-allowed' : 'pointer', fontSize: '13px' }}>Cancel</button>
                    <button onClick={handleCreate} disabled={creating} style={{ height: '32px', padding: '0 16px', backgroundColor: '#35a853', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 600, cursor: creating ? 'not-allowed' : 'pointer', fontSize: '13px' }}>{creating ? 'Creating...' : 'Add Driver'}</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Edit Driver Modal */}
        {editingDriver && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
            <div style={{ backgroundColor: 'white', borderRadius: '4px', border: '1px solid #d9e2ec', width: '90%', maxWidth: '480px', maxHeight: '90vh', overflow: 'auto' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #d9e2ec', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#202124', lineHeight: '22px' }}>Edit Driver</h2>
                <button onClick={() => setEditingDriver(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#5f6368', lineHeight: 1 }}>×</button>
              </div>
              <div style={{ padding: '16px', display: 'grid', gap: '8px' }}>
                {editError && <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '4px', padding: '8px 12px', color: '#dc2626', fontSize: '13px' }}>{editError}</div>}
                <div><label style={labelStyle}>Full Name *</label><input style={inputStyle} value={editData.display_name} onChange={e => setEditData({...editData, display_name: e.target.value})} /></div>
                <div><label style={labelStyle}>Phone</label><input style={inputStyle} value={editData.phone} onChange={e => setEditData({...editData, phone: e.target.value})} /></div>
                <div>
                  <label style={labelStyle}>Status</label>
                  <select style={inputStyle} value={editData.status} onChange={e => setEditData({...editData, status: e.target.value})}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#202124' }}>
                  <input
                    type="checkbox"
                    id="app_access"
                    checked={editData.app_access}
                    onChange={e => setEditData({...editData, app_access: e.target.checked})}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  App Access (driver can log in to driver portal)
                </label>
              </div>
              <div style={{ padding: '12px 16px', borderTop: '1px solid #d9e2ec', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button onClick={() => setEditingDriver(null)} disabled={saving} style={{ height: '32px', padding: '0 16px', backgroundColor: 'white', color: '#202124', border: '1px solid #d9e2ec', borderRadius: '4px', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '13px' }}>Cancel</button>
                <button onClick={handleUpdate} disabled={saving} style={{ height: '32px', padding: '0 16px', backgroundColor: '#1d57d8', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontSize: '13px' }}>{saving ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </div>
          </div>
        )}
      </OperationalPageLayout>
    </ProtectedRoute>
  );
}
