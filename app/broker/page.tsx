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

const THEME = {
  pageBg:     'var(--background)',
  shellBg:    'var(--xd-surface)',
  shellBorder:'var(--xd-border)',
  cardBg:     'var(--xd-surface)',
  cardBorder: 'var(--xd-border)',
  text:       'var(--xd-text)',
  muted:      'var(--xd-text-muted)',
  softMuted:  'var(--xd-text-subtle)',
  blue:       'var(--xd-gold)',
  green:      'var(--xd-green)',
  amber:      'var(--xd-amber)',
  red:        'var(--xd-red)',
  ink:        'var(--xd-text)',
};

const navGroups = [
  {
    label: 'Broker Home',
    items: [
      ['Dashboard', '/broker'],
      ['Post Load', '/broker/loads'],
      ['Loads', '/broker/loads'],
    ],
  },
  {
    label: 'Commercial',
    items: [
      ['Carrier Bids', '/broker/bids'],
      ['Awards', '/broker/awards'],
      ['Customers', '/admin/quotes'],
      ['Invoices', '/admin/invoices'],
    ],
  },
  {
    label: 'Operations',
    items: [
      ['Active Jobs', '/broker/awards'],
      ['Carriers', '/admin/companies'],
      ['POD Review', '/admin/jobs'],
    ],
  },
] as const;

const money = (value: number) =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const buttonStyle = (accent = THEME.blue) => ({
  background: accent,
  color: '#fff',
  border: 'none',
  borderRadius: '7px',
  padding: '0.5rem 0.8rem',
  fontWeight: 800,
  fontSize: '0.75rem',
  cursor: 'pointer',
});

function KpiCard({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return (
    <section style={{ background: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '9px', padding: '0.72rem 0.78rem', minHeight: '88px' }}>
      <div style={{ color: '#64748b', fontSize: '0.66rem', fontWeight: 850, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.28rem' }}>{label}</div>
      <div style={{ color: tone, fontSize: '1.36rem', fontWeight: 900, lineHeight: 1.05 }}>{value}</div>
    </section>
  );
}

function Panel({ title, subtitle, actionLabel, onAction, children }: { title: string; subtitle: string; actionLabel?: string; onAction?: () => void; children: React.ReactNode }) {
  return (
    <section style={{ background: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '10px', padding: '0.95rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <div>
          <h2 style={{ margin: 0, color: THEME.text, fontSize: '1rem', fontWeight: 850 }}>{title}</h2>
          <p style={{ margin: '0.22rem 0 0', color: THEME.muted, fontSize: '0.78rem', lineHeight: 1.42 }}>{subtitle}</p>
        </div>
        {actionLabel && onAction && (
          <button onClick={onAction} style={{ background: 'none', border: 'none', color: THEME.blue, fontSize: '0.74rem', fontWeight: 850, cursor: 'pointer', whiteSpace: 'nowrap' }}>{actionLabel}</button>
        )}
      </div>
      {children}
    </section>
  );
}

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
        .select('id, job_id, company_id, amount, bid_price_gbp, status, created_at, companies:companies!job_bids_company_id_fkey(name)')
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
      clientRevenue,
      carrierCost,
    };
  }, [jobs, bids, invoices]);

  const activeNav = (href: string) => href === '/broker';

  return (
    <ProtectedRoute allowedRoles={['broker', 'owner']}>
      <div style={{ minHeight: '100vh', backgroundColor: THEME.pageBg, display: 'flex' }}>
        <aside style={{ width: '248px', background: THEME.shellBg, borderRight: `1px solid ${THEME.shellBorder}`, display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh', flexShrink: 0 }}>
          <div style={{ padding: '0.9rem', background: '#ffffff', borderBottom: `1px solid ${THEME.shellBorder}` }}>
            <button onClick={() => router.push('/broker')} style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#1d4ed8', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 900 }}>X</div>
              <div>
                <div style={{ color: THEME.text, fontSize: '0.86rem', fontWeight: 850 }}>Broker Workspace</div>
                <div style={{ color: THEME.softMuted, fontSize: '0.66rem' }}>Commercial load desk</div>
              </div>
            </button>
          </div>

          <nav style={{ flex: 1, overflowY: 'auto', padding: '0.6rem' }}>
            {navGroups.map((group) => (
              <div key={group.label} style={{ marginBottom: '0.55rem' }}>
                <div style={{ color: '#64748b', fontSize: '0.62rem', fontWeight: 850, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0.25rem 0.45rem' }}>{group.label}</div>
                <div style={{ display: 'grid', gap: '0.14rem' }}>
                  {group.items.map(([label, href]) => {
                    const active = activeNav(href);
                    return (
                      <button key={`${label}-${href}`} onClick={() => router.push(href)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: 'none', borderLeft: active ? `3px solid ${THEME.blue}` : '3px solid transparent', borderRadius: '8px', background: active ? '#eff6ff' : 'transparent', color: active ? THEME.blue : THEME.text, padding: '0.46rem 0.55rem', fontSize: '0.76rem', fontWeight: active ? 850 : 700, cursor: 'pointer', textAlign: 'left' }}>
                        <span>{label}</span>
                        {active && <span style={{ width: '6px', height: '6px', borderRadius: '999px', background: THEME.blue }} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div style={{ padding: '0.8rem', borderTop: `1px solid ${THEME.shellBorder}`, background: '#ffffff' }}>
            <div style={{ color: THEME.softMuted, fontSize: '0.68rem', wordBreak: 'break-word', marginBottom: '0.5rem' }}>{user?.email}</div>
            <button onClick={() => void logout()} style={{ width: '100%', background: '#fef2f2', color: THEME.red, border: '1px solid #fecaca', borderRadius: '8px', padding: '0.48rem', fontWeight: 850, fontSize: '0.72rem', cursor: 'pointer' }}>Sign out</button>
          </div>
        </aside>

        <main style={{ flex: 1, minWidth: 0, padding: '1rem 1.15rem 1.35rem' }}>
          <section style={{ background: '#fff', border: `1px solid ${THEME.cardBorder}`, borderRadius: '10px', padding: '1rem 1.1rem', marginBottom: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <div style={{ color: '#64748b', fontSize: '0.68rem', fontWeight: 850, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Broker Control View</div>
                <h1 style={{ margin: 0, color: THEME.text, fontSize: '1.45rem', fontWeight: 850 }}>Commercial Load Desk</h1>
                <p style={{ color: THEME.muted, margin: '0.28rem 0 0', fontSize: '0.86rem', maxWidth: '760px', lineHeight: 1.45 }}>
                  Post freight, collect carrier bids, award the right operator and keep commercial work moving.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button onClick={() => router.push('/broker/loads')} style={buttonStyle(THEME.green)}>Post Load</button>
                <button onClick={() => router.push('/broker/bids')} style={{ ...buttonStyle(THEME.ink), background: '#ffffff', color: THEME.ink, border: `1px solid ${THEME.cardBorder}` }}>Review Bids</button>
              </div>
            </div>
          </section>

          {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '9px', padding: '0.75rem 0.85rem', marginBottom: '0.85rem', fontSize: '0.82rem' }}>{error}</div>}

          {loading ? (
            <div style={{ background: '#fff', border: `1px solid ${THEME.cardBorder}`, borderRadius: '10px', padding: '1.4rem', color: THEME.softMuted }}>Loading broker dashboard...</div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(128px, 1fr))', gap: '0.62rem', marginBottom: '0.9rem' }}>
                <KpiCard label="Open loads" value={metrics.openLoads} tone={THEME.blue} />
                <KpiCard label="Quotes received" value={metrics.quotesReceived} tone={THEME.amber} />
                <KpiCard label="Awaiting award" value={metrics.awaitingAward} tone={THEME.red} />
                <KpiCard label="Active jobs" value={metrics.activeJobs} tone={THEME.green} />
                <KpiCard label="Gross margin" value={money(metrics.grossMargin)} tone="#0f766e" />
                <KpiCard label="POD pending" value={metrics.podPending} tone="#4338ca" />
                <KpiCard label="Invoices pending" value={metrics.invoicesPending} tone={THEME.ink} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem', marginBottom: '0.9rem' }}>
                <section style={{ background: '#fff', border: `1px solid ${THEME.cardBorder}`, borderTop: `3px solid ${THEME.green}`, borderRadius: '10px', padding: '0.9rem' }}>
                  <div style={{ color: '#64748b', fontSize: '0.66rem', fontWeight: 850, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Load intake</div>
                  <h2 style={{ margin: '0.25rem 0 0.5rem', color: THEME.text, fontSize: '1rem' }}>Post and qualify freight</h2>
                  <p style={{ margin: 0, color: THEME.muted, fontSize: '0.78rem', lineHeight: 1.45 }}>Create professional load postings with the same structured transport workflow used by customers.</p>
                  <button onClick={() => router.push('/broker/loads')} style={{ ...buttonStyle(THEME.green), marginTop: '0.75rem' }}>Open loads</button>
                </section>
                <section style={{ background: '#fff', border: `1px solid ${THEME.cardBorder}`, borderTop: `3px solid ${THEME.amber}`, borderRadius: '10px', padding: '0.9rem' }}>
                  <div style={{ color: '#64748b', fontSize: '0.66rem', fontWeight: 850, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Carrier market</div>
                  <h2 style={{ margin: '0.25rem 0 0.5rem', color: THEME.text, fontSize: '1rem' }}>Compare bids</h2>
                  <p style={{ margin: 0, color: THEME.muted, fontSize: '0.78rem', lineHeight: 1.45 }}>Review submitted carrier offers, pricing, status and award readiness in one place.</p>
                  <button onClick={() => router.push('/broker/bids')} style={{ ...buttonStyle(THEME.amber), marginTop: '0.75rem' }}>Open bids</button>
                </section>
                <section style={{ background: '#fff', border: `1px solid ${THEME.cardBorder}`, borderTop: `3px solid ${THEME.blue}`, borderRadius: '10px', padding: '0.9rem' }}>
                  <div style={{ color: '#64748b', fontSize: '0.66rem', fontWeight: 850, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Award control</div>
                  <h2 style={{ margin: '0.25rem 0 0.5rem', color: THEME.text, fontSize: '1rem' }}>Award and track</h2>
                  <p style={{ margin: 0, color: THEME.muted, fontSize: '0.78rem', lineHeight: 1.45 }}>Move won work into delivery execution while keeping customer and carrier outcomes visible.</p>
                  <button onClick={() => router.push('/broker/awards')} style={{ ...buttonStyle(THEME.blue), marginTop: '0.75rem' }}>Open awards</button>
                </section>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '0.75rem' }}>
                <Panel title="Loads needing carrier" subtitle="Unawarded jobs requiring broker attention." actionLabel="Open loads" onAction={() => router.push('/broker/loads')}>
                  {jobs.filter((job) => !job.awarded_carrier_company_id).slice(0, 5).map((job) => (
                    <button key={job.id} onClick={() => router.push('/broker/loads')} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', gap: '0.75rem', textAlign: 'left', border: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: '8px', padding: '0.58rem 0.65rem', marginTop: '0.45rem', cursor: 'pointer' }}>
                      <span>
                        <strong style={{ color: THEME.text, fontSize: '0.82rem' }}>{job.pickup_location || 'Pickup TBC'} to {job.delivery_location || 'Delivery TBC'}</strong>
                        <span style={{ display: 'block', color: THEME.softMuted, fontSize: '0.74rem', marginTop: '0.16rem' }}>{job.client_name || job.client_email || 'Customer TBC'}</span>
                      </span>
                      <span style={{ color: THEME.blue, fontSize: '0.72rem', fontWeight: 850 }}>{job.status}</span>
                    </button>
                  ))}
                  {jobs.length === 0 && <div style={{ color: THEME.softMuted, fontSize: '0.82rem' }}>No broker loads yet.</div>}
                </Panel>

                <Panel title="Recent carrier bids" subtitle="Latest inbound offers from the carrier network." actionLabel="Open bids" onAction={() => router.push('/broker/bids')}>
                  {bids.slice(0, 5).map((bid) => (
                    <button key={bid.id} onClick={() => router.push('/broker/bids')} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', gap: '0.75rem', textAlign: 'left', border: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: '8px', padding: '0.58rem 0.65rem', marginTop: '0.45rem', cursor: 'pointer' }}>
                      <span>
                        <strong style={{ color: THEME.text, fontSize: '0.82rem' }}>{bid.companies?.name || 'Carrier'}</strong>
                        <span style={{ display: 'block', color: THEME.softMuted, fontSize: '0.74rem', marginTop: '0.16rem' }}>{bid.status}</span>
                      </span>
                      <span style={{ color: THEME.green, fontSize: '0.78rem', fontWeight: 850 }}>{money(Number(bid.bid_price_gbp ?? bid.amount ?? 0))}</span>
                    </button>
                  ))}
                  {bids.length === 0 && <div style={{ color: THEME.softMuted, fontSize: '0.82rem' }}>No carrier bids yet.</div>}
                </Panel>

                <Panel title="Margin snapshot" subtitle="Commercial position across posted and awarded work." actionLabel="Open finance" onAction={() => router.push('/admin/invoices')}>
                  <div style={{ display: 'grid', gap: '0.48rem', color: THEME.muted, fontSize: '0.84rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #eef2f7', paddingBottom: '0.42rem' }}><span>Client revenue</span><strong style={{ color: THEME.text }}>{money(metrics.clientRevenue)}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #eef2f7', paddingBottom: '0.42rem' }}><span>Accepted carrier cost</span><strong style={{ color: THEME.text }}>{money(metrics.carrierCost)}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Gross margin</span><strong style={{ color: metrics.grossMargin >= 0 ? THEME.green : THEME.red }}>{money(metrics.grossMargin)}</strong></div>
                  </div>
                </Panel>
              </div>
            </>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
