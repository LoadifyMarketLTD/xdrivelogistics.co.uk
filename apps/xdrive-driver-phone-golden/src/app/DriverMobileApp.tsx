import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Alert,
  Animated,
  BackHandler,
  ImageBackground,
  Linking,
  PanResponder,
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
import SignatureCanvas from 'react-native-signature-canvas';

import { fetchJobs, persistEvidencePhoto, postJobStatus, uploadPod } from '../api/jobs';
import { fetchDriverResources, fetchMarketplaceJobs, formatMoney, mapResourceJob, submitJobQuote, updateDriverAvailability, updateJobQuote, withdrawJobQuote, type DriverProfileResource } from '../api/resources';
import { clearSessionToken, saveSessionToken } from '../auth/sessionStore';
import { isSupabaseConfigured, supabase } from '../auth/supabase';
import { getNextStep } from '../jobs/statusFlow';
import type { DriverJob, JobScope } from '../jobs/types';
import { loadMarketplacePreferences, saveMarketplacePreferences, type MarketplacePreferences } from '../jobs/marketplacePreferences';
import { enqueueAction, getQueue, isOnline, saveQueue, updateQueueItem, type QueuedAction } from '../offline/queue';
import { colors, spacing } from '../ui/theme';

type MainTab = 'nearby' | 'quotes' | 'jobs' | 'alerts' | 'profile';
type Screen =
  | 'login'
  | MainTab
  | 'filters'
  | 'quoteDetail'
  | 'quoteJobDetail'
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

type Tone = 'yellow' | 'green' | 'blue' | 'red' | 'purple' | 'cyan' | 'muted';

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
  const [nearbyJobs, setNearbyJobs] = useState<DriverJob[]>([]);
  const [resources, setResources] = useState<DriverProfileResource | null>(null);
  const [job, setJob] = useState<DriverJob | null>(null);
  const [scope, setScope] = useState<JobScope>('active');
  const [queue, setQueue] = useState<QueuedAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [quoteAmount, setQuoteAmount] = useState('');
  const [quoteMessage, setQuoteMessage] = useState('');
  const [quoteSubmitting, setQuoteSubmitting] = useState(false);
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<Record<string, any> | null>(null);
  const [availabilityBusy, setAvailabilityBusy] = useState(false);
  const [refreshingMarketplace, setRefreshingMarketplace] = useState(false);
  const [marketplacePreferences, setMarketplacePreferences] = useState<MarketplacePreferences>({
    savedJobIds: [],
    hiddenJobIds: [],
    destinationPriorityEnabled: true,
    destinationRadiusMiles: 10,
  });
  const [message, setMessage] = useState('');
  const navigationHistory = useRef<Screen[]>([]);
  const nextStep = useMemo(() => (job ? getNextStep(job.status) : undefined), [job]);
  const acceptedBookingJobs = useMemo(() => (resources?.quotes ?? [])
    .filter((quote) => ['accepted', 'awarded', 'approved'].includes(normalizeQuoteStatus(quote))
      && quote.job
      && resources?.driver?.id
      && quote.job.assigned_driver_id === resources.driver.id)
    .map((quote) => ({
      ...mapResourceJob(quote.job, quote.job.is_fixed_price === true && quote.job.budget_amount != null, true),
      price: formatMoney(quote.bid_price_gbp ?? quote.amount, quote.currency),
      canViewPrice: true,
      canUpdateLifecycle: true,
    })), [resources]);
  const visibleJobs = useMemo(() => {
    const acceptedForScope = acceptedBookingJobs.filter((item) => {
      if (scope === 'completed') return item.status === 'delivered';
      if (scope === 'upcoming') return item.status === 'awarded';
      return item.status !== 'awarded' && item.status !== 'delivered';
    });
    const source = [...jobs, ...acceptedForScope];
    return [...new Map(source.map((item) => [item.id, item])).values()];
  }, [acceptedBookingJobs, jobs, scope]);

  const go = useCallback((next: Screen) => {
    if (next === screen) return;
    if (isMainTab(next)) navigationHistory.current = [];
    else navigationHistory.current.push(screen);
    setScreen(next);
    if (isMainTab(next)) setTab(next);
  }, [screen]);

  const goBack = useCallback(() => {
    const previous = navigationHistory.current.pop();
    const destination = previous ?? tab;
    setScreen(destination);
    if (isMainTab(destination)) setTab(destination);
  }, [tab]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen === 'login' || isMainTab(screen)) return false;
      goBack();
      return true;
    });
    return () => subscription.remove();
  }, [goBack, screen]);

  const loadJobs = useCallback(async (sessionToken: string, nextScope = scope) => {
    setLoading(true);
    setMessage('');
    try {
        const response = await fetchJobs(nextScope, sessionToken);
        setJobs(response.jobs.map((item) => ({ ...item, canUpdateLifecycle: true, privateDetailsRevealed: true })));
      setJob(response.jobs[0] ?? null);
      if (process.env.EXPO_PUBLIC_LOGIN_PREVIEW !== 'true') {
        setScreen('jobs');
        setTab('jobs');
      }
    } catch (error) {
      setJobs([]);
      setJob(null);
      setMessage(error instanceof Error ? error.message : 'Unable to load jobs.');
    } finally {
      setLoading(false);
    }
  }, [scope]);

  const loadRealResources = useCallback(async () => {
    const [marketplace, driverResources] = await Promise.all([
      fetchMarketplaceJobs(),
      fetchDriverResources(),
    ]);
    setNearbyJobs(marketplace);
    setResources(driverResources);
    if (driverResources.email) setUserEmail(driverResources.email);
  }, []);

  const refreshMarketplace = useCallback(async () => {
    if (refreshingMarketplace) return;
    setRefreshingMarketplace(true);
    setMessage('');
    try {
      setNearbyJobs(await fetchMarketplaceJobs());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to refresh live loads.');
    } finally {
      setRefreshingMarketplace(false);
    }
  }, [refreshingMarketplace]);

  const updateMarketplacePreferences = useCallback((update: (current: MarketplacePreferences) => MarketplacePreferences) => {
    setMarketplacePreferences((current) => {
      const next = update(current);
      void saveMarketplacePreferences(userEmail, next).catch(() => setMessage('This board preference could not be saved on the device.'));
      return next;
    });
  }, [userEmail]);

  const toggleSavedJob = useCallback((jobId: string) => {
    updateMarketplacePreferences((current) => {
      const saved = current.savedJobIds.includes(jobId);
      return { ...current, savedJobIds: saved ? current.savedJobIds.filter((id) => id !== jobId) : [...current.savedJobIds, jobId] };
    });
  }, [updateMarketplacePreferences]);

  const hideJobFromBoard = useCallback((jobId: string) => {
    updateMarketplacePreferences((current) => ({ ...current, hiddenJobIds: current.hiddenJobIds.includes(jobId) ? current.hiddenJobIds : [...current.hiddenJobIds, jobId] }));
  }, [updateMarketplacePreferences]);

  const restoreJobToBoard = useCallback((jobId: string) => {
    updateMarketplacePreferences((current) => ({ ...current, hiddenJobIds: current.hiddenJobIds.filter((id) => id !== jobId) }));
  }, [updateMarketplacePreferences]);

  const flushQueue = useCallback(async (sessionToken: string) => {
    if (!(await isOnline())) return;
    const pending = (await getQueue()).filter((item) => item.status === 'pending' || item.status === 'failed');
    let nextQueue = await getQueue();
    for (const item of pending) {
      try {
        if (item.endpoint === 'pod') await uploadPod(item.jobId, sessionToken, item.payload ?? {});
        else await postJobStatus(item.jobId, item.endpoint, sessionToken, item.payload ?? {});
        nextQueue = await updateQueueItem(item.id, { status: 'synced', lastError: undefined });
      } catch (error) {
        nextQueue = await updateQueueItem(item.id, { status: 'failed', lastError: error instanceof Error ? error.message : 'Sync failed' });
      }
    }
    const compacted = nextQueue.filter((item) => item.status !== 'synced');
    await saveQueue(compacted);
    setQueue(compacted);
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
        void loadRealResources().catch((error) => setMessage(error instanceof Error ? error.message : 'Unable to load driver data.'));
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
  }, [flushQueue, loadJobs, loadRealResources]);

  useEffect(() => {
    if (!token) return;
    const sync = () => void flushQueue(token).catch(() => undefined);
    const subscription = Network.addNetworkStateListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) sync();
    });
    const interval = setInterval(sync, 30_000);
    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, [flushQueue, token]);

  useEffect(() => {
    if (!userEmail) return;
    void loadMarketplacePreferences(userEmail).then(setMarketplacePreferences);
  }, [userEmail]);

  useEffect(() => {
    if (!token) return;
    const channel = supabase
      .channel('driver-live-loads-jobs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => {
        void refreshMarketplace();
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [refreshMarketplace, token]);

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
    await loadRealResources();
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
      let actionPayload: Record<string, unknown> = {};
      if (nextStep.status === 'loaded') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Pickup photo required', 'Allow camera access to confirm that the load was collected.');
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.75,
        });
        if (result.canceled || !result.assets[0]?.uri) return;
        actionPayload = {
          collectionPhotoUri: await persistEvidencePhoto(result.assets[0].uri, job.id, 'pickup'),
        };
      }
      if (!token || !(await isOnline())) {
        const queued = await enqueueAction({ jobId: job.id, endpoint: nextStep.endpoint, payload: actionPayload });
        setQueue((items) => [queued, ...items]);
        setJob((current) => (current ? { ...current, status: nextStep.status } : current));
        return;
      }
      try {
        const response = await postJobStatus(job.id, nextStep.endpoint, token, actionPayload);
        if ('job' in response) setJob(response.job as DriverJob);
        else {
          setJob((current) => current ? { ...current, status: nextStep.status } : current);
          setJobs((current) => current.map((item) => item.id === job.id ? { ...item, status: nextStep.status } : item));
        }
      } catch (error) {
        const queued = await enqueueAction({ jobId: job.id, endpoint: nextStep.endpoint, payload: actionPayload });
        setQueue((items) => [queued, ...items]);
        setMessage(error instanceof Error ? error.message : 'Queued for retry.');
      }
    };
    if (!nextStep.requiresConfirmation) await apply();
    else Alert.alert('Confirm action', nextStep.label, [{ text: 'Cancel', style: 'cancel' }, { text: 'Confirm', onPress: () => void apply() }]);
  }

  async function submitQuote() {
    if (!job || quoteSubmitting) return;
    const amount = Number(quoteAmount.replace(/[^\d.]/g, ''));
    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage('Enter a valid quote amount.');
      return;
    }

    setQuoteSubmitting(true);
    setMessage('');
    try {
      if (editingQuoteId) await updateJobQuote({ bidId: editingQuoteId, amount, message: quoteMessage });
      else await submitJobQuote({ jobId: job.id, amount, message: quoteMessage });
      setQuoteAmount('');
      setQuoteMessage('');
      await loadRealResources();
      setMessage(editingQuoteId ? 'Quote updated.' : 'Quote submitted.');
      setEditingQuoteId(null);
      go('quotes');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to submit quote.');
    } finally {
      setQuoteSubmitting(false);
    }
  }

  function openQuote(quote: Record<string, any>) {
    if (!quote.job) {
      setMessage('The related job is no longer available.');
      return;
    }
    setSelectedQuote(quote);
    setJob(mapResourceJob(quote.job, quote.job.is_fixed_price === true && quote.job.budget_amount != null, quote.job.private_details_revealed === true));
    go('quoteJobDetail');
  }

  function openAlert(alert: Record<string, any>) {
    const payload = alert.payload && typeof alert.payload === 'object' ? alert.payload : {};
    const identifiers = new Set([
      alert.entity_id,
      payload.bid_id,
      payload.job_bid_id,
      payload.job_id,
    ].map((value) => String(value ?? '')).filter(Boolean));
    const relatedQuote = (resources?.quotes ?? []).find((quote) => identifiers.has(String(quote.id))
      || identifiers.has(String(quote.job_id))
      || identifiers.has(String(quote.job?.id)));
    if (relatedQuote?.job) {
      openQuote(relatedQuote);
      return;
    }
    const relatedRun = visibleJobs.find((item) => identifiers.has(item.id));
    if (relatedRun) {
      setJob(relatedRun);
      go('jobDetail');
      return;
    }
    const relatedLoad = nearbyJobs.find((item) => identifiers.has(item.id));
    if (relatedLoad) {
      setJob(relatedLoad);
      setEditingQuoteId(null);
      setSelectedQuote(null);
      setQuoteAmount('');
      setQuoteMessage('');
      go('quoteDetail');
      return;
    }
    const event = String(alert.event_type ?? '').toLowerCase();
    go(event.includes('bid') ? 'quotes' : event.includes('job') ? 'jobs' : 'support');
  }

function editQuote(quote: Record<string, any>) {
  if (!canChangeQuote(quote) || !quote.job) {
    setMessage('This quote can no longer be edited.');
    return;
  }
    setSelectedQuote(quote);
    setJob(mapResourceJob(quote.job, quote.job.is_fixed_price === true && quote.job.budget_amount != null, quote.job.private_details_revealed === true));
    setEditingQuoteId(String(quote.id));
    setQuoteAmount(String(quote.bid_price_gbp ?? quote.amount ?? ''));
    setQuoteMessage(String(quote.message ?? ''));
    go('quoteDetail');
  }

function confirmWithdrawQuote(quote: Record<string, any>) {
  if (!canChangeQuote(quote)) {
    Alert.alert('Withdrawal unavailable', 'Only an active submitted quote may be withdrawn.');
    return;
  }
    Alert.alert(
      'Withdraw this quote?',
      'This action will remove your active offer for this job.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Withdraw Quote', style: 'destructive', onPress: () => void (async () => {
          setQuoteSubmitting(true);
          setMessage('');
          try {
            await withdrawJobQuote(String(quote.id));
            await loadRealResources();
            setMessage('Quote withdrawn.');
          } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Unable to withdraw quote.');
          } finally {
            setQuoteSubmitting(false);
          }
        })() },
      ],
    );
  }

  async function changeAvailability(status: 'available' | 'busy' | 'offline') {
    if (availabilityBusy) return;
    setAvailabilityBusy(true);
    setMessage('');
    try {
      await updateDriverAvailability(status);
      await loadRealResources();
      setMessage(`Availability updated to ${status}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update availability.');
    } finally {
      setAvailabilityBusy(false);
    }
  }

  if (screen === 'login') return <LoginScreen onSignIn={signIn} message={message} loading={loading} />;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar hidden />
      <View style={styles.shell}>
        <Header title={titleFor(screen)} onSettings={() => go('settings')} compact={screen === 'nearby'} />
        <ScrollView
          contentContainerStyle={[styles.content, screen === 'nearby' && styles.contentCompact]}
          showsVerticalScrollIndicator={false}
          refreshControl={screen === 'nearby' ? <RefreshControl refreshing={refreshingMarketplace} onRefresh={() => void refreshMarketplace()} tintColor={colors.primary} colors={[colors.primary]} /> : undefined}
        >
          {message ? <Banner text={message} tone="muted" /> : null}
          {loading ? <Text style={styles.muted}>Loading...</Text> : null}
          {screen === 'nearby' && <NearbyScreen jobs={nearbyJobs} preferences={marketplacePreferences} refreshing={refreshingMarketplace} onToggleSave={toggleSavedJob} onHide={hideJobFromBoard} onRestore={restoreJobToBoard} onOpen={(nextJob) => { setJob(nextJob); setEditingQuoteId(null); setSelectedQuote(null); setQuoteAmount(''); setQuoteMessage(''); go('quoteDetail'); }} />}
          {screen === 'filters' && <FiltersScreen />}
          {screen === 'quoteDetail' && job && <QuoteDetailScreen job={job} amount={quoteAmount} message={quoteMessage} submitting={quoteSubmitting} editing={Boolean(editingQuoteId)} onAmount={setQuoteAmount} onMessage={setQuoteMessage} onQuote={submitQuote} />}
          {screen === 'quoteJobDetail' && job && selectedQuote && <QuoteJobDetailScreen job={job} quote={selectedQuote} onEdit={() => editQuote(selectedQuote)} onWithdraw={() => confirmWithdrawQuote(selectedQuote)} />}
          {screen === 'quotes' && <QuotesScreen quotes={resources?.quotes ?? []} busy={quoteSubmitting} onOpen={openQuote} onEdit={editQuote} onWithdraw={confirmWithdrawQuote} />}
          {screen === 'jobs' && <JobsScreen scope={scope} jobs={visibleJobs} onScope={(nextScope) => { setScope(nextScope); if (token) void loadJobs(token, nextScope); }} onOpen={(nextJob) => { setJob(nextJob); go('jobDetail'); }} />}
          {screen === 'jobDetail' && job && <JobDetailScreen job={job} primaryLabel={nextStep?.label ?? (job.podRequired ? 'Open POD' : 'Complete Job')} onPrimary={submitStatus} onMessage={() => Alert.alert('Messaging unavailable', 'Secure job messaging is not yet exposed by the production mobile backend.')} onTimeline={() => go('timeline')} />}
          {screen === 'timeline' && job && <TimelineScreen job={job} />}
          {screen === 'pod' && job && <PodScreen job={job} token={token} onDone={() => go('completed')} onQueued={(queued) => setQueue((items) => [queued, ...items])} />}
          {screen === 'completed' && job && <CompletedScreen job={job} onBack={() => go('jobs')} />}
          {screen === 'alerts' && <AlertsScreen alerts={resources?.alerts ?? []} onOpen={openAlert} onSupport={() => go('support')} />}
          {screen === 'support' && <SupportScreen />}
          {screen === 'chat' && job && <ChatScreen job={job} />}
          {screen === 'profile' && <ProfileScreen email={userEmail} resources={resources} onOpen={go} onSignOut={signOut} queueCount={queue.length} />}
          {screen === 'smartpay' && <SmartPayScreen invoices={resources?.invoices ?? []} />}
          {screen === 'documents' && <DocumentsScreen documents={resources?.documents ?? []} />}
          {screen === 'vehicle' && <VehicleScreen vehicle={resources?.vehicle ?? null} />}
          {screen === 'settings' && <SettingsScreen onSignOut={signOut} />}
          {screen === 'earnings' && <EarningsScreen invoices={resources?.invoices ?? []} />}
          {screen === 'performance' && <PerformanceScreen />}
          {screen === 'availability' && <AvailabilityScreen driver={resources?.driver ?? null} busy={availabilityBusy} onChange={changeAvailability} />}
          {screen === 'offline' && <OfflineScreen queueCount={queue.length} />}
          {screen === 'navigation' && job && <NavigationScreen job={job} />}
        </ScrollView>
        {screen === 'nearby' ? <TouchableOpacity style={styles.fab} onPress={() => void refreshMarketplace()} disabled={refreshingMarketplace} accessibilityLabel="Refresh live loads"><Text style={styles.fabText}>{refreshingMarketplace ? '...' : 'R'}</Text></TouchableOpacity> : null}
        {!isMainTab(screen) ? <TouchableOpacity style={styles.backFab} onPress={goBack} accessibilityRole="button" accessibilityLabel="Back"><Text style={styles.backFabText}>{'‹'}</Text></TouchableOpacity> : null}
        <BottomNav active={tab} onChange={go} />
      </View>
    </SafeAreaView>
  );
}

function LoginScreen({ onSignIn, message, loading }: { onSignIn: (email: string, password: string) => void; message: string; loading: boolean }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  return (
    <SafeAreaView style={styles.loginSafe}>
      <StatusBar hidden />
      <ScrollView contentContainerStyle={styles.loginPage} keyboardShouldPersistTaps="handled">
        <View style={styles.loginHero}>
          <ImageBackground source={require('../../assets/login-hero-v2.png')} style={styles.loginHeroImage} imageStyle={styles.loginHeroImageRadius} resizeMode="cover">
            <View style={styles.loginHeroShade} />
            <View style={styles.loginBrandPill}><Text style={styles.loginBrandX}>X</Text><Text style={styles.loginBrandDrive}>DRIVE</Text><View style={styles.loginBrandDivider} /><Text style={styles.loginBrandMeta}>DRIVER</Text></View>
            <View style={styles.loginHeroCopy}>
              <Text style={styles.loginEyebrow}>BUILT FOR THE ROAD</Text>
              <Text style={styles.loginHeroTitle}>Move with confidence.</Text>
              <Text style={styles.loginHeroBody}>Live loads, clear updates and every delivery step in one place.</Text>
              <View style={styles.loginNetworkPill}><View style={styles.loginNetworkDot} /><Text style={styles.loginNetworkText}>UK-wide driver network</Text></View>
            </View>
          </ImageBackground>
        </View>

        <View style={styles.loginCard}>
          <Text style={styles.loginTitle}>Welcome back</Text>
          <Text style={styles.loginSubtitle}>Sign in to your verified driver account</Text>
          {message ? <Banner text={message} tone="muted" /> : null}

          <Text style={styles.loginFieldLabel}>EMAIL</Text>
          <TextInput autoCapitalize="none" autoCorrect={false} keyboardType="email-address" placeholder="driver@email.com" placeholderTextColor="#8290A7" style={styles.loginInput} value={email} onChangeText={setEmail} />
          <Text style={styles.loginFieldLabel}>PASSWORD</Text>
          <View style={styles.loginPasswordRow}>
            <TextInput placeholder="Enter your password" placeholderTextColor="#8290A7" secureTextEntry={!passwordVisible} style={styles.loginPasswordInput} value={password} onChangeText={setPassword} />
            <TouchableOpacity style={styles.loginShowButton} onPress={() => setPasswordVisible((value) => !value)} accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}><Text style={styles.loginShowText}>{passwordVisible ? 'HIDE' : 'SHOW'}</Text></TouchableOpacity>
          </View>

          <TouchableOpacity style={[styles.loginSubmit, (!email || !password || loading) && styles.loginSubmitDisabled]} onPress={() => onSignIn(email, password)} disabled={!email || !password || loading} accessibilityRole="button">
            <Text style={styles.loginSubmitText}>{loading ? 'Signing in...' : 'Sign in securely'}</Text>
          </TouchableOpacity>

          <View style={styles.loginTrustRow}>
            <View style={styles.loginTrustItem}><Text style={styles.loginTrustIcon}>L</Text><Text style={styles.loginTrustText}>Live work</Text></View>
            <View style={styles.loginTrustItem}><Text style={styles.loginTrustIcon}>S</Text><Text style={styles.loginTrustText}>Secure access</Text></View>
            <View style={styles.loginTrustItem}><Text style={styles.loginTrustIcon}>24</Text><Text style={styles.loginTrustText}>Driver support</Text></View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function NearbyScreen({ jobs, preferences, refreshing, onToggleSave, onHide, onRestore, onOpen }: {
  jobs: DriverJob[];
  preferences: MarketplacePreferences;
  refreshing: boolean;
  onToggleSave: (jobId: string) => void;
  onHide: (jobId: string) => void;
  onRestore: (jobId: string) => void;
  onOpen: (job: DriverJob) => void;
}) {
  const [board, setBoard] = useState<'live' | 'saved' | 'hidden'>('live');
  const filteredJobs = useMemo(() => {
    const boardJobs = jobs.filter((job) => {
      if (board === 'saved') return preferences.savedJobIds.includes(job.id);
      if (board === 'hidden') return preferences.hiddenJobIds.includes(job.id);
      return !preferences.hiddenJobIds.includes(job.id);
    });
    return [...boardJobs].sort((a, b) => a.pickupTime.localeCompare(b.pickupTime));
  }, [board, jobs, preferences.hiddenJobIds, preferences.savedJobIds]);

  return (
    <View style={styles.nearbyStack}>
      <Tabs items={[`Live (${jobs.filter((item) => !preferences.hiddenJobIds.includes(item.id)).length})`, `Pinned (${preferences.savedJobIds.filter((id) => jobs.some((item) => item.id === id)).length})`, `Hidden (${preferences.hiddenJobIds.filter((id) => jobs.some((item) => item.id === id)).length})`]} active={board === 'live' ? 0 : board === 'saved' ? 1 : 2} onChange={(index) => setBoard(index === 0 ? 'live' : index === 1 ? 'saved' : 'hidden')} />

      <View style={styles.nearbyControls}>
        <Text style={styles.resultCount}>{filteredJobs.length} {board === 'live' ? 'available' : board}</Text>
        <Text style={styles.resultMeta}>{refreshing ? 'Updating...' : 'Collection time order'}</Text>
      </View>

      {filteredJobs.length === 0 ? (
        <EmptyState title={board === 'live' ? 'No live loads' : board === 'saved' ? 'No pinned loads' : 'No hidden loads'} body={board === 'live' ? 'New published loads will appear automatically.' : board === 'saved' ? 'Pinned loads will appear here.' : 'Hidden loads can be restored here.'} />
      ) : (
        filteredJobs.map((job) => board === 'hidden'
          ? <JobMarketCard key={job.id} job={job} onPress={() => onRestore(job.id)} action="Restore" showAmount={canShowPrice(job, 'nearby')} compact />
          : <SwipePostedJobCard key={job.id} job={job} saved={preferences.savedJobIds.includes(job.id)} onOpen={() => onOpen(job)} onSave={() => onToggleSave(job.id)} onHide={() => onHide(job.id)} />)
      )}
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
      <Banner text="Advanced exchange filters require the marketplace search endpoint." tone="muted" />
    </View>
  );
}

function QuoteDetailScreen({
  job,
  amount,
  message,
  submitting,
  editing,
  onAmount,
  onMessage,
  onQuote,
}: {
  job: DriverJob;
  amount: string;
  message: string;
  submitting: boolean;
  editing: boolean;
  onAmount: (value: string) => void;
  onMessage: (value: string) => void;
  onQuote: () => void;
}) {
  return (
    <View style={styles.stack}>
      <Section>
        <RouteBlock job={job} large />
        <InfoGrid items={[
          ['Job', job.reference],
          ['Collection', formatScheduleDateText(job.pickupTime) || job.pickupTime],
          ...(timeUntil(job.pickupTime) ? [['Time until collection', timeUntil(job.pickupTime)] as [string, string]] : []),
          ['Delivery', formatScheduleDateText(job.deliveryTime) || job.deliveryTime],
          ['Load Type', job.cargoType],
          ['Vehicle', job.vehicleRequirement],
          ...(canShowPrice(job, 'nearby') ? [['Customer price', job.price] as [string, string]] : []),
        ]} />
      </Section>
      {!job.privateDetailsRevealed ? <Banner text="Private stop details unlock after allocation." tone="muted" /> : null}
      <Section title={editing ? 'Edit Quote' : 'Send Quote'}>
        <Text style={styles.label}>Your quote amount</Text>
        <TextInput
          keyboardType="decimal-pad"
          placeholder="Enter amount"
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={amount}
          onChangeText={onAmount}
        />
        <Text style={styles.label}>Message to customer</Text>
        <TextInput
          multiline
          placeholder="Add collection timing, vehicle notes or any message"
          placeholderTextColor={colors.muted}
          style={[styles.input, styles.textarea]}
          value={message}
          onChangeText={onMessage}
        />
      </Section>
      <PrimaryButton label={submitting ? 'Saving...' : editing ? 'Save Quote' : 'Submit Quote'} onPress={onQuote} disabled={submitting} />
    </View>
  );
}

type QuoteTab = 'all' | 'sent' | 'accepted' | 'closed';

function QuotesScreen({ quotes, busy, onOpen, onEdit, onWithdraw }: {
  quotes: Array<Record<string, any>>;
  busy: boolean;
  onOpen: (quote: Record<string, any>) => void;
  onEdit: (quote: Record<string, any>) => void;
  onWithdraw: (quote: Record<string, any>) => void;
}) {
  const [activeTab, setActiveTab] = useState<QuoteTab>('all');
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null);
  const counts = {
    all: quotes.length,
    sent: quotes.filter((quote) => quoteBucket(quote) === 'sent').length,
    accepted: quotes.filter((quote) => quoteBucket(quote) === 'accepted').length,
    closed: quotes.filter((quote) => quoteBucket(quote) === 'closed').length,
  };
  const visibleQuotes = quotes.filter((quote) => {
    return activeTab === 'all' || quoteBucket(quote) === activeTab;
  });
  const tabs: Array<[QuoteTab, string]> = [
    ['all', `All (${counts.all})`],
    ['sent', `Sent (${counts.sent})`],
    ['accepted', `Accepted (${counts.accepted})`],
    ['closed', `Closed (${counts.closed})`],
  ];

  return (
    <View style={styles.stack}>
      <Tabs items={tabs.map(([, label]) => label)} active={tabs.findIndex(([id]) => id === activeTab)} onChange={(index) => { setActiveTab(tabs[index][0]); setOpenSwipeId(null); }} />
      {quotes.length === 0 ? <EmptyState title="No quotes" body="Submitted quotes will appear here when connected to your account." /> : null}
      {quotes.length > 0 && visibleQuotes.length === 0 ? <EmptyState title="No quotes in this tab" body="Quotes will move here when their backend status changes." /> : null}
      {visibleQuotes.map((quote) => <SwipeQuoteCard
        key={String(quote.id)}
        quote={quote}
        busy={busy}
        open={openSwipeId === String(quote.id)}
        onOpenSwipe={() => setOpenSwipeId(String(quote.id))}
        onCloseSwipe={() => setOpenSwipeId(null)}
        onOpen={() => onOpen(quote)}
        onEdit={() => onEdit(quote)}
        onWithdraw={() => onWithdraw(quote)}
      />)}
    </View>
  );
}

function SwipeQuoteCard({ quote, busy, open, onOpenSwipe, onCloseSwipe, onOpen, onEdit, onWithdraw }: {
  quote: Record<string, any>;
  busy: boolean;
  open: boolean;
  onOpenSwipe: () => void;
  onCloseSwipe: () => void;
  onOpen: () => void;
  onEdit: () => void;
  onWithdraw: () => void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [menuOpen, setMenuOpen] = useState(false);
  const [isSwiping, setIsSwiping] = useState(false);
  const status = normalizeQuoteStatus(quote);
  const canChange = canChangeQuote(quote);
  const amount = formatMoney(quote.bid_price_gbp ?? quote.amount, quote.currency);
  const quoteJob = quote.job ?? {};
  const jobReference = quoteJob.public_reference ?? quoteJob.job_reference ?? quoteJob.reference ?? quote.job_reference ?? quote.job_id;
  const safeJob = mapResourceJob(quoteJob, quoteJob.is_fixed_price === true && quoteJob.budget_amount != null, quoteJob.private_details_revealed === true);
  const pickupTime = formatScheduleDateText(quoteJob.pickup_datetime ?? quoteJob.pickup_time_slot ?? quote.pickup_datetime ?? quote.pickup_time_slot);
  const deliveryTime = formatScheduleDateText(quoteJob.delivery_time_slot ?? quote.delivery_time_slot);

  useEffect(() => {
    if (!open) Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
  }, [open, translateX]);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > 28 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.8,
    onPanResponderGrant: () => { setIsSwiping(true); onOpenSwipe(); },
    onPanResponderMove: (_event, gesture) => translateX.setValue(Math.max(-112, Math.min(112, gesture.dx * 0.82))),
    onPanResponderRelease: (_event, gesture) => {
      if (gesture.dx > 84 && Math.abs(gesture.vx) < 3.5) onOpen();
      if (gesture.dx < -84 && Math.abs(gesture.vx) < 3.5) {
        if (canChange) onWithdraw();
        else Alert.alert('Withdrawal unavailable', 'Only an active submitted quote may be withdrawn.');
      }
      setIsSwiping(false);
      onCloseSwipe();
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
    },
    onPanResponderTerminate: () => { setIsSwiping(false); onCloseSwipe(); Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start(); },
  }), [canChange, onCloseSwipe, onOpen, onOpenSwipe, onWithdraw, translateX]);

  const primaryLabel = canChange ? 'Edit Quote' : quoteOpenActionLabel(status);
  return (
    <View style={styles.swipeShell}>
      {isSwiping ? <TouchableOpacity style={[styles.swipeAction, styles.saveSwipe]} onPress={onOpen} accessibilityLabel="View quote">
        <Text style={styles.swipeActionText}>View</Text>
      </TouchableOpacity> : null}
      {isSwiping ? <TouchableOpacity style={[styles.swipeAction, styles.withdrawSwipe]} onPress={canChange ? onWithdraw : () => Alert.alert('Withdrawal unavailable', 'Only an active submitted quote may be withdrawn.')} accessibilityLabel="Withdraw quote">
        <Text style={styles.swipeActionText}>{canChange ? 'Withdraw' : 'Locked'}</Text>
      </TouchableOpacity> : null}
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        <TouchableOpacity style={styles.quoteCard} onPress={() => { if (open) onCloseSwipe(); else onOpen(); }} disabled={busy} accessibilityLabel={`${formatQuoteReference(jobReference)}, ${formatQuoteStatus(status)}`}>
          <RowBetween>
            <View style={styles.flexText}><Text style={styles.cardBadgeText}>{formatQuoteReference(jobReference)}</Text><Text style={styles.quoteTitle}>{quoteHeadline(status)}</Text></View>
            <Row><Badge label={formatQuoteStatus(status)} tone={quoteTone(status)} /><TouchableOpacity style={styles.moreButton} onPress={() => setMenuOpen((value) => !value)}><Text style={styles.moreButtonText}>•••</Text></TouchableOpacity></Row>
          </RowBetween>
          <Text style={styles.quoteRoute} numberOfLines={2}>{safeJob.pickupLocation} {'->'} {safeJob.deliveryLocation}</Text>
          <View style={styles.quoteFooter}><View style={styles.jobMetaGrid}><Chip label={formatVehicleLabel(quoteJob.requested_vehicle_label ?? quoteJob.requested_vehicle_type ?? quoteJob.vehicle_type ?? quote.vehicle_type)} />{pickupTime ? <Text style={styles.quoteDate}>Pickup {pickupTime}</Text> : null}{deliveryTime ? <Text style={styles.quoteDate}>Delivery {deliveryTime}</Text> : null}</View>{amount ? <View><Text style={styles.quoteDate}>Your quote</Text><Text style={styles.quotePrice}>{amount}</Text></View> : null}</View>
          <MiniButton label={primaryLabel} onPress={canChange ? onEdit : onOpen} />
          {menuOpen ? <View style={styles.quoteMenu}>
            <SecondaryButton label={quoteOpenActionLabel(status)} onPress={onOpen} />
            {canChange ? <SecondaryButton label="Edit Quote" onPress={onEdit} /> : null}
            {canChange ? <SecondaryButton label="Withdraw Quote" onPress={onWithdraw} /> : null}
          </View> : null}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

function QuoteJobDetailScreen({ job, quote, onEdit, onWithdraw }: { job: DriverJob; quote: Record<string, any>; onEdit: () => void; onWithdraw: () => void }) {
  const row = quote.job ?? {};
  const status = normalizeQuoteStatus(quote);
  const canChange = canChangeQuote(quote);
  const embedded = parseLoadDetails(row.load_details);
  const references = embedded?.references ?? {};
  const palletDetails = embedded?.palletDetails ?? {};
  const dimensions = embedded?.dimensionsCm ?? {};
  const summaryItems: Array<[string, string]> = [
    ['Job reference', job.reference],
    ['Quote status', formatQuoteStatus(status)],
    ['Your quote', formatMoney(quote.bid_price_gbp ?? quote.amount, quote.currency) || 'Not available'],
    ['Vehicle', formatVehicleLabel(row.requested_vehicle_label ?? row.requested_vehicle_type ?? row.vehicle_type)],
    ['Freight', formatVehicleLabel(row.requested_cargo_label ?? row.cargo_type)],
    ['Weight', row.weight_kg != null ? `${row.weight_kg} kg` : 'Not set'],
    ['Pallets', row.pallets != null ? String(row.pallets) : String(palletDetails.count ?? 'Not set')],
    ['Lifecycle', formatVehicleLabel(row.current_status ?? row.status)],
  ];
  if (palletDetails.type) summaryItems.push(['Pallet type', String(palletDetails.type)]);
  if (palletDetails.stackable != null) summaryItems.push(['Stackable', yesNo(palletDetails.stackable)]);
  const dimensionText = [dimensions.length, dimensions.width, dimensions.height].some((value) => value != null)
    ? `${dimensions.length ?? '—'} × ${dimensions.width ?? '—'} × ${dimensions.height ?? '—'} cm`
    : '';
  if (dimensionText) summaryItems.push(['Dimensions', dimensionText]);
  if (embedded?.cargoValueGbp != null) summaryItems.push(['Cargo value', formatMoney(embedded.cargoValueGbp, 'GBP')]);
  if (row.is_fixed_price === true && row.budget_amount != null) summaryItems.push(['Customer published price', formatMoney(row.budget_amount, row.currency)]);

  const referenceItems = [
    ['Customer reference', references.customerReference],
    ['Purchase order', references.purchaseOrderNumber],
    ['Booking reference', references.bookingReference],
  ].filter((item): item is [string, string] => Boolean(item[1]));
  const collection = embedded?.collection ?? {};
  const delivery = embedded?.delivery ?? {};
  const handlingItems: Array<[string, string]> = [];
  const collectionHandling = formatHandling(collection);
  const deliveryHandling = formatHandling(delivery);
  if (collectionHandling) handlingItems.push(['Collection', collectionHandling]);
  if (deliveryHandling) handlingItems.push(['Delivery', deliveryHandling]);
  const contactItems: Array<[string, string]> = [];
  if (job.privateDetailsRevealed) {
    const collectionContact = formatContact(collection.contactName ?? row.collection_contact_name, collection.contactPhone ?? row.collection_contact_phone);
    const deliveryContact = formatContact(delivery.contactName ?? row.delivery_contact_name, delivery.contactPhone ?? row.delivery_contact_phone);
    if (collectionContact) contactItems.push(['Collection contact', collectionContact]);
    if (deliveryContact) contactItems.push(['Delivery contact', deliveryContact]);
  }
  const plainLoadNote = embedded?.plainText;
  const notes = [plainLoadNote, embedded?.notes, row.special_requirements, row.access_restrictions].filter(Boolean).map(String);

  return <View style={styles.stack}>
    <Section><RowBetween><Badge label={formatQuoteStatus(status)} tone={quoteTone(status)} /><Text style={styles.muted}>{job.reference}</Text></RowBetween><RouteBlock job={job} large /></Section>
    <Section title="Job summary"><InfoGrid items={summaryItems} /></Section>
    {referenceItems.length > 0 ? <Section title="References"><InfoGrid items={referenceItems} /></Section> : null}
    {handlingItems.length > 0 ? <Section title="Handling requirements"><InfoGrid items={handlingItems} /></Section> : null}
    {contactItems.length > 0 ? <Section title="Stop contacts"><InfoGrid items={contactItems} /></Section> : null}
    {notes.length > 0 ? <Section title="Instructions">{notes.map((note, index) => <Text key={`${index}-${note}`} style={styles.copy}>{note}</Text>)}</Section> : null}
    {!job.privateDetailsRevealed ? <Banner text="Private stop details unlock after allocation." tone="muted" /> : null}
    <Section title="Quote history"><TimelineRow label={formatQuoteStatus(status)} meta={formatDateText(quote.created_at)} done /></Section>
    {canChange ? <Row><SecondaryButton label="Edit Quote" onPress={onEdit} grow /><SecondaryButton label="Withdraw Quote" onPress={onWithdraw} grow /></Row> : null}
  </View>;
}

function JobsScreen({ scope, onScope, jobs, onOpen }: { scope: JobScope; onScope: (scope: JobScope) => void; jobs: DriverJob[]; onOpen: (job: DriverJob) => void }) {
  const scopes: JobScope[] = ['active', 'upcoming', 'completed'];
  return (
    <View style={styles.stack}>
      <View style={styles.segmented}>{scopes.map((item) => <TouchableOpacity key={item} style={[styles.segment, scope === item && styles.segmentActive]} onPress={() => onScope(item)}><Text style={[styles.segmentText, scope === item && styles.segmentTextActive]}>{item}</Text></TouchableOpacity>)}</View>
      {jobs.length === 0 ? <EmptyState title="No jobs in this scope" body="Assigned jobs will appear here when available." /> : null}
      {jobs.map((item) => <JobMarketCard key={item.id} job={item} onPress={() => onOpen(item)} action="Open" status={formatStatus(item.status)} showAmount={canShowPrice(item, 'assigned')} />)}
    </View>
  );
}

function JobDetailScreen({ job, primaryLabel, onPrimary, onMessage, onTimeline }: { job: DriverJob; primaryLabel: string; onPrimary: () => void; onMessage: () => void; onTimeline: () => void }) {
  const lifecycleReady = job.canUpdateLifecycle !== false;
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
          ...(canShowPrice(job, 'assigned') ? [['Payment', job.price] as [string, string]] : []),
        ]} />
        <MiniMap label="Route preview" />
      </Section>
      {lifecycleReady ? <PrimaryButton label={primaryLabel} onPress={onPrimary} tone="green" /> : <Banner text="Awaiting driver allocation before lifecycle updates can begin." tone="muted" />}
      <Row><SecondaryButton label="Call Customer" onPress={() => job.contactPhone ? void Linking.openURL(`tel:${job.contactPhone}`) : Alert.alert('Contact unavailable', 'The customer phone number is not available for this booking.')} grow /><SecondaryButton label="Message" onPress={onMessage} grow /></Row>
      <SecondaryButton label="Job Timeline" onPress={onTimeline} />
    </View>
  );
}

function TimelineScreen({ job }: { job: DriverJob }) {
  const steps = ['Job Accepted', 'En Route to Pickup', 'Arrived at Pickup', 'Pickup Completed', 'En Route to Delivery', 'Arrived at Delivery', 'Delivery Completed'];
  return (
    <View style={styles.stack}>
      <Section title={job.reference}>
        {steps.map((step, index) => <TimelineRow key={step} label={step} meta="" done={index <= statusStepIndex(job.status)} />)}
      </Section>
      {canShowPrice(job, 'assigned') ? <Section><InfoGrid items={[['Job Earnings', job.price]]} /></Section> : null}
    </View>
  );
}

function PodScreen({ job, token, onDone, onQueued }: { job: DriverJob; token: string | null; onDone: () => void; onQueued: (queued: QueuedAction) => void }) {
  const [recipientName, setRecipientName] = useState('');
  const [signatureData, setSignatureData] = useState('');
  const [notes, setNotes] = useState('');
  const [pickupPhotoUris, setPickupPhotoUris] = useState<string[]>([]);
  const [deliveryPhotoUris, setDeliveryPhotoUris] = useState<string[]>([]);

  async function capturePhoto(stage: 'pickup' | 'delivery') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera permission required', 'Allow camera access to add collection and delivery evidence.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.75,
    });
    if (result.canceled || !result.assets[0]?.uri) return;
    const uri = await persistEvidencePhoto(result.assets[0].uri, job.id, stage);
    if (stage === 'pickup') setPickupPhotoUris((items) => [...items, uri]);
    else setDeliveryPhotoUris((items) => [...items, uri]);
  }

  async function savePod() {
    if (!recipientName.trim()) {
      Alert.alert('Recipient required', 'Enter the name of the person who received the delivery.');
      return;
    }
    if (deliveryPhotoUris.length === 0) {
      Alert.alert('Delivery photo required', 'Take at least one delivery photo before completing the job.');
      return;
    }
    if (!signatureData) {
      Alert.alert('Signature required', 'Ask the recipient to sign and press Confirm signature.');
      return;
    }
    const payload = {
      photoUris: [...pickupPhotoUris, ...deliveryPhotoUris],
      pickupPhotoUris,
      deliveryPhotoUris,
      documentUris: [],
      recipientName: recipientName.trim(),
      signatureData,
      notes,
    };
    if (!token || !(await isOnline())) {
      const queued = await enqueueAction({ jobId: job.id, endpoint: 'pod', payload });
      onQueued(queued);
      onDone();
      return;
    }
    try {
      await uploadPod(job.id, token, payload);
    } catch {
      const queued = await enqueueAction({ jobId: job.id, endpoint: 'pod', payload });
      onQueued(queued);
    }
    onDone();
  }
  return (
    <View style={styles.stack}>
      <Section title="Job Evidence & POD">
        <Text style={styles.label}>Pickup photos</Text>
        <View style={styles.photoGrid}>
          {pickupPhotoUris.map((uri, index) => <PhotoBox key={uri} label={`Pickup ${index + 1} - tap to remove`} onPress={() => setPickupPhotoUris((items) => items.filter((item) => item !== uri))} />)}
          <PhotoBox label="+ Add pickup photo" dashed onPress={() => void capturePhoto('pickup')} />
        </View>
        <Text style={styles.label}>Delivery photos</Text>
        <View style={styles.photoGrid}>
          {deliveryPhotoUris.map((uri, index) => <PhotoBox key={uri} label={`Delivery ${index + 1} - tap to remove`} onPress={() => setDeliveryPhotoUris((items) => items.filter((item) => item !== uri))} />)}
          <PhotoBox label="+ Add delivery photo" dashed onPress={() => void capturePhoto('delivery')} />
        </View>
        <Text style={styles.label}>Recipient signature</Text>
        <View style={styles.signatureCanvas}>
          <SignatureCanvas
            onOK={setSignatureData}
            onEmpty={() => Alert.alert('Signature required', 'Please sign inside the box first.')}
            descriptionText="Sign inside the box"
            clearText="Clear"
            confirmText="Confirm signature"
            autoClear={false}
            webStyle=".m-signature-pad { box-shadow: none; border: 0; } .m-signature-pad--body { border: 1px solid #cbd5e1; } .m-signature-pad--footer { margin: 8px 12px; }"
          />
        </View>
        {signatureData ? <Banner text="Signature confirmed" tone="green" /> : null}
        <TextInput placeholder="Recipient name" placeholderTextColor={colors.muted} style={styles.input} value={recipientName} onChangeText={setRecipientName} />
        <TextInput placeholder="Notes" placeholderTextColor={colors.muted} style={styles.input} value={notes} onChangeText={setNotes} />
      </Section>
      <PrimaryButton label="Confirm Delivery" onPress={savePod} />
    </View>
  );
}

function CompletedScreen({ job, onBack }: { job: DriverJob; onBack: () => void }) {
  return (
    <View style={styles.stack}>
      <View style={styles.completeHero}><Text style={styles.check}>✓</Text><Text style={styles.title}>Job Completed!</Text><Text style={styles.muted}>Delivery and POD have been recorded.</Text></View>
      <Section title="Job Summary"><InfoGrid items={[
        ['Pickup', job.pickupLocation],
        ['Delivery', job.deliveryLocation],
        ...(canShowPrice(job, 'assigned') ? [['Total Earnings', job.price] as [string, string]] : []),
      ]} /></Section>
      <PrimaryButton label="Back to My Jobs" onPress={onBack} />
    </View>
  );
}

function AlertsScreen({ alerts, onOpen, onSupport }: { alerts: Array<Record<string, any>>; onOpen: (alert: Record<string, any>) => void; onSupport: () => void }) {
  const tabs = ['All', 'Jobs', 'Messages', 'System'];
  const [active, setActive] = useState(0);
  const filtered = alerts.filter((alert) => {
    if (active === 0) return true;
    const category = alertCategory(alert);
    return category === tabs[active].toLowerCase();
  });
  return (
    <View style={styles.stack}>
      <Tabs items={tabs} active={active} onChange={setActive} />
      {alerts.length === 0 ? <EmptyState title="No alerts" body="Unread alerts from XDrive will appear here." /> : null}
      {alerts.length > 0 && filtered.length === 0 ? <EmptyState title={`No ${tabs[active].toLowerCase()} alerts`} body="Relevant notifications will appear here." /> : null}
      {filtered.map((alert) => {
        const copy = formatAlert(alert);
        return <TouchableOpacity key={alert.id} onPress={() => onOpen(alert)} accessibilityRole="button" accessibilityLabel={`${copy.title}. ${copy.body}`}>
          <Section><RowBetween><Text style={styles.jobRef}>{copy.title}</Text><Badge label={copy.delivery} tone={copy.delivery === 'Delivered' ? 'green' : 'muted'} /></RowBetween><Text style={styles.copy}>{copy.body}</Text>{alert.created_at ? <Text style={styles.muted}>{formatDateText(alert.created_at)}</Text> : null}</Section>
        </TouchableOpacity>;
      })}
      <SecondaryButton label="Help & Support" onPress={onSupport} />
    </View>
  );
}

function SupportScreen() {
  const [query, setQuery] = useState('');
  const [openTopic, setOpenTopic] = useState('');
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const topics = [
    ['Finding and quoting for loads', 'Open Loads, select a published job, review the public route and press Quote. Exact addresses remain protected until allocation.'],
    ['Managing an allocated delivery', 'Open Runs to update arrival, loading, delivery and POD stages for jobs allocated to you.'],
    ['Uploading proof of delivery', 'Open the allocated run and follow the POD step to add photos, signature and delivery confirmation.'],
    ['Account and vehicle details', 'Open More to review your driver identity, company, assigned vehicle, availability and documents.'],
  ].filter(([title, answer]) => `${title} ${answer}`.toLowerCase().includes(query.trim().toLowerCase()));

  const openUrl = (url: string) => void Linking.openURL(url).catch(() => Alert.alert('Unable to open', 'No compatible phone application is available.'));
  const submitTicket = () => {
    if (!ticketSubject.trim() || !ticketMessage.trim()) {
      Alert.alert('Complete the ticket', 'Add both a subject and a description.');
      return;
    }
    const subject = encodeURIComponent(`[Driver App] ${ticketSubject.trim()}`);
    const body = encodeURIComponent(`${ticketMessage.trim()}\n\nDriver support request sent from XDrive mobile.`);
    openUrl(`mailto:xdrivelogisticsltd@gmail.com?subject=${subject}&body=${body}`);
  };

  return (
    <View style={styles.stack}>
      <TextInput value={query} onChangeText={setQuery} placeholder="Search help" placeholderTextColor={colors.muted} style={styles.input} />
      <Section title="Driver guides">
        {topics.map(([title, answer]) => (
          <TouchableOpacity key={title} style={styles.supportTopic} onPress={() => setOpenTopic((current) => current === title ? '' : title)}>
            <Text style={styles.listTitle}>{title}</Text>
            {openTopic === title ? <Text style={styles.supportAnswer}>{answer}</Text> : null}
          </TouchableOpacity>
        ))}
        {topics.length === 0 ? <Text style={styles.muted}>No matching guide.</Text> : null}
      </Section>
      <Section title="Contact XDrive">
        <Row><SecondaryButton label="Call support" grow onPress={() => openUrl('tel:+447423272138')} /><SecondaryButton label="Email support" grow onPress={() => openUrl('mailto:xdrivelogisticsltd@gmail.com')} /></Row>
        <Text style={styles.muted}>07423 272 138 · xdrivelogisticsltd@gmail.com</Text>
      </Section>
      <Section title="Submit a support ticket">
        <TextInput value={ticketSubject} onChangeText={setTicketSubject} placeholder="Subject" placeholderTextColor={colors.muted} style={styles.input} />
        <TextInput value={ticketMessage} onChangeText={setTicketMessage} placeholder="Describe the problem" placeholderTextColor={colors.muted} style={[styles.input, styles.textarea]} multiline />
        <PrimaryButton label="Send ticket" onPress={submitTicket} />
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

function ProfileScreen({ email, resources, onOpen, onSignOut, queueCount }: { email: string; resources: DriverProfileResource | null; onOpen: (screen: Screen) => void; onSignOut: () => void; queueCount: number }) {
  const displayName = resources?.name || email || 'Driver account';
  const companyName = resources?.company?.name ? String(resources.company.name) : 'Company not connected';
  return (
    <View style={styles.stack}>
      <Section>
        <Row><Avatar /><View style={{ flex: 1 }}><Text style={styles.title}>{displayName}</Text><Text style={styles.muted}>{companyName}</Text><Text style={styles.profileDetail}>{resources?.email || email || 'Email not available'}</Text><Text style={styles.profileDetail}>{resources?.phone || resources?.driver?.phone || 'Phone not added'}</Text><Badge label={resources?.driver?.status ? String(resources.driver.status) : 'Signed in'} tone="green" /></View></Row>
      </Section>
      <Section title="Quick Access">
        <GridButtons items={[
          ['SmartPay', `${resources?.invoices.length ?? 0} invoices`, 'smartpay'],
          ['Documents', `${resources?.documents.length ?? 0} documents`, 'documents'],
          ['Vehicle', resources?.vehicle?.reg_plate ? String(resources.vehicle.reg_plate) : 'Not assigned', 'vehicle'],
          ['Availability', formatVehicleLabel(resources?.driver?.availability_status ?? 'offline'), 'availability'],
          ['Earnings', `${resources?.invoices.filter((invoice) => String(invoice.payment_status ?? invoice.status ?? '').toLowerCase().includes('paid')).length ?? 0} paid`, 'earnings'],
          ['Offline Sync', `${queueCount} pending`, 'offline'],
        ]} onOpen={onOpen} />
      </Section>
      <SecondaryButton label="Settings" onPress={() => onOpen('settings')} />
      <PrimaryButton label="Log Out" onPress={onSignOut} tone="red" />
    </View>
  );
}

function SmartPayScreen({ invoices }: { invoices: Array<Record<string, any>> }) {
  const total = invoices.reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0);
  return (
    <View style={styles.stack}>
      <Section><Text style={styles.muted}>Invoice Total</Text><Text style={styles.price}>{total > 0 ? formatMoney(total) : ''}</Text>{total <= 0 ? <EmptyState title="Balance unavailable" body="SmartPay values will appear when enabled for your account." /> : null}</Section>
      <Section title="Recent Transactions">{invoices.length === 0 ? <EmptyState title="No transactions" body="Payment transactions will appear here." /> : invoices.map((invoice) => <ListRow key={invoice.id} icon=">" title={String(invoice.invoice_number ?? invoice.id)} subtitle={String(invoice.status ?? '')} />)}</Section>
      <Banner text="SmartPay is currently read-only in the mobile app." tone="muted" />
    </View>
  );
}

function DocumentsScreen({ documents }: { documents: Array<Record<string, any>> }) {
  const [active, setActive] = useState(0);
  const filtered = documents.filter((document) => {
    if (active === 0) return true;
    const expiry = document.expiry_date ? new Date(document.expiry_date).getTime() : 0;
    if (!expiry) return false;
    const days = (expiry - Date.now()) / 86400000;
    return active === 1 ? days >= 0 && days <= 30 : days < 0;
  });
  return (
    <View style={styles.stack}>
      <Tabs items={['All', 'Expiring Soon', 'Expired']} active={active} onChange={setActive} />
      {documents.length === 0 ? <EmptyState title="No documents" body="Driver and vehicle documents will appear here when connected to your account." /> : null}
      {documents.length > 0 && filtered.length === 0 ? <EmptyState title="No documents in this tab" body="Document expiry dates determine these categories." /> : null}
      {filtered.map((document) => <ListRow key={document.id} icon=">" title={formatVehicleLabel(document.doc_type)} subtitle={[formatVehicleLabel(document.status), document.expiry_date ? `Expires ${formatDateText(document.expiry_date)}` : ''].filter(Boolean).join(' · ')} />)}
      <Banner text="Document upload is not enabled for this account." tone="muted" />
    </View>
  );
}

function VehicleScreen({ vehicle }: { vehicle: Record<string, any> | null }) {
  return (
    <View style={styles.stack}>
      <Section>{vehicle ? <InfoGrid items={[
        ['Registration', String(vehicle.reg_plate ?? '')],
        ['Type', String(vehicle.type ?? '')],
        ['Make', String(vehicle.make ?? '')],
        ['Model', String(vehicle.model ?? '')],
      ]} /> : <EmptyState title="No vehicle data" body="Assigned vehicle details will appear here when connected to your account." />}</Section>
      {!vehicle ? <Banner text="A vehicle must be assigned before it can be managed here." tone="muted" /> : null}
    </View>
  );
}

function SettingsScreen({ onSignOut }: { onSignOut: () => void }) {
  return (
    <View style={styles.stack}>
      <Section title="App Settings"><InfoGrid items={[["Notifications", "Managed by Android and XDrive account policy"], ["Navigation", "Use installed navigation app"], ["Theme", "Dark"], ["Language", "English (UK)"], ["Units", "Miles"]]} /></Section>
      <Section title="Account & Security"><Text style={styles.copy}>Password, biometrics and two-factor authentication are managed by the secure account portal until mobile account-management routes are enabled.</Text></Section>
      <PrimaryButton label="Log Out" onPress={onSignOut} tone="red" />
    </View>
  );
}

function EarningsScreen({ invoices }: { invoices: Array<Record<string, any>> }) {
  const paid = invoices.filter((invoice) => String(invoice.payment_status ?? invoice.status ?? '').toLowerCase().includes('paid'));
  return (
    <View style={styles.stack}>
      <Tabs items={['Day', 'Week', 'Month', 'Year']} active={1} />
      <Section><Metric label="Paid invoices" value={String(paid.length)} /></Section>
      <Section title="Top Earning Jobs">{paid.length === 0 ? <EmptyState title="No completed paid jobs" body="Paid jobs will appear here." /> : paid.map((invoice) => <ListRow key={invoice.id} icon=">" title={String(invoice.invoice_number ?? invoice.id)} subtitle={formatMoney(invoice.amount, invoice.currency)} />)}</Section>
    </View>
  );
}

function PerformanceScreen() {
  return (
    <View style={styles.stack}>
      <Section><EmptyState title="No performance data" body="Ratings and operational stats will appear after completed jobs." /></Section>
      <Section title="Recent Feedback"><EmptyState title="No feedback" body="Customer feedback will appear here." /></Section>
    </View>
  );
}

function AvailabilityScreen({ driver, busy, onChange }: { driver: Record<string, any> | null; busy: boolean; onChange: (status: 'available' | 'busy' | 'offline') => void }) {
  return (
    <View style={styles.stack}>
      <Section><Text style={styles.title}>Availability</Text></Section>
      <Section title="Current Status">{driver?.availability_status ? <Info label="Status" value={formatVehicleLabel(driver.availability_status)} /> : <EmptyState title="No availability data" body="Availability will appear here when connected to your account." />}<Row>{(['available', 'busy', 'offline'] as const).map((status) => <MiniButton key={status} label={busy ? 'Saving...' : formatVehicleLabel(status)} onPress={() => onChange(status)} />)}</Row></Section>
      <Section title="Preferred Working Areas"><EmptyState title="No working areas" body="Preferred areas will appear here." /></Section>
    </View>
  );
}

function OfflineScreen({ queueCount }: { queueCount: number }) {
  return (
    <View style={styles.stack}>
      <View style={styles.offlineHero}><Text style={styles.offlineIcon}>!</Text><Text style={styles.title}>Offline Mode</Text><Text style={styles.muted}>Essential features stay available and sync automatically.</Text></View>
      <Section title="Available Offline"><ListRow icon="✓" title="Job status and POD queue" subtitle="Actions are stored locally and retried when connectivity returns" /></Section>
      <Section title="Sync Progress"><Info label="Pending Actions" value={`${queueCount} items`} /></Section>
    </View>
  );
}

function NavigationScreen({ job }: { job: DriverJob }) {
  return (
    <View style={styles.stack}>
      <Section><Text style={styles.label}>Next Stop</Text><Text style={styles.title}>{job.deliveryLocation}</Text></Section>
      <MapPreview route label="Navigation route" />
      <Banner text="Turn-by-turn navigation requires an installed navigation app." tone="muted" />
    </View>
  );
}

function Header({ title, onSettings, compact }: { title: string; onSettings: () => void; compact?: boolean }) {
  return (
    <View style={[styles.header, compact && styles.headerCompact]}>
      <View style={styles.headerLead}>
        <View style={styles.headerText}><Text style={[styles.headerTitle, compact && styles.headerTitleCompact]} numberOfLines={1}>{title}</Text>{compact ? <Text style={styles.headerBrand}>XDRIVE</Text> : <Text style={styles.muted}>XDrive Driver App</Text>}</View>
      </View>
      <TouchableOpacity style={[styles.iconButton, compact && styles.iconButtonCompact]} onPress={onSettings}><Text style={styles.iconText}>...</Text></TouchableOpacity>
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
    ['nearby', 'Loads', 'L'],
    ['alerts', 'Updates', 'U'],
    ['quotes', 'Offers', 'O'],
    ['jobs', 'Runs', 'R'],
    ['profile', 'More', 'M'],
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

function SwipePostedJobCard({ job, saved, onOpen, onSave, onHide }: { job: DriverJob; saved: boolean; onOpen: () => void; onSave: () => void; onHide: () => void }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [isSwiping, setIsSwiping] = useState(false);
  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > 28 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.8,
    onPanResponderGrant: () => setIsSwiping(true),
    onPanResponderMove: (_event, gesture) => translateX.setValue(Math.max(-112, Math.min(112, gesture.dx * 0.82))),
    onPanResponderRelease: (_event, gesture) => {
      if (gesture.dx > 84 && Math.abs(gesture.vx) < 3.5) onSave();
      if (gesture.dx < -84 && Math.abs(gesture.vx) < 3.5) onHide();
      setIsSwiping(false);
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
    },
    onPanResponderTerminate: () => { setIsSwiping(false); Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start(); },
  }), [onHide, onSave, translateX]);

  return (
    <View style={styles.postedSwipeShell}>
      {isSwiping ? <View style={[styles.postedSwipeAction, styles.postedSwipePin]}><Text style={styles.postedSwipeActionText}>{saved ? 'UNPIN' : 'PIN'}</Text></View> : null}
      {isSwiping ? <View style={[styles.postedSwipeAction, styles.postedSwipeHide]}><Text style={styles.postedSwipeActionText}>HIDE</Text></View> : null}
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        <JobMarketCard job={job} onPress={onOpen} action={saved ? 'Pinned' : 'Quote'} showAmount={canShowPrice(job, 'nearby')} compact />
      </Animated.View>
    </View>
  );
}

function JobMarketCard({ job, onPress, action, status, showAmount, compact }: { job: DriverJob; onPress: () => void; action: string; status?: string; showAmount?: boolean; compact?: boolean }) {
  if (compact) {
    const companyLabel = job.postingCompanyName
      ? `${formatPostingCompanyName(job.postingCompanyName)}${job.postingCompanyMemberCode ? ` (${job.postingCompanyMemberCode})` : ''}`
      : 'Posting company unavailable';
    return (
      <TouchableOpacity style={styles.compactJobCard} onPress={onPress}>
        <RowBetween>
          <View style={styles.compactCompany}><View style={styles.compactCompanyMark}><Text style={styles.compactCompanyMarkText}>X</Text></View><Text style={styles.compactCompanyName} numberOfLines={1}>{companyLabel}</Text></View>
          <Text style={styles.compactVehicle}>{job.vehicleRequirement || 'Vehicle required'}</Text>
        </RowBetween>
        <CompactStop tone="green" location={job.pickupLocation} time={formatScheduleDateText(job.pickupTime) || job.pickupTime} />
        <CompactStop tone="red" location={job.deliveryLocation} time={formatScheduleDateText(job.deliveryTime) || job.deliveryTime} />
        <RowBetween>
          <Text style={styles.compactLoad} numberOfLines={1}>{job.reference || 'Exchange load'} · {job.cargoType || 'Load details'}</Text>
          <View style={styles.compactAction}><Text style={styles.compactActionText}>{action}</Text></View>
        </RowBetween>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity style={styles.jobCard} onPress={onPress}>
      <RowBetween>
        {status ? <Badge label={status} tone={status.includes('PICKUP') ? 'green' : status.includes('DELIVER') ? 'yellow' : 'blue'} /> : <Text style={styles.cardBadgeText}>{job.reference || 'Exchange job'}</Text>}
        <View />
      </RowBetween>
      <RouteBlock job={job} />
      <View style={styles.jobMetaGrid}>
        <Info label="Vehicle" value={job.vehicleRequirement || 'Vehicle required'} />
        <Info label="Load" value={job.cargoType || 'Load details'} />
      </View>
      <RowBetween>
        {showAmount ? <Text style={styles.price}>{job.price}</Text> : <View />}
        <MiniButton label={action} onPress={onPress} />
      </RowBetween>
    </TouchableOpacity>
  );
}

function CompactStop({ tone, location, time }: { tone: 'green' | 'red'; location: string; time: string }) {
  return <View style={styles.compactStop}><View style={[styles.compactDot, tone === 'green' ? styles.compactDotGreen : styles.compactDotRed]} /><Text style={styles.compactLocation} numberOfLines={1}>{location}</Text><Text style={styles.compactTime}>{time}</Text></View>;
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

function Tabs({ items, active, onChange }: { items: string[]; active: number; onChange?: (index: number) => void }) {
  return <View style={styles.tabs}>{items.map((item, index) => <TouchableOpacity key={item} style={[styles.tabButton, index === active && styles.tabActive]} onPress={() => onChange?.(index)} disabled={!onChange}><Text style={[styles.tab, index === active && styles.tabTextActive]}>{item}</Text></TouchableOpacity>)}</View>;
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
  return <View style={styles.routeBlock}><View style={styles.routeRail}><View style={styles.dotGreen} /><View style={styles.line} /><View style={styles.dotRed} /></View><View style={{ flex: 1 }}><Text style={[styles.route, large && styles.routeLarge]}>{job.pickupLocation}</Text><Text style={styles.muted}>{formatScheduleDateText(job.pickupTime) || job.pickupTime}</Text><Text style={styles.routeArrow}>↓</Text><Text style={[styles.route, large && styles.routeLarge]}>{job.deliveryLocation}</Text><Text style={styles.muted}>{formatScheduleDateText(job.deliveryTime) || job.deliveryTime}</Text></View></View>;
}

function MapPreview({ route, label }: { route?: boolean; label: string }) {
  return <View style={styles.map}><Text style={styles.mapPin}>⌖</Text><View style={styles.mapRoute} /><Text style={styles.mapLabel}>{label}</Text></View>;
}

function MiniMap({ label }: { label: string }) { return <View style={styles.miniMap}><View style={styles.miniRoute} /><Text style={styles.muted}>{label}</Text></View>; }
function PhotoBox({ label, dashed, onPress }: { label: string; dashed?: boolean; onPress?: () => void }) {
  const content = <Text style={styles.photoText}>{label}</Text>;
  if (onPress) return <TouchableOpacity style={[styles.photoBox, dashed && styles.photoBoxDashed]} onPress={onPress}>{content}</TouchableOpacity>;
  return <View style={[styles.photoBox, dashed && styles.photoBoxDashed]}>{content}</View>;
}
function TimelineRow({ label, meta, done }: { label: string; meta: string; done: boolean }) { return <View style={styles.timelineRow}><Text style={[styles.timelineDot, done && { color: colors.success }]}>●</Text><View><Text style={styles.listTitle}>{label}</Text><Text style={styles.muted}>{meta}</Text></View></View>; }
function Bubble({ text, mine }: { text: string; mine?: boolean }) { return <View style={[styles.bubble, mine && styles.bubbleMine]}><Text style={styles.bubbleText}>{text}</Text></View>; }

function GridButtons({ items, onOpen }: { items: Array<[string, string, Screen]>; onOpen: (screen: Screen) => void }) {
  return <View style={styles.gridButtons}>{items.map(([title, subtitle, screen]) => <TouchableOpacity key={title} style={styles.gridButton} onPress={() => onOpen(screen)}><Text style={styles.listTitle}>{title}</Text><Text style={styles.muted}>{subtitle}</Text></TouchableOpacity>)}</View>;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}><Text style={styles.emptyIconText}>!</Text></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.muted}>{body}</Text>
    </View>
  );
}

function UnavailableState({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}><Text style={styles.emptyIconText}>!</Text></View>
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
    case 'red': return colors.danger;
    case 'purple': return colors.purple;
    case 'cyan': return colors.cyan;
    case 'muted': return colors.border;
  }
}

function parseLoadDetails(value: unknown): Record<string, any> | null {
  if (!value) return null;
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
  const text = String(value).trim();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, any> : { plainText: text };
  } catch {
    return { plainText: text };
  }
}

function yesNo(value: unknown) {
  return value === true ? 'Yes' : value === false ? 'No' : 'Not set';
}

function formatHandling(stop: Record<string, any>) {
  const items: string[] = [];
  if (stop.forkliftAvailable != null) items.push(`Forklift ${yesNo(stop.forkliftAvailable).toLowerCase()}`);
  if (stop.tailLiftRequired != null) items.push(`Tail lift ${stop.tailLiftRequired ? 'required' : 'not required'}`);
  if (stop.handballRequired != null) items.push(`Handball ${stop.handballRequired ? 'required' : 'not required'}`);
  return items.join(' · ');
}

function formatContact(name: unknown, phone: unknown) {
  return [name, phone].map((value) => String(value ?? '').trim()).filter(Boolean).join(' · ');
}

function formatStatus(status: DriverJob['status']) {
  return status.replaceAll('_', ' ').toUpperCase();
}

function canShowPrice(job: DriverJob, context: 'nearby' | 'assigned') {
  if (!job.price || job.price === 'Price TBC') return false;
  const flags = job as DriverJob & {
    publicPricePublished?: boolean;
    pricePublished?: boolean;
    isPricePublic?: boolean;
    budgetPublished?: boolean;
    canViewPrice?: boolean;
  };
  if (context === 'nearby') {
    return flags.publicPricePublished === true || flags.pricePublished === true || flags.isPricePublic === true || flags.budgetPublished === true;
  }
  return flags.canViewPrice !== false;
}

function formatQuoteReference(value: unknown) {
  const text = String(value ?? '').trim();
  if (!text) return 'Job reference pending';
  const compact = text.includes('-') && text.length > 12 ? text.slice(0, 8) : text;
  return `Job ${compact.toUpperCase()}`;
}

function alertCategory(alert: Record<string, any>) {
  const event = String(alert.event_type ?? '').toLowerCase();
  const entity = String(alert.entity_type ?? '').toLowerCase();
  if (event.includes('message') || entity.includes('message')) return 'messages';
  if (event.includes('bid') || event.includes('job') || entity.includes('bid') || entity.includes('job')) return 'jobs';
  return 'system';
}

function formatAlert(alert: Record<string, any>) {
  const event = String(alert.event_type ?? 'notification').toLowerCase();
  const payload = alert.payload && typeof alert.payload === 'object' ? alert.payload : {};
  const reference = payload.public_reference || payload.job_reference || (alert.entity_id ? formatQuoteReference(alert.entity_id) : '');
  let title = 'XDrive notification';
  let body = reference ? String(reference) : 'Open XDrive for details.';
  if (event === 'bid_accepted') { title = 'Your quote was accepted'; body = reference ? `${reference} is now a booking.` : 'The customer accepted your quote. Open Quotes or My Jobs for details.'; }
  else if (event === 'bid_rejected') { title = 'Quote unsuccessful'; body = reference ? `${reference} was awarded to another carrier.` : 'This quote was not selected.'; }
  else if (event.includes('job_assigned')) { title = 'Job assigned to you'; body = reference ? `${reference} is ready in My Jobs.` : 'A booking is ready in My Jobs.'; }
  else if (event.includes('message')) { title = 'New job message'; body = payload.message || body; }
  else title = formatVehicleLabel(event);
  const delivery = String(alert.status ?? '').toLowerCase() === 'sent' || String(alert.status ?? '').toLowerCase() === 'delivered' ? 'Delivered' : 'In app';
  return { title, body: String(body), delivery };
}

function normalizeQuoteStatus(quote: Record<string, any>) {
  return String(quote.status ?? 'unknown').toLowerCase().replaceAll(' ', '_');
}

function canChangeQuote(quote: Record<string, any>) {
  return normalizeQuoteStatus(quote) === 'submitted';
}

function quoteBucket(quote: Record<string, any>): QuoteTab {
  const status = normalizeQuoteStatus(quote);
  if (['submitted', 'sent', 'pending', 'draft'].includes(status)) return 'sent';
  if (['accepted', 'awarded', 'approved'].includes(status)) return 'accepted';
  return 'closed';
}

function quoteHeadline(status: string) {
  if (['accepted', 'awarded', 'approved'].includes(status)) return 'Accepted quote';
  if (['rejected', 'declined'].includes(status)) return 'Rejected quote';
  if (status === 'withdrawn') return 'Withdrawn quote';
  if (['expired', 'closed', 'cancelled', 'canceled'].includes(status)) return 'Closed quote';
  return 'Submitted quote';
}

function quoteOpenActionLabel(status: string) {
  return ['accepted', 'awarded', 'approved'].includes(status) ? 'Open Booking' : 'View Details';
}

function formatQuoteStatus(status: string) {
  const normalized = status === 'submitted' ? 'sent' : status;
  return normalized.replaceAll('_', ' ').toUpperCase();
}

function quoteTone(status: string): Tone {
  if (['accepted', 'awarded', 'approved'].includes(status)) return 'green';
  if (['rejected', 'expired', 'withdrawn', 'declined', 'closed', 'cancelled', 'canceled'].includes(status)) return 'red';
  return 'blue';
}

function formatVehicleLabel(value: unknown) {
  const text = String(value ?? '').trim();
  if (!text) return 'Not set';
  return text
    .replaceAll('_', ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => (part.length <= 3 ? part.toUpperCase() : `${part[0].toUpperCase()}${part.slice(1).toLowerCase()}`))
    .join(' ');
}

function formatPostingCompanyName(value: unknown) {
  const original = String(value ?? '').trim();
  if (!original.includes('@')) return original;
  const emailName = original.split('@')[0]
    .replace(/\.(co\.uk|com|net|org)$/i, '')
    .replace(/[._-]+/g, ' ')
    .replace(/loadify\s*market/gi, 'Loadify Market')
    .trim();
  return emailName.replace(/\b\w/g, (letter) => letter.toUpperCase()) || original;
}

function formatLocation(value: unknown) {
  const text = String(value ?? '').trim();
  return text || 'Location not set';
}

function formatDateText(value: unknown) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
}

// Job slots are stored as the customer's UK wall-clock value. Formatting in
// UTC prevents Android from applying the summer-time offset a second time.
function formatScheduleDateText(value: unknown) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(date);
}

function timeUntil(value: unknown) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return '';
  const diff = date.getTime() - Date.now();
  if (diff <= 0) return '';
  const minutes = Math.round(diff / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function statusStepIndex(status: DriverJob['status']) {
  const order: DriverJob['status'][] = ['awarded', 'on_my_way_pickup', 'arrived_pickup', 'loaded', 'on_my_way_delivery', 'arrived_delivery', 'delivered'];
  return Math.max(0, order.indexOf(status));
}

function isMainTab(screen: Screen): screen is MainTab {
  return screen === 'nearby' || screen === 'quotes' || screen === 'jobs' || screen === 'alerts' || screen === 'profile';
}

function titleFor(screen: Screen) {
  const map: Record<Screen, string> = {
    login: 'Login',
    nearby: 'Live Loads',
    quotes: 'My Offers',
    jobs: 'My Runs',
    alerts: 'Updates',
    profile: 'More',
    filters: 'Filters',
    quoteDetail: 'Job Details',
    quoteJobDetail: 'Quote & Job Details',
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
  contentCompact: { padding: spacing.sm, paddingBottom: 96, gap: spacing.sm },
  stack: { gap: spacing.md },
  nearbyStack: { gap: spacing.sm },
  searchPanel: { flexDirection: 'row', alignItems: 'center', gap: spacing.mdSm },
  searchInput: { flex: 1, minHeight: 52, borderColor: colors.border, borderWidth: 1, borderRadius: 14, color: colors.text, paddingHorizontal: spacing.md, backgroundColor: colors.panel, fontSize: 15 },
  filterButton: { minHeight: 52, borderRadius: 14, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.panelSoft, borderColor: colors.border, borderWidth: 1 },
  filterButtonText: { color: colors.text, fontWeight: '800', fontSize: 15 },
  nearbyControls: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingHorizontal: spacing.xs },
  resultCount: { color: colors.text, fontWeight: '900', fontSize: 15 },
  resultMeta: { color: colors.muted, fontSize: 12 },
  viewToggle: { flexDirection: 'row', backgroundColor: colors.bg2, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: spacing.xs },
  toggleItem: { minHeight: 36, minWidth: 58, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  toggleItemActive: { backgroundColor: colors.primary },
  toggleText: { color: colors.secondary, fontWeight: '800', fontSize: 12 },
  toggleTextActive: { color: '#111827' },
  loginSafe: { flex: 1, backgroundColor: '#07111F' },
  loginPage: { flexGrow: 1, backgroundColor: '#EEF3F9', paddingBottom: 28 },
  loginHero: { height: 410, backgroundColor: '#07111F', overflow: 'hidden' },
  loginHeroImage: { flex: 1, paddingHorizontal: 22, paddingTop: 24, paddingBottom: 42, justifyContent: 'space-between' },
  loginHeroImageRadius: { borderBottomLeftRadius: 34, borderBottomRightRadius: 34 },
  loginHeroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(3, 12, 30, 0.32)', borderBottomLeftRadius: 34, borderBottomRightRadius: 34 },
  loginBrandPill: { alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: 14, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.94)', flexDirection: 'row', alignItems: 'center', gap: 3 },
  loginBrandX: { color: '#FFB400', fontSize: 24, fontWeight: '900', fontStyle: 'italic' },
  loginBrandDrive: { color: '#073AA5', fontSize: 22, fontWeight: '900', fontStyle: 'italic' },
  loginBrandDivider: { width: 1, height: 22, backgroundColor: '#B7C3D4', marginHorizontal: 7 },
  loginBrandMeta: { color: '#17345F', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  loginHeroCopy: { maxWidth: '72%', gap: 8 },
  loginEyebrow: { color: '#FFC21A', fontSize: 11, fontWeight: '900', letterSpacing: 1.8 },
  loginHeroTitle: { color: '#FFFFFF', fontSize: 34, lineHeight: 38, fontWeight: '900', letterSpacing: -0.8, textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 8 },
  loginHeroBody: { color: '#F4F7FC', fontSize: 14, lineHeight: 20, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 6 },
  loginNetworkPill: { marginTop: 4, alignSelf: 'flex-start', paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, backgroundColor: 'rgba(7,45,116,0.88)', flexDirection: 'row', alignItems: 'center', gap: 7 },
  loginNetworkDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#FFC21A' },
  loginNetworkText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  loginCard: { marginHorizontal: 16, marginTop: -26, paddingHorizontal: 20, paddingTop: 26, paddingBottom: 22, borderRadius: 28, backgroundColor: '#F9FBFE', gap: 11, borderColor: '#FFFFFF', borderWidth: 1, elevation: 14, shadowColor: '#07111F', shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } },
  loginTitle: { color: '#0A2A63', textAlign: 'center', fontSize: 26, fontWeight: '900', letterSpacing: -0.4 },
  loginSubtitle: { color: '#62708A', textAlign: 'center', fontSize: 13, marginBottom: 4 },
  loginFieldLabel: { color: '#29466F', fontSize: 10, fontWeight: '900', letterSpacing: 1.4, marginTop: 3 },
  loginInput: { minHeight: 56, borderColor: '#CED8E7', borderWidth: 1, borderRadius: 15, color: '#102A50', paddingHorizontal: 16, backgroundColor: '#FFFFFF', fontSize: 15 },
  loginPasswordRow: { minHeight: 56, borderColor: '#CED8E7', borderWidth: 1, borderRadius: 15, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center' },
  loginPasswordInput: { flex: 1, minHeight: 54, color: '#102A50', paddingHorizontal: 16, fontSize: 15 },
  loginShowButton: { alignSelf: 'stretch', paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center' },
  loginShowText: { color: '#0B4FC5', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  loginSubmit: { minHeight: 58, marginTop: 8, borderRadius: 16, backgroundColor: '#0A48C5', alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#0A48C5', shadowOpacity: 0.28, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },
  loginSubmitDisabled: { backgroundColor: '#9AA9BD', elevation: 0, shadowOpacity: 0 },
  loginSubmitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  loginTrustRow: { marginTop: 8, borderTopColor: '#E0E7F0', borderTopWidth: 1, paddingTop: 16, flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  loginTrustItem: { flex: 1, alignItems: 'center', gap: 5 },
  loginTrustIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E7EFFC', color: '#0A48C5', textAlign: 'center', textAlignVertical: 'center', fontSize: 10, fontWeight: '900' },
  loginTrustText: { color: '#53647E', textAlign: 'center', fontSize: 10, fontWeight: '700' },
  heroLine: { color: colors.text, textAlign: 'center', fontSize: 16, fontWeight: '700' },
  heroLineGold: { color: colors.primary, textAlign: 'center', fontSize: 16, fontWeight: '800' },
  heroVan: { height: 210, borderRadius: 20, backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  heroVanText: { color: colors.primary, fontSize: 34, fontWeight: '900' },
  copyCenter: { color: colors.text, textAlign: 'center', lineHeight: 22 },
  header: { padding: spacing.md, borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.bg },
  headerCompact: { minHeight: 58, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  headerLead: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerText: { flex: 1, minWidth: 0 },
  headerTitle: { color: colors.text, fontSize: 24, fontWeight: '900' },
  headerTitleCompact: { fontSize: 19 },
  headerBrand: { color: colors.primary, fontWeight: '900', fontSize: 10, letterSpacing: 1.6 },
  iconButton: { width: 44, height: 44, borderRadius: 14, borderColor: colors.border, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.panel },
  iconButtonCompact: { width: 38, height: 38, borderRadius: 11 },
  backButton: { width: 46, height: 46, borderRadius: 14, borderColor: colors.border, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.panel },
  backButtonText: { color: colors.text, fontSize: 38, fontWeight: '500', lineHeight: 40, marginTop: -3 },
  iconText: { color: colors.text, fontWeight: '900' },
  muted: { color: colors.muted },
  title: { color: colors.text, fontSize: 22, fontWeight: '900' },
  banner: { fontWeight: '800', fontSize: 14 },
  input: { minHeight: 58, borderColor: '#27415e', borderWidth: 1, borderRadius: 14, color: colors.text, paddingHorizontal: spacing.md, backgroundColor: colors.panel },
  textarea: { minHeight: 110, paddingTop: spacing.md, textAlignVertical: 'top' },
  inputBox: { minHeight: 48, borderColor: colors.border, borderWidth: 1, borderRadius: 12, backgroundColor: colors.card, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  supportTopic: { borderBottomColor: colors.borderSubtle, borderBottomWidth: 1, paddingVertical: spacing.sm, gap: spacing.xs },
  supportAnswer: { color: colors.muted, lineHeight: 20 },
  profileDetail: { color: colors.text, fontSize: 13, marginTop: 2 },
  panel: { backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: 18, padding: spacing.md, gap: spacing.mdSm },
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
  flexText: { flex: 1, minWidth: 0 },
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
  tabButton: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 9, overflow: 'hidden' },
  tab: { color: colors.muted, fontWeight: '800', fontSize: 12, textAlign: 'center' },
  tabActive: { backgroundColor: colors.primary },
  tabTextActive: { color: '#111827' },
  segmented: { flexDirection: 'row', backgroundColor: colors.panel, borderRadius: 12, padding: 4, borderColor: colors.border, borderWidth: 1 },
  segment: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  segmentActive: { backgroundColor: colors.blue },
  segmentText: { color: colors.muted, textTransform: 'capitalize', fontWeight: '800' },
  segmentTextActive: { color: '#fff' },
  cardBadgeText: { color: colors.secondary, fontSize: 12, fontWeight: '800' },
  saveButton: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg2, borderColor: colors.borderSubtle, borderWidth: 1 },
  saveButtonText: { color: colors.secondary, fontSize: 22, fontWeight: '800' },
  quoteCard: { backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: spacing.mdSm, gap: spacing.sm },
  swipeShell: { position: 'relative', overflow: 'hidden', borderRadius: 12, backgroundColor: colors.bg2 },
  swipeAction: { position: 'absolute', top: 0, bottom: 0, width: 92, alignItems: 'center', justifyContent: 'center', gap: 4 },
  saveSwipe: { left: 0, backgroundColor: colors.success },
  withdrawSwipe: { right: 0, backgroundColor: colors.danger },
  swipeActionIcon: { color: '#fff', fontSize: 24, fontWeight: '900' },
  swipeActionText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  moreButton: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderColor: colors.border, borderWidth: 1 },
  moreButtonText: { color: colors.text, fontSize: 16, fontWeight: '900' },
  quoteMenu: { gap: spacing.sm, paddingTop: spacing.xs, borderTopColor: colors.border, borderTopWidth: 1 },
  postedSwipeShell: { position: 'relative', borderRadius: 18, overflow: 'hidden', backgroundColor: colors.bg2 },
  postedSwipeAction: { position: 'absolute', top: 0, bottom: 0, width: 110, alignItems: 'center', justifyContent: 'center' },
  postedSwipePin: { left: 0, backgroundColor: colors.blue },
  postedSwipeHide: { right: 0, backgroundColor: colors.danger },
  postedSwipeActionText: { color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 0.8 },
  compactJobCard: { minHeight: 148, justifyContent: 'space-between', backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: 15, paddingHorizontal: spacing.mdSm, paddingVertical: spacing.mdSm, gap: 8 },
  compactRef: { color: colors.secondary, fontSize: 13, fontWeight: '900', flexShrink: 1 },
  compactCompany: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 7 },
  compactCompanyMark: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  compactCompanyMarkText: { color: '#111827', fontSize: 12, fontWeight: '900' },
  compactCompanyName: { color: colors.text, fontSize: 14, fontWeight: '900', flex: 1 },
  compactVehicle: { color: colors.text, fontSize: 13, fontWeight: '800', backgroundColor: colors.card, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5, maxWidth: '46%' },
  compactStop: { minHeight: 29, flexDirection: 'row', alignItems: 'center', gap: 8 },
  compactDot: { width: 11, height: 11, borderRadius: 6, borderWidth: 2.5 },
  compactDotGreen: { borderColor: colors.success },
  compactDotRed: { borderColor: colors.danger },
  compactLocation: { color: colors.text, fontSize: 16, fontWeight: '900', flex: 1 },
  compactTime: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  compactLoad: { color: colors.muted, fontSize: 13, flex: 1 },
  compactAction: { backgroundColor: colors.primary, borderRadius: 9, paddingHorizontal: spacing.sm, paddingVertical: 8 },
  compactActionText: { color: '#111827', fontSize: 13, fontWeight: '900' },
  quoteTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  quoteRoute: { color: colors.text, fontSize: 14, fontWeight: '700', lineHeight: 19 },
  quoteDate: { color: colors.muted, fontSize: 12, alignSelf: 'center' },
  quoteFooter: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.sm },
  quotePrice: { color: colors.success, fontSize: 22, fontWeight: '900' },
  jobCard: { minHeight: 176, backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: 18, padding: spacing.md, gap: spacing.mdSm },
  jobMetaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  routeBlock: { flexDirection: 'row', gap: spacing.sm },
  routeRail: { alignItems: 'center', paddingTop: 3 },
  dotGreen: { width: 11, height: 11, borderRadius: 7, borderColor: colors.success, borderWidth: 3 },
  dotRed: { width: 11, height: 11, borderRadius: 7, borderColor: colors.danger, borderWidth: 3 },
  line: { width: 2, height: 42, backgroundColor: colors.success },
  routeArrow: { color: colors.muted, fontSize: 18, marginVertical: 2 },
  map: { height: 280, backgroundColor: '#102035', borderRadius: 16, borderColor: colors.border, borderWidth: 1, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  mapPin: { color: colors.primary, fontSize: 46, position: 'absolute', top: 36, left: 60 },
  mapRoute: { width: 5, height: 170, backgroundColor: colors.blue, borderRadius: 5, transform: [{ rotate: '28deg' }] },
  mapLabel: { color: colors.text, position: 'absolute', bottom: spacing.md, fontWeight: '800' },
  emptyIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.panelSoft, borderColor: colors.border, borderWidth: 1 },
  emptyIconText: { color: colors.primary, fontWeight: '900', fontSize: 22 },
  miniMap: { height: 82, backgroundColor: '#102035', borderRadius: 12, borderColor: colors.border, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  miniRoute: { width: '74%', height: 5, backgroundColor: colors.blue, borderRadius: 4, transform: [{ rotate: '-8deg' }] },
  nav: { position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: 84, backgroundColor: colors.bg2, borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', paddingHorizontal: spacing.sm, paddingTop: spacing.sm, zIndex: 10, elevation: 10 },
  fab: { position: 'absolute', right: spacing.sm, bottom: 92, width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', zIndex: 20, elevation: 12, borderColor: '#fff', borderWidth: 2 },
  fabText: { color: '#111827', fontSize: 17, fontWeight: '900' },
  backFab: { position: 'absolute', right: spacing.sm, bottom: 92, width: 52, height: 52, borderRadius: 26, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center', zIndex: 20, elevation: 12, borderColor: '#fff', borderWidth: 2 },
  backFabText: { color: '#fff', fontSize: 40, fontWeight: '600', lineHeight: 42, marginTop: -4 },
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
  signatureCanvas: { height: 250, overflow: 'hidden', borderRadius: 12, backgroundColor: '#f8fafc' },
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
