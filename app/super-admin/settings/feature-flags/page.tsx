'use client';

import { useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';

const THEME = {
  pageBg: '#0f172a',
  cardBg: '#1e293b',
  cardBorder: '#334155',
  text: '#f1f5f9',
  muted: '#94a3b8',
  accent: '#f59e0b',
  green: '#22c55e',
  red: '#ef4444',
};

type Flag = {
  key: string;
  label: string;
  description: string;
  category: 'Marketplace' | 'Operations' | 'Finance' | 'Compliance' | 'Platform';
  enabled: boolean;
};

export default function Page() {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
    const payload = (await res.json().catch(() => ({}))) as {
      flags?: Flag[];
      error?: string;
    };
    if (!res.ok) {
      setError(payload.error ?? `HTTP ${res.status}`);
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
    setFlags((current) =>
      current.map((flag) => (flag.key === key ? { ...flag, enabled } : flag))
    );
    setMessage(null);
  };

  const save = async () => {
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
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        section: 'feature-flags',
        flags: flags.map((flag) => ({ key: flag.key, enabled: flag.enabled })),
      }),
    });
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(payload.error ?? `HTTP ${res.status}`);
    } else {
      setMessage('Feature flags saved.');
    }
    setSaving(false);
  };

  const categorySummary = useMemo(
    () =>
      (['Marketplace', 'Operations', 'Finance', 'Compliance', 'Platform'] as const).map(
        (category) => {
          const categoryFlags = flags.filter((flag) => flag.category === category);
          return {
            category,
            total: categoryFlags.length,
            enabled: categoryFlags.filter((flag) => flag.enabled).length,
          };
        }
      ),
    [flags]
  );

  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <div
        style={{ minHeight: '100vh', backgroundColor: THEME.pageBg, padding: '1.5rem' }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🚩</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h1
                  style={{
                    fontSize: '1.4rem',
                    fontWeight: 700,
                    color: THEME.text,
                    margin: 0,
                  }}
                >
                  Feature Flags
                </h1>
                <span
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: THEME.accent,
                    backgroundColor: 'rgba(245,158,11,0.12)',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '4px',
                  }}
                >
                  Settings
                </span>
              </div>
              <p style={{ color: THEME.muted, margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
                Toggle platform modules live and persist governance changes.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.45rem' }}>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading || saving}
              style={{
                border: `1px solid ${THEME.cardBorder}`,
                backgroundColor: '#0b1220',
                color: THEME.text,
                borderRadius: '8px',
                padding: '0.5rem 0.75rem',
                fontSize: '0.76rem',
                cursor: loading || saving ? 'not-allowed' : 'pointer',
              }}
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={loading || saving}
              style={{
                border: `1px solid ${THEME.green}`,
                backgroundColor: THEME.green,
                color: '#052e16',
                borderRadius: '8px',
                padding: '0.5rem 0.75rem',
                fontSize: '0.76rem',
                fontWeight: 700,
                cursor: loading || saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {error && (
          <div
            style={{
              marginBottom: '0.75rem',
              border: `1px solid ${THEME.red}`,
              borderRadius: '8px',
              color: THEME.red,
              backgroundColor: 'rgba(239,68,68,0.1)',
              padding: '0.6rem 0.8rem',
              fontSize: '0.8rem',
            }}
          >
            {error}
          </div>
        )}
        {message && (
          <div
            style={{
              marginBottom: '0.75rem',
              border: `1px solid ${THEME.green}`,
              borderRadius: '8px',
              color: THEME.green,
              backgroundColor: 'rgba(34,197,94,0.1)',
              padding: '0.6rem 0.8rem',
              fontSize: '0.8rem',
            }}
          >
            {message}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.65rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {categorySummary.map((item) => (
            <div
              key={item.category}
              style={{
                backgroundColor: '#0b1220',
                border: `1px solid ${THEME.cardBorder}`,
                borderRadius: '8px',
                padding: '0.5rem 0.85rem',
              }}
            >
              <span style={{ color: THEME.text, fontSize: '0.82rem', fontWeight: 600 }}>
                {item.category}
              </span>
              <span style={{ color: THEME.muted, fontSize: '0.72rem', marginLeft: '0.5rem' }}>
                {item.enabled}/{item.total} enabled
              </span>
            </div>
          ))}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '0.75rem',
          }}
        >
          {loading ? (
            <div style={{ color: THEME.muted, fontSize: '0.82rem' }}>Loading…</div>
          ) : (
            flags.map((flag) => (
              <div
                key={flag.key}
                style={{
                  backgroundColor: THEME.cardBg,
                  border: `1px solid ${THEME.cardBorder}`,
                  borderRadius: '10px',
                  padding: '1rem',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '0.5rem',
                    gap: '0.5rem',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ color: THEME.text, fontWeight: 700, fontSize: '0.88rem' }}>
                      {flag.label}
                    </div>
                    <div
                      style={{
                        color: THEME.muted,
                        fontSize: '0.68rem',
                        fontFamily: 'monospace',
                        marginTop: '0.1rem',
                      }}
                    >
                      {flag.key}
                    </div>
                  </div>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <input
                      type="checkbox"
                      checked={flag.enabled}
                      onChange={(event) => setEnabled(flag.key, event.target.checked)}
                    />
                    <span
                      style={{
                        color: flag.enabled ? THEME.green : THEME.red,
                        fontSize: '0.72rem',
                        fontWeight: 700,
                      }}
                    >
                      {flag.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </label>
                </div>
                <p style={{ color: THEME.muted, fontSize: '0.78rem', margin: '0.25rem 0 0.5rem' }}>
                  {flag.description}
                </p>
                <span
                  style={{
                    fontSize: '0.65rem',
                    color: '#475569',
                    backgroundColor: '#0b1220',
                    padding: '0.15rem 0.4rem',
                    borderRadius: '3px',
                  }}
                >
                  {flag.category}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
