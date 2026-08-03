'use client';

import { useEffect, useState } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import type { CompanyMembership } from '../../../lib/types/database';
import { getMissingColumnFromError, selectWithMissingColumnFallback } from '../../../lib/supabaseSchemaCompat';
import { useAdminCompanyContext } from '../_hooks/useAdminCompanyContext';
import { usePasswordSetup } from '../_hooks/usePasswordSetup';
import { getAccessToken } from '../_lib/getAccessToken';
import { PageHeader, ActionButton, AlertBanner, StatusBadge } from '../../components/workspace/WorkspaceUI';
import cssStyles from '../../components/workspace/WorkspaceUI.module.css';

type DispatcherMembership = Pick<
  CompanyMembership,
  'id' | 'company_id' | 'user_id' | 'invited_email' | 'role_in_company' | 'status' | 'created_at'
>;

const DISPATCHER_SELECT_COLUMNS = ['id', 'company_id', 'user_id', 'invited_email', 'role_in_company', 'status', 'created_at'];

export default function DispatchersPage() {
  const { user } = useAuth();
  const { companyId, companyResolved, companyError } = useAdminCompanyContext();
  const canManageDispatchers = user?.membershipRole === 'owner' || user?.membershipRole === 'admin';
  const [companyName, setCompanyName] = useState('Company linked to your account');
  const [dispatchers, setDispatchers] = useState<DispatcherMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ display_name: '', phone: '', email: '' });
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const DISPATCHERS_PER_PAGE = 12;
  const [dispatcherPage, setDispatcherPage] = useState(0);

  const {
    credentials: createdDispatcher,
    setCredentials: setCreatedDispatcher,
    copiedTemporaryPassword,
    setCopiedTemporaryPassword,
    passwordSetupState,
    setPasswordSetupState,
    passwordSetupCooldownUntil,
    resetSetupState,
    handleCopyTemporaryPassword,
    handleSendPasswordSetup,
  } = usePasswordSetup({ endpoint: '/api/admin/dispatchers', companyId, membershipId: user?.membershipId });

  const loadDispatchers = async (resolvedCompanyId: string) => {
    setLoading(true);
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let orderByCreatedAt = true;
    const { rows, error: queryError } = await selectWithMissingColumnFallback<DispatcherMembership>({
      table: 'company_memberships',
      columns: DISPATCHER_SELECT_COLUMNS,
      execute: async (activeColumns) => {
        let query = supabase
          .from('company_memberships')
          .select(activeColumns.join(', '))
          .eq('company_id', resolvedCompanyId)
          .eq('role_in_company', 'dispatcher');

        if (orderByCreatedAt) {
          query = query.order('created_at', { ascending: false });
        }

        const result = await query;
        return {
          data: (result.data ?? []) as unknown as DispatcherMembership[],
          error: result.error,
        };
      },
      onError: (queryErr) => {
        const missingColumn = getMissingColumnFromError(queryErr, 'company_memberships');
        if (missingColumn === 'created_at' && orderByCreatedAt) {
          orderByCreatedAt = false;
          return true;
        }
        return false;
      },
    });

    if (queryError) {
      console.error('Failed to load dispatchers:', queryError.message);
      setDispatchers([]);
    } else {
      setDispatchers(rows);
    }

    setLoading(false);
  };

  const loadCompanyName = async (resolvedCompanyId: string) => {
    if (!isSupabaseConfigured) return;

    const { rows, error: queryError } = await selectWithMissingColumnFallback<Record<string, unknown>>({
      table: 'companies',
      columns: ['id', 'name'],
      execute: async (activeColumns) => {
        const result = await supabase
          .from('companies')
          .select(activeColumns.join(', '))
          .eq('id', resolvedCompanyId)
          .limit(1);

        return {
          data: ((result.data ?? []) as unknown) as Record<string, unknown>[],
          error: result.error,
        };
      },
    });

    if (queryError) {
      console.error('Failed to load company:', queryError.message);
      return;
    }

    const name = rows[0]?.name;
    if (typeof name === 'string' && name.trim()) {
      setCompanyName(name.trim());
    }
  };

  useEffect(() => {
    if (!companyResolved) return;
    if (!companyId) {
      setDispatchers([]);
      setLoading(false);
      return;
    }

    void Promise.all([loadDispatchers(companyId), loadCompanyName(companyId)]);
  }, [companyResolved, companyId]);

  const handleCreate = async () => {
    if (!formData.display_name.trim()) {
      setError('Dispatcher name is required');
      return;
    }
    if (!formData.email.trim()) {
      setError('Dispatcher email is required');
      return;
    }
    if (!companyId) {
      setError('Company profile is required');
      return;
    }
    if (!isSupabaseConfigured) {
      setError('Supabase is not configured');
      return;
    }

    setCreating(true);
    try {
      const { accessToken, error: accessTokenError } = await getAccessToken();
      if (accessTokenError || !accessToken) {
        setError(accessTokenError ?? 'Session expired. Please sign in again.');
        return;
      }

      const response = await fetch('/api/admin/dispatchers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + accessToken,
        },
        body: JSON.stringify({
          companyId,
          membershipId: user?.membershipId ?? null,
          displayName: formData.display_name.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim() || null,
        }),
      });

      const payload = await response.json().catch(() => ({} as {
        error?: string;
        onboardingOutcome?: 'invite_sent' | 'password_setup_required' | 'temporary_password_created';
        temporaryPassword?: string | null;
        inviteFallbackReason?: string | null;
      }));

      if (!response.ok) {
        setError(payload.error || 'Failed to create dispatcher account.');
        return;
      }

      setCreatedDispatcher({
        displayName: formData.display_name.trim(),
        email: formData.email.trim().toLowerCase(),
        temporaryPassword: payload.temporaryPassword ?? null,
        inviteFallbackReason: payload.inviteFallbackReason ?? null,
        onboardingOutcome: payload.onboardingOutcome ?? 'invite_sent',
      });
      setCopiedTemporaryPassword(false);
      setPasswordSetupState({ status: 'idle', message: '' });
      setFormData({ display_name: '', phone: '', email: '' });
      setError('');
      await loadDispatchers(companyId);
    } finally {
      setCreating(false);
    }
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

  useEffect(() => {
    setDispatcherPage(0);
  }, [dispatchers.length]);
  const totalDispatcherPages = Math.max(1, Math.ceil(dispatchers.length / DISPATCHERS_PER_PAGE));
  const safeDispatcherPage = Math.min(dispatcherPage, totalDispatcherPages - 1);
  const paginatedDispatchers = dispatchers.slice(
    safeDispatcherPage * DISPATCHERS_PER_PAGE,
    (safeDispatcherPage + 1) * DISPATCHERS_PER_PAGE,
  );

  return (
    <ProtectedRoute>
      <PageHeader
        title="Dispatchers"
        description="Invite and recover dispatcher access for your company team"
        actions={
          <ActionButton
            tone="primary"
            disabled={!companyResolved || !companyId || !canManageDispatchers}
            onClick={() => {
              setCreatedDispatcher(null);
              setCopiedTemporaryPassword(false);
              setPasswordSetupState({ status: 'idle', message: '' });
              setError('');
              setShowModal(true);
            }}
          >
            + Add Dispatcher
          </ActionButton>
        }
      />

      {companyResolved && companyId && !canManageDispatchers && (
        <AlertBanner tone="info">Only company owners and admins can onboard dispatcher accounts.</AlertBanner>
      )}
      {companyError && <AlertBanner tone="warning">{companyError}</AlertBanner>}
      {!isSupabaseConfigured && <AlertBanner tone="warning">⚠️ Supabase is not configured. Database features are disabled.</AlertBanner>}

      <div className={cssStyles.operationalTableContainer}>
        {!companyResolved || loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#5f6368', fontSize: '12px' }}>Loading…</div>
        ) : !companyId ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#5f6368', fontSize: '12px' }}>
            <p style={{ margin: 0 }}>Company profile not available. Dispatcher onboarding is hidden until company access resolves.</p>
          </div>
        ) : dispatchers.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#5f6368', fontSize: '12px' }}>
            <p style={{ margin: 0 }}>No dispatchers onboarded yet. Add your first dispatcher.</p>
          </div>
        ) : (
          <>
            <div className={cssStyles.operationalTableScroll}>
              <table className={cssStyles.operationalTable} style={{ minWidth: '760px' }}>
                <caption className={cssStyles.operationalTableCaption}>Dispatchers</caption>
                <thead>
                  <tr className={cssStyles.operationalTableHeaderRow}>
                    {['Email', 'Role', 'Status', 'Linked User', 'Created'].map((heading) => (
                      <th key={heading} scope="col" className={cssStyles.operationalTableHeadCell}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedDispatchers.map((dispatcher) => (
                    <tr key={dispatcher.id} className={cssStyles.operationalTableRow}>
                      <td className={cssStyles.operationalTableCell} style={{ fontWeight: 600 }}>{dispatcher.invited_email ?? '—'}</td>
                      <td className={cssStyles.operationalTableCell}>Dispatcher</td>
                      <td className={cssStyles.operationalTableCell}>
                        <StatusBadge value={dispatcher.status} tone={dispatcher.status === 'active' ? 'green' : 'red'} />
                      </td>
                      <td className={cssStyles.operationalTableCell}>{dispatcher.user_id ? 'Linked' : 'Pending link'}</td>
                      <td className={cssStyles.operationalTableCell}>{formatDate(dispatcher.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {dispatchers.length > DISPATCHERS_PER_PAGE && (
              <div className={cssStyles.operationalTableMeta}>
                <span>
                  Showing {safeDispatcherPage * DISPATCHERS_PER_PAGE + 1}–{Math.min((safeDispatcherPage + 1) * DISPATCHERS_PER_PAGE, dispatchers.length)} of {dispatchers.length}
                </span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <ActionButton tone="secondary" disabled={safeDispatcherPage === 0} onClick={() => setDispatcherPage((prev) => Math.max(prev - 1, 0))}>Previous</ActionButton>
                  <ActionButton tone="secondary" disabled={safeDispatcherPage >= totalDispatcherPages - 1} onClick={() => setDispatcherPage((prev) => Math.min(prev + 1, totalDispatcherPages - 1))}>Next</ActionButton>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '4px', border: '1px solid #d9e2ec', width: '90%', maxWidth: '480px', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid #d9e2ec', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '40px' }}>
              <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#202124' }}>Add Dispatcher</h2>
              <button type="button" onClick={closeModal} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#5f6368', lineHeight: 1, padding: '0 4px' }} aria-label="Close">×</button>
            </div>

            {createdDispatcher ? (
              <>
                <div style={{ padding: '12px 16px', display: 'grid', gap: '8px' }}>
                  <AlertBanner tone={createdDispatcher.onboardingOutcome === 'invite_sent' ? 'success' : 'info'}>
                    {createdDispatcher.onboardingOutcome === 'invite_sent'
                      ? 'Dispatcher invited successfully. A password setup email was sent.'
                      : createdDispatcher.onboardingOutcome === 'temporary_password_created'
                      ? 'Dispatcher created with a temporary password because invite delivery failed.'
                      : 'Dispatcher account linked without sending a fresh invite.'}
                  </AlertBanner>

                  <div style={{ fontSize: '12px', color: '#334155', lineHeight: 1.6 }}>
                    <strong>Dispatcher:</strong> {createdDispatcher.displayName}<br />
                    <strong>Email:</strong> {createdDispatcher.email}
                    {createdDispatcher.temporaryPassword ? (<><br /><strong>Temporary password:</strong> {createdDispatcher.temporaryPassword}</>) : null}
                  </div>

                  {createdDispatcher.onboardingOutcome === 'temporary_password_created' ? (
                    <AlertBanner tone="warning"><strong>Next action:</strong> copy the temporary password now, share it securely with the dispatcher, and require an immediate password change on first sign-in.</AlertBanner>
                  ) : (
                    <AlertBanner tone="info"><strong>Next action:</strong> ask the dispatcher to open their password setup email. If they need a fresh message, use the password setup action below.</AlertBanner>
                  )}

                  {createdDispatcher.inviteFallbackReason && (
                    <AlertBanner tone="warning">{createdDispatcher.inviteFallbackReason}</AlertBanner>
                  )}

                  {passwordSetupState.message && (
                    <AlertBanner tone={passwordSetupState.status === 'error' ? 'danger' : 'success'}>{passwordSetupState.message}</AlertBanner>
                  )}

                  {copiedTemporaryPassword && (
                    <AlertBanner tone="success">Temporary password copied.</AlertBanner>
                  )}
                </div>

                <div style={{ padding: '8px 16px', borderTop: '1px solid #d9e2ec', display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
                  {createdDispatcher.temporaryPassword && (
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
                  <ActionButton tone="primary" onClick={closeModal}>Done</ActionButton>
                </div>
              </>
            ) : (
              <>
                <div style={{ padding: '12px 16px', display: 'grid', gap: '8px' }}>
                  {error && <AlertBanner tone="danger">{error}</AlertBanner>}
                  <div className={cssStyles.settingsFieldRow}>
                    <label className={cssStyles.settingsLabel}>Full Name *</label>
                    <input className={cssStyles.settingsInput} value={formData.display_name} onChange={(event) => setFormData({ ...formData, display_name: event.target.value })} placeholder="Alex Dispatcher" />
                  </div>
                  <div className={cssStyles.settingsFieldRow}>
                    <label className={cssStyles.settingsLabel}>Company</label>
                    <input className={`${cssStyles.settingsInput} ${cssStyles.settingsInputReadonly}`} value={companyName} disabled readOnly />
                  </div>
                  <div className={cssStyles.settingsFieldRow}>
                    <label className={cssStyles.settingsLabel}>Email *</label>
                    <input type="email" className={cssStyles.settingsInput} value={formData.email} onChange={(event) => setFormData({ ...formData, email: event.target.value })} placeholder="dispatcher@email.com" />
                  </div>
                  <div className={cssStyles.settingsFieldRow}>
                    <label className={cssStyles.settingsLabel}>Phone</label>
                    <input className={cssStyles.settingsInput} value={formData.phone} onChange={(event) => setFormData({ ...formData, phone: event.target.value })} placeholder="07123456789" />
                  </div>
                </div>
                <div style={{ padding: '8px 16px', borderTop: '1px solid #d9e2ec', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <ActionButton tone="secondary" disabled={creating} onClick={closeModal}>Cancel</ActionButton>
                  <ActionButton tone="primary" disabled={creating} onClick={handleCreate}>{creating ? 'Creating…' : 'Add Dispatcher'}</ActionButton>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
