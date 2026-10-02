'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { ActionButton, AlertBanner, EmptyState } from './WorkspaceUI';

type RoutePoint = {
  address: string | null;
  postcode: string | null;
  dateTime: string | null;
  slot: string | null;
  contactName: string | null;
  contactPhone: string | null;
  notes?: string | null;
};

type AmendmentRow = {
  id: string;
  version_number: number;
  proposed_by_company_id: string;
  counterparty_company_id: string;
  reason: string;
  change_summary: Record<string, unknown> | null;
  effective_agreed_amount: number | string;
  currency: string;
  status: string;
  proposed_at: string | null;
  decided_at: string | null;
};
type Props = {
  jobId: string;
  mode: 'customer' | 'broker' | 'carrier';
  viewerCompanyId: string | null;
  ownerCompanyId: string;
  carrierCompanyId: string | null;
  currentAmount: number | null;
  currency: string;
  paymentTerms: string | null;
  pickup: RoutePoint;
  delivery: RoutePoint;
};

const fieldStyle = {
  width: '100%',
  minHeight: 34,
  border: '1px solid #cbd5e1',
  borderRadius: 5,
  padding: '0 8px',
  background: '#fff',
  color: '#172033',
  fontSize: 12,
  boxSizing: 'border-box' as const,
};
const textAreaStyle = { ...fieldStyle, minHeight: 72, padding: '8px' };
const labelStyle = { display: 'grid', gap: 4, fontSize: 11, fontWeight: 700, color: '#334155' };
const localDateTime = (value: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const pad = (n: number) => String(n).padStart(2, '0');
  return [
    date.getFullYear(), '-', pad(date.getMonth() + 1), '-', pad(date.getDate()),
    'T', pad(date.getHours()), ':', pad(date.getMinutes()),
  ].join('');
};

const isoFromLocal = (value: string) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
};

const numberValue = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const displayMoney = (value: unknown, currency = 'GBP') => {
  const amount = numberValue(value);
  return amount == null ? 'Amount unchanged' : new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
  }).format(amount);
};

const humanTime = (value: string | null) => value
  ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  : 'Pending';

const CHANGE_LABELS: Record<string, string> = {
  'pickup.address': 'Collection address',
  'pickup.postcode': 'Collection postcode',
  'pickup.dateTime': 'Collection date / time',
  'pickup.contactName': 'Collection contact',
  'pickup.contactPhone': 'Collection phone',
  'pickup.notes': 'Collection notes',
  'delivery.address': 'Delivery address',
  'delivery.postcode': 'Delivery postcode',
  'delivery.dateTime': 'Delivery date / time',
  'delivery.contactName': 'Delivery contact',
  'delivery.contactPhone': 'Delivery phone',
  'delivery.notes': 'Delivery notes',
  'cargo.weightKg': 'Weight',
  'cargo.pallets': 'Pallets',
  'cargo.type': 'Cargo type',
  'references.customerReference': 'Customer reference',
  'references.purchaseOrder': 'Purchase order',
  'references.bookingReference': 'Booking reference',
};

const printable = (value: unknown) => {
  if (value == null || value === '') return 'Not supplied';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const amendmentChangeLines = (row: AmendmentRow) => {
  const summary = row.change_summary ?? {};
  const lines: Array<{ label: string; from: string; to: string }> = [];
  const jobChanges = summary.jobChanges;
  if (jobChanges && typeof jobChanges === 'object' && !Array.isArray(jobChanges)) {
    for (const [section, rawFields] of Object.entries(jobChanges as Record<string, unknown>)) {
      if (!rawFields || typeof rawFields !== 'object' || Array.isArray(rawFields)) continue;
      for (const [field, rawChange] of Object.entries(rawFields as Record<string, unknown>)) {
        if (!rawChange || typeof rawChange !== 'object' || Array.isArray(rawChange)) continue;
        const change = rawChange as Record<string, unknown>;
        lines.push({
          label: CHANGE_LABELS[section + '.' + field] ?? (section + ' ' + field).replace(/([A-Z])/g, ' $1'),
          from: printable(change.from),
          to: printable(change.to),
        });
      }
    }
  }
  for (const [key, label] of [['paymentTerms', 'Payment terms'], ['podRequired', 'POD required']] as const) {
    const raw = summary[key];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const change = raw as Record<string, unknown>;
    lines.push({ label, from: printable(change.from), to: printable(change.to) });
  }
  return lines;
};

const priceAdjustment = (row: AmendmentRow) => {
  const raw = row.change_summary?.agreedAmount;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const change = raw as Record<string, unknown>;
  const from = numberValue(change.from);
  const to = numberValue(change.to);
  if (from == null || to == null) return null;
  return { from, to, delta: to - from };
};

const signedMoney = (value: number, currency: string) =>
  (value >= 0 ? '+' : '-') + displayMoney(Math.abs(value), currency);
export default function CommercialAmendmentControls(props: Props) {
  const [rows, setRows] = useState<AmendmentRow[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reason, setReason] = useState('');
  const [verbalAgreementConfirmed, setVerbalAgreementConfirmed] = useState(false);
  const [verbalAgreementNote, setVerbalAgreementNote] = useState('');
  const [agreedAmount, setAgreedAmount] = useState(
    props.currentAmount == null ? '' : String(props.currentAmount),
  );
  const [pickupAddress, setPickupAddress] = useState(props.pickup.address ?? '');
  const [pickupPostcode, setPickupPostcode] = useState(props.pickup.postcode ?? '');
  const [pickupDateTime, setPickupDateTime] = useState(localDateTime(props.pickup.dateTime));
  const [pickupContactName, setPickupContactName] = useState(props.pickup.contactName ?? '');
  const [pickupContactPhone, setPickupContactPhone] = useState(props.pickup.contactPhone ?? '');
  const [pickupNotes, setPickupNotes] = useState(props.pickup.notes ?? '');
  const [deliveryAddress, setDeliveryAddress] = useState(props.delivery.address ?? '');
  const [deliveryPostcode, setDeliveryPostcode] = useState(props.delivery.postcode ?? '');
  const [deliveryDateTime, setDeliveryDateTime] = useState(localDateTime(props.delivery.dateTime));
  const [deliveryContactName, setDeliveryContactName] = useState(props.delivery.contactName ?? '');
  const [deliveryContactPhone, setDeliveryContactPhone] = useState(props.delivery.contactPhone ?? '');
  const [deliveryNotes, setDeliveryNotes] = useState(props.delivery.notes ?? '');
  const canPropose = (props.mode === 'customer' || props.mode === 'broker')
    && props.viewerCompanyId === props.ownerCompanyId
    && Boolean(props.carrierCompanyId);

  const pendingForViewer = useMemo(
    () => rows.filter((row) =>
      row.status === 'proposed'
      && row.counterparty_company_id === props.viewerCompanyId,
    ),
    [rows, props.viewerCompanyId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Your session has expired. Sign in again.');
      const response = await fetch(
        `/api/workspace/jobs/${encodeURIComponent(props.jobId)}/amendments`,
        { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
      );
      const payload = await response.json().catch(() => ({})) as { amendments?: AmendmentRow[]; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Amendments could not be loaded.');
      setRows(payload.amendments ?? []);
    } catch (reasonValue) {
      setError(reasonValue instanceof Error ? reasonValue.message : 'Amendments could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [props.jobId]);

  useEffect(() => { void load(); }, [load]);

  const buildJobPatch = () => {
    const pickup: Record<string, unknown> = {};
    const delivery: Record<string, unknown> = {};
    if (pickupAddress.trim() !== (props.pickup.address ?? '').trim()) pickup.address = pickupAddress.trim();
    if (pickupPostcode.trim().toUpperCase() !== (props.pickup.postcode ?? '').trim().toUpperCase()) {
      pickup.postcode = pickupPostcode.trim().toUpperCase();
    }
    if (pickupDateTime !== localDateTime(props.pickup.dateTime)) pickup.dateTime = isoFromLocal(pickupDateTime);
    if (pickupContactName.trim() !== (props.pickup.contactName ?? '').trim()) pickup.contactName = pickupContactName.trim();
    if (pickupContactPhone.trim() !== (props.pickup.contactPhone ?? '').trim()) pickup.contactPhone = pickupContactPhone.trim();
    if (pickupNotes.trim() !== (props.pickup.notes ?? '').trim()) pickup.notes = pickupNotes.trim();
    if (deliveryAddress.trim() !== (props.delivery.address ?? '').trim()) delivery.address = deliveryAddress.trim();
    if (deliveryPostcode.trim().toUpperCase() !== (props.delivery.postcode ?? '').trim().toUpperCase()) {
      delivery.postcode = deliveryPostcode.trim().toUpperCase();
    }
    if (deliveryDateTime !== localDateTime(props.delivery.dateTime)) delivery.dateTime = isoFromLocal(deliveryDateTime);
    if (deliveryContactName.trim() !== (props.delivery.contactName ?? '').trim()) delivery.contactName = deliveryContactName.trim();
    if (deliveryContactPhone.trim() !== (props.delivery.contactPhone ?? '').trim()) delivery.contactPhone = deliveryContactPhone.trim();
    if (deliveryNotes.trim() !== (props.delivery.notes ?? '').trim()) delivery.notes = deliveryNotes.trim();

    const patch: Record<string, unknown> = {};
    if (Object.keys(pickup).length) patch.pickup = pickup;
    if (Object.keys(delivery).length) patch.delivery = delivery;
    return patch;
  };

  const submitProposal = async () => {
    setError('');
    setMessage('');
    if (reason.trim().length < 3) {
      setError('Enter the reason for the job change.');
      return;
    }
    const nextAmount = agreedAmount.trim() ? Number(agreedAmount) : props.currentAmount;
    if (nextAmount == null || !Number.isFinite(nextAmount) || nextAmount <= 0) {
      setError('Enter a valid agreed carrier amount.');
      return;
    }

    const jobPatch = buildJobPatch();
    const amountChanged = props.currentAmount == null || Math.abs(nextAmount - props.currentAmount) > 0.009;
    if (!amountChanged && !Object.keys(jobPatch).length) {
      setError('Change the route, schedule or agreed carrier amount before sending an amendment.');
      return;
    }

    setBusyId('proposal');
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Your session has expired. Sign in again.');
      const body: Record<string, unknown> = {
        actingCompanyId: props.viewerCompanyId,
        reason: reason.trim(),
        verbalAgreementConfirmed,
        verbalAgreementNote: verbalAgreementConfirmed ? verbalAgreementNote.trim() || undefined : undefined,
      };
      if (amountChanged) body.agreedAmount = nextAmount;
      if (Object.keys(jobPatch).length) body.jobPatch = jobPatch;
      const response = await fetch(
        `/api/workspace/jobs/${encodeURIComponent(props.jobId)}/amendments`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'The amendment could not be proposed.');
      setMessage('Job change sent. It is pending carrier / assigned-driver acceptance.');
      setOpen(false);
      setReason('');
      setVerbalAgreementConfirmed(false);
      setVerbalAgreementNote('');
      await load();
    } catch (reasonValue) {
      setError(reasonValue instanceof Error ? reasonValue.message : 'The amendment could not be proposed.');
    } finally {
      setBusyId(null);
    }
  };

  const decide = async (amendmentId: string, action: 'accept' | 'reject') => {
    setError('');
    setMessage('');
    setBusyId(amendmentId);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Your session has expired. Sign in again.');
      const response = await fetch(
        `/api/workspace/jobs/${encodeURIComponent(props.jobId)}/amendments/${encodeURIComponent(amendmentId)}/decision`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        },
      );
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'The amendment decision could not be recorded.');
      setMessage(action === 'accept' ? 'Job change accepted. Contract version updated.' : 'Job change rejected. Original contract remains active.');
      await load();
      if (action === 'accept') window.location.reload();
    } catch (reasonValue) {
      setError(reasonValue instanceof Error ? reasonValue.message : 'The amendment decision could not be recorded.');
    } finally {
      setBusyId(null);
    }
  };

  const verbalSummary = (row: AmendmentRow) => {
    const value = row.change_summary?.verbalAgreement;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const entry = value as Record<string, unknown>;
    return entry.confirmed === true
      ? String(entry.note ?? '').trim() || 'Poster recorded verbal agreement before sending this amendment.'
      : null;
  };

  return <div style={{ display: 'grid', gap: 8 }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
      <div>
        <strong>Job changes / amendments</strong>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
          Accepted booking terms remain versioned. A proposed change is not active until the counterparty accepts it.
        </div>
      </div>
      {canPropose ? (
        <ActionButton tone="warning" onClick={() => setOpen((value) => !value)}>
          {open ? 'Close amendment' : 'Amend Job'}
        </ActionButton>
      ) : null}
    </div>

    {error ? <AlertBanner tone="danger">{error}</AlertBanner> : null}
    {message ? <AlertBanner tone="success">{message}</AlertBanner> : null}

    {pendingForViewer.map((row) => (
      <div key={row.id} style={{ border: '1px solid #f5a300', background: '#fffaf0', borderRadius: 6, padding: 10, display: 'grid', gap: 7 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <strong>Job Change Request · v{row.version_number}</strong>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#9a5a00' }}>PENDING ACCEPTANCE</span>
        </div>
        <div style={{ fontSize: 12 }}><strong>Reason:</strong> {row.reason}</div>
        <div style={{ fontSize: 12 }}><strong>Proposed carrier total:</strong> {displayMoney(row.effective_agreed_amount, row.currency)}</div>
        {priceAdjustment(row) ? (
          <div style={{ fontSize: 12 }}>
            <strong>Price adjustment:</strong> {signedMoney(priceAdjustment(row)!.delta, row.currency)}
            {' '}({displayMoney(priceAdjustment(row)!.from, row.currency)} → {displayMoney(priceAdjustment(row)!.to, row.currency)})
          </div>
        ) : null}
        {amendmentChangeLines(row).length ? (
          <div style={{ display: 'grid', gap: 4, borderTop: '1px solid #fde7b2', paddingTop: 6 }}>
            {amendmentChangeLines(row).map((change, index) => (
              <div key={row.id + '-change-' + index} style={{ fontSize: 11, color: '#475569' }}>
                <strong>{change.label}:</strong> {change.from} → {change.to}
              </div>
            ))}
          </div>
        ) : null}
        {verbalSummary(row) ? (
          <div style={{ fontSize: 11, color: '#475569' }}>
            <strong>Verbal agreement recorded by poster:</strong> {verbalSummary(row)}
            <div>App acceptance is still required before this change becomes active.</div>
          </div>
        ) : null}
        <div style={{ fontSize: 11, color: '#64748b' }}>Proposed {humanTime(row.proposed_at)}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <ActionButton
            tone="primary"
            disabled={busyId === row.id}
            onClick={() => void decide(row.id, 'accept')}
          >
            {busyId === row.id ? 'Recording…' : 'Accept Changes'}
          </ActionButton>
          <ActionButton
            tone="danger"
            disabled={busyId === row.id}
            onClick={() => void decide(row.id, 'reject')}
          >
            Reject Changes
          </ActionButton>
        </div>
      </div>
    ))}

    {open && canPropose ? (
      <div style={{ border: '1px solid #dbe3ee', borderRadius: 6, padding: 12, display: 'grid', gap: 10, background: '#fbfdff' }}>
        <strong>Propose a change to the accepted booking</strong>
        <label style={labelStyle}>
          Reason for change *
          <textarea
            style={textAreaStyle}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Example: consignee changed the delivery address by phone."
          />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 10 }}>
          <label style={labelStyle}>
            Collection address
            <input style={fieldStyle} value={pickupAddress} onChange={(event) => setPickupAddress(event.target.value)} />
          </label>
          <label style={labelStyle}>
            Collection postcode
            <input style={fieldStyle} value={pickupPostcode} onChange={(event) => setPickupPostcode(event.target.value.toUpperCase())} />
          </label>
          <label style={labelStyle}>
            Collection date / time
            <input style={fieldStyle} type="datetime-local" value={pickupDateTime} onChange={(event) => setPickupDateTime(event.target.value)} />
          </label>
          <label style={labelStyle}>
            Collection contact
            <input style={fieldStyle} value={pickupContactName} onChange={(event) => setPickupContactName(event.target.value)} />
          </label>
          <label style={labelStyle}>
            Collection phone
            <input style={fieldStyle} value={pickupContactPhone} onChange={(event) => setPickupContactPhone(event.target.value)} />
          </label>
          <label style={labelStyle}>
            Delivery address
            <input style={fieldStyle} value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} />
          </label>
          <label style={labelStyle}>
            Delivery postcode
            <input style={fieldStyle} value={deliveryPostcode} onChange={(event) => setDeliveryPostcode(event.target.value.toUpperCase())} />
          </label>
          <label style={labelStyle}>
            Delivery date / time
            <input style={fieldStyle} type="datetime-local" value={deliveryDateTime} onChange={(event) => setDeliveryDateTime(event.target.value)} />
          </label>
          <label style={labelStyle}>
            Delivery contact
            <input style={fieldStyle} value={deliveryContactName} onChange={(event) => setDeliveryContactName(event.target.value)} />
          </label>
          <label style={labelStyle}>
            Delivery phone
            <input style={fieldStyle} value={deliveryContactPhone} onChange={(event) => setDeliveryContactPhone(event.target.value)} />
          </label>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 10 }}>
          <label style={labelStyle}>Collection notes<textarea style={textAreaStyle} value={pickupNotes} onChange={(event) => setPickupNotes(event.target.value)} /></label>
          <label style={labelStyle}>Delivery notes<textarea style={textAreaStyle} value={deliveryNotes} onChange={(event) => setDeliveryNotes(event.target.value)} /></label>
        </div>
        <label style={labelStyle}>
          New agreed carrier total ({props.currency})
          <input
            style={fieldStyle}
            inputMode="decimal"
            value={agreedAmount}
            onChange={(event) => setAgreedAmount(event.target.value)}
          />
        </label>

        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: '#334155', fontWeight: 700 }}>
          <input
            type="checkbox"
            checked={verbalAgreementConfirmed}
            onChange={(event) => setVerbalAgreementConfirmed(event.target.checked)}
          />
          Carrier / assigned driver verbally agreed to these proposed changes.
        </label>

        {verbalAgreementConfirmed ? (
          <label style={labelStyle}>
            Verbal agreement note
            <textarea
              style={textAreaStyle}
              value={verbalAgreementNote}
              onChange={(event) => setVerbalAgreementNote(event.target.value)}
              placeholder="Optional: who you spoke to and what was agreed."
            />
          </label>
        ) : null}
        <div style={{ fontSize: 11, color: '#64748b' }}>
          The verbal-agreement tick records the poster's declaration only. The change becomes active only after the carrier or assigned driver accepts it in XDrive.
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
          <ActionButton tone="secondary" disabled={busyId === 'proposal'} onClick={() => setOpen(false)}>
            Cancel
          </ActionButton>
          <ActionButton tone="primary" disabled={busyId === 'proposal'} onClick={() => void submitProposal()}>
            {busyId === 'proposal' ? 'Sending…' : 'Send for Acceptance'}
          </ActionButton>
        </div>
      </div>
    ) : null}

    {loading ? <EmptyState compact title="Loading amendment history…" /> : null}
    {!loading && rows.length === 0 ? <EmptyState compact title="No job amendments recorded" /> : null}
    {!loading && rows.length > 0 ? (
      <div style={{ display: 'grid', gap: 5 }}>
        <strong style={{ fontSize: 12 }}>Change history</strong>
        {rows.map((row) => (
          <div key={'history-' + row.id} style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: 8, display: 'grid', gap: 5 }}>
            <div className="workspace-record-meta">
              <span><strong>v{row.version_number}</strong> · {row.status.replace(/_/g, ' ')}</span>
              <span>{row.reason}</span>
              <span>{displayMoney(row.effective_agreed_amount, row.currency)}</span>
              <span>{humanTime(row.decided_at ?? row.proposed_at)}</span>
            </div>
            {priceAdjustment(row) ? (
              <div style={{ fontSize: 11, color: '#475569' }}>
                <strong>Price:</strong> {displayMoney(priceAdjustment(row)!.from, row.currency)}
                {' '}→ {displayMoney(priceAdjustment(row)!.to, row.currency)}
                {' '}({signedMoney(priceAdjustment(row)!.delta, row.currency)})
              </div>
            ) : null}
            {amendmentChangeLines(row).map((change, index) => (
              <div key={row.id + '-history-change-' + index} style={{ fontSize: 11, color: '#475569' }}>
                <strong>{change.label}:</strong> {change.from} → {change.to}
              </div>
            ))}
            {verbalSummary(row) ? (
              <div style={{ fontSize: 11, color: '#64748b' }}>
                <strong>Verbal agreement declaration:</strong> {verbalSummary(row)}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    ) : null}
  </div>;
}
