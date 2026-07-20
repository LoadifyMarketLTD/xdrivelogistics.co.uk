'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import LoadPostingForm from '../components/workspace/LoadPostingForm';
import { useCompanyWorkspaceData } from '../components/workspace/useCompanyWorkspaceData';
import { ActionButton, AlertBanner, DataTable, EmptyState, KpiCard, KpiGrid, PageFrame, PageHeader, Panel, StatusBadge, TwoColumn } from '../components/workspace/WorkspaceUI';

const money = (value: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);
const when = (value: string | null | undefined) => value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not set';
const active = new Set(['awarded', 'allocated', 'accepted', 'on_my_way', 'on_my_way_to_pickup', 'on_site_pickup', 'loaded', 'collected', 'in_transit', 'on_my_way_to_delivery', 'on_site_delivery']);

export function BrokerDashboard() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();
  const metrics = useMemo(() => {
    const submitted = data.bids.filter((bid) => bid.status === 'submitted');
    const accepted = data.bids.filter((bid) => bid.status === 'accepted');
    const customerRevenue = data.jobs.reduce((sum, job) => sum + Number(job.budget_amount ?? 0), 0);
    const carrierCost = accepted.reduce((sum, bid) => sum + Number(bid.bid_price_gbp ?? bid.amount ?? 0), 0);
    return {
      draft: data.jobs.filter((job) => job.status === 'draft').length,
      open: data.jobs.filter((job) => ['posted', 'quoted'].includes(job.status)).length,
      quotes: submitted.length,
      awaitingAward: data.jobs.filter((job) => !job.awarded_carrier_company_id && submitted.some((bid) => bid.job_id === job.id)).length,
      active: data.jobs.filter((job) => active.has(job.current_status ?? job.status)).length,
      pod: data.jobs.filter((job) => ['delivered', 'completed'].includes(job.status) && (job.delivery_photos?.length ?? 0) > 0).length,
      margin: customerRevenue - carrierCost,
      marginPct: customerRevenue > 0 ? ((customerRevenue - carrierCost) / customerRevenue) * 100 : 0,
    };
  }, [data.bids, data.jobs]);

  return <PageFrame>
    <PageHeader eyebrow="Broker commercial desk" title="Broker Dashboard" description="Manage customer loads, source compliant carrier capacity, protect margin and control the job through POD and invoicing." actions={<><ActionButton tone="warning" onClick={() => router.push('/broker/post-load')}>Post Load</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/broker/compare-quotes')}>Compare Quotes</ActionButton></>} />
    {data.error && <AlertBanner>{data.error}</AlertBanner>}
    <KpiGrid>
      <KpiCard label="Draft loads" value={metrics.draft} detail="Not yet visible to carriers" />
      <KpiCard label="Open loads" value={metrics.open} detail="Published for carrier pricing" tone="blue" />
      <KpiCard label="Carrier quotes" value={metrics.quotes} detail="Commercial responses received" tone="purple" />
      <KpiCard label="Awaiting award" value={metrics.awaitingAward} detail="Loads with selectable quotes" tone="orange" onClick={() => router.push('/broker/compare-quotes')} />
      <KpiCard label="Active jobs" value={metrics.active} detail="Collections and deliveries in progress" tone="green" />
      <KpiCard label="POD ready" value={metrics.pod} detail="Ready for review and invoicing" tone="navy" />
      <KpiCard label="Gross margin" value={money(metrics.margin)} detail={`${metrics.marginPct.toFixed(1)}% across current loads`} tone={metrics.margin >= 0 ? 'green' : 'red'} />
    </KpiGrid>
    <TwoColumn>
      <Panel title="Commercial decisions" description="Loads with quotes that need comparison or award." actions={<ActionButton tone="secondary" onClick={() => router.push('/broker/bids')}>All quotes</ActionButton>}>
        <DataTable columns={['Customer load', 'Quotes', 'Customer price', 'Best cost', 'Margin', 'Action']} rows={data.jobs.filter((job) => data.bids.some((bid) => bid.job_id === job.id && bid.status === 'submitted')).slice(0, 8).map((job) => {
          const quotes = data.bids.filter((bid) => bid.job_id === job.id && bid.status === 'submitted');
          const costs = quotes.map((bid) => Number(bid.bid_price_gbp ?? bid.amount ?? 0)).filter((value) => value > 0);
          const best = costs.length ? Math.min(...costs) : 0;
          const revenue = Number(job.budget_amount ?? 0);
          return [<strong key="route">{job.pickup_location ?? 'Collection'} → {job.delivery_location ?? 'Delivery'}</strong>, quotes.length, money(revenue), money(best), money(revenue - best), <ActionButton key="action" tone="success" onClick={() => router.push(`/broker/compare-quotes?job=${job.id}`)}>Compare</ActionButton>];
        })} empty={<EmptyState title="No loads awaiting a commercial decision" description="Published loads will appear when carriers submit quotes." />} />
      </Panel>
      <div style={{ display: 'grid', gap: '0.9rem' }}>
        <Panel title="Operational exceptions" description="Jobs that need broker intervention before the customer is affected.">
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            <button onClick={() => router.push('/broker/awards')} style={summaryButton}><span>Awaiting carrier award</span><strong>{metrics.awaitingAward}</strong></button>
            <button onClick={() => router.push('/broker/jobs')} style={summaryButton}><span>Active jobs</span><strong>{metrics.active}</strong></button>
            <button onClick={() => router.push('/broker/pod-review')} style={summaryButton}><span>POD awaiting review</span><strong>{metrics.pod}</strong></button>
          </div>
        </Panel>
        <Panel title="Recent customer loads" description="Latest activity in the broker book.">
          {data.jobs.slice(0, 5).map((job) => <button key={job.id} onClick={() => router.push(`/broker/loads?job=${job.id}`)} style={{ ...summaryButton, display: 'grid', gridTemplateColumns: '1fr auto', textAlign: 'left' }}><span><strong style={{ display: 'block' }}>{job.client_name ?? 'Customer load'}</strong><small style={{ color: '#64748b' }}>{job.pickup_postcode ?? job.pickup_location} → {job.delivery_postcode ?? job.delivery_location}</small></span><StatusBadge value={job.status} /></button>)}
          {data.jobs.length === 0 && <EmptyState title="No customer loads" />}
        </Panel>
      </div>
    </TwoColumn>
  </PageFrame>;
}

const summaryButton = { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.62rem 0.68rem', background: '#f8fafc', color: '#0f172a', fontSize: '0.76rem', cursor: 'pointer' } as const;

export function BrokerCustomersPage() {
  const router = useRouter(); const data = useCompanyWorkspaceData();
  const customers = useMemo(() => {
    const map = new Map<string, { name: string; jobs: number; active: number; revenue: number; last: string }>();
    for (const job of data.jobs) {
      const name = job.client_name?.trim() || 'Unassigned customer';
      const current = map.get(name) ?? { name, jobs: 0, active: 0, revenue: 0, last: job.updated_at };
      current.jobs += 1; current.active += active.has(job.current_status ?? job.status) ? 1 : 0; current.revenue += Number(job.budget_amount ?? 0); if (job.updated_at > current.last) current.last = job.updated_at; map.set(name, current);
    }
    return [...map.values()].sort((a, b) => b.last.localeCompare(a.last));
  }, [data.jobs]);
  return <PageFrame><PageHeader eyebrow="Broker customers" title="Customers" description="Customer records are built from managed loads and commercial activity. Add a load to create or extend a customer relationship." actions={<ActionButton tone="warning" onClick={() => router.push('/broker/post-load')}>Create Load</ActionButton>} /><Panel title="Customer book"><DataTable columns={['Customer', 'Loads', 'Active jobs', 'Revenue', 'Last activity', 'Action']} rows={customers.map((customer) => [<strong key="name">{customer.name}</strong>, customer.jobs, customer.active, money(customer.revenue), when(customer.last), <ActionButton key="action" tone="secondary" onClick={() => router.push(`/broker/loads?customer=${encodeURIComponent(customer.name)}`)}>View loads</ActionButton>])} empty={<EmptyState title="No customers yet" description="Post the first customer load to start the broker customer book." />} /></Panel></PageFrame>;
}

export function BrokerLoadsPage() {
  const router = useRouter(); const data = useCompanyWorkspaceData();
  return <PageFrame><PageHeader eyebrow="Customer loads" title="Customer Loads" description="All transport requests managed by the broker, from draft through POD and completion." actions={<ActionButton tone="warning" onClick={() => router.push('/broker/post-load')}>Post Load</ActionButton>} />{data.error && <AlertBanner>{data.error}</AlertBanner>}<Panel title="Load register" description="Use the commercial status to move work from publication to award and operation."><DataTable columns={['Reference', 'Customer', 'Route', 'Pickup', 'Price', 'Quotes', 'Status', 'Action']} rows={data.jobs.map((job) => [job.id.slice(0, 8).toUpperCase(), job.client_name ?? 'Customer', <strong key="route">{job.pickup_postcode ?? job.pickup_location} → {job.delivery_postcode ?? job.delivery_location}</strong>, when(job.pickup_datetime), money(Number(job.budget_amount ?? 0)), data.bids.filter((bid) => bid.job_id === job.id && bid.status === 'submitted').length, <StatusBadge key="status" value={job.current_status ?? job.status} />, <ActionButton key="action" tone="secondary" onClick={() => router.push(`/broker/compare-quotes?job=${job.id}`)}>Open</ActionButton>])} empty={<EmptyState title="No customer loads" action={<ActionButton tone="warning" onClick={() => router.push('/broker/post-load')}>Post first load</ActionButton>} />} /></Panel></PageFrame>;
}

export function BrokerPostLoadPage() { return <PageFrame><PageHeader eyebrow="Customer load" title="Post Load" description="Create the customer transport request, set the commercial target and publish it to carrier capacity." /><LoadPostingForm mode="broker" /></PageFrame>; }

export function BrokerQuotesPage({ compare = false }: { compare?: boolean }) {
  const data = useCompanyWorkspaceData(); const router = useRouter(); const [working, setWorking] = useState<string | null>(null); const [message, setMessage] = useState('');
  const grouped = useMemo(() => data.jobs.map((job) => ({ job, quotes: data.bids.filter((bid) => bid.job_id === job.id && ['submitted', 'accepted', 'rejected'].includes(bid.status)) })).filter((group) => group.quotes.length > 0), [data]);
  const award = async (bidId: string) => { setWorking(bidId); setMessage(''); const { data: session } = await supabase.auth.getSession(); const response = await fetch(`/api/customer/bids/${bidId}/award`, { method: 'POST', headers: session.session?.access_token ? { Authorization: `Bearer ${session.session.access_token}` } : {} }); const payload = await response.json().catch(() => ({})) as { error?: string }; setWorking(null); if (!response.ok) { setMessage(payload.error ?? 'Unable to award this carrier quote.'); return; } setMessage('Carrier quote awarded successfully.'); await data.refresh(); };
  return <PageFrame><PageHeader eyebrow="Carrier sourcing" title={compare ? 'Compare Quotes' : 'Carrier Quotes'} description={compare ? 'Compare carrier price, estimated margin and compliance context before award.' : 'All carrier commercial responses received for broker-managed customer loads.'} actions={<ActionButton tone="secondary" onClick={() => router.push(compare ? '/broker/bids' : '/broker/compare-quotes')}>{compare ? 'All Quotes' : 'Compare'}</ActionButton>} />{message && <AlertBanner tone={message.includes('successfully') ? 'success' : 'danger'}>{message}</AlertBanner>}{grouped.map(({ job, quotes }) => <Panel key={job.id} title={`${job.pickup_postcode ?? job.pickup_location} → ${job.delivery_postcode ?? job.delivery_location}`} description={`${job.client_name ?? 'Customer'} · customer revenue ${money(Number(job.budget_amount ?? 0))}`} style={{ marginBottom: '0.85rem' }}><DataTable columns={compare ? ['Carrier', 'Quote', 'Customer revenue', 'Gross profit', 'Margin', 'Status', 'Decision'] : ['Carrier', 'Quote', 'Message', 'Submitted', 'Status', 'Decision']} rows={quotes.sort((a, b) => Number(a.bid_price_gbp ?? a.amount ?? 0) - Number(b.bid_price_gbp ?? b.amount ?? 0)).map((bid) => { const cost = Number(bid.bid_price_gbp ?? bid.amount ?? 0); const revenue = Number(job.budget_amount ?? 0); return compare ? [bid.companies?.name ?? 'Carrier', money(cost), money(revenue), money(revenue - cost), revenue > 0 ? `${(((revenue - cost) / revenue) * 100).toFixed(1)}%` : '—', <StatusBadge key="status" value={bid.status} />, bid.status === 'submitted' ? <ActionButton key="award" tone="success" disabled={working === bid.id} onClick={() => void award(bid.id)}>{working === bid.id ? 'Awarding…' : 'Award'}</ActionButton> : '—'] : [bid.companies?.name ?? 'Carrier', money(cost), bid.message ?? 'No message', when(bid.created_at), <StatusBadge key="status" value={bid.status} />, bid.status === 'submitted' ? <ActionButton key="award" tone="success" disabled={working === bid.id} onClick={() => void award(bid.id)}>{working === bid.id ? 'Awarding…' : 'Award'}</ActionButton> : '—']; })} /></Panel>)}{grouped.length === 0 && <Panel><EmptyState title="No carrier quotes received" description="Quotes will appear after a customer load is published to the exchange." /></Panel>}</PageFrame>;
}

export function BrokerAwardsPage() {
  const data = useCompanyWorkspaceData(); const router = useRouter(); const awarded = data.jobs.filter((job) => job.awarded_carrier_company_id || ['awarded', 'allocated'].includes(job.status));
  return <PageFrame><PageHeader eyebrow="Carrier awards" title="Awards" description="Loads with a selected carrier and the transition into operational confirmation." /><Panel title="Award register"><DataTable columns={['Load', 'Customer', 'Route', 'Pickup', 'Status', 'Action']} rows={awarded.map((job) => [job.id.slice(0, 8).toUpperCase(), job.client_name ?? 'Customer', `${job.pickup_postcode ?? job.pickup_location} → ${job.delivery_postcode ?? job.delivery_location}`, when(job.pickup_datetime), <StatusBadge key="status" value={job.current_status ?? job.status} />, <ActionButton key="action" tone="secondary" onClick={() => router.push(`/broker/jobs?job=${job.id}`)}>Track</ActionButton>])} empty={<EmptyState title="No carrier awards" description="Awarded carrier quotes will appear here." />} /></Panel></PageFrame>;
}

export function BrokerJobsPage() {
  const data = useCompanyWorkspaceData(); const jobs = data.jobs.filter((job) => active.has(job.current_status ?? job.status) || ['delivered', 'completed'].includes(job.status));
  return <PageFrame><PageHeader eyebrow="Broker operations" title="Active Jobs" description="Track carrier confirmation, collection, delivery, delays and customer updates." /><Panel title="Operational job board"><DataTable columns={['Load', 'Route', 'Pickup', 'Delivery', 'Vehicle', 'Status', 'POD']} rows={jobs.map((job) => [job.id.slice(0, 8).toUpperCase(), <strong key="route">{job.pickup_location} → {job.delivery_location}</strong>, when(job.pickup_datetime), when(job.delivery_datetime), (job.vehicle_type ?? 'Not specified').replace(/_/g, ' '), <StatusBadge key="status" value={job.current_status ?? job.status} />, (job.delivery_photos?.length ?? 0) > 0 ? <StatusBadge key="pod" value="ready" tone="green" /> : <StatusBadge key="pod" value="pending" tone="orange" />])} empty={<EmptyState title="No active jobs" />} /></Panel></PageFrame>;
}

export function BrokerPodPage() {
  const data = useCompanyWorkspaceData(); const rows = data.jobs.filter((job) => ['delivered', 'completed'].includes(job.status));
  return <PageFrame><PageHeader eyebrow="Proof of delivery" title="POD Review" description="Review proof before releasing customer invoicing and carrier cost approval." /><Panel title="POD queue"><DataTable columns={['Load', 'Customer', 'Route', 'Delivery status', 'POD', 'Next action']} rows={rows.map((job) => [job.id.slice(0, 8).toUpperCase(), job.client_name ?? 'Customer', `${job.pickup_postcode ?? job.pickup_location} → ${job.delivery_postcode ?? job.delivery_location}`, <StatusBadge key="delivery" value={job.status} />, (job.delivery_photos?.length ?? 0) > 0 ? `${job.delivery_photos?.length} file(s)` : 'Missing', (job.delivery_photos?.length ?? 0) > 0 ? <StatusBadge key="next" value="Ready for review" tone="green" /> : <StatusBadge key="next" value="Request POD" tone="orange" />])} empty={<EmptyState title="No delivered jobs awaiting POD review" />} /></Panel></PageFrame>;
}

export function BrokerMarginsPage() {
  const data = useCompanyWorkspaceData();
  const rows = data.jobs.map((job) => { const acceptedBid = data.bids.find((bid) => bid.job_id === job.id && bid.status === 'accepted'); const revenue = Number(job.budget_amount ?? 0); const cost = Number(acceptedBid?.bid_price_gbp ?? acceptedBid?.amount ?? 0); return { job, revenue, cost, margin: revenue - cost, pct: revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0 }; });
  return <PageFrame><PageHeader eyebrow="Broker finance" title="Margin / Profit" description="Customer revenue and carrier cost remain separate for every load." /><KpiGrid><KpiCard label="Customer revenue" value={money(rows.reduce((sum, row) => sum + row.revenue, 0))} /><KpiCard label="Carrier cost" value={money(rows.reduce((sum, row) => sum + row.cost, 0))} tone="orange" /><KpiCard label="Gross profit" value={money(rows.reduce((sum, row) => sum + row.margin, 0))} tone="green" /></KpiGrid><Panel title="Job margin register"><DataTable columns={['Load', 'Customer', 'Revenue', 'Carrier cost', 'Gross profit', 'Margin']} rows={rows.map(({ job, revenue, cost, margin, pct }) => [job.id.slice(0, 8).toUpperCase(), job.client_name ?? 'Customer', money(revenue), money(cost), <strong key="margin" style={{ color: margin >= 0 ? '#15803d' : '#dc2626' }}>{money(margin)}</strong>, `${pct.toFixed(1)}%`])} /></Panel></PageFrame>;
}

export function BrokerInvoicesPage({ type }: { type: 'customer' | 'carrier' }) {
  const data = useCompanyWorkspaceData(); const rows = data.invoices.filter((invoice) => type === 'customer' ? invoice.company_id === data.companyId : invoice.buyer_company_id === data.companyId);
  return <PageFrame><PageHeader eyebrow="Broker finance" title={type === 'customer' ? 'Customer Invoices' : 'Carrier Costs'} description={type === 'customer' ? 'Revenue invoices issued by the broker to customers.' : 'Carrier invoices and agreed transport costs payable by the broker.'} /><Panel title={type === 'customer' ? 'Customer invoice register' : 'Carrier cost register'}><DataTable columns={['Invoice', 'Job', 'Counterparty', 'Amount', 'Due', 'Status']} rows={rows.map((invoice) => [invoice.invoice_number ?? invoice.id.slice(0, 8), invoice.job_id?.slice(0, 8) ?? '—', invoice.client_name ?? (type === 'customer' ? 'Customer' : 'Carrier'), money(Number(invoice.amount ?? 0)), invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-GB') : 'Not set', <StatusBadge key="status" value={invoice.payment_status ?? invoice.status} />])} empty={<EmptyState title={type === 'customer' ? 'No customer invoices' : 'No carrier costs'} />} /></Panel></PageFrame>;
}


type BrokerDispute = {
  id: string;
  job_id: string;
  raised_by_company_id: string;
  status: string;
  description: string | null;
  resolution_note: string | null;
  created_at: string;
};

export function BrokerDisputesPage() {
  const data = useCompanyWorkspaceData();
  const [rows, setRows] = useState<BrokerDispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!data.companyId) {
        if (!cancelled) { setRows([]); setLoading(false); }
        return;
      }
      setLoading(true);
      setError('');
      const jobIds = data.jobs.map((job) => job.id);
      let query = supabase
        .from('job_disputes')
        .select('id, job_id, raised_by_company_id, status, description, resolution_note, created_at')
        .order('created_at', { ascending: false })
        .limit(250);
      query = jobIds.length > 0
        ? query.or(`raised_by_company_id.eq.${data.companyId},job_id.in.(${jobIds.join(',')})`)
        : query.eq('raised_by_company_id', data.companyId);
      const { data: result, error: queryError } = await query;
      if (cancelled) return;
      if (queryError) {
        setError(queryError.message);
        setRows([]);
      } else {
        setRows((result ?? []) as BrokerDispute[]);
      }
      setLoading(false);
    };
    void load();
    return () => { cancelled = true; };
  }, [data.companyId, data.jobs]);

  return <PageFrame>
    <PageHeader eyebrow="Commercial exceptions" title="Disputes" description="Customer, carrier and POD disputes linked only to broker-managed loads." />
    {error && <AlertBanner tone="danger">{error}</AlertBanner>}
    <KpiGrid>
      <KpiCard label="Open" value={rows.filter((row) => row.status === 'open').length} tone="red" />
      <KpiCard label="Investigating" value={rows.filter((row) => row.status === 'investigating').length} tone="orange" />
      <KpiCard label="Resolved" value={rows.filter((row) => ['resolved', 'closed'].includes(row.status)).length} tone="green" />
    </KpiGrid>
    <Panel title="Dispute register">
      <DataTable
        columns={['Job', 'Raised by', 'Issue', 'Opened', 'Status', 'Resolution']}
        rows={rows.map((row) => [
          row.job_id.slice(0, 8).toUpperCase(),
          row.raised_by_company_id === data.companyId ? 'Broker company' : 'Trading partner',
          row.description ?? 'No description recorded',
          when(row.created_at),
          <StatusBadge key="status" value={row.status} />,
          row.resolution_note ?? 'Pending',
        ])}
        empty={<EmptyState title={loading ? 'Loading disputes…' : 'No disputes found'} description="Disputes raised against broker-managed loads will appear here." />}
      />
    </Panel>
  </PageFrame>;
}

export function BrokerSettingsPage() { return <PageFrame><PageHeader eyebrow="Broker administration" title="Settings" description="Company profile, customer payment terms, margin thresholds, notification rules and team permissions." /><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: '0.9rem' }}>{['Company profile','Customer payment terms','Carrier sourcing rules','Margin guardrails','Notifications','Team and permissions'].map((title) => <Panel key={title} title={title}><p style={{ color: '#64748b', fontSize: '0.78rem', lineHeight: 1.5, margin: 0 }}>Configuration is isolated to the broker company and must not expose another company&apos;s data.</p></Panel>)}</div></PageFrame>; }
