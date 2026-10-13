'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

import ProtectedRoute from '../../../components/ProtectedRoute';
import { useAuth } from '../../../components/AuthContext';
import { useAdminCompanyContext } from '../../_hooks/useAdminCompanyContext';
import { getAccessToken } from '../../_lib/getAccessToken';
import { AlertBanner, EmptyState, OperationalTable, StatusBadge } from '../../../components/workspace/WorkspaceUI';

type ManagerRow = {
  id: string;
  user_id: string | null;
  invited_email: string | null;
  role_in_company: string;
  status: string;
  created_at: string | null;
};

export default function FleetManagersPage() {
  const { user } = useAuth();
  const { companyId, companyResolved, companyError } = useAdminCompanyContext();
  const canManage = user?.membershipRole === 'owner' || user?.membershipRole === 'admin';
  const [managers, setManagers] = useState<ManagerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ displayName: '', email: '', phone: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (!companyResolved) return;
    if (!companyId || !canManage) {
      setManagers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { accessToken, error: tokenError } = await getAccessToken();
      if (!accessToken) {
        setError(tokenError ?? 'Session expired. Sign in again.');
        return;
      }
      const response = await fetch(`/api/admin/fleet/managers?companyId=${encodeURIComponent(companyId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({})) as { managers?: ManagerRow[]; error?: string };
      if (!response.ok) {
        setError(payload.error ?? 'Fleet Managers could not be loaded.');
        return;
      }
      setManagers(payload.managers ?? []);
    } finally {
      setLoading(false);
    }
  }, [canManage, companyId, companyResolved]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!companyId || !canManage || saving) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const { accessToken, error: tokenError } = await getAccessToken();
      if (!accessToken) {
        setError(tokenError ?? 'Session expired. Sign in again.');
        return;
      }
      const response = await fetch('/api/admin/fleet/managers', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyId,
          displayName: form.displayName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
        }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string; inviteSent?: boolean };
      if (!response.ok) {
        setError(payload.error ?? 'Fleet Manager could not be added.');
        return;
      }
      setNotice(payload.inviteSent ? 'Fleet Manager invited.' : 'Existing account linked as Fleet Manager.');
      setForm({ displayName: '', email: '', phone: '' });
      await load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute>
      <main className="carrier-register-page carrier-register-page--fleet-managers">
        <div className="carrier-register-content">
          <header className="carrier-register-toolbar">
            <div>
              <p className="carrier-register-eyebrow">Fleet administration</p>
              <h1 className="carrier-register-title">Fleet Managers</h1>
              <p className="carrier-register-subtitle">
                Delegate fleet allocation, drivers, vehicles, live positions, returns, compliance and operational finance visibility without company-owner controls.
              </p>
            </div>
          </header>

          {companyError ? <AlertBanner tone="warning">{companyError}</AlertBanner> : null}
          {!canManage && companyResolved ? <AlertBanner tone="info">Only company owners and admins can add or manage Fleet Manager accounts.</AlertBanner> : null}
          {error ? <AlertBanner tone="danger">{error}</AlertBanner> : null}
          {notice ? <AlertBanner tone="success">{notice}</AlertBanner> : null}

          {canManage ? (
            <form onSubmit={submit} className="carrier-register-manager-form">
              <input className="carrier-register-manager-input" placeholder="Full name" value={form.displayName} onChange={(e) => setForm((current) => ({ ...current, displayName: e.target.value }))} required />
              <input className="carrier-register-manager-input" type="email" placeholder="Email" value={form.email} onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))} required />
              <input className="carrier-register-manager-input" placeholder="Phone (optional)" value={form.phone} onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))} />
              <button className="carrier-register-action" type="submit" disabled={saving || !companyId}>
                {saving ? 'Adding…' : 'Add Fleet Manager'}
              </button>
            </form>
          ) : null}

          <section className="carrier-register-results" aria-label="Fleet Manager roster">
            <div className="carrier-register-results__header">
              <h2>Fleet Manager roster</h2>
            </div>
            <div className="carrier-register-table-wrap">
              <OperationalTable<ManagerRow>
                columns={[
                  { id: 'email', header: 'Email', cell: (manager) => <strong>{manager.invited_email ?? '—'}</strong> },
                  { id: 'role', header: 'Role', cell: () => 'Fleet Manager' },
                  { id: 'status', header: 'Status', cell: (manager) => <StatusBadge value={manager.status} /> },
                  { id: 'account', header: 'Account', cell: (manager) => manager.user_id ? 'Linked' : 'Pending' },
                  { id: 'created', header: 'Created', cell: (manager) => manager.created_at ? new Date(manager.created_at).toLocaleDateString('en-GB') : '—' },
                ]}
                rows={managers}
                getRowKey={(manager) => manager.id}
                loading={loading}
                empty={<EmptyState title="No Fleet Managers have been added yet" />}
              />
            </div>
          </section>
        </div>
      </main>
    </ProtectedRoute>
  );
}
