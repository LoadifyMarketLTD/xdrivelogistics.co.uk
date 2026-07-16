'use client';

import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import {
  WorkspaceShell,
  WorkspaceMain,
  WorkspaceContent,
  LoadingCard,
  ErrorBanner,
} from '../../components/workspace';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { getMissingColumnFromError } from '../../../lib/supabaseSchemaCompat';

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

const card: CSSProperties = {
  backgroundColor: '#ffffff',
  border: '1px solid #dbe3ef',
  borderRadius: '8px',
  padding: '1rem',
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '0.65rem 0.75rem',
  border: '1px solid #cbd5e1',
  borderRadius: '6px',
  fontSize: '0.9rem',
  color: '#0f172a',
  backgroundColor: '#ffffff',
  boxSizing: 'border-box',
};

const labelStyle: CSSProperties = {
  fontSize: '0.78rem',
  fontWeight: 700,
  color: '#334155',
  display: 'block',
  marginBottom: '0.35rem',
};

export default function AdminReturnJourneysPage() {
  const { user } = useAuth();
  const driverId = user?.driverId ?? null;
  const [driver, setDriver] = useState<DriverRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [returnFrom, setReturnFrom] = useState('');
  const [returnTo, setReturnTo] = useState('');
  const [returnDate, setReturnDate] = useState('');
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

      if (row?.future_position) setFuturePosition(row.future_position);
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

    const { data: drvCompany } = await supabase
      .from('drivers')
      .select('company_id')
      .eq('id', driverId)
      .maybeSingle();
    const companyId = (drvCompany as { company_id?: string | null } | null)?.company_id ?? user?.companyId ?? null;

    if (!companyId) {
      setError('Return journeys require a linked company profile.');
      setSaving(false);
      return;
    }

    await supabase.from('return_journeys').delete().eq('driver_id', driverId).eq('status', 'available');

    if (returnFrom.trim()) {
      const { error: rjErr } = await supabase.from('return_journeys').insert({
        company_id: companyId,
        driver_id: driverId,
        from_postcode: returnFrom.trim(),
        to_postcode: returnTo.trim() || null,
        available_from: returnDate ? new Date(returnDate).toISOString() : null,
        status: 'available',
      });

      if (rjErr) {
        setError(`Failed to save return journey: ${rjErr.message}`);
        setSaving(false);
        return;
      }
    }

    setSuccessMsg('Return journey saved.');
    await loadDriver();
    setTimeout(() => setSuccessMsg(''), 4000);
    setSaving(false);
  };

  const handleSaveFuturePosition = async (e: FormEvent) => {
    e.preventDefault();
    if (!driverId || !isSupabaseConfigured) return;
    setSaving(true);
    setError('');

    const { error: saveErr } = await supabase
      .from('drivers')
      .update({
        future_position: futurePosition.trim() || null,
        future_position_date: futureDate || null,
      })
      .eq('id', driverId);

    if (saveErr) {
      setError(getMissingColumnFromError(saveErr, 'drivers')
        ? 'Future position fields are not available in the current database build.'
        : `Failed to save future position: ${saveErr.message}`);
    } else {
      setSuccessMsg('Future position saved.');
      setTimeout(() => setSuccessMsg(''), 4000);
    }
    setSaving(false);
  };

  return (
    <ProtectedRoute allowedRoles={['driver', 'company_admin', 'company_staff', 'owner']}>
      <WorkspaceShell>
        <WorkspaceMain>
          <WorkspaceContent>
        <div style={{ marginBottom: '1rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#1f2937', margin: 0 }}>Return Journeys</h1>
          <p style={{ color: '#64748b', margin: '0.35rem 0 0' }}>Advertise where you will be available after delivery.</p>
        </div>

        {!driverId && (
          <div style={{ ...card, color: '#92400e', backgroundColor: '#fefce8', borderColor: '#fde68a' }}>
            No driver profile is linked to this account yet.
          </div>
        )}
        {successMsg && <div style={{ ...card, color: '#166534', backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', marginBottom: '0.75rem', fontWeight: 700 }}>{successMsg}</div>}
        {error && <ErrorBanner msg={error} />}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
          <section style={card}>
            <h2 style={{ margin: '0 0 0.8rem', fontSize: '1rem', color: '#0f172a' }}>Return Journey</h2>
            {loading ? <LoadingCard text="Loading…" /> : (
              <form onSubmit={(e) => void handleSaveReturn(e)} style={{ display: 'grid', gap: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>Returning from</label>
                  <input style={inputStyle} value={returnFrom} onChange={(e) => setReturnFrom(e.target.value)} placeholder="Manchester M1" />
                </div>
                <div>
                  <label style={labelStyle}>Returning to</label>
                  <input style={inputStyle} value={returnTo} onChange={(e) => setReturnTo(e.target.value)} placeholder="London EC1 or anywhere" />
                </div>
                <div>
                  <label style={labelStyle}>Available from</label>
                  <input style={inputStyle} type="datetime-local" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
                </div>
                <button type="submit" disabled={saving || !driverId} style={{ padding: '0.65rem', backgroundColor: saving || !driverId ? '#94a3b8' : '#1d4ed8', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: saving || !driverId ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Saving...' : 'Save Return Journey'}
                </button>
              </form>
            )}
            {currentReturnJourney?.from_postcode && (
              <div style={{ marginTop: '0.9rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.75rem', fontSize: '0.86rem', color: '#334155' }}>
                Current: {currentReturnJourney.from_postcode}{currentReturnJourney.to_postcode ? ` to ${currentReturnJourney.to_postcode}` : ''}
              </div>
            )}
          </section>

          <section style={card}>
            <h2 style={{ margin: '0 0 0.8rem', fontSize: '1rem', color: '#0f172a' }}>Future Position</h2>
            {loading ? <LoadingCard text="Loading…" /> : (
              <form onSubmit={(e) => void handleSaveFuturePosition(e)} style={{ display: 'grid', gap: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>Future location</label>
                  <input style={inputStyle} value={futurePosition} onChange={(e) => setFuturePosition(e.target.value)} placeholder="Birmingham B1" />
                </div>
                <div>
                  <label style={labelStyle}>Available from</label>
                  <input style={inputStyle} type="datetime-local" value={futureDate} onChange={(e) => setFutureDate(e.target.value)} />
                </div>
                <button type="submit" disabled={saving || !driverId} style={{ padding: '0.65rem', backgroundColor: saving || !driverId ? '#94a3b8' : '#1d4ed8', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: saving || !driverId ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Saving...' : 'Save Future Position'}
                </button>
              </form>
            )}
            {driver?.future_position && (
              <div style={{ marginTop: '0.9rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.75rem', fontSize: '0.86rem', color: '#334155' }}>
                Current: {driver.future_position}
              </div>
            )}
          </section>
        </div>
          </WorkspaceContent>
        </WorkspaceMain>
      </WorkspaceShell>
    </ProtectedRoute>
  );
}
