import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { fetchJobs, postJobStatus, uploadPod } from '../api/jobs';
import { clearSessionToken, saveSessionToken } from '../auth/sessionStore';
import { isSupabaseConfigured, supabase } from '../auth/supabase';
import { getNextStep } from '../jobs/statusFlow';
import type { DriverJob, JobScope } from '../jobs/types';
import { enqueueAction, getQueue, isOnline, saveQueue, updateQueueItem, type QueuedAction } from '../offline/queue';
import { colors, spacing } from '../ui/theme';

type Screen = 'login' | 'active' | 'jobs' | 'detail' | 'pod' | 'notifications' | 'profile';

export default function DriverMobileApp() {
  const [screen, setScreen] = useState<Screen>('login');
  const [token, setToken] = useState<string | null>(null);
  const [jobs, setJobs] = useState<DriverJob[]>([]);
  const [job, setJob] = useState<DriverJob | null>(null);
  const [scope, setScope] = useState<JobScope>('active');
  const [queue, setQueue] = useState<QueuedAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const nextStep = useMemo(() => (job ? getNextStep(job.status) : undefined), [job]);

  const loadJobs = useCallback(async (sessionToken: string, nextScope = scope) => {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetchJobs(nextScope, sessionToken);
      setJobs(response.jobs);
      setJob(response.jobs[0] ?? null);
      setScreen(response.jobs[0] ? 'active' : 'jobs');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load jobs.');
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
    await loadJobs(sessionToken);
  }, [loadJobs]);

  useEffect(() => {
    void supabase.auth.getSession()
      .then(({ data }) => {
        const sessionToken = data.session?.access_token ?? null;
        if (!sessionToken) {
          void clearSessionToken();
          return;
        }
        setToken(sessionToken);
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

    // Keep token state in sync whenever Supabase silently refreshes the session
    // (access tokens expire after ~1 hour; without this the app sends stale JWTs).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextToken = session?.access_token ?? null;
      setToken(nextToken);
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
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error || !data.session) {
      setMessage(error?.message ?? 'Login failed.');
      return;
    }
    setToken(data.session.access_token);
    await saveSessionToken(data.session.access_token);
    void safeRegisterPushToken(data.session.access_token);
    await loadJobs(data.session.access_token);
  }

  async function signOut() {
    await supabase.auth.signOut();
    await clearSessionToken();
    await saveQueue([]);
    setToken(null);
    setJob(null);
    setJobs([]);
    setQueue([]);
    setScreen('login');
  }

  async function submitStatus() {
    if (!job) return;
    if (!nextStep) {
      setScreen('pod');
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
        await loadJobs(token);
      } catch (error) {
        const queued = await enqueueAction({ jobId: job.id, endpoint: nextStep.endpoint });
        setQueue((items) => [queued, ...items]);
        setMessage(error instanceof Error ? error.message : 'Queued for retry.');
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

  if (screen === 'login') return <LoginScreen onSignIn={signIn} message={message} loading={loading} />;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View style={styles.shell}>
        <Header onProfile={() => setScreen('profile')} onNotifications={() => setScreen('notifications')} />
        <ScrollView contentContainerStyle={styles.content}>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          {loading && <Text style={styles.subtle}>Loading...</Text>}
          {screen === 'active' && job && <ActiveJobScreen job={job} pendingCount={queue.filter((item) => item.status === 'pending').length} nextLabel={nextStep?.label ?? 'Capture POD'} onPrimary={submitStatus} onDetail={() => setScreen('detail')} onPod={() => setScreen('pod')} />}
          {screen === 'active' && !job && !loading && <EmptyJobsScreen onRefresh={() => token && loadJobs(token)} />}
          {screen === 'jobs' && <JobsScreen scope={scope} jobs={jobs} onScope={(nextScope) => { setScope(nextScope); if (token) void loadJobs(token, nextScope); }} onOpen={(nextJob) => { setJob(nextJob); setScreen('detail'); }} />}
          {screen === 'detail' && job && <JobDetailScreen job={job} onPrimary={() => setScreen('active')} />}
          {screen === 'pod' && job && <PodScreen job={job} token={token} onSaved={(updatedJob) => { if (updatedJob) setJob(updatedJob); setScreen('active'); }} onQueued={(queued) => setQueue((items) => [queued, ...items])} />}
          {screen === 'notifications' && <NotificationsScreen />}
          {screen === 'profile' && <ProfileScreen onSignOut={signOut} />}
        </ScrollView>
        <BottomNav active={screen} onChange={setScreen} />
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

function Header({ onProfile, onNotifications }: { onProfile: () => void; onNotifications: () => void }) {
  return <View style={styles.header}><View><Text style={styles.headerTitle}>Driver Workspace</Text><Text style={styles.subtle}>Today</Text></View><View style={styles.headerActions}><SmallButton label="Alerts" onPress={onNotifications} /><SmallButton label="Profile" onPress={onProfile} /></View></View>;
}

function ActiveJobScreen({ job, pendingCount, nextLabel, onPrimary, onDetail, onPod }: { job: DriverJob; pendingCount: number; nextLabel: string; onPrimary: () => void; onDetail: () => void; onPod: () => void }) {
  return <View style={styles.stack}><StatusPill label={job.status} tone={job.status === 'delivered' ? 'success' : 'primary'} />{pendingCount > 0 && <StatusPill label={`${pendingCount} pending sync`} tone="warning" />}<Panel><Text style={styles.label}>Active Job</Text><Text style={styles.title}>{job.reference}</Text><Text style={styles.route}>{job.pickupLocation}</Text><Text style={styles.arrow}>to</Text><Text style={styles.route}>{job.deliveryLocation}</Text></Panel><Panel><Info label="Pickup" value={job.pickupTime} /><Info label="Delivery" value={job.deliveryTime} /><Info label="Cargo" value={job.cargoType} /><Info label="Vehicle" value={job.vehicleRequirement} /></Panel><PrimaryButton label={nextLabel} onPress={onPrimary} /><SecondaryButton label="Job details" onPress={onDetail} />{job.podRequired && <SecondaryButton label="Open POD" onPress={onPod} />}</View>;
}

function JobsScreen({ scope, onScope, jobs, onOpen }: { scope: JobScope; onScope: (scope: JobScope) => void; jobs: DriverJob[]; onOpen: (job: DriverJob) => void }) {
  return <View style={styles.stack}><Segmented value={scope} onChange={onScope} />{jobs.length === 0 ? <Text style={styles.subtle}>No jobs in this scope.</Text> : jobs.map((item) => <TouchableOpacity key={item.id} style={styles.jobRow} onPress={() => onOpen(item)}><Text style={styles.jobRef}>{item.reference}</Text><Text style={styles.subtle}>{item.pickupLocation}</Text><Text style={styles.subtle}>{item.deliveryLocation}</Text></TouchableOpacity>)}</View>;
}

function JobDetailScreen({ job, onPrimary }: { job: DriverJob; onPrimary: () => void }) {
  return <View style={styles.stack}><Panel><Text style={styles.title}>{job.reference}</Text><Info label="Pickup" value={job.pickupLocation} /><Info label="Delivery" value={job.deliveryLocation} /><Info label="Price" value={job.price} /><Info label="POD required" value={job.podRequired ? 'Yes' : 'No'} /><Info label="Contact" value={job.contactAllowed ? `${job.contactName ?? ''} ${job.contactPhone ?? ''}`.trim() : 'Restricted by policy'} /></Panel><PrimaryButton label="Back to active job" onPress={onPrimary} /></View>;
}

function PodScreen({ job, token, onSaved, onQueued }: { job: DriverJob; token: string | null; onSaved: (job?: DriverJob) => void; onQueued: (queued: QueuedAction) => void }) {
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
      onSaved('job' in response ? response.job as DriverJob : undefined);
    } catch {
      const queued = await enqueueAction({ jobId: job.id, endpoint: 'pod', payload });
      onQueued(queued);
      onSaved();
    }
  }

  return <View style={styles.stack}><Panel><Text style={styles.title}>Proof of Delivery</Text><Text style={styles.subtle}>{job.reference}</Text><Text style={styles.copy}>Add required POD evidence before delivery completion.</Text><Info label="Photos" value={String(photoUris.length)} /><Info label="Documents" value={String(documentUris.length)} /></Panel><SecondaryButton label="Add photo" onPress={addPhoto} /><SecondaryButton label="Add document" onPress={addDocument} /><TextInput placeholder="Recipient name" placeholderTextColor={colors.muted} style={styles.input} value={recipientName} onChangeText={setRecipientName} /><TextInput placeholder="Signature / signed by" placeholderTextColor={colors.muted} style={styles.input} value={signatureData} onChangeText={setSignatureData} /><TextInput placeholder="Delivery notes" placeholderTextColor={colors.muted} style={styles.input} value={notes} onChangeText={setNotes} /><PrimaryButton label="Save POD metadata" onPress={savePod} /></View>;
}

function EmptyJobsScreen({ onRefresh }: { onRefresh: () => void }) {
  return <View style={styles.stack}><Panel><Text style={styles.title}>No active job</Text><Text style={styles.copy}>When a job is awarded and assigned, it will appear here.</Text></Panel><PrimaryButton label="Refresh jobs" onPress={onRefresh} /></View>;
}

function NotificationsScreen() {
  return <View style={styles.stack}><Panel><Text style={styles.title}>Critical Notifications</Text><Text style={styles.copy}>Job awarded, job changed, cancellation and dispatcher updates will appear here.</Text></Panel></View>;
}

function ProfileScreen({ onSignOut }: { onSignOut: () => void }) {
  return <View style={styles.stack}><Panel><Text style={styles.title}>Driver Profile</Text><Info label="Account" value="Active session" /><Info label="App" value="XDrive Driver Mobile" /></Panel><PrimaryButton label="Sign out" onPress={onSignOut} /></View>;
}

function BottomNav({ active, onChange }: { active: Screen; onChange: (screen: Screen) => void }) {
  const items: Array<[Screen, string]> = [['active', 'Active'], ['jobs', 'Jobs'], ['pod', 'POD'], ['profile', 'Profile']];
  return <View style={styles.nav}>{items.map(([item, label]) => <TouchableOpacity key={item} style={[styles.navItem, active === item && styles.navItemActive]} onPress={() => onChange(item)}><Text style={[styles.navText, active === item && styles.navTextActive]}>{label}</Text></TouchableOpacity>)}</View>;
}

function Segmented({ value, onChange }: { value: JobScope; onChange: (scope: JobScope) => void }) {
  const items: JobScope[] = ['active', 'upcoming', 'completed'];
  return <View style={styles.segmented}>{items.map((item) => <TouchableOpacity key={item} style={[styles.segment, value === item && styles.segmentActive]} onPress={() => onChange(item)}><Text style={[styles.segmentText, value === item && styles.segmentTextActive]}>{item}</Text></TouchableOpacity>)}</View>;
}

function Panel({ children }: { children: ReactNode }) { return <View style={styles.panel}>{children}</View>; }
function Info({ label, value }: { label: string; value: string }) { return <View style={styles.info}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>; }
function StatusPill({ label, tone }: { label: string; tone: 'primary' | 'success' | 'warning' }) { const backgroundColor = tone === 'success' ? colors.success : tone === 'warning' ? colors.warning : colors.primary; return <Text style={[styles.pill, { backgroundColor }]}>{label.replace(/_/g, ' ')}</Text>; }
function PrimaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) { return <TouchableOpacity style={[styles.primaryButton, disabled && styles.disabled]} onPress={onPress} disabled={disabled}><Text style={styles.primaryText}>{label}</Text></TouchableOpacity>; }
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
  secondaryButton: { minHeight: 50, borderRadius: 10, borderColor: colors.border, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.panelSoft },
  secondaryText: { color: colors.text, fontWeight: '700' },
  smallButton: { borderColor: colors.border, borderWidth: 1, borderRadius: 8, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  smallText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  disabled: { opacity: 0.4 },
  pill: { alignSelf: 'flex-start', color: '#fff', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: 999, overflow: 'hidden', fontWeight: '800', textTransform: 'capitalize' },
  jobRow: { backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: 10, padding: spacing.md, gap: spacing.xs },
  jobRef: { color: colors.text, fontSize: 18, fontWeight: '800' },
  segmented: { flexDirection: 'row', backgroundColor: colors.panel, borderRadius: 10, padding: 4, borderColor: colors.border, borderWidth: 1 },
  segment: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { color: colors.muted, textTransform: 'capitalize', fontWeight: '700' },
  segmentTextActive: { color: '#fff' },
  nav: { position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: 74, backgroundColor: colors.panel, borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', padding: spacing.sm },
  navItem: { flex: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  navItemActive: { backgroundColor: colors.panelSoft },
  navText: { color: colors.muted, fontWeight: '700' },
  navTextActive: { color: colors.text },
});
