'use client';

import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { getMissingColumnFromError } from '../../../lib/supabaseSchemaCompat';

// ── Types ─────────────────────────────────────────────────────────────────────

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
};

// ── Helpers ───────────────────────────────────────────────────────────────────

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

export default function ReturnJourneysPage() {
  const { user } = useAuth();
  const driverId = user?.driverId ?? null;

  const [driver, setDriver] = useState<DriverRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Return journey form
  const [returnFrom, setReturnFrom] = useState('');
  const [returnTo, setReturnTo] = useState('');
  const [returnDate, setReturnDate] = useState('');

  // Future position form
  const [futurePosition, setFuturePosition] = useState('');
  const [futureDate, setFutureDate] = useState('');
  const [currentReturnJourney, setCurrentReturnJourney] = useState<ReturnJourneyRow | null>(null);

  const loadDriver = useCallback(async () => {
    if (!driverId || !isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from('drivers')
      .select('id, future_position, future_position_date, availability_status, status')
      .eq('id', driverId)
      .maybeSingle();

    if (fetchError && getMissingColumnFromError(fetchError, 'drivers') !== null) {
      // Column not yet in schema — use minimal fetch
      const { data: minimal } = await supabase
        .from('drivers')
        .select('id, availability_status, status')
        .eq('id', driverId)
        .maybeSingle();
      setDriver((minimal ?? null) as DriverRow | null);
    } else {
      const row = (data ?? null) as DriverRow | null;
      setDriver(row);

      const { data: rjRow } = await supabase
        .from('return_journeys')
        .select('from_postcode, to_postcode, available_from')
        .eq('driver_id', driverId)
        .eq('status', 'available')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (rjRow) {
        const rj = rjRow as ReturnJourneyRow;
        setCurrentReturnJourney(rj);
        setReturnFrom(rj.from_postcode ?? '');
        setReturnTo(rj.to_postcode ?? '');
        setReturnDate(rj.available_from ? rj.available_from.slice(0, 16) : '');
      } else {
        setCurrentReturnJourney(null);
        setReturnFrom('');
        setReturnTo('');
        setReturnDate('');
      }

      if (row?.future_position)      setFuturePosition(row.future_position);
      if (row?.future_position_date) setFutureDate(row.future_position_date.slice(0, 16));
    }
    setLoading(false);
  }, [driverId]);

  useEffect(() => {
    void loadDriver();
  }, [loadDriver]);

  const handleSaveReturn = async (e: FormEvent) => {
    e.preventDefault();
    if (!driverId || !isSupabaseConfigured) return;
    setSaving(true);
    setError('');

    // ── 1. Upsert into return_journeys table (canonical) ────────────────────────
    // Retrieve the driver's company_id first
    const { data: drvCompany } = await supabase
      .from('drivers')
      .select('company_id')
      .eq('id', driverId)
      .maybeSingle();

    const companyId = (drvCompany as { company_id?: string | null } | null)?.company_id ?? null;

    if (companyId) {
      // Delete previous active return journey for this driver, then insert fresh
      await supabase
        .from('return_journeys')
        .delete()
        .eq('driver_id', driverId)
        .eq('status', 'available');

      if (returnFrom) {
        const { error: rjErr } = await supabase.from('return_journeys').insert({
          company_id:     companyId,
          driver_id:      driverId,
          from_postcode:  returnFrom || null,
          to_postcode:    returnTo   || null,
          available_from: returnDate ? new Date(returnDate).toISOString() : null,
          status:         'available',
        });

        if (rjErr) {
          setError(`Failed to save return journey: ${rjErr.message}`);
          setSaving(false);
          return;
        }
      }
    }

    setSuccessMsg('✅ Return journey saved.');
    await loadDriver();
    setTimeout(() => setSuccessMsg(''), 4000);
    setSaving(false);
  };

  const handleSaveFuturePosition = async (e: FormEvent) => {
    e.preventDefault();
    if (!driverId || !isSupabaseConfigured) return;
    setSaving(true);
    setError('');

    const update: Record<string, unknown> = {
      future_position: futurePosition || null,
      future_position_date: futureDate || null,
    };

    const { error: saveErr } = await supabase.from('drivers').update(update).eq('id', driverId);
    if (saveErr) {
      if (getMissingColumnFromError(saveErr, 'drivers')) {
        setError('Future position fields are not yet available in the database. Please apply the latest migration.');
      } else {
        setError(`Failed to save: ${saveErr.message}`);
      }
    } else {
      setSuccessMsg('✅ Future position saved.');
      setTimeout(() => setSuccessMsg(''), 4000);
    }
    setSaving(false);
  };

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell
        subtitle="Declare your return journey and future position to attract backload opportunities."
      >
        <h2 style={{ margin: '0 0 0.3rem', fontSize: '1.35rem', fontWeight: 700, color: '#0f172a' }}>Return Journeys &amp; Future Position</h2>
        <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: '#64748b', lineHeight: 1.6 }}>
          Let shippers know where you&apos;ll be available after a delivery — this increases your chances of picking up backloads and reduces empty running.
        </p>

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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>

          {/* Return Journey */}
          <div style={card}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', marginBottom: '0.8rem' }}>
              🔄 Return Journey
            </div>
            {loading ? (
              <div style={{ color: '#64748b', fontSize: '0.9rem' }}>Loading…</div>
            ) : (
              <form onSubmit={(e) => void handleSaveReturn(e)} style={{ display: 'grid', gap: '0.7rem' }}>
                <div>
                  <label style={labelStyle}>Returning from (location/postcode)</label>
                  <input style={inputStyle} value={returnFrom} onChange={(e) => setReturnFrom(e.target.value)} placeholder="e.g. Manchester M1" />
                </div>
                <div>
                  <label style={labelStyle}>Returning to (preferred destination)</label>
                  <input style={inputStyle} value={returnTo} onChange={(e) => setReturnTo(e.target.value)} placeholder="e.g. London EC1" />
                </div>
                <div>
                  <label style={labelStyle}>Available from (date &amp; time)</label>
                  <input style={inputStyle} type="datetime-local" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  style={{ padding: '0.6rem', backgroundColor: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '7px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
                >
                  {saving ? 'Saving…' : 'Save Return Journey'}
                </button>
              </form>
            )}

            {/* Current saved value */}
            {currentReturnJourney?.from_postcode && (
              <div style={{ marginTop: '0.9rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '7px', padding: '0.7rem' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#15803d', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Current declaration</div>
                <div style={{ fontSize: '0.84rem', color: '#0f172a' }}>
                  {currentReturnJourney.from_postcode}
                  {currentReturnJourney.to_postcode ? ` → ${currentReturnJourney.to_postcode}` : ''}
                </div>
                {currentReturnJourney.available_from && (
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem' }}>
                    Available from: {new Date(currentReturnJourney.available_from).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Future Position */}
          <div style={card}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', marginBottom: '0.8rem' }}>
              📍 Future Position
            </div>
            {loading ? (
              <div style={{ color: '#64748b', fontSize: '0.9rem' }}>Loading…</div>
            ) : (
              <form onSubmit={(e) => void handleSaveFuturePosition(e)} style={{ display: 'grid', gap: '0.7rem' }}>
                <div>
                  <label style={labelStyle}>Future location (where will you be?)</label>
                  <input style={inputStyle} value={futurePosition} onChange={(e) => setFuturePosition(e.target.value)} placeholder="e.g. Birmingham B1, Midlands area" />
                </div>
                <div>
                  <label style={labelStyle}>Available from (date &amp; time)</label>
                  <input style={inputStyle} type="datetime-local" value={futureDate} onChange={(e) => setFutureDate(e.target.value)} />
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  style={{ padding: '0.6rem', backgroundColor: '#7c3aed', color: '#fff', border: 'none', borderRadius: '7px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
                >
                  {saving ? 'Saving…' : 'Save Future Position'}
                </button>
              </form>
            )}

            {driver?.future_position && (
              <div style={{ marginTop: '0.9rem', backgroundColor: '#faf5ff', border: '1px solid #ddd6fe', borderRadius: '7px', padding: '0.7rem' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#7c3aed', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Current declaration</div>
                <div style={{ fontSize: '0.84rem', color: '#0f172a' }}>{driver.future_position}</div>
                {driver.future_position_date && (
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem' }}>
                    Available from: {new Date(driver.future_position_date).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Info panel */}
        <div style={{ ...card, marginTop: '1rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' }}>ℹ️ How this works</div>
          <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.82rem', color: '#64748b', lineHeight: 1.7 }}>
            <li>Your return journey and future position are visible to shippers and dispatchers searching for available drivers.</li>
            <li>Updating your position regularly increases your match rate for new load opportunities.</li>
            <li>You can also browse the load board to find return loads matching your route.</li>
          </ul>
        </div>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
