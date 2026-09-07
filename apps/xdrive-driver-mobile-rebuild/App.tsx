import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { Inter_400Regular, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './src/auth/supabase';
import { revokeNativeDeviceSession } from './src/auth/deviceSession';
import { fetchAvailableJobs, fetchJobs, fetchResources, postJobStatus, submitQuote } from './src/api/driver';
import type { DriverJob, DriverResources } from './src/types/driver';
import { BottomNav, type MainTab } from './src/components/BottomNav';
import { HomeScreen } from './src/screens/HomeScreen';
import { LoadsScreen } from './src/screens/LoadsScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { QuotesScreen } from './src/screens/QuotesScreen';
import { MoreScreen } from './src/screens/MoreScreen';
import { LoadDetailScreen } from './src/screens/LoadDetailScreen';
import { JobDetailScreen } from './src/screens/JobDetailScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { colors } from './src/theme/tokens';

export default function App() {
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_600SemiBold, Inter_700Bold });
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [tab, setTab] = useState<MainTab>('home');
  const [available, setAvailable] = useState<DriverJob[]>([]);
  const [active, setActive] = useState<DriverJob[]>([]);
  const [history, setHistory] = useState<DriverJob[]>([]);
  const [resources, setResources] = useState<DriverResources>();
  const [selectedJob, setSelectedJob] = useState<DriverJob>();
  const [loading, setLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState('');

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
    setError('');
    const results = await Promise.allSettled([
      fetchAvailableJobs(),
      fetchJobs('active'),
      fetchJobs('completed'),
      fetchResources(),
    ]);
    if (results[0].status === 'fulfilled') setAvailable(results[0].value);
    if (results[1].status === 'fulfilled') setActive(results[1].value);
    if (results[2].status === 'fulfilled') setHistory(results[2].value);
    if (results[3].status === 'fulfilled') setResources(results[3].value);
    const failed = results.find((result) => result.status === 'rejected');
    if (failed?.status === 'rejected') setError(failed.reason instanceof Error ? failed.reason.message : 'Some XDrive data could not be loaded.');
    setLoading(false);
  }, [session]);

  useEffect(() => {
    if (session) void refresh();
    else {
      setAvailable([]);
      setActive([]);
      setHistory([]);
      setResources(undefined);
      setSelectedJob(undefined);
    }
  }, [session, refresh]);

  async function quoteLoad(amount: number) {
    if (!selectedJob) return;
    setActionBusy(true);
    setError('');
    try {
      await submitQuote(selectedJob.id, amount);
      await refresh();
      setSelectedJob(undefined);
      setTab('quotes');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Quote could not be submitted.');
    } finally {
      setActionBusy(false);
    }
  }

  async function advanceJob(endpoint: string) {
    if (!selectedJob) return;
    setActionBusy(true);
    setError('');
    try {
      await postJobStatus(selectedJob.id, endpoint);
      await refresh();
      const refreshed = [...active, ...history].find((job) => job.id === selectedJob.id);
      if (refreshed) setSelectedJob(refreshed);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Delivery status could not be updated.');
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
  if (selectedJob?.status === 'available') {
    screen = <LoadDetailScreen job={selectedJob} busy={actionBusy} onBack={() => setSelectedJob(undefined)} onQuote={quoteLoad} />;
  } else if (selectedJob) {
    screen = <JobDetailScreen job={selectedJob} busy={actionBusy} onBack={() => setSelectedJob(undefined)} onAdvance={advanceJob} />;
  } else if (tab === 'home') {
    screen = <HomeScreen jobs={available} activeJob={active[0]} recentJob={history[0]} resources={resources} loading={loading} onRefresh={refresh} onOpen={setSelectedJob} onGoLoads={() => setTab('loads')} onGoQuotes={() => setTab('quotes')} onGoHistory={() => setTab('history')} onGoMore={() => setTab('more')} />;
  } else if (tab === 'loads') {
    screen = <LoadsScreen jobs={available} loading={loading} onRefresh={refresh} onOpen={setSelectedJob} />;
  } else if (tab === 'quotes') {
    screen = <QuotesScreen resources={resources} jobs={[...available, ...active, ...history]} />;
  } else if (tab === 'history') {
    screen = <HistoryScreen jobs={history} onOpen={setSelectedJob} />;
  } else {
    screen = <MoreScreen resources={resources} onSignOut={signOut} />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.app}>
        {error ? <View style={styles.errorBanner}><Text style={styles.errorText}>{error}</Text></View> : null}
        <View style={styles.screen}>{screen}</View>
        {!selectedJob ? <BottomNav active={tab} onChange={setTab} /> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  app: { flex: 1, backgroundColor: colors.appBackground },
  screen: { flex: 1 },
  loading: { flex: 1, backgroundColor: colors.appBackground, alignItems: 'center', justifyContent: 'center' },
  errorBanner: { backgroundColor: colors.notice, paddingHorizontal: 14, paddingVertical: 9 },
  errorText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: colors.text, textAlign: 'center' },
});