'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../AuthContext';
import { resolveActiveCompanyId } from '../../../lib/activeCompany';
import { isSupabaseConfigured, supabase } from '../../../lib/supabaseClient';
import { ActionButton, AlertBanner, Panel } from './WorkspaceUI';
import PostcodeAddressField from './PostcodeAddressField';

const VEHICLES = ['Small Van', 'SWB Van', 'MWB Van', 'LWB Van', 'XLWB Van', 'Luton', 'Luton Tail Lift', 'Curtainside Van', '3.5T', '5T', '7.5T', '12T', '18T', '26T', 'Artic 44T Curtainsider', 'Artic 44T Box Trailer', 'Artic 44T Flatbed', 'Artic 44T Refrigerated', 'Hiab', 'Moffett', 'ADR Vehicle', 'Refrigerated Vehicle'];
const CARGO = ['Documents', 'Parcels', 'Pallets', 'Machinery', 'Furniture', 'Retail Goods', 'Mixed Freight', 'ADR Goods', 'Temperature Controlled Freight', 'Other'];
const HALF_HOUR_SLOTS = Array.from({ length: 48 }, (_, index) => {
  const totalMinutes = index * 30;
  const hours = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
  const minutes = (totalMinutes % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
});

const fieldStyle = { width: '100%', minHeight: '32px', border: '1px solid #cfd7e3', borderRadius: '4px', padding: '0 8px', fontSize: '12px', boxSizing: 'border-box' as const, background: '#fff', color: '#172033' };
const textareaStyle = { ...fieldStyle, minHeight: '72px', padding: '7px 8px', resize: 'vertical' as const };
const labelStyle = { display: 'grid', gap: '4px', color: '#334155', fontSize: '11px', lineHeight: '14px', fontWeight: 700 };
const readOnlyStyle = { ...fieldStyle, display: 'flex', alignItems: 'center', background: '#f8fafc', color: '#334155' };
const microButtonStyle = { minHeight: '26px', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0 7px', background: '#fff', color: '#334155', fontSize: '11px', fontWeight: 700, cursor: 'pointer' };
const invalidFieldStyle = { border: '1px solid #dc2626', background: '#fffafa', boxShadow: '0 0 0 1px rgba(220,38,38,0.12)' };
const validationMessageStyle = { color: '#b91c1c', fontSize: '10px', lineHeight: '13px', fontWeight: 700 };

const numberOrNull = (value: string) => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const normalizePostcode = (value: string) => {
  const compact = value.toUpperCase().replace(/\s+/g, ' ').trim().replace(/\s/g, '');
  return compact.length > 3 ? `${compact.slice(0, -3)} ${compact.slice(-3)}` : compact;
};

const isFullUkPostcode = (value: string) => /^(GIR 0AA|(?:[A-Z]{1,2}\d[A-Z\d]?|[A-Z]{1,2}\d{1,2}) \d[A-Z]{2})$/i.test(normalizePostcode(value));
const xdriveReference = (jobId: string) => `XDL-${jobId.slice(0, 8).toUpperCase()}`;
const localDateKey = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
const halfHourSlotMinutes = (value: string) => {
  const match = /^(\d{2}):(00|30)$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours <= 23 ? hours * 60 + minutes : null;
};
const availableHalfHourSlots = (date: string, now: Date | null) => {
  if (!date || !now) return HALF_HOUR_SLOTS;
  const today = localDateKey(now);
  if (date < today) return [];
  if (date > today) return HALF_HOUR_SLOTS;
  const currentSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  return HALF_HOUR_SLOTS.filter((slot) => {
    const minutes = halfHourSlotMinutes(slot);
    return minutes != null && minutes * 60 > currentSeconds;
  });
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

type StopFieldErrors = {
  date?: string;
  time?: string;
  postcode?: string;
  address?: string;
};

const createAdditionalStop = (): AdditionalStop => ({
  id: crypto.randomUUID(),
  type: 'delivery',
  date: '',
  time: '',
  postcode: '',
  address: '',
  contact: '',
  phone: '',
  instructions: '',
});

const validateStop = ({
  date,
  time,
  postcode,
  address,
  requireDate = false,
  requireTime = false,
  minimumDate,
  now,
}: {
  date: string;
  time: string;
  postcode: string;
  address: string;
  requireDate?: boolean;
  requireTime?: boolean;
  minimumDate?: string;
  now: Date | null;
}): StopFieldErrors => {
  const today = now ? localDateKey(now) : '';
  const dateIsRequired = requireDate || Boolean(time);
  const timeIsRequired = requireTime || Boolean(date);
  let dateError: string | undefined;
  if (dateIsRequired && !date) dateError = 'Required';
  else if (date && today && date < today) dateError = 'Choose today or a future date';
  else if (date && minimumDate && date < minimumDate) dateError = 'Choose the collection date or later';

  let timeError: string | undefined;
  if (timeIsRequired && !time) timeError = 'Required';
  else if (time) {
    const minutes = halfHourSlotMinutes(time);
    if (minutes == null) timeError = 'Use a 30-minute time slot';
    else if (date && now && date === today) {
      const currentSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
      if (minutes * 60 <= currentSeconds) timeError = 'Choose a future 30-minute slot';
    }
  }

  return {
    date: dateError,
    time: timeError,
    postcode: !postcode.trim() ? 'Required' : !isFullUkPostcode(postcode) ? 'Enter a full UK postcode' : undefined,
    address: !address.trim() ? 'Required' : undefined,
  };
};

const hasStopErrors = (errors: StopFieldErrors) => Boolean(errors.date || errors.time || errors.postcode || errors.address);

const dimensionError = (value: string) => {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 'Enter a valid dimension in cm';
  if (parsed > 2000) return 'Check this value — it exceeds 2,000 cm';
  return undefined;
};

export default function LoadPostingForm({ mode }: { mode: 'broker' | 'customer' }) {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const directCarrierId = searchParams.get('directCarrier');
  const idempotencyKeyRef = useRef<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showValidation, setShowValidation] = useState(false);
  const [clockNow, setClockNow] = useState<Date | null>(null);
  const [postingCompany, setPostingCompany] = useState<{ id: string; name: string | null; memberId: string | null } | null>(null);
  const [directCarrier, setDirectCarrier] = useState<{ id: string; name: string; memberId: string | null } | null>(null);
  const [directCarrierError, setDirectCarrierError] = useState('');
  const [additionalStops, setAdditionalStops] = useState<AdditionalStop[]>([]);
  const [form, setForm] = useState({
    clientName: '', clientEmail: '', clientPhone: '',
    pickupDate: '', pickupTime: '', pickupAddress: '', pickupPostcode: '', collectionContact: '', collectionPhone: '',
    deliveryDate: '', deliveryTime: '', deliveryAddress: '', deliveryPostcode: '', deliveryContact: '', deliveryPhone: '',
    vehicle: 'LWB Van', cargo: 'Pallets', weight: '', pallets: '', length: '', width: '', height: '', cargoValue: '',
    customerReference: '', purchaseOrder: '', bookingReference: '', customerPrice: '', targetCarrierCost: '',
    tailLift: false, forklift: false, handball: false, adr: false, temperatureControlled: false, fragile: false,
    publicQuoteNotes: '',
    executionInstructions: '',
  });

  useEffect(() => {
    const refreshClock = () => setClockNow(new Date());
    refreshClock();
    const timer = window.setInterval(refreshClock, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const resolvePostingIdentity = async () => {
      if (!user?.id || !isSupabaseConfigured) return;
      const companyId = await resolveActiveCompanyId({ userId: user.id, fallbackCompanyId: user.companyId ?? null });
      if (!companyId || cancelled) return;
      const { data } = await supabase
        .from('companies')
        .select('id, name, company_number')
        .eq('id', companyId)
        .maybeSingle();
      if (!cancelled) {
        setPostingCompany({
          id: companyId,
          name: typeof data?.name === 'string' ? data.name : null,
          memberId: typeof data?.company_number === 'string' ? data.company_number : null,
        });
      }
    };
    void resolvePostingIdentity();
    return () => { cancelled = true; };
  }, [user?.companyId, user?.id]);

  useEffect(() => {
    let cancelled = false;
    const resolveDirectCarrier = async () => {
      setDirectCarrier(null);
      setDirectCarrierError('');
      if (!directCarrierId || !isSupabaseConfigured) return;
      const { data, error: carrierError } = await supabase
        .from('companies')
        .select('id, name, company_number, status')
        .eq('id', directCarrierId)
        .maybeSingle();
      if (cancelled) return;
      if (carrierError || !data || String(data.status ?? '').toLowerCase() !== 'active') {
        setDirectCarrierError('The selected carrier is not currently available for Direct Booking. Return to Directory and choose another active member.');
        return;
      }
      setDirectCarrier({
        id: String(data.id),
        name: String(data.name ?? 'Carrier'),
        memberId: typeof data.company_number === 'string' ? data.company_number : null,
      });
    };
    void resolveDirectCarrier();
    return () => { cancelled = true; };
  }, [directCarrierId]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((current) => ({ ...current, [key]: value }));
  const setVehicle = (value: string) => setForm((current) => ({
    ...current,
    vehicle: value,
    tailLift: value === 'Luton Tail Lift' ? true : current.tailLift,
    adr: value === 'ADR Vehicle' ? true : current.adr,
    temperatureControlled: value === 'Refrigerated Vehicle' || value === 'Artic 44T Refrigerated'
      ? true
      : current.temperatureControlled,
  }));
  const addAdditionalStop = () => setAdditionalStops((current) => current.length >= 8 ? current : [...current, createAdditionalStop()]);
  const updateAdditionalStop = (id: string, patch: Partial<AdditionalStop>) => setAdditionalStops((current) =>
    current.map((stop) => stop.id === id ? { ...stop, ...patch } : stop),
  );
  const removeAdditionalStop = (id: string) => setAdditionalStops((current) => current.filter((stop) => stop.id !== id));
  const moveAdditionalStop = (id: string, delta: -1 | 1) => setAdditionalStops((current) => {
    const index = current.findIndex((stop) => stop.id === id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= current.length) return current;
    const next = [...current];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });
  const dateTime = (date: string, time: string) => date && time ? `${date}T${time}:00` : null;
  const todayKey = clockNow ? localDateKey(clockNow) : '';
  const minimumRouteDate = form.pickupDate && (!todayKey || form.pickupDate > todayKey) ? form.pickupDate : todayKey;

  const collectionErrors = validateStop({
    date: form.pickupDate,
    time: form.pickupTime,
    postcode: form.pickupPostcode,
    address: form.pickupAddress,
    requireDate: true,
    requireTime: true,
    minimumDate: todayKey || undefined,
    now: clockNow,
  });
  const deliveryErrors = validateStop({
    date: form.deliveryDate,
    time: form.deliveryTime,
    postcode: form.deliveryPostcode,
    address: form.deliveryAddress,
    minimumDate: minimumRouteDate || undefined,
    now: clockNow,
  });
  const additionalStopErrors = additionalStops.map((stop) => validateStop({
    date: stop.date,
    time: stop.time,
    postcode: stop.postcode,
    address: stop.address,
    minimumDate: minimumRouteDate || undefined,
    now: clockNow,
  }));
  const hasRequiredErrors = hasStopErrors(collectionErrors) || hasStopErrors(deliveryErrors) || additionalStopErrors.some(hasStopErrors);

  const dimensionErrors = {
    length: dimensionError(form.length),
    width: dimensionError(form.width),
    height: dimensionError(form.height),
  };
  const hasDimensionErrors = Boolean(dimensionErrors.length || dimensionErrors.width || dimensionErrors.height);
  const dimensionsCm = [form.length, form.width, form.height].map(numberOrNull);
  const hasDimensionValues = dimensionsCm.some((value) => value != null);
  const dimensionSummary = hasDimensionValues
    ? `${dimensionsCm.map((value) => value == null ? '—' : value.toLocaleString('en-GB', { maximumFractionDigits: 1 })).join(' × ')} cm`
    : 'Enter dimensions in centimetres (cm)';

  const focusFirstInvalidField = () => {
    window.setTimeout(() => {
      const field = document.querySelector<HTMLElement>('[aria-invalid="true"]');
      field?.focus();
      field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);
  };

  const save = async (publish: boolean) => {
    setError('');
    setSuccess('');
    setShowValidation(true);

    if (hasRequiredErrors || hasDimensionErrors) {
      setError('Load details are incomplete or invalid. Complete the fields highlighted in red.');
      focusFirstInvalidField();
      return;
    }
    if (!user?.id || !isSupabaseConfigured) {
      setError('Your session is not ready. Sign in again.');
      return;
    }
    if (publish && directCarrierId && !directCarrier) {
      setError(directCarrierError || 'The Direct Booking carrier could not be verified. Return to Directory and choose the member again.');
      return;
    }

    const pickupPostcode = normalizePostcode(form.pickupPostcode);
    const deliveryPostcode = normalizePostcode(form.deliveryPostcode);

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
          directInviteCompanyId: publish ? directCarrier?.id ?? null : null,
          clientName: form.clientName || null,
          clientEmail: form.clientEmail || '',
          clientPhone: form.clientPhone || null,
          pickupDateTime: dateTime(form.pickupDate, form.pickupTime),
          pickupTimeSlot: form.pickupTime,
          pickupAddress: form.pickupAddress.trim(),
          pickupPostcode,
          collectionContact: form.collectionContact || null,
          collectionPhone: form.collectionPhone || null,
          deliveryDateTime: dateTime(form.deliveryDate, form.deliveryTime),
          deliveryTimeSlot: form.deliveryTime,
          deliveryAddress: form.deliveryAddress.trim(),
          deliveryPostcode,
          deliveryContact: form.deliveryContact || null,
          deliveryPhone: form.deliveryPhone || null,
          additionalStops: additionalStops.map((stop) => ({
            type: stop.type,
            address: stop.address.trim(),
            postcode: normalizePostcode(stop.postcode),
            contact: stop.contact || null,
            phone: stop.phone || null,
            dateTime: dateTime(stop.date, stop.time),
            instructions: stop.instructions || null,
          })),
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
          publicQuoteNotes: form.publicQuoteNotes || null,
          executionInstructions: form.executionInstructions || null,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        referenceId?: string;
        job?: { id: string };
        replayed?: boolean;
      } | null;
      if (!response.ok || !payload?.job?.id) {
        const baseMessage = payload?.error ?? 'The load could not be saved.';
        throw new Error(payload?.referenceId ? `${baseMessage} Error reference: ${payload.referenceId}.` : baseMessage);
      }

      const reference = xdriveReference(payload.job.id);
      setShowValidation(false);
      setSuccess(
        publish
          ? directCarrier
            ? `Load ${reference} sent directly to ${directCarrier.name}.`
            : `Load ${reference} published to the carrier marketplace.`
          : `Draft load ${reference} saved.`,
      );
      const destination = mode === 'broker'
        ? `/broker/loads?created=${payload.job.id}`
        : `/customer/loads?created=${payload.job.id}`;
      idempotencyKeyRef.current = null;
      window.setTimeout(() => router.push(destination), 650);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The load could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: '12px' }}>
      {error && <AlertBanner tone="danger">{error}</AlertBanner>}
      {success && <AlertBanner tone="success">{success}</AlertBanner>}

      <Panel title="Posting identity & XDrive references" description="Platform ownership and the XDrive load reference are automatic. Customer-owned references remain optional inputs below.">
        <div style={gridStyle}>
          <label style={labelStyle}>Posting member<div style={readOnlyStyle}>{postingCompany?.name ?? 'Signed-in company'}</div></label>
          <label style={labelStyle}>Company number<div style={readOnlyStyle}>{postingCompany?.memberId ?? 'Resolved automatically from company record'}</div></label>
          <label style={labelStyle}>XDrive load reference<div style={readOnlyStyle}>Generated automatically after save / publish</div></label>
        </div>
      </Panel>

      {directCarrierId && (
        <Panel
          title="Direct Booking"
          description="This load will be visible only to the selected carrier before award. It will not be broadcast to the public XDrive Exchange."
        >
          {directCarrierError ? (
            <AlertBanner tone="danger">{directCarrierError}</AlertBanner>
          ) : directCarrier ? (
            <div style={gridStyle}>
              <label style={labelStyle}>Selected carrier<div style={readOnlyStyle}>{directCarrier.name}</div></label>
              <label style={labelStyle}>Company number<div style={readOnlyStyle}>{directCarrier.memberId ?? 'Not supplied'}</div></label>
              <label style={labelStyle}>Visibility<div style={readOnlyStyle}>Direct invite only</div></label>
            </div>
          ) : (
            <div style={{ color: '#64748b', fontSize: '11px' }}>Verifying selected carrier…</div>
          )}
        </Panel>
      )}

      {mode === 'broker' && (
        <Panel title="Customer" description="The customer whose transport request is being managed by the broker.">
          <div style={gridStyle}>
            <label style={labelStyle}>Customer name<input style={fieldStyle} value={form.clientName} onChange={(event) => set('clientName', event.target.value)} /></label>
            <label style={labelStyle}>Customer email<input style={fieldStyle} type="email" value={form.clientEmail} onChange={(event) => set('clientEmail', event.target.value)} /></label>
            <label style={labelStyle}>Customer phone<input style={fieldStyle} value={form.clientPhone} onChange={(event) => set('clientPhone', event.target.value)} /></label>
          </div>
        </Panel>
      )}

      <Panel title="Collection and delivery" description="Full execution addresses and site contacts are stored for the awarded job; Marketplace shows only broad route areas before award.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: '12px' }}>
          <StopFields
            title="Collection"
            date={form.pickupDate}
            time={form.pickupTime}
            postcode={form.pickupPostcode}
            address={form.pickupAddress}
            contact={form.collectionContact}
            phone={form.collectionPhone}
            onDate={(value) => setForm((current) => ({
              ...current,
              pickupDate: value,
              pickupTime: availableHalfHourSlots(value, clockNow).includes(current.pickupTime) ? current.pickupTime : '',
            }))}
            onTime={(value) => set('pickupTime', value)}
            onPostcode={(value) => set('pickupPostcode', value.toUpperCase())}
            onAddress={(value) => set('pickupAddress', value)}
            onContact={(value) => set('collectionContact', value)}
            onPhone={(value) => set('collectionPhone', value)}
            requiredDate
            requiredTime
            minDate={todayKey || undefined}
            now={clockNow}
            errors={showValidation ? collectionErrors : undefined}
          />
          <StopFields
            title="Delivery"
            date={form.deliveryDate}
            time={form.deliveryTime}
            postcode={form.deliveryPostcode}
            address={form.deliveryAddress}
            contact={form.deliveryContact}
            phone={form.deliveryPhone}
            onDate={(value) => setForm((current) => ({
              ...current,
              deliveryDate: value,
              deliveryTime: availableHalfHourSlots(value, clockNow).includes(current.deliveryTime) ? current.deliveryTime : '',
            }))}
            onTime={(value) => set('deliveryTime', value)}
            onPostcode={(value) => set('deliveryPostcode', value.toUpperCase())}
            onAddress={(value) => set('deliveryAddress', value)}
            onContact={(value) => set('deliveryContact', value)}
            onPhone={(value) => set('deliveryPhone', value)}
            minDate={minimumRouteDate || undefined}
            now={clockNow}
            errors={showValidation ? deliveryErrors : undefined}
          />
        </div>

        <div style={{ display: 'grid', gap: '8px', borderTop: '1px solid #e2e8f0', marginTop: '12px', paddingTop: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#172033' }}>Additional stops</div>
              <div style={{ fontSize: '11px', lineHeight: '16px', color: '#64748b' }}>Optional collection or delivery stops are executed in this order between the main collection and final delivery. Exact stop details stay private before award.</div>
            </div>
            <ActionButton tone="secondary" disabled={saving || additionalStops.length >= 8} onClick={addAdditionalStop}>
              {additionalStops.length >= 8 ? 'Maximum 8 stops' : 'Add stop'}
            </ActionButton>
          </div>

          {additionalStops.length === 0 ? (
            <div style={{ fontSize: '11px', color: '#64748b' }}>No additional stops. This booking remains a standard collection → delivery job.</div>
          ) : (
            <div style={{ display: 'grid', gap: '10px' }}>
              {additionalStops.map((stop, index) => {
                const stopErrors = showValidation ? additionalStopErrors[index] : undefined;
                const stopInvalid = Boolean(stopErrors && hasStopErrors(stopErrors));
                return (
                  <div key={stop.id} style={{ display: 'grid', gap: '8px', border: `1px solid ${stopInvalid ? '#dc2626' : '#dbe3ee'}`, borderRadius: '4px', padding: '10px', background: stopInvalid ? '#fffafa' : '#fbfdff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: stopInvalid ? '#b91c1c' : '#172033' }}>Stop {index + 2}{stopInvalid ? ' · check required fields' : ''}</div>
                      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                        <button type="button" style={{ ...microButtonStyle, opacity: index === 0 ? 0.45 : 1 }} disabled={index === 0 || saving} onClick={() => moveAdditionalStop(stop.id, -1)}>Move up</button>
                        <button type="button" style={{ ...microButtonStyle, opacity: index === additionalStops.length - 1 ? 0.45 : 1 }} disabled={index === additionalStops.length - 1 || saving} onClick={() => moveAdditionalStop(stop.id, 1)}>Move down</button>
                        <button type="button" style={microButtonStyle} disabled={saving} onClick={() => removeAdditionalStop(stop.id)}>Remove</button>
                      </div>
                    </div>
                    <label style={labelStyle}>Stop type
                      <select style={fieldStyle} value={stop.type} onChange={(event) => updateAdditionalStop(stop.id, { type: event.target.value as AdditionalStop['type'] })}>
                        <option value="collection">Collection</option>
                        <option value="delivery">Delivery</option>
                      </select>
                    </label>
                    <StopFields
                      title={stop.type === 'collection' ? 'Collection stop' : 'Delivery stop'}
                      date={stop.date}
                      time={stop.time}
                      postcode={stop.postcode}
                      address={stop.address}
                      contact={stop.contact}
                      phone={stop.phone}
                      onDate={(value) => updateAdditionalStop(stop.id, {
                        date: value,
                        time: availableHalfHourSlots(value, clockNow).includes(stop.time) ? stop.time : '',
                      })}
                      onTime={(value) => updateAdditionalStop(stop.id, { time: value })}
                      onPostcode={(value) => updateAdditionalStop(stop.id, { postcode: value.toUpperCase() })}
                      onAddress={(value) => updateAdditionalStop(stop.id, { address: value })}
                      onContact={(value) => updateAdditionalStop(stop.id, { contact: value })}
                      onPhone={(value) => updateAdditionalStop(stop.id, { phone: value })}
                      minDate={minimumRouteDate || undefined}
                      now={clockNow}
                      errors={stopErrors}
                    />
                    <label style={labelStyle}>Private stop instructions
                      <textarea style={textareaStyle} value={stop.instructions} onChange={(event) => updateAdditionalStop(stop.id, { instructions: event.target.value })} placeholder="Loading bay, access or stop-specific execution instructions. Hidden before award." />
                    </label>
                  </div>
                );
              })}
              <div style={{ fontSize: '11px', color: '#64748b' }}>Final delivery will be stop {additionalStops.length + 2}. Reorder the additional stops above to change the execution sequence.</div>
            </div>
          )}
        </div>
      </Panel>

      <Panel title="Cargo and vehicle" description="Vehicle capability and load dimensions used by carriers when pricing.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: '8px' }}>
          <label style={labelStyle}>Vehicle<select style={fieldStyle} value={form.vehicle} onChange={(event) => setVehicle(event.target.value)}>{VEHICLES.map((option) => <option key={option}>{option}</option>)}</select></label>
          <label style={labelStyle}>Cargo<select style={fieldStyle} value={form.cargo} onChange={(event) => set('cargo', event.target.value)}>{CARGO.map((option) => <option key={option}>{option}</option>)}</select></label>
          {([['weight', 'Weight (kg)'], ['pallets', 'Pallets'], ['length', 'Length (cm)'], ['width', 'Width (cm)'], ['height', 'Height (cm)'], ['cargoValue', 'Cargo value (£)']] as const).map(([key, label]) => {
            const dimensionKey = key === 'length' || key === 'width' || key === 'height';
            const validationError = dimensionKey && showValidation ? dimensionErrors[key] : undefined;
            return (
              <label key={key} style={labelStyle}>{label}
                <input
                  style={{ ...fieldStyle, ...(validationError ? invalidFieldStyle : {}) }}
                  aria-invalid={validationError ? 'true' : undefined}
                  type="number"
                  min="0"
                  step={dimensionKey ? '1' : undefined}
                  value={form[key]}
                  placeholder={key === 'length' ? 'e.g. 400' : key === 'width' ? 'e.g. 185' : key === 'height' ? 'e.g. 200' : undefined}
                  onChange={(event) => set(key, event.target.value)}
                />
                {validationError ? <span style={validationMessageStyle}>{validationError}</span> : null}
              </label>
            );
          })}
        </div>
        <div style={{ marginTop: '6px', fontSize: '11px', color: hasDimensionErrors && showValidation ? '#b91c1c' : '#64748b', fontWeight: hasDimensionErrors && showValidation ? 700 : 500 }}>
          {dimensionSummary}. Dimensions are entered and stored in centimetres (cm).
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '8px' }}>
          {([['tailLift', 'Tail lift required'], ['forklift', 'Forklift available at collection'], ['handball', 'Handball required'], ['adr', 'ADR load'], ['temperatureControlled', 'Temperature controlled'], ['fragile', 'Fragile goods']] as const).map(([key, label]) => (
            <label key={key} style={{ display: 'flex', gap: '5px', alignItems: 'center', fontSize: '11px', fontWeight: 700 }}>
              <input type="checkbox" checked={form[key]} onChange={(event) => set(key, event.target.checked)} />{label}
            </label>
          ))}
        </div>
      </Panel>

      <Panel title="Commercial references" description={mode === 'broker' ? 'Customer revenue and carrier target cost remain internal commercial fields; customer-owned references remain hidden from the pre-award Marketplace.' : 'Customer-owned references and budget remain part of the job record; private references are not exposed pre-award.'}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: '8px' }}>
          <label style={labelStyle}>Customer reference<input style={fieldStyle} value={form.customerReference} onChange={(event) => set('customerReference', event.target.value)} /></label>
          <label style={labelStyle}>PO number<input style={fieldStyle} value={form.purchaseOrder} onChange={(event) => set('purchaseOrder', event.target.value)} /></label>
          <label style={labelStyle}>Customer booking reference (optional)<input style={fieldStyle} value={form.bookingReference} onChange={(event) => set('bookingReference', event.target.value)} /></label>
          <label style={labelStyle}>{mode === 'broker' ? 'Customer price (£)' : 'Budget (£)'}<input style={fieldStyle} type="number" min="0" value={form.customerPrice} onChange={(event) => set('customerPrice', event.target.value)} /></label>
          {mode === 'broker' && <label style={labelStyle}>Target carrier cost (£)<input style={fieldStyle} type="number" min="0" value={form.targetCarrierCost} onChange={(event) => set('targetCarrierCost', event.target.value)} /></label>}
        </div>
        <div style={{ marginTop: '6px', color: '#64748b', fontSize: '10px', lineHeight: '14px', fontWeight: 500 }}>
          Customer booking reference is optional and remains an external/customer reference. XDrive generates its own load reference automatically.
        </div>
      </Panel>

      <Panel title="Marketplace notes & execution instructions" description="Keep quote-visible information separate from the exact instructions released after award.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '12px' }}>
          <label style={labelStyle}>
            Public quote notes
            <textarea
              style={textareaStyle}
              value={form.publicQuoteNotes}
              onChange={(event) => set('publicQuoteNotes', event.target.value)}
              placeholder="Visible before award: pricing-relevant information only, e.g. timed collection, 1 pallet, assistance unavailable. Do not put gate codes, contact names or exact access instructions here."
            />
            <span style={{ color: '#64748b', fontWeight: 500 }}>Visible to eligible Marketplace users before they quote.</span>
          </label>
          <label style={labelStyle}>
            Private execution instructions
            <textarea
              style={textareaStyle}
              value={form.executionInstructions}
              onChange={(event) => set('executionInstructions', event.target.value)}
              placeholder="Released only after authorised award/allocation: gate codes, loading-bay instructions, site-specific notes and other execution detail."
            />
            <span style={{ color: '#64748b', fontWeight: 500 }}>Hidden from the pre-award Marketplace and available to authorised execution users.</span>
          </label>
        </div>
      </Panel>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
        <ActionButton tone="secondary" disabled={saving} onClick={() => void save(false)}>{saving ? 'Saving…' : 'Save Draft'}</ActionButton>
        <ActionButton tone="warning" disabled={saving || Boolean(directCarrierId && !directCarrier)} onClick={() => void save(true)}>
          {saving ? 'Publishing…' : directCarrierId ? 'Send Direct Booking' : 'Publish Load'}
        </ActionButton>
      </div>
    </div>
  );
}

function StopFields({
  title,
  date,
  time,
  postcode,
  address,
  contact,
  phone,
  onDate,
  onTime,
  onPostcode,
  onAddress,
  onContact,
  onPhone,
  requiredDate = false,
  requiredTime = false,
  minDate,
  now,
  errors,
}: {
  title: string;
  date: string;
  time: string;
  postcode: string;
  address: string;
  contact: string;
  phone: string;
  onDate: (value: string) => void;
  onTime: (value: string) => void;
  onPostcode: (value: string) => void;
  onAddress: (value: string) => void;
  onContact: (value: string) => void;
  onPhone: (value: string) => void;
  requiredDate?: boolean;
  requiredTime?: boolean;
  minDate?: string;
  now: Date | null;
  errors?: StopFieldErrors;
}) {
  const timeOptions = availableHalfHourSlots(date, now);
  const selectedTimeUnavailable = Boolean(time && !timeOptions.includes(time));
  const noSlotsLeftToday = Boolean(date && now && date === localDateKey(now) && timeOptions.length === 0);

  return (
    <div style={{ display: 'grid', gap: '8px' }}>
      <h3 style={{ margin: 0, fontSize: '13px', lineHeight: '18px', fontWeight: 600, color: hasStopErrors(errors ?? {}) ? '#b91c1c' : undefined }}>{title}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <label style={labelStyle}>Date{requiredDate ? ' *' : ''}
          <input
            style={{ ...fieldStyle, ...(errors?.date ? invalidFieldStyle : {}) }}
            aria-invalid={errors?.date ? 'true' : undefined}
            type="date"
            min={minDate}
            value={date}
            onChange={(event) => onDate(event.target.value)}
          />
          {errors?.date ? <span style={validationMessageStyle}>{errors.date}</span> : null}
        </label>
        <label style={labelStyle}>Time{requiredTime || date ? ' *' : ''}
          <select
            style={{ ...fieldStyle, ...(errors?.time ? invalidFieldStyle : {}) }}
            aria-invalid={errors?.time ? 'true' : undefined}
            value={time}
            disabled={!date || noSlotsLeftToday}
            onChange={(event) => onTime(event.target.value)}
          >
            <option value="">{!date ? 'Select date first' : noSlotsLeftToday ? 'No slots left today' : 'Select time'}</option>
            {selectedTimeUnavailable ? <option value={time} disabled>{time} — no longer available</option> : null}
            {timeOptions.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
          </select>
          {errors?.time ? <span style={validationMessageStyle}>{errors.time}</span> : null}
          {!errors?.time && noSlotsLeftToday ? <span style={{ color: '#64748b', fontSize: '10px', lineHeight: '13px', fontWeight: 500 }}>No future times remain today — choose tomorrow.</span> : null}
        </label>
      </div>
      <label style={labelStyle}>Postcode *
        <input style={{ ...fieldStyle, ...(errors?.postcode ? invalidFieldStyle : {}) }} aria-invalid={errors?.postcode ? 'true' : undefined} autoCapitalize="characters" value={postcode} placeholder="e.g. BB1 1AA" onChange={(event) => onPostcode(event.target.value)} />
        {errors?.postcode ? <span style={validationMessageStyle}>{errors.postcode}</span> : null}
      </label>
      <PostcodeAddressField postcode={postcode} address={address} onAddress={onAddress} error={errors?.address} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <label style={labelStyle}>Contact<input style={fieldStyle} value={contact} onChange={(event) => onContact(event.target.value)} /></label>
        <label style={labelStyle}>Phone<input style={fieldStyle} value={phone} onChange={(event) => onPhone(event.target.value)} /></label>
      </div>
    </div>
  );
}

const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '8px' };
