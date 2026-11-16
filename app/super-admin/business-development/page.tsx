'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';
import {
  SuperAdminPage, SuperAdminPageHeader, SuperAdminSectionCard, SuperAdminNotice,
} from '@/app/super-admin/_components/SuperAdminEnterprisePrimitives';

type Prospect = {
  id: string; legal_name: string; company_number: string | null; legal_form: string;
  segment: string; status: string; source_url: string; created_at: string;
};
type Result = { organisations?: Prospect[]; total?: number; error?: string };
type Contact = { id: string; person_name: string | null; business_email: string | null; business_phone: string | null };
type Activity = { id: string; event_type: string; occurred_at: string; note: string | null };
const empty = { legal_name: '', company_number: '', website: '', legal_form: 'unknown', segment: 'customer', source_url: '' };

export default function BusinessDevelopmentPage() {
  const [rows, setRows] = useState<Prospect[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(empty);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [selected, setSelected] = useState<Prospect | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailVersion, setDetailVersion] = useState(0);
  const [eventType, setEventType] = useState('note');
  const [eventNote, setEventNote] = useState('');
  const [savingEvent, setSavingEvent] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [contactForm, setContactForm] = useState({ person_name: '', business_email: '', business_phone: '', contact_kind: 'generic_business', lawful_basis: 'undetermined', lawful_basis_evidence: '', source_url: '' });

  const load = useCallback(async () => {
    setError(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) throw new Error('Platform Owner session required.');
      const res = await fetch('/api/super-admin/business-development?page=' + page, {
        headers: { Authorization: auth }, cache: 'no-store',
      });
      const body = await res.json() as Result;
      if (!res.ok || !Array.isArray(body.organisations) || typeof body.total !== 'number')
        throw new Error(body.error ?? 'CRM is unavailable; check database migration.');
      setRows(body.organisations);
      setTotal(body.total);
    } catch (e) { setRows([]); setTotal(null); setError(e instanceof Error ? e.message : 'CRM unavailable.'); }
  }, [page, reloadVersion]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    let active = true;
    setContacts([]); setActivities([]); setDetailError(null);
    if (!selected) return;
    const fetchDetails = async () => {
      try {
        const auth = await getAuthHeader();
        if (!auth) throw new Error('Platform Owner session required.');
        const headers = { Authorization: auth };
        const id = encodeURIComponent(selected.id);
        const [cr, er] = await Promise.all([
          fetch('/api/super-admin/business-development/contacts?organisation_id=' + id, { headers, cache: 'no-store' }),
          fetch('/api/super-admin/business-development/events?organisation_id=' + id, { headers, cache: 'no-store' }),
        ]);
        const cb = await cr.json() as { contacts?: Contact[]; error?: string };
        const eb = await er.json() as { events?: Activity[]; error?: string };
        if (!cr.ok || !er.ok || !Array.isArray(cb.contacts) || !Array.isArray(eb.events))
          throw new Error(cb.error ?? eb.error ?? 'Prospect details unavailable.');
        if (active) { setContacts(cb.contacts); setActivities(eb.events); }
      } catch (e) {
        if (active) setDetailError(e instanceof Error ? e.message : 'Prospect details unavailable.');
      }
    };
    void fetchDetails();
    return () => { active = false; };
  }, [selected, detailVersion]);

  const saveContact = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || savingContact) return;
    setSavingContact(true); setDetailError(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) throw new Error('Platform Owner session required.');
      const response = await fetch('/api/super-admin/business-development/contacts', {
        method: 'POST',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...contactForm, organisation_id: selected.id }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Unable to save contact.');
      setContactForm({ person_name: '', business_email: '', business_phone: '', contact_kind: 'generic_business', lawful_basis: 'undetermined', lawful_basis_evidence: '', source_url: '' });
      setDetailVersion(version => version + 1);
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : 'Unable to save contact.');
    } finally { setSavingContact(false); }
  };

  const saveActivity = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || savingEvent) return;
    setSavingEvent(true); setDetailError(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) throw new Error('Platform Owner session required.');
      const response = await fetch('/api/super-admin/business-development/events', {
        method: 'POST',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ organisation_id: selected.id, event_type: eventType, channel: 'other', note: eventNote }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Unable to record activity.');
      setEventNote('');
      setDetailVersion(version => version + 1);
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : 'Unable to record activity.');
    } finally { setSavingEvent(false); }
  };

  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) throw new Error('Platform Owner session required.');
      const res = await fetch('/api/super-admin/business-development', {
        method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const body = await res.json() as { error?: string };
      if (!res.ok) throw new Error(body.error ?? 'Unable to save prospect.');
      setForm(empty); setPage(1); setReloadVersion(version => version + 1);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save prospect.'); }
    finally { setBusy(false); }
  };

  return (
    <ProtectedRoute>
      <SuperAdminPage>
        <SuperAdminPageHeader eyebrow="Commercial acquisition" title="Business Development" description="Private UK B2B prospect register. No outreach is sent from this screen." />
        {error && <SuperAdminNotice tone="danger">{error}</SuperAdminNotice>}
        <SuperAdminSectionCard title="Add verified organisation">
          <form onSubmit={(event) => void create(event)} style={{ display: 'grid', gap: 12, maxWidth: 700 }}>
            <label>Legal company name <input required minLength={2} maxLength={240} value={form.legal_name} onChange={e => setForm({ ...form, legal_name: e.target.value })} /></label>
            <label>Company number (optional) <input maxLength={32} value={form.company_number} onChange={e => setForm({ ...form, company_number: e.target.value })} /></label>
            <label>Website (HTTPS) <input type="url" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} /></label>
            <label>Legal form <select value={form.legal_form} onChange={e => setForm({ ...form, legal_form: e.target.value })}>
              <option value="unknown">Unknown</option><option value="ltd">Limited company</option>
              <option value="llp">LLP</option><option value="sole_trader">Sole trader</option><option value="other">Other</option>
            </select></label>
            <label>Commercial segment <select value={form.segment} onChange={e => setForm({ ...form, segment: e.target.value })}>
              <option value="customer">Customer</option><option value="broker">Broker</option>
              <option value="forwarder">Freight forwarder</option><option value="carrier">Carrier</option><option value="mixed">Mixed</option>
            </select></label>
            <label>Verified public source URL (HTTPS) <input required type="url" value={form.source_url} onChange={e => setForm({ ...form, source_url: e.target.value })} /></label>
            <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save prospect'}</button>
          </form>
        </SuperAdminSectionCard>
        <SuperAdminSectionCard title="Prospect organisations">
          <p>{total === null ? 'Not available' : total + ' organisations recorded'}</p>
          {rows.length === 0 ? <p>No verified prospects to display.</p> : (
            <div style={{ overflowX: 'auto' }}>
              <table><thead><tr><th>Organisation</th><th>Company number</th><th>Segment</th><th>Status</th><th>Source</th><th>Details</th></tr></thead>
                <tbody>{rows.map(row => <tr key={row.id}>
                  <td>{row.legal_name}</td><td>{row.company_number ?? '—'}</td><td>{row.segment}</td>
                  <td>{row.status}</td><td><a href={row.source_url} target="_blank" rel="noopener noreferrer">Source</a></td><td><button type="button" onClick={() => setSelected(row)}>View</button></td>
                </tr>)}</tbody>
              </table>
            </div>
          )}
          <div style={{ display: 'flex', gap: 12 }}>
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
            <span>Page {page}</span>
            <button disabled={total === null || page * 25 >= total} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        </SuperAdminSectionCard>
        {selected && <SuperAdminSectionCard title={'Prospect details — ' + selected.legal_name}>
          <button type="button" onClick={() => setSelected(null)}>Close details</button>
          {detailError && <SuperAdminNotice tone="danger">{detailError}</SuperAdminNotice>}
          <h3>Add sourced business contact</h3>
          <p>Record a verified source and lawful basis. This form never sends marketing messages.</p>
          <form onSubmit={(event) => void saveContact(event)} style={{ display: 'grid', gap: 12, maxWidth: 700 }}>
            <label>Contact name (optional) <input maxLength={200} value={contactForm.person_name} onChange={event => setContactForm({ ...contactForm, person_name: event.target.value })} /></label>
            <label>Business email <input type="email" maxLength={254} value={contactForm.business_email} onChange={event => setContactForm({ ...contactForm, business_email: event.target.value })} /></label>
            <label>Business phone (international format, e.g. +44...) <input maxLength={40} value={contactForm.business_phone} onChange={event => setContactForm({ ...contactForm, business_phone: event.target.value })} /></label>
            <label>Contact classification <select value={contactForm.contact_kind} onChange={event => setContactForm({ ...contactForm, contact_kind: event.target.value })}>
              <option value="generic_business">Generic business</option><option value="named_person">Named person</option><option value="unknown">Unknown</option>
            </select></label>
            <label>Lawful basis <select value={contactForm.lawful_basis} onChange={event => setContactForm({ ...contactForm, lawful_basis: event.target.value })}>
              <option value="undetermined">Undetermined — no outreach</option><option value="legitimate_interests">Legitimate interests</option>
              <option value="consent">Consent</option><option value="other">Other documented basis</option>
            </select></label>
            <label>Lawful basis evidence <textarea maxLength={2000} value={contactForm.lawful_basis_evidence} onChange={event => setContactForm({ ...contactForm, lawful_basis_evidence: event.target.value })} /></label>
            <label>Verified source URL (HTTPS) <input required type="url" value={contactForm.source_url} onChange={event => setContactForm({ ...contactForm, source_url: event.target.value })} /></label>
            <button type="submit" disabled={savingContact || (!contactForm.business_email.trim() && !contactForm.business_phone.trim())}>{savingContact ? 'Saving…' : 'Save contact'}</button>
          </form>
          <h3>Business contacts ({contacts.length})</h3>
          {contacts.length ? <ul>{contacts.map(contact => <li key={contact.id}>
            {contact.person_name ?? 'General business contact'} — {contact.business_email ?? contact.business_phone ?? 'No contact details'}
          </li>)}</ul> : <p>No contacts recorded or details not loaded.</p>}
          <h3>Record activity</h3>
          <form onSubmit={(event) => void saveActivity(event)} style={{ display: 'grid', gap: 12, maxWidth: 700 }}>
            <label>Activity type <select value={eventType} onChange={event => setEventType(event.target.value)}>
              <option value="note">Internal note</option>
              <option value="research_completed">Research completed</option>
              <option value="qualified">Qualified</option>
              <option value="call_attempted">Call attempted</option>
              <option value="meeting_scheduled">Meeting scheduled</option>
              <option value="reply_received">Reply received</option>
              <option value="onboarding_started">Onboarding started</option>
              <option value="converted">Converted</option>
              <option value="disqualified">Disqualified</option>
            </select></label>
            <label>Internal note <textarea maxLength={2000} value={eventNote} onChange={event => setEventNote(event.target.value)} /></label>
            <button type="submit" disabled={savingEvent}>{savingEvent ? 'Saving…' : 'Record activity'}</button>
          </form>
          <h3>Activity history ({activities.length})</h3>
          {activities.length ? <ul>{activities.map(activity => <li key={activity.id}>
            {new Date(activity.occurred_at).toLocaleString('en-GB')} — {activity.event_type}
            {activity.note ? ': ' + activity.note : ''}
          </li>)}</ul> : <p>No activity recorded or details not loaded.</p>}
        </SuperAdminSectionCard>}
      </SuperAdminPage>
    </ProtectedRoute>
  );
}
