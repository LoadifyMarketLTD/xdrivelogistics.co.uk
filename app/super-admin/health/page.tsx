'use client';

import { useCallback, useEffect, useState } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { supabase } from '@/lib/supabaseClient';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';

const THEME = {
  pageBg: 'var(--background)',
  cardBg: 'var(--xd-surface)',
  cardBorder: 'var(--xd-border)',
  text: 'var(--xd-text)',
  muted: 'var(--xd-text-muted)',
  accent: 'var(--xd-gold)',
  green: 'var(--xd-green)',
  red: 'var(--xd-red)',
};

type HealthCheck = {
  service: string;
  status: 'ok' | 'degraded' | 'error' | 'checking';
  latencyMs?: number;
  detail?: string;
};

const statusColor = (s: HealthCheck['status']): string => {
  if (s === 'ok') return THEME.green;
  if (s === 'degraded') return THEME.accent;
  if (s === 'error') return THEME.red;
  return THEME.muted;
};

const statusLabel = (s: HealthCheck['status']): string => {
  if (s === 'ok') return '● HEALTHY';
  if (s === 'degraded') return '● DEGRADED';
  if (s === 'error') return '● ERROR';
  return '○ CHECKING…';
};

export default function Page() {
  const [checks, setChecks] = useState<HealthCheck[]>([
    { service: 'Supabase Database', status: 'checking' },
    { service: 'Auth Service', status: 'checking' },
    { service: 'Stats API', status: 'checking' },
    { service: 'Operations API', status: 'checking' },
    { service: 'Finance API', status: 'checking' },
    { service: 'Compliance API', status: 'checking' },
    { service: 'Email Readiness', status: 'checking' },
  ]);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  const runChecks = useCallback(async () => {
    setCheckedAt(null);
    setChecks((prev) => prev.map((c) => ({ ...c, status: 'checking' as const })));

    const auth = await getAuthHeader();

    const runCheck = async (
      service: string,
      checkFn: () => Promise<void>,
    ): Promise<HealthCheck> => {
      const start = Date.now();
      try {
        await checkFn();
        return { service, status: 'ok', latencyMs: Date.now() - start };
      } catch (err) {
        return { service, status: 'error', latencyMs: Date.now() - start, detail: err instanceof Error ? err.message : 'Unknown error' };
      }
    };

    const results = await Promise.allSettled([
      runCheck('Supabase Database', async () => {
        const { error } = await supabase.from('companies').select('id', { count: 'exact', head: true });
        if (error) throw new Error(error.message);
      }),
      runCheck('Auth Service', async () => {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw new Error(error.message);
        if (!data.session) throw new Error('No active session');
      }),
      ...(auth ? [
        runCheck('Stats API', async () => {
          const res = await fetch('/api/super-admin/stats', { headers: { Authorization: auth } });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
        }),
        runCheck('Operations API', async () => {
          const res = await fetch('/api/super-admin/operations?section=jobs&limit=1', { headers: { Authorization: auth } });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
        }),
        runCheck('Finance API', async () => {
          const res = await fetch('/api/super-admin/finance?section=invoices&limit=1', { headers: { Authorization: auth } });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
        }),
        runCheck('Compliance API', async () => {
          const res = await fetch('/api/super-admin/compliance?section=documents&limit=1', { headers: { Authorization: auth } });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
        }),
        runCheck('Email Readiness', async () => {
          const res = await fetch('/api/super-admin/email-readiness', { headers: { Authorization: auth } });
          const payload = await res.json().catch(() => null) as {
            notificationEvents?: { pending?: number; failed?: number };
            databaseWiring?: { projectRefConfigured?: boolean; serviceRoleKeyConfiguredForTrigger?: boolean };
            errors?: string[];
          } | null;
          if (!res.ok) throw new Error(payload?.errors?.[0] ?? 'HTTP ' + res.status);
          const pending = payload?.notificationEvents?.pending ?? 0;
          const failed = payload?.notificationEvents?.failed ?? 0;
          const triggerConfigReady = payload?.databaseWiring?.projectRefConfigured === true && payload?.databaseWiring?.serviceRoleKeyConfiguredForTrigger === true;
          if (pending > 0 || failed > 0 || !triggerConfigReady) {
            throw new Error('Email queue not ready: pending=' + pending + ', failed=' + failed + ', triggerConfig=' + (triggerConfigReady ? 'yes' : 'no'));
          }
        }),
      ] : [
        Promise.resolve({ service: 'Stats API', status: 'error' as const, detail: 'No session' }),
        Promise.resolve({ service: 'Operations API', status: 'error' as const, detail: 'No session' }),
        Promise.resolve({ service: 'Finance API', status: 'error' as const, detail: 'No session' }),
        Promise.resolve({ service: 'Compliance API', status: 'error' as const, detail: 'No session' }),
        Promise.resolve({ service: 'Email Readiness', status: 'error' as const, detail: 'No session' }),
      ]),
    ]);

    const resolved: HealthCheck[] = results.map((r) =>
      r.status === 'fulfilled' ? r.value : { service: 'Unknown', status: 'error' as const },
    );

    setChecks(resolved);
    setCheckedAt(new Date().toLocaleString('en-GB'));
  }, []);

  useEffect(() => { void runChecks(); }, [runChecks]);

  const allOk = checks.every((c) => c.status === 'ok');
  const hasError = checks.some((c) => c.status === 'error');
  const overallStatus = allOk ? 'ok' : hasError ? 'error' : 'degraded';

  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <div style={{ minHeight: '100vh', backgroundColor: THEME.pageBg, padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '1.5rem' }}>🩺</span>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: THEME.text, margin: 0 }}>Platform Health</h1>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: THEME.accent, backgroundColor: 'rgba(245, 163, 0, 0.12)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>Platform</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: statusColor(overallStatus), marginLeft: '0.5rem' }}>
                {statusLabel(overallStatus)}
              </span>
            </div>
            <p style={{ color: THEME.muted, margin: '0.25rem 0 0', fontSize: '0.85rem' }}>Real-time health status for all platform APIs and services.</p>
          </div>
          <button
            onClick={() => void runChecks()}
            style={{ padding: '0.45rem 1rem', backgroundColor: THEME.accent, color: '#1A1F2B', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}
          >
            🔄 Re-check
          </button>
        </div>

        {checkedAt && (
          <div style={{ color: THEME.muted, fontSize: '0.75rem', marginBottom: '1rem' }}>
            Last checked: {checkedAt}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
          {checks.map((check) => (
            <div
              key={check.service}
              style={{
                backgroundColor: THEME.cardBg,
                border: `1px solid ${check.status === 'error' ? THEME.red : check.status === 'ok' ? 'rgba(29, 87, 216, 0.3)' : THEME.cardBorder}`,
                borderRadius: '10px',
                padding: '1rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={{ color: THEME.text, fontWeight: 700, fontSize: '0.88rem' }}>{check.service}</span>
                <span style={{ color: statusColor(check.status), fontSize: '0.72rem', fontWeight: 700 }}>
                  {statusLabel(check.status)}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                {check.latencyMs !== undefined && (
                  <span style={{ color: THEME.muted, fontSize: '0.72rem' }}>
                    Latency: <span style={{ color: check.latencyMs < 500 ? THEME.green : check.latencyMs < 2000 ? THEME.accent : THEME.red, fontWeight: 600 }}>{check.latencyMs}ms</span>
                  </span>
                )}
                {check.detail && (
                  <span style={{ color: THEME.red, fontSize: '0.7rem' }}>{check.detail}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </ProtectedRoute>
  );
}
