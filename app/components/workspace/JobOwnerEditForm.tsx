'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import PostcodeAddressField from './PostcodeAddressField';
import { ActionButton, AlertBanner, EmptyState, Panel } from './WorkspaceUI';

const VEHICLES = ['Small Van', 'SWB Van', 'MWB Van', 'LWB Van', 'XLWB Van', 'Luton', 'Luton Tail Lift', 'Curtainside Van', '3.5T', '5T', '7.5T', '12T', '18T', '26T', 'Artic 44T Curtainsider', 'Artic 44T Box Trailer', 'Artic 44T Flatbed', 'Artic 44T Refrigerated', 'Hiab', 'Moffett', 'ADR Vehicle', 'Refrigerated Vehicle'];
const CARGO = ['Documents', 'Parcels', 'Pallets', 'Machinery', 'Furniture', 'Retail Goods', 'Mixed Freight', 'ADR Goods', 'Temperature Controlled Freight', 'Other'];
const HALF_HOUR_SLOTS = Array.from({ length: 48 }, (_, index) => `${String(Math.floor(index / 2)).padStart(2, '0')}:${index % 2 ? '30' : '00'}`);
const fieldStyle = { width: '100%', minHeight: 32, border: '1px solid #cfd7e3', borderRadius: 4, padding: '0 8px', fontSize: 12, boxSizing: 'border-box' as const, background: '#fff', color: '#172033' };
const textareaStyle = { ...fieldStyle, minHeight: 72, padding: '7px 8px', resize: 'vertical' as const };
const labelStyle = { display: 'grid', gap: 4, color: '#334155', fontSize: 11, lineHeight: '14px', fontWeight: 700 };
const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 8 } as const;
const microButtonStyle = { minHeight: 26, border: '1px solid #cbd5e1', borderRadius: 4, padding: '0 7px', background: '#fff', color: '#334155', fontSize: 11, fontWeight: 700, cursor: 'pointer' } as const;
const invalidStyle = { border: '1px solid #dc2626', background: '#fffafa' };
const errorTextStyle = { color: '#b91c1c', fontSize: 10, fontWeight: 700 } as const;

const normalizePostcode = (value: string) => {
  const compact = value.toUpperCase().replace(/\s+/g, '').trim();
  return compact.length > 3 ? `${compact.slice(0, -3)} ${compact.slice(-3)}` : compact;
};
const isFullUkPostcode = (value: string) => /^(GIR 0AA|(?:[A-Z]{1,2}\d[A-Z\d]?|[A-Z]{1,2}\d{1,2}) \d[A-Z]{2})$/i.test(normalizePostcode(value));
const numberOrNull = (value: string) => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};
const dateTime = (date: string, time: string) => date && time ? `${date}T${time}:00` : null;
const asInput = (value: number | null | undefined) => value == null ? '' : String(value);

export type OwnerEditCapabilities = {
  canEdit: boolean;
  canDelete: boolean;
  editReason: string | null;
  deleteReason: string | null;
  bidCount: number;
};

type AdditionalStop = {
  id: string;
  type: 'collection' | 'delivery';
  date: string;
  time: string;
  postcode: string;
  address: string;
  contact: string;
  phone: string;
  instructions: string;
};

type Snapshot = {
  id: string;
  reference: string;
  status: string;
  publish: boolean;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  pickupDate: string;
  pickupTime: string;
  pickupAddress: string;
  pickupPostcode: string;
  collectionContact: string;
  collectionPhone: string;
  deliveryDate: string;
  deliveryTime: string;
  deliveryAddress: string;
  deliveryPostcode: string;
  deliveryContact: string;
  deliveryPhone: string;
  additionalStops: AdditionalStop[];
  vehicle: string;
  cargo: string;
  weight: number | null;
  pallets: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  cargoValue: number | null;
  customerReference: string;
  purchaseOrder: string;
  bookingReference: string;
  customerPrice: number | null;
  targetCarrierCost: number | null;
  tailLift: boolean;
  forklift: boolean;
  handball: boolean;
  adr: boolean;
  temperatureControlled: boolean;
  fragile: boolean;
  publicQuoteNotes: string;
  executionInstructions: string;
  capabilities: OwnerEditCapabilities;
};

type FormState = {
  clientName: string; clientEmail: string; clientPhone: string;
  pickupDate: string; pickupTime: string; pickupAddress: string; pickupPostcode: string; collectionContact: string; collectionPhone: string;
  deliveryDate: string; deliveryTime: string; deliveryAddress: string; deliveryPostcode: string; deliveryContact: string; deliveryPhone: string;
  vehicle: string; cargo: string; weight: string; pallets: string; length: string; width: string; height: string; cargoValue: string;
  customerReference: string; purchaseOrder: string; bookingReference: string; customerPrice: string; targetCarrierCost: string;
  tailLift: boolean; forklift: boolean; handball: boolean; adr: boolean; temperatureControlled: boolean; fragile: boolean;
  publicQuoteNotes: string; executionInstructions: string;
};

const EMPTY_FORM: FormState = {
  clientName: '', clientEmail: '', clientPhone: '',
  pickupDate: '', pickupTime: '', pickupAddress: '', pickupPostcode: '', collectionContact: '', collectionPhone: '',
  deliveryDate: '', deliveryTime: '', deliveryAddress: '', deliveryPostcode: '', deliveryContact: '', deliveryPhone: '',
  vehicle: 'LWB Van', cargo: 'Pallets', weight: '', pallets: '', length: '', width: '', height: '', cargoValue: '',
  customerReference: '', purchaseOrder: '', bookingReference: '', customerPrice: '', targetCarrierCost: '',
  tailLift: false, forklift: false, handball: false, adr: false, temperatureControlled: false, fragile: false,
  publicQuoteNotes: '', executionInstructions: '',
};

function StopFields({
  title, date, time, postcode, address, contact, phone, onDate, onTime, onPostcode, onAddress, onContact, onPhone, showErrors,
}: {
  title: string; date: string; time: string; postcode: string; address: string; contact: string; phone: string;
  onDate: (value: string) => void; onTime: (value: string) => void; onPostcode: (value: string) => void; onAddress: (value: string) => void; onContact: (value: string) => void; onPhone: (value: string) => void; showErrors: boolean;
}) {
  const postcodeError = showErrors && (!postcode.trim() ? 'Required' : !isFullUkPostcode(postcode) ? 'Enter a full UK postcode' : '');
  const addressError = showErrors && !address.trim() ? 'Required' : '';
  return <div style={{ display: 'grid', gap: 7 }}>
    <strong style={{ fontSize: 12 }}>{title}</strong>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      <label style={labelStyle}>Date *<input style={{ ...fieldStyle, ...(showErrors && !date ? invalidStyle : {}) }} type="date" value={date} onChange={(event) => onDate(event.target.value)} />{showErrors && !date ? <span style={errorTextStyle}>Required</span> : null}</label>
      <label style={labelStyle}>Time *<select style={{ ...fieldStyle, ...(showErrors && !time ? invalidStyle : {}) }} value={time} onChange={(event) => onTime(event.target.value)}><option value="">Select time</option>{HALF_HOUR_SLOTS.map((slot) => <option key={slot} value={slot}>{slot}</option>)}</select>{showErrors && !time ? <span style={errorTextStyle}>Required</span> : null}</label>
    </div>
    <label style={labelStyle}>Postcode *<input style={{ ...fieldStyle, ...(postcodeError ? invalidStyle : {}) }} value={postcode} onChange={(event) => onPostcode(event.target.value.toUpperCase())} />{postcodeError ? <span style={errorTextStyle}>{postcodeError}</span> : null}</label>
    <PostcodeAddressField postcode={postcode} address={address} onAddress={onAddress} error={addressError || undefined} />
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      <label style={labelStyle}>Contact<input style={fieldStyle} value={contact} onChange={(event) => onContact(event.target.value)} /></label>
      <label style={labelStyle}>Phone<input style={fieldStyle} value={phone} onChange={(event) => onPhone(event.target.value)} /></label>
    </div>
  </div>;
}

export default function JobOwnerEditForm({ jobId, mode = 'customer' }: { jobId: string; mode?: 'customer' | 'broker' }) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [additionalStops, setAdditionalStops] = useState<AdditionalStop[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true); setError('');
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error('Your session has expired. Sign in again.');
        const response = await fetch(`/api/workspace/jobs/${encodeURIComponent(jobId)}/owner`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
        const payload = await response.json().catch(() => ({})) as { job?: Snapshot; error?: string };
        if (!response.ok || !payload.job) throw new Error(payload.error || 'The load could not be opened for editing.');
        if (cancelled) return;
        const job = payload.job;
        setSnapshot(job);
        setAdditionalStops(job.additionalStops ?? []);
        setForm({
          clientName: job.clientName ?? '', clientEmail: job.clientEmail ?? '', clientPhone: job.clientPhone ?? '',
          pickupDate: job.pickupDate ?? '', pickupTime: job.pickupTime ?? '', pickupAddress: job.pickupAddress ?? '', pickupPostcode: job.pickupPostcode ?? '', collectionContact: job.collectionContact ?? '', collectionPhone: job.collectionPhone ?? '',
          deliveryDate: job.deliveryDate ?? '', deliveryTime: job.deliveryTime ?? '', deliveryAddress: job.deliveryAddress ?? '', deliveryPostcode: job.deliveryPostcode ?? '', deliveryContact: job.deliveryContact ?? '', deliveryPhone: job.deliveryPhone ?? '',
          vehicle: job.vehicle || 'LWB Van', cargo: job.cargo || 'Pallets', weight: asInput(job.weight), pallets: asInput(job.pallets), length: asInput(job.length), width: asInput(job.width), height: asInput(job.height), cargoValue: asInput(job.cargoValue),
          customerReference: job.customerReference ?? '', purchaseOrder: job.purchaseOrder ?? '', bookingReference: job.bookingReference ?? '', customerPrice: asInput(job.customerPrice), targetCarrierCost: asInput(job.targetCarrierCost),
          tailLift: Boolean(job.tailLift), forklift: Boolean(job.forklift), handball: Boolean(job.handball), adr: Boolean(job.adr), temperatureControlled: Boolean(job.temperatureControlled), fragile: Boolean(job.fragile),
          publicQuoteNotes: job.publicQuoteNotes ?? '', executionInstructions: job.executionInstructions ?? '',
        });
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'The load could not be opened for editing.');
      } finally { if (!cancelled) setLoading(false); }
    };
    void load();
    return () => { cancelled = true; };
  }, [jobId]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const addStop = () => setAdditionalStops((current) => current.length >= 8 ? current : [...current, { id: crypto.randomUUID(), type: 'delivery', date: '', time: '', postcode: '', address: '', contact: '', phone: '', instructions: '' }]);
  const updateStop = (id: string, patch: Partial<AdditionalStop>) => setAdditionalStops((current) => current.map((stop) => stop.id === id ? { ...stop, ...patch } : stop));
  const removeStop = (id: string) => setAdditionalStops((current) => current.filter((stop) => stop.id !== id));
  const moveStop = (id: string, delta: -1 | 1) => setAdditionalStops((current) => {
    const index = current.findIndex((stop) => stop.id === id); const nextIndex = index + delta;
    if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
    const next = [...current]; [next[index], next[nextIndex]] = [next[nextIndex], next[index]]; return next;
  });

  const invalid = () => {
    const mainInvalid = !form.pickupDate || !form.pickupTime || !isFullUkPostcode(form.pickupPostcode) || !form.pickupAddress.trim() || !form.deliveryDate || !form.deliveryTime || !isFullUkPostcode(form.deliveryPostcode) || !form.deliveryAddress.trim();
    const stopsInvalid = additionalStops.some((stop) => !stop.date || !stop.time || !isFullUkPostcode(stop.postcode) || !stop.address.trim());
    const dimensionsInvalid = [form.length, form.width, form.height].some((value) => value.trim() && (numberOrNull(value) == null || Number(value) > 2000));
    return mainInvalid || stopsInvalid || dimensionsInvalid;
  };

  const save = async (publish: boolean) => {
    setShowErrors(true); setError('');
    if (invalid()) { setError('Load details are incomplete or invalid. Complete the fields highlighted in red.'); return; }
    setSaving(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Your session has expired. Sign in again.');
      const response = await fetch(`/api/workspace/jobs/${encodeURIComponent(jobId)}/owner`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publish,
          clientName: form.clientName || null, clientEmail: form.clientEmail || '', clientPhone: form.clientPhone || null,
          pickupDateTime: dateTime(form.pickupDate, form.pickupTime), pickupTimeSlot: form.pickupTime, pickupAddress: form.pickupAddress.trim(), pickupPostcode: normalizePostcode(form.pickupPostcode), collectionContact: form.collectionContact || null, collectionPhone: form.collectionPhone || null,
          deliveryDateTime: dateTime(form.deliveryDate, form.deliveryTime), deliveryTimeSlot: form.deliveryTime, deliveryAddress: form.deliveryAddress.trim(), deliveryPostcode: normalizePostcode(form.deliveryPostcode), deliveryContact: form.deliveryContact || null, deliveryPhone: form.deliveryPhone || null,
          additionalStops: additionalStops.map((stop) => ({ type: stop.type, address: stop.address.trim(), postcode: normalizePostcode(stop.postcode), contact: stop.contact || null, phone: stop.phone || null, dateTime: dateTime(stop.date, stop.time), instructions: stop.instructions || null })),
          vehicleLabel: form.vehicle, cargoLabel: form.cargo, weightKg: numberOrNull(form.weight), pallets: numberOrNull(form.pallets), lengthCm: numberOrNull(form.length), widthCm: numberOrNull(form.width), heightCm: numberOrNull(form.height), cargoValueGbp: numberOrNull(form.cargoValue),
          customerReference: form.customerReference || null, purchaseOrder: form.purchaseOrder || null, bookingReference: form.bookingReference || null, customerPrice: numberOrNull(form.customerPrice), targetCarrierCost: numberOrNull(form.targetCarrierCost),
          tailLift: form.tailLift, forklift: form.forklift, handball: form.handball, adr: form.adr, temperatureControlled: form.temperatureControlled, fragile: form.fragile,
          publicQuoteNotes: form.publicQuoteNotes || null, executionInstructions: form.executionInstructions || null,
        }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'The load could not be updated.');
      router.push(`/${mode}/jobs/${jobId}?updated=1`);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The load could not be updated.');
    } finally { setSaving(false); }
  };

  if (loading) return <EmptyState compact title="Loading editable load…" />;
  if (error && !snapshot) return <AlertBanner tone="danger">{error}</AlertBanner>;
  if (!snapshot) return <EmptyState title="Load unavailable" />;
  if (!snapshot.capabilities.canEdit) return <AlertBanner tone="warning">{snapshot.capabilities.editReason ?? 'This load is no longer editable.'}</AlertBanner>;

  return <div style={{ display: 'grid', gap: 12 }}>
    {error ? <AlertBanner tone="danger">{error}</AlertBanner> : null}
    <Panel title="Load identity" description="The XDrive reference and posting company ownership do not change when you edit this load.">
      <div style={gridStyle}><label style={labelStyle}>XDrive reference<div style={{ ...fieldStyle, display: 'flex', alignItems: 'center', background: '#f8fafc' }}>{snapshot.reference}</div></label><label style={labelStyle}>Current status<div style={{ ...fieldStyle, display: 'flex', alignItems: 'center', background: '#f8fafc', textTransform: 'capitalize' }}>{snapshot.status.replace(/_/g, ' ')}</div></label></div>
    </Panel>

    <Panel title="Collection and delivery" description="You can change an unawarded route. If the load has received carrier quotes, editing is locked to avoid stale pricing.">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 12 }}>
        <StopFields title="Collection" date={form.pickupDate} time={form.pickupTime} postcode={form.pickupPostcode} address={form.pickupAddress} contact={form.collectionContact} phone={form.collectionPhone} onDate={(v) => set('pickupDate', v)} onTime={(v) => set('pickupTime', v)} onPostcode={(v) => set('pickupPostcode', v)} onAddress={(v) => set('pickupAddress', v)} onContact={(v) => set('collectionContact', v)} onPhone={(v) => set('collectionPhone', v)} showErrors={showErrors} />
        <StopFields title="Delivery" date={form.deliveryDate} time={form.deliveryTime} postcode={form.deliveryPostcode} address={form.deliveryAddress} contact={form.deliveryContact} phone={form.deliveryPhone} onDate={(v) => set('deliveryDate', v)} onTime={(v) => set('deliveryTime', v)} onPostcode={(v) => set('deliveryPostcode', v)} onAddress={(v) => set('deliveryAddress', v)} onContact={(v) => set('deliveryContact', v)} onPhone={(v) => set('deliveryPhone', v)} showErrors={showErrors} />
      </div>
      <div style={{ display: 'grid', gap: 8, borderTop: '1px solid #e2e8f0', marginTop: 12, paddingTop: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}><div><strong style={{ fontSize: 12 }}>Additional stops</strong><div style={{ fontSize: 11, color: '#64748b' }}>Edit, add, remove or reorder intermediate stops before the load is awarded.</div></div><ActionButton tone="secondary" disabled={saving || additionalStops.length >= 8} onClick={addStop}>{additionalStops.length >= 8 ? 'Maximum 8 stops' : 'Add stop'}</ActionButton></div>
        {additionalStops.map((stop, index) => <div key={stop.id} style={{ border: '1px solid #dbe3ee', borderRadius: 4, padding: 10, display: 'grid', gap: 8, background: '#fbfdff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><strong style={{ fontSize: 12 }}>Stop {index + 2}</strong><div style={{ display: 'flex', gap: 5 }}><button type="button" style={microButtonStyle} disabled={index === 0 || saving} onClick={() => moveStop(stop.id, -1)}>Move up</button><button type="button" style={microButtonStyle} disabled={index === additionalStops.length - 1 || saving} onClick={() => moveStop(stop.id, 1)}>Move down</button><button type="button" style={microButtonStyle} disabled={saving} onClick={() => removeStop(stop.id)}>Remove</button></div></div>
          <label style={labelStyle}>Stop type<select style={fieldStyle} value={stop.type} onChange={(event) => updateStop(stop.id, { type: event.target.value as 'collection' | 'delivery' })}><option value="collection">Collection</option><option value="delivery">Delivery</option></select></label>
          <StopFields title={stop.type === 'collection' ? 'Collection stop' : 'Delivery stop'} date={stop.date} time={stop.time} postcode={stop.postcode} address={stop.address} contact={stop.contact} phone={stop.phone} onDate={(v) => updateStop(stop.id, { date: v })} onTime={(v) => updateStop(stop.id, { time: v })} onPostcode={(v) => updateStop(stop.id, { postcode: v })} onAddress={(v) => updateStop(stop.id, { address: v })} onContact={(v) => updateStop(stop.id, { contact: v })} onPhone={(v) => updateStop(stop.id, { phone: v })} showErrors={showErrors} />
          <label style={labelStyle}>Private stop instructions<textarea style={textareaStyle} value={stop.instructions} onChange={(event) => updateStop(stop.id, { instructions: event.target.value })} /></label>
        </div>)}
      </div>
    </Panel>

    <Panel title="Cargo and vehicle" description="Update the transport requirement before a carrier has been awarded.">
      <div style={gridStyle}>
        <label style={labelStyle}>Vehicle<select style={fieldStyle} value={form.vehicle} onChange={(event) => set('vehicle', event.target.value)}>{VEHICLES.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label style={labelStyle}>Cargo<select style={fieldStyle} value={form.cargo} onChange={(event) => set('cargo', event.target.value)}>{CARGO.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label style={labelStyle}>Weight (kg)<input style={fieldStyle} inputMode="decimal" value={form.weight} onChange={(event) => set('weight', event.target.value)} /></label>
        <label style={labelStyle}>Pallets<input style={fieldStyle} inputMode="numeric" value={form.pallets} onChange={(event) => set('pallets', event.target.value)} /></label>
        <label style={labelStyle}>Length (cm)<input style={fieldStyle} inputMode="decimal" value={form.length} onChange={(event) => set('length', event.target.value)} /></label>
        <label style={labelStyle}>Width (cm)<input style={fieldStyle} inputMode="decimal" value={form.width} onChange={(event) => set('width', event.target.value)} /></label>
        <label style={labelStyle}>Height (cm)<input style={fieldStyle} inputMode="decimal" value={form.height} onChange={(event) => set('height', event.target.value)} /></label>
        <label style={labelStyle}>Cargo value (£)<input style={fieldStyle} inputMode="decimal" value={form.cargoValue} onChange={(event) => set('cargoValue', event.target.value)} /></label>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 10, fontSize: 11 }}>
        <label><input type="checkbox" checked={form.tailLift} onChange={(event) => set('tailLift', event.target.checked)} /> Tail lift required</label>
        <label><input type="checkbox" checked={form.forklift} onChange={(event) => set('forklift', event.target.checked)} /> Forklift available at collection</label>
        <label><input type="checkbox" checked={form.handball} onChange={(event) => set('handball', event.target.checked)} /> Handball required</label>
        <label><input type="checkbox" checked={form.adr} onChange={(event) => set('adr', event.target.checked)} /> ADR load</label>
        <label><input type="checkbox" checked={form.temperatureControlled} onChange={(event) => set('temperatureControlled', event.target.checked)} /> Temperature controlled</label>
        <label><input type="checkbox" checked={form.fragile} onChange={(event) => set('fragile', event.target.checked)} /> Fragile goods</label>
      </div>
    </Panel>

    <Panel title="Commercial references" description="These remain owned by the posting company.">
      <div style={gridStyle}>
        <label style={labelStyle}>Customer reference<input style={fieldStyle} value={form.customerReference} onChange={(event) => set('customerReference', event.target.value)} /></label>
        <label style={labelStyle}>PO number<input style={fieldStyle} value={form.purchaseOrder} onChange={(event) => set('purchaseOrder', event.target.value)} /></label>
        <label style={labelStyle}>Customer booking reference<input style={fieldStyle} value={form.bookingReference} onChange={(event) => set('bookingReference', event.target.value)} /></label>
        <label style={labelStyle}>Budget (£)<input style={fieldStyle} inputMode="decimal" value={form.customerPrice} onChange={(event) => set('customerPrice', event.target.value)} /></label>
      </div>
    </Panel>

    <Panel title="Marketplace notes & execution instructions" description="Pre-award public notes remain separate from private execution instructions.">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 10 }}>
        <label style={labelStyle}>Public quote notes<textarea style={textareaStyle} value={form.publicQuoteNotes} onChange={(event) => set('publicQuoteNotes', event.target.value)} /></label>
        <label style={labelStyle}>Private execution instructions<textarea style={textareaStyle} value={form.executionInstructions} onChange={(event) => set('executionInstructions', event.target.value)} /></label>
      </div>
    </Panel>

    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
      <ActionButton tone="secondary" disabled={saving} onClick={() => router.push(`/${mode}/jobs/${jobId}`)}>Cancel</ActionButton>
      <ActionButton tone="primary" disabled={saving} onClick={() => void save(snapshot.publish)}>{saving ? 'Saving…' : 'Save changes'}</ActionButton>
      {!snapshot.publish ? <ActionButton tone="warning" disabled={saving} onClick={() => void save(true)}>{saving ? 'Publishing…' : 'Save & Publish'}</ActionButton> : null}
    </div>
  </div>;
}
