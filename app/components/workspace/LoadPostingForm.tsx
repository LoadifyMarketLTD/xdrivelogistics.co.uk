'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../AuthContext';
import { resolveActiveCompanyId } from '../../../lib/activeCompany';
import { isSupabaseConfigured, supabase } from '../../../lib/supabaseClient';
import { ActionButton, AlertBanner, Panel } from './WorkspaceUI';
import PostcodeAddressField from './PostcodeAddressField';
import StripeSetupAction from './StripeSetupAction';
import WorkspaceRestrictionBanner from './WorkspaceRestrictionBanner';
import { usePrivateNetworkGroups } from './usePrivateNetworkGroups';
import { WORKSPACE_READINESS_CHANGED, isSafeRecoveryHref } from '../../../lib/workspaceReadiness';
import { resolveLegalRemediationUrl } from '../../../lib/workspaceRemediation';
import { isValidTargetPriceGbp, smartReadLoad } from '../../../lib/smartReadLoad';
import { COMPANY_CONFIG } from '../../config/company';
import { convertPostLoadMeasurement, displayPostLoadMeasurement, type PostLoadWeightUnit, type PostLoadDimensionUnit } from '../../../lib/postLoadUnits';
import { importedPostingTown, townFromPostingAddress, validPostingTown } from '../../../lib/loadPostingTown';
import './load-posting-exchange.css';
import './approved-post-load-3150.css';
import './xdrive-postload-original.css';

const VEHICLES = ['Small Van', 'SWB Van', 'MWB Van', 'LWB Van', 'XLWB Van', 'Luton', 'Luton Tail Lift', 'Curtainside Van', '3.5T', '5T', '7.5T', '12T', '18T', '26T', 'Artic 44T Curtainsider', 'Artic 44T Box Trailer', 'Artic 44T Flatbed', 'Artic 44T Refrigerated', 'Hiab', 'Moffett', 'ADR Vehicle', 'Refrigerated Vehicle'];
const PAYMENT_TERMS = COMPANY_CONFIG.payment.terms;
const CARGO = ['Documents', 'Parcels', 'Pallets', 'Machinery', 'Furniture', 'Retail Goods', 'Mixed Freight', 'ADR Goods', 'Temperature Controlled Freight', 'Other'];
type CanonicalLoadType = 'on_demand' | 'regular_load' | 'daily_hire';
const LOAD_TYPES: Array<{ value: CanonicalLoadType; label: string; detail: string }> = [
  { value: 'on_demand', label: 'On Demand', detail: 'One-off collection and delivery.' },
  { value: 'regular_load', label: 'Regular Load', detail: 'Recurring work on selected operating days.' },
  { value: 'daily_hire', label: 'Daily Hire', detail: 'Vehicle / driver capacity hired for a defined day period.' },
];
const REGULAR_DAYS = [
  ['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun'],
] as const;
const MAX_DOCUMENT_FILES = 12;
const MAX_DOCUMENT_BYTES = 12 * 1024 * 1024;
const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);
const cleanDocumentFileName = (value: string) =>
  value.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-');
const QUARTER_HOUR_SLOTS = Array.from({ length: 96 }, (_, index) => {
  const totalMinutes = index * 15;
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
const quarterHourSlotMinutes = (value: string) => {
  const match = /^(\d{2}):(00|15|30|45)$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours <= 23 ? hours * 60 + minutes : null;
};
const availableQuarterHourSlots = (date: string, now: Date | null) => {
  if (!date || !now) return QUARTER_HOUR_SLOTS;
  const today = localDateKey(now);
  if (date < today) return [];
  if (date > today) return QUARTER_HOUR_SLOTS;
  const currentSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  return QUARTER_HOUR_SLOTS.filter((slot) => {
    const minutes = quarterHourSlotMinutes(slot);
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

type LoadClonePrefill = {
  clientName: string; clientEmail: string; clientPhone: string;
  pickupAddress: string; pickupPostcode: string; collectionContact: string; collectionPhone: string;
  deliveryAddress: string; deliveryPostcode: string; deliveryContact: string; deliveryPhone: string;
  vehicle: string; cargo: string; weight: string; pallets: string; itemCount: string; palletType: string; palletStackable: string;
  length: string; width: string; height: string; cargoValue: string;
  customerReference: string; purchaseOrder: string; bookingReference: string; customerPrice: string; targetCarrierCost: string;
  tailLift: boolean; forklift: boolean; handball: boolean; deliveryTailLift: boolean; deliveryForklift: boolean; deliveryHandball: boolean;
  adr: boolean; temperatureControlled: boolean; fragile: boolean; pumpTruck: boolean; twoPersonCrew: boolean; dedicatedVehicle: boolean; isFixedPrice: boolean;
  collectionAccessRestrictions: string; deliveryAccessRestrictions: string; documentChecklist: string;
  publicQuoteNotes: string; executionInstructions: string;
  additionalStops: Array<Omit<AdditionalStop, 'id'>>;
};

type LoadClonePrefillResponse = { prefill?: LoadClonePrefill; notice?: string; error?: string };

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
  allowAsap = false,
  minimumDate,
  now,
}: {
  date: string;
  time: string;
  postcode: string;
  address: string;
  requireDate?: boolean;
  requireTime?: boolean;
  allowAsap?: boolean;
  minimumDate?: string;
  now: Date | null;
}): StopFieldErrors => {
  const today = now ? localDateKey(now) : '';
  const dateIsRequired = requireDate || Boolean(time);
  const timeIsRequired = !allowAsap && (requireTime || Boolean(date));
  let dateError: string | undefined;
  if (dateIsRequired && !date) dateError = 'Required';
  else if (date && today && date < today) dateError = 'Choose today or a future date';
  else if (date && minimumDate && date < minimumDate) dateError = 'Choose the collection date or later';

  let timeError: string | undefined;
  if (timeIsRequired && !time) timeError = 'Required';
  else if (time) {
    const minutes = quarterHourSlotMinutes(time);
    if (minutes == null) timeError = 'Use a 15-minute time slot';
    else if (date && now && date === today) {
      const currentSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
      if (minutes * 60 <= currentSeconds) timeError = 'Choose a future 15-minute slot';
    }
  }

  return {
    date: dateError,
    time: timeError,
    postcode: !postcode.trim() ? 'Required' : !isFullUkPostcode(postcode) ? 'Enter a full UK postcode' : undefined,
    address: !address.trim() ? 'Required' : address.trim().length < 3 ? 'Enter a complete address' : undefined,
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

type LoadPostingMode = 'broker' | 'customer' | 'admin' | 'owner';
type DirectTargetMode = 'marketplace' | 'external_subcontractor' | 'internal_resource';
type InternalDirectDriver = { id: string; name: string; availabilityStatus: string | null; driverType: string | null };
type InternalDirectVehicle = { id: string; registration: string; type: string | null; assignedDriverId: string | null };

export default function LoadPostingForm({ mode }: { mode: LoadPostingMode }) {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const directCarrierId = searchParams.get('directCarrier');
  const sourceJobId = searchParams.get('sourceJob');
  const sourceActionParam = searchParams.get('sourceAction');
  const sourceAction = sourceActionParam === 'rebook' || sourceActionParam === 'repost' ? sourceActionParam : null;
  const idempotencyKeyRef = useRef<string | null>(null);
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [stripeSetupCompanyId, setStripeSetupCompanyId] = useState<string | null>(null);
  const [remediationAction, setRemediationAction] = useState<{ url: string; label: string } | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  const [clockNow, setClockNow] = useState<Date | null>(null);
  const [postingCompany, setPostingCompany] = useState<{ id: string; name: string | null; memberId: string | null } | null>(null);
  const [directCarrier, setDirectCarrier] = useState<{ id: string; name: string; memberId: string | null } | null>(null);
  const [directCarrierError, setDirectCarrierError] = useState('');
  const [directTargetMode, setDirectTargetMode] = useState<DirectTargetMode>('marketplace');
  const [visibilityGroupId, setVisibilityGroupId] = useState('');
  const [externalTarget, setExternalTarget] = useState({ contactName: '', companyName: '', email: '', phone: '', agreedRate: '', paymentTerms: COMPANY_CONFIG.payment.defaultTerm as (typeof PAYMENT_TERMS)[number] });
  const [internalDrivers, setInternalDrivers] = useState<InternalDirectDriver[]>([]);
  const [internalVehicles, setInternalVehicles] = useState<InternalDirectVehicle[]>([]);
  const [internalDriverId, setInternalDriverId] = useState('');
  const [internalVehicleId, setInternalVehicleId] = useState('');
  const [internalResourcesError, setInternalResourcesError] = useState('');
  const [cloneNotice, setCloneNotice] = useState('');
  const [cloneLoading, setCloneLoading] = useState(false);
  const [documentFiles, setDocumentFiles] = useState<File[]>([]);
  const [documentName, setDocumentName] = useState('');
  const [documentNames, setDocumentNames] = useState<Record<string,string>>({});
  const [additionalStops, setAdditionalStops] = useState<AdditionalStop[]>([]);
  const privateGroups = usePrivateNetworkGroups(postingCompany?.id);

  const [smartReadText, setSmartReadText] = useState('');
  const [smartReadFeedback, setSmartReadFeedback] = useState('');
  const [fixedPriceError, setFixedPriceError] = useState(false);
  const [showOptional, setShowOptional] = useState(true);
  const [pickupMode, setPickupMode] = useState<'Between' | 'At' | 'Before' | 'ASAP'>('Between');
  const [deliveryMode, setDeliveryMode] = useState<'ASAP' | 'At' | 'By' | 'Between'>('ASAP');
  const [pickupEnd, setPickupEnd] = useState('');
  const [deliveryEnd, setDeliveryEnd] = useState('');
  const [jobDescription, setJobDescription] = useState('Deliver Direct');
  const [bodyType, setBodyType] = useState('n/a');
  const [jobType, setJobType] = useState<'Hotshot' | 'Backload'>('Hotshot');
  const [loadingMetres, setLoadingMetres] = useState('');
  const [cubicMetres, setCubicMetres] = useState('');
  const [weightUnit, setWeightUnit] = useState<PostLoadWeightUnit>('kg');
  const [dimensionUnit, setDimensionUnit] = useState<PostLoadDimensionUnit>('cm');
  const [waitReturn, setWaitReturn] = useState(false);
  const [hiab, setHiab] = useState(false);
  const [trailer, setTrailer] = useState(false);
  const [moffett, setMoffett] = useState(false);
  const [trackedPreferred, setTrackedPreferred] = useState(false);
  const [electronicQuotes, setElectronicQuotes] = useState(true);
  const [allowEuMembers, setAllowEuMembers] = useState(false);
  const [notifyRadius, setNotifyRadius] = useState('10');
  const [form, setForm] = useState({
    loadType: 'on_demand' as CanonicalLoadType,
    regularDays: [] as Array<(typeof REGULAR_DAYS)[number][0]>,
    regularEndDate: '',
    hireEndTime: '',
    proximityAlertsEnabled: false,
    pickupAlertRadiusMiles: '1',
    deliveryAlertRadiusMiles: '1',
    clientName: '', clientEmail: '', clientPhone: '',
    pickupDate: '', pickupTime: '', pickupAddress: '', pickupTown: '', pickupPostcode: '', collectionContact: '', collectionPhone: '',
    deliveryDate: '', deliveryTime: '', deliveryAddress: '', deliveryTown: '', deliveryPostcode: '', deliveryContact: '', deliveryPhone: '',
    vehicle: 'LWB Van', cargo: 'Pallets', weight: '', pallets: '', itemCount: '', palletType: '', palletStackable: '', length: '', width: '', height: '', cargoValue: '',
    customerReference: '', purchaseOrder: '', bookingReference: '', customerPrice: '', targetCarrierCost: '', paymentTerms: COMPANY_CONFIG.payment.defaultTerm as (typeof PAYMENT_TERMS)[number],
    tailLift: false, forklift: false, handball: false, deliveryTailLift: false, deliveryForklift: false, deliveryHandball: false,
    adr: false, temperatureControlled: false, fragile: false, pumpTruck: false, twoPersonCrew: false, dedicatedVehicle: false, isFixedPrice: false,
    collectionAccessRestrictions: '', deliveryAccessRestrictions: '', documentChecklist: '',
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
        .select('id, name, xd_id')
        .eq('id', companyId)
        .maybeSingle();
      if (!cancelled) {
        setPostingCompany({
          id: companyId,
          name: typeof data?.name === 'string' ? data.name : null,
          memberId: typeof data?.xd_id === 'string' ? data.xd_id : null,
        });
      }
    };
    void resolvePostingIdentity();
    return () => { cancelled = true; };
  }, [user?.companyId, user?.id]);

  useEffect(() => {
    let cancelled = false;
    const loadInternalResources = async () => {
      setInternalResourcesError('');
      if (directTargetMode !== 'internal_resource' || !postingCompany?.id) return;
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        if (!cancelled) setInternalResourcesError('Your session has expired. Sign in again.');
        return;
      }
      try {
        const response = await fetch(`/api/jobs/direct-booking-resources?companyId=${encodeURIComponent(postingCompany.id)}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const payload = await response.json().catch(() => ({})) as {
          drivers?: InternalDirectDriver[];
          vehicles?: InternalDirectVehicle[];
          error?: string;
        };
        if (!response.ok) throw new Error(payload.error || 'Internal resources could not be loaded.');
        if (!cancelled) {
          setInternalDrivers(Array.isArray(payload.drivers) ? payload.drivers : []);
          setInternalVehicles(Array.isArray(payload.vehicles) ? payload.vehicles : []);
        }
      } catch (reason) {
        if (!cancelled) setInternalResourcesError(reason instanceof Error ? reason.message : 'Internal resources could not be loaded.');
      }
    };
    void loadInternalResources();
    return () => { cancelled = true; };
  }, [directTargetMode, postingCompany?.id]);

  useEffect(() => {
    let cancelled = false;
    const resolveClonePrefill = async () => {
      setCloneNotice('');
      if (!sourceJobId || !sourceAction || !user?.id || !isSupabaseConfigured) return;
      setCloneLoading(true);
      try {
        const companyId = await resolveActiveCompanyId({ userId: user.id, fallbackCompanyId: user.companyId ?? null });
        if (!companyId) throw new Error('This account is not linked to a company.');
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error('Your session has expired. Please sign in again.');
        const response = await fetch(`/api/admin/jobs/${encodeURIComponent(sourceJobId)}/clone-prefill?companyId=${encodeURIComponent(companyId)}&action=${sourceAction}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const payload = await response.json().catch(() => ({})) as LoadClonePrefillResponse;
        if (!response.ok || !payload.prefill) throw new Error(payload.error || 'The source booking could not be prepared.');
        if (cancelled) return;
        const { additionalStops: sourceStops, ...prefill } = payload.prefill;
        setForm((current) => ({ ...current, ...prefill, pickupDate: '', pickupTime: '', deliveryDate: '', deliveryTime: '' }));
        setAdditionalStops(sourceStops.map((stop) => ({ ...stop, id: crypto.randomUUID(), date: '', time: '' })));
        idempotencyKeyRef.current = null;
        setCloneNotice(payload.notice ?? 'Source booking details copied into a new load. Review the schedule and references before saving.');
      } catch (reason) {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : 'The source booking could not be prepared.');
        }
      } finally {
        if (!cancelled) setCloneLoading(false);
      }
    };
    void resolveClonePrefill();
    return () => { cancelled = true; };
  }, [sourceAction, sourceJobId, user?.companyId, user?.id]);

  useEffect(() => {
    let cancelled = false;
    const resolveDirectCarrier = async () => {
      setDirectCarrier(null);
      setDirectCarrierError('');
      if (!directCarrierId || !isSupabaseConfigured) return;
      const { data, error: carrierError } = await supabase
        .from('companies')
        .select('id, name, xd_id, status')
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
        memberId: typeof data.xd_id === 'string' ? data.xd_id : null,
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

  const effectivePickupTime = pickupMode === 'ASAP' ? availableQuarterHourSlots(form.pickupDate, clockNow)[0] ?? '' : form.pickupTime;
  const effectiveDeliveryTime = deliveryMode === 'ASAP' ? '' : form.deliveryTime;
  const scheduleError = pickupMode === 'Between' && !pickupEnd ? 'Choose the end of the collection window.' : deliveryMode === 'Between' && !deliveryEnd ? 'Choose the end of the delivery window.' : '';
  const collectionErrors = validateStop({
    date: form.pickupDate,
    time: effectivePickupTime,
    postcode: form.pickupPostcode,
    address: form.pickupAddress,
    requireDate: true,
    requireTime: true,
    minimumDate: todayKey || undefined,
    now: clockNow,
  });
  const deliveryErrors = validateStop({
    date: form.deliveryDate,
    time: effectiveDeliveryTime,
    allowAsap: deliveryMode === 'ASAP',
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
  const townErrors = {
    pickup: !form.pickupTown.trim() ? 'Enter the collection town' : !validPostingTown(form.pickupTown) ? 'Enter a town, not a street address' : '',
    delivery: !form.deliveryTown.trim() ? 'Enter the delivery town' : !validPostingTown(form.deliveryTown) ? 'Enter a town, not a street address' : '',
  };
  const hasRequiredErrors = hasStopErrors(collectionErrors) || hasStopErrors(deliveryErrors) || additionalStopErrors.some(hasStopErrors) || Boolean(townErrors.pickup || townErrors.delivery);
  const loadTypeError = form.loadType === 'regular_load' && form.regularDays.length === 0
    ? 'Select at least one operating day for a Regular Load.'
    : form.loadType === 'daily_hire' && !form.hireEndTime
      ? 'Choose an end time for Daily Hire.'
      : form.loadType === 'daily_hire' && form.pickupTime && form.hireEndTime && (quarterHourSlotMinutes(form.hireEndTime) ?? -1) <= (quarterHourSlotMinutes(form.pickupTime) ?? -1)
        ? 'Daily Hire end time must be later than the start time.'
        : '';

  const dimensionErrors = {
    length: dimensionError(form.length),
    width: dimensionError(form.width),
    height: dimensionError(form.height),
  };
  const numericErrors = Object.fromEntries((['weight', 'pallets', 'itemCount', 'cargoValue'] as const).map(key => {
    const value = form[key].trim();
    const parsed = Number(value);
    return [key, value && (!Number.isFinite(parsed) || parsed < 0 || ((key === 'pallets' || key === 'itemCount') && !Number.isInteger(parsed))) ? 'Enter a valid non-negative ' + (key === 'pallets' || key === 'itemCount' ? 'whole number' : 'number') : ''];
  }));
  const emailError = form.clientEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.clientEmail.trim()) ? 'Enter a valid customer email address' : '';
  const hasDimensionErrors = Boolean(dimensionErrors.length || dimensionErrors.width || dimensionErrors.height);
  const dimensionsCm = [form.length, form.width, form.height].map(numberOrNull);
  const hasDimensionValues = dimensionsCm.some((value) => value != null);
  const dimensionSummary = hasDimensionValues
    ? `${dimensionsCm.map((value) => value == null ? '—' : value.toLocaleString('en-GB', { maximumFractionDigits: 1 })).join(' × ')} cm`
    : 'Enter dimensions in centimetres (cm)';

  const focusFirstInvalidField = () => {
    window.setTimeout(() => {
      const field = document.querySelector<HTMLElement>('.xdrive-post-load-form [aria-invalid="true"]:not(:disabled)');
      field?.focus();
      field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);
  };

  const save = async (publish: boolean, saveForRepeat = false) => {
    setError('');
    setSuccess('');
    setStripeSetupCompanyId(null);
    setRemediationAction(null);
    if (cloneLoading) {
      setError('Wait for the source booking details to finish loading before saving.');
      return;
    }
    setShowValidation(true);

    const requiresFixedPrice = publish && form.isFixedPrice;
    if (requiresFixedPrice && !isValidTargetPriceGbp(Number(form.customerPrice))) {
      setFixedPriceError(true);
      setError('A fixed-price post needs a positive GBP price, up to 2 decimal places, excluding VAT.');
      focusFirstInvalidField();
      return;
    }
    setFixedPriceError(false);

    if (hasRequiredErrors || hasDimensionErrors || loadTypeError || scheduleError || Object.values(numericErrors).some(Boolean) || emailError) {
      setError(scheduleError || loadTypeError || 'Load details are incomplete or invalid. Complete the fields highlighted in red.');
      focusFirstInvalidField();
      return;
    }
    if (documentFiles.length > MAX_DOCUMENT_FILES) {
      setError('Attach no more than ' + MAX_DOCUMENT_FILES + ' documents to one load.');
      return;
    }
    const invalidDocument = documentFiles.find((file) =>
      file.size <= 0
      || file.size > MAX_DOCUMENT_BYTES
      || !ALLOWED_DOCUMENT_MIME_TYPES.has(file.type.trim().toLowerCase()),
    );
    if (invalidDocument) {
      setError('Document ' + invalidDocument.name + ' is empty, exceeds 12 MB, or uses an unsupported file type.');
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
    if (publish && !directCarrierId && directTargetMode === 'external_subcontractor' && (externalTarget.contactName.trim().length < 2 || externalTarget.phone.trim().length < 5)) {
      focusFirstInvalidField();
      setError('External Direct Booking requires a subcontractor contact name and phone number.');
      return;
    }
    if (publish && !directCarrierId && directTargetMode === 'internal_resource' && (!internalDriverId || !internalVehicleId)) {
      focusFirstInvalidField();
      setError('Internal Direct Booking requires both a driver and a vehicle.');
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
          mode: mode === 'owner' ? 'admin' : mode,
          loadType: form.loadType,
          regularSchedule: form.loadType === 'regular_load' ? { days: form.regularDays, endDate: form.regularEndDate || null } : null,
          hireEndDateTime: form.loadType === 'daily_hire' ? dateTime(form.pickupDate, form.hireEndTime) : null,
          publish,
          proximityAlertsEnabled: form.proximityAlertsEnabled,
          pickupAlertRadiusMiles: Number(form.pickupAlertRadiusMiles || 1),
          deliveryAlertRadiusMiles: Number(form.deliveryAlertRadiusMiles || 1),
          visibility: publish && !directCarrierId && directTargetMode === 'marketplace' && visibilityGroupId ? 'private_group' : undefined,
          visibilityGroupId: publish && !directCarrierId && directTargetMode === 'marketplace' && visibilityGroupId ? visibilityGroupId : null,
          directInviteCompanyId: publish ? directCarrier?.id ?? null : null,
          directBookingTarget: publish
            ? directCarrier
              ? { type: 'exchange_member', companyId: directCarrier.id }
              : directTargetMode === 'external_subcontractor'
                ? {
                    type: 'external_subcontractor',
                    contactName: externalTarget.contactName.trim(),
                    companyName: externalTarget.companyName.trim() || null,
                    email: externalTarget.email.trim() || null,
                    phone: externalTarget.phone.trim(),
                    agreedRate: numberOrNull(externalTarget.agreedRate),
                    paymentTerms: externalTarget.paymentTerms.trim() || null,
                  }
                : directTargetMode === 'internal_resource'
                  ? { type: 'internal_resource', driverId: internalDriverId, vehicleId: internalVehicleId }
                  : null
            : null,
          clientName: form.clientName || null,
          clientEmail: form.clientEmail || '',
          clientPhone: form.clientPhone || null,
          pickupDateTime: dateTime(form.pickupDate, effectivePickupTime),
          pickupTimeSlot: pickupMode === 'Between' ? `Between ${effectivePickupTime}-${pickupEnd}` : pickupMode === 'ASAP' ? 'ASAP' : `${pickupMode} ${effectivePickupTime}`,
          pickupAddress: form.pickupAddress.trim(), pickupTown: form.pickupTown.trim(),
          pickupPostcode,
          collectionContact: form.collectionContact || null,
          collectionPhone: form.collectionPhone || null,
          deliveryDateTime: dateTime(form.deliveryDate, effectiveDeliveryTime),
          deliveryTimeSlot: deliveryMode === 'Between' ? `Between ${effectiveDeliveryTime}-${deliveryEnd}` : deliveryMode === 'ASAP' ? 'ASAP' : `${deliveryMode} ${effectiveDeliveryTime}`,
          deliveryAddress: form.deliveryAddress.trim(), deliveryTown: form.deliveryTown.trim(),
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
          itemCount: numberOrNull(form.itemCount),
          palletType: form.palletType || null,
          palletStackable: form.palletStackable === 'yes' ? true : form.palletStackable === 'no' ? false : null,
          lengthCm: numberOrNull(form.length),
          widthCm: numberOrNull(form.width),
          heightCm: numberOrNull(form.height),
          cargoValueGbp: numberOrNull(form.cargoValue),
          customerReference: form.customerReference || null,
          purchaseOrder: form.purchaseOrder || null,
          bookingReference: form.bookingReference || null,
          customerPrice: form.isFixedPrice ? numberOrNull(form.customerPrice) : null,
          targetCarrierCost: numberOrNull(form.targetCarrierCost),
          paymentTerms: form.paymentTerms,
          tailLift: form.tailLift,
          forklift: form.forklift,
          handball: form.handball,
          deliveryTailLift: form.deliveryTailLift,
          deliveryForklift: form.deliveryForklift,
          deliveryHandball: form.deliveryHandball,
          adr: form.adr,
          temperatureControlled: form.temperatureControlled,
          fragile: form.fragile,
          documentChecklist: form.documentChecklist.split(/\r?\n|,/).map((value) => value.trim()).filter(Boolean),
          collectionAccessRestrictions: form.collectionAccessRestrictions.split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
          deliveryAccessRestrictions: form.deliveryAccessRestrictions.split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
          specialRequirementsList: [
            waitReturn && 'Wait & Return', hiab && 'Hiab', trailer && 'Trailer', moffett && 'Moffett Mounty',
            form.pumpTruck && 'Pump truck required',
            form.twoPersonCrew && 'Two-person crew required',
            form.dedicatedVehicle && 'Dedicated vehicle / no co-loading',
          ].filter((value): value is string => Boolean(value)),
          isFixedPrice: form.isFixedPrice,
          publicQuoteNotes: form.publicQuoteNotes || null,
          operationalDetails: {
            jobDescription, bodyType, jobType, pickupMode, pickupWindowEnd: pickupEnd,
            deliveryMode, deliveryWindowEnd: deliveryEnd,
            loadingMetres: numberOrNull(loadingMetres), cubicMetres: numberOrNull(cubicMetres),
            waitReturn, hiab, trailer, moffett, repeatable: saveForRepeat,
            trackedDriverPreferred: trackedPreferred, electronicQuotes, allowEuMembers,
            notifyRadiusMiles: Math.min(100, Math.max(1, Math.round(Number(notifyRadius) || 10))),
          },
          executionInstructions: form.executionInstructions || null,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        referenceId?: string;
        reason?: string;
        resolution?: string;
        setupCompanyId?: string;
        setupUrl?: string;
        code?: string;
        job?: { id: string };
        replayed?: boolean;
      } | null;
      if (!response.ok || !payload?.job?.id) {
        window.dispatchEvent(new Event(WORKSPACE_READINESS_CHANGED));
        if (response.status === 409 && payload?.setupCompanyId === companyId && ['owner', 'admin'].includes(user?.membershipRole ?? '')) {
          setStripeSetupCompanyId(companyId);
        }
        if (isSafeRecoveryHref(payload?.setupUrl) && payload?.code !== 'STRIPE_COMMERCIAL_READINESS_REQUIRED') {
          const label = payload.code === 'COMMERCIAL_LEGAL_REACCEPTANCE_REQUIRED'
            ? 'Review legal agreements'
            : payload.code === 'TRANSPORT_BUYER_RISK_LIMIT'
              ? 'Resolve account restriction'
              : payload.code === 'COMPANY_MEMBERSHIP_REQUIRED'
                ? 'Complete onboarding'
                : 'Resolve requirement';
          const url = payload.code === 'COMMERCIAL_LEGAL_REACCEPTANCE_REQUIRED' ? resolveLegalRemediationUrl(payload.setupUrl, mode) : payload.setupUrl;
          if (url && (payload.code !== 'COMMERCIAL_LEGAL_REACCEPTANCE_REQUIRED' || ['owner', 'admin'].includes(user?.membershipRole ?? ''))) setRemediationAction({ url, label });
        }
        const baseMessage = payload?.error ?? 'The load could not be saved.';
        const reasonText = payload?.reason ? ` Cause: ${payload.reason}` : '';
        const resolutionText = payload?.resolution ? ` Resolution: ${payload.resolution}` : '';
        const referenceText = payload?.referenceId ? ` Error reference: ${payload.referenceId}.` : '';
        throw new Error(`${baseMessage}${reasonText}${resolutionText}${referenceText}`);
      }

      if (documentFiles.length > 0) {
        const documentRows: Array<{ storagePath: string; fileName: string; fileSizeBytes: number; mimeType: string | null }> = [];
        for (const file of documentFiles) {
          const storagePath = `${companyId}/${payload.job.id}/${crypto.randomUUID()}-${cleanDocumentFileName(file.name)}`;
          const { error: uploadError } = await supabase.storage.from('load-documents').upload(storagePath, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type || undefined,
          });
          if (uploadError) {
            if (documentRows.length > 0) {
              await supabase.storage.from('load-documents').remove(documentRows.map((document) => document.storagePath));
            }
            throw new Error(`Load ${xdriveReference(payload.job.id)} was saved, but document upload failed for ${file.name}: ${uploadError.message}`);
          }
          documentRows.push({
            storagePath,
            fileName: documentNames[file.name] || file.name,
            fileSizeBytes: file.size,
            mimeType: file.type || null,
          });
        }

        const documentResponse = await fetch(`/api/admin/jobs/${encodeURIComponent(payload.job.id)}/documents`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ companyId, documents: documentRows }),
        });
        const documentPayload = (await documentResponse.json().catch(() => null)) as { error?: string } | null;
        if (!documentResponse.ok) {
          await supabase.storage.from('load-documents').remove(documentRows.map((document) => document.storagePath));
          throw new Error(`Load ${xdriveReference(payload.job.id)} was saved, but document records could not be saved: ${documentPayload?.error ?? 'Unknown document service error.'}`);
        }
      }

      const reference = xdriveReference(payload.job.id);
      setShowValidation(false);
      setSuccess(
        publish
          ? directCarrier
            ? `Load ${reference} sent directly to ${directCarrier.name}.`
            : directTargetMode === 'external_subcontractor'
              ? `Direct Booking ${reference} confirmed with the external subcontractor.`
              : directTargetMode === 'internal_resource'
                ? `Direct Booking ${reference} allocated to the selected internal driver and vehicle.`
                : `Load ${reference} published to the carrier marketplace.`
          : `Draft load ${reference} saved.`,
      );
      const destination = mode === 'broker'
        ? `/broker/loads?created=${payload.job.id}`
        : mode === 'customer'
          ? `/customer/loads?created=${payload.job.id}`
          : mode === 'owner'
            ? `/driver/loads?created=${payload.job.id}`
            : `/admin/jobs?created=${payload.job.id}`;
      idempotencyKeyRef.current = null;
      setDocumentFiles([]);
      window.setTimeout(() => router.push(destination), 650);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The load could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="xdrive-post-load-form xdrive-approved-postload-3150" data-testid="approved-post-load-3150">
      <div className="approved-postload-intro">
        <div className="approved-postload-heading"><span className="approved-postload-new">NEW</span><h2>Post Load</h2></div>
        <div className="approved-postload-modes" role="group" aria-label="Load service type">
          {LOAD_TYPES.map((option) => <button key={option.value} type="button" aria-pressed={form.loadType === option.value} onClick={() => setForm((current) => ({ ...current, loadType: option.value, regularDays: option.value === 'regular_load' ? current.regularDays : [], regularEndDate: option.value === 'regular_load' ? current.regularEndDate : '', hireEndTime: option.value === 'daily_hire' ? current.hireEndTime : '' }))}>{option.label}</button>)}
        </div>
        <div className="approved-postload-header-actions">
          <button type="button" onClick={() => router.push(mode === 'broker' ? '/broker/loads' : mode === 'customer' ? '/customer/loads' : mode === 'owner' ? '/driver/loads' : '/admin/jobs')}>Open Saved Loads</button>
          <button type="button" aria-pressed={!showOptional} onClick={() => setShowOptional((current) => !current)}>{showOptional ? 'Close All Optional' : 'Open All Optional'}</button>
        </div>
      </div>
      <p className="approved-postload-explainer">Only town and outcode are visible to carriers before award; complete collection and delivery addresses remain private.</p>
      {error && (
        <AlertBanner tone="danger">
          {error}
          {showValidation && <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
            {[
              ...Object.entries(collectionErrors).filter(([, message]) => message).map(([key, message]) => 'Collection ' + key + ': ' + message),
              ...Object.entries(deliveryErrors).filter(([, message]) => message).map(([key, message]) => 'Delivery ' + key + ': ' + message),
              ...additionalStopErrors.flatMap((errors, index) => Object.entries(errors).filter(([, message]) => message).map(([key, message]) => 'Stop ' + (index + 1) + ' ' + key + ': ' + message)),
              townErrors.pickup, townErrors.delivery, loadTypeError, scheduleError, emailError,
              ...Object.entries(dimensionErrors).filter(([, message]) => message).map(([key, message]) => key + ': ' + message),
              ...Object.entries(numericErrors).filter(([, message]) => message).map(([key, message]) => key + ': ' + message),
            ].filter(Boolean).map(message => <li key={message}>{message}</li>)}
          </ul>}
            <WorkspaceRestrictionBanner role={mode === 'owner' ? 'owner_driver' : mode === 'admin' ? 'company_owner' : mode} inline operation="post_load" />
          {stripeSetupCompanyId ? (
            <StripeSetupAction
              companyId={stripeSetupCompanyId}
              getAccessToken={async () => {
                const { data } = await supabase.auth.getSession();
                return data.session?.access_token ?? null;
              }}
            />
          ) : null}
          {remediationAction ? (
            <div style={{ marginTop: 10 }}>
              <a href={remediationAction.url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', padding: '8px 12px', borderRadius: 6, background: '#0b2f6b', color: '#fff', fontWeight: 700 }}>{remediationAction.label}</a>
            </div>
          ) : null}
        </AlertBanner>
      )}
      {cloneLoading && <AlertBanner tone="info">Preparing a new booking from the source record…</AlertBanner>}
      {cloneNotice && <AlertBanner tone="info">{cloneNotice}</AlertBanner>}
      {success && <AlertBanner tone="success">{success}</AlertBanner>}

      {sourceAction === 'repost' && <Panel style={{ order: 12 }} title="Smart Read - optional text import" description="Paste transport instructions to prefill recognised fields. Source text stays in this browser; review all values before saving.">
        <textarea aria-label="Transport instructions for Smart Read" value={smartReadText} onChange={(event) => setSmartReadText(event.target.value)} rows={4} maxLength={20000} style={{ width: '100%', padding: 12, border: '1px solid #c8d3e0', borderRadius: 7, font: 'inherit', color: '#111827' }} placeholder="Collection: M1 1AE today 10:15; Delivery: SW1A 1AA; Vehicle: LWB; Total weight: 450 kg; 2 pallets; Dimensions: 120cm x 80cm x 60cm" />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10 }}>
          <ActionButton tone="secondary" onClick={() => {
            const parsed = smartReadLoad(smartReadText);
            if (parsed.targetPriceGbp) setFixedPriceError(false);
            const vehicleMap: Record<string, string> = { 'SMALL VAN': 'Small Van', SWB: 'SWB Van', LWB: 'LWB Van', XLWB: 'XLWB Van', LUTON: 'Luton' };
            const pickupIndex = parsed.locations.findIndex((stop) => stop.type === 'collection');
            let deliveryIndex = -1;
            parsed.locations.forEach((stop, index) => { if (stop.type === 'delivery') deliveryIndex = index; });
            const pickup = pickupIndex >= 0 ? parsed.locations[pickupIndex] : undefined;
            const delivery = deliveryIndex >= 0 ? parsed.locations[deliveryIndex] : undefined;
            const importedStops = pickup && delivery && pickupIndex < deliveryIndex
              ? parsed.locations.filter((_, index) => index !== pickupIndex && index !== deliveryIndex).slice(0, 8)
              : [];
            if (parsed.locations.length > 2 && importedStops.length !== parsed.locations.length - 2) {
              parsed.warnings.push('The stop order could not be mapped fully; review the route manually.');
            }
            const mergeText = (current: string, incoming?: string) => {
              if (!incoming) return current;
              if (!current.trim()) return incoming;
              return current.includes(incoming) ? current : current + '\n' + incoming;
            };
            setForm((current) => ({
              ...current,
              pickupPostcode: pickup?.postcode.value ?? current.pickupPostcode,
              pickupTown: importedPostingTown(pickup, current.pickupPostcode, current.pickupTown),
              pickupAddress: pickup?.address?.value ?? (pickup && pickup.postcode.value !== current.pickupPostcode ? '' : current.pickupAddress),
              pickupDate: pickup?.date?.value ?? current.pickupDate,
              pickupTime: pickup?.asap ? '' : pickup?.time?.value ?? current.pickupTime,
              deliveryPostcode: delivery?.postcode.value ?? current.deliveryPostcode,
              deliveryTown: importedPostingTown(delivery, current.deliveryPostcode, current.deliveryTown),
              deliveryAddress: delivery?.address?.value ?? (delivery && delivery.postcode.value !== current.deliveryPostcode ? '' : current.deliveryAddress),
              deliveryDate: delivery?.date?.value ?? current.deliveryDate,
              deliveryTime: delivery?.time?.value ?? current.deliveryTime,
              vehicle: parsed.vehicleType ? (vehicleMap[parsed.vehicleType.value] ?? current.vehicle) : current.vehicle,
              weight: parsed.weightKg?.value ?? current.weight,
              pallets: parsed.pallets?.value ?? current.pallets,
              itemCount: parsed.itemCount?.value ?? current.itemCount,
              length: parsed.dimensionsCm?.length.value ?? current.length,
              width: parsed.dimensionsCm?.width.value ?? current.width,
              height: parsed.dimensionsCm?.height.value ?? current.height,
              customerPrice: parsed.targetPriceGbp?.value ?? current.customerPrice,
              targetCarrierCost: parsed.targetCarrierCostGbp?.value ?? current.targetCarrierCost,
              isFixedPrice: parsed.fixedPrice ?? current.isFixedPrice,
              tailLift: parsed.equipment.tailLiftCollection ?? current.tailLift,
              deliveryTailLift: parsed.equipment.tailLiftDelivery ?? current.deliveryTailLift,
              forklift: parsed.equipment.forkliftCollection ?? current.forklift,
              deliveryForklift: parsed.equipment.forkliftDelivery ?? current.deliveryForklift,
              handball: parsed.equipment.handballCollection ?? current.handball,
              deliveryHandball: parsed.equipment.handballDelivery ?? current.deliveryHandball,
              adr: parsed.equipment.adr ?? current.adr,
              temperatureControlled: parsed.equipment.temperatureControlled ?? current.temperatureControlled,
              fragile: parsed.equipment.fragile ?? current.fragile,
              pumpTruck: parsed.equipment.pumpTruck ?? current.pumpTruck,
              twoPersonCrew: parsed.equipment.twoPersonCrew ?? current.twoPersonCrew,
              dedicatedVehicle: parsed.equipment.dedicatedVehicle ?? current.dedicatedVehicle,
              collectionAccessRestrictions: mergeText(current.collectionAccessRestrictions, parsed.collectionAccessRestrictions?.value),
              deliveryAccessRestrictions: mergeText(current.deliveryAccessRestrictions, parsed.deliveryAccessRestrictions?.value),
              executionInstructions: mergeText(current.executionInstructions, parsed.executionInstructions?.value),
            }));
            if (pickup && delivery && pickupIndex < deliveryIndex) {
              setAdditionalStops(importedStops.map((stop) => ({
                ...createAdditionalStop(),
                type: stop.type,
                postcode: stop.postcode.value,
                address: stop.address?.value ?? '',
                date: stop.date?.value ?? '',
                time: stop.time?.value ?? '',
              })));
            }
            const recognised = [pickup, delivery, parsed.vehicleType, parsed.weightKg, parsed.pallets, parsed.itemCount, parsed.dimensionsCm, parsed.targetPriceGbp, parsed.targetCarrierCostGbp, ...parsed.requirements, parsed.collectionAccessRestrictions, parsed.deliveryAccessRestrictions, parsed.executionInstructions].filter(Boolean).length;
            setSmartReadFeedback(['Recognised ' + recognised + ' items. Check imported values and complete any missing stop addresses before saving.', ...parsed.warnings].join(' '));
          }}>Prefill recognised fields</ActionButton>
          {smartReadFeedback && <span role="status" style={{ fontSize: 13 }}>{smartReadFeedback}</span>}
        </div>
      </Panel>}
      {Boolean(directCarrierId) && <Panel style={{ order: 11 }} title="Posting identity & XDrive references" description="Platform ownership and the XDrive load reference are automatic. Customer-owned references remain optional inputs below.">
        <div style={gridStyle}>
          <label style={labelStyle}>Posting member<div style={readOnlyStyle}>{postingCompany?.name ?? 'Signed-in company'}</div></label>
          <label style={labelStyle}>Member ID<div style={readOnlyStyle}>{postingCompany?.memberId ?? 'Resolved automatically from XDrive membership'}</div></label>
          <label style={labelStyle}>XDrive load reference<div style={readOnlyStyle}>Generated automatically after save / publish</div></label>
        </div>
      </Panel>}

      {directCarrierId && (
        <Panel
          style={{ order: 10 }}
          title="Direct Booking"
          description="This load will be visible only to the selected carrier before award. It will not be broadcast to the public XDrive Exchange."
        >
          {directCarrierError ? (
            <AlertBanner tone="danger">{directCarrierError}</AlertBanner>
          ) : directCarrier ? (
            <div style={gridStyle}>
              <label style={labelStyle}>Selected carrier<div style={readOnlyStyle}>{directCarrier.name}</div></label>
              <label style={labelStyle}>Member ID<div style={readOnlyStyle}>{directCarrier.memberId ?? 'Not supplied'}</div></label>
              <label style={labelStyle}>Visibility<div style={readOnlyStyle}>Direct invite only</div></label>
            </div>
          ) : (
            <div style={{ color: '#64748b', fontSize: '11px' }}>Verifying selected carrier…</div>
          )}
        </Panel>
      )}

      {!directCarrierId && (
        <Panel style={{ order: 7 }} title="Who do you want to notify?" description="Publish to eligible members, a private group, or a selected direct-booking recipient.">
          <div className="approved-postload-audience">
            <label style={labelStyle}>Advertise this load to
              <select
                style={fieldStyle}
                value={directTargetMode === 'marketplace' ? (visibilityGroupId ? 'group:' + visibilityGroupId : 'exchange') : directTargetMode}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value.startsWith('group:')) { setDirectTargetMode('marketplace'); setVisibilityGroupId(value.slice(6)); }
                  else if (value === 'exchange') { setDirectTargetMode('marketplace'); setVisibilityGroupId(''); }
                  else { setDirectTargetMode(value as DirectTargetMode); setVisibilityGroupId(''); }
                }}
              >
                <option value="exchange">All XDrive members</option>
                {privateGroups.groups.filter((group) => group.allowLoadVisibility).map((group) =>
                  <option key={group.id} value={'group:' + group.id}>Selected group: {group.name}</option>
                )}
                <option value="external_subcontractor">Direct Booking - external subcontractor</option>
                <option value="internal_resource">Direct Booking - company driver and vehicle</option>
              </select>
            </label>
            {privateGroups.loading && <span>Loading authorised groups…</span>}
            {privateGroups.error && <AlertBanner tone="warning">{privateGroups.error}</AlertBanner>}
            {directTargetMode === 'marketplace' && visibilityGroupId && <span>Only authorised members of this private group can view and quote the load.</span>}
            {directTargetMode === 'marketplace' && <div className="approved-postload-notify-options">
              <label style={labelStyle}>Notify all live tracked drivers within
                <span className="approved-postload-radius"><button type="button" onClick={() => setNotifyRadius((v) => String(Math.max(1, Number(v) - 1)))}>−</button><input style={fieldStyle} type="number" min="1" max="100" value={notifyRadius} onChange={(event) => setNotifyRadius(event.target.value)} /><button type="button" onClick={() => setNotifyRadius((v) => String(Math.min(100, Number(v) + 1)))}>+</button><span>miles of the pick-up</span></span>
              </label>
              <label className="approved-postload-check"><input type="checkbox" checked={trackedPreferred} onChange={(event) => setTrackedPreferred(event.target.checked)}/> Tracked Driver Preferred</label>
              <label className="approved-postload-check"><input type="checkbox" checked={electronicQuotes} onChange={(event) => setElectronicQuotes(event.target.checked)}/> Electronic Quotes</label>
              <label className="approved-postload-check"><input type="checkbox" checked={allowEuMembers} onChange={(event) => setAllowEuMembers(event.target.checked)}/> Also accept quotes from EU members</label>
              <span>Distribution and quoting preferences are saved with this load; eligibility remains subject to XDrive server-side permissions.</span>
            </div>}
          </div>
          {directTargetMode === 'external_subcontractor' && (
            <div className="approved-postload-direct-fields">
              <label style={labelStyle}>Contact name *<input style={fieldStyle} value={externalTarget.contactName} onChange={(event) => setExternalTarget((v) => ({ ...v, contactName: event.target.value }))} /></label>
              <label style={labelStyle}>Company<input style={fieldStyle} value={externalTarget.companyName} onChange={(event) => setExternalTarget((v) => ({ ...v, companyName: event.target.value }))} /></label>
              <label style={labelStyle}>Phone *<input style={fieldStyle} value={externalTarget.phone} onChange={(event) => setExternalTarget((v) => ({ ...v, phone: event.target.value }))} /></label>
              <label style={labelStyle}>Email<input style={fieldStyle} type="email" value={externalTarget.email} onChange={(event) => setExternalTarget((v) => ({ ...v, email: event.target.value }))} /></label>
              <label style={labelStyle}>Agreed rate (£)<input style={fieldStyle} type="number" min="0" value={externalTarget.agreedRate} onChange={(event) => setExternalTarget((v) => ({ ...v, agreedRate: event.target.value }))} /></label>
              <label style={labelStyle}>Payment terms<select style={fieldStyle} value={externalTarget.paymentTerms} onChange={(event) => setExternalTarget((v) => ({ ...v, paymentTerms: event.target.value as (typeof PAYMENT_TERMS)[number] }))}>{PAYMENT_TERMS.map((term) => <option key={term} value={term}>{term}</option>)}</select></label>
            <p role="note" style={{ fontSize: 11, lineHeight: 1.5, color: "#475569", margin: "4px 0 10px" }}>Late payment notice: For qualifying business-to-business debts, overdue invoices may attract statutory interest of 8% per year above the Bank of England base rate (calculated daily), plus fixed debt-recovery compensation of GBP 40 (debt under GBP 1,000), GBP 70 (GBP 1,000 to GBP 9,999.99), or GBP 100 (GBP 10,000 or more). These are potential creditor rights, not automatic XDrive platform charges. Contractual terms and applicable law govern.</p>
            </div>
          )}
          {directTargetMode === 'internal_resource' && (
            <div className="approved-postload-direct-fields">
              {internalResourcesError && <AlertBanner tone="danger">{internalResourcesError}</AlertBanner>}
              <label style={labelStyle}>Company driver *
                <select style={fieldStyle} value={internalDriverId} onChange={(event) => { setInternalDriverId(event.target.value); setInternalVehicleId(''); }}>
                  <option value="">Select driver</option>
                  {internalDrivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name}{driver.availabilityStatus ? ' · ' + driver.availabilityStatus : ''}</option>)}
                </select>
              </label>
              <label style={labelStyle}>Assigned vehicle *
                <select style={fieldStyle} value={internalVehicleId} onChange={(event) => setInternalVehicleId(event.target.value)}>
                  <option value="">Select vehicle</option>
                  {internalVehicles.filter((vehicle) => vehicle.assignedDriverId === internalDriverId).map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.registration}{vehicle.type ? ' · ' + vehicle.type : ''}</option>)}
                </select>
              </label>
            </div>
          )}
        </Panel>
      )}

      {form.loadType !== 'on_demand' && <Panel style={{ order: 2 }} title="Load type & schedule" description="Choose the commercial load pattern. Marketplace and Diary use this canonical type across every workspace.">
        {form.loadType === 'regular_load' && (
          <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
            <div style={labelStyle}>Operating days</div>
            <div role="group" aria-label="Operating days" tabIndex={-1} aria-invalid={showValidation && Boolean(loadTypeError)} style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {REGULAR_DAYS.map(([value, label]) => {
                const selected = form.regularDays.includes(value);
                return <button key={value} type="button" aria-pressed={selected} onClick={() => setForm((current) => ({ ...current, regularDays: selected ? current.regularDays.filter((day) => day !== value) : [...current.regularDays, value] }))} style={{ ...microButtonStyle, background: selected ? '#0b2f6b' : '#fff', color: selected ? '#fff' : '#334155' }}>{label}</button>;
              })}
            </div>
            <label style={labelStyle}>Repeat until (optional)
              <input style={fieldStyle} type="date" min={form.pickupDate || todayKey || undefined} value={form.regularEndDate} onChange={(event) => set('regularEndDate', event.target.value)} />
            </label>
            {showValidation && loadTypeError ? <span style={validationMessageStyle}>{loadTypeError}</span> : null}
          </div>
        )}

        {form.loadType === 'daily_hire' && (
          <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 8 }}>
            <label style={labelStyle}>Hire date<div style={readOnlyStyle}>{form.pickupDate || 'Set the collection / hire start date below'}</div></label>
            <label style={labelStyle}>Hire start<div style={readOnlyStyle}>{form.pickupTime || 'Set the hire start time below'}</div></label>
            <label style={labelStyle}>Hire end time
              <select style={{ ...fieldStyle, ...(showValidation && loadTypeError ? invalidFieldStyle : {}) }} aria-invalid={showValidation && loadTypeError ? 'true' : undefined} value={form.hireEndTime} onChange={(event) => set('hireEndTime', event.target.value)}>
                <option value="">Choose end time</option>
                {QUARTER_HOUR_SLOTS.filter((slot) => !form.pickupTime || (quarterHourSlotMinutes(slot) ?? -1) > (quarterHourSlotMinutes(form.pickupTime) ?? -1)).map((slot) => <option key={slot} value={slot}>{slot}</option>)}
              </select>
              {showValidation && loadTypeError ? <span style={validationMessageStyle}>{loadTypeError}</span> : null}
            </label>
          </div>
        )}
      </Panel>}
      <Panel style={{ order: 6 }} title="Smart Alerts" description="Optional pickup and delivery notifications, using authorised location information.">
        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <input type="checkbox" checked={form.proximityAlertsEnabled} onChange={(event) => set('proximityAlertsEnabled', event.target.checked)} />
          <span><strong>Enable pickup and delivery proximity alerts</strong><br /><span style={{ color: '#64748b', fontSize: 11 }}>Notify the posting company when the assigned vehicle enters the configured collection or delivery radius.</span></span>
        </label>
        {form.proximityAlertsEnabled ? (
          <div style={{ ...gridStyle, marginTop: 10 }}>
            <label style={labelStyle}>Pickup alert radius
              <select style={fieldStyle} value={form.pickupAlertRadiusMiles} onChange={(event) => set('pickupAlertRadiusMiles', event.target.value)}>
                {['1','2','5','10'].map((value) => <option key={value} value={value}>{value} mile{value === '1' ? '' : 's'}</option>)}
              </select>
            </label>
            <label style={labelStyle}>Delivery alert radius
              <select style={fieldStyle} value={form.deliveryAlertRadiusMiles} onChange={(event) => set('deliveryAlertRadiusMiles', event.target.value)}>
                {['1','2','5','10'].map((value) => <option key={value} value={value}>{value} mile{value === '1' ? '' : 's'}</option>)}
              </select>
            </label>
          </div>
        ) : null}
      </Panel>

      <Panel style={{ order: 1 }} title="Customer" description="PRIVATE · Visible to authorised parties only">
        <div className="approved-postload-customer-grid">
          <label style={labelStyle}>Customer / company
            <input style={fieldStyle} placeholder="Start typing the customer name" value={form.clientName} onChange={(event) => set('clientName', event.target.value)} />
          </label>
          {form.isFixedPrice && <label style={labelStyle}>Fixed price (£, excluding VAT)
            <input id="xdrive-fixed-price" style={{ ...fieldStyle, ...(fixedPriceError ? invalidFieldStyle : {}) }} aria-invalid={fixedPriceError || undefined} type="number" min="0.01" step="0.01" value={form.customerPrice} onChange={(event) => { set('customerPrice', event.target.value); setFixedPriceError(false); }} />
          </label>}
          <label style={labelStyle}>Your reference
            <input style={fieldStyle} placeholder="000000" value={form.bookingReference} onChange={(event) => set('bookingReference', event.target.value)} />
          </label>
          <label style={labelStyle}>Customer reference
            <input style={fieldStyle} placeholder="000000" value={form.customerReference} onChange={(event) => set('customerReference', event.target.value)} />
          </label>
          <label className="approved-postload-hardpod">
            <input type="checkbox" checked={form.documentChecklist.split(/\r?\n/).some((entry) => entry.trim() === 'Hard copy POD required')} onChange={(event) => setForm((current) => ({ ...current, documentChecklist: event.target.checked ? [current.documentChecklist.trim(), 'Hard copy POD required'].filter(Boolean).join('\n') : current.documentChecklist.split(/\r?\n/).filter((entry) => entry.trim() !== 'Hard copy POD required').join('\n') }))} />
            Hard copy POD required
          </label>
        </div>
        <details className="approved-postload-customer-optional">
          <summary>Additional customer, pricing and payment information</summary>
          <div className="approved-postload-customer-grid">
            <label style={labelStyle}>Customer email
              <input style={{ ...fieldStyle, ...(showValidation && emailError ? invalidFieldStyle : {}) }} aria-invalid={showValidation && Boolean(emailError)} type="email" value={form.clientEmail} onChange={(event) => set('clientEmail', event.target.value)} />
            </label>
            <label style={labelStyle}>Customer phone
              <input style={fieldStyle} value={form.clientPhone} onChange={(event) => set('clientPhone', event.target.value)} />
            </label>
            <label style={labelStyle}>Purchase order number
              <input style={fieldStyle} value={form.purchaseOrder} onChange={(event) => set('purchaseOrder', event.target.value)} />
            </label>
            <label style={labelStyle}>Pricing method
              <select style={fieldStyle} value={form.isFixedPrice ? 'fixed' : 'quotes'} onChange={(event) => set('isFixedPrice', event.target.value === 'fixed')}>
                <option value="quotes">Accept quotes</option>
                <option value="fixed">Fixed price</option>
              </select>
            </label>
            <label style={labelStyle}>Payment terms
              <select style={fieldStyle} value={form.paymentTerms} onChange={(event) => set('paymentTerms', event.target.value as (typeof PAYMENT_TERMS)[number])}>
                {PAYMENT_TERMS.map((term) => <option key={term} value={term}>{term}</option>)}
              </select>
            </label>
            <p role="note" style={{ fontSize: 11, lineHeight: 1.5, color: "#475569", margin: "4px 0 10px" }}>Late payment notice: For qualifying business-to-business debts, overdue invoices may attract statutory interest of 8% per year above the Bank of England base rate (calculated daily), plus fixed debt-recovery compensation of GBP 40 (debt under GBP 1,000), GBP 70 (GBP 1,000 to GBP 9,999.99), or GBP 100 (GBP 10,000 or more). These are potential creditor rights, not automatic XDrive platform charges. Contractual terms and applicable law govern.</p>
            {mode === 'broker' && <label style={labelStyle}>Target carrier cost (£)
              <input style={fieldStyle} type="number" min="0" value={form.targetCarrierCost} onChange={(event) => set('targetCarrierCost', event.target.value)} />
            </label>}
          </div>
        </details>
      </Panel>
      <div className="approved-postload-stop-card" style={{ order: 3 }}>
        <div className="approved-postload-two-stops">
          <section className="approved-postload-stop-section"><h3>Pickup Details</h3>
          <StopFields
            title="Collection"
            timeMode={pickupMode}
            onTimeMode={(value) => setPickupMode(value as typeof pickupMode)}
            endTime={pickupEnd}
            onEndTime={setPickupEnd}
            town={form.pickupTown}
            townError={showValidation ? townErrors.pickup : undefined}
            date={form.pickupDate}
            time={form.pickupTime}
            postcode={form.pickupPostcode}
            address={form.pickupAddress}
            contact={form.collectionContact}
            phone={form.collectionPhone}
            onDate={(value) => setForm((current) => ({
              ...current,
              pickupDate: value,
              pickupTime: availableQuarterHourSlots(value, clockNow).includes(current.pickupTime) ? current.pickupTime : '',
            }))}
            onTime={(value) => set('pickupTime', value)}
            onPostcode={(value) => setForm(current => ({...current,pickupPostcode:value.toUpperCase(),pickupTown:''}))}
            onAddress={(value) => setForm(current => ({ ...current, pickupAddress: value, pickupTown: townFromPostingAddress(value, current.pickupPostcode) || current.pickupTown }))}
            onTown={(value) => set('pickupTown', value)}
            onContact={(value) => set('collectionContact', value)}
            onPhone={(value) => set('collectionPhone', value)}
            requiredDate
            requiredTime
            minDate={todayKey || undefined}
            now={clockNow}
            errors={showValidation ? collectionErrors : undefined}
          />

          </section>
          <section className="approved-postload-stop-section"><h3>Delivery Details</h3>
          <StopFields
            title="Delivery"
            timeMode={deliveryMode}
            onTimeMode={(value) => setDeliveryMode(value as typeof deliveryMode)}
            endTime={deliveryEnd}
            onEndTime={setDeliveryEnd}
            town={form.deliveryTown}
            townError={showValidation ? townErrors.delivery : undefined}
            date={form.deliveryDate}
            time={form.deliveryTime}
            postcode={form.deliveryPostcode}
            address={form.deliveryAddress}
            contact={form.deliveryContact}
            phone={form.deliveryPhone}
            onDate={(value) => setForm((current) => ({
              ...current,
              deliveryDate: value,
              deliveryTime: availableQuarterHourSlots(value, clockNow).includes(current.deliveryTime) ? current.deliveryTime : '',
            }))}
            onTime={(value) => set('deliveryTime', value)}
            onPostcode={(value) => setForm(current => ({...current,deliveryPostcode:value.toUpperCase(),deliveryTown:''}))}
            onAddress={(value) => setForm(current => ({ ...current, deliveryAddress: value, deliveryTown: townFromPostingAddress(value, current.deliveryPostcode) || current.deliveryTown }))}
            onTown={(value) => set('deliveryTown', value)}
            onContact={(value) => set('deliveryContact', value)}
            onPhone={(value) => set('deliveryPhone', value)}
            minDate={minimumRouteDate || undefined}
            now={clockNow}
            errors={showValidation ? deliveryErrors : undefined}
          />

          </section>
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
                        time: availableQuarterHourSlots(value, clockNow).includes(stop.time) ? stop.time : '',
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
      </div>

      <Panel style={{ order: 4 }} title="Job Details" description="The live load details shown to authorised XDrive carriers.">
        <div className="approved-postload-job-columns">
          <div className="approved-postload-job-fields">
            <label style={labelStyle}>Job Description *<select style={fieldStyle} value={jobDescription} onChange={(event) => setJobDescription(event.target.value)}>{['Deliver Direct','Same Day - Timed','Next Day','Regular Load','Daily Hire'].map((v) => <option key={v}>{v}</option>)}</select></label>
            <label style={labelStyle}>Suggested Vehicle *
              <select style={fieldStyle} value={form.vehicle} onChange={(event) => setVehicle(event.target.value)}>
                {VEHICLES.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label style={labelStyle}>Packaging / cargo
              <select style={fieldStyle} value={form.cargo} onChange={(event) => set('cargo', event.target.value)}>
                {CARGO.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <div className="approved-postload-job-metrics">
              {([['itemCount', 'No. of Items'], ['weight', 'Gross Load Weight (kg)'], ['pallets', 'Pallets']] as const).map(([key, label]) => (
                <label key={key} style={labelStyle}>{key === 'weight' ? `Gross Load Weight (${weightUnit})` : label}
                  {key === 'weight' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 76px', gap: 6 }}>
                      <input aria-label="Gross Load Weight" style={{ ...fieldStyle, ...(showValidation && numericErrors[key] ? invalidFieldStyle : {}) }} aria-invalid={showValidation && Boolean(numericErrors[key])} type="number" min="0" step="any" value={displayPostLoadMeasurement(form.weight, weightUnit, 'kg')} onChange={(event) => set('weight', convertPostLoadMeasurement(event.target.value, weightUnit, 'kg'))} />
                      <select aria-label="Weight unit" style={fieldStyle} value={weightUnit} onChange={(event) => setWeightUnit(event.target.value as PostLoadWeightUnit)}>
                        <option value="kg">kg</option><option value="lb">lbs</option><option value="t">t</option>
                      </select>
                    </div>
                  ) : (
                    <input style={{ ...fieldStyle, ...(showValidation && numericErrors[key] ? invalidFieldStyle : {}) }} aria-invalid={showValidation && Boolean(numericErrors[key])} type="number" min="0" value={form[key]} onChange={(event) => set(key, event.target.value)} />
                  )}
                </label>
              ))}
            </div>
            <label style={labelStyle}>Body Type<select style={fieldStyle} value={bodyType} onChange={(event) => setBodyType(event.target.value)}>{['n/a','Box','Curtainside','Flatbed','Refrigerated','Other'].map((v) => <option key={v}>{v}</option>)}</select></label>
            <label style={labelStyle}>Job Type<select style={fieldStyle} value={jobType} onChange={(event) => setJobType(event.target.value as typeof jobType)}><option>Hotshot</option><option>Backload</option></select></label>
            <label style={labelStyle}>Pallet type
              <select style={fieldStyle} value={form.palletType} onChange={(event) => set('palletType', event.target.value)}>
                <option value="">Not specified</option>
                <option value="UK Standard">UK Standard</option>
                <option value="Euro">Euro</option>
                <option value="Oversized">Oversized</option>
                <option value="Custom">Custom</option>
              </select>
            </label>
          </div>
          <details open={showOptional} className="approved-postload-job-additional">
            <summary>Additional Options</summary>
            <div className="approved-postload-job-fields">
              <div className="approved-postload-job-metrics"><label style={labelStyle}>Loading Metres<input style={fieldStyle} type="number" min="0" step="0.01" value={loadingMetres} onChange={(event) => setLoadingMetres(event.target.value)} /></label><label style={labelStyle}>Cubic Metres<input style={fieldStyle} type="number" min="0" step="0.01" value={cubicMetres} onChange={(event) => setCubicMetres(event.target.value)} /></label></div>
              <label style={labelStyle}>Dimension unit
                <select aria-label="Dimension unit" style={{ ...fieldStyle, maxWidth: 140 }} value={dimensionUnit} onChange={(event) => setDimensionUnit(event.target.value as PostLoadDimensionUnit)}>
                  <option value="cm">cm</option><option value="m">m</option><option value="in">in</option><option value="ft">ft</option>
                </select>
              </label>
              <div className="approved-postload-job-metrics">
                {([['length', 'Length (cm)'], ['width', 'Width (cm)'], ['height', 'Height (cm)']] as const).map(([key, label]) => (
                  <label key={key} style={labelStyle}>{dimensionUnit === 'cm' ? label : `${key.charAt(0).toUpperCase() + key.slice(1)} (${dimensionUnit})`}
                    <input style={{ ...fieldStyle, ...(showValidation && dimensionErrors[key] ? invalidFieldStyle : {}) }} aria-invalid={showValidation && Boolean(dimensionErrors[key])} type="number" min="0" step="any" value={displayPostLoadMeasurement(form[key], dimensionUnit, 'cm')} onChange={(event) => set(key, convertPostLoadMeasurement(event.target.value, dimensionUnit, 'cm'))} />
                  </label>
                ))}
              </div>
              <div className="approved-postload-job-metrics">
                <label style={labelStyle}>Cargo value (£)
                  <input style={fieldStyle} type="number" min="0" value={form.cargoValue} onChange={(event) => set('cargoValue', event.target.value)} />
                </label>
                <label style={labelStyle}>Stackable
                  <select style={fieldStyle} value={form.palletStackable} onChange={(event) => set('palletStackable', event.target.value)}>
                    <option value="">Not specified</option><option value="yes">Yes</option><option value="no">No</option>
                  </select>
                </label>
              </div>
              <div className="approved-postload-check-grid">
                {([['tailLift', 'Tail Lift'], ['forklift', 'Forklift at collection'], ['handball', 'Handball'], ['deliveryTailLift', 'Tail Lift at delivery'], ['deliveryForklift', 'Forklift at delivery'], ['deliveryHandball', 'Delivery handball'], ['pumpTruck', 'Pump Truck'], ['twoPersonCrew', 'Two Man'], ['dedicatedVehicle', 'Dedicated Vehicle'], ['adr', 'ADR'], ['temperatureControlled', 'Temperature Controlled'], ['fragile', 'Fragile Goods']] as const).map(([key, label]) => (
                  <label key={key} className="approved-postload-check">
                    <input type="checkbox" checked={form[key]} onChange={(event) => set(key, event.target.checked)} /> {label}
                  </label>
                ))}
              </div>
              <div className="approved-postload-check-grid">
                {([['waitReturn','Wait & Return',waitReturn,setWaitReturn],['hiab','Hiab',hiab,setHiab],['trailer','Trailer',trailer,setTrailer],['moffett','Moffett Mounty',moffett,setMoffett]] as const).map(([key,label,value,setter]) => <label key={key} className="approved-postload-check"><input type="checkbox" checked={value} onChange={(event) => setter(event.target.checked)}/>{label}</label>)}
              </div>
              <span className="approved-postload-dimension-hint">{dimensionSummary}</span>
            </div>
          </details>
        </div>
      </Panel>
      <Panel style={{ order: 8 }} title="Documents" description="Only authorised parties to the job may access these private documents.">
        <div className="approved-postload-documents">
          <label style={labelStyle}>Document Name
            <input style={fieldStyle} value={documentName} maxLength={160} placeholder="e.g. Collection instruction" onChange={(event) => setDocumentName(event.target.value)} />
          </label>
          <label style={labelStyle}>Upload Document (maximum 12 MB)
            <input
              ref={documentInputRef}
              style={{ ...fieldStyle, padding: '5px 8px', minHeight: '38px' }}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.csv,.doc,.docx,.xls,.xlsx"
              onChange={(event) => {
                const added = Array.from(event.target.files ?? []);
                setDocumentFiles((current) => [...current, ...added].slice(0, MAX_DOCUMENT_FILES));
                if (documentName.trim()) setDocumentNames((current) => Object.fromEntries([...Object.entries(current), ...added.map((file) => [file.name, documentName.trim()])]));
                event.target.value = '';
              }}
            />
            <span>Accepted: jpg, jpeg, png, pdf, doc, docx, xls, xlsx, csv. Maximum 12 MB per file.</span>
          </label>
          <div className="approved-postload-document-actions">
            <button type="button" onClick={() => documentInputRef.current?.click()} disabled={saving || documentFiles.length >= MAX_DOCUMENT_FILES}>+ Add Document</button>
          </div>
          {documentFiles.map((file, index) => <div key={file.name + index} className="approved-postload-document-row">
            <span>{documentNames[file.name] || file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</span>
            <button type="button" onClick={() => setDocumentFiles((current) => current.filter((_, i) => i !== index))} disabled={saving}>Remove</button>
          </div>)}
          <details open={showOptional} className="approved-postload-customer-optional">
            <summary>Document checklist and site access restrictions</summary>
            <div className="xdrive-postload-requirements-grid">
              <label style={labelStyle}>Collection access restrictions
                <textarea style={textareaStyle} value={form.collectionAccessRestrictions} onChange={(event) => set('collectionAccessRestrictions', event.target.value)} />
              </label>
              <label style={labelStyle}>Delivery access restrictions
                <textarea style={textareaStyle} value={form.deliveryAccessRestrictions} onChange={(event) => set('deliveryAccessRestrictions', event.target.value)} />
              </label>
              <label style={labelStyle}>Document checklist
                <textarea style={textareaStyle} value={form.documentChecklist} onChange={(event) => set('documentChecklist', event.target.value)} />
              </label>
            </div>
          </details>
        </div>
      </Panel>
      <Panel style={{ order: 5 }} title="Notes" description="Quote-visible notes and private delivery instructions.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '12px' }}>
          <label style={labelStyle}>
            Public quote notes
            <textarea
              style={textareaStyle}
              maxLength={1000}
              value={form.publicQuoteNotes}
              onChange={(event) => set('publicQuoteNotes', event.target.value)}
              placeholder="Visible before award: pricing-relevant information only, e.g. timed collection, 1 pallet, assistance unavailable. Do not put gate codes, contact names or exact access instructions here."
            />
            <span className="approved-postload-counter">{form.publicQuoteNotes.length} / 1000</span>
            <span style={{ color: '#64748b', fontWeight: 500 }}>Visible to eligible Marketplace users before they quote.</span>
          </label>
          <label style={labelStyle}>
            Private execution instructions
            <textarea
              style={textareaStyle}
              maxLength={1000}
              value={form.executionInstructions}
              onChange={(event) => set('executionInstructions', event.target.value)}
              placeholder="Released only after authorised award/allocation: gate codes, loading-bay instructions, site-specific notes and other execution detail."
            />
            <span style={{ color: '#64748b', fontWeight: 500 }}>Hidden from the pre-award Marketplace and available to authorised execution users.</span>
          </label>
        </div>
      </Panel>

      <div className="xdrive-postload-actions" style={{order:99}}>
        <span className="approved-postload-required-note">* Required Inputs</span>
        <button type="button" className="approved-postload-cancel" disabled={saving} onClick={() => router.back()}>Cancel</button>
        <ActionButton tone="secondary" disabled={saving || Boolean(directCarrierId && !directCarrier)} onClick={() => void save(true, true)}>{saving ? 'Posting…' : 'Post Load & Save for Repeat Use'}</ActionButton>
        <ActionButton tone="warning" disabled={saving || Boolean(directCarrierId && !directCarrier)} onClick={() => void save(true)}>
          {saving ? 'Publishing…' : directCarrierId ? 'Send Direct Booking' : directTargetMode === 'external_subcontractor' ? 'Confirm External Booking' : directTargetMode === 'internal_resource' ? 'Create & Allocate Booking' : 'Post Load'}
        </ActionButton>
      </div>
    </div>
  );
}

function StopFields({
  title, town, townError, date, time, postcode, address, contact, phone,
  timeMode, onTimeMode, endTime, onEndTime,
  onDate, onTime, onPostcode, onAddress, onTown, onContact, onPhone,
  requiredDate = false, requiredTime = false, minDate, now, errors,
}: {
  title: string;
  timeMode?: string;
  onTimeMode?: (value: string) => void;
  endTime?: string;
  onEndTime?: (value: string) => void;
  town?: string;
  townError?: string;
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
  onTown?: (value: string) => void;
  onContact: (value: string) => void;
  onPhone: (value: string) => void;
  requiredDate?: boolean;
  requiredTime?: boolean;
  minDate?: string;
  now: Date | null;
  errors?: StopFieldErrors;
}) {
  const timeOptions = availableQuarterHourSlots(date, now);
  const selectedTimeUnavailable = Boolean(time && !timeOptions.includes(time));
  const noSlotsLeftToday = Boolean(date && now && date === localDateKey(now) && timeOptions.length === 0);
  const pickup = title === 'Collection' || title === 'Collection stop';
  return (
    <div className="approved-postload-stop-fields">
      <div className="approved-postload-location-fields">
        {onTown && <label style={labelStyle}>{pickup ? 'Collection' : 'Delivery'} town (public) *
          <input
            style={{ ...fieldStyle, ...(townError ? invalidFieldStyle : {}) }}
            aria-invalid={Boolean(townError)}
            value={town ?? ''}
            placeholder="e.g. Manchester"
            onChange={(event) => onTown(event.target.value)}
            required
          />
          {townError && <span style={validationMessageStyle}>{townError}</span>}
        </label>}
        <label style={labelStyle}>Full postcode (private until award) *
          <input
            style={{ ...fieldStyle, ...(errors?.postcode ? invalidFieldStyle : {}) }}
            aria-invalid={Boolean(errors?.postcode)}
            autoCapitalize="characters"
            value={postcode}
            placeholder="e.g. BB1 1AA"
            onChange={(event) => onPostcode(event.target.value)}
          />
          {errors?.postcode && <span style={validationMessageStyle}>{errors.postcode}</span>}
        </label>
      </div>
      <PostcodeAddressField postcode={postcode} address={address} onAddress={onAddress} onTown={onTown} onPostcodeResolved={onPostcode} error={errors?.address} />
      <div className="approved-postload-contact-fields">
        <label style={labelStyle}>Contact name
          <input style={fieldStyle} value={contact} onChange={(event) => onContact(event.target.value)} />
        </label>
        <label style={labelStyle}>Telephone
          <input style={fieldStyle} value={phone} onChange={(event) => onPhone(event.target.value)} />
        </label>
      </div>
      {onTimeMode && <div className="approved-postload-time-modes" role="group" aria-label={`${title} time mode`}>
        {(pickup ? ['Between', 'At', 'Before', 'ASAP'] : ['ASAP', 'At', 'By', 'Between']).map((value) => <button type="button" key={value} aria-pressed={timeMode === value} onClick={() => onTimeMode(value)}>{value}</button>)}
      </div>}
      <div className="approved-postload-schedule-fields">
        <label style={labelStyle}>{pickup ? 'Collection' : 'Delivery'} date{requiredDate ? ' *' : ''}
          <input
            style={{ ...fieldStyle, ...(errors?.date ? invalidFieldStyle : {}) }}
            aria-invalid={Boolean(errors?.date)}
            type="date"
            aria-label={title + ' date'}
            aria-required={requiredDate}
            min={minDate}
            value={date}
            onChange={(event) => onDate(event.target.value)}
          />
          {errors?.date && <span style={validationMessageStyle}>{errors.date}</span>}
        </label>
        {timeMode !== 'ASAP' && <label style={labelStyle}>{timeMode === 'Between' ? 'From' : timeMode === 'Before' || timeMode === 'By' ? 'By' : 'At'}{requiredTime || date ? ' *' : ''}
          <select
            style={{ ...fieldStyle, ...(errors?.time ? invalidFieldStyle : {}) }}
            aria-invalid={Boolean(errors?.time)}
            aria-label={title + ' time'}
            aria-required={requiredTime || Boolean(date)}
            value={time}
            disabled={!date || noSlotsLeftToday}
            onChange={(event) => onTime(event.target.value)}
          >
            <option value="">{!date ? 'Select date first' : noSlotsLeftToday ? 'No slots left today' : 'Select time'}</option>
            {selectedTimeUnavailable && <option value={time} disabled>{time} — no longer available</option>}
            {timeOptions.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
          </select>
          {errors?.time && <span style={validationMessageStyle}>{errors.time}</span>}
          {!errors?.time && noSlotsLeftToday && <span style={{ color: '#64748b', fontSize: '10px' }}>No future slots today — choose tomorrow.</span>}
        </label>}
        {timeMode === 'Between' && onEndTime && <label style={labelStyle}>To
          <select style={fieldStyle} value={endTime ?? ''} onChange={(event) => onEndTime(event.target.value)}>
            <option value="">Select end time</option>
            {QUARTER_HOUR_SLOTS.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
          </select>
        </label>}
      </div>
    </div>
  );
}

const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '8px' };
