import * as Network from 'expo-network';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, Image, Linking, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import SignatureCanvas, { type SignatureViewRef } from 'react-native-signature-canvas';

import { isPermanentClientError } from '../api/client';
import { fetchJob, fetchJobs, postJobStatus, postStopStatus, uploadPod } from '../api/jobs';
import { fetchDriverResources, markDriverNotificationRead, type DriverAlert, type DriverResources } from '../api/resources';
import { clearSessionToken, saveSessionToken } from '../auth/sessionStore';
import { handleSessionLoss } from '../auth/sessionLoss';
import { supabase } from '../auth/supabase';
import { FULL_TIMELINE, getNextStep, statusIndex } from '../jobs/statusFlow';
import type { AuditEntry, DriverJob, JobScope, JobStop, PodRecord, QueuedActionStatus } from '../jobs/types';
import { LiveLoadsScreen } from '../live-loads/LiveLoadsScreen';
import { createCollectionEvidenceId } from '../offline/collectionEvidencePersistence';
import {
  enqueueAction,
  getQueue,
  isOnline,
  clearQueue,
  isQueueItemReady,
  markQueueItemFailed,
  markQueueItemSynced,
  markQueueItemSyncing,
  reconcileQueueState,
  retryQueueItem,
  type QueuedAction,
} from '../offline/queue';
import { getReadyActionsInOrder } from '../offline/queueOrderingHelpers';
import { subscribeToNotificationNavigation } from '../push/notificationHandling';
import { colors, spacing } from '../ui/theme';

type Screen = 'login' | 'liveLoads' | 'active' | 'jobs' | 'detail' | 'pod' | 'viewPod' | 'notifications' | 'profile';

type DetailTab = 'summary' | 'stops' | 'status';

type QueueCounts = Record<QueuedActionStatus, number>;

const notificationEventTitles: Record<string, string> = {
  job_assigned: 'Job assigned',
  bid_accepted: 'Bid accepted',
  pod_uploaded: 'POD uploaded',
  job_cancelled: 'Job cancelled',
  job_updated: 'Job updated',
  dispatcher_message: 'Dispatcher update',
  driver_instruction: 'Driver instruction',
};

function getAccessToken(session: { access_token?: string | null } | null | undefined) {
  const token = session?.access_token?.trim();
  return token || null;
}

type ReadySession = { accessToken: string; userId: string };

async function waitForReadySession(maxAttempts = 8, waitMs = 300): Promise<ReadySession | null> {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = getAccessToken(data.session);
      const userId = data.session?.user?.id?.trim() || null;
      if (accessToken && userId) return { accessToken, userId };
    } catch {
      // Retry on transient auth-read failures.
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  return null;
}

/**
 * Validates that the signed-in user is authorized as a driver by calling the
 * backend driver resources endpoint. This uses the backend as the authority
 * rather than reading from `profiles.role` directly, which avoids a direct
 * Supabase table dependency and honours any server-side role logic.
 *
 * Returns the userId on success, or null if authorization fails.
 */
async function validateDriverAuthorization(userId: string, accessToken: string): Promise<string | null> {
  try {
    await fetchDriverResources(accessToken);
    return userId;
  } catch (error) {
    console.warn('[auth] Driver authorization check failed:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function stringField(value: unknown, fallback = 'Not available') {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || fallback;
}

function optionalString(value: unknown) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || undefined;
}

function optionalBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : null;
}

function formatDateTime(value?: string | null, fallback = 'Not available') {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatRelativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return value;
  const deltaMinutes = Math.max(1, Math.floor((Date.now() - timestamp) / 60_000));
  if (deltaMinutes < 60) return `${deltaMinutes}m ago`;
  const deltaHours = Math.floor(deltaMinutes / 60);
  if (deltaHours < 24) return `${deltaHours}h ago`;
  const deltaDays = Math.floor(deltaHours / 24);
  return `${deltaDays}d ago`;
}

function notificationTitle(alert: DriverAlert) {
  return notificationEventTitles[alert.event_type] || 'Notification';
}

function notificationSummary(alert: DriverAlert) {
  const payload = toRecord(alert.payload);
  const pickup = optionalString(payload.pickup_location);
  const delivery = optionalString(payload.delivery_location);
  const dispatcherMessage = optionalString(payload.message) || optionalString(payload.note);

  if (alert.event_type === 'job_assigned') {
    return `${pickup || 'Pickup TBC'} → ${delivery || 'Delivery TBC'}`;
  }

  if (alert.event_type === 'bid_accepted') {
    const rawAmount = payload.bid_price_gbp ?? payload.amount ?? payload.bid_amount;
    const amount = typeof rawAmount === 'number' ? rawAmount : Number(rawAmount);
    return Number.isFinite(amount) && amount > 0 ? `Accepted amount: £${amount.toFixed(2)}` : 'A submitted quote has been accepted.';
  }

  if (alert.event_type === 'pod_uploaded') {
    return `${pickup || 'Pickup'} → ${delivery || 'Delivery'} marked delivered.`;
  }

  return dispatcherMessage || `${stringField(alert.entity_type, 'Record')} #${stringField(alert.entity_id, '').slice(0, 8).toUpperCase() || 'update'}`;
}

function isInboxNotification(alert: DriverAlert) {
  const payload = toRecord(alert.payload);
  return alert.entity_type === 'notification' || optionalString(payload.source) === 'driver_inbox';
}

function notificationReadAt(alert: DriverAlert) {
  return optionalString(toRecord(alert.payload).read_at) ?? null;
}

function isUnreadInboxNotification(alert: DriverAlert) {
  return isInboxNotification(alert) && !notificationReadAt(alert);
}

function notificationJobId(alert: DriverAlert) {
  if (alert.entity_type === 'job' && alert.entity_id.trim()) return alert.entity_id.trim();
  const payload = toRecord(alert.payload);
  return optionalString(payload.job_id) ?? optionalString(payload.jobId) ?? null;
}

function queueStatusLabel(status: QueuedActionStatus) {
  if (status === 'syncing') return 'Syncing';
  if (status === 'synced') return 'Synced';
  if (status === 'failed') return 'Failed';
  return 'Pending';
}

function statusTone(status: QueuedActionStatus): 'primary' | 'success' | 'warning' | 'danger' {
  if (status === 'synced') return 'success';
  if (status === 'failed') return 'danger';
  if (status === 'syncing') return 'primary';
  return 'warning';
}

function getQueueCounts(queue: QueuedAction[]): QueueCounts {
  return queue.reduce<QueueCounts>((counts, item) => {
    counts[item.status] += 1;
    return counts;
  }, { pending: 0, syncing: 0, synced: 0, failed: 0 });
}

function getPersistentStops(job: DriverJob) {
  return job.stops && job.stops.length > 0
    ? [...job.stops].sort((a, b) => a.sequence - b.sequence)
    : [];
}

function isStopTerminal(stop: JobStop) {
  return stop.status === 'completed' || stop.status === 'skipped';
}

function hasIncompletePersistentStops(job: DriverJob) {
  const stops = getPersistentStops(job);
  return stops.length > 0 && stops.some((stop) => !isStopTerminal(stop));
}

function applyOptimisticStopStatus(job: DriverJob, stopId: string, status: 'arrived' | 'completed'): DriverJob {
  const now = new Date().toISOString();
  return {
    ...job,
    stops: job.stops?.map((stop) => {
      if (stop.id !== stopId) return stop;
      if (status === 'arrived') {
        return { ...stop, status, arrivedAt: stop.arrivedAt ?? now };
      }
      return { ...stop, status, arrivedAt: stop.arrivedAt ?? now, completedAt: now };
    }),
  };
}

async function captureCollectionPhotoPayload(): Promise<Record<string, unknown> | null> {
  const ImagePicker = await import('expo-image-picker');
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Camera required', 'A loading photo is required before the job can be marked Loaded.');
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
  const uri = !result.canceled ? result.assets[0]?.uri?.trim() : '';
  if (!uri) return null;
  return {
    collectionPhotoUri: uri,
    collectionEvidenceId: createCollectionEvidenceId(),
  };
}

export default function DriverMobileApp() {
  const [screen, setScreen] = useState<Screen>('login');
  const [token, setToken] = useState<string | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<DriverJob[]>([]);
  const [job, setJob] = useState<DriverJob | null>(null);
  const [scope, setScope] = useState<JobScope>('active');
  const [queue, setQueue] = useState<QueuedAction[]>([]);
  const [resources, setResources] = useState<DriverResources | null>(null);
  const [loading, setLoading] = useState(false);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [stopActionId, setStopActionId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const queueSyncInFlightRef = useRef(false);
  /**
   * Tracks the last successfully authenticated user ID so that when
   * `onAuthStateChange` fires with a null session (token expiry, remote logout,
   * etc.) we can clear that user's account-scoped queue even though
   * `session?.user?.id` is null at that point.
   */
  const authenticatedUserIdRef = useRef<string | null>(null);
  const nextStep = useMemo(() => (job ? getNextStep(job.status) : undefined), [job]);
  const queueCounts = useMemo(() => getQueueCounts(queue), [queue]);
  const driverCanCommercialBid = optionalBoolean(resources?.driver?.can_commercial_bid);
  const unreadNotificationCount = useMemo(
    () => resources?.alerts?.filter(isUnreadInboxNotification).length ?? 0,
    [resources?.alerts],
  );

  const loadJobs = useCallback(async (
    sessionToken: string,
    nextScope = scope,
    options: { navigate?: boolean } = {}
  ) => {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetchJobs(nextScope, sessionToken);
      setJobs(response.jobs);
      setJob((current) => {
        if (current) {
          const refreshed = response.jobs.find((item) => item.id === current.id);
          if (refreshed) return refreshed;
        }
        return response.jobs[0] ?? null;
      });
      if (options.navigate !== false) {
        setScreen(response.jobs[0] ? 'active' : 'jobs');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load jobs.');
    } finally {
      setLoading(false);
    }
  }, [scope]);

  const loadResources = useCallback(async (sessionToken: string, options: { silent?: boolean } = {}) => {
    if (!options.silent) setResourcesLoading(true);
    try {
      const response = await fetchDriverResources(sessionToken);
      setResources(response.resources);
    } catch (error) {
      if (!options.silent) {
        setMessage(error instanceof Error ? error.message : 'Failed to load driver account data.');
      }
    } finally {
      if (!options.silent) setResourcesLoading(false);
    }
  }, []);

  const flushQueue = useCallback(async (userId: string, sessionToken: string, options: { force?: boolean } = {}) => {
    if (queueSyncInFlightRef.current) return;
    if (!(await isOnline())) return;

    queueSyncInFlightRef.current = true;
    try {
      let nextQueue = await getQueue(userId);
      const readyItems = getReadyActionsInOrder(
        nextQueue,
        options.force ? (item) => item.status !== 'synced' : isQueueItemReady,
      );
      if (readyItems.length === 0) {
        setQueue(nextQueue);
        return;
      }

      const failedJobIds = new Set<string>();
      for (const item of readyItems) {
        if (failedJobIds.has(item.jobId)) continue;
        nextQueue = await markQueueItemSyncing(userId, item.id);
        setQueue(nextQueue);
        try {
          if (item.endpoint === 'pod') await uploadPod(item.jobId, sessionToken, item.payload ?? {});
          else await postJobStatus(item.jobId, item.endpoint, sessionToken, item.payload ?? {});
          nextQueue = await markQueueItemSynced(userId, item.id);
        } catch (error) {
          nextQueue = await markQueueItemFailed(
            userId,
            item.id,
            error instanceof Error ? error.message : 'Sync failed.',
            item.retryCount,
            { retryable: !isPermanentClientError(error) },
          );
          failedJobIds.add(item.jobId);
        }
        setQueue(nextQueue);
      }

      await loadJobs(sessionToken, scope, { navigate: false });
      await loadResources(sessionToken, { silent: true });
    } finally {
      queueSyncInFlightRef.current = false;
      const latestQueue = await getQueue(userId).catch(() => []);
      setQueue(latestQueue);
    }
  }, [loadJobs, loadResources, scope]);

  const openJobById = useCallback(async (jobId: string) => {
    if (!token) return;
    setLoading(true);
    setMessage('');
    try {
      const response = await fetchJob(jobId, token);
      setJob(response.job);
      setScreen('detail');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to open this job.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const openNotification = useCallback(async (alert: DriverAlert) => {
    if (!token) return;
    if (isUnreadInboxNotification(alert)) {
      const notificationId = alert.entity_id.trim() || alert.id.trim();
      if (notificationId) {
        try {
          await markDriverNotificationRead(notificationId, token);
          await loadResources(token, { silent: true });
        } catch (error) {
          setMessage(error instanceof Error ? error.message : 'Notification read state could not be updated.');
          return;
        }
      }
    }

    const jobId = notificationJobId(alert);
    if (jobId) await openJobById(jobId);
  }, [loadResources, openJobById, token]);

  useEffect(() => {
    void waitForReadySession()
      .then(async (readySession) => {
        const sessionToken = readySession?.accessToken ?? null;
        const userId = readySession?.userId ?? null;
        setAuthUserId(userId);
        if (!sessionToken || !userId) {
          void clearSessionToken();
          return;
        }

        const isDriver = await validateDriverAuthorization(userId, sessionToken);
        if (!isDriver) {
          setMessage('Access denied: only drivers can use this app.');
          await clearQueue(userId).catch(() => undefined);
          await supabase.auth.signOut().catch(() => undefined);
          await clearSessionToken();
          setScreen('login');
          return;
        }

        authenticatedUserIdRef.current = userId;
        void getQueue(userId).then(setQueue).catch(() => setQueue([]));
        setToken(sessionToken);
        void saveSessionToken(sessionToken);
        await loadJobs(sessionToken);
        void loadResources(sessionToken);
        void safeRegisterPushToken(sessionToken);
        void flushQueue(userId, sessionToken);
      })
      .catch(() => {
        void clearSessionToken();
        setScreen('login');
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: unknown, session: { access_token?: string | null; user?: { id?: string | null } | null } | null) => {
      const nextToken = getAccessToken(session);
      const nextUserId = session?.user?.id?.trim() || null;
      setToken(nextToken);
      setAuthUserId(nextUserId);
      if (nextToken) void saveSessionToken(nextToken);
      else void clearSessionToken();
      if (nextUserId) {
        authenticatedUserIdRef.current = nextUserId;
      }
      if (!session) {
        const previousUserId = authenticatedUserIdRef.current;
        authenticatedUserIdRef.current = null;
        void handleSessionLoss(previousUserId);
        setJob(null);
        setJobs([]);
        setResources(null);
        setQueue([]);
        setMessage('');
        setScreen('login');
      }
    });
    return () => subscription.unsubscribe();
  }, [flushQueue, loadJobs, loadResources]);

  useEffect(() => {
    if (!token) return;
    if (screen === 'profile' || screen === 'notifications') {
      void loadResources(token);
    }
  }, [loadResources, screen, token]);

  useEffect(() => {
    if (!token) return;
    return subscribeToNotificationNavigation((jobId) => {
      void openJobById(jobId);
    });
  }, [openJobById, token]);

  useEffect(() => {
    if (!token || !authUserId) return;
    const subscription = Network.addNetworkStateListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        void flushQueue(authUserId, token);
      }
    });
    const intervalId = setInterval(() => {
      void flushQueue(authUserId, token);
    }, 15_000);
    return () => {
      subscription.remove();
      clearInterval(intervalId);
    };
  }, [flushQueue, token, authUserId]);

  async function signIn(email: string, password: string) {
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password.trim()) {
      setMessage('Enter both email and password.');
      return;
    }
    setLoading(true);
    setMessage('');
    const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    if (error) {
      setLoading(false);
      setMessage(error.message);
      return;
    }

    const readySession = await waitForReadySession(12, 350);
    setLoading(false);
    const accessToken = readySession?.accessToken ?? null;
    const userId = readySession?.userId ?? null;
    if (!accessToken || !userId) {
      setMessage('Driver session not ready. Please wait and refresh.');
      await supabase.auth.signOut().catch(() => undefined);
      return;
    }

    const isDriver = await validateDriverAuthorization(userId, accessToken);
    if (!isDriver) {
      setMessage('Access denied: only drivers can use this app.');
      await supabase.auth.signOut().catch(() => undefined);
      return;
    }

    setToken(accessToken);
    setAuthUserId(userId);
    authenticatedUserIdRef.current = userId;
    try {
      await saveSessionToken(accessToken);
    } catch {
      // SecureStore failure should not block sign-in.
    }
    void getQueue(userId).then(setQueue).catch(() => setQueue([]));
    void safeRegisterPushToken(accessToken);
    await loadJobs(accessToken);
    void loadResources(accessToken);
    void flushQueue(userId, accessToken);
  }

  async function signOut() {
    const userId = authUserId;
    authenticatedUserIdRef.current = null;
    await supabase.auth.signOut();
    await clearSessionToken();
    if (userId) await clearQueue(userId).catch(() => undefined);
    setToken(null);
    setAuthUserId(null);
    setJob(null);
    setJobs([]);
    setQueue([]);
    setResources(null);
    setMessage('');
    setScreen('login');
  }

  async function retryFailedQueueItems() {
    if (!authUserId || !token) return;
    const failedItems = queue.filter((item) => item.status === 'failed');
    for (const item of failedItems) {
      await retryQueueItem(authUserId, item.id);
    }
    const latestQueue = await getQueue(authUserId);
    setQueue(latestQueue);
    await flushQueue(authUserId, token, { force: true });
  }

  async function submitStopStatus(stopId: string, status: 'arrived' | 'completed') {
    if (!job || !authUserId || stopActionId) return;
    const currentJob = job;
    const payload = { stop_id: stopId, status };

    const queueStopAction = async (reason: string) => {
      const queued = await enqueueAction(authUserId, {
        jobId: currentJob.id,
        endpoint: 'stop-status',
        payload,
      });
      setQueue((items) => reconcileQueueState(items, queued));
      const optimisticJob = applyOptimisticStopStatus(currentJob, stopId, status);
      setJob(optimisticJob);
      setJobs((items) => items.map((item) => item.id === optimisticJob.id ? optimisticJob : item));
      setMessage(reason);
    };

    setStopActionId(stopId);
    setMessage('');
    try {
      if (!token || !(await isOnline())) {
        await queueStopAction('Stop update saved offline. It will sync in order when connectivity returns.');
        return;
      }

      try {
        await postStopStatus(currentJob.id, stopId, status, token);
        const refreshed = await fetchJob(currentJob.id, token);
        setJob(refreshed.job);
        setJobs((items) => items.map((item) => item.id === refreshed.job.id ? refreshed.job : item));
      } catch (error) {
        const text = error instanceof Error ? error.message : 'Unable to update this stop.';
        if (isPermanentClientError(error)) {
          setMessage(text);
          const refreshed = await fetchJob(currentJob.id, token).catch(() => null);
          if (refreshed?.job) {
            setJob(refreshed.job);
            setJobs((items) => items.map((item) => item.id === refreshed.job.id ? refreshed.job : item));
          }
          return;
        }
        await queueStopAction('Stop update queued after a connection failure. It will retry automatically.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save this stop update securely.');
    } finally {
      setStopActionId(null);
    }
  }

  async function submitStatus() {
    if (!job) return;
    if (!nextStep) {
      setMessage('Job status is already up to date.');
      return;
    }
    if (nextStep.status === 'delivered' && hasIncompletePersistentStops(job)) {
      setMessage('Complete all multi-drop stops before final delivery and POD.');
      setScreen('detail');
      return;
    }
    if (nextStep.status === 'delivered') {
      const podAlreadyCaptured = job.podCompleted === true || job.podGenerated === true || job.pod != null;
      if (!podAlreadyCaptured) {
        setScreen('pod');
        return;
      }
    }

    const apply = async () => {
      let actionPayload: Record<string, unknown> | undefined;
      if (nextStep.endpoint === 'loaded') {
        actionPayload = await captureCollectionPhotoPayload() ?? undefined;
        if (!actionPayload) {
          setMessage('A loading photo is required before the job can be marked Loaded.');
          return;
        }
      }

      if (!token || !authUserId || !(await isOnline())) {
        if (!authUserId) return;
        const queued = await enqueueAction(authUserId, { jobId: job.id, endpoint: nextStep.endpoint, payload: actionPayload });
        setQueue((items) => reconcileQueueState(items, queued));
        setMessage('Action saved offline. It will sync automatically when connectivity returns.');
        return;
      }
      try {
        const response = await postJobStatus(job.id, nextStep.endpoint, token, actionPayload ?? {});
        if ('job' in response) setJob(response.job as DriverJob);
        await loadJobs(token, scope, { navigate: false });
      } catch (error) {
        const text = error instanceof Error ? error.message : 'Unable to update job status. Please retry.';
        if (/pod is required|delivery photo|recipient signature/i.test(text)) {
          setMessage(text);
          setScreen('pod');
          return;
        }
        if (isPermanentClientError(error)) {
          setMessage(text);
          await loadJobs(token, scope, { navigate: false }).catch(() => undefined);
          return;
        }
        const queued = await enqueueAction(authUserId, { jobId: job.id, endpoint: nextStep.endpoint, payload: actionPayload });
        setQueue((items) => reconcileQueueState(items, queued));
        setMessage(text);
      }
    };

    if (!nextStep.requiresConfirmation) {
      await apply();
      return;
    }
    Alert.alert('Confirm action', nextStep.label, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: () => void apply() },
    ]);
  }

  function handleBottomNavChange(nextScreen: Screen) {
    if ((nextScreen === 'pod' || nextScreen === 'viewPod' || nextScreen === 'active' || nextScreen === 'detail') && !job) {
      setScreen('jobs');
      return;
    }
    if (nextScreen === 'pod' && job && hasIncompletePersistentStops(job)) {
      setMessage('Complete all multi-drop stops before capturing POD.');
      setScreen('detail');
      return;
    }
    setScreen(nextScreen);
  }

  if (screen === 'login') return <LoginScreen onSignIn={signIn} message={message} loading={loading} />;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View style={styles.shell}>
        <Header
          onProfile={() => setScreen('profile')}
          onNotifications={() => setScreen('notifications')}
          unreadNotificationCount={unreadNotificationCount}
        />
        {screen === 'liveLoads' ? <LiveLoadsScreen canCommercialBid={driverCanCommercialBid} /> : (
          <ScrollView contentContainerStyle={styles.content}>
            {message ? <Text style={styles.message}>{message}</Text> : null}
            {(loading || resourcesLoading) && <Text style={styles.subtle}>Loading...</Text>}
            {screen === 'active' && job && (
              <ActiveJobScreen
                job={job}
                queue={queue}
                counts={queueCounts}
                nextLabel={nextStep?.label ?? 'Delivered'}
                onPrimary={() => void submitStatus()}
                onDetail={() => setScreen('detail')}
                onPod={() => {
                  if (hasIncompletePersistentStops(job)) {
                    setMessage('Complete all multi-drop stops before capturing POD.');
                    setScreen('detail');
                    return;
                  }
                  setScreen('pod');
                }}
                onRetryFailed={() => void retryFailedQueueItems()}
                onSyncNow={() => authUserId && token && void flushQueue(authUserId, token, { force: true })}
              />
            )}
            {screen === 'active' && !job && !loading && <EmptyJobsScreen onRefresh={() => token && void loadJobs(token, scope, { navigate: false })} />}
            {screen === 'jobs' && (
              <JobsScreen
                scope={scope}
                jobs={jobs}
                onScope={(nextScope) => {
                  setScope(nextScope);
                  if (token) void loadJobs(token, nextScope, { navigate: false });
                }}
                onOpen={(nextJob) => {
                  setJob(nextJob);
                  setScreen('detail');
                }}
              />
            )}
            {screen === 'detail' && job && (
              <JobDetailScreen
                job={job}
                onPrimary={() => setScreen('active')}
                onViewPod={() => setScreen('viewPod')}
                onStopStatus={(stopId, status) => void submitStopStatus(stopId, status)}
                stopActionId={stopActionId}
              />
            )}
            {screen === 'pod' && job && authUserId && (
              <PodScreen
                job={job}
                token={token}
                userId={authUserId}
                onSaved={(updatedJob) => {
                  if (updatedJob) setJob(updatedJob);
                  else setJob((current) => (current ? { ...current, podGenerated: true, podCompleted: true } : current));
                  setScreen('active');
                }}
                onQueued={(queued) => setQueue((items) => reconcileQueueState(items, queued))}
              />
            )}
            {screen === 'viewPod' && job && (
              <ViewPodScreen pod={job.pod ?? null} onBack={() => setScreen('detail')} />
            )}
            {screen === 'notifications' && (
              <NotificationsScreen
                notifications={resources?.alerts ?? []}
                unreadCount={unreadNotificationCount}
                onOpenNotification={(alert) => void openNotification(alert)}
              />
            )}
            {screen === 'profile' && (
              <ProfileScreen
                resources={resources}
                queue={queue}
                onRefresh={() => token && void loadResources(token)}
                onSignOut={signOut}
              />
            )}
          </ScrollView>
        )}
        <BottomNav active={screen} onChange={handleBottomNavChange} />
      </View>
    </SafeAreaView>
  );
}

function LoginScreen({ onSignIn, message, loading }: { onSignIn: (email: string, password: string) => void; message: string; loading: boolean }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const hasCredentials = email.trim().length > 0 && password.trim().length > 0;
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.login}>
        <Text style={styles.logo}>XDrive Driver</Text>
        <Text style={styles.subtle}>Native operations app</Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}
        <TextInput autoCapitalize="none" keyboardType="email-address" placeholder="Email" placeholderTextColor={colors.muted} style={styles.input} value={email} onChangeText={setEmail} />
        <TextInput placeholder="Password" placeholderTextColor={colors.muted} secureTextEntry style={styles.input} value={password} onChangeText={setPassword} />
        <PrimaryButton label={loading ? 'Signing in...' : 'Sign in'} onPress={() => onSignIn(email, password)} disabled={!hasCredentials || loading} />
      </View>
    </SafeAreaView>
  );
}

function Header({ onProfile, onNotifications, unreadNotificationCount }: { onProfile: () => void; onNotifications: () => void; unreadNotificationCount: number }) {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.headerTitle}>Driver Workspace</Text>
        <Text style={styles.subtle}>Today</Text>
      </View>
      <View style={styles.headerActions}>
        <SmallButton label={unreadNotificationCount > 0 ? `Alerts ${unreadNotificationCount}` : 'Alerts'} onPress={onNotifications} />
        <SmallButton label="Profile" onPress={onProfile} />
      </View>
    </View>
  );
}

function ActiveJobScreen({
  job,
  queue,
  counts,
  nextLabel,
  onPrimary,
  onDetail,
  onPod,
  onRetryFailed,
  onSyncNow,
}: {
  job: DriverJob;
  queue: QueuedAction[];
  counts: QueueCounts;
  nextLabel: string;
  onPrimary: () => void;
  onDetail: () => void;
  onPod: () => void;
  onRetryFailed: () => void;
  onSyncNow: () => void;
}) {
  const recentQueue = queue.slice(0, 5);
  const persistentStops = getPersistentStops(job);
  const completedStops = persistentStops.filter(isStopTerminal).length;
  const isPodDone = job.podCompleted === true || job.podGenerated === true || job.pod != null;
  const isPodQueued = queue.some((item) => item.jobId === job.id && item.endpoint === 'pod' && item.status !== 'synced');
  const showCapturePod =
    (job.status === 'arrived_delivery' || job.status === 'delivered') &&
    !hasIncompletePersistentStops(job) &&
    !isPodDone &&
    !isPodQueued;
  return (
    <View style={styles.stack}>
      <StatusPill label={job.status.replace(/_/g, ' ')} tone={job.status === 'delivered' ? 'success' : 'primary'} />
      <View style={styles.pillRow}>
        <StatusPill label={`Pending ${counts.pending}`} tone="warning" />
        <StatusPill label={`Syncing ${counts.syncing}`} tone="primary" />
        <StatusPill label={`Synced ${counts.synced}`} tone="success" />
        <StatusPill label={`Failed ${counts.failed}`} tone="danger" />
      </View>
      <Panel>
        <Text style={styles.title}>{job.reference}</Text>
        <Info label="Pickup" value={job.pickupLocation} />
        <Info label="Delivery" value={job.deliveryLocation} />
        <Info label="Pickup time" value={job.pickupTime} />
        <Info label="Delivery time" value={job.deliveryTime} />
        <Info label="Cargo" value={job.cargoType} />
        <Info label="Vehicle" value={job.vehicleRequirement} />
        {persistentStops.length > 0 ? <Info label="Stops" value={`${completedStops}/${persistentStops.length} complete`} /> : null}
        <Info label="POD" value={job.podGenerated ? 'Captured' : job.podRequired ? 'Required' : 'Not required'} />
        {job.price ? <Info label="Price" value={job.price} /> : null}
      </Panel>
      <PrimaryButton label={nextLabel} onPress={onPrimary} />
      <SecondaryButton label="Job detail" onPress={onDetail} />
      {showCapturePod && <SecondaryButton label="Capture POD" onPress={onPod} />}
      <QueuePanel queue={recentQueue} counts={counts} onRetryFailed={onRetryFailed} onSyncNow={onSyncNow} />
    </View>
  );
}

function JobsScreen({ scope, onScope, jobs, onOpen }: { scope: JobScope; onScope: (scope: JobScope) => void; jobs: DriverJob[]; onOpen: (job: DriverJob) => void }) {
  return (
    <View style={styles.stack}>
      <Segmented value={scope} onChange={onScope} />
      {jobs.length === 0
        ? <Text style={styles.subtle}>No jobs in this scope.</Text>
        : jobs.map((item) => (
          <TouchableOpacity key={item.id} style={styles.jobRow} onPress={() => onOpen(item)}>
            <Text style={styles.jobRef}>{item.reference}</Text>
            <Text style={[styles.subtle, styles.arrow]}>{item.pickupLocation}</Text>
            <Text style={styles.arrow}>↓</Text>
            <Text style={[styles.subtle, styles.arrow]}>{item.deliveryLocation}</Text>
          </TouchableOpacity>
        ))}
    </View>
  );
}

function JobDetailScreen({
  job,
  onPrimary,
  onViewPod,
  onStopStatus,
  stopActionId,
}: {
  job: DriverJob;
  onPrimary: () => void;
  onViewPod: () => void;
  onStopStatus: (stopId: string, status: 'arrived' | 'completed') => void;
  stopActionId: string | null;
}) {
  const [tab, setTab] = useState<DetailTab>('summary');
  const isPodDone = job.podCompleted === true || job.podGenerated === true || job.pod != null;
  const tabs: Array<[DetailTab, string]> = [['summary', 'Summary'], ['stops', 'Stops'], ['status', 'Status']];

  return (
    <View style={styles.stack}>
      <View style={styles.detailTabs}>
        {tabs.map(([key, label]) => (
          <TouchableOpacity key={key} style={[styles.detailTab, tab === key && styles.detailTabActive]} onPress={() => setTab(key)}>
            <Text style={[styles.detailTabText, tab === key && styles.detailTabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'summary' && <SummaryTab job={job} />}
      {tab === 'stops' && (
        <StopsTab
          job={job}
          onViewPod={onViewPod}
          isPodDone={isPodDone}
          onStopStatus={onStopStatus}
          stopActionId={stopActionId}
        />
      )}
      {tab === 'status' && <StatusTab job={job} />}

      <PrimaryButton label="Back to active" onPress={onPrimary} />
      {isPodDone && (
        <TouchableOpacity style={styles.viewPodButton} onPress={onViewPod} accessibilityRole="button">
          <Text style={styles.viewPodButtonText}>VIEW POD</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function SummaryTab({ job }: { job: DriverJob }) {
  const mapUrl = `https://www.google.com/maps/dir/${encodeURIComponent(job.pickupLocation)}/${encodeURIComponent(job.deliveryLocation)}`;

  return (
    <View style={styles.stack}>
      <Panel>
        <Text style={styles.title}>{job.reference}</Text>
        {job.client ? <Info label="Customer" value={job.client} /> : null}
        {job.contactAllowed && job.contactPhone ? (
          <View style={styles.contactRow}>
            <TouchableOpacity style={styles.contactButton} onPress={() => void Linking.openURL(`tel:${job.contactPhone}`)}>
              <Text style={styles.contactButtonText}>📞 CALL</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.contactButton} onPress={() => void Linking.openURL(`sms:${job.contactPhone}`)}>
              <Text style={styles.contactButtonText}>💬 MESSAGE</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {job.contactAllowed && job.contactName ? <Info label="Contact" value={job.contactName} /> : null}
      </Panel>

      <Panel>
        <Info label="Pickup Address" value={job.pickupLocation} />
        <Info label="Delivery Address" value={job.deliveryLocation} />
        <TouchableOpacity style={styles.mapButton} onPress={() => void Linking.openURL(mapUrl)} accessibilityRole="button">
          <Text style={styles.mapButtonText}>🗺  VIEW ROUTE MAP</Text>
        </TouchableOpacity>
        {job.distance ? <Info label="Distance" value={job.distance} /> : null}
        {job.eta ? <Info label="Driving Time (ETA)" value={job.eta} /> : null}
        <Info label="Vehicle" value={job.vehicleRequirement} />
      </Panel>

      <Panel>
        <Text style={styles.infoLabel}>Load Details</Text>
        <Info label="Freight Type" value={job.cargoType} />
        {job.weight ? <Info label="Weight" value={job.weight} /> : null}
        {job.dimensions ? <Info label="Dimensions" value={job.dimensions} /> : null}
        {job.palletCount != null ? <Info label="Pallet Count" value={String(job.palletCount)} /> : null}
        {job.adr ? <Info label="ADR" value="Yes — Hazardous goods" /> : null}
        {job.tailLift ? <Info label="Tail Lift" value="Required" /> : null}
        {job.temperatureControlled ? <Info label="Temperature Controlled" value="Required" /> : null}
      </Panel>

      {(job.customerNotes || job.dispatcherNotes || job.specialInstructions || job.requirements) ? (
        <Panel>
          {job.customerNotes ? <Info label="Customer Notes" value={job.customerNotes} /> : null}
          {job.dispatcherNotes ? <Info label="Dispatcher Notes" value={job.dispatcherNotes} /> : null}
          {job.specialInstructions ? <Info label="Special Instructions" value={job.specialInstructions} /> : null}
          {job.requirements ? <Info label="Requirements" value={job.requirements} /> : null}
        </Panel>
      ) : null}

      <Panel>
        {job.customerReference ? <Info label="Customer Reference" value={job.customerReference} /> : null}
        {job.internalReference ? <Info label="Internal Reference" value={job.internalReference} /> : null}
        {job.paymentTerms ? <Info label="Payment Terms" value={job.paymentTerms} /> : null}
        {job.price ? <Info label="Price" value={job.price} /> : null}
        {job.customerDetails ? <Info label="Customer Information" value={job.customerDetails} /> : null}
        {job.updatedAt ? <Info label="Last Updated" value={formatDateTime(job.updatedAt)} /> : null}
      </Panel>

      {job.attachments && job.attachments.length > 0 ? (
        <Panel>
          <Text style={styles.infoLabel}>Attachments</Text>
          {job.attachments.map((att) => (
            <TouchableOpacity key={att.id} style={styles.attachmentRow} onPress={() => void Linking.openURL(att.url)}>
              <View style={styles.attachmentLeft}>
                <Text style={styles.attachmentName} numberOfLines={1}>{att.name}</Text>
                <Text style={styles.attachmentMeta}>{att.category.replace(/_/g, ' ').toUpperCase()} · {att.fileType.toUpperCase()}</Text>
              </View>
              <Text style={styles.attachmentAction}>↓</Text>
            </TouchableOpacity>
          ))}
        </Panel>
      ) : null}
    </View>
  );
}

function StopsTab({
  job,
  onViewPod,
  isPodDone,
  onStopStatus,
  stopActionId,
}: {
  job: DriverJob;
  onViewPod: () => void;
  isPodDone: boolean;
  onStopStatus: (stopId: string, status: 'arrived' | 'completed') => void;
  stopActionId: string | null;
}) {
  const persistentStops = getPersistentStops(job);
  const hasPersistentStops = persistentStops.length > 0;
  const stops: JobStop[] = hasPersistentStops
    ? persistentStops
    : [
        { id: 'pickup', type: 'collection', sequence: 0, address: job.pickupLocation, timeWindowFrom: job.pickupTime },
        { id: 'delivery', type: 'delivery', sequence: 1, address: job.deliveryLocation, timeWindowFrom: job.deliveryTime },
      ];
  const currentStop = persistentStops.find((stop) => !isStopTerminal(stop));
  const completedStops = persistentStops.filter(isStopTerminal).length;

  return (
    <View style={styles.stack}>
      {hasPersistentStops ? (
        <Panel>
          <Info label="Stop progress" value={`${completedStops}/${persistentStops.length} complete`} />
          {currentStop ? <Info label="Current stop" value={`${currentStop.sequence} · ${currentStop.type === 'collection' ? 'Collection' : 'Delivery'}`} /> : null}
          <Text style={styles.copy}>Stop Arrived/Completed updates are saved securely offline when needed and replayed to the server in job order before final delivery/POD.</Text>
        </Panel>
      ) : null}
      {stops.map((stop) => {
        const status = stop.status ?? 'pending';
        const isActionable = hasPersistentStops && currentStop?.id === stop.id;
        const actionBusy = stopActionId !== null;
        return (
          <Panel key={stop.id}>
            <View style={styles.stopTypeRow}>
              <Text style={[styles.stopTypeLabel, stop.type === 'collection' ? styles.stopCollection : styles.stopDelivery]}>
                {stop.type === 'collection' ? 'COLLECTION' : 'DELIVERY'}
              </Text>
              {stop.status ? <StatusPill label={stop.status} tone={isStopTerminal(stop) ? 'success' : status === 'arrived' ? 'warning' : 'primary'} /> : null}
            </View>
            <Info label="Address" value={stop.address} />
            {stop.company ? <Info label="Company" value={stop.company} /> : null}
            {stop.contactPerson ? <Info label="Contact" value={stop.contactPerson} /> : null}
            {stop.telephone ? (
              <TouchableOpacity onPress={() => void Linking.openURL(`tel:${stop.telephone}`)}>
                <Info label="Telephone" value={stop.telephone ?? ''} />
              </TouchableOpacity>
            ) : null}
            {stop.timeWindowFrom ? (
              <Info label="Time Window" value={stop.timeWindowTo ? `${formatDateTime(stop.timeWindowFrom)} – ${formatDateTime(stop.timeWindowTo)}` : formatDateTime(stop.timeWindowFrom)} />
            ) : null}
            {stop.arrivedAt ? <Info label="Arrived" value={formatDateTime(stop.arrivedAt)} /> : null}
            {stop.completedAt ? <Info label="Completed" value={formatDateTime(stop.completedAt)} /> : null}
            {stop.collectionDetails ? <Info label="Collection Details" value={stop.collectionDetails} /> : null}
            {stop.deliveryDetails ? <Info label="Delivery Details" value={stop.deliveryDetails} /> : null}
            {stop.notes ? <Info label="Notes" value={stop.notes} /> : null}
            {stop.gpsCoordinates ? <Info label="GPS" value={stop.gpsCoordinates} /> : null}
            {hasPersistentStops && isActionable && status === 'pending' ? (
              <PrimaryButton label={stopActionId === stop.id ? 'Updating...' : 'Mark arrived'} onPress={() => onStopStatus(stop.id, 'arrived')} disabled={actionBusy} />
            ) : null}
            {hasPersistentStops && isActionable && status === 'arrived' ? (
              <PrimaryButton label={stopActionId === stop.id ? 'Updating...' : 'Mark completed'} onPress={() => onStopStatus(stop.id, 'completed')} disabled={actionBusy} />
            ) : null}
            {hasPersistentStops && !isActionable && !isStopTerminal(stop) ? (
              <Text style={styles.subtle}>Complete the earlier stop before this stop becomes actionable.</Text>
            ) : null}
          </Panel>
        );
      })}
      {hasPersistentStops && !currentStop && !isPodDone ? (
        <Panel>
          <Text style={styles.copy}>All persisted stops are complete. Final delivery/POD can now continue through the parent job workflow.</Text>
        </Panel>
      ) : null}
      {isPodDone && (
        <TouchableOpacity style={styles.viewPodButton} onPress={onViewPod} accessibilityRole="button">
          <Text style={styles.viewPodButtonText}>VIEW POD</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function StatusTab({ job }: { job: DriverJob }) {
  const [expandedStatus, setExpandedStatus] = useState<string | null>(null);
  const currentIdx = statusIndex(job.status);

  return (
    <View style={styles.stack}>
      {FULL_TIMELINE.map((step, i) => {
        const isDone = i <= currentIdx;
        const isCurrent = i === currentIdx;
        const audit: AuditEntry | undefined = job.auditTrail?.find((e) => e.status === step.status);
        const isExpanded = expandedStatus === step.status;

        return (
          <TouchableOpacity
            key={step.status}
            onPress={() => setExpandedStatus(isExpanded ? null : step.status)}
            disabled={!isDone}
            accessibilityRole="button"
          >
            <View style={styles.timelineRow}>
              <View style={styles.timelineConnectorCol}>
                {i > 0 && <View style={[styles.timelineLine, isDone ? styles.timelineLineDone : styles.timelineLinePending]} />}
                <View style={[styles.timelineDot, isDone ? styles.timelineDotDone : styles.timelineDotPending, isCurrent && styles.timelineDotCurrent]}>
                  {isDone ? <Text style={styles.timelineDotCheck}>✓</Text> : null}
                </View>
                {i < FULL_TIMELINE.length - 1 && <View style={[styles.timelineLineBottom, isDone ? styles.timelineLineDone : styles.timelineLinePending]} />}
              </View>
              <View style={styles.timelineContent}>
                <Text style={[styles.timelineLabel, isDone ? styles.timelineLabelDone : styles.timelineLabelPending]}>{step.label}</Text>
                {audit ? (
                  <Text style={styles.timelineMeta}>{formatDateTime(audit.timestamp)} · {audit.user} · {audit.role}</Text>
                ) : null}
                {isExpanded && audit ? (
                  <View style={styles.timelineExpanded}>
                    {audit.gps ? <Info label="GPS" value={audit.gps} /> : null}
                    {audit.device ? <Info label="Device" value={audit.device} /> : null}
                    {audit.osVersion ? <Info label="OS Version" value={audit.osVersion} /> : null}
                    {audit.notes ? <Info label="Notes" value={audit.notes} /> : null}
                  </View>
                ) : null}
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function PodScreen({ job, token, userId, onSaved, onQueued }: { job: DriverJob; token: string | null; userId: string; onSaved: (job?: DriverJob) => void; onQueued: (queued: QueuedAction) => void }) {
  const signatureRef = useRef<SignatureViewRef | null>(null);
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [damagePhotoUris, setDamagePhotoUris] = useState<string[]>([]);
  const [documentUris, setDocumentUris] = useState<string[]>([]);
  const [recipientName, setRecipientName] = useState('');
  const [recipientCompany, setRecipientCompany] = useState('');
  const [signatureData, setSignatureData] = useState('');
  const [quantityDelivered, setQuantityDelivered] = useState('');
  const [itemsMissing, setItemsMissing] = useState('');
  const [itemsDamaged, setItemsDamaged] = useState('');
  const [comments, setComments] = useState('');
  const [receiverNotes, setReceiverNotes] = useState('');
  const [driverNotes, setDriverNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const now = new Date();
  const podDate = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const podTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  async function addDeliveryPhoto() {
    const ImagePicker = await import('expo-image-picker');
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return Alert.alert('Camera required', 'Camera permission is required for POD photos.');
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled) setPhotoUris((items) => [...items, ...result.assets.map((asset) => asset.uri)]);
  }

  async function addDamagePhoto() {
    const ImagePicker = await import('expo-image-picker');
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return Alert.alert('Camera required', 'Camera permission is required for damage photos.');
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled) setDamagePhotoUris((items) => [...items, ...result.assets.map((asset) => asset.uri)]);
  }

  async function addDocument() {
    const DocumentPicker = await import('expo-document-picker');
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (!result.canceled) setDocumentUris((items) => [...items, ...result.assets.map((asset) => asset.uri)]);
  }

  async function savePod() {
    if (!recipientName.trim()) {
      Alert.alert('Recipient required', 'Enter the recipient name before saving POD.');
      return;
    }
    if (job.podRequired && photoUris.length === 0) {
      Alert.alert('Delivery photo required', 'Capture at least one delivery photo before saving POD.');
      return;
    }
    if (job.podRequired && !signatureData.trim()) {
      Alert.alert('Signature required', 'Capture the recipient signature before saving POD.');
      return;
    }
    if (!job.podRequired && photoUris.length === 0 && damagePhotoUris.length === 0 && documentUris.length === 0 && !signatureData.trim()) {
      Alert.alert('Evidence required', 'Capture a signature, photo, damage photo or document before saving POD.');
      return;
    }
    if (photoUris.length + damagePhotoUris.length > 10) {
      Alert.alert('Too many photos', 'A maximum of 10 delivery and damage photos are allowed in total.');
      return;
    }
    if (documentUris.length > 10) {
      Alert.alert('Too many documents', 'A maximum of 10 documents are allowed.');
      return;
    }

    setSubmitting(true);

    const noteParts: string[] = [];
    if (quantityDelivered.trim()) noteParts.push(`Qty: ${quantityDelivered.trim()}`);
    if (itemsMissing.trim()) noteParts.push(`Missing: ${itemsMissing.trim()}`);
    if (itemsDamaged.trim()) noteParts.push(`Damaged: ${itemsDamaged.trim()}`);
    if (receiverNotes.trim()) noteParts.push(`Receiver: ${receiverNotes.trim()}`);
    if (driverNotes.trim()) noteParts.push(`Driver: ${driverNotes.trim()}`);
    if (comments.trim()) noteParts.push(`Comments: ${comments.trim()}`);
    const notes = noteParts.join(' | ').slice(0, 2000) || undefined;

    const payload = {
      photoUris,
      damagePhotoUris,
      documentUris,
      recipientName: recipientName.trim(),
      signatureData: signatureData.trim() || undefined,
      notes,
    };
    if (!token || !(await isOnline())) {
      const queued = await enqueueAction(userId, { jobId: job.id, endpoint: 'pod', payload });
      onQueued(queued);
      setSubmitting(false);
      Alert.alert('POD saved offline', 'Your POD evidence has been saved and will be uploaded automatically when connectivity returns.', [
        { text: 'OK', onPress: () => onSaved() },
      ]);
      return;
    }
    try {
      const response = await uploadPod(job.id, token, payload);
      setSubmitting(false);
      onSaved('job' in response ? response.job as DriverJob : undefined);
    } catch (error) {
      const text = error instanceof Error ? error.message : 'The POD could not be saved.';
      setSubmitting(false);
      if (isPermanentClientError(error)) {
        Alert.alert('POD not saved', text);
        return;
      }
      const queued = await enqueueAction(userId, { jobId: job.id, endpoint: 'pod', payload });
      onQueued(queued);
      Alert.alert('POD queued for retry', 'The upload failed. Your POD evidence has been saved and will retry automatically.', [
        { text: 'OK', onPress: () => onSaved() },
      ]);
    }
  }

  return (
    <View style={styles.stack}>
      <Panel>
        <Text style={styles.title}>Proof of Delivery</Text>
        <Text style={styles.subtle}>{job.reference}</Text>
        <Text style={styles.copy}>Complete all required fields before marking the job as delivered.</Text>
        <Info label="Date" value={podDate} />
        <Info label="Time" value={podTime} />
      </Panel>

      <TextInput placeholder="Receiver Name *" placeholderTextColor={colors.muted} style={styles.input} value={recipientName} onChangeText={setRecipientName} />
      <TextInput placeholder="Receiver Company" placeholderTextColor={colors.muted} style={styles.input} value={recipientCompany} onChangeText={setRecipientCompany} />
      <TextInput placeholder="Quantity Delivered" placeholderTextColor={colors.muted} style={styles.input} value={quantityDelivered} onChangeText={setQuantityDelivered} keyboardType="numeric" />
      <TextInput placeholder="Items Missing" placeholderTextColor={colors.muted} style={styles.input} value={itemsMissing} onChangeText={setItemsMissing} />
      <TextInput placeholder="Items Damaged" placeholderTextColor={colors.muted} style={styles.input} value={itemsDamaged} onChangeText={setItemsDamaged} />

      <SecondaryButton label={photoUris.length > 0 ? `Delivery Photos (${photoUris.length}) – add more` : 'Add Delivery Photo'} onPress={() => void addDeliveryPhoto()} />
      <SecondaryButton label={damagePhotoUris.length > 0 ? `Damage Photos (${damagePhotoUris.length}) – add more` : 'Add Damage Photo'} onPress={() => void addDamagePhoto()} />
      <SecondaryButton label={documentUris.length > 0 ? `Documents (${documentUris.length}) – add more` : 'Add Document'} onPress={() => void addDocument()} />

      <TextInput placeholder="Receiver Notes" placeholderTextColor={colors.muted} style={[styles.input, styles.notesInput]} value={receiverNotes} onChangeText={setReceiverNotes} multiline />
      <TextInput placeholder="Driver Notes (optional)" placeholderTextColor={colors.muted} style={[styles.input, styles.notesInput]} value={driverNotes} onChangeText={setDriverNotes} multiline />
      <TextInput placeholder="Comments (optional)" placeholderTextColor={colors.muted} style={[styles.input, styles.notesInput]} value={comments} onChangeText={setComments} multiline />

      <Panel>
        <Text style={styles.infoLabel}>Recipient Signature *</Text>
        <View style={styles.signatureWrap}>
          <SignatureCanvas
            ref={signatureRef}
            penColor={colors.text}
            backgroundColor={colors.panel}
            onOK={setSignatureData}
            onEmpty={() => setSignatureData('')}
            onClear={() => setSignatureData('')}
            onEnd={() => signatureRef.current?.readSignature()}
            autoClear={false}
            descriptionText=""
            webStyle={`
              .m-signature-pad { box-shadow: none; border: none; }
              .m-signature-pad--footer { display: none; margin: 0; }
              body,html { background: ${colors.panel}; }
            `}
            style={styles.signatureCanvas}
          />
        </View>
        <View style={styles.signatureActions}>
          <SecondaryButton label="Clear signature" onPress={() => signatureRef.current?.clearSignature()} />
        </View>
        {signatureData ? (
          <View style={styles.signaturePreviewWrap}>
            <Text style={styles.subtle}>Signature captured</Text>
            <Image source={{ uri: signatureData }} style={styles.signaturePreview} resizeMode="contain" />
          </View>
        ) : (
          <Text style={styles.subtle}>Draw directly in the signature panel above.</Text>
        )}
      </Panel>
      <PrimaryButton label={submitting ? 'Saving...' : 'Save POD'} onPress={() => void savePod()} disabled={submitting} />
    </View>
  );
}

function ViewPodScreen({ pod, onBack }: { pod: PodRecord | null; onBack: () => void }) {
  if (!pod) {
    return (
      <View style={styles.stack}>
        <Panel>
          <Text style={styles.title}>POD Not Available</Text>
          <Text style={styles.copy}>No Proof of Delivery has been recorded for this job yet.</Text>
        </Panel>
        <SecondaryButton label="Back" onPress={onBack} />
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      <Panel>
        <Text style={styles.title}>Proof of Delivery</Text>
        <Info label="Completed By" value={`${pod.completedBy} (${pod.completedByRole})`} />
        <Info label="Date" value={pod.date} />
        <Info label="Time" value={pod.time} />
        {pod.gps ? <Info label="GPS Coordinates" value={pod.gps} /> : null}
      </Panel>
      <Panel>
        <Info label="Receiver" value={pod.receiverName} />
        {pod.receiverCompany ? <Info label="Company" value={pod.receiverCompany} /> : null}
        {pod.quantityDelivered ? <Info label="Quantity Delivered" value={pod.quantityDelivered} /> : null}
        {pod.itemsMissing ? <Info label="Items Missing" value={pod.itemsMissing} /> : null}
        {pod.itemsDamaged ? <Info label="Items Damaged" value={pod.itemsDamaged} /> : null}
      </Panel>
      {pod.signatureData ? (
        <Panel>
          <Text style={styles.infoLabel}>Signature</Text>
          <Image source={{ uri: pod.signatureData }} style={styles.signaturePreview} resizeMode="contain" />
        </Panel>
      ) : null}
      {pod.deliveryPhotoUris && pod.deliveryPhotoUris.length > 0 ? (
        <Panel>
          <Text style={styles.infoLabel}>Delivery Photos ({pod.deliveryPhotoUris.length})</Text>
          <View style={styles.podPhotoGrid}>
            {pod.deliveryPhotoUris.map((uri, idx) => (
              <Image key={idx} source={{ uri }} style={styles.podPhotoThumb} resizeMode="cover" />
            ))}
          </View>
        </Panel>
      ) : null}
      {pod.damagePhotoUris && pod.damagePhotoUris.length > 0 ? (
        <Panel>
          <Text style={styles.infoLabel}>Damage Photos ({pod.damagePhotoUris.length})</Text>
          <View style={styles.podPhotoGrid}>
            {pod.damagePhotoUris.map((uri, idx) => (
              <Image key={idx} source={{ uri }} style={styles.podPhotoThumb} resizeMode="cover" />
            ))}
          </View>
        </Panel>
      ) : null}
      {pod.documentUris && pod.documentUris.length > 0 ? (
        <Panel>
          <Text style={styles.infoLabel}>Documents ({pod.documentUris.length})</Text>
          {pod.documentUris.map((uri, idx) => (
            <TouchableOpacity key={idx} onPress={() => void Linking.openURL(uri)}>
              <Text style={styles.linkText}>Document {idx + 1}</Text>
            </TouchableOpacity>
          ))}
        </Panel>
      ) : null}
      {pod.comments ? <Panel><Info label="Comments" value={pod.comments} /></Panel> : null}
      {pod.receiverNotes ? <Panel><Info label="Receiver Notes" value={pod.receiverNotes} /></Panel> : null}
      {pod.driverNotes ? <Panel><Info label="Driver Notes" value={pod.driverNotes} /></Panel> : null}
      {pod.auditHistory && pod.auditHistory.length > 0 ? (
        <Panel>
          <Text style={styles.infoLabel}>Audit History</Text>
          {pod.auditHistory.map((entry) => (
            <View key={entry.id} style={styles.auditRow}>
              <Text style={styles.auditStatus}>{entry.status.replace(/_/g, ' ').toUpperCase()}</Text>
              <Text style={styles.auditMeta}>{formatDateTime(entry.timestamp)} · {entry.user} · {entry.role}</Text>
            </View>
          ))}
        </Panel>
      ) : null}
      <SecondaryButton label="Back" onPress={onBack} />
    </View>
  );
}

function EmptyJobsScreen({ onRefresh }: { onRefresh: () => void }) {
  return (
    <View style={styles.stack}>
      <Panel>
        <Text style={styles.title}>No active job</Text>
        <Text style={styles.copy}>When a job is awarded and assigned, it will appear here.</Text>
      </Panel>
      <PrimaryButton label="Refresh" onPress={onRefresh} />
    </View>
  );
}

function NotificationsScreen({ notifications, unreadCount, onOpenNotification }: { notifications: DriverAlert[]; unreadCount: number; onOpenNotification: (alert: DriverAlert) => void }) {
  return (
    <View style={styles.stack}>
      <Panel>
        <Text style={styles.title}>Critical Notifications</Text>
        <Text style={styles.copy}>{unreadCount > 0 ? `${unreadCount} unread inbox updates` : 'All inbox notifications are up to date.'}</Text>
      </Panel>
      {notifications.length === 0 ? (
        <Panel>
          <Text style={styles.copy}>No notifications yet.</Text>
        </Panel>
      ) : notifications.map((alert) => {
        const jobId = notificationJobId(alert);
        const inboxNotification = isInboxNotification(alert);
        const inboxUnread = isUnreadInboxNotification(alert);
        const actionable = Boolean(jobId) || inboxUnread;
        const displayStatus = inboxNotification ? (inboxUnread ? 'Unread' : 'Read') : stringField(alert.status, 'sent');
        const displayTone = inboxNotification ? (inboxUnread ? 'warning' : 'success') : statusTone(alert.status === 'failed' ? 'failed' : alert.status === 'sent' ? 'synced' : 'pending');
        return (
          <TouchableOpacity key={alert.id} style={styles.notificationCard} onPress={() => actionable && onOpenNotification(alert)} disabled={!actionable}>
            <View style={styles.notificationHeader}>
              <Text style={styles.notificationTitle}>{notificationTitle(alert)}</Text>
              <StatusPill label={displayStatus} tone={displayTone} />
            </View>
            <Text style={styles.copy}>{notificationSummary(alert)}</Text>
            <Text style={styles.notificationMeta}>{formatRelativeTime(alert.created_at)} • {formatDateTime(alert.created_at)}</Text>
            {jobId ? <Text style={styles.linkText}>Open related job</Text> : inboxUnread ? <Text style={styles.linkText}>Mark as read</Text> : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function ProfileScreen({ resources, queue, onRefresh, onSignOut }: { resources: DriverResources | null; queue: QueuedAction[]; onRefresh: () => void; onSignOut: () => void }) {
  const driver = toRecord(resources?.driver);
  const company = toRecord(resources?.company);
  const vehicle = toRecord(resources?.vehicle);
  const documents = resources?.documents ?? [];
  const invoices = resources?.invoices ?? [];
  const queueCounts = getQueueCounts(queue);
  const approvedDocuments = documents.filter((item) => stringField(toRecord(item).status, '').toLowerCase() === 'approved').length;
  const pendingDocuments = documents.filter((item) => stringField(toRecord(item).status, '').toLowerCase() === 'pending').length;

  return (
    <View style={styles.stack}>
      <Panel>
        <Text style={styles.title}>Driver Profile</Text>
        <Info label="Name" value={stringField(resources?.name || driver.display_name)} />
        <Info label="Email" value={stringField(resources?.email)} />
        <Info label="Phone" value={stringField(resources?.phone || driver.phone)} />
        <Info label="Driver status" value={stringField(driver.status, 'Active')} />
        <Info label="App access" value={driver.app_access === false ? 'Disabled' : 'Enabled'} />
      </Panel>
      <Panel>
        <Text style={styles.infoLabel}>Company</Text>
        <Info label="Name" value={stringField(company.name)} />
        <Info label="Member code" value={stringField(company.company_number)} />
        <Info label="Type" value={stringField(company.company_type)} />
      </Panel>
      <Panel>
        <Text style={styles.infoLabel}>Vehicle</Text>
        <Info label="Registration" value={stringField(vehicle.reg_plate || vehicle.registration_number || vehicle.registration || vehicle.plate_number)} />
        <Info label="Type" value={stringField(vehicle.type || vehicle.vehicle_type || vehicle.body_type)} />
        <Info label="Status" value={stringField(vehicle.status, 'Assigned')} />
      </Panel>
      <Panel>
        <Text style={styles.infoLabel}>Compliance & finance</Text>
        <Info label="Documents" value={`${documents.length} total • ${approvedDocuments} approved • ${pendingDocuments} pending`} />
        <Info label="Invoices" value={`${invoices.length} available`} />
        <Info label="Notification feed" value={`${resources?.alerts?.length ?? 0} updates`} />
      </Panel>
      <Panel>
        <Text style={styles.infoLabel}>Offline queue</Text>
        <Info label="Pending" value={String(queueCounts.pending)} />
        <Info label="Syncing" value={String(queueCounts.syncing)} />
        <Info label="Synced" value={String(queueCounts.synced)} />
        <Info label="Failed" value={String(queueCounts.failed)} />
      </Panel>
      <SecondaryButton label="Refresh account data" onPress={onRefresh} />
      <SecondaryButton label="Sign out" onPress={onSignOut} />
    </View>
  );
}

function QueuePanel({ queue, counts, onRetryFailed, onSyncNow }: { queue: QueuedAction[]; counts: QueueCounts; onRetryFailed: () => void; onSyncNow: () => void }) {
  return (
    <Panel>
      <Text style={styles.infoLabel}>Offline queue</Text>
      {queue.length === 0 ? (
        <Text style={styles.copy}>No queued actions.</Text>
      ) : (
        <View style={styles.queueList}>
          {queue.map((item) => (
            <View key={item.id} style={styles.queueRow}>
              <View style={styles.queueRowTop}>
                <Text style={styles.queueRowTitle}>{item.endpoint.replace(/-/g, ' ')}</Text>
                <StatusPill label={queueStatusLabel(item.status)} tone={statusTone(item.status)} />
              </View>
              <Text style={styles.subtle}>{stringField(item.jobId, 'Unknown job').slice(0, 8).toUpperCase()} • queued {formatRelativeTime(item.createdAt)}</Text>
              {item.lastError ? <Text style={styles.queueError}>{item.lastError}</Text> : null}
            </View>
          ))}
        </View>
      )}
      <View style={styles.queueActions}>
        <SecondaryButton label="Sync now" onPress={onSyncNow} />
        {counts.failed > 0 ? <SecondaryButton label="Retry failed" onPress={onRetryFailed} /> : null}
      </View>
    </Panel>
  );
}

function BottomNav({ active, onChange }: { active: Screen; onChange: (screen: Screen) => void }) {
  const items: Array<[Screen, string]> = [['liveLoads', 'Loads'], ['active', 'Active'], ['jobs', 'Jobs'], ['pod', 'POD'], ['profile', 'Profile']];
  return (
    <View style={styles.nav}>
      {items.map(([item, label]) => (
        <TouchableOpacity key={item} style={[styles.navItem, active === item && styles.navItemActive]} onPress={() => onChange(item)}>
          <Text style={[styles.navText, active === item && styles.navTextActive]}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function Segmented({ value, onChange }: { value: JobScope; onChange: (scope: JobScope) => void }) {
  const items: JobScope[] = ['active', 'upcoming', 'completed'];
  return (
    <View style={styles.segmented}>
      {items.map((item) => (
        <TouchableOpacity key={item} style={[styles.segment, value === item && styles.segmentActive]} onPress={() => onChange(item)}>
          <Text style={[styles.segmentText, value === item && styles.segmentTextActive]}>{item}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function Panel({ children }: { children: ReactNode }) { return <View style={styles.panel}>{children}</View>; }
function Info({ label, value }: { label: string; value: string }) { return <View style={styles.info}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>; }
function StatusPill({ label, tone }: { label: string; tone: 'primary' | 'success' | 'warning' | 'danger' }) {
  const backgroundColor = tone === 'success' ? colors.success : tone === 'warning' ? colors.warning : tone === 'danger' ? colors.danger : colors.primary;
  return <Text style={[styles.pill, { backgroundColor }]}>{label}</Text>;
}
function PrimaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) { return <TouchableOpacity style={[styles.primaryButton, disabled === true && styles.disabled]} onPress={onPress} disabled={disabled}><Text style={styles.primaryText}>{label}</Text></TouchableOpacity>; }
function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) { return <TouchableOpacity style={styles.secondaryButton} onPress={onPress}><Text style={styles.secondaryText}>{label}</Text></TouchableOpacity>; }
function SmallButton({ label, onPress }: { label: string; onPress: () => void }) { return <TouchableOpacity style={styles.smallButton} onPress={onPress}><Text style={styles.smallText}>{label}</Text></TouchableOpacity>; }

async function safeRegisterPushToken(sessionToken: string) {
  try {
    const { registerPushToken } = await import('../push/registerPushToken');
    await registerPushToken(sessionToken);
  } catch {
    // Push registration must never block the driver from opening the app.
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  shell: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: 100 },
  stack: { gap: spacing.md },
  login: { flex: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
  logo: { color: colors.text, fontSize: 30, fontWeight: '800' },
  header: { padding: spacing.md, borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  subtle: { color: colors.muted },
  message: { color: colors.warning, fontWeight: '700' },
  input: { minHeight: 52, borderColor: colors.border, borderWidth: 1, borderRadius: 8, color: colors.text, paddingHorizontal: spacing.md, backgroundColor: colors.panel },
  notesInput: { minHeight: 88, paddingTop: spacing.md, textAlignVertical: 'top' },
  panel: { backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: 10, padding: spacing.md, gap: spacing.sm },
  label: { color: colors.muted, fontSize: 13, textTransform: 'uppercase' },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  route: { color: colors.text, fontSize: 18, fontWeight: '700' },
  arrow: { color: colors.muted, fontSize: 13 },
  copy: { color: colors.muted, lineHeight: 20 },
  info: { gap: 4 },
  infoLabel: { color: colors.muted, fontSize: 12, textTransform: 'uppercase' },
  infoValue: { color: colors.text, fontSize: 16, fontWeight: '600' },
  primaryButton: { minHeight: 56, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  secondaryButton: { minHeight: 50, borderRadius: 10, borderColor: colors.border, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.panelSoft, paddingHorizontal: spacing.md },
  secondaryText: { color: colors.text, fontWeight: '700' },
  smallButton: { borderColor: colors.border, borderWidth: 1, borderRadius: 8, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  smallText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  disabled: { opacity: 0.4 },
  pill: { alignSelf: 'flex-start', color: '#fff', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: 999, overflow: 'hidden', fontWeight: '800', textTransform: 'capitalize' },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  jobRow: { backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: 10, padding: spacing.md, gap: spacing.xs },
  jobRef: { color: colors.text, fontSize: 18, fontWeight: '800' },
  segmented: { flexDirection: 'row', backgroundColor: colors.panel, borderRadius: 10, padding: 4, borderColor: colors.border, borderWidth: 1 },
  segment: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { color: colors.muted, textTransform: 'capitalize', fontWeight: '700' },
  segmentTextActive: { color: '#fff' },
  nav: { position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: 74, backgroundColor: colors.panel, borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', padding: spacing.xs },
  navItem: { flex: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  navItemActive: { backgroundColor: colors.panelSoft },
  navText: { color: colors.muted, fontWeight: '700' },
  navTextActive: { color: colors.text },
  signatureWrap: { overflow: 'hidden', borderRadius: 10, borderColor: colors.border, borderWidth: 1, height: 220, backgroundColor: colors.panel },
  signatureCanvas: { flex: 1, backgroundColor: colors.panel },
  signatureActions: { gap: spacing.sm },
  signaturePreviewWrap: { gap: spacing.sm },
  signaturePreview: { width: '100%', height: 120, borderRadius: 8, backgroundColor: colors.panelSoft },
  notificationCard: { backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: 10, padding: spacing.md, gap: spacing.sm },
  notificationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  notificationTitle: { color: colors.text, fontSize: 16, fontWeight: '800', flex: 1 },
  notificationMeta: { color: colors.muted, fontSize: 12 },
  linkText: { color: colors.primary, fontWeight: '700' },
  queueList: { gap: spacing.sm },
  queueRow: { borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: spacing.sm, gap: spacing.xs, backgroundColor: colors.panelSoft },
  queueRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  queueRowTitle: { color: colors.text, fontWeight: '700', textTransform: 'capitalize', flex: 1 },
  queueActions: { gap: spacing.sm },
  queueError: { color: colors.danger, fontWeight: '600' },
  detailTabs: { flexDirection: 'row', backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 4 },
  detailTab: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  detailTabActive: { backgroundColor: colors.primary },
  detailTabText: { color: colors.muted, fontWeight: '800', fontSize: 13 },
  detailTabTextActive: { color: '#fff' },
  contactRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  contactButton: { flex: 1, minHeight: 44, backgroundColor: colors.panelSoft, borderColor: colors.border, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  contactButtonText: { color: colors.text, fontWeight: '800', fontSize: 13 },
  mapButton: { minHeight: 44, backgroundColor: colors.panelSoft, borderColor: colors.border, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xs },
  mapButtonText: { color: colors.primary, fontWeight: '800', fontSize: 13 },
  attachmentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs, borderBottomColor: colors.border, borderBottomWidth: 1 },
  attachmentLeft: { flex: 1, gap: 2 },
  attachmentName: { color: colors.text, fontWeight: '700', fontSize: 14 },
  attachmentMeta: { color: colors.muted, fontSize: 11 },
  attachmentAction: { color: colors.primary, fontWeight: '900', fontSize: 20, paddingLeft: spacing.sm },
  stopTypeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  stopTypeLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  stopCollection: { color: '#22c55e' },
  stopDelivery: { color: '#ef4444' },
  viewPodButton: { minHeight: 52, backgroundColor: '#16a34a', borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  viewPodButtonText: { color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 0.6 },
  timelineRow: { flexDirection: 'row', gap: spacing.sm },
  timelineConnectorCol: { alignItems: 'center', width: 28 },
  timelineLine: { width: 2, flex: 1, minHeight: 14 },
  timelineLineBottom: { width: 2, flex: 1, minHeight: 14 },
  timelineLineDone: { backgroundColor: '#22c55e' },
  timelineLinePending: { backgroundColor: colors.border },
  timelineDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  timelineDotDone: { backgroundColor: '#22c55e', borderColor: '#22c55e' },
  timelineDotPending: { backgroundColor: colors.panelSoft, borderColor: colors.border },
  timelineDotCurrent: { borderColor: colors.primary },
  timelineDotCheck: { color: '#fff', fontSize: 12, fontWeight: '900' },
  timelineContent: { flex: 1, paddingBottom: spacing.md },
  timelineLabel: { fontWeight: '800', fontSize: 15 },
  timelineLabelDone: { color: colors.text },
  timelineLabelPending: { color: colors.muted },
  timelineMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  timelineExpanded: { marginTop: spacing.sm, gap: spacing.xs },
  podPhotoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  podPhotoThumb: { width: 80, height: 80, borderRadius: 8, backgroundColor: colors.panelSoft },
  auditRow: { paddingVertical: spacing.xs, borderBottomColor: colors.border, borderBottomWidth: 1 },
  auditStatus: { color: colors.text, fontWeight: '700', fontSize: 13 },
  auditMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
});
