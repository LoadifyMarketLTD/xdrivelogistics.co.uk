'use client';
import { useState } from 'react';
import './driver-v2.css';

const stages = ['Accepted', 'On my Way to Pickup', 'On Site (Pickup)', 'Loaded', 'On my Way to Delivery', 'On Site (Delivery)', 'Delivered / POD'];
const tabs = ['Jobs', 'Quotes', 'Bookings', 'More'] as const;
type Tab = typeof tabs[number];

export default function DriverV2() {
  const [tab, setTab] = useState<Tab>('Jobs');
  const [stage, setStage] = useState(0);
  const [notes, setNotes] = useState('');
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  return <main className="xd-v2">
    <header className="xd-v2-header">XDrive Logistics · Driver V2</header>
    <nav className="xd-v2-nav" aria-label="Driver navigation">
      {tabs.map(item => <button key={item} type="button" className="xd-v2-tab" aria-current={tab === item ? 'page' : undefined} onClick={() => setTab(item)}>{item}</button>)}
    </nav>
    <section className="xd-v2-content">
      {tab === 'Jobs' && <article className="xd-v2-card">
        <h2 className="xd-v2-title">Job card reference layout</h2>
        <p className="xd-v2-note">Isolated visual prototype — no live job data connected.</p>
        <div className="xd-v2-section"><p className="xd-v2-location">Pickup Town, Outcode</p><p className="xd-v2-label">Collection time</p></div>
        <div className="xd-v2-section"><p className="xd-v2-location">Delivery Town, Outcode</p><p className="xd-v2-label">Delivery time</p></div>
        <p className="xd-v2-note">Vehicle · Distance · Load details</p>
        <button className="xd-v2-button" type="button" onClick={() => setTab('Bookings')}>View booking layout</button>
        <button className="xd-v2-button" style={{ background: 'var(--xd-quote)' }} type="button" onClick={() => setTab('Quotes')}>View quote layout</button>
      </article>}
      {tab === 'Quotes' && <article className="xd-v2-card">
        <h2 className="xd-v2-title">Sent Quotes</h2>
        <p className="xd-v2-note">Submitted · Unsuccessful · Withdrawn</p>
        <label className="xd-v2-label" htmlFor="quote-amount">Quote amount (£) — local draft</label>
        <input className="xd-v2-input" id="quote-amount" type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} />
        <p className="xd-v2-note">No offer is submitted from this prototype.</p>
      </article>}
      {tab === 'Bookings' && <article className="xd-v2-card">
        <h2 className="xd-v2-title">Booking Status</h2>
        <p className="xd-v2-note">Local demonstration — no real booking updated</p>
        {stages.map((label, index) => <div key={label} className="xd-v2-timeline-row" data-current={index === stage} data-future={index > stage}><span className="xd-v2-timeline">{index < stage ? '✓' : index === stage ? '●' : '○'} {label}</span></div>)}
        <div className="xd-v2-section"><label className="xd-v2-label" htmlFor="driver-notes">Driver's Notes</label><textarea className="xd-v2-input" id="driver-notes" rows={3} value={notes} onChange={e => setNotes(e.target.value)} /></div>
        {stage === stages.length - 1 && <div className="xd-v2-section"><label className="xd-v2-label" htmlFor="pod-recipient">Received By (Full Name)</label><input className="xd-v2-input" id="pod-recipient" value={recipient} onChange={e => setRecipient(e.target.value)} /></div>}
        <button className="xd-v2-button" type="button" onClick={() => setStage(Math.min(stages.length - 1, stage + 1))} disabled={stage === stages.length - 1}>Next stage (demo)</button>
        <button className="xd-v2-button" style={{ background: '#e3e3e3' }} type="button" onClick={() => setStage(Math.max(0, stage - 1))} disabled={stage === 0}>Undo (demo)</button>
      </article>}
      {tab === 'More' && <article className="xd-v2-card"><h2 className="xd-v2-title">Driver Workspace</h2><p className="xd-v2-label">Availability · Return Journeys · Documents · Profile · Settings</p><p className="xd-v2-note">Isolated visual prototype. No live API or payment actions.</p></article>}
    </section>
  </main>;
}
