'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileText,
  FileUp,
  MessageSquare,
  Phone,
  Plus,
  ReceiptText,
  Route,
  Search,
  Send,
  ShieldCheck,
  Truck,
  UploadCloud,
  UsersRound,
  Zap,
} from 'lucide-react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';

type Tone = 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'slate';

type MetricPayload = {
  todayJobs: number;
  activeJobs: number;
  completedToday: number;
  delayedJobs: number;
  driversOnline: number;
  driversTotal: number;
  vehiclesAvailable: number;
  vehiclesTotal: number;
  podMissing: number;
  invoicesPending: number;
  jobsAwaitingQuote: number;
  jobsAwaitingCarrier: number;
  companiesOnline: number;
  customersOnline: number;
  fleetCompaniesOnline: number;
  ownerDriversOnline: number;
  averageDeliveryTimeMinutes: number;
  averageResponseTimeMinutes: number;
  revenueToday: number;
  revenueThisMonth: number;
  platformHealth: string;
};

type Job = {
  id: string;
  shortId: string;
  pickup: string;
  dropoff: string;
  start: string;
  eta: string;
  driver: string;
  vehicle: string;
  progress: number;
  status: string;
  tone: Tone;
  bidCount: number;
  priority: string;
};

type MapPoint = {
  id: string;
  kind: string;
  label: string;
  lat: number | null;
  lng: number | null;
  status: string | null;
  updatedAt: string | null;
};

type TimelineItem = { id: string; time: string; title: string; detail: string; owner: string; tone: 'blue' | 'green' | 'amber' | 'red' };
type Alert = { id: string; title: string; message: string; time: string; severity: 'critical' | 'warning' | 'info'; type: string };

type Payload = {
  generatedAt: string;
  metrics: MetricPayload;
  jobs: Job[];
  mapPoints: MapPoint[];
  timeline: TimelineItem[];
  alerts: Alert[];
  errors: Array<{ message: string }>;
};

const emptyMetrics: MetricPayload = {
  todayJobs: 0,
  activeJobs: 0,
  completedToday: 0,
  delayedJobs: 0,
  driversOnline: 0,
  driversTotal: 0,
  vehiclesAvailable: 0,
  vehiclesTotal: 0,
  podMissing: 0,
  invoicesPending: 0,
  jobsAwaitingQuote: 0,
  jobsAwaitingCarrier: 0,
  companiesOnline: 0,
  customersOnline: 0,
  fleetCompaniesOnline: 0,
  ownerDriversOnline: 0,
  averageDeliveryTimeMinutes: 0,
  averageResponseTimeMinutes: 0,
  revenueToday: 0,
  revenueThisMonth: 0,
  platformHealth: 'Unknown',
};

const emptyPayload: Payload = { generatedAt: '', metrics: emptyMetrics, jobs: [], mapPoints: [], timeline: [], alerts: [], errors: [] };

const statusFilters = [
  ['all', 'All'],
  ['today', 'Today'],
  ['active', 'Active'],
  ['allocated', 'Assigned'],
  ['collected', 'Collected'],
  ['delivered', 'Delivered'],
  ['delayed', 'Delayed'],
  ['cancelled', 'Cancelled'],
  ['awaiting_pod', 'Awaiting POD'],
  ['awaiting_invoice', 'Awaiting Invoice'],
  ['awaiting_payment', 'Awaiting Payment'],
] as const;

const quickActions = [
  ['Assign Driver', UsersRound, '/admin/diary'],
  ['Create Job', Plus, '/admin/jobs'],
  ['Create Invoice', ReceiptText, '/admin/invoices/new'],
  ['Open Marketplace', BriefcaseBusiness, '/admin/marketplace'],
  ['Upload POD', UploadCloud, '/admin/diary'],
  ['Call Driver', Phone, '/admin/drivers'],
  ['Send Message', MessageSquare, '/admin/dispatchers'],
  ['Dispatch', Send, '/admin/diary'],
  ['Reassign Vehicle', Truck, '/admin/vehicles'],
  ['Create Quote', FileText, '/admin/quotes'],
  ['Approve Company', ShieldCheck, '/admin/companies'],
  ['Open Finance', ReceiptText, '/admin/invoices'],
] as const;

function money(value: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value || 0);
}

function minutes(value: number) {
  if (!value) return '0m';
  if (value < 60) return `${value}m`;
  return `${Math.floor(value / 60)}h ${value % 60}m`;
}

function projectPoint(lat: number | null, lng: number | null) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  const left = ((lng + 8.5) / 10.3) * 100;
  const top = ((58.8 - lat) / 9) * 100;
  if (!Number.isFinite(left) || !Number.isFinite(top)) return null;
  return { left: Math.min(94, Math.max(6, left)), top: Math.min(92, Math.max(8, top)) };
}

export default function OperationsCentrePage() {
  const router = useRouter();
  const [payload, setPayload] = useState<Payload>(emptyPayload);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [date, setDate] = useState('today');
  const [sort, setSort] = useState('priority');

  const loadOperations = useCallback(async () => {
    setLoading(true);
    setError('');
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) {
      setPayload(emptyPayload);
      setError('No authenticated session found.');
      setLoading(false);
      return;
    }

    const params = new URLSearchParams({ q: query, status, date, sort, limit: '160' });
    const response = await fetch(`/api/admin/operations-centre?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setPayload(emptyPayload);
      setError(typeof body.error === 'string' ? body.error : `Operations API failed with HTTP ${response.status}`);
      setLoading(false);
      return;
    }
    setPayload(body as Payload);
    setLoading(false);
  }, [date, query, sort, status]);

  useEffect(() => { void loadOperations(); }, [loadOperations]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const channel = supabase
      .channel('operations-centre-live-refresh')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => { void loadOperations(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_tracking_events' }, () => { void loadOperations(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_locations' }, () => { void loadOperations(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notification_events' }, () => { void loadOperations(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadOperations]);

  const metrics = useMemo(() => {
    const m = payload.metrics;
    return [
      ['Today Jobs', String(m.todayJobs), 'Jobs dated today', 'blue', ClipboardList],
      ['Active Jobs', String(m.activeJobs), 'Live operational work', 'green', Route],
      ['Completed Today', String(m.completedToday), 'Closed today', 'green', CheckCircle2],
      ['Delayed Jobs', String(m.delayedJobs), 'Needs attention', m.delayedJobs ? 'amber' : 'green', Clock3],
      ['Drivers Online', `${m.driversOnline}/${m.driversTotal}`, 'Active driver capacity', 'violet', UsersRound],
      ['Vehicles Available', `${m.vehiclesAvailable}/${m.vehiclesTotal}`, 'Unassigned capacity', 'blue', Truck],
      ['POD Missing', String(m.podMissing), 'Delivered without POD', m.podMissing ? 'red' : 'green', FileUp],
      ['Invoices Pending', String(m.invoicesPending), 'Draft, sent, overdue', m.invoicesPending ? 'amber' : 'green', ReceiptText],
      ['Awaiting Quote', String(m.jobsAwaitingQuote), 'Needs quote response', 'blue', FileText],
      ['Awaiting Carrier', String(m.jobsAwaitingCarrier), 'Needs carrier award', 'amber', BriefcaseBusiness],
      ['Companies Online', String(m.companiesOnline), 'Active company context', 'green', ShieldCheck],
      ['Customers Online', String(m.customersOnline), 'Visible customer jobs', 'blue', UsersRound],
      ['Fleet Companies', String(m.fleetCompaniesOnline), 'Awarded carriers', 'violet', Truck],
      ['Owner Drivers', String(m.ownerDriversOnline), 'Available driver pool', 'green', UsersRound],
      ['Avg Delivery', minutes(m.averageDeliveryTimeMinutes), 'Pickup to delivery', 'blue', Clock3],
      ['Avg Response', minutes(m.averageResponseTimeMinutes), 'Job to bid', 'violet', Zap],
      ['Revenue Today', money(m.revenueToday), 'Invoice value today', 'green', ReceiptText],
      ['Revenue Month', money(m.revenueThisMonth), 'Invoice value this month', 'green', ReceiptText],
      ['Platform Health', m.platformHealth, `${payload.errors.length} source issue${payload.errors.length === 1 ? '' : 's'}`, payload.errors.length ? 'red' : 'green', ShieldCheck],
    ] as Array<[string, string, string, Tone, typeof ClipboardList]>;
  }, [payload.errors.length, payload.metrics]);

  return (
    <ProtectedRoute>
      <main className="ops-page">
        <header className="ops-header">
          <div>
            <h1>Operations Centre</h1>
            <p>{loading ? 'Loading live operations...' : `Live snapshot updated ${payload.generatedAt ? new Date(payload.generatedAt).toLocaleTimeString('en-GB') : 'now'}`}</p>
          </div>
          <div className="header-actions">
            <label className="search-box"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search jobs, locations, refs..." /></label>
            <select value={date} onChange={(event) => setDate(event.target.value)}><option value="today">Today</option><option value="tomorrow">Tomorrow</option><option value="all">All dates</option></select>
            <select value={sort} onChange={(event) => setSort(event.target.value)}><option value="priority">Priority</option><option value="time">Time</option></select>
            <button type="button" onClick={() => void loadOperations()}>Refresh</button>
          </div>
        </header>

        {(error || payload.errors.length > 0) && <section className="error-strip">{error || payload.errors.map((item) => item.message).join(' | ')}</section>}

        <section className="metric-grid">
          {metrics.map(([label, value, note, tone, Icon]) => (
            <article key={label} className={`metric tone-${tone}`}>
              <div><span>{label}</span><strong>{value}</strong><small>{note}</small></div>
              <Icon size={22} />
            </article>
          ))}
        </section>

        <section className="filter-row">
          {statusFilters.map(([id, label]) => (
            <button
              key={id}
              className={(id === 'today' ? date === 'today' && status === 'all' : status === id) ? 'active' : ''}
              onClick={() => {
                if (id === 'today') {
                  setDate('today');
                  setStatus('all');
                  return;
                }
                setStatus(id);
              }}
              type="button"
            >
              {label}
            </button>
          ))}
        </section>

        <section className="workspace">
          <article className="panel jobs-panel">
            <div className="panel-title"><h2>Active Jobs</h2><span>{payload.jobs.length}</span></div>
            <div className="job-list">
              {loading && <div className="empty">Loading jobs...</div>}
              {!loading && payload.jobs.length === 0 && <div className="empty">No jobs match the selected filters.</div>}
              {payload.jobs.map((job) => (
                <button key={job.id} className={`job-card job-${job.tone}`} onClick={() => router.push(`/admin/jobs/${job.id}`)} type="button">
                  <div className="job-head"><span>JOB #{job.shortId}</span><b>{job.status}</b></div>
                  <strong>{job.pickup}</strong>
                  <small>{job.dropoff}</small>
                  <div className="job-meta"><span>{job.driver}</span><span>{job.vehicle}</span><time>{job.start} / {job.eta}</time></div>
                  <div className="progress"><i style={{ width: `${job.progress}%` }} /></div>
                  <footer><span>{job.priority}</span><span>{job.bidCount} bid{job.bidCount === 1 ? '' : 's'}</span></footer>
                </button>
              ))}
            </div>
          </article>

          <div className="centre-stack">
            <article className="panel map-panel">
              <div className="panel-title"><h2>Live Operations Map</h2><span>{payload.mapPoints.length}</span></div>
              <div className="map">
                <svg viewBox="0 0 740 420" role="img" aria-label="UK live operations map">
                  <path className="land" d="M142 312 C126 270 142 232 181 216 C176 177 202 142 238 129 C259 82 314 68 357 94 C389 69 448 79 472 115 C520 112 561 144 572 188 C623 202 645 242 626 286 C672 321 645 372 589 374 L500 373 C451 405 384 393 357 360 C313 375 260 360 244 321 C208 336 166 335 142 312 Z" />
                  <path className="road" d="M235 302 C282 251 304 222 348 202 C394 181 420 156 458 124" />
                  <path className="road" d="M321 330 C350 286 386 255 438 237 C494 219 527 193 563 158" />
                  <path className="road" d="M266 167 C300 192 323 217 343 262 C361 302 392 323 440 337" />
                </svg>
                {payload.mapPoints.length === 0 && <div className="empty map-empty">No live coordinates available.</div>}
                {payload.mapPoints.map((point) => {
                  const position = projectPoint(point.lat, point.lng);
                  if (!position) return null;
                  return <span key={point.id} className={`pin pin-${point.kind}`} title={`${point.label} - ${point.status ?? 'unknown'}`} style={{ left: `${position.left}%`, top: `${position.top}%` }}><Truck size={15} /></span>;
                })}
              </div>
            </article>

            <article className="panel timeline-panel">
              <div className="panel-title"><h2>Live Timeline</h2><span>{payload.timeline.length}</span></div>
              <div className="timeline">
                {!loading && payload.timeline.length === 0 && <div className="empty">No operational events found.</div>}
                {payload.timeline.slice(0, 16).map((item) => (
                  <div key={item.id} className="timeline-row"><time>{item.time}</time><i className={`dot ${item.tone}`} /><span><b>{item.title}</b><small>{item.detail}</small></span><em>{item.owner}</em></div>
                ))}
              </div>
            </article>
          </div>

          <aside className="right-stack">
            <article className="panel alerts-panel">
              <div className="panel-title"><h2>Alert Centre</h2><span>{payload.alerts.length}</span></div>
              <div className="alerts">
                {!loading && payload.alerts.length === 0 && <div className="empty">No live alerts.</div>}
                {payload.alerts.slice(0, 14).map((alert) => (
                  <div key={alert.id} className={`alert alert-${alert.severity}`}><AlertTriangle size={18} /><span><b>{alert.title}</b><small>{alert.message}</small></span><time>{alert.time}</time></div>
                ))}
              </div>
            </article>

            <article className="panel actions-panel">
              <div className="panel-title"><h2>Quick Actions</h2></div>
              <div className="actions">
                {quickActions.map(([label, Icon, href]) => <button key={label} onClick={() => router.push(href)} type="button"><Icon size={21} /><span>{label}</span></button>)}
              </div>
            </article>
          </aside>
        </section>
      </main>

      <style jsx>{`
        .ops-page { min-height: calc(100vh - 92px); padding: 14px; background: #1A1F2B; color: #F4F6F8; }
        button, input, select { font: inherit; }
        .ops-header { display: flex; justify-content: space-between; align-items: center; gap: 14px; margin-bottom: 12px; }
        h1, h2, p { margin: 0; } h1 { font-size: 1.45rem; } p, small { color: #1D57D8; }
        .header-actions, .filter-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
        .search-box, select, .header-actions button, .filter-row button { min-height: 38px; border: 1px solid rgba(244, 246, 248, .22); border-radius: 8px; background: rgba(26, 31, 43, .82); color: #F4F6F8; }
        .search-box { display: flex; align-items: center; gap: 8px; padding: 0 10px; width: min(360px, 30vw); }
        input { width: 100%; min-width: 0; border: 0; outline: 0; background: transparent; color: #FFFFFF; }
        select, .header-actions button, .filter-row button { padding: 0 12px; cursor: pointer; }
        .filter-row { margin-bottom: 12px; }
        .filter-row button.active { background: #1D57D8; border-color: #1D57D8; color: #FFFFFF; }
        .error-strip { border: 1px solid rgba(245, 163, 0, .32); background: rgba(245, 163, 0, .12); color: #F4F6F8; border-radius: 8px; padding: 10px 12px; margin-bottom: 12px; }
        .metric-grid { display: grid; grid-template-columns: repeat(6, minmax(150px, 1fr)); gap: 10px; margin-bottom: 12px; }
        .metric, .panel { border: 1px solid rgba(244, 246, 248, .18); background: rgba(26, 31, 43, .78); border-radius: 8px; box-shadow: inset 0 1px 0 rgba(255, 255, 255, .035); }
        .metric { min-height: 92px; padding: 11px; display: flex; justify-content: space-between; gap: 10px; }
        .metric span, .metric small { display: block; } .metric strong { display: block; margin: 7px 0; font-size: 1.45rem; line-height: 1; }
        .tone-blue svg { color: #1D57D8; } .tone-green svg { color: #1D57D8; } .tone-amber svg { color: #1A1F2B; } .tone-red svg { color: #1A1F2B; } .tone-violet svg { color: #F4F6F8; }
        .workspace { display: grid; grid-template-columns: minmax(300px, 390px) minmax(430px, 1fr) minmax(310px, 430px); gap: 10px; align-items: start; }
        .centre-stack, .right-stack { display: grid; gap: 10px; }
        .panel { padding: 12px; min-width: 0; }
        .panel-title { display: flex; justify-content: space-between; align-items: center; gap: 10px; min-height: 28px; margin-bottom: 10px; }
        .panel-title h2 { font-size: .98rem; } .panel-title span { color: #1D57D8; background: rgba(244, 246, 248, .13); border-radius: 999px; padding: 3px 8px; }
        .job-list, .timeline, .alerts { display: grid; gap: 8px; }
        .job-card { width: 100%; text-align: left; border: 1px solid rgba(244, 246, 248, .18); background: rgba(26, 31, 43, .82); color: #F4F6F8; border-radius: 8px; padding: 10px; display: grid; gap: 7px; cursor: pointer; }
        .job-card:hover, .actions button:hover { border-color: rgba(29, 87, 216, .65); }
        .job-head, .job-meta, .job-card footer { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
        .job-head span { color: #1D57D8; font-size: .74rem; } .job-head b { font-size: .68rem; text-transform: uppercase; border-radius: 6px; padding: 4px 7px; background: rgba(244, 246, 248, .14); }
        .job-card > strong, .job-card > small, .job-meta span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .job-meta { color: #1D57D8; font-size: .74rem; } .job-meta time { color: #F4F6F8; white-space: nowrap; }
        .progress { height: 5px; border-radius: 999px; background: rgba(244, 246, 248, .18); overflow: hidden; } .progress i { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #1D57D8, #1D57D8); }
        .job-red .job-head b { color: #1A1F2B; background: rgba(245, 163, 0, .22); } .job-amber .job-head b { color: #1A1F2B; background: rgba(245, 163, 0, .22); } .job-green .job-head b { color: #1D57D8; background: rgba(29, 87, 216, .2); }
        .map { min-height: 410px; position: relative; border: 1px solid rgba(244, 246, 248, .16); border-radius: 8px; overflow: hidden; background: linear-gradient(160deg, rgba(26, 31, 43, .96), rgba(26, 31, 43, .88)); }
        .map svg { position: absolute; inset: 0; width: 100%; height: 100%; } .land { fill: rgba(29, 87, 216, .72); stroke: rgba(29, 87, 216, .28); stroke-width: 2; } .road { fill: none; stroke: rgba(29, 87, 216, .18); stroke-width: 3; stroke-linecap: round; }
        .pin { position: absolute; transform: translate(-50%, -50%); z-index: 2; width: 30px; height: 24px; border-radius: 7px; display: grid; place-items: center; box-shadow: 0 8px 18px rgba(26, 31, 43, .28); }
        .pin-driver { background: #1D57D8; color: #1A1F2B; } .pin-pickup { background: #1D57D8; color: #FFFFFF; } .pin-delivery { background: #F5A300; color: #1A1F2B; }
        .map-empty { position: absolute; inset: 0; display: grid; place-items: center; z-index: 2; }
        .timeline-row { min-height: 42px; display: grid; grid-template-columns: 48px 20px minmax(0,1fr) 90px; align-items: center; gap: 8px; border-bottom: 1px solid rgba(244, 246, 248, .1); }
        .timeline-row b, .timeline-row small, .alert b, .alert small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .timeline-row em { color: #1D57D8; font-style: normal; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .dot { width: 16px; height: 16px; border-radius: 999px; display: block; } .dot.blue { background: #1D57D8; } .dot.green { background: #1D57D8; } .dot.amber { background: #F5A300; } .dot.red { background: #F5A300; }
        .alert { min-height: 66px; border: 1px solid rgba(244, 246, 248, .16); background: rgba(26, 31, 43, .82); border-radius: 8px; padding: 9px; display: grid; grid-template-columns: 28px minmax(0,1fr) 56px; gap: 8px; align-items: start; }
        .alert-critical svg { color: #1A1F2B; } .alert-warning svg { color: #1A1F2B; } .alert-info svg { color: #1D57D8; } .alert time { color: #1D57D8; font-size: .72rem; text-align: right; }
        .actions { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 8px; } .actions button { min-height: 72px; border: 1px solid rgba(244, 246, 248, .16); background: rgba(26, 31, 43, .82); color: #F4F6F8; border-radius: 8px; display: grid; place-items: center; gap: 6px; cursor: pointer; text-align: center; }
        .empty { border: 1px dashed rgba(244, 246, 248, .24); border-radius: 8px; padding: 12px; color: #1D57D8; background: rgba(244, 246, 248, .06); }
        @media (max-width: 1500px) { .metric-grid { grid-template-columns: repeat(4, minmax(150px,1fr)); } .workspace { grid-template-columns: minmax(300px,380px) minmax(420px,1fr); } .right-stack { grid-column: 1 / -1; grid-template-columns: 1fr 1fr; } }
        @media (max-width: 1050px) { .ops-header, .header-actions { align-items: stretch; } .ops-header { flex-direction: column; } .search-box { width: 100%; } .metric-grid, .workspace, .right-stack { grid-template-columns: 1fr; } }
        @media (max-width: 620px) { .ops-page { padding: 10px; } .metric-grid { grid-template-columns: repeat(2, minmax(0,1fr)); } .workspace { gap: 8px; } .timeline-row { grid-template-columns: 44px 18px minmax(0,1fr); } .timeline-row em { display: none; } .actions { grid-template-columns: 1fr; } }
      `}</style>
    </ProtectedRoute>
  );
}
