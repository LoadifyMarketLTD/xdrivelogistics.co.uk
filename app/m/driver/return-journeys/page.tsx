'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { readRouteAuthAccessToken } from '../../../../lib/routeAuthCookie';

type Journey = {
  from_postcode?: string | null;
  to_postcode?: string | null;
  available_from?: string | null;
  available_to?: string | null;
  vehicle_type?: string | null;
  notes?: string | null;
  status?: string | null;
};

type JourneyForm = {
  from: string;
  to: string;
  availableFrom: string;
  availableTo: string;
  vehicle: string;
  notes: string;
};

const emptyForm: JourneyForm = {
  from: '', to: '', availableFrom: '', availableTo: '', vehicle: '', notes: '',
};

function datetimeLocal(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (number: number) => String(number).padStart(2, '0');
  return [
    date.getFullYear(), '-', pad(date.getMonth() + 1), '-', pad(date.getDate()),
    'T', pad(date.getHours()), ':', pad(date.getMinutes()),
  ].join('');
}

function formFromJourney(journey: Journey | null): JourneyForm {
  if (!journey || (journey.status && journey.status !== 'available')) return { ...emptyForm };
  return {
    from: journey.from_postcode || '',
    to: journey.to_postcode || '',
    availableFrom: datetimeLocal(journey.available_from),
    availableTo: datetimeLocal(journey.available_to),
    vehicle: journey.vehicle_type || '',
    notes: journey.notes || '',
  };
}

export default function DriverReturnJourneysPage() {
  const [form, setForm] = useState<JourneyForm>({ ...emptyForm });
  const [hasJourney, setHasJourney] = useState(false);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setReady(false);
    setHasJourney(false);
    setForm({ ...emptyForm });
    setError('');
    try {
      const token = readRouteAuthAccessToken();
      if (!token) throw new Error('Sign in to manage your return journeys.');
      const response = await fetch('/api/driver/web/resources', {
        cache: 'no-store', headers: { Authorization: 'Bearer ' + token },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.resources) throw new Error(result.error || 'Return journey could not be loaded.');
      if (result.resources.partial?.includes('return_journey')) {
        throw new Error('Return journey service is currently unavailable. Please retry.');
      }
      const journey = (result.resources.return_journey || null) as Journey | null;
      setHasJourney(Boolean(journey?.from_postcode && (!journey.status || journey.status === 'available')));
      setForm(formFromJourney(journey));
      setReady(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Return journey could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const save = async (clear = false) => {
    if (saving || loading) return;
    setError('');
    setNotice('');
    const from = clear ? '' : form.from.trim().toUpperCase();
    const to = clear ? '' : form.to.trim().toUpperCase();
    if (!clear && (!from || !to || !form.availableFrom || !form.availableTo)) {
      setError('Enter both journey areas and an available-from and available-until time.');
      return;
    }
    const start = clear ? null : new Date(form.availableFrom);
    const end = clear ? null : new Date(form.availableTo);
    if (!clear && (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())
      || start.getTime() <= Date.now() || end.getTime() <= start.getTime())) {
      setError('Choose a future start time and an end time after the start.');
      return;
    }

    setSaving(true);
    try {
      const token = readRouteAuthAccessToken();
      if (!token) throw new Error('Your session expired. Sign in again.');
      const response = await fetch('/api/driver/web/resources', {
        method: 'POST', cache: 'no-store',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_return_journey',
          fromLocation: from,
          toLocation: to,
          availableDate: start?.toISOString() || null,
          availableTo: end?.toISOString() || null,
          vehicleType: clear ? null : form.vehicle.trim(),
          notes: clear ? null : form.notes.trim(),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok !== true) throw new Error(result.error || 'Return journey could not be saved.');
      await refresh();
      setNotice(clear ? 'Return journey removed.' : 'Return journey saved.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Return journey could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const update = (field: keyof JourneyForm, value: string) =>
    setForm(previous => ({ ...previous, [field]: value }));

  return <section className="xd-mobile-list">
    <header>
      <Link className="xd-mobile-back" href="/m/driver/more">More</Link>
      <h1>Return Journeys</h1>
      <p>Let the network know when and where your vehicle can collect a return load.</p>
    </header>
    {loading ? <p role="status">Loading return journey...</p> : null}
    {error ? <div role="alert" className="xd-mobile-error"><p>{error}</p>
      {!loading && !hasJourney && !form.from ? <button type="button" onClick={() => void refresh()}>Retry</button> : null}
    </div> : null}
    {notice ? <p role="status" className="xd-mobile-success">{notice}</p> : null}
    {ready && !hasJourney ? <p>No active return journey is saved.</p> : null}
    {ready && !loading ? <form className="xd-mobile-card" onSubmit={(event: FormEvent<HTMLFormElement>) => {
      event.preventDefault(); void save();
    }}>
      <label htmlFor="return-from">From town or postcode</label>
      <input id="return-from" value={form.from} maxLength={120} required disabled={saving}
        onChange={event => update('from', event.target.value)} placeholder="e.g. Manchester M1" />
      <label htmlFor="return-to">To town or postcode</label>
      <input id="return-to" value={form.to} maxLength={120} required disabled={saving}
        onChange={event => update('to', event.target.value)} placeholder="e.g. Birmingham B1" />
      <label htmlFor="return-start">Available from</label>
      <input id="return-start" type="datetime-local" value={form.availableFrom} required disabled={saving}
        onChange={event => update('availableFrom', event.target.value)} />
      <label htmlFor="return-end">Available until</label>
      <input id="return-end" type="datetime-local" value={form.availableTo} required disabled={saving}
        onChange={event => update('availableTo', event.target.value)} />
      <label htmlFor="return-vehicle">Vehicle type (optional)</label>
      <input id="return-vehicle" value={form.vehicle} maxLength={100} disabled={saving}
        onChange={event => update('vehicle', event.target.value)} placeholder="e.g. Luton Van" />
      <label htmlFor="return-notes">Notes (optional)</label>
      <textarea id="return-notes" value={form.notes} maxLength={4000} rows={3} disabled={saving}
        onChange={event => update('notes', event.target.value)} />
      <p className="xd-mobile-muted">Times use your device's local timezone. Return journeys are visible only according to platform access rules.</p>
      <div className="xd-mobile-actions">
        <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save return journey'}</button>
        {hasJourney ? <button type="button" className="xd-mobile-button--secondary" disabled={saving}
          onClick={() => void save(true)}>Remove journey</button> : null}
      </div>
    </form> : null}
  </section>;
}
