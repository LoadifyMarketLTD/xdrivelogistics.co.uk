'use client';

import { useEffect, useState } from 'react';

import { supabase } from '../../../lib/supabaseClient';
import { ActionButton, AlertBanner } from './WorkspaceUI';

type SmartAlertPreferences = {
  enabled: boolean;
  pickupProximityEnabled: boolean;
  deliveryProximityEnabled: boolean;
  pickupRadiusMiles: 1 | 2 | 5 | 10;
  deliveryRadiusMiles: 1 | 2 | 5 | 10;
  onSitePickupEnabled: boolean;
  loadedEnabled: boolean;
  onSiteDeliveryEnabled: boolean;
  podSubmittedEnabled: boolean;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
};

const DEFAULTS: SmartAlertPreferences = {
  enabled: true,
  pickupProximityEnabled: true,
  deliveryProximityEnabled: true,
  pickupRadiusMiles: 1,
  deliveryRadiusMiles: 1,
  onSitePickupEnabled: true,
  loadedEnabled: true,
  onSiteDeliveryEnabled: true,
  podSubmittedEnabled: true,
  inAppEnabled: true,
  emailEnabled: false,
  pushEnabled: false,
};

const radiusOptions = [1, 2, 5, 10] as const;

export function JobSmartAlertsPanel({ jobId }: { jobId: string }) {
  const [preferences, setPreferences] = useState<SmartAlertPreferences>(DEFAULTS);
  const [canManage, setCanManage] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setMessage('');
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        if (!token) throw new Error('Session expired.');
        const response = await fetch(`/api/workspace/jobs/${encodeURIComponent(jobId)}/smart-alerts`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const payload = await response.json().catch(() => ({})) as {
          preferences?: SmartAlertPreferences;
          canManage?: boolean;
          configured?: boolean;
          error?: string;
        };
        if (!response.ok || !payload.preferences) throw new Error(payload.error || 'Smart Alerts could not be loaded.');
        if (!cancelled) {
          setPreferences(payload.preferences);
          setCanManage(payload.canManage === true);
          setConfigured(payload.configured === true);
        }
      } catch (reason) {
        if (!cancelled) setMessage(reason instanceof Error ? reason.message : 'Smart Alerts could not be loaded.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [jobId]);

  const save = async () => {
    setSaving(true);
    setMessage('');
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error('Session expired.');
      const response = await fetch(`/api/workspace/jobs/${encodeURIComponent(jobId)}/smart-alerts`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      });
      const payload = await response.json().catch(() => ({})) as {
        preferences?: SmartAlertPreferences;
        error?: string;
      };
      if (!response.ok || !payload.preferences) throw new Error(payload.error || 'Smart Alerts could not be saved.');
      setPreferences(payload.preferences);
      setConfigured(true);
      setMessage('Smart / Pro Alerts saved.');
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Smart Alerts could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="workspace-record-meta"><span>Loading Smart / Pro Alerts...</span></div>;

  const checkbox = (
    label: string,
    key: keyof Pick<SmartAlertPreferences, 'pickupProximityEnabled' | 'deliveryProximityEnabled' | 'onSitePickupEnabled' | 'loadedEnabled' | 'onSiteDeliveryEnabled' | 'podSubmittedEnabled' | 'inAppEnabled' | 'emailEnabled' | 'pushEnabled'>,
  ) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
      <input
        type="checkbox"
        checked={Boolean(preferences[key])}
        disabled={!canManage || saving}
        onChange={(event) => setPreferences((current) => ({ ...current, [key]: event.target.checked }))}
      />
      {label}
    </label>
  );

  return (
    <div className="workspace-panel" style={{ padding: 10, display: 'grid', gap: 8 }}>
      <div className="workspace-record-meta" style={{ justifyContent: 'space-between' }}>
        <span><strong>Smart / Pro Alerts</strong> - {configured ? 'Configured for this booking' : 'Using recommended defaults'}</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            checked={preferences.enabled}
            disabled={!canManage || saving}
            onChange={(event) => setPreferences((current) => ({ ...current, enabled: event.target.checked }))}
          />
          Enabled
        </label>
      </div>

      <div className="workspace-detail-grid">
        <div className="workspace-detail-item">
          <strong>Pickup proximity</strong>
          {checkbox('Notify near pickup', 'pickupProximityEnabled')}
          <select
            value={preferences.pickupRadiusMiles}
            disabled={!canManage || saving || !preferences.pickupProximityEnabled}
            onChange={(event) => setPreferences((current) => ({ ...current, pickupRadiusMiles: Number(event.target.value) as 1 | 2 | 5 | 10 }))}
          >
            {radiusOptions.map((radius) => <option key={radius} value={radius}>{radius} mile{radius === 1 ? '' : 's'}</option>)}
          </select>
        </div>
        <div className="workspace-detail-item">
          <strong>Delivery proximity</strong>
          {checkbox('Notify near delivery', 'deliveryProximityEnabled')}
          <select
            value={preferences.deliveryRadiusMiles}
            disabled={!canManage || saving || !preferences.deliveryProximityEnabled}
            onChange={(event) => setPreferences((current) => ({ ...current, deliveryRadiusMiles: Number(event.target.value) as 1 | 2 | 5 | 10 }))}
          >
            {radiusOptions.map((radius) => <option key={radius} value={radius}>{radius} mile{radius === 1 ? '' : 's'}</option>)}
          </select>
        </div>
        <div className="workspace-detail-item">
          <strong>Milestones</strong>
          {checkbox('On site pickup', 'onSitePickupEnabled')}
          {checkbox('Loaded', 'loadedEnabled')}
          {checkbox('On site delivery', 'onSiteDeliveryEnabled')}
          {checkbox('POD submitted', 'podSubmittedEnabled')}
        </div>
        <div className="workspace-detail-item">
          <strong>Delivery channels</strong>
          {checkbox('In-app', 'inAppEnabled')}
          {checkbox('Email', 'emailEnabled')}
          {checkbox('Push', 'pushEnabled')}
        </div>
      </div>

      {message ? <AlertBanner tone={message.includes('saved') ? 'success' : 'warning'}>{message}</AlertBanner> : null}
      {canManage ? <div style={{ display: 'flex', justifyContent: 'flex-end' }}><ActionButton tone="success" disabled={saving} onClick={() => void save()}>{saving ? 'Saving...' : 'Save Smart Alerts'}</ActionButton></div> : <div className="workspace-record-meta"><span>View only. Smart Alerts are managed by the booking owner company.</span></div>}
    </div>
  );
}
