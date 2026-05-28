'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../components/ProtectedRoute';
import { useAuth } from '../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';

type AvailabilityStatus = 'available' | 'busy' | 'offline';

const AVAILABILITY_OPTIONS: { value: AvailabilityStatus; label: string; color: string; bg: string }[] = [
  { value: 'available', label: '🟢 Available', color: '#15803d', bg: '#f0fdf4' },
  { value: 'busy',      label: '🟡 On a Job',  color: '#b45309', bg: '#fffbeb' },
  { value: 'offline',   label: '🔴 Offline',   color: '#dc2626', bg: '#fef2f2' },
];

const VEHICLE_TYPE_LABEL: Record<string, string> = {
  bicycle: 'Bicycle', motorbike: 'Motorbike', car: 'Car',
  van_small: 'Small Van', van_large: 'Large Van', luton: 'Luton Van',
  truck_7_5t: '7.5t Truck', truck_18t: '18t Truck', artic: 'Artic',
};

export default function DriverEntryPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [stats, setStats] = useState({ active: 0, history: 0 });
  const [loadingStats, setLoadingStats] = useState(true);
  const [driverPhone, setDriverPhone] = useState('');
  const [vehicle, setVehicle] = useState<{ type: string; reg_plate: string | null } | null>(null);
  const [availability, setAvailability] = useState<AvailabilityStatus>('available');
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

  const quickActions = [
    { label: 'Active Jobs',     description: 'Open current deliveries',    emoji: '🚚', href: '/driver/jobs?tab=active' },
    { label: 'History',         description: 'Review completed jobs',       emoji: '📋', href: '/driver/jobs?tab=history' },
    { label: 'Earnings',        description: 'View totals and weekly income', emoji: '💷', href: '/driver/jobs?tab=earnings' },
    { label: 'All Jobs',        description: 'Go to the full jobs view',    emoji: '📦', href: '/driver/jobs' },
    { label: 'Account Security', description: 'Change login password',      emoji: '🔒', href: '/driver/change-password' },
  ] as const;

  const loadDriverProfile = useCallback(async () => {
    if (!user?.driverId || !isSupabaseConfigured) return;
    const { data: driver } = await supabase
      .from('drivers')
      .select('phone, status')
      .eq('id', user.driverId)
      .maybeSingle();
    if (driver) {
      if (driver.phone) setDriverPhone(driver.phone as string);
      const s = driver.status as string;
      if (s === 'available' || s === 'busy' || s === 'offline') setAvailability(s);
    }
    const { data: veh } = await supabase
      .from('vehicles')
      .select('type, reg_plate')
      .eq('assigned_driver_id', user.driverId)
      .maybeSingle();
    if (veh) setVehicle({ type: veh.type as string, reg_plate: veh.reg_plate as string | null });
  }, [user?.driverId]);

  useEffect(() => {
    if (!user?.driverId || !isSupabaseConfigured) {
      setLoadingStats(false);
      return;
    }
    const loadStats = async () => {
      const [activeRes, historyRes] = await Promise.all([
        supabase
          .from('jobs')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_driver_id', user.driverId)
          .in('status', ['allocated', 'in_transit']),
        supabase
          .from('jobs')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_driver_id', user.driverId)
          .in('status', ['delivered', 'cancelled', 'disputed']),
      ]);
      setStats({ active: activeRes.count ?? 0, history: historyRes.count ?? 0 });
      setLoadingStats(false);
    };
    loadStats();
    loadDriverProfile();
  }, [user?.driverId, loadDriverProfile]);

  const handleAvailabilityChange = async (next: AvailabilityStatus) => {
    if (!user?.driverId || !isSupabaseConfigured || availabilityLoading) return;
    setAvailabilityLoading(true);
    setAvailability(next);
    await supabase.from('drivers').update({ status: next }).eq('id', user.driverId);
    setAvailabilityLoading(false);
  };

  const currentAvail = AVAILABILITY_OPTIONS.find(o => o.value === availability) ?? AVAILABILITY_OPTIONS[0];

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          padding: '2rem 1.5rem 3rem',
          backgroundColor: '#0A2239',
          color: '#ffffff',
        }}
      >
        {/* Profile card */}
        <div style={{
          width: '100%', maxWidth: '560px',
          backgroundColor: '#0f2f4f',
          border: '1px solid #2f4f6f',
          borderRadius: '14px',
          padding: '1rem 1.25rem',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
        }}>
          <div style={{ fontSize: '2.2rem' }}>👤</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '1.1rem', fontWeight: '700' }}>{user?.email?.split('@')[0] ?? 'Driver'}</div>
            <div style={{ fontSize: '0.8rem', color: '#93c5fd', marginTop: '0.1rem' }}>{user?.email}</div>
            {driverPhone && <div style={{ fontSize: '0.8rem', color: '#93c5fd' }}>📞 {driverPhone}</div>}
            {vehicle && (
              <div style={{ fontSize: '0.8rem', color: '#7dd3fc', marginTop: '0.15rem' }}>
                🚐 {VEHICLE_TYPE_LABEL[vehicle.type] ?? vehicle.type}{vehicle.reg_plate ? ` · ${vehicle.reg_plate}` : ''}
              </div>
            )}
          </div>
        </div>

        {/* Availability toggle */}
        <div style={{ width: '100%', maxWidth: '560px', marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#93c5fd', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            My Availability
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {AVAILABILITY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleAvailabilityChange(opt.value)}
                disabled={availabilityLoading}
                style={{
                  flex: 1,
                  padding: '0.6rem 0.4rem',
                  borderRadius: '10px',
                  border: availability === opt.value ? `2px solid ${opt.color}` : '2px solid transparent',
                  backgroundColor: availability === opt.value ? opt.bg : '#123556',
                  color: availability === opt.value ? opt.color : '#93c5fd',
                  fontSize: '0.78rem',
                  fontWeight: availability === opt.value ? '700' : '400',
                  cursor: availabilityLoading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: '0.72rem', color: currentAvail.color, marginTop: '0.35rem' }}>
            Status visible to your dispatcher
          </div>
        </div>

        {/* Stats */}
        <div style={{
          width: '100%', maxWidth: '560px',
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(120px, 1fr))',
          gap: '0.75rem',
          marginBottom: '0.75rem',
        }}>
          <div style={{ backgroundColor: '#123556', border: '1px solid #2f4f6f', borderRadius: '12px', padding: '0.75rem' }}>
            <div style={{ fontSize: '0.72rem', color: '#93c5fd' }}>Active</div>
            <div style={{ fontSize: '1.15rem', fontWeight: '700' }}>{loadingStats ? '…' : stats.active}</div>
          </div>
          <div style={{ backgroundColor: '#123556', border: '1px solid #2f4f6f', borderRadius: '12px', padding: '0.75rem' }}>
            <div style={{ fontSize: '0.72rem', color: '#93c5fd' }}>Completed / Closed</div>
            <div style={{ fontSize: '1.15rem', fontWeight: '700' }}>{loadingStats ? '…' : stats.history}</div>
          </div>
        </div>

        {/* Quick actions */}
        <div style={{
          width: '100%', maxWidth: '560px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '0.75rem',
          marginBottom: '0.75rem',
        }}>
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => router.push(action.href)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '0.9rem 1rem',
                backgroundColor: '#0f2f4f',
                color: '#ffffff',
                border: '1px solid #2f4f6f',
                borderRadius: '12px',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.2rem' }}>
                {action.emoji} {action.label}
              </div>
              <div style={{ fontSize: '0.82rem', color: '#bfdbfe' }}>{action.description}</div>
            </button>
          ))}
        </div>

        <button
          onClick={logout}
          style={{
            width: '100%', maxWidth: '280px',
            padding: '0.9rem',
            backgroundColor: 'transparent',
            color: '#93c5fd',
            border: '1px solid #3b5c7c',
            borderRadius: '12px',
            fontSize: '0.95rem',
            cursor: 'pointer',
          }}
        >
          Logout
        </button>
      </div>
    </ProtectedRoute>
  );
}
