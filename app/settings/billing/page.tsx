'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { XDRIVE_STANDARD_PLANS, isStandardMembershipPlan, type StandardMembershipPlanId } from '../../../lib/commercialBilling';
import { supabase } from '../../../lib/supabaseClient';
import { ActionButton, AlertBanner, EmptyState, PageFrame, PageHeader, Panel } from '../../components/workspace/WorkspaceUI';

type CompanyMembership = { companyId: string; name: string; role: string };
type BillingSubscription = {
  planId: string;
  status: string;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  termsVersion: string;
  contractAcceptedAt: string | null;
  hasStripeCustomer: boolean;
  hasStripeSubscription: boolean;
};

type BillingStatusPayload = {
  excluded?: boolean;
  delegated?: boolean;
  reason?: string | null;
  subscription?: BillingSubscription | null;
  error?: string;
};

const PLAN_ORDER: StandardMembershipPlanId[] = ['owner-driver', 'customer-shipper', 'small-carrier', 'broker', 'growing-carrier', 'fleet'];
const BILLING_ROLES = new Set(['owner', 'admin']);

const money = (pence: number) => `£${(pence / 100).toFixed(2)}`;
const formatDate = (value: string | null | undefined) => {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function BillingSettingsPage() {
  const router = useRouter();
  const [planId, setPlanId] = useState<StandardMembershipPlanId>('owner-driver');
  const [companies, setCompanies] = useState<CompanyMembership[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<BillingSubscription | null>(null);
  const [excluded, setExcluded] = useState(false);
  const [delegated, setDelegated] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [opening, setOpening] = useState(false);
  const [portalOpening, setPortalOpening] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  const readStatus = async (token: string, targetCompanyId: string | null) => {
    setStatusLoading(true);
    try {
      const query = targetCompanyId ? `?companyId=${encodeURIComponent(targetCompanyId)}` : '';
      const response = await fetch(`/api/billing/status${query}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => null)) as BillingStatusPayload | null;
      if (!response.ok) throw new Error(payload?.error ?? 'Billing status could not be loaded.');
      const nextSubscription = payload?.subscription ?? null;
      setExcluded(payload?.excluded === true);
      setDelegated(payload?.delegated === true);
      setSubscription(nextSubscription);
      if (nextSubscription && isStandardMembershipPlan(nextSubscription.planId)) setPlanId(nextSubscription.planId);
      if (nextSubscription?.contractAcceptedAt) setAcceptedTerms(true);
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        if (active) setError('Your session has expired. Please sign in again.');
        if (active) setLoading(false);
        return;
      }
      const requestedPlan = session.user.user_metadata?.selected_membership_plan;
      if (isStandardMembershipPlan(requestedPlan) && active) setPlanId(requestedPlan);

      const { data, error: membershipError } = await supabase
        .from('company_memberships')
        .select('company_id, role_in_company, companies(name)')
        .eq('user_id', session.user.id)
        .eq('status', 'active');
      if (!active) return;
      if (membershipError) {
        setError(membershipError.message);
      } else {
        const resolved = (data ?? []).map((row) => {
          const relation = row.companies as unknown as { name?: string } | { name?: string }[] | null;
          const company = Array.isArray(relation) ? relation[0] : relation;
          return { companyId: String(row.company_id), role: String(row.role_in_company ?? ''), name: company?.name?.trim() || 'XDrive company' };
        }).filter((company) => BILLING_ROLES.has(company.role.toLowerCase()));
        const initialCompanyId = resolved[0]?.companyId ?? null;
        setCompanies(resolved);
        setCompanyId(initialCompanyId);
        try {
          await readStatus(session.access_token, initialCompanyId);
        } catch (reason) {
          if (active) setError(reason instanceof Error ? reason.message : 'Billing status could not be loaded.');
        }
      }
      if (active) setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, []);

  const refreshStatusForCompany = async (nextCompanyId: string | null) => {
    setCompanyId(nextCompanyId);
    setError('');
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setError('Your session has expired. Please sign in again.');
      return;
    }
    try {
      await readStatus(token, nextCompanyId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Billing status could not be loaded.');
    }
  };

  const plan = XDRIVE_STANDARD_PLANS[planId];
  const selectedCompany = useMemo(() => companies.find((company) => company.companyId === companyId) ?? null, [companies, companyId]);
  const futureTrialEnd = subscription?.trialEndsAt ? new Date(subscription.trialEndsAt) : null;
  const trialActive = subscription?.status === 'trialing' && Boolean(futureTrialEnd && Number.isFinite(futureTrialEnd.getTime()) && futureTrialEnd.getTime() > Date.now());
  const planLocked = Boolean(subscription);
  const canOpenPortal = Boolean(subscription?.hasStripeCustomer);
  const canDownloadConfirmation = Boolean(subscription?.contractAcceptedAt);

  const checkoutLabel = subscription
    ? trialActive
      ? `Add payment method · trial ends ${formatDate(subscription.trialEndsAt)}`
      : `Activate membership · ${money(plan.monthlyAmountPence)}/month + VAT`
    : `Start 3-month free trial · then ${money(plan.monthlyAmountPence)}/month + VAT`;

  const startCheckout = async () => {
    if (!acceptedTerms) {
      setError('Please accept the Membership & Subscription Terms before continuing.');
      return;
    }
    setOpening(true);
    setError('');
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Your session has expired. Please sign in again.');
      const response = await fetch('/api/billing/subscription/checkout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, companyId, acceptedMembershipTerms: true, termsVersion: '2026-09-01' }),
      });
      const payload = (await response.json().catch(() => null)) as { checkoutUrl?: string; error?: string } | null;
      if (!response.ok || !payload?.checkoutUrl) throw new Error(payload?.error ?? 'Subscription checkout could not be started.');
      window.location.assign(payload.checkoutUrl);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Subscription checkout could not be started.');
      setOpening(false);
    }
  };

  const openPortal = async () => {
    setPortalOpening(true);
    setError('');
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Your session has expired. Please sign in again.');
      const response = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      });
      const payload = (await response.json().catch(() => null)) as { portalUrl?: string; error?: string } | null;
      if (!response.ok || !payload?.portalUrl) throw new Error(payload?.error ?? 'Billing portal could not be opened.');
      window.location.assign(payload.portalUrl);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Billing portal could not be opened.');
      setPortalOpening(false);
    }
  };

  const downloadConfirmation = async () => {
    setDownloading(true);
    setError('');
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Your session has expired. Please sign in again.');
      const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
      const response = await fetch(`/api/billing/contract-confirmation${query}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? 'Membership confirmation could not be generated.');
      }
      const blob = await response.blob();
      const disposition = response.headers.get('content-disposition') ?? '';
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? 'XDrive-Membership-Confirmation.pdf';
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(href);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Membership confirmation could not be generated.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Membership"
        title="XDrive membership billing"
        description="The first three calendar months are free for eligible standard memberships. After the trial, membership continues monthly at the disclosed price plus VAT where applicable."
        actions={<ActionButton tone="secondary" onClick={() => router.back()}>Back</ActionButton>}
      />
      {error ? <AlertBanner tone="danger">{error}</AlertBanner> : null}
      {loading ? <Panel><EmptyState title="Loading billing profile…" /></Panel> : excluded ? (
        <Panel title="Platform account" description="Platform Owner is intentionally outside the commercial XDrive membership billing lifecycle.">
          <EmptyState title="No platform membership charge applies to this account." />
        </Panel>
      ) : delegated ? (
        <Panel title="Company-managed membership" description="Your XDrive access belongs to a company membership. Billing changes are restricted to that company’s authorised owner or admin.">
          <EmptyState title="Contact your company owner or administrator to manage the membership or payment method." />
        </Panel>
      ) : (
        <>
          {companies.length > 0 ? (
            <Panel title="Billing account" description="Select the company that owns this XDrive membership.">
              <select value={companyId ?? ''} onChange={(event) => void refreshStatusForCompany(event.target.value || null)} style={{ width: '100%', maxWidth: 520, padding: '0.75rem', border: '1px solid #CBD5E1', borderRadius: 10, background: '#fff' }}>
                {companies.map((company) => <option key={company.companyId} value={company.companyId}>{company.name} · {company.role}</option>)}
              </select>
            </Panel>
          ) : null}

          {subscription ? (
            <Panel title="Current membership" description="This is the server-authoritative membership lifecycle for the selected billing account.">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.8rem' }}>
                <div><strong>Plan</strong><div>{isStandardMembershipPlan(subscription.planId) ? XDRIVE_STANDARD_PLANS[subscription.planId].label : subscription.planId}</div></div>
                <div><strong>Status</strong><div>{subscription.status.replace(/_/g, ' ')}</div></div>
                <div><strong>Trial ends</strong><div>{formatDate(subscription.trialEndsAt)}</div></div>
                <div><strong>Renewal</strong><div>{subscription.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : trialActive ? 'After free trial' : 'Pending activation'}</div></div>
              </div>
              {trialActive && !subscription.hasStripeSubscription ? <div style={{ marginTop: '0.8rem', color: '#64748B', fontSize: '0.85rem' }}>Your free period is already running. Adding a payment method does not restart or extend the trial.</div> : null}
              {subscription.cancelAtPeriodEnd ? <div style={{ marginTop: '0.8rem', color: '#64748B', fontSize: '0.85rem' }}>Cancellation is scheduled for the end of the current billing period.</div> : null}
            </Panel>
          ) : null}

          <Panel title="Membership plan" description={planLocked ? 'The current lifecycle plan is locked here to prevent an accidental billing-tier change.' : 'Enterprise agreements are handled separately and are not activated through self-service Checkout.'}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.75rem' }}>
              {PLAN_ORDER.map((id) => {
                const item = XDRIVE_STANDARD_PLANS[id];
                const selected = id === planId;
                return (
                  <button key={id} type="button" disabled={planLocked || statusLoading} onClick={() => setPlanId(id)} style={{ textAlign: 'left', padding: '1rem', borderRadius: 12, border: selected ? '2px solid #1D57D8' : '1px solid #E2E8F0', background: selected ? '#EFF6FF' : '#fff', cursor: planLocked ? 'default' : 'pointer', opacity: planLocked && !selected ? 0.55 : 1 }}>
                    <div style={{ fontWeight: 900, color: '#0B2F6B' }}>{item.label}</div>
                    <div style={{ marginTop: '0.35rem', fontSize: '1.25rem', fontWeight: 900 }}>{money(item.monthlyAmountPence)} <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B' }}>/ month + VAT</span></div>
                    <div style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: '#64748B' }}>{subscription ? selected ? `Current status: ${subscription.status.replace(/_/g, ' ')}` : 'Different membership tier' : 'First 3 calendar months free'}</div>
                  </button>
                );
              })}
            </div>
          </Panel>

          <Panel title="Contract & payment method" description="Stripe securely stores the payment method used for future membership renewals. XDrive does not receive or store card numbers.">
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', lineHeight: 1.55 }}>
              <input type="checkbox" checked={acceptedTerms} disabled={Boolean(subscription?.contractAcceptedAt)} onChange={(event) => setAcceptedTerms(event.target.checked)} style={{ marginTop: '0.3rem' }} />
              <span>I accept the <Link href="/subscription-terms" style={{ color: '#1D57D8', fontWeight: 800 }}>Membership & Subscription Terms</Link> (version 2026-09-01), including the three-month free period and monthly rolling renewal after the trial.</span>
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.7rem', marginTop: '1rem' }}>
              {!subscription?.hasStripeSubscription ? <ActionButton tone="primary" disabled={opening || !acceptedTerms || statusLoading} onClick={() => void startCheckout()}>{opening ? 'Opening Stripe…' : checkoutLabel}</ActionButton> : null}
              <ActionButton tone="secondary" disabled={portalOpening || !canOpenPortal} onClick={() => void openPortal()}>{portalOpening ? 'Opening portal…' : 'Manage existing subscription'}</ActionButton>
              <ActionButton tone="secondary" disabled={downloading || !canDownloadConfirmation} onClick={() => void downloadConfirmation()}>{downloading ? 'Preparing confirmation…' : 'Download membership confirmation'}</ActionButton>
            </div>
            {selectedCompany ? <div style={{ marginTop: '0.75rem', color: '#64748B', fontSize: '0.82rem' }}>Membership account: {selectedCompany.name}</div> : null}
          </Panel>
        </>
      )}
    </PageFrame>
  );
}
