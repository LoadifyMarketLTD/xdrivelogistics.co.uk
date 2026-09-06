import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import {
  Alert,
  ImageBackground,
  Linking,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Network from 'expo-network';
import * as Notifications from 'expo-notifications';
import SignatureCanvas from 'react-native-signature-canvas';

import { apiRequest } from '../api/client';
import { fetchJobs, persistEvidenceFile, persistEvidencePhoto, postJobStatus, uploadPod } from '../api/jobs';
import {
  fetchDriverResources,
  formatMoney,
  mapResourceJob,
  updateDriverAvailability,
  updateJobQuote,
  withdrawJobQuote,
  type DriverProfileResource,
} from '../api/resources';
import { fetchLiveLoads, submitLiveLoadQuote, type LiveLoad } from '../api/liveLoads';
import { clearSessionToken, saveSessionToken } from '../auth/sessionStore';
import { isSupabaseConfigured, supabase } from '../auth/supabase';
import {
  loadMarketplacePreferences,
  saveMarketplacePreferences,
  type MarketplacePreferences,
} from '../jobs/marketplacePreferences';
import { getNextStep, statusFlow } from '../jobs/statusFlow';
import type { CanonicalJobStatus, DriverJob } from '../jobs/types';
import {
  clearQueueSessionCache,
  enqueueAction,
  getQueue,
  isOnline,
  saveQueue,
  updateQueueItem,
  type QueuedAction,
} from '../offline/queue';
import {
  parseDriverDeepLink,
  targetFromNotificationData,
  type DriverDeepLinkTarget,
} from '../push/driverDeepLinks';
import { registerPushToken } from '../push/registerPushToken';
import {
  classifyTrackingError,
  publishCurrentDriverLocation,
  type DriverTrackingState,
} from '../tracking/nativeLocation';
import { colors, spacing } from '../ui/theme';

type PrimaryTab = 'overview' | 'loads' | 'offers' | 'history' | 'account';
type LoadFeed = 'available' | 'starred' | 'dismissed';
type OfferFeed = 'active' | 'won' | 'archived';
type JobDetailTab = 'overview' | 'route' | 'progress';
type UtilityPage = 'profile' | 'vehicle' | 'documents' | 'earnings' | 'availability' | 'offline' | 'support';

type AppRoute =
  | { kind: 'primary'; tab: PrimaryTab }
  | { kind: 'load'; load: LiveLoad }
  | { kind: 'offer'; load: LiveLoad }
  | { kind: 'job'; jobId: string }
  | { kind: 'utility'; page: UtilityPage };

type JobStop = {
  id?: string;
  sequence: number;
  type?: string;
  address: string;
  postcode?: string;
  company?: string;
  contactPerson?: string;
  telephone?: string;
  timeWindowFrom?: string;
  timeWindowTo?: string;
  status?: string;
  notes?: string;
};

type WorkDocument = {
  id?: string | null;
  type?: string | null;
  fileName?: string | null;
  createdAt?: string | null;
};

type AuditEntry = {
  id?: string | null;
  eventType?: string | null;
  message?: string | null;
  createdAt?: string | null;
  source?: string | null;
};
type JobDetail = DriverJob & {
  stops?: JobStop[];
  specialInstructions?: string;
  postingCompanyPhone?: string;
  customerName?: string;
  customerReference?: string;
  purchaseOrderNumber?: string;
  bookingReference?: string;
  requestedVehicle?: string;
  allocatedVehicle?: Record<string, unknown> | null;
  cargo?: Record<string, unknown> | null;
  requirements?: string[];
  documentChecklist?: string[];
  commercial?: Record<string, unknown> | null;
  notes?: Record<string, unknown> | null;
  attachments?: WorkDocument[];
  documents?: WorkDocument[];
  auditTrail?: AuditEntry[];
  pod?: Record<string, unknown> | null;
  podCompleted?: boolean;
  distanceMiles?: number | null;
  etaMinutes?: number | null;
  partial?: boolean;
};

const MAX_POD_PHOTOS = 10;
const MAX_POD_DOCUMENTS = 10;

const defaultPreferences: MarketplacePreferences = {
  savedJobIds: [],
  hiddenJobIds: [],
  destinationPriorityEnabled: true,
  destinationRadiusMiles: 10,
};

const progressLabels: Record<CanonicalJobStatus, string> = {
  awarded: 'Assigned',
  on_my_way_pickup: 'Heading to collection',
  arrived_pickup: 'At collection point',
  loaded: 'Cargo loaded',
  on_my_way_delivery: 'Delivery leg active',
  arrived_delivery: 'At delivery point',
  delivered: 'Completed',
  cancelled: 'Cancelled',
};

const progressOrder: CanonicalJobStatus[] = [
  'awarded',
  ...statusFlow.map((step) => step.status),
  'delivered',
];

function cleanError(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Time not supplied';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function textValue(value: unknown) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function uriLabel(uri: string) {
  const clean = uri.split('?', 1)[0] ?? uri;
  const tail = clean.slice(clean.lastIndexOf('/') + 1) || 'evidence';
  try { return decodeURIComponent(tail); } catch { return tail; }
}

function numberText(value: unknown, suffix = '') {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `${parsed}${suffix}` : '';
}

function canonicalEventStatus(value: unknown): CanonicalJobStatus | null {
  const status = String(value ?? '').trim().toLowerCase();
  if (['awarded', 'allocated', 'accepted', 'assigned'].includes(status)) return 'awarded';
  if (['on_my_way', 'on_my_way_to_pickup', 'on_my_way_pickup'].includes(status)) return 'on_my_way_pickup';
  if (['on_site_pickup', 'arrived_pickup'].includes(status)) return 'arrived_pickup';
  if (['loaded', 'collected'].includes(status)) return 'loaded';
  if (['in_transit', 'on_route_delivery', 'on_my_way_to_delivery', 'on_my_way_delivery'].includes(status)) return 'on_my_way_delivery';
  if (['on_site_delivery', 'arrived_delivery'].includes(status)) return 'arrived_delivery';
  if (['delivered', 'completed', 'invoiced', 'paid'].includes(status)) return 'delivered';
  if (['cancelled', 'canceled'].includes(status)) return 'cancelled';
  return null;
}

function sortTime(job: DriverJob) {
  const values = [job.updatedAt, job.deliveryTime, job.pickupTime];
  for (const value of values) {
    const timestamp = new Date(value ?? '').getTime();
    if (Number.isFinite(timestamp)) return timestamp;
  }
  return 0;
}

function quoteStatus(quote: Record<string, any>) {
  return String(quote.status ?? '').toLowerCase();
}

function offerBucket(quote: Record<string, any>): OfferFeed {
  const status = quoteStatus(quote);
  if (['accepted', 'awarded', 'approved'].includes(status)) return 'won';
  if (['rejected', 'unsuccessful', 'declined', 'withdrawn', 'expired', 'cancelled'].includes(status)) return 'archived';
  return 'active';
}

async function validateDriverRole(userId: string) {
  try {
    const { data, error } = await supabase.from('profiles').select('role').eq('user_id', userId).maybeSingle();
    return !error && data?.role === 'driver';
  } catch {
    return false;
  }
}

async function fetchJobDetail(jobId: string) {
  const payload = await apiRequest<{ job: JobDetail }>(`/api/driver/mobile/jobs/${jobId}`);
  return payload.job;
}

export default function DriverMobileAppV3() {
  const [token, setToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [route, setRoute] = useState<AppRoute>({ kind: 'primary', tab: 'overview' });
  const [activeTab, setActiveTab] = useState<PrimaryTab>('overview');
  const [loadFeed, setLoadFeed] = useState<LoadFeed>('available');
  const [offerFeed, setOfferFeed] = useState<OfferFeed>('active');
  const [detailTab, setDetailTab] = useState<JobDetailTab>('overview');
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [loadBusy, setLoadBusy] = useState(false);
  const [resourcesBusy, setResourcesBusy] = useState(false);
  const [jobsBusy, setJobsBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [liveLoads, setLiveLoads] = useState<LiveLoad[]>([]);
  const [resources, setResources] = useState<DriverProfileResource | null>(null);
  const [activeJobs, setActiveJobs] = useState<DriverJob[]>([]);
  const [upcomingJobs, setUpcomingJobs] = useState<DriverJob[]>([]);
  const [completedJobs, setCompletedJobs] = useState<DriverJob[]>([]);
  const [jobDetail, setJobDetail] = useState<JobDetail | null>(null);
  const [jobDetailBusy, setJobDetailBusy] = useState(false);
  const [preferences, setPreferences] = useState<MarketplacePreferences>(defaultPreferences);
  const [queue, setQueue] = useState<QueuedAction[]>([]);
  const [offerAmount, setOfferAmount] = useState('');
  const [offerMessage, setOfferMessage] = useState('');
  const [editingOfferId, setEditingOfferId] = useState<string | null>(null);
  const [podOpen, setPodOpen] = useState(false);
  const [podRecipient, setPodRecipient] = useState('');
  const [podSignature, setPodSignature] = useState('');
  const [podPhotoUris, setPodPhotoUris] = useState<string[]>([]);
  const [podDocumentUris, setPodDocumentUris] = useState<string[]>([]);
  const [podNotes, setPodNotes] = useState('');
  const [trackingState, setTrackingState] = useState<DriverTrackingState>('standby');
  const signatureRef = useRef<any>(null);
  const initialIntentHandledRef = useRef(false);
  const trackingBusyRef = useRef(false);

  const currentJobs = useMemo(() => {
    const merged = [...upcomingJobs, ...activeJobs];
    return [...new Map(merged.map((job) => [job.id, job])).values()];
  }, [activeJobs, upcomingJobs]);

  const fullHistory = useMemo(() => {
    const merged = [...currentJobs, ...completedJobs];
    const unique = [...new Map(merged.map((job) => [job.id, job])).values()];
    return unique.sort((left, right) => sortTime(right) - sortTime(left));
  }, [completedJobs, currentJobs]);

  const trackingJob = useMemo(
    () => currentJobs.find((job) => job.status !== 'delivered') ?? null,
    [currentJobs],
  );

  const refreshLiveLoads = useCallback(async () => {
    setLoadBusy(true);
    setLoadError('');
    try {
      const result = await fetchLiveLoads({
        destinationMode: preferences.destinationPriorityEnabled,
        radiusMiles: preferences.destinationRadiusMiles,
      });
      setLiveLoads(result.jobs);
    } catch (error) {
      const text = cleanError(error, 'Load Board could not be refreshed.');
      setLoadError(text);
      setMessage(text);
    } finally {
      setLoadBusy(false);
    }
  }, [preferences.destinationPriorityEnabled, preferences.destinationRadiusMiles]);

  const refreshResources = useCallback(async () => {
    setResourcesBusy(true);
    try {
      const next = await fetchDriverResources();
      setResources(next);
      if (next.email) setUserEmail(next.email);
    } catch (error) {
      setMessage(cleanError(error, 'Driver account data is temporarily unavailable.'));
    } finally {
      setResourcesBusy(false);
    }
  }, []);

  const refreshJobs = useCallback(async () => {
    if (!token) return;
    setJobsBusy(true);
    const results = await Promise.allSettled([
      fetchJobs('active', token),
      fetchJobs('upcoming', token),
      fetchJobs('completed', token),
    ]);
    const [active, upcoming, completed] = results;
    if (active.status === 'fulfilled') {
      setActiveJobs(active.value.jobs.map((job) => ({ ...job, privateDetailsRevealed: true, canUpdateLifecycle: true })));
    }
    if (upcoming.status === 'fulfilled') {
      setUpcomingJobs(upcoming.value.jobs.map((job) => ({ ...job, privateDetailsRevealed: true, canUpdateLifecycle: true })));
    }
    if (completed.status === 'fulfilled') {
      setCompletedJobs(completed.value.jobs.map((job) => ({ ...job, privateDetailsRevealed: true, canUpdateLifecycle: false })));
    }
    const rejected = results.find((result) => result.status === 'rejected');
    if (rejected?.status === 'rejected') {
      setMessage(cleanError(rejected.reason, 'Some work records could not be refreshed.'));
    }
    setJobsBusy(false);
  }, [token]);

  const refreshJobDetail = useCallback(async (jobId: string) => {
    setJobDetailBusy(true);
    try {
      setJobDetail(await fetchJobDetail(jobId));
    } catch (error) {
      setMessage(cleanError(error, 'This work order could not be loaded.'));
    } finally {
      setJobDetailBusy(false);
    }
  }, []);

  const bootstrap = useCallback(async (sessionToken: string, email: string) => {
    setMessage('');
    const stored = await loadMarketplacePreferences(email).catch(() => defaultPreferences);
    setPreferences(stored);
    void registerPushToken(sessionToken);
    void refreshResources();
    void refreshJobs();
  }, [refreshJobs, refreshResources]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      const session = data.session;
      if (!session?.access_token || !session.user?.id || !(await validateDriverRole(session.user.id))) {
        if (session) await supabase.auth.signOut().catch(() => undefined);
        await clearSessionToken().catch(() => undefined);
        return;
      }
      const email = session.user.email ?? '';
      setToken(session.access_token);
      setUserEmail(email);
      setRoute({ kind: 'primary', tab: 'overview' });
      setActiveTab('overview');
      await saveSessionToken(session.access_token).catch(() => undefined);
      await bootstrap(session.access_token, email);
    })().catch((error) => setMessage(cleanError(error, 'Unable to restore the driver session.')));

    void getQueue().then(setQueue).catch(() => setQueue([]));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const next = session?.access_token?.trim() || null;
      setToken(next);
      setUserEmail(session?.user?.email ?? '');
      if (!next) {
        setRoute({ kind: 'primary', tab: 'overview' });
        setActiveTab('overview');
        setJobDetail(null);
        setTrackingState('standby');
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [bootstrap]);

  useEffect(() => {
    if (!token) return;
    void refreshLiveLoads();
  }, [refreshLiveLoads, token]);

  const flushOfflineQueue = useCallback(async () => {
    if (!token || !(await isOnline())) return;
    const pending = (await getQueue()).filter((item) => item.status === 'pending' || item.status === 'failed');
    let next = await getQueue();
    for (const item of pending) {
      try {
        if (item.endpoint === 'pod') {
          await uploadPod(item.jobId, token, item.payload ?? {});
          await postJobStatus(item.jobId, 'delivered', token);
        } else {
          await postJobStatus(item.jobId, item.endpoint, token, item.payload ?? {});
        }
        next = await updateQueueItem(item.id, { status: 'synced', lastError: undefined });
      } catch (error) {
        next = await updateQueueItem(item.id, { status: 'failed', lastError: cleanError(error, 'Sync failed.') });
      }
    }
    const remaining = next.filter((item) => item.status !== 'synced');
    await saveQueue(remaining);
    setQueue(remaining);
    await refreshJobs();
    if (route.kind === 'job') await refreshJobDetail(route.jobId);
  }, [refreshJobDetail, refreshJobs, route, token]);

  useEffect(() => {
    if (!token) return;
    const subscription = Network.addNetworkStateListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) void flushOfflineQueue();
    });
    const interval = setInterval(() => void flushOfflineQueue(), 45_000);
    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, [flushOfflineQueue, token]);

  useEffect(() => {
    if (!token) return;
    const channel = supabase
      .channel('xdrive-driver-v3-load-board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => void refreshLiveLoads())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [refreshLiveLoads, token]);

  useEffect(() => {
    if (!token || !trackingJob) {
      trackingBusyRef.current = false;
      setTrackingState('standby');
      return;
    }

    let mounted = true;
    setTrackingState('starting');
    const publish = async () => {
      if (trackingBusyRef.current) return;
      trackingBusyRef.current = true;
      try {
        await publishCurrentDriverLocation(token);
        if (mounted) setTrackingState('active');
      } catch (error) {
        if (mounted) setTrackingState(classifyTrackingError(error));
      } finally {
        trackingBusyRef.current = false;
      }
    };

    void publish();
    const interval = setInterval(() => void publish(), 30_000);
    return () => {
      mounted = false;
      trackingBusyRef.current = false;
      clearInterval(interval);
    };
  }, [token, trackingJob?.id, trackingJob?.status]);

  async function signIn(email: string, password: string) {
    if (!isSupabaseConfigured) {
      setMessage('XDrive Driver authentication is not configured for this build.');
      return;
    }
    setAuthBusy(true);
    setMessage('');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      const session = data.session;
      if (!session?.access_token || !session.user?.id || !(await validateDriverRole(session.user.id))) {
        await supabase.auth.signOut().catch(() => undefined);
        throw new Error('Access denied: this account is not an active XDrive driver account.');
      }
      const normalizedEmail = session.user.email ?? email.trim();
      setToken(session.access_token);
      setUserEmail(normalizedEmail);
      setRoute({ kind: 'primary', tab: 'overview' });
      setActiveTab('overview');
      await saveSessionToken(session.access_token).catch(() => undefined);
      void bootstrap(session.access_token, normalizedEmail);
      void refreshLiveLoads();
    } catch (error) {
      setMessage(cleanError(error, 'Unable to sign in.'));
    } finally {
      setAuthBusy(false);
    }
  }

  async function signOut() {
    await clearSessionToken().catch(() => undefined);
    await supabase.auth.signOut().catch(() => undefined);
    clearQueueSessionCache();
    setQueue([]);
    setToken(null);
    setResources(null);
    setLiveLoads([]);
    setActiveJobs([]);
    setUpcomingJobs([]);
    setCompletedJobs([]);
    setJobDetail(null);
    setMessage('');
    setLoadError('');
    setTrackingState('standby');
  }

  const navigatePrimary = useCallback((tab: PrimaryTab) => {
    setActiveTab(tab);
    setRoute({ kind: 'primary', tab });
    setJobDetail(null);
    setPodOpen(false);
    setMessage('');
  }, []);

  const openJob = useCallback((jobId: string) => {
    setRoute({ kind: 'job', jobId });
    setDetailTab('overview');
    setPodOpen(false);
    setMessage('');
    void refreshJobDetail(jobId);
  }, [refreshJobDetail]);

  const openDeepLinkTarget = useCallback(async (target: DriverDeepLinkTarget) => {
    if (target.kind === 'job') {
      openJob(target.id);
      return;
    }
    const load = liveLoads.find((item) => item.id === target.id);
    setActiveTab('loads');
    if (load) {
      setRoute({ kind: 'load', load });
      return;
    }
    setRoute({ kind: 'primary', tab: 'loads' });
    setMessage('Refreshing the Load Board for this notification.');
    await refreshLiveLoads();
  }, [liveLoads, openJob, refreshLiveLoads]);

  useEffect(() => {
    if (!token) return;
    const openUrl = (url: string | null | undefined) => {
      const target = parseDriverDeepLink(url);
      if (target) void openDeepLinkTarget(target);
    };
    const openNotification = (response: Notifications.NotificationResponse | null | undefined) => {
      const target = targetFromNotificationData(response?.notification.request.content.data);
      if (target) void openDeepLinkTarget(target);
    };

    if (!initialIntentHandledRef.current) {
      initialIntentHandledRef.current = true;
      void Linking.getInitialURL().then(openUrl).catch(() => undefined);
      void Notifications.getLastNotificationResponseAsync().then(openNotification).catch(() => undefined);
    }

    const linkSubscription = Linking.addEventListener('url', ({ url }) => openUrl(url));
    const notificationSubscription = Notifications.addNotificationResponseReceivedListener(openNotification);
    return () => {
      linkSubscription.remove();
      notificationSubscription.remove();
    };
  }, [openDeepLinkTarget, token]);

  const persistPreferences = useCallback((update: (current: MarketplacePreferences) => MarketplacePreferences) => {
    setPreferences((current) => {
      const next = update(current);
      void saveMarketplacePreferences(userEmail, next).catch(() => setMessage('Load Board preference could not be saved.'));
      return next;
    });
  }, [userEmail]);

  function toggleStar(jobId: string) {
    persistPreferences((current) => ({
      ...current,
      savedJobIds: current.savedJobIds.includes(jobId)
        ? current.savedJobIds.filter((id) => id !== jobId)
        : [...current.savedJobIds, jobId],
    }));
  }

  function dismissLoad(jobId: string) {
    persistPreferences((current) => ({
      ...current,
      hiddenJobIds: current.hiddenJobIds.includes(jobId) ? current.hiddenJobIds : [...current.hiddenJobIds, jobId],
    }));
  }

  function restoreLoad(jobId: string) {
    persistPreferences((current) => ({
      ...current,
      hiddenJobIds: current.hiddenJobIds.filter((id) => id !== jobId),
    }));
  }

  async function submitOffer(load: LiveLoad) {
    if (!editingOfferId && load.canQuote === false) {
      navigatePrimary('offers');
      setMessage(load.quoteWarning || 'An active offer already exists for this load.');
      return;
    }
    const amount = Number(offerAmount.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage('Enter a valid offer amount.');
      return;
    }
    setActionBusy(true);
    setMessage('');
    try {
      if (editingOfferId) {
        await updateJobQuote({ bidId: editingOfferId, amount, message: offerMessage });
      } else {
        await submitLiveLoadQuote(load.id, amount, offerMessage);
      }
      const wasEditing = Boolean(editingOfferId);
      setEditingOfferId(null);
      setOfferAmount('');
      setOfferMessage('');
      await Promise.all([refreshLiveLoads(), refreshResources()]);
      navigatePrimary('offers');
      setMessage(wasEditing ? 'Offer updated.' : 'Offer sent.');
    } catch (error) {
      setMessage(cleanError(error, 'This offer could not be sent.'));
    } finally {
      setActionBusy(false);
    }
  }

  async function retractOffer(quote: Record<string, any>) {
    setActionBusy(true);
    try {
      await withdrawJobQuote(String(quote.id));
      await Promise.all([refreshResources(), refreshLiveLoads()]);
      setMessage('Offer retracted.');
    } catch (error) {
      setMessage(cleanError(error, 'The offer could not be retracted.'));
    } finally {
      setActionBusy(false);
    }
  }

  async function lifecycleAction() {
    if (!token || !jobDetail || actionBusy) return;
    const nextStep = getNextStep(jobDetail.status);
    if (!nextStep) {
      if (jobDetail.status === 'delivered' || jobDetail.status === 'cancelled') return;
      setPodOpen(true);
      setDetailTab('progress');
      return;
    }

    const apply = async () => {
      setActionBusy(true);
      setMessage('');
      let payload: Record<string, unknown> = {};
      try {
        if (nextStep.status === 'loaded') {
          const permission = await ImagePicker.requestCameraPermissionsAsync();
          if (!permission.granted) throw new Error('Camera access is required to record collection evidence.');
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.78,
          });
          if (result.canceled || !result.assets[0]?.uri) return;
          payload = { collectionPhotoUri: await persistEvidencePhoto(result.assets[0].uri, jobDetail.id, 'pickup') };
        }

        if (!(await isOnline())) {
          const queued = await enqueueAction({ jobId: jobDetail.id, endpoint: nextStep.endpoint, payload });
          setQueue((current) => [queued, ...current]);
          setMessage(`${nextStep.label} saved for sync. XDrive will change the server status only after confirmation.`);
          return;
        }

        await postJobStatus(jobDetail.id, nextStep.endpoint, token, payload);
        await Promise.all([refreshJobDetail(jobDetail.id), refreshJobs()]);
      } catch (error) {
        setMessage(cleanError(error, 'The work status could not be updated.'));
      } finally {
        setActionBusy(false);
      }
    };

    if (nextStep.requiresConfirmation) {
      Alert.alert('Confirm work step', nextStep.label, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => void apply() },
      ]);
    } else {
      await apply();
    }
  }

  async function capturePodPhoto() {
    if (!jobDetail) return;
    if (podPhotoUris.length >= MAX_POD_PHOTOS) {
      setMessage(`Maximum ${MAX_POD_PHOTOS} delivery images reached.`);
      return;
    }
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setMessage('Camera access is required for delivery evidence.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      const stored = await persistEvidencePhoto(result.assets[0].uri, jobDetail.id, 'delivery');
      setPodPhotoUris((current) => [...current, stored].slice(0, MAX_POD_PHOTOS));
    }
  }


  async function selectPodPhotos() {
    if (!jobDetail) return;
    const remaining = MAX_POD_PHOTOS - podPhotoUris.length;
    if (remaining <= 0) {
      setMessage(`Maximum ${MAX_POD_PHOTOS} delivery images reached.`);
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setMessage('Photo-library access is required to attach delivery images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.8,
    });
    if (result.canceled) return;
    const selected = result.assets.slice(0, remaining);
    const stored = await Promise.all(selected.map((asset) => persistEvidencePhoto(asset.uri, jobDetail.id, 'delivery')));
    setPodPhotoUris((current) => [...current, ...stored].slice(0, MAX_POD_PHOTOS));
  }


  async function selectPodDocuments() {
    if (!jobDetail) return;
    const remaining = MAX_POD_DOCUMENTS - podDocumentUris.length;
    if (remaining <= 0) {
      setMessage(`Maximum ${MAX_POD_DOCUMENTS} delivery documents reached.`);
      return;
    }
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png'],
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const selected = result.assets.slice(0, remaining);
    const uris = await Promise.all(selected.map((asset) => persistEvidenceFile(asset.uri, jobDetail.id, 'document')));
    setPodDocumentUris((current) => [...current, ...uris].slice(0, MAX_POD_DOCUMENTS));
  }

  function removePodPhoto(index: number) {
    setPodPhotoUris((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function removePodDocument(index: number) {
    setPodDocumentUris((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function submitPod() {
    if (!token || !jobDetail || actionBusy) return;
    if (!podRecipient.trim()) {
      setMessage('Recipient name is required.');
      return;
    }
    if (!podSignature) {
      signatureRef.current?.readSignature?.();
      setMessage('Save the recipient signature before completing the work order.');
      return;
    }
    if (podPhotoUris.length === 0) {
      setMessage('At least one delivery photo is required.');
      return;
    }

    const payload = {
      recipientName: podRecipient.trim(),
      signatureData: podSignature,
      deliveryPhotoUris: podPhotoUris,
      damagePhotoUris: [],
      documentUris: podDocumentUris,
      notes: podNotes.trim() || undefined,
    };

    setActionBusy(true);
    setMessage('');
    try {
      if (!(await isOnline())) {
        const queued = await enqueueAction({ jobId: jobDetail.id, endpoint: 'pod', payload });
        setQueue((current) => [queued, ...current]);
        setMessage('Delivery evidence saved for sync. The work order remains open until server confirmation.');
        return;
      }
      await uploadPod(jobDetail.id, token, payload);
      await postJobStatus(jobDetail.id, 'delivered', token);
      setPodOpen(false);
      setPodRecipient('');
      setPodSignature('');
      setPodPhotoUris([]);
      setPodDocumentUris([]);
      setPodNotes('');
      await Promise.all([refreshJobDetail(jobDetail.id), refreshJobs(), refreshResources()]);
      setMessage('Delivery evidence confirmed. Work order completed.');
    } catch (error) {
      setMessage(cleanError(error, 'Delivery evidence could not be submitted.'));
    } finally {
      setActionBusy(false);
    }
  }

  if (!token) {
    return <LoginScreen onSignIn={signIn} busy={authBusy} message={message} />;
  }

  const fixedTop = renderFixedTop({
    route,
    activeTab,
    loadFeed,
    offerFeed,
    detailTab,
    resources,
    trackingState,
    onLoadFeed: setLoadFeed,
    onOfferFeed: setOfferFeed,
    onDetailTab: setDetailTab,
    onBack: () => navigatePrimary(activeTab),
  });

  const fixedAction = route.kind === 'job' && jobDetail && detailTab === 'progress'
    ? <WorkStepAction job={jobDetail} busy={actionBusy} podOpen={podOpen} onPress={() => void lifecycleAction()} />
    : null;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.secondary} />
      <View style={styles.shell}>
        {fixedTop}
        <ScrollView
          style={styles.bodyViewport}
          contentContainerStyle={[styles.bodyContent, fixedAction ? styles.bodyWithAction : null]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={route.kind === 'primary' && route.tab === 'loads'
            ? <RefreshControl refreshing={loadBusy} onRefresh={() => void refreshLiveLoads()} colors={[colors.primary]} tintColor={colors.primary} />
            : undefined}
        >
          {message ? <Banner text={message} onDismiss={() => setMessage('')} /> : null}

          {route.kind === 'primary' && route.tab === 'overview' ? (
            <OverviewBody
              resources={resources}
              liveCount={liveLoads.length}
              currentJobs={currentJobs}
              activeOffers={(resources?.quotes ?? []).filter((quote) => offerBucket(quote) === 'active').length}
              loading={resourcesBusy || jobsBusy}
              onLoads={() => navigatePrimary('loads')}
              onHistory={() => navigatePrimary('history')}
              onOffers={() => navigatePrimary('offers')}
              onAvailability={() => setRoute({ kind: 'utility', page: 'availability' })}
              onOpenJob={openJob}
            />
          ) : null}

          {route.kind === 'primary' && route.tab === 'loads' ? (
            <LoadBoard
              loads={liveLoads}
              feed={loadFeed}
              preferences={preferences}
              loading={loadBusy}
              error={loadError}
              onRefresh={() => void refreshLiveLoads()}
              onOpen={(load) => setRoute({ kind: 'load', load })}
              onOffer={(load) => {
                setEditingOfferId(null);
                setOfferAmount('');
                setOfferMessage('');
                setRoute({ kind: 'offer', load });
              }}
              onStar={toggleStar}
              onDismiss={dismissLoad}
              onRestore={restoreLoad}
            />
          ) : null}

          {route.kind === 'primary' && route.tab === 'offers' ? (
            <OffersBody
              quotes={resources?.quotes ?? []}
              feed={offerFeed}
              busy={resourcesBusy || actionBusy}
              onRetract={(quote) => Alert.alert('Retract offer?', 'This removes your current offer from the load.', [
                { text: 'Keep offer', style: 'cancel' },
                { text: 'Retract', style: 'destructive', onPress: () => void retractOffer(quote) },
              ])}
              onOpenJob={(quote) => quote.job?.id ? openJob(String(quote.job.id)) : setMessage('The linked work order is not available.')}
              onEdit={(quote) => {
                if (!quote.job?.id) return;
                const load = liveLoads.find((item) => item.id === String(quote.job.id));
                if (!load) {
                  setMessage('This offer is visible, but the load is no longer open for editing.');
                  return;
                }
                setEditingOfferId(String(quote.id));
                setOfferAmount(String(quote.bid_price_gbp ?? quote.amount ?? ''));
                setOfferMessage(String(quote.message ?? ''));
                setRoute({ kind: 'offer', load });
              }}
            />
          ) : null}

          {route.kind === 'primary' && route.tab === 'history' ? (
            <HistoryBody jobs={fullHistory} loading={jobsBusy} onOpen={openJob} />
          ) : null}

          {route.kind === 'primary' && route.tab === 'account' ? (
            <AccountBody
              resources={resources}
              queueCount={queue.length}
              onOpen={(page) => setRoute({ kind: 'utility', page })}
              onSignOut={() => void signOut()}
            />
          ) : null}

          {route.kind === 'load' ? (
            <LoadDetail
              load={route.load}
              starred={preferences.savedJobIds.includes(route.load.id)}
              onStar={() => toggleStar(route.load.id)}
              onOffer={() => {
                setEditingOfferId(null);
                setOfferAmount('');
                setOfferMessage('');
                setRoute({ kind: 'offer', load: route.load });
              }}
            />
          ) : null}

          {route.kind === 'offer' ? (
            <OfferForm
              load={route.load}
              amount={offerAmount}
              note={offerMessage}
              busy={actionBusy}
              editing={Boolean(editingOfferId)}
              onAmount={setOfferAmount}
              onNote={setOfferMessage}
              onSubmit={() => void submitOffer(route.load)}
            />
          ) : null}

          {route.kind === 'job' ? (
            jobDetailBusy && !jobDetail
              ? <LoadingCard text="Loading work order..." />
              : jobDetail
                ? <WorkOrder
                    job={jobDetail}
                    tab={detailTab}
                    podOpen={podOpen}
                    recipient={podRecipient}
                    signature={podSignature}
                    photoUris={podPhotoUris}
                    documentUris={podDocumentUris}
                    notes={podNotes}
                    signatureRef={signatureRef}
                    onRecipient={setPodRecipient}
                    onSignature={setPodSignature}
                    onTakePhoto={() => void capturePodPhoto()}
                    onChoosePhotos={() => void selectPodPhotos()}
                    onAddDocuments={() => void selectPodDocuments()}
                    onRemovePhoto={removePodPhoto}
                    onRemoveDocument={removePodDocument}
                    onNotes={setPodNotes}
                    onSubmitPod={() => void submitPod()}
                    onCall={() => { const phone = jobDetail.postingCompanyPhone || jobDetail.contactPhone; return phone ? void Linking.openURL(`tel:${phone}`) : undefined; }}
                    onMap={() => void openExternalRoute(jobDetail)}
                    busy={actionBusy}
                  />
                : <EmptyState title="Work order unavailable" body="Refresh History and try again." />
          ) : null}

          {route.kind === 'utility' ? (
            <UtilityBody
              page={route.page}
              resources={resources}
              queue={queue}
              busy={actionBusy}
              onAvailability={async (status) => {
                setActionBusy(true);
                try {
                  await updateDriverAvailability(status);
                  await refreshResources();
                  setMessage(`Work state changed to ${status}.`);
                } catch (error) {
                  setMessage(cleanError(error, 'Work state could not be changed.'));
                } finally {
                  setActionBusy(false);
                }
              }}
              onFlush={() => void flushOfflineQueue()}
            />
          ) : null}
        </ScrollView>
        {fixedAction}
        <BottomDock active={activeTab} loadCount={liveLoads.length} onChange={navigatePrimary} />
      </View>
    </SafeAreaView>
  );
}

function renderFixedTop(input: {
  route: AppRoute;
  activeTab: PrimaryTab;
  loadFeed: LoadFeed;
  offerFeed: OfferFeed;
  detailTab: JobDetailTab;
  resources: DriverProfileResource | null;
  trackingState: DriverTrackingState;
  onLoadFeed: (feed: LoadFeed) => void;
  onOfferFeed: (feed: OfferFeed) => void;
  onDetailTab: (tab: JobDetailTab) => void;
  onBack: () => void;
}) {
  const { route } = input;
  if (route.kind === 'primary' && route.tab === 'overview') {
    return <OverviewHeader resources={input.resources} trackingState={input.trackingState} />;
  }
  if (route.kind === 'primary' && route.tab === 'loads') {
    return <View style={styles.topChrome}><ScreenTitle title="Load Board" kicker="AVAILABLE WORK" /><Tabs<LoadFeed> items={[['available', 'Available'], ['starred', 'Starred'], ['dismissed', 'Dismissed']]} value={input.loadFeed} onChange={input.onLoadFeed} /></View>;
  }
  if (route.kind === 'primary' && route.tab === 'offers') {
    return <View style={styles.topChrome}><ScreenTitle title="Offers" kicker="MY COMMERCIAL OFFERS" /><Tabs<OfferFeed> items={[['active', 'Active'], ['won', 'Won'], ['archived', 'Archived']]} value={input.offerFeed} onChange={input.onOfferFeed} /></View>;
  }
  if (route.kind === 'primary' && route.tab === 'history') {
    return <View style={styles.topChrome}><ScreenTitle title="History" kicker="COMPLETE WORK LOG" /></View>;
  }
  if (route.kind === 'primary' && route.tab === 'account') {
    return <View style={styles.topChrome}><ScreenTitle title="Account" kicker="DRIVER SETTINGS" /></View>;
  }
  if (route.kind === 'job') {
    return <View style={styles.topChrome}><BackTitle title="Work Order" onBack={input.onBack} /><Tabs<JobDetailTab> items={[['overview', 'Overview'], ['route', 'Route'], ['progress', 'Progress']]} value={input.detailTab} onChange={input.onDetailTab} /></View>;
  }
  const title = route.kind === 'load'
    ? route.load.reference
    : route.kind === 'offer'
      ? 'Make Offer'
      : route.kind === 'utility'
        ? utilityTitle(route.page)
        : 'XDrive Driver';
  return <View style={styles.topChrome}><BackTitle title={title} onBack={input.onBack} /></View>;
}

function LoginScreen({ onSignIn, busy, message }: {
  onSignIn: (email: string, password: string) => void;
  busy: boolean;
  message: string;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  return (
    <SafeAreaView style={styles.loginSafe}>
      <StatusBar barStyle="light-content" backgroundColor="#0B2F6B" />
      <ScrollView contentContainerStyle={styles.loginPage} keyboardShouldPersistTaps="handled">
        <ImageBackground source={require('../../assets/login-hero-v2.png')} style={styles.loginHero} imageStyle={styles.loginHeroImage}>
          <View style={styles.loginShade} />
          <View style={styles.brandPill}><Text style={styles.brandX}>X</Text><Text style={styles.brandDrive}>DRIVE</Text><View style={styles.brandDivider} /><Text style={styles.brandMeta}>DRIVER</Text></View>
          <View style={styles.loginCopy}>
            <Text style={styles.loginEyebrow}>BUILT FOR THE ROAD</Text>
            <Text style={styles.loginHeroTitle}>Move with confidence.</Text>
            <Text style={styles.loginHeroBody}>Live work, clear proof and every operational step in one XDrive workspace.</Text>
            <View style={styles.networkPill}><View style={styles.networkDot} /><Text style={styles.networkText}>XDrive verified driver access</Text></View>
          </View>
        </ImageBackground>
        <View style={styles.loginCard}>
          <Text style={styles.loginTitle}>Welcome back</Text>
          <Text style={styles.loginSubtitle}>Sign in to your XDrive driver account</Text>
          {message ? <Banner text={message} /> : null}
          <Text style={styles.fieldLabel}>EMAIL</Text>
          <TextInput style={styles.loginInput} autoCapitalize="none" keyboardType="email-address" placeholder="driver@email.com" placeholderTextColor="#8290A7" value={email} onChangeText={setEmail} />
          <Text style={styles.fieldLabel}>PASSWORD</Text>
          <View style={styles.passwordRow}>
            <TextInput style={styles.passwordInput} secureTextEntry={!show} placeholder="Enter your password" placeholderTextColor="#8290A7" value={password} onChangeText={setPassword} />
            <TouchableOpacity style={styles.showButton} onPress={() => setShow((value) => !value)}><Text style={styles.showText}>{show ? 'HIDE' : 'SHOW'}</Text></TouchableOpacity>
          </View>
          <TouchableOpacity style={[styles.primaryButton, (!email || !password || busy) && styles.disabledButton]} disabled={!email || !password || busy} onPress={() => onSignIn(email, password)}>
            <Text style={styles.primaryButtonText}>{busy ? 'Signing in...' : 'Open driver workspace'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function trackingLabel(state: DriverTrackingState) {
  if (state === 'active') return 'Location live';
  if (state === 'starting') return 'Starting link';
  if (state === 'permission-required') return 'Permission needed';
  if (state === 'unavailable') return 'Location unavailable';
  return 'Standby';
}

function OverviewHeader({ resources, trackingState }: {
  resources: DriverProfileResource | null;
  trackingState: DriverTrackingState;
}) {
  const name = resources?.name || resources?.driver?.display_name || 'XDrive Driver';
  const vehicle = resources?.vehicle?.reg_plate || resources?.vehicle?.type || resources?.vehicle?.vehicle_type || 'Vehicle not assigned';
  const availability = String(resources?.driver?.availability_status ?? 'available').replace('_', ' ');
  const shiftLabel = availability === 'available' ? 'Ready for work' : availability === 'busy' ? 'Busy' : 'Off duty';
  return (
    <View style={styles.overviewHeader}>
      <View style={styles.commandBrandRow}>
        <View style={styles.commandBrandLockup}>
          <Text style={styles.commandBrand}>XDRIVE</Text>
          <Text style={styles.commandSlash}>/</Text>
          <Text style={styles.commandMode}>ROAD OPS</Text>
        </View>
        <View style={styles.commandPulse}><View style={styles.commandPulseDot} /><Text style={styles.commandPulseText}>DRIVER</Text></View>
      </View>
      <View style={styles.commandIdentityRow}>
        <View style={styles.flexOne}>
          <Text style={styles.commandEyebrow}>SIGNED-IN DRIVER</Text>
          <Text style={styles.driverName}>{name}</Text>
          <Text style={styles.driverVehicle}>{vehicle}</Text>
        </View>
        <View style={styles.commandMonogram}><Text style={styles.commandMonogramText}>{initials(name)}</Text></View>
      </View>
      <View style={styles.commandStatusStrip}>
        <View style={styles.commandStatusItem}><Text style={styles.commandStatusLabel}>SHIFT</Text><Text style={styles.commandStatusValue}>{shiftLabel}</Text></View>
        <View style={styles.commandStatusRule} />
        <View style={styles.commandStatusItem}><Text style={styles.commandStatusLabel}>GPS LINK</Text><Text style={trackingState === 'active' ? styles.commandStatusValueLive : styles.commandStatusValue}>{trackingLabel(trackingState)}</Text></View>
      </View>
    </View>
  );
}

function OverviewBody({ resources, liveCount, currentJobs, activeOffers, loading, onLoads, onHistory, onOffers, onAvailability, onOpenJob }: {
  resources: DriverProfileResource | null;
  liveCount: number;
  currentJobs: DriverJob[];
  activeOffers: number;
  loading: boolean;
  onLoads: () => void;
  onHistory: () => void;
  onOffers: () => void;
  onAvailability: () => void;
  onOpenJob: (id: string) => void;
}) {
  const activeJob = currentJobs[0];
  return <View style={styles.stack}>
    <View style={styles.dispatchPanel}>
      <View style={styles.dispatchHeader}>
        <View><Text style={styles.sectionKicker}>DISPATCH NOW</Text><Text style={styles.dispatchTitle}>Operational desk</Text></View>
        <Text style={styles.dispatchCount}>{currentJobs.length}</Text>
      </View>
      {activeJob ? (
        <TouchableOpacity style={styles.activeRunCard} onPress={() => onOpenJob(activeJob.id)} activeOpacity={0.9}>
          <View style={styles.activeRunTop}>
            <View style={styles.flexOne}><Text style={styles.activeRunLabel}>ACTIVE WORK ORDER</Text><Text style={styles.activeRunReference}>{activeJob.reference}</Text></View>
            <StatusTag label={progressLabels[activeJob.status].toUpperCase()} tone={activeJob.status === 'delivered' ? 'green' : 'blue'} />
          </View>
          <CompactRoute job={activeJob} />
          <View style={styles.activeRunFooter}><Text style={styles.activeRunHint}>Open route, instructions, progress and POD</Text><Text style={styles.activeRunArrow}>→</Text></View>
        </TouchableOpacity>
      ) : (
        <View style={styles.dispatchEmpty}><Text style={styles.dispatchEmptyTitle}>No work order in progress</Text><Text style={styles.dispatchEmptyBody}>When a job is allocated, the full operational record will appear here.</Text></View>
      )}
    </View>

    <TouchableOpacity style={styles.marketAccessCard} onPress={onLoads} activeOpacity={0.9}>
      <View style={styles.marketAccessIcon}><Text style={styles.marketAccessIconText}>↗</Text></View>
      <View style={styles.flexOne}><Text style={styles.marketAccessKicker}>MARKET ACCESS</Text><Text style={styles.marketAccessTitle}>Open Live Load Board</Text><Text style={styles.marketAccessBody}>Eligible work, route summary and commercial offer controls.</Text></View>
      <View style={styles.marketAccessCount}><Text style={styles.marketAccessCountValue}>{liveCount}</Text><Text style={styles.marketAccessCountLabel}>LIVE</Text></View>
    </TouchableOpacity>

    <View style={styles.commandLedger}>
      <TouchableOpacity style={styles.ledgerCell} onPress={onOffers}>
        <Text style={styles.ledgerLabel}>OPEN OFFERS</Text><Text style={styles.ledgerValue}>{activeOffers}</Text><Text style={styles.ledgerHint}>Commercial decisions pending</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.ledgerCell} onPress={onHistory}>
        <Text style={styles.ledgerLabel}>WORK LOG</Text><Text style={styles.ledgerValue}>{currentJobs.length}</Text><Text style={styles.ledgerHint}>Open complete History</Text>
      </TouchableOpacity>
    </View>

    <TouchableOpacity style={styles.shiftControl} onPress={onAvailability}>
      <View><Text style={styles.shiftControlLabel}>DRIVER AVAILABILITY</Text><Text style={styles.shiftControlTitle}>Change work state</Text></View><Text style={styles.shiftControlArrow}>→</Text>
    </TouchableOpacity>

    {loading ? <LoadingCard text="Updating XDrive operational data..." /> : null}
    {resources?.company?.name ? <Text style={styles.accountHint}>Operating account · {String(resources.company.name)}</Text> : null}
  </View>;
}

function LoadBoard({ loads, feed, preferences, loading, error, onRefresh, onOpen, onOffer, onStar, onDismiss, onRestore }: {
  loads: LiveLoad[];
  feed: LoadFeed;
  preferences: MarketplacePreferences;
  loading: boolean;
  error: string;
  onRefresh: () => void;
  onOpen: (load: LiveLoad) => void;
  onOffer: (load: LiveLoad) => void;
  onStar: (id: string) => void;
  onDismiss: (id: string) => void;
  onRestore: (id: string) => void;
}) {
  const visible = loads.filter((load) => !preferences.hiddenJobIds.includes(load.id));
  const displayed = feed === 'starred'
    ? visible.filter((load) => preferences.savedJobIds.includes(load.id))
    : feed === 'dismissed'
      ? loads.filter((load) => preferences.hiddenJobIds.includes(load.id))
      : visible;

  if (loading && loads.length === 0) return <LoadingCard text="Refreshing Load Board..." />;
  if (displayed.length === 0) {
    return <View style={styles.stack}>
      {error ? <Banner text={error} /> : null}
      <EmptyState
        title={feed === 'available' ? 'No available loads' : feed === 'starred' ? 'Nothing starred' : 'No dismissed loads'}
        body={feed === 'available' ? 'Pull down or use refresh to check the XDrive marketplace again.' : 'Use Load Board actions to organise work.'}
      />
      {feed === 'available' ? <TouchableOpacity style={styles.secondaryAction} onPress={onRefresh}><Text style={styles.secondaryActionText}>Refresh Load Board</Text></TouchableOpacity> : null}
    </View>;
  }

  return <View style={styles.stack}>{displayed.map((load) => (
    <LoadCard
      key={load.id}
      load={load}
      starred={preferences.savedJobIds.includes(load.id)}
      dismissed={feed === 'dismissed'}
      onOpen={() => onOpen(load)}
      onOffer={() => onOffer(load)}
      onStar={() => onStar(load.id)}
      onDismiss={() => onDismiss(load.id)}
      onRestore={() => onRestore(load.id)}
    />
  ))}</View>;
}

function LoadCard({ load, starred, dismissed, onOpen, onOffer, onStar, onDismiss, onRestore }: {
  load: LiveLoad;
  starred: boolean;
  dismissed: boolean;
  onOpen: () => void;
  onOffer: () => void;
  onStar: () => void;
  onDismiss: () => void;
  onRestore: () => void;
}) {
  return <View style={styles.loadCard}>
    <TouchableOpacity onPress={onOpen} activeOpacity={0.85}>
      <View style={styles.loadHeader}>
        <View style={styles.flexOne}>
          <Text style={styles.companyName}>{load.postingCompanyName || 'Verified XDrive member'}</Text>
          <Text style={styles.referenceText}>{load.reference} · {load.vehicleRequirement}</Text>
        </View>
        <StatusTag label={load.canQuote === false ? 'OFFER SENT' : 'OPEN'} tone={load.canQuote === false ? 'muted' : 'blue'} />
      </View>
      <RouteBand pickup={load.pickupLocation} pickupTime={load.pickupTime} delivery={load.deliveryLocation} deliveryTime={load.deliveryTime} />
      <View style={styles.loadFacts}>
        <Fact label="FREIGHT" value={load.cargoType} />
        {load.price ? <Fact label="PUBLISHED RATE" value={load.price} align="right" /> : null}
      </View>
      {load.destinationPriority ? <Text style={styles.returnIq}>Return IQ match{load.distanceFromCurrentDeliveryMiles != null ? ` · ${load.distanceFromCurrentDeliveryMiles.toFixed(1)} mi from delivery` : ''}</Text> : null}
      {load.canQuote === false && load.quoteWarning ? <Text style={styles.inlineWarning}>{load.quoteWarning}</Text> : null}
    </TouchableOpacity>
    <View style={styles.actionRow}>
      {dismissed
        ? <TouchableOpacity style={styles.textAction} onPress={onRestore}><Text style={styles.textActionText}>Restore</Text></TouchableOpacity>
        : <>
            <TouchableOpacity style={styles.textAction} onPress={onStar}><Text style={styles.textActionText}>{starred ? 'Starred ★' : 'Star'}</Text></TouchableOpacity>
            <TouchableOpacity style={styles.textAction} onPress={onDismiss}><Text style={styles.textActionText}>Dismiss</Text></TouchableOpacity>
          </>}
      {!dismissed ? <TouchableOpacity style={[styles.offerButton, load.canQuote === false && styles.disabledButton]} disabled={load.canQuote === false} onPress={onOffer}><Text style={styles.offerButtonText}>{load.canQuote === false ? 'Offer sent' : 'Make offer'}</Text></TouchableOpacity> : null}
    </View>
  </View>;
}

function LoadDetail({ load, starred, onStar, onOffer }: {
  load: LiveLoad;
  starred: boolean;
  onStar: () => void;
  onOffer: () => void;
}) {
  return <View style={styles.stack}>
    <View style={styles.section}>
      <Text style={styles.sectionKicker}>LOAD OWNER</Text>
      <Text style={styles.companyName}>{load.postingCompanyName || 'Verified XDrive member'}</Text>
      <Text style={styles.referenceText}>{load.postingCompanyMemberCode || load.reference}</Text>
      <RouteBand pickup={load.pickupLocation} pickupTime={load.pickupTime} delivery={load.deliveryLocation} deliveryTime={load.deliveryTime} />
      <InfoLine label="Vehicle" value={load.vehicleRequirement} />
      <InfoLine label="Freight" value={load.cargoType} />
      {load.price ? <InfoLine label="Published rate" value={load.price} /> : null}
    </View>
    <Banner text="Street-level addresses and private contacts remain protected until allocation." />
    {load.canQuote === false && load.quoteWarning ? <Banner text={load.quoteWarning} /> : null}
    <View style={styles.twoActions}>
      <TouchableOpacity style={styles.secondaryAction} onPress={onStar}><Text style={styles.secondaryActionText}>{starred ? 'Starred ★' : 'Star this load'}</Text></TouchableOpacity>
      <TouchableOpacity style={[styles.primaryCompact, load.canQuote === false && styles.disabledButton]} disabled={load.canQuote === false} onPress={onOffer}><Text style={styles.primaryCompactText}>{load.canQuote === false ? 'Offer already sent' : 'Make offer'}</Text></TouchableOpacity>
    </View>
  </View>;
}

function OfferForm({ load, amount, note, busy, editing, onAmount, onNote, onSubmit }: {
  load: LiveLoad;
  amount: string;
  note: string;
  busy: boolean;
  editing: boolean;
  onAmount: (value: string) => void;
  onNote: (value: string) => void;
  onSubmit: () => void;
}) {
  const blocked = !editing && load.canQuote === false;
  return <View style={styles.stack}>
    <View style={styles.section}>
      <Text style={styles.sectionKicker}>ROUTE</Text>
      <RouteBand pickup={load.pickupLocation} pickupTime={load.pickupTime} delivery={load.deliveryLocation} deliveryTime={load.deliveryTime} />
      <InfoLine label="Vehicle" value={load.vehicleRequirement} />
      <InfoLine label="Freight" value={load.cargoType} />
    </View>
    {blocked ? <Banner text={load.quoteWarning || 'An active offer already exists for this load.'} /> : null}
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{editing ? 'Edit commercial offer' : 'Commercial offer'}</Text>
      <Text style={styles.fieldLabel}>RATE BEFORE VAT · GBP</Text>
      <TextInput style={styles.bigInput} keyboardType="decimal-pad" placeholder="£0.00" placeholderTextColor="#98A2B3" value={amount} onChangeText={onAmount} editable={!blocked} />
      <Text style={styles.fieldLabel}>DRIVER NOTE</Text>
      <TextInput style={[styles.bigInput, styles.textarea]} multiline placeholder="Optional collection or availability note" placeholderTextColor="#98A2B3" value={note} onChangeText={onNote} editable={!blocked} />
    </View>
    <TouchableOpacity style={[styles.primaryButton, (busy || blocked) && styles.disabledButton]} disabled={busy || blocked} onPress={onSubmit}><Text style={styles.primaryButtonText}>{blocked ? 'Offer already sent' : busy ? 'Sending...' : editing ? 'Save changes' : 'Send offer'}</Text></TouchableOpacity>
  </View>;
}

function OffersBody({ quotes, feed, busy, onRetract, onOpenJob, onEdit }: {
  quotes: Array<Record<string, any>>;
  feed: OfferFeed;
  busy: boolean;
  onRetract: (quote: Record<string, any>) => void;
  onOpenJob: (quote: Record<string, any>) => void;
  onEdit: (quote: Record<string, any>) => void;
}) {
  const filtered = quotes.filter((quote) => offerBucket(quote) === feed);
  if (busy && quotes.length === 0) return <LoadingCard text="Loading offers..." />;
  if (filtered.length === 0) return <EmptyState title={`No ${feed} offers`} body="Offers move here as their commercial outcome changes." />;

  return <View style={styles.stack}>{filtered.map((quote) => {
    const job = quote.job ? mapResourceJob(quote.job, false, false) : null;
    const amount = formatMoney(quote.bid_price_gbp ?? quote.amount, quote.currency || 'GBP') || 'Rate not supplied';
    const bucket = offerBucket(quote);
    return <View key={String(quote.id)} style={styles.offerCard}>
      <View style={styles.loadHeader}>
        <View style={styles.flexOne}><Text style={styles.companyName}>{job?.postingCompanyName || 'XDrive marketplace'}</Text><Text style={styles.referenceText}>{job?.reference || String(quote.job_id ?? '')}</Text></View>
        <StatusTag label={bucket === 'active' ? 'ACTIVE' : bucket === 'won' ? 'WON' : 'ARCHIVED'} tone={bucket === 'won' ? 'green' : bucket === 'active' ? 'blue' : 'muted'} />
      </View>
      {job ? <CompactRoute job={job} /> : null}
      <View style={styles.ratePanel}><Text style={styles.sectionKicker}>YOUR RATE</Text><Text style={styles.rateValue}>{amount}</Text></View>
      <View style={styles.actionRow}>
        {bucket === 'active' ? <><TouchableOpacity style={styles.textAction} onPress={() => onEdit(quote)}><Text style={styles.textActionText}>Edit</Text></TouchableOpacity><TouchableOpacity style={styles.textAction} onPress={() => onRetract(quote)}><Text style={styles.textActionText}>Retract</Text></TouchableOpacity></> : null}
        {bucket === 'won' ? <TouchableOpacity style={styles.primaryCompact} onPress={() => onOpenJob(quote)}><Text style={styles.primaryCompactText}>Open work order</Text></TouchableOpacity> : null}
      </View>
    </View>;
  })}</View>;
}

function HistoryBody({ jobs, loading, onOpen }: { jobs: DriverJob[]; loading: boolean; onOpen: (id: string) => void }) {
  if (loading && jobs.length === 0) return <LoadingCard text="Loading complete work log..." />;
  if (jobs.length === 0) return <EmptyState title="History is empty" body="Your full XDrive work record will build here without date-range buckets." />;
  return <View style={styles.stack}>
    <View style={styles.historyIntro}><Text style={styles.historyCount}>{jobs.length}</Text><View><Text style={styles.historyIntroTitle}>Work records</Text><Text style={styles.historyIntroBody}>All current and completed driver work in one chronological log.</Text></View></View>
    {jobs.map((job) => <HistoryCard key={job.id} job={job} onPress={() => onOpen(job.id)} />)}
  </View>;
}

function HistoryCard({ job, onPress }: { job: DriverJob; onPress: () => void }) {
  return <TouchableOpacity style={styles.historyCard} onPress={onPress} activeOpacity={0.9}>
    <View style={styles.historyTop}>
      <View style={styles.flexOne}><Text style={styles.referenceStrong}>{job.reference}</Text><Text style={styles.referenceText}>{job.postingCompanyName || 'XDrive work order'}</Text></View>
      <StatusTag
        label={progressLabels[job.status].toUpperCase()}
        tone={job.status === 'delivered' ? 'green' : job.status === 'cancelled' ? 'muted' : 'blue'}
      />
    </View>
    <CompactRoute job={job} />
    <View style={styles.historyBottom}><Text style={styles.historyDate}>{formatDate(job.updatedAt || job.deliveryTime || job.pickupTime)}</Text>{job.price ? <Text style={styles.historyRate}>{job.price}</Text> : null}</View>
  </TouchableOpacity>;
}

function WorkOrder({ job, tab, podOpen, recipient, signature, photoUris, documentUris, notes, signatureRef, onRecipient, onSignature, onTakePhoto, onChoosePhotos, onAddDocuments, onRemovePhoto, onRemoveDocument, onNotes, onSubmitPod, onCall, onMap, busy }: {
  job: JobDetail;
  tab: JobDetailTab;
  podOpen: boolean;
  recipient: string;
  signature: string;
  photoUris: string[];
  documentUris: string[];
  notes: string;
  signatureRef: MutableRefObject<any>;
  onRecipient: (value: string) => void;
  onSignature: (value: string) => void;
  onTakePhoto: () => void;
  onChoosePhotos: () => void;
  onAddDocuments: () => void;
  onRemovePhoto: (index: number) => void;
  onRemoveDocument: (index: number) => void;
  onNotes: (value: string) => void;
  onSubmitPod: () => void;
  onCall: () => void;
  onMap: () => void;
  busy: boolean;
}) {
  if (tab === 'overview') return <WorkOverview job={job} onCall={onCall} onMap={onMap} />;
  if (tab === 'route') return <WorkRoute job={job} />;
  return <View style={styles.stack}>
    <ProgressBoard job={job} />
    {podOpen ? <PodPanel job={job} recipient={recipient} signature={signature} photoUris={photoUris} documentUris={documentUris} notes={notes} signatureRef={signatureRef} onRecipient={onRecipient} onSignature={onSignature} onTakePhoto={onTakePhoto} onChoosePhotos={onChoosePhotos} onAddDocuments={onAddDocuments} onRemovePhoto={onRemovePhoto} onRemoveDocument={onRemoveDocument} onNotes={onNotes} onSubmit={onSubmitPod} busy={busy} /> : null}
  </View>;
}

function WorkOverview({ job, onCall, onMap }: { job: JobDetail; onCall: () => void; onMap: () => void }) {
  const commercial = objectValue(job.commercial);
  const cargo = objectValue(job.cargo);
  const vehicle = objectValue(job.allocatedVehicle);
  const notes = objectValue(job.notes);
  const pod = objectValue(job.pod);
  const agreedRate = commercial.agreedRate !== null && commercial.agreedRate !== undefined
    ? formatMoney(commercial.agreedRate, textValue(commercial.currency) || 'GBP')
    : job.price;
  const paymentTerms = textValue(commercial.paymentTerms)
    || (commercial.paymentDueDays ? `${commercial.paymentDueDays} days` : 'Not supplied');
  const allocatedLabel = [textValue(vehicle.registration), textValue(vehicle.make), textValue(vehicle.model), textValue(vehicle.type)]
    .filter(Boolean).join(' · ');
  const dimensions = [numberText(cargo.lengthCm), numberText(cargo.widthCm), numberText(cargo.heightCm)].filter(Boolean).join(' × ');
  const palletSummary = [numberText(cargo.pallets), textValue(cargo.palletType), cargo.stackable === true ? 'stackable' : cargo.stackable === false ? 'not stackable' : '']
    .filter(Boolean).join(' · ');
  const instructionRows = [
    ['Execution', textValue(notes.executionInstructions)],
    ['Collection', textValue(notes.collectionNotes)],
    ['Delivery', textValue(notes.deliveryNotes)],
    ['Driver note', textValue(notes.driverNotes)],
  ].filter((entry) => entry[1]);

  return <View style={styles.stack}>
    <View style={styles.section}>
      <Text style={styles.sectionKicker}>FULL WORK ORDER</Text>
      <Text style={styles.companyName}>{job.postingCompanyName || 'XDrive customer'}</Text>
      {job.postingCompanyMemberCode ? <Text style={styles.referenceText}>Member {job.postingCompanyMemberCode}</Text> : null}
      <Text style={styles.referenceStrong}>{job.reference}</Text>
      {job.customerName ? <InfoLine label="End customer" value={job.customerName} /> : null}
      <CompactRoute job={job} />
      <TouchableOpacity style={styles.primaryCompact} onPress={onMap}><Text style={styles.primaryCompactText}>Open full driving route</Text></TouchableOpacity>
      <View style={styles.twoActions}>
        <TouchableOpacity style={styles.secondaryAction} onPress={onCall}><Text style={styles.secondaryActionText}>Call job contact</Text></TouchableOpacity>
        <TouchableOpacity style={styles.secondaryAction} onPress={() => Alert.alert('XDrive Messages', 'Secure job messaging will appear here only after its production contract is enabled.')}><Text style={styles.secondaryActionText}>Messages</Text></TouchableOpacity>
      </View>
    </View>

    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Commercial & references</Text>
      <InfoLine label="Agreed rate" value={agreedRate || 'Not supplied'} />
      <InfoLine label="Payment terms" value={paymentTerms} />
      {commercial.bookedAt ? <InfoLine label="Awarded" value={formatDate(textValue(commercial.bookedAt))} /> : null}
      {job.customerReference ? <InfoLine label="Customer ref" value={job.customerReference} /> : null}
      {job.purchaseOrderNumber ? <InfoLine label="PO number" value={job.purchaseOrderNumber} /> : null}
      {job.bookingReference ? <InfoLine label="Booking ref" value={job.bookingReference} /> : null}
    </View>

    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Vehicle & load</Text>
      <InfoLine label="Requested vehicle" value={job.requestedVehicle || job.vehicleRequirement || 'Not supplied'} />
      <InfoLine label="Allocated vehicle" value={allocatedLabel || 'Not supplied'} />
      {vehicle.payloadKg ? <InfoLine label="Vehicle payload" value={`${vehicle.payloadKg} kg`} /> : null}
      <InfoLine label="Cargo" value={textValue(cargo.type) || job.cargoType || 'Not supplied'} />
      {cargo.weightKg ? <InfoLine label="Weight" value={`${cargo.weightKg} kg`} /> : null}
      {palletSummary ? <InfoLine label="Pallets" value={palletSummary} /> : null}
      {dimensions ? <InfoLine label="Dimensions" value={`${dimensions} cm`} /> : null}
      {cargo.cargoValueGbp ? <InfoLine label="Cargo value" value={formatMoney(cargo.cargoValueGbp, 'GBP')} /> : null}
      {job.distanceMiles ? <InfoLine label="Route distance" value={`${job.distanceMiles} mi${job.etaMinutes ? ` · approx. ${job.etaMinutes} min` : ''}`} /> : null}
    </View>

    {(job.requirements ?? []).length > 0 ? <View style={styles.section}>
      <Text style={styles.sectionTitle}>Requirements</Text>
      {(job.requirements ?? []).map((item, index) => <Text key={`${item}-${index}`} style={styles.bulletText}>• {item}</Text>)}
    </View> : null}

    {instructionRows.length > 0 || job.specialInstructions ? <View style={styles.section}>
      <Text style={styles.sectionTitle}>Driver instructions</Text>
      {instructionRows.map(([label, value]) => <View key={label} style={styles.instructionBlock}><Text style={styles.fieldLabel}>{label.toUpperCase()}</Text><Text style={styles.longText}>{value}</Text></View>)}
      {instructionRows.length === 0 && job.specialInstructions ? <Text style={styles.longText}>{job.specialInstructions}</Text> : null}
    </View> : null}

    {(job.documentChecklist ?? []).length > 0 ? <View style={styles.section}>
      <Text style={styles.sectionTitle}>Required paperwork</Text>
      {(job.documentChecklist ?? []).map((item, index) => <Text key={`${item}-${index}`} style={styles.bulletText}>□ {item}</Text>)}
    </View> : null}

    {(job.documents ?? job.attachments ?? []).length > 0 ? <View style={styles.section}>
      <Text style={styles.sectionTitle}>Work documents</Text>
      {(job.documents ?? job.attachments ?? []).map((attachment, index) => <View key={String(attachment.id ?? index)} style={styles.documentRow}>
        <Text style={styles.documentBadge}>{textValue(attachment.type) || 'FILE'}</Text>
        <View style={styles.flexOne}><Text style={styles.documentText}>{textValue(attachment.fileName) || `Document ${index + 1}`}</Text>{attachment.createdAt ? <Text style={styles.referenceText}>{formatDate(attachment.createdAt)}</Text> : null}</View>
      </View>)}
    </View> : null}

    {job.podCompleted ? <View style={styles.section}>
      <Text style={styles.sectionTitle}>POD & delivery evidence</Text>
      <InfoLine label="Receiver" value={textValue(pod.receiverName) || 'Recorded'} />
      <InfoLine label="Signature" value={pod.signatureRecorded ? 'Recorded' : 'Not recorded'} />
      <InfoLine label="Delivery images" value={String(Number(pod.deliveryPhotoCount ?? 0))} />
      {pod.generatedAt ? <InfoLine label="POD generated" value={formatDate(textValue(pod.generatedAt))} /> : null}
      <Banner text="Delivery evidence is server-confirmed for this completed work order." />
    </View> : null}

    {job.partial ? <Banner text="Some enrichment sources were unavailable. Core assignment data is shown, but this work order should not be treated as complete until refresh succeeds." /> : null}
  </View>;
}

function WorkRoute({ job }: { job: JobDetail }) {
  const stops: JobStop[] = job.stops && job.stops.length > 0
    ? job.stops
    : [
        { sequence: 1, type: 'collection', address: job.pickupLocation, timeWindowFrom: job.pickupTime },
        { sequence: 2, type: 'delivery', address: job.deliveryLocation, timeWindowFrom: job.deliveryTime },
      ];

  return <View style={styles.stack}>
    <View style={styles.section}>
      <Text style={styles.sectionKicker}>EXECUTION ROUTE</Text>
      <Text style={styles.sectionTitle}>{stops.length} stop{stops.length === 1 ? '' : 's'} in server sequence</Text>
      {job.distanceMiles ? <Text style={styles.referenceText}>{job.distanceMiles} mi{job.etaMinutes ? ` · approx. ${job.etaMinutes} min` : ''}</Text> : null}
    </View>
    {stops.map((stop, index) => {
      const normalizedType = String(stop.type ?? '').toLowerCase();
      const type = normalizedType === 'collection'
        ? (index === 0 ? 'COLLECTION' : 'EXTRA COLLECTION')
        : normalizedType === 'delivery'
          ? (index === stops.length - 1 ? 'DELIVERY' : 'EXTRA DELIVERY')
          : `STOP ${index + 1}`;
      const routeUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.address)}`;
      return <View key={stop.id ?? `${stop.sequence}-${index}`} style={styles.routeStopCard}>
        <View style={styles.routeStopHead}>
          <View style={styles.stopNumber}><Text style={styles.stopNumberText}>{stop.sequence || index + 1}</Text></View>
          <View style={styles.flexOne}><Text style={styles.stopTypeTitle}>{type}</Text>{stop.company ? <Text style={styles.stopCompany}>{stop.company}</Text> : null}</View>
          {stop.status ? <StatusTag label={String(stop.status).toUpperCase()} tone={String(stop.status).toLowerCase().includes('complete') ? 'green' : 'blue'} /> : null}
        </View>
        <Text style={styles.stopAddress}>{stop.address}</Text>
        <Text style={styles.stopTime}>{formatDate(stop.timeWindowFrom)}{stop.timeWindowTo ? ` → ${formatDate(stop.timeWindowTo)}` : ''}</Text>
        {stop.contactPerson ? <InfoLine label="Contact" value={stop.contactPerson} /> : null}
        {stop.telephone ? <InfoLine label="Phone" value={stop.telephone} /> : null}
        {stop.notes ? <View style={styles.stopInstruction}><Text style={styles.fieldLabel}>SITE INSTRUCTIONS</Text><Text style={styles.stopNote}>{stop.notes}</Text></View> : null}
        <View style={styles.twoActions}>
          <TouchableOpacity style={[styles.secondaryAction, !stop.telephone && styles.disabledButton]} disabled={!stop.telephone} onPress={() => stop.telephone ? void Linking.openURL(`tel:${stop.telephone}`) : undefined}><Text style={styles.secondaryActionText}>Call site</Text></TouchableOpacity>
          <TouchableOpacity style={styles.primaryCompact} onPress={() => void Linking.openURL(routeUrl)}><Text style={styles.primaryCompactText}>Navigate</Text></TouchableOpacity>
        </View>
      </View>;
    })}
  </View>;
}

function ProgressBoard({ job }: { job: JobDetail }) {
  if (job.status === 'cancelled') {
    return <View style={styles.progressBoard}>
      <Text style={styles.sectionKicker}>SERVER-CONFIRMED PROGRESS</Text>
      <Text style={styles.progressHeading}>Cancelled</Text>
      <Text style={styles.longText}>This work order is closed and cannot accept lifecycle or POD actions.</Text>
    </View>;
  }

  const timelineByStatus = new Map<CanonicalJobStatus, AuditEntry>();
  for (const entry of job.auditTrail ?? []) {
    const status = canonicalEventStatus(entry.eventType);
    if (status) timelineByStatus.set(status, entry);
  }
  const currentIndex = progressOrder.indexOf(job.status);

  return <View style={styles.progressBoard}>
    <Text style={styles.sectionKicker}>SERVER-CONFIRMED PROGRESS</Text>
    <Text style={styles.progressHeading}>{progressLabels[job.status]}</Text>
    <Text style={styles.referenceText}>Every completed step remains visible with its server timestamp when available.</Text>
    <View style={styles.progressList}>{progressOrder.map((status, index) => {
      const done = index < currentIndex || job.status === 'delivered';
      const current = index === currentIndex && job.status !== 'delivered';
      const audit = timelineByStatus.get(status);
      return <View key={status} style={[styles.progressRow, current && styles.progressRowCurrent]}>
        <View style={[styles.progressState, done && styles.progressStateDone, current && styles.progressStateCurrent]}><Text style={styles.progressStateText}>{done ? '✓' : current ? 'NOW' : 'NEXT'}</Text></View>
        <View style={styles.flexOne}>
          <Text style={[styles.progressText, current && styles.progressTextCurrent]}>{progressLabels[status]}</Text>
          {audit?.createdAt ? <Text style={styles.progressTimestamp}>{formatDate(audit.createdAt)}</Text> : null}
          {audit?.message ? <Text style={styles.progressNote}>{audit.message}</Text> : null}
        </View>
      </View>;
    })}</View>
  </View>;
}

function PodPanel({ job, recipient, signature, photoUris, documentUris, notes, signatureRef, onRecipient, onSignature, onTakePhoto, onChoosePhotos, onAddDocuments, onRemovePhoto, onRemoveDocument, onNotes, onSubmit, busy }: {
  job: JobDetail;
  recipient: string;
  signature: string;
  photoUris: string[];
  documentUris: string[];
  notes: string;
  signatureRef: MutableRefObject<any>;
  onRecipient: (value: string) => void;
  onSignature: (value: string) => void;
  onTakePhoto: () => void;
  onChoosePhotos: () => void;
  onAddDocuments: () => void;
  onRemovePhoto: (index: number) => void;
  onRemoveDocument: (index: number) => void;
  onNotes: (value: string) => void;
  onSubmit: () => void;
  busy: boolean;
}) {
  return <View style={styles.section}>
    <Text style={styles.sectionKicker}>POD & DELIVERY CLOSEOUT</Text>
    <Text style={styles.sectionTitle}>Delivery evidence</Text>
    <Text style={styles.fieldLabel}>RECEIVED BY</Text>
    <TextInput style={styles.bigInput} value={recipient} onChangeText={onRecipient} placeholder="Full recipient name" placeholderTextColor="#98A2B3" />

    <Text style={styles.fieldLabel}>RECIPIENT SIGNATURE</Text>
    <View style={styles.signatureBox}><SignatureCanvas ref={signatureRef} onOK={onSignature} onEmpty={() => undefined} descriptionText="Sign above" clearText="Clear" confirmText="Save signature" webStyle=".m-signature-pad--footer {display:flex; gap:8px;} body,html {width:100%;height:100%;}" /></View>
    <Text style={styles.savedState}>{signature ? 'Signature stored ✓' : 'Signature not stored yet'}</Text>

    <View style={styles.evidenceHeader}><Text style={styles.fieldLabel}>DELIVERY IMAGES</Text><Text style={styles.evidenceCount}>{photoUris.length}/{MAX_POD_PHOTOS}</Text></View>
    {photoUris.map((uri, index) => <View key={`${uri}-${index}`} style={styles.evidenceRow}><View style={styles.evidenceIndex}><Text style={styles.evidenceIndexText}>{index + 1}</Text></View><Text style={styles.evidenceText} numberOfLines={1}>{uriLabel(uri)}</Text><TouchableOpacity onPress={() => onRemovePhoto(index)}><Text style={styles.removeEvidence}>Remove</Text></TouchableOpacity></View>)}
    <View style={styles.twoActions}>
      <TouchableOpacity style={[styles.secondaryAction, photoUris.length >= MAX_POD_PHOTOS && styles.disabledButton]} disabled={photoUris.length >= MAX_POD_PHOTOS} onPress={onTakePhoto}><Text style={styles.secondaryActionText}>Take photo</Text></TouchableOpacity>
      <TouchableOpacity style={[styles.secondaryAction, photoUris.length >= MAX_POD_PHOTOS && styles.disabledButton]} disabled={photoUris.length >= MAX_POD_PHOTOS} onPress={onChoosePhotos}><Text style={styles.secondaryActionText}>Choose photos</Text></TouchableOpacity>
    </View>
    <Text style={styles.referenceText}>Add every signed sheet or delivery image required by the job, up to {MAX_POD_PHOTOS} images.</Text>

    <View style={styles.evidenceHeader}><Text style={styles.fieldLabel}>SIGNED DOCUMENTS / PDF</Text><Text style={styles.evidenceCount}>{documentUris.length}/{MAX_POD_DOCUMENTS}</Text></View>
    {documentUris.map((uri, index) => <View key={`${uri}-${index}`} style={styles.evidenceRow}><Text style={styles.documentBadge}>FILE</Text><Text style={styles.evidenceText} numberOfLines={1}>{uriLabel(uri)}</Text><TouchableOpacity onPress={() => onRemoveDocument(index)}><Text style={styles.removeEvidence}>Remove</Text></TouchableOpacity></View>)}
    <TouchableOpacity style={[styles.secondaryAction, documentUris.length >= MAX_POD_DOCUMENTS && styles.disabledButton]} disabled={documentUris.length >= MAX_POD_DOCUMENTS} onPress={onAddDocuments}><Text style={styles.secondaryActionText}>Add signed document</Text></TouchableOpacity>

    <Text style={styles.fieldLabel}>DELIVERY NOTE</Text>
    <TextInput style={[styles.bigInput, styles.textarea]} multiline value={notes} onChangeText={onNotes} placeholder="Optional delivery note" placeholderTextColor="#98A2B3" />
    <Banner text={job.podRequired ? 'Recipient name, saved electronic signature and at least one delivery image are required before XDrive completes this work order.' : 'Evidence is server-verified before the work order is completed.'} />
    <TouchableOpacity style={[styles.primaryButton, busy && styles.disabledButton]} disabled={busy} onPress={onSubmit}><Text style={styles.primaryButtonText}>{busy ? 'Submitting...' : 'Confirm POD & complete job'}</Text></TouchableOpacity>
  </View>;
}

function WorkStepAction({ job, busy, podOpen, onPress }: { job: JobDetail; busy: boolean; podOpen: boolean; onPress: () => void }) {
  if (podOpen || job.status === 'delivered' || job.status === 'cancelled') return null;
  const next = getNextStep(job.status);
  const label = next?.label || 'Record delivery evidence';
  return <View style={styles.fixedAction}><TouchableOpacity style={[styles.fixedActionButton, busy && styles.disabledButton]} disabled={busy} onPress={onPress}><Text style={styles.fixedActionText}>{busy ? 'Updating...' : label}</Text></TouchableOpacity></View>;
}

function AccountBody({ resources, queueCount, onOpen, onSignOut }: {
  resources: DriverProfileResource | null;
  queueCount: number;
  onOpen: (page: UtilityPage) => void;
  onSignOut: () => void;
}) {
  return <View style={styles.stack}>
    <View style={styles.accountIdentity}>
      <View style={styles.accountAvatar}><Text style={styles.accountAvatarText}>{initials(resources?.name || 'XDrive Driver')}</Text></View>
      <View style={styles.flexOne}><Text style={styles.accountName}>{resources?.name || 'XDrive Driver'}</Text><Text style={styles.accountEmail}>{resources?.email || 'Driver account'}</Text></View>
    </View>

    <AccountSection title="DRIVER">
      <AccountRow title="Profile" subtitle="Contact and company details" onPress={() => onOpen('profile')} />
      <AccountRow title="Vehicle" subtitle={resources?.vehicle?.reg_plate || 'Assigned vehicle'} onPress={() => onOpen('vehicle')} />
      <AccountRow title="Documents" subtitle={`${resources?.documents?.length ?? 0} records`} onPress={() => onOpen('documents')} />
    </AccountSection>

    <AccountSection title="OPERATIONS">
      <AccountRow title="Work state" subtitle={String(resources?.driver?.availability_status ?? 'available')} onPress={() => onOpen('availability')} />
      <AccountRow title="Earnings" subtitle={`${resources?.invoices?.length ?? 0} invoices`} onPress={() => onOpen('earnings')} />
      <AccountRow title="Sync queue" subtitle={`${queueCount} pending`} onPress={() => onOpen('offline')} />
      <AccountRow title="Support" subtitle="XDrive operational support" onPress={() => onOpen('support')} />
    </AccountSection>

    <TouchableOpacity style={styles.signOutButton} onPress={onSignOut}><Text style={styles.signOutText}>Sign out of XDrive Driver</Text></TouchableOpacity>
  </View>;
}

function UtilityBody({ page, resources, queue, busy, onAvailability, onFlush }: {
  page: UtilityPage;
  resources: DriverProfileResource | null;
  queue: QueuedAction[];
  busy: boolean;
  onAvailability: (status: 'available' | 'busy' | 'offline') => Promise<void>;
  onFlush: () => void;
}) {
  if (page === 'profile') return <View style={styles.section}><Text style={styles.sectionTitle}>Driver profile</Text><InfoLine label="Name" value={resources?.name || 'Not supplied'} /><InfoLine label="Email" value={resources?.email || 'Not supplied'} /><InfoLine label="Phone" value={resources?.phone || 'Not supplied'} /><InfoLine label="Company" value={resources?.company?.name || 'Not supplied'} /></View>;
  if (page === 'vehicle') return <View style={styles.section}><Text style={styles.sectionTitle}>Assigned vehicle</Text><InfoLine label="Registration" value={resources?.vehicle?.reg_plate || 'Not supplied'} /><InfoLine label="Type" value={resources?.vehicle?.type || resources?.vehicle?.vehicle_type || 'Not supplied'} /><InfoLine label="Make / model" value={[resources?.vehicle?.make, resources?.vehicle?.model].filter(Boolean).join(' ') || 'Not supplied'} /><InfoLine label="Payload" value={resources?.vehicle?.payload_kg ? `${resources.vehicle.payload_kg} kg` : 'Not supplied'} /></View>;
  if (page === 'documents') return <View style={styles.section}><Text style={styles.sectionTitle}>Driver documents</Text>{(resources?.documents ?? []).length === 0 ? <EmptyState title="No documents" body="Driver and vehicle records will appear here." /> : (resources?.documents ?? []).map((doc, index) => <View key={String(doc.id ?? index)} style={styles.documentRow}><Text style={styles.documentBadge}>FILE</Text><View style={styles.flexOne}><Text style={styles.documentText}>{String(doc.doc_type ?? 'Document')}</Text><Text style={styles.referenceText}>{String(doc.status ?? '')}{doc.expiry_date ? ` · expires ${formatDate(doc.expiry_date)}` : ''}</Text></View></View>)}</View>;
  if (page === 'earnings') return <View style={styles.section}><Text style={styles.sectionTitle}>Invoices and earnings</Text>{(resources?.invoices ?? []).length === 0 ? <EmptyState title="No invoices" body="Completed XDrive invoices will appear here." /> : (resources?.invoices ?? []).map((invoice, index) => <View key={String(invoice.id ?? index)} style={styles.invoiceRow}><View><Text style={styles.documentText}>{String(invoice.invoice_number ?? `Invoice ${index + 1}`)}</Text><Text style={styles.referenceText}>{String(invoice.client_name ?? '')}</Text></View><Text style={styles.historyRate}>{formatMoney(invoice.amount, invoice.currency || 'GBP')}</Text></View>)}</View>;
  if (page === 'availability') return <View style={styles.section}><Text style={styles.sectionTitle}>Work state</Text><Text style={styles.longText}>Choose how XDrive should treat your availability for suitable work and operational alerts.</Text>{(['available', 'busy', 'offline'] as const).map((status) => <TouchableOpacity key={status} style={[styles.secondaryAction, busy && styles.disabledButton]} disabled={busy} onPress={() => void onAvailability(status)}><Text style={styles.secondaryActionText}>{status === 'available' ? 'Ready for work' : status === 'busy' ? 'Busy / unavailable for new work' : 'Off duty'}</Text></TouchableOpacity>)}</View>;
  if (page === 'offline') return <View style={styles.section}><Text style={styles.sectionTitle}>Sync queue</Text>{queue.length === 0 ? <EmptyState title="Everything is synced" body="No driver actions are waiting for server confirmation." /> : queue.map((item) => <View key={item.id} style={styles.queueRow}><Text style={styles.documentText}>{item.endpoint}</Text><Text style={styles.referenceText}>{item.jobId} · {item.status}</Text>{item.lastError ? <Text style={styles.errorText}>{item.lastError}</Text> : null}</View>)}<TouchableOpacity style={styles.primaryButton} onPress={onFlush}><Text style={styles.primaryButtonText}>Retry pending sync</Text></TouchableOpacity></View>;
  return <View style={styles.section}><Text style={styles.sectionTitle}>XDrive support</Text><Text style={styles.longText}>For urgent operational issues, use the verified XDrive support channel. Preview does not invent an unverified messaging endpoint.</Text><TouchableOpacity style={styles.secondaryAction} onPress={() => void Linking.openURL('mailto:xdrivelogisticsltd@gmail.com')}><Text style={styles.secondaryActionText}>Email XDrive support</Text></TouchableOpacity></View>;
}

function ScreenTitle({ title, kicker }: { title: string; kicker: string }) {
  return <View style={styles.screenTitleRow}><Text style={styles.screenKicker}>{kicker}</Text><Text style={styles.screenTitle}>{title}</Text></View>;
}

function BackTitle({ title, onBack }: { title: string; onBack: () => void }) {
  return <View style={styles.backTitleRow}><TouchableOpacity style={styles.backButton} onPress={onBack}><Text style={styles.backText}>←</Text></TouchableOpacity><Text style={styles.backTitle}>{title}</Text><View style={styles.backSpacer} /></View>;
}

function Tabs<T extends string>({ items, value, onChange }: { items: Array<[T, string]>; value: T; onChange: (value: T) => void }) {
  return <View style={styles.tabs}>{items.map(([key, label]) => <TouchableOpacity key={key} style={[styles.tab, value === key && styles.tabActive]} onPress={() => onChange(key)}><Text style={[styles.tabText, value === key && styles.tabTextActive]}>{label}</Text></TouchableOpacity>)}</View>;
}

function BottomDock({ active, loadCount, onChange }: { active: PrimaryTab; loadCount: number; onChange: (tab: PrimaryTab) => void }) {
  const items: Array<[PrimaryTab, string, string]> = [
    ['overview', 'Overview', 'XD'],
    ['loads', 'Loads', '↗'],
    ['offers', 'Offers', '£'],
    ['history', 'History', '≡'],
    ['account', 'Account', 'ID'],
  ];
  return <View style={styles.bottomDock}>{items.map(([key, label, glyph]) => <TouchableOpacity key={key} style={styles.dockItem} onPress={() => onChange(key)}><View style={[styles.dockGlyph, active === key && styles.dockGlyphActive]}><Text style={[styles.dockGlyphText, active === key && styles.dockGlyphTextActive]}>{glyph}</Text>{key === 'loads' && loadCount > 0 ? <View style={styles.dockBadge}><Text style={styles.dockBadgeText}>{Math.min(99, loadCount)}</Text></View> : null}</View><Text style={[styles.dockLabel, active === key && styles.dockLabelActive]}>{label}</Text></TouchableOpacity>)}</View>;
}

function RouteBand({ pickup, pickupTime, delivery, deliveryTime }: { pickup: string; pickupTime: string; delivery: string; deliveryTime: string }) {
  return <View style={styles.routeBand}>
    <View style={styles.routeBlock}><Text style={styles.routeKind}>COLLECT</Text><Text style={styles.routePlace} numberOfLines={2}>{pickup}</Text><Text style={styles.routeWhen}>{formatDate(pickupTime)}</Text></View>
    <View style={styles.routeArrow}><Text style={styles.routeArrowText}>→</Text></View>
    <View style={styles.routeBlock}><Text style={styles.routeKind}>DELIVER</Text><Text style={styles.routePlace} numberOfLines={2}>{delivery}</Text><Text style={styles.routeWhen}>{formatDate(deliveryTime)}</Text></View>
  </View>;
}

function CompactRoute({ job }: { job: DriverJob }) {
  return <View style={styles.compactRoute}><View style={styles.compactLeg}><Text style={styles.compactKind}>COLLECT</Text><Text style={styles.compactPlace} numberOfLines={1}>{job.pickupLocation}</Text></View><Text style={styles.compactArrow}>→</Text><View style={styles.compactLeg}><Text style={styles.compactKind}>DELIVER</Text><Text style={styles.compactPlace} numberOfLines={1}>{job.deliveryLocation}</Text></View></View>;
}

function Fact({ label, value, align = 'left' }: { label: string; value: string; align?: 'left' | 'right' }) {
  return <View style={[styles.fact, align === 'right' && styles.factRight]}><Text style={styles.factLabel}>{label}</Text><Text style={styles.factValue} numberOfLines={2}>{value}</Text></View>;
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return <View style={styles.infoLine}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>;
}

function StatusTag({ label, tone }: { label: string; tone: 'blue' | 'green' | 'muted' }) {
  return <View style={[styles.statusTag, tone === 'green' ? styles.statusTagGreen : tone === 'muted' ? styles.statusTagMuted : styles.statusTagBlue]}><Text style={styles.statusTagText}>{label}</Text></View>;
}

function AccountSection({ title, children }: { title: string; children: ReactNode }) {
  return <View style={styles.accountSection}><Text style={styles.accountSectionTitle}>{title}</Text><View style={styles.accountRows}>{children}</View></View>;
}

function AccountRow({ title, subtitle, onPress }: { title: string; subtitle: string; onPress: () => void }) {
  return <TouchableOpacity style={styles.accountRow} onPress={onPress}><View style={styles.flexOne}><Text style={styles.accountRowTitle}>{title}</Text><Text style={styles.accountRowSubtitle} numberOfLines={1}>{subtitle}</Text></View><Text style={styles.accountChevron}>→</Text></TouchableOpacity>;
}

function Banner({ text, onDismiss }: { text: string; onDismiss?: () => void }) {
  return <TouchableOpacity activeOpacity={onDismiss ? 0.8 : 1} onPress={onDismiss} style={styles.banner}><Text style={styles.bannerText}>{text}</Text>{onDismiss ? <Text style={styles.bannerClose}>×</Text> : null}</TouchableOpacity>;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return <View style={styles.emptyState}><Text style={styles.emptyMonogram}>XD</Text><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyBody}>{body}</Text></View>;
}

function LoadingCard({ text }: { text: string }) {
  return <View style={styles.loadingCard}><Text style={styles.loadingText}>{text}</Text></View>;
}

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'XD';
}

function utilityTitle(page: UtilityPage) {
  return page === 'profile'
    ? 'Driver Profile'
    : page === 'vehicle'
      ? 'Vehicle'
      : page === 'documents'
        ? 'Documents'
        : page === 'earnings'
          ? 'Earnings'
          : page === 'availability'
            ? 'Work State'
            : page === 'offline'
              ? 'Sync Queue'
              : 'Support';
}

async function openExternalRoute(job: DriverJob) {
  const origin = encodeURIComponent(job.pickupLocation);
  const destination = encodeURIComponent(job.deliveryLocation);
  const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
  if (await Linking.canOpenURL(url)) await Linking.openURL(url);
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.secondary },
  shell: { flex: 1, backgroundColor: colors.bg },
  bodyViewport: { flex: 1, backgroundColor: colors.bg },
  bodyContent: { padding: spacing.md, paddingBottom: 28, gap: spacing.md },
  bodyWithAction: { paddingBottom: 120 },
  topChrome: { backgroundColor: colors.secondary, paddingHorizontal: spacing.md, paddingTop: 12, paddingBottom: 14, gap: 12 },
  stack: { gap: spacing.md },
  flexOne: { flex: 1, minWidth: 0 },

  screenTitleRow: { minHeight: 56, justifyContent: 'center' },
  screenKicker: { color: '#9FB8DE', fontSize: 10, fontWeight: '900', letterSpacing: 1.6 },
  screenTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '900', marginTop: 2 },
  backTitleRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 46, height: 46, justifyContent: 'center' },
  backText: { color: '#FFFFFF', fontSize: 24, fontWeight: '700' },
  backTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  backSpacer: { width: 46 },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: { flex: 1, minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: '#355A91', alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  tabText: { color: '#BFD1EF', fontSize: 13, fontWeight: '800' },
  tabTextActive: { color: colors.secondary, fontWeight: '900' },

  overviewHeader: { backgroundColor: colors.secondary, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, gap: 15, borderBottomWidth: 3, borderBottomColor: colors.warning },
  commandBrandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  commandBrandLockup: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  commandBrand: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', letterSpacing: 0.8 },
  commandSlash: { color: colors.warning, fontSize: 21, fontWeight: '900' },
  commandMode: { color: '#AFC3E3', fontSize: 9, fontWeight: '900', letterSpacing: 1.6 },
  commandPulse: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#102A52', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  commandPulseDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.warning },
  commandPulseText: { color: '#DCE8FA', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  commandIdentityRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  commandEyebrow: { color: '#87A5D0', fontSize: 8, fontWeight: '900', letterSpacing: 1.3, marginBottom: 3 },
  driverName: { color: '#FFFFFF', fontSize: 26, fontWeight: '900' },
  driverVehicle: { color: '#BCD0EE', fontSize: 13, fontWeight: '700', marginTop: 2 },
  commandMonogram: { width: 52, height: 52, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  commandMonogramText: { color: colors.secondary, fontSize: 15, fontWeight: '900' },
  commandStatusStrip: { flexDirection: 'row', alignItems: 'center', borderTopColor: '#31517E', borderTopWidth: 1, paddingTop: 12 },
  commandStatusItem: { flex: 1 },
  commandStatusRule: { width: 1, height: 30, backgroundColor: '#31517E', marginHorizontal: 14 },
  commandStatusLabel: { color: '#7F9BC4', fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  commandStatusValue: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', marginTop: 4 },
  commandStatusValueLive: { color: '#8FE7B0', fontSize: 13, fontWeight: '900', marginTop: 4 },

  dispatchPanel: { backgroundColor: '#FFFFFF', borderRadius: 18, borderColor: colors.borderSubtle, borderWidth: 1, padding: 16, gap: 12 },
  dispatchHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dispatchTitle: { color: colors.text, fontSize: 21, fontWeight: '900', marginTop: 3 },
  dispatchCount: { minWidth: 42, height: 42, borderRadius: 12, backgroundColor: '#EEF4FF', color: colors.primary, fontSize: 20, fontWeight: '900', textAlign: 'center', textAlignVertical: 'center' },
  activeRunCard: { borderRadius: 15, backgroundColor: '#0B2F6B', padding: 14, gap: 11 },
  activeRunTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  activeRunLabel: { color: '#9FB8DE', fontSize: 8, fontWeight: '900', letterSpacing: 1.1, marginBottom: 3 },
  activeRunReference: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  activeRunFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopColor: '#31517E', borderTopWidth: 1, paddingTop: 9 },
  activeRunHint: { color: '#C6D7F0', fontSize: 10, lineHeight: 15, fontWeight: '700', flex: 1, paddingRight: 10 },
  activeRunArrow: { color: colors.warning, fontSize: 21, fontWeight: '900' },
  dispatchEmpty: { backgroundColor: '#F8FAFC', borderRadius: 13, padding: 14, borderLeftWidth: 4, borderLeftColor: colors.warning },
  dispatchEmptyTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  dispatchEmptyBody: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 4 },

  marketAccessCard: { minHeight: 102, backgroundColor: '#0E3FA9', borderRadius: 18, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12 },
  marketAccessIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  marketAccessIconText: { color: '#0E3FA9', fontSize: 24, fontWeight: '900' },
  marketAccessKicker: { color: '#BFD4FF', fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  marketAccessTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', marginTop: 3 },
  marketAccessBody: { color: '#E5EEFF', fontSize: 10, lineHeight: 15, fontWeight: '600', marginTop: 3 },
  marketAccessCount: { minWidth: 52, minHeight: 58, borderRadius: 13, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7 },
  marketAccessCountValue: { color: colors.secondary, fontSize: 22, fontWeight: '900' },
  marketAccessCountLabel: { color: colors.primary, fontSize: 8, fontWeight: '900', letterSpacing: 1 },

  commandLedger: { flexDirection: 'row', gap: 10 },
  ledgerCell: { flex: 1, minHeight: 112, backgroundColor: '#FFFFFF', borderRadius: 16, borderColor: colors.borderSubtle, borderWidth: 1, padding: 14, justifyContent: 'space-between' },
  ledgerLabel: { color: colors.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  ledgerValue: { color: colors.secondary, fontSize: 30, fontWeight: '900' },
  ledgerHint: { color: colors.muted, fontSize: 10, lineHeight: 15, fontWeight: '600' },

  shiftControl: { minHeight: 66, backgroundColor: '#FFF7E6', borderRadius: 16, borderColor: '#F9D690', borderWidth: 1, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  shiftControlLabel: { color: '#8A5A00', fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  shiftControlTitle: { color: colors.text, fontSize: 14, fontWeight: '900', marginTop: 2 },
  shiftControlArrow: { color: '#B26A00', fontSize: 22, fontWeight: '900' },
  accountHint: { color: colors.muted, fontSize: 11, textAlign: 'center' },

  section: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderColor: colors.borderSubtle, borderWidth: 1, gap: 12 },
  sectionKicker: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.3 },
  sectionTitle: { color: colors.text, fontSize: 20, fontWeight: '900' },
  companyName: { color: colors.text, fontSize: 17, lineHeight: 22, fontWeight: '900' },
  referenceText: { color: colors.muted, fontSize: 12, lineHeight: 17, fontWeight: '600', marginTop: 2 },
  referenceStrong: { color: colors.secondary, fontSize: 16, fontWeight: '900' },
  longText: { color: colors.text, fontSize: 14, lineHeight: 21, fontWeight: '600' },

  loadCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, borderColor: colors.borderSubtle, borderWidth: 1, gap: 13, shadowColor: '#101828', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  loadHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  routeBand: { flexDirection: 'row', alignItems: 'stretch', gap: 8, marginTop: 13 },
  routeBlock: { flex: 1, backgroundColor: '#F5F8FC', borderRadius: 14, padding: 12, minHeight: 112 },
  routeKind: { color: colors.primary, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  routePlace: { color: colors.text, fontSize: 14, lineHeight: 19, fontWeight: '900', marginTop: 6 },
  routeWhen: { color: colors.muted, fontSize: 10, lineHeight: 15, fontWeight: '600', marginTop: 7 },
  routeArrow: { width: 28, alignItems: 'center', justifyContent: 'center' },
  routeArrowText: { color: colors.warning, fontSize: 24, fontWeight: '900' },
  loadFacts: { flexDirection: 'row', gap: 12, marginTop: 13 },
  fact: { flex: 1 },
  factRight: { alignItems: 'flex-end' },
  factLabel: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  factValue: { color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: '800', marginTop: 3 },
  returnIq: { color: colors.secondary, backgroundColor: '#EDF4FF', borderRadius: 10, padding: 9, fontSize: 11, lineHeight: 16, fontWeight: '800', marginTop: 12 },
  inlineWarning: { color: '#7A4A00', backgroundColor: '#FFF5DB', borderRadius: 10, padding: 9, fontSize: 11, lineHeight: 16, fontWeight: '700', marginTop: 10 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  textAction: { minHeight: 42, paddingHorizontal: 12, borderRadius: 11, backgroundColor: '#F2F4F7', alignItems: 'center', justifyContent: 'center' },
  textActionText: { color: '#475467', fontSize: 12, fontWeight: '800' },
  offerButton: { marginLeft: 'auto', minHeight: 44, minWidth: 118, paddingHorizontal: 17, borderRadius: 13, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  offerButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  offerCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderColor: colors.borderSubtle, borderWidth: 1, gap: 12 },
  ratePanel: { backgroundColor: '#F5F8FC', borderRadius: 13, padding: 12 },
  rateValue: { color: colors.secondary, fontSize: 24, fontWeight: '900', marginTop: 3 },

  compactRoute: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F8FAFC', borderRadius: 13, padding: 11 },
  compactLeg: { flex: 1, minWidth: 0 },
  compactKind: { color: colors.primary, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  compactPlace: { color: colors.text, fontSize: 13, fontWeight: '800', marginTop: 3 },
  compactArrow: { color: colors.warning, fontSize: 19, fontWeight: '900' },

  historyIntro: { backgroundColor: '#FFFFFF', borderRadius: 18, borderColor: colors.borderSubtle, borderWidth: 1, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  historyCount: { color: colors.primary, fontSize: 36, fontWeight: '900' },
  historyIntroTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  historyIntroBody: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 2, maxWidth: 250 },
  historyCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 15, borderColor: colors.borderSubtle, borderWidth: 1, gap: 11 },
  historyTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  historyBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyDate: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  historyRate: { color: colors.secondary, fontSize: 15, fontWeight: '900' },

  statusTag: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  statusTagBlue: { backgroundColor: '#E7F0FF' },
  statusTagGreen: { backgroundColor: '#DCFCE7' },
  statusTagMuted: { backgroundColor: '#EAECF0' },
  statusTagText: { color: '#344054', fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },

  progressBoard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderColor: colors.borderSubtle, borderWidth: 1, gap: 12 },
  progressHeading: { color: colors.text, fontSize: 22, fontWeight: '900' },
  progressList: { gap: 8 },
  progressRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 9, borderRadius: 12, backgroundColor: '#F8FAFC' },
  progressRowCurrent: { backgroundColor: '#FFF4D8', borderColor: '#FFD878', borderWidth: 1 },
  progressState: { width: 48, minHeight: 30, borderRadius: 8, backgroundColor: '#E4E7EC', alignItems: 'center', justifyContent: 'center' },
  progressStateDone: { backgroundColor: '#D1FADF' },
  progressStateCurrent: { backgroundColor: colors.warning },
  progressStateText: { color: '#344054', fontSize: 8, fontWeight: '900' },
  progressText: { color: '#667085', fontSize: 14, fontWeight: '800' },
  progressTextCurrent: { color: colors.text, fontWeight: '900' },
  progressTimestamp: { color: colors.muted, fontSize: 10, fontWeight: '700', marginTop: 3 },
  progressNote: { color: colors.secondary, fontSize: 10, lineHeight: 15, marginTop: 3 },

  bulletText: { color: colors.text, fontSize: 13, lineHeight: 20, fontWeight: '600' },
  instructionBlock: { gap: 5, paddingTop: 5 },

  routeStopCard: { backgroundColor: '#FFFFFF', borderRadius: 17, padding: 15, borderColor: colors.borderSubtle, borderWidth: 1, gap: 11 },
  routeStopHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stopNumber: { width: 34, height: 34, borderRadius: 9, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center' },
  stopNumberText: { color: colors.secondary, fontSize: 13, fontWeight: '900' },
  stopTypeTitle: { color: colors.secondary, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  stopCompany: { color: colors.text, fontSize: 15, lineHeight: 20, fontWeight: '900', marginTop: 2 },
  stopInstruction: { backgroundColor: '#EDF4FF', borderRadius: 10, padding: 10, gap: 5 },

  stopBlock: { backgroundColor: '#FFFFFF', borderRadius: 17, padding: 15, borderColor: colors.borderSubtle, borderWidth: 1, flexDirection: 'row', gap: 12 },
  stopLabel: { width: 72, minHeight: 34, alignSelf: 'flex-start', borderRadius: 8, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  stopLabelText: { color: colors.secondary, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  stopAddress: { color: colors.text, fontSize: 16, lineHeight: 21, fontWeight: '900' },
  stopTime: { color: colors.muted, fontSize: 11, lineHeight: 16, fontWeight: '700', marginTop: 4 },
  stopMeta: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5 },
  stopNote: { color: colors.secondary, backgroundColor: '#EDF4FF', borderRadius: 9, padding: 8, fontSize: 11, lineHeight: 16, marginTop: 7 },

  infoLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, borderTopColor: colors.borderSubtle, borderTopWidth: 1, paddingTop: 10 },
  infoLabel: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  infoValue: { color: colors.text, fontSize: 12, fontWeight: '900', flex: 1, textAlign: 'right' },
  fieldLabel: { color: colors.secondary, fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginTop: 3 },
  bigInput: { minHeight: 54, borderColor: colors.border, borderWidth: 1, borderRadius: 14, backgroundColor: '#FFFFFF', color: colors.text, paddingHorizontal: 14, fontSize: 16, fontWeight: '600' },
  textarea: { minHeight: 100, paddingTop: 14, textAlignVertical: 'top' },
  primaryButton: { minHeight: 56, backgroundColor: colors.primary, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  primaryCompact: { minHeight: 46, flexGrow: 1, paddingHorizontal: 15, backgroundColor: colors.primary, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  primaryCompactText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  twoActions: { flexDirection: 'row', gap: 10 },
  secondaryAction: { flex: 1, minHeight: 48, borderColor: colors.primary, borderWidth: 1.3, borderRadius: 13, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, backgroundColor: '#FFFFFF' },
  secondaryActionText: { color: colors.primary, fontSize: 12, fontWeight: '900', textAlign: 'center' },
  disabledButton: { opacity: 0.45 },

  signatureBox: { height: 210, borderColor: colors.border, borderWidth: 1, borderRadius: 14, overflow: 'hidden', backgroundColor: '#FFFFFF' },
  savedState: { color: colors.success, fontSize: 11, fontWeight: '800' },
  evidenceHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  evidenceCount: { color: colors.secondary, fontSize: 11, fontWeight: '900' },
  evidenceRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 9, borderColor: colors.borderSubtle, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, backgroundColor: '#F8FAFC' },
  evidenceIndex: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center' },
  evidenceIndexText: { color: colors.secondary, fontSize: 10, fontWeight: '900' },
  evidenceText: { color: colors.text, fontSize: 11, fontWeight: '700', flex: 1 },
  removeEvidence: { color: colors.danger, fontSize: 10, fontWeight: '900' },
  fixedAction: { position: 'absolute', left: 0, right: 0, bottom: 78, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#0A234F' },
  fixedActionButton: { minHeight: 58, backgroundColor: colors.warning, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  fixedActionText: { color: '#17202F', fontSize: 15, fontWeight: '900' },

  accountIdentity: { backgroundColor: colors.secondary, borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 13 },
  accountAvatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  accountAvatarText: { color: colors.secondary, fontSize: 15, fontWeight: '900' },
  accountName: { color: '#FFFFFF', fontSize: 19, fontWeight: '900' },
  accountEmail: { color: '#BFD1EF', fontSize: 11, marginTop: 3 },
  accountSection: { gap: 7 },
  accountSectionTitle: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.2, marginLeft: 4 },
  accountRows: { backgroundColor: '#FFFFFF', borderRadius: 16, borderColor: colors.borderSubtle, borderWidth: 1, overflow: 'hidden' },
  accountRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 15, borderBottomColor: colors.borderSubtle, borderBottomWidth: 1 },
  accountRowTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  accountRowSubtitle: { color: colors.muted, fontSize: 11, marginTop: 2 },
  accountChevron: { color: colors.primary, fontSize: 18, fontWeight: '900' },
  signOutButton: { minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: '#FCA5A5', backgroundColor: '#FFF5F5', alignItems: 'center', justifyContent: 'center' },
  signOutText: { color: colors.danger, fontSize: 13, fontWeight: '900' },

  documentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderColor: colors.borderSubtle, borderWidth: 1, borderRadius: 11, padding: 10, backgroundColor: '#F8FAFC' },
  documentBadge: { width: 40, color: colors.primary, fontSize: 9, fontWeight: '900' },
  documentText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  invoiceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 14, borderBottomColor: colors.borderSubtle, borderBottomWidth: 1, paddingVertical: 10 },
  queueRow: { borderColor: colors.borderSubtle, borderWidth: 1, borderRadius: 11, padding: 10 },
  errorText: { color: colors.danger, fontSize: 11, marginTop: 4 },

  banner: { minHeight: 46, backgroundColor: '#EAF2FF', borderColor: '#B9D3FF', borderWidth: 1, borderRadius: 13, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', gap: 9, alignItems: 'center' },
  bannerText: { color: colors.secondary, fontSize: 12, lineHeight: 18, fontWeight: '700', flex: 1 },
  bannerClose: { color: colors.secondary, fontSize: 21, fontWeight: '700' },
  emptyState: { minHeight: 230, backgroundColor: '#FFFFFF', borderRadius: 18, borderColor: colors.borderSubtle, borderWidth: 1, alignItems: 'center', justifyContent: 'center', padding: 26 },
  emptyMonogram: { color: colors.primary, backgroundColor: '#EEF4FF', width: 70, height: 70, borderRadius: 18, textAlign: 'center', textAlignVertical: 'center', fontSize: 22, fontWeight: '900' },
  emptyTitle: { color: colors.text, fontSize: 19, fontWeight: '900', marginTop: 15, textAlign: 'center' },
  emptyBody: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 6 },
  loadingCard: { minHeight: 86, borderRadius: 16, backgroundColor: '#FFFFFF', borderColor: colors.borderSubtle, borderWidth: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  loadingText: { color: colors.muted, fontSize: 13, fontWeight: '700' },

  bottomDock: { minHeight: 78, flexDirection: 'row', backgroundColor: '#FFFFFF', borderTopColor: colors.borderSubtle, borderTopWidth: 1, paddingTop: 7, paddingBottom: 7 },
  dockItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  dockGlyph: { minWidth: 34, height: 29, borderRadius: 9, backgroundColor: '#F2F4F7', alignItems: 'center', justifyContent: 'center' },
  dockGlyphActive: { backgroundColor: '#E7F0FF' },
  dockGlyphText: { color: '#667085', fontSize: 11, fontWeight: '900' },
  dockGlyphTextActive: { color: colors.primary },
  dockLabel: { color: '#667085', fontSize: 10, fontWeight: '700' },
  dockLabelActive: { color: colors.primary, fontWeight: '900' },
  dockBadge: { position: 'absolute', right: -7, top: -6, minWidth: 19, height: 19, borderRadius: 10, backgroundColor: colors.warning, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  dockBadgeText: { color: '#17202F', fontSize: 9, fontWeight: '900' },

  loginSafe: { flex: 1, backgroundColor: '#0B2F6B' },
  loginPage: { flexGrow: 1, backgroundColor: '#F4F6F8', paddingBottom: 20 },
  loginHero: { minHeight: 390, paddingHorizontal: 22, paddingTop: 24, paddingBottom: 35, justifyContent: 'space-between' },
  loginHeroImage: { borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  loginShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,26,55,0.35)', borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  brandPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFFFF', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 11 },
  brandX: { color: colors.warning, fontSize: 23, fontWeight: '900' },
  brandDrive: { color: '#0E3FA9', fontSize: 23, fontWeight: '900' },
  brandDivider: { width: 1, height: 27, backgroundColor: '#CBD5E1', marginHorizontal: 5 },
  brandMeta: { color: '#0B2F6B', fontSize: 14, fontWeight: '900', letterSpacing: 2 },
  loginCopy: { gap: 9 },
  loginEyebrow: { color: '#FFBF24', fontSize: 13, fontWeight: '900', letterSpacing: 3 },
  loginHeroTitle: { color: '#FFFFFF', fontSize: 38, lineHeight: 42, fontWeight: '900', maxWidth: 300 },
  loginHeroBody: { color: '#FFFFFF', fontSize: 18, lineHeight: 25, fontWeight: '700', maxWidth: 330 },
  networkPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#0E3FA9', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
  networkDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFBF24' },
  networkText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  loginCard: { marginHorizontal: 18, marginTop: 16, backgroundColor: '#FFFFFF', borderRadius: 26, padding: 22, gap: 12, borderColor: colors.borderSubtle, borderWidth: 1 },
  loginTitle: { color: colors.secondary, fontSize: 28, fontWeight: '900', textAlign: 'center' },
  loginSubtitle: { color: colors.muted, fontSize: 14, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  loginInput: { minHeight: 56, borderColor: colors.border, borderWidth: 1, borderRadius: 15, paddingHorizontal: 14, color: colors.text, fontSize: 16, fontWeight: '600' },
  passwordRow: { minHeight: 56, borderColor: colors.border, borderWidth: 1, borderRadius: 15, flexDirection: 'row', alignItems: 'center' },
  passwordInput: { flex: 1, minHeight: 54, paddingHorizontal: 14, color: colors.text, fontSize: 16, fontWeight: '600' },
  showButton: { paddingHorizontal: 14, height: 54, alignItems: 'center', justifyContent: 'center' },
  showText: { color: colors.primary, fontSize: 12, fontWeight: '900' },
});
