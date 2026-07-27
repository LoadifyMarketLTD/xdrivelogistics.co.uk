import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Animated, PanResponder, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { fetchActiveQuotedJobIds, fetchLiveLoads, submitLiveLoadQuote, type LiveLoad } from '../api/liveLoads';
import { supabase } from '../auth/supabase';
import { loadMarketplacePreferences, saveMarketplacePreferences, type MarketplacePreferences } from '../jobs/marketplacePreferences';
import { enqueueAction, isOnline, type QueuedAction } from '../offline/queue';
import { LiveLoadCard } from './LiveLoadCard';

type Feed = 'live' | 'pinned' | 'hidden';

const defaultPreferences: MarketplacePreferences = {
  savedJobIds: [],
  hiddenJobIds: [],
  destinationPriorityEnabled: true,
  destinationRadiusMiles: 10,
};

function SwipeCard({ job, pinned, onOpen, onQuote, onTogglePin, onHide }: { job: LiveLoad; pinned: boolean; onOpen: () => void; onQuote: () => void; onTogglePin: () => void; onHide: () => void }) {
  const translateX = useMemo(() => new Animated.Value(0), []);
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > 28 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.8,
    onPanResponderMove: (_event, gesture) => translateX.setValue(Math.max(-112, Math.min(112, gesture.dx * 0.82))),
    onPanResponderRelease: (_event, gesture) => {
      if (gesture.dx > 84 && Math.abs(gesture.vx) < 3.5) onTogglePin();
      if (gesture.dx < -84 && Math.abs(gesture.vx) < 3.5) onHide();
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
    },
    onPanResponderTerminate: () => Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start(),
  }), [onHide, onTogglePin, translateX]);
  return <View style={styles.swipeShell}>
    <View style={[styles.swipeAction, styles.pinAction]}><Text style={styles.swipeText}>{pinned ? 'UNPIN' : 'PIN'}</Text></View>
    <View style={[styles.swipeAction, styles.hideAction]}><Text style={styles.swipeText}>HIDE</Text></View>
    <Animated.View style={{ transform: [{ translateX }] }} {...pan.panHandlers}>
      <LiveLoadCard job={job} action={pinned ? 'PINNED' : 'QUOTE'} onOpen={onOpen} onAction={onQuote} />
    </Animated.View>
  </View>;
}

export function LiveLoadsScreen({ canCommercialBid, authUserId, onQuoteQueued }: { canCommercialBid?: boolean | null; authUserId?: string | null; onQuoteQueued?: (queued: QueuedAction) => void }) {
  const [feed, setFeed] = useState<Feed>('live');
  const [jobs, setJobs] = useState<LiveLoad[]>([]);
  const [preferences, setPreferences] = useState<MarketplacePreferences>(defaultPreferences);
  const [accountEmail, setAccountEmail] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [quoteJob, setQuoteJob] = useState<LiveLoad | null>(null);
  const [quoteAmount, setQuoteAmount] = useState('');
  const [quoteMessage, setQuoteMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadJobs = useCallback(async (nextPreferences: MarketplacePreferences) => {
    setRefreshing(true);
    setError('');
    try {
      const [result, quotedJobIds] = await Promise.all([
        fetchLiveLoads({ destinationMode: nextPreferences.destinationPriorityEnabled, radiusMiles: nextPreferences.destinationRadiusMiles }),
        fetchActiveQuotedJobIds(),
      ]);
      setJobs(result.jobs
        .filter((job) => !quotedJobIds.has(job.id))
        .map((job) => {
          if (canCommercialBid === false) {
            return {
              ...job,
              canQuote: false,
              quoteWarning: 'Your account type does not permit commercial bidding.',
            };
          }
          return job;
        }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load live jobs.');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      const email = data.session?.user?.email?.trim().toLowerCase() || '';
      const stored = await loadMarketplacePreferences(email);
      if (!active) return;
      setAccountEmail(email);
      setPreferences(stored);
      await loadJobs(stored);
    })();
    return () => { active = false; };
  }, [loadJobs]);

  const persistPreferences = useCallback((update: (current: MarketplacePreferences) => MarketplacePreferences) => {
    setPreferences((current) => {
      const next = update(current);
      void saveMarketplacePreferences(accountEmail, next);
      return next;
    });
  }, [accountEmail]);

  const togglePin = useCallback((jobId: string) => persistPreferences((current) => ({
    ...current,
    savedJobIds: current.savedJobIds.includes(jobId) ? current.savedJobIds.filter((id) => id !== jobId) : [...current.savedJobIds, jobId],
  })), [persistPreferences]);

  const hide = useCallback((jobId: string) => persistPreferences((current) => ({
    ...current,
    hiddenJobIds: current.hiddenJobIds.includes(jobId) ? current.hiddenJobIds : [...current.hiddenJobIds, jobId],
  })), [persistPreferences]);

  const restore = useCallback((jobId: string) => persistPreferences((current) => ({
    ...current,
    hiddenJobIds: current.hiddenJobIds.filter((id) => id !== jobId),
  })), [persistPreferences]);

  const openQuote = useCallback((job: LiveLoad) => {
    if (job.canQuote === false) {
      setError(job.quoteWarning || 'This load requires an eligibility check before quoting.');
      return;
    }
    setQuoteJob(job);
    // Pre-fill with proposed price if published so driver can accept or override
    setQuoteAmount(job.proposedPriceAmount != null ? String(job.proposedPriceAmount) : '');
    setQuoteMessage('');
  }, []);

  const submitQuote = useCallback(async () => {
    if (!quoteJob) return;
    const amount = Number(quoteAmount.replace(',', '.'));
    const bidKey = `bid-${quoteJob.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a valid quote amount.');
      return;
    }
    setSubmitting(true);
    setError('');
    // Attempt online submission first; fall back to offline queue when unavailable.
    const online = await isOnline();
    if (!online && authUserId) {
      try {
        const queued = await enqueueAction(authUserId, {
          jobId: quoteJob.id,
          endpoint: 'bid',
          payload: { amount, message: quoteMessage, bidKey },
        });
        setJobs((current) => current.filter((job) => job.id !== quoteJob.id));
        setQuoteJob(null);
        onQuoteQueued?.(queued);
        Alert.alert('Quote queued', 'You are offline. Your quote will be submitted when connectivity is restored.');
      } catch (queueError) {
        setError(queueError instanceof Error ? queueError.message : 'Unable to queue this quote.');
      } finally {
        setSubmitting(false);
      }
      return;
    }
    try {
      await submitLiveLoadQuote(quoteJob.id, amount, quoteMessage, bidKey);
      setJobs((current) => current.filter((job) => job.id !== quoteJob.id));
      setQuoteJob(null);
      Alert.alert('Quote sent', 'Your quote was submitted successfully.');
    } catch (quoteError) {
      // If the online attempt fails due to a network error and authUserId is available, enqueue.
      const isNetworkError = quoteError instanceof Error && (
        quoteError.message.includes('network') ||
        quoteError.message.includes('fetch') ||
        quoteError.message.includes('timeout') ||
        quoteError.message.includes('offline')
      );
      if (isNetworkError && authUserId) {
        try {
          const queued = await enqueueAction(authUserId, {
            jobId: quoteJob.id,
            endpoint: 'bid',
            payload: { amount, message: quoteMessage, bidKey },
          });
          setJobs((current) => current.filter((job) => job.id !== quoteJob.id));
          setQuoteJob(null);
          onQuoteQueued?.(queued);
          Alert.alert('Quote queued', 'Network error. Your quote has been saved and will sync automatically.');
        } catch (queueFallbackError) {
          setError(queueFallbackError instanceof Error ? queueFallbackError.message : 'Unable to submit or queue this quote.');
        }
      } else {
        setError(quoteError instanceof Error ? quoteError.message : 'Unable to submit this quote.');
      }
    } finally {
      setSubmitting(false);
    }
  }, [authUserId, onQuoteQueued, quoteAmount, quoteJob, quoteMessage]);

  const visible = jobs.filter((job) => !preferences.hiddenJobIds.includes(job.id));
  const displayed = feed === 'pinned'
    ? visible.filter((job) => preferences.savedJobIds.includes(job.id))
    : feed === 'hidden'
      ? jobs.filter((job) => preferences.hiddenJobIds.includes(job.id))
      : visible;

  return <View style={styles.screen}>
    <View><Text style={styles.title}>Live Loads</Text><Text style={styles.brand}>XDRIVE</Text></View>
    <View style={styles.tabs}>
      {([['live', `Live (${visible.length})`], ['pinned', `Pinned (${preferences.savedJobIds.length})`], ['hidden', `Hidden (${preferences.hiddenJobIds.length})`]] as Array<[Feed, string]>).map(([key, label]) => (
        <TouchableOpacity key={key} style={[styles.tab, feed === key && styles.activeTab]} onPress={() => setFeed(key)}><Text style={[styles.tabText, feed === key && styles.activeTabText]}>{label}</Text></TouchableOpacity>
      ))}
    </View>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {quoteJob ? <View style={styles.quotePanel}>
      <Text style={styles.quoteTitle}>{quoteJob.reference}: {quoteJob.pickupLocation} to {quoteJob.deliveryLocation}</Text>
      {quoteJob.publicPricePublished && quoteJob.proposedPriceAmount != null && (
        <>
          <Text style={styles.proposedPrice}>Proposed price: {quoteJob.price} — accept or enter your own</Text>
          <TouchableOpacity style={styles.acceptButton} onPress={() => setQuoteAmount(String(quoteJob.proposedPriceAmount))} disabled={submitting}>
            <Text style={styles.acceptButtonText}>ACCEPT PROPOSED ({quoteJob.price})</Text>
          </TouchableOpacity>
        </>
      )}
      <TextInput value={quoteAmount} onChangeText={setQuoteAmount} keyboardType="decimal-pad" placeholder="Quote amount (GBP)" placeholderTextColor="#6b7280" style={styles.input} />
      <TextInput value={quoteMessage} onChangeText={setQuoteMessage} placeholder="Message to customer (optional)" placeholderTextColor="#6b7280" style={[styles.input, styles.messageInput]} multiline />
      <View style={styles.quoteActions}>
        <TouchableOpacity style={styles.cancelButton} onPress={() => setQuoteJob(null)} disabled={submitting}><Text style={styles.cancelText}>CANCEL</Text></TouchableOpacity>
        <TouchableOpacity style={styles.submitButton} onPress={() => void submitQuote()} disabled={submitting}><Text style={styles.submitText}>{submitting ? 'SENDING...' : 'SUBMIT QUOTE'}</Text></TouchableOpacity>
      </View>
    </View> : null}
    <ScrollView contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadJobs(preferences)} tintColor="#ffc107" colors={['#ffc107']} />}>
      {displayed.length === 0 ? <Text style={styles.empty}>No loads in this section.</Text> : displayed.map((job) => feed === 'hidden'
        ? <LiveLoadCard key={job.id} job={job} action="RESTORE" onOpen={() => openQuote(job)} onAction={() => restore(job.id)} />
        : <SwipeCard key={job.id} job={job} pinned={preferences.savedJobIds.includes(job.id)} onOpen={() => openQuote(job)} onQuote={() => openQuote(job)} onTogglePin={() => togglePin(job.id)} onHide={() => hide(job.id)} />)}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#071018', paddingHorizontal: 16, paddingTop: 12, gap: 16 },
  title: { color: '#f8fafc', fontSize: 28, fontWeight: '900' },
  brand: { color: '#ffc107', fontSize: 13, fontWeight: '900', letterSpacing: 2.4, marginTop: 2 },
  tabs: { flexDirection: 'row', backgroundColor: '#0d1a24', borderColor: '#1f2937', borderWidth: 1, borderRadius: 16, padding: 4 },
  tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  activeTab: { backgroundColor: '#ffc107' },
  tabText: { color: '#9ca3af', fontWeight: '800', fontSize: 13 },
  activeTabText: { color: '#111827' },
  error: { color: '#fca5a5', backgroundColor: '#3f151b', borderRadius: 10, padding: 10, fontWeight: '700' },
  quotePanel: { backgroundColor: '#0d1a24', borderColor: '#1f2937', borderWidth: 1, borderRadius: 14, padding: 12, gap: 10 },
  quoteTitle: { color: '#f8fafc', fontSize: 14, fontWeight: '800' },
  proposedPrice: { color: '#4ade80', fontSize: 13, fontWeight: '700' },
  acceptButton: { backgroundColor: '#14532d', borderColor: '#16a34a', borderWidth: 1, borderRadius: 10, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  acceptButtonText: { color: '#4ade80', fontWeight: '900', fontSize: 13, letterSpacing: 0.4 },
  input: { minHeight: 48, color: '#f8fafc', backgroundColor: '#111827', borderColor: '#1f2937', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12 },
  messageInput: { minHeight: 76, paddingTop: 12, textAlignVertical: 'top' },
  quoteActions: { flexDirection: 'row', gap: 10 },
  cancelButton: { flex: 1, minHeight: 46, borderColor: '#334155', borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: '#cbd5e1', fontWeight: '900' },
  submitButton: { flex: 2, minHeight: 46, backgroundColor: '#ffc107', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: '#111827', fontWeight: '900' },
  list: { gap: 14, paddingBottom: 110 },
  empty: { color: '#9ca3af', textAlign: 'center', marginTop: 40 },
  swipeShell: { position: 'relative', borderRadius: 18, overflow: 'hidden', backgroundColor: '#08131f' },
  swipeAction: { position: 'absolute', top: 0, bottom: 0, width: 110, alignItems: 'center', justifyContent: 'center' },
  pinAction: { left: 0, backgroundColor: '#3b82f6' },
  hideAction: { right: 0, backgroundColor: '#ef4444' },
  swipeText: { color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 0.8 },
});
