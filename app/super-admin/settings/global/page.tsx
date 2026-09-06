'use client';

import { useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';

const V2 = {
  blue: '#1A73E8',
  green: '#34A853',
  yellow: '#FBBC05',
  red: '#EA4335',
  grey: '#8A9099',
  white: '#FFFFFF',
  shadow: '0px 2px 6px rgba(0,0,0,0.08)',
} as const;

type Setting = {
  key: string;
  label: string;
  value: string;
  type: 'text' | 'number' | 'boolean';
  category: 'Platform Identity' | 'Marketplace Rules' | 'Compliance' | 'Onboarding';
};

const enterpriseButton = {
  minHeight: '40px',
  padding: '12px 18px',
  borderRadius: '8px',
  background: V2.white,
  boxShadow: V2.shadow,
  fontFamily: 'Inter, Arial, sans-serif',
  fontSize: '16px',
  fontWeight: 500,
} as const;

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
      setError('Authentication session is unavailable.');
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/super-admin/settings?section=global', { headers: { Authorization: auth } });
      const payload = (await res.json().catch(() => ({}))) as { settings?: Setting[] };
      if (!res.ok) {
        setError('Platform settings service is currently unavailable.');
        setSettings([]);
      } else {
        setSettings(Array.isArray(payload.settings) ? payload.settings : []);
      }
    } catch {
      setError('Platform settings service is currently unavailable.');
      setSettings([]);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, Setting[]>();
    for (const item of settings) map.set(item.category, [...(map.get(item.category) ?? []), item]);
    return Array.from(map.entries());
  }, [settings]);

  const setValue = (key: string, value: string) => {
    setSettings((current) => current.map((setting) => setting.key === key ? { ...setting, value } : setting));
    setMessage(null);
  };

  const save = async () => {
    if (settings.length === 0) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    const auth = await getAuthHeader();
    if (!auth) {
      setError('Authentication session is unavailable.');
      setSaving(false);
      return;
    }
    try {
      const res = await fetch('/api/super-admin/settings', {
        method: 'PATCH',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'global', settings: settings.map(({ key, value }) => ({ key, value })) }),
      });
      await res.json().catch(() => ({}));
      if (!res.ok) setError('Platform settings could not be saved right now.');
      else {
        setMessage('Global settings saved.');
        await load();
      }
    } catch {
      setError('Platform settings could not be saved right now.');
    }
    setSaving(false);
  };

  const saveDisabled = loading || saving || settings.length === 0;

  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <main style={{ minHeight: '100vh', background: V2.white, color: V2.grey, padding: '24px', fontFamily: 'Inter, Arial, sans-serif' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px', marginBottom: '24px', padding: '24px', border: `1px solid ${V2.grey}`, borderRadius: '8px', background: V2.white, boxShadow: V2.shadow }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <span aria-hidden="true" style={{ width: '24px', height: '24px', display: 'grid', placeItems: 'center', color: V2.blue, fontSize: '24px', lineHeight: '24px' }}>⚙</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                <h1 style={{ margin: 0, color: V2.blue, fontSize: '20px', fontWeight: 700 }}>Global Settings</h1>
                <span data-status-chip style={{ padding: '4px 10px', border: `1px solid ${V2.blue}`, borderRadius: '8px', background: V2.white, color: V2.blue, boxShadow: V2.shadow, fontSize: '14px', fontWeight: 400 }}>Settings</span>
              </div>
              <p style={{ margin: '24px 0 0', color: V2.grey, fontSize: '14px', fontWeight: 400 }}>Edit and persist platform-wide configuration defaults.</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '24px' }}>
            <button type="button" onClick={() => void load()} disabled={loading || saving} style={{ ...enterpriseButton, border: `1px solid ${V2.grey}`, color: V2.blue, cursor: loading || saving ? 'not-allowed' : 'pointer' }}>Refresh</button>
            <button type="button" onClick={() => void save()} disabled={saveDisabled} style={{ ...enterpriseButton, border: `1px solid ${saveDisabled ? V2.grey : V2.blue}`, color: saveDisabled ? V2.grey : V2.blue, cursor: saveDisabled ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </header>

        {error && <div role="alert" style={{ marginBottom: '24px', padding: '24px', border: `1px solid ${V2.red}`, borderRadius: '8px', background: V2.white, color: V2.red, boxShadow: V2.shadow, fontSize: '14px' }}>{error}</div>}
        {message && <div role="status" style={{ marginBottom: '24px', padding: '24px', border: `1px solid ${V2.green}`, borderRadius: '8px', background: V2.white, color: V2.green, boxShadow: V2.shadow, fontSize: '14px' }}>{message}</div>}

        {loading ? (
          <div style={{ padding: '24px', border: `1px solid ${V2.grey}`, borderRadius: '8px', background: V2.white, color: V2.grey, boxShadow: V2.shadow, fontSize: '14px' }}>Loading…</div>
        ) : grouped.length === 0 ? (
          <div style={{ minHeight: '120px', display: 'grid', placeItems: 'center', padding: '24px', border: `1px solid ${V2.grey}`, borderRadius: '8px', background: V2.white, color: V2.grey, boxShadow: V2.shadow, textAlign: 'center' }}>
            <div><strong style={{ display: 'block', color: V2.blue, fontSize: '20px', fontWeight: 700 }}>Platform settings are unavailable</strong><span style={{ display: 'block', marginTop: '24px', fontSize: '14px' }}>No configuration data can be edited until the settings service is available.</span></div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '24px' }}>
            {grouped.map(([category, entries]) => (
              <section key={category} style={{ border: `1px solid ${V2.grey}`, borderRadius: '8px', overflow: 'hidden', background: V2.white, boxShadow: V2.shadow }}>
                <div style={{ padding: '24px', borderBottom: `1px solid ${V2.grey}`, background: V2.white }}>
                  <h3 style={{ margin: 0, color: V2.blue, fontSize: '20px', fontWeight: 700 }}>{category}</h3>
                </div>
                <div>
                  {entries.map((setting, index) => (
                    <div key={setting.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '24px', padding: '24px', borderBottom: index === entries.length - 1 ? 'none' : `1px solid ${V2.grey}` }}>
                      <label htmlFor={`setting-${setting.key}`} style={{ color: V2.grey, fontSize: '14px', fontWeight: 400 }}>{setting.label}</label>
                      <input id={`setting-${setting.key}`} value={setting.value} onChange={(event) => setValue(setting.key, event.target.value)} style={{ width: '320px', maxWidth: '45vw', minHeight: '40px', boxSizing: 'border-box', padding: '12px 18px', border: `1px solid ${V2.grey}`, borderRadius: '8px', background: V2.white, color: V2.grey, boxShadow: V2.shadow, fontFamily: 'Inter, Arial, sans-serif', fontSize: '14px', fontWeight: 400 }} />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}
