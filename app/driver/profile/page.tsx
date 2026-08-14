'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { getMissingColumnFromError } from '../../../lib/supabaseSchemaCompat';
import { ActionButton, AlertBanner, StatusBadge } from '../../components/workspace/WorkspaceUI';

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

function getWorkspaceModeLabel(user: ReturnType<typeof useAuth>['user']) {
  if (!user) return 'Driver workspace';
  if (user.ownerDriverExecutionMode) return 'Owner account · driver execution';
  if (user.ownerDriverWorkspace) return 'Owner-driver workspace';
  if (user.canAccessDriverMode) return 'Driver mode enabled';
  return 'Driver workspace';
}

type AccountLink = { label: string; description: string; href: string };

const ACCOUNT_LINKS: AccountLink[] = [
  { label: 'My Profile', description: 'Identity, contact details and account status', href: '/driver/profile' },
  { label: 'Vehicle', description: 'Vehicle capacity, equipment and readiness', href: '/driver/vehicles' },
  { label: 'Documents', description: 'Insurance, compliance and expiry evidence', href: '/driver/documents' },
  { label: 'Invoices & Finance', description: 'Invoices, earnings and payment records', href: '/driver/finance' },
  { label: 'Experience & Record', description: 'Completed work and operational history', href: '/driver/history' },
  { label: 'Event Log', description: 'Search and export account activity', href: '/driver/event-log' },
  { label: 'Messages', description: 'Operational and account conversations', href: '/driver/messages' },
  { label: 'Notifications', description: 'Account and job notifications', href: '/driver/notifications' },
  { label: 'Availability', description: 'Live status, matching radius and schedule', href: '/driver/availability' },
  { label: 'Password & Security', description: 'Account access and password settings', href: '/driver/change-password' },
  { label: 'Terms & Conditions', description: 'Platform terms and policies', href: '/terms' },
  { label: 'Help & Support', description: 'Feedback and support requests', href: '/support/feedback' },
];

export default function DriverProfilePage() {
  const { user } = useAuth();
  const router = useRouter();
  const driverId = typeof user?.driverId === 'string' ? user.driverId.trim() : '';

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

  useEffect(() => { void loadProfile(); }, [loadProfile]);

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
      .update({ display_name: displayName.trim() || null, phone: phone.trim() || null })
      .eq('id', driverId);

    if (updateError) setError('Your profile changes could not be saved.');
    else {
      setSuccess('Profile details updated.');
      await loadProfile();
    }
    setSaving(false);
  };

  const workspaceMode = getWorkspaceModeLabel(user);
  const contactEmail = driver?.email ?? user?.email ?? 'Not available';
  const companyLinked = Boolean(driver?.company_id ?? user?.companyId);
  const driverLinked = Boolean(driver?.id ?? user?.driverId);
  const availabilityTone = driver?.availability_status === 'available' ? 'green' : driver?.availability_status === 'busy' ? 'orange' : 'grey';

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell
        subtitle="Manage driver identity, readiness and account tools from one compact account workspace."
        driverName={driver?.display_name ?? user?.email ?? 'Driver'}
        availabilityLabel={availabilityLabel}
      >
        {error && <AlertBanner tone="danger">{error}</AlertBanner>}
        {success && <AlertBanner tone="success">{success}</AlertBanner>}

        <div className="driver-account-status" aria-label="Account status">
          <div><span>Workspace</span><strong>{workspaceMode}</strong></div>
          <div><span>Company connection</span><strong>{companyLinked ? 'Linked' : 'Not linked'}</strong></div>
          <div><span>Driver profile</span><strong>{driverLinked ? 'Active record' : 'Not linked'}</strong></div>
        </div>

        <div className="driver-account-hub">
          <section className="driver-account-column" aria-label="Account sections">
            <div className="driver-account-column__head">Account</div>
            <div className="driver-account-column__body">
              {ACCOUNT_LINKS.map((item) => (
                <button key={item.href} type="button" className="driver-account-link" onClick={() => router.push(item.href)}>
                  <span><strong>{item.label}</strong><small>{item.description}</small></span>
                  <span aria-hidden="true">→</span>
                </button>
              ))}
            </div>
          </section>

          <section className="driver-account-column" id="driver-account-profile">
            <div className="driver-account-column__head">My Profile</div>
            {loading ? (
              <div className="driver-account-member-card"><div><span>Status</span><strong>Loading profile…</strong></div></div>
            ) : (
              <>
                <div className="driver-account-member-card">
                  <div><span>Email</span><strong>{contactEmail}</strong></div>
                  <div><span>Role</span><strong>Driver</strong></div>
                  <div><span>Account status</span><strong>{driver?.status ?? 'Unknown'}</strong></div>
                  <div><span>Availability</span><strong><StatusBadge value={availabilityLabel} tone={availabilityTone} /></strong></div>
                </div>
                <div className="driver-account-edit">
                  <label>Display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Driver name" /></label>
                  <label>Phone<input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Contact number" /></label>
                  <div className="driver-account-edit__actions">
                    <ActionButton tone="secondary" onClick={() => router.push('/driver/change-password')}>Security</ActionButton>
                    <ActionButton tone="primary" onClick={() => void handleSave()} disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</ActionButton>
                  </div>
                </div>
              </>
            )}
          </section>

          <section className="driver-account-column">
            <div className="driver-account-column__head">Operational Readiness</div>
            <div className="driver-account-column__body">
              <button type="button" className="driver-account-link" onClick={() => router.push('/driver/availability')}>
                <span><strong>Availability & matching</strong><small>Current state: {availabilityLabel}</small></span><span aria-hidden="true">→</span>
              </button>
              <button type="button" className="driver-account-link" onClick={() => router.push('/driver/vehicles')}>
                <span><strong>Vehicle readiness</strong><small>Capacity and equipment profile</small></span><span aria-hidden="true">→</span>
              </button>
              <button type="button" className="driver-account-link" onClick={() => router.push('/driver/documents')}>
                <span><strong>Documents & compliance</strong><small>Maintain ready-to-work evidence</small></span><span aria-hidden="true">→</span>
              </button>
              <button type="button" className="driver-account-link" onClick={() => router.push('/driver/finance')}>
                <span><strong>Finance</strong><small>Invoices, earnings and payment records</small></span><span aria-hidden="true">→</span>
              </button>
            </div>
          </section>
        </div>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
