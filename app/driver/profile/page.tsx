'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { getMissingColumnFromError } from '../../../lib/supabaseSchemaCompat';

type DriverProfileRow = {
  id: string;
  company_id: string;
  display_name: string | null;
  phone: string | null;
  email: string | null;
  availability_status: 'available' | 'busy' | 'offline' | null;
  status: string | null;
};

const card: CSSProperties = {
  backgroundColor: '#ffffff',
  border: '1px solid #d7e0ea',
  borderRadius: '10px',
  padding: '1rem',
  boxShadow: '0 2px 8px rgba(15,23,42,0.06)',
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '0.7rem 0.75rem',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  fontSize: '0.92rem',
};

const availabilityLabels: Record<'available' | 'busy' | 'offline', string> = {
  available: 'Available',
  busy: 'On a job',
  offline: 'Offline',
};

function getWorkspaceModeLabel(user: ReturnType<typeof useAuth>['user']) {
  if (!user) return 'Driver workspace';
  if (user.ownerDriverExecutionMode) return 'Owner account using driver execution mode';
  if (user.ownerDriverWorkspace) return 'Owner-driver workspace';
  if (user.canAccessDriverMode) return 'Driver mode enabled';
  return 'Driver workspace';
}

export default function DriverProfilePage() {
  const { user } = useAuth();
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
        setError(`Unable to load your driver profile: ${fallback.error.message}`);
        setLoading(false);
        return;
      }
      row = (fallback.data as DriverProfileRow | null) ?? null;
    } else if (primary.error) {
      setError(`Unable to load your driver profile: ${primary.error.message}`);
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
      setError(`Unable to save your profile: ${updateError.message}`);
    } else {
      setSuccess('Profile details updated.');
      await loadProfile();
    }
    setSaving(false);
  };

  const workspaceMode = getWorkspaceModeLabel(user);
  const contactEmail = driver?.email ?? user?.email ?? 'Not available';

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell
        subtitle="Review your account summary, driver identity, workspace mode, availability, and contact details."
        driverName={driver?.display_name ?? user?.email ?? 'Driver'}
        availabilityLabel={availabilityLabel}
      >
        <div style={{ display: 'grid', gap: '1rem' }}>
          {error && (
            <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '8px', padding: '0.75rem', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', borderRadius: '8px', padding: '0.75rem', fontSize: '0.85rem', fontWeight: 600 }}>
              {success}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div style={card}>
              <div style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.45rem' }}>Account summary</div>
              {[
                { label: 'Workspace mode', value: workspaceMode },
                { label: 'Role', value: 'Driver' },
                { label: 'Company context', value: driver?.company_id ?? user?.companyId ?? 'Not linked' },
                { label: 'Driver record', value: driver?.id ?? user?.driverId ?? 'Not linked' },
              ].map((item) => (
                <div key={item.label} style={{ padding: '0.65rem 0', borderTop: '1px solid #eef2f7' }}>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.15rem' }}>{item.label}</div>
                  <div style={{ fontSize: '0.88rem', color: '#0f172a', fontWeight: 600, wordBreak: 'break-word' }}>{item.value}</div>
                </div>
              ))}
            </div>

            <div style={card}>
              <div style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.45rem' }}>Availability</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem' }}>{availabilityLabel}</div>
              <div style={{ fontSize: '0.84rem', color: '#475569', lineHeight: 1.5 }}>
                Manage working slots, driver persona, and radius preferences from the availability page.
              </div>
              <button
                onClick={() => window.location.assign('/driver/availability')}
                style={{ marginTop: '0.8rem', padding: '0.6rem 0.9rem', borderRadius: '8px', border: '1px solid #d7e0ea', backgroundColor: '#f8fafc', color: '#0f172a', fontWeight: 600, cursor: 'pointer' }}
              >
                Open availability
              </button>
            </div>
          </div>

          <div style={{ ...card, maxWidth: '680px' }}>
            <div style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.8rem' }}>Driver identity &amp; contact</div>
            {loading ? (
              <div style={{ color: '#64748b', fontSize: '0.9rem' }}>Loading profile…</div>
            ) : (
              <div style={{ display: 'grid', gap: '0.9rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>Display name</label>
                  <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} style={inputStyle} placeholder="Driver name" />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>Phone</label>
                  <input value={phone} onChange={(event) => setPhone(event.target.value)} style={inputStyle} placeholder="Contact number" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                  <div style={{ backgroundColor: '#f8fafc', borderRadius: '8px', padding: '0.8rem' }}>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.15rem' }}>Email</div>
                    <div style={{ fontWeight: 600, color: '#0f172a', wordBreak: 'break-word' }}>{contactEmail}</div>
                  </div>
                  <div style={{ backgroundColor: '#f8fafc', borderRadius: '8px', padding: '0.8rem' }}>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.15rem' }}>Driver account status</div>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{driver?.status ?? 'Unknown'}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => void handleSave()}
                    disabled={saving}
                    style={{ padding: '0.7rem 1rem', borderRadius: '8px', border: 'none', backgroundColor: '#1d4ed8', color: '#fff', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
                  >
                    {saving ? 'Saving…' : 'Save profile'}
                  </button>
                  <button
                    onClick={() => window.location.assign('/driver/change-password')}
                    style={{ padding: '0.7rem 1rem', borderRadius: '8px', border: '1px solid #d7e0ea', backgroundColor: '#f8fafc', color: '#0f172a', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Password &amp; security
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
