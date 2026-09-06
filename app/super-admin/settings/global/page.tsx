'use client';

import { useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
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
      setError('Authentication session is unavailable.');
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/super-admin/settings?section=global', {
        headers: { Authorization: auth },
      });
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
        headers: {
          Authorization: auth,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          section: 'global',
          settings: settings.map((setting) => ({ key: setting.key, value: setting.value })),
        }),
      });
      await res.json().catch(() => ({}));
      if (!res.ok) {
        setError('Platform settings could not be saved right now.');
      } else {
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
      <div style={{ minHeight: '100vh', backgroundColor: THEME.pageBg, padding: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>⚙️</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <h1 style={{ fontSize: '20px', fontWeight: 800, color: THEME.heading, margin: 0 }}>Global Settings</h1>
                <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9A5D00', backgroundColor: '#FFF4DA', padding: '3px 6px', borderRadius: '4px' }}>Settings</span>
              </div>
              <p style={{ color: THEME.muted, margin: '3px 0 0', fontSize: '12px' }}>Edit and persist platform-wide configuration defaults.</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button type="button" onClick={() => void load()} disabled={loading || saving} style={{ height: '32px', border: `1px solid ${THEME.cardBorder}`, backgroundColor: THEME.cardBg, color: THEME.heading, borderRadius: '4px', padding: '0 10px', fontSize: '11px', fontWeight: 700, cursor: loading || saving ? 'not-allowed' : 'pointer' }}>Refresh</button>
            <button type="button" onClick={() => void save()} disabled={saveDisabled} style={{ height: '32px', border: `1px solid ${saveDisabled ? THEME.cardBorder : THEME.blue}`, backgroundColor: saveDisabled ? '#E5E7EB' : THEME.blue, color: saveDisabled ? '#94A3B8' : '#FFFFFF', borderRadius: '4px', padding: '0 10px', fontSize: '11px', fontWeight: 800, cursor: saveDisabled ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>

        {error && <div style={{ marginBottom: '12px', border: `1px solid ${THEME.red}`, borderRadius: '4px', color: THEME.red, backgroundColor: '#FEF2F2', padding: '8px 10px', fontSize: '12px' }}>{error}</div>}
        {message && <div style={{ marginBottom: '12px', border: `1px solid ${THEME.green}`, borderRadius: '4px', color: THEME.green, backgroundColor: '#F0FDF4', padding: '8px 10px', fontSize: '12px' }}>{message}</div>}

        {loading ? (
          <div style={{ color: THEME.muted, fontSize: '12px' }}>Loading…</div>
        ) : grouped.length === 0 ? (
          <div style={{ border: `1px solid ${THEME.cardBorder}`, borderRadius: '4px', backgroundColor: THEME.cardBg, minHeight: '88px', display: 'grid', placeItems: 'center', padding: '12px', textAlign: 'center' }}>
            <div>
              <div style={{ color: THEME.heading, fontSize: '12px', fontWeight: 800 }}>Platform settings are unavailable</div>
              <div style={{ color: THEME.muted, fontSize: '11px', marginTop: '4px' }}>No configuration data can be edited until the settings service is available.</div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {grouped.map(([category, entries]) => (
              <section key={category} style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ minHeight: '36px', padding: '0 12px', borderBottom: `1px solid ${THEME.cardBorder}`, backgroundColor: THEME.pageBg, display: 'flex', alignItems: 'center' }}>
                  <h3 style={{ color: THEME.heading, fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>{category}</h3>
                </div>
                <div>
                  {entries.map((setting, index) => (
                    <div key={setting.key} style={{ minHeight: '44px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '8px 12px', borderBottom: index === entries.length - 1 ? 'none' : `1px solid ${THEME.cardBorder}` }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ color: THEME.text, fontSize: '12px', fontWeight: 700 }}>{setting.label}</div>
                      </div>
                      <input value={setting.value} onChange={(event) => setValue(setting.key, event.target.value)} style={{ width: '220px', maxWidth: '45vw', height: '32px', boxSizing: 'border-box', backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '4px', padding: '0 8px', color: THEME.text, fontSize: '12px' }} />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
