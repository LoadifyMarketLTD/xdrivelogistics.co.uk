'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../components/ProtectedRoute';
import { useAuth } from '../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';

export default function DriverEntryPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [stats, setStats] = useState({ active: 0, history: 0 });
  const [loadingStats, setLoadingStats] = useState(true);
  const quickActions = [
    {
      label: 'Active Jobs',
      description: 'Open current deliveries',
      emoji: '🚚',
      href: '/driver/jobs?tab=active',
    },
    {
      label: 'History',
      description: 'Review completed jobs',
      emoji: '📋',
      href: '/driver/jobs?tab=history',
    },
    {
      label: 'Earnings',
      description: 'View totals and weekly income',
      emoji: '💷',
      href: '/driver/jobs?tab=earnings',
    },
    {
      label: 'All Jobs',
      description: 'Go to the full jobs view',
      emoji: '📦',
      href: '/driver/jobs',
    },
    {
      label: 'Account Security',
      description: 'Change login password',
      emoji: '🔒',
      href: '/driver/change-password',
    },
  ] as const;

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
      setStats({
        active: activeRes.count ?? 0,
        history: historyRes.count ?? 0,
      });
      setLoadingStats(false);
    };
    loadStats();
  }, [user?.driverId]);

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem 1.5rem',
          backgroundColor: '#0A2239',
          color: '#ffffff',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Driver App</h1>
        <p style={{ marginBottom: '1.5rem', color: '#cbd5e1' }}>
          Signed in as {user?.email}
        </p>
        <div
          style={{
            width: '100%',
            maxWidth: '560px',
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(120px, 1fr))',
            gap: '0.75rem',
            marginBottom: '0.75rem',
          }}
        >
          <div style={{ backgroundColor: '#123556', border: '1px solid #2f4f6f', borderRadius: '12px', padding: '0.75rem', textAlign: 'left' }}>
            <div style={{ fontSize: '0.72rem', color: '#93c5fd' }}>Active</div>
            <div style={{ fontSize: '1.15rem', fontWeight: '700' }}>{loadingStats ? '…' : stats.active}</div>
          </div>
          <div style={{ backgroundColor: '#123556', border: '1px solid #2f4f6f', borderRadius: '12px', padding: '0.75rem', textAlign: 'left' }}>
            <div style={{ fontSize: '0.72rem', color: '#93c5fd' }}>Completed / Closed</div>
            <div style={{ fontSize: '1.15rem', fontWeight: '700' }}>{loadingStats ? '…' : stats.history}</div>
          </div>
        </div>
        <div
          style={{
            width: '100%',
            maxWidth: '560px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '0.75rem',
            marginBottom: '0.75rem',
          }}
        >
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
            width: '100%',
            maxWidth: '280px',
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
