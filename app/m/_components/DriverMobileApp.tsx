'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import MobileWebDeprecationNotice from './MobileWebDeprecationNotice';
import {
  MobileCard,
  MobileKpiGrid,
  MobileKpiItem,
  MobileSectionTitle,
  mobileMutedTextStyle,
} from './MobileUiPrimitives';

type MobileTab = 'home' | 'alerts' | 'quotes' | 'bookings' | 'more';

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

type DriverNotification = {
  id: string;
  title: string;
  body: string | null;
  type: string | null;
  read_at: string | null;
  created_at: string | null;
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  posted: 'Posted',
  awarded: 'Assigned',
  allocated: 'Assigned',
  on_my_way: 'On Route',
  on_site_pickup: 'At Pickup',
  loaded: 'Loaded',
  on_site_delivery: 'At Delivery',
  in_transit: 'In Transit',
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
const isAssignedJob = (job: MobileJob) => ['awarded', 'allocated'].includes(normalizeStatus(job));
const isInProgressJob = (job: MobileJob) => ['on_my_way', 'on_site_pickup', 'loaded', 'on_site_delivery', 'in_transit'].includes(normalizeStatus(job));

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  background: '#101114',
  color: '#f8fafc',
  padding: '0.75rem 0.75rem 5.25rem',
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

export default function DriverMobileApp() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const podInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<MobileTab>('home');
  const [jobs, setJobs] = useState<MobileJob[]>([]);
  const [bids, setBids] = useState<DriverBid[]>([]);
  const [vehicle, setVehicle] = useState<VehicleRow | null>(null);
  const [notes, setNotes] = useState<DriverJobNote[]>([]);
  const [documents, setDocuments] = useState<DriverDocument[]>([]);
  const [notifications, setNotifications] = useState<DriverNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const driverId = user?.driverId ?? null;
  const companyId = user?.companyId ?? null;
  const userId = user?.id ?? null;

  const loadData = useCallback(async () => {
    setLoading(true);
    setMessage('');
    if (!isSupabaseConfigured || !driverId) {
      setLoading(false);
      return;
    }

    const [jobRes, vehicleRes, bidRes, documentRes, notifRes] = await Promise.all([
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
      userId
        ? supabase
            .from('notifications')
            .select('id, title, body, type, read_at, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(50)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (jobRes.error) setMessage(`Jobs could not be loaded: ${jobRes.error.message}`);
    const jobRows = (jobRes.data ?? []) as MobileJob[];
    setJobs(jobRows);
    setVehicle((vehicleRes.data ?? null) as VehicleRow | null);
    setBids((bidRes.data ?? []) as unknown as DriverBid[]);
    setDocuments((documentRes.data ?? []) as DriverDocument[]);
    setNotifications((notifRes.data ?? []) as DriverNotification[]);

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
  }, [driverId, companyId, userId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeJob = useMemo(() => jobs.find(isLiveJob) ?? jobs[0] ?? null, [jobs]);
  const todaysJobs = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return jobs.filter((job: MobileJob) => (job.pickup_datetime ?? job.created_at ?? '').slice(0, 10) === today).slice(0, 6);
  }, [jobs]);
  const completedJobs = jobs.filter((job: MobileJob) => ['delivered', 'completed'].includes(normalizeStatus(job)));
  const activeJobs = jobs.filter(isLiveJob);
  const assignedJobs = jobs.filter(isAssignedJob);
  const inProgressJobs = jobs.filter(isInProgressJob);
  const activeJobNotes = activeJob ? notes.filter((note: DriverJobNote) => note.job_id === activeJob.id).slice(0, 3) : [];
  const unreadNotifCount = notifications.filter((n: DriverNotification) => !n.read_at).length;

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

  const markAllNotificationsRead = async () => {
    if (!userId || !isSupabaseConfigured) return;
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('read_at', null);
    await loadData();
  };

  const Header = () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: '#facc15', color: '#111827', display: 'grid', placeItems: 'center', fontWeight: 900 }}>XD</div>
        <div>
          <div style={{ fontSize: '0.88rem', fontWeight: 800 }}>Driver</div>
          <div style={{ ...mobileMutedTextStyle, fontSize: '0.72rem' }}>{vehicle?.reg_plate || vehicle?.type || 'Vehicle TBC'}</div>
        </div>
      </div>
      <button onClick={() => void loadData()} style={ghostButton}>Refresh</button>
    </div>
  );

  const Home = () => {
    const vehicleLabel = vehicle ? [vehicle.reg_plate, vehicle.make, vehicle.model].filter(Boolean).join(' ') : 'No vehicle assigned';
    return (
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        {unreadNotifCount > 0 && (
          <button onClick={() => setTab('alerts')} style={{ ...moreButton, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 12, padding: '0.65rem 0.75rem' }}>
            <span>🔔 {unreadNotifCount} unread notification{unreadNotifCount !== 1 ? 's' : ''}</span>
            <span style={{ color: '#60a5fa' }}>View →</span>
          </button>
        )}
        <MobileCard>
          <MobileKpiGrid>
            <MobileKpiItem label="Assigned" value={String(assignedJobs.length)} />
            <MobileKpiItem label="In Progress" value={String(inProgressJobs.length)} />
            <MobileKpiItem label="Completed" value={String(completedJobs.length)} />
            <MobileKpiItem label="Assigned vehicle" value={vehicleLabel} />
          </MobileKpiGrid>
        </MobileCard>
        <MobileCard highlighted>
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
                <MobileKpiItem label="Pickup" value={fmtDateTime(activeJob.pickup_datetime)} />
                <MobileKpiItem label="Delivery" value={fmtDateTime(activeJob.delivery_datetime)} />
                <MobileKpiItem label="Customer" value={activeJob.client_name || 'TBC'} />
                <MobileKpiItem label="Vehicle" value={activeJob.vehicle_type?.replace(/_/g, ' ') || vehicleLabel} />
              </div>
              <StatusActions job={activeJob} busyAction={busyAction} updateStatus={updateStatus} />
              <button onClick={() => podInputRef.current?.click()} disabled={busyAction === 'pod'} style={primaryActionButton}>
                {busyAction === 'pod' ? 'Uploading POD...' : 'Upload POD'}
              </button>
            </>
          ) : (
            <div style={{ ...mobileMutedTextStyle, marginTop: '0.75rem' }}>You have no active assigned work right now.</div>
          )}
        </MobileCard>
        <MobileCard>
          <MobileSectionTitle>Next stop</MobileSectionTitle>
          {activeJob ? (
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 800 }}>{nextStopLabel(activeJob)}</div>
              <div style={{ ...mobileMutedTextStyle, marginTop: '0.3rem' }}>{nextStopAddress(activeJob)}</div>
            </div>
          ) : <div style={mobileMutedTextStyle}>No next stop available.</div>}
        </MobileCard>
        <MobileCard>
          <MobileSectionTitle>Today&apos;s jobs</MobileSectionTitle>
          <JobMiniList jobs={todaysJobs.length ? todaysJobs : activeJobs.slice(0, 4)} />
        </MobileCard>
        {activeJobNotes.length > 0 && (
          <MobileCard>
            <MobileSectionTitle>Job notes</MobileSectionTitle>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {activeJobNotes.map((note) => (
                <div key={note.id} style={{ background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '0.7rem' }}>
                  <div style={{ fontWeight: 780, lineHeight: 1.35 }}>{note.note}</div>
                  <div style={{ ...mobileMutedTextStyle, marginTop: '0.25rem' }}>{fmtDateTime(note.created_at)}</div>
                </div>
              ))}
            </div>
          </MobileCard>
        )}
      </div>
    );
  };

  const Alerts = () => {
    const [notifFilter, setNotifFilter] = useState<'all' | 'unread' | 'important'>('all');
    const filtered = notifications.filter((n) => {
      if (notifFilter === 'unread') return !n.read_at;
      if (notifFilter === 'important') return ['job_assigned', 'job_cancelled', 'pod_rejected', 'document_rejected'].includes(n.type ?? '');
      return true;
    });
    return (
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <MobileCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
            <MobileSectionTitle>Alerts</MobileSectionTitle>
            {unreadNotifCount > 0 && (
              <button onClick={() => void markAllNotificationsRead()} style={{ ...ghostButton, fontSize: '0.72rem' }}>Mark all read</button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {(['all', 'unread', 'important'] as const).map((f) => (
              <button key={f} onClick={() => setNotifFilter(f)} style={{ flex: 1, minHeight: 36, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, background: notifFilter === f ? '#facc15' : 'transparent', color: notifFilter === f ? '#111827' : '#cbd5e1', fontWeight: 800, fontSize: '0.72rem', cursor: 'pointer' }}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </MobileCard>
        {filtered.length === 0 ? (
          <MobileCard>
            <MobileSectionTitle>No notifications</MobileSectionTitle>
            <div style={mobileMutedTextStyle}>
              {notifFilter === 'unread' ? 'All notifications are read.' : 'Notifications for job assignments, updates, POD approvals and messages will appear here.'}
            </div>
          </MobileCard>
        ) : (
          filtered.map((n) => (
            <MobileCard key={n.id} style={{ borderColor: !n.read_at ? 'rgba(59,130,246,0.4)' : undefined }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                <div style={{ fontSize: '1.3rem' }}>{notificationIcon(n.type)}</div>
                {!n.read_at && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', flexShrink: 0 }} />}
              </div>
              <div style={{ fontWeight: 850 }}>{n.title}</div>
              {n.body && <div style={mobileMutedTextStyle}>{n.body}</div>}
              <div style={{ ...mobileMutedTextStyle, fontSize: '0.65rem' }}>{fmtDateTime(n.created_at)}</div>
            </MobileCard>
          ))
        )}
      </div>
    );
  };

  const Quotes = () => {
    const [quoteFilter, setQuoteFilter] = useState<'all' | 'submitted' | 'accepted' | 'rejected'>('all');
    const filtered = quoteFilter === 'all' ? bids : bids.filter((b) => b.status === quoteFilter);
    return (
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <MobileCard>
          <MobileSectionTitle>Quotes</MobileSectionTitle>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {(['all', 'submitted', 'accepted', 'rejected'] as const).map((f) => (
              <button key={f} onClick={() => setQuoteFilter(f)} style={{ flex: 1, minHeight: 36, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, background: quoteFilter === f ? '#facc15' : 'transparent', color: quoteFilter === f ? '#111827' : '#cbd5e1', fontWeight: 800, fontSize: '0.68rem', cursor: 'pointer' }}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </MobileCard>
        {filtered.length === 0 ? (
          <MobileCard><div style={mobileMutedTextStyle}>No quotes to show.</div></MobileCard>
        ) : (
          filtered.map((bid) => (
            <MobileCard key={bid.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.55rem' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 850 }}>{bid.jobs?.pickup_location || 'Pickup TBC'} → {bid.jobs?.delivery_location || 'Delivery TBC'}</div>
                  <div style={{ ...mobileMutedTextStyle, marginTop: '0.2rem' }}>{fmtDateTime(bid.jobs?.pickup_datetime)} · £{Number(bid.bid_price_gbp ?? bid.amount ?? 0).toFixed(2)}</div>
                </div>
                <StatusPill status={bid.status} />
              </div>
              <div style={{ ...mobileMutedTextStyle, fontSize: '0.65rem' }}>{fmtDateTime(bid.created_at)}</div>
            </MobileCard>
          ))
        )}
      </div>
    );
  };

  const Bookings = () => {
    const [bookingTab, setBookingTab] = useState<'assigned' | 'inprogress' | 'completed'>('assigned');
    const current = bookingTab === 'assigned' ? assignedJobs : bookingTab === 'inprogress' ? inProgressJobs : completedJobs;
    return (
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <MobileCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <MobileSectionTitle>Bookings</MobileSectionTitle>
            <button onClick={() => void loadData()} style={ghostButton}>Refresh</button>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {([['assigned', assignedJobs.length], ['inprogress', inProgressJobs.length], ['completed', completedJobs.length]] as Array<['assigned' | 'inprogress' | 'completed', number]>).map(([t, count]) => (
              <button key={t} onClick={() => setBookingTab(t)} style={{ flex: 1, minHeight: 44, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, background: bookingTab === t ? '#facc15' : 'transparent', color: bookingTab === t ? '#111827' : '#cbd5e1', fontWeight: 800, fontSize: '0.68rem', cursor: 'pointer' }}>
                <div>{count}</div>
                <div>{t === 'inprogress' ? 'Active' : t.charAt(0).toUpperCase() + t.slice(1)}</div>
              </button>
            ))}
          </div>
        </MobileCard>
        {current.length === 0 ? (
          <MobileCard><div style={mobileMutedTextStyle}>No {bookingTab === 'inprogress' ? 'in-progress' : bookingTab} jobs right now.</div></MobileCard>
        ) : (
          current.map((job) => (
            <MobileCard key={job.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.55rem' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 850, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {job.pickup_location || 'Pickup TBC'} → {job.delivery_location || 'Delivery TBC'}
                  </div>
                  <div style={{ ...mobileMutedTextStyle, marginTop: '0.2rem' }}>{fmtTime(job.pickup_datetime)} pickup · {fmtTime(job.delivery_datetime)} delivery</div>
                </div>
                <StatusPill status={normalizeStatus(job)} />
              </div>
              <Timeline job={job} />
              {isInProgressJob(job) && (
                <StatusActions job={job} busyAction={busyAction} updateStatus={updateStatus} />
              )}
            </MobileCard>
          ))
        )}
      </div>
    );
  };

  const More = () => (
    <MobileCard>
      <MobileSectionTitle>More</MobileSectionTitle>
      <div style={{ marginBottom: '0.9rem' }}>
        <div style={{ ...mobileMutedTextStyle, marginBottom: '0.45rem', fontWeight: 850, textTransform: 'uppercase' }}>Documents</div>
        {documents.length === 0 ? (
          <div style={mobileMutedTextStyle}>No compliance documents uploaded yet.</div>
        ) : documents.slice(0, 4).map((doc) => (
          <div key={doc.id} style={{ background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '0.7rem', marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 850 }}>{doc.doc_type || 'Document'}</div>
                <div style={mobileMutedTextStyle}>{doc.expiry_date ? `Expires ${fmtDateTime(doc.expiry_date)}` : 'No expiry date'}</div>
              </div>
              <StatusPill status={doc.status || 'pending'} />
            </div>
          </div>
        ))}
      </div>
      {[
        ['Bookings', 'bookings'],
        ['Upload POD', 'pod'],
        ['Profile', '/driver/change-password'],
        ['Change Password', '/driver/change-password'],
        ['Help & Support', 'mailto:support@xdrivelogistics.co.uk'],
      ].map(([label, href]) => (
        <button key={label} onClick={() => {
          if (href === 'bookings') setTab('bookings');
          else if (href === 'pod') podInputRef.current?.click();
          else if (href.startsWith('mailto:')) window.location.href = href;
          else router.push(href);
        }} style={moreButton}>
          {label}
          <span style={{ color: '#facc15' }}>›</span>
        </button>
      ))}
      <button onClick={() => void logout()} style={{ ...moreButton, color: '#fecaca' }}>Sign out<span>›</span></button>
    </MobileCard>
  );

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <main style={pageStyle}>
        <Header />
        <MobileWebDeprecationNotice />
        {message && <div style={{ background: '#27210f', border: '1px solid rgba(250,204,21,0.35)', color: '#fde68a', borderRadius: 12, padding: '0.65rem 0.75rem', marginBottom: '0.75rem', fontSize: '0.82rem' }}>{message}</div>}
        {!driverId && <MobileCard>No driver profile is linked to this account.</MobileCard>}
        {loading ? <MobileCard>Loading work...</MobileCard> : (
          <>
            {tab === 'home' && <Home />}
            {tab === 'alerts' && <Alerts />}
            {tab === 'quotes' && <Quotes />}
            {tab === 'bookings' && <Bookings />}
            {tab === 'more' && <More />}
          </>
        )}
        <input ref={podInputRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={(event) => void uploadPod(event.target.files?.[0] ?? null)} />
        <BottomNav active={tab} onChange={setTab} unreadCount={unreadNotifCount} />
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

function StatusPill({ status }: { status: string }) {
  return (
    <span style={{ flexShrink: 0, background: '#facc15', color: '#111827', borderRadius: 999, padding: '0.24rem 0.55rem', fontSize: '0.68rem', fontWeight: 900 }}>
      {statusLabels[status] ?? status}
    </span>
  );
}

function JobMiniList({ jobs }: { jobs: MobileJob[] }) {
  if (jobs.length === 0) return <div style={mobileMutedTextStyle}>No jobs to show.</div>;
  return (
    <div style={{ display: 'grid', gap: '0.55rem' }}>
      {jobs.map((job) => (
        <div key={job.id} style={{ background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '0.72rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.55rem' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 850, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {job.pickup_location || 'Pickup TBC'} to {job.delivery_location || 'Delivery TBC'}
              </div>
              <div style={{ ...mobileMutedTextStyle, marginTop: '0.2rem' }}>{fmtTime(job.pickup_datetime)} pickup · {fmtTime(job.delivery_datetime)} delivery</div>
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


function BottomNav({ active, onChange, unreadCount }: { active: MobileTab; onChange: (tab: MobileTab) => void; unreadCount: number }) {
  const items: Array<[MobileTab, string]> = [
    ['home', 'Home'],
    ['alerts', 'Alerts'],
    ['quotes', 'Quotes'],
    ['bookings', 'Bookings'],
    ['more', 'More'],
  ];
  return (
    <nav style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: '#0b0c0f', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', padding: '0.35rem 0.45rem 0.55rem', zIndex: 30 }}>
      {items.map(([id, label]) => {
        const selected = active === id;
        return (
          <button key={id} onClick={() => onChange(id)} style={{ minHeight: 48, border: 'none', borderRadius: 12, background: selected ? '#facc15' : 'transparent', color: selected ? '#111827' : '#cbd5e1', fontSize: '0.7rem', fontWeight: 900, cursor: 'pointer', position: 'relative' }}>
            {id === 'alerts' && unreadCount > 0 && (
              <span style={{ position: 'absolute', top: 4, right: 6, background: '#ef4444', color: '#fff', borderRadius: '50%', minWidth: 16, height: 16, fontSize: '0.6rem', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
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

function notificationIcon(type: string | null) {
  switch (type) {
    case 'job_assigned': return '📋';
    case 'job_updated': return '🔄';
    case 'job_cancelled': return '❌';
    case 'quote_accepted': return '✅';
    case 'quote_rejected': return '❌';
    case 'pod_approved': return '✅';
    case 'pod_rejected': return '❌';
    case 'document_approved': return '📄';
    case 'document_rejected': return '📄';
    case 'document_expiring': return '⚠️';
    case 'new_message': return '💬';
    case 'payment': return '💰';
    default: return '🔔';
  }
}
