'use client';

import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '../AuthContext';
import { supabase } from '../../../lib/supabaseClient';
import { ActionButton, AlertBanner, EmptyState, Panel } from './WorkspaceUI';

type EventClass = 'operational' | 'marketplace' | 'finance' | 'account';
type PreferenceRow = {
  event_class: EventClass;
  in_app_enabled: boolean;
  email_enabled: boolean;
};

const DEFINITIONS: Array<{ id: EventClass; label: string; description: string }> = [
  { id: 'operational', label: 'Operational', description: 'Assignments, POD, tracking and booking execution updates.' },
  { id: 'marketplace', label: 'Marketplace', description: 'Load alerts, quote outcomes and carrier invitations.' },
  { id: 'finance', label: 'Finance', description: 'Invoice creation, disputes, payments and finance events.' },
  { id: 'account', label: 'Account', description: 'Onboarding, membership and account administration.' },
];

const defaults = () => Object.fromEntries(DEFINITIONS.map(({ id }) => [id, { inApp: true, email: true }])) as Record<EventClass, { inApp: boolean; email: boolean }>;

export default function NotificationPreferencesPanel({ driverMode = false }: { driverMode?: boolean }) {
  const { user } = useAuth();
  const [values, setValues] = useState(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    setLoading(true); setError('');
    const { data, error: loadError } = await supabase
      .from('user_notification_preferences')
      .select('event_class,in_app_enabled,email_enabled')
      .eq('user_id', user.id);
    if (loadError) {
      setError('Notification preferences could not be loaded.');
      setLoading(false);
      return;
    }
    const next = defaults();
    for (const row of (data ?? []) as PreferenceRow[]) {
      if (row.event_class in next) next[row.event_class] = { inApp: row.in_app_enabled, email: row.email_enabled };
    }
    setValues(next);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!user?.id) return;
    setSaving(true); setError(''); setNotice('');
    const now = new Date().toISOString();
    const rows = DEFINITIONS.map(({ id }) => ({
      user_id: user.id,
      event_class: id,
      in_app_enabled: values[id].inApp,
      email_enabled: values[id].email,
      updated_at: now,
    }));
    const { error: saveError } = await supabase
      .from('user_notification_preferences')
      .upsert(rows, { onConflict: 'user_id,event_class' });
    setSaving(false);
    if (saveError) {
      setError('Notification preferences could not be saved.');
      return;
    }
    setNotice('Notification preferences saved.');
  };

  if (loading) return <Panel><EmptyState compact title="Loading notification preferences…" /></Panel>;

  return <Panel title="Notification Preferences" description="Choose which XDrive event classes appear in your in-app inbox and which are also emailed to you.">
    {error && <AlertBanner tone="danger">{error}</AlertBanner>}
    {notice && <AlertBanner tone="success">{notice}</AlertBanner>}
    <div style={{ display: 'grid', gap: 8 }}>
      {DEFINITIONS.map((definition) => <div key={definition.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto auto', gap: 12, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #eef2f7' }}>
        <div><strong style={{ display: 'block', fontSize: 12 }}>{definition.label}</strong><span style={{ color: '#64748b', fontSize: 11 }}>{definition.description}</span></div>
        <label style={{ display: 'inline-flex', gap: 5, alignItems: 'center', fontSize: 11, fontWeight: 700 }}><input type="checkbox" checked={values[definition.id].inApp} onChange={(event) => setValues((current) => ({ ...current, [definition.id]: { ...current[definition.id], inApp: event.target.checked } }))} />In-app</label>
        <label style={{ display: 'inline-flex', gap: 5, alignItems: 'center', fontSize: 11, fontWeight: 700 }}><input type="checkbox" checked={values[definition.id].email} onChange={(event) => setValues((current) => ({ ...current, [definition.id]: { ...current[definition.id], email: event.target.checked } }))} />Email</label>
      </div>)}
    </div>
    {driverMode && <div style={{ marginTop: 10, color: '#64748b', fontSize: 11 }}>Load Alert push notifications are managed separately in your Load Alert preferences. These switches control the XDrive inbox and email channels only.</div>}
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}><ActionButton tone="primary" disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save Preferences'}</ActionButton></div>
  </Panel>;
}
