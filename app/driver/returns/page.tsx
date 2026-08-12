'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { getMissingColumnFromError } from '../../../lib/supabaseSchemaCompat';
import { VEHICLE_TYPE_LABELS } from '../../../lib/vehicleTypes';
import { ActionButton, AlertBanner, Panel } from '../../components/workspace/WorkspaceUI';

type DriverRow = {
  id: string;
  future_position?: string | null;
  future_position_date?: string | null;
  availability_status?: string | null;
  status?: string | null;
};

type ReturnJourneyRow = {
  from_postcode: string | null;
  to_postcode: string | null;
  available_from: string | null;
  available_to: string | null;
  vehicle_type: string | null;
  notes: string | null;
};

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

function fmtDate(value: string | null | undefined) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function ReturnJourneysPage() {
  const { user } = useAuth();
  const router = useRouter();
  const driverId = user?.driverId ?? null;

  const [driver, setDriver] = useState<DriverRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [returnFrom, setReturnFrom] = useState('');
  const [returnTo, setReturnTo] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [returnUntil, setReturnUntil] = useState('');
  const [returnVehicleType, setReturnVehicleType] = useState('');
  const [returnNotes, setReturnNotes] = useState('');
  const [goAnywhere, setGoAnywhere] = useState(false);
  const [futurePosition, setFuturePosition] = useState('');
  const [futureDate, setFutureDate] = useState('');
  const [currentReturnJourney, setCurrentReturnJourney] = useState<ReturnJourneyRow | null>(null);

  const loadDriver = useCallback(async () => {
    if (!driverId || !isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    const { data, error: fetchError } = await supabase
      .from('drivers')
      .select('id, future_position, future_position_date, availability_status, status')
      .eq('id', driverId)
      .maybeSingle();

    let row: DriverRow | null = null;
    if (fetchError && getMissingColumnFromError(fetchError, 'drivers') !== null) {
      const { data: minimal, error: minimalError } = await supabase
        .from('drivers')
        .select('id, availability_status, status')
        .eq('id', driverId)
        .maybeSingle();
      if (minimalError) setError('Return journey data could not be loaded.');
      row = (minimal ?? null) as DriverRow | null;
    } else if (fetchError) {
      setError('Return journey data could not be loaded.');
    } else {
      row = (data ?? null) as DriverRow | null;
    }

    setDriver(row);

    const { data: journey, error: journeyError } = await supabase
      .from('return_journeys')
      .select('from_postcode, to_postcode, available_from, available_to, vehicle_type, notes')
      .eq('driver_id', driverId)
      .eq('status', 'available')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!journeyError && journey) {
      const current = journey as ReturnJourneyRow;
      setCurrentReturnJourney(current);
      setReturnFrom(current.from_postcode ?? '');
      setReturnTo(current.to_postcode ?? '');
      setReturnDate(current.available_from ? current.available_from.slice(0, 16) : '');
      setReturnUntil(current.available_to ? current.available_to.slice(0, 16) : '');
      setReturnVehicleType(current.vehicle_type ?? '');
      setReturnNotes(current.notes ?? '');
      setGoAnywhere(!current.to_postcode);
    } else {
      setCurrentReturnJourney(null);
      setReturnFrom('');
      setReturnTo('');
      setReturnDate('');
      setReturnUntil('');
      setReturnVehicleType('');
      setReturnNotes('');
      setGoAnywhere(false);
      if (journeyError) setError((previous) => previous || 'Your current return journey could not be loaded.');
    }

    setFuturePosition(row?.future_position ?? '');
    setFutureDate(row?.future_position_date ? row.future_position_date.slice(0, 16) : '');
    setLoading(false);
  }, [driverId]);

  useEffect(() => {
    void loadDriver();
  }, [loadDriver]);

  const handleSaveReturn = async (event: FormEvent) => {
    event.preventDefault();
    if (!driverId || !isSupabaseConfigured) return;

    setSaving(true);
    setError('');

    const { data: driverCompany, error: companyError } = await supabase
      .from('drivers')
      .select('company_id')
      .eq('id', driverId)
      .maybeSingle();

    const companyId = (driverCompany as { company_id?: string | null } | null)?.company_id ?? null;
    if (companyError || !companyId) {
      setError('A linked company profile is required before a return journey can be published.');
      setSaving(false);
      return;
    }

    const { error: deleteError } = await supabase
      .from('return_journeys')
      .delete()
      .eq('driver_id', driverId)
      .eq('status', 'available');

    if (deleteError) {
      setError('The existing return journey could not be replaced safely.');
      setSaving(false);
      return;
    }

    if (returnFrom.trim()) {
      const { error: insertError } = await supabase.from('return_journeys').insert({
        company_id: companyId,
        driver_id: driverId,
        from_postcode: returnFrom.trim(),
        to_postcode: goAnywhere ? null : (returnTo.trim() || null),
        available_from: returnDate ? new Date(returnDate).toISOString() : null,
        available_to: returnUntil ? new Date(returnUntil).toISOString() : null,
        vehicle_type: returnVehicleType || null,
        notes: returnNotes.trim() || null,
        status: 'available',
      });

      if (insertError) {
        setError('The return journey could not be published.');
        setSaving(false);
        return;
      }
    }

    setSuccessMsg(returnFrom.trim() ? 'Return journey published.' : 'Return journey cleared.');
    await loadDriver();
    window.setTimeout(() => setSuccessMsg(''), 3500);
    setSaving(false);
  };

  const handleSaveFuturePosition = async (event: FormEvent) => {
    event.preventDefault();
    if (!driverId || !isSupabaseConfigured) return;

    setSaving(true);
    setError('');

    const { error: saveError } = await supabase.from('drivers').update({
      future_position: futurePosition.trim() || null,
      future_position_date: futureDate || null,
    }).eq('id', driverId);

    if (saveError) {
      setError(getMissingColumnFromError(saveError, 'drivers')
        ? 'Future-position publishing is not enabled in this database build yet.'
        : 'Your future position could not be saved.');
    } else {
      setSuccessMsg('Future position saved.');
      await loadDriver();
      window.setTimeout(() => setSuccessMsg(''), 3500);
    }
    setSaving(false);
  };

  const liveStatus = driver?.availability_status ?? driver?.status ?? 'Not set';

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell
        subtitle="Publish where your empty vehicle will be next, then jump straight to matching live work."
        availabilityLabel={liveStatus}
        headerActions={<ActionButton tone="primary" onClick={() => void loadDriver()} disabled={loading}>Refresh</ActionButton>}
      >
        {error && <AlertBanner tone="danger">{error}</AlertBanner>}
        {successMsg && <AlertBanner tone="success">{successMsg}</AlertBanner>}

        <Panel
          title="Current marketplace position"
          description="The active return journey and future position visible to matching workflows."
          actions={<ActionButton tone="success" onClick={() => router.push('/driver/loads')}>Find matching loads</ActionButton>}
        >
          <div className="driver-detail-grid">
            <div className="driver-detail-item"><span>Live availability</span><strong>{liveStatus}</strong></div>
            <div className="driver-detail-item"><span>Return route</span><strong>{currentReturnJourney?.from_postcode ? `${currentReturnJourney.from_postcode}${currentReturnJourney.to_postcode ? ` → ${currentReturnJourney.to_postcode}` : ' → Go Anywhere'}` : 'Not published'}</strong></div>
            <div className="driver-detail-item"><span>Available window</span><strong>{currentReturnJourney?.available_from ? `${fmtDate(currentReturnJourney.available_from)}${currentReturnJourney.available_to ? ` → ${fmtDate(currentReturnJourney.available_to)}` : ''}` : 'Not set'}</strong></div>
            <div className="driver-detail-item"><span>Vehicle</span><strong>{currentReturnJourney?.vehicle_type ? (VEHICLE_TYPE_LABELS[currentReturnJourney.vehicle_type] ?? currentReturnJourney.vehicle_type) : 'Not specified'}</strong></div>
            <div className="driver-detail-item"><span>Future position</span><strong>{driver?.future_position ?? 'Not published'}</strong></div>
          </div>
        </Panel>

        <div className="driver-ops-grid-2">
          <Panel title="Return journey" description="Publish an empty-vehicle route after your next delivery.">
            {loading ? (
              <div style={{ color: '#64748b', fontSize: '12px' }}>Loading declaration…</div>
            ) : (
              <form onSubmit={(event) => void handleSaveReturn(event)} style={{ display: 'grid', gap: '8px' }}>
                <div>
                  <label style={labelStyle}>Returning from</label>
                  <input style={inputStyle} value={returnFrom} onChange={(event) => setReturnFrom(event.target.value)} placeholder="e.g. Manchester M1" />
                </div>
                <div>
                  <label style={labelStyle}>Preferred destination</label>
                  <input style={inputStyle} value={returnTo} disabled={goAnywhere} onChange={(event) => setReturnTo(event.target.value)} placeholder="e.g. Blackburn BB1" />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569', fontSize: '11px', fontWeight: 700 }}>
                  <input type="checkbox" checked={goAnywhere} onChange={(event) => { setGoAnywhere(event.target.checked); if (event.target.checked) setReturnTo(''); }} />
                  Go Anywhere
                </label>
                <div>
                  <label style={labelStyle}>Vehicle size</label>
                  <select style={inputStyle} value={returnVehicleType} onChange={(event) => setReturnVehicleType(event.target.value)}>
                    <option value="">Use assigned / any vehicle</option>
                    {Object.entries(VEHICLE_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Departs / available from</label>
                  <input style={inputStyle} type="datetime-local" value={returnDate} onChange={(event) => setReturnDate(event.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Available until / ETA</label>
                  <input style={inputStyle} type="datetime-local" value={returnUntil} onChange={(event) => setReturnUntil(event.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Journey notes</label>
                  <textarea style={{ ...inputStyle, minHeight: '72px', height: 'auto', padding: '8px' }} value={returnNotes} onChange={(event) => setReturnNotes(event.target.value)} placeholder="Empty vehicle, equipment or route notes" />
                </div>
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  {currentReturnJourney && <ActionButton tone="secondary" onClick={() => { setReturnFrom(''); setReturnTo(''); setReturnDate(''); setReturnUntil(''); setReturnVehicleType(''); setReturnNotes(''); setGoAnywhere(false); }}>Clear form</ActionButton>}
                  <ActionButton type="submit" tone="primary" disabled={saving}>{saving ? 'Saving…' : 'Publish return journey'}</ActionButton>
                </div>
              </form>
            )}
          </Panel>

          <Panel title="Future position" description="Advertise the location where you expect to be available next.">
            {loading ? (
              <div style={{ color: '#64748b', fontSize: '12px' }}>Loading future position…</div>
            ) : (
              <form onSubmit={(event) => void handleSaveFuturePosition(event)} style={{ display: 'grid', gap: '8px' }}>
                <div>
                  <label style={labelStyle}>Future location</label>
                  <input style={inputStyle} value={futurePosition} onChange={(event) => setFuturePosition(event.target.value)} placeholder="e.g. Birmingham B1, Midlands" />
                </div>
                <div>
                  <label style={labelStyle}>Available from</label>
                  <input style={inputStyle} type="datetime-local" value={futureDate} onChange={(event) => setFutureDate(event.target.value)} />
                </div>
                <div className="driver-detail-item">
                  <span>Current declaration</span>
                  <strong>{driver?.future_position ? `${driver.future_position} · ${fmtDate(driver.future_position_date)}` : 'No future position published'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <ActionButton type="submit" tone="primary" disabled={saving}>{saving ? 'Saving…' : 'Save future position'}</ActionButton>
                </div>
              </form>
            )}
          </Panel>
        </div>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <ActionButton tone="secondary" onClick={() => router.push('/driver/availability')}>Update availability</ActionButton>
          <ActionButton tone="secondary" onClick={() => router.push('/driver/vehicles')}>Check vehicle</ActionButton>
          <ActionButton tone="success" onClick={() => router.push('/driver/loads')}>Browse live loads</ActionButton>
        </div>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
