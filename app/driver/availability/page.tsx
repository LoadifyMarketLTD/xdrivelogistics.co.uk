'use client';

import { useCallback, useEffect, useState } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { getMissingColumnFromError } from '../../../lib/supabaseSchemaCompat';
import { VEHICLE_TYPE_LABELS } from '../../../lib/vehicleTypes';
import { ActionButton, AlertBanner, StatusBadge } from '../../components/workspace/WorkspaceUI';

type AvailabilityStatus = 'available' | 'busy' | 'offline';
type SlotName = 'AM' | 'PM' | 'EVENING';
type SlotKey = `${number}_${SlotName}`;

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
  future_position: string | null;
  future_position_date: string | null;
  destination_priority_enabled: boolean;
  destination_radius_miles: number;
  international_work_approved: boolean;
  driver_type: string;
  can_commercial_bid: boolean;
};

type WeeklySlotRow = { day_of_week: number; slot: string; available: boolean };
type WeeklyScheduleResult = {
  rows: WeeklySlotRow[];
  error: string | null;
  unavailable: boolean;
};

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SLOTS: SlotName[] = ['AM', 'PM', 'EVENING'];
const AVAILABILITY_OPTIONS: Array<{ value: AvailabilityStatus; label: string; description: string }> = [
  { value: 'available', label: 'Available', description: 'Ready to accept work' },
  { value: 'busy', label: 'On a job', description: 'Executing assigned work' },
  { value: 'offline', label: 'Offline', description: 'Not accepting work' },
];

function fmtDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function humanize(value: string | null | undefined) {
  if (!value) return '—';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function AvailabilityPage() {
  const { user } = useAuth();
  const driverId = typeof user?.driverId === 'string' ? user.driverId.trim() : '';

  const [driverRow, setDriverRow] = useState<DriverRow | null>(null);
  const [vehicle, setVehicle] = useState<VehicleRow | null>(null);
  const [availability, setAvailability] = useState<AvailabilityStatus>('offline');
  const [destinationPriority, setDestinationPriority] = useState(true);
  const [destinationRadiusMiles, setDestinationRadiusMiles] = useState('10');
  const [weeklySlots, setWeeklySlots] = useState<Record<SlotKey, boolean>>({} as Record<SlotKey, boolean>);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [scheduleUnavailable, setScheduleUnavailable] = useState(false);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const [matchingSaving, setMatchingSaving] = useState(false);
  const [calendarSaving, setCalendarSaving] = useState<SlotKey | null>(null);

  const setTimedSuccess = (message: string) => {
    setSuccessMsg(message);
    window.setTimeout(() => setSuccessMsg(''), 3000);
  };

  const getAuthHeader = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    return token ? `Bearer ${token}` : null;
  }, []);

  const loadWeeklySchedule = useCallback(async (): Promise<WeeklyScheduleResult> => {
    const auth = await getAuthHeader();
    if (!auth) {
      return { rows: [], error: 'Your session has expired. Sign in again to manage your weekly schedule.', unavailable: false };
    }

    try {
      const response = await fetch('/api/driver/availability-slots', { headers: { Authorization: auth } });
      const payload = (await response.json().catch(() => ({}))) as { slots?: WeeklySlotRow[]; error?: string; code?: string };
      if (!response.ok) {
        if (payload.code === 'SCHEDULE_NOT_AVAILABLE') return { rows: [], error: null, unavailable: true };
        return { rows: [], error: payload.error || 'Weekly schedule could not be loaded.', unavailable: false };
      }
      return { rows: payload.slots ?? [], error: null, unavailable: false };
    } catch {
      return { rows: [], error: 'Weekly schedule could not be loaded.', unavailable: false };
    }
  }, [getAuthHeader]);

  const loadAllData = useCallback(async () => {
    if (!driverId || !isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    const [driverRes, vehicleRes, slotsRes] = await Promise.all([
      supabase
        .from('drivers')
        .select('id, display_name, phone, availability_status, status, future_position, future_position_date, destination_priority_enabled, destination_radius_miles, international_work_approved, driver_type, can_commercial_bid')
        .eq('id', driverId)
        .maybeSingle(),
      supabase
        .from('vehicles')
        .select('type, reg_plate, payload_kg, has_tail_lift')
        .eq('assigned_driver_id', driverId)
        .maybeSingle(),
      loadWeeklySchedule(),
    ]);

    const issues: string[] = [];
    if (driverRes.error) {
      issues.push('Driver availability profile could not be loaded.');
      setDriverRow(null);
    } else {
      const row = (driverRes.data as DriverRow | null) ?? null;
      setDriverRow(row);
      if (row) {
        if (row.availability_status === 'available' || row.availability_status === 'busy' || row.availability_status === 'offline') {
          setAvailability(row.availability_status);
        } else {
          setAvailability('offline');
        }
        setDestinationPriority(row.destination_priority_enabled !== false);
        setDestinationRadiusMiles(String(row.destination_radius_miles ?? 10));
      }
    }

    if (vehicleRes.error) issues.push('Assigned vehicle data could not be loaded.');
    setVehicle((vehicleRes.data as VehicleRow | null) ?? null);

    setScheduleUnavailable(slotsRes.unavailable);
    if (slotsRes.error) issues.push(slotsRes.error);
    if (slotsRes.unavailable) {
      setWeeklySlots({} as Record<SlotKey, boolean>);
    } else {
      const nextSlots: Record<SlotKey, boolean> = {} as Record<SlotKey, boolean>;
      for (const row of slotsRes.rows) {
        if (row.slot === 'AM' || row.slot === 'PM' || row.slot === 'EVENING') {
          nextSlots[`${row.day_of_week}_${row.slot}` as SlotKey] = row.available;
        }
      }
      setWeeklySlots(nextSlots);
    }

    setError(issues.join(' '));
    setLoading(false);
  }, [driverId, loadWeeklySchedule]);

  useEffect(() => { void loadAllData(); }, [loadAllData]);

  const handleAvailabilityChange = async (next: AvailabilityStatus) => {
    if (!driverId || !isSupabaseConfigured || availabilitySaving) return;
    const previous = availability;
    setAvailability(next);
    setAvailabilitySaving(true);
    setError('');

    const updateRes = await supabase.from('drivers').update({ availability_status: next }).eq('id', driverId);
    if (updateRes.error) {
      setAvailability(previous);
      setError(getMissingColumnFromError(updateRes.error, 'drivers') === 'availability_status'
        ? 'Live availability is not enabled in this database build.'
        : 'Availability could not be updated.');
    } else {
      setTimedSuccess(`Availability updated to ${AVAILABILITY_OPTIONS.find((option) => option.value === next)?.label ?? next}.`);
    }
    setAvailabilitySaving(false);
  };

  const saveMatchingProfile = async () => {
    if (!driverId || !isSupabaseConfigured || matchingSaving) return;
    const parsedRadius = Number.parseInt(destinationRadiusMiles, 10);
    if (!Number.isFinite(parsedRadius) || parsedRadius < 1 || parsedRadius > 500) {
      setError('Destination radius must be between 1 and 500 miles.');
      return;
    }

    setMatchingSaving(true);
    setError('');
    const { error: saveError } = await supabase
      .from('drivers')
      .update({ destination_priority_enabled: destinationPriority, destination_radius_miles: parsedRadius })
      .eq('id', driverId);

    if (saveError) setError('Matching profile could not be saved.');
    else {
      setTimedSuccess('Matching profile updated.');
      setDriverRow((current) => current ? { ...current, destination_priority_enabled: destinationPriority, destination_radius_miles: parsedRadius } : current);
    }
    setMatchingSaving(false);
  };

  const toggleSlot = async (day: number, slot: SlotName) => {
    if (!driverId || !isSupabaseConfigured || scheduleUnavailable) return;
    const key: SlotKey = `${day}_${slot}`;
    const current = weeklySlots[key] ?? true;
    const next = !current;

    setCalendarSaving(key);
    setError('');
    setWeeklySlots((previous) => ({ ...previous, [key]: next }));

    const auth = await getAuthHeader();
    if (!auth) {
      setWeeklySlots((previous) => ({ ...previous, [key]: current }));
      setError('Your session has expired. Sign in again to update your weekly schedule.');
      setCalendarSaving(null);
      return;
    }

    try {
      const response = await fetch('/api/driver/availability-slots', {
        method: 'PATCH',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ day_of_week: day, slot, available: next }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; code?: string };
      if (!response.ok) {
        setWeeklySlots((previous) => ({ ...previous, [key]: current }));
        if (payload.code === 'SCHEDULE_NOT_AVAILABLE') setScheduleUnavailable(true);
        else setError(payload.error || `The ${DAYS[day]} ${slot} slot could not be updated.`);
      } else {
        setTimedSuccess(`Updated ${DAYS[day]} ${slot}.`);
      }
    } catch {
      setWeeklySlots((previous) => ({ ...previous, [key]: current }));
      setError(`The ${DAYS[day]} ${slot} slot could not be updated.`);
    }
    setCalendarSaving(null);
  };

  const availabilityLabel = AVAILABILITY_OPTIONS.find((option) => option.value === availability)?.label ?? availability;
  const hasSavedSchedule = Object.keys(weeklySlots).length > 0;
  const vehicleLabel = vehicle ? (VEHICLE_TYPE_LABELS[vehicle.type ?? ''] ?? humanize(vehicle.type)) : 'Not assigned';

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell
        subtitle="Keep live status, destination matching, vehicle readiness and weekly availability current."
        availabilityLabel={availabilityLabel}
        driverName={driverRow?.display_name ?? user?.email ?? 'Driver'}
        headerActions={<ActionButton tone="primary" onClick={() => void loadAllData()} disabled={loading}>Refresh</ActionButton>}
      >
        {successMsg && <AlertBanner tone="success">{successMsg}</AlertBanner>}
        {error && <AlertBanner tone="danger">{error}</AlertBanner>}
        {scheduleUnavailable && <AlertBanner tone="warning">Weekly schedule storage is unavailable. Live status, destination matching and vehicle readiness still work.</AlertBanner>}

        <div className="driver-availability-board">
          <aside className="driver-availability-rail" aria-label="Live availability controls">
            <div className="driver-availability-section">
              <div className="driver-availability-section__head">
                <strong>Live status</strong>
                <StatusBadge value={availabilityLabel} tone={availability === 'available' ? 'green' : availability === 'busy' ? 'orange' : 'neutral'} />
              </div>
              <div className="driver-availability-status-list">
                {AVAILABILITY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className="driver-availability-status"
                    data-active={availability === option.value ? 'true' : 'false'}
                    onClick={() => void handleAvailabilityChange(option.value)}
                    disabled={loading || availabilitySaving}
                  >
                    <strong>{option.label}</strong>
                    <span>{option.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="driver-availability-section">
              <div className="driver-availability-section__head"><strong>Assigned vehicle</strong></div>
              <dl className="driver-availability-facts">
                <div><dt>Vehicle</dt><dd>{vehicleLabel}</dd></div>
                <div><dt>Registration</dt><dd>{vehicle?.reg_plate ?? '—'}</dd></div>
                <div><dt>Payload</dt><dd>{vehicle?.payload_kg ? `${vehicle.payload_kg} kg` : '—'}</dd></div>
                <div><dt>Tail lift</dt><dd>{vehicle ? (vehicle.has_tail_lift ? 'Yes' : 'No') : '—'}</dd></div>
              </dl>
            </div>

            <div className="driver-availability-section">
              <div className="driver-availability-section__head"><strong>Position</strong></div>
              <dl className="driver-availability-facts">
                <div><dt>Future position</dt><dd>{driverRow?.future_position ?? 'Not advertised'}</dd></div>
                <div><dt>From</dt><dd>{fmtDate(driverRow?.future_position_date ?? null)}</dd></div>
              </dl>
              <ActionButton tone="secondary" onClick={() => { window.location.href = '/driver/returns'; }}>Manage return journey</ActionButton>
            </div>
          </aside>

          <main className="driver-availability-main">
            <section className="driver-availability-panel">
              <div className="driver-availability-panel__head">
                <div><strong>Destination matching</strong><span>Control how far XDrive should surface suitable work.</span></div>
                <ActionButton tone="primary" onClick={() => void saveMatchingProfile()} disabled={loading || matchingSaving}>{matchingSaving ? 'Saving…' : 'Save'}</ActionButton>
              </div>
              <div className="driver-availability-matching-row">
                <label className="driver-availability-toggle">
                  <input type="checkbox" checked={destinationPriority} onChange={(event) => setDestinationPriority(event.target.checked)} />
                  <span><strong>Destination priority</strong><small>{destinationPriority ? 'Enabled' : 'Disabled'}</small></span>
                </label>
                <label className="driver-availability-field">
                  <span>Radius</span>
                  <span className="driver-availability-input-suffix">
                    <input type="number" min="1" max="500" value={destinationRadiusMiles} onChange={(event) => setDestinationRadiusMiles(event.target.value)} disabled={!destinationPriority} />
                    <em>miles</em>
                  </span>
                </label>
              </div>
              <div className="driver-availability-readiness-strip">
                <div><span>Driver type</span><strong>{humanize(driverRow?.driver_type)}</strong></div>
                <div><span>Commercial bidding</span><StatusBadge value={driverRow?.can_commercial_bid ? 'Enabled' : 'Restricted'} tone={driverRow?.can_commercial_bid ? 'green' : 'orange'} /></div>
                <div><span>International work</span><StatusBadge value={driverRow?.international_work_approved ? 'Approved' : 'UK only'} tone={driverRow?.international_work_approved ? 'green' : 'neutral'} /></div>
                <div><span>Driver record</span><StatusBadge value={humanize(driverRow?.status)} tone={String(driverRow?.status ?? '').toLowerCase() === 'active' ? 'green' : 'neutral'} /></div>
              </div>
            </section>

            <section className="driver-availability-panel">
              <div className="driver-availability-panel__head">
                <div><strong>Weekly schedule</strong><span>Toggle AM, PM and evening availability for marketplace matching.</span></div>
                {!scheduleUnavailable && <StatusBadge value={hasSavedSchedule ? 'Saved pattern' : 'Default available'} tone={hasSavedSchedule ? 'blue' : 'neutral'} />}
              </div>

              {scheduleUnavailable ? (
                <div className="driver-availability-empty">Schedule editing is unavailable in this database build.</div>
              ) : loading ? (
                <div className="driver-availability-empty">Loading weekly schedule…</div>
              ) : (
                <div className="driver-availability-schedule" role="grid" aria-label="Weekly availability">
                  {DAYS.map((day, dayIndex) => (
                    <div key={day} className="driver-availability-day" role="row">
                      <strong>{day}</strong>
                      {SLOTS.map((slot) => {
                        const key: SlotKey = `${dayIndex}_${slot}`;
                        const isAvailable = weeklySlots[key] !== false;
                        const isSaving = calendarSaving === key;
                        return (
                          <button
                            key={slot}
                            type="button"
                            data-available={isAvailable ? 'true' : 'false'}
                            disabled={isSaving}
                            onClick={() => void toggleSlot(dayIndex, slot)}
                            title={isAvailable ? 'Available — click to mark unavailable' : 'Unavailable — click to mark available'}
                          >
                            <span>{slot}</span><strong>{isSaving ? '…' : isAvailable ? 'Available' : 'Off'}</strong>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </main>
        </div>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
