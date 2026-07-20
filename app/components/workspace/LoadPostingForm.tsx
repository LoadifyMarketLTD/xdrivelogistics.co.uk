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
    clientName: '', clientEmail: '', clientPhone: '', pickupDate: '', pickupTime: '08:00', pickupAddress: '', pickupPostcode: '', collectionContact: '', collectionPhone: '', deliveryDate: '', deliveryTime: 'ASAP', deliveryAddress: '', deliveryPostcode: '', deliveryContact: '', deliveryPhone: '', vehicle: 'LWB Van', cargo: 'Pallets', weight: '', pallets: '', length: '', width: '', height: '', cargoValue: '', customerReference: '', purchaseOrder: '', bookingReference: '', customerPrice: '', targetCarrierCost: '', tailLift: false, forklift: false, handball: false, adr: false, temperatureControlled: false, fragile: false, notes: '',
  });
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm(current => ({ ...current, [key]: value }));
  const dateTime = (date: string, time: string) => date ? `${date}T${time === 'ASAP' ? '23:59' : time}:00` : null;

  const save = async (publish: boolean) => {
    setError(''); setSuccess('');
    if (!form.pickupDate || !form.pickupAddress.trim() || !form.pickupPostcode.trim() || !form.deliveryAddress.trim() || !form.deliveryPostcode.trim()) { setError('Collection date, collection address, delivery address and both postcodes are required.'); return; }
    if (!user?.id || !isSupabaseConfigured) { setError('Your session is not ready. Sign in again.'); return; }
    setSaving(true);
    const companyId = await resolveActiveCompanyId({ userId: user.id, fallbackCompanyId: user.companyId ?? null });
    if (!companyId) { setError('This account is not linked to a company.'); setSaving(false); return; }
    const specialRequirements = [form.tailLift && 'Tail lift required', form.forklift && 'Forklift required', form.handball && 'Handball required', form.adr && 'ADR required', form.temperatureControlled && 'Temperature controlled', form.fragile && 'Fragile goods'].filter(Boolean).join(', ');
    const loadDetails = JSON.stringify({ source: mode === 'broker' ? 'broker_workspace_v2' : 'customer_workspace_v2', targetCarrierCost: form.targetCarrierCost ? Number(form.targetCarrierCost) : null, dimensionsCm: { length: form.length || null, width: form.width || null, height: form.height || null }, notes: form.notes || null });
    const { data, error: insertError } = await supabase.from('jobs').insert([{
      company_id: companyId, created_by: user.id, status: publish ? 'posted' : 'draft', current_status: publish ? 'posted' : 'draft',
      pickup_location: `${form.pickupAddress.trim()}, ${form.pickupPostcode.trim().toUpperCase()}`, pickup_postcode: form.pickupPostcode.trim().toUpperCase(), pickup_datetime: dateTime(form.pickupDate, form.pickupTime), pickup_time_slot: form.pickupTime,
      delivery_location: `${form.deliveryAddress.trim()}, ${form.deliveryPostcode.trim().toUpperCase()}`, delivery_postcode: form.deliveryPostcode.trim().toUpperCase(), delivery_datetime: dateTime(form.deliveryDate, form.deliveryTime), delivery_time_slot: form.deliveryTime,
      collection_contact_name: form.collectionContact || null, collection_contact_phone: form.collectionPhone || null, delivery_contact_name: form.deliveryContact || null, delivery_contact_phone: form.deliveryPhone || null,
      client_name: form.clientName || null, client_email: form.clientEmail || null, client_phone: form.clientPhone || null, customer_reference: form.customerReference || null, purchase_order_number: form.purchaseOrder || null, booking_reference: form.bookingReference || null,
      vehicle_type: labelToVehicleType(form.vehicle), requested_vehicle_label: form.vehicle, cargo_type: labelToCargoType(form.cargo), requested_cargo_label: form.cargo,
      weight_kg: form.weight ? Number(form.weight) : null, pallets: form.pallets ? Number(form.pallets) : null, length_cm: form.length ? Number(form.length) : null, width_cm: form.width ? Number(form.width) : null, height_cm: form.height ? Number(form.height) : null, cargo_value_gbp: form.cargoValue ? Number(form.cargoValue) : null, budget_amount: form.customerPrice ? Number(form.customerPrice) : null,
      collection_tail_lift_required: form.tailLift, collection_forklift_available: form.forklift, collection_handball_required: form.handball, special_requirements: specialRequirements || null, load_details: loadDetails, exchange_visibility: publish ? 'exchange' : 'private', exchange_posted_at: publish ? new Date().toISOString() : null,
    }]).select('id').single();
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    setSuccess(publish ? 'Load published to the carrier marketplace.' : 'Draft load saved.');
    window.setTimeout(() => router.push(mode === 'broker' ? `/broker/loads?created=${data?.id ?? ''}` : `/customer/loads?created=${data?.id ?? ''}`), 600);
  };

  const fields = (items: Array<[keyof typeof form, string, string?]>) => <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: '0.7rem' }}>{items.map(([key, label, type]) => <label key={key} style={labelStyle}>{label}<input style={fieldStyle} type={type ?? 'text'} value={String(form[key])} onChange={event => set(key, event.target.value as never)} /></label>)}</div>;
  return <div style={{ display: 'grid', gap: '0.9rem' }}>
    {error && <AlertBanner tone="danger">{error}</AlertBanner>}{success && <AlertBanner tone="success">{success}</AlertBanner>}
    {mode === 'broker' && <Panel title="Customer" description="The customer whose transport request is being managed by the broker.">{fields([['clientName','Customer name'],['clientEmail','Customer email','email'],['clientPhone','Customer phone']])}</Panel>}
    <Panel title="Collection and delivery" description="Dates, time windows, full addresses and site contacts."><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '1rem' }}>
      <div style={{ display: 'grid', gap: '0.65rem' }}><h3 style={{ margin: 0, fontSize: '0.88rem' }}>Collection</h3>{fields([['pickupDate','Date *','date'],['pickupTime','Time','time'],['pickupPostcode','Postcode *'],['collectionContact','Contact'],['collectionPhone','Phone']])}<label style={labelStyle}>Address *<textarea style={{...fieldStyle,minHeight:84}} value={form.pickupAddress} onChange={event=>set('pickupAddress',event.target.value)}/></label></div>
      <div style={{ display: 'grid', gap: '0.65rem' }}><h3 style={{ margin: 0, fontSize: '0.88rem' }}>Delivery</h3>{fields([['deliveryDate','Date','date'],['deliveryTime','Time','time'],['deliveryPostcode','Postcode *'],['deliveryContact','Contact'],['deliveryPhone','Phone']])}<label style={labelStyle}>Address *<textarea style={{...fieldStyle,minHeight:84}} value={form.deliveryAddress} onChange={event=>set('deliveryAddress',event.target.value)}/></label></div>
    </div></Panel>
    <Panel title="Cargo and vehicle" description="Vehicle capability and load dimensions used by carriers when pricing."><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: '0.7rem' }}>
      <label style={labelStyle}>Vehicle<select style={fieldStyle} value={form.vehicle} onChange={event=>set('vehicle',event.target.value)}>{VEHICLES.map(option=><option key={option}>{option}</option>)}</select></label>
      <label style={labelStyle}>Cargo<select style={fieldStyle} value={form.cargo} onChange={event=>set('cargo',event.target.value)}>{CARGO.map(option=><option key={option}>{option}</option>)}</select></label>
      {fields([['weight','Weight (kg)','number'],['pallets','Pallets','number'],['length','Length (cm)','number'],['width','Width (cm)','number'],['height','Height (cm)','number'],['cargoValue','Cargo value (£)','number']])}
    </div><div style={{display:'flex',flexWrap:'wrap',gap:'0.8rem',marginTop:'0.8rem'}}>{([['tailLift','Tail lift'],['forklift','Forklift'],['handball','Handball'],['adr','ADR'],['temperatureControlled','Temperature controlled'],['fragile','Fragile']] as const).map(([key,label])=><label key={key} style={{display:'flex',gap:'0.38rem',alignItems:'center',fontSize:'0.78rem',fontWeight:700}}><input type="checkbox" checked={form[key]} onChange={event=>set(key,event.target.checked)}/>{label}</label>)}</div></Panel>
    <Panel title="Commercial references" description={mode === 'broker' ? 'Customer revenue and carrier target cost remain separate so margin is visible.' : 'References and optional target budget for carrier quotes.'}>{fields([['customerReference','Customer reference'],['purchaseOrder','PO number'],['bookingReference','Booking reference'],['customerPrice',mode === 'broker' ? 'Customer price (£)' : 'Budget (£)','number'],...(mode === 'broker' ? [['targetCarrierCost','Target carrier cost (£)','number'] as [keyof typeof form,string,string]] : [])])}<label style={{...labelStyle,marginTop:'0.7rem'}}>Operational notes<textarea style={{...fieldStyle,minHeight:90}} value={form.notes} onChange={event=>set('notes',event.target.value)}/></label></Panel>
    <div style={{display:'flex',justifyContent:'flex-end',gap:'0.55rem',flexWrap:'wrap'}}><ActionButton tone="secondary" disabled={saving} onClick={()=>void save(false)}>{saving?'Saving…':'Save Draft'}</ActionButton><ActionButton tone="warning" disabled={saving} onClick={()=>void save(true)}>{saving?'Publishing…':'Publish Load'}</ActionButton></div>
  </div>;
}
