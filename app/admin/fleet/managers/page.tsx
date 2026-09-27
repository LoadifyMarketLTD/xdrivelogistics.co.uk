'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

import ProtectedRoute from '../../../components/ProtectedRoute';
import { useAuth } from '../../../components/AuthContext';
import { useAdminCompanyContext } from '../../_hooks/useAdminCompanyContext';
import { getAccessToken } from '../../_lib/getAccessToken';

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
      <main className="min-h-screen bg-[#F4F6F8] p-4 md:p-6">
        <div className="mx-auto max-w-6xl space-y-5">
          <header className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-widest text-[#F5A300]">Fleet administration</p>
            <h1 className="mt-1 text-2xl font-black text-[#0A234F]">Fleet Managers</h1>
            <p className="mt-2 text-sm font-medium text-[#4B5563]">
              Delegate fleet allocation, drivers, vehicles, live positions, returns, compliance and operational finance visibility without company-owner controls.
            </p>
          </header>

          {companyError ? <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-900">{companyError}</div> : null}
          {!canManage && companyResolved ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-900">
              Only company owners and admins can add or manage Fleet Manager accounts.
            </div>
          ) : null}
          {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">{error}</div> : null}
          {notice ? <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800">{notice}</div> : null}

          {canManage ? (
            <form onSubmit={submit} className="grid gap-3 rounded-2xl bg-white p-5 shadow-sm md:grid-cols-4">
              <input className="h-11 rounded-xl border border-slate-300 px-3 text-sm" placeholder="Full name" value={form.displayName} onChange={(e) => setForm((current) => ({ ...current, displayName: e.target.value }))} required />
              <input className="h-11 rounded-xl border border-slate-300 px-3 text-sm" type="email" placeholder="Email" value={form.email} onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))} required />
              <input className="h-11 rounded-xl border border-slate-300 px-3 text-sm" placeholder="Phone (optional)" value={form.phone} onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))} />
              <button className="h-11 rounded-xl bg-[#0E3FA9] px-4 text-sm font-black text-white disabled:opacity-50" type="submit" disabled={saving || !companyId}>
                {saving ? 'Adding…' : 'Add Fleet Manager'}
              </button>
            </form>
          ) : null}

          <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="font-black text-[#0A234F]">Fleet Manager roster</h2>
            </div>
            {loading ? (
              <div className="p-8 text-sm text-slate-500">Loading Fleet Managers…</div>
            ) : managers.length === 0 ? (
              <div className="p-8 text-sm text-slate-500">No Fleet Managers have been added yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr><th className="px-5 py-3">Email</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Account</th><th className="px-5 py-3">Created</th></tr>
                  </thead>
                  <tbody>
                    {managers.map((manager) => (
                      <tr key={manager.id} className="border-t border-slate-100">
                        <td className="px-5 py-4 font-bold text-[#0A234F]">{manager.invited_email ?? '—'}</td>
                        <td className="px-5 py-4">Fleet Manager</td>
                        <td className="px-5 py-4">{manager.status}</td>
                        <td className="px-5 py-4">{manager.user_id ? 'Linked' : 'Pending'}</td>
                        <td className="px-5 py-4">{manager.created_at ? new Date(manager.created_at).toLocaleDateString('en-GB') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>
    </ProtectedRoute>
  );
}
