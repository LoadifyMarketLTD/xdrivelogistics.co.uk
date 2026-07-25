'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { supabase } from '../../../../lib/supabaseClient';

const THEME = {
  pageBg: '#0f172a', cardBg: '#1e293b', cardBorder: '#334155',
  text: '#f1f5f9', muted: '#94a3b8', accent: '#f59e0b', green: '#22c55e', red: '#ef4444',
};

const DEFAULTS: { group: string; settings: { key: string; label: string; value: string; type: string }[] }[] = [
  { group: 'Platform Identity', settings: [
    { key: 'platform_name', label: 'Platform Name', value: 'XDrive Logistics', type: 'text' },
    { key: 'platform_domain', label: 'Primary Domain', value: 'xdrivelogistics.co.uk', type: 'text' },
    { key: 'support_email', label: 'Support Email', value: 'support@xdrivelogistics.co.uk', type: 'text' },
    { key: 'default_currency', label: 'Default Currency', value: 'GBP', type: 'text' },
    { key: 'default_timezone', label: 'Default Timezone', value: 'Europe/London', type: 'text' },
  ] },
  { group: 'Marketplace Rules', settings: [
    { key: 'min_bid_interval_minutes', label: 'Min Bid Interval (minutes)', value: '5', type: 'number' },
    { key: 'max_bids_per_job', label: 'Max Bids per Job', value: '25', type: 'number' },
    { key: 'exchange_auto_expire_hours', label: 'Exchange Job Auto-Expire (hours)', value: '72', type: 'number' },
    { key: 'vat_rate_default_pct', label: 'Default VAT Rate (%)', value: '20', type: 'number' },
  ] },
  { group: 'Compliance', settings: [
    { key: 'doc_expiry_warning_days', label: 'Document Expiry Warning (days)', value: '30', type: 'number' },
    { key: 'compliance_block_posting', label: 'Block Posting on Compliance Failure', value: 'true', type: 'text' },
    { key: 'driver_doc_required', label: 'Required Driver Docs', value: 'driving_licence, cpc_card, insurance', type: 'text' },
    { key: 'vehicle_doc_required', label: 'Required Vehicle Docs', value: 'mot, insurance', type: 'text' },
  ] },
  { group: 'Notifications', settings: [
    { key: 'email_from_name', label: 'Email Sender Name', value: 'XDrive Logistics', type: 'text' },
    { key: 'email_from_address', label: 'Email Sender Address', value: 'noreply@xdrivelogistics.co.uk', type: 'text' },
    { key: 'notification_retry_max', label: 'Max Notification Retry Attempts', value: '3', type: 'number' },
  ] },
];

type AppSetting = { key: string; value: string };

async function getToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export default function GlobalSettingsPage() {
  const [livSettings, setLivSettings] = useState<AppSetting[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const [error, setError] = useState('');
  const debounce = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const token = await getToken();
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch('/api/super-admin/settings?section=global', { headers });
    const body = await res.json().catch(() => ({})) as { settings?: AppSetting[]; error?: string };
    if (!res.ok) { setError(body.error ?? 'Failed to load settings.'); }
    else { setLivSettings(body.settings ?? []); }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const getValue = (key: string, def: string) => {
    if (edits[key] !== undefined) return edits[key];
    const live = livSettings.find((s) => s.key === key);
    return live ? live.value : def;
  };

  const save = async (key: string) => {
    const value = edits[key];
    if (value === undefined) return;
    setSaving(key);
    const token = await getToken();
    const headers: HeadersInit = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    const res = await fetch('/api/super-admin/settings', {
      method: 'PATCH', headers,
      body: JSON.stringify({ section: 'global', key, value }),
    });
    const body = await res.json().catch(() => ({})) as { error?: string };
    if (res.ok) {
      setLivSettings((prev) => {
        const existing = prev.find((s) => s.key === key);
        if (existing) return prev.map((s) => s.key === key ? { ...s, value } : s);
        return [...prev, { key, value }];
      });
      setEdits((prev) => { const n = { ...prev }; delete n[key]; return n; });
      setResults((prev) => ({ ...prev, [key]: { ok: true, msg: 'Saved.' } }));
      setTimeout(() => setResults((prev) => { const n = { ...prev }; delete n[key]; return n; }), 2500);
    } else {
      setResults((prev) => ({ ...prev, [key]: { ok: false, msg: body.error ?? 'Save failed.' } }));
    }
    setSaving(null);
  };

  const onChange = (key: string, value: string) => {
    setEdits((prev) => ({ ...prev, [key]: value }));
    clearTimeout(debounce.current[key]);
    debounce.current[key] = setTimeout(() => void save(key), 1200);
  };

  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <div style={{ minHeight: '100vh', background: THEME.pageBg, color: THEME.text, padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: THEME.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Platform</div>
              <h1 style={{ margin: '0.25rem 0 0', fontSize: '1.6rem', fontWeight: 800 }}>Global Settings</h1>
            </div>
            <button onClick={() => void load()} style={{ background: 'transparent', border: `1px solid ${THEME.cardBorder}`, borderRadius: '6px', color: THEME.muted, padding: '0.4rem 0.8rem', fontSize: '0.78rem', cursor: 'pointer' }}>
              ↻ Refresh
            </button>
          </div>

          <div style={{ fontSize: '0.78rem', color: THEME.muted, marginBottom: '1.25rem', background: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '8px', padding: '0.75rem 1rem' }}>
            Settings are persisted to <strong>app_settings</strong> and take effect immediately.
            Changes auto-save 1.2 s after you stop typing.
            {loading ? ' Loading live values…' : livSettings.length === 0 ? ' (No DB values yet — showing defaults. Apply migration 088 to persist.)' : ` ${livSettings.length} setting(s) loaded from DB.`}
          </div>

          {error && <div style={{ background: '#2d1414', border: '1px solid #7f1d1d', color: '#fca5a5', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.83rem' }}>{error}</div>}

          {DEFAULTS.map((grp) => (
            <div key={grp.group} style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: THEME.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>{grp.group}</div>
              <div style={{ background: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '10px', overflow: 'hidden' }}>
                {grp.settings.map((s, i) => {
                  const val = getValue(s.key, s.value);
                  const res = results[s.key];
                  return (
                    <div key={s.key} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', alignItems: 'center', padding: '0.9rem 1.1rem', borderBottom: i < grp.settings.length - 1 ? `1px solid ${THEME.cardBorder}` : 'none' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{s.label}</div>
                        <div style={{ fontSize: '0.68rem', color: THEME.muted, fontFamily: 'monospace' }}>{s.key}</div>
                        {res && <div style={{ fontSize: '0.7rem', color: res.ok ? THEME.green : THEME.red, fontWeight: 700 }}>{res.msg}</div>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input
                          type={s.type === 'number' ? 'number' : 'text'}
                          value={val}
                          onChange={(e) => onChange(s.key, e.target.value)}
                          style={{ flex: 1, background: '#0f172a', border: `1px solid ${saving === s.key ? THEME.accent : THEME.cardBorder}`, borderRadius: '6px', color: THEME.text, padding: '0.4rem 0.6rem', fontSize: '0.83rem', fontFamily: s.type === 'number' ? 'monospace' : 'inherit', outline: 'none' }}
                        />
                        <button
                          onClick={() => void save(s.key)}
                          disabled={saving === s.key || edits[s.key] === undefined}
                          style={{ background: THEME.accent, border: 'none', borderRadius: '6px', color: '#000', padding: '0.4rem 0.8rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', opacity: (saving === s.key || edits[s.key] === undefined) ? 0.4 : 1 }}
                        >
                          {saving === s.key ? '...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </ProtectedRoute>
  );
}
