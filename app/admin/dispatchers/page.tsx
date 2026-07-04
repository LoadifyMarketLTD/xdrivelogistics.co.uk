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
  }, [companyResolved, companyId]); // eslint-disable-line react-hooks/exhaustive-deps

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
      <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', padding: '1rem' }}>
        <div style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h1 style={{ fontSize: '2rem', fontWeight: '700', color: '#1f2937', margin: 0 }}>Dispatchers</h1>
              <p style={{ color: '#6b7280', margin: '0.5rem 0 0 0' }}>Invite and recover dispatcher access for your company team</p>
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
              style={{ padding: '0.75rem 1.5rem', backgroundColor: !companyResolved || !companyId || !canManageDispatchers ? '#9ca3af' : '#1F7A3D', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.95rem', fontWeight: '600', cursor: !companyResolved || !companyId || !canManageDispatchers ? 'not-allowed' : 'pointer' }}
            >
              + Add Dispatcher
            </button>
          </div>

          {companyResolved && companyId && !canManageDispatchers ? (
            <div style={{ backgroundColor: '#eff6ff', border: '1px solid #93c5fd', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', color: '#1d4ed8' }}>
              Only company owners and admins can onboard dispatcher accounts.
            </div>
          ) : null}

          {companyError && (
            <div style={{ backgroundColor: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', color: '#92400e' }}>
              {companyError}
            </div>
          )}

          {!isSupabaseConfigured && (
            <div style={{ backgroundColor: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', color: '#92400e' }}>
              ⚠️ Supabase is not configured. Database features are disabled.
            </div>
          )}

          <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            {!companyResolved || loading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>Loading...</div>
            ) : !companyId ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
                <p>Company profile not available. Dispatcher onboarding is hidden until company access resolves.</p>
              </div>
            ) : dispatchers.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎛️</div>
                <p>No dispatchers onboarded yet. Add your first dispatcher.</p>
              </div>
            ) : (
              <>
              <div style={{ overflowX: 'auto', width: '100%' }}>
                <table style={{ width: '100%', minWidth: '760px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                      {['Email', 'Role', 'Status', 'Linked User', 'Created'].map((heading) => (
                        <th key={heading} style={{ padding: '1rem', textAlign: 'left', fontSize: '0.85rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedDispatchers.map((dispatcher, index) => (
                      <tr key={dispatcher.id} style={{ borderBottom: index < paginatedDispatchers.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                        <td style={{ padding: '1rem', color: '#1f2937', fontWeight: 600 }}>{dispatcher.invited_email ?? '—'}</td>
                        <td style={{ padding: '1rem', color: '#6b7280' }}>Dispatcher</td>
                        <td style={{ padding: '1rem' }}>
                          <span style={{ backgroundColor: dispatcher.status === 'active' ? '#d1fae5' : '#fee2e2', color: dispatcher.status === 'active' ? '#166534' : '#991b1b', padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600' }}>
                            {dispatcher.status}
                          </span>
                        </td>
                        <td style={{ padding: '1rem', color: '#6b7280' }}>{dispatcher.user_id ? 'Linked' : 'Pending link'}</td>
                        <td style={{ padding: '1rem', color: '#6b7280' }}>{formatDate(dispatcher.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {dispatchers.length > DISPATCHERS_PER_PAGE && (
                <div style={{ borderTop: '1px solid #e5e7eb', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: '#6b7280' }}>
                  <span>
                    Showing {safeDispatcherPage * DISPATCHERS_PER_PAGE + 1}–{Math.min((safeDispatcherPage + 1) * DISPATCHERS_PER_PAGE, dispatchers.length)} of {dispatchers.length}
                  </span>
                  <div style={{ display: 'flex', gap: '0.45rem' }}>
                    <button
                      onClick={() => setDispatcherPage((prev) => Math.max(prev - 1, 0))}
                      disabled={safeDispatcherPage === 0}
                      style={{ padding: '0.3rem 0.7rem', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: safeDispatcherPage === 0 ? '#f9fafb' : '#fff', cursor: safeDispatcherPage === 0 ? 'not-allowed' : 'pointer' }}
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setDispatcherPage((prev) => Math.min(prev + 1, totalDispatcherPages - 1))}
                      disabled={safeDispatcherPage >= totalDispatcherPages - 1}
                      style={{ padding: '0.3rem 0.7rem', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: safeDispatcherPage >= totalDispatcherPages - 1 ? '#f9fafb' : '#fff', cursor: safeDispatcherPage >= totalDispatcherPages - 1 ? 'not-allowed' : 'pointer' }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
              </>
            )}
          </div>
        </div>

        {showModal && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
            <div style={{ backgroundColor: 'white', borderRadius: '12px', width: '90%', maxWidth: '520px', maxHeight: '90vh', overflow: 'auto' }}>
              <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#1f2937' }}>Add Dispatcher</h2>
                <button onClick={closeModal} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}>×</button>
              </div>

              {createdDispatcher ? (
                <>
                  <div style={{ padding: '1.5rem', display: 'grid', gap: '0.9rem' }}>
                    <div style={{ backgroundColor: createdDispatcher.onboardingOutcome === 'invite_sent' ? '#ecfdf3' : '#eff6ff', border: `1px solid ${createdDispatcher.onboardingOutcome === 'invite_sent' ? '#86efac' : '#93c5fd'}`, borderRadius: '8px', padding: '0.9rem', color: createdDispatcher.onboardingOutcome === 'invite_sent' ? '#166534' : '#1d4ed8', fontSize: '0.9rem' }}>
                      {createdDispatcher.onboardingOutcome === 'invite_sent'
                        ? 'Dispatcher invited successfully. A password setup email was sent.'
                        : createdDispatcher.onboardingOutcome === 'temporary_password_created'
                        ? 'Dispatcher created with a temporary password because invite delivery failed.'
                        : 'Dispatcher account linked without sending a fresh invite.'}
                    </div>

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
                      <div style={{ backgroundColor: '#fff7ed', border: '1px solid #fdba74', borderRadius: '8px', padding: '0.9rem', color: '#9a3412', fontSize: '0.85rem', lineHeight: 1.6 }}>
                        <strong>Next action:</strong> copy the temporary password now, share it securely with the dispatcher, and require an immediate password change on first sign-in.
                      </div>
                    ) : (
                      <div style={{ backgroundColor: '#eff6ff', border: '1px solid #93c5fd', borderRadius: '8px', padding: '0.9rem', color: '#1d4ed8', fontSize: '0.85rem', lineHeight: 1.6 }}>
                        <strong>Next action:</strong> ask the dispatcher to open their password setup email. If they need a fresh message, use the password setup action below.
                      </div>
                    )}

                    {createdDispatcher.inviteFallbackReason ? (
                      <div style={{ backgroundColor: '#fff7ed', border: '1px solid #fdba74', borderRadius: '8px', padding: '0.9rem', color: '#9a3412', fontSize: '0.85rem' }}>
                        {createdDispatcher.inviteFallbackReason}
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
                    {createdDispatcher.temporaryPassword ? (
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
                    <button onClick={closeModal} style={{ padding: '0.75rem 1rem', backgroundColor: '#1F7A3D', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>
                      Done
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
                    {error ? <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '0.75rem', color: '#dc2626', fontSize: '0.9rem' }}>{error}</div> : null}
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
                  <div style={{ padding: '1.5rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                    <button onClick={closeModal} disabled={creating} style={{ padding: '0.75rem 1.5rem', backgroundColor: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', cursor: creating ? 'not-allowed' : 'pointer' }}>Cancel</button>
                    <button onClick={handleCreate} disabled={creating} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#1F7A3D', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: creating ? 'not-allowed' : 'pointer' }}>{creating ? 'Creating...' : 'Add Dispatcher'}</button>
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
