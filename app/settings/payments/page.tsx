'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { supabase } from '../../../lib/supabaseClient';
import { ActionButton, AlertBanner, EmptyState, PageFrame, PageHeader, Panel } from '../../components/workspace/WorkspaceUI';

type CompanyChoice = { companyId: string; name: string; role: string };

export default function PaymentSettingsPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<CompanyChoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) {
        if (active) setError('Your session has expired. Please sign in again.');
        if (active) setLoading(false);
        return;
      }
      const { data, error: membershipError } = await supabase
        .from('company_memberships')
        .select('company_id, role_in_company, companies(name)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .in('role_in_company', ['owner', 'admin']);
      if (!active) return;
      if (membershipError) {
        setError(membershipError.message);
      } else {
        setCompanies((data ?? []).map((row) => {
          const companyRelation = row.companies as unknown as { name?: string } | { name?: string }[] | null;
          const company = Array.isArray(companyRelation) ? companyRelation[0] : companyRelation;
          return {
            companyId: String(row.company_id),
            role: String(row.role_in_company ?? ''),
            name: company?.name?.trim() || 'XDrive company',
          };
        }));
      }
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, []);

  const connect = async (companyId: string) => {
    setConnectingId(companyId);
    setError('');
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Your session has expired. Please sign in again.');
      const response = await fetch('/api/payments/connect/onboarding', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      });
      const payload = (await response.json().catch(() => null)) as { onboardingUrl?: string; error?: string } | null;
      if (!response.ok || !payload?.onboardingUrl) throw new Error(payload?.error ?? 'Stripe onboarding could not be started.');
      window.location.assign(payload.onboardingUrl);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Stripe onboarding could not be started.');
      setConnectingId(null);
    }
  };

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Payments"
        title="Receive transport payments"
        description="Connect your business to Stripe so customers can pay transport invoices securely. Stripe collects verification and bank details; XDrive does not store your bank credentials or custody transport funds."
        actions={<ActionButton tone="secondary" onClick={() => router.back()}>Back</ActionButton>}
      />
      {error ? <AlertBanner tone="danger">{error}</AlertBanner> : null}
      <Panel title="Stripe payout connection" description="Only company owners and admins can create or refresh the payout connection.">
        {loading ? <EmptyState title="Loading companies…" /> : companies.length === 0 ? (
          <EmptyState title="No authorised company found" description="You need an active owner/admin company membership before payout onboarding can start." />
        ) : (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {companies.map((company) => (
              <div key={company.companyId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.9rem 1rem', border: '1px solid #E5E7EB', borderRadius: '12px' }}>
                <div>
                  <div style={{ fontWeight: 850 }}>{company.name}</div>
                  <div style={{ marginTop: '0.2rem', color: '#64748B', fontSize: '0.82rem' }}>Stripe Connect Standard · {company.role}</div>
                </div>
                <ActionButton tone="primary" disabled={connectingId === company.companyId} onClick={() => void connect(company.companyId)}>
                  {connectingId === company.companyId ? 'Opening Stripe…' : 'Connect / manage payout account'}
                </ActionButton>
              </div>
            ))}
          </div>
        )}
      </Panel>
      <Panel title="How job money moves">
        <div style={{ lineHeight: 1.75, color: '#334155' }}>
          Customer pays in Stripe → Stripe processes the direct charge on the carrier connected account → Stripe pays the carrier/owner-driver according to its payout schedule. XDrive records payment status against the job invoice but does not receive the transport value into the XDrive platform balance.
        </div>
      </Panel>
    </PageFrame>
  );
}
