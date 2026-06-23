'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../components/ProtectedRoute';
import { useAuth } from '../components/AuthContext';
import { resolveActiveCompanyId } from '../../lib/activeCompany';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';

type BrokerJob = {
  id: string;
  status: string;
  pickup_location: string | null;
  delivery_location: string | null;
  pickup_datetime: string | null;
  budget_amount: number | null;
  client_name: string | null;
  client_email: string | null;
  awarded_carrier_company_id: string | null;
  delivery_photos?: string[] | null;
  created_at: string;
  updated_at: string;
};

type BrokerBid = {
  id: string;
  job_id: string;
  company_id: string | null;
  amount: number | null;
  bid_price_gbp: number | null;
  status: string;
  created_at: string;
  companies?: { name: string | null } | null;
};

type BrokerInvoice = {
  id: string;
  amount: number | null;
  status: string;
  created_at: string;
};

const navItems = [
  ['Dashboard', '/broker'],
  ['Post Load', '/broker/loads'],
  ['Loads', '/broker/loads'],
  ['Quotes / Carrier Bids', '/broker/bids'],
  ['Awards', '/broker/awards'],
  ['Active Jobs', '/broker/awards'],
  ['Carriers / Network', '/admin/companies'],
  ['POD', '/admin/jobs'],
  ['Invoices', '/admin/invoices'],
  ['Customers', '/admin/quotes'],
] as const;

const money = (value: number) => `£${value.toFixed(2)}`;

export default function BrokerDashboardPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<BrokerJob[]>([]);
  const [bids, setBids] = useState<BrokerBid[]>([]);
  const [invoices, setInvoices] = useState<BrokerInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user?.id) return;
    const resolve = async () => {
      const id = await resolveActiveCompanyId({ userId: user.id, fallbackCompanyId: user.companyId ?? null });
      setCompanyId(id ?? null);
    };
    void resolve();
  }, [user?.id, user?.companyId]);

  const loadDashboard = useCallback(async () => {
    if (!companyId || !isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    const [jobRes, bidRes, invoiceRes] = await Promise.all([
      supabase
        .from('jobs')
        .select('id, status, pickup_location, delivery_location, pickup_datetime, budget_amount, client_name, client_email, awarded_carrier_company_id, delivery_photos, created_at, updated_at')
        .eq('company_id', companyId)
        .order('updated_at', { ascending: false })
        .limit(100),
      supabase
        .from('job_bids')
        .select('id, job_id, company_id, amount, bid_price_gbp, status, created_at, companies:company_id(name)')
        .order('created_at', { ascending: false })
        .limit(150),
      supabase
        .from('invoices')
        .select('id, amount, status, created_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(100),
    ]);

    if (jobRes.error || bidRes.error || invoiceRes.error) {
      setError(jobRes.error?.message ?? bidRes.error?.message ?? invoiceRes.error?.message ?? 'Unable to load broker dashboard.');
      setJobs([]);
      setBids([]);
      setInvoices([]);
      setLoading(false);
      return;
    }

    const brokerJobs = (jobRes.data ?? []) as BrokerJob[];
    const jobIds = new Set(brokerJobs.map((job) => job.id));
    setJobs(brokerJobs);
    setBids(((bidRes.data ?? []) as unknown as BrokerBid[]).filter((bid) => jobIds.has(bid.job_id)));
    setInvoices((invoiceRes.data ?? []) as BrokerInvoice[]);
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const metrics = useMemo(() => {
    const openLoads = jobs.filter((job) => ['draft', 'posted'].includes(job.status)).length;
    const quotesReceived = bids.filter((bid) => bid.status === 'submitted').length;
    const awaitingAward = jobs.filter((job) => !job.awarded_carrier_company_id && bids.some((bid) => bid.job_id === job.id && bid.status === 'submitted')).length;
    const activeJobs = jobs.filter((job) => ['allocated', 'collected', 'in_transit', 'awarded'].includes(job.status)).length;
    const podPending = jobs.filter((job) => ['delivered', 'completed'].includes(job.status) && !(job.delivery_photos?.length)).length;
    const invoicesPending = invoices.filter((invoice) => !['Paid', 'paid'].includes(invoice.status)).length;
    const clientRevenue = jobs.reduce((sum, job) => sum + Number(job.budget_amount ?? 0), 0);
    const carrierCost = bids
      .filter((bid) => bid.status === 'accepted')
      .reduce((sum, bid) => sum + Number(bid.bid_price_gbp ?? bid.amount ?? 0), 0);
    return {
      openLoads,
      quotesReceived,
      awaitingAward,
      activeJobs,
      grossMargin: clientRevenue - carrierCost,
      podPending,
      invoicesPending,
    };
  }, [jobs, bids, invoices]);

  return (
    <ProtectedRoute allowedRoles={['broker', 'owner']}>
      <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
        <header style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Broker workspace</p>
            <h1 style={{ margin: 0, color: '#0f172a', fontSize: '1.3rem' }}>Broker Dashboard</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <button onClick={() => router.push('/broker/loads')} style={{ background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.55rem 0.95rem', fontWeight: 700, cursor: 'pointer' }}>Post Load</button>
            <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{user?.email}</span>
            <button onClick={() => void logout()} style={{ background: '#fff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.5rem 0.85rem', fontWeight: 600, cursor: 'pointer' }}>Sign out</button>
          </div>
        </header>

        <nav style={{ display: 'flex', gap: 0, overflowX: 'auto', background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 1rem' }}>
          {navItems.map(([label, href]) => (
            <button key={`${label}-${href}`} onClick={() => router.push(href)} style={{ border: 'none', borderBottom: href === '/broker' ? '2px solid #1d4ed8' : '2px solid transparent', background: 'transparent', color: href === '/broker' ? '#1d4ed8' : '#64748b', padding: '0.7rem 0.85rem', fontWeight: 700, fontSize: '0.76rem', whiteSpace: 'nowrap', cursor: 'pointer' }}>
              {label}
            </button>
          ))}
        </nav>

        <main style={{ padding: '1rem', display: 'grid', gap: '1rem' }}>
          {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '8px', padding: '0.85rem' }}>{error}</div>}
          {loading ? (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '2rem', color: '#64748b' }}>Loading broker dashboard...</div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
                {[
                  ['Open loads', metrics.openLoads],
                  ['Quotes received', metrics.quotesReceived],
                  ['Awaiting award', metrics.awaitingAward],
                  ['Active jobs', metrics.activeJobs],
                  ['Gross margin', money(metrics.grossMargin)],
                  ['PODs pending', metrics.podPending],
                  ['Invoices pending', metrics.invoicesPending],
                ].map(([label, value]) => (
                  <section key={String(label)} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
                    <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700 }}>{label}</div>
                    <div style={{ color: '#0f172a', fontSize: '1.45rem', fontWeight: 800, marginTop: '0.25rem' }}>{value}</div>
                  </section>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
                <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
                  <h2 style={{ margin: '0 0 0.7rem', fontSize: '1rem', color: '#0f172a' }}>Loads needing carrier</h2>
                  {jobs.filter((job) => !job.awarded_carrier_company_id).slice(0, 5).map((job) => (
                    <div key={job.id} style={{ borderTop: '1px solid #f1f5f9', padding: '0.65rem 0', fontSize: '0.86rem', color: '#334155' }}>
                      <strong>{job.pickup_location || 'Pickup TBC'}</strong> to <strong>{job.delivery_location || 'Delivery TBC'}</strong>
                      <div style={{ color: '#64748b', fontSize: '0.78rem' }}>{job.client_name || job.client_email || 'Customer TBC'} - {job.status}</div>
                    </div>
                  ))}
                  {jobs.length === 0 && <div style={{ color: '#64748b', fontSize: '0.86rem' }}>No broker loads yet.</div>}
                </section>

                <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
                  <h2 style={{ margin: '0 0 0.7rem', fontSize: '1rem', color: '#0f172a' }}>Recent carrier bids</h2>
                  {bids.slice(0, 5).map((bid) => (
                    <div key={bid.id} style={{ borderTop: '1px solid #f1f5f9', padding: '0.65rem 0', fontSize: '0.86rem', color: '#334155' }}>
                      <strong>{bid.companies?.name || 'Carrier'}</strong> - {money(Number(bid.bid_price_gbp ?? bid.amount ?? 0))}
                      <div style={{ color: '#64748b', fontSize: '0.78rem' }}>{bid.status}</div>
                    </div>
                  ))}
                  {bids.length === 0 && <div style={{ color: '#64748b', fontSize: '0.86rem' }}>No carrier bids yet.</div>}
                </section>

                <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
                  <h2 style={{ margin: '0 0 0.7rem', fontSize: '1rem', color: '#0f172a' }}>Margin snapshot</h2>
                  <div style={{ fontSize: '0.9rem', color: '#334155', display: 'grid', gap: '0.45rem' }}>
                    <div>Client revenue: <strong>{money(jobs.reduce((sum, job) => sum + Number(job.budget_amount ?? 0), 0))}</strong></div>
                    <div>Accepted carrier cost: <strong>{money(bids.filter((bid) => bid.status === 'accepted').reduce((sum, bid) => sum + Number(bid.bid_price_gbp ?? bid.amount ?? 0), 0))}</strong></div>
                    <div>Gross margin: <strong>{money(metrics.grossMargin)}</strong></div>
                  </div>
                </section>
              </div>
            </>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
