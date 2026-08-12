'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { getMissingColumnFromError } from '../../../lib/supabaseSchemaCompat';
import { DRIVER_PERSONA_LABELS, mapDriverPersona, type DriverPersona } from '../../../lib/authRole';
import { VEHICLE_TYPE_LABELS } from '../../../lib/vehicleTypes';
import { ActionButton, Panel, StatusBadge } from '../../components/workspace/WorkspaceUI';

type AvailabilityStatus = 'available' | 'busy' | 'offline';

type VehicleRow = {
  type: string | null;
  reg_plate: string | null;
  payload_kg?: number | null;
  has_tail_lift?: boolean | null;
};

type DriverRow = {
  id: string;
  display_name: string | null;
  phone: string | null;
  availability_status: string | null;
  status: string | null;
  persona?: string | null;
  home_postcode?: string | null;
  max_radius_km?: number | null;
};

type SlotName = 'AM' | 'PM' | 'EVENING';
type SlotKey = `${number}_${SlotName}`;

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SLOTS: SlotName[] = ['AM', 'PM', 'EVENING'];

const AVAILABILITY_OPTIONS: Array<{
  value: AvailabilityStatus;
  label: string;
  description: string;
}> = [
  { value: 'available', label: 'Available', description: 'Ready to accept new work' },
  { value: 'busy', label: 'On a job', description: 'Currently executing work' },
  { value: 'offline', label: 'Offline', description: 'Not available for new work' },
];

const inputStyle = {
  width: '100%',
  height: '32px',
  padding: '0 8px',
  border: '1px solid #d8dee8',
  borderRadius: '4px',
  background: '#fff',
  color: '#1a1f2b',
  fontSize: '12px',
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

function schedulePermissionDenied(message: string | null | undefined) {
  const normalised = String(message ?? '').toLowerCase();
  return normalised.includes('driver_availability_slots') && (
    normalised.includes('permission denied') ||
    normalised.includes('row-level security') ||
    normalised.includes('rls')
  );
}

export default function AvailabilityPage() {
  const { user } = useAuth();
  const driverId = user?.driverId ?? null;

  const [driverRow, setDriverRow] = useState<DriverRow | null>(null);
  const [vehicle, setVehicle] = useState<VehicleRow | null>(null);
  const [availability, setAvailability] = useState<AvailabilityStatus>('available');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [scheduleUnavailable, setScheduleUnavailable] = useState(false);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [persona, setPersona] = useState<DriverPersona | ''>('');
  const [homePostcode, setHomePostcode] = useState('');
  const [maxRadiusKm, setMaxRadiusKm] = useState('');
  const [weeklySlots, setWeeklySlots] = useState<Record<SlotKey, boolean>>({} as Record<SlotKey, boolean>);
  const [calendarSaving, setCalendarSaving] = useState<SlotKey | null>(null);

  const setTimedSuccess = (message: string) => {
    setSuccessMsg(message);
    window.setTimeout(() => setSuccessMsg(''), 3000);
  };

  const loadDriver = useCallback(async () => {
    const primary = await supabase
      .from('drivers')
      .select('id, display_name, phone, availability_status, status, persona, home_postcode, max_radius_km')
      .eq('id', driverId)
      .maybeSingle();

    if (primary.error && getMissingColumnFromError(primary.error, 'drivers') !== null) {
      const fallback = await supabase
        .from('drivers')
        .select('id, display_name, phone, availability_status, status')
        .eq('id', driverId)
        .maybeSingle();
      return {
        row: (fallback.data as DriverRow | null) ?? null,
        error: fallback.error ? 'Driver profile could not be loaded.' : null,
      };
    }

    return {
      row: (primary.data as DriverRow | null) ?? null,
      error: primary.error ? 'Driver profile could not be loaded.' : null,
    };
  }, [driverId]);

  const loadAllData = useCallback(async () => {
    if (!driverId || !isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    const [driverRes, vehicleRes, slotsRes] = await Promise.all([
      loadDriver(),
      supabase
        .from('vehicles')
        .select('type, reg_plate, payload_kg, has_tail_lift')
        .eq('assigned_driver_id', driverId)
        .maybeSingle(),
      supabase
        .from('driver_availability_slots')
        .select('day_of_week, slot, available')
        .eq('driver_id', driverId),
    ]);

    if (driverRes.row) {
      setDriverRow(driverRes.row);
      setPersona(driverRes.row.persona ? (mapDriverPersona(driverRes.row.persona) ?? '') : '');
      setHomePostcode(driverRes.row.home_postcode ?? '');
      setMaxRadiusKm(driverRes.row.max_radius_km != null ? String(driverRes.row.max_radius_km) : '');
      const nextAvailability = driverRes.row.availability_status ?? driverRes.row.status ?? '';
      if (nextAvailability === 'available' || nextAvailability === 'busy' || nextAvailability === 'offline') {
        setAvailability(nextAvailability);
      }
    }

    setVehicle((vehicleRes.data as VehicleRow | null) ?? null);

    if (slotsRes.error) {
      setWeeklySlots({} as Record<SlotKey, boolean>);
      setScheduleUnavailable(schedulePermissionDenied(slotsRes.error.message));
    } else {
      setScheduleUnavailable(false);
      const nextSlots: Record<SlotKey, boolean> = {} as Record<SlotKey, boolean>;
      for (const row of (slotsRes.data ?? []) as Array<{ day_of_week: number; slot: string; available: boolean }>) {
        if (row.slot === 'AM' || row.slot === 'PM' || row.slot === 'EVENING') {
          nextSlots[`${row.day_of_week}_${row.slot}` as SlotKey] = row.available;
        }
      }
      setWeeklySlots(nextSlots);
    }

    const issues: string[] = [];
    if (driverRes.error) issues.push(driverRes.error);
    if (vehicleRes.error) issues.push('Assigned vehicle data could not be loaded.');
    if (slotsRes.error && !schedulePermissionDenied(slotsRes.error.message)) {
      issues.push('Weekly schedule could not be loaded.');
    }
    setError(issues.join(' '));
    setLoading(false);
  }, [driverId, loadDriver]);

  useEffect(() => {
    void loadAllData();
  }, [loadAllData]);

  const handleAvailabilityChange = async (next: AvailabilityStatus) => {
    if (!driverId || !isSupabaseConfigured || availabilitySaving) return;

    const previous = availability;
    setAvailability(next);
    setAvailabilitySaving(true);
    setError('');

    const updateRes = await supabase.from('drivers').update({ availability_status: next }).eq('id', driverId);
    if (updateRes.error && getMissingColumnFromError(updateRes.error, 'drivers') === 'availability_status') {
      const fallbackRes = await supabase.from('drivers').update({ status: next }).eq('id', driverId);
      if (fallbackRes.error) {
        setAvailability(previous);
        setError('Availability could not be updated.');
      } else {
        setTimedSuccess(`Availability updated to ${next}.`);
      }
    } else if (updateRes.error) {
      setAvailability(previous);
      setError('Availability could not be updated.');
    } else {
      setTimedSuccess(`Availability updated to ${next}.`);
    }

    setAvailabilitySaving(false);
  };

  const handleSaveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!driverId || !isSupabaseConfigured) return;

    setProfileSaving(true);
    setError('');

    const update: Record<string, unknown> = {
      home_postcode: homePostcode.trim() || null,
      max_radius_km: maxRadiusKm ? parseInt(maxRadiusKm, 10) : null,
    };
    if (persona) update.persona = persona;

    const { error: saveError } = await supabase.from('drivers').update(update).eq('id', driverId);
    if (saveError) {
      setError(getMissingColumnFromError(saveError, 'drivers')
        ? 'Some availability profile fields are not enabled in this database build yet.'
        : 'Availability profile could not be saved.');
    } else {
      setTimedSuccess('Availability profile updated.');
      await loadAllData();
    }
    setProfileSaving(false);
  };

  const toggleSlot = async (day: number, slot: SlotName) => {
    if (!driverId || !isSupabaseConfigured || scheduleUnavailable) return;

    const key: SlotKey = `${day}_${slot}`;
    const current = weeklySlots[key] ?? true;
    const next = !current;

    setCalendarSaving(key);
    setError('');
    setWeeklySlots((previous) => ({ ...previous, [key]: next }));

    const { error: upsertError } = await supabase
      .from('driver_availability_slots')
      .upsert(
        { driver_id: driverId, day_of_week: day, slot, available: next, updated_at: new Date().toISOString() },
        { onConflict: 'driver_id,day_of_week,slot' }
      );

    if (upsertError) {
      setWeeklySlots((previous) => ({ ...previous, [key]: current }));
      if (schedulePermissionDenied(upsertError.message)) {
        setScheduleUnavailable(true);
      } else {
        setError(`The ${DAYS[day]} ${slot} slot could not be updated.`);
      }
    } else {
      setTimedSuccess(`Updated ${DAYS[day]} ${slot}.`);
    }
    setCalendarSaving(null);
  };

  const personaLabel = persona ? DRIVER_PERSONA_LABELS[persona] : undefined;
  const hasSavedSchedule = Object.keys(weeklySlots).length > 0;

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell
        subtitle="Set live availability, marketplace radius, assigned vehicle readiness and your weekly working pattern."
        availabilityLabel={AVAILABILITY_OPTIONS.find((option) => option.value === availability)?.label ?? availability}
        driverName={driverRow?.display_name ?? user?.email ?? 'Driver'}
        personaLabel={personaLabel}
        headerActions={<ActionButton tone="primary" onClick={() => void loadAllData()} disabled={loading}>Refresh</ActionButton>}
      >
        {successMsg && (
          <div style={{ minHeight: '32px', display: 'flex', alignItems: 'center', padding: '6px 10px', border: '1px solid #bbf7d0', borderRadius: '4px', background: '#ecfdf3', color: '#166534', fontSize: '12px', fontWeight: 700 }}>
            {successMsg}
          </div>
        )}
        {error && (
          <div role="alert" style={{ minHeight: '32px', display: 'flex', alignItems: 'center', padding: '6px 10px', border: '1px solid #fecaca', borderRadius: '4px', background: '#fef2f2', color: '#b91c1c', fontSize: '12px', fontWeight: 700 }}>
            {error}
          </div>
        )}
        {scheduleUnavailable && (
          <div style={{ minHeight: '32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '6px 10px', border: '1px solid #fde68a', borderRadius: '4px', background: '#fffbeb', color: '#92400e', fontSize: '11px' }}>
            <span><strong>Weekly schedule unavailable.</strong> Live availability, radius and vehicle information still work. The raw database permission error is no longer exposed to drivers.</span>
            <StatusBadge value="Schedule restricted" tone="orange" />
          </div>
        )}

        <Panel title="Current availability" description="This status is the primary signal used by dispatch and marketplace matching.">
          {loading ? (
            <div style={{ color: '#64748b', fontSize: '12px' }}>Loading current status…</div>
          ) : (
            <div className="driver-status-choice-grid">
              {AVAILABILITY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className="driver-status-choice"
                  data-active={availability === option.value}
                  onClick={() => void handleAvailabilityChange(option.value)}
                  disabled={availabilitySaving}
                >
                  <strong>{option.label}</strong>
                  <span>{option.description}</span>
                </button>
              ))}
            </div>
          )}
        </Panel>

        <div className="driver-ops-grid-2">
          <Panel title="Availability profile" description="Home area and working radius used to surface relevant work.">
            {loading ? (
              <div style={{ color: '#64748b', fontSize: '12px' }}>Loading profile…</div>
            ) : (
              <form onSubmit={(event) => void handleSaveProfile(event)} style={{ display: 'grid', gap: '8px' }}>
                <div>
                  <label style={labelStyle}>Driver persona</label>
                  <select value={persona} onChange={(event) => setPersona(event.target.value as DriverPersona | '')} style={inputStyle}>
                    <option value="">Select persona…</option>
                    {(Object.entries(DRIVER_PERSONA_LABELS) as Array<[DriverPersona, string]>).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="driver-ops-grid-2" style={{ gap: '8px' }}>
                  <div>
                    <label style={labelStyle}>Home postcode</label>
                    <input style={inputStyle} value={homePostcode} onChange={(event) => setHomePostcode(event.target.value)} placeholder="e.g. BB1 9QL" />
                  </div>
                  <div>
                    <label style={labelStyle}>Maximum radius (km)</label>
                    <input style={inputStyle} type="number" min="0" max="1000" value={maxRadiusKm} onChange={(event) => setMaxRadiusKm(event.target.value)} placeholder="e.g. 100" />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <ActionButton type="submit" tone="primary" disabled={profileSaving}>{profileSaving ? 'Saving…' : 'Save profile'}</ActionButton>
                </div>
              </form>
            )}
          </Panel>

          <Panel title="Assigned vehicle" description="The vehicle currently linked to your live driver readiness.">
            {loading ? (
              <div style={{ color: '#64748b', fontSize: '12px' }}>Loading assigned vehicle…</div>
            ) : vehicle ? (
              <div className="driver-detail-grid">
                <div className="driver-detail-item"><span>Registration</span><strong>{vehicle.reg_plate ?? 'Not set'}</strong></div>
                <div className="driver-detail-item"><span>Vehicle</span><strong>{VEHICLE_TYPE_LABELS[vehicle.type ?? ''] ?? vehicle.type?.replace(/_/g, ' ') ?? 'Not set'}</strong></div>
                <div className="driver-detail-item"><span>Payload</span><strong>{vehicle.payload_kg ? `${vehicle.payload_kg} kg` : 'Not set'}</strong></div>
                <div className="driver-detail-item"><span>Tail lift</span><strong>{vehicle.has_tail_lift ? 'Yes' : 'No'}</strong></div>
              </div>
            ) : (
              <div style={{ padding: '8px 0', color: '#64748b', fontSize: '12px' }}>No vehicle is currently assigned. Availability can still be managed.</div>
            )}
          </Panel>
        </div>

        <Panel title="Weekly schedule" description="Toggle AM, PM and evening availability without horizontal scrolling.">
          {scheduleUnavailable ? (
            <div style={{ padding: '8px 0', color: '#64748b', fontSize: '12px' }}>
              Schedule editing is temporarily disabled until database access for driver availability slots is restored.
            </div>
          ) : loading ? (
            <div style={{ color: '#64748b', fontSize: '12px' }}>Loading weekly schedule…</div>
          ) : (
            <>
              {!hasSavedSchedule && (
                <div style={{ marginBottom: '8px', color: '#64748b', fontSize: '11px' }}>
                  No saved pattern yet. Unconfigured slots currently default to available.
                </div>
              )}
              <div className="driver-schedule-grid">
                {DAYS.map((day, dayIndex) => (
                  <div key={day} className="driver-schedule-day">
                    <strong>{day}</strong>
                    <div className="driver-schedule-slots">
                      {SLOTS.map((slot) => {
                        const key: SlotKey = `${dayIndex}_${slot}`;
                        const isAvailable = weeklySlots[key] !== false;
                        const isSaving = calendarSaving === key;
                        return (
                          <button
                            key={slot}
                            type="button"
                            data-available={isAvailable}
                            disabled={isSaving}
                            onClick={() => void toggleSlot(dayIndex, slot)}
                            title={isAvailable ? 'Available — click to mark unavailable' : 'Unavailable — click to mark available'}
                          >
                            {slot} {isSaving ? '…' : isAvailable ? '✓' : '–'}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Panel>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
