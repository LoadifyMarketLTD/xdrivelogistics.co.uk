'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { readRouteAuthAccessToken } from '../../../../lib/routeAuthCookie';
import DriverLocationSharing from '../DriverLocationSharing';

type AvailabilityStatus = 'available' | 'busy' | 'offline';
type DriverAvailability = {
  availability_status: AvailabilityStatus;
  destination_priority_enabled: boolean;
  destination_radius_miles: number;
};

const radii = [10, 20, 30, 50, 100, 200, 300] as const;

function normalizeDriver(value: Record<string, unknown>): DriverAvailability {
  const status = String(value.availability_status || 'offline');
  const radius = Number(value.destination_radius_miles);
  return {
    availability_status: status === 'available' || status === 'busy' ? status : 'offline',
    destination_priority_enabled: value.destination_priority_enabled === true,
    destination_radius_miles: radii.some(option => option === radius) ? radius : 30,
  };
}

export default function DriverAvailabilityPage() {
  const [driver, setDriver] = useState<DriverAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setDriver(null);
    setError('');
    setNotice('');
    try {
      const token = readRouteAuthAccessToken();
      if (!token) throw new Error('Sign in to manage your availability.');
      const response = await fetch('/api/driver/availability-profile', {
        cache: 'no-store',
        headers: { Authorization: 'Bearer ' + token },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.driver) {
        throw new Error(result.error || 'Your availability could not be loaded.');
      }
      setDriver(normalizeDriver(result.driver));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Your availability could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!driver || saving) return;
    setSaving(true);
    setNotice('');
    setError('');
    try {
      const token = readRouteAuthAccessToken();
      if (!token) throw new Error('Your session expired. Sign in again.');
      const response = await fetch('/api/driver/availability-profile', {
        method: 'PUT',
        cache: 'no-store',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          availabilityStatus: driver.availability_status,
          destinationPriorityEnabled: driver.destination_priority_enabled,
          destinationRadiusMiles: driver.destination_radius_miles,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.driver) {
        throw new Error(result.error || 'Your availability could not be saved.');
      }
      setDriver(normalizeDriver(result.driver));
      setNotice('Availability preferences saved.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Your availability could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return <section className="xd-mobile-list">
    <header>
      <Link className="xd-mobile-back" href="/m/driver/more">More</Link>
      <h1>Availability</h1>
      <p>Control your availability and destination preferences.</p>
    </header>
    {loading ? <p role="status">Loading availability...</p> : null}
    {error ? <div className="xd-mobile-error" role="alert"><p>{error}</p>
      {!driver ? <button type="button" onClick={() => void refresh()}>Retry</button> : null}
    </div> : null}
    {notice ? <p className="xd-mobile-success" role="status">{notice}</p> : null}
    {driver && !loading ? <form className="xd-mobile-card" onSubmit={event => void save(event)}>
      <label htmlFor="availability-status">Driver status</label>
      <select id="availability-status" value={driver.availability_status} disabled={saving}
        onChange={event => setDriver(previous => previous ? { ...previous, availability_status: event.target.value as AvailabilityStatus } : null)}>
        <option value="available">Available</option>
        <option value="busy">Busy</option>
        <option value="offline">Offline</option>
      </select>
      <label className="xd-mobile-check" htmlFor="destination-priority">
        <input id="destination-priority" type="checkbox" checked={driver.destination_priority_enabled} disabled={saving}
          onChange={event => setDriver(previous => previous ? { ...previous, destination_priority_enabled: event.target.checked } : null)} />
        Prioritise jobs near my destination
      </label>
      <label htmlFor="destination-radius">Destination search radius</label>
      <select id="destination-radius" disabled={saving} value={driver.destination_radius_miles}
        onChange={event => setDriver(previous => previous ? { ...previous, destination_radius_miles: Number(event.target.value) } : null)}>
        {radii.map(radius => <option key={radius} value={radius}>{radius} miles</option>)}
      </select>
      <p className="xd-mobile-muted">Setting Available does not automatically share your precise location. To enable GPS, save Available status and use the separate Share my GPS button below. Location sharing stops when you stop it or leave this page; background GPS is not guaranteed in a PWA.</p>
      <div className="xd-mobile-actions">
        <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save preferences'}</button>
      </div>
    </form> : null}
    {driver?.availability_status === 'available' && !loading ? <DriverLocationSharing /> : null}
  </section>;
}
