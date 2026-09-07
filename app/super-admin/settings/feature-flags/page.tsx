'use client';

import { useEffect, useMemo, useState } from 'react';
import { Flag } from 'lucide-react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';
import {
  SuperAdminEmptyState, SuperAdminMetricCard, SuperAdminMetricGrid, SuperAdminNotice,
  SuperAdminPage, SuperAdminPageHeader, SuperAdminSectionCard, SuperAdminStatusBadge,
  SuperAdminUnavailableState,
} from '@/app/super-admin/_components/SuperAdminEnterprisePrimitives';

type FeatureFlag = {
  key: string; label: string; description: string;
  category: 'Marketplace' | 'Operations' | 'Finance' | 'Compliance' | 'Platform' | 'Governance';
  enabled: boolean;
};

const categories: FeatureFlag['category'][] = ['Marketplace', 'Operations', 'Finance', 'Compliance', 'Platform', 'Governance'];

export default function Page() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    const auth = await getAuthHeader();
    if (!auth) { setError('No active Platform Owner session.'); setLoading(false); return; }
    try {
      const response = await fetch('/api/super-admin/settings?section=feature-flags', { headers: { Authorization: auth }, cache: 'no-store' });
      const payload = await response.json().catch(() => ({})) as { flags?: FeatureFlag[] };
      if (!response.ok) { setFlags([]); setError('Feature flag service is currently unavailable.'); }
      else setFlags(Array.isArray(payload.flags) ? payload.flags : []);
    } catch { setFlags([]); setError('Feature flag service is currently unavailable.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const summary = useMemo(() => categories.map((category) => {
    const rows = flags.filter((flag) => flag.category === category);
    return { category, total: rows.length, enabled: rows.filter((flag) => flag.enabled).length };
  }), [flags]);
  const setEnabled = (key: string, enabled: boolean) => {
    setFlags((current) => current.map((flag) => flag.key === key ? { ...flag, enabled } : flag));
    setMessage(null);
  };

  const save = async () => {
    setSaving(true); setError(null); setMessage(null);
    const auth = await getAuthHeader();
    if (!auth) { setError('No active Platform Owner session.'); setSaving(false); return; }
    try {
      const response = await fetch('/api/super-admin/settings', {
        method: 'PATCH', headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'feature-flags', flags: flags.map(({ key, enabled }) => ({ key, enabled })) }),
      });
      await response.json().catch(() => ({}));
      if (!response.ok) setError('Feature flags could not be saved right now.');
      else setMessage('Feature flags saved.');
    } catch { setError('Feature flags could not be saved right now.'); }
    finally { setSaving(false); }
  };

  return <ProtectedRoute allowedRoles={['owner']}>
    <SuperAdminPage>
      <SuperAdminPageHeader eyebrow="Platform" title="Feature Flags" description="Governed module switches. Changes use the existing Platform Owner settings mutation and preserve current authorization." icon={<Flag size={20} aria-hidden="true" />} actions={<div style={{ display: 'flex', gap: 8 }}><button type="button" className="sa-button" onClick={() => void load()} disabled={loading || saving}>Refresh</button><button type="button" className="sa-button" onClick={() => void save()} disabled={loading || saving}>{saving ? 'Saving…' : 'Save'}</button></div>} />
      {error ? <SuperAdminUnavailableState title="Feature flags unavailable" description={error} /> : null}
      {message ? <SuperAdminNotice tone="success">{message}</SuperAdminNotice> : null}
      {!error ? <SuperAdminMetricGrid>
        {summary.map((item) => <SuperAdminMetricCard key={item.category} label={item.category} value={loading ? '—' : `${item.enabled}/${item.total}`} note="enabled" tone="info" />)}
      </SuperAdminMetricGrid> : null}
      {!error && loading ? <SuperAdminEmptyState title="Loading feature flags…" /> : null}
      {!error && !loading && flags.length === 0 ? <SuperAdminEmptyState title="No feature flags are available." /> : null}
      {!error && !loading ? <SuperAdminSectionCard title="Governed feature registry" description="Enable or disable only flags returned by the canonical settings service.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 10 }}>
          {flags.map((flag) => <article key={flag.key} style={{ border: '1px solid #D9E1EA', borderRadius: 8, padding: 12, background: '#FFFFFF' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
              <div><strong>{flag.label}</strong><code style={{ display: 'block', marginTop: 3, color: '#64748B', fontSize: 11 }}>{flag.key}</code></div>
              <SuperAdminStatusBadge label={flag.enabled ? 'Enabled' : 'Disabled'} tone={flag.enabled ? 'success' : 'neutral'} />
            </div>
            <p style={{ color: '#475569', fontSize: 12, lineHeight: 1.5 }}>{flag.description}</p>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderTop: '1px solid #EEF2F6', paddingTop: 10 }}>
              <span><SuperAdminStatusBadge label={flag.category} tone="info" /></span>
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12 }}><input type="checkbox" checked={flag.enabled} onChange={(event) => setEnabled(flag.key, event.target.checked)} /> {flag.enabled ? 'On' : 'Off'}</span>
            </label>
          </article>)}
        </div>
      </SuperAdminSectionCard> : null}
    </SuperAdminPage>
  </ProtectedRoute>;
}
