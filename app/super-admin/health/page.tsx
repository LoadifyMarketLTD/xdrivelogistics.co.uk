'use client';

import { useCallback, useEffect, useState } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';

const X = {
  navy: '#0B2F6B',
  blue: '#1D57D8',
  orange: '#F5A300',
  white: '#FFFFFF',
  charcoal: '#1A1F2B',
  light: '#F4F6F8',
  border: '#D9E1EA',
  muted: '#64748B',
  green: '#16A34A',
  red: '#DC2626',
} as const;

type HealthStatus = 'healthy' | 'degraded' | 'error' | 'checking';
type ServiceCheck = { service: string; status: HealthStatus; latencyMs?: number; detail?: string };
type Integration = { service: string; configured: boolean; detail: string };
type InfraPayload = { checkedAt?: string; checks?: ServiceCheck[]; integrations?: Integration[]; error?: string };
type EmailReadinessPayload = { readinessStatus?: 'healthy' | 'degraded' | 'error'; readinessMessage?: string; errors?: string[] };
type GovernanceRowsPayload = { rows?: Array<Record<string, unknown>> };

const REQUEST_TIMEOUT_MS = 15_000;
const colorFor = (status: HealthStatus) => status === 'healthy' ? X.green : status === 'degraded' ? X.orange : status === 'error' ? X.red : X.muted;
const labelFor = (status: HealthStatus) => status === 'healthy' ? 'Healthy' : status === 'degraded' ? 'Degraded' : status === 'error' ? 'Error' : 'Checking';

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

function HealthCard({ check }: { check: ServiceCheck }) {
  const color = colorFor(check.status);
  return (
    <div style={{ background: X.white, border: `1px solid ${X.border}`, borderTop: `3px solid ${color}`, borderRadius: '4px', padding: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
        <span style={{ color: X.navy, fontWeight: 800, fontSize: '12px' }}>{check.service}</span>
        <span style={{ color, fontWeight: 800, fontSize: '10px', textTransform: 'uppercase' }}>{labelFor(check.status)}</span>
      </div>
      <div style={{ marginTop: '6px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {check.latencyMs !== undefined && <span style={{ color: X.muted, fontSize: '10px' }}>Latency: <strong style={{ color: check.latencyMs < 500 ? X.green : check.latencyMs < 2000 ? X.orange : X.red }}>{check.latencyMs}ms</strong></span>}
        {check.detail && <span style={{ color: X.muted, fontSize: '10px' }}>{check.detail}</span>}
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
    setChecks([]);
    setIntegrations([]);
    setCheckedAt(null);

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
      { service: 'Governance API', url: '/api/super-admin/governance?section=memberships&limit=1' },
    ];

    const checkApi = async ({ service, url }: { service: string; url: string }): Promise<ServiceCheck> => {
      const start = Date.now();
      try {
        const response = await fetchWithTimeout(url, { headers: { Authorization: auth } });
        if (!response.ok) return { service, status: 'error', latencyMs: Date.now() - start, detail: 'Endpoint unavailable.' };
        return { service, status: 'healthy', latencyMs: Date.now() - start, detail: 'Endpoint responded successfully.' };
      } catch {
        return { service, status: 'error', latencyMs: Date.now() - start, detail: 'Endpoint unavailable or timed out.' };
      }
    };

    const checkBillingGovernance = async (): Promise<ServiceCheck> => {
      const start = Date.now();
      try {
        const response = await fetchWithTimeout('/api/super-admin/governance?section=subscriptions&limit=100', { headers: { Authorization: auth } });
        const body = await response.json().catch(() => ({})) as GovernanceRowsPayload;
        if (!response.ok || !Array.isArray(body.rows)) return { service: 'Membership Billing', status: 'error', latencyMs: Date.now() - start, detail: 'Subscription state unavailable.' };
        const problemStatuses = new Set(['past_due', 'unpaid', 'incomplete', 'incomplete_expired']);
        const affected = body.rows.filter((row) => problemStatuses.has(String(row.status ?? '').toLowerCase())).length;
        return affected > 0
          ? { service: 'Membership Billing', status: 'degraded', latencyMs: Date.now() - start, detail: `${affected} subscription(s) require billing attention.` }
          : { service: 'Membership Billing', status: 'healthy', latencyMs: Date.now() - start, detail: `${body.rows.length} recent subscription record(s) checked.` };
      } catch {
        return { service: 'Membership Billing', status: 'error', latencyMs: Date.now() - start, detail: 'Subscription state unavailable or timed out.' };
      }
    };

    const checkStripeWebhooks = async (): Promise<ServiceCheck> => {
      const start = Date.now();
      try {
        const response = await fetchWithTimeout('/api/super-admin/governance?section=stripe-webhooks&limit=100', { headers: { Authorization: auth } });
        const body = await response.json().catch(() => ({})) as GovernanceRowsPayload;
        if (!response.ok || !Array.isArray(body.rows)) return { service: 'Stripe Webhook Processing', status: 'error', latencyMs: Date.now() - start, detail: 'Webhook processing state unavailable.' };
        const failed = body.rows.filter((row) => ['failed', 'error'].includes(String(row.processing_status ?? '').toLowerCase())).length;
        return failed > 0
          ? { service: 'Stripe Webhook Processing', status: 'degraded', latencyMs: Date.now() - start, detail: `${failed} webhook event(s) failed processing.` }
          : { service: 'Stripe Webhook Processing', status: 'healthy', latencyMs: Date.now() - start, detail: `${body.rows.length} recent webhook event(s) checked.` };
      } catch {
        return { service: 'Stripe Webhook Processing', status: 'error', latencyMs: Date.now() - start, detail: 'Webhook processing state unavailable or timed out.' };
      }
    };

    try {
      const [infraResponse, emailResponse, billingCheck, webhookCheck, ...apiResults] = await Promise.all([
        fetchWithTimeout('/api/super-admin/health', { headers: { Authorization: auth } }),
        fetchWithTimeout('/api/super-admin/email-readiness', { headers: { Authorization: auth } }),
        checkBillingGovernance(),
        checkStripeWebhooks(),
        ...apiChecks.map(checkApi),
      ]);

      const infra = (await infraResponse.json().catch(() => ({}))) as InfraPayload;
      if (!infraResponse.ok) throw new Error('Platform health service is currently unavailable.');

      const email = (await emailResponse.json().catch(() => ({}))) as EmailReadinessPayload;
      const emailCheck: ServiceCheck = !emailResponse.ok || email.readinessStatus === 'error'
        ? { service: 'Email Delivery', status: 'error', detail: 'Email delivery readiness check failed.' }
        : email.readinessStatus === 'degraded'
          ? { service: 'Email Delivery', status: 'degraded', detail: email.readinessMessage ?? 'Email delivery has warnings.' }
          : { service: 'Email Delivery', status: 'healthy', detail: email.readinessMessage ?? 'Email delivery is operational.' };

      if (!Array.isArray(infra.checks) || !Array.isArray(infra.integrations)) {
        throw new Error('Platform health service returned an invalid contract.');
      }

      setChecks([...infra.checks, emailCheck, billingCheck as ServiceCheck, webhookCheck as ServiceCheck, ...(apiResults as ServiceCheck[])]);
      setIntegrations(infra.integrations);
      setCheckedAt(infra.checkedAt ?? new Date().toISOString());
    } catch {
      setError('Platform health service is currently unavailable.');
      setChecks([]);
      setIntegrations([]);
      setCheckedAt(null);
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
      <div style={{ minHeight: '100vh', background: X.light, color: X.charcoal, padding: '12px' }}>
        <header style={{ minHeight: '52px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h1 style={{ color: X.navy, fontSize: '20px', margin: 0, fontWeight: 800 }}>Platform Health</h1>
              <span style={{ color: X.blue, background: '#EEF4FF', padding: '3px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' }}>Platform</span>
              <span style={{ color: colorFor(overall), fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' }}>{labelFor(overall)}</span>
            </div>
            <p style={{ color: X.muted, margin: '4px 0 0', fontSize: '12px' }}>Live internal service checks, billing/webhook processing signals and integration readiness.</p>
            {checkedAt && <p style={{ color: X.muted, margin: '3px 0 0', fontSize: '10px' }}>Last checked: {new Date(checkedAt).toLocaleString('en-GB')}</p>}
          </div>
          <button onClick={() => void runChecks()} disabled={loading} style={{ height: '32px', border: `1px solid ${X.blue}`, borderRadius: '4px', background: X.blue, color: X.white, padding: '0 10px', fontWeight: 800, fontSize: '11px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .65 : 1 }}>Re-check</button>
        </header>

        {error && <div role="alert" style={{ border: `1px solid ${X.red}`, borderLeft: `4px solid ${X.red}`, background: X.white, color: X.red, borderRadius: '4px', padding: '9px 12px', marginBottom: '12px', fontSize: '11px', fontWeight: 700 }}>{error}</div>}

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '12px', marginBottom: '12px' }}>
          {[
            ['Healthy', healthy, X.green],
            ['Degraded', degraded, X.orange],
            ['Errors', failed, X.red],
            ['Checks', checks.length, X.navy],
            ['Integrations Ready', `${configuredCount}/${integrations.length}`, X.blue],
          ].map(([label, value, color]) => <div key={String(label)} style={{ background: X.white, border: `1px solid ${X.border}`, borderRadius: '4px', padding: '12px' }}><div style={{ color: String(color), fontSize: '20px', fontWeight: 900 }}>{value}</div><div style={{ color: X.muted, fontSize: '10px', textTransform: 'uppercase', marginTop: '3px', fontWeight: 700 }}>{label}</div></div>)}
        </section>

        <h2 style={{ color: X.navy, fontSize: '13px', margin: '0 0 8px', fontWeight: 800 }}>Live Service Health</h2>
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '12px', marginBottom: '16px' }}>
          {loading && checks.length === 0 ? Array.from({ length: 10 }).map((_, i) => <div key={i} style={{ background: X.white, border: `1px solid ${X.border}`, borderRadius: '4px', padding: '12px', color: X.muted, fontSize: '11px' }}>Checking…</div>) : checks.map((check) => <HealthCard key={check.service} check={check} />)}
        </section>

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
          <h2 style={{ color: X.navy, fontSize: '13px', margin: 0, fontWeight: 800 }}>Integration Readiness</h2>
          <span style={{ color: X.muted, fontSize: '10px' }}>Configuration readiness only; no credentials are exposed.</span>
        </div>
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: '12px' }}>
          {integrations.map((integration) => <div key={integration.service} style={{ background: X.white, border: `1px solid ${X.border}`, borderTop: `3px solid ${integration.configured ? X.green : X.orange}`, borderRadius: '4px', padding: '12px' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}><span style={{ color: X.navy, fontWeight: 800, fontSize: '12px' }}>{integration.service}</span><span style={{ color: integration.configured ? X.green : X.orange, fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' }}>{integration.configured ? 'Configured' : 'Action needed'}</span></div><div style={{ color: X.muted, fontSize: '10px', marginTop: '6px' }}>{integration.detail}</div></div>)}
        </section>
      </div>
    </ProtectedRoute>
  );
}
