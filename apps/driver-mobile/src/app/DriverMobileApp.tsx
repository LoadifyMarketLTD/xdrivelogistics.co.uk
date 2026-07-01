import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { clearSessionToken, getSessionToken, saveSessionToken } from '../auth/sessionStore';
import { getNextStep } from '../jobs/statusFlow';
import type { DriverJob, JobScope } from '../jobs/types';
import { enqueueAction, getQueue, isOnline, type QueuedAction } from '../offline/queue';
import { colors, spacing } from '../ui/theme';
import { demoActiveJob } from './mockData';

type Screen = 'login' | 'active' | 'jobs' | 'detail' | 'pod' | 'notifications' | 'profile';

export default function DriverMobileApp() {
  const [screen, setScreen] = useState<Screen>('login');
  const [token, setToken] = useState<string | null>(null);
  const [job, setJob] = useState<DriverJob>(demoActiveJob);
  const [scope, setScope] = useState<JobScope>('active');
  const [queue, setQueue] = useState<QueuedAction[]>([]);
  const nextStep = useMemo(() => getNextStep(job.status), [job.status]);

  useEffect(() => {
    void getSessionToken().then((saved) => {
      if (saved) {
        setToken(saved);
        setScreen('active');
      }
    });
    void getQueue().then(setQueue);
  }, []);

  async function signIn(email: string) {
    const sessionToken = `driver-session-${email.trim()}`;
    await saveSessionToken(sessionToken);
    setToken(sessionToken);
    setScreen('active');
  }

  async function signOut() {
    await clearSessionToken();
    setToken(null);
    setScreen('login');
  }

  async function submitStatus() {
    if (!nextStep) {
      setScreen('pod');
      return;
    }
    const apply = async () => {
      if (!token || !(await isOnline())) {
        const queued = await enqueueAction({ jobId: job.id, endpoint: nextStep.endpoint });
        setQueue((items) => [queued, ...items]);
      }
      setJob((current) => ({ ...current, status: nextStep.status }));
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

  if (screen === 'login') return <LoginScreen onSignIn={signIn} />;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View style={styles.shell}>
        <Header onAlerts={() => setScreen('notifications')} onProfile={() => setScreen('profile')} />
        <ScrollView contentContainerStyle={styles.content}>
          {screen === 'active' && <ActiveJobScreen job={job} pending={queue.filter((item) => item.status === 'pending').length} primaryLabel={nextStep?.label ?? 'Capture POD'} onPrimary={submitStatus} onDetail={() => setScreen('detail')} />}
          {screen === 'jobs' && <JobsScreen scope={scope} onScope={setScope} job={job} onOpen={() => setScreen('detail')} />}
          {screen === 'detail' && <JobDetailScreen job={job} onPrimary={() => setScreen('active')} />}
          {screen === 'pod' && <PodScreen job={job} onPrimary={() => setScreen('active')} />}
          {screen === 'notifications' && <NotificationsScreen />}
          {screen === 'profile' && <ProfileScreen onSignOut={signOut} />}
        </ScrollView>
        <BottomNav active={screen} onChange={setScreen} />
      </View>
    </SafeAreaView>
  );
}

function LoginScreen({ onSignIn }: { onSignIn: (email: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.login}>
        <Text style={styles.logo}>XDrive Driver</Text>
        <Text style={styles.subtle}>Native operations app</Text>
        <TextInput autoCapitalize="none" keyboardType="email-address" placeholder="Email" placeholderTextColor={colors.muted} style={styles.input} value={email} onChangeText={setEmail} />
        <TextInput placeholder="Password" placeholderTextColor={colors.muted} secureTextEntry style={styles.input} value={password} onChangeText={setPassword} />
        <PrimaryButton label="Sign in" disabled={!email || !password} onPress={() => onSignIn(email)} />
      </View>
    </SafeAreaView>
  );
}

function Header({ onAlerts, onProfile }: { onAlerts: () => void; onProfile: () => void }) {
  return (
    <View style={styles.header}>
      <View><Text style={styles.headerTitle}>Driver Workspace</Text><Text style={styles.subtle}>Today</Text></View>
      <View style={styles.row}><SmallButton label="Alerts" onPress={onAlerts} /><SmallButton label="Profile" onPress={onProfile} /></View>
    </View>
  );
}

function ActiveJobScreen({ job, pending, primaryLabel, onPrimary, onDetail }: { job: DriverJob; pending: number; primaryLabel: string; onPrimary: () => void; onDetail: () => void }) {
  return (
    <View style={styles.stack}>
      <StatusPill label={job.status} tone={job.status === 'delivered' ? 'success' : 'primary'} />
      {pending > 0 && <StatusPill label={`${pending} pending sync`} tone="warning" />}
      <Panel><Text style={styles.label}>Active Job</Text><Text style={styles.title}>{job.reference}</Text><Text style={styles.route}>{job.pickupLocation}</Text><Text style={styles.arrow}>to</Text><Text style={styles.route}>{job.deliveryLocation}</Text></Panel>
      <Panel><Info label="Pickup" value={job.pickupTime} /><Info label="Delivery" value={job.deliveryTime} /><Info label="Cargo" value={job.cargoType} /><Info label="Vehicle" value={job.vehicleRequirement} /></Panel>
      <PrimaryButton label={primaryLabel} onPress={onPrimary} />
      <SecondaryButton label="Job details" onPress={onDetail} />
    </View>
  );
}

function JobsScreen({ scope, onScope, job, onOpen }: { scope: JobScope; onScope: (scope: JobScope) => void; job: DriverJob; onOpen: () => void }) {
  return <View style={styles.stack}><Segmented value={scope} onChange={onScope} /><TouchableOpacity style={styles.jobRow} onPress={onOpen}><Text style={styles.jobRef}>{job.reference}</Text><Text style={styles.subtle}>{job.pickupLocation}</Text><Text style={styles.subtle}>{job.deliveryLocation}</Text></TouchableOpacity></View>;
}

function JobDetailScreen({ job, onPrimary }: { job: DriverJob; onPrimary: () => void }) {
  return <View style={styles.stack}><Panel><Text style={styles.title}>{job.reference}</Text><Info label="Pickup" value={job.pickupLocation} /><Info label="Delivery" value={job.deliveryLocation} /><Info label="Price" value={job.price} /><Info label="POD required" value={job.podRequired ? 'Yes' : 'No'} /><Info label="Contact" value={job.contactAllowed ? `${job.contactName ?? ''} ${job.contactPhone ?? ''}`.trim() : 'Restricted by policy'} /></Panel><PrimaryButton label="Back to active job" onPress={onPrimary} /></View>;
}

function PodScreen({ job, onPrimary }: { job: DriverJob; onPrimary: () => void }) {
  return <View style={styles.stack}><Panel><Text style={styles.title}>Proof of Delivery</Text><Text style={styles.subtle}>{job.reference}</Text><Text style={styles.copy}>Capture photo, document and signature according to the backend POD rule.</Text></Panel><SecondaryButton label="Add photo" onPress={() => Alert.alert('POD photo', 'Camera integration is ready for the next PR.')} /><SecondaryButton label="Add document" onPress={() => Alert.alert('POD document', 'Document picker integration is ready for the next PR.')} /><SecondaryButton label="Capture signature" onPress={() => Alert.alert('Signature', 'Signature capture is ready for the next PR.')} /><PrimaryButton label="Save POD metadata" onPress={onPrimary} /></View>;
}

function NotificationsScreen() {
  return <View style={styles.stack}><Panel><Text style={styles.title}>Critical Notifications</Text><Text style={styles.copy}>Job awarded, job changed, cancellation and dispatcher updates will appear here.</Text></Panel></View>;
}

function ProfileScreen({ onSignOut }: { onSignOut: () => void }) {
  return <View style={styles.stack}><Panel><Text style={styles.title}>Driver Profile</Text><Info label="Account" value="Active session" /><Info label="App" value="XDrive Driver Mobile" /></Panel><PrimaryButton label="Sign out" onPress={onSignOut} /></View>;
}

function BottomNav({ active, onChange }: { active: Screen; onChange: (screen: Screen) => void }) {
  const items: Array<[Screen, string]> = [['active', 'Active'], ['jobs', 'Jobs'], ['pod', 'POD'], ['profile', 'Profile']];
  return <View style={styles.nav}>{items.map(([screen, label]) => <TouchableOpacity key={screen} style={[styles.navItem, active === screen && styles.navItemActive]} onPress={() => onChange(screen)}><Text style={[styles.navText, active === screen && styles.navTextActive]}>{label}</Text></TouchableOpacity>)}</View>;
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  shell: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: 100 },
  stack: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  login: { flex: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
  logo: { color: colors.text, fontSize: 30, fontWeight: '800' },
  header: { padding: spacing.md, borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  subtle: { color: colors.muted },
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
