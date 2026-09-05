'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BriefcaseBusiness,
  ClipboardList,
  ClockAlert,
  DatabaseBackup,
  FileCheck2,
  HeartPulse,
  KeyRound,
  PoundSterling,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Truck,
  UserRound,
  Users,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';

import ProtectedRoute from '@/app/components/ProtectedRoute';
import PlatformEntityLink from '@/app/super-admin/_components/control-plane/PlatformEntityLink';
import SuperAdminOperationalMap, { type OperationalDriverPin, type OperationalJobPin } from '@/app/super-admin/_components/SuperAdminOperationalMap';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';
import styles from './page.module.css';

type Job = OperationalJobPin & {
  pickup_postcode: string | null;
  delivery_postcode: string | null;
  driver_id: string | null;
  driver_name: string | null;
  vehicle_id: string | null;
  vehicle_registration: string | null;
  price: number | null;
  currency: string;
};

type Driver = OperationalDriverPin & {
  user_id: string | null;
  company_name: string;
  availability_status: string;
  online: boolean;
  last_activity_at: string | null;
  rating: number | null;
  review_count: number;
};

type Vehicle = {
  id: string;
  company_name: string;
  registration: string;
  label: string;
  status: string;
  available: boolean;
  tracked: boolean;
  last_tracked_at: string | null;
  tail_lift: boolean;
  pallets_capacity: number | null;
  payload_kg: number | null;
  loading_capacity_m3: number | null;
  operationally_healthy: boolean;
  compliance_blocked: boolean;
  mileage: null;
  service_due: null;
};

type Finance = {
  currency: string | null;
  mixedCurrency: boolean;
  revenueToday: number | null;
  revenueWeek: number | null;
  revenueMonth: number | null;
  outstandingInvoices: number;
  topClients: Array<{ name: string; invoicedValue: number }>;
  driverPayments: null;
  profitabilityPerRoute: null;
  unavailable: string[];
};

type Payload = {
  refreshedAt: string;
  kpis: {
    activeJobs: number;
    driversOnline: number;
    fleetHealth: number | null;
    lateDeliveries: number;
    revenueToday: number | null;
    urgentRequests: number;
    currency: string | null;
    mixedCurrency: boolean;
  };
  map: { drivers: Driver[]; jobs: Job[]; routes: Job[] };
  jobs: Job[];
  drivers: Driver[];
  fleet: Vehicle[];
  finance: Finance;
  capabilities: {
    apiKeyManagement: boolean;
    xeroIntegrationManagement: boolean;
    courierExchangeIntegrationManagement: boolean;
    stripeIntegrationVisibility: boolean;
    backupRestoreDirectAction: boolean;
    vehicleMileage: boolean;
    vehicleServiceDue: boolean;
  };
};

const C = {
  blue: '#1A73E8',
  green: '#34A853',
  yellow: '#FBBC05',
  red: '#EA4335',
  grey: '#8A9099',
} as const;

const money = (value: number | null, currency: string | null) =>
  value == null || !currency
    ? '—'
    : new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);

const when = (value: string | null) =>
  value ? new Date(value).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

const regionOf = (job: Job) => {
  const postcode = (job.pickup_postcode ?? '').toUpperCase();
  if (/^(E|EC|N|NW|SE|SW|W|WC|BR|CR|DA|EN|HA|IG|KT|RM|SM|TW|UB)/.test(postcode)) return 'London';
  if (/^(B|CV|DE|DY|LE|NG|NN|ST|TF|WS|WV)/.test(postcode)) return 'Midlands';
  if (/^(BB|BD|BL|CA|CH|CW|DH|DL|DN|FY|HD|HG|HU|HX|L|LA|LS|M|NE|OL|PR|S|SK|SR|TS|WA|WF|WN|YO)/.test(postcode)) return 'North';
  return 'Other';
};

const jobTone = (status: string) => {
  const value = status.toLowerCase();
  if (['delivered', 'completed', 'paid'].includes(value)) return C.green;
  if (['cancelled', 'canceled', 'failed'].includes(value)) return C.red;
  if (value === 'posted') return C.blue;
  if (['draft', 'received', 'quoted', 'pending'].includes(value)) return C.yellow;
  return C.blue;
};

const driverTone = (driver: Driver) => {
  if (!driver.online) return C.grey;
  if (driver.status === 'busy') return C.blue;
  return C.green;
};

const vehicleHealth = (vehicle: Vehicle) => {
  if (vehicle.compliance_blocked) return { label: 'Critical', color: C.red };
  if (!vehicle.operationally_healthy) return { label: 'Attention', color: C.yellow };
  return { label: 'Ready', color: C.green };
};

function KpiCard({
  label,
  value,
  note,
  accent,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  note: string;
  accent: string;
  icon: LucideIcon;
}) {
  return (
    <div className={styles.kpiCard} style={{ '--accent': accent } as React.CSSProperties}>
      <div className={styles.kpiTop}>
        <div className={styles.kpiIcon}><Icon size={24} strokeWidth={2} /></div>
        <div className={styles.kpiValue}>{value}</div>
      </div>
      <div className={styles.kpiLabel}>{label}</div>
      <div className={styles.kpiNote}>{note}</div>
    </div>
  );
}

export default function SuperAdminOperationsControlCentre() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [vehicleFilter, setVehicleFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) {
        setError('No active Platform Owner session.');
        return;
      }
      const response = await fetch('/api/super-admin/operations-cockpit', {
        headers: { Authorization: auth },
        cache: 'no-store',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError((body as { error?: string }).error ?? `System overview unavailable (${response.status}).`);
        return;
      }
      setData(body as Payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'System overview unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredJobs = useMemo(() => data?.jobs.filter((job) => {
    if (statusFilter !== 'all' && job.status !== statusFilter) return false;
    if (regionFilter !== 'all' && regionOf(job) !== regionFilter) return false;
    if (vehicleFilter !== 'all' && (job.vehicle_registration ?? 'unassigned') !== vehicleFilter) return false;
    const query = clientFilter.trim().toLowerCase();
    return !query || job.client.toLowerCase().includes(query) || job.short_id.toLowerCase().includes(query);
  }) ?? [], [clientFilter, data, regionFilter, statusFilter, vehicleFilter]);

  const statuses = Array.from(new Set((data?.jobs ?? []).map((job) => job.status))).sort();
  const vehicles = Array.from(new Set((data?.jobs ?? []).map((job) => job.vehicle_registration ?? 'unassigned'))).sort();
  const maxClientValue = data?.finance.topClients[0]?.invoicedValue || 1;
  const fleetTone = data?.kpis.fleetHealth == null ? C.grey : data.kpis.fleetHealth >= 80 ? C.green : data.kpis.fleetHealth >= 60 ? C.yellow : C.red;
  const driverKpiTone = (data?.kpis.driversOnline ?? 0) > 0 ? C.green : C.yellow;
  const lateTone = (data?.kpis.lateDeliveries ?? 0) === 0 ? C.green : C.red;
  const urgentTone = (data?.kpis.urgentRequests ?? 0) === 0 ? C.green : (data?.kpis.urgentRequests ?? 0) <= 2 ? C.yellow : C.red;
  const revenueTone = data?.kpis.mixedCurrency ? C.yellow : C.green;

  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <main className={styles.page}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>XDrive Logistics LTD — System Overview</h1>
            <p className={styles.subtitle}>Your Freight. Our Priority.</p>
            {data && <div className={styles.snapshot}>Live snapshot: {new Date(data.refreshedAt).toLocaleString('en-GB')}</div>}
          </div>
          <button type="button" className={styles.button} onClick={() => void load()} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh Live Data'}
          </button>
        </header>

        {error && <div className={styles.alert} role="alert">{error}</div>}

        {!error && (
          <>
            <section className={styles.kpiGrid} aria-label="Key performance indicators">
              <KpiCard icon={BriefcaseBusiness} label="Active Jobs" value={loading ? '—' : data?.kpis.activeJobs ?? '—'} note="Open transport workload" accent={C.blue} />
              <KpiCard icon={Users} label="Drivers Online" value={loading ? '—' : data?.kpis.driversOnline ?? '—'} note="Fresh location + active presence" accent={driverKpiTone} />
              <KpiCard icon={HeartPulse} label="Fleet Health" value={loading ? '—' : data?.kpis.fleetHealth == null ? '—' : `${data.kpis.fleetHealth}%`} note="Operational/compliance readiness" accent={fleetTone} />
              <KpiCard icon={ClockAlert} label="Late Deliveries" value={loading ? '—' : data?.kpis.lateDeliveries ?? '—'} note="ETA or delivery deadline breached" accent={lateTone} />
              <KpiCard icon={PoundSterling} label="Revenue Today" value={loading ? '—' : money(data?.kpis.revenueToday ?? null, data?.kpis.currency ?? null)} note={data?.kpis.mixedCurrency ? 'Mixed currencies — no aggregate' : 'Recorded settlements'} accent={revenueTone} />
              <KpiCard icon={Siren} label="Urgent Requests" value={loading ? '—' : data?.kpis.urgentRequests ?? '—'} note="P0/P1 cases + critical support" accent={urgentTone} />
            </section>

            {data && (
              <section className={styles.overviewGrid}>
                <div className={styles.card}>
                  <div className={styles.sectionHeader} style={{ padding: 0, borderBottom: 0, marginBottom: 12 }}>
                    <div>
                      <h2 className={styles.sectionTitle}>Live Operational Map</h2>
                      <p className={styles.sectionText}>Moving vehicles green · idle yellow · offline red · active jobs blue. ETA uses cached traffic data; this page makes no routing-provider call.</p>
                    </div>
                    <Link className={styles.linkButton} href="/super-admin/operations/fleet-positions">Fleet Positions</Link>
                  </div>
                  <SuperAdminOperationalMap drivers={data.map.drivers} jobs={data.map.jobs} routes={data.map.routes} />
                  {data.map.jobs.length === 0 && <p className={styles.quickNote}>No active job currently has canonical map coordinates, so no job pin or route is fabricated.</p>}
                </div>

                <div className={styles.sideStack}>
                  <aside className={styles.asideCard}>
                    <h2 className={styles.sectionTitle}>Quick Actions</h2>
                    <div className={styles.quickList}>
                      <Link className={styles.quickLink} href="#jobs-management"><ClipboardList size={24} /><span>Jobs Management</span><b>→</b></Link>
                      <Link className={styles.quickLink} href="#drivers-center"><Users size={24} /><span>Drivers Center</span><b>→</b></Link>
                      <Link className={styles.quickLink} href="#fleet-overview"><Truck size={24} /><span>Fleet Overview</span><b>→</b></Link>
                      <Link className={styles.quickLink} href="#finance-dashboard"><WalletCards size={24} /><span>Finance Dashboard</span><b>→</b></Link>
                      <Link className={styles.quickLink} href="/super-admin/settings/roles-permissions"><ShieldCheck size={24} /><span>Manage Roles</span><b>→</b></Link>
                      <Link className={styles.quickLink} href="/super-admin/settings/audit-logs"><ScrollText size={24} /><span>View Logs</span><b>→</b></Link>
                    </div>
                    <p className={styles.quickNote}>Create, assign, reassign, cancel, backup and restore remain disabled here unless a governed Platform Owner mutation route exists.</p>
                  </aside>

                  <aside className={styles.asideCard}>
                    <h2 className={styles.sectionTitle}>Live Feed</h2>
                    {data.jobs.slice(0, 6).map((job) => (
                      <div key={job.id} className={styles.feedItem}>
                        <strong>Job {job.short_id} · {job.status.replaceAll('_', ' ')}</strong>
                        <span>{job.pickup} → {job.delivery}</span>
                      </div>
                    ))}
                  </aside>
                </div>
              </section>
            )}

            {data && (
              <section className={styles.module} id="jobs-management">
                <div className={styles.sectionHeader}>
                  <div>
                    <h2 className={styles.sectionTitle}>Jobs Management</h2>
                    <p className={styles.sectionText}>Pickup, dropoff, vehicle, driver, status, ETA and price with advanced filters.</p>
                  </div>
                  <Link className={styles.linkButton} href="/super-admin/operations/jobs">Open Full Jobs Workspace</Link>
                </div>
                <div className={styles.moduleBody}>
                  <div className={styles.filters}>
                    <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select>
                    <select value={regionFilter} onChange={(event) => setRegionFilter(event.target.value)}><option value="all">All regions</option>{['London', 'Midlands', 'North', 'Other'].map((region) => <option key={region} value={region}>{region}</option>)}</select>
                    <select value={vehicleFilter} onChange={(event) => setVehicleFilter(event.target.value)}><option value="all">All vehicles</option>{vehicles.map((vehicle) => <option key={vehicle} value={vehicle}>{vehicle === 'unassigned' ? 'Unassigned' : vehicle}</option>)}</select>
                    <input value={clientFilter} onChange={(event) => setClientFilter(event.target.value)} placeholder="Client or Job ID" />
                  </div>
                  <div className={styles.jobGrid}>
                    {filteredJobs.map((job) => (
                      <article key={job.id} className={styles.jobCard}>
                        <div className={styles.cardHeader}>
                          <strong className={styles.jobTitle}>Job {job.short_id}</strong>
                          <span className={styles.status} style={{ background: jobTone(job.status) }}>{job.status.replaceAll('_', ' ')}</span>
                        </div>
                        <div className={styles.jobRoute}><strong>{job.pickup}</strong><span>↓</span><strong>{job.delivery}</strong></div>
                        <div className={styles.metaGrid}>
                          <div><span className={styles.metaLabel}>Client</span><span className={styles.metaValue}>{job.client}</span></div>
                          <div><span className={styles.metaLabel}>Region</span><span className={styles.metaValue}>{regionOf(job)}</span></div>
                          <div><span className={styles.metaLabel}>Driver</span><span className={styles.metaValue}>{job.driver_name ?? 'Unassigned'}</span></div>
                          <div><span className={styles.metaLabel}>Vehicle</span><span className={styles.metaValue}>{job.vehicle_registration ?? 'Unassigned'}</span></div>
                          <div><span className={styles.metaLabel}>ETA</span><span className={styles.metaValue}>{job.eta?.eta_at ? when(job.eta.eta_at) : 'Unavailable'}</span></div>
                          <div><span className={styles.metaLabel}>Price</span><span className={styles.metaValue}>{money(job.price, job.currency)}</span></div>
                        </div>
                        <div className={styles.actions}>
                          <PlatformEntityLink entityType="job" entityId={job.id} compact>Track / View</PlatformEntityLink>
                          <button className={styles.disabledButton} type="button" disabled>Assign Driver</button>
                        </div>
                      </article>
                    ))}
                    {filteredJobs.length === 0 && <div className={styles.unavailable}>No jobs match the selected filters.</div>}
                  </div>
                </div>
              </section>
            )}

            {data && (
              <section className={styles.module} id="drivers-center">
                <div className={styles.sectionHeader}>
                  <div><h2 className={styles.sectionTitle}>Drivers Center</h2><p className={styles.sectionText}>Availability, route state, rating, assigned vehicle and last activity.</p></div>
                  <Link className={styles.linkButton} href="/super-admin/users/drivers">All Drivers</Link>
                </div>
                <div className={styles.moduleBody}><div className={styles.driverGrid}>
                  {data.drivers.map((driver) => (
                    <article key={driver.id} className={styles.driverCard}>
                      <div className={styles.driverHeader}>
                        <div className={styles.avatar} aria-label={`${driver.name} avatar`}><UserRound size={28} /><span>{driver.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span></div>
                        <span className={styles.status} style={{ background: driverTone(driver) }}>{driver.online ? (driver.status === 'busy' ? 'On Route' : 'Available') : 'Off Duty'}</span>
                      </div>
                      <h3 className={styles.driverName}>{driver.name}</h3>
                      <div className={styles.metaGrid}>
                        <div><span className={styles.metaLabel}>Vehicle Assigned</span><span className={styles.metaValue}>{driver.vehicle?.registration ?? 'Unassigned'}</span></div>
                        <div><span className={styles.metaLabel}>Rating</span><span className={styles.metaValue}>{driver.rating == null ? 'No reviews' : `${driver.rating.toFixed(1)} / 5`}</span></div>
                        <div><span className={styles.metaLabel}>Last Delivery</span><span className={styles.metaValue}>Unavailable</span></div>
                        <div><span className={styles.metaLabel}>Last Activity</span><span className={styles.metaValue}>{when(driver.last_activity_at)}</span></div>
                      </div>
                      <div className={styles.actions}><PlatformEntityLink entityType="driver" entityId={driver.id} compact>View Profile</PlatformEntityLink><button className={styles.disabledButton} type="button" disabled>Assign Job</button></div>
                    </article>
                  ))}
                </div></div>
              </section>
            )}

            {data && (
              <section className={styles.module} id="fleet-overview">
                <div className={styles.sectionHeader}>
                  <div><h2 className={styles.sectionTitle}>Fleet Overview</h2><p className={styles.sectionText}>Vehicle type, capacity, tail-lift, GPS and operational health. Mileage and service due remain unavailable until canonical source fields exist.</p></div>
                  <Link className={styles.linkButton} href="/super-admin/fleet/vehicles">Vehicle Registry</Link>
                </div>
                <div className={styles.moduleBody}><div className={styles.fleetGrid}>
                  {data.fleet.map((vehicle) => {
                    const health = vehicleHealth(vehicle);
                    return (
                      <article key={vehicle.id} className={styles.vehicleCard} style={{ '--health': health.color } as React.CSSProperties}>
                        <div className={styles.vehicleVisual}><Truck size={46} strokeWidth={1.7} /><span>{vehicle.available ? 'Available' : vehicle.status.replaceAll('_', ' ')}</span></div>
                        <div className={styles.cardHeader}><div><strong className={styles.vehicleTitle}>{vehicle.registration}</strong><div>{vehicle.label}</div></div><div className={styles.healthRing}>{health.label === 'Ready' ? 'OK' : '!'}</div></div>
                        <div className={styles.metaGrid}>
                          <div><span className={styles.metaLabel}>Capacity</span><span className={styles.metaValue}>{vehicle.payload_kg == null ? '—' : `${vehicle.payload_kg} kg`}</span></div>
                          <div><span className={styles.metaLabel}>Tail-lift</span><span className={styles.metaValue}>{vehicle.tail_lift ? 'Yes' : 'No'}</span></div>
                          <div><span className={styles.metaLabel}>GPS</span><span className={styles.metaValue}>{vehicle.tracked ? 'Active' : 'Signal unavailable'}</span></div>
                          <div><span className={styles.metaLabel}>Health</span><span className={styles.healthValue} style={{ color: health.color }}>{health.label}</span></div>
                          <div><span className={styles.metaLabel}>Mileage</span><span className={styles.metaValue}>Unavailable</span></div>
                          <div><span className={styles.metaLabel}>Service Due</span><span className={styles.metaValue}>Unavailable</span></div>
                        </div>
                        <div className={styles.actions}><PlatformEntityLink entityType="vehicle" entityId={vehicle.id} compact>Inspect Vehicle</PlatformEntityLink></div>
                      </article>
                    );
                  })}
                </div></div>
              </section>
            )}

            {data && (
              <section className={styles.module} id="finance-dashboard">
                <div className={styles.sectionHeader}>
                  <div><h2 className={styles.sectionTitle}>Finance Dashboard</h2><p className={styles.sectionText}>Revenue and invoice exposure from recorded ledgers. Expenses and profit are not inferred without an authoritative cost ledger.</p></div>
                  <div className={styles.actions}><Link className={styles.linkButton} href="/super-admin/finance">View Transactions</Link><Link className={styles.linkButton} href="/super-admin/analytics">Generate Report</Link><button className={styles.disabledButton} type="button" disabled>Export CSV</button></div>
                </div>
                <div className={styles.moduleBody}>
                  <div className={styles.financeGrid}>
                    <div className={`${styles.metricCard} ${styles.metricRevenue}`}><span className={styles.metaLabel}>Revenue</span><div className={styles.metricValue}>{money(data.finance.revenueToday, data.finance.currency)}</div></div>
                    <div className={`${styles.metricCard} ${styles.metricExpenses}`}><span className={styles.metaLabel}>Expenses</span><div className={styles.metricValue}>Unavailable</div></div>
                    <div className={`${styles.metricCard} ${styles.metricProfit}`}><span className={styles.metaLabel}>Profit</span><div className={styles.metricValue}>Unavailable</div></div>
                    <div className={`${styles.metricCard} ${styles.metricOutstanding}`}><span className={styles.metaLabel}>Outstanding Invoices</span><div className={styles.metricValue}>{data.finance.outstandingInvoices}</div></div>
                  </div>
                  <div className={styles.chartGrid}>
                    <div className={`${styles.chart} ${styles.enterpriseChart}`}>
                      <div className={styles.chartHeading}><Activity size={24} /><h3>Revenue & Profit Trend</h3></div>
                      <div className={styles.chartCanvas} aria-label="Revenue and profit trend unavailable">
                        <span className={styles.chartUnavailable}>Profit series unavailable — no canonical cost ledger.</span>
                      </div>
                      <div className={styles.chartFacts}><span>Today: {money(data.finance.revenueToday, data.finance.currency)}</span><span>Week: {money(data.finance.revenueWeek, data.finance.currency)}</span><span>Month: {money(data.finance.revenueMonth, data.finance.currency)}</span></div>
                    </div>
                    <div className={`${styles.chart} ${styles.enterpriseChart}`}>
                      <div className={styles.chartHeading}><WalletCards size={24} /><h3>Expense Breakdown</h3></div>
                      <div className={styles.chartCanvas} aria-label="Expense breakdown unavailable"><span className={styles.chartUnavailable}>Fuel, maintenance and operations costs are unavailable because no authoritative expense ledger exists.</span></div>
                    </div>
                  </div>
                  <div className={styles.topClientsPanel}>
                    <h3 className={styles.sectionTitle}>Top Clients</h3>
                    {data.finance.topClients.map((client) => <div className={styles.barRow} key={client.name}><div className={styles.barHeader}><span>{client.name}</span><strong>{money(client.invoicedValue, data.finance.currency ?? 'GBP')}</strong></div><div className={styles.barTrack}><div className={styles.barFill} style={{ width: `${Math.max(4, Math.round((client.invoicedValue / maxClientValue) * 100))}%` }} /></div></div>)}
                  </div>
                </div>
              </section>
            )}

            {data && (
              <section className={styles.module} id="admin-compliance">
                <div className={styles.sectionHeader}><div><h2 className={styles.sectionTitle}>Admin & Compliance</h2><p className={styles.sectionText}>Platform Owner controls, audit, security and compliance surfaces.</p></div></div>
                <div className={styles.moduleBody}><div className={styles.adminGrid}>
                  <div className={styles.adminCard}><div className={styles.adminIcon}><ShieldCheck size={24} /></div><h3>User Roles & Permissions</h3><p>Access Matrix and Platform Admin registry.</p><div className={styles.actions}><Link className={styles.linkButton} href="/super-admin/settings/roles-permissions">Manage Roles</Link></div></div>
                  <div className={styles.adminCard}><div className={styles.adminIcon}><KeyRound size={24} /></div><h3>API Keys & Integrations</h3><p>Stripe visibility is available. Xero, Courier Exchange API and general key management are not configured as Super Admin controls.</p><div className={styles.adminState} style={{ color: C.yellow }}>Partially configured</div></div>
                  <div className={styles.adminCard}><div className={styles.adminIcon}><ScrollText size={24} /></div><h3>System Logs & Audit Trail</h3><p>Review immutable platform audit activity and operational evidence.</p><div className={styles.actions}><Link className={styles.linkButton} href="/super-admin/settings/audit-logs">View Logs</Link></div></div>
                  <div className={styles.adminCard}><div className={styles.adminIcon}><ShieldAlert size={24} /></div><h3>Security Alerts</h3><p>Platform health, security and degraded-service monitoring.</p><div className={styles.actions}><Link className={styles.linkButton} href="/super-admin/health">Open Health</Link></div></div>
                  <div className={styles.adminCard}><div className={styles.adminIcon}><DatabaseBackup size={24} /></div><h3>Backup & Restore</h3><p>Direct restore is not exposed from the browser control plane.</p><div className={styles.adminState} style={{ color: C.yellow }}>Restricted by design</div></div>
                  <div className={styles.adminCard}><div className={styles.adminIcon}><FileCheck2 size={24} /></div><h3>Compliance Status</h3><p>Document review, insurance, operator licences, expiries and legal agreements are available. No ISO certification is asserted by this dashboard.</p><div className={styles.actions}><Link className={styles.linkButton} href="/super-admin/compliance/documents">Open Compliance</Link></div></div>
                </div></div>
              </section>
            )}

            <footer className={styles.footer}>
              <div><div className={styles.footerBrand}>XDrive Logistics LTD</div><div className={styles.footerTagline}>Your Freight. Our Priority.</div></div>
              <div className={styles.footerLinks}><Link href="/track">Track Shipment</Link><Link href="/quote">Get a Quote</Link><Link href="/contact">Contact</Link><span>© {new Date().getFullYear()} XDrive Logistics</span></div>
            </footer>
          </>
        )}
      </main>
    </ProtectedRoute>
  );
}
