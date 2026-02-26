'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import type { DbJob } from '../../../lib/types/database';

type Tab = 'active' | 'history' | 'earnings';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Received',
  posted: 'Posted',
  allocated: 'Allocated',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  disputed: 'Disputed',
};

const STATUS_COLOR: Record<string, string> = {
  allocated: '#1d4ed8',
  in_transit: '#d97706',
  delivered: '#15803d',
  cancelled: '#dc2626',
  posted: '#6d28d9',
};

export default function DriverJobsPage() {
  const router = useRouter();
  const [driverName, setDriverName] = useState('');
  const [driverId, setDriverId] = useState('');
  const [tab, setTab] = useState<Tab>('active');
  const [jobs, setJobs] = useState<DbJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = sessionStorage.getItem('driver_id') ?? '';
    const name = sessionStorage.getItem('driver_name') ?? '';
    if (!id) {
      router.replace('/driver');
      return;
    }
    setDriverId(id);
    setDriverName(name);
  }, [router]);

  const loadJobs = useCallback(async () => {
    if (!driverId || !isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const activeStatuses = ['allocated', 'in_transit'];
    const historyStatuses = ['delivered', 'cancelled', 'disputed'];

    const statuses = tab === 'active' ? activeStatuses : historyStatuses;
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('assigned_driver_id', driverId)
      .in('status', statuses)
      .order('updated_at', { ascending: false });

    if (!error && data) setJobs(data as DbJob[]);
    setLoading(false);
  }, [driverId, tab]);

  useEffect(() => {
    if (driverId) loadJobs();
  }, [driverId, tab, loadJobs]);

  const handleLogout = () => {
    sessionStorage.removeItem('driver_id');
    sessionStorage.removeItem('driver_name');
    router.push('/driver');
  };

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: '#f3f4f6' }}>
      {/* Header */}
      <header
        style={{
          backgroundColor: '#0A2239',
          padding: '1rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div>
          <p style={{ color: '#93c5fd', fontSize: '0.75rem', margin: 0 }}>Welcome back</p>
          <h1 style={{ color: '#ffffff', fontSize: '1.1rem', fontWeight: '700', margin: 0 }}>
            {driverName || 'Driver'}
          </h1>
        </div>
        <button
          onClick={handleLogout}
          style={{
            backgroundColor: 'transparent',
            border: '1px solid #3b5c7c',
            color: '#93c5fd',
            borderRadius: '8px',
            padding: '0.4rem 0.75rem',
            fontSize: '0.8rem',
            cursor: 'pointer',
          }}
        >
          Logout
        </button>
      </header>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        {(['active', 'history', 'earnings'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: '0.85rem 0',
              fontSize: '0.875rem',
              fontWeight: tab === t ? '700' : '400',
              color: tab === t ? '#0A2239' : '#6b7280',
              background: 'none',
              border: 'none',
              borderBottom: tab === t ? '2px solid #0A2239' : '2px solid transparent',
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {t === 'active' ? 'Active Jobs' : t === 'history' ? 'History' : 'Earnings'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: '1rem' }}>
        {tab === 'earnings' ? (
          <EarningsPanel driverId={driverId} />
        ) : loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
            Loading…
          </div>
        ) : jobs.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>
              {tab === 'active' ? '✅' : '📋'}
            </div>
            <p style={{ margin: 0, fontSize: '0.95rem' }}>
              {tab === 'active' ? 'No active jobs right now.' : 'No completed jobs yet.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {jobs.map(job => (
              <JobCard key={job.id} job={job} onClick={() => router.push(`/driver/jobs/${job.id}`)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function JobCard({ job, onClick }: { job: DbJob; onClick: () => void }) {
  const color = STATUS_COLOR[job.status] ?? '#374151';
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        backgroundColor: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        padding: '1rem',
        cursor: 'pointer',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6b7280' }}>
          #{job.id.slice(0, 8).toUpperCase()}
        </span>
        <span
          style={{
            fontSize: '0.7rem',
            fontWeight: '700',
            color,
            backgroundColor: color + '1a',
            padding: '0.2rem 0.6rem',
            borderRadius: '20px',
            textTransform: 'uppercase',
          }}
        >
          {STATUS_LABEL[job.status] ?? job.status}
        </span>
      </div>
      <div style={{ fontSize: '0.9rem', color: '#1f2937', marginBottom: '0.25rem' }}>
        <span style={{ fontWeight: '600' }}>📦 </span>
        {job.pickup_location ?? 'Collection TBC'}
      </div>
      <div style={{ fontSize: '0.9rem', color: '#1f2937' }}>
        <span style={{ fontWeight: '600' }}>📍 </span>
        {job.delivery_location ?? 'Delivery TBC'}
      </div>
      {job.budget_amount != null && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#15803d', fontWeight: '700' }}>
          £{job.budget_amount.toFixed(2)}
        </div>
      )}
    </button>
  );
}

function EarningsPanel({ driverId }: { driverId: string }) {
  const [data, setData] = useState<{ total: number; count: number; week: number }>({
    total: 0,
    count: 0,
    week: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!driverId || !isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data: jobs } = await supabase
        .from('jobs')
        .select('budget_amount, updated_at')
        .eq('assigned_driver_id', driverId)
        .eq('status', 'delivered');

      if (jobs) {
        const total = jobs.reduce((s, j) => s + (j.budget_amount ?? 0), 0);
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const week = jobs
          .filter(j => j.updated_at >= oneWeekAgo)
          .reduce((s, j) => s + (j.budget_amount ?? 0), 0);
        setData({ total, count: jobs.length, week });
      }
      setLoading(false);
    })();
  }, [driverId]);

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Loading…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {[
        { label: 'Total Earned', value: `£${data.total.toFixed(2)}`, icon: '💷' },
        { label: 'This Week', value: `£${data.week.toFixed(2)}`, icon: '📅' },
        { label: 'Jobs Completed', value: String(data.count), icon: '✅' },
      ].map(card => (
        <div
          key={card.label}
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            padding: '1.25rem',
            border: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <span style={{ fontSize: '2rem' }}>{card.icon}</span>
          <div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#6b7280' }}>{card.label}</p>
            <p style={{ margin: 0, fontSize: '1.4rem', fontWeight: '700', color: '#0A2239' }}>
              {card.value}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
