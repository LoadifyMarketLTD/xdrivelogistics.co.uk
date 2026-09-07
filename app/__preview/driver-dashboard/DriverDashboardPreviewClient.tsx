'use client';

import { useState } from 'react';

type DetailTab = 'details' | 'journey' | 'quote' | 'documents';
type Load = { id: string; from: string; to: string; pickup: string; delivery: string; vehicle: string; price: string; member: string; note: string; distance: string };

const loads: Load[] = [
  { id: 'XD83A1F2C', from: 'BLACKBURN, BB1', to: 'MANCHESTER, M17', pickup: '07 Sep - 08:30', delivery: 'ASAP', vehicle: 'Luton Tail Lift', price: 'Quote required', member: 'NORTHLINE FREIGHT LTD', note: 'Direct delivery - tail lift required', distance: '31.8 miles' },
  { id: 'XD91C7B4D', from: 'LEEDS, LS10', to: 'LIVERPOOL, L24', pickup: '07 Sep - 10:00', delivery: '07 Sep - 12:45', vehicle: 'LWB Van', price: 'GBP 145 proposed', member: 'ATLAS DISPATCH LTD', note: '2 pallets - no co-loading', distance: '73.4 miles' },
];

function LoadRow({ load, onOpen }: { load: Load; onOpen: () => void }) {
  return <article className="driver-load-row driver-dashboard-marketplace-row driver-preview-load-row">
    <div className="driver-load-row__top">
      <div className="driver-load-cell"><span className="driver-cell-label">From</span><strong className="driver-cell-primary">{load.from}</strong><span className="driver-cell-secondary">Pickup {load.pickup}</span></div>
      <div className="driver-load-cell"><span className="driver-cell-label">To</span><strong className="driver-cell-primary">{load.to}</strong><span className="driver-cell-secondary">Delivery {load.delivery}</span></div>
      <div className="driver-load-cell"><span className="driver-cell-label">Vehicle</span><strong className="driver-cell-primary">{load.vehicle}</strong><span className="driver-cell-secondary">{load.distance}</span></div>
      <div className="driver-load-cell"><span className="driver-cell-label">Commercial</span><strong className="driver-cell-primary">{load.price}</strong><span className="driver-cell-secondary">{load.member}</span></div>
    </div>
    <div className="driver-load-row__meta"><span className="driver-preview-badge">LIVE</span><span>{load.note}</span><span>Load #{load.id}</span><div className="driver-row-actions"><button className="driver-preview-btn driver-preview-btn--primary" onClick={onOpen}>Open load</button></div></div>
  </article>;
}

export default function DriverDashboardPreviewClient() {
  const [selectedLoad, setSelectedLoad] = useState<Load>(loads[0]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tab, setTab] = useState<DetailTab>('details');
  const openLoad = (load: Load) => { setSelectedLoad(load); setTab('details'); setDrawerOpen(true); };

  return <div className="driver-preview-root xdrive-workspace-measured">
    <header className="driver-preview-topbar">
      <div className="driver-preview-brand"><img src="/xdrive-logo-primary.png" alt="XDrive Logistics" /><span>OWNER DRIVER</span></div>
      <nav className="driver-preview-nav" aria-label="Driver preview navigation">
        {['Dashboard','Directory','Return Journeys','Loads','Quotes','Diary','Event Log'].map((item) => <button key={item} data-active={item === 'Dashboard'}>{item}</button>)}
      </nav>
      <div className="driver-preview-top-actions"><button>+ Find Loads</button><button>Action Centre</button><button aria-label="Notifications">Alerts</button></div>
    </header>

    <main className="driver-reference-dashboard driver-dashboard-v4 driver-preview-canvas">
      <section className="driver-preview-pagehead"><div><span>OWNER-DRIVER WORKSPACE</span><h1>Driver Dashboard</h1></div><div className="driver-preview-pagehead-actions"><span className="driver-preview-live-dot">Available</span><button>Refresh</button></div></section>
      <div className="driver-dashboard-command-strip" aria-label="Driver operational snapshot">
        <button><span>Availability</span><strong>Available</strong></button><button><span>Current job</span><strong>None</strong></button>
        <button><span>Jobs today</span><strong>2</strong></button><button><span>Upcoming</span><strong>1</strong></button>
        <button><span>Vehicle</span><strong>Luton Tail Lift</strong></button><button className="driver-dashboard-command-strip__primary"><span>Exchange</span><strong>Find loads</strong></button>
      </div>

      <div className="driver-dashboard-layout">
        <aside className="driver-dashboard-left">
          <section className="driver-dashboard-section"><div className="driver-dashboard-section__header"><span>Status & availability</span><span>LIVE</span></div><div className="driver-dashboard-section__body">
            <div className="driver-dashboard-status-primary"><span>Availability</span><span className="driver-preview-status driver-preview-status--green">Available</span></div>
            <dl className="driver-dashboard-facts"><div><dt>Driver status</dt><dd>Active</dd></div><div><dt>Current job</dt><dd>None</dd></div><div><dt>Jobs today</dt><dd>2</dd></div><div><dt>Upcoming</dt><dd>1</dd></div></dl>
            <button className="driver-preview-btn driver-preview-btn--success">Update availability</button>
          </div></section>
          <section className="driver-dashboard-section"><div className="driver-dashboard-section__header"><span>Active vehicle</span><button className="driver-preview-link">Vehicle</button></div><div className="driver-dashboard-section__body">
            <dl className="driver-dashboard-facts"><div><dt>Vehicle</dt><dd>Luton Tail Lift</dd></div><div><dt>Registration</dt><dd>XD57 VAN</dd></div><div><dt>Readiness</dt><dd>Ready</dd></div></dl>
          </div></section>
          <section className="driver-dashboard-section"><div className="driver-dashboard-section__header"><span>Journey & position</span></div><div className="driver-dashboard-section__body">
            <div className="driver-dashboard-quick-row"><div><strong>Return journey</strong><span>Advertise empty capacity.</span></div><button className="driver-preview-link">Open</button></div>
            <dl className="driver-dashboard-facts"><div><dt>Future position</dt><dd>Manchester</dd></div><div><dt>Available from</dt><dd>Today - 17:30</dd></div></dl>
          </div></section>
        </aside>

        <div className="driver-dashboard-main">
          <section className="driver-dashboard-section"><div className="driver-dashboard-section__header"><span>Current execution</span><span className="driver-preview-status">No active job</span></div><div className="driver-dashboard-section__body">
            <div className="driver-preview-empty"><div><strong>Ready for next job</strong><span>Your active vehicle is available and the exchange is live.</span></div><button className="driver-preview-btn driver-preview-btn--success">Find matching loads</button></div>
          </div></section>

          <div className="driver-dashboard-operational-grid"><section className="driver-dashboard-section"><div className="driver-dashboard-section__header"><span>Relevant loads</span><button className="driver-preview-link">All loads</button></div><div className="driver-dashboard-section__body"><div className="driver-load-list">
            {loads.map((load) => <LoadRow key={load.id} load={load} onOpen={() => openLoad(load)} />)}
          </div></div></section></div>

          <section className="driver-dashboard-section"><div className="driver-dashboard-section__header"><span>Recent bookings</span><button className="driver-preview-link">View all</button></div><div className="driver-dashboard-section__body">
            <div className="driver-preview-booking-grid">
              <article><div><span>Delivered</span><strong>BLACKBURN, BB1 to ST HELENS, WA11</strong><small>06 Sep - Luton Tail Lift</small></div><button>Open</button></article>
              <article><div><span>Completed</span><strong>PRESTON, PR2 to LEEDS, LS10</strong><small>05 Sep - LWB Van</small></div><button>Open</button></article>
              <article><div><span>Awarded</span><strong>BURNLEY, BB10 to MANCHESTER, M22</strong><small>07 Sep - 14:00</small></div><button>Open</button></article>
            </div>
          </div></section>

          <section className="driver-dashboard-section driver-dashboard-compliance"><div className="driver-dashboard-section__header"><span>Compliance & document alerts</span><button className="driver-preview-link">Documents</button></div><div className="driver-dashboard-section__body">
            <div className="driver-preview-compliance"><span className="driver-preview-status driver-preview-status--green">Ready</span><div><strong>Operational documents current</strong><span>1 document expires within 30 days - no blocking items</span></div><button>Review</button></div>
          </div></section>

          <div className="driver-dashboard-lower-grid"><section className="driver-dashboard-section"><div className="driver-dashboard-section__header"><span>Quote activity</span><button className="driver-preview-link">Quotes</button></div><div className="driver-dashboard-section__body driver-dashboard-table-wrap">
            <table><thead><tr><th>Quote</th><th>Status</th><th>Submitted</th></tr></thead><tbody><tr><td>GBP 145</td><td>Submitted</td><td>23:11</td></tr><tr><td>GBP 95</td><td>Accepted</td><td>18:42</td></tr><tr><td>GBP 180</td><td>Unsuccessful</td><td>16:20</td></tr></tbody></table>
          </div></section>
            <section className="driver-dashboard-section"><div className="driver-dashboard-section__header"><span>Payment position</span><button className="driver-preview-link">Finance</button></div><div className="driver-dashboard-section__body">
              <div className="driver-preview-finance-grid"><div><span>Ready to invoice</span><strong>2</strong></div><div><span>Awaiting payment</span><strong>GBP 420</strong></div><div><span>Paid this month</span><strong>GBP 1,860</strong></div></div>
            </div></section>
          </div>
        </div>
      </div>
    </main>

    {drawerOpen && <div className="driver-preview-overlay" onMouseDown={() => setDrawerOpen(false)}><aside className="driver-preview-drawer" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
      <div className="driver-preview-drawer-head"><div><span>07 SEP 2026 - LOAD #{selectedLoad.id}</span><strong>{selectedLoad.member}</strong><small>{selectedLoad.vehicle}</small></div><div><button>Refresh</button><button>Print</button><button onClick={() => setDrawerOpen(false)}>Close</button></div></div>
      <div className="driver-preview-tabs">{(['details','journey','quote','documents'] as DetailTab[]).map((item) => <button key={item} data-active={tab === item} onClick={() => setTab(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}</div>
      <div className="driver-preview-drawer-body">
        {tab === 'details' && <><div className="driver-preview-route-card"><div><span>1</span><strong>{selectedLoad.from}</strong><small>{selectedLoad.pickup}</small></div><div className="driver-preview-route-line" /><div><span>2</span><strong>{selectedLoad.to}</strong><small>{selectedLoad.delivery}</small></div></div>
          <div className="driver-preview-detail-grid"><section><span>Vehicle</span><strong>{selectedLoad.vehicle}</strong></section><section><span>Distance</span><strong>{selectedLoad.distance}</strong></section><section><span>Payment terms</span><strong>30 Days EOM</strong></section><section><span>POD</span><strong>Electronic POD</strong></section></div>
          <section className="driver-preview-member-card"><div><span>Posting member</span><strong>{selectedLoad.member}</strong><small>Verified member - trust and payment feedback available</small></div><div><button>Message</button><button>Profile</button></div></section>
          <section className="driver-preview-note"><span>Job notes</span><strong>{selectedLoad.note}</strong></section></>}
        {tab === 'journey' && <div className="driver-preview-journey"><div className="driver-preview-map"><div className="driver-preview-map-label"><span>Distance to collection</span><strong>18.6 miles - 29 min</strong><span>Load distance</span><strong>{selectedLoad.distance}</strong></div><div className="driver-preview-map-route"><span>1</span><i /><span>2</span></div></div><button className="driver-preview-btn driver-preview-btn--primary">Open route map</button></div>}
        {tab === 'quote' && <div className="driver-preview-quote"><div><span>Commercial position</span><strong>{selectedLoad.price}</strong></div><label>Your quote (GBP)<input defaultValue="145" /></label><label>Message<textarea defaultValue="Available with tail lift. Can collect on time." /></label><div><button className="driver-preview-btn">Save draft</button><button className="driver-preview-btn driver-preview-btn--success">Submit quote</button></div></div>}
        {tab === 'documents' && <div className="driver-preview-docs"><div><span>Public job documents</span><strong>No public documents supplied</strong><small>Private execution documents unlock only after authorised award/allocation.</small></div><div><span>Execution evidence</span><strong>POD - delivery photos</strong><small>Evidence stays attached to the awarded job and role-scoped.</small></div></div>}
      </div>
    </aside></div>}
  </div>;
}
