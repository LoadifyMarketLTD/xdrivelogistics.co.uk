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
import { ActionButton, AlertBanner, EmptyState, OperationalTable, StatusBadge } from '../../components/workspace/WorkspaceUI';

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

  const inputStyle = {
    width: '100%',
    padding: '0.75rem',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '0.95rem',
    boxSizing: 'border-box' as const,
  };
  const labelStyle = {
    display: 'block',
    fontSize: '0.9rem',
    fontWeight: '500' as const,
    color: '#374151',
    marginBottom: '0.5rem',
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
      <div className="carrier-register-page carrier-register-page--dispatchers">
        <div style={{ width: '100%' }}>
          <div className="carrier-register-toolbar">
            <div>
              <h1 className="carrier-register-title">Dispatchers</h1>
              <p className="carrier-register-subtitle">Invite and recover dispatcher access for your company team</p>
            </div>
            <button
              onClick={() => {
                setCreatedDispatcher(null);
                setCopiedTemporaryPassword(false);
                setPasswordSetupState({ status: 'idle', message: '' });
                setError('');
                setShowModal(true);
              }}
              disabled={!companyResolved || !companyId || !canManageDispatchers}
              className="carrier-register-action"
            >
              + Add Dispatcher
            </button>
          </div>

          {companyResolved && companyId && !canManageDispatchers ? <AlertBanner tone="info">Only company owners and admins can onboard dispatcher accounts.</AlertBanner> : null}

          {companyError ? <AlertBanner tone="warning">{companyError}</AlertBanner> : null}

          {!isSupabaseConfigured ? <AlertBanner tone="warning">Supabase is not configured. Database features are disabled.</AlertBanner> : null}

          <section className="carrier-register-results" aria-label="Dispatcher directory">
            <div className="carrier-register-table-wrap">
              <OperationalTable<DispatcherMembership>
                columns={[
                  { id: 'email', header: 'Email', cell: (dispatcher) => <strong>{dispatcher.invited_email ?? '—'}</strong> },
                  { id: 'role', header: 'Role', cell: () => 'Dispatcher' },
                  { id: 'status', header: 'Status', cell: (dispatcher) => <StatusBadge value={dispatcher.status} /> },
                  { id: 'linked', header: 'Linked User', cell: (dispatcher) => dispatcher.user_id ? 'Linked' : 'Pending link' },
                  { id: 'created', header: 'Created', cell: (dispatcher) => formatDate(dispatcher.created_at) },
                ]}
                rows={companyResolved && companyId ? paginatedDispatchers : []}
                getRowKey={(dispatcher) => dispatcher.id}
                loading={!companyResolved || loading}
                empty={
                  !companyId
                    ? <EmptyState title="Company profile not available" description="Dispatcher onboarding is hidden until company access resolves." />
                    : <EmptyState title="No dispatchers onboarded yet" description="Add your first dispatcher." />
                }
              />
            </div>
            {dispatchers.length > DISPATCHERS_PER_PAGE && (
              <div style={{ minHeight: 'var(--ws-meta-h, 22px)', borderTop: '1px solid var(--ws-border-soft, #e2e7ed)', padding: '4px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--ws-font-meta, 11px)', color: '#64748b' }}>
                <span>Showing {safeDispatcherPage * DISPATCHERS_PER_PAGE + 1}–{Math.min((safeDispatcherPage + 1) * DISPATCHERS_PER_PAGE, dispatchers.length)} of {dispatchers.length}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <ActionButton tone="secondary" onClick={() => setDispatcherPage((prev) => Math.max(prev - 1, 0))} disabled={safeDispatcherPage === 0}>Previous</ActionButton>
                  <ActionButton tone="secondary" onClick={() => setDispatcherPage((prev) => Math.min(prev + 1, totalDispatcherPages - 1))} disabled={safeDispatcherPage >= totalDispatcherPages - 1}>Next</ActionButton>
                </div>
              </div>
            )}
          </section>
        </div>

        {showModal && (
          <div className="carrier-register-modal-overlay">
            <div className="carrier-register-modal" style={{ maxWidth: '520px' }}>
              <div className="carrier-register-modal__header">
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#1f2937' }}>Add Dispatcher</h2>
                <button onClick={closeModal} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}>×</button>
              </div>

              {createdDispatcher ? (
                <>
                  <div className="carrier-register-modal__body">
                    <AlertBanner tone={createdDispatcher.onboardingOutcome === 'invite_sent' ? 'success' : 'info'}>
                      {createdDispatcher.onboardingOutcome === 'invite_sent'
                        ? 'Dispatcher invited successfully. A password setup email was sent.'
                        : createdDispatcher.onboardingOutcome === 'temporary_password_created'
                        ? 'Dispatcher created with a temporary password because invite delivery failed.'
                        : 'Dispatcher account linked without sending a fresh invite.'}
                    </AlertBanner>

                    <div style={{ fontSize: '0.88rem', color: '#334155', lineHeight: 1.6 }}>
                      <strong>Dispatcher:</strong> {createdDispatcher.displayName}
                      <br />
                      <strong>Email:</strong> {createdDispatcher.email}
                      {createdDispatcher.temporaryPassword ? (
                        <>
                          <br />
                          <strong>Temporary password:</strong> {createdDispatcher.temporaryPassword}
                        </>
                      ) : null}
                    </div>

                    {createdDispatcher.onboardingOutcome === 'temporary_password_created' ? (
                      <AlertBanner tone="warning"><strong>Next action:</strong> copy the temporary password now, share it securely with the dispatcher, and require an immediate password change on first sign-in.</AlertBanner>
                    ) : (
                      <AlertBanner tone="info"><strong>Next action:</strong> ask the dispatcher to open their password setup email. If they need a fresh message, use the password setup action below.</AlertBanner>
                    )}

                    {createdDispatcher.inviteFallbackReason ? <AlertBanner tone="warning">{createdDispatcher.inviteFallbackReason}</AlertBanner> : null}

                    {passwordSetupState.message ? <AlertBanner tone={passwordSetupState.status === 'error' ? 'danger' : 'success'}>{passwordSetupState.message}</AlertBanner> : null}

                    {copiedTemporaryPassword ? <AlertBanner tone="success">Temporary password copied.</AlertBanner> : null}
                  </div>

                  <div className="carrier-register-modal__footer">
                    {createdDispatcher.temporaryPassword ? <ActionButton tone="secondary" onClick={handleCopyTemporaryPassword}>Copy temporary password</ActionButton> : null}
                    <ActionButton
                      tone="primary"
                      onClick={handleSendPasswordSetup}
                      disabled={passwordSetupState.status === 'sending' || Date.now() < passwordSetupCooldownUntil}
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
                  <div className="carrier-register-modal__body">
                    {error ? <AlertBanner tone="danger">{error}</AlertBanner> : null}
                    <div>
                      <label style={labelStyle}>Full Name *</label>
                      <input style={inputStyle} value={formData.display_name} onChange={(event) => setFormData({ ...formData, display_name: event.target.value })} placeholder="Alex Dispatcher" />
                    </div>
                    <div>
                      <label style={labelStyle}>Company</label>
                      <input style={{ ...inputStyle, backgroundColor: '#f9fafb', color: '#6b7280' }} value={companyName} disabled readOnly />
                    </div>
                    <div>
                      <label style={labelStyle}>Email *</label>
                      <input style={inputStyle} type="email" value={formData.email} onChange={(event) => setFormData({ ...formData, email: event.target.value })} placeholder="dispatcher@email.com" />
                    </div>
                    <div>
                      <label style={labelStyle}>Phone</label>
                      <input style={inputStyle} value={formData.phone} onChange={(event) => setFormData({ ...formData, phone: event.target.value })} placeholder="07123456789" />
                    </div>
                  </div>
                  <div className="carrier-register-modal__footer">
                    <ActionButton tone="secondary" onClick={closeModal} disabled={creating}>Cancel</ActionButton>
                    <ActionButton tone="success" onClick={handleCreate} disabled={creating}>{creating ? 'Creating…' : 'Add Dispatcher'}</ActionButton>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
