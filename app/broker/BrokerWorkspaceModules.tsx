'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { invoiceNetAmount, isAwaitingPayment, isCarrierPayableInvoice, isOverdue, isRevenueInvoice } from '../../lib/brokerFinance';
import LoadPostingForm from '../components/workspace/LoadPostingForm';
import { useCompanyWorkspaceData } from '../components/workspace/useCompanyWorkspaceData';
import { ActionButton, AlertBanner, DataTable, EmptyState, KpiCard, KpiGrid, PageFrame, PageHeader, Panel, StatusBadge, TwoColumn } from '../components/workspace/WorkspaceUI';

const money = (value: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);
const when = (value: string | null | undefined) => value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not set';
const active = new Set(['awarded', 'allocated', 'accepted', 'on_my_way', 'on_my_way_to_pickup', 'on_site_pickup', 'loaded', 'collected', 'in_transit', 'on_my_way_to_delivery', 'on_site_delivery']);

export function BrokerDashboard() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();
  const [spendPeriod, setSpendPeriod] = useState<'month' | 'quarter' | 'year'>('month');
  const metrics = useMemo(() => {
    const submitted = data.bids.filter((bid) => bid.status === 'submitted');
    const accepted = data.bids.filter((bid) => bid.status === 'accepted');
    const estimatedCustomerBudget = data.jobs.reduce((sum, job) => sum + Number(job.budget_amount ?? 0), 0);
    const estimatedCarrierCost = accepted.reduce((sum, bid) => sum + Number(bid.bid_price_gbp ?? bid.amount ?? 0), 0);
    const issuedRevenueInvoices = data.invoices.filter((inv) => isRevenueInvoice(inv, data.companyId));
    const supplierPayableInvoices = data.invoices.filter((inv) => isCarrierPayableInvoice(inv, data.companyId));
    const invoicedRevenueNet = issuedRevenueInvoices.reduce((sum, inv) => sum + invoiceNetAmount(inv), 0);
    const supplierPayablesNet = supplierPayableInvoices.reduce((sum, inv) => sum + invoiceNetAmount(inv), 0);
    const awaitingAwardJobs = data.jobs.filter((job) => !job.awarded_carrier_company_id && submitted.some((bid) => bid.job_id === job.id));
    const activeJobs = data.jobs.filter((job) => active.has(job.current_status ?? job.status));
    const podPending = data.jobs.filter((job) => ['delivered', 'completed'].includes(job.status) && (job.delivery_photos?.length ?? 0) === 0);
    const awaitingRevenueInvoices = issuedRevenueInvoices.filter((inv) => isAwaitingPayment(inv));
    const awaitingRevenueValue = awaitingRevenueInvoices.reduce((sum, inv) => sum + invoiceNetAmount(inv), 0);
    const overdueRevenueInvoices = issuedRevenueInvoices.filter((inv) => isOverdue(inv));

    const now = Date.now();
    const dueForPayment = awaitingRevenueInvoices.filter((inv) => inv.due_date && new Date(inv.due_date).getTime() <= now + 7 * 86_400_000);
    const latestInvoices = [...issuedRevenueInvoices].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '')).slice(0, 5);

    // Monthly totals (last 6 months)
    const monthlyTotals: Record<string, { revenue: number; cost: number }> = {};
    for (const job of data.jobs) {
      const d = job.pickup_datetime ?? job.created_at;
      if (!d) continue;
      const key = new Date(d).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
      const row = monthlyTotals[key] ?? { revenue: 0, cost: 0 };
      row.revenue += 0;
      monthlyTotals[key] = row;
    }
    for (const inv of issuedRevenueInvoices) {
      const d = inv.invoice_date ?? inv.created_at;
      if (!d) continue;
      const key = new Date(d).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
      const row = monthlyTotals[key] ?? { revenue: 0, cost: 0 };
      row.revenue += invoiceNetAmount(inv);
      monthlyTotals[key] = row;
    }
    for (const inv of supplierPayableInvoices) {
      const d = inv.invoice_date ?? inv.created_at;
      if (!d) continue;
      const key = new Date(d).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
      const row = monthlyTotals[key] ?? { revenue: 0, cost: 0 };
      row.cost += invoiceNetAmount(inv);
      monthlyTotals[key] = row;
    }
    const monthlyRows = Object.entries(monthlyTotals).slice(-6);

    // Sub-contract spend by period
    const periodMs = spendPeriod === 'month' ? 30 : spendPeriod === 'quarter' ? 91 : 365;
    const periodStart = now - periodMs * 86_400_000;
    const subcontractSpend = supplierPayableInvoices
      .filter((inv) => {
        const d = inv.invoice_date ?? inv.created_at;
        return d && new Date(d).getTime() >= periodStart;
      })
      .reduce((sum, inv) => sum + invoiceNetAmount(inv), 0);

    // Compliance summary from docs
    const docs = data.driverDocuments.concat(data.vehicleDocuments);
    const expiredDocs = docs.filter((doc) => { const d = doc.expiry_date ? Math.ceil((new Date(doc.expiry_date).getTime() - now) / 86_400_000) : null; return d !== null && d < 0; }).length;
    const soonDocs = docs.filter((doc) => { const d = doc.expiry_date ? Math.ceil((new Date(doc.expiry_date).getTime() - now) / 86_400_000) : null; return d !== null && d >= 0 && d <= 30; }).length;
    const currentDocs = docs.length - expiredDocs - soonDocs;

    return {
      draft: data.jobs.filter((job) => job.status === 'draft').length,
      open: data.jobs.filter((job) => ['posted', 'quoted'].includes(job.status)).length,
      quotes: submitted.length,
      awaitingAwardJobs,
      activeJobs,
      podPending,
      margin: invoicedRevenueNet - supplierPayablesNet,
      marginPct: invoicedRevenueNet > 0 ? ((invoicedRevenueNet - supplierPayablesNet) / invoicedRevenueNet) * 100 : 0,
      invoicedRevenueNet,
      supplierPayablesNet,
      estimatedCustomerBudget,
      estimatedCarrierCost,
      awaitingRevenueInvoices,
      awaitingRevenueValue,
      overdueRevenueInvoices,
      supplierPayableInvoices,
      dueForPayment,
      latestInvoices,
      monthlyRows,
      subcontractSpend,
      complianceSummary: { current: currentDocs, expiring: soonDocs, expired: expiredDocs, total: docs.length },
    };
  }, [data, spendPeriod]);

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Broker commercial desk"
        title="Broker Dashboard"
        description="Manage customer loads, source compliant carrier capacity, protect margin and control the job through POD and invoicing."
        actions={<><ActionButton tone="warning" onClick={() => router.push('/broker/post-load')}>Post Load</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/broker/compare-quotes')}>Compare Quotes</ActionButton></>}
      />
      {data.error && <AlertBanner>{data.error}</AlertBanner>}

      <KpiGrid>
        <KpiCard label="Draft loads" value={metrics.draft} detail="Not yet published" onClick={() => router.push('/broker/loads')} />
        <KpiCard label="Open loads" value={metrics.open} detail="Published for carrier pricing" tone="blue" onClick={() => router.push('/broker/loads')} />
        <KpiCard label="Carrier quotes" value={metrics.quotes} detail="Commercial responses received" tone="purple" onClick={() => router.push('/broker/bids')} />
        <KpiCard label="Awaiting award" value={metrics.awaitingAwardJobs.length} detail="Your decision needed" tone="orange" onClick={() => router.push('/broker/compare-quotes')} />
        <KpiCard label="Active jobs" value={metrics.activeJobs.length} detail="Collections and deliveries" tone="green" onClick={() => router.push('/broker/jobs')} />
        <KpiCard label="POD missing" value={metrics.podPending.length} detail="Delivered without proof" tone={metrics.podPending.length ? 'red' : 'navy'} onClick={() => router.push('/broker/pod-review')} />
        <KpiCard label="Gross margin" value={money(metrics.margin)} detail={`${metrics.marginPct.toFixed(1)}% margin`} tone={metrics.margin >= 0 ? 'green' : 'red'} onClick={() => router.push('/broker/margins')} />
        <KpiCard label="Awaiting customer payment" value={metrics.awaitingRevenueInvoices.length} detail={money(metrics.awaitingRevenueValue)} tone={metrics.awaitingRevenueInvoices.length ? 'orange' : 'green'} onClick={() => router.push('/broker/customer-invoices')} />
        <KpiCard label="Due for payment" value={metrics.dueForPayment.length} detail="Due within 7 days" tone={metrics.dueForPayment.length ? 'red' : 'green'} onClick={() => router.push('/broker/customer-invoices')} />
        <KpiCard label="Overdue customer invoices" value={metrics.overdueRevenueInvoices.length} detail={money(metrics.overdueRevenueInvoices.reduce((sum, inv) => sum + invoiceNetAmount(inv), 0))} tone={metrics.overdueRevenueInvoices.length ? 'red' : 'green'} onClick={() => router.push('/broker/customer-invoices')} />
      </KpiGrid>

      {metrics.awaitingAwardJobs.length > 0 && (
        <Panel
          title="Award decisions needed"
          description="These loads have carrier quotes waiting. Select the best option and award before capacity moves elsewhere."
          actions={<ActionButton tone="warning" onClick={() => router.push('/broker/compare-quotes')}>Compare all</ActionButton>}
        >
          <DataTable
            columns={['Customer load', 'Route', 'Quotes', 'Customer budget (est.)', 'Best carrier quote (est.)', 'Estimated margin', 'Action']}
            rows={metrics.awaitingAwardJobs.slice(0, 6).map((job) => {
              const quotes = data.bids.filter((bid) => bid.job_id === job.id && bid.status === 'submitted');
              const costs = quotes.map((b) => Number(b.bid_price_gbp ?? b.amount ?? 0)).filter((p) => p > 0);
              const best = costs.length ? Math.min(...costs) : 0;
              const revenue = Number(job.budget_amount ?? 0);
              return [
                job.client_name ?? 'Customer',
                <strong key="route">{job.pickup_postcode ?? job.pickup_location} → {job.delivery_postcode ?? job.delivery_location}</strong>,
                quotes.length,
                money(revenue),
                best > 0 ? money(best) : '—',
                best > 0 && revenue > 0 ? money(revenue - best) : '—',
                <ActionButton key="action" tone="success" onClick={() => router.push(`/broker/compare-quotes?job=${job.id}`)}>Compare &amp; award</ActionButton>,
              ];
            })}
            empty={<EmptyState title="No loads awaiting award" />}
          />
        </Panel>
      )}

      <TwoColumn>
        <Panel
          title="Active jobs"
          description="Carrier-confirmed jobs in transit. Monitor for delays and exceptions before the customer is affected."
          actions={<ActionButton tone="secondary" onClick={() => router.push('/broker/jobs')}>All jobs</ActionButton>}
        >
          <DataTable
            columns={['Route', 'Customer', 'Pickup', 'Status', 'POD', 'Action']}
            rows={metrics.activeJobs.slice(0, 6).map((job) => [
              <strong key="route">{job.pickup_postcode ?? job.pickup_location} → {job.delivery_postcode ?? job.delivery_location}</strong>,
              job.client_name ?? '—',
              when(job.pickup_datetime),
              <StatusBadge key="status" value={job.current_status ?? job.status} />,
              (job.delivery_photos?.length ?? 0) > 0
                ? <StatusBadge key="pod" value="ready" tone="green" />
                : <StatusBadge key="pod" value="pending" tone="orange" />,
              <ActionButton key="action" tone="secondary" onClick={() => router.push(`/broker/jobs?job=${job.id}`)}>Track</ActionButton>,
            ])}
            empty={<EmptyState title="No active jobs" description="Jobs appear here once a carrier is awarded and confirmed." />}
          />
        </Panel>

        <div style={{ display: 'grid', gap: '0.9rem' }}>
          <Panel
            title="Commercial summary"
            description="Invoiced net amounts are shown separately from operational estimates."
          >
            <div style={{ display: 'grid', gap: '0.55rem' }}>
              {[
                ['Invoiced revenue (net)', money(metrics.invoicedRevenueNet), '#f0fdf4', '#166534'],
                ['Carrier payables (net)', money(metrics.supplierPayablesNet), '#fff7ed', '#c2410c'],
                ['Gross margin', money(metrics.margin), metrics.margin >= 0 ? '#f0fdf4' : '#fef2f2', metrics.margin >= 0 ? '#166534' : '#dc2626'],
                ['Estimated customer budget', money(metrics.estimatedCustomerBudget), '#eff6ff', '#1e40af'],
                ['Estimated carrier quote cost', money(metrics.estimatedCarrierCost), metrics.estimatedCarrierCost > 0 ? '#fff7ed' : '#f8fafc', metrics.estimatedCarrierCost > 0 ? '#c2410c' : '#64748b'],
              ].map(([label, value, bg, color]) => (
                <div key={String(label)} style={{ display: 'flex', justifyContent: 'space-between', background: String(bg), border: `1px solid ${String(color)}20`, borderRadius: '8px', padding: '0.62rem 0.75rem', fontSize: '0.76rem' }}>
                  <span style={{ color: '#475569' }}>{label}</span>
                  <strong style={{ color: String(color) }}>{value}</strong>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Recent customer loads" description="Latest activity in the broker book." actions={<ActionButton tone="secondary" onClick={() => router.push('/broker/loads')}>All loads</ActionButton>}>
            {data.jobs.slice(0, 5).map((job) => (
              <button
                key={job.id}
                onClick={() => router.push(`/broker/loads?job=${job.id}`)}
                style={{ ...summaryButton, display: 'grid', gridTemplateColumns: '1fr auto', textAlign: 'left' }}
              >
                <span>
                  <strong style={{ display: 'block' }}>{job.client_name ?? 'Customer load'}</strong>
                  <small style={{ color: '#64748b' }}>{job.pickup_postcode ?? job.pickup_location} → {job.delivery_postcode ?? job.delivery_location}</small>
                </span>
                <StatusBadge value={job.status} />
              </button>
            ))}
            {data.jobs.length === 0 && <EmptyState title="No customer loads" />}
          </Panel>

          <Panel title="Quick actions" description="Shortcuts for the broker control desk.">
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {[
                ['Post customer load', '/broker/post-load'],
                ['Compare carrier quotes', '/broker/compare-quotes'],
                ['Open disputes', '/broker/disputes'],
                ['Manage carrier network', '/broker/carrier-network'],
                ['Review invoices', '/broker/customer-invoices'],
                ['View margins', '/broker/margins'],
              ].map(([label, href]) => (
                <button key={href} onClick={() => router.push(href)} style={summaryButton}>
                  <span>{label}</span><span>→</span>
                </button>
              ))}
            </div>
          </Panel>
        </div>
      </TwoColumn>

      <TwoColumn>
        <Panel
          title="Monthly totals"
          description="Invoiced net revenue vs supplier payable net by invoice month."
          actions={<ActionButton tone="secondary" onClick={() => router.push('/broker/margins')}>Full report</ActionButton>}
        >
          {metrics.monthlyRows.length > 0 ? (
            <div style={{ display: 'grid', gap: '0.45rem' }}>
              {metrics.monthlyRows.map(([month, row]) => {
                const rev = row.revenue;
                const cost = row.cost;
                const margin = rev - cost;
                const maxVal = Math.max(rev, 1);
                return (
                  <div key={month} style={{ display: 'grid', gridTemplateColumns: '60px 1fr auto', gap: '0.6rem', alignItems: 'center', fontSize: '0.73rem' }}>
                    <span style={{ color: '#64748b', fontWeight: 700 }}>{month}</span>
                    <div style={{ display: 'grid', gap: '2px' }}>
                      <div style={{ background: '#dcfce7', borderRadius: '3px', height: '7px', width: `${Math.max(2, (rev / maxVal) * 100)}%` }} title={`Invoiced net: ${money(rev)}`} />
                      <div style={{ background: '#fed7aa', borderRadius: '3px', height: '7px', width: `${Math.max(2, (cost / maxVal) * 100)}%` }} title={`Cost: ${money(cost)}`} />
                    </div>
                    <span style={{ color: margin >= 0 ? '#15803d' : '#dc2626', fontWeight: 800, minWidth: '70px', textAlign: 'right' }}>{money(margin)}</span>
                  </div>
                );
              })}
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.3rem', fontSize: '0.64rem', color: '#64748b' }}>
                <span><span style={{ background: '#dcfce7', borderRadius: '2px', display: 'inline-block', width: '10px', height: '8px', marginRight: '4px' }} />Invoiced net</span>
                <span><span style={{ background: '#fed7aa', borderRadius: '2px', display: 'inline-block', width: '10px', height: '8px', marginRight: '4px' }} />Carrier cost</span>
              </div>
            </div>
          ) : (
            <div style={{ color: '#64748b', fontSize: '0.76rem', padding: '0.8rem 0' }}>No load history to display.</div>
          )}
        </Panel>

        <div style={{ display: 'grid', gap: '0.9rem' }}>
          <Panel
            title="Sub-contract spend"
            description="Total carrier costs excluding own-driver jobs."
            actions={
              <select
                value={spendPeriod}
                onChange={(e) => setSpendPeriod(e.target.value as 'month' | 'quarter' | 'year')}
                style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.3rem 0.5rem', fontSize: '0.72rem', background: '#fff' }}
              >
                <option value="month">Last 30 days</option>
                <option value="quarter">Last 90 days</option>
                <option value="year">Last 365 days</option>
              </select>
            }
          >
            <div style={{ display: 'grid', gap: '0.45rem' }}>
              <div style={{ fontSize: '1.55rem', fontWeight: 900, color: '#c2410c' }}>{money(metrics.subcontractSpend)}</div>
              <div style={{ fontSize: '0.73rem', color: '#64748b' }}>Total agreed with sub-contractors ({spendPeriod === 'month' ? '30' : spendPeriod === 'quarter' ? '90' : '365'} days)</div>
              <div style={{ display: 'flex', gap: '0.55rem', marginTop: '0.3rem', flexWrap: 'wrap' }}>
                {[
                  ['Latest invoices received', '/broker/carrier-costs'],
                  ['Invoices due for payment', '/broker/customer-invoices'],
                  ['Invoices awaiting payment', '/broker/customer-invoices'],
                  ['Monthly totals', '/broker/margins'],
                ].map(([label, href]) => (
                  <button key={label} onClick={() => router.push(href)} style={{ border: '1px solid #e2e8f0', borderRadius: '6px', background: '#f8fafc', color: '#0f172a', padding: '0.32rem 0.6rem', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}>{label}</button>
                ))}
              </div>
            </div>
          </Panel>

          <Panel
            title="Supplier compliance"
            description="Document status across carriers in your network."
            actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/documents/expiry')}>View all</ActionButton>}
          >
            {metrics.complianceSummary.total > 0 ? (
              <div>
                <div style={{ display: 'grid', gap: '0.42rem' }}>
                  {[
                    ['Fully compliant', metrics.complianceSummary.current, '#166534', '#ecfdf3', '#bbf7d0'],
                    ['About to expire', metrics.complianceSummary.expiring, '#92400e', '#fffbeb', '#fde68a'],
                    ['Updates needed', metrics.complianceSummary.expired, '#b91c1c', '#fef2f2', '#fecaca'],
                  ].map(([label, count, color, bg, border]) => {
                    const pct = metrics.complianceSummary.total > 0 ? Math.round((Number(count) / metrics.complianceSummary.total) * 100) : 0;
                    return (
                      <div key={String(label)} style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: String(bg), border: `2px solid ${String(border)}`, flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: '0.73rem', color: '#475569' }}>{label}</span>
                        <strong style={{ fontSize: '0.73rem', color: String(color) }}>{count}</strong>
                        <span style={{ fontSize: '0.68rem', color: '#94a3b8', minWidth: '32px', textAlign: 'right' }}>{pct}%</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: '0.6rem', height: '8px', borderRadius: '999px', overflow: 'hidden', display: 'flex', background: '#e2e8f0' }}>
                  {metrics.complianceSummary.current > 0 && <div style={{ width: `${(metrics.complianceSummary.current / metrics.complianceSummary.total) * 100}%`, background: '#16a34a' }} />}
                  {metrics.complianceSummary.expiring > 0 && <div style={{ width: `${(metrics.complianceSummary.expiring / metrics.complianceSummary.total) * 100}%`, background: '#f59e0b' }} />}
                  {metrics.complianceSummary.expired > 0 && <div style={{ width: `${(metrics.complianceSummary.expired / metrics.complianceSummary.total) * 100}%`, background: '#ef4444' }} />}
                </div>
              </div>
            ) : (
              <div style={{ color: '#64748b', fontSize: '0.76rem', padding: '0.4rem 0' }}>No compliance documents on record.</div>
            )}
          </Panel>
        </div>
      </TwoColumn>

      <Panel
        title="Latest invoices received"
        description="Most recent customer invoices across all loads."
        actions={<ActionButton tone="secondary" onClick={() => router.push('/broker/customer-invoices')}>All invoices</ActionButton>}
      >
        <DataTable
          columns={['Invoice', 'Customer', 'Amount', 'Due', 'Status']}
          rows={metrics.latestInvoices.map((inv) => [
            inv.invoice_number ?? inv.id.slice(0, 8).toUpperCase(),
            inv.client_name ?? 'Customer',
            money(Number(inv.amount ?? 0)),
            inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-GB') : 'Not set',
            <StatusBadge key="status" value={inv.payment_status ?? inv.status} />,
          ])}
          empty={<EmptyState title="No invoices yet" />}
        />
      </Panel>
    </PageFrame>
  );
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

export function getBrokerCustomerFilter(searchParams: Pick<URLSearchParams, 'get'>): string | null {
  return searchParams.get('customer');
}

export function BrokerLoadsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobFilter = searchParams.get('job');
  const customerFilter = getBrokerCustomerFilter(searchParams);
  const data = useCompanyWorkspaceData();
  const filteredJobs = useMemo(() => {
    let result = data.jobs;
    if (jobFilter) result = result.filter((j) => j.id === jobFilter);
    if (customerFilter) result = result.filter((j) => (j.client_name ?? '').toLowerCase() === customerFilter.toLowerCase());
    return result;
  }, [data.jobs, jobFilter, customerFilter]);
  const filterNote = jobFilter ? `Showing load ${jobFilter.slice(0, 8).toUpperCase()} only. ` : customerFilter ? `Showing loads for customer "${customerFilter}" only. ` : '';
  return <PageFrame><PageHeader eyebrow="Customer loads" title="Customer Loads" description="All transport requests managed by the broker, from draft through POD and completion." actions={<ActionButton tone="warning" onClick={() => router.push('/broker/post-load')}>Post Load</ActionButton>} />{data.error && <AlertBanner>{data.error}</AlertBanner>}{filterNote && <AlertBanner tone="info">{filterNote}<ActionButton tone="secondary" onClick={() => router.push('/broker/loads')}>Show all loads</ActionButton></AlertBanner>}<Panel title="Load register" description="Use the commercial status to move work from publication to award and operation."><DataTable columns={['Reference', 'Customer', 'Route', 'Pickup', 'Budget (est.)', 'Quotes', 'Status', 'Action']} rows={filteredJobs.map((job) => [job.id.slice(0, 8).toUpperCase(), job.client_name ?? 'Customer', <strong key="route">{job.pickup_postcode ?? job.pickup_location} → {job.delivery_postcode ?? job.delivery_location}</strong>, when(job.pickup_datetime), money(Number(job.budget_amount ?? 0)), data.bids.filter((bid) => bid.job_id === job.id && bid.status === 'submitted').length, <StatusBadge key="status" value={job.current_status ?? job.status} />, <ActionButton key="action" tone="secondary" onClick={() => router.push(`/broker/compare-quotes?job=${job.id}`)}>Open</ActionButton>])} empty={<EmptyState title="No customer loads" action={<ActionButton tone="warning" onClick={() => router.push('/broker/post-load')}>Post first load</ActionButton>} />} /></Panel></PageFrame>;
}

export function BrokerPostLoadPage() { return <PageFrame><PageHeader eyebrow="Customer load" title="Post Load" description="Create the customer transport request, set the commercial target and publish it to carrier capacity." /><LoadPostingForm mode="broker" /></PageFrame>; }

export function BrokerQuotesPage({ compare = false }: { compare?: boolean }) {
  const data = useCompanyWorkspaceData();
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get('job');
  const [working, setWorking] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'received' | 'archived' | 'unsuccessful'>('received');

  const grouped = useMemo(() => {
    const all = data.jobs.map((job) => ({
      job,
      quotes: data.bids.filter((bid) => bid.job_id === job.id && ['submitted', 'accepted', 'rejected', 'archived', 'unsuccessful', 'cancelled'].includes(bid.status)),
    })).filter((group) => group.quotes.length > 0);
    return jobId ? all.filter(({ job }) => job.id === jobId) : all;
  }, [data, jobId]);

  const filteredGrouped = useMemo(() => {
    if (activeTab === 'received') {
      return grouped.map(({ job, quotes }) => ({ job, quotes: quotes.filter((b) => ['submitted', 'accepted'].includes(b.status)) })).filter((g) => g.quotes.length > 0);
    }
    if (activeTab === 'archived') {
      return grouped.map(({ job, quotes }) => ({ job, quotes: quotes.filter((b) => ['archived', 'cancelled'].includes(b.status)) })).filter((g) => g.quotes.length > 0);
    }
    return grouped.map(({ job, quotes }) => ({ job, quotes: quotes.filter((b) => b.status === 'rejected') })).filter((g) => g.quotes.length > 0);
  }, [grouped, activeTab]);

  const award = async (bidId: string) => {
    setWorking(bidId);
    setMessage('');
    const { data: session } = await supabase.auth.getSession();
    const response = await fetch(`/api/customer/bids/${bidId}/award`, {
      method: 'POST',
      headers: session.session?.access_token ? { Authorization: 'Bearer ' + session.session.access_token } : {},
    });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    setWorking(null);
    if (!response.ok) { setMessage(payload.error ?? 'Unable to award this carrier quote.'); return; }
    setMessage('Carrier quote awarded successfully.');
    await data.refresh();
  };

  const tabs: Array<{ id: typeof activeTab; label: string }> = [
    { id: 'received', label: 'Received' },
    { id: 'archived', label: 'Archived' },
    { id: 'unsuccessful', label: 'Unsuccessful' },
  ];

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Carrier sourcing"
        title={compare ? 'Compare Quotes' : 'Carrier Quotes'}
        description={compare ? 'Compare carrier price, estimated margin and compliance context before award.' : 'All carrier commercial responses received for broker-managed customer loads.'}
        actions={<ActionButton tone="secondary" onClick={() => router.push(compare ? '/broker/bids' : '/broker/compare-quotes')}>{compare ? 'All Quotes' : 'Compare'}</ActionButton>}
      />
      {message && <AlertBanner tone={message.includes('successfully') ? 'success' : 'danger'}>{message}</AlertBanner>}

      <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.9rem', borderBottom: '1px solid #e2e8f0' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              border: 0,
              borderBottom: activeTab === tab.id ? '2px solid #1d57d8' : '2px solid transparent',
              background: 'transparent',
              color: activeTab === tab.id ? '#1d57d8' : '#64748b',
              padding: '0.52rem 0.85rem',
              fontSize: '0.78rem',
              fontWeight: activeTab === tab.id ? 800 : 600,
              cursor: 'pointer',
              marginBottom: '-1px',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filteredGrouped.map(({ job, quotes }) => (
        <Panel
          key={job.id}
          title={`${job.pickup_postcode ?? job.pickup_location} → ${job.delivery_postcode ?? job.delivery_location}`}
          description={`${job.client_name ?? 'Customer'} · customer budget estimate ${money(Number(job.budget_amount ?? 0))}`}
          style={{ marginBottom: '0.85rem' }}
        >
          <DataTable
            columns={compare ? ['Carrier', 'Quote', 'Customer budget (est.)', 'Estimated gross profit', 'Estimated margin', 'Status', 'Decision'] : ['Carrier', 'Quote', 'Message', 'Submitted', 'Status', 'Decision']}
            rows={quotes.sort((a, b) => Number(a.bid_price_gbp ?? a.amount ?? 0) - Number(b.bid_price_gbp ?? b.amount ?? 0)).map((bid) => {
              const cost = Number(bid.bid_price_gbp ?? bid.amount ?? 0);
              const revenue = Number(job.budget_amount ?? 0);
              return compare
                ? [bid.companies?.name ?? 'Carrier', money(cost), money(revenue), money(revenue - cost), revenue > 0 ? `${(((revenue - cost) / revenue) * 100).toFixed(1)}%` : '—', <StatusBadge key="status" value={bid.status} />, bid.status === 'submitted' ? <ActionButton key="award" tone="success" disabled={working === bid.id} onClick={() => void award(bid.id)}>{working === bid.id ? 'Awarding…' : 'Award'}</ActionButton> : '—']
                : [bid.companies?.name ?? 'Carrier', money(cost), bid.message ?? 'No message', when(bid.created_at), <StatusBadge key="status" value={bid.status} />, bid.status === 'submitted' ? <ActionButton key="award" tone="success" disabled={working === bid.id} onClick={() => void award(bid.id)}>{working === bid.id ? 'Awarding…' : 'Award'}</ActionButton> : '—'];
            })}
          />
        </Panel>
      ))}
      {filteredGrouped.length === 0 && (
        <Panel>
          <EmptyState
            title={activeTab === 'received' ? 'No carrier quotes received' : activeTab === 'archived' ? 'No archived quotes' : 'No unsuccessful quotes'}
            description={activeTab === 'received' ? 'Quotes will appear after a customer load is published to the exchange.' : activeTab === 'archived' ? 'Cancelled or archived quotes will appear here.' : 'Rejected carrier quotes will appear here.'}
          />
        </Panel>
      )}
    </PageFrame>
  );
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
  return <PageFrame><PageHeader eyebrow="Broker finance" title="Estimated Margin" description="This view is estimate-only (customer budget vs accepted/lowest carrier quote), not invoiced accounting." /><KpiGrid><KpiCard label="Customer budget estimate" value={money(rows.reduce((sum, row) => sum + row.revenue, 0))} /><KpiCard label="Carrier quote estimate" value={money(rows.reduce((sum, row) => sum + row.cost, 0))} tone="orange" /><KpiCard label="Estimated gross margin" value={money(rows.reduce((sum, row) => sum + row.margin, 0))} tone="green" /></KpiGrid><Panel title="Estimated job margin register"><DataTable columns={['Load', 'Customer', 'Budget (est.)', 'Carrier quote (est.)', 'Estimated gross margin', 'Estimated margin']} rows={rows.map(({ job, revenue, cost, margin, pct }) => [job.id.slice(0, 8).toUpperCase(), job.client_name ?? 'Customer', money(revenue), money(cost), <strong key="margin" style={{ color: margin >= 0 ? '#15803d' : '#dc2626' }}>{money(margin)}</strong>, `${pct.toFixed(1)}%`])} /></Panel></PageFrame>;
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

const noteInputStyle = { border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.45rem 0.6rem', fontSize: '0.76rem', width: '100%', minWidth: '180px', resize: 'vertical' } as const;

export function BrokerDisputesPage() {
  const data = useCompanyWorkspaceData();
  const [rows, setRows] = useState<BrokerDispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [working, setWorking] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const getAuthHeader = async () => {
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    return token ? 'Bearer ' + token : null;
  };

  const load = async () => {
    if (!data.companyId) { setRows([]); setLoading(false); return; }
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
    if (queryError) { setError(queryError.message); setRows([]); } else { setRows((result ?? []) as BrokerDispute[]); }
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => { if (!cancelled) await load(); };
    void run();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.companyId, data.jobs]);

  const runAction = async (disputeId: string, action: 'resolve' | 'escalate') => {
    setWorking(disputeId);
    setNotice('');
    setError('');
    const auth = await getAuthHeader();
    if (!auth) { setError('Session expired. Please sign in again.'); setWorking(null); return; }
    const response = await fetch(`/api/broker/disputes/${disputeId}`, {
      method: 'PATCH',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, resolution_note: notes[disputeId]?.trim() || undefined }),
    });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    setWorking(null);
    if (!response.ok) { setError(payload.error ?? 'Action failed.'); return; }
    setNotice(action === 'resolve' ? 'Dispute resolved.' : 'Dispute escalated to investigating.');
    setNotes((prev) => { const next = { ...prev }; delete next[disputeId]; return next; });
    await load();
  };

  return <PageFrame>
    <PageHeader eyebrow="Commercial exceptions" title="Disputes" description="Customer, carrier and POD disputes linked only to broker-managed loads." />
    {error && <AlertBanner tone="danger">{error}</AlertBanner>}
    {notice && <AlertBanner tone="success">{notice}</AlertBanner>}
    <KpiGrid>
      <KpiCard label="Open" value={rows.filter((row) => row.status === 'open').length} tone="red" />
      <KpiCard label="Investigating" value={rows.filter((row) => row.status === 'investigating').length} tone="orange" />
      <KpiCard label="Resolved" value={rows.filter((row) => ['resolved', 'closed'].includes(row.status)).length} tone="green" />
    </KpiGrid>
    <Panel title="Dispute register">
      <DataTable
        columns={['Job', 'Raised by', 'Issue', 'Opened', 'Status', 'Resolution note', 'Actions']}
        rows={rows.map((row) => {
          const isActive = !['resolved', 'closed'].includes(row.status);
          return [
            row.job_id.slice(0, 8).toUpperCase(),
            row.raised_by_company_id === data.companyId ? 'Broker company' : 'Trading partner',
            row.description ?? 'No description recorded',
            when(row.created_at),
            <StatusBadge key="status" value={row.status} />,
            row.resolution_note ?? 'Pending',
            isActive ? (
              <div key="actions" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: '200px' }}>
                <textarea
                  placeholder="Resolution note (optional)…"
                  value={notes[row.id] ?? ''}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [row.id]: e.target.value }))}
                  rows={2}
                  style={noteInputStyle}
                />
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  <ActionButton key="resolve" tone="success" disabled={working === row.id} onClick={() => void runAction(row.id, 'resolve')}>
                    {working === row.id ? 'Saving…' : 'Resolve'}
                  </ActionButton>
                  {row.status === 'open' && (
                    <ActionButton key="escalate" tone="warning" disabled={working === row.id} onClick={() => void runAction(row.id, 'escalate')}>
                      Escalate
                    </ActionButton>
                  )}
                </div>
              </div>
            ) : <span key="done" style={{ color: '#64748b', fontSize: '0.72rem' }}>Closed</span>,
          ];
        })}
        empty={<EmptyState title={loading ? 'Loading disputes…' : 'No disputes found'} description="Disputes raised against broker-managed loads will appear here." />}
      />
    </Panel>
  </PageFrame>;
}

type CarrierInvitation = {
  id: string;
  invited_email: string | null;
  carrier_company_id: string | null;
  carrierCompanyName: string | null;
  status: string;
  message: string | null;
  created_at: string;
};

export function BrokerCarrierNetworkPage() {
  const [invitations, setInvitations] = useState<CarrierInvitation[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [working, setWorking] = useState<string | null>(null);
  const [carrierEmail, setCarrierEmail] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');

  const getAuthHeader = async () => {
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    return token ? 'Bearer ' + token : null;
  };

  const load = async () => {
    setLoading(true);
    setError('');
    const auth = await getAuthHeader();
    if (!auth) { setError('Session expired.'); setLoading(false); return; }
    const response = await fetch('/api/broker/carrier-invitations', { headers: { Authorization: auth } });
    const payload = await response.json().catch(() => ({})) as { invitations?: CarrierInvitation[]; canManage?: boolean; error?: string };
    if (!response.ok) { setError(payload.error ?? 'Failed to load carrier network.'); } else { setInvitations(payload.invitations ?? []); setCanManage(Boolean(payload.canManage)); }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const invite = async () => {
    if (!carrierEmail.trim()) { setError('Carrier email is required.'); return; }
    setWorking('invite');
    setError('');
    setNotice('');
    const auth = await getAuthHeader();
    if (!auth) { setError('Session expired.'); setWorking(null); return; }
    const response = await fetch('/api/broker/carrier-invitations', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ carrierEmail: carrierEmail.trim(), message: inviteMessage.trim() || undefined }),
    });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    setWorking(null);
    if (!response.ok) { setError(payload.error ?? 'Invitation failed.'); return; }
    setCarrierEmail('');
    setInviteMessage('');
    setNotice('Carrier invitation sent.');
    await load();
  };

  const revoke = async (invitationId: string) => {
    if (!window.confirm('Revoke this carrier invitation?')) return;
    setWorking(invitationId);
    setError('');
    setNotice('');
    const auth = await getAuthHeader();
    if (!auth) { setError('Session expired.'); setWorking(null); return; }
    const response = await fetch('/api/broker/carrier-invitations', {
      method: 'DELETE',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ invitationId }),
    });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    setWorking(null);
    if (!response.ok) { setError(payload.error ?? 'Revoke failed.'); return; }
    setNotice('Invitation revoked.');
    await load();
  };

  const pending = invitations.filter((i) => i.status === 'pending').length;
  const accepted = invitations.filter((i) => i.status === 'accepted').length;
  const revoked = invitations.filter((i) => i.status === 'revoked').length;

  return <PageFrame>
    <PageHeader eyebrow="Carrier network" title="Carrier Invitations" description="Invite carrier companies into the broker preferred network and manage access." actions={<ActionButton tone="secondary" disabled={loading} onClick={() => void load()}>{loading ? 'Refreshing…' : 'Refresh'}</ActionButton>} />
    {error && <AlertBanner tone="danger">{error}</AlertBanner>}
    {notice && <AlertBanner tone="success">{notice}</AlertBanner>}
    <KpiGrid>
      <KpiCard label="Pending" value={pending} tone="orange" />
      <KpiCard label="Accepted" value={accepted} tone="green" />
      <KpiCard label="Revoked" value={revoked} />
    </KpiGrid>
    {canManage && (
      <Panel title="Invite carrier" style={{ marginBottom: '0.9rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'flex-end' }}>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.72rem', color: '#334155', fontWeight: 700 }}>Carrier email</label>
            <input value={carrierEmail} onChange={(e) => setCarrierEmail(e.target.value)} placeholder="carrier@company.com" style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0.5rem 0.65rem', minWidth: '220px', fontSize: '0.78rem' }} />
          </div>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.72rem', color: '#334155', fontWeight: 700 }}>Message (optional)</label>
            <input value={inviteMessage} onChange={(e) => setInviteMessage(e.target.value)} placeholder="Personal invitation message…" style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0.5rem 0.65rem', minWidth: '260px', fontSize: '0.78rem' }} />
          </div>
          <ActionButton tone="primary" disabled={working === 'invite'} onClick={() => void invite()}>{working === 'invite' ? 'Sending…' : 'Send invitation'}</ActionButton>
        </div>
      </Panel>
    )}
    <Panel title="Carrier network register" description="Only carriers invited by this broker company are listed.">
      <DataTable
        columns={['Carrier email', 'Company', 'Message', 'Invited', 'Status', 'Action']}
        rows={invitations.map((inv) => [
          inv.invited_email ?? '—',
          inv.carrierCompanyName ?? (inv.carrier_company_id ? inv.carrier_company_id.slice(0, 8) : '—'),
          inv.message ?? '—',
          when(inv.created_at),
          <StatusBadge key="status" value={inv.status} />,
          canManage && inv.status === 'pending' ? (
            <ActionButton key="revoke" tone="danger" disabled={working === inv.id} onClick={() => void revoke(inv.id)}>
              {working === inv.id ? 'Revoking…' : 'Revoke'}
            </ActionButton>
          ) : <span key="na" style={{ color: '#64748b', fontSize: '0.72rem' }}>—</span>,
        ])}
        empty={<EmptyState title={loading ? 'Loading…' : 'No carrier invitations yet'} description="Invite carrier companies to build a preferred sourcing network." />}
      />
    </Panel>
  </PageFrame>;
}

export function BrokerSettingsPage() { return <PageFrame><PageHeader eyebrow="Broker administration" title="Settings" description="Company profile, customer payment terms, margin thresholds, notification rules and team permissions." /><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: '0.9rem' }}>{['Company profile','Customer payment terms','Carrier sourcing rules','Margin guardrails','Notifications','Team and permissions'].map((title) => <Panel key={title} title={title}><p style={{ color: '#64748b', fontSize: '0.78rem', lineHeight: 1.5, margin: 0 }}>Configuration is isolated to the broker company and must not expose another company&apos;s data.</p></Panel>)}</div></PageFrame>; }
