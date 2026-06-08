'use client';

import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { getMissingColumnFromError } from '../../../lib/supabaseSchemaCompat';
import { DRIVER_PERSONA_LABELS, mapDriverPersona, type DriverPersona } from '../../../lib/authRole';

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

type SlotKey = `${number}_${'AM' | 'PM' | 'EVENING'}`;

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SLOTS: Array<'AM' | 'PM' | 'EVENING'> = ['AM', 'PM', 'EVENING'];

const AVAILABILITY_OPTIONS: Array<{ value: AvailabilityStatus; label: string; description: string; color: string; bg: string }> = [
  { value: 'available', label: 'Available', description: 'Ready to accept new jobs.', color: '#15803d', bg: '#f0fdf4' },
  { value: 'busy', label: 'On a Job', description: 'Currently on an active delivery.', color: '#b45309', bg: '#fffbeb' },
  { value: 'offline', label: 'Offline', description: 'Not available for new work.', color: '#dc2626', bg: '#fef2f2' },
];

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  bicycle: 'Bicycle',
  motorbike: 'Motorbike',
  car: 'Car',
  van_small: 'Small Van',
  van_large: 'Large Van',
  luton: 'Luton Van',
  truck_7_5t: '7.5t Truck',
  truck_18t: '18t Truck',
  artic: 'Artic',
};

const card: CSSProperties = {
  backgroundColor: '#ffffff',
  border: '1px solid #d7e0ea',
  borderRadius: '10px',
  padding: '1.1rem',
  boxShadow: '0 2px 8px rgba(15,23,42,0.06)',
};

const inputStyle: CSSProperties = {
  padding: '0.6rem 0.75rem',
  border: '1px solid #cbd5e1',
  borderRadius: '7px',
  fontSize: '0.85rem',
  color: '#0f172a',
  backgroundColor: '#ffffff',
  width: '100%',
};

const labelStyle: CSSProperties = {
  fontSize: '0.78rem',
  fontWeight: 600,
  color: '#374151',
  display: 'block',
  marginBottom: '0.3rem',
};

export default function AvailabilityPage() {
  const { user } = useAuth();
  const driverId = user?.driverId ?? null;

  const [driverRow, setDriverRow] = useState<DriverRow | null>(null);
  const [vehicle, setVehicle] = useState<VehicleRow | null>(null);
  const [availability, setAvailability] = useState<AvailabilityStatus>('available');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [persona, setPersona] = useState<DriverPersona | ''>('');
  const [homePostcode, setHomePostcode] = useState('');
  const [maxRadiusKm, setMaxRadiusKm] = useState('');
  const [weeklySlots, setWeeklySlots] = useState<Record<SlotKey, boolean>>({} as Record<SlotKey, boolean>);
  const [calendarSaving, setCalendarSaving] = useState<SlotKey | null>(null);

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
        error: fallback.error?.message ?? null,
      };
    }

    return {
      row: (primary.data as DriverRow | null) ?? null,
      error: primary.error?.message ?? null,
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
      if (driverRes.row.persona) setPersona(mapDriverPersona(driverRes.row.persona) ?? '');
      if (driverRes.row.home_postcode != null) setHomePostcode(driverRes.row.home_postcode);
      if (driverRes.row.max_radius_km != null) setMaxRadiusKm(String(driverRes.row.max_radius_km));
      const nextAvailability = driverRes.row.availability_status ?? driverRes.row.status ?? '';
      if (nextAvailability === 'available' || nextAvailability === 'busy' || nextAvailability === 'offline') {
        setAvailability(nextAvailability);
      }
    }

    setVehicle((vehicleRes.data as VehicleRow | null) ?? null);

    if (!slotsRes.error && slotsRes.data) {
      const nextSlots: Record<SlotKey, boolean> = {} as Record<SlotKey, boolean>;
      for (const row of slotsRes.data as Array<{ day_of_week: number; slot: string; available: boolean }>) {
        if (row.slot === 'AM' || row.slot === 'PM' || row.slot === 'EVENING') {
          nextSlots[`${row.day_of_week}_${row.slot}` as SlotKey] = row.available;
        }
      }
      setWeeklySlots(nextSlots);
    }

    const issues = [driverRes.error, vehicleRes.error?.message ?? null, slotsRes.error?.message ?? null].filter(Boolean);
    if (issues.length > 0) {
      setError(issues.join(' • '));
    }

    setLoading(false);
  }, [driverId, loadDriver]);

  useEffect(() => {
    void loadAllData();
  }, [loadAllData]);

  const currentOption = AVAILABILITY_OPTIONS.find((option) => option.value === availability) ?? AVAILABILITY_OPTIONS[0];
  const hasSavedSchedule = Object.keys(weeklySlots).length > 0;

  const setTimedSuccess = (message: string) => {
    setSuccessMsg(message);
    window.setTimeout(() => setSuccessMsg(''), 3000);
  };

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
        setError(`Failed to update availability: ${fallbackRes.error.message}`);
      } else {
        setTimedSuccess(`Availability updated to ${next}.`);
      }
    } else if (updateRes.error) {
      setAvailability(previous);
      setError(`Failed to update availability: ${updateRes.error.message}`);
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
      if (getMissingColumnFromError(saveError, 'drivers')) {
        setError('Some profile fields are not available in this database build yet.');
      } else {
        setError(`Failed to save profile details: ${saveError.message}`);
      }
    } else {
      setTimedSuccess('Availability profile updated.');
      await loadAllData();
    }
    setProfileSaving(false);
  };

  const toggleSlot = async (day: number, slot: 'AM' | 'PM' | 'EVENING') => {
    if (!driverId || !isSupabaseConfigured) return;

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
      setError(`Failed to update ${DAYS[day]} ${slot}: ${upsertError.message}`);
    } else {
      setTimedSuccess(`Updated ${DAYS[day]} ${slot}.`);
    }
    setCalendarSaving(null);
  };

  const personaLabel = persona ? DRIVER_PERSONA_LABELS[persona] : undefined;

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell
        subtitle="Manage your availability, driver persona, home location, and assigned vehicle from one place."
        availabilityLabel={currentOption.label}
        driverName={driverRow?.display_name ?? user?.email ?? 'Driver'}
        personaLabel={personaLabel}
        headerActions={
          <button
            onClick={() => void loadAllData()}
            style={{ padding: '0.55rem 0.95rem', backgroundColor: '#f8fafc', color: '#0f172a', border: '1px solid #d7e0ea', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
          >
            Refresh data
          </button>
        }
      >
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.35rem', fontWeight: 700, color: '#0f172a' }}>Driver Availability</h2>

        {successMsg && (
          <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', borderRadius: '8px', padding: '0.7rem', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.75rem' }}>
            {successMsg}
          </div>
        )}
        {error && (
          <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '8px', padding: '0.7rem', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
          <div style={card}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', marginBottom: '0.85rem' }}>Current status</div>
            {loading ? (
              <div style={{ color: '#64748b' }}>Loading status…</div>
            ) : (
              <>
                <div style={{ display: 'grid', gap: '0.55rem', marginBottom: '0.9rem' }}>
                  {AVAILABILITY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => void handleAvailabilityChange(option.value)}
                      disabled={availabilitySaving}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.7rem',
                        padding: '0.75rem',
                        borderRadius: '8px',
                        border: availability === option.value ? `2px solid ${option.color}` : '1px solid #e2e8f0',
                        backgroundColor: availability === option.value ? option.bg : '#f8fafc',
                        cursor: availabilitySaving ? 'not-allowed' : 'pointer',
                        textAlign: 'left',
                        width: '100%',
                        opacity: availabilitySaving && availability !== option.value ? 0.6 : 1,
                      }}
                    >
                      <div
                        style={{
                          width: '14px',
                          height: '14px',
                          borderRadius: '50%',
                          marginTop: '2px',
                          backgroundColor: availability === option.value ? option.color : '#cbd5e1',
                          flexShrink: 0,
                        }}
                      />
                      <div>
                        <div style={{ fontSize: '0.88rem', fontWeight: 700, color: availability === option.value ? option.color : '#374151' }}>{option.label}</div>
                        <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '0.1rem' }}>{option.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: '0.82rem', color: currentOption.color, fontWeight: 600 }}>
                  {availabilitySaving ? 'Saving availability…' : `Current status: ${currentOption.label}`}
                </div>
              </>
            )}
          </div>

          <div style={card}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', marginBottom: '0.85rem' }}>Availability profile</div>
            {loading ? (
              <div style={{ color: '#64748b' }}>Loading profile…</div>
            ) : (
              <form onSubmit={(event) => void handleSaveProfile(event)} style={{ display: 'grid', gap: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>Driver persona</label>
                  <select value={persona} onChange={(e) => setPersona(e.target.value as DriverPersona | '')} style={inputStyle}>
                    <option value="">Select persona…</option>
                    {(Object.entries(DRIVER_PERSONA_LABELS) as [DriverPersona, string][]).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Home postcode</label>
                  <input style={inputStyle} value={homePostcode} onChange={(e) => setHomePostcode(e.target.value)} placeholder="e.g. M1 1AA" />
                </div>
                <div>
                  <label style={labelStyle}>Max radius (km)</label>
                  <input style={inputStyle} type="number" min="0" max="1000" value={maxRadiusKm} onChange={(e) => setMaxRadiusKm(e.target.value)} placeholder="e.g. 100" />
                </div>
                <div style={{ backgroundColor: '#f8fafc', borderRadius: '7px', padding: '0.75rem' }}>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.2rem' }}>Driver name</div>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>{driverRow?.display_name ?? user?.email ?? '—'}</div>
                </div>
                <button
                  type="submit"
                  disabled={profileSaving}
                  style={{ padding: '0.6rem', backgroundColor: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '7px', fontWeight: 700, cursor: profileSaving ? 'not-allowed' : 'pointer', opacity: profileSaving ? 0.7 : 1 }}
                >
                  {profileSaving ? 'Saving…' : 'Save profile'}
                </button>
              </form>
            )}
          </div>

          <div style={card}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', marginBottom: '0.85rem' }}>Assigned vehicle</div>
            {loading ? (
              <div style={{ color: '#64748b' }}>Loading vehicle…</div>
            ) : vehicle ? (
              <div style={{ display: 'grid', gap: '0.6rem' }}>
                {[
                  { label: 'Registration', value: vehicle.reg_plate ?? 'Not set' },
                  { label: 'Vehicle type', value: VEHICLE_TYPE_LABELS[vehicle.type ?? ''] ?? vehicle.type ?? 'Not set' },
                  { label: 'Payload capacity', value: vehicle.payload_kg ? `${vehicle.payload_kg} kg` : 'Not set' },
                  { label: 'Tail lift equipped', value: vehicle.has_tail_lift ? 'Yes' : 'No' },
                ].map((row) => (
                  <div key={row.label} style={{ backgroundColor: '#f8fafc', borderRadius: '7px', padding: '0.7rem' }}>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.15rem' }}>{row.label}</div>
                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.88rem' }}>{row.value}</div>
                  </div>
                ))}
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.2rem' }}>Vehicle assignment is still managed by your company dispatcher.</div>
              </div>
            ) : (
              <div style={{ backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
                <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem' }}>No vehicle assigned</div>
                <div style={{ fontSize: '0.82rem', color: '#64748b' }}>You can still manage your status and weekly schedule while waiting for a dispatcher assignment.</div>
              </div>
            )}
          </div>
        </div>

        <div style={card}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', marginBottom: '0.4rem' }}>Weekly schedule</div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '1rem' }}>
            Tap a slot to toggle availability. Changes apply immediately and stay visible on mobile without horizontal scrolling.
          </div>
          {!hasSavedSchedule && !loading && (
            <div style={{ backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1', padding: '0.85rem', marginBottom: '1rem', color: '#475569', fontSize: '0.83rem' }}>
              No saved schedule yet. All slots currently default to available until you customise them.
            </div>
          )}
          {loading ? (
            <div style={{ color: '#64748b' }}>Loading weekly schedule…</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
              {DAYS.map((day, dayIdx) => (
                <div key={day} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.75rem', backgroundColor: '#f8fafc' }}>
                  <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.6rem' }}>{day}</div>
                  <div style={{ display: 'grid', gap: '0.45rem' }}>
                    {SLOTS.map((slot) => {
                      const key: SlotKey = `${dayIdx}_${slot}`;
                      const isAvailable = weeklySlots[key] !== false;
                      const isSaving = calendarSaving === key;
                      return (
                        <button
                          key={slot}
                          onClick={() => void toggleSlot(dayIdx, slot)}
                          disabled={isSaving}
                          title={isAvailable ? 'Available — click to mark unavailable' : 'Unavailable — click to mark available'}
                          style={{
                            width: '100%',
                            borderRadius: '8px',
                            border: '1px solid',
                            borderColor: isAvailable ? '#86efac' : '#e2e8f0',
                            backgroundColor: isAvailable ? '#dcfce7' : '#ffffff',
                            color: isAvailable ? '#15803d' : '#64748b',
                            cursor: isSaving ? 'wait' : 'pointer',
                            fontSize: '0.76rem',
                            fontWeight: 700,
                            padding: '0.55rem 0.6rem',
                            opacity: isSaving ? 0.65 : 1,
                          }}
                        >
                          {slot} {isSaving ? '…' : isAvailable ? '✓' : '–'}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
