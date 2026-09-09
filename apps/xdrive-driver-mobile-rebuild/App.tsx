import { ThemeProvider, useAppTheme } from './src/theme/ThemeProvider';
import { useCallback, useEffect, useState } from 'react';
import { BackHandler, StatusBar, StyleSheet } from 'react-native';
import { ActivityIndicator, SafeAreaView, Text, View } from './src/theme/primitives';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './src/auth/supabase';
import { revokeNativeDeviceSession } from './src/auth/deviceSession';
import { fetchAvailableJobs, fetchJob, fetchJobs, fetchResources, isQuoteWindowOpen, postJobStatus, quoteReadinessMessage, submitQuote, updateDestinationPreferences, type ReturnIqMeta } from './src/api/driver';
import type { DriverJob, DriverResources } from './src/types/driver';
import { BottomNav, type MainTab } from './src/components/BottomNav';
import { HomeScreen } from './src/screens/HomeScreen';
import { LoadsScreen } from './src/screens/LoadsScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { QuotesScreen } from './src/screens/QuotesScreen';
import { MoreScreen } from './src/screens/MoreScreen';
import { ResourcesScreen } from './src/screens/ResourcesScreen';
import { LoadDetailScreen } from './src/screens/LoadDetailScreen';
import { JobDetailScreen } from './src/screens/JobDetailScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { colors } from './src/theme/tokens';

export default function App() { return <ThemeProvider><DriverApp /></ThemeProvider>; }

function destinationRadius(value: unknown): 10 | 20 | 30 {
  const radius = Number(value);
  return radius === 10 || radius === 20 || radius === 30 ? radius : 20;
}

function destinationEnabled(value: unknown) {
  return value === true || String(value ?? '').toLowerCase() === 'true';
}

function DriverApp() {
  const { isDark, palette } = useAppTheme();
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [tab, setTab] = useState<MainTab>('home');
  const [available, setAvailable] = useState<DriverJob[]>([]);
  const [active, setActive] = useState<DriverJob[]>([]);
  const [history, setHistory] = useState<DriverJob[]>([]);
  const [resources, setResources] = useState<DriverResources>();
  const [returnIq, setReturnIq] = useState<ReturnIqMeta>({ active: false });
  const [returnIqBusy, setReturnIqBusy] = useState(false);
  const [selectedJob, setSelectedJob] = useState<DriverJob>();
  const [selectedQuote, setSelectedQuote] = useState<Record<string, unknown>>();
  const [resourcePage, setResourcePage] = useState<'vehicle' | 'documents' | 'alerts' | 'journeys' | 'messenger' | 'invoices'>();
  const [loading, setLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [dataError, setDataError] = useState('');
  const [actionError, setActionError] = useState('');
  useEffect(() => {
    setActionError('');
  }, [resourcePage, selectedJob?.id, tab]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selectedJob) { setSelectedJob(undefined); setSelectedQuote(undefined); return true; }
      if (resourcePage) { setResourcePage(undefined); return true; }
      if (tab !== 'home') { setTab('home'); return true; }
      return false;
    });
    return () => subscription.remove();
  }, [resourcePage, selectedJob, tab]);


  useEffect(() => {
    let active = true;
    const authTimeout = setTimeout(() => {
      if (active) setAuthReady(true);
    }, 4000);
    supabase.auth.getSession()
      .then(({ data }) => { if (active) setSession(data.session); })
      .catch(() => undefined)
      .finally(() => { if (active) setAuthReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      setSession(next);
      setAuthReady(true);
    });
    return () => {
      active = false;
      clearTimeout(authTimeout);
      data.subscription.unsubscribe();
    };
  }, []);
  const refresh = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setDataError('');
    const baseResults = await Promise.allSettled([
      fetchJobs('active'),
      fetchJobs('completed'),
      fetchResources(),
    ]);
    if (baseResults[0].status === 'fulfilled') setActive(baseResults[0].value);
    if (baseResults[1].status === 'fulfilled') setHistory(baseResults[1].value);
    if (baseResults[2].status === 'fulfilled') setResources(baseResults[2].value);

    const nextResources = baseResults[2].status === 'fulfilled' ? baseResults[2].value : undefined;
    const enabled = destinationEnabled(nextResources?.driver?.destination_priority_enabled);
    const radius = destinationRadius(nextResources?.driver?.destination_radius_miles);
    const marketResult = await Promise.allSettled([
      fetchAvailableJobs(enabled ? { destinationMode: true, radiusMiles: radius } : {}),
    ]);
    if (marketResult[0].status === 'fulfilled') {
      setAvailable(marketResult[0].value.jobs);
      setReturnIq(marketResult[0].value.returnIq);
    }
    const failed = [...baseResults, ...marketResult].find((result) => result.status === 'rejected');
    if (failed?.status === 'rejected') setDataError(failed.reason instanceof Error ? failed.reason.message : 'Some XDrive data could not be loaded.');
    setLoading(false);
  }, [session]);


  useEffect(() => {
    if (session) void refresh();
    else {
      setAvailable([]);
      setActive([]);
      setHistory([]);
      setResources(undefined);
      setReturnIq({ active: false });
      setSelectedJob(undefined);
      setSelectedQuote(undefined);
      setResourcePage(undefined);
    }
  }, [session, refresh]);

  async function saveReturnIq(enabled: boolean, radius: 10 | 20 | 30) {
    setReturnIqBusy(true);
    setActionError('');
    try {
      await updateDestinationPreferences(enabled, radius);
      const result = await fetchAvailableJobs(enabled ? { destinationMode: true, radiusMiles: radius } : {});
      setAvailable(result.jobs);
      setReturnIq(result.returnIq);
      setResources((current) => current?.driver ? {
        ...current,
        driver: {
          ...current.driver,
          destination_priority_enabled: enabled,
          destination_radius_miles: radius,
        },
      } : current);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Return IQ preferences could not be updated.');
    } finally {
      setReturnIqBusy(false);
    }
  }

  async function quoteLoad(amount: number) {
    if (!selectedJob) return;
    if (!isQuoteWindowOpen(selectedJob)) {
      setActionError('This load is no longer open for quotation.');
      return;
    }
    if (selectedJob.canQuote === false) {
      setActionError(selectedJob.quoteWarning || 'This load is not currently eligible for quotation.');
      return;
    }
    const readiness = resources?.quoteReadiness;
    if (readiness && !readiness.eligible) {
      setActionError(quoteReadinessMessage(readiness));
      return;
    }
    setActionBusy(true);
    setActionError('');
    try {
      await submitQuote(selectedJob.id, amount);
      await refresh();
      setSelectedJob(undefined);
      setTab('quotes');
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Quote could not be submitted.');
    } finally {
      setActionBusy(false);
    }
  }

  async function advanceJob(endpoint: string) {
    if (!selectedJob) return;
    setActionBusy(true);
    setActionError('');
    try {
      await postJobStatus(selectedJob.id, endpoint);
      const refreshedJob = await fetchJob(selectedJob.id);
      setSelectedJob(refreshedJob);
      await refresh();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Delivery status could not be updated.');
    } finally {
      setActionBusy(false);
    }
  }

  async function signOut() {
    const token = session?.access_token ?? '';
    if (token) await revokeNativeDeviceSession(token).catch(() => undefined);
    await supabase.auth.signOut();
  }

  if ((!fontsLoaded && !fontError) || !authReady) {
    return <View style={styles.loading}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  if (!session) return <LoginScreen />;

  let screen = null;
  if (resourcePage) {
    screen = <ResourcesScreen page={resourcePage} resources={resources} returnIq={returnIq} returnIqBusy={returnIqBusy} onReturnIqChange={saveReturnIq} onDocumentsChanged={refresh} onBack={() => setResourcePage(undefined)} />;
  } else if (selectedJob && (selectedQuote || selectedJob.status === 'available')) {
    screen = <LoadDetailScreen job={selectedJob} busy={actionBusy} existingQuote={selectedQuote} quoteReadiness={resources?.quoteReadiness} onBack={() => { setSelectedJob(undefined); setSelectedQuote(undefined); }} onOpenDocuments={() => { setSelectedJob(undefined); setSelectedQuote(undefined); setResourcePage('documents'); }} onQuote={quoteLoad} />;
  } else if (selectedJob) {
    screen = <JobDetailScreen job={selectedJob} busy={actionBusy} onBack={() => { setSelectedJob(undefined); setSelectedQuote(undefined); }} onAdvance={advanceJob} />;
  } else if (tab === 'home') {
    screen = <HomeScreen jobs={available} activeJob={active[0]} recentJob={history[0]} resources={resources} loading={loading} dataError={dataError} onRefresh={refresh} onOpen={setSelectedJob} onGoLoads={() => setTab('loads')} onGoQuotes={() => setTab('quotes')} onGoHistory={() => setTab('history')} onGoMore={() => setTab('more')} onAvailabilitySaved={(value) => setResources(current => current?.driver ? { ...current, driver: { ...current.driver, availability_status: value } } : current)} />;
  } else if (tab === 'loads') {
    screen = <LoadsScreen jobs={available} loading={loading} onRefresh={refresh} onOpen={(job) => { setSelectedQuote(undefined); setSelectedJob(job); }} />;
  } else if (tab === 'quotes') {
    screen = <QuotesScreen resources={resources} jobs={[...available, ...active, ...history]} onOpen={(job, quote) => { setSelectedQuote(quote); setSelectedJob(job); }} />;
  } else if (tab === 'history') {
    screen = <HistoryScreen jobs={history} onOpen={(job) => { setSelectedQuote(undefined); setSelectedJob(job); }} />;
  } else {
    screen = <MoreScreen resources={resources} onSignOut={signOut} onOpenResource={setResourcePage} />;
  }

  const homeBrand = !selectedJob && tab === 'home';
  return (
    <SafeAreaView style={[styles.safe, homeBrand && styles.homeSafe]}>
      <StatusBar barStyle={homeBrand || isDark ? 'light-content' : 'dark-content'} backgroundColor={homeBrand ? palette.brand : palette.surface} />
      <View style={styles.app}>
        {actionError ? <View style={styles.errorBanner}><Text style={styles.errorText}>{actionError}</Text></View> : null}
        <View style={styles.screen}>{screen}</View>
        {!selectedJob && !resourcePage ? <BottomNav active={tab} onChange={setTab} /> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  homeSafe: { backgroundColor: '#0B2F6B' },
  app: { flex: 1, backgroundColor: colors.appBackground },
  screen: { flex: 1 },
  loading: { flex: 1, backgroundColor: colors.appBackground, alignItems: 'center', justifyContent: 'center' },
  errorBanner: { backgroundColor: colors.notice, paddingHorizontal: 14, paddingVertical: 9 },
  errorText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: colors.text, textAlign: 'center' },
});