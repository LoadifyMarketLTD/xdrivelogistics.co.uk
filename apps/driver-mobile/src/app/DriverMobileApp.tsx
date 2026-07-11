import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import {
  fetchDocuments,
  fetchJobs,
  fetchNotifications,
  fetchProfile,
  fetchQuotes,
  fetchVehicle,
  markNotificationsRead,
  postJobStatus,
  uploadPod,
  type DriverDocument,
} from '../api/jobs';
import { clearSessionToken, saveSessionToken } from '../auth/sessionStore';
import { isSupabaseConfigured, supabase } from '../auth/supabase';
import { getNextStep } from '../jobs/statusFlow';
import type {
  DriverJob,
  DriverNotification,
  DriverProfile,
  DriverQuote,
  DriverVehicle,
  JobScope,
} from '../jobs/types';
import { enqueueAction, getQueue, isOnline, saveQueue, updateQueueItem, type QueuedAction } from '../offline/queue';
import { colors, spacing } from '../ui/theme';

// ─── Screen types ────────────────────────────────────────────────────────────

type MainTab = 'home' | 'alerts' | 'quotes' | 'bookings' | 'more';
type SubScreen =
  | 'login'
  | 'home'
  | 'alerts'
  | 'quotes'
  | 'bookings'
  | 'more'
  | 'job_detail'
  | 'pod'
  | 'profile'
  | 'vehicle'
  | 'documents'
  | 'messages';

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
      .maybeSingle();

    if (error) {
      // Profile fetch failed (e.g. RLS, network) — allow login; server will validate
      console.warn('[auth] Profile fetch failed:', error?.message);
      return userId;
    }
    if (!profile) {
      // No profile row yet (e.g. new driver) — allow login; server will validate
      console.warn('[auth] Profile not found, allowing login.');
      return userId;
    }
    if (profile.role !== 'driver') {
      console.warn('[auth] User role is not driver:', profile.role);
      return null;
    }
    return userId;
  } catch (error) {
    console.error('[auth] Driver role validation error:', error);
    return userId; // Allow login on unexpected errors; server is authoritative
  }
}

// ─── Root Component ───────────────────────────────────────────────────────────

export default function DriverMobileApp() {
  const [screen, setScreen] = useState<SubScreen>('login');
  const [activeTab, setActiveTab] = useState<MainTab>('home');
  const [token, setToken] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string>('');

  // Jobs
  const [jobs, setJobs] = useState<DriverJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<DriverJob | null>(null);
  const [jobScope, setJobScope] = useState<JobScope>('active');
  const [queue, setQueue] = useState<QueuedAction[]>([]);

  // Other data
  const [notifications, setNotifications] = useState<DriverNotification[]>([]);
  const [quotes, setQuotes] = useState<DriverQuote[]>([]);
  const [vehicle, setVehicle] = useState<DriverVehicle | null>(null);
  const [profile, setProfile] = useState<DriverProfile | null>(null);

  // UI
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const nextStep = useMemo(
    () => (selectedJob ? getNextStep(selectedJob.status) : undefined),
    [selectedJob]
  );

  // ── Data loading ───────────────────────────────────────────────────────────

  const loadJobs = useCallback(async (sessionToken: string, nextScope = jobScope) => {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetchJobs(nextScope, sessionToken);
      setJobs(response.jobs);
      if (nextScope === 'active' && response.jobs.length > 0) {
        setSelectedJob((current) => current ?? response.jobs[0] ?? null);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load jobs.');
    } finally {
      setLoading(false);
    }
  }, [jobScope]);

  const loadNotifications = useCallback(async (sessionToken: string) => {
    try {
      const response = await fetchNotifications(sessionToken);
      setNotifications(response.notifications);
    } catch {
      // Non-critical — keep current state
    }
  }, []);

  const loadQuotes = useCallback(async (sessionToken: string) => {
    try {
      const response = await fetchQuotes(sessionToken);
      setQuotes(response.quotes);
    } catch {
      // Non-critical
    }
  }, []);

  const loadVehicleAndProfile = useCallback(async (sessionToken: string) => {
    try {
      const [vehicleRes, profileRes] = await Promise.all([
        fetchVehicle(sessionToken),
        fetchProfile(sessionToken),
      ]);
      setVehicle(vehicleRes.vehicle);
      setProfile(profileRes.profile);
      if (profileRes.profile?.display_name) {
        const first = profileRes.profile.display_name.split(' ')[0] ?? '';
        setFirstName(first);
      }
    } catch {
      // Non-critical
    }
  }, []);

  const loadAll = useCallback(async (sessionToken: string) => {
    await Promise.all([
      loadJobs(sessionToken),
      loadNotifications(sessionToken),
      loadQuotes(sessionToken),
      loadVehicleAndProfile(sessionToken),
    ]);
  }, [loadJobs, loadNotifications, loadQuotes, loadVehicleAndProfile]);

  const flushQueue = useCallback(async (sessionToken: string) => {
    if (!(await isOnline())) return;
    const pending = (await getQueue()).filter((item) => item.status === 'pending' || item.status === 'failed');
    let nextQueue = await getQueue();
    for (const item of pending) {
      try {
        if (item.endpoint === 'pod') await uploadPod(item.jobId, sessionToken, item.payload ?? {});
        else await postJobStatus(item.jobId, item.endpoint, sessionToken);
        nextQueue = await updateQueueItem(item.id, { status: 'synced', lastError: undefined });
      } catch (error) {
        nextQueue = await updateQueueItem(item.id, {
          status: 'failed',
          lastError: error instanceof Error ? error.message : 'Sync failed',
        });
      }
    }
    setQueue(nextQueue);
    await loadJobs(sessionToken);
  }, [loadJobs]);

  // ── Auth lifecycle ─────────────────────────────────────────────────────────

  useEffect(() => {
    void supabase.auth
      .getSession()
      .then(async ({ data }) => {
        const sessionToken = getAccessToken(data.session);
        if (!sessionToken) {
          void clearSessionToken();
          return;
        }
        const userId = data.session?.user?.id;
        if (!userId) {
          setMessage('Session invalid: user ID not found.');
          await supabase.auth.signOut().catch(() => undefined);
          await clearSessionToken();
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
        void loadAll(sessionToken);
        void safeRegisterPushToken(sessionToken);
        void flushQueue(sessionToken);
      })
      .catch(() => {
        void clearSessionToken();
        setScreen('login');
      });

    void getQueue().then(setQueue).catch(() => setQueue([]));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextToken = getAccessToken(session);
      setToken(nextToken);
      if (nextToken) void saveSessionToken(nextToken);
      else void clearSessionToken();
      if (!session) setScreen('login');
    });
    return () => subscription.unsubscribe();
  }, [flushQueue, loadAll]);

  // Sync screen with active tab
  useEffect(() => {
    if (screen !== 'login' && screen !== 'job_detail' && screen !== 'pod') {
      if (!['profile', 'vehicle', 'documents', 'messages'].includes(screen)) {
        setScreen(activeTab);
      }
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auth actions ───────────────────────────────────────────────────────────

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
    if (!accessToken) {
      setMessage('Login succeeded but no access token was returned.');
      await supabase.auth.signOut().catch(() => undefined);
      return;
    }
    const userId = sessionData.session?.user?.id;
    if (!userId) {
      setMessage('Session invalid: user ID not found.');
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
    try {
      await saveSessionToken(accessToken);
    } catch {
      /* SecureStore non-critical */
    }
    void safeRegisterPushToken(accessToken);
    setActiveTab('home');
    setScreen('home');
    await loadAll(accessToken);
  }

  async function signOut() {
    await supabase.auth.signOut();
    await clearSessionToken();
    await saveQueue([]);
    setToken(null);
    setSelectedJob(null);
    setJobs([]);
    setQueue([]);
    setNotifications([]);
    setQuotes([]);
    setVehicle(null);
    setProfile(null);
    setFirstName('');
    setScreen('login');
  }

  // ── Job status actions ─────────────────────────────────────────────────────

  async function submitStatus() {
    if (!selectedJob) return;
    if (!nextStep) {
      if (selectedJob.podRequired && !selectedJob.podGenerated) {
        setMessage('Proof of Delivery is required before marking job as delivered.');
        setScreen('pod');
        return;
      }
      setMessage('Job complete. Ready to submit.');
      return;
    }
    const apply = async () => {
      if (!token || !(await isOnline())) {
        const queued = await enqueueAction({ jobId: selectedJob.id, endpoint: nextStep.endpoint });
        setQueue((items) => [queued, ...items]);
        setSelectedJob((current) => (current ? { ...current, status: nextStep.status } : current));
        return;
      }
      try {
        const response = await postJobStatus(selectedJob.id, nextStep.endpoint, token);
        if ('job' in response) setSelectedJob(response.job as DriverJob);
        if (token) await loadJobs(token);
      } catch (error) {
        const queued = await enqueueAction({ jobId: selectedJob.id, endpoint: nextStep.endpoint });
        setQueue((items) => [queued, ...items]);
        setMessage(error instanceof Error ? error.message : 'Queued for retry.');
        setSelectedJob((current) => (current ? { ...current, status: nextStep.status } : current));
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

  // ── Computed ───────────────────────────────────────────────────────────────

  const unreadCount = notifications.filter((n) => !n.read_at).length;
  const assignedJobs = jobs.filter((j) => j.status === 'awarded');
  const inProgressJobs = jobs.filter((j) =>
    ['on_my_way_pickup', 'arrived_pickup', 'loaded', 'on_my_way_delivery', 'arrived_delivery'].includes(j.status)
  );
  const completedJobs = jobs.filter((j) => j.status === 'delivered');
  const activeJob = jobs.find((j) => j.status !== 'delivered') ?? null;

  // ── Greeting ───────────────────────────────────────────────────────────────

  function timeGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (screen === 'login') {
    return <LoginScreen onSignIn={signIn} message={message} loading={loading} />;
  }

  function navigateTo(s: SubScreen) {
    setScreen(s);
  }

  const tabScreens: Record<MainTab, SubScreen> = {
    home: 'home',
    alerts: 'alerts',
    quotes: 'quotes',
    bookings: 'bookings',
    more: 'more',
  };

  function handleTabChange(tab: MainTab) {
    setActiveTab(tab);
    setScreen(tabScreens[tab]);
    setMessage('');
    if (token) {
      if (tab === 'alerts') void loadNotifications(token);
      if (tab === 'quotes') void loadQuotes(token);
      if (tab === 'bookings') void loadJobs(token);
    }
  }

  const displayScreen = screen;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View style={styles.shell}>
        <AppHeader
          greeting={`${timeGreeting()}${firstName ? `, ${firstName}` : ''}`}
          onNotifications={() => handleTabChange('alerts')}
          unreadCount={unreadCount}
        />
        <ScrollView contentContainerStyle={styles.content}>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          {loading && <Text style={styles.subtle}>Loading...</Text>}

          {displayScreen === 'home' && (
            <HomeScreen
              greeting={`${timeGreeting()}${firstName ? `, ${firstName}` : ''}`}
              vehicle={vehicle}
              activeJob={activeJob}
              assignedCount={assignedJobs.length}
              inProgressCount={inProgressJobs.length}
              completedCount={completedJobs.length}
              openCount={jobs.length - completedJobs.length}
              onViewJob={(job) => {
                setSelectedJob(job);
                navigateTo('job_detail');
              }}
              onAlerts={() => handleTabChange('alerts')}
              unreadCount={unreadCount}
            />
          )}

          {displayScreen === 'alerts' && (
            <AlertsScreen
              notifications={notifications}
              loading={loading}
              onMarkAllRead={async () => {
                if (token) {
                  try {
                    await markNotificationsRead(token);
                    await loadNotifications(token);
                  } catch {
                    setMessage('Could not mark as read. Please retry.');
                  }
                }
              }}
            />
          )}

          {displayScreen === 'quotes' && (
            <QuotesScreen quotes={quotes} loading={loading} />
          )}

          {displayScreen === 'bookings' && (
            <BookingsScreen
              assignedJobs={assignedJobs}
              inProgressJobs={inProgressJobs}
              completedJobs={completedJobs}
              scope={jobScope}
              pendingCount={queue.filter((item) => item.status === 'pending').length}
              onScopeChange={(s) => {
                setJobScope(s);
                if (token) void loadJobs(token, s);
              }}
              onOpenJob={(job) => {
                setSelectedJob(job);
                navigateTo('job_detail');
              }}
              onRefresh={() => token && void loadJobs(token)}
            />
          )}

          {displayScreen === 'more' && (
            <MoreScreen
              profile={profile}
              vehicle={vehicle}
              onNavigate={navigateTo}
              onSignOut={signOut}
            />
          )}

          {displayScreen === 'job_detail' && selectedJob && (
            <JobDetailScreen
              job={selectedJob}
              nextStep={nextStep}
              pendingCount={queue.filter((item) => item.status === 'pending').length}
              onSubmitStatus={submitStatus}
              onUploadPod={() => navigateTo('pod')}
              onBack={() => setScreen('bookings')}
            />
          )}

          {displayScreen === 'pod' && selectedJob && (
            <PodScreen
              job={selectedJob}
              token={token}
              onSaved={(updatedJob) => {
                if (updatedJob) setSelectedJob(updatedJob);
                setScreen('job_detail');
              }}
              onQueued={(queued) => setQueue((items) => [queued, ...items])}
            />
          )}

          {displayScreen === 'profile' && (
            <ProfileScreen profile={profile} onBack={() => setScreen('more')} onSignOut={signOut} />
          )}

          {displayScreen === 'vehicle' && (
            <VehicleScreen vehicle={vehicle} onBack={() => setScreen('more')} />
          )}

          {displayScreen === 'documents' && (
            <DocumentsScreen token={token} onBack={() => setScreen('more')} />
          )}

          {displayScreen === 'messages' && (
            <MessagesScreen onBack={() => setScreen('more')} />
          )}
        </ScrollView>
        <BottomNav active={activeTab} onChange={handleTabChange} unreadCount={unreadCount} />
      </View>
    </SafeAreaView>
  );
}

// ─── Login ────────────────────────────────────────────────────────────────────

function LoginScreen({
  onSignIn,
  message,
  loading,
}: {
  onSignIn: (email: string, password: string) => void;
  message: string;
  loading: boolean;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.login}>
        <Text style={styles.logo}>XDrive Driver</Text>
        <Text style={styles.subtle}>Operations app</Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}
        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="Email"
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          placeholder="Password"
          placeholderTextColor={colors.muted}
          secureTextEntry
          style={styles.input}
          value={password}
          onChangeText={setPassword}
        />
        <PrimaryButton
          label={loading ? 'Signing in...' : 'Sign in'}
          onPress={() => onSignIn(email, password)}
          disabled={!email || !password || loading}
        />
      </View>
    </SafeAreaView>
  );
}

// ─── App Header ───────────────────────────────────────────────────────────────

function AppHeader({
  greeting,
  onNotifications,
  unreadCount,
}: {
  greeting: string;
  onNotifications: () => void;
  unreadCount: number;
}) {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.headerTitle}>XDrive Driver</Text>
        <Text style={styles.subtle}>{greeting}</Text>
      </View>
      <TouchableOpacity style={styles.notifButton} onPress={onNotifications}>
        <Text style={styles.notifIcon}>🔔</Text>
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : String(unreadCount)}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ─── Home Screen ──────────────────────────────────────────────────────────────

function HomeScreen({
  greeting,
  vehicle,
  activeJob,
  assignedCount,
  inProgressCount,
  completedCount,
  openCount,
  onViewJob,
  onAlerts,
  unreadCount,
}: {
  greeting: string;
  vehicle: DriverVehicle | null;
  activeJob: DriverJob | null;
  assignedCount: number;
  inProgressCount: number;
  completedCount: number;
  openCount: number;
  onViewJob: (job: DriverJob) => void;
  onAlerts: () => void;
  unreadCount: number;
}) {
  const vehicleLabel = vehicle
    ? [vehicle.reg_plate, vehicle.make, vehicle.model].filter(Boolean).join(' ')
    : 'No vehicle assigned';

  return (
    <View style={styles.stack}>
      {/* Greeting */}
      <Panel>
        <Text style={styles.greeting}>{greeting}</Text>
        <Info label="Assigned vehicle" value={vehicleLabel} />
      </Panel>

      {/* KPI Cards */}
      <View style={styles.kpiRow}>
        <KpiCard label="Assigned" value={String(assignedCount)} />
        <KpiCard label="In Progress" value={String(inProgressCount)} />
        <KpiCard label="Completed" value={String(completedCount)} />
        <KpiCard label="Open" value={String(openCount)} />
      </View>

      {/* Notifications shortcut */}
      {unreadCount > 0 && (
        <TouchableOpacity style={styles.alertBanner} onPress={onAlerts}>
          <Text style={styles.alertBannerText}>
            🔔 You have {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
          </Text>
          <Text style={styles.alertBannerLink}>View →</Text>
        </TouchableOpacity>
      )}

      {/* Next job / current job */}
      {activeJob ? (
        <Panel>
          <StatusPill label={activeJob.status} tone={activeJob.status === 'delivered' ? 'success' : 'primary'} />
          <Text style={[styles.title, { marginTop: spacing.xs }]}>{activeJob.reference}</Text>
          <Info label="Pickup" value={activeJob.pickupLocation} />
          <Info label="Delivery" value={activeJob.deliveryLocation} />
          <Info label="Pickup time" value={fmtDatetime(activeJob.pickupTime)} />
          <PrimaryButton label="View Job Details" onPress={() => onViewJob(activeJob)} />
        </Panel>
      ) : (
        <Panel>
          <Text style={styles.title}>No active job</Text>
          <Text style={styles.copy}>When a job is assigned, it will appear here.</Text>
        </Panel>
      )}
    </View>
  );
}

// ─── Alerts Screen ────────────────────────────────────────────────────────────

function AlertsScreen({
  notifications,
  loading,
  onMarkAllRead,
}: {
  notifications: DriverNotification[];
  loading: boolean;
  onMarkAllRead: () => void;
}) {
  const [filter, setFilter] = useState<'all' | 'unread' | 'important'>('all');

  const filtered = notifications.filter((n) => {
    if (filter === 'unread') return !n.read_at;
    if (filter === 'important') return ['job_assigned', 'job_cancelled', 'pod_rejected', 'document_rejected'].includes(n.type ?? '');
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <View style={styles.stack}>
      <Panel>
        <View style={styles.rowBetween}>
          <Text style={styles.title}>Alerts</Text>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={onMarkAllRead}>
              <Text style={{ color: colors.primary, fontWeight: '700' }}>Mark all read</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Filter tabs */}
        <View style={styles.segmented}>
          {(['all', 'unread', 'important'] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.segment, filter === f && styles.segmentActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.segmentText, filter === f && styles.segmentTextActive]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Panel>

      {loading && <Text style={styles.subtle}>Loading notifications...</Text>}

      {!loading && filtered.length === 0 && (
        <Panel>
          <Text style={styles.title}>No notifications</Text>
          <Text style={styles.copy}>
            {filter === 'unread'
              ? 'All notifications have been read.'
              : 'Notifications for job assignments, updates, POD approvals, and messages will appear here.'}
          </Text>
        </Panel>
      )}

      {filtered.map((n) => (
        <NotificationCard key={n.id} notification={n} />
      ))}
    </View>
  );
}

function NotificationCard({ notification: n }: { notification: DriverNotification }) {
  const isUnread = !n.read_at;
  const icon = notificationIcon(n.type);
  return (
    <View style={[styles.notifCard, isUnread && styles.notifCardUnread]}>
      <View style={styles.rowBetween}>
        <Text style={styles.notifIcon2}>{icon}</Text>
        {isUnread && <View style={styles.unreadDot} />}
      </View>
      <Text style={styles.notifTitle}>{n.title}</Text>
      {n.body ? <Text style={styles.copy}>{n.body}</Text> : null}
      <Text style={styles.timestamp}>{fmtDatetime(n.created_at)}</Text>
    </View>
  );
}

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

// ─── Quotes Screen ────────────────────────────────────────────────────────────

function QuotesScreen({
  quotes,
  loading,
}: {
  quotes: DriverQuote[];
  loading: boolean;
}) {
  const [filter, setFilter] = useState<'all' | 'submitted' | 'accepted' | 'rejected'>('all');

  const filtered = filter === 'all' ? quotes : quotes.filter((q) => q.status === filter);

  return (
    <View style={styles.stack}>
      <Panel>
        <Text style={styles.title}>Quotes</Text>
        <View style={styles.segmented}>
          {(['all', 'submitted', 'accepted', 'rejected'] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.segment, filter === f && styles.segmentActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.segmentText, filter === f && styles.segmentTextActive]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Panel>

      {loading && <Text style={styles.subtle}>Loading quotes...</Text>}

      {!loading && filtered.length === 0 && (
        <Panel>
          <Text style={styles.title}>No quotes</Text>
          <Text style={styles.copy}>Quotes you submit for loads will appear here.</Text>
        </Panel>
      )}

      {filtered.map((q) => (
        <QuoteCard key={q.id} quote={q} />
      ))}
    </View>
  );
}

function QuoteCard({ quote: q }: { quote: DriverQuote }) {
  const statusColor = q.status === 'accepted' ? colors.success : q.status === 'rejected' ? colors.danger : colors.primary;
  return (
    <Panel>
      <View style={styles.rowBetween}>
        <Text style={styles.route}>{q.pickupLocation}</Text>
        <StatusPill label={q.status} tone={q.status === 'accepted' ? 'success' : q.status === 'rejected' ? 'danger' : 'primary'} />
      </View>
      <Text style={styles.arrow}>→ {q.deliveryLocation}</Text>
      <Info label="Price" value={q.price} />
      <Info label="Pickup" value={fmtDatetime(q.pickupDatetime)} />
      <Info label="Vehicle" value={q.vehicleType} />
      <Text style={[styles.timestamp, { color: statusColor }]}>{(q.status ?? '').toUpperCase()}</Text>
    </Panel>
  );
}

// ─── Bookings Screen ──────────────────────────────────────────────────────────

type BookingTab = 'assigned' | 'inprogress' | 'completed';

function BookingsScreen({
  assignedJobs,
  inProgressJobs,
  completedJobs,
  scope,
  pendingCount,
  onScopeChange,
  onOpenJob,
  onRefresh,
}: {
  assignedJobs: DriverJob[];
  inProgressJobs: DriverJob[];
  completedJobs: DriverJob[];
  scope: JobScope;
  pendingCount: number;
  onScopeChange: (scope: JobScope) => void;
  onOpenJob: (job: DriverJob) => void;
  onRefresh: () => void;
}) {
  const [tab, setTab] = useState<BookingTab>('assigned');

  function handleTabChange(t: BookingTab) {
    setTab(t);
    // Switch the server-side scope so the correct jobs are fetched
    if (t === 'completed') {
      onScopeChange('completed');
    } else if (scope !== 'active') {
      onScopeChange('active');
    }
  }

  const current =
    tab === 'assigned' ? assignedJobs : tab === 'inprogress' ? inProgressJobs : completedJobs;

  const tabLabel = (t: BookingTab, count: number) => {
    const labels: Record<BookingTab, string> = {
      assigned: `Assigned`,
      inprogress: `In Progress`,
      completed: `Completed`,
    };
    return `${labels[t]} (${count})`;
  };

  return (
    <View style={styles.stack}>
      <Panel>
        <View style={styles.rowBetween}>
          <Text style={styles.title}>Bookings</Text>
          <TouchableOpacity onPress={onRefresh}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>Refresh</Text>
          </TouchableOpacity>
        </View>
        {pendingCount > 0 && (
          <StatusPill label={`${pendingCount} pending sync`} tone="warning" />
        )}
        <View style={styles.segmented}>
          {(['assigned', 'inprogress', 'completed'] as BookingTab[]).map((t) => {
            const count = t === 'assigned' ? assignedJobs.length : t === 'inprogress' ? inProgressJobs.length : completedJobs.length;
            return (
              <TouchableOpacity
                key={t}
                style={[styles.segment, tab === t && styles.segmentActive]}
                onPress={() => handleTabChange(t)}
              >
                <Text style={[styles.segmentText, tab === t && styles.segmentTextActive]}>
                  {count}
                </Text>
                <Text style={[styles.segmentSubText, tab === t && styles.segmentTextActive]}>
                  {t === 'inprogress' ? 'Active' : t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Panel>

      {current.length === 0 ? (
        <Panel>
          <Text style={styles.copy}>
            No {tab === 'inprogress' ? 'in-progress' : tab} jobs right now.
          </Text>
        </Panel>
      ) : (
        current.map((job) => (
          <JobCard key={job.id} job={job} onOpen={() => onOpenJob(job)} />
        ))
      )}
    </View>
  );
}

function JobCard({ job, onOpen }: { job: DriverJob; onOpen: () => void }) {
  return (
    <TouchableOpacity style={styles.jobRow} onPress={onOpen}>
      <View style={styles.rowBetween}>
        <Text style={styles.jobRef}>{job.reference}</Text>
        <StatusPill label={jobStatusLabel(job.status)} tone={job.status === 'delivered' ? 'success' : 'primary'} />
      </View>
      <Text style={styles.route}>{job.pickupLocation}</Text>
      <Text style={styles.arrow}>→ {job.deliveryLocation}</Text>
      <Text style={styles.subtle}>{fmtDatetime(job.pickupTime)}</Text>
      {job.podRequired && job.podGenerated && (
        <Text style={{ color: colors.success, fontSize: 12, fontWeight: '700' }}>✓ POD uploaded</Text>
      )}
    </TouchableOpacity>
  );
}

// ─── Job Detail Screen ────────────────────────────────────────────────────────

function JobDetailScreen({
  job,
  nextStep,
  pendingCount,
  onSubmitStatus,
  onUploadPod,
  onBack,
}: {
  job: DriverJob;
  nextStep: ReturnType<typeof getNextStep>;
  pendingCount: number;
  onSubmitStatus: () => void;
  onUploadPod: () => void;
  onBack: () => void;
}) {
  const isPodRequired = job.podRequired && !job.podGenerated;
  const isDeliveryStage = job.status === 'arrived_delivery';
  const isCompleted = job.status === 'delivered';

  return (
    <View style={styles.stack}>
      <Panel>
        <StatusPill label={jobStatusLabel(job.status)} tone={isCompleted ? 'success' : 'primary'} />
        {pendingCount > 0 && <StatusPill label={`${pendingCount} pending sync`} tone="warning" />}
        <Text style={styles.title}>{job.reference}</Text>
        <Info label="Pickup" value={job.pickupLocation} />
        <Info label="Delivery" value={job.deliveryLocation} />
        <Info label="Pickup time" value={fmtDatetime(job.pickupTime)} />
        <Info label="Delivery time" value={fmtDatetime(job.deliveryTime)} />
        <Info label="Cargo" value={job.cargoType} />
        <Info label="Vehicle" value={job.vehicleRequirement} />
        {job.contactAllowed && job.contactName && <Info label="Contact" value={job.contactName} />}
        {job.requirements ? <Info label="Notes" value={job.requirements} /> : null}
        <Info label="Price" value={job.price} />
      </Panel>

      {/* Primary action */}
      {!isCompleted && (
        <Panel>
          {isDeliveryStage && isPodRequired ? (
            <>
              <Text style={styles.copy}>Upload Proof of Delivery before marking delivered.</Text>
              <PrimaryButton label="Upload POD" onPress={onUploadPod} />
            </>
          ) : nextStep ? (
            <PrimaryButton label={nextStep.label} onPress={onSubmitStatus} />
          ) : (
            <Text style={styles.copy}>No further actions required.</Text>
          )}
        </Panel>
      )}

      {/* View POD if exists */}
      {isCompleted && job.podGenerated && (
        <Panel>
          <Text style={{ color: colors.success, fontWeight: '700' }}>✓ POD on file</Text>
        </Panel>
      )}

      <SecondaryButton label="← Back to Bookings" onPress={onBack} />
    </View>
  );
}

// ─── POD Screen ───────────────────────────────────────────────────────────────

function PodScreen({
  job,
  token,
  onSaved,
  onQueued,
}: {
  job: DriverJob;
  token: string | null;
  onSaved: (job?: DriverJob) => void;
  onQueued: (queued: QueuedAction) => void;
}) {
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
    const payload = { photoUris, documentUris, recipientName, signatureData, notes };
    if (!token || !(await isOnline())) {
      const queued = await enqueueAction({ jobId: job.id, endpoint: 'pod', payload });
      onQueued(queued);
      onSaved();
      return;
    }
    try {
      const response = await uploadPod(job.id, token, payload);
      onSaved('job' in response ? (response.job as DriverJob) : undefined);
    } catch {
      const queued = await enqueueAction({ jobId: job.id, endpoint: 'pod', payload });
      onQueued(queued);
      onSaved();
    }
  }

  return (
    <View style={styles.stack}>
      <Panel>
        <Text style={styles.title}>Proof of Delivery</Text>
        <Text style={styles.subtle}>{job.reference}</Text>
        <Text style={styles.copy}>Add required POD evidence before marking this job as delivered.</Text>
      </Panel>
      <Panel>
        <SecondaryButton
          label={photoUris.length > 0 ? `Photos: ${photoUris.length}` : 'Take Photo'}
          onPress={addPhoto}
        />
        <SecondaryButton
          label={documentUris.length > 0 ? `Documents: ${documentUris.length}` : 'Attach Document'}
          onPress={addDocument}
        />
        <TextInput
          placeholder="Recipient name"
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={recipientName}
          onChangeText={setRecipientName}
        />
        <TextInput
          placeholder="Notes (optional)"
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={notes}
          onChangeText={setNotes}
          multiline
        />
        <PrimaryButton
          label="Save POD"
          onPress={savePod}
          disabled={photoUris.length === 0 && documentUris.length === 0 && !recipientName}
        />
      </Panel>
    </View>
  );
}

// ─── More Screen ──────────────────────────────────────────────────────────────

function MoreScreen({
  profile,
  vehicle,
  onNavigate,
  onSignOut,
}: {
  profile: DriverProfile | null;
  vehicle: DriverVehicle | null;
  onNavigate: (screen: SubScreen) => void;
  onSignOut: () => void;
}) {
  return (
    <View style={styles.stack}>
      <Panel>
        <Text style={styles.title}>More</Text>
        {profile && <Info label="Account" value={profile.display_name} />}
        {vehicle && <Info label="Vehicle" value={[vehicle.reg_plate, vehicle.make, vehicle.model].filter(Boolean).join(' ')} />}
      </Panel>
      <Panel>
        {(
          [
            ['Profile', 'profile'],
            ['My Vehicle', 'vehicle'],
            ['Documents', 'documents'],
            ['Messages', 'messages'],
          ] as Array<[string, SubScreen]>
        ).map(([label, screen]) => (
          <TouchableOpacity key={screen} style={styles.moreRow} onPress={() => onNavigate(screen)}>
            <Text style={styles.moreLabel}>{label}</Text>
            <Text style={styles.muted}>›</Text>
          </TouchableOpacity>
        ))}
      </Panel>
      <Panel>
        <TouchableOpacity style={[styles.moreRow, { borderBottomWidth: 0 }]} onPress={onSignOut}>
          <Text style={[styles.moreLabel, { color: colors.danger }]}>Sign Out</Text>
        </TouchableOpacity>
      </Panel>
    </View>
  );
}

// ─── Profile Screen ───────────────────────────────────────────────────────────

function ProfileScreen({
  profile,
  onBack,
  onSignOut,
}: {
  profile: DriverProfile | null;
  onBack: () => void;
  onSignOut: () => void;
}) {
  return (
    <View style={styles.stack}>
      <Panel>
        <Text style={styles.title}>Driver Profile</Text>
        {profile ? (
          <>
            <Info label="Name" value={profile.display_name} />
            {profile.email ? <Info label="Email" value={profile.email} /> : null}
            {profile.phone ? <Info label="Phone" value={profile.phone} /> : null}
            <Info label="Status" value={profile.status} />
          </>
        ) : (
          <Text style={styles.copy}>Profile data unavailable.</Text>
        )}
      </Panel>
      <SecondaryButton label="← Back" onPress={onBack} />
    </View>
  );
}

// ─── Vehicle Screen ───────────────────────────────────────────────────────────

function VehicleScreen({
  vehicle,
  onBack,
}: {
  vehicle: DriverVehicle | null;
  onBack: () => void;
}) {
  return (
    <View style={styles.stack}>
      <Panel>
        <Text style={styles.title}>My Vehicle</Text>
        {vehicle ? (
          <>
            {vehicle.reg_plate ? <Info label="Registration" value={vehicle.reg_plate} /> : null}
            {vehicle.make ? <Info label="Make" value={vehicle.make} /> : null}
            {vehicle.model ? <Info label="Model" value={vehicle.model} /> : null}
            {vehicle.type ? <Info label="Type" value={vehicle.type.replace(/_/g, ' ')} /> : null}
            {vehicle.payload_kg ? <Info label="Payload" value={`${vehicle.payload_kg} kg`} /> : null}
            {vehicle.pallets_capacity ? <Info label="Pallet capacity" value={String(vehicle.pallets_capacity)} /> : null}
            {vehicle.has_tail_lift ? <Info label="Tail lift" value="Yes" /> : null}
          </>
        ) : (
          <Text style={styles.copy}>No vehicle is currently assigned to your account.</Text>
        )}
      </Panel>
      <SecondaryButton label="← Back" onPress={onBack} />
    </View>
  );
}

// ─── Documents Screen ─────────────────────────────────────────────────────────

function DocumentsScreen({ token, onBack }: { token: string | null; onBack: () => void }) {
  const [docs, setDocs] = useState<DriverDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!token) { setLoading(false); return; }
      try {
        const response = await fetchDocuments(token);
        setDocs(response.documents ?? []);
      } catch {
        // Show empty state
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [token]);

  return (
    <View style={styles.stack}>
      <Panel>
        <Text style={styles.title}>Documents</Text>
        <Text style={styles.copy}>Driver compliance and vehicle documents.</Text>
      </Panel>
      {loading ? (
        <Text style={styles.subtle}>Loading documents...</Text>
      ) : docs.length === 0 ? (
        <Panel>
          <Text style={styles.title}>No documents uploaded</Text>
          <Text style={styles.copy}>
            Upload your driving licence, insurance, MOT, and other compliance documents.
            Use the XDrive web portal or contact your dispatcher to upload documents.
          </Text>
        </Panel>
      ) : (
        docs.map((doc) => (
          <Panel key={doc.id}>
            <View style={styles.rowBetween}>
              <Text style={styles.route}>{doc.doc_type ?? 'Document'}</Text>
              <StatusPill
                label={doc.status ?? 'pending'}
                tone={doc.status === 'approved' ? 'success' : doc.status === 'rejected' ? 'danger' : 'warning'}
              />
            </View>
            {doc.expiry_date && <Info label="Expiry" value={fmtDatetime(doc.expiry_date)} />}
            <Info label="Uploaded" value={fmtDatetime(doc.created_at)} />
          </Panel>
        ))
      )}
      <SecondaryButton label="← Back" onPress={onBack} />
    </View>
  );
}

// ─── Messages Screen ──────────────────────────────────────────────────────────

function MessagesScreen({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.stack}>
      <Panel>
        <Text style={styles.title}>Messages</Text>
        <Text style={styles.copy}>
          Dispatcher messages, operational updates and notes will appear here.
        </Text>
      </Panel>
      <Panel>
        <Text style={styles.title}>No messages</Text>
        <Text style={styles.copy}>
          You have no messages at this time. Your dispatcher will send messages here for job-related communications.
        </Text>
        <Text style={{ color: colors.warning, fontSize: 12, marginTop: spacing.xs }}>
          Note: Direct messaging backend requires dispatcher integration.
        </Text>
      </Panel>
      <SecondaryButton label="← Back" onPress={onBack} />
    </View>
  );
}

// ─── Bottom Navigation ────────────────────────────────────────────────────────

function BottomNav({
  active,
  onChange,
  unreadCount,
}: {
  active: MainTab;
  onChange: (tab: MainTab) => void;
  unreadCount: number;
}) {
  const items: Array<[MainTab, string]> = [
    ['home', 'Home'],
    ['alerts', 'Alerts'],
    ['quotes', 'Quotes'],
    ['bookings', 'Bookings'],
    ['more', 'More'],
  ];
  return (
    <View style={styles.nav}>
      {items.map(([tab, label]) => (
        <TouchableOpacity
          key={tab}
          style={[styles.navItem, active === tab && styles.navItemActive]}
          onPress={() => onChange(tab)}
        >
          {tab === 'alerts' && unreadCount > 0 && (
            <View style={styles.navBadge}>
              <Text style={styles.navBadgeText}>{unreadCount > 9 ? '9+' : String(unreadCount)}</Text>
            </View>
          )}
          <Text style={[styles.navText, active === tab && styles.navTextActive]}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Shared UI components ─────────────────────────────────────────────────────

function Panel({ children }: { children: ReactNode }) {
  return <View style={styles.panel}>{children}</View>;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.info}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kpiCard}>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: 'primary' | 'success' | 'warning' | 'danger';
}) {
  const background =
    tone === 'success'
      ? colors.success
      : tone === 'warning'
      ? colors.warning
      : tone === 'danger'
      ? colors.danger
      : colors.primary;
  return (
    <Text style={[styles.pill, { backgroundColor: background }]}>{(label ?? '').replace(/_/g, ' ')}</Text>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.primaryButton, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.primaryText}>{label}</Text>
    </TouchableOpacity>
  );
}

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.secondaryButton} onPress={onPress}>
      <Text style={styles.secondaryText}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function fmtDatetime(value: string | null | undefined) {
  if (!value) return 'TBC';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function jobStatusLabel(status: string) {
  const map: Record<string, string> = {
    awarded: 'Assigned',
    on_my_way_pickup: 'On Route',
    arrived_pickup: 'At Pickup',
    loaded: 'Loaded',
    on_my_way_delivery: 'In Transit',
    arrived_delivery: 'At Delivery',
    delivered: 'Delivered',
  };
  return map[status] ?? status.replace(/_/g, ' ');
}

async function safeRegisterPushToken(sessionToken: string) {
  try {
    const { registerPushToken } = await import('../push/registerPushToken');
    await registerPushToken(sessionToken);
  } catch {
    // Push registration must never block the driver from opening the app.
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  shell: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: 90 },
  stack: { gap: spacing.md },
  login: { flex: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
  logo: { color: colors.text, fontSize: 30, fontWeight: '800' },
  header: {
    padding: spacing.md,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  greeting: { color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: spacing.xs },
  subtle: { color: colors.muted },
  muted: { color: colors.muted },
  message: { color: colors.warning, fontWeight: '700', marginBottom: spacing.sm },
  input: {
    minHeight: 52,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    color: colors.text,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.panel,
  },
  panel: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: spacing.md,
    gap: spacing.sm,
  },
  label: { color: colors.muted, fontSize: 13, textTransform: 'uppercase' },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  route: { color: colors.text, fontSize: 16, fontWeight: '700', flexShrink: 1 },
  arrow: { color: colors.muted, fontSize: 13 },
  copy: { color: colors.muted, lineHeight: 20 },
  info: { gap: 4 },
  infoLabel: { color: colors.muted, fontSize: 12, textTransform: 'uppercase' },
  infoValue: { color: colors.text, fontSize: 15, fontWeight: '600' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timestamp: { color: colors.muted, fontSize: 11 },

  // KPI
  kpiRow: { flexDirection: 'row', gap: spacing.sm },
  kpiCard: {
    flex: 1,
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: spacing.sm,
    alignItems: 'center',
  },
  kpiValue: { color: colors.text, fontSize: 22, fontWeight: '800' },
  kpiLabel: { color: colors.muted, fontSize: 11, textTransform: 'uppercase', textAlign: 'center' },

  // Alert banner
  alertBanner: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: 10,
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alertBannerText: { color: colors.text, fontWeight: '600', flex: 1 },
  alertBannerLink: { color: colors.primary, fontWeight: '700' },

  // Notification
  notifButton: { position: 'relative', padding: spacing.xs },
  notifIcon: { fontSize: 22 },
  notifIcon2: { fontSize: 24 },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: colors.danger,
    borderRadius: 999,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  notifCard: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: spacing.md,
    gap: spacing.xs,
  },
  notifCardUnread: { borderColor: colors.primary },
  notifTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  unreadDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: colors.primary },

  // Buttons
  primaryButton: {
    minHeight: 56,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  secondaryButton: {
    minHeight: 50,
    borderRadius: 10,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.panelSoft,
  },
  secondaryText: { color: colors.text, fontWeight: '700' },
  disabled: { opacity: 0.4 },

  // Status pill
  pill: {
    alignSelf: 'flex-start',
    color: '#fff',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    overflow: 'hidden',
    fontWeight: '800',
    textTransform: 'capitalize',
    fontSize: 12,
  },

  // Job card
  jobRow: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: spacing.md,
    gap: spacing.xs,
  },
  jobRef: { color: colors.text, fontSize: 18, fontWeight: '800' },

  // Segmented control
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.panelSoft,
    borderRadius: 10,
    padding: 4,
    borderColor: colors.border,
    borderWidth: 1,
    marginTop: spacing.xs,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { color: colors.muted, textTransform: 'capitalize', fontWeight: '700', fontSize: 12 },
  segmentSubText: { color: colors.muted, fontSize: 10 },
  segmentTextActive: { color: '#fff' },

  // More screen
  moreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  moreLabel: { color: colors.text, fontSize: 16, fontWeight: '700' },

  // Quote card
  quoteStatusText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },

  // Bottom nav
  nav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 74,
    backgroundColor: colors.panel,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.sm,
    paddingTop: spacing.xs,
  },
  navItem: {
    flex: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  navItemActive: { backgroundColor: colors.panelSoft },
  navText: { color: colors.muted, fontWeight: '700', fontSize: 11 },
  navTextActive: { color: colors.text },
  navBadge: {
    position: 'absolute',
    top: 4,
    right: 6,
    backgroundColor: colors.danger,
    borderRadius: 999,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  navBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
});
