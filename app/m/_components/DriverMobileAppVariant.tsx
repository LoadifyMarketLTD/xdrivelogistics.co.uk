'use client';
/* eslint-disable @typescript-eslint/no-unused-vars */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import { ArrowLeft, Bell, Calendar, CheckCircle2, ChevronRight, FileText, HelpCircle, LogOut, MapPin, Menu, MessageSquare, Settings, Shield, Tag, Truck, User } from 'lucide-react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { isSupabaseConfigured, supabase } from '../../../lib/supabaseClient';
import { submitJobNote } from '../../../lib/jobNotesApi';
import { inspectJobEnvironmentalZones } from '../../../lib/environmentalZone';

type DriverTab = 'today' | 'queue' | 'comms' | 'docs' | 'me';
type MoreTab = 'profile' | 'vehicle' | 'documents' | 'messages' | 'security' | 'settings' | 'help' | 'privacy' | 'terms' | 'account' | 'support';

type Job = {
  id: string;
  company_id: string | null;
  status: string | null;
  current_status: string | null;
  pickup_location: string | null;
  pickup_postcode?: string | null;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  delivery_location: string | null;
  delivery_postcode?: string | null;
  delivery_lat?: number | null;
  delivery_lng?: number | null;
  pickup_datetime: string | null;
  delivery_datetime: string | null;
  client_name: string | null;
  vehicle_type?: string | null;
  load_details: string | null;
  budget_amount?: number | null;
  delivery_photos?: string[] | null;
  pod_photos?: string[] | null;
};

type DriverBid = {
  id: string;
  job_id: string;
  amount: number | null;
  bid_price_gbp: number | null;
  status: string | null;
  created_at: string | null;
  jobs?: Pick<Job, 'pickup_location' | 'delivery_location' | 'pickup_datetime' | 'vehicle_type' | 'client_name'> | null;
};

type Note = {
  id: string;
  job_id: string;
  note: string | null;
  visibility?: string | null;
  status?: string | null;
  created_at: string | null;
};

type Doc = {
  id: string;
  doc_type: string | null;
  status: string | null;
  expiry_date?: string | null;
  rejection_reason?: string | null;
  created_at: string | null;
  source?: 'driver' | 'vehicle';
};

type DriverProfile = {
  id: string;
  display_name: string | null;
  phone: string | null;
  email: string | null;
  status: string | null;
};

type Vehicle = {
  id: string;
  type: string | null;
  reg_plate: string | null;
  make: string | null;
  model: string | null;
};

// Notification rows are fetched from notification_events (the canonical outbox)
// and shaped into this display type so the rest of the component is unchanged.
type Notification = {
  id: string;
  title: string | null;
  body: string | null;
  type: string | null;
  read_at: string | null; // always null — notification_events has no user-read timestamp
  created_at: string | null;
};

type DriverMessage = {
  id: string;
  conversation_id: string | null;
  sender_user_id: string | null;
  recipient_user_id: string | null;
  body: string | null;
  created_at: string | null;
};

type Props = {
  initialTab?: DriverTab;
  initialMoreTab?: MoreTab;
  initialJobsTab?: 'assigned' | 'in_progress' | 'completed';
  initialQueueView?: 'list' | 'details' | 'progress';
  initialCommsView?: 'messages' | 'quotes';
};

const money = (amount: number | null | undefined) => {
  if (typeof amount !== 'number' || Number.isNaN(amount)) return 'Not set';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
};

const fmtDateTime = (value: string | null | undefined, fallback: string) => {
  if (!value) return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  const day = d.toLocaleDateString('en-GB', { weekday: 'short' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${day}, ${time}`;
};

const getJobStatus = (job: Pick<Job, 'current_status' | 'status'> | null | undefined) =>
  (job?.current_status || job?.status || '').toLowerCase();

const isAssignedLifecycleStatus = (status: string) => ['allocated', 'awarded'].includes(status);
const isInProgressLifecycleStatus = (status: string) => ['on_my_way', 'on_site_pickup', 'loaded', 'on_site_delivery', 'in_transit'].includes(status);
const isCompletedLifecycleStatus = (status: string) => ['delivered', 'completed'].includes(status);

const labelForStatus = (value: string | null | undefined) => {
  const v = (value ?? '').toLowerCase();
  if (v === 'posted' || v === 'open') return 'Open for quotes';
  if (v === 'awarded') return 'Awarded';
  if (v === 'allocated') return 'Allocated';
  if (v === 'on_my_way') return 'On route';
  if (v === 'on_site_pickup') return 'At pickup';
  if (v === 'loaded') return 'Loaded';
  if (v === 'on_site_delivery') return 'At delivery';
  if (v === 'cancelled') return 'Cancelled';
  if (v === 'delivered' || v === 'completed') return 'Delivered';
  return 'In transit';
};

const initials = (email: string | undefined) => {
  if (!email) return 'NA';
  const base = email.split('@')[0].replace(/[^a-zA-Z]/g, '');
  return (base.slice(0, 2) || 'NA').toUpperCase();
};

const hasPodEvidence = (job: Job | null) => Boolean(job && ((job.pod_photos?.length ?? 0) > 0 || (job.delivery_photos?.length ?? 0) > 0));

const isCompletedStatus = (status: string | null | undefined) => isCompletedLifecycleStatus((status || '').toLowerCase());

const queueTimeline = (job: Job | null | undefined) => {
  const current = getJobStatus(job) || 'allocated';
  const steps = [
    { id: 'allocated', label: 'Assigned', doneIf: ['awarded', 'allocated', 'on_my_way', 'on_site_pickup', 'loaded', 'on_site_delivery', 'delivered', 'completed'] },
    { id: 'on_my_way', label: 'On route', doneIf: ['on_my_way', 'on_site_pickup', 'loaded', 'on_site_delivery', 'delivered', 'completed'] },
    { id: 'loaded', label: 'Collected', doneIf: ['loaded', 'on_site_delivery', 'delivered', 'completed'] },
    { id: 'on_site_delivery', label: 'At delivery', doneIf: ['on_site_delivery', 'delivered', 'completed'] },
    { id: 'delivered', label: 'Delivered', doneIf: ['delivered', 'completed'] },
  ];

  return steps.map((step) => ({ ...step, done: step.doneIf.includes(current), current: step.id === current }));
};

const nextStatusFor = (status: string | null | undefined): string | null => {
  const current = (status || '').toLowerCase();
  if (!current || current === 'allocated' || current === 'awarded') return 'on_my_way';
  if (current === 'in_transit') return 'on_site_delivery';
  if (current === 'on_my_way') return 'on_site_pickup';
  if (current === 'on_site_pickup') return 'loaded';
  if (current === 'loaded') return 'on_site_delivery';
  if (current === 'on_site_delivery') return 'delivered';
  return null;
};

const isUuid = (value: string | null | undefined) =>
  Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));

const plural = (count: number, singular: string, pluralLabel = `${singular}s`) => `${count} ${count === 1 ? singular : pluralLabel}`;

const isImportant = (value: string | null | undefined) => {
  const normalized = (value || '').toLowerCase();
  return ['important', 'urgent', 'error', 'warning', 'pod_rejected', 'document_rejected', 'job_cancelled'].some((item) => normalized.includes(item));
};

const labelDocStatus = (status: string | null | undefined, expiryDate?: string | null) => {
  const normalized = (status || 'pending').toLowerCase();
  if (expiryDate) {
    const ms = new Date(expiryDate).getTime();
    if (!Number.isNaN(ms)) {
      const days = (ms - Date.now()) / (24 * 60 * 60 * 1000);
      if (days < 0) return 'Expired';
      if (days <= 30) return 'Expiring Soon';
    }
  }
  if (['verified', 'approved', 'active'].includes(normalized)) return 'Approved';
  if (normalized === 'rejected') return 'Rejected';
  return 'Pending';
};

const shouldRenderLegacyDocumentWallet = (value: string) => value === 'legacy_disabled';

export default function DriverMobileAppVariant({
  initialTab = 'today',
  initialMoreTab = 'profile',
  initialJobsTab = 'assigned',
  initialQueueView = 'list',
  initialCommsView = 'quotes',
}: Props) {
  const { user, logout, isLoading: authLoading } = useAuth();

  const [tab, setTab] = useState<DriverTab>(initialTab);
  const [moreTab, setMoreTab] = useState<MoreTab>(initialMoreTab);
  const [jobsTab, setJobsTab] = useState<'assigned' | 'in_progress' | 'completed'>(initialJobsTab);
  const [queueView, setQueueView] = useState<'list' | 'details' | 'progress'>(initialQueueView);
  const [quotesTab, setQuotesTab] = useState<'submitted' | 'unsuccessful'>('submitted');
  const [commsView, setCommsView] = useState<'messages' | 'quotes'>(initialCommsView);
  const [messagesFilter, setMessagesFilter] = useState<'all' | 'unread' | 'important'>('all');
  const [bookingsTab, setBookingsTab] = useState<'current' | 'past_7' | 'past_14'>('current');
  const [docsView, setDocsView] = useState<'wallet' | 'bookings' | 'jobs' | 'tracking' | 'pod' | 'pickup_done' | 'delivery_done' | 'legacy_disabled'>('wallet');
  const [notifyTracked, setNotifyTracked] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [selectedDocJobId, setSelectedDocJobId] = useState<string | null>(null);
  const [selectedQueueJobId, setSelectedQueueJobId] = useState<string | null>(null);
  const [selectedPodFile, setSelectedPodFile] = useState<File | null>(null);
  const [podRecipientName, setPodRecipientName] = useState('');
  const [podSignature, setPodSignature] = useState('');
  const [podNotes, setPodNotes] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [flashMessage, setFlashMessage] = useState('');
  const [quickNoteText, setQuickNoteText] = useState('');
  const [quickNoteImportant, setQuickNoteImportant] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [marketLoads, setMarketLoads] = useState<Job[]>([]);
  const [driverBids, setDriverBids] = useState<DriverBid[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [assignedVehicle, setAssignedVehicle] = useState<Vehicle | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [driverMessages, setDriverMessages] = useState<DriverMessage[]>([]);
  const [alertsFilter, setAlertsFilter] = useState<'all' | 'unread' | 'important'>('all');
  const [quoteStatusFilter, setQuoteStatusFilter] = useState<'open' | 'submitted' | 'accepted' | 'rejected' | 'withdrawn' | 'expired'>('submitted');
  const [quoteModalJob, setQuoteModalJob] = useState<Job | null>(null);
  const [quoteModalAmount, setQuoteModalAmount] = useState('');
  const [quoteModalMessage, setQuoteModalMessage] = useState('');
  const [quoteModalSubmitting, setQuoteModalSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const podInputRef = useRef<HTMLInputElement>(null);

  const driverId = user?.driverId ?? null;
  const companyId = user?.companyId ?? null;
  const hasDriverAccess = user?.role === 'driver' && Boolean(driverId);

  const currentJob = useMemo(() => {
    if (jobs.length === 0) return null;
    const live = jobs.find((j) => {
      const status = getJobStatus(j);
      return !isCompletedLifecycleStatus(status) && status !== 'cancelled';
    });
    return live || jobs[0];
  }, [jobs]);

  const assignedJobs = useMemo(
    () => jobs.filter((j) => isAssignedLifecycleStatus(getJobStatus(j))),
    [jobs]
  );
  const inProgressJobs = useMemo(
    () => jobs.filter((j) => isInProgressLifecycleStatus(getJobStatus(j))),
    [jobs]
  );
  const completedJobs = useMemo(
    () => jobs.filter((j) => isCompletedLifecycleStatus(getJobStatus(j))),
    [jobs]
  );

  const driverDisplayName = useMemo(() => {
    if (driverProfile?.display_name) return driverProfile.display_name;
    const email = user?.email ?? '';
    const local = email.split('@')[0] ?? '';
    const parts = local.split(/[._-]+/).filter(Boolean);
    if (parts.length === 0) return 'Driver';
    return parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  }, [driverProfile?.display_name, user?.email]);

  const driverFirstName = useMemo(() => driverDisplayName.split(/\s+/).filter(Boolean)[0] || 'Driver', [driverDisplayName]);

  const vehicleDisplay = useMemo(() => {
    if (!assignedVehicle) return 'No vehicle assigned';
    return [assignedVehicle.reg_plate, assignedVehicle.make, assignedVehicle.model, assignedVehicle.type].filter(Boolean).join(' • ') || 'No vehicle assigned';
  }, [assignedVehicle]);

  const earningsTotalAmount = useMemo(
    () => completedJobs.reduce((sum, job) => sum + (typeof job.budget_amount === 'number' ? job.budget_amount : 0), 0),
    [completedJobs]
  );

  const earningsAverage = useMemo(
    () => (completedJobs.length > 0 ? earningsTotalAmount / completedJobs.length : 0),
    [completedJobs.length, earningsTotalAmount]
  );

  const loadData = useCallback(async () => {
    if (!driverId || !isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const driverRes = await supabase
        .from('drivers')
        .select('id,display_name,phone,email,status')
        .eq('id', driverId)
        .maybeSingle();
      setDriverProfile((driverRes.data || null) as DriverProfile | null);

      const vehicleRes = await supabase
        .from('vehicles')
        .select('id,type,reg_plate,make,model')
        .eq('assigned_driver_id', driverId)
        .maybeSingle();
      const loadedVehicle = (vehicleRes.data || null) as Vehicle | null;
      setAssignedVehicle(loadedVehicle);

      const jobsRes = await supabase
        .from('jobs')
        .select('id,company_id,status,current_status,pickup_location,pickup_postcode,pickup_lat,pickup_lng,delivery_location,delivery_postcode,delivery_lat,delivery_lng,pickup_datetime,delivery_datetime,client_name,load_details,budget_amount,delivery_photos,pod_photos,assigned_driver_id')
        .eq('assigned_driver_id', driverId)
        .order('pickup_datetime', { ascending: true })
        .limit(30);

      const loadedJobs = (jobsRes.data || []) as Job[];
      setJobs(loadedJobs);

      if (loadedJobs.length > 0) {
        const ids = loadedJobs.map((j) => j.id);
        const notesRes = await supabase
          .from('job_notes')
          .select('id,job_id,note,visibility,status,created_at')
          .in('job_id', ids)
          .order('created_at', { ascending: false })
          .limit(40);
        setNotes((notesRes.data || []) as Note[]);
      } else {
        setNotes([]);
      }

      const marketRes = await supabase
        .from('jobs')
        .select('id,company_id,status,current_status,pickup_location,pickup_postcode,pickup_lat,pickup_lng,delivery_location,delivery_postcode,delivery_lat,delivery_lng,pickup_datetime,delivery_datetime,client_name,load_details,budget_amount,awarded_carrier_company_id')
        .in('status', ['posted', 'open'])
        .is('awarded_carrier_company_id', null)
        .order('pickup_datetime', { ascending: true })
        .limit(25);

      setMarketLoads((marketRes.data || []) as Job[]);

      if (user?.id) {
        const bidsRes = await supabase
          .from('job_bids')
          .select('id,job_id,amount,bid_price_gbp,status,created_at,bidder_user_id,jobs(pickup_location,delivery_location,pickup_datetime,vehicle_type,client_name)')
          .eq('bidder_user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(60);

        const normalizedBids = ((bidsRes.data || []) as Array<Omit<DriverBid, 'jobs'> & { jobs?: DriverBid['jobs'] | DriverBid['jobs'][] }>).map((bid) => ({
          ...bid,
          jobs: Array.isArray(bid.jobs) ? bid.jobs[0] ?? null : bid.jobs ?? null,
        }));
        setDriverBids(normalizedBids);
      } else {
        setDriverBids([]);
      }

      const docsRes = await supabase
        .from('driver_documents')
        .select('id,doc_type,status,expiry_date,rejection_reason,created_at')
        .eq('driver_id', driverId)
        .order('created_at', { ascending: false })
        .limit(20);
      const driverDocs = ((docsRes.data || []) as Doc[]).map((doc) => ({ ...doc, source: 'driver' as const }));

      let vehicleDocs: Doc[] = [];
      if (loadedVehicle?.id) {
        const vehicleDocsRes = await supabase
          .from('vehicle_documents')
          .select('id,doc_type,status,expiry_date,rejection_reason,created_at')
          .eq('vehicle_id', loadedVehicle.id)
          .order('created_at', { ascending: false })
          .limit(20);
        vehicleDocs = ((vehicleDocsRes.data || []) as Doc[]).map((doc) => ({ ...doc, source: 'vehicle' as const }));
      }
      setDocs([...driverDocs, ...vehicleDocs]);

      if (user?.id) {
        // Read from the canonical notification_events outbox (same source as web
        // NotificationBell, Expo mobile, and admin ops-centre). Map to the
        // Notification display type so the rest of this component is unchanged.
        const notificationsRes = await supabase
          .from('notification_events')
          .select('id,event_type,entity_type,payload,status,processed_at,created_at')
          .eq('recipient_user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);
        const eventTitleMap: Record<string, string> = {
          job_assigned: 'Job assigned to you',
          bid_accepted: 'Your bid was accepted',
          pod_uploaded: 'POD uploaded — job delivered',
          bid_rejected: 'Bid rejected',
          invoice_dispute: 'Invoice dispute raised',
          carrier_invited: 'Carrier network invitation',
          carrier_accepted: 'Carrier accepted your invitation',
          carrier_rejected: 'Carrier declined your invitation',
          onboarding_submitted: 'Onboarding application submitted',
          onboarding_approved: 'Your application has been approved',
          onboarding_rejected: 'Application requires attention',
        };
        const deriveBody = (eventType: string, payload: Record<string, unknown> | null): string => {
          const p = payload ?? {};
          const pickup = typeof p.pickup_location === 'string' ? p.pickup_location : null;
          const delivery = typeof p.delivery_location === 'string' ? p.delivery_location : null;
          if (eventType === 'job_assigned' && pickup && delivery) return `${pickup} → ${delivery}`;
          if (eventType === 'bid_accepted') {
            const amount = p.bid_price_gbp ?? p.amount;
            if (typeof amount === 'number') return `Accepted amount: £${amount.toFixed(2)}`;
          }
          if (eventType === 'pod_uploaded' && pickup && delivery) return `${pickup} → ${delivery}`;
          if (typeof p.message === 'string') return p.message;
          return 'Open the platform for details.';
        };
        const mapped: Notification[] = ((notificationsRes.data ?? []) as Array<{
          id: string;
          event_type: string;
          entity_type: string;
          payload: Record<string, unknown> | null;
          status: string;
          processed_at: string | null;
          created_at: string;
        }>).map((row) => ({
          id: row.id,
          title: eventTitleMap[row.event_type] ?? row.event_type.replace(/_/g, ' '),
          body: deriveBody(row.event_type, row.payload),
          type: row.event_type,
          // processed_at reflects edge-function delivery, not user read state.
          // notification_events has no user-read timestamp; treat all as unread.
          read_at: null,
          created_at: row.created_at,
        }));
        setNotifications(mapped);

        const messagesRes = await supabase
          .from('messages')
          .select('id,conversation_id,sender_user_id,recipient_user_id,body,created_at')
          .or(`sender_user_id.eq.${user.id},recipient_user_id.eq.${user.id}`)
          .order('created_at', { ascending: false })
          .limit(50);
        setDriverMessages((messagesRes.data || []) as DriverMessage[]);
      } else {
        setNotifications([]);
        setDriverMessages([]);
      }
    } finally {
      setLoading(false);
    }
  }, [driverId, user?.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!flashMessage) return;
    const timeout = setTimeout(() => setFlashMessage(''), 3200);
    return () => clearTimeout(timeout);
  }, [flashMessage]);

  useEffect(() => {
    const loadDriverPrefs = async () => {
      if (!isSupabaseConfigured || !user?.id) return;
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) return;
      const meta = data.user.user_metadata ?? {};
      if (typeof meta.driver_notify_tracked === 'boolean') setNotifyTracked(meta.driver_notify_tracked);
      if (typeof meta.driver_email_notifications === 'boolean') setEmailNotifications(meta.driver_email_notifications);
    };

    void loadDriverPrefs();
  }, [user?.id]);

  useEffect(() => {
    if (tab !== 'queue') setQueueView('list');
  }, [tab]);

  const saveDriverPreferences = useCallback(async () => {
    if (!isSupabaseConfigured || !user?.id) {
      setFlashMessage('Settings save unavailable for this account.');
      return;
    }

    setPrefsSaving(true);
    const { error } = await supabase.auth.updateUser({
      data: {
        driver_notify_tracked: notifyTracked,
        driver_email_notifications: emailNotifications,
      },
    });
    setPrefsSaving(false);

    if (error) {
      setFlashMessage(`Settings save failed: ${error.message}`);
      return;
    }

    setFlashMessage('Settings saved.');
  }, [emailNotifications, notifyTracked, user?.id]);

  const openQuoteModal = useCallback((load: Job) => {
    const existing = driverBids.find((bid) => bid.job_id === load.id && bid.status === 'submitted');
    if (existing) {
      setFlashMessage('You already have an active quote for this job.');
      return;
    }
    setQuoteModalJob(load);
    setQuoteModalAmount(typeof load.budget_amount === 'number' && load.budget_amount > 0 ? String(load.budget_amount) : '');
    setQuoteModalMessage('');
  }, [driverBids]);

  const submitQuoteModal = useCallback(async () => {
    if (!quoteModalJob || !isSupabaseConfigured || !user?.id || !driverId || !companyId) return;
    const parsed = parseFloat(quoteModalAmount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setFlashMessage('Enter a valid quote amount.');
      return;
    }
    setQuoteModalSubmitting(true);
    const { error } = await supabase.from('job_bids').insert({
      job_id: quoteModalJob.id,
      company_id: companyId,
      bidder_user_id: user.id,
      bidder_driver_id: driverId,
      amount: parsed,
      bid_price_gbp: parsed,
      currency: 'GBP',
      status: 'submitted',
      message: quoteModalMessage.trim() || null,
    });
    setQuoteModalSubmitting(false);
    if (error) {
      setFlashMessage(`Quote failed: ${error.message}`);
      return;
    }
    setQuoteModalJob(null);
    setFlashMessage('Quote submitted successfully.');
    await loadData();
  }, [companyId, driverId, loadData, quoteModalAmount, quoteModalJob, quoteModalMessage, user?.id]);

  const uploadPodForJob = useCallback(async (job: Job) => {
    if (!selectedPodFile || !driverId || !isSupabaseConfigured) {
      setFlashMessage('Select a POD file first.');
      return false;
    }

    if (!isUuid(job.id)) {
      setFlashMessage('POD can only be uploaded for real jobs.');
      return false;
    }

    setBusyAction('pod-upload');
    const safeName = selectedPodFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${job.id}/${Date.now()}-${safeName}`;
    const upload = await supabase.storage.from('pod-photos').upload(storagePath, selectedPodFile, { cacheControl: '3600', upsert: false });

    if (upload.error) {
      setBusyAction(null);
      setFlashMessage(`POD upload failed: ${upload.error.message}`);
      return false;
    }

    const nextDeliveryPhotos = [...(job.delivery_photos ?? []), storagePath];
    const nextPodPhotos = [...(job.pod_photos ?? []), storagePath];
    const now = new Date().toISOString();

    let updateQuery = supabase
      .from('jobs')
      .update({
        delivery_photos: nextDeliveryPhotos,
        pod_photos: nextPodPhotos,
        pod_generated: true,
        pod_generated_at: now,
        client_signature_name: podRecipientName.trim() || null,
        delivery_signature_data: podSignature.trim()
          ? { type: 'typed_signature', value: podSignature.trim(), captured_at: now, captured_by: user?.id ?? null }
          : null,
        delivery_notes: podNotes.trim() || null,
        current_status: 'delivered',
        status: 'delivered',
        updated_at: now,
      })
      .eq('id', job.id);

    if (driverId) {
      updateQuery = updateQuery.eq('assigned_driver_id', driverId);
    }

    const { error } = await updateQuery;
    setBusyAction(null);

    if (error) {
      setFlashMessage(`POD save failed: ${error.message}`);
      return false;
    }

    setFlashMessage('POD saved and delivery completed.');
    setSelectedPodFile(null);
    await loadData();
    return true;
  }, [driverId, loadData, podNotes, podRecipientName, podSignature, selectedPodFile, user?.id]);

  const updateJobStatus = useCallback(async (job: Job, nextStatus: string) => {
    if (!driverId || !isSupabaseConfigured) {
      setFlashMessage('Status update unavailable for this account.');
      return;
    }

    if (nextStatus === 'delivered' && !hasPodEvidence(job)) {
      setFlashMessage('Upload POD before marking delivery complete.');
      return;
    }

    setBusyAction(`status:${job.id}`);
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('jobs')
      .update({
        status: nextStatus,
        current_status: nextStatus,
        updated_at: now,
      })
      .select('id')
      .eq('id', job.id)
      .eq('assigned_driver_id', driverId);

    setBusyAction(null);
    if (error) {
      setFlashMessage(`Status update failed: ${error.message}`);
      return;
    }

    if (!data || data.length === 0) {
      setFlashMessage('Status update could not be applied for this assignment. Please refresh and try again.');
      return;
    }

    setFlashMessage(`Status moved to ${labelForStatus(nextStatus)}.`);
    await loadData();
  }, [driverId, loadData]);

  const sendQuickNote = useCallback(async (job: Job) => {
    if (!isSupabaseConfigured || !user?.id) {
      setFlashMessage('Quick note unavailable for this account.');
      return;
    }

    const note = quickNoteText.trim();
    if (!note) {
      setFlashMessage('Write a short note first.');
      return;
    }

    setBusyAction(`note:${job.id}`);
    const result = await submitJobNote({
      jobId: job.id,
      note,
      important: quickNoteImportant,
    });
    setBusyAction(null);

    if (!result.ok) {
      setFlashMessage(`Quick note failed: ${result.error}`);
      return;
    }

    setQuickNoteText('');
    setQuickNoteImportant(false);
    setFlashMessage('Dispatch note sent.');
    await loadData();
  }, [loadData, quickNoteImportant, quickNoteText, user?.id]);

  const renderReferenceLikeScreen = () => {
    const actionJob = currentJob;
    const pickup = actionJob?.pickup_location || 'Pickup not available';
    const drop = actionJob?.delivery_location || 'Delivery not available';
    const pickupTime = fmtDateTime(actionJob?.pickup_datetime, 'Schedule pending');
    const nextJobRef = actionJob?.id?.slice(0, 11).toUpperCase() || 'N/A';
    const nextStatus = nextStatusFor(actionJob?.current_status || actionJob?.status);
    const recentNotes = actionJob ? notes.filter((note) => note.job_id === actionJob.id).slice(0, 2) : [];
    const openJobs = assignedJobs.length + inProgressJobs.length;
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

    return (
      <div style={screenWrap}>
        <div style={topBar}>
          <img src="/xdrive-logo-horizontal.png" alt="XDrive Logistics" style={logo} />
          <button style={menuBtn} aria-label="Notifications" onClick={() => setFlashMessage('Notifications opened.') }>
            <Bell size={22} color="#FFFFFF" />
          </button>
        </div>

        <div style={contentArea}>
          {renderFlash()}
          <div style={welcomeCard}>
            <div style={welcomeTitle}>{greeting}, {driverFirstName}</div>
            <div style={welcomeSub}>Driver workspace</div>
            <div style={welcomeChip}>Vehicle: {vehicleDisplay}</div>
          </div>

          <div style={overviewGrid}>
            <div style={overviewCard}><strong>{assignedJobs.length}</strong><span>Assigned</span></div>
            <div style={overviewCard}><strong>{inProgressJobs.length}</strong><span>In Progress</span></div>
            <div style={overviewCard}><strong>{completedJobs.length}</strong><span>Completed</span></div>
            <div style={overviewCard}><strong>{openJobs}</strong><span>Open</span></div>
          </div>

          {actionJob ? (
            <div style={routeCard}>
              <div style={subHeaderRow}>
                <div style={subHeaderTitle}>Next Job</div>
                <span style={statusCapsule}>{labelForStatus(actionJob.current_status || actionJob.status).toUpperCase()}</span>
              </div>
              <div style={routeTime}>{pickupTime}</div>
              <div style={routeAddress}>{pickup.split(',')[0]} {' -> '} {drop.split(',')[0]}</div>
              <div style={jobMetaRowLine}><span style={trackingLabel}>Ref</span><strong style={trackingValue}>{nextJobRef}</strong></div>
              <button style={quoteButton} onClick={() => setTab('docs')}>View Job Details</button>
            </div>
          ) : (
            <div style={emptyPanel}>
              <Truck size={54} color="#B6BCC8" />
              <div style={emptyTitle}>No active job</div>
              <div style={emptyBody}>New assigned work will appear here when available.</div>
            </div>
          )}

          {actionJob ? (
            <div style={routeCard}>
              <div style={trackingTitle}>Live actions</div>
              <div style={jobMetaRowLine}><span style={trackingLabel}>Current</span><span style={statusCapsule}>{(actionJob.current_status || actionJob.status || 'allocated').toUpperCase()}</span></div>
              <button
                style={quoteButton}
                disabled={!nextStatus || busyAction === `status:${actionJob.id}`}
                onClick={() => nextStatus && void updateJobStatus(actionJob, nextStatus)}
              >
                {busyAction === `status:${actionJob.id}` ? 'Updating...' : nextStatus ? `Set ${labelForStatus(nextStatus)}` : 'No next status'}
              </button>
              <div style={podFormRow}>
                <span style={trackingLabel}>Quick dispatch note</span>
                <textarea style={podTextArea} value={quickNoteText} onChange={(e) => setQuickNoteText(e.target.value)} placeholder="Add dispatch note" />
                <label style={miniCheck}><input type="checkbox" checked={quickNoteImportant} onChange={(e) => setQuickNoteImportant(e.target.checked)} /> Mark as important</label>
                <button
                  style={smallActionBtn}
                  disabled={busyAction === `note:${actionJob.id}`}
                  onClick={() => void sendQuickNote(actionJob)}
                >
                  {busyAction === `note:${actionJob.id}` ? 'Sending...' : 'Send Quick Note'}
                </button>
              </div>
              {recentNotes.length > 0 ? (
                <div style={listStackCompact}>
                  {recentNotes.map((entry) => (
                    <div key={entry.id} style={noteRow}>{entry.note || 'No content'}</div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          <button style={ghostAction} onClick={() => setTab('queue')}>Notification shortcut</button>
        </div>
        <BottomNav tab={tab} onTabChange={setTab} />
      </div>
    );
  };

  const renderSimpleList = (title: string, items: string[]) => (
    <div style={screenWrap}>
      <div style={topBar}>
        <img src="/xdrive-logo-horizontal.png" alt="XDrive Logistics" style={logo} />
      </div>
      <div style={contentArea}>
        <div style={titleRow}>
          <div style={jobTitle}>{title}</div>
        </div>
        <div style={routeCard}>
          {items.length === 0 ? (
            <div style={metaLine}>No data available.</div>
          ) : (
            items.map((item) => (
              <div key={item} style={{ ...metaLine, marginBottom: 10 }}>{item}</div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  const renderFlash = () => (flashMessage ? <div style={flashBanner}>{flashMessage}</div> : null);

  const renderTab = () => {
    if (authLoading || loading) {
      return renderSimpleList('JOB', ['Loading mobile workspace...']);
    }

    if (!hasDriverAccess) {
      return renderSimpleList('ACCESS', ['Driver access is required.']);
    }

    if (tab === 'today') return renderReferenceLikeScreen();

    if (tab === 'queue') {
      const filteredAlerts = notifications.filter((entry) => {
        if (alertsFilter === 'unread') return !entry.read_at;
        if (alertsFilter === 'important') return isImportant(entry.type) || isImportant(entry.title);
        return true;
      });

      return (
        <div style={screenWrap}>
          <div style={topBar}>
            <img src="/xdrive-logo-horizontal.png" alt="XDrive Logistics" style={logo} />
            <button style={menuBtn} aria-label="Refresh alerts" onClick={() => void loadData()}><Bell size={24} color="#FFFFFF" /></button>
          </div>
          <div style={contentArea}>
            {renderFlash()}
            <div style={segmentedTabs}>
              <button style={alertsFilter === 'all' ? segmentActive : segmentIdle} onClick={() => setAlertsFilter('all')}>All</button>
              <button style={alertsFilter === 'unread' ? segmentActive : segmentIdle} onClick={() => setAlertsFilter('unread')}>Unread</button>
              <button style={alertsFilter === 'important' ? segmentActive : segmentIdle} onClick={() => setAlertsFilter('important')}>Important</button>
            </div>
            {filteredAlerts.length === 0 ? (
              <div style={emptyPanel}>
                <Bell size={54} color="#B6BCC8" />
                <div style={emptyTitle}>No notifications</div>
                <div style={emptyBody}>New job, quote, POD, document, dispatcher and payment notifications will appear here when the backend creates them.</div>
              </div>
            ) : (
              filteredAlerts.map((entry) => (
                <button
                  key={entry.id}
                  style={routeCard}
                  onClick={() => {
                    const type = (entry.type || '').toLowerCase();
                    if (type.includes('quote')) setTab('comms');
                    else if (type.includes('document')) {
                      setTab('me');
                      setMoreTab('documents');
                    } else if (type.includes('message')) {
                      setTab('me');
                      setMoreTab('messages');
                    } else if (type.includes('job') || type.includes('pod')) setTab('docs');
                  }}
                >
                  <div style={jobMetaRowLine}>
                    <span style={entry.read_at ? statusCapsule : tagMint}>{entry.read_at ? 'READ' : 'UNREAD'}</span>
                    <span style={trackingLabel}>{fmtDateTime(entry.created_at, 'Recently')}</span>
                  </div>
                  <div style={routeAddress}>{entry.title || 'Notification'}</div>
                  <div style={routeTime}>{entry.body || 'Open the related record for details.'}</div>
                </button>
              ))
            )}
          </div>
          <BottomNav tab={tab} onTabChange={setTab} />
        </div>
      );
    }

    if (tab === 'docs') {
      const sourceJobs = jobs;
      const assigned = sourceJobs.filter((j) => isAssignedLifecycleStatus(getJobStatus(j)));
      const progress = sourceJobs.filter((j) => isInProgressLifecycleStatus(getJobStatus(j)));
      const completed = sourceJobs.filter((j) => isCompletedLifecycleStatus(getJobStatus(j)));
      const visible = jobsTab === 'assigned' ? assigned : jobsTab === 'in_progress' ? progress : completed;
      const queueSelectionSource = sourceJobs.length > 0 ? sourceJobs : visible;
      const selectedQueueJob = queueSelectionSource.find((entry) => entry.id === selectedQueueJobId) || visible[0] || sourceJobs[0] || null;
      const queueStatus = getJobStatus(selectedQueueJob) || 'allocated';
      const queueNextStatus = nextStatusFor(queueStatus);
      const timeline = queueTimeline(selectedQueueJob);

      const openQueueDetails = (jobId: string) => {
        setSelectedQueueJobId(jobId);
        setQueueView('details');
      };

      const openQueueProgress = (jobId: string) => {
        setSelectedQueueJobId(jobId);
        setQueueView('progress');
      };

      return (
        <div style={screenWrap}>
          <div style={topBar}>
            <img src="/xdrive-logo-horizontal.png" alt="XDrive Logistics" style={logo} />
            <button style={menuBtn} aria-label="My Jobs" onClick={() => setFlashMessage('My jobs opened.')}><Bell size={24} color="#FFFFFF" /></button>
          </div>
          <div style={contentArea}>
            {renderFlash()}
            {queueView !== 'list' ? (
              <div style={subHeaderRow}>
                <button style={backBtn} onClick={() => setQueueView('list')}><ArrowLeft size={16} /> Back</button>
                <div style={subHeaderTitle}>{queueView === 'details' ? 'Job Details' : 'Job Progress'}</div>
                <span style={activeBadge}>#{selectedQueueJob?.id.slice(0, 8).toUpperCase() || 'N/A'}</span>
              </div>
            ) : null}
            <div style={segmentedTabs}>
              <button style={jobsTab === 'assigned' ? segmentActive : segmentIdle} onClick={() => setJobsTab('assigned')}>Assigned</button>
              <button style={jobsTab === 'in_progress' ? segmentActive : segmentIdle} onClick={() => setJobsTab('in_progress')}>In Progress</button>
              <button style={jobsTab === 'completed' ? segmentActive : segmentIdle} onClick={() => setJobsTab('completed')}>Completed</button>
            </div>
            {queueView === 'list' ? (
              <>
                <div style={routeCard}>
                  <div style={routeAddress}>Today • {visible.length} jobs</div>
                  <div style={routeTime}>Track, update and complete your assigned work.</div>
                </div>
                {visible.slice(0, 10).map((entry) => {
                  const item = `${entry.pickup_location || 'Pickup'} -> ${entry.delivery_location || 'Delivery'}`;
                  const status = getJobStatus(entry);
                  const nextStatus = nextStatusFor(status);
                  const showPod = hasPodEvidence(entry);
                  return (
                    <div key={entry.id} style={routeCard}>
                      <div style={jobMetaRowLine}><span style={statusCapsule}>{jobsTab === 'assigned' ? 'ASSIGNED' : jobsTab === 'in_progress' ? 'IN PROGRESS' : 'COMPLETED'}</span><span style={trackingLabel}>{fmtDateTime(entry.pickup_datetime, '10:30')}</span></div>
                      <div style={routeAddress}>{item}</div>
                      <div style={jobMetaRowLine}><span style={trackingLabel}>Ref: {entry.id.slice(0, 11).toUpperCase()}</span><strong style={trackingValue}>{money(entry.budget_amount)}</strong></div>
                      <div style={dualBtnRow}>
                        <button style={smallActionBtn} onClick={() => openQueueDetails(entry.id)}>View Details</button>
                        <button style={smallActionBtn} onClick={() => openQueueProgress(entry.id)}>{isCompletedLifecycleStatus(status) ? 'View Timeline' : 'Open Progress'}</button>
                      </div>
                      {status === 'on_site_delivery' ? (
                        <button style={quoteButton} onClick={() => { setSelectedDocJobId(entry.id); setQueueView('progress'); }}>Upload POD</button>
                      ) : nextStatus && !isCompletedLifecycleStatus(status) ? (
                        <button style={quoteButton} onClick={() => void updateJobStatus(entry, nextStatus)}>
                          {status === 'allocated' || status === 'awarded' ? 'Start / Set On Route' : `Mark ${labelForStatus(nextStatus)}`}
                        </button>
                      ) : showPod ? (
                        <button style={quoteButton} onClick={() => openQueueProgress(entry.id)}>View POD</button>
                      ) : null}
                    </div>
                  );
                })}
                {visible.length === 0 ? <div style={routeCard}><div style={routeTime}>No jobs in this bucket right now.</div></div> : null}
              </>
            ) : null}

            {queueView === 'details' && selectedQueueJob ? (
              <div style={routeCard}>
                <div style={jobMetaRowLine}>
                  <span style={statusCapsule}>{labelForStatus(queueStatus).toUpperCase()}</span>
                  <span style={trackingLabel}>{fmtDateTime(selectedQueueJob.pickup_datetime, 'Schedule pending')}</span>
                </div>
                <div style={routeAddress}>{selectedQueueJob.pickup_location || 'Pickup location pending'}</div>
                <div style={routeTime}>Pickup</div>
                <div style={divider} />
                <div style={routeAddress}>{selectedQueueJob.delivery_location || 'Delivery location pending'}</div>
                <div style={routeTime}>Drop-off</div>
                <div style={divider} />
                <div style={trackingGrid}>
                  <div>
                    <div style={trackingLabel}>Reference</div>
                    <div style={trackingValue}>{selectedQueueJob.id.slice(0, 11).toUpperCase()}</div>
                  </div>
                  <div>
                    <div style={trackingLabel}>Agreed rate</div>
                    <div style={trackingValue}>{money(selectedQueueJob.budget_amount)}</div>
                  </div>
                </div>
                <div style={podFormRow}>
                  <div style={trackingLabel}>Load details</div>
                  <div style={noteRow}>{selectedQueueJob.load_details || 'Not provided'}</div>
                </div>
                <button style={quoteButton} onClick={() => setQueueView('progress')}>Open Job Progress</button>
              </div>
            ) : null}

            {queueView === 'progress' && selectedQueueJob ? (
              <div style={routeCard}>
                <div style={trackingTitle}>Progress Timeline</div>
                <div style={timelineWrap}>
                  {timeline.map((step) => (
                    <div key={step.id} style={timelineRow}>
                      <div style={step.done ? timelineDotDone : step.current ? timelineDotCurrent : timelineDotIdle} />
                      <div style={timelineTextWrap}>
                        <div style={timelineLabel}>{step.label}</div>
                        <div style={timelineMeta}>{step.done ? 'Completed' : step.current ? 'Current step' : 'Pending'}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={jobMetaRowLine}>
                  <span style={trackingLabel}>Current status</span>
                  <span style={statusCapsule}>{labelForStatus(queueStatus).toUpperCase()}</span>
                </div>
                <button
                  style={quoteButton}
                  disabled={!queueNextStatus || busyAction === `status:${selectedQueueJob.id}`}
                  onClick={() => queueNextStatus && void updateJobStatus(selectedQueueJob, queueNextStatus)}
                >
                  {busyAction === `status:${selectedQueueJob.id}`
                    ? 'Updating status...'
                    : queueNextStatus
                      ? `Move to ${labelForStatus(queueNextStatus)}`
                      : 'No further status'}
                </button>
                <div style={dualBtnRow}>
                  <button
                    style={smallActionBtn}
                    onClick={() => {
                      setSelectedDocJobId(selectedQueueJob.id);
                      setQueueView('progress');
                    }}
                  >
                    Open POD
                  </button>
                  <button style={smallActionBtn} onClick={() => setQueueView('details')}>Back to Details</button>
                </div>
                {isCompletedStatus(queueStatus) ? <div style={flashBanner}>This job is complete and ready for POD archive.</div> : null}
              </div>
            ) : null}
          </div>
          <BottomNav tab={tab} onTabChange={setTab} />
        </div>
      );
    }

    if (tab === 'comms') {
      const openQuoteJobs = marketLoads.filter((job) => !driverBids.some((bid) => bid.job_id === job.id));
      const visibleBids = driverBids.filter((bid) => (bid.status || 'submitted').toLowerCase() === quoteStatusFilter);
      const quoteCount = quoteStatusFilter === 'open' ? openQuoteJobs.length : visibleBids.length;

      return (
        <div style={screenWrap}>
          <div style={topBar}>
            <img src="/xdrive-logo-horizontal.png" alt="XDrive Logistics" style={logo} />
          </div>
          <div style={contentArea}>
            {renderFlash()}
            <div style={routeCard}>
              <div style={jobMetaRowLine}><strong style={trackingValue}>Quotes</strong><span style={trackingLabel}>{plural(quoteCount, 'record')}</span></div>
              <div style={trackingGrid}>
                <div><div style={trackingLabel}>Open</div><div style={trackingValue}>{openQuoteJobs.length}</div></div>
                <div><div style={trackingLabel}>Submitted</div><div style={trackingValue}>{driverBids.filter((bid) => (bid.status || '').toLowerCase() === 'submitted').length}</div></div>
              </div>
            </div>
            <div style={segmentedTabs}>
              {(['open', 'submitted', 'accepted', 'rejected', 'withdrawn', 'expired'] as const).map((status) => (
                <button key={status} style={quoteStatusFilter === status ? segmentActive : segmentIdle} onClick={() => setQuoteStatusFilter(status)}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
            {quoteStatusFilter === 'open' ? (
              openQuoteJobs.length === 0 ? (
                <div style={emptyPanel}><Tag size={54} color="#B6BCC8" /><div style={emptyTitle}>No open quotes</div><div style={emptyBody}>Marketplace loads available to your authenticated role will appear here.</div></div>
              ) : openQuoteJobs.slice(0, 10).map((job) => (
                <div key={job.id} style={routeCard}>
                  <div style={jobMetaRowLine}><span style={trackingLabel}>Ref #{job.id.slice(0, 8).toUpperCase()}</span><span style={statusCapsule}>OPEN</span></div>
                  <div style={routeAddress}>{job.pickup_location || 'Pickup pending'} {' -> '} {job.delivery_location || 'Delivery pending'}</div>
                  <div style={routeTime}>{fmtDateTime(job.pickup_datetime, 'Schedule pending')} · {job.vehicle_type || 'Vehicle type pending'}</div>
                  <div style={jobMetaRowLine}>
                    <span style={trackingLabel}>{job.client_name || 'Company withheld'}</span>
                    {typeof job.budget_amount === 'number' && job.budget_amount > 0
                      ? <strong style={{ ...trackingValue, color: '#15803d' }}>Proposed: {money(job.budget_amount)}</strong>
                      : <strong style={trackingValue}>Open to quotes</strong>}
                  </div>
                  <button style={quoteButton} onClick={() => openQuoteModal(job)}>Submit Quote</button>
                </div>
              ))
            ) : visibleBids.length === 0 ? (
              <div style={emptyPanel}><Tag size={54} color="#B6BCC8" /><div style={emptyTitle}>No {quoteStatusFilter} quotes</div><div style={emptyBody}>Only real quote records from your account are shown.</div></div>
            ) : visibleBids.slice(0, 10).map((bid) => (
              <div key={bid.id} style={routeCard}>
                <div style={jobMetaRowLine}><span style={trackingLabel}>Ref #{bid.job_id.slice(0, 8).toUpperCase()}</span><span style={statusCapsule}>{(bid.status || 'submitted').toUpperCase()}</span></div>
                <div style={routeAddress}>{bid.jobs?.pickup_location || 'Pickup pending'} {' -> '} {bid.jobs?.delivery_location || 'Delivery pending'}</div>
                <div style={routeTime}>{fmtDateTime(bid.jobs?.pickup_datetime, 'Schedule pending')} ? {bid.jobs?.vehicle_type || 'Vehicle type pending'}</div>
                <div style={jobMetaRowLine}><span style={trackingLabel}>{bid.jobs?.client_name || 'Company withheld'}</span><strong style={trackingValue}>{money(Number(bid.bid_price_gbp ?? bid.amount ?? 0))}</strong></div>
                <button style={smallActionBtn} onClick={() => setFlashMessage('Quote details route is not available yet.')}>View Details</button>
              </div>
            ))}
          </div>
          <BottomNav tab={tab} onTabChange={setTab} />
        </div>
      );
    }

    const legacyDocsView = docsView as string;
    if (shouldRenderLegacyDocumentWallet(legacyDocsView)) {
      const nowMs = Date.now();
      const days14Ms = 14 * 24 * 60 * 60 * 1000;
      const days7Ms = 7 * 24 * 60 * 60 * 1000;
      const docWallet = docs.length > 0
        ? docs
        : [];
      const verifiedDocs = docWallet.filter((entry) => ['verified', 'approved', 'active'].includes((entry.status || '').toLowerCase()));
      const pendingDocs = docWallet.filter((entry) => !['verified', 'approved', 'active'].includes((entry.status || '').toLowerCase()));
      const liveBookingItems = jobs.filter((entry) => {
        const dateMs = entry.pickup_datetime ? new Date(entry.pickup_datetime).getTime() : Number.NaN;
        if (Number.isNaN(dateMs)) return bookingsTab === 'current';
        const age = nowMs - dateMs;
        if (bookingsTab === 'current') return !['delivered', 'completed', 'cancelled'].includes((entry.current_status || entry.status || '').toLowerCase());
        if (bookingsTab === 'past_7') return age >= 0 && age <= days7Ms;
        return age >= 0 && age <= days14Ms;
      });

      const bookingItems = liveBookingItems.slice(0, 8) as Job[];
      const selectedDocJob = bookingItems.find((entry) => entry.id === selectedDocJobId) || bookingItems[0] || null;

      const renderDocsSubView = () => {
        if (docsView === 'wallet') {
          return (
            <>
              <div style={routeCard}>
                <div style={subHeaderRow}>
                  <div style={subHeaderTitle}>Document Wallet</div>
                  <span style={activeBadge}>{verifiedDocs.length} verified</span>
                </div>
                <div style={trackingGrid}>
                  <div>
                    <div style={trackingLabel}>Verified</div>
                    <div style={trackingValue}>{verifiedDocs.length}</div>
                  </div>
                  <div>
                    <div style={trackingLabel}>Pending</div>
                    <div style={trackingValue}>{pendingDocs.length}</div>
                  </div>
                </div>
                <div style={divider} />
                <div style={listStackCompact}>
                  {docWallet.slice(0, 6).map((entry) => (
                    <div
                      key={entry.id}
                      style={jobMiniCard}
                      onClick={() => setFlashMessage(`${entry.doc_type || 'Document'} opened.`)}
                    >
                      <div>
                        <div style={jobMiniRoute}>{entry.doc_type || 'Document'}</div>
                        <div style={routeTime}>Uploaded {fmtDateTime(entry.created_at, 'Recently')}</div>
                      </div>
                      <span style={['verified', 'approved', 'active'].includes((entry.status || '').toLowerCase()) ? tagMint : tagBlue}>
                        {(entry.status || 'pending').toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
                <div style={dualBtnRow}>
                  <button style={smallActionBtn} onClick={() => podInputRef.current?.click()}>Upload New Doc</button>
                  <button style={smallActionBtn} onClick={() => setDocsView('bookings')}>Open Bookings</button>
                </div>
                <input
                  ref={podInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setSelectedPodFile(file);
                    if (file) setFlashMessage(`Ready to upload: ${file.name}`);
                  }}
                />
              </div>
            </>
          );
        }

        if (docsView === 'tracking') {
          const trackingName = user?.email ?? 'Unassigned';
          const trackingRef = selectedDocJob ? `#${selectedDocJob.id.slice(0, 8).toUpperCase()}` : 'N/A';
          const trackingStatus = selectedDocJob ? labelForStatus(selectedDocJob.current_status || selectedDocJob.status).toUpperCase() : 'N/A';
          return (
            <div style={routeCard}>
              <div style={subHeaderRow}>
                <button style={backBtn} onClick={() => setDocsView('wallet')}><ArrowLeft size={16} /> Back</button>
                <div style={subHeaderTitle}>Live Tracking</div>
              </div>
              <div style={mapLarge}>
                <div style={mapRouteLong} />
                <div style={mapPinStart}>C</div>
                <div style={mapPinEnd}>D</div>
                <div style={truckDot}><Truck size={14} color="#FFFFFF" /></div>
              </div>
              <div style={trackingGrid}>
                <div>
                  <div style={trackingLabel}>Assigned to</div>
                  <div style={trackingValue}>{trackingName}</div>
                  <div style={routeTime}>{selectedDocJob?.load_details || 'Vehicle details unavailable'}</div>
                </div>
                <div>
                  <div style={trackingLabel}>Ref</div>
                  <div style={trackingValue}>{trackingRef}</div>
                  <div style={routeTime}>Status: {trackingStatus}</div>
                </div>
              </div>
            </div>
          );
        }

        if (docsView === 'jobs') {
          return (
            <div style={routeCard}>
              <div style={subHeaderRow}>
                <button style={backBtn} onClick={() => setDocsView('wallet')}><ArrowLeft size={16} /> Back</button>
                <div style={subHeaderTitle}>Jobs</div>
                <span style={activeBadge}>Active ({bookingItems.length})</span>
              </div>
              <div style={listStackCompact}>
                {bookingItems.map((entry) => (
                  <button key={entry.id} style={jobMiniCard} onClick={() => setDocsView('tracking')}>
                    <div>
                      <div style={routeTime}>{fmtDateTime(entry.pickup_datetime, 'Today, 08:00')}</div>
                      <div style={jobMiniRoute}>{entry.pickup_location} to {entry.delivery_location}</div>
                    </div>
                    <div style={jobMiniRight}>{money(entry.budget_amount)}</div>
                  </button>
                ))}
              </div>
            </div>
          );
        }

        if (docsView === 'pod') {
          return (
            <div style={routeCard}>
              <div style={subHeaderRow}>
                <button style={backBtn} onClick={() => setDocsView('wallet')}><ArrowLeft size={16} /> Back</button>
                <div style={subHeaderTitle}>Proof of Delivery</div>
              </div>
              <div style={trackingLabel}>Order {selectedDocJob ? selectedDocJob.id.slice(0, 10).toUpperCase() : 'N/A'}</div>
              <div style={signatureBox}>{podRecipientName || 'Recipient name'}</div>
              <div style={podFormRow}><span style={trackingLabel}>Recipient</span><input style={podInput} value={podRecipientName} onChange={(e) => setPodRecipientName(e.target.value)} /></div>
              <div style={podFormRow}><span style={trackingLabel}>Signature</span><input style={podInput} value={podSignature} onChange={(e) => setPodSignature(e.target.value)} /></div>
              <div style={trackingLabel}>Photos</div>
              <div style={photoThumb}>{selectedPodFile ? selectedPodFile.name : 'No POD file selected'}</div>
              <button style={smallActionBtn} onClick={() => podInputRef.current?.click()}>Choose POD File</button>
              <input
                ref={podInputRef}
                type="file"
                accept="image/*,application/pdf"
                style={{ display: 'none' }}
                onChange={(e) => setSelectedPodFile(e.target.files?.[0] ?? null)}
              />
              <div style={trackingLabel}>Notes</div>
              <textarea style={podTextArea} value={podNotes} onChange={(e) => setPodNotes(e.target.value)} />
              <button
                style={quoteButton}
                onClick={async () => {
                  if (!selectedDocJob) {
                    setFlashMessage('No job selected for POD.');
                    return;
                  }
                  const ok = await uploadPodForJob(selectedDocJob);
                  if (ok) setDocsView('delivery_done');
                }}
                disabled={busyAction === 'pod-upload'}
              >
                {busyAction === 'pod-upload' ? 'Saving POD...' : 'Complete Delivery'}
              </button>
              <button style={ghostAction} onClick={() => setDocsView('pickup_done')}>Show Pickup Confirmation</button>
            </div>
          );
        }

        if (docsView === 'pickup_done') {
          return (
            <div style={successCard}>
              <CheckCircle2 size={72} color="#12A076" />
              <div style={successTitle}>Pickup Confirmed</div>
              <div style={successText}>Job collected successfully. Proceed with delivery as planned.</div>
              <div style={successMeta}><strong>Ref:</strong> {selectedDocJob ? selectedDocJob.id.slice(0, 10).toUpperCase() : 'N/A'}</div>
              <div style={successMeta}><strong>From:</strong> {selectedDocJob?.pickup_location || 'Unavailable'}</div>
              <div style={successMeta}><strong>To:</strong> {selectedDocJob?.delivery_location || 'Unavailable'}</div>
              <button style={quoteButton} onClick={() => setDocsView('pod')}>Continue to POD</button>
            </div>
          );
        }

        if (docsView === 'delivery_done') {
          return (
            <div style={successCard}>
              <CheckCircle2 size={72} color="#12A076" />
              <div style={successTitle}>Delivery Completed</div>
              <div style={successText}>The job has been completed successfully.</div>
              <div style={trackingLabel}>Payment proof</div>
              <div style={signatureBox}>Signed</div>
                <button style={quoteButton} onClick={() => podInputRef.current?.click()}>Upload Photo of BOL</button>
              <button style={ghostAction} onClick={() => setDocsView('bookings')}>Back to bookings</button>
            </div>
          );
        }

        return (
          <>
            <div style={segmentedTabs3}>
              <button style={bookingsTab === 'current' ? segmentActive : segmentIdle} onClick={() => setBookingsTab('current')}>Current</button>
              <button style={bookingsTab === 'past_7' ? segmentActive : segmentIdle} onClick={() => setBookingsTab('past_7')}>Past 7 days</button>
              <button style={bookingsTab === 'past_14' ? segmentActive : segmentIdle} onClick={() => setBookingsTab('past_14')}>Past 14 days</button>
            </div>
            {bookingItems.length === 0 ? (
              <div style={routeCard}>
                <div style={routeTime}>No real booking data available for this range.</div>
              </div>
            ) : bookingItems.map((entry) => (
              <div key={entry.id} style={routeCard}>
                <div style={routeTime}>{fmtDateTime(entry.pickup_datetime, 'Today, 08:00')}</div>
                <div style={routeAddress}>{entry.pickup_location || 'Pickup'} {' -> '} {entry.delivery_location || 'Delivery'}</div>
                <div style={tagsRow}><span style={isCompletedLifecycleStatus(getJobStatus(entry)) ? tagMint : statusCapsule}>{labelForStatus(entry.current_status || entry.status).toUpperCase()}</span></div>
                <div style={dualBtnRow}>
                  <button style={smallActionBtn} onClick={() => { setSelectedDocJobId(entry.id); setDocsView('jobs'); }}>Jobs List</button>
                  <button style={smallActionBtn} onClick={() => { setSelectedDocJobId(entry.id); setDocsView('tracking'); }}>Track Live</button>
                </div>
                <button style={quoteButton} onClick={() => { setSelectedDocJobId(entry.id); setDocsView('pod'); }}>Open POD</button>
              </div>
            ))}
          </>
        );
      };

      return (
        <div style={screenWrap}>
          <div style={topBar}>
            <img src="/xdrive-logo-horizontal.png" alt="XDrive Logistics" style={logo} />
          </div>
          <div style={contentArea}>{renderFlash()}{renderDocsSubView()}</div>
          <BottomNav tab={tab} onTabChange={setTab} />
        </div>
      );
    }

    return (
      <div style={screenWrap}>
        <div style={topBar}>
          <img src="/xdrive-logo-horizontal.png" alt="XDrive Logistics" style={logo} />
        </div>
        <div style={contentArea}>
          {renderFlash()}
          <div style={routeCard}>
            <button style={linkRow} onClick={() => setMoreTab('profile')}><span><User size={15} /> Profile</span><ChevronRight size={16} /></button>
            <button style={linkRow} onClick={() => setMoreTab('vehicle')}><span><Truck size={15} /> My Vehicle</span><ChevronRight size={16} /></button>
            <button style={linkRow} onClick={() => setMoreTab('documents')}><span><FileText size={15} /> Documents</span><ChevronRight size={16} /></button>
            <button style={linkRow} onClick={() => setMoreTab('messages')}><span><MessageSquare size={15} /> Messages</span><ChevronRight size={16} /></button>
            <button style={linkRow} onClick={() => setMoreTab('security')}><span><Shield size={15} /> Account & Security</span><ChevronRight size={16} /></button>
            <button style={linkRow} onClick={() => setMoreTab('settings')}><span><Settings size={15} /> Settings</span><ChevronRight size={16} /></button>
            <button style={linkRow} onClick={() => setMoreTab('help')}><span><HelpCircle size={15} /> Help & Support</span><ChevronRight size={16} /></button>
            <button style={linkRow} onClick={() => setMoreTab('privacy')}><span>Privacy Policy</span><ChevronRight size={16} /></button>
            <button style={linkRow} onClick={() => setMoreTab('terms')}><span>Terms & Conditions</span><ChevronRight size={16} /></button>
            <button style={linkRow} onClick={() => void logout()}><span><LogOut size={15} /> Log Out</span><ChevronRight size={16} /></button>
          </div>
          {moreTab === 'documents' && (
            <div style={routeCard}>
              <div style={subHeaderRow}><div style={subHeaderTitle}>Documents</div><span style={activeBadge}>{docs.length}</span></div>
              {docs.length === 0 ? (
                <div style={emptyBody}>No driver or assigned vehicle documents are available for this account.</div>
              ) : docs.map((entry) => (
                <div key={`${entry.source}-${entry.id}`} style={jobMiniCard}>
                  <div>
                    <div style={jobMiniRoute}>{entry.doc_type || 'Document'}</div>
                    <div style={routeTime}>{entry.source === 'vehicle' ? 'Vehicle document' : 'Driver document'} • Uploaded {fmtDateTime(entry.created_at, 'Recently')}</div>
                    {entry.expiry_date ? <div style={routeTime}>Expires {new Date(entry.expiry_date).toLocaleDateString('en-GB')}</div> : null}
                    {entry.rejection_reason ? <div style={routeTime}>{entry.rejection_reason}</div> : null}
                  </div>
                  <span style={labelDocStatus(entry.status, entry.expiry_date) === 'Approved' ? tagMint : tagBlue}>{labelDocStatus(entry.status, entry.expiry_date).toUpperCase()}</span>
                </div>
              ))}
              <button style={smallActionBtn} onClick={() => podInputRef.current?.click()}>Upload New Document</button>
            </div>
          )}
          {moreTab === 'messages' && (
            <div style={routeCard}>
              <div style={subHeaderRow}><div style={subHeaderTitle}>Messages</div><span style={activeBadge}>{driverMessages.length}</span></div>
              <div style={segmentedTabs}>
                <button style={messagesFilter === 'all' ? segmentActive : segmentIdle} onClick={() => setMessagesFilter('all')}>All</button>
                <button style={messagesFilter === 'unread' ? segmentActive : segmentIdle} onClick={() => setMessagesFilter('unread')}>Unread</button>
                <button style={messagesFilter === 'important' ? segmentActive : segmentIdle} onClick={() => setMessagesFilter('important')}>Important</button>
              </div>
              {driverMessages.length === 0 ? (
                <div style={emptyBody}>No real messaging records are available for this account.</div>
              ) : driverMessages.map((entry) => (
                <div key={entry.id} style={jobMiniCard}>
                  <div>
                    <div style={jobMiniRoute}>{entry.body || 'Message'}</div>
                    <div style={routeTime}>{fmtDateTime(entry.created_at, 'Recently')}</div>
                    <div style={routeTime}>Conversation {entry.conversation_id?.slice(0, 8).toUpperCase() || 'N/A'}</div>
                  </div>
                  <span style={tagBlue}>MESSAGE</span>
                </div>
              ))}
            </div>
          )}
          {moreTab === 'vehicle' && (
            <div style={routeCard}>
              <div style={trackingTitle}>My Vehicle</div>
              <div style={detailsGrid}>
                <div style={detailLabel}>Vehicle</div><div style={detailValueStrong}>{vehicleDisplay}</div>
                <div style={detailLabel}>Registration</div><div style={detailValue}>{assignedVehicle?.reg_plate || 'No vehicle assigned'}</div>
              </div>
            </div>
          )}
          <div style={segmentedTabs3}>
            <button style={moreTab === 'account' ? segmentActive : segmentIdle} onClick={() => setMoreTab('account')}>Account</button>
            <button style={moreTab === 'settings' ? segmentActive : segmentIdle} onClick={() => setMoreTab('settings')}>Settings</button>
            <button style={moreTab === 'support' ? segmentActive : segmentIdle} onClick={() => setMoreTab('support')}>Support</button>
          </div>

          {moreTab === 'account' && (
            <div style={listStackCompact}>
              <div style={routeCard}>
                <div style={profileMiniRow}>
                  <div style={avatarMini}>{initials(user?.email)}</div>
                  <div>
                    <div style={driverName}>{driverDisplayName}</div>
                    <div style={metaLine}>{user?.email || 'No account email'}</div>
                  </div>
                </div>
                <div style={divider} />
                <div style={detailsGrid}>
                  <div style={detailLabel}>Phone</div><div style={detailValue}>Not available</div>
                  <div style={detailLabel}>Vehicle</div><div style={detailValue}>Not available</div>
                  <div style={detailLabel}>Reg</div><div style={detailValue}>Not available</div>
                  <div style={detailLabel}>Licence</div><div style={detailValue}>Not available</div>
                  <div style={detailLabel}>Rating</div><div style={detailValue}>Not available</div>
                  <div style={detailLabel}>Status</div><div style={detailValueStrong}>{hasDriverAccess ? 'Active Driver' : 'No driver access'}</div>
                </div>
                <div style={divider} />
                <div style={statusBand}>Profile data comes from your real account context.</div>
              </div>

              <div style={routeCard}>
                <div style={routeTime}>Earnings from completed jobs</div>
                <div style={earningsTotal}>{money(earningsTotalAmount)}</div>
                <div style={earningsStats}>
                  <div style={earningStat}><strong>{completedJobs.length}</strong><span>Completed jobs</span></div>
                  <div style={earningStat}><strong>{money(earningsAverage)}</strong><span>Avg. earnings</span></div>
                  <div style={earningStat}><strong>{inProgressJobs.length}</strong><span>In progress</span></div>
                </div>
              </div>
            </div>
          )}

          {moreTab === 'settings' && (
            <div style={listStackCompact}>
              <div style={routeCard}>
                <div style={trackingTitle}>Account</div>
                <div style={settingRow}><span>Notify when tracked</span><input type="checkbox" checked={notifyTracked} onChange={(e) => setNotifyTracked(e.target.checked)} /></div>
                <div style={divider} />
                <div style={settingRow}><span>Email notifications</span><input type="checkbox" checked={emailNotifications} onChange={(e) => setEmailNotifications(e.target.checked)} /></div>
                <div style={divider} />
                <button style={linkRow} onClick={() => setFlashMessage('Contact details opened.')}><span>Manage Contact Details</span><ChevronRight size={16} /></button>
                <button style={linkRow} onClick={() => setFlashMessage('Security settings opened.')}><span>Security & Login</span><ChevronRight size={16} /></button>
              </div>

              <div style={routeCard}>
                <div style={trackingTitle}>App</div>
                <button style={linkRow} onClick={() => setFlashMessage('Push notifications settings opened.')}><span>Push Notifications</span><ChevronRight size={16} /></button>
                <button style={linkRow} onClick={() => setFlashMessage('Vehicle tracking settings opened.')}><span>Vehicle Tracking</span><ChevronRight size={16} /></button>
                <button style={linkRow} onClick={() => setFlashMessage('Biometric login settings opened.')}><span>Biometric login</span><ChevronRight size={16} /></button>
                <button style={linkRow} onClick={() => setFlashMessage('Language and region settings opened.')}><span>Language & Region</span><ChevronRight size={16} /></button>
              </div>

              <div style={routeCard}>
                <div style={trackingTitle}>About</div>
                <button style={linkRow} onClick={() => setFlashMessage('App version details opened.')}><span>App version</span><ChevronRight size={16} /></button>
                <button style={linkRow} onClick={() => setFlashMessage('Terms and privacy opened.')}><span>Terms & Privacy</span><ChevronRight size={16} /></button>
                <button style={linkRow} onClick={() => setFlashMessage('Licenses opened.')}><span>Licenses</span><ChevronRight size={16} /></button>
              </div>

              <button style={quoteButton} onClick={() => void saveDriverPreferences()} disabled={prefsSaving}>{prefsSaving ? 'Saving...' : 'Save Settings'}</button>
            </div>
          )}

          {moreTab === 'support' && (
            <div style={routeCard}>
              <button style={linkRow} onClick={() => setFlashMessage('Help centre opened.')}><span>Help Centre</span><ChevronRight size={16} /></button>
              <div style={divider} />
              <button style={linkRow} onClick={() => setFlashMessage('Support opened.')}><span>Support</span><ChevronRight size={16} /></button>
              <div style={divider} />
              <button style={linkRow} onClick={() => setFlashMessage("What's new opened.")}><span>What's New</span><ChevronRight size={16} /></button>
              <div style={divider} />
              <button style={linkRow} onClick={() => setFlashMessage('Legal opened.')}><span>Legal</span><ChevronRight size={16} /></button>
            </div>
          )}
        </div>
        <BottomNav tab={tab} onTabChange={setTab} />
      </div>
    );
  };

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <main style={pageBg}>
        {renderTab()}
        {quoteModalJob && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 2000, padding: '0 0 24px' }}>
            <div style={{ background: '#fff', borderRadius: '16px 16px 0 0', padding: '1.25rem', width: '100%', maxWidth: '520px', boxShadow: '0 -8px 32px rgba(0,0,0,0.18)', display: 'grid', gap: '0.85rem' }}>
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a' }}>Submit Quote</div>
              <div style={{ fontSize: '0.82rem', color: '#374151', background: '#f8fafc', borderRadius: '8px', padding: '0.6rem 0.75rem', borderLeft: '3px solid #1d4ed8' }}>
                <div style={{ fontWeight: 700 }}>{quoteModalJob.pickup_location || 'Pickup'} → {quoteModalJob.delivery_location || 'Delivery'}</div>
                {typeof quoteModalJob.budget_amount === 'number' && quoteModalJob.budget_amount > 0 && (
                  <div style={{ marginTop: '0.25rem', color: '#15803d', fontWeight: 700 }}>
                    Proposed price: £{quoteModalJob.budget_amount.toFixed(2)} — accept or enter your own
                  </div>
                )}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#374151', marginBottom: '0.3rem' }}>Your Quote Amount (£) *</label>
                <input
                  type="number" min="1" step="0.01"
                  value={quoteModalAmount}
                  onChange={(e) => setQuoteModalAmount(e.target.value)}
                  placeholder="e.g. 250.00"
                  style={{ width: '100%', padding: '0.65rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box' }}
                />
              </div>
              {typeof quoteModalJob.budget_amount === 'number' && quoteModalJob.budget_amount > 0 && (
                <button
                  style={{ padding: '0.6rem', background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem' }}
                  onClick={() => setQuoteModalAmount(String(quoteModalJob.budget_amount))}
                >
                  Accept proposed price (£{(quoteModalJob.budget_amount as number).toFixed(2)})
                </button>
              )}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#374151', marginBottom: '0.3rem' }}>Message (optional)</label>
                <textarea
                  rows={2} value={quoteModalMessage}
                  onChange={(e) => setQuoteModalMessage(e.target.value)}
                  placeholder="Notes to customer…"
                  style={{ width: '100%', padding: '0.6rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.9rem', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setQuoteModalJob(null)}
                  style={{ flex: 1, padding: '0.65rem', background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => void submitQuoteModal()}
                  disabled={quoteModalSubmitting || !quoteModalAmount}
                  style={{ flex: 2, padding: '0.65rem', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: quoteModalSubmitting ? 'not-allowed' : 'pointer', opacity: quoteModalSubmitting ? 0.6 : 1 }}
                >
                  {quoteModalSubmitting ? 'Submitting…' : 'Submit Quote'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}

const pageBg: CSSProperties = {
  minHeight: '100vh',
  background: 'linear-gradient(180deg, #DEE3E9 0%, #EEF2F6 52%, #E4E9F0 100%)',
  display: 'flex',
  justifyContent: 'center',
  padding: '8px',
};

function BottomNav({ tab, onTabChange }: { tab: DriverTab; onTabChange: (next: DriverTab) => void }) {
  const items: Array<{ id: DriverTab; label: string; icon: ReactElement }> = [
    { id: 'today', label: 'Home', icon: <User size={15} /> },
    { id: 'queue', label: 'Alerts', icon: <Bell size={15} /> },
    { id: 'comms', label: 'Quotes', icon: <Tag size={15} /> },
    { id: 'docs', label: 'Bookings', icon: <Calendar size={15} /> },
    { id: 'me', label: 'More', icon: <Menu size={15} /> },
  ];

  return (
    <nav style={bottomNav}>
      {items.map((item) => (
        <button key={item.id} style={tab === item.id ? bottomNavItemActive : bottomNavItem} onClick={() => onTabChange(item.id)}>
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

const screenWrap: CSSProperties = {
  width: '100%',
  maxWidth: 430,
  minHeight: 'calc(100vh - 16px)',
  borderRadius: 28,
  overflow: 'hidden',
  border: '1px solid #2D3A4F',
  background: '#EFF2F5',
  boxShadow: '0 20px 45px rgba(20,31,51,0.22)',
};

const topBar: CSSProperties = {
  height: 108,
  background: 'linear-gradient(120deg, #0C2B4F 0%, #0F4E7A 48%, #0F7C82 100%)',
  padding: '20px 18px 16px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const logo: CSSProperties = {
  width: 185,
  height: 'auto',
  filter: 'brightness(0) invert(1)',
};

const menuBtn: CSSProperties = {
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  width: 36,
  height: 36,
  display: 'grid',
  placeItems: 'center',
};

const contentArea: CSSProperties = {
  padding: '18px 14px 16px',
  display: 'grid',
  gap: 14,
  paddingBottom: 96,
};

const flashBanner: CSSProperties = {
  borderRadius: 10,
  border: '1px solid #BFD9CF',
  background: '#E8F5EF',
  color: '#1B4E40',
  fontSize: 13,
  fontWeight: 700,
  padding: '10px 12px',
};

const welcomeCard: CSSProperties = {
  borderRadius: 14,
  border: '1px solid #0D4D80',
  background: 'linear-gradient(135deg, #0C54A3 0%, #0B3C80 100%)',
  color: '#FFFFFF',
  padding: 14,
  display: 'grid',
  gap: 6,
};

const welcomeTitle: CSSProperties = {
  fontSize: 20,
  fontWeight: 800,
};

const welcomeSub: CSSProperties = {
  fontSize: 13,
  opacity: 0.92,
};

const welcomeChip: CSSProperties = {
  marginTop: 6,
  width: 'fit-content',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.18)',
  padding: '5px 10px',
  fontSize: 12,
  fontWeight: 700,
};

const overviewGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 8,
};

const overviewCard: CSSProperties = {
  borderRadius: 12,
  border: '1px solid #D1D9E4',
  background: '#F8FAFC',
  padding: '10px 12px',
  display: 'grid',
  gap: 4,
};

const quickActionsRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 8,
};

const pillAction: CSSProperties = {
  border: 'none',
  borderRadius: 999,
  background: '#E4EAF0',
  padding: '10px 8px',
  fontWeight: 700,
  color: '#19354D',
};

const infoPanel: CSSProperties = {
  borderRadius: 16,
  border: '1px solid #D6DCE6',
  background: '#F7F8FA',
  padding: 14,
  display: 'grid',
  gap: 10,
};

const infoTitle: CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  color: '#1A2232',
};

const infoBody: CSSProperties = {
  fontSize: 14,
  lineHeight: 1.45,
  color: '#596277',
};

const infoCta: CSSProperties = {
  border: 'none',
  borderRadius: 999,
  background: '#0F8A78',
  color: '#FFFFFF',
  fontSize: 16,
  fontWeight: 800,
  padding: '12px 16px',
};

const segmentedTabs: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 8,
  background: '#1D3550',
  padding: 6,
  borderRadius: 999,
};

const segmentedTabs3: CSSProperties = {
  ...segmentedTabs,
};

const segmentActive: CSSProperties = {
  border: 'none',
  borderRadius: 999,
  padding: '10px 8px',
  background: '#46B4A1',
  color: '#FFFFFF',
  fontWeight: 800,
};

const segmentIdle: CSSProperties = {
  border: 'none',
  borderRadius: 999,
  padding: '10px 8px',
  background: 'transparent',
  color: '#FFFFFF',
  fontWeight: 700,
};

const tagsRow: CSSProperties = {
  display: 'flex',
  gap: 8,
  margin: '8px 0 10px',
  flexWrap: 'wrap',
};

const tagGreen: CSSProperties = {
  borderRadius: 8,
  padding: '4px 8px',
  background: '#D7EFDB',
  color: '#2A7032',
  fontSize: 12,
  fontWeight: 800,
};

const tagBlue: CSSProperties = {
  borderRadius: 8,
  padding: '4px 8px',
  background: '#DCEAF9',
  color: '#2E5D9A',
  fontSize: 12,
  fontWeight: 800,
};

const tagMint: CSSProperties = {
  borderRadius: 8,
  padding: '4px 8px',
  background: '#D7F3DB',
  color: '#247B2D',
  fontSize: 12,
  fontWeight: 800,
};

const quoteButton: CSSProperties = {
  width: '100%',
  border: 'none',
  borderRadius: 999,
  background: '#0F8A78',
  color: '#FFFFFF',
  fontWeight: 800,
  fontSize: 16,
  padding: '12px 14px',
};

const emptyPanel: CSSProperties = {
  borderRadius: 16,
  border: '1px solid #D6DCE6',
  background: '#F7F8FA',
  padding: 24,
  display: 'grid',
  placeItems: 'center',
  gap: 10,
  textAlign: 'center',
};

const emptyTitle: CSSProperties = {
  fontSize: 28 / 1.6,
  fontWeight: 800,
  color: '#1A2232',
};

const emptyBody: CSSProperties = {
  fontSize: 14,
  color: '#5D667A',
  lineHeight: 1.4,
};

const profileMiniRow: CSSProperties = {
  display: 'flex',
  gap: 10,
  alignItems: 'center',
};

const avatarMini: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: '50%',
  background: '#0F8A78',
  color: '#FFFFFF',
  fontWeight: 800,
  display: 'grid',
  placeItems: 'center',
};

const settingRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  color: '#1F2A3E',
  fontWeight: 700,
};

const linkRow: CSSProperties = {
  border: 'none',
  background: 'transparent',
  width: '100%',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  color: '#1F2A3E',
  fontWeight: 700,
  padding: '8px 0',
};

const bottomNav: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  display: 'grid',
  gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
  gap: 2,
  padding: '8px 8px 10px',
  borderTop: '1px solid #CDD4DE',
  background: '#FFFFFF',
};

const bottomNavItem: CSSProperties = {
  border: 'none',
  background: 'transparent',
  borderRadius: 10,
  color: '#4A5265',
  fontSize: 12,
  fontWeight: 700,
  display: 'grid',
  gap: 4,
  justifyItems: 'center',
  padding: '8px 4px',
};

const bottomNavItemActive: CSSProperties = {
  ...bottomNavItem,
  background: '#DCEFEA',
  color: '#0C5D65',
};

const titleRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const jobTitle: CSSProperties = {
  fontSize: 48 / 2,
  fontWeight: 800,
  letterSpacing: 0.2,
  color: '#171B24',
};

const jobRef: CSSProperties = {
  fontSize: 18,
  color: '#2B3343',
};

const infoCard: CSSProperties = {
  borderRadius: 12,
  border: '1px solid #CDD4DE',
  background: '#F8F8F8',
  padding: 10,
};

const profileRow: CSSProperties = {
  display: 'flex',
  gap: 12,
};

const avatar: CSSProperties = {
  width: 92,
  height: 120,
  borderRadius: 10,
  background: '#D8DADF',
  color: '#233558',
  fontWeight: 800,
  fontSize: 24,
  display: 'grid',
  placeItems: 'center',
  flexShrink: 0,
};

const driverName: CSSProperties = {
  fontSize: 20,
  fontWeight: 800,
  color: '#1A2130',
};

const metaLine: CSSProperties = {
  fontSize: 15,
  color: '#2D394F',
  lineHeight: 1.35,
};

const detailsGrid: CSSProperties = {
  marginTop: 6,
  display: 'grid',
  gridTemplateColumns: '108px 1fr',
  rowGap: 2,
  columnGap: 8,
  alignItems: 'baseline',
};

const detailLabel: CSSProperties = {
  fontSize: 13,
  color: '#3B465B',
};

const detailValue: CSSProperties = {
  fontSize: 15,
  color: '#1F2A3F',
  fontWeight: 600,
};

const detailValueStrong: CSSProperties = {
  fontSize: 17,
  color: '#141D2E',
  fontWeight: 800,
};

const stars: CSSProperties = {
  color: '#F6BE00',
  fontSize: 18,
  letterSpacing: 1.2,
};

const statusBand: CSSProperties = {
  borderRadius: 8,
  background: '#DBECE8',
  color: '#0A5259',
  textAlign: 'center',
  fontSize: 20 / 1.6,
  fontWeight: 600,
  padding: '8px 10px',
};

const sectionTitle: CSSProperties = {
  fontSize: 40 / 2,
  fontWeight: 800,
  color: '#161C29',
};

const routeCard: CSSProperties = {
  borderRadius: 12,
  border: '1px solid #CDD4DE',
  background: '#F8F8F8',
  padding: 12,
};

const routeRow: CSSProperties = {
  display: 'flex',
  gap: 10,
  alignItems: 'flex-start',
};

const markerGreen: CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: '50%',
  background: '#2F9D8F',
  display: 'grid',
  placeItems: 'center',
  marginTop: 2,
  flexShrink: 0,
};

const markerRed: CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: '50%',
  background: '#E25A4B',
  display: 'grid',
  placeItems: 'center',
  marginTop: 2,
  flexShrink: 0,
};

const routeAddress: CSSProperties = {
  fontSize: 22 / 1.45,
  fontWeight: 700,
  color: '#191F2C',
};

const routeTime: CSSProperties = {
  marginTop: 2,
  fontSize: 20 / 1.45,
  color: '#465066',
};

const divider: CSSProperties = {
  margin: '12px 0',
  borderTop: '1px solid #D8DDE5',
};

const priceCta: CSSProperties = {
  marginTop: 4,
  width: '100%',
  border: 'none',
  borderRadius: 10,
  background: '#0F4E7A',
  color: '#FFFFFF',
  fontSize: 46 / 2,
  fontWeight: 700,
  padding: '14px 10px',
  cursor: 'pointer',
};

const trackingPanel: CSSProperties = {
  borderRadius: 14,
  border: '1px solid #CBD6E0',
  background: '#F8FBFD',
  padding: 12,
  display: 'grid',
  gap: 10,
};

const trackingTitle: CSSProperties = {
  fontSize: 16,
  fontWeight: 800,
  color: '#17324D',
};

const mapPlaceholder: CSSProperties = {
  position: 'relative',
  height: 122,
  borderRadius: 12,
  background: 'repeating-linear-gradient(45deg, #E6EEF3, #E6EEF3 10px, #EDF3F7 10px, #EDF3F7 20px)',
  border: '1px solid #D5E0E8',
  overflow: 'hidden',
};

const mapPath: CSSProperties = {
  position: 'absolute',
  left: '16%',
  top: '62%',
  width: '68%',
  height: 4,
  background: '#0F6E89',
  transform: 'rotate(-22deg)',
  borderRadius: 999,
};

const mapPinStart: CSSProperties = {
  position: 'absolute',
  left: '10%',
  top: '58%',
  width: 22,
  height: 22,
  borderRadius: '50%',
  background: '#0F8A78',
  color: '#FFFFFF',
  fontSize: 11,
  fontWeight: 800,
  display: 'grid',
  placeItems: 'center',
};

const mapPinEnd: CSSProperties = {
  position: 'absolute',
  right: '10%',
  top: '34%',
  width: 22,
  height: 22,
  borderRadius: '50%',
  background: '#D9534F',
  color: '#FFFFFF',
  fontSize: 11,
  fontWeight: 800,
  display: 'grid',
  placeItems: 'center',
};

const trackingGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 8,
};

const trackingLabel: CSSProperties = {
  fontSize: 12,
  color: '#64809B',
};

const trackingValue: CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  color: '#17324D',
};

const earningsTotal: CSSProperties = {
  marginTop: 8,
  borderRadius: 12,
  background: '#12806F',
  color: '#FFFFFF',
  textAlign: 'center',
  fontWeight: 800,
  fontSize: 30,
  padding: '14px 10px',
};

const earningsStats: CSSProperties = {
  marginTop: 10,
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 8,
};

const earningStat: CSSProperties = {
  borderRadius: 10,
  border: '1px solid #D4DEE8',
  background: '#F9FBFC',
  display: 'grid',
  gap: 4,
  padding: '10px 8px',
  textAlign: 'center',
  color: '#1E3248',
  fontSize: 12,
};

const subHeaderRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  marginBottom: 8,
};

const subHeaderTitle: CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  color: '#18334D',
};

const backBtn: CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: '#35536D',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  fontWeight: 700,
  cursor: 'pointer',
};

const mapLarge: CSSProperties = {
  position: 'relative',
  height: 168,
  borderRadius: 12,
  border: '1px solid #D5E0E8',
  background: 'linear-gradient(180deg, #E7EFF4 0%, #EEF4F8 100%)',
  overflow: 'hidden',
  marginBottom: 10,
};

const mapRouteLong: CSSProperties = {
  position: 'absolute',
  left: '18%',
  top: '58%',
  width: '58%',
  height: 5,
  background: '#0A6880',
  transform: 'rotate(-34deg)',
  borderRadius: 999,
};

const truckDot: CSSProperties = {
  position: 'absolute',
  left: '56%',
  top: '44%',
  width: 26,
  height: 26,
  borderRadius: '50%',
  background: '#0F4E7A',
  display: 'grid',
  placeItems: 'center',
};

const activeBadge: CSSProperties = {
  borderRadius: 999,
  padding: '6px 10px',
  background: '#DDEFEA',
  color: '#0E625E',
  fontWeight: 800,
  fontSize: 13,
};

const listStackCompact: CSSProperties = {
  display: 'grid',
  gap: 8,
};

const jobMiniCard: CSSProperties = {
  width: '100%',
  border: '1px solid #D4DEE8',
  borderRadius: 12,
  background: '#FAFCFD',
  padding: 10,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  cursor: 'pointer',
};

const jobMiniRoute: CSSProperties = {
  fontSize: 20 / 1.35,
  fontWeight: 700,
  color: '#17324D',
};

const jobMiniRight: CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  color: '#0F4E7A',
};

const signatureBox: CSSProperties = {
  marginTop: 4,
  borderRadius: 12,
  border: '1px solid #D4DEE8',
  background: '#FBFCFD',
  height: 84,
  display: 'grid',
  placeItems: 'center',
  fontSize: 42,
  fontStyle: 'italic',
  color: '#2F3F54',
};

const photoThumb: CSSProperties = {
  marginTop: 4,
  width: 110,
  height: 88,
  borderRadius: 10,
  border: '1px solid #D4DEE8',
  background: '#E9EFF4',
  display: 'grid',
  placeItems: 'center',
  color: '#4F647B',
  fontWeight: 700,
};

const successCard: CSSProperties = {
  borderRadius: 16,
  border: '1px solid #CFE0D7',
  background: '#F7FCFA',
  padding: 16,
  display: 'grid',
  gap: 10,
  justifyItems: 'center',
  textAlign: 'center',
};

const successTitle: CSSProperties = {
  fontSize: 30 / 1.35,
  fontWeight: 800,
  color: '#0A524D',
};

const successText: CSSProperties = {
  fontSize: 15,
  color: '#3E5E66',
  lineHeight: 1.4,
};

const successMeta: CSSProperties = {
  width: '100%',
  textAlign: 'left',
  color: '#1C344B',
  fontSize: 16,
};

const ghostAction: CSSProperties = {
  width: '100%',
  border: '1px solid #B8CAD6',
  borderRadius: 999,
  background: '#FFFFFF',
  color: '#234A66',
  fontWeight: 700,
  fontSize: 15,
  padding: '11px 12px',
};

const dualBtnRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 8,
  marginBottom: 8,
};

const smallActionBtn: CSSProperties = {
  border: '1px solid #BFD0DC',
  background: '#F9FCFD',
  color: '#234A66',
  borderRadius: 10,
  fontWeight: 700,
  padding: '10px 8px',
  fontSize: 13,
};

const jobMetaRowLine: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  marginBottom: 8,
};

const statusCapsule: CSSProperties = {
  borderRadius: 999,
  padding: '4px 10px',
  background: '#E4EEF7',
  color: '#234A66',
  fontWeight: 800,
  fontSize: 12,
};

const podFormRow: CSSProperties = {
  display: 'grid',
  gap: 6,
};

const podInput: CSSProperties = {
  width: '100%',
  border: '1px solid #C8D4E0',
  borderRadius: 10,
  padding: '10px 12px',
  fontSize: 14,
  color: '#1D3046',
  background: '#FFFFFF',
};

const podTextArea: CSSProperties = {
  width: '100%',
  minHeight: 84,
  border: '1px solid #C8D4E0',
  borderRadius: 10,
  padding: '10px 12px',
  fontSize: 14,
  color: '#1D3046',
  resize: 'vertical',
  background: '#FFFFFF',
};

const miniCheck: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  color: '#35506D',
  fontSize: 13,
  fontWeight: 700,
};

const noteRow: CSSProperties = {
  border: '1px solid #D4DEE8',
  borderRadius: 10,
  background: '#F9FCFD',
  padding: '9px 10px',
  color: '#234A66',
  fontSize: 13,
  lineHeight: 1.35,
};

const timelineWrap: CSSProperties = {
  display: 'grid',
  gap: 8,
  margin: '8px 0 12px',
};

const timelineRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '16px 1fr',
  gap: 10,
  alignItems: 'start',
};

const timelineDotBase: CSSProperties = {
  width: 12,
  height: 12,
  borderRadius: '50%',
  marginTop: 4,
};

const timelineDotDone: CSSProperties = {
  ...timelineDotBase,
  background: '#0F8A78',
};

const timelineDotCurrent: CSSProperties = {
  ...timelineDotBase,
  background: '#0F4E7A',
};

const timelineDotIdle: CSSProperties = {
  ...timelineDotBase,
  background: '#CED7E1',
};

const timelineTextWrap: CSSProperties = {
  display: 'grid',
  gap: 2,
};

const timelineLabel: CSSProperties = {
  fontSize: 14,
  color: '#18334D',
  fontWeight: 700,
};

const timelineMeta: CSSProperties = {
  fontSize: 12,
  color: '#64809B',
};
