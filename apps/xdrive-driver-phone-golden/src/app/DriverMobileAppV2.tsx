import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
import * as ImagePicker from 'expo-image-picker';
import * as Network from 'expo-network';
import * as Notifications from 'expo-notifications';
import SignatureCanvas from 'react-native-signature-canvas';

import { apiRequest } from '../api/client';
import { fetchJobs, persistEvidencePhoto, postJobStatus, uploadPod } from '../api/jobs';
import {
  fetchDriverResources,
  formatMoney,
  mapResourceJob,
  updateDriverAvailability,
  updateJobQuote,
  withdrawJobQuote,
  type DriverProfileResource,
} from '../api/resources';
import {
  fetchLiveLoads,
  submitLiveLoadQuote,
  type LiveLoad,
} from '../api/liveLoads';
import { clearSessionToken, saveSessionToken } from '../auth/sessionStore';
import { isSupabaseConfigured, supabase } from '../auth/supabase';
import { loadMarketplacePreferences, saveMarketplacePreferences, type MarketplacePreferences } from '../jobs/marketplacePreferences';
import { getNextStep, statusFlow } from '../jobs/statusFlow';
import type { CanonicalJobStatus, DriverJob } from '../jobs/types';
import { enqueueAction, getQueue, isOnline, saveQueue, updateQueueItem, type QueuedAction } from '../offline/queue';
import { parseDriverDeepLink, targetFromNotificationData, type DriverDeepLinkTarget } from '../push/driverDeepLinks';
import { registerPushToken } from '../push/registerPushToken';
import { classifyTrackingError, publishCurrentDriverLocation, type DriverTrackingState } from '../tracking/nativeLocation';
import { colors, spacing } from '../ui/theme';

type PrimaryTab = 'home' | 'alerts' | 'quotes' | 'bookings' | 'more';
type LoadFeed = 'live' | 'saved' | 'hidden';
type QuoteFeed = 'submitted' | 'accepted' | 'closed';
type BookingFeed = 'current' | 'past7' | 'past14' | 'all';
type JobDetailTab = 'summary' | 'stops' | 'status';
type UtilityPage = 'profile' | 'vehicle' | 'documents' | 'earnings' | 'availability' | 'offline' | 'support';

type AppRoute =
  | { kind: 'primary'; tab: PrimaryTab }
  | { kind: 'load'; load: LiveLoad }
  | { kind: 'quote'; load: LiveLoad }
  | { kind: 'job'; jobId: string }
  | { kind: 'utility'; page: UtilityPage };

type JobStop = {
  id?: string;
  sequence: number;
  type?: string;
  address: string;
  company?: string;
  contactPerson?: string;
  telephone?: string;
  timeWindowFrom?: string;
  timeWindowTo?: string;
  status?: string;
  notes?: string;
  arrivedAt?: string;
  completedAt?: string;
};

type JobDetail = DriverJob & {
  stops?: JobStop[];
  specialInstructions?: string;
  attachments?: Array<Record<string, unknown>>;
  pod?: Record<string, unknown> | null;
  podCompleted?: boolean;
  agreedRateAmount?: number | null;
  budgetAmount?: number | null;
};

const defaultPreferences: MarketplacePreferences = {
  savedJobIds: [],
  hiddenJobIds: [],
  destinationPriorityEnabled: true,
  destinationRadiusMiles: 10,
};

const statusLabels: Record<CanonicalJobStatus, string> = {
  awarded: 'Allocated',
  on_my_way_pickup: 'On My Way to Pickup',
  arrived_pickup: 'On Site Pickup',
  loaded: 'Loaded',
  on_my_way_delivery: 'On My Way to Delivery',
  arrived_delivery: 'On Site Delivery',
  delivered: 'Delivered (POD)',
};

function cleanError(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not supplied';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ageInDays(value: string | null | undefined) {
  const timestamp = new Date(value ?? '').getTime();
  if (!Number.isFinite(timestamp)) return Number.POSITIVE_INFINITY;
  return Math.floor((Date.now() - timestamp) / 86_400_000);
}

function quoteStatus(quote: Record<string, any>) {
  return String(quote.status ?? '').toLowerCase();
}

function quoteBucket(quote: Record<string, any>): QuoteFeed {
  const status = quoteStatus(quote);
  if (['accepted', 'awarded', 'approved'].includes(status)) return 'accepted';
  if (['rejected', 'unsuccessful', 'declined', 'withdrawn', 'expired', 'cancelled'].includes(status)) return 'closed';
  return 'submitted';
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

export default function DriverMobileAppV2() {
  const [token, setToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [route, setRoute] = useState<AppRoute>({ kind: 'primary', tab: 'home' });
  const [activeTab, setActiveTab] = useState<PrimaryTab>('home');
  const [liveFeed, setLiveFeed] = useState<LoadFeed>('live');
  const [quoteFeed, setQuoteFeed] = useState<QuoteFeed>('submitted');
  const [bookingFeed, setBookingFeed] = useState<BookingFeed>('current');
  const [detailTab, setDetailTab] = useState<JobDetailTab>('summary');
  const [message, setMessage] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [liveBusy, setLiveBusy] = useState(false);
  const [resourcesBusy, setResourcesBusy] = useState(false);
  const [bookingsBusy, setBookingsBusy] = useState(false);
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
  const [quoteAmount, setQuoteAmount] = useState('');
  const [quoteMessage, setQuoteMessage] = useState('');
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [podOpen, setPodOpen] = useState(false);
  const [podRecipient, setPodRecipient] = useState('');
  const [podSignature, setPodSignature] = useState('');
  const [podPhotoUri, setPodPhotoUri] = useState('');
  const [podNotes, setPodNotes] = useState('');
  const [trackingState, setTrackingState] = useState<DriverTrackingState>('standby');
  const signatureRef = useRef<any>(null);
  const initialIntentHandledRef = useRef(false);
  const trackingBusyRef = useRef(false);

  const currentJobs = useMemo(() => {
    const merged = [...upcomingJobs, ...activeJobs];
    return [...new Map(merged.map((job) => [job.id, job])).values()];
  }, [activeJobs, upcomingJobs]);

  const trackingJob = useMemo(() => currentJobs.find((job) => job.status !== 'delivered') ?? null, [currentJobs]);

  const refreshLiveLoads = useCallback(async () => {
    setLiveBusy(true);
    try {
      const result = await fetchLiveLoads({
        destinationMode: preferences.destinationPriorityEnabled,
        radiusMiles: preferences.destinationRadiusMiles,
      });
      setLiveLoads(result.jobs);
    } catch (error) {
      setMessage(cleanError(error, 'Unable to load live work.'));
    } finally {
      setLiveBusy(false);
    }
  }, [preferences.destinationPriorityEnabled, preferences.destinationRadiusMiles]);

  const refreshResources = useCallback(async () => {
    setResourcesBusy(true);
    try {
      const next = await fetchDriverResources();
      setResources(next);
      if (next.email) setUserEmail(next.email);
    } catch (error) {
      setMessage(cleanError(error, 'Driver resources are temporarily unavailable.'));
    } finally {
      setResourcesBusy(false);
    }
  }, []);

  const refreshBookings = useCallback(async () => {
    if (!token) return;
    setBookingsBusy(true);
    const results = await Promise.allSettled([
      fetchJobs('active', token),
      fetchJobs('upcoming', token),
      fetchJobs('completed', token),
    ]);
    const [active, upcoming, completed] = results;
    if (active.status === 'fulfilled') setActiveJobs(active.value.jobs.map((job) => ({ ...job, privateDetailsRevealed: true, canUpdateLifecycle: true })));
    if (upcoming.status === 'fulfilled') setUpcomingJobs(upcoming.value.jobs.map((job) => ({ ...job, privateDetailsRevealed: true, canUpdateLifecycle: true })));
    if (completed.status === 'fulfilled') setCompletedJobs(completed.value.jobs.map((job) => ({ ...job, privateDetailsRevealed: true, canUpdateLifecycle: false })));
    const rejected = results.find((result) => result.status === 'rejected');
    if (rejected?.status === 'rejected') setMessage(cleanError(rejected.reason, 'Some bookings could not be refreshed.'));
    setBookingsBusy(false);
  }, [token]);

  const refreshJobDetail = useCallback(async (jobId: string) => {
    setJobDetailBusy(true);
    try {
      setJobDetail(await fetchJobDetail(jobId));
    } catch (error) {
      setMessage(cleanError(error, 'Unable to load this booking.'));
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
    void refreshBookings();
  }, [refreshBookings, refreshResources]);

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
      setRoute({ kind: 'primary', tab: 'home' });
      setActiveTab('home');
      await saveSessionToken(session.access_token).catch(() => undefined);
      await bootstrap(session.access_token, email);
    })().catch((error) => setMessage(cleanError(error, 'Unable to restore the driver session.')));

    void getQueue().then(setQueue).catch(() => setQueue([]));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const next = session?.access_token?.trim() || null;
      setToken(next);
      setUserEmail(session?.user?.email ?? '');
      if (!next) {
        setRoute({ kind: 'primary', tab: 'home' });
        setActiveTab('home');
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
    await refreshBookings();
    if (route.kind === 'job') await refreshJobDetail(route.jobId);
  }, [refreshBookings, refreshJobDetail, route, token]);

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
      .channel('xdrive-driver-v2-live-jobs')
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
        throw new Error('Access denied: only verified XDrive drivers can use this app.');
      }
      const normalizedEmail = session.user.email ?? email.trim();
      setToken(session.access_token);
      setUserEmail(normalizedEmail);
      setRoute({ kind: 'primary', tab: 'home' });
      setActiveTab('home');
      await saveSessionToken(session.access_token).catch(() => undefined);
      // Authenticated UI is entered before optional bootstrap calls. Resource or
      // marketplace failures are displayed inside the workspace, never as a silent login stall.
      void bootstrap(session.access_token, normalizedEmail);
      void refreshLiveLoads();
    } catch (error) {
      setMessage(cleanError(error, 'Unable to sign in.'));
    } finally {
      setAuthBusy(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut().catch(() => undefined);
    await clearSessionToken().catch(() => undefined);
    setToken(null);
    setResources(null);
    setLiveLoads([]);
    setActiveJobs([]);
    setUpcomingJobs([]);
    setCompletedJobs([]);
    setJobDetail(null);
    setMessage('');
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
    setDetailTab('summary');
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
    setActiveTab('alerts');
    if (load) {
      setRoute({ kind: 'load', load });
      setMessage('');
      return;
    }

    setRoute({ kind: 'primary', tab: 'alerts' });
    setMessage('Refreshing Live Loads for this alert.');
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
      void saveMarketplacePreferences(userEmail, next).catch(() => setMessage('Board preference could not be saved.'));
      return next;
    });
  }, [userEmail]);

  function toggleSaved(jobId: string) {
    persistPreferences((current) => ({
      ...current,
      savedJobIds: current.savedJobIds.includes(jobId)
        ? current.savedJobIds.filter((id) => id !== jobId)
        : [...current.savedJobIds, jobId],
    }));
  }

  function hideLoad(jobId: string) {
    persistPreferences((current) => ({
      ...current,
      hiddenJobIds: current.hiddenJobIds.includes(jobId) ? current.hiddenJobIds : [...current.hiddenJobIds, jobId],
    }));
  }

  function restoreLoad(jobId: string) {
    persistPreferences((current) => ({ ...current, hiddenJobIds: current.hiddenJobIds.filter((id) => id !== jobId) }));
  }

  async function submitQuote(load: LiveLoad) {
    if (!editingQuoteId && load.canQuote === false) {
      navigatePrimary('quotes');
      setMessage(load.quoteWarning || 'An active quote already exists for this load. Manage it from Quotes.');
      return;
    }

    const amount = Number(quoteAmount.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage('Enter a valid quote amount.');
      return;
    }
    setActionBusy(true);
    setMessage('');
    try {
      if (editingQuoteId) {
        await updateJobQuote({ bidId: editingQuoteId, amount, message: quoteMessage });
      } else {
        await submitLiveLoadQuote(load.id, amount, quoteMessage);
      }
      const wasEditing = Boolean(editingQuoteId);
      setEditingQuoteId(null);
      setQuoteAmount('');
      setQuoteMessage('');
      await Promise.all([refreshLiveLoads(), refreshResources()]);
      navigatePrimary('quotes');
      setMessage(wasEditing ? 'Quote updated.' : 'Quote submitted.');
    } catch (error) {
      setMessage(cleanError(error, 'Unable to submit this quote.'));
    } finally {
      setActionBusy(false);
    }
  }

  async function withdrawQuote(quote: Record<string, any>) {
    setActionBusy(true);
    try {
      await withdrawJobQuote(String(quote.id));
      await Promise.all([refreshResources(), refreshLiveLoads()]);
      setMessage('Quote withdrawn.');
    } catch (error) {
      setMessage(cleanError(error, 'Unable to withdraw this quote.'));
    } finally {
      setActionBusy(false);
    }
  }

  async function lifecycleAction() {
    if (!token || !jobDetail || actionBusy) return;
    const nextStep = getNextStep(jobDetail.status);
    if (!nextStep) {
      if (jobDetail.status === 'delivered') return;
      setPodOpen(true);
      setDetailTab('status');
      return;
    }

    const apply = async () => {
      setActionBusy(true);
      setMessage('');
      let payload: Record<string, unknown> = {};
      try {
        if (nextStep.status === 'loaded') {
          const permission = await ImagePicker.requestCameraPermissionsAsync();
          if (!permission.granted) throw new Error('Camera permission is required for pickup evidence.');
          const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.78 });
          if (result.canceled || !result.assets[0]?.uri) return;
          payload = { collectionPhotoUri: await persistEvidencePhoto(result.assets[0].uri, jobDetail.id, 'pickup') };
        }

        if (!(await isOnline())) {
          const queued = await enqueueAction({ jobId: jobDetail.id, endpoint: nextStep.endpoint, payload });
          setQueue((current) => [queued, ...current]);
          setMessage(`${nextStep.label} queued. The displayed status will change only after the server confirms it.`);
          return;
        }

        await postJobStatus(jobDetail.id, nextStep.endpoint, token, payload);
        await Promise.all([refreshJobDetail(jobDetail.id), refreshBookings()]);
      } catch (error) {
        setMessage(cleanError(error, 'Unable to update the job status.'));
      } finally {
        setActionBusy(false);
      }
    };

    if (nextStep.requiresConfirmation) {
      Alert.alert('Confirm status', nextStep.label, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => void apply() },
      ]);
    } else {
      await apply();
    }
  }

  async function capturePodPhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setMessage('Camera permission is required for delivery evidence.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!result.canceled && result.assets[0]?.uri) setPodPhotoUri(result.assets[0].uri);
  }

  async function submitPod() {
    if (!token || !jobDetail || actionBusy) return;
    if (!podRecipient.trim()) {
      setMessage('Recipient name is required.');
      return;
    }
    if (!podSignature) {
      signatureRef.current?.readSignature?.();
      setMessage('Save the recipient signature before submitting POD.');
      return;
    }
    if (!podPhotoUri) {
      setMessage('At least one delivery photo is required.');
      return;
    }

    const payload = {
      recipientName: podRecipient.trim(),
      signatureData: podSignature,
      deliveryPhotoUris: [podPhotoUri],
      damagePhotoUris: [],
      documentUris: [],
      notes: podNotes.trim() || undefined,
    };

    setActionBusy(true);
    setMessage('');
    try {
      if (!(await isOnline())) {
        const queued = await enqueueAction({ jobId: jobDetail.id, endpoint: 'pod', payload });
        setQueue((current) => [queued, ...current]);
        setMessage('POD queued securely. The job remains uncompleted until XDrive confirms the upload and delivery status.');
        return;
      }
      await uploadPod(jobDetail.id, token, payload);
      await postJobStatus(jobDetail.id, 'delivered', token);
      setPodOpen(false);
      setPodRecipient('');
      setPodSignature('');
      setPodPhotoUri('');
      setPodNotes('');
      await Promise.all([refreshJobDetail(jobDetail.id), refreshBookings(), refreshResources()]);
      setMessage('POD confirmed and delivery completed.');
    } catch (error) {
      setMessage(cleanError(error, 'Unable to submit POD.'));
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
    liveFeed,
    quoteFeed,
    bookingFeed,
    detailTab,
    resources,
    trackingState,
    onLiveFeed: setLiveFeed,
    onQuoteFeed: setQuoteFeed,
    onBookingFeed: setBookingFeed,
    onDetailTab: setDetailTab,
    onBack: () => navigatePrimary(activeTab),
  });

  const fixedAction = route.kind === 'job' && jobDetail && detailTab === 'status'
    ? <JobFixedAction job={jobDetail} busy={actionBusy} podOpen={podOpen} onPress={() => void lifecycleAction()} />
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
          refreshControl={route.kind === 'primary' && route.tab === 'alerts'
            ? <RefreshControl refreshing={liveBusy} onRefresh={() => void refreshLiveLoads()} colors={[colors.primary]} tintColor={colors.primary} />
            : undefined}
        >
          {message ? <Banner text={message} onDismiss={() => setMessage('')} /> : null}
          {route.kind === 'primary' && route.tab === 'home' ? (
            <HomeBody
              resources={resources}
              liveCount={liveLoads.length}
              currentJobs={currentJobs}
              loading={resourcesBusy || bookingsBusy}
              onLive={() => navigatePrimary('alerts')}
              onBookings={() => navigatePrimary('bookings')}
              onAvailability={() => setRoute({ kind: 'utility', page: 'availability' })}
              onOpenJob={openJob}
            />
          ) : null}

          {route.kind === 'primary' && route.tab === 'alerts' ? (
            <LiveBoard
              loads={liveLoads}
              feed={liveFeed}
              preferences={preferences}
              loading={liveBusy}
              onOpen={(load) => setRoute({ kind: 'load', load })}
              onQuote={(load) => { setEditingQuoteId(null); setQuoteAmount(''); setQuoteMessage(''); setRoute({ kind: 'quote', load }); }}
              onSave={toggleSaved}
              onHide={hideLoad}
              onRestore={restoreLoad}
            />
          ) : null}

          {route.kind === 'primary' && route.tab === 'quotes' ? (
            <QuotesBody
              quotes={resources?.quotes ?? []}
              feed={quoteFeed}
              busy={resourcesBusy || actionBusy}
              onWithdraw={(quote) => Alert.alert('Withdraw quote?', 'This removes the active offer for this load.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Withdraw', style: 'destructive', onPress: () => void withdrawQuote(quote) },
              ])}
              onOpenJob={(quote) => quote.job?.id ? openJob(String(quote.job.id)) : setMessage('The related booking is not available.')}
              onEdit={(quote) => {
                if (!quote.job?.id) return;
                const load = liveLoads.find((item) => item.id === String(quote.job.id));
                if (!load) {
                  setMessage('This quote can be viewed, but the live load is no longer open for editing.');
                  return;
                }
                setEditingQuoteId(String(quote.id));
                setQuoteAmount(String(quote.bid_price_gbp ?? quote.amount ?? ''));
                setQuoteMessage(String(quote.message ?? ''));
                setRoute({ kind: 'quote', load });
              }}
            />
          ) : null}

          {route.kind === 'primary' && route.tab === 'bookings' ? (
            <BookingsBody
              current={currentJobs}
              completed={completedJobs}
              feed={bookingFeed}
              loading={bookingsBusy}
              onOpen={openJob}
            />
          ) : null}

          {route.kind === 'primary' && route.tab === 'more' ? (
            <MoreBody resources={resources} queueCount={queue.length} onOpen={(page) => setRoute({ kind: 'utility', page })} onSignOut={() => void signOut()} />
          ) : null}

          {route.kind === 'load' ? (
            <LoadDetailBody
              load={route.load}
              saved={preferences.savedJobIds.includes(route.load.id)}
              onSave={() => toggleSaved(route.load.id)}
              onQuote={() => { setEditingQuoteId(null); setQuoteAmount(''); setQuoteMessage(''); setRoute({ kind: 'quote', load: route.load }); }}
            />
          ) : null}

          {route.kind === 'quote' ? (
            <QuoteFormBody
              load={route.load}
              amount={quoteAmount}
              message={quoteMessage}
              busy={actionBusy}
              editing={Boolean(editingQuoteId)}
              onAmount={setQuoteAmount}
              onMessage={setQuoteMessage}
              onSubmit={() => void submitQuote(route.load)}
            />
          ) : null}

          {route.kind === 'job' ? (
            jobDetailBusy && !jobDetail
              ? <LoadingCard text="Loading booking..." />
              : jobDetail
                ? <JobDetailBody
                    job={jobDetail}
                    tab={detailTab}
                    podOpen={podOpen}
                    recipient={podRecipient}
                    signature={podSignature}
                    photoUri={podPhotoUri}
                    notes={podNotes}
                    signatureRef={signatureRef}
                    onRecipient={setPodRecipient}
                    onSignature={setPodSignature}
                    onPhoto={() => void capturePodPhoto()}
                    onNotes={setPodNotes}
                    onSubmitPod={() => void submitPod()}
                    onCall={() => jobDetail.contactPhone ? void Linking.openURL(`tel:${jobDetail.contactPhone}`) : undefined}
                    onMap={() => void openExternalRoute(jobDetail)}
                    busy={actionBusy}
                  />
                : <EmptyState title="Booking unavailable" body="Refresh your bookings and try again." />
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
                  setMessage(`Availability updated to ${status}.`);
                } catch (error) {
                  setMessage(cleanError(error, 'Availability could not be updated.'));
                } finally {
                  setActionBusy(false);
                }
              }}
              onFlush={() => void flushOfflineQueue()}
            />
          ) : null}
        </ScrollView>
        {fixedAction}
        <BottomNav active={activeTab} alertCount={liveLoads.length} onChange={navigatePrimary} />
      </View>
    </SafeAreaView>
  );
}

function renderFixedTop(input: {
  route: AppRoute;
  activeTab: PrimaryTab;
  liveFeed: LoadFeed;
  quoteFeed: QuoteFeed;
  bookingFeed: BookingFeed;
  detailTab: JobDetailTab;
  resources: DriverProfileResource | null;
  trackingState: DriverTrackingState;
  onLiveFeed: (feed: LoadFeed) => void;
  onQuoteFeed: (feed: QuoteFeed) => void;
  onBookingFeed: (feed: BookingFeed) => void;
  onDetailTab: (tab: JobDetailTab) => void;
  onBack: () => void;
}) {
  const { route } = input;
  if (route.kind === 'primary' && route.tab === 'home') {
    return <HomeHeader resources={input.resources} trackingState={input.trackingState} />;
  }
  if (route.kind === 'primary' && route.tab === 'alerts') {
    return <View style={styles.topChrome}><ScreenTitle title="Live Loads" /><Segmented<LoadFeed> items={[['live', 'Inbox'], ['saved', 'Saved'], ['hidden', 'Hidden']]} value={input.liveFeed} onChange={input.onLiveFeed} /></View>;
  }
  if (route.kind === 'primary' && route.tab === 'quotes') {
    return <View style={styles.topChrome}><ScreenTitle title="Quotes" /><Segmented<QuoteFeed> items={[['submitted', 'Submitted'], ['accepted', 'Accepted'], ['closed', 'Closed']]} value={input.quoteFeed} onChange={input.onQuoteFeed} /></View>;
  }
  if (route.kind === 'primary' && route.tab === 'bookings') {
    return <View style={styles.topChrome}><ScreenTitle title="Bookings" /><Segmented<BookingFeed> items={[['current', 'Current'], ['past7', 'Past 7 days'], ['past14', 'Past 14'], ['all', 'All']]} value={input.bookingFeed} onChange={input.onBookingFeed} compact /></View>;
  }
  if (route.kind === 'primary' && route.tab === 'more') return <View style={styles.topChrome}><ScreenTitle title="More" /></View>;
  if (route.kind === 'job') {
    return <View style={styles.topChrome}><BackTitle title="Booking" onBack={input.onBack} /><Segmented<JobDetailTab> items={[['summary', 'Summary'], ['stops', 'Stops'], ['status', 'Status']]} value={input.detailTab} onChange={input.onDetailTab} /></View>;
  }
  const title = route.kind === 'load' ? route.load.reference : route.kind === 'quote' ? 'Quote' : route.kind === 'utility' ? utilityTitle(route.page) : 'XDrive Driver';
  return <View style={styles.topChrome}><BackTitle title={title} onBack={input.onBack} /></View>;
}

function LoginScreen({ onSignIn, busy, message }: { onSignIn: (email: string, password: string) => void; busy: boolean; message: string }) {
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
            <Text style={styles.loginHeroBody}>Live loads, clear updates and every delivery step in one place.</Text>
            <View style={styles.networkPill}><View style={styles.networkDot} /><Text style={styles.networkText}>UK-wide driver network</Text></View>
          </View>
        </ImageBackground>
        <View style={styles.loginCard}>
          <Text style={styles.loginTitle}>Welcome back</Text>
          <Text style={styles.loginSubtitle}>Sign in to your verified driver account</Text>
          {message ? <Banner text={message} /> : null}
          <Text style={styles.fieldLabel}>EMAIL</Text>
          <TextInput style={styles.loginInput} autoCapitalize="none" keyboardType="email-address" placeholder="driver@email.com" placeholderTextColor="#8290A7" value={email} onChangeText={setEmail} />
          <Text style={styles.fieldLabel}>PASSWORD</Text>
          <View style={styles.passwordRow}>
            <TextInput style={styles.passwordInput} secureTextEntry={!show} placeholder="Enter your password" placeholderTextColor="#8290A7" value={password} onChangeText={setPassword} />
            <TouchableOpacity style={styles.showButton} onPress={() => setShow((value) => !value)}><Text style={styles.showText}>{show ? 'HIDE' : 'SHOW'}</Text></TouchableOpacity>
          </View>
          <TouchableOpacity style={[styles.primaryButton, (!email || !password || busy) && styles.disabledButton]} disabled={!email || !password || busy} onPress={() => onSignIn(email, password)}>
            <Text style={styles.primaryButtonText}>{busy ? 'Signing in...' : 'Sign in securely'}</Text>
          </TouchableOpacity>
          <View style={styles.loginTrustRow}>
            <TrustItem badge="L" label="Live work" />
            <TrustItem badge="S" label="Secure access" />
            <TrustItem badge="24" label="Driver support" />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function TrustItem({ badge, label }: { badge: string; label: string }) {
  return <View style={styles.trustItem}><View style={styles.trustBadge}><Text style={styles.trustBadgeText}>{badge}</Text></View><Text style={styles.trustText}>{label}</Text></View>;
}

function trackingLabel(state: DriverTrackingState) {
  if (state === 'active') return 'Active';
  if (state === 'starting') return 'Starting';
  if (state === 'permission-required') return 'Permission';
  if (state === 'unavailable') return 'Unavailable';
  return 'Standby';
}

function HomeHeader({ resources, trackingState }: { resources: DriverProfileResource | null; trackingState: DriverTrackingState }) {
  const name = resources?.name || resources?.driver?.display_name || 'XDrive Driver';
  const vehicle = resources?.vehicle?.type || resources?.vehicle?.vehicle_type || resources?.vehicle?.reg_plate || 'Vehicle not assigned';
  const availability = String(resources?.driver?.availability_status ?? 'available');
  return (
    <View style={styles.homeHeader}>
      <View style={styles.homeBrandRow}><View style={styles.roundIcon}><Text style={styles.roundIconText}>ID</Text></View><Text style={styles.xdriveMark}>X<Text style={styles.xdriveBlue}>DRIVE</Text></Text><View style={styles.roundIcon}><Text style={styles.roundIconText}>MSG</Text></View></View>
      <Text style={styles.homeDate}>{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
      <View style={styles.homeGrid}>
        <View style={styles.homeTile}><Text style={styles.homeTileLabel}>DRIVER / VEHICLE</Text><Text style={styles.homeTileValue} numberOfLines={1}>{name}</Text><Text style={styles.homeTileMeta} numberOfLines={1}>{vehicle}</Text></View>
        <View style={styles.homeTileSmall}><Text style={styles.homeTileLabel}>TRACKING</Text><Text style={trackingState === 'active' ? styles.trackingOn : styles.trackingStandby}>● {trackingLabel(trackingState)}</Text></View>
      </View>
      <View style={styles.statusRow}><View><Text style={styles.homeTileLabel}>STATUS</Text><Text style={styles.statusValue}>{availability.replace('_', ' ')}</Text></View><Text style={styles.chevron}>›</Text></View>
    </View>
  );
}

function HomeBody({ resources, liveCount, currentJobs, loading, onLive, onBookings, onAvailability, onOpenJob }: {
  resources: DriverProfileResource | null;
  liveCount: number;
  currentJobs: DriverJob[];
  loading: boolean;
  onLive: () => void;
  onBookings: () => void;
  onAvailability: () => void;
  onOpenJob: (id: string) => void;
}) {
  return <View style={styles.stack}>
    <View style={styles.quickRow}>
      <QuickButton label="Search" onPress={onLive} />
      <QuickButton label="Network" onPress={onLive} />
      <QuickButton label="Journeys" onPress={onBookings} />
    </View>
    <View style={styles.metricRow}>
      <MetricCard value={String(liveCount)} label="Live loads" onPress={onLive} />
      <MetricCard value={String(currentJobs.length)} label="Current jobs" onPress={onBookings} />
      <MetricCard value={String((resources?.quotes ?? []).filter((quote) => quoteBucket(quote) === 'submitted').length)} label="Open quotes" />
    </View>
    {loading ? <LoadingCard text="Updating your driver workspace..." /> : null}
    {currentJobs[0] ? <Section title="Next booking"><BookingCard job={currentJobs[0]} onPress={() => onOpenJob(currentJobs[0].id)} /></Section> : <EmptyState title="No current booking" body="Allocated jobs will appear here as soon as they are assigned to you." />}
    <TouchableOpacity style={styles.secondaryButton} onPress={onAvailability}><Text style={styles.secondaryButtonText}>Update driver availability</Text></TouchableOpacity>
  </View>;
}

function LiveBoard({ loads, feed, preferences, loading, onOpen, onQuote, onSave, onHide, onRestore }: {
  loads: LiveLoad[];
  feed: LoadFeed;
  preferences: MarketplacePreferences;
  loading: boolean;
  onOpen: (load: LiveLoad) => void;
  onQuote: (load: LiveLoad) => void;
  onSave: (id: string) => void;
  onHide: (id: string) => void;
  onRestore: (id: string) => void;
}) {
  const visible = loads.filter((load) => !preferences.hiddenJobIds.includes(load.id));
  const displayed = feed === 'saved'
    ? visible.filter((load) => preferences.savedJobIds.includes(load.id))
    : feed === 'hidden'
      ? loads.filter((load) => preferences.hiddenJobIds.includes(load.id))
      : visible;
  if (loading && loads.length === 0) return <LoadingCard text="Loading live work..." />;
  if (displayed.length === 0) return <EmptyState title={feed === 'live' ? 'No live loads' : feed === 'saved' ? 'No saved loads' : 'No hidden loads'} body={feed === 'live' ? 'Eligible marketplace loads will appear here automatically.' : 'Use the load controls to manage this board.'} />;
  return <View style={styles.stack}>{displayed.map((load) => <LiveCard key={load.id} load={load} saved={preferences.savedJobIds.includes(load.id)} hidden={feed === 'hidden'} onOpen={() => onOpen(load)} onQuote={() => onQuote(load)} onSave={() => onSave(load.id)} onHide={() => onHide(load.id)} onRestore={() => onRestore(load.id)} />)}</View>;
}

function LiveCard({ load, saved, hidden, onOpen, onQuote, onSave, onHide, onRestore }: {
  load: LiveLoad;
  saved: boolean;
  hidden: boolean;
  onOpen: () => void;
  onQuote: () => void;
  onSave: () => void;
  onHide: () => void;
  onRestore: () => void;
}) {
  const company = load.postingCompanyName || 'Verified marketplace member';
  return <TouchableOpacity style={styles.loadCard} onPress={onOpen} activeOpacity={0.92}>
    <View style={styles.companyRow}><View style={styles.verifiedBadge}><Text style={styles.verifiedText}>✓</Text></View><View style={styles.companyTextWrap}><Text style={styles.companyName} numberOfLines={1}>{company}</Text><Text style={styles.companyMeta}>{load.postingCompanyMemberCode ? `Member ${load.postingCompanyMemberCode} · ` : ''}{load.vehicleRequirement}</Text></View></View>
    <View style={styles.chipRow}><Chip label="NEW" tone="green" />{load.destinationPriority ? <Chip label="RETURN IQ" tone="blue" /> : null}{load.publicPricePublished ? <Chip label="PRICE VISIBLE" tone="orange" /> : null}</View>
    <RouteCard pickup={load.pickupLocation} pickupTime={load.pickupTime} delivery={load.deliveryLocation} deliveryTime={load.deliveryTime} />
    <View style={styles.loadSummaryRow}><View style={styles.flexOne}><Text style={styles.eyebrow}>LOAD</Text><Text style={styles.summaryText} numberOfLines={2}>{load.cargoType}</Text></View>{load.price ? <View><Text style={styles.eyebrow}>PRICE</Text><Text style={styles.priceText}>{load.price}</Text></View> : null}</View>
    <View style={styles.cardActions}>
      {hidden ? <SmallAction label="Restore" onPress={onRestore} /> : <><SmallAction label={saved ? 'Saved ✓' : 'Save'} onPress={onSave} /><SmallAction label="Hide" onPress={onHide} /></>}
      {!hidden ? <TouchableOpacity style={[styles.quoteButton, load.canQuote === false && styles.disabledButton]} disabled={load.canQuote === false} onPress={onQuote}><Text style={styles.quoteButtonText}>{load.canQuote === false ? 'Quoted' : 'Quote'}</Text></TouchableOpacity> : null}
    </View>
    {load.canQuote === false && load.quoteWarning ? <Text style={styles.inlineWarning}>{load.quoteWarning}</Text> : null}
  </TouchableOpacity>;
}

function LoadDetailBody({ load, saved, onSave, onQuote }: { load: LiveLoad; saved: boolean; onSave: () => void; onQuote: () => void }) {
  return <View style={styles.stack}>
    <Section>
      <View style={styles.companyRow}><View style={styles.verifiedBadge}><Text style={styles.verifiedText}>✓</Text></View><View style={styles.companyTextWrap}><Text style={styles.companyName}>{load.postingCompanyName || 'Marketplace member'}</Text><Text style={styles.companyMeta}>{load.postingCompanyMemberCode || load.reference}</Text></View></View>
      <RouteCard pickup={load.pickupLocation} pickupTime={load.pickupTime} delivery={load.deliveryLocation} deliveryTime={load.deliveryTime} />
      <InfoRow label="Vehicle" value={load.vehicleRequirement} />
      <InfoRow label="Freight" value={load.cargoType} />
      {load.price ? <InfoRow label="Published price" value={load.price} /> : null}
      {load.destinationPriority && load.distanceFromCurrentDeliveryMiles != null ? <InfoRow label="From current delivery" value={`${load.distanceFromCurrentDeliveryMiles.toFixed(1)} miles`} /> : null}
    </Section>
    <Banner text="Exact street addresses and private contacts remain protected until allocation." />
    {load.canQuote === false && load.quoteWarning ? <Banner text={load.quoteWarning} /> : null}
    <View style={styles.cardActions}><SmallAction label={saved ? 'Saved ✓' : 'Save load'} onPress={onSave} /><TouchableOpacity style={[styles.primaryInlineButton, load.canQuote === false && styles.disabledButton]} disabled={load.canQuote === false} onPress={onQuote}><Text style={styles.primaryInlineText}>{load.canQuote === false ? 'Quote already submitted' : 'Quote this load'}</Text></TouchableOpacity></View>
  </View>;
}

function QuoteFormBody({ load, amount, message, busy, editing, onAmount, onMessage, onSubmit }: {
  load: LiveLoad;
  amount: string;
  message: string;
  busy: boolean;
  editing: boolean;
  onAmount: (value: string) => void;
  onMessage: (value: string) => void;
  onSubmit: () => void;
}) {
  const blocked = !editing && load.canQuote === false;
  return <View style={styles.stack}>
    <Section><RouteCard pickup={load.pickupLocation} pickupTime={load.pickupTime} delivery={load.deliveryLocation} deliveryTime={load.deliveryTime} /><InfoRow label="Vehicle" value={load.vehicleRequirement} /><InfoRow label="Freight" value={load.cargoType} /></Section>
    {blocked ? <Banner text={load.quoteWarning || 'An active quote already exists for this load. Manage it from Quotes.'} /> : null}
    <Section title={editing ? 'Edit quote' : 'My quote (ex. VAT)'}>
      <Text style={styles.fieldLabel}>AMOUNT · GBP</Text>
      <TextInput style={styles.bigInput} keyboardType="decimal-pad" placeholder="£0.00" placeholderTextColor="#98A2B3" value={amount} onChangeText={onAmount} editable={!blocked} />
      <Text style={styles.fieldLabel}>COLLECTION / OFFER NOTES</Text>
      <TextInput style={[styles.bigInput, styles.textarea]} multiline placeholder="Optional notes" placeholderTextColor="#98A2B3" value={message} onChangeText={onMessage} editable={!blocked} />
    </Section>
    <TouchableOpacity style={[styles.primaryButton, (busy || blocked) && styles.disabledButton]} disabled={busy || blocked} onPress={onSubmit}><Text style={styles.primaryButtonText}>{blocked ? 'Quote already submitted' : busy ? 'Submitting...' : editing ? 'Save quote' : 'Submit quote'}</Text></TouchableOpacity>
  </View>;
}

function QuotesBody({ quotes, feed, busy, onWithdraw, onOpenJob, onEdit }: {
  quotes: Array<Record<string, any>>;
  feed: QuoteFeed;
  busy: boolean;
  onWithdraw: (quote: Record<string, any>) => void;
  onOpenJob: (quote: Record<string, any>) => void;
  onEdit: (quote: Record<string, any>) => void;
}) {
  const filtered = quotes.filter((quote) => quoteBucket(quote) === feed);
  if (busy && quotes.length === 0) return <LoadingCard text="Loading quotes..." />;
  if (filtered.length === 0) return <EmptyState title={`No ${feed} quotes`} body="Your quote history will move between these sections as customers respond." />;
  return <View style={styles.stack}>{filtered.map((quote) => {
    const job = quote.job ? mapResourceJob(quote.job, false, quote.job.private_details_revealed === true) : null;
    const amount = formatMoney(quote.bid_price_gbp ?? quote.amount, quote.currency || 'GBP') || 'Amount not supplied';
    const bucket = quoteBucket(quote);
    return <View key={String(quote.id)} style={styles.quoteCard}>
      <View style={styles.quoteHeader}><View><Text style={styles.companyName}>{job?.postingCompanyName || 'Marketplace quote'}</Text><Text style={styles.companyMeta}>{job?.reference || String(quote.job_id ?? '')}</Text></View><Chip label={bucket.toUpperCase()} tone={bucket === 'accepted' ? 'green' : bucket === 'closed' ? 'red' : 'blue'} /></View>
      {job ? <RouteCard pickup={job.pickupLocation} pickupTime={job.pickupTime} delivery={job.deliveryLocation} deliveryTime={job.deliveryTime} /> : null}
      <View style={styles.quoteAmountPanel}><Text style={styles.eyebrow}>YOUR QUOTE</Text><Text style={styles.quoteAmount}>{amount}</Text></View>
      <View style={styles.cardActions}>{bucket === 'submitted' ? <><SmallAction label="Edit" onPress={() => onEdit(quote)} /><SmallAction label="Withdraw" onPress={() => onWithdraw(quote)} /></> : null}{bucket === 'accepted' ? <TouchableOpacity style={styles.primaryInlineButton} onPress={() => onOpenJob(quote)}><Text style={styles.primaryInlineText}>Open booking</Text></TouchableOpacity> : null}</View>
    </View>;
  })}</View>;
}

function BookingsBody({ current, completed, feed, loading, onOpen }: { current: DriverJob[]; completed: DriverJob[]; feed: BookingFeed; loading: boolean; onOpen: (id: string) => void }) {
  let jobs = feed === 'current' ? current : completed;
  if (feed === 'past7') jobs = completed.filter((job) => ageInDays(job.deliveryTime) <= 7);
  if (feed === 'past14') jobs = completed.filter((job) => ageInDays(job.deliveryTime) <= 14);
  if (feed === 'all') jobs = [...current, ...completed];
  if (loading && jobs.length === 0) return <LoadingCard text="Loading bookings..." />;
  if (jobs.length === 0) return <EmptyState title="No bookings" body={feed === 'current' ? 'Jobs allocated to you will appear here.' : 'No completed bookings match this period.'} />;
  return <View style={styles.stack}>{jobs.map((job) => <BookingCard key={job.id} job={job} onPress={() => onOpen(job.id)} />)}</View>;
}

function BookingCard({ job, onPress }: { job: DriverJob; onPress: () => void }) {
  return <TouchableOpacity style={styles.bookingCard} onPress={onPress} activeOpacity={0.92}>
    <View style={styles.quoteHeader}><View style={styles.flexOne}><Text style={styles.companyName} numberOfLines={1}>{job.postingCompanyName || 'XDrive booking'}</Text><Text style={styles.companyMeta}>{job.reference}</Text></View><Chip label={statusLabels[job.status]} tone={job.status === 'delivered' ? 'green' : 'blue'} /></View>
    <RouteCard pickup={job.pickupLocation} pickupTime={job.pickupTime} delivery={job.deliveryLocation} deliveryTime={job.deliveryTime} />
    <View style={styles.loadSummaryRow}><Text style={styles.summaryText}>{job.vehicleRequirement}</Text>{job.price ? <Text style={styles.priceText}>{job.price}</Text> : null}</View>
  </TouchableOpacity>;
}

function JobDetailBody({ job, tab, podOpen, recipient, signature, photoUri, notes, signatureRef, onRecipient, onSignature, onPhoto, onNotes, onSubmitPod, onCall, onMap, busy }: {
  job: JobDetail;
  tab: JobDetailTab;
  podOpen: boolean;
  recipient: string;
  signature: string;
  photoUri: string;
  notes: string;
  signatureRef: React.MutableRefObject<any>;
  onRecipient: (value: string) => void;
  onSignature: (value: string) => void;
  onPhoto: () => void;
  onNotes: (value: string) => void;
  onSubmitPod: () => void;
  onCall: () => void;
  onMap: () => void;
  busy: boolean;
}) {
  if (tab === 'summary') return <JobSummary job={job} onCall={onCall} onMap={onMap} />;
  if (tab === 'stops') return <StopsView job={job} />;
  return <View style={styles.stack}>
    <Section>
      <Text style={styles.companyName}>{job.postingCompanyName || 'XDrive booking'}</Text><Text style={styles.companyMeta}>{job.reference}</Text>
      <StatusTimeline job={job} />
    </Section>
    {podOpen ? <PodPanel job={job} recipient={recipient} signature={signature} photoUri={photoUri} notes={notes} signatureRef={signatureRef} onRecipient={onRecipient} onSignature={onSignature} onPhoto={onPhoto} onNotes={onNotes} onSubmit={onSubmitPod} busy={busy} /> : null}
  </View>;
}

function JobSummary({ job, onCall, onMap }: { job: JobDetail; onCall: () => void; onMap: () => void }) {
  return <View style={styles.stack}>
    <Section>
      <Text style={styles.companyName}>{job.postingCompanyName || 'XDrive booking'}</Text><Text style={styles.companyMeta}>{job.reference}</Text>
      {job.contactAllowed ? <View style={styles.dualActions}><TouchableOpacity style={styles.blueAction} onPress={onCall}><Text style={styles.blueActionText}>Call</Text></TouchableOpacity><TouchableOpacity style={styles.blueAction} onPress={() => Alert.alert('Messaging', 'Secure job messaging will appear here when the production messaging contract is enabled.')}><Text style={styles.blueActionText}>Message</Text></TouchableOpacity></View> : null}
      <RouteCard pickup={job.pickupLocation} pickupTime={job.pickupTime} delivery={job.deliveryLocation} deliveryTime={job.deliveryTime} />
      <TouchableOpacity style={styles.blueActionFull} onPress={onMap}><Text style={styles.blueActionText}>Open route</Text></TouchableOpacity>
      <InfoRow label="Vehicle" value={job.vehicleRequirement} />
      <InfoRow label="Load" value={job.cargoType} />
      {job.price ? <InfoRow label="Agreed rate" value={job.price} /> : null}
    </Section>
    {job.specialInstructions ? <Section title="Driver instructions"><Text style={styles.longText}>{job.specialInstructions}</Text></Section> : null}
    {(job.attachments ?? []).length > 0 ? <Section title="Attachments">{(job.attachments ?? []).map((attachment, index) => <View key={String(attachment.id ?? index)} style={styles.attachmentRow}><Text style={styles.attachmentIcon}>DOC</Text><Text style={styles.attachmentText} numberOfLines={2}>{String(attachment.name ?? attachment.fileName ?? attachment.file_name ?? `Attachment ${index + 1}`)}</Text></View>)}</Section> : null}
    {job.podCompleted ? <Banner text="POD is stored and server-confirmed for this booking." /> : null}
  </View>;
}

function StopsView({ job }: { job: JobDetail }) {
  const stops: JobStop[] = (job.stops && job.stops.length > 0) ? job.stops : [
    { sequence: 1, type: 'collection', address: job.pickupLocation, timeWindowFrom: job.pickupTime },
    { sequence: 2, type: 'delivery', address: job.deliveryLocation, timeWindowFrom: job.deliveryTime },
  ];
  return <Section>{stops.map((stop, index) => <View key={stop.id ?? `${stop.sequence}-${index}`} style={styles.stopDetailRow}><View style={styles.stopNumber}><Text style={styles.stopNumberText}>{stop.sequence || index + 1}</Text></View><View style={styles.flexOne}><Text style={styles.stopTitle}>{stop.type === 'collection' ? 'Collection Details' : stop.type === 'delivery' ? 'Delivery Details' : `Stop ${index + 1}`}</Text><Text style={styles.stopTime}>{formatDate(stop.timeWindowFrom)}{stop.timeWindowTo ? ` – ${formatDate(stop.timeWindowTo)}` : ''}</Text>{stop.company ? <Text style={styles.stopMeta}>{stop.company}</Text> : null}<Text style={styles.stopAddress}>{stop.address}</Text>{stop.contactPerson ? <Text style={styles.stopMeta}>Contact: {stop.contactPerson}{stop.telephone ? ` · ${stop.telephone}` : ''}</Text> : null}{stop.notes ? <Text style={styles.stopNote}>{stop.notes}</Text> : null}</View></View>)}</Section>;
}

function StatusTimeline({ job }: { job: JobDetail }) {
  const order: CanonicalJobStatus[] = ['awarded', ...statusFlow.map((step) => step.status), 'delivered'];
  const currentIndex = order.indexOf(job.status);
  return <View style={styles.timeline}>{order.map((status, index) => {
    const completed = index <= currentIndex;
    const current = status === job.status;
    return <View key={status} style={styles.timelineRow}><View style={[styles.timelineDot, completed && styles.timelineDotDone, current && styles.timelineDotCurrent]}><Text style={styles.timelineDotText}>{completed ? '✓' : '·'}</Text></View><View style={styles.flexOne}><Text style={[styles.timelineLabel, current && styles.timelineLabelCurrent]}>{statusLabels[status]}</Text><Text style={styles.timelineMeta}>{current ? 'Current server-confirmed status' : completed ? 'Completed' : 'Pending'}</Text></View></View>;
  })}</View>;
}

function PodPanel({ job, recipient, signature, photoUri, notes, signatureRef, onRecipient, onSignature, onPhoto, onNotes, onSubmit, busy }: {
  job: JobDetail;
  recipient: string;
  signature: string;
  photoUri: string;
  notes: string;
  signatureRef: React.MutableRefObject<any>;
  onRecipient: (value: string) => void;
  onSignature: (value: string) => void;
  onPhoto: () => void;
  onNotes: (value: string) => void;
  onSubmit: () => void;
  busy: boolean;
}) {
  return <Section title="Proof of Delivery">
    <Text style={styles.fieldLabel}>RECEIVED BY</Text><TextInput style={styles.bigInput} value={recipient} onChangeText={onRecipient} placeholder="Full recipient name" placeholderTextColor="#98A2B3" />
    <Text style={styles.fieldLabel}>RECIPIENT SIGNATURE</Text>
    <View style={styles.signatureBox}><SignatureCanvas ref={signatureRef} onOK={onSignature} onEmpty={() => undefined} descriptionText="Sign above" clearText="Clear" confirmText="Save signature" webStyle=".m-signature-pad--footer {display:flex; gap:8px;} body,html {width:100%;height:100%;}" /></View>
    <Text style={styles.savedState}>{signature ? 'Signature saved ✓' : 'Signature not saved yet'}</Text>
    <TouchableOpacity style={styles.secondaryButton} onPress={onPhoto}><Text style={styles.secondaryButtonText}>{photoUri ? 'Delivery photo captured ✓' : 'Capture delivery photo'}</Text></TouchableOpacity>
    <Text style={styles.fieldLabel}>NOTES</Text><TextInput style={[styles.bigInput, styles.textarea]} multiline value={notes} onChangeText={onNotes} placeholder="Optional POD notes" placeholderTextColor="#98A2B3" />
    <Banner text={job.podRequired ? 'POD requires recipient name, signature and at least one delivery photo.' : 'Evidence is server-verified before delivery is marked complete.'} />
    <TouchableOpacity style={[styles.primaryButton, busy && styles.disabledButton]} disabled={busy} onPress={onSubmit}><Text style={styles.primaryButtonText}>{busy ? 'Submitting...' : 'Submit POD & complete delivery'}</Text></TouchableOpacity>
  </Section>;
}

function JobFixedAction({ job, busy, podOpen, onPress }: { job: JobDetail; busy: boolean; podOpen: boolean; onPress: () => void }) {
  if (podOpen || job.status === 'delivered') return null;
  const next = getNextStep(job.status);
  const label = next?.label || 'Capture POD';
  return <View style={styles.fixedAction}><TouchableOpacity style={[styles.fixedActionButton, busy && styles.disabledButton]} disabled={busy} onPress={onPress}><Text style={styles.fixedActionText}>{busy ? 'Updating...' : label}</Text></TouchableOpacity></View>;
}

function MoreBody({ resources, queueCount, onOpen, onSignOut }: { resources: DriverProfileResource | null; queueCount: number; onOpen: (page: UtilityPage) => void; onSignOut: () => void }) {
  const tiles: Array<[UtilityPage, string, string]> = [
    ['profile', 'Profile', resources?.name || 'Driver account'],
    ['vehicle', 'Vehicle', resources?.vehicle?.reg_plate || 'Assigned vehicle'],
    ['documents', 'Documents', `${resources?.documents?.length ?? 0} records`],
    ['earnings', 'Earnings', `${resources?.invoices?.length ?? 0} invoices`],
    ['availability', 'Availability', String(resources?.driver?.availability_status ?? 'available')],
    ['offline', 'Offline queue', `${queueCount} pending`],
    ['support', 'Help & Support', 'Driver support'],
  ];
  return <View style={styles.stack}><View style={styles.utilityGrid}>{tiles.map(([page, title, subtitle]) => <TouchableOpacity key={page} style={styles.utilityTile} onPress={() => onOpen(page)}><View style={styles.utilityGlyph}><Text style={styles.utilityGlyphText}>{title.slice(0, 2).toUpperCase()}</Text></View><Text style={styles.utilityTitle}>{title}</Text><Text style={styles.utilityMeta} numberOfLines={1}>{subtitle}</Text></TouchableOpacity>)}</View><TouchableOpacity style={styles.signOutButton} onPress={onSignOut}><Text style={styles.signOutText}>Sign out</Text></TouchableOpacity></View>;
}

function UtilityBody({ page, resources, queue, busy, onAvailability, onFlush }: {
  page: UtilityPage;
  resources: DriverProfileResource | null;
  queue: QueuedAction[];
  busy: boolean;
  onAvailability: (status: 'available' | 'busy' | 'offline') => Promise<void>;
  onFlush: () => void;
}) {
  if (page === 'profile') return <Section title="Driver profile"><InfoRow label="Name" value={resources?.name || 'Not supplied'} /><InfoRow label="Email" value={resources?.email || 'Not supplied'} /><InfoRow label="Phone" value={resources?.phone || 'Not supplied'} /><InfoRow label="Company" value={resources?.company?.name || 'Not supplied'} /></Section>;
  if (page === 'vehicle') return <Section title="Assigned vehicle"><InfoRow label="Registration" value={resources?.vehicle?.reg_plate || 'Not supplied'} /><InfoRow label="Type" value={resources?.vehicle?.type || resources?.vehicle?.vehicle_type || 'Not supplied'} /><InfoRow label="Make / model" value={[resources?.vehicle?.make, resources?.vehicle?.model].filter(Boolean).join(' ') || 'Not supplied'} /><InfoRow label="Payload" value={resources?.vehicle?.payload_kg ? `${resources.vehicle.payload_kg} kg` : 'Not supplied'} /></Section>;
  if (page === 'documents') return <Section title="Documents">{(resources?.documents ?? []).length === 0 ? <EmptyState title="No documents" body="Driver and vehicle documents will appear here." /> : (resources?.documents ?? []).map((doc, index) => <View key={String(doc.id ?? index)} style={styles.attachmentRow}><Text style={styles.attachmentIcon}>DOC</Text><View style={styles.flexOne}><Text style={styles.attachmentText}>{String(doc.doc_type ?? 'Document')}</Text><Text style={styles.companyMeta}>{String(doc.status ?? '')}{doc.expiry_date ? ` · expires ${formatDate(doc.expiry_date)}` : ''}</Text></View></View>)}</Section>;
  if (page === 'earnings') return <Section title="Invoices / earnings">{(resources?.invoices ?? []).length === 0 ? <EmptyState title="No invoices" body="Completed marketplace invoices will appear here." /> : (resources?.invoices ?? []).map((invoice, index) => <View key={String(invoice.id ?? index)} style={styles.invoiceRow}><View><Text style={styles.attachmentText}>{String(invoice.invoice_number ?? `Invoice ${index + 1}`)}</Text><Text style={styles.companyMeta}>{String(invoice.client_name ?? '')}</Text></View><Text style={styles.priceText}>{formatMoney(invoice.amount, invoice.currency || 'GBP')}</Text></View>)}</Section>;
  if (page === 'availability') return <Section title="Driver availability"><Text style={styles.longText}>Your availability is used by XDrive to decide whether you should receive suitable work and operational alerts.</Text><View style={styles.stack}>{(['available', 'busy', 'offline'] as const).map((status) => <TouchableOpacity key={status} style={[styles.secondaryButton, busy && styles.disabledButton]} disabled={busy} onPress={() => void onAvailability(status)}><Text style={styles.secondaryButtonText}>{status[0].toUpperCase() + status.slice(1)}</Text></TouchableOpacity>)}</View></Section>;
  if (page === 'offline') return <Section title="Offline queue">{queue.length === 0 ? <EmptyState title="Everything is synced" body="No driver actions are waiting for server confirmation." /> : queue.map((item) => <View key={item.id} style={styles.queueRow}><View style={styles.flexOne}><Text style={styles.attachmentText}>{item.endpoint}</Text><Text style={styles.companyMeta}>{item.jobId} · {item.status}</Text>{item.lastError ? <Text style={styles.errorText}>{item.lastError}</Text> : null}</View></View>)}<TouchableOpacity style={styles.primaryButton} onPress={onFlush}><Text style={styles.primaryButtonText}>Retry sync now</Text></TouchableOpacity></Section>;
  return <Section title="Help & Support"><Text style={styles.longText}>For urgent operational issues, use the verified XDrive support channel from your account. This Preview does not invent an unverified chat endpoint.</Text><TouchableOpacity style={styles.secondaryButton} onPress={() => void Linking.openURL('mailto:xdrivelogisticsltd@gmail.com')}><Text style={styles.secondaryButtonText}>Email XDrive support</Text></TouchableOpacity></Section>;
}

function ScreenTitle({ title }: { title: string }) { return <View style={styles.screenTitleRow}><Text style={styles.screenTitle}>{title}</Text><Text style={styles.screenBrand}>XDRIVE DRIVER</Text></View>; }
function BackTitle({ title, onBack }: { title: string; onBack: () => void }) { return <View style={styles.backTitleRow}><TouchableOpacity style={styles.backButton} onPress={onBack}><Text style={styles.backText}>‹</Text></TouchableOpacity><Text style={styles.backTitle}>{title}</Text><View style={styles.backSpacer} /></View>; }

function Segmented<T extends string>({ items, value, onChange, compact = false }: { items: Array<[T, string]>; value: T; onChange: (value: T) => void; compact?: boolean }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.segmented, compact && styles.segmentedCompact]}>{items.map(([key, label]) => <TouchableOpacity key={key} style={[styles.segment, value === key && styles.segmentActive]} onPress={() => onChange(key)}><Text style={[styles.segmentText, value === key && styles.segmentTextActive]}>{label}</Text></TouchableOpacity>)}</ScrollView>;
}

function BottomNav({ active, alertCount, onChange }: { active: PrimaryTab; alertCount: number; onChange: (tab: PrimaryTab) => void }) {
  const items: Array<[PrimaryTab, string, string]> = [['home', 'Home', '⌂'], ['alerts', 'Alerts', '◉'], ['quotes', 'Quotes', '◇'], ['bookings', 'Bookings', '▣'], ['more', 'More', '•••']];
  return <View style={styles.bottomNav}>{items.map(([key, label, glyph]) => <TouchableOpacity key={key} style={styles.navItem} onPress={() => onChange(key)}><View style={styles.navGlyphWrap}><Text style={[styles.navGlyph, active === key && styles.navActive]}>{glyph}</Text>{key === 'alerts' && alertCount > 0 ? <View style={styles.navBadge}><Text style={styles.navBadgeText}>{Math.min(99, alertCount)}</Text></View> : null}</View><Text style={[styles.navLabel, active === key && styles.navActive]}>{label}</Text></TouchableOpacity>)}</View>;
}

function RouteCard({ pickup, pickupTime, delivery, deliveryTime }: { pickup: string; pickupTime: string; delivery: string; deliveryTime: string }) {
  return <View style={styles.routeCard}><RouteStop number="1" location={pickup} time={pickupTime} /><View style={styles.routeConnector}><View style={styles.connectorDot} /><View style={styles.connectorDot} /><View style={styles.connectorDot} /></View><RouteStop number="2" location={delivery} time={deliveryTime} delivery /></View>;
}

function RouteStop({ number, location, time, delivery = false }: { number: string; location: string; time: string; delivery?: boolean }) {
  return <View style={styles.routeStop}><View style={[styles.routeMarker, delivery && styles.routeMarkerDelivery]}><Text style={styles.routeMarkerText}>{number}</Text></View><View style={styles.flexOne}><Text style={styles.routeLocation}>{location}</Text><Text style={styles.routeTime}>{formatDate(time)}</Text></View></View>;
}

function Section({ title, children }: { title?: string; children: ReactNode }) { return <View style={styles.section}>{title ? <Text style={styles.sectionTitle}>{title}</Text> : null}{children}</View>; }
function InfoRow({ label, value }: { label: string; value: string }) { return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>; }
function Banner({ text, onDismiss }: { text: string; onDismiss?: () => void }) { return <TouchableOpacity activeOpacity={onDismiss ? 0.75 : 1} onPress={onDismiss} style={styles.banner}><Text style={styles.bannerText}>{text}</Text>{onDismiss ? <Text style={styles.bannerDismiss}>×</Text> : null}</TouchableOpacity>; }
function EmptyState({ title, body }: { title: string; body: string }) { return <View style={styles.emptyState}><View style={styles.emptyGlyph}><Text style={styles.emptyGlyphText}>XD</Text></View><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyBody}>{body}</Text></View>; }
function LoadingCard({ text }: { text: string }) { return <View style={styles.loadingCard}><Text style={styles.loadingText}>{text}</Text></View>; }
function QuickButton({ label, onPress }: { label: string; onPress: () => void }) { return <TouchableOpacity style={styles.quickButton} onPress={onPress}><Text style={styles.quickText}>{label}</Text></TouchableOpacity>; }
function MetricCard({ value, label, onPress }: { value: string; label: string; onPress?: () => void }) { return <TouchableOpacity style={styles.metricCard} onPress={onPress} disabled={!onPress}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></TouchableOpacity>; }
function SmallAction({ label, onPress }: { label: string; onPress: () => void }) { return <TouchableOpacity style={styles.smallAction} onPress={onPress}><Text style={styles.smallActionText}>{label}</Text></TouchableOpacity>; }
function Chip({ label, tone }: { label: string; tone: 'green' | 'blue' | 'orange' | 'red' }) { const toneStyle = tone === 'green' ? styles.chipGreen : tone === 'blue' ? styles.chipBlue : tone === 'red' ? styles.chipRed : styles.chipOrange; return <View style={[styles.chip, toneStyle]}><Text style={styles.chipText}>{label}</Text></View>; }

function utilityTitle(page: UtilityPage) {
  return page === 'profile' ? 'Profile' : page === 'vehicle' ? 'Vehicle' : page === 'documents' ? 'Documents' : page === 'earnings' ? 'Earnings' : page === 'availability' ? 'Availability' : page === 'offline' ? 'Offline Queue' : 'Help & Support';
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
  bodyWithAction: { paddingBottom: 118 },
  topChrome: { backgroundColor: colors.secondary, paddingHorizontal: spacing.md, paddingTop: 10, paddingBottom: 12, gap: 12 },
  screenTitleRow: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  screenTitle: { color: '#FFFFFF', fontSize: 23, fontWeight: '800' },
  screenBrand: { color: '#BFD1F7', fontSize: 10, fontWeight: '800', letterSpacing: 1.8, marginTop: 2 },
  backTitleRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backText: { color: '#FFFFFF', fontSize: 38, lineHeight: 40, fontWeight: '300' },
  backTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  backSpacer: { width: 44 },
  segmented: { backgroundColor: '#173B73', borderRadius: 18, padding: 4, gap: 3, minWidth: '100%' },
  segmentedCompact: { minWidth: 440 },
  segment: { minHeight: 44, minWidth: 100, flexGrow: 1, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  segmentActive: { backgroundColor: '#FFFFFF' },
  segmentText: { color: '#D7E3F8', fontSize: 14, fontWeight: '700' },
  segmentTextActive: { color: colors.secondary, fontWeight: '900' },
  bottomNav: { minHeight: 76, flexDirection: 'row', backgroundColor: '#FFFFFF', borderTopColor: colors.borderSubtle, borderTopWidth: 1, paddingTop: 8, paddingBottom: 7 },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  navGlyphWrap: { minWidth: 34, height: 28, alignItems: 'center', justifyContent: 'center' },
  navGlyph: { color: '#475467', fontSize: 24, fontWeight: '700' },
  navLabel: { color: '#475467', fontSize: 11, fontWeight: '700' },
  navActive: { color: colors.primary },
  navBadge: { position: 'absolute', right: -5, top: -5, minWidth: 19, height: 19, borderRadius: 10, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  navBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  stack: { gap: spacing.md },
  flexOne: { flex: 1, minWidth: 0 },

  homeHeader: { backgroundColor: colors.secondary, paddingHorizontal: spacing.md, paddingTop: 12, paddingBottom: 18, borderBottomLeftRadius: 26, borderBottomRightRadius: 26, gap: 13 },
  homeBrandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roundIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#173B73', alignItems: 'center', justifyContent: 'center' },
  roundIconText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  xdriveMark: { color: colors.warning, fontSize: 24, fontWeight: '900', letterSpacing: 0.5 },
  xdriveBlue: { color: '#FFFFFF' },
  homeDate: { color: '#D5E1F5', textAlign: 'center', fontSize: 13, fontWeight: '700' },
  homeGrid: { flexDirection: 'row', gap: 10 },
  homeTile: { flex: 2, backgroundColor: '#173B73', borderRadius: 16, padding: 13 },
  homeTileSmall: { flex: 1, backgroundColor: '#173B73', borderRadius: 16, padding: 13 },
  homeTileLabel: { color: '#AFC2E4', fontSize: 9, letterSpacing: 0.8, fontWeight: '900' },
  homeTileValue: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', marginTop: 4 },
  homeTileMeta: { color: '#D5E1F5', fontSize: 12, fontWeight: '700', marginTop: 3 },
  trackingOn: { color: '#86EFAC', fontSize: 14, fontWeight: '900', marginTop: 9 },
  trackingStandby: { color: '#D5E1F5', fontSize: 13, fontWeight: '800', marginTop: 9 },
  statusRow: { backgroundColor: '#173B73', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusValue: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', marginTop: 2, textTransform: 'capitalize' },
  chevron: { color: colors.warning, fontSize: 32, fontWeight: '300' },
  quickRow: { flexDirection: 'row', gap: 9 },
  quickButton: { flex: 1, minHeight: 48, backgroundColor: '#FFFFFF', borderColor: colors.border, borderWidth: 1, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  quickText: { color: colors.text, fontSize: 14, fontWeight: '800' },
  metricRow: { flexDirection: 'row', gap: 9 },
  metricCard: { flex: 1, minHeight: 88, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12, alignItems: 'center', justifyContent: 'center', borderColor: colors.borderSubtle, borderWidth: 1 },
  metricValue: { color: colors.primary, fontSize: 27, fontWeight: '900' },
  metricLabel: { color: colors.muted, fontSize: 11, fontWeight: '700', textAlign: 'center', marginTop: 2 },

  section: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: spacing.md, borderColor: colors.borderSubtle, borderWidth: 1, gap: 12 },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: '900' },
  loadCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, borderColor: colors.borderSubtle, borderWidth: 1, gap: 12, shadowColor: '#101828', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  bookingCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, borderColor: colors.borderSubtle, borderWidth: 1, gap: 12 },
  quoteCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, borderColor: colors.borderSubtle, borderWidth: 1, gap: 12 },
  companyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  verifiedBadge: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center' },
  verifiedText: { color: colors.blue, fontSize: 18, fontWeight: '900' },
  companyTextWrap: { flex: 1, minWidth: 0 },
  companyName: { color: colors.text, fontSize: 17, lineHeight: 22, fontWeight: '900' },
  companyMeta: { color: colors.muted, fontSize: 12, lineHeight: 17, fontWeight: '600', marginTop: 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  chipGreen: { backgroundColor: '#DCFCE7' },
  chipBlue: { backgroundColor: '#E8F1FF' },
  chipOrange: { backgroundColor: '#FFF3D6' },
  chipRed: { backgroundColor: '#FEE2E2' },
  chipText: { color: '#344054', fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  routeCard: { borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 13, backgroundColor: '#FFFFFF' },
  routeStop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  routeMarker: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#4D9BE6', alignItems: 'center', justifyContent: 'center' },
  routeMarkerDelivery: { borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  routeMarkerText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  routeLocation: { color: colors.text, fontSize: 17, lineHeight: 22, fontWeight: '900' },
  routeTime: { color: colors.muted, fontSize: 12, fontWeight: '700', marginTop: 2 },
  routeConnector: { width: 32, height: 24, marginLeft: 0, alignItems: 'center', justifyContent: 'space-around', paddingVertical: 2 },
  connectorDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#D0D5DD' },
  loadSummaryRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-end', justifyContent: 'space-between' },
  eyebrow: { color: colors.muted, fontSize: 10, letterSpacing: 1, fontWeight: '900' },
  summaryText: { color: colors.text, fontSize: 14, lineHeight: 19, fontWeight: '700', marginTop: 2 },
  priceText: { color: colors.secondary, fontSize: 18, fontWeight: '900' },
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  smallAction: { minHeight: 42, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#F2F4F7', alignItems: 'center', justifyContent: 'center' },
  smallActionText: { color: '#475467', fontSize: 12, fontWeight: '800' },
  quoteButton: { marginLeft: 'auto', minHeight: 46, minWidth: 120, paddingHorizontal: 20, backgroundColor: colors.primary, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  quoteButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  inlineWarning: { color: colors.secondary, backgroundColor: colors.panelSoft, borderRadius: 10, padding: 9, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  primaryInlineButton: { flexGrow: 1, minHeight: 46, paddingHorizontal: 18, backgroundColor: colors.primary, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  primaryInlineText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  primaryButton: { minHeight: 56, backgroundColor: colors.primary, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  secondaryButton: { minHeight: 50, borderColor: colors.primary, borderWidth: 1.5, borderRadius: 15, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, backgroundColor: '#FFFFFF' },
  secondaryButtonText: { color: colors.primary, fontSize: 14, fontWeight: '900' },
  disabledButton: { opacity: 0.45 },
  fieldLabel: { color: colors.secondary, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginTop: 3 },
  bigInput: { minHeight: 54, borderColor: colors.border, borderWidth: 1, borderRadius: 14, backgroundColor: '#FFFFFF', color: colors.text, paddingHorizontal: 14, fontSize: 16, fontWeight: '600' },
  textarea: { minHeight: 100, paddingTop: 14, textAlignVertical: 'top' },
  quoteHeader: { flexDirection: 'row', gap: 10, justifyContent: 'space-between', alignItems: 'flex-start' },
  quoteAmountPanel: { backgroundColor: colors.panelSoft, borderRadius: 14, padding: 12 },
  quoteAmount: { color: colors.text, fontSize: 22, fontWeight: '900', marginTop: 2 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, borderTopColor: colors.borderSubtle, borderTopWidth: 1, paddingTop: 10 },
  infoLabel: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  infoValue: { color: colors.text, fontSize: 13, fontWeight: '800', flex: 1, textAlign: 'right' },
  longText: { color: colors.text, fontSize: 14, lineHeight: 22, fontWeight: '600' },
  dualActions: { flexDirection: 'row', gap: 10 },
  blueAction: { flex: 1, minHeight: 48, borderRadius: 14, backgroundColor: '#4D9BE6', alignItems: 'center', justifyContent: 'center' },
  blueActionFull: { minHeight: 48, borderRadius: 14, backgroundColor: '#4D9BE6', alignItems: 'center', justifyContent: 'center' },
  blueActionText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  attachmentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderColor: '#9BC7F0', borderWidth: 1, borderRadius: 12, padding: 10, backgroundColor: '#F7FBFF' },
  attachmentIcon: { width: 38, color: colors.blue, fontSize: 11, fontWeight: '900' },
  attachmentText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '800' },
  stopDetailRow: { flexDirection: 'row', gap: 13, paddingVertical: 8 },
  stopNumber: { width: 34, height: 34, borderRadius: 9, backgroundColor: '#4D9BE6', alignItems: 'center', justifyContent: 'center' },
  stopNumberText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  stopTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  stopTime: { color: colors.muted, fontSize: 13, fontWeight: '700', marginTop: 2 },
  stopMeta: { color: colors.muted, fontSize: 13, lineHeight: 19, fontWeight: '600', marginTop: 4 },
  stopAddress: { color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: '700', marginTop: 3 },
  stopNote: { color: colors.secondary, backgroundColor: colors.panelSoft, borderRadius: 10, padding: 9, fontSize: 13, lineHeight: 18, marginTop: 7 },
  timeline: { gap: 0 },
  timelineRow: { minHeight: 67, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  timelineDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#EAECF0', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  timelineDotDone: { backgroundColor: '#65C65A' },
  timelineDotCurrent: { borderWidth: 3, borderColor: '#D5F5D1' },
  timelineDotText: { color: '#FFFFFF', fontWeight: '900' },
  timelineLabel: { color: '#667085', fontSize: 16, fontWeight: '800' },
  timelineLabelCurrent: { color: colors.text, fontWeight: '900' },
  timelineMeta: { color: '#98A2B3', fontSize: 12, marginTop: 3 },
  signatureBox: { height: 210, borderColor: colors.border, borderWidth: 1, borderRadius: 14, overflow: 'hidden', backgroundColor: '#FFFFFF' },
  savedState: { color: colors.success, fontSize: 12, fontWeight: '800' },
  fixedAction: { position: 'absolute', left: 0, right: 0, bottom: 76, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.secondary },
  fixedActionButton: { minHeight: 58, backgroundColor: '#65C65A', borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  fixedActionText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  utilityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  utilityTile: { width: '48%', minHeight: 154, backgroundColor: '#FFFFFF', borderColor: colors.borderSubtle, borderWidth: 1, borderRadius: 18, alignItems: 'center', justifyContent: 'center', padding: 14 },
  utilityGlyph: { width: 56, height: 56, borderRadius: 16, backgroundColor: colors.panelSoft, alignItems: 'center', justifyContent: 'center' },
  utilityGlyphText: { color: colors.secondary, fontSize: 15, fontWeight: '900' },
  utilityTitle: { color: colors.text, fontSize: 16, fontWeight: '900', marginTop: 10 },
  utilityMeta: { color: colors.muted, fontSize: 11, fontWeight: '600', marginTop: 3 },
  signOutButton: { minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: '#FCA5A5', backgroundColor: '#FFF5F5', alignItems: 'center', justifyContent: 'center' },
  signOutText: { color: colors.danger, fontSize: 14, fontWeight: '900' },
  invoiceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 14, borderBottomColor: colors.borderSubtle, borderBottomWidth: 1, paddingVertical: 10 },
  queueRow: { borderColor: colors.borderSubtle, borderWidth: 1, borderRadius: 12, padding: 11 },
  errorText: { color: colors.danger, fontSize: 11, marginTop: 4 },
  banner: { minHeight: 46, backgroundColor: '#EAF2FF', borderColor: '#B9D3FF', borderWidth: 1, borderRadius: 13, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', gap: 9, alignItems: 'center' },
  bannerText: { color: colors.secondary, fontSize: 12, lineHeight: 18, fontWeight: '700', flex: 1 },
  bannerDismiss: { color: colors.secondary, fontSize: 22, fontWeight: '700' },
  emptyState: { minHeight: 280, backgroundColor: '#FFFFFF', borderRadius: 18, borderColor: colors.borderSubtle, borderWidth: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  emptyGlyph: { width: 92, height: 92, borderRadius: 46, backgroundColor: colors.panelSoft, alignItems: 'center', justifyContent: 'center' },
  emptyGlyphText: { color: colors.primary, fontSize: 24, fontWeight: '900' },
  emptyTitle: { color: colors.text, fontSize: 20, fontWeight: '900', marginTop: 16, textAlign: 'center' },
  emptyBody: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 7 },
  loadingCard: { minHeight: 90, borderRadius: 16, backgroundColor: '#FFFFFF', borderColor: colors.borderSubtle, borderWidth: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  loadingText: { color: colors.muted, fontSize: 14, fontWeight: '700' },

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
  loginTrustRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  trustItem: { alignItems: 'center', flex: 1, gap: 4 },
  trustBadge: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#EEF4FF', alignItems: 'center', justifyContent: 'center' },
  trustBadgeText: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  trustText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
});
