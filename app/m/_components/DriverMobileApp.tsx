'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';

type MobileTab = 'home' | 'loads' | 'quotes' | 'jobs' | 'more';

type MobileJob = {
  id: string;
  status: string | null;
  current_status: string | null;
  pickup_location: string | null;
  delivery_location: string | null;
  pickup_datetime: string | null;
  delivery_datetime: string | null;
  client_name: string | null;
  vehicle_type: string | null;
  load_details: string | null;
  delivery_photos: string[] | null;
  pod_photos: string[] | null;
  on_my_way_at: string | null;
  on_site_pickup_at: string | null;
  loaded_at: string | null;
  on_site_delivery_at: string | null;
  delivered_at: string | null;
  updated_at: string | null;
  created_at: string | null;
};

type AvailableLoad = {
  id: string;
  pickup_location: string | null;
  delivery_location: string | null;
  pickup_datetime: string | null;
  vehicle_type: string | null;
  budget_amount: number | null;
  status: string | null;
};

type DriverBid = {
  id: string;
  status: string;
  amount: number | null;
  bid_price_gbp: number | null;
  created_at: string;
  jobs: {
    pickup_location: string | null;
    delivery_location: string | null;
    pickup_datetime: string | null;
  } | null;
};

type VehicleRow = {
  id: string;
  reg_plate: string | null;
  type: string | null;
  make: string | null;
  model: string | null;
};

type DriverJobNote = {
  id: string;
  job_id: string;
  note: string | null;
  created_at: string | null;
};

type DriverDocument = {
  id: string;
  doc_type: string | null;
  status: string | null;
  expiry_date: string | null;
  created_at: string | null;
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  posted: 'Posted',
  awarded: 'Awarded',
  allocated: 'Allocated',
  on_my_way: 'On route',
  on_site_pickup: 'Arrived pickup',
  loaded: 'Loaded',
  on_site_delivery: 'Arrived delivery',
  in_transit: 'In transit',
  delivered: 'Delivered',
  completed: 'Completed',
};

const fmtTime = (value: string | null | undefined) => {
  if (!value) return 'TBC';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'TBC';
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

const fmtDateTime = (value: string | null | undefined) => {
  if (!value) return 'TBC';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'TBC';
  return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const normalizeStatus = (job: MobileJob | null) => job?.current_status || job?.status || 'allocated';
const isLiveJob = (job: MobileJob) => !['delivered', 'completed', 'cancelled'].includes(normalizeStatus(job));

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  background: '#101114',
  color: '#f8fafc',
  padding: '0.75rem 0.75rem 5.25rem',
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const cardStyle: CSSProperties = {
  background: '#181a20',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '16px',
  padding: '1rem',
  boxShadow: '0 10px 28px rgba(0,0,0,0.28)',
};

const mutedStyle: CSSProperties = { color: '#9ca3af', fontSize: '0.78rem' };

export default function DriverMobileApp() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const podInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<MobileTab>('home');
  const [jobs, setJobs] = useState<MobileJob[]>([]);
  const [loads, setLoads] = useState<AvailableLoad[]>([]);
  const [bids, setBids] = useState<DriverBid[]>([]);
  const [vehicle, setVehicle] = useState<VehicleRow | null>(null);
  const [notes, setNotes] = useState<DriverJobNote[]>([]);
  const [documents, setDocuments] = useState<DriverDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const driverId = user?.driverId ?? null;
  const companyId = user?.companyId ?? null;

  const loadData = useCallback(async () => {
    setLoading(true);
    setMessage('');
    if (!isSupabaseConfigured || !driverId) {
      setLoading(false);
      return;
    }

    const [jobRes, vehicleRes, loadRes, bidRes, documentRes] = await Promise.all([
      supabase
        .from('jobs')
        .select('id, status, current_status, pickup_location, delivery_location, pickup_datetime, delivery_datetime, client_name, vehicle_type, load_details, delivery_photos, pod_photos, on_my_way_at, on_site_pickup_at, loaded_at, on_site_delivery_at, delivered_at, updated_at, created_at')
        .eq('assigned_driver_id', driverId)
        .order('pickup_datetime', { ascending: true })
        .limit(80),
      supabase
        .from('vehicles')
        .select('id, reg_plate, type, make, model')
        .eq('assigned_driver_id', driverId)
        .limit(1)
        .maybeSingle(),
      supabase
        .from('jobs')
        .select('id, pickup_location, delivery_location, pickup_datetime, vehicle_type, budget_amount, status')
        .in('status', ['posted', 'open'])
        .is('awarded_carrier_company_id', null)
        .order('pickup_datetime', { ascending: true })
        .limit(25),
      companyId
        ? supabase
            .from('job_bids')
            .select('id, status, amount, bid_price_gbp, created_at, jobs:job_id(pickup_location, delivery_location, pickup_datetime)')
            .eq('company_id', companyId)
            .order('created_at', { ascending: false })
            .limit(40)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from('driver_documents')
        .select('id, doc_type, status, expiry_date, created_at')
        .eq('driver_id', driverId)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    if (jobRes.error) setMessage(`Jobs could not be loaded: ${jobRes.error.message}`);
    const jobRows = (jobRes.data ?? []) as MobileJob[];
    setJobs(jobRows);
    setVehicle((vehicleRes.data ?? null) as VehicleRow | null);
    setLoads((loadRes.data ?? []) as AvailableLoad[]);
    setBids((bidRes.data ?? []) as unknown as DriverBid[]);
    setDocuments((documentRes.data ?? []) as DriverDocument[]);

    if (jobRows.length) {
      const { data: noteRows } = await supabase
        .from('job_notes')
        .select('id, job_id, note, created_at')
        .in('job_id', jobRows.map((job) => job.id))
        .order('created_at', { ascending: false })
        .limit(20);
      setNotes((noteRows ?? []) as DriverJobNote[]);
    } else {
      setNotes([]);
    }
    setLoading(false);
  }, [driverId, companyId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeJob = useMemo(() => jobs.find(isLiveJob) ?? jobs[0] ?? null, [jobs]);
  const todaysJobs = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return jobs.filter((job) => (job.pickup_datetime ?? job.created_at ?? '').slice(0, 10) === today).slice(0, 6);
  }, [jobs]);
  const completedJobs = jobs.filter((job) => ['delivered', 'completed'].includes(normalizeStatus(job)));
  const activeJobs = jobs.filter(isLiveJob);
  const activeJobNotes = activeJob ? notes.filter((note) => note.job_id === activeJob.id).slice(0, 3) : [];

  const updateStatus = async (
    job: MobileJob,
    nextStatus: string,
    timestampField: 'on_my_way_at' | 'on_site_pickup_at' | 'loaded_at' | 'on_site_delivery_at' | 'delivered_at'
  ) => {
    if (!driverId || !isSupabaseConfigured) return;
    setBusyAction(nextStatus);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('jobs')
      .update({
        status: nextStatus,
        current_status: nextStatus,
        status_updated_at: now,
        updated_at: now,
        [timestampField]: now,
      })
      .eq('id', job.id)
      .eq('assigned_driver_id', driverId);
    setBusyAction(null);
    if (error) {
      setMessage(`Status update failed: ${error.message}`);
      return;
    }
    setMessage('Status updated.');
    await loadData();
  };

  const uploadPod = async (file: File | null) => {
    if (!file || !activeJob || !driverId || !isSupabaseConfigured) return;
    setBusyAction('pod');
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${activeJob.id}/${Date.now()}-${safeName}`;
    const upload = await supabase.storage.from('pod-docs').upload(storagePath, file, { cacheControl: '3600', upsert: false });
    if (upload.error) {
      setBusyAction(null);
      setMessage(`POD upload failed: ${upload.error.message}`);
      return;
    }
    const nextDeliveryPhotos = [...(activeJob.delivery_photos ?? []), storagePath];
    const nextPodPhotos = [...(activeJob.pod_photos ?? []), storagePath];
    const { error } = await supabase
      .from('jobs')
      .update({
        delivery_photos: nextDeliveryPhotos,
        pod_photos: nextPodPhotos,
        pod_generated: true,
        pod_generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', activeJob.id)
      .eq('assigned_driver_id', driverId);
    setBusyAction(null);
    if (error) {
      setMessage(`POD save failed: ${error.message}`);
      return;
    }
    setMessage('POD uploaded.');
    await loadData();
  };

  const Header = () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: '#facc15', color: '#111827', display: 'grid', placeItems: 'center', fontWeight: 900 }}>XD</div>
        <div>
          <div style={{ fontSize: '0.88rem', fontWeight: 800 }}>Driver</div>
          <div style={{ ...mutedStyle, fontSize: '0.72rem' }}>{vehicle?.reg_plate || vehicle?.type || 'Vehicle TBC'}</div>
        </div>
      </div>
      <button onClick={() => void loadData()} style={ghostButton}>Refresh</button>
    </div>
  );

  const Home = () => (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <section style={{ ...cardStyle, borderColor: '#facc15', background: 'linear-gradient(180deg, #22231c 0%, #181a20 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start' }}>
          <div>
            <div style={{ color: '#facc15', fontSize: '0.72rem', fontWeight: 900, letterSpacing: '0.06em' }}>ACTIVE JOB</div>
            <h1 style={{ margin: '0.35rem 0 0', fontSize: '1.25rem', lineHeight: 1.15 }}>
              {activeJob ? `${activeJob.pickup_location || 'Pickup TBC'} to ${activeJob.delivery_location || 'Delivery TBC'}` : 'No active job'}
            </h1>
          </div>
          {activeJob && <StatusPill status={normalizeStatus(activeJob)} />}
        </div>

        {activeJob ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginTop: '0.9rem' }}>
              <InfoBlock label="Pickup" value={fmtDateTime(activeJob.pickup_datetime)} />
              <InfoBlock label="Delivery" value={fmtDateTime(activeJob.delivery_datetime)} />
              <InfoBlock label="Customer" value={activeJob.client_name || 'TBC'} />
              <InfoBlock label="Vehicle" value={activeJob.vehicle_type?.replace(/_/g, ' ') || vehicle?.reg_plate || 'TBC'} />
            </div>
            <StatusActions job={activeJob} busyAction={busyAction} updateStatus={updateStatus} />
            <button onClick={() => podInputRef.current?.click()} disabled={busyAction === 'pod'} style={primaryActionButton}>
              {busyAction === 'pod' ? 'Uploading POD...' : 'Upload POD'}
            </button>
          </>
        ) : (
          <div style={{ ...mutedStyle, marginTop: '0.75rem' }}>You have no active assigned work right now.</div>
        )}
      </section>

      <section style={cardStyle}>
        <div style={sectionTitle}>Next stop</div>
        {activeJob ? (
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 800 }}>{nextStopLabel(activeJob)}</div>
            <div style={{ ...mutedStyle, marginTop: '0.3rem' }}>{nextStopAddress(activeJob)}</div>
          </div>
        ) : <div style={mutedStyle}>No next stop available.</div>}
      </section>

      <section style={cardStyle}>
        <div style={sectionTitle}>Today&apos;s jobs</div>
        <JobMiniList jobs={todaysJobs.length ? todaysJobs : activeJobs.slice(0, 4)} />
      </section>

      <section style={cardStyle}>
        <div style={sectionTitle}>Driver messages / notes</div>
        {activeJobNotes.length === 0 ? (
          <div style={mutedStyle}>No notes for the active job.</div>
        ) : (
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {activeJobNotes.map((note) => (
              <div key={note.id} style={{ background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '0.7rem' }}>
                <div style={{ fontWeight: 780, lineHeight: 1.35 }}>{note.note}</div>
                <div style={{ ...mutedStyle, marginTop: '0.25rem' }}>{fmtDateTime(note.created_at)}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={cardStyle}>
        <div style={sectionTitle}>Tracking</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
          <InfoBlock label="Driver status" value={activeJob ? statusLabels[normalizeStatus(activeJob)] ?? normalizeStatus(activeJob) : 'Available'} />
          <InfoBlock label="Assigned vehicle" value={vehicle ? [vehicle.reg_plate, vehicle.make, vehicle.model].filter(Boolean).join(' ') : 'TBC'} />
        </div>
      </section>
    </div>
  );

  const Loads = () => (
    <section style={cardStyle}>
      <div style={sectionTitle}>Available loads</div>
      <div style={{ display: 'grid', gap: '0.6rem' }}>
        {loads.length === 0 ? <div style={mutedStyle}>No available loads match your account right now.</div> : loads.map((load) => (
          <button key={load.id} onClick={() => setMessage('Load detail and quote actions stay inside the mobile app.')} style={listButton}>
            <div style={{ fontWeight: 800 }}>{load.pickup_location || 'Pickup TBC'} to {load.delivery_location || 'Delivery TBC'}</div>
            <div style={mutedStyle}>{fmtDateTime(load.pickup_datetime)} · {load.vehicle_type?.replace(/_/g, ' ') || 'Vehicle TBC'} · {load.budget_amount ? `£${Number(load.budget_amount).toFixed(0)}` : 'Quote required'}</div>
          </button>
        ))}
      </div>
    </section>
  );

  const Quotes = () => {
    const submitted = bids.filter((bid) => bid.status === 'submitted');
    const won = bids.filter((bid) => bid.status === 'accepted');
    const unsuccessful = bids.filter((bid) => ['rejected', 'withdrawn', 'unsuccessful'].includes(bid.status));
    return (
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <QuoteGroup title="Submitted" bids={submitted} />
        <QuoteGroup title="Won" bids={won} />
        <QuoteGroup title="Unsuccessful" bids={unsuccessful} />
      </div>
    );
  };

  const Jobs = () => (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <section style={cardStyle}>
        <div style={sectionTitle}>Active jobs</div>
        <JobMiniList jobs={activeJobs} />
      </section>
      <section style={cardStyle}>
        <div style={sectionTitle}>Completed</div>
        <JobMiniList jobs={completedJobs.slice(0, 8)} />
      </section>
    </div>
  );

  const More = () => (
    <section style={cardStyle}>
      <div style={sectionTitle}>More</div>
      <div style={{ marginBottom: '0.9rem' }}>
        <div style={{ ...mutedStyle, marginBottom: '0.45rem', fontWeight: 850, textTransform: 'uppercase' }}>Documents</div>
        {documents.length === 0 ? (
          <div style={mutedStyle}>No compliance documents uploaded yet.</div>
        ) : documents.slice(0, 4).map((doc) => (
          <div key={doc.id} style={{ background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '0.7rem', marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 850 }}>{doc.doc_type || 'Document'}</div>
                <div style={mutedStyle}>{doc.expiry_date ? `Expires ${fmtDateTime(doc.expiry_date)}` : 'No expiry date'}</div>
              </div>
              <StatusPill status={doc.status || 'pending'} />
            </div>
          </div>
        ))}
      </div>
      {[
        ['Jobs', 'jobs'],
        ['POD upload', 'pod'],
        ['Profile', '/driver/change-password'],
        ['Password', '/driver/change-password'],
        ['Support', 'mailto:support@xdrivelogistics.co.uk'],
      ].map(([label, href]) => (
        <button key={label} onClick={() => {
          if (href === 'jobs') setTab('jobs');
          else if (href === 'pod') podInputRef.current?.click();
          else if (href.startsWith('mailto:')) window.location.href = href;
          else router.push(href);
        }} style={moreButton}>
          {label}
          <span style={{ color: '#facc15' }}>›</span>
        </button>
      ))}
      <button onClick={() => void logout()} style={{ ...moreButton, color: '#fecaca' }}>Sign out<span>›</span></button>
    </section>
  );

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <main style={pageStyle}>
        <Header />
        {message && <div style={{ background: '#27210f', border: '1px solid rgba(250,204,21,0.35)', color: '#fde68a', borderRadius: 12, padding: '0.65rem 0.75rem', marginBottom: '0.75rem', fontSize: '0.82rem' }}>{message}</div>}
        {!driverId && <div style={cardStyle}>No driver profile is linked to this account.</div>}
        {loading ? <div style={cardStyle}>Loading work...</div> : (
          <>
            {tab === 'home' && <Home />}
            {tab === 'loads' && <Loads />}
            {tab === 'quotes' && <Quotes />}
            {tab === 'jobs' && <Jobs />}
            {tab === 'more' && <More />}
          </>
        )}
        <input ref={podInputRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={(event) => void uploadPod(event.target.files?.[0] ?? null)} />
        <BottomNav active={tab} onChange={setTab} />
      </main>
    </ProtectedRoute>
  );
}

function StatusActions({
  job,
  busyAction,
  updateStatus,
}: {
  job: MobileJob;
  busyAction: string | null;
  updateStatus: (
    job: MobileJob,
    nextStatus: string,
    timestampField: 'on_my_way_at' | 'on_site_pickup_at' | 'loaded_at' | 'on_site_delivery_at' | 'delivered_at'
  ) => Promise<void>;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.55rem', marginTop: '0.9rem' }}>
      <button onClick={() => void updateStatus(job, 'on_my_way', 'on_my_way_at')} disabled={busyAction === 'on_my_way'} style={statusButton}>On Route</button>
      <button onClick={() => void updateStatus(job, 'on_site_pickup', 'on_site_pickup_at')} disabled={busyAction === 'on_site_pickup'} style={statusButton}>Arrived</button>
      <button onClick={() => void updateStatus(job, 'loaded', 'loaded_at')} disabled={busyAction === 'loaded'} style={statusButton}>Loaded</button>
      <button onClick={() => void updateStatus(job, 'delivered', 'delivered_at')} disabled={busyAction === 'delivered'} style={statusButton}>Delivered</button>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.055)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '0.7rem' }}>
      <div style={{ color: '#9ca3af', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ color: '#fff', fontSize: '0.88rem', fontWeight: 750, marginTop: '0.25rem', lineHeight: 1.25 }}>{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span style={{ flexShrink: 0, background: '#facc15', color: '#111827', borderRadius: 999, padding: '0.24rem 0.55rem', fontSize: '0.68rem', fontWeight: 900 }}>
      {statusLabels[status] ?? status}
    </span>
  );
}

function JobMiniList({ jobs }: { jobs: MobileJob[] }) {
  if (jobs.length === 0) return <div style={mutedStyle}>No jobs to show.</div>;
  return (
    <div style={{ display: 'grid', gap: '0.55rem' }}>
      {jobs.map((job) => (
        <div key={job.id} style={{ background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '0.72rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.55rem' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 850, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {job.pickup_location || 'Pickup TBC'} to {job.delivery_location || 'Delivery TBC'}
              </div>
              <div style={{ ...mutedStyle, marginTop: '0.2rem' }}>{fmtTime(job.pickup_datetime)} pickup · {fmtTime(job.delivery_datetime)} delivery</div>
            </div>
            <StatusPill status={normalizeStatus(job)} />
          </div>
          <Timeline job={job} />
        </div>
      ))}
    </div>
  );
}

function Timeline({ job }: { job: MobileJob }) {
  const steps = [
    ['Pickup', job.on_site_pickup_at],
    ['Loaded', job.loaded_at],
    ['In transit', job.on_site_delivery_at],
    ['Delivered', job.delivered_at],
    ['POD', (job.pod_photos?.length || job.delivery_photos?.length) ? 'uploaded' : null],
  ] as const;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.25rem', marginTop: '0.7rem' }}>
      {steps.map(([label, value]) => (
        <div key={label} style={{ textAlign: 'center' }}>
          <div style={{ height: 5, borderRadius: 999, background: value ? '#facc15' : 'rgba(255,255,255,0.16)' }} />
          <div style={{ marginTop: '0.25rem', color: value ? '#fef3c7' : '#9ca3af', fontSize: '0.58rem', fontWeight: 800 }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

function QuoteGroup({ title, bids }: { title: string; bids: DriverBid[] }) {
  return (
    <section style={cardStyle}>
      <div style={sectionTitle}>{title}</div>
      {bids.length === 0 ? <div style={mutedStyle}>No quotes in this section.</div> : (
        <div style={{ display: 'grid', gap: '0.55rem' }}>
          {bids.map((bid) => (
            <div key={bid.id} style={{ background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '0.72rem' }}>
              <div style={{ fontWeight: 850 }}>{bid.jobs?.pickup_location || 'Pickup TBC'} to {bid.jobs?.delivery_location || 'Delivery TBC'}</div>
              <div style={mutedStyle}>{fmtDateTime(bid.jobs?.pickup_datetime)} · £{Number(bid.bid_price_gbp ?? bid.amount ?? 0).toFixed(2)}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function BottomNav({ active, onChange }: { active: MobileTab; onChange: (tab: MobileTab) => void }) {
  const items: Array<[MobileTab, string]> = [
    ['home', 'Home'],
    ['loads', 'Loads'],
    ['quotes', 'Quotes'],
    ['jobs', 'Jobs'],
    ['more', 'More'],
  ];
  return (
    <nav style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: '#0b0c0f', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', padding: '0.35rem 0.45rem 0.55rem', zIndex: 30 }}>
      {items.map(([id, label]) => {
        const selected = active === id;
        return (
          <button key={id} onClick={() => onChange(id)} style={{ minHeight: 48, border: 'none', borderRadius: 12, background: selected ? '#facc15' : 'transparent', color: selected ? '#111827' : '#cbd5e1', fontSize: '0.7rem', fontWeight: 900, cursor: 'pointer' }}>
            {label}
          </button>
        );
      })}
    </nav>
  );
}

function nextStopLabel(job: MobileJob) {
  const status = normalizeStatus(job);
  if (['loaded', 'on_site_delivery', 'in_transit'].includes(status)) return 'Go to delivery';
  if (status === 'delivered') return 'Upload POD / finish job';
  return 'Go to pickup';
}

function nextStopAddress(job: MobileJob) {
  const status = normalizeStatus(job);
  if (['loaded', 'on_site_delivery', 'in_transit'].includes(status)) return job.delivery_location || 'Delivery address TBC';
  return job.pickup_location || 'Pickup address TBC';
}

const sectionTitle: CSSProperties = {
  color: '#f8fafc',
  fontSize: '0.82rem',
  fontWeight: 900,
  marginBottom: '0.65rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const ghostButton: CSSProperties = {
  minHeight: 38,
  padding: '0 0.8rem',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 999,
  background: '#181a20',
  color: '#f8fafc',
  fontSize: '0.74rem',
  fontWeight: 800,
  cursor: 'pointer',
};

const statusButton: CSSProperties = {
  minHeight: 54,
  border: '1px solid rgba(250,204,21,0.34)',
  borderRadius: 14,
  background: '#111827',
  color: '#fef3c7',
  fontSize: '0.86rem',
  fontWeight: 900,
  cursor: 'pointer',
};

const primaryActionButton: CSSProperties = {
  width: '100%',
  minHeight: 56,
  marginTop: '0.6rem',
  border: 'none',
  borderRadius: 14,
  background: '#facc15',
  color: '#111827',
  fontSize: '0.95rem',
  fontWeight: 950,
  cursor: 'pointer',
};

const listButton: CSSProperties = {
  width: '100%',
  textAlign: 'left',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 13,
  background: 'rgba(255,255,255,0.045)',
  color: '#fff',
  padding: '0.8rem',
  cursor: 'pointer',
};

const moreButton: CSSProperties = {
  width: '100%',
  minHeight: 52,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  border: 'none',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  background: 'transparent',
  color: '#f8fafc',
  fontSize: '0.92rem',
  fontWeight: 800,
  cursor: 'pointer',
};
