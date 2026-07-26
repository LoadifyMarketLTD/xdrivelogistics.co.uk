import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, Image, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import SignatureCanvas, { type SignatureViewRef } from 'react-native-signature-canvas';

import { fetchJob, fetchJobs, postJobStatus, uploadPod } from '../api/jobs';
import { fetchDriverResources, type DriverAlert, type DriverResources } from '../api/resources';
import { clearSessionToken, saveSessionToken } from '../auth/sessionStore';
import { isSupabaseConfigured, supabase } from '../auth/supabase';
import { getNextStep } from '../jobs/statusFlow';
import type { DriverJob, JobScope, QueuedActionStatus } from '../jobs/types';
import { LiveLoadsScreen } from '../live-loads/LiveLoadsScreen';
import {
  enqueueAction,
  getQueue,
  isOnline,
  isQueueItemReady,
  markQueueItemFailed,
  markQueueItemSynced,
  markQueueItemSyncing,
  retryQueueItem,
  type QueuedAction,
} from '../offline/queue';
import { colors, spacing } from '../ui/theme';

type Screen = 'login' | 'liveLoads' | 'active' | 'jobs' | 'detail' | 'pod' | 'notifications' | 'profile';

type QueueCounts = Record<QueuedActionStatus, number>;

const notificationEventTitles: Record<string, string> = {
  job_assigned: 'Job assigned',
  bid_accepted: 'Bid accepted',
  pod_uploaded: 'POD uploaded',
  job_cancelled: 'Job cancelled',
  job_updated: 'Job updated',
  dispatcher_message: 'Dispatcher update',
};

function getAccessToken(session: { access_token?: string | null } | null | undefined) {
  const token = session?.access_token?.trim();
  return token || null;
}

async function validateDriverRole(userId: string): Promise<string | null> {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (error || !profile) {
      console.warn('[auth] Profile fetch failed or not found:', error?.message);
      return null;
    }

    if ((profile as { role?: string }).role !== 'driver') {
      console.warn('[auth] User role is not driver:', (profile as { role?: string }).role);
      return null;
    }

    return userId;
  } catch (error) {
    console.error('[auth] Driver role validation error:', error);
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

export default function DriverMobileApp() {
  const [screen, setScreen] = useState<Screen>('login');
  const [token, setToken] = useState<string | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<DriverJob[]>([]);
  const [job, setJob] = useState<DriverJob | null>(null);
  const [scope, setScope] = useState<JobScope>('active');
  const [queue, setQueue] = useState<QueuedAction[]>([]);
  const [resources, setResources] = useState<DriverResources | null>(null);
  const [notificationsSeenAt, setNotificationsSeenAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [message, setMessage] = useState('');
  const queueSyncInFlightRef = useRef(false);
  const nextStep = useMemo(() => (job ? getNextStep(job.status) : undefined), [job]);
  const queueCounts = useMemo(() => getQueueCounts(queue), [queue]);
  const notificationsSeenKey = authUserId ? `xdrive.driver.notificationsSeen:${authUserId}` : null;
  const driverCanCommercialBid = optionalBoolean(resources?.driver?.can_commercial_bid);
  const unreadNotificationCount = useMemo(() => {
    if (!resources?.alerts?.length) return 0;
    if (!notificationsSeenAt) return resources.alerts.length;
    const threshold = new Date(notificationsSeenAt).getTime();
    return resources.alerts.filter((alert) => new Date(alert.created_at).getTime() > threshold).length;
  }, [notificationsSeenAt, resources?.alerts]);

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

  const flushQueue = useCallback(async (sessionToken: string, userId: string, options: { force?: boolean } = {}) => {
    if (queueSyncInFlightRef.current) return;
    if (!(await isOnline())) return;

    queueSyncInFlightRef.current = true;
    try {
      let nextQueue = await getQueue(userId);
      const readyItems = nextQueue.filter((item) => (options.force ? item.status !== 'synced' : isQueueItemReady(item)));
      if (readyItems.length === 0) {
        setQueue(nextQueue);
        return;
      }

      for (const item of readyItems) {
        nextQueue = await markQueueItemSyncing(userId, item.id);
        setQueue(nextQueue);
        try {
          if (item.endpoint === 'pod') await uploadPod(item.jobId, sessionToken, item.payload ?? {});
          else await postJobStatus(item.jobId, item.endpoint, sessionToken);
          nextQueue = await markQueueItemSynced(userId, item.id);
        } catch (error) {
          nextQueue = await markQueueItemFailed(userId, item.id, error instanceof Error ? error.message : 'Sync failed.', item.retryCount);
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

  useEffect(() => {
    void supabase.auth.getSession()
      .then(async ({ data }: { data: { session: { access_token?: string | null; user?: { id?: string | null } | null } | null } }) => {
        const sessionToken = getAccessToken(data.session);
        const userId = data.session?.user?.id?.trim() || null;
        setAuthUserId(userId);
        if (!sessionToken || !userId) {
          void clearSessionToken();
          return;
        }

        const isDriver = await validateDriverRole(userId);
        if (!isDriver) {
          setMessage('Access denied: only drivers can use this app.');
          await supabase.auth.signOut().catch(() => undefined);
          await clearSessionToken();
          setScreen('login');
          return;
        }

        setToken(sessionToken);
        void saveSessionToken(sessionToken);
        // Load the queue for this specific user only after auth is confirmed.
        void getQueue(userId).then(setQueue).catch(() => setQueue([]));
        await loadJobs(sessionToken);
        void loadResources(sessionToken);
        void safeRegisterPushToken(sessionToken);
        void flushQueue(sessionToken, userId);
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
      if (!session) setScreen('login');
    });
    return () => subscription.unsubscribe();
  }, [flushQueue, loadJobs, loadResources]);

  useEffect(() => {
    if (!notificationsSeenKey) {
      setNotificationsSeenAt(null);
      return;
    }
    void AsyncStorage.getItem(notificationsSeenKey).then(setNotificationsSeenAt).catch(() => setNotificationsSeenAt(null));
  }, [notificationsSeenKey]);

  useEffect(() => {
    if (!token) return;
    if (screen === 'profile' || screen === 'notifications') {
      void loadResources(token);
    }
  }, [loadResources, screen, token]);

  useEffect(() => {
    if (screen !== 'notifications' || !notificationsSeenKey) return;
    const seenAt = resources?.alerts?.[0]?.created_at ?? new Date().toISOString();
    setNotificationsSeenAt(seenAt);
    void AsyncStorage.setItem(notificationsSeenKey, seenAt).catch(() => undefined);
  }, [notificationsSeenKey, resources?.alerts, screen]);

  useEffect(() => {
    if (!token || !authUserId) return;
    const subscription = Network.addNetworkStateListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        void flushQueue(token, authUserId);
      }
    });
    const intervalId = setInterval(() => {
      void flushQueue(token, authUserId);
    }, 15_000);
    return () => {
      subscription.remove();
      clearInterval(intervalId);
    };
  }, [authUserId, flushQueue, token]);

  async function signIn(email: string, password: string) {
    if (!isSupabaseConfigured) {
      setMessage('Supabase mobile config is missing.');
      return;
    }
    setLoading(true);
    setMessage('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setLoading(false);
      setMessage(error.message);
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    setLoading(false);
    const accessToken = sessionData.session?.access_token ?? null;
    const userId = sessionData.session?.user?.id?.trim() || null;
    if (!accessToken || !userId) {
      setMessage('Login succeeded but the session could not be restored.');
      await supabase.auth.signOut().catch(() => undefined);
      return;
    }

    const isDriver = await validateDriverRole(userId);
    if (!isDriver) {
      setMessage('Access denied: only drivers can use this app.');
      await supabase.auth.signOut().catch(() => undefined);
      return;
    }

    setToken(accessToken);
    setAuthUserId(userId);
    try {
      await saveSessionToken(accessToken);
    } catch {
      // SecureStore failure should not block sign-in.
    }
    void safeRegisterPushToken(accessToken);
    void getQueue(userId).then(setQueue).catch(() => setQueue([]));
    await loadJobs(accessToken);
    void loadResources(accessToken);
    void flushQueue(accessToken, userId);
  }

  async function signOut() {
    await supabase.auth.signOut();
    await clearSessionToken();
    setToken(null);
    setAuthUserId(null);
    setJob(null);
    setJobs([]);
    setQueue([]);
    setResources(null);
    setNotificationsSeenAt(null);
    setScreen('login');
  }

  async function retryFailedQueueItems() {
    if (!authUserId) return;
    const failedItems = queue.filter((item) => item.status === 'failed');
    for (const item of failedItems) {
      await retryQueueItem(authUserId, item.id);
    }
    const latestQueue = await getQueue(authUserId);
    setQueue(latestQueue);
    if (token) await flushQueue(token, authUserId, { force: true });
  }

  async function submitStatus() {
    if (!job) return;
    if (!nextStep) {
      setMessage('Job status is already up to date.');
      return;
    }
    if (nextStep.status === 'delivered' && job.podRequired && job.podGenerated !== true) {
      setMessage('Proof of Delivery is required before marking this job as delivered.');
      setScreen('pod');
      return;
    }

    const apply = async () => {
      if (!authUserId) {
        setMessage('Driver session is not ready. Please sign in again.');
        return;
      }
      if (!token || !(await isOnline())) {
        const queued = await enqueueAction(authUserId, { jobId: job.id, endpoint: nextStep.endpoint });
        setQueue((items) => [queued, ...items]);
        setJob((current) => (current ? { ...current, status: nextStep.status } : current));
        setMessage('Action saved offline. It will sync automatically when connectivity returns.');
        return;
      }
      try {
        const response = await postJobStatus(job.id, nextStep.endpoint, token);
        if ('job' in response) setJob(response.job as DriverJob);
        await loadJobs(token, scope, { navigate: false });
      } catch (error) {
        const text = error instanceof Error ? error.message : 'Queued for retry.';
        if (/pod is required/i.test(text)) {
          setMessage(text);
          setScreen('pod');
          return;
        }
        const queued = await enqueueAction(authUserId, { jobId: job.id, endpoint: nextStep.endpoint });
        setQueue((items) => [queued, ...items]);
        setMessage(text);
        setJob((current) => (current ? { ...current, status: nextStep.status } : current));
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
    if ((nextScreen === 'pod' || nextScreen === 'active' || nextScreen === 'detail') && !job) {
      setScreen('jobs');
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
                onPod={() => setScreen('pod')}
                onRetryFailed={() => void retryFailedQueueItems()}
                onSyncNow={() => token && authUserId && void flushQueue(token, authUserId, { force: true })}
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
            {screen === 'detail' && job && <JobDetailScreen job={job} onPrimary={() => setScreen('active')} />}
            {screen === 'pod' && job && (
              <PodScreen
                job={job}
                token={token}
                userId={authUserId}
                onSaved={(updatedJob) => {
                  if (updatedJob) setJob(updatedJob);
                  else setJob((current) => (current ? { ...current, podGenerated: true } : current));
                  setScreen('active');
                }}
                onQueued={(queued) => setQueue((items) => [queued, ...items])}
              />
            )}
            {screen === 'notifications' && (
              <NotificationsScreen
                notifications={resources?.alerts ?? []}
                unreadCount={unreadNotificationCount}
                onOpenJob={(jobId) => void openJobById(jobId)}
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
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.login}>
        <Text style={styles.logo}>XDrive Driver</Text>
        <Text style={styles.subtle}>Native operations app</Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}
        <TextInput autoCapitalize="none" keyboardType="email-address" placeholder="Email" placeholderTextColor={colors.muted} style={styles.input} value={email} onChangeText={setEmail} />
        <TextInput placeholder="Password" placeholderTextColor={colors.muted} secureTextEntry style={styles.input} value={password} onChangeText={setPassword} />
        <PrimaryButton label={loading ? 'Signing in...' : 'Sign in'} onPress={() => onSignIn(email, password)} disabled={!email || !password || loading} />
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
        <Info label="POD" value={job.podGenerated ? 'Captured' : job.podRequired ? 'Required' : 'Not required'} />
        {job.price ? <Info label="Price" value={job.price} /> : null}
      </Panel>
      <PrimaryButton label={nextLabel} onPress={onPrimary} />
      <SecondaryButton label="Job detail" onPress={onDetail} />
      <SecondaryButton label="Capture POD" onPress={onPod} />
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

function JobDetailScreen({ job, onPrimary }: { job: DriverJob; onPrimary: () => void }) {
  return (
    <View style={styles.stack}>
      <Panel>
        <Text style={styles.title}>{job.reference}</Text>
        <Info label="Lifecycle" value={stringField(job.lifecycleStatus, 'In progress')} />
        <Info label="Pickup" value={job.pickupLocation} />
        <Info label="Delivery" value={job.deliveryLocation} />
        <Info label="Pickup time" value={job.pickupTime} />
        <Info label="Delivery time" value={job.deliveryTime} />
        <Info label="Cargo" value={job.cargoType} />
        <Info label="Vehicle" value={job.vehicleRequirement} />
        <Info label="POD" value={job.podGenerated ? 'Captured' : job.podRequired ? 'Required before delivery' : 'Not required'} />
        {job.price ? <Info label="Price" value={job.price} /> : null}
        {job.requirements ? <Info label="Requirements" value={job.requirements} /> : null}
        {job.contactAllowed && job.contactName ? <Info label="Contact" value={job.contactName} /> : null}
        {job.contactAllowed && job.contactPhone ? <Info label="Phone" value={job.contactPhone} /> : null}
        {job.updatedAt ? <Info label="Last updated" value={formatDateTime(job.updatedAt)} /> : null}
      </Panel>
      <PrimaryButton label="Back to active" onPress={onPrimary} />
    </View>
  );
}

function PodScreen({ job, token, userId, onSaved, onQueued }: { job: DriverJob; token: string | null; userId: string | null; onSaved: (job?: DriverJob) => void; onQueued: (queued: QueuedAction) => void }) {
  const signatureRef = useRef<SignatureViewRef | null>(null);
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [documentUris, setDocumentUris] = useState<string[]>([]);
  const [recipientName, setRecipientName] = useState('');
  const [signatureData, setSignatureData] = useState('');
  const [notes, setNotes] = useState('');

  async function addPhoto() {
    const ImagePicker = await import('expo-image-picker');
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return Alert.alert('Camera required', 'Camera permission is required for POD photos.');
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled) setPhotoUris((items) => [...items, ...result.assets.map((asset) => asset.uri)]);
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
    if (photoUris.length === 0 && documentUris.length === 0 && !signatureData.trim()) {
      Alert.alert('Evidence required', 'Capture a signature, photo or document before saving POD.');
      return;
    }

    const payload = { photoUris, documentUris, recipientName, signatureData, notes };
    if (!userId) {
      Alert.alert('Session error', 'Driver session is not ready. Please sign in again.');
      return;
    }
    if (!token || !(await isOnline())) {
      const queued = await enqueueAction(userId, { jobId: job.id, endpoint: 'pod', payload });
      onQueued(queued);
      onSaved();
      return;
    }
    try {
      const response = await uploadPod(job.id, token, payload);
      onSaved('job' in response ? response.job as DriverJob : undefined);
    } catch {
      const queued = await enqueueAction(userId, { jobId: job.id, endpoint: 'pod', payload });
      onQueued(queued);
      onSaved();
    }
  }

  return (
    <View style={styles.stack}>
      <Panel>
        <Text style={styles.title}>Proof of Delivery</Text>
        <Text style={styles.subtle}>{job.reference}</Text>
        <Text style={styles.copy}>Add required POD evidence before marking the job as delivered.</Text>
      </Panel>
      <SecondaryButton label={photoUris.length > 0 ? `Photos (${photoUris.length}) – add more` : 'Add photo'} onPress={() => void addPhoto()} />
      <SecondaryButton label={documentUris.length > 0 ? `Documents (${documentUris.length}) – add more` : 'Add document'} onPress={() => void addDocument()} />
      <TextInput
        placeholder="Recipient name (required)"
        placeholderTextColor={colors.muted}
        style={styles.input}
        value={recipientName}
        onChangeText={setRecipientName}
      />
      {!recipientName.trim() ? (
        <Text style={styles.subtle}>Recipient name is required to save POD.</Text>
      ) : null}
      <TextInput
        placeholder="Notes (optional)"
        placeholderTextColor={colors.muted}
        style={[styles.input, styles.notesInput]}
        value={notes}
        onChangeText={setNotes}
        multiline
      />
      <Panel>
        <Text style={styles.infoLabel}>Recipient signature</Text>
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
      <PrimaryButton label="Save POD" onPress={() => void savePod()} />
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

function NotificationsScreen({ notifications, unreadCount, onOpenJob }: { notifications: DriverAlert[]; unreadCount: number; onOpenJob: (jobId: string) => void }) {
  return (
    <View style={styles.stack}>
      <Panel>
        <Text style={styles.title}>Critical Notifications</Text>
        <Text style={styles.copy}>{unreadCount > 0 ? `${unreadCount} unread updates` : 'All notifications are up to date.'}</Text>
      </Panel>
      {notifications.length === 0 ? (
        <Panel>
          <Text style={styles.copy}>No notifications yet.</Text>
        </Panel>
      ) : notifications.map((alert) => {
        const canOpenJob = alert.entity_type === 'job' && Boolean(alert.entity_id);
        return (
          <TouchableOpacity key={alert.id} style={styles.notificationCard} onPress={() => canOpenJob && onOpenJob(alert.entity_id)} disabled={!canOpenJob}>
            <View style={styles.notificationHeader}>
              <Text style={styles.notificationTitle}>{notificationTitle(alert)}</Text>
              <StatusPill label={stringField(alert.status, 'pending')} tone={statusTone(alert.status === 'failed' ? 'failed' : alert.status === 'sent' ? 'synced' : 'pending')} />
            </View>
            <Text style={styles.copy}>{notificationSummary(alert)}</Text>
            <Text style={styles.notificationMeta}>{formatRelativeTime(alert.created_at)} • {formatDateTime(alert.created_at)}</Text>
            {canOpenJob ? <Text style={styles.linkText}>Open related job</Text> : null}
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
});
