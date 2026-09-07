'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';
import {
  SuperAdminEmptyState, SuperAdminMetricCard, SuperAdminMetricGrid, SuperAdminNotice,
  SuperAdminPage, SuperAdminPageHeader, SuperAdminSectionCard, SuperAdminStatusBadge,
  SuperAdminUnavailableState,
} from '@/app/super-admin/_components/SuperAdminEnterprisePrimitives';

type HealthStatus = 'healthy' | 'degraded' | 'error' | 'checking';
type ServiceCheck = { service: string; status: HealthStatus; latencyMs?: number; detail?: string };
type Integration = { service: string; configured: boolean; detail: string };
type InfraPayload = { checkedAt?: string; checks?: ServiceCheck[]; integrations?: Integration[]; error?: string };
type EmailReadinessPayload = { readinessStatus?: 'healthy' | 'degraded' | 'error'; readinessMessage?: string };
type GovernanceRowsPayload = { rows?: Array<Record<string, unknown>> };

const REQUEST_TIMEOUT_MS = 15_000;
const toneFor = (status: HealthStatus) => status === 'healthy' ? 'success' : status === 'degraded' ? 'warning' : status === 'error' ? 'danger' : 'unavailable';
const labelFor = (status: HealthStatus) => status === 'healthy' ? 'Healthy' : status === 'degraded' ? 'Degraded' : status === 'error' ? 'Error' : 'Checking';

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try { return await fetch(input, { ...init, signal: controller.signal, cache: 'no-store' }); }
  finally { window.clearTimeout(timer); }
}
export default function Page() {
  const [checks, setChecks] = useState<ServiceCheck[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const runChecks = useCallback(async () => {
    setLoading(true); setError(null); setChecks([]); setIntegrations([]); setCheckedAt(null);
    const auth = await getAuthHeader();
    if (!auth) { setError('No active Platform Owner session.'); setLoading(false); return; }

    const apiChecks = [
      ['Stats API', '/api/super-admin/stats'],
      ['Operations API', '/api/super-admin/operations?section=jobs&limit=1'],
      ['Finance API', '/api/super-admin/finance?section=invoices&limit=1'],
      ['Compliance API', '/api/super-admin/compliance?section=documents&limit=1'],
      ['Marketplace API', '/api/super-admin/marketplace?limit=1'],
      ['Notifications API', '/api/super-admin/notifications?limit=1'],
      ['Users API', '/api/super-admin/users?limit=1'],
      ['Support API', '/api/super-admin/support?section=tickets&limit=1'],
      ['Governance API', '/api/super-admin/governance?section=memberships&limit=1'],
    ] as const;

    const checkApi = async ([service, url]: readonly [string, string]): Promise<ServiceCheck> => {
      const start = Date.now();
      try { const response = await fetchWithTimeout(url, { headers: { Authorization: auth } }); return response.ok ? { service, status: 'healthy', latencyMs: Date.now() - start, detail: 'Endpoint responded successfully.' } : { service, status: 'error', latencyMs: Date.now() - start, detail: 'Endpoint unavailable.' }; }
      catch { return { service, status: 'error', latencyMs: Date.now() - start, detail: 'Endpoint unavailable or timed out.' }; }
    };
    const checkGovernance = async (service: string, url: string, failureField: string): Promise<ServiceCheck> => {
      const start = Date.now();
      try {
        const response = await fetchWithTimeout(url, { headers: { Authorization: auth } });
        const body = await response.json().catch(() => ({})) as GovernanceRowsPayload;
        if (!response.ok || !Array.isArray(body.rows)) return { service, status: 'error', latencyMs: Date.now() - start, detail: 'Governance state unavailable.' };
        const affected = body.rows.filter((row) => ['failed', 'error', 'past_due', 'unpaid', 'incomplete', 'incomplete_expired'].includes(String(row[failureField] ?? row.status ?? '').toLowerCase())).length;
        return affected > 0
          ? { service, status: 'degraded', latencyMs: Date.now() - start, detail: `${affected} record(s) require attention.` }
          : { service, status: 'healthy', latencyMs: Date.now() - start, detail: `${body.rows.length} recent record(s) checked.` };
      } catch { return { service, status: 'error', latencyMs: Date.now() - start, detail: 'Governance state unavailable or timed out.' }; }
    };

    try {
      const [infraResponse, emailResponse, billingCheck, webhookCheck, ...apiResults] = await Promise.all([
        fetchWithTimeout('/api/super-admin/health', { headers: { Authorization: auth } }),
        fetchWithTimeout('/api/super-admin/email-readiness', { headers: { Authorization: auth } }),
        checkGovernance('Membership Billing', '/api/super-admin/governance?section=subscriptions&limit=100', 'status'),
        checkGovernance('Stripe Webhook Processing', '/api/super-admin/governance?section=stripe-webhooks&limit=100', 'processing_status'),
        ...apiChecks.map(checkApi),
      ]);
      const infra = await infraResponse.json().catch(() => ({})) as InfraPayload;
      if (!infraResponse.ok || !Array.isArray(infra.checks) || !Array.isArray(infra.integrations)) throw new Error('Invalid platform health contract.');
      const email = await emailResponse.json().catch(() => ({})) as EmailReadinessPayload;
      const emailCheck: ServiceCheck = !emailResponse.ok || email.readinessStatus === 'error'
        ? { service: 'Email Delivery', status: 'error', detail: 'Email delivery readiness check failed.' }
        : email.readinessStatus === 'degraded'
          ? { service: 'Email Delivery', status: 'degraded', detail: email.readinessMessage ?? 'Email delivery has warnings.' }
          : { service: 'Email Delivery', status: 'healthy', detail: email.readinessMessage ?? 'Email delivery is operational.' };
      setChecks([...infra.checks, emailCheck, billingCheck, webhookCheck, ...apiResults]);
      setIntegrations(infra.integrations);
      setCheckedAt(infra.checkedAt ?? new Date().toISOString());
    } catch {
      setError('Platform health service is currently unavailable.');
      setChecks([]); setIntegrations([]); setCheckedAt(null);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void runChecks(); }, [runChecks]);
  const healthy = checks.filter((item) => item.status === 'healthy').length;
  const degraded = checks.filter((item) => item.status === 'degraded').length;
  const failed = checks.filter((item) => item.status === 'error').length;
  const overall: HealthStatus = loading ? 'checking' : failed > 0 ? 'error' : degraded > 0 ? 'degraded' : checks.length > 0 ? 'healthy' : 'checking';
  const configuredCount = integrations.filter((item) => item.configured).length;

  return <ProtectedRoute allowedRoles={['owner']}>
    <SuperAdminPage>
      <SuperAdminPageHeader
        eyebrow="Platform"
        title="Platform Health"
        description="Live internal service checks, billing/webhook processing signals and integration readiness."
        icon={<Activity size={20} aria-hidden="true" />}
        meta={checkedAt ? `Last checked ${new Date(checkedAt).toLocaleString('en-GB')}` : undefined}
        actions={<button type="button" className="sa-button" onClick={() => void runChecks()} disabled={loading}>{loading ? 'Checking…' : 'Re-check'}</button>}
      />
      {error ? <SuperAdminUnavailableState title="Platform health unavailable" description={error} /> : null}
      <SuperAdminMetricGrid>
        <SuperAdminMetricCard label="Overall" value={labelFor(overall)} tone={toneFor(overall)} />
        <SuperAdminMetricCard label="Healthy" value={loading ? '—' : healthy} tone="success" />
        <SuperAdminMetricCard label="Degraded" value={loading ? '—' : degraded} tone="warning" />
        <SuperAdminMetricCard label="Errors" value={loading ? '—' : failed} tone="danger" />
        <SuperAdminMetricCard label="Checks" value={loading ? '—' : checks.length} tone="info" />
        <SuperAdminMetricCard label="Integrations Ready" value={loading ? '—' : `${configuredCount}/${integrations.length}`} tone="info" />
      </SuperAdminMetricGrid>

      <SuperAdminSectionCard title="Live Service Health" description="Each status reflects a verified endpoint or governance check from this refresh cycle.">
        {loading && checks.length === 0 ? <SuperAdminEmptyState title="Running platform checks…" /> : checks.length === 0 ? <SuperAdminEmptyState title="No health checks returned." /> : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 10 }}>
          {checks.map((check) => <article key={check.service} style={{ border: '1px solid #D9E1EA', borderRadius: 8, padding: 12, background: '#FFFFFF' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}><strong>{check.service}</strong><SuperAdminStatusBadge label={labelFor(check.status)} tone={toneFor(check.status)} /></div>
            <div style={{ marginTop: 8, color: '#64748B', fontSize: 12 }}>{check.latencyMs !== undefined ? `${check.latencyMs}ms · ` : ''}{check.detail ?? 'No detail returned.'}</div>
          </article>)}
        </div>}
      </SuperAdminSectionCard>

      <SuperAdminSectionCard title="Integration Readiness" description="Configuration readiness only; credentials and secrets are never exposed.">
        {integrations.length === 0 ? <SuperAdminNotice tone="warning">No integration readiness records were returned.</SuperAdminNotice> : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 10 }}>
          {integrations.map((integration) => <article key={integration.service} style={{ border: '1px solid #D9E1EA', borderRadius: 8, padding: 12, background: '#FFFFFF' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><strong>{integration.service}</strong><SuperAdminStatusBadge label={integration.configured ? 'Configured' : 'Action needed'} tone={integration.configured ? 'success' : 'warning'} /></div>
            <div style={{ marginTop: 8, color: '#64748B', fontSize: 12 }}>{integration.detail}</div>
          </article>)}
        </div>}
      </SuperAdminSectionCard>
    </SuperAdminPage>
  </ProtectedRoute>;
}
