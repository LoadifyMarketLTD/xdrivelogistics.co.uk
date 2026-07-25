'use client';

import { useCallback, useEffect, useState } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { supabase } from '../../../../lib/supabaseClient';

type FeatureFlag = {
  key: string;
  label: string;
  description: string | null;
  category: string;
  is_enabled: boolean;
  updated_at: string | null;
};

const THEME = {
  pageBg: '#0f172a', cardBg: '#1e293b', cardBorder: '#334155',
  text: '#f1f5f9', muted: '#94a3b8', accent: '#f59e0b',
  green: '#22c55e', red: '#ef4444',
};

async function getToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [toggling, setToggling] = useState<string | null>(null);
  const [toggleResult, setToggleResult] = useState<Record<string, { ok: boolean; msg: string }>>({});

  const load = useCallback(async () => {
    setLoading(true); setError(''); setNote('');
    const token = await getToken();
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch('/api/super-admin/settings?section=feature-flags', { headers });
    const body = await res.json().catch(() => ({})) as { flags?: FeatureFlag[]; error?: string; note?: string };
    if (!res.ok) { setError(body.error ?? 'Failed to load flags.'); }
    else { setFlags(body.flags ?? []); if (body.note) setNote(body.note); }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toggle = async (key: string, currentValue: boolean) => {
    setToggling(key);
    const token = await getToken();
    const headers: HeadersInit = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    const res = await fetch('/api/super-admin/settings', {
      method: 'PATCH', headers,
      body: JSON.stringify({ section: 'feature-flags', key, is_enabled: !currentValue }),
    });
    const body = await res.json().catch(() => ({})) as { error?: string };
    if (res.ok) {
      setFlags((prev) => prev.map((f) => f.key === key ? { ...f, is_enabled: !currentValue } : f));
      setToggleResult((prev) => ({ ...prev, [key]: { ok: true, msg: `${!currentValue ? 'Enabled' : 'Disabled'}.` } }));
      setTimeout(() => setToggleResult((prev) => { const n = { ...prev }; delete n[key]; return n; }), 2500);
    } else {
      setToggleResult((prev) => ({ ...prev, [key]: { ok: false, msg: body.error ?? 'Toggle failed.' } }));
    }
    setToggling(null);
  };

  const grouped = flags.reduce<Record<string, FeatureFlag[]>>((acc, f) => {
    (acc[f.category] ??= []).push(f);
    return acc;
  }, {});

  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <div style={{ minHeight: '100vh', background: THEME.pageBg, color: THEME.text, padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: THEME.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Platform</div>
              <h1 style={{ margin: '0.25rem 0 0', fontSize: '1.6rem', fontWeight: 800 }}>Feature Flags</h1>
            </div>
            <button onClick={() => void load()} style={{ background: 'transparent', border: `1px solid ${THEME.cardBorder}`, borderRadius: '6px', color: THEME.muted, padding: '0.4rem 0.8rem', fontSize: '0.78rem', cursor: 'pointer' }}>
              ↻ Refresh
            </button>
          </div>

          {note && <div style={{ background: '#1c2a3f', border: `1px solid ${THEME.accent}`, color: THEME.accent, borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.83rem' }}>{note}</div>}
          {error && <div style={{ background: '#2d1414', border: '1px solid #7f1d1d', color: '#fca5a5', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.83rem' }}>{error}</div>}
          {loading && <div style={{ color: THEME.muted }}>Loading feature flags…</div>}

          {!loading && Object.entries(grouped).map(([category, items]) => (
            <div key={category} style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: THEME.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>{category}</div>
              <div style={{ background: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '10px', overflow: 'hidden' }}>
                {items.map((flag, i) => {
                  const res = toggleResult[flag.key];
                  return (
                    <div key={flag.key} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem', alignItems: 'center', padding: '0.9rem 1.1rem', borderBottom: i < items.length - 1 ? `1px solid ${THEME.cardBorder}` : 'none' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '0.2rem' }}>{flag.label}</div>
                        <div style={{ color: THEME.muted, fontSize: '0.78rem' }}>{flag.description ?? ''}</div>
                        {res && <div style={{ fontSize: '0.72rem', color: res.ok ? THEME.green : THEME.red, fontWeight: 700, marginTop: '0.2rem' }}>{res.msg}</div>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '0.72rem', color: flag.is_enabled ? THEME.green : THEME.muted, fontWeight: 700, textTransform: 'uppercase' }}>
                          {flag.is_enabled ? 'ON' : 'OFF'}
                        </span>
                        <button
                          onClick={() => void toggle(flag.key, flag.is_enabled)}
                          disabled={toggling === flag.key}
                          style={{
                            width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                            background: flag.is_enabled ? THEME.green : THEME.cardBorder,
                            position: 'relative', transition: 'background 0.2s',
                            opacity: toggling === flag.key ? 0.5 : 1,
                          }}
                          aria-label={`${flag.is_enabled ? 'Disable' : 'Enable'} ${flag.label}`}
                        >
                          <span style={{
                            position: 'absolute', top: '3px', borderRadius: '50%', width: '18px', height: '18px',
                            background: '#fff', transition: 'left 0.2s',
                            left: flag.is_enabled ? '23px' : '3px',
                          }} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {!loading && flags.length === 0 && !note && (
            <div style={{ color: THEME.muted, textAlign: 'center', padding: '2rem', fontSize: '0.88rem' }}>
              No feature flags found. Apply migration 20260725170000 in Supabase SQL Editor to seed initial flags.
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
