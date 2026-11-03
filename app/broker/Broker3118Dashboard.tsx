'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useCompanyWorkspaceData } from '../components/workspace/useCompanyWorkspaceData';

const lifecycle = [
  { title: 'Post customer load', href: '/broker/post-load' },
  { title: 'Compare carrier quotes', href: '/broker/bids' },
  { title: 'Award transport', href: '/broker/awards' },
  { title: 'Track booking', href: '/broker/jobs' },
  { title: 'Review delivery POD', href: '/broker/pod-review' },
] as const;

export default function Broker3118Dashboard() {
  const data = useCompanyWorkspaceData();
  const stats = useMemo(() => ({
    loads: data.jobs.length,
    quotes: data.bids.filter(q => ['submitted','open','pending'].includes(q.status.toLowerCase())).length,
    awarded: data.jobs.filter(j => Boolean(j.awarded_carrier_company_id)).length,
    pod: data.jobs.filter(j => Boolean(j.pod_generated_at || j.pod_generated || j.has_delivery_evidence)).length,
  }), [data.jobs, data.bids]);
  const first = data.jobs[0];
  const metrics = [
    { label: 'POSTED LOADS', value: stats.loads, detail: 'Broker transport requests' },
    { label: 'CARRIER QUOTES', value: stats.quotes, detail: 'Offers to review' },
    { label: 'AWARDED JOBS', value: stats.awarded, detail: 'Carrier confirmed' },
    { label: 'PROOF OF DELIVERY', value: stats.pod, detail: 'Evidence received' },
  ];
  return <div className="broker3118-dashboard">
    <h1>Dashboard</h1>
    <div className="broker3118-metrics">
      {metrics.map(m => <div key={m.label}><small>{m.label}</small><b>{m.value}</b><span>{m.detail}</span></div>)}
    </div>
    <section className="broker3118-panel">
      <div className="broker3118-panelhead"><h2>Broker operations overview</h2><span>{first?.booking_reference || first?.id || 'NO LOADS'}</span></div>
      <div className="broker3118-customer"><small>YOUR CUSTOMER</small><strong>{first?.client_name || 'No customer selected'}</strong><span>Customer account</span></div>
      <div className="broker3118-route">
        <div><small>COLLECTION</small><strong>{first?.pickup_location || first?.pickup_postcode || '—'}</strong></div>
        <span aria-hidden="true">→</span>
        <div><small>DELIVERY</small><strong>{first?.delivery_location || first?.delivery_postcode || '—'}</strong></div>
      </div>
      <div className="broker3118-facts">
        <span>🚚 {first?.vehicle_type || 'Vehicle TBC'}</span>
        <span>{first?.pickup_datetime ? new Date(first.pickup_datetime).toLocaleString('en-GB') : 'Collection TBC'}</span>
        <span>{first?.delivery_datetime ? new Date(first.delivery_datetime).toLocaleString('en-GB') : 'Delivery TBC'}</span>
      </div>
      <div className="broker3118-actions">
        <Link className="primary" href={stats.quotes ? '/broker/bids' : '/broker/post-load'}>{stats.quotes ? 'Review carrier quotes' : 'Publish your first load'} →</Link>
        <Link className="outline" href="/broker/diary">Operations diary</Link>
      </div>
    </section>
    <section className="broker3118-panel">
      <h2>Broker transport lifecycle</h2>
      <div className="broker3118-steps">
        {lifecycle.map((step,i) => <Link key={step.href} href={step.href}><b>{String(i+1).padStart(2,'0')}</b><span>{step.title}</span><span>→</span></Link>)}
      </div>
    </section>
  </div>;
}
