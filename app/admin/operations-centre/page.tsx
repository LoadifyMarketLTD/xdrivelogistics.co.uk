'use client';

import {
  AlertTriangle,
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Crosshair,
  FileText,
  FileUp,
  Filter,
  Mail,
  Maximize2,
  MessageSquare,
  Phone,
  Plus,
  ReceiptText,
  Route,
  Search,
  Settings2,
  Truck,
  UploadCloud,
  UsersRound,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useAuth } from '../../components/AuthContext';
import ProtectedRoute from '../../components/ProtectedRoute';

type Metric = {
  label: string;
  value: string;
  note: string;
  tone: 'blue' | 'green' | 'amber' | 'red' | 'violet';
  Icon: typeof ClipboardList;
};

type JobCard = {
  id: string;
  pickup: string;
  dropoff: string;
  start: string;
  eta: string;
  driver: string;
  vehicle: string;
  progress: number;
  status: string;
  tone: 'green' | 'blue' | 'amber' | 'red' | 'slate';
  detail?: string;
};

type AlertItem = {
  title: string;
  message: string;
  time: string;
  tone: 'red' | 'amber' | 'blue' | 'violet';
  Icon: typeof AlertTriangle;
};

const metrics: Metric[] = [
  { label: "Today's Jobs", value: '126', note: 'View all jobs', tone: 'blue', Icon: ClipboardList },
  { label: 'Active', value: '34', note: 'Currently in progress', tone: 'green', Icon: Route },
  { label: 'Completed', value: '71', note: 'Today completed', tone: 'green', Icon: CheckCircle2 },
  { label: 'Delayed', value: '3', note: 'Requires attention', tone: 'amber', Icon: Clock3 },
  { label: 'Drivers Online', value: '29', note: 'Out of 41', tone: 'violet', Icon: UsersRound },
  { label: 'Vehicles', value: '41', note: 'Total in fleet', tone: 'blue', Icon: Truck },
  { label: 'POD Missing', value: '2', note: 'Awaiting upload', tone: 'red', Icon: FileUp },
  { label: 'Invoices Pending', value: '7', note: 'Awaiting payment', tone: 'amber', Icon: ReceiptText },
];

const jobs: JobCard[] = [
  {
    id: 'XDL-2026-00134',
    pickup: 'Manchester M17 1AB',
    dropoff: 'Leeds LS1 2EX',
    start: '09:00',
    eta: '11:30',
    driver: 'Daniel Preda',
    vehicle: 'Luton - YP21 XDF',
    progress: 75,
    status: 'On site',
    tone: 'amber',
  },
  {
    id: 'XDL-2026-00135',
    pickup: 'Birmingham B1 1AA',
    dropoff: 'London E1 6AN',
    start: '10:00',
    eta: '13:30',
    driver: 'Marius Ionescu',
    vehicle: 'Sprinter - BT22 XDL',
    progress: 45,
    status: 'On my way',
    tone: 'green',
  },
  {
    id: 'XDL-2026-00136',
    pickup: 'Glasgow G2 1DY',
    dropoff: 'Edinburgh EH1 1YZ',
    start: '07:30',
    eta: '09:30',
    driver: 'Cristian Pop',
    vehicle: 'LWB - SV21 XDR',
    progress: 90,
    status: 'Loaded',
    tone: 'blue',
  },
  {
    id: 'XDL-2026-00137',
    pickup: 'Southampton SO15 1GA',
    dropoff: 'Bristol BS1 5TY',
    start: '08:00',
    eta: '12:00',
    driver: 'George Stan',
    vehicle: 'Luton - GL20 XDR',
    progress: 15,
    status: 'Pending POD',
    tone: 'slate',
  },
  {
    id: 'XDL-2026-00138',
    pickup: 'Newcastle NE1 1AA',
    dropoff: 'Manchester M1 1AE',
    start: '06:00',
    eta: '10:30',
    driver: 'Alexandru D.',
    vehicle: '7.5t - AB12 XDR',
    progress: 68,
    status: 'Delayed',
    tone: 'red',
    detail: 'Delayed 45m',
  },
];

const alerts: AlertItem[] = [
  { title: 'Driver delayed', message: 'Alexandru D. is delayed by 45 minutes', time: '5m ago', tone: 'red', Icon: AlertTriangle },
  { title: 'POD missing', message: '2 jobs await POD upload', time: '15m ago', tone: 'amber', Icon: FileUp },
  { title: 'Vehicle unavailable', message: 'Vehicle GL20 XDR not available', time: '30m ago', tone: 'amber', Icon: Truck },
  { title: 'Driver offline', message: 'George Stan is offline', time: '1h ago', tone: 'blue', Icon: UsersRound },
  { title: 'Document expired', message: 'Insurance document expired', time: '2h ago', tone: 'violet', Icon: FileText },
];

const timeline = [
  ['11:48', 'Invoice created', 'Job XDL-2026-00134', 'System', 'blue'],
  ['11:45', 'POD uploaded', '3 documents received', 'Daniel Preda', 'green'],
  ['11:41', 'Delivered', 'Leeds LS1 2EX', 'Daniel Preda', 'green'],
  ['10:18', 'Loaded', 'Manchester M17 1AB', 'Daniel Preda', 'blue'],
  ['09:55', 'On site', 'Manchester M17 1AB', 'Daniel Preda', 'amber'],
  ['09:31', 'On my way', 'To Manchester M17 1AB', 'Daniel Preda', 'green'],
] as const;

const sidebar = [
  ['Dashboard', BarChart3],
  ['Operations Centre', Crosshair],
  ['Diary', CalendarDays],
  ['Jobs', ClipboardList],
  ['Drivers & Vehicles', Truck],
  ['Customers', UsersRound],
  ['Documents', FileText],
  ['Invoices', ReceiptText],
  ['Alerts', Bell],
] as const;

const actions = [
  ['Assign Job', UsersRound, 'green'],
  ['Send Message', MessageSquare, 'blue'],
  ['Call Driver', Phone, 'green'],
  ['Upload Document', UploadCloud, 'violet'],
  ['Create Invoice', ReceiptText, 'amber'],
  ['View Reports', BarChart3, 'blue'],
] as const;

export default function OperationsCentrePage() {
  const { user } = useAuth();

  return (
    <ProtectedRoute>
      <main className="ops-shell">
        <aside className="ops-sidebar" aria-label="Operations navigation">
          <div className="brand">
            <span className="brand-mark">X</span>
            <span>
              <strong>DRIVE</strong>
              <small>LOGISTICS</small>
            </span>
          </div>

          <nav className="side-nav">
            {sidebar.map(([label, Icon]) => (
              <button key={label} className={label === 'Operations Centre' ? 'active' : ''} type="button">
                <Icon size={17} aria-hidden="true" />
                <span>{label}</span>
                {label === 'Alerts' && <b>7</b>}
              </button>
            ))}
          </nav>

          <div className="sidebar-footer">
            <div className="theme-toggle" aria-label="Theme">
              <button className="active" type="button">Dark</button>
              <button type="button">Light</button>
            </div>
            <span>XDrive Logistics Ltd</span>
          </div>
        </aside>

        <section className="ops-main">
          <header className="topbar">
            <div>
              <h1>Operations Centre</h1>
              <p>Real-time overview of your entire operation</p>
            </div>
            <div className="topbar-tools">
              <label className="search-box">
                <Search size={16} aria-hidden="true" />
                <input placeholder="Search anything..." />
                <kbd>CTRL + K</kbd>
              </label>
              <button className="icon-button" type="button" aria-label="Messages"><MessageSquare size={18} /></button>
              <button className="icon-button has-badge" type="button" aria-label="Notifications"><Bell size={18} /><span>7</span></button>
              <button className="icon-button" type="button" aria-label="Mail"><Mail size={18} /></button>
              <div className="operator">
                <span>
                  <strong>{user?.email?.split('@')[0] ?? 'Daniel Preda'}</strong>
                  <small>Fleet Operator</small>
                </span>
                <div className="avatar">DP</div>
              </div>
            </div>
          </header>

          <section className="metrics-grid" aria-label="Operations metrics">
            {metrics.map(({ label, value, note, tone, Icon }) => (
              <article key={label} className={`metric-card tone-${tone}`}>
                <div>
                  <span>{label}</span>
                  <strong>{value}</strong>
                  <small>{note}</small>
                </div>
                <div className="metric-icon"><Icon size={23} aria-hidden="true" /></div>
              </article>
            ))}
          </section>

          <section className="filter-row" aria-label="Job filters">
            {['Today', 'Tomorrow', 'Delayed', 'Awaiting POD', 'Awaiting Invoice', 'Cancelled', 'Completed'].map((filter) => (
              <button key={filter} className={filter === 'Today' ? 'selected' : ''} type="button">{filter}</button>
            ))}
            <button type="button">More Filters <Filter size={14} aria-hidden="true" /></button>
            <label className="job-search">
              <Search size={16} aria-hidden="true" />
              <input placeholder="Search jobs, drivers, customers..." />
            </label>
            <button className="icon-button" type="button" aria-label="Filter settings"><Settings2 size={17} /></button>
            <button className="new-job" type="button"><Plus size={18} /> New Job</button>
          </section>

          <section className="workspace-grid">
            <article className="panel active-jobs">
              <div className="panel-title">
                <h2>Active Jobs</h2>
                <span>27</span>
              </div>
              <div className="job-list">
                {jobs.map((job) => (
                  <div key={job.id} className={`job-card job-${job.tone}`}>
                    <div className="job-head">
                      <span><i /> JOB #{job.id}</span>
                      <strong>{job.status}</strong>
                    </div>
                    <div className="route">
                      <b>{job.pickup}</b>
                      <b>{job.dropoff}</b>
                    </div>
                    <div className="job-meta">
                      <div className="driver-face">{job.driver.split(' ').map((part) => part[0]).join('').slice(0, 2)}</div>
                      <span>
                        <strong>{job.driver}</strong>
                        <small>{job.vehicle}</small>
                      </span>
                      <time>{job.start}<br />{job.eta}</time>
                    </div>
                    <div className="progress-line"><span style={{ width: `${job.progress}%` }} /></div>
                    <footer>
                      <small>{job.progress}%</small>
                      {job.detail && <em>{job.detail}</em>}
                    </footer>
                  </div>
                ))}
              </div>
              <button className="text-action" type="button">View all active jobs</button>
            </article>

            <div className="centre-stack">
              <article className="panel map-panel">
                <div className="panel-title">
                  <h2>Live Operations Map <span>41 vehicles tracking</span></h2>
                  <button type="button"><Maximize2 size={15} /> Full Screen</button>
                </div>
                <div className="map-canvas" aria-label="Live operations map">
                  <svg viewBox="0 0 740 420" role="img" aria-label="UK operations map">
                    <defs>
                      <linearGradient id="routeGlow" x1="0" x2="1" y1="0" y2="1">
                        <stop offset="0" stopColor="#22c55e" />
                        <stop offset="0.5" stopColor="#3b82f6" />
                        <stop offset="1" stopColor="#f59e0b" />
                      </linearGradient>
                    </defs>
                    <path className="land" d="M142 312 C126 270 142 232 181 216 C176 177 202 142 238 129 C259 82 314 68 357 94 C389 69 448 79 472 115 C520 112 561 144 572 188 C623 202 645 242 626 286 C672 321 645 372 589 374 L500 373 C451 405 384 393 357 360 C313 375 260 360 244 321 C208 336 166 335 142 312 Z" />
                    <path className="road" d="M235 302 C282 251 304 222 348 202 C394 181 420 156 458 124" />
                    <path className="road" d="M321 330 C350 286 386 255 438 237 C494 219 527 193 563 158" />
                    <path className="road" d="M266 167 C300 192 323 217 343 262 C361 302 392 323 440 337" />
                    <path className="route-line" d="M314 242 C350 218 385 216 418 250 C454 286 505 274 547 240" />
                    <path className="route-line amber" d="M303 177 C351 167 390 189 426 219" />
                  </svg>

                  {[
                    ['Glasgow', 31, 12], ['Newcastle', 70, 19], ['Leeds', 70, 33], ['Manchester', 47, 42],
                    ['Birmingham', 52, 58], ['London', 68, 69], ['Cardiff', 36, 72], ['Southampton', 57, 78],
                    ['Norwich', 86, 58], ['Plymouth', 19, 83],
                  ].map(([city, left, top]) => (
                    <span key={city} className="city" style={{ left: `${left}%`, top: `${top}%` }}>{city}</span>
                  ))}

                  {[
                    ['van', 'green', 37, 27], ['truck', 'slate', 46, 23], ['car', 'blue', 52, 34],
                    ['van', 'red', 75, 42], ['truck', 'green', 82, 53], ['van', 'red', 27, 48],
                    ['van', 'green', 51, 76],
                  ].map(([label, tone, left, top], index) => (
                    <span key={`${label}-${index}`} className={`vehicle-pin ${tone}`} style={{ left: `${left}%`, top: `${top}%` }}>
                      <Truck size={15} aria-hidden="true" />
                    </span>
                  ))}

                  {[
                    ['5', 'amber', 47, 38], ['3', 'green', 66, 34], ['2', 'red', 58, 54], ['4', 'blue', 73, 64],
                  ].map(([count, tone, left, top]) => (
                    <span key={count} className={`cluster ${tone}`} style={{ left: `${left}%`, top: `${top}%` }}>{count}</span>
                  ))}

                  <div className="map-controls">
                    <button type="button" aria-label="Zoom in"><ZoomIn size={16} /></button>
                    <button type="button" aria-label="Zoom out"><ZoomOut size={16} /></button>
                    <button type="button" aria-label="Locate"><Crosshair size={16} /></button>
                  </div>
                  <div className="legend">
                    {['On My Way', 'On Site', 'Loaded', 'Delivered', 'Delayed', 'Idle', 'Offline'].map((label) => (
                      <span key={label}><i />{label}</span>
                    ))}
                  </div>
                </div>
              </article>

              <article className="panel timeline-panel">
                <div className="panel-title">
                  <h2>Operations Timeline</h2>
                  <button type="button">All Events</button>
                </div>
                <div className="timeline-list">
                  {timeline.map(([time, title, detail, owner, tone]) => (
                    <div key={`${time}-${title}`} className="timeline-row">
                      <time>{time}</time>
                      <i className={`dot ${tone}`} />
                      <span>
                        <strong>{title}</strong>
                        <small>{detail}</small>
                      </span>
                      <em>{owner}</em>
                    </div>
                  ))}
                </div>
                <button className="text-action" type="button">View full timeline</button>
              </article>
            </div>

            <aside className="right-stack">
              <article className="panel alerts-panel">
                <div className="panel-title">
                  <h2>Alerts <span>6</span></h2>
                  <button type="button">View all</button>
                </div>
                <div className="alert-list">
                  {alerts.map(({ title, message, time, tone, Icon }) => (
                    <div key={title} className={`alert-card alert-${tone}`}>
                      <Icon size={18} aria-hidden="true" />
                      <span>
                        <strong>{title}</strong>
                        <small>{message}</small>
                      </span>
                      <time>{time}</time>
                    </div>
                  ))}
                </div>
              </article>

              <article className="panel actions-panel">
                <div className="panel-title"><h2>Quick Actions</h2></div>
                <div className="actions-grid">
                  {actions.map(([label, Icon, tone]) => (
                    <button key={label} className={`action-${tone}`} type="button">
                      <Icon size={23} aria-hidden="true" />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </article>
            </aside>
          </section>
        </section>
      </main>

      <style jsx>{`
        .ops-shell {
          min-height: calc(100vh - 92px);
          background:
            linear-gradient(135deg, rgba(10, 16, 28, 0.98), rgba(6, 21, 37, 0.98)),
            #07111e;
          color: #eef6ff;
          display: grid;
          grid-template-columns: 230px minmax(0, 1fr);
          font-family: Inter, system-ui, sans-serif;
        }

        button, input {
          font: inherit;
        }

        button {
          color: inherit;
        }

        .ops-sidebar {
          border-right: 1px solid rgba(148, 163, 184, 0.18);
          background: linear-gradient(180deg, rgba(9, 23, 42, 0.98), rgba(8, 19, 32, 0.96));
          padding: 18px 12px;
          display: flex;
          flex-direction: column;
          gap: 18px;
          min-width: 0;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 48px;
          padding: 0 10px 16px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.14);
        }

        .brand-mark {
          color: #4f8cff;
          font-size: 2rem;
          line-height: 1;
          font-weight: 900;
        }

        .brand strong,
        .brand small {
          display: block;
          letter-spacing: 0;
        }

        .brand strong {
          color: #ffffff;
          font-size: 1rem;
        }

        .brand small {
          color: #8fb1d8;
          font-size: 0.64rem;
        }

        .side-nav {
          display: grid;
          gap: 4px;
        }

        .side-nav button {
          min-height: 42px;
          border: 0;
          border-radius: 6px;
          background: transparent;
          display: grid;
          grid-template-columns: 22px minmax(0, 1fr) auto;
          align-items: center;
          gap: 8px;
          padding: 0 10px;
          color: #c7d4e3;
          cursor: pointer;
          text-align: left;
        }

        .side-nav button.active {
          background: linear-gradient(135deg, #1d5cff, #326cff);
          color: #ffffff;
          box-shadow: 0 10px 28px rgba(29, 92, 255, 0.24);
        }

        .side-nav b {
          min-width: 21px;
          height: 21px;
          border-radius: 999px;
          background: rgba(239, 68, 68, 0.75);
          display: grid;
          place-items: center;
          font-size: 0.7rem;
        }

        .sidebar-footer {
          margin-top: auto;
          color: #c7d4e3;
          display: grid;
          gap: 12px;
        }

        .theme-toggle {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4px;
          background: rgba(2, 8, 23, 0.46);
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 8px;
          padding: 4px;
        }

        .theme-toggle button {
          min-height: 34px;
          border: 0;
          border-radius: 6px;
          background: transparent;
          cursor: pointer;
        }

        .theme-toggle button.active {
          background: #153a86;
        }

        .ops-main {
          min-width: 0;
          padding: 14px 18px 24px;
        }

        .topbar,
        .filter-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .topbar {
          min-height: 56px;
          margin-bottom: 12px;
        }

        h1, h2, p {
          margin: 0;
        }

        .topbar h1 {
          font-size: 1.45rem;
          line-height: 1.2;
        }

        .topbar p {
          margin-top: 4px;
          color: #a8b7c9;
        }

        .topbar-tools {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .search-box,
        .job-search {
          height: 40px;
          border: 1px solid rgba(148, 163, 184, 0.22);
          border-radius: 8px;
          background: rgba(15, 31, 50, 0.72);
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 12px;
          color: #8fa3bc;
        }

        .search-box {
          width: min(360px, 34vw);
        }

        .job-search {
          margin-left: auto;
          width: min(360px, 28vw);
        }

        input {
          width: 100%;
          min-width: 0;
          border: 0;
          outline: 0;
          background: transparent;
          color: #eef6ff;
        }

        input::placeholder {
          color: #91a0b1;
        }

        kbd {
          border-radius: 6px;
          background: rgba(148, 163, 184, 0.15);
          color: #c9d8e8;
          padding: 2px 6px;
          font-size: 0.65rem;
          white-space: nowrap;
        }

        .icon-button,
        .panel-title button,
        .filter-row button,
        .new-job {
          border: 1px solid rgba(148, 163, 184, 0.2);
          background: rgba(13, 29, 49, 0.8);
          border-radius: 8px;
          min-height: 40px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
        }

        .icon-button {
          width: 40px;
          position: relative;
        }

        .has-badge span {
          position: absolute;
          top: -6px;
          right: -5px;
          min-width: 18px;
          height: 18px;
          border-radius: 999px;
          background: #ef4444;
          color: #fff;
          font-size: 0.68rem;
          display: grid;
          place-items: center;
        }

        .operator {
          display: flex;
          align-items: center;
          gap: 10px;
          padding-left: 10px;
          border-left: 1px solid rgba(148, 163, 184, 0.16);
        }

        .operator strong,
        .operator small {
          display: block;
          white-space: nowrap;
        }

        .operator small {
          color: #9aaabc;
          margin-top: 2px;
        }

        .avatar,
        .driver-face {
          border-radius: 8px;
          background: linear-gradient(135deg, #9cc8ff, #5b6c82);
          color: #07111e;
          display: grid;
          place-items: center;
          font-weight: 800;
        }

        .avatar {
          width: 38px;
          height: 38px;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(8, minmax(125px, 1fr));
          gap: 10px;
          margin-bottom: 14px;
        }

        .metric-card,
        .panel,
        .job-card,
        .alert-card {
          border: 1px solid rgba(148, 163, 184, 0.18);
          background: rgba(13, 29, 49, 0.76);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
        }

        .metric-card {
          min-height: 102px;
          border-radius: 8px;
          padding: 12px;
          display: flex;
          justify-content: space-between;
          gap: 8px;
        }

        .metric-card span,
        .metric-card small,
        .panel-title span {
          color: #a8b7c9;
        }

        .metric-card strong {
          display: block;
          margin: 8px 0;
          font-size: 1.75rem;
          line-height: 1;
        }

        .metric-icon {
          width: 50px;
          height: 50px;
          border-radius: 16px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
        }

        .tone-blue .metric-icon { background: rgba(37, 99, 235, 0.34); color: #77adff; }
        .tone-green .metric-icon { background: rgba(22, 163, 74, 0.34); color: #62d887; }
        .tone-amber .metric-icon { background: rgba(217, 119, 6, 0.34); color: #f8b84b; }
        .tone-red .metric-icon { background: rgba(220, 38, 38, 0.34); color: #ff7b7b; }
        .tone-violet .metric-icon { background: rgba(124, 58, 237, 0.34); color: #b090ff; }
        .tone-red strong { color: #ff7b7b; }

        .filter-row {
          flex-wrap: wrap;
          padding: 10px;
          border-top: 1px solid rgba(148, 163, 184, 0.14);
          border-bottom: 1px solid rgba(148, 163, 184, 0.14);
          margin-bottom: 12px;
        }

        .filter-row button {
          padding: 0 14px;
          color: #c9d8e8;
        }

        .filter-row button.selected,
        .new-job {
          background: linear-gradient(135deg, #1f5fff, #3972ff);
          border-color: rgba(108, 145, 255, 0.7);
          color: #ffffff;
        }

        .workspace-grid {
          display: grid;
          grid-template-columns: minmax(280px, 390px) minmax(430px, 1fr) minmax(300px, 420px);
          gap: 10px;
          align-items: start;
        }

        .centre-stack,
        .right-stack {
          display: grid;
          gap: 10px;
        }

        .panel {
          border-radius: 8px;
          padding: 12px;
          min-width: 0;
        }

        .panel-title {
          min-height: 28px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }

        .panel-title h2 {
          font-size: 1rem;
          line-height: 1.2;
        }

        .panel-title h2 span {
          margin-left: 10px;
          color: #29d17d;
          font-size: 0.76rem;
          font-weight: 700;
        }

        .panel-title > span,
        .panel-title h2 > span:last-child {
          border-radius: 999px;
          background: rgba(148, 163, 184, 0.13);
          padding: 3px 8px;
        }

        .panel-title button {
          min-height: 32px;
          padding: 0 10px;
          color: #c9d8e8;
        }

        .job-list {
          display: grid;
          gap: 8px;
        }

        .job-card {
          border-radius: 8px;
          padding: 11px;
          display: grid;
          gap: 8px;
        }

        .job-head,
        .job-meta,
        .job-card footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .job-head span {
          color: #6da5ff;
          font-size: 0.78rem;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .job-head i {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #22c55e;
        }

        .job-head strong {
          border-radius: 6px;
          padding: 4px 8px;
          background: rgba(148, 163, 184, 0.14);
          font-size: 0.7rem;
          text-transform: uppercase;
        }

        .job-amber .job-head strong { background: rgba(245, 158, 11, 0.24); color: #ffc36a; }
        .job-green .job-head strong { background: rgba(34, 197, 94, 0.22); color: #70df91; }
        .job-blue .job-head strong { background: rgba(59, 130, 246, 0.24); color: #88b8ff; }
        .job-red .job-head strong { background: rgba(239, 68, 68, 0.24); color: #ff8b8b; }

        .route {
          display: grid;
          gap: 4px;
          font-size: 0.92rem;
        }

        .route b:nth-child(2)::before {
          content: '-> ';
          color: #c9d8e8;
        }

        .driver-face {
          width: 34px;
          height: 34px;
          font-size: 0.74rem;
        }

        .job-meta {
          justify-content: flex-start;
        }

        .job-meta span {
          min-width: 0;
          flex: 1;
        }

        .job-meta strong,
        .job-meta small {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .job-meta small,
        .job-card footer,
        .timeline-row small,
        .alert-card small {
          color: #a8b7c9;
        }

        .job-meta time {
          margin-left: auto;
          text-align: right;
          color: #dce8f6;
        }

        .progress-line {
          height: 5px;
          border-radius: 999px;
          background: rgba(148, 163, 184, 0.18);
          overflow: hidden;
        }

        .progress-line span {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #2563eb, #7aa7ff);
        }

        .job-card em {
          color: #ff6767;
          font-style: normal;
        }

        .map-canvas {
          min-height: 390px;
          position: relative;
          border-radius: 8px;
          overflow: hidden;
          background:
            linear-gradient(160deg, rgba(9, 25, 44, 0.96), rgba(9, 36, 46, 0.88)),
            #07111e;
          border: 1px solid rgba(148, 163, 184, 0.16);
        }

        .map-canvas svg {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
        }

        .land {
          fill: rgba(32, 84, 83, 0.72);
          stroke: rgba(150, 210, 199, 0.28);
          stroke-width: 2;
        }

        .road {
          fill: none;
          stroke: rgba(178, 199, 217, 0.18);
          stroke-width: 3;
          stroke-linecap: round;
        }

        .route-line {
          fill: none;
          stroke: url(#routeGlow);
          stroke-width: 4;
          stroke-linecap: round;
          stroke-dasharray: 10 8;
        }

        .route-line.amber {
          stroke: #f59e0b;
          opacity: 0.78;
        }

        .city,
        .vehicle-pin,
        .cluster {
          position: absolute;
          transform: translate(-50%, -50%);
          z-index: 2;
        }

        .city {
          color: #f4f9ff;
          text-shadow: 0 2px 8px rgba(0, 0, 0, 0.9);
          font-weight: 700;
        }

        .vehicle-pin,
        .cluster {
          display: grid;
          place-items: center;
          box-shadow: 0 8px 18px rgba(0, 0, 0, 0.28);
        }

        .vehicle-pin {
          width: 30px;
          height: 22px;
          border-radius: 6px;
        }

        .vehicle-pin.green,
        .cluster.green { background: #3dcc48; color: #06220c; }
        .vehicle-pin.blue,
        .cluster.blue { background: #3b82f6; color: #ffffff; }
        .vehicle-pin.red,
        .cluster.red { background: #ef4444; color: #ffffff; }
        .vehicle-pin.slate { background: #9aa8b8; color: #0f172a; }
        .cluster.amber { background: #f59e0b; color: #271705; }

        .cluster {
          width: 34px;
          height: 34px;
          border-radius: 999px;
          font-weight: 900;
        }

        .map-controls {
          position: absolute;
          top: 12px;
          right: 12px;
          z-index: 3;
          display: grid;
          gap: 8px;
        }

        .map-controls button {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          border: 1px solid rgba(148, 163, 184, 0.28);
          background: rgba(8, 20, 35, 0.78);
          display: grid;
          place-items: center;
          cursor: pointer;
        }

        .legend {
          position: absolute;
          left: 12px;
          right: 12px;
          bottom: 10px;
          z-index: 3;
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          padding: 8px 10px;
          border-radius: 8px;
          background: rgba(6, 16, 28, 0.66);
        }

        .legend span {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: #d9e6f5;
          font-size: 0.73rem;
        }

        .legend i {
          width: 9px;
          height: 9px;
          border-radius: 2px;
          background: #22c55e;
        }

        .legend span:nth-child(2) i,
        .legend span:nth-child(6) i { background: #f59e0b; }
        .legend span:nth-child(3) i { background: #3b82f6; }
        .legend span:nth-child(5) i { background: #ef4444; }
        .legend span:nth-child(7) i { background: #64748b; }

        .timeline-list,
        .alert-list {
          display: grid;
          gap: 6px;
        }

        .timeline-row {
          min-height: 42px;
          display: grid;
          grid-template-columns: 48px 22px minmax(0, 1fr) 96px;
          align-items: center;
          gap: 8px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.1);
        }

        .timeline-row span,
        .alert-card span {
          min-width: 0;
        }

        .timeline-row strong,
        .timeline-row small,
        .alert-card strong,
        .alert-card small {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .timeline-row em {
          color: #a8b7c9;
          font-style: normal;
          text-align: right;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .dot {
          width: 20px;
          height: 20px;
          border-radius: 999px;
          display: block;
        }

        .dot.blue { background: #3b82f6; }
        .dot.green { background: #22c55e; }
        .dot.amber { background: #f59e0b; }

        .alert-card {
          min-height: 76px;
          border-radius: 8px;
          padding: 10px;
          display: grid;
          grid-template-columns: 36px minmax(0, 1fr) 58px;
          align-items: start;
          gap: 10px;
        }

        .alert-card > svg {
          width: 34px;
          height: 34px;
          padding: 8px;
          border-radius: 8px;
        }

        .alert-red > svg { background: rgba(239, 68, 68, 0.25); color: #ff7979; }
        .alert-amber > svg { background: rgba(245, 158, 11, 0.25); color: #ffbe54; }
        .alert-blue > svg { background: rgba(59, 130, 246, 0.25); color: #88b8ff; }
        .alert-violet > svg { background: rgba(124, 58, 237, 0.25); color: #b090ff; }

        .alert-card time {
          color: #a8b7c9;
          text-align: right;
          white-space: nowrap;
          font-size: 0.75rem;
        }

        .actions-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }

        .actions-grid button {
          min-height: 86px;
          border: 1px solid rgba(148, 163, 184, 0.18);
          background: rgba(13, 29, 49, 0.78);
          border-radius: 8px;
          display: grid;
          place-items: center;
          gap: 8px;
          cursor: pointer;
          color: #dce8f6;
          text-align: center;
        }

        .actions-grid svg {
          width: 40px;
          height: 40px;
          padding: 9px;
          border-radius: 8px;
        }

        .action-green svg { color: #57dc82; background: rgba(34, 197, 94, 0.2); }
        .action-blue svg { color: #78aaff; background: rgba(59, 130, 246, 0.2); }
        .action-violet svg { color: #b38cff; background: rgba(124, 58, 237, 0.2); }
        .action-amber svg { color: #f6b64b; background: rgba(245, 158, 11, 0.2); }

        .text-action {
          width: 100%;
          border: 0;
          background: transparent;
          color: #5794ff;
          margin-top: 10px;
          cursor: pointer;
        }

        @media (max-width: 1500px) {
          .metrics-grid {
            grid-template-columns: repeat(4, minmax(150px, 1fr));
          }

          .workspace-grid {
            grid-template-columns: minmax(280px, 360px) minmax(420px, 1fr);
          }

          .right-stack {
            grid-column: 1 / -1;
            grid-template-columns: minmax(0, 1fr) minmax(280px, 360px);
          }
        }

        @media (max-width: 1120px) {
          .ops-shell {
            grid-template-columns: 1fr;
          }

          .ops-sidebar {
            display: none;
          }

          .topbar,
          .topbar-tools {
            flex-wrap: wrap;
          }

          .search-box,
          .job-search {
            width: min(100%, 520px);
          }

          .workspace-grid {
            grid-template-columns: 1fr;
          }

          .right-stack {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .ops-main {
            padding: 12px;
          }

          .metrics-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .metric-card {
            min-height: 112px;
          }

          .topbar-tools .icon-button,
          .operator {
            display: none;
          }

          .job-search,
          .search-box {
            width: 100%;
          }

          .map-canvas {
            min-height: 330px;
          }

          .city {
            font-size: 0.72rem;
          }

          .timeline-row {
            grid-template-columns: 44px 18px minmax(0, 1fr);
          }

          .timeline-row em {
            display: none;
          }

          .actions-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 520px) {
          .metrics-grid {
            grid-template-columns: 1fr;
          }

          .filter-row button,
          .new-job {
            flex: 1 1 calc(50% - 8px);
          }

          .panel-title {
            align-items: flex-start;
            flex-direction: column;
          }

          .alert-card {
            grid-template-columns: 34px minmax(0, 1fr);
          }

          .alert-card time {
            grid-column: 2;
            text-align: left;
          }
        }
      `}</style>
    </ProtectedRoute>
  );
}
