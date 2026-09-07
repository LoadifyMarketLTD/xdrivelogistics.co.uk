'use client';

import { useEffect, useMemo, useState } from 'react';
import { Settings2 } from 'lucide-react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';
import {
  SuperAdminEmptyState, SuperAdminNotice, SuperAdminPage, SuperAdminPageHeader,
  SuperAdminSectionCard, SuperAdminUnavailableState,
} from '@/app/super-admin/_components/SuperAdminEnterprisePrimitives';

type Setting = {
  key: string; label: string; value: string; type: 'text' | 'number' | 'boolean';
  category: 'Platform Identity' | 'Marketplace Rules' | 'Compliance' | 'Onboarding';
};

export default function Page() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    const auth = await getAuthHeader();
    if (!auth) { setError('Authentication session is unavailable.'); setLoading(false); return; }
    try {
      const response = await fetch('/api/super-admin/settings?section=global', { headers: { Authorization: auth }, cache: 'no-store' });
      const payload = await response.json().catch(() => ({})) as { settings?: Setting[] };
      if (!response.ok) { setSettings([]); setError('Platform settings service is currently unavailable.'); }
      else setSettings(Array.isArray(payload.settings) ? payload.settings : []);
    } catch { setSettings([]); setError('Platform settings service is currently unavailable.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const grouped = useMemo(() => {
    const map = new Map<string, Setting[]>();
    for (const setting of settings) map.set(setting.category, [...(map.get(setting.category) ?? []), setting]);
    return Array.from(map.entries());
  }, [settings]);
  const setValue = (key: string, value: string) => {
    setSettings((current) => current.map((setting) => setting.key === key ? { ...setting, value } : setting));
    setMessage(null);
  };

  const save = async () => {
    if (!settings.length) return;
    setSaving(true); setError(null); setMessage(null);
    const auth = await getAuthHeader();
    if (!auth) { setError('Authentication session is unavailable.'); setSaving(false); return; }
    try {
      const response = await fetch('/api/super-admin/settings', {
        method: 'PATCH', headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'global', settings: settings.map(({ key, value }) => ({ key, value })) }),
      });
      await response.json().catch(() => ({}));
      if (!response.ok) setError('Platform settings could not be saved right now.');
      else { setMessage('Global settings saved.'); await load(); }
    } catch { setError('Platform settings could not be saved right now.'); }
    finally { setSaving(false); }
  };

  return <ProtectedRoute allowedRoles={['owner']}>
    <SuperAdminPage>
      <SuperAdminPageHeader eyebrow="Platform" title="Global Settings" description="Platform-wide configuration defaults backed by the governed settings service." icon={<Settings2 size={20} aria-hidden="true" />} actions={<div style={{ display: 'flex', gap: 8 }}><button type="button" className="sa-button" onClick={() => void load()} disabled={loading || saving}>Refresh</button><button type="button" className="sa-button" onClick={() => void save()} disabled={loading || saving || settings.length === 0}>{saving ? 'Saving…' : 'Save'}</button></div>} />
      {error ? <SuperAdminUnavailableState title="Global settings unavailable" description={error} /> : null}
      {message ? <SuperAdminNotice tone="success">{message}</SuperAdminNotice> : null}
      {!error && loading ? <SuperAdminEmptyState title="Loading platform settings…" /> : null}
      {!error && !loading && grouped.length === 0 ? <SuperAdminEmptyState title="No platform settings are available." description="No configuration data can be edited until the settings service returns a governed setting registry." /> : null}
      {!error && !loading ? grouped.map(([category, entries]) => <SuperAdminSectionCard key={category} title={category} description={`${entries.length} governed setting(s)`}>
        <div style={{ display: 'grid', gap: 10 }}>
          {entries.map((setting) => <label key={setting.key} htmlFor={`setting-${setting.key}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px,1fr) minmax(220px,360px)', gap: 12, alignItems: 'center', paddingBottom: 10, borderBottom: '1px solid #EEF2F6' }}>
            <span><strong>{setting.label}</strong><code style={{ display: 'block', marginTop: 3, color: '#667085', fontSize: 11 }}>{setting.key}</code></span>
            <input id={`setting-${setting.key}`} value={setting.value} onChange={(event) => setValue(setting.key, event.target.value)} style={{ minHeight: 36, border: '1px solid #E5E7EB', borderRadius: 8, padding: '0 10px', color: '#1A1F2B', background: '#FFFFFF' }} />
          </label>)}
        </div>
      </SuperAdminSectionCard>) : null}
    </SuperAdminPage>
  </ProtectedRoute>;
}
