'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { MemberIdentityLink } from './MemberProfile';
import { ActionButton, AlertBanner, EmptyState, StatusBadge } from './WorkspaceUI';

type JobSheet = {
  jobId: string;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
  acceptedAt: string | null;
  ownerCompany: { companyId: string; name: string; memberId: string | null; phone: string | null; type: string | null };
  carrier: { companyId: string; name: string; memberId: string | null; phone: string | null; type: string | null } | null;
  driver: { id: string; name: string | null; status: string | null } | null;
  customer: { name: string | null; email: string | null; phone: string | null };
  references: { booking: string | null; customer: string | null; purchaseOrder: string | null; xdrive: string };
  route: {
    pickup: { address: string | null; postcode: string | null; dateTime: string | null; slot: string | null; contactName: string | null; contactPhone: string | null; notes: string | null };
    delivery: { address: string | null; postcode: string | null; dateTime: string | null; slot: string | null; contactName: string | null; contactPhone: string | null; notes: string | null };
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
  pod: { required: boolean; hardCopy: string | null; generated: boolean | null; generatedAt: string | null; photoCount: number; reviewStatus: string | null; reviewNote: string | null };
  notes: { publicQuoteNotes: string | null; executionInstructions: string | null; collection: string | null; delivery: string | null; driver: string | null; documentChecklist: string[] };
  timeline: Array<{ id: string | null; eventType: string; message: string | null; createdAt: string | null; userName: string | null }>;
  documents: Array<{ id: string | null; type: string; fileName: string | null; filePath: string | null; createdAt: string | null }>;
  invoices: Array<{ id: string | null; number: string | null; status: string | null; paymentStatus: string | null; amount: number | null; currency: string; dueDate: string | null }>;
  partial: boolean;
  unavailable: { bodyType: string; bookingFooter: string; extras: string };
};

type Tab = 'order' | 'notes' | 'history' | 'documents' | 'pod' | 'invoice';
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'order', label: 'Order' }, { id: 'notes', label: 'Notes' }, { id: 'history', label: 'History' },
  { id: 'documents', label: 'Documents' }, { id: 'pod', label: 'POD' }, { id: 'invoice', label: 'Invoice' },
];

const when = (value: string | null) => value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not supplied';
const money = (value: number | null, currency = 'GBP') => value == null ? 'Not supplied' : new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);
const human = (value: string | null | undefined) => value ? value.replace(/_/g, ' ') : 'Not supplied';

function Detail({ label, value, detail }: { label: string; value: ReactNode; detail?: ReactNode }) {
  return <div className="workspace-detail-item"><strong>{label}</strong><div>{value}</div>{detail ? <small>{detail}</small> : null}</div>;
}

export function CompanyJobSheetPanel({ jobId, mode }: { jobId: string; mode: 'broker' | 'customer' }) {
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
    ?? (sheet.pod.required ? 'POD required; hard-copy requirement not separately supplied' : 'Not required');

  return (
    <div className="workspace-record-details" style={{ padding: 0 }}>
      {sheet.partial && <AlertBanner tone="warning">Part of this job sheet could not be enriched. Verified values are shown; missing values are not fabricated.</AlertBanner>}
      <div className="workspace-tab-strip" role="tablist" aria-label="Job sheet sections" style={{ display: 'flex', overflowX: 'auto', marginBottom: 6 }}>
        {TABS.map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} data-active={tab === item.id ? 'true' : 'false'} onClick={() => setTab(item.id)}>{item.label}{item.id === 'documents' && sheet.documents.length ? ` ${sheet.documents.length}` : ''}</button>)}
      </div>

      {tab === 'order' && (
        <div style={{ display: 'grid', gap: 8 }}>
          <div className="workspace-detail-grid">
            <Detail label="XDrive reference" value={sheet.references.xdrive} detail={sheet.references.booking ? `Booking ${sheet.references.booking}` : undefined} />
            <Detail label="Status" value={<StatusBadge value={sheet.status} />} detail={sheet.acceptedAt ? `Awarded ${when(sheet.acceptedAt)}` : undefined} />
            <Detail label="Posting company" value={<MemberIdentityLink companyId={sheet.ownerCompany.companyId}>{sheet.ownerCompany.name}</MemberIdentityLink>} detail={[sheet.ownerCompany.memberId, sheet.ownerCompany.phone].filter(Boolean).join(' · ') || undefined} />
            <Detail label="Awarded carrier" value={sheet.carrier ? <MemberIdentityLink companyId={sheet.carrier.companyId}>{sheet.carrier.name}</MemberIdentityLink> : 'Not awarded'} detail={sheet.carrier ? [sheet.carrier.memberId, sheet.carrier.phone].filter(Boolean).join(' · ') : undefined} />
            <Detail label="Assigned driver" value={sheet.driver?.name ?? 'Not assigned'} detail={sheet.driver?.status ? `Account ${human(sheet.driver.status)}` : undefined} />
            <Detail label="Requested vehicle" value={human(sheet.load.requestedVehicle)} />
            <Detail label="Body type" value="Not supplied" detail={sheet.unavailable.bodyType} />
            <Detail label="Cargo" value={human(sheet.load.cargoType)} detail={[sheet.load.weightKg != null ? `${sheet.load.weightKg} kg` : null, sheet.load.pallets != null ? `${sheet.load.pallets} pallet(s)` : null].filter(Boolean).join(' · ') || undefined} />
            <Detail label="Dimensions" value={dimensions} />
            <Detail label="Cargo value" value={money(sheet.load.cargoValueGbp)} />
            <Detail label="Distance" value={sheet.route.distanceMiles != null ? `${sheet.route.distanceMiles} miles` : 'Not supplied'} />
            <Detail label="Customer" value={sheet.customer.name ?? 'Not supplied'} detail={mode === 'broker' ? [sheet.customer.email, sheet.customer.phone].filter(Boolean).join(' · ') || undefined : undefined} />
            <Detail label="Customer ref" value={sheet.references.customer ?? 'Not supplied'} />
            <Detail label="PO number" value={sheet.references.purchaseOrder ?? 'Not supplied'} />
            <Detail label="Customer price" value={money(sheet.commercial.customerPrice, sheet.commercial.currency)} />
            <Detail label="Carrier cost" value={money(sheet.commercial.carrierCost, sheet.commercial.currency)} detail={sheet.commercial.snapshotAvailable ? 'Immutable commercial snapshot available' : 'No immutable snapshot returned'} />
            {mode === 'broker' && <Detail label="Margin" value={money(sheet.commercial.margin, sheet.commercial.currency)} detail={sheet.commercial.targetCarrierCost != null ? `Target carrier cost ${money(sheet.commercial.targetCarrierCost, sheet.commercial.currency)}` : undefined} />}
            <Detail label="Payment terms" value={sheet.commercial.paymentTerms ?? 'Historical terms unavailable'} detail={sheet.commercial.paymentDueDays != null ? `${sheet.commercial.paymentDueDays} day(s)` : undefined} />
            <Detail label="Extras" value="Not supplied" detail={sheet.unavailable.extras} />
            <Detail label="Hard-copy POD" value={hardCopyPod} />
          </div>

          <div className="workspace-detail-grid">
            <Detail label="Pickup" value={[sheet.route.pickup.address, sheet.route.pickup.postcode].filter(Boolean).join(', ') || 'Not supplied'} detail={`${when(sheet.route.pickup.dateTime)}${sheet.route.pickup.slot ? ` · ${sheet.route.pickup.slot}` : ''}`} />
            <Detail label="Pickup contact" value={sheet.route.pickup.contactName ?? 'Not supplied'} detail={sheet.route.pickup.contactPhone ?? undefined} />
            <Detail label="Delivery" value={[sheet.route.delivery.address, sheet.route.delivery.postcode].filter(Boolean).join(', ') || 'Not supplied'} detail={`${when(sheet.route.delivery.dateTime)}${sheet.route.delivery.slot ? ` · ${sheet.route.delivery.slot}` : ''}`} />
            <Detail label="Delivery contact" value={sheet.route.delivery.contactName ?? 'Not supplied'} detail={sheet.route.delivery.contactPhone ?? undefined} />
          </div>

          {bookingNotes.length > 0 && (
            <div style={{ display: 'grid', gap: 6 }}>
              <strong>Notes &amp; Details</strong>
              {bookingNotes.map(([label, value]) => <div key={label} className="workspace-detail-item"><strong>{label}</strong><div>{value}</div></div>)}
            </div>
          )}
          {sheet.load.requirements.length > 0 && <div className="workspace-record-meta"><span><strong>Requirements:</strong> {sheet.load.requirements.join(' · ')}</span></div>}
          {sheet.notes.documentChecklist.length > 0 && <div className="workspace-record-meta"><span><strong>Paperwork:</strong> {sheet.notes.documentChecklist.join(' · ')}</span></div>}
          <div className="workspace-detail-item"><strong>Booking footer / working instructions</strong><div>Unavailable</div><small>{sheet.unavailable.bookingFooter}</small></div>
        </div>
      )}

      {tab === 'notes' && (visibleNotes.length ? <div style={{ display: 'grid', gap: 6 }}>{visibleNotes.map(([label, value]) => <div key={label} className="workspace-detail-item"><strong>{label}</strong><div>{value}</div></div>)}</div> : <EmptyState compact title="No notes recorded" />)}

      {tab === 'history' && (sheet.timeline.length ? <div style={{ display: 'grid' }}>{[...sheet.timeline].reverse().map((event, index) => <div key={event.id ?? `${event.eventType}-${index}`} className="workspace-record-meta"><span><strong>{human(event.eventType)}</strong></span><span>{when(event.createdAt)}</span><span>{event.message ?? event.userName ?? 'Operational update'}</span></div>)}</div> : <EmptyState compact title="No history events recorded" />)}

      {tab === 'documents' && (sheet.documents.length ? <div style={{ display: 'grid' }}>{sheet.documents.map((document, index) => <div key={document.id ?? `${document.fileName}-${index}`} className="workspace-record-meta"><span><strong>{document.fileName ?? document.type}</strong></span><span>{document.type}</span><span>{when(document.createdAt)}</span>{document.filePath?.startsWith('http') ? <ActionButton tone="secondary" onClick={() => window.open(document.filePath ?? '', '_blank', 'noopener,noreferrer')}>Open</ActionButton> : <span>Stored securely</span>}</div>)}</div> : <EmptyState compact title="No job documents attached" />)}

      {tab === 'pod' && <div className="workspace-detail-grid"><Detail label="POD required" value={sheet.pod.required ? 'Yes' : 'No'} /><Detail label="Hard-copy POD" value={hardCopyPod} /><Detail label="POD status" value={sheet.pod.generated || sheet.pod.photoCount > 0 ? <StatusBadge value="captured" tone="green" /> : <StatusBadge value="pending" tone="orange" />} /><Detail label="POD files" value={sheet.pod.photoCount} /><Detail label="Generated" value={when(sheet.pod.generatedAt)} /><Detail label="Review" value={human(sheet.pod.reviewStatus)} detail={sheet.pod.reviewNote ?? undefined} /></div>}

      {tab === 'invoice' && (sheet.invoices.length ? <div style={{ display: 'grid' }}>{sheet.invoices.map((invoice, index) => <div key={invoice.id ?? `${invoice.number}-${index}`} className="workspace-record-meta"><span><strong>{invoice.number ?? 'Invoice'}</strong></span><span>{money(invoice.amount, invoice.currency)}</span><span>{invoice.paymentStatus ?? invoice.status ?? 'Not supplied'}</span><span>{invoice.dueDate ? `Due ${when(invoice.dueDate)}` : 'No due date'}</span></div>)}</div> : <EmptyState compact title="No authorised invoice linked to this job" />)}
    </div>
  );
}
