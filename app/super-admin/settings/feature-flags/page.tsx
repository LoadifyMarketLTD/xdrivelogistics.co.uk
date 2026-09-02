'use client';

import { useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { ActionConfirmModal } from '@/app/super-admin/_components/ActionConfirmModal';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';

const THEME = {
  pageBg: '#F4F6F8',
  cardBg: '#FFFFFF',
  cardBorder: '#D9E1EA',
  text: '#1A1F2B',
  heading: '#0B2F6B',
  blue: '#1D57D8',
  muted: '#64748B',
  accent: '#F5A300',
  green: '#16A34A',
  red: '#DC2626',
};

type Flag = {
  key: string;
  label: string;
  description: string;
  category: 'Marketplace' | 'Operations' | 'Finance' | 'Compliance' | 'Platform' | 'Governance';
  enabled: boolean;
};

export default function Page() {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const auth = await getAuthHeader();
    if (!auth) {
      setError('No active session.');
      setLoading(false);
      return;
    }
    const res = await fetch('/api/super-admin/settings?section=feature-flags', {
      headers: { Authorization: auth },
    });
    const payload = (await res.json().catch(() => ({}))) as { flags?: Flag[]; error?: string };
    if (!res.ok) {
      setError('Feature flag service is currently unavailable.');
      setFlags([]);
    } else {
      setFlags(Array.isArray(payload.flags) ? payload.flags : []);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const setEnabled = (key: string, enabled: boolean) => {
    setFlags((current) => current.map((flag) => (flag.key === key ? { ...flag, enabled } : flag)));
    setMessage(null);
  };

  const save = async (reason: string) => {
    setSaving(true);
    setError(null);
    setMessage(null);
    const auth = await getAuthHeader();
    if (!auth) {
      setError('No active session.');
      setSaving(false);
      return;
    }

    const res = await fetch('/api/super-admin/settings', {
      method: 'PATCH',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        section: 'feature-flags',
        flags: flags.map((flag) => ({ key: flag.key, enabled: flag.enabled })),
        reason: reason.trim(),
      }),
    });
    const payload = (await res.json().catch(() => ({}))) as { updated?: number; migrationRequired?: boolean };
    if (!res.ok) {
      setError(payload.migrationRequired
        ? 'Feature flag governance migration is not applied in this environment.'
        : 'Feature flags could not be saved right now.');
    } else {
      const updated = Number(payload.updated ?? 0);
      setMessage(updated > 0 ? `${updated} feature flag change${updated === 1 ? '' : 's'} saved and audited.` : 'No feature flag values changed.');
      await load();
    }
    setSaving(false);
  };

  const categorySummary = useMemo(
    () =>
      (['Marketplace', 'Operations', 'Finance', 'Compliance', 'Platform', 'Governance'] as const).map((category) => {
        const categoryFlags = flags.filter((flag) => flag.category === category);
        return { category, total: categoryFlags.length, enabled: categoryFlags.filter((flag) => flag.enabled).length };
      }),
    [flags]
  );

  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <div style={{ minHeight: '100vh', backgroundColor: THEME.pageBg, padding: '12px' }}>
        {confirmSave && (
          <ActionConfirmModal
            open
            title="Save feature flag changes"
            description="Apply platform-wide feature flag changes through the audited Platform Owner governance path."
            confirmLabel="Save audited changes"
            reasonRequired
            reasonLabel="Change reason"
            reasonPlaceholder="Explain why these platform feature flags are being changed…"
            submitting={saving}
            onCancel={() => setConfirmSave(false)}
            onConfirm={(reason) => {
              setConfirmSave(false);
              void save(reason);
            }}
          />
        )}

        <header style={{ minHeight: '52px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>🚩</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <h1 style={{ fontSize: '20px', fontWeight: 800, color: THEME.heading, margin: 0 }}>Feature Flags</h1>
                <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9A5D00', backgroundColor: '#FFF4DA', padding: '3px 6px', borderRadius: '4px' }}>Settings</span>
              </div>
              <p style={{ color: THEME.muted, margin: '3px 0 0', fontSize: '12px' }}>Toggle platform modules through the audited Platform Owner governance path.</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button type="button" onClick={() => void load()} disabled={loading || saving} style={{ height: '32px', border: `1px solid ${THEME.cardBorder}`, backgroundColor: THEME.cardBg, color: THEME.heading, borderRadius: '4px', padding: '0 10px', fontSize: '11px', fontWeight: 700, cursor: loading || saving ? 'not-allowed' : 'pointer' }}>Refresh</button>
            <button type="button" onClick={() => setConfirmSave(true)} disabled={loading || saving || flags.length === 0} style={{ height: '32px', border: `1px solid ${THEME.blue}`, backgroundColor: THEME.blue, color: '#FFFFFF', borderRadius: '4px', padding: '0 10px', fontSize: '11px', fontWeight: 800, cursor: loading || saving || flags.length === 0 ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </header>

        {error && <div style={{ marginBottom: '12px', border: `1px solid ${THEME.red}`, borderRadius: '4px', color: THEME.red, backgroundColor: '#FEF2F2', padding: '8px 10px', fontSize: '12px' }}>{error}</div>}
        {message && <div style={{ marginBottom: '12px', border: `1px solid ${THEME.green}`, borderRadius: '4px', color: THEME.green, backgroundColor: '#F0FDF4', padding: '8px 10px', fontSize: '12px' }}>{message}</div>}

        <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
          {categorySummary.map((item) => (
            <div key={item.category} style={{ minHeight: '32px', display: 'inline-flex', alignItems: 'center', backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '4px', padding: '0 9px' }}>
              <span style={{ color: THEME.heading, fontSize: '11px', fontWeight: 800 }}>{item.category}</span>
              <span style={{ color: THEME.muted, fontSize: '10px', marginLeft: '6px' }}>{item.enabled}/{item.total} enabled</span>
            </div>
          ))}
        </div>

        {loading ? (
          <div style={{ color: THEME.muted, fontSize: '12px' }}>Loading…</div>
        ) : flags.length === 0 ? (
          <div style={{ border: `1px solid ${THEME.cardBorder}`, borderRadius: '4px', backgroundColor: THEME.cardBg, minHeight: '88px', display: 'grid', placeItems: 'center', color: THEME.muted, fontSize: '12px' }}>No feature flags are available.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
            {flags.map((flag) => (
              <section key={flag.key} style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '4px', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: THEME.heading, fontWeight: 800, fontSize: '12px' }}>{flag.label}</div>
                    <div style={{ color: THEME.muted, fontSize: '10px', marginTop: '2px' }}>{flag.key}</div>
                  </div>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: flag.enabled ? THEME.green : THEME.muted, fontSize: '11px', fontWeight: 800 }}>
                    <input type="checkbox" checked={flag.enabled} onChange={(event) => setEnabled(flag.key, event.target.checked)} />
                    {flag.enabled ? 'Enabled' : 'Disabled'}
                  </label>
                </div>
                <p style={{ color: THEME.text, fontSize: '11px', lineHeight: 1.45, margin: '8px 0' }}>{flag.description}</p>
                <span style={{ display: 'inline-flex', alignItems: 'center', minHeight: '22px', color: THEME.heading, backgroundColor: THEME.pageBg, border: `1px solid ${THEME.cardBorder}`, padding: '0 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>{flag.category}</span>
              </section>
            ))}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
