'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { workspaceJobPresentationStatus } from '../../../lib/jobs/workspaceJobStage';
import { supabase } from '../../../lib/supabaseClient';
import { MemberIdentityLink } from './MemberProfile';
import WorkspaceJobReplay from './WorkspaceJobReplay';
import { ActionButton, AlertBanner, EmptyState, StatusBadge } from './WorkspaceUI';

type JobSheet = {
  jobId: string;
  viewerWorkspace?: 'broker' | 'customer' | 'carrier';
  viewerCompanyId?: string | null;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
  acceptedAt: string | null;
  ownerCompany: { companyId: string; name: string; memberId: string | null; phone: string | null; type: string | null };
  carrier: { companyId: string; name: string; memberId: string | null; phone: string | null; type: string | null } | null;
  executionCompany: { companyId: string; name: string; memberId: string | null; phone: string | null; type: string | null } | null;
  acceptedBidRecorded: boolean;
  acceptedBidderDriver: { id: string; name: string | null; status: string | null } | null;
  driver: { id: string; name: string | null; status: string | null } | null;
  vehicle: {
    id: string;
    registration: string | null;
    type: string | null;
    make: string | null;
    model: string | null;
    bodyType: string | null;
    payloadKg: number | null;
    palletsCapacity: number | null;
    hasTailLift: boolean | null;
  } | null;
  customer: { name: string | null; email: string | null; phone: string | null };
  references: { booking: string | null; customer: string | null; purchaseOrder: string | null; xdrive: string };
  route: {
    pickup: { address: string | null; postcode: string | null; dateTime: string | null; slot: string | null; contactName: string | null; contactPhone: string | null; notes: string | null };
    delivery: { address: string | null; postcode: string | null; dateTime: string | null; slot: string | null; contactName: string | null; contactPhone: string | null; notes: string | null };
    stops?: Array<{
      id: string | null;
      sequence: number | null;
      type: string;
      address: string | null;
      postcode: string | null;
      companyName: string | null;
      contactName: string | null;
      contactPhone: string | null;
      windowStart: string | null;
      windowEnd: string | null;
      instructions: string | null;
      status: string | null;
      arrivedAt: string | null;
      completedAt: string | null;
    }>;
    distanceMiles: number | null;
  };
  load: {
    requestedVehicle: string | null; cargoType: string | null; weightKg: number | null; pallets: number | null;
    lengthCm: number | null; widthCm: number | null; heightCm: number | null; cargoValueGbp: number | null;
    palletType: string | null; stackable: boolean | null; requirements: string[];
  };
  commercial: {
    customerPrice: number | null; carrierCost: number | null; margin: number | null; currency: string; paymentTerms: string | null;
    paymentDueDays: number | null; vatRate: number | null; vatAmount: number | null; agreedGross: number | null;
    snapshotAvailable: boolean; targetCarrierCost: number | null;
  };
  pod: { required: boolean | null; hardCopy: string | null; generated: boolean | null; generatedAt: string | null; photoCount: number; reviewStatus: string | null; reviewNote: string | null };
  notes: { publicQuoteNotes: string | null; executionInstructions: string | null; collection: string | null; delivery: string | null; driver: string | null; documentChecklist: string[] };
  timeline: Array<{ id: string | null; eventType: string; message: string | null; createdAt: string | null; userName: string | null }>;
  documents: Array<{ id: string | null; type: string; fileName: string | null; filePath: string | null; createdAt: string | null }>;
  invoices: Array<{ id: string | null; number: string | null; status: string | null; paymentStatus: string | null; amount: number | null; currency: string; dueDate: string | null }>;
  partial: boolean;
  unavailable: { bodyType: string; bookingFooter: string; extras: string };
};

type Tab = 'order' | 'notes' | 'history' | 'replay' | 'documents' | 'pod' | 'invoice';
type SheetMode = 'broker' | 'customer' | 'carrier';
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'order', label: 'Order' }, { id: 'notes', label: 'Notes' }, { id: 'history', label: 'History' },
  { id: 'replay', label: 'Replay' }, { id: 'documents', label: 'Documents' }, { id: 'pod', label: 'POD' }, { id: 'invoice', label: 'Invoice' },
];

const when = (value: string | null) => value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not supplied';
const money = (value: number | null, currency = 'GBP') => value == null ? 'Not supplied' : new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);
const human = (value: string | null | undefined) => value ? value.replace(/_/g, ' ') : 'Not supplied';

function normalizeComparable(value: string | null | undefined) {
  return (value ?? '').trim().replace(/[,.]+$/g, '').replace(/\s+/g, ' ').toUpperCase();
}

function formatExecutionAddress(address: string | null, postcode: string | null) {
  const cleanAddress = address?.trim() || '';
  const cleanPostcode = postcode?.trim() || '';
  if (!cleanAddress) return cleanPostcode || 'Not supplied';
  if (!cleanPostcode) return cleanAddress;
  const addressComparable = normalizeComparable(cleanAddress);
  const postcodeComparable = normalizeComparable(cleanPostcode);
  return addressComparable.includes(postcodeComparable) ? cleanAddress : `${cleanAddress}, ${cleanPostcode}`;
}

function rawDateLabel(value: string | null) {
  const raw = value?.trim();
  if (!raw) return 'Date not supplied';
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return when(value);
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.toLocaleDateString('en-GB', { dateStyle: 'medium' });
}

function formatScheduleDetail(dateTime: string | null, slot: string | null) {
  const cleanSlot = slot?.trim();
  if (!cleanSlot) return when(dateTime);
  const isClockOrWindow = /^\d{1,2}:\d{2}(?:\s*[-–]\s*\d{1,2}:\d{2})?$/.test(cleanSlot);
  if (isClockOrWindow || cleanSlot.toUpperCase() === 'ASAP') return `${rawDateLabel(dateTime)} · ${cleanSlot}`;
  return `${when(dateTime)} · ${cleanSlot}`;
}

function formatStopSchedule(windowStart: string | null, windowEnd: string | null) {
  if (!windowEnd) return when(windowStart);
  return `${when(windowStart)} → ${when(windowEnd)}`;
}

function availabilityCopy(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  const normalized = value.toLowerCase();
  if (normalized.includes('immutable') || normalized.includes('snapshot') || normalized.includes('verified data contract')) return fallback;
  return value;
}

function companyDetail(companyNumber: string | null, phone: string | null) {
  return [companyNumber ? `Company no. ${companyNumber}` : null, phone].filter(Boolean).join(' · ') || undefined;
}

function Detail({ label, value, detail }: { label: string; value: ReactNode; detail?: ReactNode }) {
  return <div className="workspace-detail-item"><strong>{label}</strong><div>{value}</div>{detail ? <small>{detail}</small> : null}</div>;
}

export function CompanyJobSheetPanel({ jobId, mode }: { jobId: string; mode: SheetMode }) {
  const [sheet, setSheet] = useState<JobSheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('order');

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true); setError('');
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        if (!token) throw new Error('Session expired.');
        const response = await fetch(`/api/workspace/jobs/${encodeURIComponent(jobId)}/sheet`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
        const payload = await response.json().catch(() => ({})) as { sheet?: JobSheet; error?: string };
        if (!response.ok || !payload.sheet) throw new Error(payload.error || 'Job sheet unavailable.');
        if (!cancelled) setSheet(payload.sheet);
      } catch (reason) {
        if (!cancelled) { setSheet(null); setError(reason instanceof Error ? reason.message : 'Job sheet unavailable.'); }
      } finally { if (!cancelled) setLoading(false); }
    };
    void run();
    return () => { cancelled = true; };
  }, [jobId]);

  const dimensions = useMemo(() => {
    if (!sheet) return 'Not supplied';
    const values = [sheet.load.lengthCm, sheet.load.widthCm, sheet.load.heightCm];
    return values.every((value) => value == null) ? 'Not supplied' : `${values.map((value) => value == null ? '—' : value).join(' × ')} cm`;
  }, [sheet]);

  if (loading) return <EmptyState compact title="Loading job sheet…" />;
  if (error || !sheet) return <AlertBanner tone="warning">{error || 'Job sheet unavailable.'}</AlertBanner>;

  const visibleNotes = [
    ['Public quote notes', sheet.notes.publicQuoteNotes],
    ['Private execution instructions', sheet.notes.executionInstructions],
    ['Collection notes', sheet.notes.collection],
    ['Delivery notes', sheet.notes.delivery],
    ['Driver notes', sheet.notes.driver],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
  const bookingNotes = [
    ['Public quote notes retained on booking', sheet.notes.publicQuoteNotes],
    ['Private execution instructions', sheet.notes.executionInstructions],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
  const hardCopyPod = sheet.pod.hardCopy
    ?? (sheet.pod.required === true
      ? 'POD required; hard-copy requirement not separately supplied'
      : sheet.pod.required === false
        ? 'Not required'
        : 'Not supplied');
  const podState = sheet.pod.generated
    ? { label: 'POD generated', tone: 'green' as const, detail: sheet.pod.photoCount > 0 ? `${sheet.pod.photoCount} evidence file(s)` : 'Generated POD record' }
    : sheet.pod.photoCount > 0
      ? { label: 'Delivery evidence', tone: 'blue' as const, detail: `${sheet.pod.photoCount} photo/evidence file(s); generated POD not confirmed` }
      : sheet.pod.required === false
        ? { label: 'Not required', tone: 'grey' as const, detail: 'This booking does not require POD evidence.' }
        : sheet.pod.required === true
          ? { label: 'Pending', tone: 'orange' as const, detail: 'POD is required and no generated POD or delivery evidence is recorded.' }
          : { label: 'Requirement not supplied', tone: 'grey' as const, detail: 'The booking does not state whether POD is required; no evidence is inferred.' };
  const carrierMode = mode === 'carrier';
  const presentationStatus = workspaceJobPresentationStatus({
    status: sheet.status,
    awarded_carrier_company_id: sheet.carrier?.companyId ?? null,
    assigned_driver_id: sheet.driver?.id ?? null,
    vehicle_id: sheet.vehicle?.id ?? null,
  });
  const allocatedVehicleLabel = sheet.vehicle
    ? [sheet.vehicle.registration, sheet.vehicle.make, sheet.vehicle.model].filter(Boolean).join(' · ') || human(sheet.vehicle.type)
    : 'Not assigned';
  const allocatedVehicleDetail = sheet.vehicle
    ? [
        sheet.vehicle.type ? human(sheet.vehicle.type) : null,
        sheet.vehicle.bodyType ? human(sheet.vehicle.bodyType) : null,
        sheet.vehicle.payloadKg != null ? `${sheet.vehicle.payloadKg} kg payload` : null,
        sheet.vehicle.palletsCapacity != null ? `${sheet.vehicle.palletsCapacity} pallet capacity` : null,
        sheet.vehicle.hasTailLift === true ? 'Tail lift' : null,
      ].filter(Boolean).join(' · ') || undefined
    : undefined;
  const acceptedBidderDriverLabel = sheet.acceptedBidderDriver
    ? sheet.acceptedBidderDriver.name ?? `Driver ${sheet.acceptedBidderDriver.id.slice(0, 8).toUpperCase()}`
    : sheet.acceptedBidRecorded
      ? 'Company-level accepted bid'
      : 'Not recorded';
  const acceptedBidderDriverDetail = sheet.acceptedBidderDriver
    ? `Accepted bid driver ${sheet.acceptedBidderDriver.id.slice(0, 8).toUpperCase()}${sheet.acceptedBidderDriver.status ? ` · Account ${human(sheet.acceptedBidderDriver.status)}` : ''}`
    : sheet.acceptedBidRecorded
      ? 'No named bidder driver is recorded on the accepted bid.'
      : undefined;
  const routeStops = sheet.route.stops ?? [];
  const hasPersistedRoute = routeStops.length >= 2;

  return (
    <div className="workspace-record-details" style={{ padding: 0 }}>
      {sheet.partial && <AlertBanner tone="warning">Some booking details are unavailable. Verified values are shown and missing values are left unfilled.</AlertBanner>}
      <div className="workspace-tab-strip" role="tablist" aria-label="Job sheet sections" style={{ display: 'flex', overflowX: 'auto', marginBottom: 6 }}>
        {TABS.map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} data-active={tab === item.id ? 'true' : 'false'} onClick={() => setTab(item.id)}>{item.label}{item.id === 'documents' && sheet.documents.length ? ` ${sheet.documents.length}` : ''}</button>)}
      </div>

      {tab === 'order' && (
        <div style={{ display: 'grid', gap: 8 }}>
          <div className="workspace-detail-grid">
            <Detail label="XDrive reference" value={sheet.references.xdrive} detail={sheet.references.booking ? `Customer booking ref ${sheet.references.booking}` : undefined} />
            <Detail label="Status" value={<StatusBadge value={presentationStatus} />} detail={sheet.acceptedAt ? `Awarded ${when(sheet.acceptedAt)}` : undefined} />
            <Detail label="Posting company" value={<MemberIdentityLink companyId={sheet.ownerCompany.companyId}>{sheet.ownerCompany.name}</MemberIdentityLink>} detail={companyDetail(sheet.ownerCompany.memberId, sheet.ownerCompany.phone)} />
            <Detail label="Awarded carrier" value={sheet.carrier ? <MemberIdentityLink companyId={sheet.carrier.companyId}>{sheet.carrier.name}</MemberIdentityLink> : 'Not awarded'} detail={sheet.carrier ? companyDetail(sheet.carrier.memberId, sheet.carrier.phone) : undefined} />
            <Detail label="Accepted bidder driver" value={acceptedBidderDriverLabel} detail={acceptedBidderDriverDetail} />
            <Detail label="Execution company" value={sheet.executionCompany ? <MemberIdentityLink companyId={sheet.executionCompany.companyId}>{sheet.executionCompany.name}</MemberIdentityLink> : 'Not assigned'} detail={sheet.executionCompany ? companyDetail(sheet.executionCompany.memberId, sheet.executionCompany.phone) : undefined} />
            <Detail label="Assigned driver" value={sheet.driver?.name ?? 'Not assigned'} detail={sheet.driver?.status ? `Account ${human(sheet.driver.status)}` : undefined} />
            <Detail label="Allocated vehicle" value={allocatedVehicleLabel} detail={allocatedVehicleDetail} />
            <Detail label="Requested vehicle" value={human(sheet.load.requestedVehicle)} />
            <Detail label="Body type" value={sheet.vehicle?.bodyType ? human(sheet.vehicle.bodyType) : 'Not supplied'} detail={!sheet.vehicle?.bodyType ? availabilityCopy(sheet.unavailable.bodyType, 'Not available for this booking.') : undefined} />
            <Detail label="Cargo" value={human(sheet.load.cargoType)} detail={[sheet.load.weightKg != null ? `${sheet.load.weightKg} kg` : null, sheet.load.pallets != null ? `${sheet.load.pallets} pallet(s)` : null].filter(Boolean).join(' · ') || undefined} />
            <Detail label="Dimensions" value={dimensions} />
            <Detail label="Cargo value" value={money(sheet.load.cargoValueGbp)} />
            <Detail label="Distance" value={sheet.route.distanceMiles != null ? `${sheet.route.distanceMiles} miles` : 'Not supplied'} />
            <Detail label="Customer" value={sheet.customer.name ?? 'Not supplied'} detail={mode === 'broker' ? [sheet.customer.email, sheet.customer.phone].filter(Boolean).join(' · ') || undefined : undefined} />
            <Detail label="Customer ref" value={sheet.references.customer ?? 'Not supplied'} />
            <Detail label="PO number" value={sheet.references.purchaseOrder ?? 'Not supplied'} />
            {!carrierMode && <Detail label="Customer price" value={money(sheet.commercial.customerPrice, sheet.commercial.currency)} />}
            <Detail label={carrierMode ? 'Agreed carrier rate' : 'Carrier cost'} value={money(sheet.commercial.carrierCost, sheet.commercial.currency)} detail={sheet.commercial.snapshotAvailable ? 'Agreed rate recorded at award' : 'Historical agreed-rate record unavailable'} />
            {mode === 'broker' && <Detail label="Margin" value={money(sheet.commercial.margin, sheet.commercial.currency)} detail={sheet.commercial.targetCarrierCost != null ? `Target carrier cost ${money(sheet.commercial.targetCarrierCost, sheet.commercial.currency)}` : undefined} />}
            <Detail label="Payment terms" value={sheet.commercial.paymentTerms ?? 'Historical terms unavailable'} detail={sheet.commercial.paymentDueDays != null ? `${sheet.commercial.paymentDueDays} day(s)` : undefined} />
            <Detail label="Extras" value="Not supplied" detail={availabilityCopy(sheet.unavailable.extras, 'No historical extras record is available for this booking.')} />
            <Detail label="Hard-copy POD" value={hardCopyPod} />
          </div>

          <div className="workspace-detail-grid">
            {hasPersistedRoute ? routeStops.map((stop, index) => {
              const sequence = stop.sequence ?? index + 1;
              const routeDetail = [
                formatStopSchedule(stop.windowStart, stop.windowEnd),
                stop.status ? `Status ${human(stop.status)}` : null,
              ].filter(Boolean).join(' · ');
              const contactDetail = [stop.companyName, stop.contactPhone, stop.instructions].filter(Boolean).join(' · ') || undefined;
              return [
                <Detail
                  key={`${stop.id ?? sequence}-route`}
                  label={`Stop ${sequence} · ${human(stop.type)}`}
                  value={formatExecutionAddress(stop.address, stop.postcode)}
                  detail={routeDetail}
                />,
                <Detail
                  key={`${stop.id ?? sequence}-contact`}
                  label={`Stop ${sequence} contact`}
                  value={stop.contactName ?? 'Not supplied'}
                  detail={contactDetail}
                />,
              ];
            }) : (
              <>
                <Detail label="Pickup" value={formatExecutionAddress(sheet.route.pickup.address, sheet.route.pickup.postcode)} detail={formatScheduleDetail(sheet.route.pickup.dateTime, sheet.route.pickup.slot)} />
                <Detail label="Pickup contact" value={sheet.route.pickup.contactName ?? 'Not supplied'} detail={sheet.route.pickup.contactPhone ?? undefined} />
                <Detail label="Delivery" value={formatExecutionAddress(sheet.route.delivery.address, sheet.route.delivery.postcode)} detail={formatScheduleDetail(sheet.route.delivery.dateTime, sheet.route.delivery.slot)} />
                <Detail label="Delivery contact" value={sheet.route.delivery.contactName ?? 'Not supplied'} detail={sheet.route.delivery.contactPhone ?? undefined} />
              </>
            )}
          </div>

          {bookingNotes.length > 0 && (
            <div style={{ display: 'grid', gap: 6 }}>
              <strong>Notes &amp; Details</strong>
              {bookingNotes.map(([label, value]) => <div key={label} className="workspace-detail-item"><strong>{label}</strong><div>{value}</div></div>)}
            </div>
          )}
          {sheet.load.requirements.length > 0 && <div className="workspace-record-meta"><span><strong>Requirements:</strong> {sheet.load.requirements.join(' · ')}</span></div>}
          {sheet.notes.documentChecklist.length > 0 && <div className="workspace-record-meta"><span><strong>Paperwork:</strong> {sheet.notes.documentChecklist.join(' · ')}</span></div>}
          <div className="workspace-detail-item"><strong>Booking footer / working instructions</strong><div>Unavailable</div><small>{availabilityCopy(sheet.unavailable.bookingFooter, 'Not available for this historical booking.')}</small></div>
        </div>
      )}

      {tab === 'notes' && (visibleNotes.length ? <div style={{ display: 'grid', gap: 6 }}>{visibleNotes.map(([label, value]) => <div key={label} className="workspace-detail-item"><strong>{label}</strong><div>{value}</div></div>)}</div> : <EmptyState compact title="No notes recorded" />)}

      {tab === 'history' && (sheet.timeline.length ? <div style={{ display: 'grid' }}>{[...sheet.timeline].reverse().map((event, index) => <div key={event.id ?? `${event.eventType}-${index}`} className="workspace-record-meta"><span><strong>{human(event.eventType)}</strong></span><span>{when(event.createdAt)}</span><span>{event.message ?? event.userName ?? 'Operational update'}</span></div>)}</div> : <EmptyState compact title="No history events recorded" />)}

      {tab === 'replay' && <WorkspaceJobReplay jobId={jobId} />}

      {tab === 'documents' && (sheet.documents.length ? <div style={{ display: 'grid' }}>{sheet.documents.map((document, index) => <div key={document.id ?? `${document.fileName}-${index}`} className="workspace-record-meta"><span><strong>{document.fileName ?? document.type}</strong></span><span>{human(document.type)}</span><span>{when(document.createdAt)}</span>{document.filePath?.startsWith('http') ? <ActionButton tone="secondary" onClick={() => window.open(document.filePath ?? '', '_blank', 'noopener,noreferrer')}>Open</ActionButton> : <span>Stored securely</span>}</div>)}</div> : <EmptyState compact title="No job documents attached" />)}

      {tab === 'pod' && <div className="workspace-detail-grid"><Detail label="POD required" value={sheet.pod.required == null ? 'Not supplied' : sheet.pod.required ? 'Yes' : 'No'} /><Detail label="Hard-copy POD" value={hardCopyPod} /><Detail label="POD status" value={<StatusBadge value={podState.label} tone={podState.tone} />} detail={podState.detail} /><Detail label="Evidence files" value={sheet.pod.photoCount} /><Detail label="Generated" value={sheet.pod.generated ? when(sheet.pod.generatedAt) : 'Not confirmed'} /><Detail label="Review" value={human(sheet.pod.reviewStatus)} detail={sheet.pod.reviewNote ?? undefined} /></div>}

      {tab === 'invoice' && (sheet.invoices.length ? <div style={{ display: 'grid' }}>{sheet.invoices.map((invoice, index) => <div key={invoice.id ?? `${invoice.number}-${index}`} className="workspace-record-meta"><span><strong>{invoice.number ?? 'Invoice'}</strong></span><span>{money(invoice.amount, invoice.currency)}</span><span>{human(invoice.paymentStatus ?? invoice.status)}</span><span>{invoice.dueDate ? `Due ${when(invoice.dueDate)}` : 'No due date'}</span></div>)}</div> : <EmptyState compact title="No authorised invoice linked to this job" />)}
    </div>
  );
}
