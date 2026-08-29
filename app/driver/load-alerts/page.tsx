'use client';

import { useCallback, useEffect, useState } from 'react';

import ProtectedRoute from '../../components/ProtectedRoute';
import { supabase } from '../../../lib/supabaseClient';
import { ActionButton, AlertBanner, StatusBadge } from '../../components/workspace/WorkspaceUI';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';

type LoadAlertPreference = {
  enabled: boolean;
  currentRadiusEnabled: boolean;
  homeOutcodeEnabled: boolean;
  homeOutcode: string;
  futurePositionEnabled: boolean;
  radiusMiles: number;
  currentLocationMaxAgeMinutes: number;
  requireVehicleMatch: boolean;
  minimumBudgetGbp: number | null;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
};

type LoadAlertContext = {
  futurePosition: string | null;
  futurePositionDate: string | null;
  availabilityStatus: string | null;
  vehicleType: string | null;
  vehicleRegistration: string | null;
};

type ApiPayload = {
  preference?: LoadAlertPreference;
  context?: LoadAlertContext;
  matchedRecent?: number;
  warning?: string;
  error?: string;
  code?: string;
};

const DEFAULT_PREFERENCE: LoadAlertPreference = {
  enabled: false,
  currentRadiusEnabled: true,
  homeOutcodeEnabled: false,
  homeOutcode: '',
  futurePositionEnabled: true,
  radiusMiles: 30,
  currentLocationMaxAgeMinutes: 120,
  requireVehicleMatch: true,
  minimumBudgetGbp: null,
  inAppEnabled: true,
  emailEnabled: false,
  pushEnabled: false,
};

function humanize(value: string | null | undefined) {
  return value ? value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase()) : 'Not available';
}

function when(value: string | null | undefined) {
  if (!value) return 'Not set';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Not set' : parsed.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function DriverLoadAlertsPage() {
  const [preference, setPreference] = useState<LoadAlertPreference>(DEFAULT_PREFERENCE);
  const [context, setContext] = useState<LoadAlertContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [warning, setWarning] = useState('');
  const [schemaUnavailable, setSchemaUnavailable] = useState(false);

  const authHeader = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : null;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setWarning('');
    const auth = await authHeader();
    if (!auth) {
      setError('Your session has expired. Sign in again to manage Load Alerts.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/driver/load-alert-preferences', { headers: auth, cache: 'no-store' });
      const payload = await response.json().catch(() => ({})) as ApiPayload;
      if (!response.ok) {
        if (payload.code === 'LOAD_ALERT_SCHEMA_UNAVAILABLE') {
          setSchemaUnavailable(true);
          setError('Smart Load Alerts are prepared for this release, but they are not active in this environment yet. No alert settings have been applied here.');
        } else {
          setError(payload.error ?? 'Load Alert settings could not be loaded.');
        }
        setLoading(false);
        return;
      }
      setSchemaUnavailable(false);
      setPreference(payload.preference ?? DEFAULT_PREFERENCE);
      setContext(payload.context ?? null);
    } catch {
      setError('Load Alert settings could not be loaded.');
    }
    setLoading(false);
  }, [authHeader]);

  useEffect(() => { void load(); }, [load]);

  const patch = <K extends keyof LoadAlertPreference>(key: K, value: LoadAlertPreference[K]) => {
    setPreference((current) => ({ ...current, [key]: value }));
  };

  const save = async () => {
    if (saving || schemaUnavailable) return;
    setSaving(true);
    setError('');
    setSuccess('');
    setWarning('');

    const auth = await authHeader();
    if (!auth) {
      setError('Your session has expired. Sign in again to save Load Alerts.');
      setSaving(false);
      return;
    }

    try {
      const response = await fetch('/api/driver/load-alert-preferences', {
        method: 'PUT',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify(preference),
      });
      const payload = await response.json().catch(() => ({})) as ApiPayload;
      if (!response.ok) {
        if (payload.code === 'LOAD_ALERT_SCHEMA_UNAVAILABLE') setSchemaUnavailable(true);
        setError(payload.error ?? 'Load Alert settings could not be saved.');
        setSaving(false);
        return;
      }
      if (payload.preference) setPreference(payload.preference);
      if (payload.context) setContext(payload.context);
      setWarning(payload.warning ?? '');
      const matched = Number(payload.matchedRecent ?? 0);
      setSuccess(preference.enabled
        ? `Load Alerts saved.${matched > 0 ? ` ${matched} recent matching load${matched === 1 ? '' : 's'} added to your alerts.` : ''}`
        : 'Load Alerts switched off.');
    } catch {
      setError('Load Alert settings could not be saved.');
    }
    setSaving(false);
  };

  const sourcesSelected = [preference.currentRadiusEnabled, preference.homeOutcodeEnabled, preference.futurePositionEnabled].filter(Boolean).length;
  const channelsSelected = [preference.inAppEnabled, preference.emailEnabled, preference.pushEnabled].filter(Boolean).length;

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell
        subtitle="Choose which marketplace loads should reach you and how XDrive should alert you. Exact live coordinates stay private and are used only for matching."
        availabilityLabel={preference.enabled ? 'Alerts on' : 'Alerts off'}
        headerActions={<ActionButton tone="secondary" onClick={() => void load()} disabled={loading}>Refresh</ActionButton>}
      >
        {error && <AlertBanner tone={schemaUnavailable ? 'warning' : 'danger'}>{error}</AlertBanner>}
        {warning && <AlertBanner tone="warning">{warning}</AlertBanner>}
        {success && <AlertBanner tone="success">{success}</AlertBanner>}

        <section className="workspace-panel" style={{ marginBottom: 8 }}>
          <div className="workspace-panel__header" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
            <div>
              <strong>Smart Load Alerts</strong>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Opt in to relevant marketplace work instead of relying on a general notification bell.</div>
            </div>
            <StatusBadge value={preference.enabled ? 'Enabled' : 'Disabled'} tone={preference.enabled ? 'green' : 'grey'} />
          </div>
          <div className="workspace-panel__body">
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <input type="checkbox" checked={preference.enabled} onChange={(event) => patch('enabled', event.target.checked)} disabled={loading || schemaUnavailable} />
              <span><strong>Send me matching load alerts</strong><br /><span style={{ color: '#64748b', fontSize: 12 }}>Only loads that pass your selected location, vehicle and budget rules can generate an alert.</span></span>
            </label>
          </div>
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 8 }}>
          <section className="workspace-panel">
            <div className="workspace-panel__header"><strong>Where should XDrive match?</strong></div>
            <div className="workspace-panel__body" style={{ display: 'grid', gap: 12 }}>
              <label style={{ display: 'flex', gap: 8 }}><input type="checkbox" checked={preference.currentRadiusEnabled} onChange={(event) => patch('currentRadiusEnabled', event.target.checked)} disabled={loading || schemaUnavailable} /><span><strong>Current position</strong><br /><span style={{ fontSize: 12, color: '#64748b' }}>Match collection points near your recent Driver location.</span></span></label>
              <label>RADIUS
                <select value={preference.radiusMiles} onChange={(event) => patch('radiusMiles', Number(event.target.value))} disabled={loading || schemaUnavailable || !preference.currentRadiusEnabled}>
                  {[5, 10, 20, 30, 50, 100, 200, 300].map((miles) => <option key={miles} value={miles}>{miles} miles</option>)}
                </select>
              </label>
              <label>MAX LOCATION AGE
                <select value={preference.currentLocationMaxAgeMinutes} onChange={(event) => patch('currentLocationMaxAgeMinutes', Number(event.target.value))} disabled={loading || schemaUnavailable || !preference.currentRadiusEnabled}>
                  <option value={30}>30 minutes</option><option value={60}>1 hour</option><option value={120}>2 hours</option><option value={240}>4 hours</option><option value={360}>6 hours</option>
                </select>
              </label>

              <label style={{ display: 'flex', gap: 8 }}><input type="checkbox" checked={preference.homeOutcodeEnabled} onChange={(event) => patch('homeOutcodeEnabled', event.target.checked)} disabled={loading || schemaUnavailable} /><span><strong>Home area</strong><br /><span style={{ fontSize: 12, color: '#64748b' }}>Match by UK outcode only, not by a private home address.</span></span></label>
              <label>HOME OUTCODE<input value={preference.homeOutcode} onChange={(event) => patch('homeOutcode', event.target.value.toUpperCase())} placeholder="e.g. BB1" disabled={loading || schemaUnavailable || !preference.homeOutcodeEnabled} /></label>

              <label style={{ display: 'flex', gap: 8 }}><input type="checkbox" checked={preference.futurePositionEnabled} onChange={(event) => patch('futurePositionEnabled', event.target.checked)} disabled={loading || schemaUnavailable} /><span><strong>Future / return position</strong><br /><span style={{ fontSize: 12, color: '#64748b' }}>Use your saved future position when it lines up with the collection time.</span></span></label>
              <div className="workspace-record-meta"><span>Saved position: <strong>{context?.futurePosition ?? 'Not set'}</strong></span><span>{when(context?.futurePositionDate)}</span></div>
            </div>
          </section>

          <section className="workspace-panel">
            <div className="workspace-panel__header"><strong>Which loads should qualify?</strong></div>
            <div className="workspace-panel__body" style={{ display: 'grid', gap: 12 }}>
              <label style={{ display: 'flex', gap: 8 }}><input type="checkbox" checked={preference.requireVehicleMatch} onChange={(event) => patch('requireVehicleMatch', event.target.checked)} disabled={loading || schemaUnavailable} /><span><strong>Require vehicle match</strong><br /><span style={{ fontSize: 12, color: '#64748b' }}>Only alert when the load matches your active XDrive vehicle type.</span></span></label>
              <div className="workspace-record-meta"><span>Vehicle: <strong>{humanize(context?.vehicleType)}</strong></span><span>{context?.vehicleRegistration ?? 'Registration not available'}</span></div>
              <label>MINIMUM LOAD BUDGET (£)<input type="number" min="0" step="1" value={preference.minimumBudgetGbp ?? ''} onChange={(event) => patch('minimumBudgetGbp', event.target.value === '' ? null : Number(event.target.value))} placeholder="No minimum" disabled={loading || schemaUnavailable} /></label>
              <div style={{ fontSize: 12, color: '#64748b' }}>If a load has no stated budget and you set a minimum, that load will not match.</div>
            </div>
          </section>

          <section className="workspace-panel">
            <div className="workspace-panel__header"><strong>How should XDrive alert you?</strong></div>
            <div className="workspace-panel__body" style={{ display: 'grid', gap: 12 }}>
              <label style={{ display: 'flex', gap: 8 }}><input type="checkbox" checked={preference.inAppEnabled} onChange={(event) => patch('inAppEnabled', event.target.checked)} disabled={loading || schemaUnavailable} /><span><strong>In-app</strong><br /><span style={{ fontSize: 12, color: '#64748b' }}>Add matching loads to your XDrive notifications.</span></span></label>
              <label style={{ display: 'flex', gap: 8 }}><input type="checkbox" checked={preference.emailEnabled} onChange={(event) => patch('emailEnabled', event.target.checked)} disabled={loading || schemaUnavailable} /><span><strong>Email</strong><br /><span style={{ fontSize: 12, color: '#64748b' }}>Send the public collection/delivery areas and a link back to XDrive.</span></span></label>
              <label style={{ display: 'flex', gap: 8 }}><input type="checkbox" checked={preference.pushEnabled} onChange={(event) => patch('pushEnabled', event.target.checked)} disabled={loading || schemaUnavailable} /><span><strong>Push</strong><br /><span style={{ fontSize: 12, color: '#64748b' }}>Use an active registered Driver device when push delivery is configured.</span></span></label>
              <div className="workspace-record-meta"><span>{sourcesSelected} matching source{sourcesSelected === 1 ? '' : 's'}</span><span>{channelsSelected} channel{channelsSelected === 1 ? '' : 's'}</span></div>
            </div>
          </section>
        </div>

        <section className="workspace-panel" style={{ marginTop: 8 }}>
          <div className="workspace-panel__body" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12, color: '#64748b', maxWidth: 720 }}>
              XDrive uses your exact tracking coordinates only while checking whether a load is nearby. Alerts show public collection and delivery areas, never your live coordinates or a customer's exact pre-award address.
            </div>
            <ActionButton tone="primary" onClick={() => void save()} disabled={loading || saving || schemaUnavailable}>{saving ? 'Saving…' : 'Save Load Alerts'}</ActionButton>
          </div>
        </section>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
