'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../AuthContext';
import { resolveActiveCompanyId } from '../../../lib/activeCompany';
import { isSupabaseConfigured, supabase } from '../../../lib/supabaseClient';
import { ActionButton, AlertBanner, Panel } from './WorkspaceUI';

const VEHICLES = ['Small Van', 'SWB Van', 'MWB Van', 'LWB Van', 'XLWB Van', 'Luton', 'Luton Tail Lift', 'Curtainside Van', '3.5T', '5T', '7.5T', '12T', '18T', '26T', 'Artic 44T Curtainsider', 'Artic 44T Box Trailer', 'Artic 44T Flatbed', 'Artic 44T Refrigerated', 'Hiab', 'Moffett', 'ADR Vehicle', 'Refrigerated Vehicle'];
const CARGO = ['Documents', 'Parcels', 'Pallets', 'Machinery', 'Furniture', 'Retail Goods', 'Mixed Freight', 'ADR Goods', 'Temperature Controlled Freight', 'Other'];

const fieldStyle = { width: '100%', minHeight: '42px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0.62rem 0.7rem', fontSize: '0.82rem', boxSizing: 'border-box' as const, background: '#fff', color: '#0f172a' };
const labelStyle = { display: 'grid', gap: '0.32rem', color: '#334155', fontSize: '0.74rem', fontWeight: 750 };

const numberOrNull = (value: string) => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

export default function LoadPostingForm({ mode }: { mode: 'broker' | 'customer' }) {
  const { user } = useAuth();
  const router = useRouter();
  const idempotencyKeyRef = useRef<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    clientName: '', clientEmail: '', clientPhone: '',
    pickupDate: '', pickupTime: '08:00', pickupAddress: '', pickupPostcode: '', collectionContact: '', collectionPhone: '',
    deliveryDate: '', deliveryTime: 'ASAP', deliveryAddress: '', deliveryPostcode: '', deliveryContact: '', deliveryPhone: '',
    vehicle: 'LWB Van', cargo: 'Pallets', weight: '', pallets: '', length: '', width: '', height: '', cargoValue: '',
    customerReference: '', purchaseOrder: '', bookingReference: '', customerPrice: '', targetCarrierCost: '',
    tailLift: false, forklift: false, handball: false, adr: false, temperatureControlled: false, fragile: false,
    notes: '',
  });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((current) => ({ ...current, [key]: value }));
  const dateTime = (date: string, time: string) => date ? `${date}T${time === 'ASAP' ? '23:59' : time}:00` : null;

  const save = async (publish: boolean) => {
    setError('');
    setSuccess('');
    if (!form.pickupDate || !form.pickupAddress.trim() || !form.pickupPostcode.trim() || !form.deliveryAddress.trim() || !form.deliveryPostcode.trim()) {
      setError('Collection date, collection address, delivery address and both postcodes are required.');
      return;
    }
    if (!user?.id || !isSupabaseConfigured) {
      setError('Your session is not ready. Sign in again.');
      return;
    }

    setSaving(true);
    try {
      const companyId = await resolveActiveCompanyId({ userId: user.id, fallbackCompanyId: user.companyId ?? null });
      if (!companyId) throw new Error('This account is not linked to a company.');

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('Your session has expired. Please sign in again.');

      idempotencyKeyRef.current ??= crypto.randomUUID();
      const response = await fetch('/api/jobs/create', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idempotencyKey: idempotencyKeyRef.current,
          companyId,
          mode,
          publish,
          clientName: form.clientName || null,
          clientEmail: form.clientEmail || '',
          clientPhone: form.clientPhone || null,
          pickupDateTime: dateTime(form.pickupDate, form.pickupTime),
          pickupTimeSlot: form.pickupTime,
          pickupAddress: form.pickupAddress,
          pickupPostcode: form.pickupPostcode,
          collectionContact: form.collectionContact || null,
          collectionPhone: form.collectionPhone || null,
          deliveryDateTime: dateTime(form.deliveryDate, form.deliveryTime),
          deliveryTimeSlot: form.deliveryTime,
          deliveryAddress: form.deliveryAddress,
          deliveryPostcode: form.deliveryPostcode,
          deliveryContact: form.deliveryContact || null,
          deliveryPhone: form.deliveryPhone || null,
          vehicleLabel: form.vehicle,
          cargoLabel: form.cargo,
          weightKg: numberOrNull(form.weight),
          pallets: numberOrNull(form.pallets),
          lengthCm: numberOrNull(form.length),
          widthCm: numberOrNull(form.width),
          heightCm: numberOrNull(form.height),
          cargoValueGbp: numberOrNull(form.cargoValue),
          customerReference: form.customerReference || null,
          purchaseOrder: form.purchaseOrder || null,
          bookingReference: form.bookingReference || null,
          customerPrice: numberOrNull(form.customerPrice),
          targetCarrierCost: numberOrNull(form.targetCarrierCost),
          tailLift: form.tailLift,
          forklift: form.forklift,
          handball: form.handball,
          adr: form.adr,
          temperatureControlled: form.temperatureControlled,
          fragile: form.fragile,
          notes: form.notes || null,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        job?: { id: string };
        replayed?: boolean;
      } | null;
      if (!response.ok || !payload?.job?.id) {
        throw new Error(payload?.error ?? 'The load could not be saved.');
      }

      setSuccess(publish ? 'Load published to the carrier marketplace.' : 'Draft load saved.');
      const destination = mode === 'broker'
        ? `/broker/loads?created=${payload.job.id}`
        : `/customer/loads?created=${payload.job.id}`;
      idempotencyKeyRef.current = null;
      window.setTimeout(() => router.push(destination), 350);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The load could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: '0.9rem' }}>
      {error && <AlertBanner tone="danger">{error}</AlertBanner>}
      {success && <AlertBanner tone="success">{success}</AlertBanner>}

      {mode === 'broker' && (
        <Panel title="Customer" description="The customer whose transport request is being managed by the broker.">
          <div style={gridStyle}>
            <label style={labelStyle}>Customer name<input style={fieldStyle} value={form.clientName} onChange={(event) => set('clientName', event.target.value)} /></label>
            <label style={labelStyle}>Customer email<input style={fieldStyle} type="email" value={form.clientEmail} onChange={(event) => set('clientEmail', event.target.value)} /></label>
            <label style={labelStyle}>Customer phone<input style={fieldStyle} value={form.clientPhone} onChange={(event) => set('clientPhone', event.target.value)} /></label>
          </div>
        </Panel>
      )}

      <Panel title="Collection and delivery" description="Dates, time windows, full addresses and site contacts.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: '0.9rem' }}>
          <StopFields title="Collection" date={form.pickupDate} time={form.pickupTime} postcode={form.pickupPostcode} address={form.pickupAddress} contact={form.collectionContact} phone={form.collectionPhone} onDate={(value) => set('pickupDate', value)} onTime={(value) => set('pickupTime', value)} onPostcode={(value) => set('pickupPostcode', value)} onAddress={(value) => set('pickupAddress', value)} onContact={(value) => set('collectionContact', value)} onPhone={(value) => set('collectionPhone', value)} requiredDate />
          <StopFields title="Delivery" date={form.deliveryDate} time={form.deliveryTime === 'ASAP' ? '' : form.deliveryTime} postcode={form.deliveryPostcode} address={form.deliveryAddress} contact={form.deliveryContact} phone={form.deliveryPhone} onDate={(value) => set('deliveryDate', value)} onTime={(value) => set('deliveryTime', value || 'ASAP')} onPostcode={(value) => set('deliveryPostcode', value)} onAddress={(value) => set('deliveryAddress', value)} onContact={(value) => set('deliveryContact', value)} onPhone={(value) => set('deliveryPhone', value)} />
        </div>
      </Panel>

      <Panel title="Cargo and vehicle" description="Vehicle capability and load dimensions used by carriers when pricing.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: '0.7rem' }}>
          <label style={labelStyle}>Vehicle<select style={fieldStyle} value={form.vehicle} onChange={(event) => set('vehicle', event.target.value)}>{VEHICLES.map((option) => <option key={option}>{option}</option>)}</select></label>
          <label style={labelStyle}>Cargo<select style={fieldStyle} value={form.cargo} onChange={(event) => set('cargo', event.target.value)}>{CARGO.map((option) => <option key={option}>{option}</option>)}</select></label>
          {([['weight', 'Weight (kg)'], ['pallets', 'Pallets'], ['length', 'Length (cm)'], ['width', 'Width (cm)'], ['height', 'Height (cm)'], ['cargoValue', 'Cargo value (£)']] as const).map(([key, label]) => (
            <label key={key} style={labelStyle}>{label}<input style={fieldStyle} type="number" min="0" value={form[key]} onChange={(event) => set(key, event.target.value)} /></label>
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.8rem', marginTop: '0.8rem' }}>
          {([['tailLift', 'Tail lift'], ['forklift', 'Forklift'], ['handball', 'Handball'], ['adr', 'ADR'], ['temperatureControlled', 'Temperature controlled'], ['fragile', 'Fragile']] as const).map(([key, label]) => (
            <label key={key} style={{ display: 'flex', gap: '0.38rem', alignItems: 'center', fontSize: '0.78rem', fontWeight: 700 }}>
              <input type="checkbox" checked={form[key]} onChange={(event) => set(key, event.target.checked)} />{label}
            </label>
          ))}
        </div>
      </Panel>

      <Panel title="Commercial references" description={mode === 'broker' ? 'Customer revenue and carrier target cost remain separate so margin is visible.' : 'References and optional target budget for carrier quotes.'}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: '0.7rem' }}>
          <label style={labelStyle}>Customer reference<input style={fieldStyle} value={form.customerReference} onChange={(event) => set('customerReference', event.target.value)} /></label>
          <label style={labelStyle}>PO number<input style={fieldStyle} value={form.purchaseOrder} onChange={(event) => set('purchaseOrder', event.target.value)} /></label>
          <label style={labelStyle}>Booking reference<input style={fieldStyle} value={form.bookingReference} onChange={(event) => set('bookingReference', event.target.value)} /></label>
          <label style={labelStyle}>{mode === 'broker' ? 'Customer price (£)' : 'Budget (£)'}<input style={fieldStyle} type="number" min="0" value={form.customerPrice} onChange={(event) => set('customerPrice', event.target.value)} /></label>
          {mode === 'broker' && <label style={labelStyle}>Target carrier cost (£)<input style={fieldStyle} type="number" min="0" value={form.targetCarrierCost} onChange={(event) => set('targetCarrierCost', event.target.value)} /></label>}
        </div>
        <label style={{ ...labelStyle, marginTop: '0.7rem' }}>Operational notes<textarea style={{ ...fieldStyle, minHeight: 90 }} value={form.notes} onChange={(event) => set('notes', event.target.value)} /></label>
      </Panel>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.55rem', flexWrap: 'wrap' }}>
        <ActionButton tone="secondary" disabled={saving} onClick={() => void save(false)}>{saving ? 'Saving…' : 'Save Draft'}</ActionButton>
        <ActionButton tone="warning" disabled={saving} onClick={() => void save(true)}>{saving ? 'Publishing…' : 'Publish Load'}</ActionButton>
      </div>
    </div>
  );
}

function StopFields({ title, date, time, postcode, address, contact, phone, onDate, onTime, onPostcode, onAddress, onContact, onPhone, requiredDate = false }: {
  title: string; date: string; time: string; postcode: string; address: string; contact: string; phone: string;
  onDate: (value: string) => void; onTime: (value: string) => void; onPostcode: (value: string) => void;
  onAddress: (value: string) => void; onContact: (value: string) => void; onPhone: (value: string) => void; requiredDate?: boolean;
}) {
  return (
    <div style={{ display: 'grid', gap: '0.65rem' }}>
      <h3 style={{ margin: 0, fontSize: '0.88rem' }}>{title}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
        <label style={labelStyle}>Date{requiredDate ? ' *' : ''}<input style={fieldStyle} type="date" value={date} onChange={(event) => onDate(event.target.value)} /></label>
        <label style={labelStyle}>Time<input style={fieldStyle} type="time" value={time} onChange={(event) => onTime(event.target.value)} /></label>
      </div>
      <label style={labelStyle}>Postcode *<input style={fieldStyle} value={postcode} onChange={(event) => onPostcode(event.target.value)} /></label>
      <label style={labelStyle}>Address *<textarea style={{ ...fieldStyle, minHeight: 84 }} value={address} onChange={(event) => onAddress(event.target.value)} /></label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
        <label style={labelStyle}>Contact<input style={fieldStyle} value={contact} onChange={(event) => onContact(event.target.value)} /></label>
        <label style={labelStyle}>Phone<input style={fieldStyle} value={phone} onChange={(event) => onPhone(event.target.value)} /></label>
      </div>
    </div>
  );
}

const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '0.75rem' };
