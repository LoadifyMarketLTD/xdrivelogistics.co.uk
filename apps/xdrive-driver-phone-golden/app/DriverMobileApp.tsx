import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { fetchJobs, postJobStatus, uploadPod } from '../api/jobs';
import { clearSessionToken, saveSessionToken } from '../auth/sessionStore';
import { isSupabaseConfigured, supabase } from '../auth/supabase';
import { getNextStep } from '../jobs/statusFlow';
import type { DriverJob, JobScope } from '../jobs/types';
import { enqueueAction, getQueue, isOnline, saveQueue, updateQueueItem, type QueuedAction } from '../offline/queue';
import { colors, spacing } from '../ui/theme';

type MainTab = 'nearby' | 'quotes' | 'jobs' | 'alerts' | 'profile';
type Screen =
  | 'login'
  | MainTab
  | 'filters'
  | 'quoteDetail'
  | 'jobDetail'
  | 'pod'
  | 'completed'
  | 'timeline'
  | 'smartpay'
  | 'documents'
  | 'vehicle'
  | 'settings'
  | 'earnings'
  | 'performance'
  | 'availability'
  | 'offline'
  | 'support'
  | 'chat'
  | 'navigation';

type Tone = 'yellow' | 'green' | 'blue' | 'orange' | 'red' | 'purple' | 'cyan' | 'muted';

function getAccessToken(session: { access_token?: string | null } | null | undefined) {
  const token = session?.access_token?.trim();
  return token || null;
}

async function validateDriverRole(userId: string): Promise<string | null> {
  try {
    const { data: profile, error } = await supabase.from('profiles').select('role').eq('user_id', userId).single();
    if (error || !profile) return null;
    return profile.role === 'driver' ? userId : null;
  } catch {
    return null;
  }
}

export default function DriverMobileApp() {
  const [screen, setScreen] = useState<Screen>('login');
  const [tab, setTab] = useState<MainTab>('nearby');
  const [token, setToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [jobs, setJobs] = useState<DriverJob[]>([]);
  const [job, setJob] = useState<DriverJob | null>(null);
  const [scope, setScope] = useState<JobScope>('active');
  const [queue, setQueue] = useState<QueuedAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const nextStep = useMemo(() => (job ? getNextStep(job.status) : undefined), [job]);

  const go = (next: Screen) => {
    setScreen(next);
    if (isMainTab(next)) setTab(next);
  };

  const loadJobs = useCallback(async (sessionToken: string, nextScope = scope) => {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetchJobs(nextScope, sessionToken);
      setJobs(response.jobs);
      setJob(response.jobs[0] ?? null);
      setScreen(nextScope === 'active' ? 'jobs' : 'jobs');
      setTab('jobs');
    } catch (error) {
      setJobs([]);
      setJob(null);
      setMessage(error instanceof Error ? error.message : 'Unable to load jobs.');
    } finally {
      setLoading(false);
    }
  }, [scope]);

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
        nextQueue = await updateQueueItem(item.id, { status: 'failed', lastError: error instanceof Error ? error.message : 'Sync failed' });
      }
    }
    setQueue(nextQueue);
  }, []);

  useEffect(() => {
    void supabase.auth.getSession()
      .then(async ({ data }) => {
        const sessionToken = getAccessToken(data.session);
        if (!sessionToken) {
          void clearSessionToken();
          return;
        }
        const userId = data.session?.user?.id;
        if (!userId || !(await validateDriverRole(userId))) {
          await supabase.auth.signOut().catch(() => undefined);
          await clearSessionToken();
          setScreen('login');
          return;
        }
        setToken(sessionToken);
        setUserEmail(data.session?.user?.email ?? '');
        void saveSessionToken(sessionToken);
        void loadJobs(sessionToken);
        void safeRegisterPushToken(sessionToken);
        void flushQueue(sessionToken);
      })
      .catch(() => {
        void clearSessionToken();
        setScreen('login');
      });
    void getQueue().then(setQueue).catch(() => setQueue([]));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextToken = getAccessToken(session);
      setToken(nextToken);
      setUserEmail(session?.user?.email ?? '');
      if (nextToken) void saveSessionToken(nextToken);
      else void clearSessionToken();
      if (!session) setScreen('login');
    });
    return () => subscription.unsubscribe();
  }, [flushQueue, loadJobs]);

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
    const userId = sessionData.session?.user?.id;
    if (!accessToken || !userId || !(await validateDriverRole(userId))) {
      setMessage('Access denied: only verified drivers can use this app.');
      await supabase.auth.signOut().catch(() => undefined);
      return;
    }
    setToken(accessToken);
    setUserEmail(sessionData.session?.user?.email ?? '');
    try { await saveSessionToken(accessToken); } catch {}
    void safeRegisterPushToken(accessToken);
    await loadJobs(accessToken);
  }

  async function signOut() {
    await supabase.auth.signOut();
    await clearSessionToken();
    await saveQueue([]);
    setToken(null);
    setUserEmail('');
    setScreen('login');
  }

  async function submitStatus() {
    if (!job) return;
    if (!nextStep) {
      go(job.podRequired ? 'pod' : 'completed');
      return;
    }
    const apply = async () => {
      if (!token || !(await isOnline())) {
        const queued = await enqueueAction({ jobId: job.id, endpoint: nextStep.endpoint });
        setQueue((items) => [queued, ...items]);
        setJob((current) => (current ? { ...current, status: nextStep.status } : current));
        return;
      }
      try {
        const response = await postJobStatus(job.id, nextStep.endpoint, token);
        if ('job' in response) setJob(response.job as DriverJob);
      } catch (error) {
        const queued = await enqueueAction({ jobId: job.id, endpoint: nextStep.endpoint });
        setQueue((items) => [queued, ...items]);
        setMessage(error instanceof Error ? error.message : 'Queued for retry.');
      }
    };
    if (!nextStep.requiresConfirmation) await apply();
    else Alert.alert('Confirm action', nextStep.label, [{ text: 'Cancel', style: 'cancel' }, { text: 'Confirm', onPress: () => void apply() }]);
  }

  if (screen === 'login') return <LoginScreen onSignIn={signIn} message={message} loading={loading} />;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      <View style={styles.shell}>
        <Header title={titleFor(screen)} onSettings={() => go('settings')} />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {message ? <Banner text={message} tone="orange" /> : null}
          {loading ? <Text style={styles.muted}>Loading...</Text> : null}
          {screen === 'nearby' && <NearbyScreen jobs={jobs} onFilters={() => go('filters')} onOpen={(nextJob) => { setJob(nextJob); go('quoteDetail'); }} />}
          {screen === 'filters' && <FiltersScreen />}
          {screen === 'quoteDetail' && job && <QuoteDetailScreen job={job} onQuote={() => go('quotes')} />}
          {screen === 'quotes' && <QuotesScreen jobs={jobs} onOpen={(nextJob) => { setJob(nextJob); go('quoteDetail'); }} />}
          {screen === 'jobs' && <JobsScreen scope={scope} jobs={jobs} onScope={setScope} onOpen={(nextJob) => { setJob(nextJob); go('jobDetail'); }} />}
          {screen === 'jobDetail' && job && <JobDetailScreen job={job} onPrimary={submitStatus} onPod={() => go('pod')} onTimeline={() => go('timeline')} />}
          {screen === 'timeline' && job && <TimelineScreen job={job} />}
          {screen === 'pod' && job && <PodScreen job={job} token={token} onDone={() => go('completed')} onQueued={(queued) => setQueue((items) => [queued, ...items])} />}
          {screen === 'completed' && job && <CompletedScreen job={job} onBack={() => go('jobs')} />}
          {screen === 'alerts' && <AlertsScreen onSupport={() => go('support')} />}
          {screen === 'support' && <SupportScreen />}
          {screen === 'chat' && job && <ChatScreen job={job} />}
          {screen === 'profile' && <ProfileScreen email={userEmail} onOpen={go} onSignOut={signOut} queueCount={queue.length} />}
          {screen === 'smartpay' && <SmartPayScreen />}
          {screen === 'documents' && <DocumentsScreen />}
          {screen === 'vehicle' && <VehicleScreen />}
          {screen === 'settings' && <SettingsScreen onSignOut={signOut} />}
          {screen === 'earnings' && <EarningsScreen />}
          {screen === 'performance' && <PerformanceScreen />}
          {screen === 'availability' && <AvailabilityScreen />}
          {screen === 'offline' && <OfflineScreen queueCount={queue.length} />}
          {screen === 'navigation' && job && <NavigationScreen job={job} />}
        </ScrollView>
        <BottomNav active={tab} onChange={go} />
      </View>
    </SafeAreaView>
  );
}

function LoginScreen({ onSignIn, message, loading }: { onSignIn: (email: string, password: string) => void; message: string; loading: boolean }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      <ScrollView contentContainerStyle={styles.login}>
        <View style={styles.logoMark}><Text style={styles.logoX}>X</Text><Text style={styles.logoDrive}>DRIVE</Text></View>
        <Text style={styles.heroLine}>Move Freight. Manage Operations.</Text>
        <Text style={styles.heroLineGold}>Grow Your Network.</Text>
        <View style={styles.heroVan}><Text style={styles.heroVanText}>XDRIVE</Text></View>
        <Text style={styles.copyCenter}>The smart way for drivers to find jobs, manage deliveries and grow your business.</Text>
        {message ? <Banner text={message} tone="orange" /> : null}
        <TextInput autoCapitalize="none" keyboardType="email-address" placeholder="Email" placeholderTextColor={colors.muted} style={styles.input} value={email} onChangeText={setEmail} />
        <TextInput placeholder="Password" placeholderTextColor={colors.muted} secureTextEntry style={styles.input} value={password} onChangeText={setPassword} />
        <PrimaryButton label={loading ? 'Signing in...' : 'Sign in'} onPress={() => onSignIn(email, password)} disabled={!email || !password || loading} />
      </ScrollView>
    </SafeAreaView>
  );
}

function NearbyScreen({ jobs, onFilters, onOpen }: { jobs: DriverJob[]; onFilters: () => void; onOpen: (job: DriverJob) => void }) {
  return (
    <View style={styles.stack}>
      <Toolbar left={`${jobs.length} jobs available`} right="Filters" onRight={onFilters} />
      {jobs.length === 0 ? <EmptyState title="No nearby jobs" body="Available jobs from your XDrive account will appear here." /> : null}
      {jobs.map((job) => <JobMarketCard key={job.id} job={job} onPress={() => onOpen(job)} action="Open" />)}
      <MapPreview label="Map view" />
    </View>
  );
}

function FiltersScreen() {
  return (
    <View style={styles.stack}>
      <Section title="Filters">
        <InputBox label="Pickup Location" value="Enter post/zip code or city" />
        <InputBox label="Delivery Location" value="Enter post/zip code or city" />
        <InputBox label="Vehicle Type" value="All Types" />
        <InputBox label="Load Type" value="All Types" />
        <Text style={styles.label}>Pallets</Text>
        <Row>{['Any', '1', '2+', '3+', '4+'].map((item, index) => <Chip key={item} label={item} active={index === 0} />)}</Row>
        <Info label="Max Distance" value="250 mi" />
        <Progress value={0.55} tone="yellow" />
        <InputBox label="Budget" value="Any" />
      </Section>
      <PrimaryButton label="Apply Filters" onPress={() => undefined} />
      <SecondaryButton label="Clear All" onPress={() => undefined} />
    </View>
  );
}

function QuoteDetailScreen({ job, onQuote }: { job: DriverJob; onQuote: () => void }) {
  return (
    <View style={styles.stack}>
      <Section>
        <RowBetween><Badge label="FEATURED" tone="yellow" /><Text style={styles.muted}>Posted 5 min ago</Text></RowBetween>
        <RouteBlock job={job} large />
        <InfoGrid items={[['Load Type', 'General'], ['Vehicle', job.vehicleRequirement], ['Distance', '196 mi'], ['Est. Duration', '3h 10m'], ['Budget', job.price]]} />
      </Section>
      <PrimaryButton label="Quote This Job" onPress={onQuote} />
      <SecondaryButton label="Save Job" onPress={() => undefined} />
    </View>
  );
}

function QuotesScreen({ jobs, onOpen }: { jobs: DriverJob[]; onOpen: (job: DriverJob) => void }) {
  return (
    <View style={styles.stack}>
      <Tabs items={['All', 'Sent', 'Accepted', 'Expired']} active={0} />
      {jobs.length === 0 ? <EmptyState title="No quotes" body="Quotes linked to your driver account will appear here." /> : null}
      {jobs.map((job) => <QuoteCard key={job.id} job={job} status={job.status} onPress={() => onOpen(job)} />)}
    </View>
  );
}

function JobsScreen({ scope, onScope, jobs, onOpen }: { scope: JobScope; onScope: (scope: JobScope) => void; jobs: DriverJob[]; onOpen: (job: DriverJob) => void }) {
  const scopes: JobScope[] = ['active', 'upcoming', 'completed'];
  return (
    <View style={styles.stack}>
      <View style={styles.segmented}>{scopes.map((item) => <TouchableOpacity key={item} style={[styles.segment, scope === item && styles.segmentActive]} onPress={() => onScope(item)}><Text style={[styles.segmentText, scope === item && styles.segmentTextActive]}>{item}</Text></TouchableOpacity>)}</View>
      {jobs.length === 0 ? <EmptyState title="No jobs in this scope" body="Assigned jobs will appear here when available." /> : null}
      {jobs.map((item) => <JobMarketCard key={item.id} job={item} onPress={() => onOpen(item)} action="Open" status={formatStatus(item.status)} />)}
    </View>
  );
}

function JobDetailScreen({ job, onPrimary, onPod, onTimeline }: { job: DriverJob; onPrimary: () => void; onPod: () => void; onTimeline: () => void }) {
  return (
    <View style={styles.stack}>
      <Section>
        <RowBetween><Badge label={job.status.replaceAll('_', ' ')} tone="blue" /><Text style={styles.muted}>Job ID: {job.reference}</Text></RowBetween>
        <RouteBlock job={job} />
        <InfoGrid items={[
          ['Vehicle Required', job.vehicleRequirement],
          ['Load Type', job.cargoType],
          ...(job.contactName ? [['Contact', job.contactName] as [string, string]] : []),
          ...(job.contactPhone ? [['Phone', job.contactPhone] as [string, string]] : []),
          ['Payment', job.price],
        ]} />
        <MiniMap label="Route preview" />
      </Section>
      <PrimaryButton label="Start Navigation" onPress={onPrimary} tone="green" />
      <Row><SecondaryButton label="Call Customer" onPress={() => undefined} grow /><SecondaryButton label="Message" onPress={onPod} grow /></Row>
      <SecondaryButton label="Job Timeline" onPress={onTimeline} />
    </View>
  );
}

function TimelineScreen({ job }: { job: DriverJob }) {
  const steps = ['Job Accepted', 'En Route to Pickup', 'Arrived at Pickup', 'Pickup Completed', 'En Route to Delivery', 'Arrived at Delivery', 'Delivery Completed'];
  return (
    <View style={styles.stack}>
      <Section title={job.reference}>
        {steps.map((step, index) => <TimelineRow key={step} label={step} meta={index < 4 ? '18 May 2026 - 08:45' : 'ETA: 13:45'} done={index < 5} />)}
      </Section>
      <Section><InfoGrid items={[['Job Earnings', job.price]]} /></Section>
    </View>
  );
}

function PodScreen({ job, token, onDone, onQueued }: { job: DriverJob; token: string | null; onDone: () => void; onQueued: (queued: QueuedAction) => void }) {
  const [recipientName, setRecipientName] = useState('');
  const [signatureData, setSignatureData] = useState('');
  const [notes, setNotes] = useState('');
  async function savePod() {
    const payload = { photoUris: [], documentUris: [], recipientName, signatureData, notes };
    if (!token || !(await isOnline())) {
      const queued = await enqueueAction({ jobId: job.id, endpoint: 'pod', payload });
      onQueued(queued);
      onDone();
      return;
    }
    try { await uploadPod(job.id, token, payload); } catch {}
    onDone();
  }
  return (
    <View style={styles.stack}>
      <Section title="POD Capture">
        <Text style={styles.label}>Photo of Delivery</Text>
        <View style={styles.photoGrid}><PhotoBox label="Pallets" /><PhotoBox label="Boxes" /><PhotoBox label="Warehouse" /><PhotoBox label="+ Add Photo" dashed /></View>
        <Text style={styles.label}>Recipient Signature</Text>
        <View style={styles.signature}><Text style={styles.signatureText}>{signatureData || 'Signature'}</Text></View>
        <TextInput placeholder="Recipient name" placeholderTextColor={colors.muted} style={styles.input} value={recipientName} onChangeText={setRecipientName} />
        <TextInput placeholder="Signature confirmation" placeholderTextColor={colors.muted} style={styles.input} value={signatureData} onChangeText={setSignatureData} />
        <TextInput placeholder="Notes" placeholderTextColor={colors.muted} style={styles.input} value={notes} onChangeText={setNotes} />
      </Section>
      <PrimaryButton label="Confirm Delivery" onPress={savePod} />
    </View>
  );
}

function CompletedScreen({ job, onBack }: { job: DriverJob; onBack: () => void }) {
  return (
    <View style={styles.stack}>
      <View style={styles.completeHero}><Text style={styles.check}>✓</Text><Text style={styles.title}>Job Completed!</Text><Text style={styles.muted}>Great job. Everything looks perfect.</Text></View>
      <Section title="Job Summary"><InfoGrid items={[['Pickup', job.pickupLocation], ['Delivery', job.deliveryLocation], ['Total Earnings', job.price]]} /></Section>
      <PrimaryButton label="Back to My Jobs" onPress={onBack} />
    </View>
  );
}

function AlertsScreen({ onSupport }: { onSupport: () => void }) {
  return (
    <View style={styles.stack}>
      <Tabs items={['All', 'Jobs', 'Messages', 'System']} active={0} />
      <EmptyState title="No alerts" body="Unread alerts from XDrive will appear here." />
      <SecondaryButton label="Help & Support" onPress={onSupport} />
    </View>
  );
}

function SupportScreen() {
  return (
    <View style={styles.stack}>
      <SearchBox />
      <Section title="Popular Topics">
        {['How to accept a job', 'Using SmartPay', 'POD Capture Guide', 'Navigation & Routes'].map((item) => <ListRow key={item} icon="?" title={item} subtitle="Step by step guide" />)}
      </Section>
      <Section title="Support">
        {['Contact Support', 'Submit a Ticket', 'FAQs'].map((item) => <ListRow key={item} icon="i" title={item} subtitle="Get help from our team" />)}
      </Section>
    </View>
  );
}

function ChatScreen({ job }: { job: DriverJob }) {
  return (
    <View style={styles.stack}>
      <Section><Text style={styles.title}>{job.contactName ?? 'Contact'}</Text><Text style={styles.muted}>{job.reference} - {job.pickupLocation} to {job.deliveryLocation}</Text></Section>
      <EmptyState title="No messages" body="Job messages will appear here when available." />
      <View style={styles.chatInput}><Text style={styles.muted}>Type a message...</Text><Text style={styles.send}>{'>'}</Text></View>
    </View>
  );
}

function ProfileScreen({ email, onOpen, onSignOut, queueCount }: { email: string; onOpen: (screen: Screen) => void; onSignOut: () => void; queueCount: number }) {
  return (
    <View style={styles.stack}>
      <Section>
        <Row><Avatar /><View style={{ flex: 1 }}><Text style={styles.title}>{email || 'Driver account'}</Text><Text style={styles.muted}>Signed in driver session</Text><Badge label="Verified access" tone="green" /></View></Row>
      </Section>
      <Section title="Quick Access">
        <GridButtons items={[
          ['SmartPay', 'Open balance', 'smartpay'],
          ['Documents', 'Open documents', 'documents'],
          ['Vehicle', 'Open vehicle', 'vehicle'],
          ['Availability', 'Open availability', 'availability'],
          ['Earnings', 'Open earnings', 'earnings'],
          ['Offline Sync', `${queueCount} pending`, 'offline'],
        ]} onOpen={onOpen} />
      </Section>
      <SecondaryButton label="Settings" onPress={() => onOpen('settings')} />
      <PrimaryButton label="Log Out" onPress={onSignOut} tone="red" />
    </View>
  );
}

function SmartPayScreen() {
  return (
    <View style={styles.stack}>
      <Section><Text style={styles.muted}>Available Balance</Text><EmptyState title="Balance unavailable" body="SmartPay values will appear when returned by the XDrive API." /></Section>
      <Section title="Recent Transactions"><EmptyState title="No transactions" body="Payment transactions will appear here." /></Section>
      <PrimaryButton label="Withdraw Funds" onPress={() => undefined} />
      <SecondaryButton label="Transaction History" onPress={() => undefined} />
    </View>
  );
}

function DocumentsScreen() {
  return (
    <View style={styles.stack}>
      <Tabs items={['All', 'Expiring Soon', 'Expired']} active={0} />
      <EmptyState title="No documents" body="Driver and vehicle documents will appear here when returned by the API." />
      <PrimaryButton label="Upload Document" onPress={() => undefined} />
    </View>
  );
}

function VehicleScreen() {
  return (
    <View style={styles.stack}>
      <Section><EmptyState title="No vehicle data" body="Assigned vehicle details will appear here when returned by the API." /></Section>
      <PrimaryButton label="Edit Vehicle" onPress={() => undefined} />
    </View>
  );
}

function SettingsScreen({ onSignOut }: { onSignOut: () => void }) {
  return (
    <View style={styles.stack}>
      <Section title="App Settings">{['Notifications On', 'Navigation Google Maps', 'Theme Dark', 'Language English', 'Units Metric'].map((item) => <ListRow key={item} icon=">" title={item} subtitle="" />)}</Section>
      <Section title="Account & Security">{['Change Password', 'Biometric Login On', 'Two-Factor Authentication On'].map((item) => <ListRow key={item} icon=">" title={item} subtitle="" />)}</Section>
      <PrimaryButton label="Log Out" onPress={onSignOut} tone="red" />
    </View>
  );
}

function EarningsScreen() {
  return (
    <View style={styles.stack}>
      <Tabs items={['Day', 'Week', 'Month', 'Year']} active={1} />
      <Section><EmptyState title="No earnings data" body="Earnings will appear here when returned by the API." /></Section>
      <Section title="Top Earning Jobs"><EmptyState title="No completed paid jobs" body="Paid jobs will appear here." /></Section>
    </View>
  );
}

function PerformanceScreen() {
  return (
    <View style={styles.stack}>
      <Section><EmptyState title="No performance data" body="Ratings and operational stats will appear here when returned by the API." /></Section>
      <Section title="Recent Feedback"><EmptyState title="No feedback" body="Customer feedback will appear here." /></Section>
    </View>
  );
}

function AvailabilityScreen() {
  return (
    <View style={styles.stack}>
      <Section><RowBetween><Text style={styles.title}>Availability</Text><Badge label="API required" tone="muted" /></RowBetween></Section>
      <Section title="Working Hours"><EmptyState title="No availability data" body="Working hours will appear here when returned by the API." /></Section>
      <Section title="Preferred Working Areas"><EmptyState title="No working areas" body="Preferred areas will appear here." /></Section>
    </View>
  );
}

function OfflineScreen({ queueCount }: { queueCount: number }) {
  return (
    <View style={styles.stack}>
      <View style={styles.offlineHero}><Text style={styles.offlineIcon}>!</Text><Text style={styles.title}>Offline Mode</Text><Text style={styles.muted}>Essential features stay available and sync automatically.</Text></View>
      <Section title="Available Offline">{['My Jobs', 'POD & Documents', 'Messages', 'Quotes'].map((item) => <ListRow key={item} icon="✓" title={item} subtitle="Available when cached from your account" />)}</Section>
      <Section title="Sync Progress"><Info label="Pending Actions" value={`${queueCount} items`} /></Section>
    </View>
  );
}

function NavigationScreen({ job }: { job: DriverJob }) {
  return (
    <View style={styles.stack}>
      <Section><Text style={styles.label}>Next Stop</Text><Text style={styles.title}>{job.deliveryLocation}</Text></Section>
      <MapPreview route label="Navigation route" />
      <PrimaryButton label="Stop Navigation" onPress={() => undefined} tone="red" />
    </View>
  );
}

function Header({ title, onSettings }: { title: string; onSettings: () => void }) {
  return (
    <View style={styles.header}>
      <View><Text style={styles.headerTitle}>{title}</Text><Text style={styles.muted}>XDrive Driver App</Text></View>
      <TouchableOpacity style={styles.iconButton} onPress={onSettings}><Text style={styles.iconText}>...</Text></TouchableOpacity>
    </View>
  );
}

function Toolbar({ left, right, onRight }: { left: string; right: string; onRight: () => void }) {
  return (
    <View style={styles.toolbar}>
      <Text style={styles.toolbarText}>{left}</Text>
      <TouchableOpacity style={styles.toolbarButton} onPress={onRight}>
        <Text style={styles.toolbarText}>{right}</Text>
      </TouchableOpacity>
    </View>
  );
}

function BottomNav({ active, onChange }: { active: MainTab; onChange: (screen: Screen) => void }) {
  const items: Array<[MainTab, string, string]> = [
    ['nearby', 'Nearby', '⌖'],
    ['quotes', 'Quotes', '◇'],
    ['jobs', 'My Jobs', '▣'],
    ['alerts', 'Alerts', '!'],
    ['profile', 'Profile', '○'],
  ];
  return (
    <View style={styles.nav}>
      {items.map(([item, label, icon]) => (
        <TouchableOpacity key={item} style={styles.navItem} onPress={() => onChange(item)}>
          <Text style={[styles.navIcon, active === item && styles.navIconActive]}>{icon}</Text>
          <Text style={[styles.navText, active === item && styles.navTextActive]}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function JobMarketCard({ job, onPress, action, status }: { job: DriverJob; onPress: () => void; action: string; status?: string }) {
  return (
    <TouchableOpacity style={styles.jobCard} onPress={onPress}>
      <RowBetween>{status ? <Badge label={status} tone={status.includes('PICKUP') ? 'green' : status.includes('DELIVER') ? 'yellow' : 'blue'} /> : <View />}<Text style={styles.price}>{job.price}</Text></RowBetween>
      <Text style={styles.route}>{job.pickupLocation}</Text><Text style={styles.arrow}>to {job.deliveryLocation}</Text>
      <Row><Chip label={job.vehicleRequirement} /><Chip label={job.cargoType.split('/')[0].trim()} /><Chip label={job.cargoType.split('/')[1]?.trim() ?? '800 kg'} /></Row>
      <RowBetween><Text style={styles.muted}>Dist. 196 mi - Est. 3h 10m</Text><MiniButton label={action} onPress={onPress} /></RowBetween>
    </TouchableOpacity>
  );
}

function QuoteCard({ job, status, onPress }: { job: DriverJob; status: string; onPress: () => void }) {
  const tone: Tone = status === 'Accepted' ? 'green' : status === 'Expired' ? 'muted' : 'blue';
  return (
    <TouchableOpacity style={styles.jobCard} onPress={onPress}>
      <RowBetween><Text style={styles.jobRef}>{job.reference}</Text><Badge label={status} tone={tone} /></RowBetween>
      <Text style={styles.copy}>{job.pickupLocation} to {job.deliveryLocation}</Text>
      <Row><Chip label={job.vehicleRequirement} /><Chip label={job.cargoType} /></Row>
      <RowBetween><Text style={styles.muted}>Quote Total</Text><Text style={styles.price}>{job.price}</Text></RowBetween>
    </TouchableOpacity>
  );
}

function DocumentCard({ title, expiry, status, tone }: { title: string; expiry: string; status: string; tone: Tone }) {
  return <Section><Row><IconBubble label={title.slice(0, 2).toUpperCase()} tone={tone} /><View style={{ flex: 1 }}><Text style={styles.jobRef}>{title}</Text><Text style={styles.muted}>{expiry}</Text></View><Text style={[styles.statusText, { color: colorFor(tone) }]}>{status}</Text></Row></Section>;
}

function AlertRow({ title, body, time, tone }: { title: string; body: string; time: string; tone: Tone }) {
  return <Section><Row><IconBubble label="!" tone={tone} /><View style={{ flex: 1 }}><Text style={styles.jobRef}>{title}</Text><Text style={styles.muted}>{body}</Text></View><Text style={styles.muted}>{time}</Text></Row></Section>;
}

function Section({ title, children }: { title?: string; children: ReactNode }) {
  return <View style={styles.panel}>{title ? <Text style={styles.sectionTitle}>{title}</Text> : null}{children}</View>;
}

function Row({ children }: { children: ReactNode }) { return <View style={styles.row}>{children}</View>; }
function RowBetween({ children }: { children: ReactNode }) { return <View style={styles.rowBetween}>{children}</View>; }
function Info({ label, value }: { label: string; value: string }) { return <View style={styles.info}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>; }
function InfoGrid({ items }: { items: Array<[string, string]> }) { return <View style={styles.infoGrid}>{items.map(([label, value]) => <Info key={label} label={label} value={value} />)}</View>; }
function Metric({ label, value }: { label: string; value: string }) { return <View style={styles.metric}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text></View>; }
function Badge({ label, tone }: { label: string; tone: Tone }) { return <Text style={[styles.badge, { backgroundColor: colorFor(tone), color: tone === 'yellow' ? '#111827' : '#fff' }]}>{label}</Text>; }
function Chip({ label, active }: { label: string; active?: boolean }) { return <Text style={[styles.chip, active && styles.chipActive]}>{label}</Text>; }
function PrimaryButton({ label, onPress, disabled, tone = 'yellow' }: { label: string; onPress: () => void; disabled?: boolean; tone?: Tone }) { return <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colorFor(tone) }, disabled && styles.disabled]} onPress={onPress} disabled={disabled}><Text style={[styles.primaryText, tone === 'yellow' && { color: '#111827' }]}>{label}</Text></TouchableOpacity>; }
function SecondaryButton({ label, onPress, grow }: { label: string; onPress: () => void; grow?: boolean }) { return <TouchableOpacity style={[styles.secondaryButton, grow && { flex: 1 }]} onPress={onPress}><Text style={styles.secondaryText}>{label}</Text></TouchableOpacity>; }
function MiniButton({ label, onPress }: { label: string; onPress: () => void }) { return <TouchableOpacity style={styles.miniButton} onPress={onPress}><Text style={styles.miniButtonText}>{label}</Text></TouchableOpacity>; }
function Banner({ text, tone }: { text: string; tone: Tone }) { return <Text style={[styles.banner, { color: colorFor(tone) }]}>{text}</Text>; }

function Tabs({ items, active }: { items: string[]; active: number }) {
  return <View style={styles.tabs}>{items.map((item, index) => <Text key={item} style={[styles.tab, index === active && styles.tabActive]}>{item}</Text>)}</View>;
}

function ListRow({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return <View style={styles.listRow}><IconBubble label={icon} tone="blue" /><View style={{ flex: 1 }}><Text style={styles.listTitle}>{title}</Text>{subtitle ? <Text style={styles.muted}>{subtitle}</Text> : null}</View><Text style={styles.muted}>›</Text></View>;
}

function InputBox({ label, value }: { label: string; value: string }) {
  return <View><Text style={styles.label}>{label}</Text><View style={styles.inputBox}><Text style={styles.muted}>{value}</Text><Text style={styles.muted}>⌖</Text></View></View>;
}

function SearchBox() { return <View style={styles.inputBox}><Text style={styles.muted}>Search for help...</Text><Text style={styles.muted}>⌕</Text></View>; }
function IconBubble({ label, tone }: { label: string; tone: Tone }) { return <View style={[styles.iconBubble, { backgroundColor: `${colorFor(tone)}33` }]}><Text style={[styles.iconBubbleText, { color: colorFor(tone) }]}>{label}</Text></View>; }
function Avatar() { return <View style={styles.avatar}><Text style={styles.avatarText}>DP</Text></View>; }
function Progress({ value, tone }: { value: number; tone: Tone }) { return <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.round(value * 100)}%`, backgroundColor: colorFor(tone) }]} /></View>; }

function RouteBlock({ job, large }: { job: DriverJob; large?: boolean }) {
  return <View style={styles.routeBlock}><View style={styles.routeRail}><View style={styles.dotGreen} /><View style={styles.line} /><View style={styles.dotRed} /></View><View style={{ flex: 1 }}><Text style={[styles.route, large && styles.routeLarge]}>{job.pickupLocation}</Text><Text style={styles.muted}>{job.pickupTime}</Text><Text style={styles.routeArrow}>↓</Text><Text style={[styles.route, large && styles.routeLarge]}>{job.deliveryLocation}</Text><Text style={styles.muted}>{job.deliveryTime}</Text></View></View>;
}

function MapPreview({ route, label }: { route?: boolean; label: string }) {
  return <View style={styles.map}><Text style={styles.mapPin}>⌖</Text><View style={styles.mapRoute} /><Text style={styles.mapLabel}>{label}</Text></View>;
}

function MiniMap({ label }: { label: string }) { return <View style={styles.miniMap}><View style={styles.miniRoute} /><Text style={styles.muted}>{label}</Text></View>; }
function PhotoBox({ label, dashed }: { label: string; dashed?: boolean }) { return <View style={[styles.photoBox, dashed && styles.photoBoxDashed]}><Text style={styles.photoText}>{label}</Text></View>; }
function TimelineRow({ label, meta, done }: { label: string; meta: string; done: boolean }) { return <View style={styles.timelineRow}><Text style={[styles.timelineDot, done && { color: colors.success }]}>●</Text><View><Text style={styles.listTitle}>{label}</Text><Text style={styles.muted}>{meta}</Text></View></View>; }
function Bubble({ text, mine }: { text: string; mine?: boolean }) { return <View style={[styles.bubble, mine && styles.bubbleMine]}><Text style={styles.bubbleText}>{text}</Text></View>; }

function GridButtons({ items, onOpen }: { items: Array<[string, string, Screen]>; onOpen: (screen: Screen) => void }) {
  return <View style={styles.gridButtons}>{items.map(([title, subtitle, screen]) => <TouchableOpacity key={title} style={styles.gridButton} onPress={() => onOpen(screen)}><Text style={styles.listTitle}>{title}</Text><Text style={styles.muted}>{subtitle}</Text></TouchableOpacity>)}</View>;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.muted}>{body}</Text>
    </View>
  );
}

function Chart() {
  return <View style={styles.chart}>{[25, 42, 58, 52, 74, 92, 80, 46, 30].map((height, index) => <View key={index} style={[styles.chartBar, { height }]} />)}</View>;
}

function colorFor(tone: Tone) {
  switch (tone) {
    case 'yellow': return colors.primary;
    case 'green': return colors.success;
    case 'blue': return colors.blue;
    case 'orange': return colors.warning;
    case 'red': return colors.danger;
    case 'purple': return colors.purple;
    case 'cyan': return colors.cyan;
    case 'muted': return colors.border;
  }
}

function formatStatus(status: DriverJob['status']) {
  return status.replaceAll('_', ' ').toUpperCase();
}

function isMainTab(screen: Screen): screen is MainTab {
  return screen === 'nearby' || screen === 'quotes' || screen === 'jobs' || screen === 'alerts' || screen === 'profile';
}

function titleFor(screen: Screen) {
  const map: Record<Screen, string> = {
    login: 'Login',
    nearby: 'Nearby',
    quotes: 'Quotes',
    jobs: 'My Jobs',
    alerts: 'Alerts',
    profile: 'Profile',
    filters: 'Filters',
    quoteDetail: 'Job Details',
    jobDetail: 'Job Details',
    pod: 'POD Capture',
    completed: 'Job Completion',
    timeline: 'Job Timeline',
    smartpay: 'SmartPay',
    documents: 'Documents',
    vehicle: 'Vehicle',
    settings: 'Settings',
    earnings: 'Earnings Overview',
    performance: 'Performance',
    availability: 'Availability',
    offline: 'Offline Mode',
    support: 'Help & Support',
    chat: 'Chat',
    navigation: 'Navigation',
  };
  return map[screen];
}

async function safeRegisterPushToken(sessionToken: string) {
  try {
    const { registerPushToken } = await import('../push/registerPushToken');
    await registerPushToken(sessionToken);
  } catch {}
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  shell: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: 106, gap: spacing.md },
  stack: { gap: spacing.md },
  login: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
  logoMark: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  logoX: { color: colors.primary, fontSize: 42, fontWeight: '900', fontStyle: 'italic' },
  logoDrive: { color: colors.text, fontSize: 40, fontWeight: '900', fontStyle: 'italic' },
  heroLine: { color: colors.text, textAlign: 'center', fontSize: 16, fontWeight: '700' },
  heroLineGold: { color: colors.primary, textAlign: 'center', fontSize: 16, fontWeight: '800' },
  heroVan: { height: 210, borderRadius: 20, backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  heroVanText: { color: colors.primary, fontSize: 34, fontWeight: '900' },
  copyCenter: { color: colors.text, textAlign: 'center', lineHeight: 22 },
  header: { padding: spacing.md, borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.bg },
  headerTitle: { color: colors.text, fontSize: 24, fontWeight: '900' },
  iconButton: { width: 44, height: 44, borderRadius: 14, borderColor: colors.border, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.panel },
  iconText: { color: colors.text, fontWeight: '900' },
  muted: { color: colors.muted },
  title: { color: colors.text, fontSize: 22, fontWeight: '900' },
  banner: { fontWeight: '800', fontSize: 14 },
  input: { minHeight: 58, borderColor: '#27415e', borderWidth: 1, borderRadius: 14, color: colors.text, paddingHorizontal: spacing.md, backgroundColor: colors.panel },
  inputBox: { minHeight: 48, borderColor: colors.border, borderWidth: 1, borderRadius: 12, backgroundColor: colors.card, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  panel: { backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: spacing.md, gap: spacing.sm },
  toolbar: { minHeight: 46, borderRadius: 12, backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toolbarButton: { borderRadius: 10, backgroundColor: colors.card, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  toolbarText: { color: colors.text, fontWeight: '800' },
  sectionTitle: { color: colors.text, fontWeight: '900', fontSize: 16, marginBottom: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  label: { color: colors.text, fontSize: 13, fontWeight: '800' },
  route: { color: colors.text, fontSize: 18, fontWeight: '800' },
  routeLarge: { fontSize: 22 },
  arrow: { color: colors.text, fontSize: 14 },
  copy: { color: colors.muted, lineHeight: 20 },
  price: { color: colors.success, fontWeight: '900', fontSize: 20 },
  jobRef: { color: colors.text, fontSize: 16, fontWeight: '900' },
  info: { gap: 3, flex: 1, minWidth: 116 },
  infoGrid: { gap: spacing.sm },
  infoLabel: { color: colors.muted, fontSize: 12 },
  infoValue: { color: colors.text, fontSize: 15, fontWeight: '700' },
  metric: { flex: 1, minWidth: 96, backgroundColor: colors.card, borderRadius: 12, padding: spacing.sm, borderColor: colors.border, borderWidth: 1 },
  metricValue: { color: colors.text, fontWeight: '900', fontSize: 18 },
  money: { color: colors.success, fontSize: 34, fontWeight: '900' },
  successText: { color: colors.success, fontWeight: '800' },
  badge: { alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: 8, overflow: 'hidden', fontWeight: '900', textTransform: 'uppercase', fontSize: 11 },
  chip: { color: colors.text, borderColor: colors.border, borderWidth: 1, borderRadius: 9, paddingHorizontal: spacing.sm, paddingVertical: 6, overflow: 'hidden', backgroundColor: colors.card, fontSize: 12 },
  chipActive: { backgroundColor: colors.primary, color: '#111827', borderColor: colors.primary, fontWeight: '900' },
  primaryButton: { minHeight: 54, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  secondaryButton: { minHeight: 50, borderRadius: 12, borderColor: colors.border, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.panelSoft, paddingHorizontal: spacing.md },
  secondaryText: { color: colors.text, fontWeight: '800' },
  disabled: { opacity: 0.4 },
  miniButton: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  miniButtonText: { color: '#111827', fontWeight: '900' },
  tabs: { flexDirection: 'row', backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 4 },
  tab: { flex: 1, minHeight: 36, textAlign: 'center', textAlignVertical: 'center', color: colors.muted, borderRadius: 9, overflow: 'hidden', fontWeight: '800', fontSize: 12 },
  tabActive: { backgroundColor: colors.primary, color: '#111827' },
  segmented: { flexDirection: 'row', backgroundColor: colors.panel, borderRadius: 12, padding: 4, borderColor: colors.border, borderWidth: 1 },
  segment: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  segmentActive: { backgroundColor: colors.blue },
  segmentText: { color: colors.muted, textTransform: 'capitalize', fontWeight: '800' },
  segmentTextActive: { color: '#fff' },
  jobCard: { backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: spacing.md, gap: spacing.sm },
  routeBlock: { flexDirection: 'row', gap: spacing.md },
  routeRail: { alignItems: 'center', paddingTop: 4 },
  dotGreen: { width: 13, height: 13, borderRadius: 8, borderColor: colors.success, borderWidth: 3 },
  dotRed: { width: 13, height: 13, borderRadius: 8, borderColor: colors.danger, borderWidth: 3 },
  line: { width: 2, height: 54, backgroundColor: colors.success },
  routeArrow: { color: colors.muted, fontSize: 18, marginVertical: 2 },
  map: { height: 280, backgroundColor: '#102035', borderRadius: 16, borderColor: colors.border, borderWidth: 1, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  mapPin: { color: colors.primary, fontSize: 46, position: 'absolute', top: 36, left: 60 },
  mapRoute: { width: 5, height: 170, backgroundColor: colors.blue, borderRadius: 5, transform: [{ rotate: '28deg' }] },
  mapLabel: { color: colors.text, position: 'absolute', bottom: spacing.md, fontWeight: '800' },
  miniMap: { height: 82, backgroundColor: '#102035', borderRadius: 12, borderColor: colors.border, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  miniRoute: { width: '74%', height: 5, backgroundColor: colors.blue, borderRadius: 4, transform: [{ rotate: '-8deg' }] },
  nav: { position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: 84, backgroundColor: colors.bg2, borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', paddingHorizontal: spacing.sm, paddingTop: spacing.sm },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', gap: 3 },
  navIcon: { color: colors.muted, fontSize: 22, fontWeight: '900' },
  navIconActive: { color: colors.primary },
  navText: { color: colors.muted, fontWeight: '700', fontSize: 11 },
  navTextActive: { color: colors.primary },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  listTitle: { color: colors.text, fontWeight: '800' },
  iconBubble: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  iconBubbleText: { fontWeight: '900' },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.panelSoft, borderColor: colors.primary, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primary, fontWeight: '900', fontSize: 20 },
  gridButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  gridButton: { width: '48%', minHeight: 76, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: spacing.sm, justifyContent: 'center' },
  emptyState: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: spacing.md, gap: spacing.xs },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  progressTrack: { height: 9, backgroundColor: colors.card, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: 9, borderRadius: 999 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photoBox: { width: '48%', height: 104, borderRadius: 12, backgroundColor: '#26384d', alignItems: 'center', justifyContent: 'center' },
  photoBoxDashed: { borderStyle: 'dashed', borderColor: colors.muted, borderWidth: 1, backgroundColor: colors.card },
  photoText: { color: colors.text, fontWeight: '800' },
  signature: { height: 72, borderRadius: 12, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center' },
  signatureText: { color: '#111827', fontSize: 26, fontStyle: 'italic' },
  completeHero: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  check: { width: 92, height: 92, borderRadius: 46, backgroundColor: colors.success, color: '#fff', textAlign: 'center', textAlignVertical: 'center', fontSize: 54, fontWeight: '900' },
  statusText: { fontWeight: '900' },
  bigRating: { color: colors.text, fontSize: 58, fontWeight: '900' },
  stars: { color: colors.primary, fontSize: 28, letterSpacing: 1 },
  chart: { height: 120, flexDirection: 'row', alignItems: 'flex-end', gap: 9, paddingTop: spacing.md },
  chartBar: { flex: 1, backgroundColor: colors.success, borderRadius: 8, opacity: 0.85 },
  offlineHero: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  offlineIcon: { width: 82, height: 82, borderRadius: 41, borderColor: colors.muted, borderWidth: 2, color: colors.muted, textAlign: 'center', textAlignVertical: 'center', fontSize: 46, fontWeight: '900' },
  van: { width: 112, height: 78, borderRadius: 14, backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' },
  vanText: { color: '#111827', fontWeight: '900' },
  chatInput: { height: 54, borderRadius: 999, backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  send: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.blue, color: '#fff', textAlign: 'center', textAlignVertical: 'center', fontWeight: '900' },
  bubble: { maxWidth: '78%', backgroundColor: colors.panel, borderRadius: 14, padding: spacing.md, alignSelf: 'flex-start' },
  bubbleMine: { backgroundColor: colors.blue, alignSelf: 'flex-end' },
  bubbleText: { color: colors.text, lineHeight: 20 },
  timelineRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', paddingVertical: spacing.xs },
  timelineDot: { color: colors.muted, fontSize: 18, lineHeight: 22 },
});
