'use client';
import { useEffect, useState } from 'react';
import { readRouteAuthAccessToken } from '../../../../lib/routeAuthCookie';
type Driver = { availability_status?: string | null; destination_priority_enabled?: boolean; destination_radius_miles?: number };
export default function AvailabilityPage() {
  const [driver, setDriver] = useState<Driver | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    const token = readRouteAuthAccessToken();
    if (!token) { setError('Sign in required.'); return; }
    void fetch('/api/driver/web/resources', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      .then(async r => { const body = await r.json(); if (!r.ok) throw Error(body.error || 'Unavailable'); return body; })
      .then(body => { if (active) setDriver(body.resources?.driver ?? null); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Unavailable'); });
    return () => { active = false; };
  }, []);
  async function save() {
    const token = readRouteAuthAccessToken(); if (!token || !driver) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/driver/web/resources', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_destination_preferences', destinationPriorityEnabled: driver.destination_priority_enabled === true, destinationRadiusMiles: driver.destination_radius_miles ?? 20 }) });
      const result = await response.json(); if (!response.ok) throw Error(result.error || 'Could not save preferences');
      setDriver(current => current ? { ...current, ...result.preferences } : current);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save'); }
    finally { setBusy(false); }
  }
  return <section className="xd-mobile-list"><header><h1>Availability</h1><p>Driver status and destination preferences</p></header>
    {error && <p role="alert">{error}</p>}
    {!driver && !error && <p role="status">Loading...</p>}
    {driver && <article className="xd-mobile-card"><p>Current status: {driver.availability_status || 'Not provided'}</p>
      <label><input type="checkbox" checked={driver.destination_priority_enabled === true} onChange={e => setDriver({ ...driver, destination_priority_enabled: e.target.checked })}/> Destination priority</label>
      <label>Destination radius (miles) <select value={driver.destination_radius_miles ?? 20} onChange={e => setDriver({ ...driver, destination_radius_miles: Number(e.target.value) })}>{[10,20,30,50,100,200,300].map(v => <option key={v} value={v}>{v}</option>)}</select></label>
      <button type="button" disabled={busy} onClick={() => void save()}>{busy ? 'Saving...' : 'Save preferences'}</button>
    </article>}
  </section>;
}
