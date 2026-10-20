'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabaseClient';
import { readRouteAuthAccessToken } from '../../../lib/routeAuthCookie';
import { ActionButton, AlertBanner, EmptyState, PageFrame, PageHeader, Panel } from '../../components/workspace/WorkspaceUI';

type CompanyChoice = { companyId: string; name: string; role: string; preApproval: boolean; stripeReady: boolean; onboardingStatus: string };

async function authHeaders(): Promise<Record<string, string>> {
  const cached = readRouteAuthAccessToken();
  if (cached) return { Authorization: `Bearer ${cached}` };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const { data } = await Promise.race([
    supabase.auth.getSession(),
    new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Session lookup timed out. Please reload and sign in again.')), 15000); }),
  ]).finally(() => { if (timer) clearTimeout(timer); });
  if (!data.session?.access_token) throw new Error('Sign in to configure your company payments.');
  return { Authorization: `Bearer ${data.session.access_token}` };
}

export default function PaymentSettingsPage() {
  const [companies, setCompanies] = useState<CompanyChoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const response = await fetch('/api/payments/connect/onboarding', {
      headers: await authHeaders(), cache: 'no-store', signal: AbortSignal.timeout(30000),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? 'Your company could not be loaded.');
    setCompanies(payload.companies ?? []);
  }, []);

  const refresh = useCallback(async (companyId: string) => {
    const response = await fetch('/api/payments/connect/onboarding', {
      method: 'POST', headers: { ...await authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, action: 'refresh' }), signal: AbortSignal.timeout(30000),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? 'Stripe status could not be refreshed.');
    setMessage(payload.stripeReady
      ? 'Stripe is active. Platform Compliance can now recheck your application; this does not automatically approve it.'
      : 'Stripe setup is not fully active yet. Continue setup to complete the details or check again after Stripe finishes its review.');
    await load();
  }, [load]);

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      await load();
      const params = new URLSearchParams(window.location.search);
      if (params.get('connect') === 'return' && params.get('companyId')) {
        await refresh(params.get('companyId')!);
      } else if (params.get('connect') === 'refresh') {
        setMessage('Your Stripe link has expired or was already used. Select Continue Stripe setup to obtain a new secure link.');
      }
    };
    void initialize().catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Payment setup could not be loaded.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load, refresh]);

  const connect = async (companyId: string) => {
    setConnectingId(companyId); setError(''); setMessage('');
    try {
      const response = await fetch('/api/payments/connect/onboarding', {
        method: 'POST', headers: { ...await authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, action: 'start' }), signal: AbortSignal.timeout(55000),
      });
      const payload = await response.json();
      if (!response.ok || !payload.onboardingUrl) throw new Error(payload.error ?? 'Stripe setup could not be started.');
      const destination = new URL(payload.onboardingUrl);
      if (destination.protocol !== 'https:' || !destination.hostname.endsWith('.stripe.com')) throw new Error('Invalid Stripe setup destination.');
      window.location.assign(destination.href);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Stripe setup could not be started.');
      setConnectingId(null);
    }
  };

  const checkStatus = async (companyId: string) => {
    setConnectingId(companyId); setError('');
    try { await refresh(companyId); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Stripe status could not be checked.'); }
    finally { setConnectingId(null); }
  };

  return <PageFrame>
    <PageHeader eyebrow="Payments" title="Receive transport payments"
      description="Connect your business to Stripe. Pending company applicants can complete this setup before Platform Compliance approval, without gaining commercial workspace access."
      actions={<Link href="/pending-approval">Application status</Link>} />
    {error && <AlertBanner tone="danger">{error} <Link href="/login?next=%2Fsettings%2Fpayments">Sign in again</Link></AlertBanner>}
    {message && <div role="status"><AlertBanner tone="info">{message}</AlertBanner></div>}
    <Panel title="Stripe payout connection" description="Only authorised owners and admins can configure their own company. Stripe collects verification and bank details securely.">
      {loading ? <EmptyState title="Loading your company..." /> : !companies.length ? <EmptyState title="No company available for payment setup"
        description="Sign in with the account that owns the application. An invited company owner can complete Stripe for their own pending company; ordinary driver invitations do not grant this permission." /> :
        <div style={{ display: 'grid', gap: 16 }}>
          {companies.map(company => <section key={company.companyId} aria-label={company.name}
            style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: 16 }}>
            <h2 style={{ fontSize: 19, margin: '0 0 8px' }}>{company.name}</h2>
            <p>{company.preApproval ? 'Pre-approval payment setup. Your application remains under review.' : 'Authorised company payment setup.'}</p>
            <p><strong>Stripe:</strong> {company.stripeReady ? 'Active - payments and payouts enabled' : company.onboardingStatus === 'not_started' ? 'Not connected' : 'Setup incomplete or awaiting Stripe verification'}</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {!company.stripeReady && <ActionButton tone="primary" disabled={connectingId !== null} onClick={() => void connect(company.companyId)}>
                {connectingId === company.companyId ? 'Please wait...' : company.onboardingStatus === 'not_started' ? 'Connect Stripe' : 'Continue Stripe setup'}
              </ActionButton>}
              <ActionButton tone="secondary" disabled={connectingId !== null} onClick={() => void checkStatus(company.companyId)}>Check Stripe status</ActionButton>
            </div>
          </section>)}
        </div>}
    </Panel>
    <Panel title="How job money moves"><p>Stripe processes transport payments on the carrier account and pays that business according to its payout schedule. XDrive records the invoice payment status. Completing this setup does not approve your documents or activate your workspace.</p></Panel>
    <p><Link href="/onboarding/documents">View or replace my documents</Link></p>
  </PageFrame>;
}
