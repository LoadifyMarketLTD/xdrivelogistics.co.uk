'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { workspaceJobOperationalLabel } from '../../../lib/jobs/workspaceJobStage';
import { supabase } from '../../../lib/supabaseClient';
import { MemberIdentityLink } from './MemberProfile';
import WorkspaceJobReplay from './WorkspaceJobReplay';
import { ActionButton, AlertBanner, EmptyState, StatusBadge } from './WorkspaceUI';
import CommercialAmendmentControls from './CommercialAmendmentControls';

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
    snapshotAvailable: boolean; agreementStatus: string | null; targetCarrierCost: number | null; agreementId: string | null; contractVersion: number | null; contractSnapshotHash: string | null;
  };
  evidence: { collectionPhotoCount: number; deliveryPhotoCount: number; podPhotoCount: number; collectionHandoverRecorded: boolean; deliverySignatureRecorded: boolean; recipientName: string | null };
  pod: { required: boolean; hardCopy: string | null; generated: boolean | null; generatedAt: string | null; photoCount: number; reviewStatus: string | null; reviewNote: string | null };
  notes: { publicQuoteNotes: string | null; executionInstructions: string | null; collection: string | null; delivery: string | null; driver: string | null; documentChecklist: string[] };
  timeline: Array<{ id: string | null; eventType: string; message: string | null; createdAt: string | null; userName: string | null }>;
  documents: Array<{ id: string | null; type: string; fileName: string | null; filePath: string | null; createdAt: string | null }>;
  invoices: Array<{ id: string | null; number: string | null; status: string | null; paymentStatus: string | null; amount: number | null; currency: string; dueDate: string | null }>;
  paymentHistory: Array<{ id: string | null; invoiceId: string | null; companyId: string | null; amount: number | null; currency: string; settlementMethod: string | null; externalReference: string | null; note: string | null; statusAfter: string | null; paidAt: string | null; createdAt: string | null }>;
  amendments: Array<{ id: string | null; agreementId: string | null; versionNumber: number | null; status: string | null; reason: string | null; changeSummary: unknown; effectiveAgreedAmount: number | null; currency: string; paymentTerms: string | null; paymentDueDays: number | null; proposedByCompanyId: string | null; decidedByCompanyId: string | null; createdAt: string | null; decidedAt: string | null }>;
  disputes: Array<{ id: string | null; type: 'job' | 'invoice'; invoiceId?: string | null; status: string | null; raisedByCompanyId: string | null; reason?: string | null; description: string | null; resolutionNote: string | null; createdAt: string | null; resolvedAt: string | null }>;
  extras: Array<{ id: string | null; type: string | null; description: string | null; amountGbp: number | null; minutes: number | null; status: string | null; reviewedAt: string | null; reviewNote: string | null; contractualAmendmentId: string | null; contractualSnapshotHash: string | null; contractualSnapshotVersion: number | null; createdAt: string | null }>;
  partial: boolean;
  unavailable: { bodyType: string | null; bookingFooter: string | null; extras: string | null; amendments?: string | null; payments?: string | null; disputes?: string | null; documents?: string | null };
};

export type JobSheetTab = 'agreement' | 'route' | 'progress' | 'evidence' | 'pod' | 'invoice' | 'payment' | 'dispute' | 'event-log';
export type LegacyJobSheetTab = 'order' | 'notes' | 'history' | 'replay' | 'documents';
type JobSheetTabInput = JobSheetTab | LegacyJobSheetTab;
type SheetMode = 'broker' | 'customer' | 'carrier';
const TABS: Array<{ id: JobSheetTab; label: string }> = [
  { id: 'agreement', label: 'Agreement' },
  { id: 'route', label: 'Route' },
  { id: 'progress', label: 'Progress' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'pod', label: 'POD' },
  { id: 'invoice', label: 'Invoice' },
  { id: 'payment', label: 'Payment' },
  { id: 'dispute', label: 'Dispute' },
  { id: 'event-log', label: 'Event Log' },
];
const normalizeTab = (value: JobSheetTabInput): JobSheetTab => {
  if (value === 'order') return 'agreement';
  if (value === 'notes') return 'progress';
  if (value === 'history' || value === 'replay') return 'event-log';
  if (value === 'documents') return 'evidence';
  return value;
};

const when = (value: string | null) => value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not supplied';
const money = (value: number | null, currency = 'GBP') => value == null ? 'Not supplied' : new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);
const human = (value: string | null | undefined) => value ? value.replace(/_/g, ' ') : 'Not supplied';

const SHEET_FETCH_CONCURRENCY = 4;
let activeSheetFetches = 0;
const sheetFetchQueue: Array<() => void> = [];

function runSheetFetchLimited<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const execute = () => {
      activeSheetFetches += 1;
      void task().then(resolve, reject).finally(() => {
        activeSheetFetches -= 1;
        sheetFetchQueue.shift()?.();
      });
    };
    if (activeSheetFetches < SHEET_FETCH_CONCURRENCY) execute();
    else sheetFetchQueue.push(execute);
  });
}

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

function companyDetail(memberId: string | null, phone: string | null) {
  return [memberId ? `Member ID ${memberId}` : null, phone].filter(Boolean).join(' · ') || undefined;
}

function Detail({ label, value, detail }: { label: string; value: ReactNode; detail?: ReactNode }) {
  return <div className="workspace-detail-item"><strong>{label}</strong><div>{value}</div>{detail ? <small>{detail}</small> : null}</div>;
}

export function CompanyJobSheetPanel({ jobId, mode, initialTab = 'agreement' }: { jobId: string; mode: SheetMode; initialTab?: JobSheetTabInput }) {
  const [sheet, setSheet] = useState<JobSheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<JobSheetTab>(normalizeTab(initialTab));

  useEffect(() => { setTab(normalizeTab(initialTab)); }, [initialTab]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true); setError('');
      try {
        const loadedSheet = await runSheetFetchLimited(async () => {
          const { data: session } = await supabase.auth.getSession();
          const token = session.session?.access_token;
          if (!token) throw new Error('Session expired.');
          const response = await fetch(`/api/workspace/jobs/${encodeURIComponent(jobId)}/sheet`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
          const payload = await response.json().catch(() => ({})) as { sheet?: JobSheet; error?: string };
          if (!response.ok || !payload.sheet) throw new Error(payload.error || 'Job sheet unavailable.');
          return payload.sheet;
        });
        if (!cancelled) setSheet(loadedSheet);
      } catch (reason) {
        if (!cancelled) { setSheet(null); setError(reason instanceof Error ? reason.message : 'Job sheet unavailable.'); }
      } finally { if (!cancelled) setLoading(false); }
    };
    void run();
    return () => { cancelled = true; };
  }, [jobId, mode]);

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
  const hardCopyPod = sheet.pod.hardCopy ?? 'Digital POD required; hard-copy requirement not separately supplied';
  const podState = sheet.pod.generated
    ? { label: 'POD generated', tone: 'green' as const, detail: sheet.pod.photoCount > 0 ? `${sheet.pod.photoCount} evidence file(s)` : 'Generated POD record' }
    : sheet.pod.photoCount > 0
      ? { label: 'Delivery evidence', tone: 'blue' as const, detail: `${sheet.pod.photoCount} photo/evidence file(s); generated POD not confirmed` }
      : { label: 'Pending', tone: 'orange' as const, detail: 'POD is mandatory and no generated POD or delivery evidence is recorded.' };
  const carrierMode = mode === 'carrier';
  const presentationJob = {
    status: sheet.status,
    awarded_carrier_company_id: sheet.carrier?.companyId ?? null,
    assigned_driver_id: sheet.driver?.id ?? null,
    vehicle_id: sheet.vehicle?.id ?? null,
  };
  const presentationStatus = workspaceJobOperationalLabel(presentationJob);
  const agreementStatus = sheet.commercial.agreementStatus
    ? human(sheet.commercial.agreementStatus).replace(/\b\w/g, (character) => character.toUpperCase())
    : sheet.acceptedAt ? 'Accepted' : 'Not accepted';
  const agreementReference = sheet.commercial.agreementId
    ? `AGR-${sheet.commercial.agreementId.slice(0, 8).toUpperCase()}`
    : 'Not available';
  const customerAgreedPrice = sheet.commercial.agreedGross ?? sheet.commercial.carrierCost;
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
  const messagesHref = mode === 'customer'
    ? `/customer/messages?jobId=${encodeURIComponent(jobId)}`
    : mode === 'broker'
      ? `/broker/messages?jobId=${encodeURIComponent(jobId)}`
      : `/admin/messages?jobId=${encodeURIComponent(jobId)}`;

  return (
    <div className="workspace-record-details" style={{ padding: 0 }}>
      {sheet.partial && <AlertBanner tone="warning">Some booking details are unavailable. Verified values are shown and missing values are left unfilled.</AlertBanner>}
      <div className="workspace-record-meta" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <span><strong>Booking Detail</strong> · {sheet.references.xdrive}</span>
        <ActionButton tone="secondary" onClick={() => { window.location.href = messagesHref; }}>Messages for this job</ActionButton>
      </div>
      <div className="workspace-tab-strip" role="tablist" aria-label="Booking detail sections" style={{ display: 'flex', overflowX: 'auto', marginBottom: 6 }}>
        {TABS.map((item) => {
          const count = item.id === 'evidence' ? sheet.documents.length
            : item.id === 'invoice' ? sheet.invoices.length
              : item.id === 'payment' ? sheet.paymentHistory.length
                : item.id === 'dispute' ? sheet.disputes.length
                  : item.id === 'event-log' ? sheet.timeline.length
                    : 0;
          return <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} data-active={tab === item.id ? 'true' : 'false'} onClick={() => setTab(item.id)}>{item.label}{count ? ` ${count}` : ''}</button>;
        })}
      </div>

      {tab === 'agreement' && (
        <div style={{ display: 'grid', gap: 8 }}>
          <div className="workspace-detail-grid">
            <Detail label="XDrive reference" value={sheet.references.xdrive} detail={sheet.references.booking ? `Customer booking ref ${sheet.references.booking}` : undefined} />
            <Detail label="Transport status" value={<StatusBadge value={presentationStatus} />} detail={sheet.updatedAt ? `Last updated ${when(sheet.updatedAt)}` : undefined} />
            <Detail label="Transport buyer / posting company" value={<MemberIdentityLink companyId={sheet.ownerCompany.companyId}>{sheet.ownerCompany.name}</MemberIdentityLink>} detail={companyDetail(sheet.ownerCompany.memberId, sheet.ownerCompany.phone)} />
            <Detail label="Performing carrier" value={sheet.carrier ? <MemberIdentityLink companyId={sheet.carrier.companyId}>{sheet.carrier.name}</MemberIdentityLink> : 'Not awarded'} detail={sheet.carrier ? companyDetail(sheet.carrier.memberId, sheet.carrier.phone) : undefined} />
            <Detail label="Agreement status" value={<StatusBadge value={agreementStatus} />} detail={sheet.acceptedAt ? `Accepted ${when(sheet.acceptedAt)}` : 'Booking acceptance not recorded'} />
            <Detail label="Agreement reference" value={agreementReference} />
            <Detail label="Contract version" value={sheet.commercial.contractVersion != null ? `v${sheet.commercial.contractVersion}` : 'Not available'} detail={sheet.commercial.snapshotAvailable ? 'Immutable agreement snapshot recorded' : undefined} />
            {mode === 'customer' && <Detail label="Agreed transport price" value={money(customerAgreedPrice, sheet.commercial.currency)} detail={sheet.commercial.vatRate != null ? `VAT ${sheet.commercial.vatRate}% · ${money(sheet.commercial.vatAmount, sheet.commercial.currency)}` : undefined} />}
            {mode === 'broker' && sheet.commercial.customerPrice != null && <Detail label="Customer price" value={money(sheet.commercial.customerPrice, sheet.commercial.currency)} />}
            {mode !== 'customer' && <Detail label={carrierMode ? 'Agreed carrier rate' : 'Carrier cost'} value={money(sheet.commercial.carrierCost, sheet.commercial.currency)} detail={sheet.commercial.snapshotAvailable ? 'Immutable commercial agreement recorded' : 'Historical agreement snapshot unavailable'} />}
            {mode !== 'customer' && sheet.commercial.agreedGross != null && sheet.commercial.agreedGross !== sheet.commercial.carrierCost && <Detail label="Agreed gross" value={money(sheet.commercial.agreedGross, sheet.commercial.currency)} detail={sheet.commercial.vatRate != null ? `VAT ${sheet.commercial.vatRate}% · ${money(sheet.commercial.vatAmount, sheet.commercial.currency)}` : undefined} />}
            {mode === 'broker' && <Detail label="Margin" value={money(sheet.commercial.margin, sheet.commercial.currency)} detail={sheet.commercial.targetCarrierCost != null ? `Target carrier cost ${money(sheet.commercial.targetCarrierCost, sheet.commercial.currency)}` : undefined} />}
            <Detail label="Payment terms" value={sheet.commercial.paymentTerms ?? 'Historical terms unavailable'} detail={sheet.commercial.paymentDueDays != null && sheet.commercial.paymentDueDays > 0 ? `${sheet.commercial.paymentDueDays} day(s)` : undefined} />
            <Detail label="Customer reference" value={sheet.references.customer ?? 'Not supplied'} />
            <Detail label="Purchase order" value={sheet.references.purchaseOrder ?? 'Not supplied'} />
          </div>

          <div style={{ display: 'grid', gap: 6 }}>
            <strong>Contract amendments</strong>
            {sheet.amendments.length ? sheet.amendments.map((amendment, index) => (
              <div key={amendment.id ?? `amendment-${index}`} className="workspace-record-meta">
                <span><strong>v{amendment.versionNumber ?? '?'}</strong> · {human(amendment.status)}</span>
                <span>{amendment.reason ?? 'Commercial amendment'}</span>
                <span>{amendment.effectiveAgreedAmount != null ? money(amendment.effectiveAgreedAmount, amendment.currency) : 'Amount unchanged'}</span>
                <span>{amendment.decidedAt ? when(amendment.decidedAt) : when(amendment.createdAt)}</span>
              </div>
            )) : <EmptyState compact title="No contract amendments recorded" description={sheet.unavailable.amendments ?? undefined} />}
          </div>

          <CommercialAmendmentControls
            jobId={jobId}
            mode={mode}
            viewerCompanyId={sheet.viewerCompanyId ?? null}
            ownerCompanyId={sheet.ownerCompany.companyId}
            carrierCompanyId={sheet.carrier?.companyId ?? null}
            currentAmount={sheet.commercial.carrierCost}
            currency={sheet.commercial.currency}
            paymentTerms={sheet.commercial.paymentTerms}
            pickup={sheet.route.pickup}
            delivery={sheet.route.delivery}
          />

          <div style={{ display: 'grid', gap: 6 }}>
            <strong>Approved extras / adjustments</strong>
            {sheet.extras.length ? sheet.extras.map((extra, index) => (
              <div key={extra.id ?? `extra-${index}`} className="workspace-record-meta">
                <span><strong>{human(extra.type)}</strong></span>
                <span>{money(extra.amountGbp, 'GBP')}</span>
                <span>{human(extra.status)}</span>
                <span>{extra.contractualSnapshotVersion != null ? `Contract v${extra.contractualSnapshotVersion}` : 'Not contractually accepted'}</span>
                <span>{extra.description ?? extra.reviewNote ?? ''}</span>
              </div>
            )) : <EmptyState compact title="No execution extras recorded" description={sheet.unavailable.extras ?? undefined} />}
          </div>
        </div>
      )}

      {tab === 'route' && (
        <div style={{ display: 'grid', gap: 8 }}>
          <div className="workspace-detail-grid">
            <Detail label="Requested vehicle" value={human(sheet.load.requestedVehicle)} />
            <Detail label="Cargo" value={human(sheet.load.cargoType)} detail={[sheet.load.weightKg != null ? `${sheet.load.weightKg} kg` : null, sheet.load.pallets != null ? `${sheet.load.pallets} pallet(s)` : null].filter(Boolean).join(' · ') || undefined} />
            <Detail label="Dimensions" value={dimensions} />
            <Detail label="Cargo value" value={money(sheet.load.cargoValueGbp)} />
            <Detail label="Distance" value={sheet.route.distanceMiles != null ? `${sheet.route.distanceMiles} miles` : 'Not supplied'} />
            <Detail label="Pallet type" value={human(sheet.load.palletType)} detail={sheet.load.stackable == null ? undefined : sheet.load.stackable ? 'Stackable' : 'Not stackable'} />
          </div>
          <div className="workspace-detail-grid">
            {hasPersistedRoute ? routeStops.map((stop, index) => {
              const sequence = stop.sequence ?? index + 1;
              const routeDetail = [formatStopSchedule(stop.windowStart, stop.windowEnd), stop.status ? `Status ${human(stop.status)}` : null].filter(Boolean).join(' · ');
              const contactDetail = [stop.companyName, stop.contactPhone, stop.instructions].filter(Boolean).join(' · ') || undefined;
              return [
                <Detail key={`${stop.id ?? sequence}-route`} label={`Stop ${sequence} · ${human(stop.type)}`} value={formatExecutionAddress(stop.address, stop.postcode)} detail={routeDetail} />,
                <Detail key={`${stop.id ?? sequence}-contact`} label={`Stop ${sequence} contact`} value={stop.contactName ?? 'Not supplied'} detail={contactDetail} />,
              ];
            }) : <>
              <Detail label="Pickup" value={formatExecutionAddress(sheet.route.pickup.address, sheet.route.pickup.postcode)} detail={formatScheduleDetail(sheet.route.pickup.dateTime, sheet.route.pickup.slot)} />
              <Detail label="Pickup contact" value={sheet.route.pickup.contactName ?? 'Not supplied'} detail={[sheet.route.pickup.contactPhone, sheet.route.pickup.notes].filter(Boolean).join(' · ') || undefined} />
              <Detail label="Delivery" value={formatExecutionAddress(sheet.route.delivery.address, sheet.route.delivery.postcode)} detail={formatScheduleDetail(sheet.route.delivery.dateTime, sheet.route.delivery.slot)} />
              <Detail label="Delivery contact" value={sheet.route.delivery.contactName ?? 'Not supplied'} detail={[sheet.route.delivery.contactPhone, sheet.route.delivery.notes].filter(Boolean).join(' · ') || undefined} />
            </>}
          </div>
          {sheet.load.requirements.length > 0 && <div className="workspace-record-meta"><span><strong>Requirements:</strong> {sheet.load.requirements.join(' · ')}</span></div>}
          {bookingNotes.length > 0 && <div style={{ display: 'grid', gap: 6 }}>{bookingNotes.map(([label, value]) => <div key={label} className="workspace-detail-item"><strong>{label}</strong><div>{value}</div></div>)}</div>}
        </div>
      )}

      {tab === 'progress' && (
        <div style={{ display: 'grid', gap: 8 }}>
          <div className="workspace-detail-grid">
            <Detail label="Current status" value={<StatusBadge value={presentationStatus} />} detail={sheet.updatedAt ? `Updated ${when(sheet.updatedAt)}` : undefined} />
            <Detail label="Accepted bidder driver" value={acceptedBidderDriverLabel} detail={acceptedBidderDriverDetail} />
            <Detail label="Execution company" value={sheet.executionCompany ? <MemberIdentityLink companyId={sheet.executionCompany.companyId}>{sheet.executionCompany.name}</MemberIdentityLink> : 'Not assigned'} detail={sheet.executionCompany ? companyDetail(sheet.executionCompany.memberId, sheet.executionCompany.phone) : undefined} />
            <Detail label="Assigned driver" value={sheet.driver?.name ?? 'Not assigned'} />
            <Detail label="Allocated vehicle" value={allocatedVehicleLabel} detail={allocatedVehicleDetail} />
            <Detail label="Body type" value={sheet.vehicle?.bodyType ? human(sheet.vehicle.bodyType) : 'Not supplied'} detail={!sheet.vehicle?.bodyType ? availabilityCopy(sheet.unavailable.bodyType, 'Not available for this booking.') : undefined} />
          </div>
          {visibleNotes.length ? <div style={{ display: 'grid', gap: 6 }}>{visibleNotes.map(([label, value]) => <div key={label} className="workspace-detail-item"><strong>{label}</strong><div>{value}</div></div>)}</div> : <EmptyState compact title="No operational notes recorded" />}
        </div>
      )}

      {tab === 'evidence' && (
        <div style={{ display: 'grid', gap: 8 }}>
          <div className="workspace-detail-grid">
            <Detail label="Collection photos" value={sheet.evidence.collectionPhotoCount} detail={sheet.evidence.collectionHandoverRecorded ? 'Verified collection handover recorded' : 'Collection handover not recorded'} />
            <Detail label="Delivery photos" value={sheet.evidence.deliveryPhotoCount} />
            <Detail label="POD photos" value={sheet.evidence.podPhotoCount} />
            <Detail label="Delivery signature" value={sheet.evidence.deliverySignatureRecorded ? 'Recorded' : 'Not recorded'} detail={sheet.evidence.recipientName ?? undefined} />
          </div>
          {sheet.documents.length ? <div style={{ display: 'grid' }}>{sheet.documents.map((document, index) => <div key={document.id ?? `${document.fileName}-${index}`} className="workspace-record-meta"><span><strong>{document.fileName ?? document.type}</strong></span><span>{human(document.type)}</span><span>{when(document.createdAt)}</span>{document.filePath?.startsWith('http') ? <ActionButton tone="secondary" onClick={() => window.open(document.filePath ?? '', '_blank', 'noopener,noreferrer')}>Open</ActionButton> : <span>Stored securely</span>}</div>)}</div> : <EmptyState compact title="No job documents attached" description={sheet.unavailable.documents ?? undefined} />}
        </div>
      )}

      {tab === 'pod' && <div className="workspace-detail-grid"><Detail label="POD required" value={sheet.pod.required == null ? 'Not supplied' : sheet.pod.required ? 'Yes' : 'No'} /><Detail label="Hard-copy POD" value={hardCopyPod} /><Detail label="POD status" value={<StatusBadge value={podState.label} tone={podState.tone} />} detail={podState.detail} /><Detail label="Evidence files" value={sheet.pod.photoCount} /><Detail label="Generated" value={sheet.pod.generated ? when(sheet.pod.generatedAt) : 'Not confirmed'} /><Detail label="Review" value={human(sheet.pod.reviewStatus)} detail={sheet.pod.reviewNote ?? undefined} /></div>}

      {tab === 'invoice' && (sheet.invoices.length ? <div style={{ display: 'grid' }}>{sheet.invoices.map((invoice, index) => <div key={invoice.id ?? `${invoice.number}-${index}`} className="workspace-record-meta"><span><strong>{invoice.number ?? 'Invoice'}</strong></span><span>{money(invoice.amount, invoice.currency)}</span><span>{human(invoice.paymentStatus ?? invoice.status)}</span><span>{invoice.dueDate ? `Due ${when(invoice.dueDate)}` : 'No due date'}</span></div>)}</div> : <EmptyState compact title="No authorised invoice linked to this booking" />)}

      {tab === 'payment' && (sheet.paymentHistory.length ? <div style={{ display: 'grid' }}>{sheet.paymentHistory.map((payment, index) => <div key={payment.id ?? `payment-${index}`} className="workspace-record-meta"><span><strong>{money(payment.amount, payment.currency)}</strong></span><span>{human(payment.settlementMethod)}</span><span>{human(payment.statusAfter)}</span><span>{when(payment.paidAt ?? payment.createdAt)}</span><span>{payment.externalReference ?? payment.note ?? ''}</span></div>)}</div> : <EmptyState compact title="No payment history recorded" description={sheet.unavailable.payments ?? undefined} />)}

      {tab === 'dispute' && (sheet.disputes.length ? <div style={{ display: 'grid' }}>{sheet.disputes.map((dispute, index) => <div key={dispute.id ?? `dispute-${index}`} className="workspace-record-meta"><span><strong>{dispute.type === 'invoice' ? 'Invoice dispute' : 'Job dispute'}</strong></span><span>{human(dispute.status)}</span><span>{dispute.reason ?? dispute.description ?? 'No reason supplied'}</span><span>{when(dispute.createdAt)}</span>{dispute.resolutionNote ? <span>Resolution: {dispute.resolutionNote}</span> : null}</div>)}</div> : <EmptyState compact title="No disputes recorded" description={sheet.unavailable.disputes ?? undefined} />)}

      {tab === 'event-log' && (
        <div style={{ display: 'grid', gap: 8 }}>
          {sheet.timeline.length ? <div style={{ display: 'grid' }}>{[...sheet.timeline].reverse().map((event, index) => <div key={event.id ?? `${event.eventType}-${index}`} className="workspace-record-meta"><span><strong>{human(event.eventType)}</strong></span><span>{when(event.createdAt)}</span><span>{event.message ?? event.userName ?? 'Operational update'}</span></div>)}</div> : <EmptyState compact title="No event log entries recorded" />}
          <WorkspaceJobReplay jobId={jobId} />
        </div>
      )}
    </div>
  );
}
