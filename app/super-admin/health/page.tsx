'use client';

import { useCallback, useEffect, useState } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';

const T = {
  pageBg: '#0f172a', cardBg: '#1e293b', surface: '#0b1220', border: '#334155',
  text: '#f1f5f9', muted: '#94a3b8', accent: '#f59e0b', green: '#22c55e', red: '#ef4444', blue: '#3b82f6',
};

type HealthStatus = 'healthy' | 'degraded' | 'error' | 'checking';
type ServiceCheck = { service: string; status: HealthStatus; latencyMs?: number; detail?: string };
type Integration = { service: string; configured: boolean; detail: string };
type InfraPayload = { checkedAt?: string; checks?: ServiceCheck[]; integrations?: Integration[]; error?: string };
type EmailReadinessPayload = { readinessStatus?: 'healthy' | 'degraded' | 'error'; readinessMessage?: string; errors?: string[] };

const colorFor = (status: HealthStatus) => status === 'healthy' ? T.green : status === 'degraded' ? T.accent : status === 'error' ? T.red : T.muted;
const labelFor = (status: HealthStatus) => status === 'healthy' ? '● HEALTHY' : status === 'degraded' ? '● DEGRADED' : status === 'error' ? '● ERROR' : '○ CHECKING…';

function HealthCard({ check }: { check: ServiceCheck }) {
  const color = colorFor(check.status);
  return (
    <div style={{ backgroundColor: T.cardBg, border: `1px solid ${check.status === 'healthy' ? 'rgba(34,197,94,.3)' : color}`, borderRadius: 10, padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.75rem', alignItems: 'center' }}>
        <span style={{ color: T.text, fontWeight: 700, fontSize: '.88rem' }}>{check.service}</span>
        <span style={{ color, fontWeight: 800, fontSize: '.7rem', whiteSpace: 'nowrap' }}>{labelFor(check.status)}</span>
      </div>
      <div style={{ marginTop: '.45rem', display: 'flex', gap: '.75rem', flexWrap: 'wrap' }}>
        {check.latencyMs !== undefined && <span style={{ color: T.muted, fontSize: '.7rem' }}>Latency: <strong style={{ color: check.latencyMs < 500 ? T.green : check.latencyMs < 2000 ? T.accent : T.red }}>{check.latencyMs}ms</strong></span>}
        {check.detail && <span style={{ color: check.status === 'error' ? T.red : check.status === 'degraded' ? T.accent : T.muted, fontSize: '.7rem' }}>{check.detail}</span>}
      </div>
    </div>
  );
}

export default function Page() {
  const [checks, setChecks] = useState<ServiceCheck[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const runChecks = useCallback(async () => {
    setLoading(true);
    setError(null);
    const auth = await getAuthHeader();
    if (!auth) {
      setError('No active owner session.');
      setLoading(false);
      return;
    }

    const apiChecks: Array<{ service: string; url: string }> = [
      { service: 'Stats API', url: '/api/super-admin/stats' },
      { service: 'Operations API', url: '/api/super-admin/operations?section=jobs&limit=1' },
      { service: 'Finance API', url: '/api/super-admin/finance?section=invoices&limit=1' },
      { service: 'Compliance API', url: '/api/super-admin/compliance?section=documents&limit=1' },
      { service: 'Marketplace API', url: '/api/super-admin/marketplace?limit=1' },
      { service: 'Notifications API', url: '/api/super-admin/notifications?limit=1' },
      { service: 'Users API', url: '/api/super-admin/users?limit=1' },
      { service: 'Support API', url: '/api/super-admin/support?section=tickets&limit=1' },
    ];

    const checkApi = async ({ service, url }: { service: string; url: string }): Promise<ServiceCheck> => {
      const start = Date.now();
      try {
        const response = await fetch(url, { headers: { Authorization: auth } });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return { service, status: 'healthy', latencyMs: Date.now() - start, detail: 'Endpoint responded successfully.' };
      } catch (err) {
        return { service, status: 'error', latencyMs: Date.now() - start, detail: err instanceof Error ? err.message : 'Request failed.' };
      }
    };

    try {
      const [infraResponse, emailResponse, ...apiResults] = await Promise.all([
        fetch('/api/super-admin/health', { headers: { Authorization: auth } }),
        fetch('/api/super-admin/email-readiness', { headers: { Authorization: auth } }),
        ...apiChecks.map(checkApi),
      ]);

      const infra = (await infraResponse.json().catch(() => ({}))) as InfraPayload;
      if (!infraResponse.ok) throw new Error(infra.error ?? `Health API HTTP ${infraResponse.status}`);

      const email = (await emailResponse.json().catch(() => ({}))) as EmailReadinessPayload;
      const emailCheck: ServiceCheck = !emailResponse.ok || email.readinessStatus === 'error'
        ? { service: 'Email Delivery', status: 'error', detail: email.errors?.[0] ?? email.readinessMessage ?? `HTTP ${emailResponse.status}` }
        : email.readinessStatus === 'degraded'
          ? { service: 'Email Delivery', status: 'degraded', detail: email.readinessMessage ?? 'Email delivery has warnings.' }
          : { service: 'Email Delivery', status: 'healthy', detail: email.readinessMessage ?? 'Email delivery is operational.' };

      setChecks([...(infra.checks ?? []), emailCheck, ...(apiResults as ServiceCheck[])]);
      setIntegrations(infra.integrations ?? []);
      setCheckedAt(infra.checkedAt ?? new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Platform health could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void runChecks(); }, [runChecks]);

  const healthy = checks.filter((c) => c.status === 'healthy').length;
  const degraded = checks.filter((c) => c.status === 'degraded').length;
  const failed = checks.filter((c) => c.status === 'error').length;
  const overall: HealthStatus = loading ? 'checking' : failed > 0 ? 'error' : degraded > 0 ? 'degraded' : checks.length > 0 ? 'healthy' : 'checking';
  const configuredCount = integrations.filter((i) => i.configured).length;

  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <div style={{ minHeight: '100vh', backgroundColor: T.pageBg, padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.55rem', flexWrap: 'wrap' }}>
              <h1 style={{ color: T.text, fontSize: '1.4rem', margin: 0 }}>Platform Health</h1>
              <span style={{ color: T.accent, background: 'rgba(245,158,11,.12)', padding: '.15rem .5rem', borderRadius: 4, fontSize: '.65rem', fontWeight: 800 }}>PLATFORM</span>
              <span style={{ color: colorFor(overall), fontSize: '.72rem', fontWeight: 800 }}>{labelFor(overall)}</span>
            </div>
            <p style={{ color: T.muted, margin: '.3rem 0 0', fontSize: '.84rem' }}>Live internal service checks plus integration configuration readiness. Credentials are never exposed.</p>
            {checkedAt && <p style={{ color: '#64748b', margin: '.2rem 0 0', fontSize: '.7rem' }}>Last checked: {new Date(checkedAt).toLocaleString('en-GB')}</p>}
          </div>
          <button onClick={() => void runChecks()} disabled={loading} style={{ border: 0, borderRadius: 8, backgroundColor: T.accent, color: '#0f172a', padding: '.48rem 1rem', fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .65 : 1 }}>↻ Re-check</button>
        </div>

        {error && <div style={{ border: `1px solid ${T.red}`, background: 'rgba(239,68,68,.08)', color: T.red, borderRadius: 8, padding: '.7rem .9rem', marginBottom: '1rem', fontSize: '.8rem' }}>⚠ {error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '.65rem', marginBottom: '1.25rem' }}>
          {[
            ['Healthy', healthy, T.green], ['Degraded', degraded, T.accent], ['Errors', failed, T.red], ['Checks', checks.length, T.text], ['Integrations Ready', `${configuredCount}/${integrations.length}`, T.blue],
          ].map(([label, value, color]) => <div key={String(label)} style={{ backgroundColor: T.surface, border: `1px solid ${T.border}`, borderRadius: 9, padding: '.75rem' }}><div style={{ color: String(color), fontSize: '1.2rem', fontWeight: 900 }}>{value}</div><div style={{ color: T.muted, fontSize: '.66rem', textTransform: 'uppercase', marginTop: '.15rem' }}>{label}</div></div>)}
        </div>

        <h2 style={{ color: T.text, fontSize: '.95rem', margin: '0 0 .7rem' }}>Live Service Health</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '.75rem', marginBottom: '1.4rem' }}>
          {loading && checks.length === 0 ? Array.from({ length: 8 }).map((_, i) => <div key={i} style={{ backgroundColor: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 10, padding: '1rem', color: T.muted }}>Checking…</div>) : checks.map((check) => <HealthCard key={check.service} check={check} />)}
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '.75rem', flexWrap: 'wrap', marginBottom: '.7rem' }}>
          <h2 style={{ color: T.text, fontSize: '.95rem', margin: 0 }}>Integration Readiness</h2>
          <span style={{ color: T.muted, fontSize: '.68rem' }}>Configured ≠ external service uptime; this section checks deployment readiness only.</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: '.75rem' }}>
          {integrations.map((integration) => (
            <div key={integration.service} style={{ backgroundColor: T.cardBg, border: `1px solid ${integration.configured ? 'rgba(34,197,94,.3)' : T.accent}`, borderRadius: 10, padding: '.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.5rem' }}>
                <span style={{ color: T.text, fontWeight: 700, fontSize: '.84rem' }}>{integration.service}</span>
                <span style={{ color: integration.configured ? T.green : T.accent, fontSize: '.68rem', fontWeight: 800 }}>{integration.configured ? '● CONFIGURED' : '● ACTION NEEDED'}</span>
              </div>
              <div style={{ color: T.muted, fontSize: '.7rem', marginTop: '.4rem' }}>{integration.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </ProtectedRoute>
  );
}
