'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../AuthContext';
import { resolveActiveCompanyId } from '../../../lib/activeCompany';
import { isSupabaseConfigured, supabase } from '../../../lib/supabaseClient';
import { labelToCargoType, labelToVehicleType } from '../../../lib/vehicleTypes';
import { ActionButton, AlertBanner, Panel } from './WorkspaceUI';

const VEHICLES = ['Small Van', 'SWB Van', 'MWB Van', 'LWB Van', 'XLWB Van', 'Luton', 'Luton Tail Lift', 'Curtainside Van', '3.5T', '5T', '7.5T', '12T', '18T', '26T', 'Artic 44T Curtainsider', 'Artic 44T Box Trailer', 'Artic 44T Flatbed', 'Artic 44T Refrigerated', 'Hiab', 'Moffett', 'ADR Vehicle', 'Refrigerated Vehicle'];
const CARGO = ['Documents', 'Parcels', 'Pallets', 'Machinery', 'Furniture', 'Retail Goods', 'Mixed Freight', 'ADR Goods', 'Temperature Controlled Freight', 'Other'];

const fieldStyle = { width: '100%', minHeight: '42px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0.62rem 0.7rem', fontSize: '0.82rem', boxSizing: 'border-box' as const, background: '#fff', color: '#0f172a' };
const labelStyle = { display: 'grid', gap: '0.32rem', color: '#334155', fontSize: '0.74rem', fontWeight: 750 };

export default function LoadPostingForm({ mode }: { mode: 'broker' | 'customer' }) {
  const { user } = useAuth();
  const router = useRouter();
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
    setError(''); setSuccess('');
    if (!form.pickupDate || !form.pickupAddress.trim() || !form.pickupPostcode.trim() || !form.deliveryAddress.trim() || !form.deliveryPostcode.trim()) {
      setError('Collection date, collection address, delivery address and both postcodes are required.');
      return;
    }
    if (!user?.id || !isSupabaseConfigured) { setError('Your session is not ready. Sign in again.'); return; }
    setSaving(true);
    const companyId = await resolveActiveCompanyId({ userId: user.id, fallbackCompanyId: user.companyId ?? null });
    if (!companyId) { setError('This account is not linked to a company.'); setSaving(false); return; }

    const specialRequirements = [form.tailLift && 'Tail lift required', form.forklift && 'Forklift required', form.handball && 'Handball required', form.adr && 'ADR required', form.temperatureControlled && 'Temperature controlled', form.fragile && 'Fragile goods'].filter(Boolean).join(', ');
    const loadDetails = JSON.stringify({
      source: mode === 'broker' ? 'broker_workspace_v2' : 'customer_workspace_v2',
      targetCarrierCost: form.targetCarrierCost ? Number(form.targetCarrierCost) : null,
      dimensionsCm: { length: form.length || null, width: form.width || null, height: form.height || null },
      notes: form.notes || null,
    });

    const { data, error: insertError } = await supabase.from('jobs').insert([{
      company_id: companyId,
      created_by: user.id,
      status: publish ? 'posted' : 'draft',
      current_status: publish ? 'posted' : 'draft',
      pickup_location: `${form.pickupAddress.trim()}, ${form.pickupPostcode.trim().toUpperCase()}`,
      pickup_postcode: form.pickupPostcode.trim().toUpperCase(),
      pickup_datetime: dateTime(form.pickupDate, form.pickupTime),
      pickup_time_slot: form.pickupTime,
      delivery_location: `${form.deliveryAddress.trim()}, ${form.deliveryPostcode.trim().toUpperCase()}`,
      delivery_postcode: form.deliveryPostcode.trim().toUpperCase(),
      delivery_datetime: dateTime(form.deliveryDate, form.deliveryTime),
      delivery_time_slot: form.deliveryTime,
      collection_contact_name: form.collectionContact || null,
      collection_contact_phone: form.collectionPhone || null,
      delivery_contact_name: form.deliveryContact || null,
      delivery_contact_phone: form.deliveryPhone || null,
      client_name: form.clientName || null,
      client_email: form.clientEmail || null,
      client_phone: form.clientPhone || null,
      customer_reference: form.customerReference || null,
      purchase_order_number: form.purchaseOrder || null,
      booking_reference: form.bookingReference || null,
      vehicle_type: labelToVehicleType(form.vehicle),
      requested_vehicle_label: form.vehicle,
      cargo_type: labelToCargoType(form.cargo),
      requested_cargo_label: form.cargo,
      weight_kg: form.weight ? Number(form.weight) : null,
      pallets: form.pallets ? Number(form.pallets) : null,
      length_cm: form.length ? Number(form.length) : null,
      width_cm: form.width ? Number(form.width) : null,
      height_cm: form.height ? Number(form.height) : null,
      cargo_value_gbp: form.cargoValue ? Number(form.cargoValue) : null,
      budget_amount: form.customerPrice ? Number(form.customerPrice) : null,
      collection_tail_lift_required: form.tailLift,
      collection_forklift_available: form.forklift,
      collection_handball_required: form.handball,
      special_requirements: specialRequirements || null,
      load_details: loadDetails,
      exchange_visibility: publish ? 'exchange' : 'private',
      exchange_posted_at: publish ? new Date().toISOString() : null,
    }]).select('id').single();

    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    setSuccess(publish ? 'Load published to the carrier marketplace.' : 'Draft load saved.');
    const destination = mode === 'broker' ? `/broker/loads?created=${data?.id ?? ''}` : `/customer/loads?created=${data?.id ?? ''}`;
    window.setTimeout(() => router.push(destination), 600);
  };

  return (
    <div style={{ display: 'grid', gap: '0.9rem' }}>
      {error && <AlertBanner tone="danger">{error}</AlertBanner>}
      {success && <AlertBanner tone="success">{success}</AlertBanner>}
      {mode === 'broker' && <Panel title="Customer" description="The customer whose transport request is being managed by the broker."><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '0.75rem' }}><label style={labelStyle}>Customer name<input style={fieldStyle} value={form.clientName} onChange={(event) => set('clientName', event.target.value)} /></label><label style={labelStyle}>Customer email<input style={fieldStyle} type="email" value={form.clientEmail} onChange={(event) => set('clientEmail', event.target.value)} /></label><label style={labelStyle}>Customer phone<input style={fieldStyle} value={form.clientPhone} onChange={(event) => set('clientPhone', event.target.value)} /></label></div></Panel>}
      <Panel title="Collection and delivery" description="Dates, time windows, full addresses and site contacts.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: '0.9rem' }}>
          <div style={{ display: 'grid', gap: '0.65rem' }}><h3 style={{ margin: 0, fontSize: '0.88rem' }}>Collection</h3><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}><label style={labelStyle}>Date *<input style={fieldStyle} type="date" value={form.pickupDate} onChange={(event) => set('pickupDate', event.target.value)} /></label><label style={labelStyle}>Time<input style={fieldStyle} type="time" value={form.pickupTime} onChange={(event) => set('pickupTime', event.target.value)} /></label></div><label style={labelStyle}>Postcode *<input style={fieldStyle} value={form.pickupPostcode} onChange={(event) => set('pickupPostcode', event.target.value)} /></label><label style={labelStyle}>Address *<textarea style={{ ...fieldStyle, minHeight: 84 }} value={form.pickupAddress} onChange={(event) => set('pickupAddress', event.target.value)} /></label><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}><label style={labelStyle}>Contact<input style={fieldStyle} value={form.collectionContact} onChange={(event) => set('collectionContact', event.target.value)} /></label><label style={labelStyle}>Phone<input style={fieldStyle} value={form.collectionPhone} onChange={(event) => set('collectionPhone', event.target.value)} /></label></div></div>
          <div style={{ display: 'grid', gap: '0.65rem' }}><h3 style={{ margin: 0, fontSize: '0.88rem' }}>Delivery</h3><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}><label style={labelStyle}>Date<input style={fieldStyle} type="date" value={form.deliveryDate} onChange={(event) => set('deliveryDate', event.target.value)} /></label><label style={labelStyle}>Time<input style={fieldStyle} type="time" value={form.deliveryTime === 'ASAP' ? '' : form.deliveryTime} onChange={(event) => set('deliveryTime', event.target.value || 'ASAP')} /></label></div><label style={labelStyle}>Postcode *<input style={fieldStyle} value={form.deliveryPostcode} onChange={(event) => set('deliveryPostcode', event.target.value)} /></label><label style={labelStyle}>Address *<textarea style={{ ...fieldStyle, minHeight: 84 }} value={form.deliveryAddress} onChange={(event) => set('deliveryAddress', event.target.value)} /></label><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}><label style={labelStyle}>Contact<input style={fieldStyle} value={form.deliveryContact} onChange={(event) => set('deliveryContact', event.target.value)} /></label><label style={labelStyle}>Phone<input style={fieldStyle} value={form.deliveryPhone} onChange={(event) => set('deliveryPhone', event.target.value)} /></label></div></div>
        </div>
      </Panel>
      <Panel title="Cargo and vehicle" description="Vehicle capability and load dimensions used by carriers when pricing.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: '0.7rem' }}>
          <label style={labelStyle}>Vehicle<select style={fieldStyle} value={form.vehicle} onChange={(event) => set('vehicle', event.target.value)}>{VEHICLES.map((option) => <option key={option}>{option}</option>)}</select></label>
          <label style={labelStyle}>Cargo<select style={fieldStyle} value={form.cargo} onChange={(event) => set('cargo', event.target.value)}>{CARGO.map((option) => <option key={option}>{option}</option>)}</select></label>
          <label style={labelStyle}>Weight (kg)<input style={fieldStyle} type="number" min="0" value={form.weight} onChange={(event) => set('weight', event.target.value)} /></label>
          <label style={labelStyle}>Pallets<input style={fieldStyle} type="number" min="0" value={form.pallets} onChange={(event) => set('pallets', event.target.value)} /></label>
          <label style={labelStyle}>Length (cm)<input style={fieldStyle} type="number" min="0" value={form.length} onChange={(event) => set('length', event.target.value)} /></label>
          <label style={labelStyle}>Width (cm)<input style={fieldStyle} type="number" min="0" value={form.width} onChange={(event) => set('width', event.target.value)} /></label>
          <label style={labelStyle}>Height (cm)<input style={fieldStyle} type="number" min="0" value={form.height} onChange={(event) => set('height', event.target.value)} /></label>
          <label style={labelStyle}>Cargo value (£)<input style={fieldStyle} type="number" min="0" value={form.cargoValue} onChange={(event) => set('cargoValue', event.target.value)} /></label>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.8rem', marginTop: '0.8rem' }}>{[['tailLift','Tail lift'],['forklift','Forklift'],['handball','Handball'],['adr','ADR'],['temperatureControlled','Temperature controlled'],['fragile','Fragile']].map(([key,label]) => <label key={key} style={{ display: 'flex', gap: '0.38rem', alignItems: 'center', fontSize: '0.78rem', fontWeight: 700 }}><input type="checkbox" checked={Boolean(form[key as keyof typeof form])} onChange={(event) => set(key as keyof typeof form, event.target.checked as never)} />{label}</label>)}</div>
      </Panel>
      <Panel title="Commercial references" description={mode === 'broker' ? 'Customer revenue and carrier target cost remain separate so margin is visible.' : 'References and optional target budget for carrier quotes.'}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: '0.7rem' }}><label style={labelStyle}>Customer reference<input style={fieldStyle} value={form.customerReference} onChange={(event) => set('customerReference', event.target.value)} /></label><label style={labelStyle}>PO number<input style={fieldStyle} value={form.purchaseOrder} onChange={(event) => set('purchaseOrder', event.target.value)} /></label><label style={labelStyle}>Booking reference<input style={fieldStyle} value={form.bookingReference} onChange={(event) => set('bookingReference', event.target.value)} /></label><label style={labelStyle}>{mode === 'broker' ? 'Customer price (£)' : 'Budget (£)'}<input style={fieldStyle} type="number" min="0" value={form.customerPrice} onChange={(event) => set('customerPrice', event.target.value)} /></label>{mode === 'broker' && <label style={labelStyle}>Target carrier cost (£)<input style={fieldStyle} type="number" min="0" value={form.targetCarrierCost} onChange={(event) => set('targetCarrierCost', event.target.value)} /></label>}</div><label style={{ ...labelStyle, marginTop: '0.7rem' }}>Operational notes<textarea style={{ ...fieldStyle, minHeight: 90 }} value={form.notes} onChange={(event) => set('notes', event.target.value)} /></label>
      </Panel>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.55rem', flexWrap: 'wrap' }}><ActionButton tone="secondary" disabled={saving} onClick={() => void save(false)}>{saving ? 'Saving…' : 'Save Draft'}</ActionButton><ActionButton tone="warning" disabled={saving} onClick={() => void save(true)}>{saving ? 'Publishing…' : 'Publish Load'}</ActionButton></div>
    </div>
  );
}
