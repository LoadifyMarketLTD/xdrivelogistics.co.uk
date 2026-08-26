'use client';

import { useCallback, useEffect, useState } from 'react';
import ProtectedRoute from '../../../components/ProtectedRoute';
import DriverWorkspaceShell from '../../_components/DriverWorkspaceShell';
import { supabase } from '../../../../lib/supabaseClient';
import { ActionButton, AlertBanner, Panel, StatusBadge } from '../../../components/workspace/WorkspaceUI';

type Visibility = 'private' | 'fleet' | 'exchange';
type Presence = { visibility: Visibility; available_until: string; recorded_at: string };

const VISIBILITY_COPY: Record<Visibility, string> = {
  private: 'Only you. Your position is not shared with Fleet or the Exchange.',
  fleet: 'Your own Fleet/company can see your exact availability position. The Exchange cannot.',
  exchange: 'Your Fleet can see the exact position. Exchange users receive only an intentionally rounded area position.',
};

export default function LiveAvailabilityPage() {
  const [presence, setPresence] = useState<Presence | null>(null);
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [hours, setHours] = useState(4);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const authHeader = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ? `Bearer ${data.session.access_token}` : null;
  }, []);

  const load = useCallback(async () => {
    const auth = await authHeader();
    if (!auth) return;
    const response = await fetch('/api/driver/availability-presence', { headers: { Authorization: auth }, cache: 'no-store' });
    const payload = await response.json().catch(() => ({})) as { active?: boolean; presence?: Presence | null };
    setPresence(response.ok && payload.active ? payload.presence ?? null : null);
  }, [authHeader]);

  useEffect(() => { void load(); }, [load]);

  const start = async () => {
    if (!navigator.geolocation || busy) {
      if (!navigator.geolocation) setError('Location access is not available on this device/browser.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    navigator.geolocation.getCurrentPosition(async (position) => {
      const auth = await authHeader();
      if (!auth) { setError('Your session has expired.'); setBusy(false); return; }
      const response = await fetch('/api/driver/availability-presence', {
        method: 'POST',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          visibility,
          hours,
        }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string; available_until?: string };
      if (!response.ok) setError(payload.error ?? 'Live availability could not be started.');
      else {
        setMessage(`Live availability is on until ${new Date(payload.available_until ?? Date.now()).toLocaleString('en-GB')}.`);
        await load();
      }
      setBusy(false);
    }, () => {
      setError('Location permission is required to share live availability.');
      setBusy(false);
    }, { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 });
  };

  const stop = async () => {
    setBusy(true);
    setError('');
    const auth = await authHeader();
    if (!auth) { setError('Your session has expired.'); setBusy(false); return; }
    const response = await fetch('/api/driver/availability-presence', { method: 'DELETE', headers: { Authorization: auth } });
    if (!response.ok) setError('Live availability could not be stopped.');
    else { setPresence(null); setMessage('Live availability is off.'); }
    setBusy(false);
  };

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell subtitle="Opt in only when you want XDrive to use your location to help find work. This is separate from live job tracking." availabilityLabel={presence ? 'Live availability ON' : 'Live availability OFF'}>
        <div style={{ display: 'grid', gap: 12 }}>
          {message && <AlertBanner tone="success">{message}</AlertBanner>}
          {error && <AlertBanner tone="danger">{error}</AlertBanner>}
          <Panel title="Share availability location" description="OFF by default. Maximum 8 hours, then it expires automatically.">
            <div style={{ display: 'grid', gap: 12 }}>
              <div className="workspace-record-meta" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <span>Status <StatusBadge value={presence ? 'ON' : 'OFF'} tone={presence ? 'green' : 'grey'} /></span>
                {presence && <span>Expires {new Date(presence.available_until).toLocaleString('en-GB')}</span>}
              </div>

              <label>
                <strong>Who may use this availability position?</strong>
                <select value={visibility} onChange={(event) => setVisibility(event.target.value as Visibility)} disabled={busy || Boolean(presence)}>
                  <option value="private">Private</option>
                  <option value="fleet">My Fleet only</option>
                  <option value="exchange">Fleet + Exchange area</option>
                </select>
              </label>
              <p>{VISIBILITY_COPY[visibility]}</p>

              <label>
                <strong>Auto-off after</strong>
                <select value={hours} onChange={(event) => setHours(Number(event.target.value))} disabled={busy || Boolean(presence)}>
                  <option value={1}>1 hour</option>
                  <option value={4}>4 hours</option>
                  <option value={8}>8 hours</option>
                </select>
              </label>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {!presence ? (
                  <ActionButton tone="primary" onClick={() => void start()} disabled={busy}>Start live availability</ActionButton>
                ) : (
                  <ActionButton tone="danger" onClick={() => void stop()} disabled={busy}>Stop live availability</ActionButton>
                )}
                <ActionButton onClick={() => window.location.assign('/driver/availability')} disabled={busy}>Back to Availability</ActionButton>
              </div>
            </div>
          </Panel>
        </div>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
