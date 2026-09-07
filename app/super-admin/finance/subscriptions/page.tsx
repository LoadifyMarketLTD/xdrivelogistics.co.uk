'use client';

import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import PlatformEntityLink from '@/app/super-admin/_components/control-plane/PlatformEntityLink';
import { StatusChip, formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';

type Row = {
  id: string;
  user_id: string | null;
  company_id: string | null;
  plan_id: string | null;
  status: string | null;
  company_name: string;
  user_name: string;
  user_email: string;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  cancel_at_period_end: boolean | null;
  current_period_end: string | null;
  contract_terms_version: string | null;
  contract_accepted_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

export default function Page() {
  return <SuperAdminLiveTablePage<Row>
    icon="£"
    title="Membership Subscriptions"
    sectionLabel="Finance"
    description="Platform membership and billing state with Stripe linkage represented only as configured/not configured."
    endpoint="/api/super-admin/governance?section=subscriptions"
    pageSize={50}
    emptyMessage="No platform membership subscriptions found."
    columns={[
      { key: 'account', label: 'Account', render: (row) => row.user_id ? <div><PlatformEntityLink entityType="user" entityId={row.user_id} compact>{row.user_name !== '—' ? row.user_name : row.user_email}</PlatformEntityLink><div style={{fontSize:10,color:'#64748B',marginTop:3}}>{row.user_email}</div></div> : '—' },
      { key: 'company', label: 'Company', render: (row) => row.company_id ? <PlatformEntityLink entityType="company" entityId={row.company_id} compact>{row.company_name}</PlatformEntityLink> : '—' },
      { key: 'plan', label: 'Plan', render: (row) => <strong>{row.plan_id?.replaceAll('_',' ') ?? '—'}</strong> },
      { key: 'status', label: 'Status', render: (row) => <StatusChip value={row.status} /> },
      { key: 'trial', label: 'Trial', render: (row) => row.trial_ends_at ? <span>{formatDateTime(row.trial_started_at)} → {formatDateTime(row.trial_ends_at)}</span> : '—' },
      { key: 'period', label: 'Current period', render: (row) => <div>{formatDateTime(row.current_period_end)}{row.cancel_at_period_end ? <div style={{fontSize:10,color:'#DC2626',marginTop:3}}>Cancels at period end</div> : null}</div> },
      { key: 'terms', label: 'Contract terms', render: (row) => <div>{row.contract_terms_version ?? '—'}<div style={{fontSize:10,color:'#64748B',marginTop:3}}>{formatDateTime(row.contract_accepted_at)}</div></div> },
      { key: 'stripe', label: 'Stripe linkage', render: (row) => [row.stripe_customer_id ? 'Customer' : null, row.stripe_subscription_id ? 'Subscription' : null].filter(Boolean).join(' + ') || 'Not linked' },
    ]}
  />;
}
