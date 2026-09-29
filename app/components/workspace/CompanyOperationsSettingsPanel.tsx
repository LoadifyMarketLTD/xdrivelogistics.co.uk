'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { supabase } from '../../../lib/supabaseClient';
import { ActionButton, AlertBanner, EmptyState, Panel, StatusBadge } from './WorkspaceUI';

type SpecialistRow = {
  capability_code: SpecialistCode;
  verification_required: boolean;
  verification_status: 'declared' | 'pending' | 'verified' | 'rejected';
  evidence_document_id: string | null;
  review_note: string | null;
  updated_at: string | null;
};

const SPECIALISTS = [
  ['24_hour', '24 Hour', false],
  ['adr', 'ADR', true],
  ['dgsa_qualified', 'DGSA Qualified', true],
  ['fors_bronze', 'FORS Bronze', true],
  ['fors_silver', 'FORS Silver', true],
  ['fors_gold', 'FORS Gold', true],
  ['frozen', 'Frozen', false],
  ['hanging_garment', 'GOH - Hanging Garment Transportation', false],
  ['high_security', 'High Security', false],
  ['installation_swapout', 'Installation & Swapout', false],
  ['aviation_level_ab', 'Level A / B Aviation', true],
  ['cargo_operated_level_d', 'Cargo Operated (Level D)', true],
  ['refrigerated_chilled', 'Refrigerated / Chilled', false],
  ['removals', 'Removals', false],
  ['waste_carrier', 'Waste Carrier', true],
  ['weee', 'WEEE', true],
  ['authorised_economic_operator', 'Authorised Economic Operator (AEO)', true],
  ['cmr', 'CMR', false],
] as const;

type SpecialistCode = typeof SPECIALISTS[number][0];

type OperationsSettings = {
  operatorLicenceNumber: string;
  financeEmail: string;
  secondaryPhone: string;
  emailVisibleToMembers: boolean;
  homeLocation: string;
  directoryLocation: string;
  bookingFooter: string;
  deliveryNoteCompanyName: string;
  deliveryNoteCustomerPhone: string;
  deliveryNoteDriverPhone: string;
  deliveryNoteFooter: string;
  waitingTimeTerms: string;
  loadingTimeTerms: string;
  cancellationTerms: string;
  otherCharges: string;
  feedbackViewDays: 30 | 60 | 90 | 180 | 365;
  driverMustConfirmAcceptance: boolean;
  allowLoadReminder: boolean;
  showNotificationBar: boolean;
  showAverageSpeedReplay: boolean;
  acceptElectronicQuotes: boolean;
  acceptQuotesApprovedMembersOnly: boolean;
  acceptInternationalQuotes: boolean;
  receiveQuoteEmailNotifications: boolean;
  showFullPostcodePostedLoads: boolean;
  updatedAt: string | null;
};

type OperationsResponse = {
  settings?: Partial<OperationsSettings>;
  specialistCapabilities?: SpecialistRow[];
  error?: string;
};

const EMPTY: OperationsSettings = {
  operatorLicenceNumber: '',
  financeEmail: '',
  secondaryPhone: '',
  emailVisibleToMembers: false,
  homeLocation: '',
  directoryLocation: '',
  bookingFooter: '',
  deliveryNoteCompanyName: '',
  deliveryNoteCustomerPhone: '',
  deliveryNoteDriverPhone: '',
  deliveryNoteFooter: '',
  waitingTimeTerms: '',
  loadingTimeTerms: '',
  cancellationTerms: '',
  otherCharges: '',
  feedbackViewDays: 90,
  driverMustConfirmAcceptance: true,
  allowLoadReminder: true,
  showNotificationBar: true,
  showAverageSpeedReplay: true,
  acceptElectronicQuotes: true,
  acceptQuotesApprovedMembersOnly: false,
  acceptInternationalQuotes: true,
  receiveQuoteEmailNotifications: true,
  showFullPostcodePostedLoads: true,
  updatedAt: null,
};

const labelStyle = { display: 'grid', gap: 4, fontSize: 11, fontWeight: 800, color: '#334155' } as const;
const checkboxStyle = { display: 'flex', alignItems: 'center', gap: 7, minHeight: 30, fontSize: 12, color: '#334155' } as const;

export default function CompanyOperationsSettingsPanel({ companyId, companyName }: { companyId: string; companyName: string }) {
  const [settings, setSettings] = useState<OperationsSettings>(EMPTY);
  const [specialists, setSpecialists] = useState<SpecialistRow[]>([]);
  const [selected, setSelected] = useState<Set<SpecialistCode>>(new Set());
  const [tab, setTab] = useState<'profile' | 'documents' | 'charges' | 'services' | 'preferences'>('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setError('Your session has expired. Sign in again.');
      setLoading(false);
      return;
    }
    const response = await fetch('/api/settings/company-operations?companyId=' + encodeURIComponent(companyId), {
      headers: { Authorization: 'Bearer ' + token },
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => ({})) as OperationsResponse;
    if (!response.ok || !payload.settings) {
      setError(payload.error || 'Company operations settings could not be loaded.');
    } else {
      setSettings({ ...EMPTY, ...payload.settings });
      const rows = payload.specialistCapabilities ?? [];
      setSpecialists(rows);
      setSelected(new Set(rows.map((row) => row.capability_code)));
    }
    setLoading(false);
  }, [companyId]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setSaving(true);
    setError('');
    setNotice('');
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setError('Your session has expired. Sign in again.');
      setSaving(false);
      return;
    }
    const response = await fetch('/api/settings/company-operations', {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId,
        ...settings,
        specialistCapabilities: Array.from(selected),
      }),
    });
    const payload = await response.json().catch(() => ({})) as OperationsResponse;
    if (!response.ok) {
      setError(payload.error || 'Company operations settings could not be saved.');
    } else {
      setNotice('Company operations settings saved.');
      await load();
    }
    setSaving(false);
  };

  const specialistByCode = useMemo(
    () => new Map(specialists.map((row) => [row.capability_code, row])),
    [specialists],
  );

  if (loading) return <Panel><EmptyState compact title="Loading company operations settings…" /></Panel>;

  return <div style={{ display: 'grid', gap: 10 }}>
    {error && <AlertBanner tone="danger">{error}</AlertBanner>}
    {notice && <AlertBanner tone="success">{notice}</AlertBanner>}

    <div className="workspace-tab-strip" role="tablist" aria-label="Company operations settings" style={{ display: 'flex', overflowX: 'auto' }}>
      {([
        ['profile', 'Trading & Contact'],
        ['documents', 'Booking / Delivery Notes'],
        ['charges', 'Charges'],
        ['services', 'Specialist Services'],
        ['preferences', 'Exchange Preferences'],
      ] as const).map(([id, label]) => (
        <button key={id} type="button" role="tab" aria-selected={tab === id} data-active={tab === id ? 'true' : 'false'} onClick={() => setTab(id)}>{label}</button>
      ))}
    </div>

    {tab === 'profile' && <Panel title="Trading & Contact Details" description="Company operational identity and member-facing contact defaults. Verified legal identity remains controlled separately.">
      <div className="role-settings-form">
        <label style={labelStyle}>Operator&apos;s Licence<input value={settings.operatorLicenceNumber} onChange={(e) => setSettings((v) => ({ ...v, operatorLicenceNumber: e.target.value.slice(0, 120) }))} placeholder="If legally applicable" /></label>
        <label style={labelStyle}>Finance Email<input type="email" value={settings.financeEmail} onChange={(e) => setSettings((v) => ({ ...v, financeEmail: e.target.value.slice(0, 320) }))} /></label>
        <label style={labelStyle}>Secondary Phone<input value={settings.secondaryPhone} onChange={(e) => setSettings((v) => ({ ...v, secondaryPhone: e.target.value.slice(0, 80) }))} /></label>
        <label style={labelStyle}>Home Location<input value={settings.homeLocation} onChange={(e) => setSettings((v) => ({ ...v, homeLocation: e.target.value.slice(0, 240) }))} placeholder="Base / office location used for matching" /></label>
        <label style={labelStyle}>Directory Location<input value={settings.directoryLocation} onChange={(e) => setSettings((v) => ({ ...v, directoryLocation: e.target.value.slice(0, 240) }))} placeholder="Member directory location" /></label>
        <label style={{ ...checkboxStyle, alignSelf: 'end' }}><input type="checkbox" checked={settings.emailVisibleToMembers} onChange={(e) => setSettings((v) => ({ ...v, emailVisibleToMembers: e.target.checked }))} /> Email visible to members</label>
      </div>
      <div style={{ marginTop: 8, color: '#64748b', fontSize: 11 }}>Operator&apos;s Licence is a recorded reference only; it does not become verified merely because it is entered here.</div>
    </Panel>}

    {tab === 'documents' && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 10 }}>
      <Panel title="Booking Footer" description="Notes shown on booking records where the booking document template supports them.">
        <label style={labelStyle}>Booking footer<textarea rows={7} value={settings.bookingFooter} onChange={(e) => setSettings((v) => ({ ...v, bookingFooter: e.target.value.slice(0, 2000) }))} placeholder="Booking terms or operational notes" /></label>
      </Panel>
      <Panel title="Delivery Note Details" description="Company contact and footer defaults for delivery-note output.">
        <div style={{ display: 'grid', gap: 8 }}>
          <label style={labelStyle}>Company name on delivery note<input value={settings.deliveryNoteCompanyName} onChange={(e) => setSettings((v) => ({ ...v, deliveryNoteCompanyName: e.target.value.slice(0, 200) }))} placeholder={companyName} /></label>
          <label style={labelStyle}>Telephone customers use<input value={settings.deliveryNoteCustomerPhone} onChange={(e) => setSettings((v) => ({ ...v, deliveryNoteCustomerPhone: e.target.value.slice(0, 80) }))} /></label>
          <label style={labelStyle}>Telephone drivers use<input value={settings.deliveryNoteDriverPhone} onChange={(e) => setSettings((v) => ({ ...v, deliveryNoteDriverPhone: e.target.value.slice(0, 80) }))} /></label>
          <label style={labelStyle}>Delivery-note footer<textarea rows={5} value={settings.deliveryNoteFooter} onChange={(e) => setSettings((v) => ({ ...v, deliveryNoteFooter: e.target.value.slice(0, 2000) }))} /></label>
        </div>
      </Panel>
    </div>}

    {tab === 'charges' && <Panel title="Charges" description="Company default commercial notes. These do not silently amend an awarded booking; agreed job/invoice snapshots remain authoritative.">
      <div className="role-settings-form">
        <label style={labelStyle}>Waiting Time<input value={settings.waitingTimeTerms} onChange={(e) => setSettings((v) => ({ ...v, waitingTimeTerms: e.target.value.slice(0, 500) }))} placeholder="e.g. 30 minutes free, then £30/hour" /></label>
        <label style={labelStyle}>Loading Time<input value={settings.loadingTimeTerms} onChange={(e) => setSettings((v) => ({ ...v, loadingTimeTerms: e.target.value.slice(0, 500) }))} /></label>
        <label style={labelStyle}>Cancellation<input value={settings.cancellationTerms} onChange={(e) => setSettings((v) => ({ ...v, cancellationTerms: e.target.value.slice(0, 500) }))} /></label>
        <label style={labelStyle}>Other<input value={settings.otherCharges} onChange={(e) => setSettings((v) => ({ ...v, otherCharges: e.target.value.slice(0, 500) }))} /></label>
      </div>
    </Panel>}

    {tab === 'services' && <Panel title="Specialist Services" description="Declare the services your company offers. Regulated accreditations stay pending until separately verified with appropriate evidence.">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 6 }}>
        {SPECIALISTS.map(([code, label, verificationRequired]) => {
          const row = specialistByCode.get(code);
          const checked = selected.has(code);
          const status = row?.verification_status ?? (verificationRequired && checked ? 'pending' : checked ? 'declared' : null);
          return <label key={code} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 36, border: '1px solid #e2e8f0', borderRadius: 4, padding: '5px 8px', background: '#fff' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12 }}><input type="checkbox" checked={checked} onChange={(e) => setSelected((current) => { const next = new Set(current); if (e.target.checked) next.add(code); else next.delete(code); return next; })} /> {label}</span>
            {status ? <StatusBadge value={status} tone={status === 'verified' ? 'green' : status === 'rejected' ? 'red' : status === 'pending' ? 'orange' : 'blue'} /> : verificationRequired ? <span style={{ fontSize: 10, color: '#64748b' }}>verification required</span> : null}
          </label>;
        })}
      </div>
    </Panel>}

    {tab === 'preferences' && <Panel title="Exchange Preferences" description="Company-level operational defaults inspired by the reference exchange, mapped to XDrive behaviour.">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 6 }}>
        <label style={checkboxStyle}><input type="checkbox" checked={settings.driverMustConfirmAcceptance} onChange={(e) => setSettings((v) => ({ ...v, driverMustConfirmAcceptance: e.target.checked }))} /> Driver / Carrier must confirm acceptance</label>
        <label style={checkboxStyle}><input type="checkbox" checked={settings.allowLoadReminder} onChange={(e) => setSettings((v) => ({ ...v, allowLoadReminder: e.target.checked }))} /> Allow load reminders</label>
        <label style={checkboxStyle}><input type="checkbox" checked={settings.showNotificationBar} onChange={(e) => setSettings((v) => ({ ...v, showNotificationBar: e.target.checked }))} /> Show notification bar</label>
        <label style={checkboxStyle}><input type="checkbox" checked={settings.showAverageSpeedReplay} onChange={(e) => setSettings((v) => ({ ...v, showAverageSpeedReplay: e.target.checked }))} /> Show average speed in journey replay</label>
        <label style={checkboxStyle}><input type="checkbox" checked={settings.acceptElectronicQuotes} onChange={(e) => setSettings((v) => ({ ...v, acceptElectronicQuotes: e.target.checked }))} /> Accept electronic quotes by default</label>
        <label style={checkboxStyle}><input type="checkbox" checked={settings.acceptQuotesApprovedMembersOnly} onChange={(e) => setSettings((v) => ({ ...v, acceptQuotesApprovedMembersOnly: e.target.checked }))} /> Accept quotes from approved XDrive members only</label>
        <label style={checkboxStyle}><input type="checkbox" checked={settings.acceptInternationalQuotes} onChange={(e) => setSettings((v) => ({ ...v, acceptInternationalQuotes: e.target.checked }))} /> Accept international quotes where company approval allows</label>
        <label style={checkboxStyle}><input type="checkbox" checked={settings.receiveQuoteEmailNotifications} onChange={(e) => setSettings((v) => ({ ...v, receiveQuoteEmailNotifications: e.target.checked }))} /> Receive quote email notifications</label>
        <label style={checkboxStyle}><input type="checkbox" checked={settings.showFullPostcodePostedLoads} onChange={(e) => setSettings((v) => ({ ...v, showFullPostcodePostedLoads: e.target.checked }))} /> Show full postcode for posted loads</label>
        <label style={labelStyle}>Feedback view<select value={settings.feedbackViewDays} onChange={(e) => setSettings((v) => ({ ...v, feedbackViewDays: Number(e.target.value) as OperationsSettings['feedbackViewDays'] }))}><option value={30}>Past 30 days</option><option value={60}>Past 60 days</option><option value={90}>Past 90 days</option><option value={180}>Past 180 days</option><option value={365}>Past 365 days</option></select></label>
      </div>
    </Panel>}

    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <ActionButton tone="primary" disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save Company Operations'}</ActionButton>
    </div>
  </div>;
}
