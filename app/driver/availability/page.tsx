'use client';

import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { getMissingColumnFromError } from '../../../lib/supabaseSchemaCompat';
import { DRIVER_PERSONA_LABELS, mapDriverPersona, type DriverPersona } from '../../../lib/authRole';

// ── Types ─────────────────────────────────────────────────────────────────────

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

// day_of_week 0=Monday … 6=Sunday
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SLOTS: Array<'AM' | 'PM' | 'EVENING'> = ['AM', 'PM', 'EVENING'];

// ── Helpers ───────────────────────────────────────────────────────────────────

const AVAILABILITY_OPTIONS: Array<{ value: AvailabilityStatus; label: string; description: string; color: string; bg: string }> = [
  { value: 'available', label: 'Available',    description: 'Ready to accept new jobs.',       color: '#15803d', bg: '#f0fdf4' },
  { value: 'busy',      label: 'On a Job',     description: 'Currently on an active delivery.', color: '#b45309', bg: '#fffbeb' },
  { value: 'offline',   label: 'Offline',      description: 'Not available for new work.',     color: '#dc2626', bg: '#fef2f2' },
];

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  bicycle: 'Bicycle', motorbike: 'Motorbike', car: 'Car',
  van_small: 'Small Van', van_large: 'Large Van', luton: 'Luton Van',
  truck_7_5t: '7.5t Truck', truck_18t: '18t Truck', artic: 'Artic',
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

// ── Component ─────────────────────────────────────────────────────────────────

export default function AvailabilityPage() {
  const { user } = useAuth();
  const driverId = user?.driverId ?? null;

  const [driverRow, setDriverRow] = useState<DriverRow | null>(null);
  const [vehicle, setVehicle] = useState<VehicleRow | null>(null);
  const [availability, setAvailability] = useState<AvailabilityStatus>('available');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Profile form
  const [persona, setPersona] = useState<DriverPersona | ''>('');
  const [homePostcode, setHomePostcode] = useState('');
  const [maxRadiusKm, setMaxRadiusKm] = useState('');

  // Weekly calendar slots: key = `${dayOfWeek}_${slot}`, value = true (available) / false (unavailable)
  const [weeklySlots, setWeeklySlots] = useState<Record<SlotKey, boolean>>({} as Record<SlotKey, boolean>);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [calendarSaving, setCalendarSaving] = useState<SlotKey | null>(null);

  const loadData = useCallback(async () => {
    if (!driverId || !isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const driverRes = await supabase
      .from('drivers')
      .select('id, display_name, phone, availability_status, status, persona, home_postcode, max_radius_km')
      .eq('id', driverId)
      .maybeSingle();

    if (driverRes.error && getMissingColumnFromError(driverRes.error, 'drivers') !== null) {
      const fallback = await supabase
        .from('drivers')
        .select('id, display_name, phone, availability_status, status')
        .eq('id', driverId)
        .maybeSingle();
      setDriverRow((fallback.data as DriverRow | null) ?? null);
    } else {
      const row = (driverRes.data as DriverRow | null) ?? null;
      setDriverRow(row);
      if (row?.persona) setPersona(mapDriverPersona(row.persona) ?? '');
      if (row?.home_postcode) setHomePostcode(row.home_postcode);
      if (row?.max_radius_km) setMaxRadiusKm(String(row.max_radius_km));
    }

    const avail = (driverRes.data as DriverRow | null)?.availability_status ?? (driverRes.data as DriverRow | null)?.status ?? '';
    if (avail === 'available' || avail === 'busy' || avail === 'offline') {
      setAvailability(avail as AvailabilityStatus);
    }

    const vehicleRes = await supabase
      .from('vehicles')
      .select('type, reg_plate, payload_kg, has_tail_lift')
      .eq('assigned_driver_id', driverId)
      .maybeSingle();

    if (!vehicleRes.error) {
      setVehicle((vehicleRes.data as VehicleRow | null) ?? null);
    }

    setLoading(false);
  }, [driverId]);

  const loadCalendar = useCallback(async () => {
    if (!driverId || !isSupabaseConfigured) { setCalendarLoading(false); return; }
    setCalendarLoading(true);
    const { data, error: calErr } = await supabase
      .from('driver_availability_slots')
      .select('day_of_week, slot, available')
      .eq('driver_id', driverId);

    if (!calErr && data) {
      const map: Record<SlotKey, boolean> = {} as Record<SlotKey, boolean>;
      for (const row of data as Array<{ day_of_week: number; slot: string; available: boolean }>) {
        if (row.slot === 'AM' || row.slot === 'PM' || row.slot === 'EVENING') {
          map[`${row.day_of_week}_${row.slot}` as SlotKey] = row.available;
        }
      }
      setWeeklySlots(map);
    }
    setCalendarLoading(false);
  }, [driverId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    void loadCalendar();
  }, [loadCalendar]);

  const handleAvailabilityChange = async (next: AvailabilityStatus) => {
    if (!driverId || !isSupabaseConfigured || saving) return;
    setSaving(true);
    setAvailability(next);
    const updateRes = await supabase.from('drivers').update({ availability_status: next }).eq('id', driverId);
    if (updateRes.error && getMissingColumnFromError(updateRes.error, 'drivers') === 'availability_status') {
      await supabase.from('drivers').update({ status: next }).eq('id', driverId);
    }
    setSaving(false);
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!driverId || !isSupabaseConfigured) return;
    setSaving(true);
    setError('');

    const update: Record<string, unknown> = {};
    if (persona) update.persona = persona;
    if (homePostcode !== undefined) update.home_postcode = homePostcode || null;
    if (maxRadiusKm !== undefined) update.max_radius_km = maxRadiusKm ? parseInt(maxRadiusKm, 10) : null;

    const { error: saveErr } = await supabase.from('drivers').update(update).eq('id', driverId);
    if (saveErr) {
      if (getMissingColumnFromError(saveErr, 'drivers')) {
        setError('Some profile fields are not yet in the database. Contact support to apply the latest migration.');
      } else {
        setError(`Failed to save: ${saveErr.message}`);
      }
    } else {
      setSuccessMsg('✅ Profile updated.');
      setTimeout(() => setSuccessMsg(''), 4000);
      void loadData();
    }
    setSaving(false);
  };

  const toggleSlot = async (day: number, slot: 'AM' | 'PM' | 'EVENING') => {
    if (!driverId || !isSupabaseConfigured) return;
    const key: SlotKey = `${day}_${slot}`;
    const current = weeklySlots[key] ?? true; // default: available
    const next = !current;
    setCalendarSaving(key);
    // Optimistic update
    setWeeklySlots((prev) => ({ ...prev, [key]: next }));

    const { error: upsertErr } = await supabase
      .from('driver_availability_slots')
      .upsert(
        { driver_id: driverId, day_of_week: day, slot, available: next, updated_at: new Date().toISOString() },
        { onConflict: 'driver_id,day_of_week,slot' }
      );

    if (upsertErr) {
      // Revert on failure
      setWeeklySlots((prev) => ({ ...prev, [key]: current }));
    }
    setCalendarSaving(null);
  };

  const currentOption = AVAILABILITY_OPTIONS.find((o) => o.value === availability) ?? AVAILABILITY_OPTIONS[0];

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell
        subtitle="Manage your availability, driver persona, home location, and vehicle assignment."
        availabilityLabel={currentOption.label}
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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>

          {/* Availability status */}
          <div style={card}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', marginBottom: '0.85rem' }}>
              Current Status
            </div>
            {loading ? (
              <div style={{ color: '#64748b' }}>Loading…</div>
            ) : (
              <>
                <div style={{ display: 'grid', gap: '0.55rem', marginBottom: '0.9rem' }}>
                  {AVAILABILITY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => void handleAvailabilityChange(option.value)}
                      disabled={saving}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.7rem',
                        padding: '0.75rem',
                        borderRadius: '8px',
                        border: availability === option.value ? `2px solid ${option.color}` : '1px solid #e2e8f0',
                        backgroundColor: availability === option.value ? option.bg : '#f8fafc',
                        cursor: saving ? 'not-allowed' : 'pointer',
                        textAlign: 'left',
                        width: '100%',
                        opacity: saving && availability !== option.value ? 0.6 : 1,
                      }}
                    >
                      <div
                        style={{
                          width: '14px', height: '14px', borderRadius: '50%', marginTop: '2px',
                          backgroundColor: availability === option.value ? option.color : '#cbd5e1',
                          flexShrink: 0,
                        }}
                      />
                      <div>
                        <div style={{ fontSize: '0.88rem', fontWeight: 700, color: availability === option.value ? option.color : '#374151' }}>
                          {option.label}
                        </div>
                        <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '0.1rem' }}>{option.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: '0.82rem', color: currentOption.color, fontWeight: 600 }}>
                  Status: {currentOption.label}
                </div>
              </>
            )}
          </div>

          {/* Driver persona + profile */}
          <div style={card}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', marginBottom: '0.85rem' }}>
              Driver Profile
            </div>
            {loading ? (
              <div style={{ color: '#64748b' }}>Loading…</div>
            ) : (
              <form onSubmit={(e) => void handleSaveProfile(e)} style={{ display: 'grid', gap: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>Driver persona</label>
                  <select
                    value={persona}
                    onChange={(e) => setPersona(e.target.value as DriverPersona | '')}
                    style={inputStyle}
                  >
                    <option value="">Select persona…</option>
                    {(Object.entries(DRIVER_PERSONA_LABELS) as [DriverPersona, string][]).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                    Used for workspace defaults and load filters.
                  </div>
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
                  disabled={saving}
                  style={{ padding: '0.6rem', backgroundColor: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '7px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
                >
                  {saving ? 'Saving…' : 'Save Profile'}
                </button>
              </form>
            )}
          </div>

          {/* Assigned vehicle */}
          <div style={card}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', marginBottom: '0.85rem' }}>
              Assigned Vehicle
            </div>
            {loading ? (
              <div style={{ color: '#64748b' }}>Loading…</div>
            ) : vehicle ? (
              <div style={{ display: 'grid', gap: '0.6rem' }}>
                {[
                  { label: 'Registration',      value: vehicle.reg_plate ?? 'Not set' },
                  { label: 'Vehicle type',       value: VEHICLE_TYPE_LABELS[vehicle.type ?? ''] ?? vehicle.type ?? 'Not set' },
                  { label: 'Payload capacity',   value: vehicle.payload_kg ? `${vehicle.payload_kg} kg` : 'Not set' },
                  { label: 'Tail lift equipped', value: vehicle.has_tail_lift ? 'Yes' : 'No' },
                ].map((row) => (
                  <div key={row.label} style={{ backgroundColor: '#f8fafc', borderRadius: '7px', padding: '0.7rem' }}>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.15rem' }}>{row.label}</div>
                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.88rem' }}>{row.value}</div>
                  </div>
                ))}
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                  Vehicle assignment is managed by your company dispatcher.
                </div>
              </div>
            ) : (
              <div style={{ backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
                <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem' }}>No vehicle assigned</div>
                <div style={{ fontSize: '0.82rem', color: '#64748b' }}>Contact your dispatcher to assign a vehicle.</div>
              </div>
            )}
          </div>
        </div>

        {/* ── Weekly Availability Calendar ─────────────────────────────────── */}
        <div style={card}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', marginBottom: '0.85rem' }}>
            Weekly Schedule
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '1rem' }}>
            Click a slot to toggle availability. Green = available, grey = not available.
          </div>
          {calendarLoading ? (
            <div style={{ color: '#64748b' }}>Loading schedule…</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: '420px' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '0.4rem 0.5rem', width: '60px', fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700, textAlign: 'left' }}>Slot</th>
                    {DAYS.map((d) => (
                      <th key={d} style={{ padding: '0.4rem 0.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#374151', textAlign: 'center', minWidth: '56px' }}>{d}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SLOTS.map((slot) => (
                    <tr key={slot}>
                      <td style={{ padding: '0.3rem 0.5rem', fontSize: '0.72rem', fontWeight: 700, color: '#64748b' }}>{slot}</td>
                      {DAYS.map((_, dayIdx) => {
                        const key: SlotKey = `${dayIdx}_${slot}`;
                        const isAvailable = weeklySlots[key] !== false; // default to available
                        const isSaving = calendarSaving === key;
                        return (
                          <td key={dayIdx} style={{ padding: '0.25rem 0.35rem', textAlign: 'center' }}>
                            <button
                              onClick={() => void toggleSlot(dayIdx, slot)}
                              disabled={isSaving}
                              title={isAvailable ? 'Available — click to mark unavailable' : 'Unavailable — click to mark available'}
                              style={{
                                width: '44px',
                                height: '30px',
                                borderRadius: '6px',
                                border: '1px solid',
                                borderColor: isAvailable ? '#86efac' : '#e2e8f0',
                                backgroundColor: isAvailable ? '#dcfce7' : '#f1f5f9',
                                color: isAvailable ? '#15803d' : '#94a3b8',
                                cursor: isSaving ? 'wait' : 'pointer',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                opacity: isSaving ? 0.6 : 1,
                                transition: 'background 0.15s',
                              }}
                            >
                              {isSaving ? '…' : isAvailable ? '✓' : '–'}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '1rem', fontSize: '0.72rem', color: '#64748b' }}>
            <span>
              <span style={{ display: 'inline-block', width: '12px', height: '12px', backgroundColor: '#dcfce7', border: '1px solid #86efac', borderRadius: '3px', verticalAlign: 'middle', marginRight: '0.25rem' }} />
              Available
            </span>
            <span>
              <span style={{ display: 'inline-block', width: '12px', height: '12px', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '3px', verticalAlign: 'middle', marginRight: '0.25rem' }} />
              Not available
            </span>
          </div>
        </div>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

const AVAILABILITY_OPTIONS: Array<{ value: AvailabilityStatus; label: string; description: string; color: string; bg: string }> = [
  { value: 'available', label: 'Available',    description: 'Ready to accept new jobs.',       color: '#15803d', bg: '#f0fdf4' },
  { value: 'busy',      label: 'On a Job',     description: 'Currently on an active delivery.', color: '#b45309', bg: '#fffbeb' },
  { value: 'offline',   label: 'Offline',      description: 'Not available for new work.',     color: '#dc2626', bg: '#fef2f2' },
];

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  bicycle: 'Bicycle', motorbike: 'Motorbike', car: 'Car',
  van_small: 'Small Van', van_large: 'Large Van', luton: 'Luton Van',
  truck_7_5t: '7.5t Truck', truck_18t: '18t Truck', artic: 'Artic',
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

// ── Component ─────────────────────────────────────────────────────────────────

export default function AvailabilityPage() {
  const { user } = useAuth();
  const driverId = user?.driverId ?? null;

  const [driverRow, setDriverRow] = useState<DriverRow | null>(null);
  const [vehicle, setVehicle] = useState<VehicleRow | null>(null);
  const [availability, setAvailability] = useState<AvailabilityStatus>('available');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Profile form
  const [persona, setPersona] = useState<DriverPersona | ''>('');
  const [homePostcode, setHomePostcode] = useState('');
  const [maxRadiusKm, setMaxRadiusKm] = useState('');

  const loadData = useCallback(async () => {
    if (!driverId || !isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const driverRes = await supabase
      .from('drivers')
      .select('id, display_name, phone, availability_status, status, persona, home_postcode, max_radius_km')
      .eq('id', driverId)
      .maybeSingle();

    if (driverRes.error && getMissingColumnFromError(driverRes.error, 'drivers') !== null) {
      const fallback = await supabase
        .from('drivers')
        .select('id, display_name, phone, availability_status, status')
        .eq('id', driverId)
        .maybeSingle();
      setDriverRow((fallback.data as DriverRow | null) ?? null);
    } else {
      const row = (driverRes.data as DriverRow | null) ?? null;
      setDriverRow(row);
      if (row?.persona) setPersona(mapDriverPersona(row.persona) ?? '');
      if (row?.home_postcode) setHomePostcode(row.home_postcode);
      if (row?.max_radius_km) setMaxRadiusKm(String(row.max_radius_km));
    }

    const avail = (driverRes.data as DriverRow | null)?.availability_status ?? (driverRes.data as DriverRow | null)?.status ?? '';
    if (avail === 'available' || avail === 'busy' || avail === 'offline') {
      setAvailability(avail as AvailabilityStatus);
    }

    const vehicleRes = await supabase
      .from('vehicles')
      .select('type, reg_plate, payload_kg, has_tail_lift')
      .eq('assigned_driver_id', driverId)
      .maybeSingle();

    if (!vehicleRes.error) {
      setVehicle((vehicleRes.data as VehicleRow | null) ?? null);
    }

    setLoading(false);
  }, [driverId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleAvailabilityChange = async (next: AvailabilityStatus) => {
    if (!driverId || !isSupabaseConfigured || saving) return;
    setSaving(true);
    setAvailability(next);
    const updateRes = await supabase.from('drivers').update({ availability_status: next }).eq('id', driverId);
    if (updateRes.error && getMissingColumnFromError(updateRes.error, 'drivers') === 'availability_status') {
      await supabase.from('drivers').update({ status: next }).eq('id', driverId);
    }
    setSaving(false);
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!driverId || !isSupabaseConfigured) return;
    setSaving(true);
    setError('');

    const update: Record<string, unknown> = {};
    if (persona) update.persona = persona;
    if (homePostcode !== undefined) update.home_postcode = homePostcode || null;
    if (maxRadiusKm !== undefined) update.max_radius_km = maxRadiusKm ? parseInt(maxRadiusKm, 10) : null;

    const { error: saveErr } = await supabase.from('drivers').update(update).eq('id', driverId);
    if (saveErr) {
      if (getMissingColumnFromError(saveErr, 'drivers')) {
        setError('Some profile fields are not yet in the database. Contact support to apply the latest migration.');
      } else {
        setError(`Failed to save: ${saveErr.message}`);
      }
    } else {
      setSuccessMsg('✅ Profile updated.');
      setTimeout(() => setSuccessMsg(''), 4000);
      void loadData();
    }
    setSaving(false);
  };

  const currentOption = AVAILABILITY_OPTIONS.find((o) => o.value === availability) ?? AVAILABILITY_OPTIONS[0];

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell
        subtitle="Manage your availability, driver persona, home location, and vehicle assignment."
        availabilityLabel={currentOption.label}
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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>

          {/* Availability status */}
          <div style={card}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', marginBottom: '0.85rem' }}>
              Current Status
            </div>
            {loading ? (
              <div style={{ color: '#64748b' }}>Loading…</div>
            ) : (
              <>
                <div style={{ display: 'grid', gap: '0.55rem', marginBottom: '0.9rem' }}>
                  {AVAILABILITY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => void handleAvailabilityChange(option.value)}
                      disabled={saving}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.7rem',
                        padding: '0.75rem',
                        borderRadius: '8px',
                        border: availability === option.value ? `2px solid ${option.color}` : '1px solid #e2e8f0',
                        backgroundColor: availability === option.value ? option.bg : '#f8fafc',
                        cursor: saving ? 'not-allowed' : 'pointer',
                        textAlign: 'left',
                        width: '100%',
                        opacity: saving && availability !== option.value ? 0.6 : 1,
                      }}
                    >
                      <div
                        style={{
                          width: '14px', height: '14px', borderRadius: '50%', marginTop: '2px',
                          backgroundColor: availability === option.value ? option.color : '#cbd5e1',
                          flexShrink: 0,
                        }}
                      />
                      <div>
                        <div style={{ fontSize: '0.88rem', fontWeight: 700, color: availability === option.value ? option.color : '#374151' }}>
                          {option.label}
                        </div>
                        <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '0.1rem' }}>{option.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: '0.82rem', color: currentOption.color, fontWeight: 600 }}>
                  Status: {currentOption.label}
                </div>
              </>
            )}
          </div>

          {/* Driver persona + profile */}
          <div style={card}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', marginBottom: '0.85rem' }}>
              Driver Profile
            </div>
            {loading ? (
              <div style={{ color: '#64748b' }}>Loading…</div>
            ) : (
              <form onSubmit={(e) => void handleSaveProfile(e)} style={{ display: 'grid', gap: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>Driver persona</label>
                  <select
                    value={persona}
                    onChange={(e) => setPersona(e.target.value as DriverPersona | '')}
                    style={inputStyle}
                  >
                    <option value="">Select persona…</option>
                    {(Object.entries(DRIVER_PERSONA_LABELS) as [DriverPersona, string][]).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                    Used for workspace defaults and load filters.
                  </div>
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
                  disabled={saving}
                  style={{ padding: '0.6rem', backgroundColor: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '7px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
                >
                  {saving ? 'Saving…' : 'Save Profile'}
                </button>
              </form>
            )}
          </div>

          {/* Assigned vehicle */}
          <div style={card}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', marginBottom: '0.85rem' }}>
              Assigned Vehicle
            </div>
            {loading ? (
              <div style={{ color: '#64748b' }}>Loading…</div>
            ) : vehicle ? (
              <div style={{ display: 'grid', gap: '0.6rem' }}>
                {[
                  { label: 'Registration',      value: vehicle.reg_plate ?? 'Not set' },
                  { label: 'Vehicle type',       value: VEHICLE_TYPE_LABELS[vehicle.type ?? ''] ?? vehicle.type ?? 'Not set' },
                  { label: 'Payload capacity',   value: vehicle.payload_kg ? `${vehicle.payload_kg} kg` : 'Not set' },
                  { label: 'Tail lift equipped', value: vehicle.has_tail_lift ? 'Yes' : 'No' },
                ].map((row) => (
                  <div key={row.label} style={{ backgroundColor: '#f8fafc', borderRadius: '7px', padding: '0.7rem' }}>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.15rem' }}>{row.label}</div>
                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.88rem' }}>{row.value}</div>
                  </div>
                ))}
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                  Vehicle assignment is managed by your company dispatcher.
                </div>
              </div>
            ) : (
              <div style={{ backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
                <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem' }}>No vehicle assigned</div>
                <div style={{ fontSize: '0.82rem', color: '#64748b' }}>Contact your dispatcher to assign a vehicle.</div>
              </div>
            )}
          </div>
        </div>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
