'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { useAuth } from '../../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../../lib/supabaseClient';

type JobDetail = {
  id: string;
  company_id: string;
  created_by: string | null;
  status: string;
  pickup_location: string | null;
  pickup_postcode: string | null;
  pickup_datetime: string | null;
  delivery_location: string | null;
  delivery_postcode: string | null;
  delivery_datetime: string | null;
  vehicle_type: string | null;
  cargo_type: string | null;
  load_details: string | null;
  special_requirements: string | null;
  access_restrictions: string | null;
  delivery_photos: string[] | null;
  pod_photos: string[] | null;
  awarded_carrier_company_id: string | null;
  assigned_driver_id: string | null;
  status_history: Array<{ status?: string; timestamp?: string; note?: string }> | null;
  created_at: string;
  updated_at: string;
};

type EventRow = {
  id: string;
  event_type: string;
  message: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
};

type NoteRow = {
  id: string;
  note: string;
  created_at: string;
};

type DocumentRow = {
  id: string;
  doc_type: string | null;
  file_path: string | null;
  file_url?: string | null;
  file_type?: string | null;
  created_at: string | null;
};

type InvoiceRow = {
  id: string;
  invoice_number: string;
  status: string;
  payment_status: string | null;
  amount: number;
  invoice_date: string;
  due_date: string;
};

type BidRow = {
  id: string;
  status: string;
  amount: number | null;
  bid_price_gbp: number | null;
  companies: { name: string | null } | null;
};

const dateDisplay = (value: string | null | undefined) => {
  if (!value) return '-';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
};

const money = (value: number | null | undefined) => `GBP ${Number(value ?? 0).toFixed(2)}`;

const timelineSteps = [
  ['posted', 'Posted'],
  ['quoted', 'Quoted'],
  ['awarded', 'Awarded'],
  ['allocated', 'Allocated'],
  ['collected', 'Collected'],
  ['in_transit', 'In Transit'],
  ['delivered', 'Delivered'],
  ['pod_uploaded', 'POD Uploaded'],
  ['invoiced', 'Invoice Issued'],
  ['paid', 'Paid'],
  ['closed', 'Closed'],
] as const;

export default function CustomerJobDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const jobId = params?.id;

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [job, setJob] = useState<JobDetail | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [acceptedBid, setAcceptedBid] = useState<BidRow | null>(null);
  const [bidCount, setBidCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!isSupabaseConfigured || !user?.id) {
        if (!cancelled) setCompanyId(user?.companyId ?? null);
        return;
      }
      if (user.companyId) {
        if (!cancelled) setCompanyId(user.companyId);
        return;
      }
      const { data } = await supabase
        .from('company_memberships')
        .select('company_id')
        .eq('user_id', user.id)
        .neq('status', 'suspended')
        .limit(1)
        .maybeSingle();
      if (!cancelled) setCompanyId((data?.company_id as string) ?? null);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.companyId]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setMessage('');
      if (!isSupabaseConfigured || !jobId || !companyId) {
        setLoading(false);
        return;
      }

      const { data: jobRow, error: jobError } = await supabase
        .from('jobs')
        .select('id, company_id, created_by, status, pickup_location, pickup_postcode, pickup_datetime, delivery_location, delivery_postcode, delivery_datetime, vehicle_type, cargo_type, load_details, special_requirements, access_restrictions, delivery_photos, pod_photos, awarded_carrier_company_id, assigned_driver_id, status_history, created_at, updated_at')
        .eq('id', jobId)
        .eq('company_id', companyId)
        .maybeSingle();

      if (jobError || !jobRow) {
        setMessage(jobError?.message ?? 'Job not found.');
        setLoading(false);
        return;
      }

      const [eventRes, noteRes, documentRes, invoiceRes, bidRes, bidCountRes] = await Promise.all([
        supabase.from('job_tracking_events').select('id, event_type, message, meta, created_at').eq('job_id', jobId).order('created_at', { ascending: true }),
        supabase.from('job_notes').select('id, note, created_at').eq('job_id', jobId).order('created_at', { ascending: true }),
        supabase.from('job_documents').select('id, doc_type, file_path, file_url, file_type, created_at').eq('job_id', jobId).order('created_at', { ascending: false }),
        supabase.from('invoices').select('id, invoice_number, status, payment_status, amount, invoice_date, due_date').eq('job_id', jobId).order('created_at', { ascending: false }),
        supabase.from('job_bids').select('id, status, amount, bid_price_gbp, companies:companies!job_bids_company_id_fkey(name)').eq('job_id', jobId).eq('status', 'accepted').maybeSingle(),
        supabase.from('job_bids').select('id', { count: 'exact', head: true }).eq('job_id', jobId),
      ]);

      setJob(jobRow as JobDetail);
      setEvents((eventRes.data ?? []) as EventRow[]);
      setNotes((noteRes.data ?? []) as NoteRow[]);
      setDocuments((documentRes.data ?? []) as DocumentRow[]);
      setInvoices((invoiceRes.data ?? []) as InvoiceRow[]);
      setAcceptedBid((bidRes.data ?? null) as unknown as BidRow | null);
      setBidCount(bidCountRes.count ?? 0);
      setLoading(false);
    };

    void run();
  }, [companyId, jobId]);

  const podFiles = useMemo(() => {
    if (!job) return [];
    const photos = [...(job.delivery_photos ?? []), ...(job.pod_photos ?? [])].map((path, index) => ({
      id: `photo-${index}`,
      label: `POD ${index + 1}`,
      path,
    }));
    const docs = documents
      .filter((doc) => `${doc.doc_type ?? ''} ${doc.file_type ?? ''}`.toLowerCase().includes('pod') || doc.file_path || doc.file_url)
      .map((doc, index) => ({
        id: doc.id,
        label: doc.doc_type || doc.file_type || `POD document ${index + 1}`,
        path: doc.file_path || doc.file_url || '',
      }))
      .filter((file) => file.path);
    return [...photos, ...docs];
  }, [documents, job]);

  const completedStatuses = useMemo(() => {
    const set = new Set<string>();
    for (const entry of job?.status_history ?? []) {
      if (entry.status) set.add(entry.status);
    }
    for (const event of events) {
      if (event.event_type) set.add(event.event_type);
    }
    if (job?.status) set.add(job.status);
    if (bidCount > 0) set.add('quoted');
    if (acceptedBid) set.add('awarded');
    if (set.has('awarded') && (set.has('allocated') || String(job?.status ?? '').toLowerCase() === 'allocated')) set.add('allocated');
    if (podFiles.length > 0) set.add('pod_uploaded');
    if (invoices.length > 0) set.add('invoiced');
    if (invoices.some((invoice) => invoice.payment_status === 'paid')) set.add('paid');
    if (set.has('paid')) set.add('closed');
    return set;
  }, [acceptedBid, bidCount, events, invoices, job, podFiles.length]);

  const resolvePodUrl = async (path: string) => {
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const { data, error } = await supabase.storage.from('pod-docs').createSignedUrl(path, 60 * 5);
    if (error || !data?.signedUrl) throw new Error(error?.message ?? 'POD file is not available.');
    return data.signedUrl;
  };

  const openPod = async (path: string) => {
    try {
      window.open(await resolvePodUrl(path), '_blank', 'noopener,noreferrer');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to open POD.');
    }
  };

  return (
    <ProtectedRoute allowedRoles={['customer']}>
      <main className="page">
        <button onClick={() => router.push('/customer')}>Back to Customer Portal</button>
        {message && <div className="notice">{message}</div>}
        {loading ? <section className="card">Loading job...</section> : job && (
          <div className="stack">
            <section className="card">
              <div className="split">
                <div>
                  <p>Customer Job</p>
                  <h1>{job.pickup_postcode ?? job.pickup_location ?? '-'} to {job.delivery_postcode ?? job.delivery_location ?? '-'}</h1>
                </div>
                <strong>{job.status}</strong>
              </div>
              <div className="grid">
                <span>Pickup: {dateDisplay(job.pickup_datetime)}</span>
                <span>Delivery: {dateDisplay(job.delivery_datetime)}</span>
                <span>Vehicle: {job.vehicle_type?.replace(/_/g, ' ') ?? '-'}</span>
                <span>Cargo: {job.cargo_type ?? '-'}</span>
              </div>
            </section>

            <section className="card">
              <h2>Assigned Carrier</h2>
              <p>{acceptedBid?.companies?.name ?? (job.awarded_carrier_company_id ? 'Carrier awarded' : 'No carrier awarded yet')}</p>
              {acceptedBid && <p>Accepted rate: {money(acceptedBid.bid_price_gbp ?? acceptedBid.amount)}</p>}
            </section>

            <section className="card">
              <h2>Timeline</h2>
              <div className="timeline">
                {timelineSteps.map(([key, label]) => <div key={key} className={completedStatuses.has(key) ? 'done' : ''}>{label}</div>)}
              </div>
              {events.length > 0 && events.map((event) => <p key={event.id}><strong>{event.event_type}</strong> - {event.message ?? '-'} · {dateDisplay(event.created_at)}</p>)}
            </section>

            <section className="card">
              <h2>POD</h2>
              {podFiles.length === 0 ? <p>POD pending.</p> : podFiles.map((file) => (
                <div key={file.id} className="row">
                  <span>{file.label}</span>
                  <button onClick={() => void openPod(file.path)}>Open</button>
                </div>
              ))}
            </section>

            <section className="card">
              <h2>Invoice Status</h2>
              {invoices.length === 0 ? <p>No invoice issued yet.</p> : invoices.map((invoice) => (
                <p key={invoice.id}>{invoice.invoice_number} - {money(invoice.amount)} - {invoice.status} - due {dateDisplay(invoice.due_date)}</p>
              ))}
            </section>

            <section className="card">
              <h2>Notes</h2>
              {notes.length === 0 ? <p>No customer-visible notes found.</p> : notes.map((note) => <p key={note.id}>{note.note} · {dateDisplay(note.created_at)}</p>)}
            </section>
          </div>
        )}

        <style jsx>{`
          .page { min-height: 100vh; background: #f3f4f6; color: #0f172a; padding: 16px; }
          .stack { display: grid; gap: 16px; max-width: 1100px; margin: 16px auto; }
          .card { background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
          .split { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
          .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; color: #64748b; }
          button { border: 1px solid #cbd5e1; background: white; border-radius: 8px; padding: 10px 14px; font-weight: 800; cursor: pointer; color: #0f172a; }
          .notice { max-width: 1100px; margin: 12px auto; border: 1px solid #f59e0b; background: #fef3c7; color: #92400e; border-radius: 8px; padding: 12px; font-weight: 800; }
          .timeline { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; }
          .timeline div { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; color: #64748b; font-weight: 800; }
          .timeline .done { background: #dcfce7; border-color: #22c55e; color: #14532d; }
          .row { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 0; border-top: 1px solid #e2e8f0; }
        `}</style>
      </main>
    </ProtectedRoute>
  );
}
