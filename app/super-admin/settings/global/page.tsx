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

type Setting = {
  key: string;
  label: string;
  value: string;
  type: 'text' | 'number' | 'boolean';
  category: 'Platform Identity' | 'Marketplace Rules' | 'Compliance' | 'Onboarding';
};

export default function Page() {
  const [settings, setSettings] = useState<Setting[]>([]);
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
    const res = await fetch('/api/super-admin/settings?section=global', {
      headers: { Authorization: auth },
    });
    const payload = (await res.json().catch(() => ({}))) as {
      settings?: Setting[];
      error?: string;
    };
    if (!res.ok) {
      setError(payload.error ?? `HTTP ${res.status}`);
      setSettings([]);
    } else {
      setSettings(Array.isArray(payload.settings) ? payload.settings : []);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, Setting[]>();
    for (const item of settings) {
      const current = map.get(item.category) ?? [];
      current.push(item);
      map.set(item.category, current);
    }
    return Array.from(map.entries());
  }, [settings]);

  const setValue = (key: string, value: string) => {
    setSettings((current) =>
      current.map((setting) => (setting.key === key ? { ...setting, value } : setting))
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
        section: 'global',
        settings: settings.map((setting) => ({ key: setting.key, value: setting.value })),
      }),
    });
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(payload.error ?? `HTTP ${res.status}`);
    } else {
      setMessage('Global settings saved.');
      await load();
    }
    setSaving(false);
  };

  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <div style={{ minHeight: '100vh', backgroundColor: THEME.pageBg, padding: '1.5rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            marginBottom: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.5rem' }}>⚙️</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: THEME.text, margin: 0 }}>
                  Global Platform Settings
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
                Edit and persist platform-wide configuration defaults.
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

        {loading ? (
          <div style={{ color: THEME.muted, fontSize: '0.84rem' }}>Loading…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {grouped.map(([category, entries]) => (
              <div
                key={category}
                style={{
                  backgroundColor: THEME.cardBg,
                  border: `1px solid ${THEME.cardBorder}`,
                  borderRadius: '12px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    borderBottom: `1px solid ${THEME.cardBorder}`,
                    backgroundColor: '#0b1220',
                  }}
                >
                  <h3
                    style={{
                      color: THEME.accent,
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      margin: 0,
                    }}
                  >
                    {category}
                  </h3>
                </div>
                <div style={{ padding: '0.25rem 0' }}>
                  {entries.map((setting) => (
                    <div
                      key={setting.key}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '0.8rem',
                        padding: '0.6rem 1rem',
                        borderBottom: '1px solid rgba(51,65,85,0.4)',
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ color: THEME.text, fontSize: '0.82rem', fontWeight: 500 }}>
                          {setting.label}
                        </div>
                        <div
                          style={{
                            color: '#475569',
                            fontSize: '0.68rem',
                            fontFamily: 'monospace',
                            marginTop: '0.1rem',
                          }}
                        >
                          {setting.key}
                        </div>
                      </div>
                      <input
                        value={setting.value}
                        onChange={(event) => setValue(setting.key, event.target.value)}
                        style={{
                          backgroundColor: '#0b1220',
                          border: `1px solid ${THEME.cardBorder}`,
                          borderRadius: '6px',
                          padding: '0.42rem 0.6rem',
                          color: THEME.text,
                          fontSize: '0.78rem',
                          minWidth: '170px',
                          textAlign: 'right',
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
