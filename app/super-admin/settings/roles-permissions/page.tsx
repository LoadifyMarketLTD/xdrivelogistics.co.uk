'use client';

import { useCallback, useEffect, useState } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { supabase } from '@/lib/supabaseClient';

const THEME = {
  pageBg: '#0f172a',
  cardBg: '#1e293b',
  cardBorder: '#334155',
  text: '#f1f5f9',
  muted: '#94a3b8',
  accent: '#f59e0b',
};

type RoleDefinition = {
  role: string;
  label: string;
  description: string;
  scopes: string[];
  color: string;
};

const DEFAULT_ROLES: RoleDefinition[] = [
  {
    role: 'owner',
    label: '👑 Platform Owner',
    description: 'Full super-admin access. Can approve/suspend companies, view all data, manage all platform settings.',
    scopes: ['super-admin/*', 'all companies', 'all users', 'all finance', 'all compliance', 'audit logs', 'feature flags'],
    color: '#f59e0b',
  },
  {
    role: 'company_admin',
    label: '🏢 Company Admin',
    description: 'Manages their own company — drivers, vehicles, jobs, invoices, dispatchers.',
    scopes: ['company/drivers', 'company/vehicles', 'company/jobs', 'company/invoices', 'company/dispatchers'],
    color: '#3b82f6',
  },
  {
    role: 'admin_staff',
    label: '👔 Admin Staff',
    description: 'Company staff with administrative access. Can manage jobs and drivers within their company.',
    scopes: ['company/jobs', 'company/drivers', 'company/vehicles'],
    color: '#8b5cf6',
  },
  {
    role: 'dispatcher',
    label: '📡 Dispatcher',
    description: 'Assigns jobs to drivers, monitors active deliveries, manages job workflows.',
    scopes: ['dispatch/jobs', 'dispatch/allocations', 'dispatch/tracking'],
    color: '#06b6d4',
  },
  {
    role: 'driver',
    label: '🚚 Driver',
    description: 'Accepts and manages own job assignments. Can capture POD and update delivery status.',
    scopes: ['driver/jobs', 'driver/pod', 'driver/profile'],
    color: '#22c55e',
  },
  {
    role: 'customer',
    label: '📦 Customer',
    description: 'Can submit quote requests and track their own shipments.',
    scopes: ['quotes/request', 'quotes/track'],
    color: '#94a3b8',
  },
  {
    role: 'viewer',
    label: '👁️ Viewer',
    description: 'Read-only access to assigned company resources.',
    scopes: ['read-only'],
    color: '#475569',
  },
];

export default function Page() {
  const [roles, setRoles] = useState<RoleDefinition[]>(DEFAULT_ROLES);
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [editBuffer, setEditBuffer] = useState<Partial<RoleDefinition>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const getAuthHeader = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    return token ? 'Bearer ' + token : null;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const auth = await getAuthHeader();
    if (!auth) { setLoading(false); return; }
    try {
      const response = await fetch('/api/super-admin/settings?section=roles', {
        headers: { Authorization: auth },
      });
      const payload = (await response.json().catch(() => ({}))) as {
        roles?: RoleDefinition[];
        error?: string;
      };
      if (response.ok && Array.isArray(payload.roles)) {
        setRoles(payload.roles);
      }
    } catch {
      // Fall through to defaults
    }
    setLoading(false);
  }, [getAuthHeader]);

  useEffect(() => {
    void load();
  }, [load]);

  const startEdit = (role: RoleDefinition) => {
    setEditingRole(role.role);
    setEditBuffer({ description: role.description, scopes: [...role.scopes] });
    setNotice('');
    setError('');
  };

  const cancelEdit = () => {
    setEditingRole(null);
    setEditBuffer({});
  };

  const saveRole = async (roleKey: string) => {
    setSaving(true);
    setError('');
    const auth = await getAuthHeader();
    if (!auth) { setError('Session expired.'); setSaving(false); return; }

    const updatedRoles = roles.map((r) =>
      r.role === roleKey ? { ...r, ...editBuffer, scopes: editBuffer.scopes ?? r.scopes } : r
    );

    const response = await fetch('/api/super-admin/settings', {
      method: 'PATCH',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ section: 'roles', roles: updatedRoles }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    setSaving(false);
    if (!response.ok) { setError(payload.error ?? 'Save failed.'); return; }
    setRoles(updatedRoles);
    setEditingRole(null);
    setEditBuffer({});
    setNotice(`Role "${roleKey}" updated successfully.`);
  };

  const addScope = (_roleKey: string) => {
    const scope = window.prompt('New scope (e.g. company/reports):');
    if (!scope?.trim()) return;
    setEditBuffer((prev) => ({ ...prev, scopes: [...(prev.scopes ?? []), scope.trim()] }));
  };

  const removeScope = (index: number) => {
    setEditBuffer((prev) => ({ ...prev, scopes: (prev.scopes ?? []).filter((_, i) => i !== index) }));
  };

  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <div style={{ minHeight: '100vh', backgroundColor: THEME.pageBg, padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '1.5rem' }}>🔐</span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: THEME.text, margin: 0 }}>Roles &amp; Permissions</h1>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: THEME.accent, backgroundColor: 'rgba(245,158,11,0.12)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>Settings</span>
            </div>
            <p style={{ color: THEME.muted, margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
              Platform role model and permission matrix. Click a role card to edit its description and scopes.
            </p>
          </div>
        </div>

        {loading && <p style={{ color: THEME.muted, fontSize: '0.85rem', marginBottom: '1rem' }}>Loading saved role configuration…</p>}
        {error && <div style={{ backgroundColor: 'rgba(220,38,38,0.1)', border: '1px solid #dc2626', color: '#fca5a5', borderRadius: '8px', padding: '0.65rem 0.9rem', marginBottom: '1rem', fontSize: '0.82rem' }}>{error}</div>}
        {notice && <div style={{ backgroundColor: 'rgba(21,128,61,0.15)', border: '1px solid #15803d', color: '#86efac', borderRadius: '8px', padding: '0.65rem 0.9rem', marginBottom: '1rem', fontSize: '0.82rem' }}>{notice}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '0.75rem' }}>
          {roles.map((role) => {
            const isEditing = editingRole === role.role;
            return (
              <div
                key={role.role}
                style={{ backgroundColor: THEME.cardBg, border: `1px solid ${isEditing ? role.color : THEME.cardBorder}`, borderRadius: '10px', padding: '1rem' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '1rem' }}>{role.label.split(' ')[0]}</span>
                  <span style={{ color: role.color, fontWeight: 700, fontSize: '0.88rem' }}>
                    {role.label.split(' ').slice(1).join(' ')}
                  </span>
                  <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', color: '#475569', backgroundColor: '#0b1220', padding: '0.15rem 0.45rem', borderRadius: '3px', marginLeft: 'auto' }}>
                    {role.role}
                  </span>
                </div>

                {isEditing ? (
                  <div style={{ display: 'grid', gap: '0.6rem' }}>
                    <div>
                      <label style={{ display: 'block', color: THEME.muted, fontSize: '0.7rem', fontWeight: 700, marginBottom: '0.25rem' }}>Description</label>
                      <textarea
                        value={editBuffer.description ?? role.description}
                        onChange={(e) => setEditBuffer((prev) => ({ ...prev, description: e.target.value }))}
                        rows={3}
                        style={{ width: '100%', background: '#0b1220', border: '1px solid #475569', color: THEME.text, borderRadius: '6px', padding: '0.45rem 0.6rem', fontSize: '0.78rem', resize: 'vertical' }}
                      />
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <label style={{ color: THEME.muted, fontSize: '0.7rem', fontWeight: 700 }}>Scopes</label>
                        <button type="button" onClick={() => addScope(role.role)} style={{ background: 'none', border: 'none', color: THEME.accent, fontSize: '0.72rem', cursor: 'pointer' }}>+ Add scope</button>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                        {(editBuffer.scopes ?? role.scopes).map((scope, index) => (
                          <span key={index} style={{ fontSize: '0.65rem', backgroundColor: '#0b1220', border: `1px solid ${role.color}33`, color: '#94a3b8', padding: '0.15rem 0.45rem', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            {scope}
                            <button type="button" onClick={() => removeScope(index)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: 0, fontSize: '0.7rem', lineHeight: 1 }}>×</button>
                          </span>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void saveRole(role.role)}
                        style={{ flex: 1, background: role.color, color: '#0f172a', border: 'none', borderRadius: '6px', padding: '0.45rem', fontWeight: 700, fontSize: '0.78rem', cursor: saving ? 'not-allowed' : 'pointer' }}
                      >
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        style={{ flex: 1, background: '#334155', color: THEME.text, border: 'none', borderRadius: '6px', padding: '0.45rem', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p style={{ color: THEME.muted, fontSize: '0.78rem', margin: '0 0 0.65rem' }}>{role.description}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.65rem' }}>
                      {role.scopes.map((scope) => (
                        <span key={scope} style={{ fontSize: '0.65rem', backgroundColor: '#0b1220', border: `1px solid ${THEME.cardBorder}`, color: '#94a3b8', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
                          {scope}
                        </span>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => startEdit(role)}
                      style={{ width: '100%', background: 'none', border: `1px solid ${THEME.cardBorder}`, color: THEME.muted, borderRadius: '6px', padding: '0.35rem', fontSize: '0.72rem', cursor: 'pointer' }}
                    >
                      Edit role
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </ProtectedRoute>
  );
}
