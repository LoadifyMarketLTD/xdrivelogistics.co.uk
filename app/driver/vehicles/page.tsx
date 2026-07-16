'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { VEHICLE_TYPE_LABELS } from '../../../lib/vehicleTypes';

type VehicleRow = {
  id: string;
  type: string | null;
  reg_plate: string | null;
  make: string | null;
  model: string | null;
  payload_kg: number | null;
  has_tail_lift: boolean | null;
};

const card: CSSProperties = {
  backgroundColor: '#FFFFFF',
  border: '1px solid rgba(11, 47, 107, 0.16)',
  borderRadius: '12px',
  padding: '1rem',
  boxShadow: '0 2px 8px rgba(26, 31, 43, 0.06)',
};

export default function DriverVehiclesPage() {
  const { user } = useAuth();
  const driverId = user?.driverId ?? null;

  const [vehicle, setVehicle] = useState<VehicleRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadVehicle = useCallback(async () => {
    if (!driverId || !isSupabaseConfigured) {
      setVehicle(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    const { data, error: queryError } = await supabase
      .from('vehicles')
      .select('id, type, reg_plate, make, model, payload_kg, has_tail_lift')
      .eq('assigned_driver_id', driverId)
      .maybeSingle();

    if (queryError) {
      setError(`Unable to load your assigned vehicle: ${queryError.message}`);
      setVehicle(null);
    } else {
      setVehicle((data as VehicleRow | null) ?? null);
    }
    setLoading(false);
  }, [driverId]);

  useEffect(() => {
    void loadVehicle();
  }, [loadVehicle]);

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell subtitle="Assigned vehicle summary and upcoming self-service vehicle tools.">
        <div style={{ display: 'grid', gap: '1rem', maxWidth: '920px' }}>
          {error && (
            <div style={{ backgroundColor: '#F4F6F8', border: '1px solid rgba(11, 47, 107, 0.16)', color: '#1A1F2B', borderRadius: '8px', padding: '0.75rem', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
            <div style={card}>
              <div style={{ fontSize: '0.76rem', color: '#0B2F6B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>Vehicle workspace</div>
              <h1 style={{ margin: 0, fontSize: '1.35rem', color: '#1A1F2B' }}>Vehicles</h1>
              <p style={{ margin: '0.55rem 0 0', color: '#0B2F6B', lineHeight: 1.6, fontSize: '0.9rem' }}>
                Dispatcher-managed vehicle assignment is shown here. Driver-side create or edit tools are intentionally disabled until the backend workflow is ready.
              </p>
            </div>

            <div style={card}>
              <div style={{ fontWeight: 700, color: '#1A1F2B', marginBottom: '0.35rem' }}>What&apos;s coming next</div>
              <ul style={{ margin: 0, paddingLeft: '1rem', color: '#0B2F6B', fontSize: '0.86rem', lineHeight: 1.7 }}>
                <li>Assigned vehicle history</li>
                <li>Compliance reminders linked to your current vehicle</li>
                <li>Read-only checks before document expiry</li>
              </ul>
            </div>
          </div>

          <div style={card}>
            <div style={{ fontSize: '0.76rem', color: '#0B2F6B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.8rem' }}>Current assignment</div>
            {loading ? (
              <div style={{ color: '#0B2F6B', fontSize: '0.9rem' }}>Loading assigned vehicle…</div>
            ) : vehicle ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                {[
                  { label: 'Registration', value: vehicle.reg_plate ?? 'Not set' },
                  { label: 'Vehicle type', value: VEHICLE_TYPE_LABELS[vehicle.type ?? ''] ?? vehicle.type ?? 'Not set' },
                  { label: 'Make / model', value: [vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'Not set' },
                  { label: 'Payload', value: vehicle.payload_kg ? `${vehicle.payload_kg} kg` : 'Not set' },
                  { label: 'Tail lift', value: vehicle.has_tail_lift ? 'Yes' : 'No' },
                ].map((item) => (
                  <div key={item.label} style={{ backgroundColor: '#F4F6F8', borderRadius: '8px', padding: '0.85rem' }}>
                    <div style={{ fontSize: '0.72rem', color: '#0B2F6B', marginBottom: '0.15rem' }}>{item.label}</div>
                    <div style={{ fontWeight: 700, color: '#1A1F2B', fontSize: '0.88rem' }}>{item.value}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ border: '1px dashed #F4F6F8', borderRadius: '10px', padding: '1rem', textAlign: 'center', backgroundColor: '#F4F6F8' }}>
                <div style={{ fontWeight: 700, color: '#1A1F2B', marginBottom: '0.25rem' }}>No vehicle assigned yet</div>
                <div style={{ color: '#0B2F6B', fontSize: '0.85rem', lineHeight: 1.6 }}>
                  Your dispatcher still manages assignment. Once a vehicle is linked to your driver record, the summary will appear here automatically.
                </div>
              </div>
            )}
          </div>
        </div>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
