'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { getMissingColumnFromError } from '../../../lib/supabaseSchemaCompat';
import { ActionButton, AlertBanner, Panel } from '../../components/workspace/WorkspaceUI';

type DriverProfileRow = {
  id: string;
  company_id: string;
  display_name: string | null;
  phone: string | null;
  email: string | null;
  availability_status: 'available' | 'busy' | 'offline' | null;
  status: string | null;
};

const availabilityLabels: Record<'available' | 'busy' | 'offline', string> = {
  available: 'Available',
  busy: 'On a job',
  offline: 'Offline',
};

const inputStyle = {
  width: '100%',
  height: '32px',
  padding: '0 8px',
  borderRadius: '4px',
  border: '1px solid #d8dee8',
  fontSize: '12px',
  background: '#fff',
  color: '#1a1f2b',
} as const;

const labelStyle = {
  display: 'block',
  marginBottom: '3px',
  color: '#64748b',
  fontSize: '10px',
  lineHeight: '14px',
  fontWeight: 700,
  letterSpacing: '.03em',
  textTransform: 'uppercase' as const,
};

const shortcutStyle = {
  minHeight: '44px',
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  alignItems: 'center',
  gap: '8px',
  border: '1px solid #d8dee8',
  borderRadius: '4px',
  background: '#fff',
  padding: '6px 8px',
  textAlign: 'left' as const,
  cursor: 'pointer',
};

function getWorkspaceModeLabel(user: ReturnType<typeof useAuth>['user']) {
  if (!user) return 'Driver workspace';
  if (user.ownerDriverExecutionMode) return 'Owner account · driver execution';
  if (user.ownerDriverWorkspace) return 'Owner-driver workspace';
  if (user.canAccessDriverMode) return 'Driver mode enabled';
  return 'Driver workspace';
}

export default function DriverProfilePage() {
  const { user } = useAuth();
  const router = useRouter();
  const driverId = user?.driverId ?? null;

  const [driver, setDriver] = useState<DriverProfileRow | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadProfile = useCallback(async () => {
    if (!driverId || !isSupabaseConfigured) {
      setDriver(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    const primary = await supabase
      .from('drivers')
      .select('id, company_id, display_name, phone, email, availability_status, status')
      .eq('id', driverId)
      .maybeSingle();

    let row = primary.data as DriverProfileRow | null;
    if (primary.error && getMissingColumnFromError(primary.error, 'drivers') !== null) {
      const fallback = await supabase
        .from('drivers')
        .select('id, company_id, display_name, phone, email, status')
        .eq('id', driverId)
        .maybeSingle();
      if (fallback.error) {
        setError('Your driver profile could not be loaded.');
        setLoading(false);
        return;
      }
      row = (fallback.data as DriverProfileRow | null) ?? null;
    } else if (primary.error) {
      setError('Your driver profile could not be loaded.');
      setLoading(false);
      return;
    }

    setDriver(row);
    setDisplayName(row?.display_name ?? '');
    setPhone(row?.phone ?? '');
    setLoading(false);
  }, [driverId]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const availabilityLabel = useMemo(() => {
    const status = driver?.availability_status;
    return status ? availabilityLabels[status] : 'Not set';
  }, [driver?.availability_status]);

  const handleSave = async () => {
    if (!driverId || !isSupabaseConfigured) return;

    setSaving(true);
    setError('');
    setSuccess('');

    const { error: updateError } = await supabase
      .from('drivers')
      .update({
        display_name: displayName.trim() || null,
        phone: phone.trim() || null,
      })
      .eq('id', driverId);

    if (updateError) {
      setError('Your profile changes could not be saved.');
    } else {
      setSuccess('Profile details updated.');
      await loadProfile();
    }
    setSaving(false);
  };

  const workspaceMode = getWorkspaceModeLabel(user);
  const contactEmail = driver?.email ?? user?.email ?? 'Not available';
  const companyLinked = Boolean(driver?.company_id ?? user?.companyId);
  const driverLinked = Boolean(driver?.id ?? user?.driverId);

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell
        subtitle="Identity, contact, account readiness and availability shortcuts without exposing internal platform identifiers."
        driverName={driver?.display_name ?? user?.email ?? 'Driver'}
        availabilityLabel={availabilityLabel}
      >
        {error && <AlertBanner tone="danger">{error}</AlertBanner>}
        {success && <AlertBanner tone="success">{success}</AlertBanner>}

        <div className="driver-profile-summary">
          <div>
            <span>Workspace</span>
            <strong>{workspaceMode}</strong>
          </div>
          <div>
            <span>Company connection</span>
            <strong>{companyLinked ? 'Linked' : 'Not linked'}</strong>
          </div>
          <div>
            <span>Driver profile</span>
            <strong>{driverLinked ? 'Active record' : 'Not linked'}</strong>
          </div>
        </div>

        <div className="driver-ops-grid-2">
          <Panel title="Driver identity & contact" description="Primary details used for driver operations and communication.">
            {loading ? (
              <div style={{ color: '#64748b', fontSize: '12px' }}>Loading profile…</div>
            ) : (
              <div style={{ display: 'grid', gap: '8px' }}>
                <div>
                  <label style={labelStyle}>Display name</label>
                  <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} style={inputStyle} placeholder="Driver name" />
                </div>
                <div>
                  <label style={labelStyle}>Phone</label>
                  <input value={phone} onChange={(event) => setPhone(event.target.value)} style={inputStyle} placeholder="Contact number" />
                </div>
                <div className="driver-detail-grid">
                  <div className="driver-detail-item"><span>Email</span><strong>{contactEmail}</strong></div>
                  <div className="driver-detail-item"><span>Role</span><strong>Driver</strong></div>
                  <div className="driver-detail-item"><span>Account status</span><strong>{driver?.status ?? 'Unknown'}</strong></div>
                  <div className="driver-detail-item"><span>Availability</span><strong>{availabilityLabel}</strong></div>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <ActionButton tone="secondary" onClick={() => router.push('/driver/change-password')}>Password & security</ActionButton>
                  <ActionButton tone="primary" onClick={() => void handleSave()} disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</ActionButton>
                </div>
              </div>
            )}
          </Panel>

          <Panel title="Operational shortcuts" description="Jump directly to the settings that affect live work visibility and readiness.">
            <div style={{ display: 'grid', gap: '6px' }}>
              <button type="button" onClick={() => router.push('/driver/availability')} style={shortcutStyle}>
                <span><strong style={{ display: 'block', fontSize: '12px', color: '#1a1f2b' }}>Availability & working radius</strong><small style={{ color: '#64748b', fontSize: '10px' }}>Current state: {availabilityLabel}</small></span><span aria-hidden="true" style={{ color: '#1d57d8' }}>→</span>
              </button>
              <button type="button" onClick={() => router.push('/driver/vehicles')} style={shortcutStyle}>
                <span><strong style={{ display: 'block', fontSize: '12px', color: '#1a1f2b' }}>Vehicle</strong><small style={{ color: '#64748b', fontSize: '10px' }}>Capacity and equipment profile</small></span><span aria-hidden="true" style={{ color: '#1d57d8' }}>→</span>
              </button>
              <button type="button" onClick={() => router.push('/driver/documents')} style={shortcutStyle}>
                <span><strong style={{ display: 'block', fontSize: '12px', color: '#1a1f2b' }}>Documents & compliance</strong><small style={{ color: '#64748b', fontSize: '10px' }}>Maintain ready-to-work evidence</small></span><span aria-hidden="true" style={{ color: '#1d57d8' }}>→</span>
              </button>
            </div>
          </Panel>
        </div>

        <Panel title="Account & exchange tools" description="Account, activity and support options available without changing the accepted workspace navigation.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '6px' }}>
            <button type="button" onClick={() => router.push('/driver/event-log')} style={shortcutStyle}>
              <span><strong style={{ display: 'block', fontSize: '12px', color: '#1a1f2b' }}>Event Log</strong><small style={{ color: '#64748b', fontSize: '10px' }}>Search and export account activity</small></span><span aria-hidden="true" style={{ color: '#1d57d8' }}>→</span>
            </button>
            <button type="button" onClick={() => router.push('/driver/history')} style={shortcutStyle}>
              <span><strong style={{ display: 'block', fontSize: '12px', color: '#1a1f2b' }}>Experience & Record</strong><small style={{ color: '#64748b', fontSize: '10px' }}>Completed work and operational history</small></span><span aria-hidden="true" style={{ color: '#1d57d8' }}>→</span>
            </button>
            <button type="button" onClick={() => router.push('/driver/notifications')} style={shortcutStyle}>
              <span><strong style={{ display: 'block', fontSize: '12px', color: '#1a1f2b' }}>Notifications</strong><small style={{ color: '#64748b', fontSize: '10px' }}>Account and job notifications</small></span><span aria-hidden="true" style={{ color: '#1d57d8' }}>→</span>
            </button>
            <button type="button" onClick={() => router.push('/terms')} style={shortcutStyle}>
              <span><strong style={{ display: 'block', fontSize: '12px', color: '#1a1f2b' }}>Terms & Conditions</strong><small style={{ color: '#64748b', fontSize: '10px' }}>Platform terms and policies</small></span><span aria-hidden="true" style={{ color: '#1d57d8' }}>→</span>
            </button>
            <button type="button" onClick={() => router.push('/support/feedback')} style={shortcutStyle}>
              <span><strong style={{ display: 'block', fontSize: '12px', color: '#1a1f2b' }}>Help & Support</strong><small style={{ color: '#64748b', fontSize: '10px' }}>Submit feedback or request support</small></span><span aria-hidden="true" style={{ color: '#1d57d8' }}>→</span>
            </button>
          </div>
        </Panel>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
