'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { MemberIdentityLink } from './MemberProfile';
import { ActionButton, AlertBanner, EmptyState, StatusBadge } from './WorkspaceUI';

type DriverSheet = {
  reference: string;
  loadId: string;
  status: string;
  bookedAt: string | null;
  postingCompanyId: string | null;
  bookedBy: string;
  memberCode: string | null;
  memberPhone: string | null;
  executingCompanyId: string | null;
  driverId: string;
  driverName: string | null;
  agreedRate: number | null;
  agreedGross: number | null;
  vatRate: number | null;
  vatAmount: number | null;
  currency: string;
  paymentTerms: string | null;
  paymentDueDays: number | null;
  commercialSnapshotAvailable: boolean;
  customerName: string | null;
  customerReference: string | null;
  purchaseOrderNumber: string | null;
  bookingReference: string | null;
  distanceMiles: number | null;
  requestedVehicle: string | null;
  allocatedVehicle: {
    id: string | null;
    ref: string | null;
    type: string | null;
    bodyType: string | null;
    make: string | null;
    model: string | null;
    payloadKg: number | null;
    palletsCapacity: number | null;
    hasTailLift: boolean | null;
    source: 'job' | 'driver_current' | 'none';
  };
  cargo: {
    type: string | null;
    weightKg: number | null;
    pallets: number | null;
    lengthCm: number | null;
    widthCm: number | null;
    heightCm: number | null;
    cargoValueGbp: number | null;
    palletType: string | null;
    stackable: boolean | null;
  };
  requirements: string[];
  hardCopyPod: string;
  podRequired: boolean;
  pickup: {
    address: string | null;
    postcode: string | null;
    dateTime: string | null;
    slot: string | null;
    contactName: string | null;
    contactPhone: string | null;
    notes: string | null;
  };
  delivery: {
    address: string | null;
    postcode: string | null;
    dateTime: string | null;
    slot: string | null;
    contactName: string | null;
    contactPhone: string | null;
    notes: string | null;
    receiverName: string | null;
    signatureRecorded: boolean;
  };
  pod: {
    generated: boolean | null;
    generatedAt: string | null;
    photoCount: number;
    collectionPhotoRecorded: boolean;
    receiverName: string | null;
    signatureRecorded: boolean;
  };
  publicQuoteNotes: string | null;
  executionInstructions: string | null;
  driverNotes: string | null;
  documentChecklist: string[];
  timeline: Array<{ id: string | null; eventType: string; message: string | null; meta?: unknown; createdAt: string | null }>;
  documents: Array<{ id: string | null; type: string; fileName: string | null; filePath: string | null; createdAt: string | null }>;
  invoices: Array<{ id: string | null; number: string | null; status: string | null; paymentStatus: string | null; amount: number | null; currency: string; dueDate: string | null }>;
  partial: boolean;
  unavailable: { bodyType: string | null; extras: string; bookingFooter: string };
};

type ReviewRow = { id: string; rating: number | null; comment: string | null; created_at: string | null };
type Tab = 'order' | 'pod' | 'notes' | 'history' | 'documents' | 'invoice' | 'feedback';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'order', label: 'Order' },
  { id: 'pod', label: 'POD' },
  { id: 'notes', label: 'Notes' },
  { id: 'history', label: 'History' },
  { id: 'documents', label: 'Documents' },
  { id: 'invoice', label: 'Invoice' },
  { id: 'feedback', label: 'Feedback' },
];

const when = (value: string | null | undefined) => value
  ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  : 'Not supplied';
const money = (value: number | null | undefined, currency = 'GBP') =>
  typeof value === 'number' && Number.isFinite(value)
    ? new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value)
    : 'Not supplied';
const human = (value: string | null | undefined) => value ? value.replace(/_/g, ' ') : 'Not supplied';

function Detail({ label, value, detail }: { label: string; value: ReactNode; detail?: ReactNode }) {
  return <div className="workspace-detail-item"><strong>{label}</strong><div>{value}</div>{detail ? <small>{detail}</small> : null}</div>;
}

export function DriverJobSheetPanel({ jobId }: { jobId: string }) {
  const [sheet, setSheet] = useState<DriverSheet | null>(null);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('order');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        if (!token) throw new Error('Your session has expired. Sign in again.');
        const [sheetResponse, reviewsResult] = await Promise.all([
          fetch(`/api/driver/jobs/${encodeURIComponent(jobId)}/sheet`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }),
          supabase.from('reviews').select('id, rating, comment, created_at').eq('job_id', jobId).order('created_at', { ascending: false }).limit(20),
        ]);
        const payload = await sheetResponse.json().catch(() => ({})) as { sheet?: DriverSheet; error?: string };
        if (!sheetResponse.ok || !payload.sheet) throw new Error(payload.error || 'The assigned job sheet could not be loaded.');
        if (!cancelled) {
          setSheet(payload.sheet);
          setReviews((reviewsResult.data as ReviewRow[] | null) ?? []);
        }
      } catch (reason) {
        if (!cancelled) {
          setSheet(null);
          setReviews([]);
          setError(reason instanceof Error ? reason.message : 'The assigned job sheet could not be loaded.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [jobId]);

  const dimensions = useMemo(() => {
    if (!sheet) return 'Not supplied';
    const values = [sheet.cargo.lengthCm, sheet.cargo.widthCm, sheet.cargo.heightCm];
    return values.every((value) => value == null)
      ? 'Not supplied'
      : `${values.map((value) => value == null ? '—' : value).join(' × ')} cm`;
  }, [sheet]);

  if (loading) return <EmptyState compact title="Loading complete job sheet…" />;
  if (!sheet || error) return <AlertBanner tone="warning">{error || 'Job sheet unavailable.'}</AlertBanner>;

  const allocatedVehicleName = [sheet.allocatedVehicle.make, sheet.allocatedVehicle.model, sheet.allocatedVehicle.ref].filter(Boolean).join(' · ');
  const allocatedVehicle = sheet.allocatedVehicle.source === 'none'
    ? 'Not supplied'
    : allocatedVehicleName || human(sheet.allocatedVehicle.type);
  const notes = [
    ['Public quote notes', sheet.publicQuoteNotes],
    ['Private execution instructions', sheet.executionInstructions],
    ['Collection notes', sheet.pickup.notes],
    ['Delivery notes', sheet.delivery.notes],
    ['Driver notes', sheet.driverNotes],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  return (
    <div className="workspace-record-details" style={{ padding: 0 }}>
      {sheet.partial && <AlertBanner tone="warning">Part of the enrichment is temporarily unavailable. Verified values are shown; missing values are not invented.</AlertBanner>}

      <div className="workspace-tab-strip" role="tablist" aria-label="Assigned job sheet sections" style={{ display: 'flex', overflowX: 'auto', marginBottom: 6 }}>
        {TABS.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} data-active={tab === item.id ? 'true' : 'false'} onClick={() => setTab(item.id)}>
            {item.label}{item.id === 'documents' && sheet.documents.length ? ` ${sheet.documents.length}` : ''}{item.id === 'feedback' && reviews.length ? ` ${reviews.length}` : ''}
          </button>
        ))}
      </div>

      {tab === 'order' && (
        <div style={{ display: 'grid', gap: 8 }}>
          <div className="workspace-detail-grid">
            <Detail label="Booking / load" value={sheet.reference} detail={`XDrive ${sheet.loadId.slice(0, 8).toUpperCase()}`} />
            <Detail label="Status" value={<StatusBadge value={sheet.status} />} detail={sheet.bookedAt ? `Awarded ${when(sheet.bookedAt)}` : undefined} />
            <Detail label="Booked by" value={sheet.postingCompanyId ? <MemberIdentityLink companyId={sheet.postingCompanyId}>{sheet.bookedBy}</MemberIdentityLink> : sheet.bookedBy} detail={[sheet.memberCode, sheet.memberPhone].filter(Boolean).join(' · ') || undefined} />
            <Detail label="Agreed rate" value={money(sheet.agreedRate, sheet.currency)} detail={sheet.commercialSnapshotAvailable ? 'Commercial agreement source available' : 'No immutable commercial snapshot returned'} />
            <Detail label="Payment terms" value={sheet.paymentTerms ?? 'Historical terms unavailable'} detail={sheet.paymentDueDays != null ? `${sheet.paymentDueDays} day(s)` : undefined} />
            <Detail label="Customer ref" value={sheet.customerReference ?? 'Not supplied'} />
            <Detail label="PO number" value={sheet.purchaseOrderNumber ?? 'Not supplied'} />
            <Detail label="Requested vehicle" value={human(sheet.requestedVehicle)} />
            <Detail label="Allocated vehicle" value={allocatedVehicle} detail={sheet.allocatedVehicle.source === 'driver_current' ? 'Current driver vehicle; no job-specific vehicle snapshot is stored.' : undefined} />
            <Detail label="Body type" value={sheet.allocatedVehicle.bodyType ?? 'Not supplied'} detail={sheet.unavailable.bodyType ?? undefined} />
            <Detail label="Cargo" value={human(sheet.cargo.type)} detail={[sheet.cargo.weightKg != null ? `${sheet.cargo.weightKg} kg` : null, sheet.cargo.pallets != null ? `${sheet.cargo.pallets} pallet(s)` : null].filter(Boolean).join(' · ') || undefined} />
            <Detail label="Dimensions" value={dimensions} />
            <Detail label="Cargo value" value={money(sheet.cargo.cargoValueGbp)} />
            <Detail label="Distance" value={sheet.distanceMiles != null ? `${sheet.distanceMiles} miles` : 'Not supplied'} />
            <Detail label="Hard-copy POD" value={sheet.hardCopyPod} />
            <Detail label="Extras" value="Not supplied" detail={sheet.unavailable.extras} />
          </div>

          <div className="workspace-detail-grid">
            <Detail label="Collection" value={[sheet.pickup.address, sheet.pickup.postcode].filter(Boolean).join(', ') || 'Not supplied'} detail={`${when(sheet.pickup.dateTime)}${sheet.pickup.slot ? ` · ${sheet.pickup.slot}` : ''}`} />
            <Detail label="Collection contact" value={sheet.pickup.contactName ?? 'Not supplied'} detail={sheet.pickup.contactPhone ?? undefined} />
            <Detail label="Delivery" value={[sheet.delivery.address, sheet.delivery.postcode].filter(Boolean).join(', ') || 'Not supplied'} detail={`${when(sheet.delivery.dateTime)}${sheet.delivery.slot ? ` · ${sheet.delivery.slot}` : ''}`} />
            <Detail label="Delivery contact" value={sheet.delivery.contactName ?? 'Not supplied'} detail={sheet.delivery.contactPhone ?? undefined} />
            <Detail label="Receiver" value={sheet.delivery.receiverName ?? 'Not supplied'} detail={sheet.delivery.signatureRecorded ? 'Recipient signature recorded' : 'Signature not recorded'} />
          </div>

          {sheet.requirements.length > 0 && <div className="workspace-record-meta"><span><strong>Requirements:</strong> {sheet.requirements.join(' · ')}</span></div>}
          {sheet.documentChecklist.length > 0 && <div className="workspace-record-meta"><span><strong>Paperwork:</strong> {sheet.documentChecklist.join(' · ')}</span></div>}
          <div className="workspace-detail-item"><strong>Booking footer / working instructions</strong><div>Unavailable</div><small>{sheet.unavailable.bookingFooter}</small></div>
        </div>
      )}

      {tab === 'pod' && (
        <div className="workspace-detail-grid">
          <Detail label="POD required" value={sheet.podRequired ? 'Yes' : 'No'} />
          <Detail label="Hard-copy POD" value={sheet.hardCopyPod} />
          <Detail label="Collection photo" value={sheet.pod.collectionPhotoRecorded ? 'Recorded' : 'Not recorded'} />
          <Detail label="Delivery photos" value={sheet.pod.photoCount} />
          <Detail label="Receiver" value={sheet.pod.receiverName ?? 'Not supplied'} />
          <Detail label="Signature" value={sheet.pod.signatureRecorded ? 'Recorded' : 'Not recorded'} />
          <Detail label="POD generated" value={sheet.pod.generated ? 'Yes' : 'No'} detail={sheet.pod.generatedAt ? when(sheet.pod.generatedAt) : undefined} />
        </div>
      )}

      {tab === 'notes' && (notes.length ? <div style={{ display: 'grid', gap: 6 }}>{notes.map(([label, value]) => <div key={label} className="workspace-detail-item"><strong>{label}</strong><div>{value}</div></div>)}</div> : <EmptyState compact title="No notes supplied" />)}

      {tab === 'history' && (sheet.timeline.length ? <div style={{ display: 'grid' }}>{[...sheet.timeline].reverse().map((event, index) => <div key={event.id ?? `${event.eventType}-${index}`} className="workspace-record-meta"><span><strong>{human(event.eventType)}</strong></span><span>{when(event.createdAt)}</span><span>{event.message ?? 'Operational update'}</span></div>)}</div> : <EmptyState compact title="No tracking history recorded" />)}

      {tab === 'documents' && (sheet.documents.length ? <div style={{ display: 'grid' }}>{sheet.documents.map((document, index) => <div key={document.id ?? `${document.fileName}-${index}`} className="workspace-record-meta"><span><strong>{document.fileName ?? document.type}</strong></span><span>{document.type}</span><span>{when(document.createdAt)}</span>{document.filePath?.startsWith('http') ? <ActionButton tone="secondary" onClick={() => window.open(document.filePath ?? '', '_blank', 'noopener,noreferrer')}>Open</ActionButton> : <span>Stored securely</span>}</div>)}</div> : <EmptyState compact title="No job documents attached" />)}

      {tab === 'invoice' && (sheet.invoices.length ? <div style={{ display: 'grid' }}>{sheet.invoices.map((invoice, index) => <div key={invoice.id ?? `${invoice.number}-${index}`} className="workspace-record-meta"><span><strong>{invoice.number ?? 'Invoice'}</strong></span><span>{money(invoice.amount, invoice.currency)}</span><span>{invoice.paymentStatus ?? invoice.status ?? 'Not supplied'}</span><span>{invoice.dueDate ? `Due ${when(invoice.dueDate)}` : 'No due date'}</span></div>)}</div> : <EmptyState compact title="No carrier invoice linked to this driver/company" />)}

      {tab === 'feedback' && (reviews.length ? <div style={{ display: 'grid', gap: 6 }}>{reviews.map((review) => <div key={review.id} className="workspace-detail-item"><strong>{review.rating != null ? `${review.rating}/5` : 'Feedback'}</strong><div>{review.comment ?? 'No comment supplied'}</div><small>{when(review.created_at)}</small></div>)}</div> : <EmptyState compact title="No feedback recorded" description="No verified write workflow is invented here; existing authorised feedback will appear when present." />)}
    </div>
  );
}
