import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, PanResponder, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { fetchActiveQuotedJobIds, fetchLiveLoads, submitLiveLoadQuote, type LiveLoad } from '../api/liveLoads';
import { supabase } from '../auth/supabase';
import { loadMarketplacePreferences, saveMarketplacePreferences, type MarketplacePreferences } from '../jobs/marketplacePreferences';
import { enqueueAction, isOnline, type QueuedAction } from '../offline/queue';
import { buildDisplayedFeed, hideJobPreference, restoreJobPreference, togglePinPreference } from './liveLoadHelpers';
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

  return (
    <View style={styles.swipeShell}>
      <View style={[styles.swipeAction, styles.pinAction]}><Text style={styles.swipeText}>{pinned ? 'UNPIN' : 'PIN'}</Text></View>
      <View style={[styles.swipeAction, styles.hideAction]}><Text style={styles.swipeText}>HIDE</Text></View>
      <Animated.View style={{ transform: [{ translateX }] }} {...pan.panHandlers}>
        <LiveLoadCard job={job} action={pinned ? 'PINNED' : 'QUOTE'} onOpen={onOpen} onAction={onQuote} />
      </Animated.View>
    </View>
  );
}

export function LiveLoadsScreen({ canCommercialBid, authUserId, onQuoteQueued }: { canCommercialBid?: boolean | null; authUserId?: string | null; onQuoteQueued?: (queued: QueuedAction) => void }) {
  const [feed, setFeed] = useState<Feed>('live');
  const [jobs, setJobs] = useState<LiveLoad[]>([]);
  const [preferences, setPreferences] = useState<MarketplacePreferences>(defaultPreferences);
  const [accountEmail, setAccountEmail] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState('');
  const [quoteJob, setQuoteJob] = useState<LiveLoad | null>(null);
  const [quoteAmount, setQuoteAmount] = useState('');
  const [quoteMessage, setQuoteMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadJobs = useCallback(async (nextPreferences: MarketplacePreferences, search = '') => {
    setRefreshing(true);
    setError('');
    try {
      const [result, quotedJobIds] = await Promise.all([
        fetchLiveLoads({ destinationMode: nextPreferences.destinationPriorityEnabled, radiusMiles: nextPreferences.destinationRadiusMiles, search: search.trim() || undefined }),
        fetchActiveQuotedJobIds(),
      ]);
      setJobs(result.jobs
        .filter((job) => !quotedJobIds.has(job.id))
        .map((job) => canCommercialBid === false
          ? { ...job, canQuote: false, quoteWarning: 'Your account type does not permit commercial bidding.' }
          : job));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load live jobs.');
    } finally {
      setRefreshing(false);
      setHasLoaded(true);
    }
  }, [canCommercialBid]);

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
    return () => {
      active = false;
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [loadJobs]);

  const persistPreferences = useCallback((update: (current: MarketplacePreferences) => MarketplacePreferences) => {
    setPreferences((current) => {
      const next = update(current);
      void saveMarketplacePreferences(accountEmail, next);
      return next;
    });
  }, [accountEmail]);

  const onSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      void loadJobs(preferences, text);
    }, 400);
  }, [loadJobs, preferences]);

  const setRadius = useCallback((radius: 10 | 20 | 30) => {
    const next = { ...preferences, destinationRadiusMiles: radius };
    persistPreferences(() => next);
    void loadJobs(next, searchQuery);
  }, [loadJobs, persistPreferences, preferences, searchQuery]);

  const toggleDestinationMode = useCallback(() => {
    const next = { ...preferences, destinationPriorityEnabled: !preferences.destinationPriorityEnabled };
    persistPreferences(() => next);
    void loadJobs(next, searchQuery);
  }, [loadJobs, persistPreferences, preferences, searchQuery]);

  const togglePin = useCallback((jobId: string) => persistPreferences((current) => ({
    ...current,
    ...togglePinPreference(current, jobId),
  })), [persistPreferences]);

  const hide = useCallback((jobId: string) => persistPreferences((current) => ({
    ...current,
    ...hideJobPreference(current, jobId),
  })), [persistPreferences]);

  const restore = useCallback((jobId: string) => persistPreferences((current) => ({
    ...current,
    ...restoreJobPreference(current, jobId),
  })), [persistPreferences]);

  const openQuote = useCallback((job: LiveLoad) => {
    if (job.canQuote === false) {
      setError(job.quoteWarning || 'This load requires an eligibility check before quoting.');
      return;
    }
    setQuoteJob(job);
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
    const online = await isOnline();
    if (!online && authUserId) {
      try {
        const queued = await enqueueAction(authUserId, { jobId: quoteJob.id, endpoint: 'bid', payload: { amount, message: quoteMessage, bidKey } });
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
      const isNetworkError = quoteError instanceof Error && (
        quoteError.message.toLowerCase().includes('network') ||
        quoteError.message.toLowerCase().includes('fetch') ||
        quoteError.message.toLowerCase().includes('timeout') ||
        quoteError.message.toLowerCase().includes('offline')
      );
      if (isNetworkError && authUserId) {
        try {
          const queued = await enqueueAction(authUserId, { jobId: quoteJob.id, endpoint: 'bid', payload: { amount, message: quoteMessage, bidKey } });
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

  const displayed = buildDisplayedFeed(feed, jobs, preferences);
  const visibleCount = jobs.filter((job) => !preferences.hiddenJobIds.includes(job.id)).length;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>XDRIVE DRIVER</Text>
          <Text style={styles.title}>Live Loads</Text>
          <Text style={styles.subtitle}>{visibleCount} available load{visibleCount === 1 ? '' : 's'}</Text>
        </View>
        <TouchableOpacity
          style={[styles.filterToggle, showFilters && styles.filterToggleActive]}
          onPress={() => setShowFilters((value) => !value)}
          accessibilityRole="button"
          accessibilityLabel={showFilters ? 'Hide load filters' : 'Show load filters'}
        >
          <Text style={[styles.filterToggleText, showFilters && styles.filterToggleTextActive]}>{showFilters ? 'Close' : 'Filters'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        {([['live', `Live ${visibleCount}`], ['pinned', `Pinned ${preferences.savedJobIds.length}`], ['hidden', `Hidden ${preferences.hiddenJobIds.length}`]] as Array<[Feed, string]>).map(([key, label]) => (
          <TouchableOpacity key={key} style={[styles.tab, feed === key && styles.activeTab]} onPress={() => setFeed(key)} accessibilityRole="tab">
            <Text style={[styles.tabText, feed === key && styles.activeTabText]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {showFilters ? (
        <View style={styles.filterBar}>
          <TextInput
            value={searchQuery}
            onChangeText={onSearchChange}
            placeholder="Search location, postcode or freight"
            placeholderTextColor="#94a3b8"
            style={styles.searchInput}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Radius</Text>
            <View style={styles.radiusGroup}>
              {([10, 20, 30] as const).map((radius) => (
                <TouchableOpacity key={radius} style={[styles.radiusBtn, preferences.destinationRadiusMiles === radius && styles.radiusBtnActive]} onPress={() => setRadius(radius)}>
                  <Text style={[styles.radiusBtnText, preferences.destinationRadiusMiles === radius && styles.radiusBtnTextActive]}>{radius} mi</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <TouchableOpacity style={styles.modeToggle} onPress={toggleDestinationMode} accessibilityRole="switch" accessibilityState={{ checked: preferences.destinationPriorityEnabled }}>
            <View style={[styles.switchTrack, preferences.destinationPriorityEnabled && styles.switchTrackOn]}>
              <View style={[styles.switchThumb, preferences.destinationPriorityEnabled && styles.switchThumbOn]} />
            </View>
            <View style={styles.modeTextBlock}>
              <Text style={styles.modeTitle}>Destination priority</Text>
              <Text style={styles.modeDescription}>Show suitable backloads near your current delivery.</Text>
            </View>
          </TouchableOpacity>
        </View>
      ) : null}

      {error ? <View style={styles.errorBox}><Text style={styles.error}>{error}</Text></View> : null}

      {quoteJob ? (
        <View style={styles.quotePanel}>
          <View style={styles.quoteHeader}>
            <View style={styles.quoteHeadingBlock}>
              <Text style={styles.quoteEyebrow}>SEND A QUOTE</Text>
              <Text style={styles.quoteTitle}>{quoteJob.pickupLocation} → {quoteJob.deliveryLocation}</Text>
              <Text style={styles.quoteReference}>{quoteJob.reference}</Text>
            </View>
            <TouchableOpacity onPress={() => setQuoteJob(null)} disabled={submitting} accessibilityRole="button">
              <Text style={styles.closeQuote}>Close</Text>
            </TouchableOpacity>
          </View>
          {quoteJob.publicPricePublished && quoteJob.proposedPriceAmount != null ? (
            <TouchableOpacity style={styles.acceptButton} onPress={() => setQuoteAmount(String(quoteJob.proposedPriceAmount))} disabled={submitting}>
              <Text style={styles.acceptLabel}>Proposed price</Text>
              <Text style={styles.acceptButtonText}>{quoteJob.price}</Text>
            </TouchableOpacity>
          ) : null}
          <Text style={styles.inputLabel}>Your quote</Text>
          <TextInput value={quoteAmount} onChangeText={setQuoteAmount} keyboardType="decimal-pad" placeholder="Amount in GBP" placeholderTextColor="#94a3b8" style={styles.input} />
          <Text style={styles.inputLabel}>Message to customer</Text>
          <TextInput value={quoteMessage} onChangeText={setQuoteMessage} placeholder="Optional message" placeholderTextColor="#94a3b8" style={[styles.input, styles.messageInput]} multiline />
          <TouchableOpacity style={[styles.submitButton, submitting && styles.submitButtonDisabled]} onPress={() => void submitQuote()} disabled={submitting}>
            <Text style={styles.submitText}>{submitting ? 'Sending quote…' : 'Submit quote'}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadJobs(preferences, searchQuery)} tintColor="#f5a300" colors={['#f5a300']} />}
      >
        {!hasLoaded && refreshing ? (
          <View style={styles.stateCard}><ActivityIndicator size="large" color="#f5a300" /><Text style={styles.stateTitle}>Loading live loads</Text><Text style={styles.stateText}>Checking the marketplace for suitable work.</Text></View>
        ) : displayed.length === 0 ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>{feed === 'live' ? 'No live loads found' : feed === 'pinned' ? 'No pinned loads' : 'No hidden loads'}</Text>
            <Text style={styles.stateText}>{feed === 'live' ? 'Pull down to refresh or adjust your filters.' : feed === 'pinned' ? 'Swipe right on a load to save it here.' : 'Swipe left on a load to hide it.'}</Text>
          </View>
        ) : displayed.map((job) => feed === 'hidden'
          ? <LiveLoadCard key={job.id} job={job} action="RESTORE" onOpen={() => restore(job.id)} onAction={() => restore(job.id)} />
          : <SwipeCard key={job.id} job={job} pinned={preferences.savedJobIds.includes(job.id)} onOpen={() => openQuote(job)} onQuote={() => openQuote(job)} onTogglePin={() => togglePin(job.id)} onHide={() => hide(job.id)} />)}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f6f8', paddingHorizontal: 16, paddingTop: 14, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  eyebrow: { color: '#1d57d8', fontSize: 10, lineHeight: 14, fontWeight: '900', letterSpacing: 1.5 },
  title: { color: '#0f172a', fontSize: 28, lineHeight: 34, fontWeight: '900', marginTop: 1 },
  subtitle: { color: '#64748b', fontSize: 12, lineHeight: 17, fontWeight: '600', marginTop: 1 },
  filterToggle: { minWidth: 76, minHeight: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderWidth: 1, borderRadius: 12 },
  filterToggleActive: { backgroundColor: '#0b2f6b', borderColor: '#0b2f6b' },
  filterToggleText: { color: '#0b2f6b', fontWeight: '800', fontSize: 13 },
  filterToggleTextActive: { color: '#ffffff' },
  tabs: { flexDirection: 'row', backgroundColor: '#e8edf3', borderRadius: 14, padding: 4 },
  tab: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  activeTab: { backgroundColor: '#ffffff', shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  tabText: { color: '#64748b', fontWeight: '700', fontSize: 12 },
  activeTabText: { color: '#0b2f6b', fontWeight: '900' },
  filterBar: { backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderWidth: 1, borderRadius: 16, padding: 13, gap: 12 },
  searchInput: { minHeight: 46, color: '#0f172a', backgroundColor: '#f8fafc', borderColor: '#cbd5e1', borderWidth: 1, borderRadius: 11, paddingHorizontal: 12, fontSize: 14 },
  filterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  filterLabel: { color: '#334155', fontWeight: '800', fontSize: 13 },
  radiusGroup: { flexDirection: 'row', gap: 6 },
  radiusBtn: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 9, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#ffffff' },
  radiusBtnActive: { backgroundColor: '#0b2f6b', borderColor: '#0b2f6b' },
  radiusBtnText: { color: '#64748b', fontWeight: '800', fontSize: 12 },
  radiusBtnTextActive: { color: '#ffffff' },
  modeToggle: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingTop: 2 },
  switchTrack: { width: 42, height: 24, borderRadius: 12, backgroundColor: '#cbd5e1', padding: 3 },
  switchTrackOn: { backgroundColor: '#1d57d8' },
  switchThumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#ffffff' },
  switchThumbOn: { alignSelf: 'flex-end' },
  modeTextBlock: { flex: 1 },
  modeTitle: { color: '#334155', fontSize: 13, lineHeight: 17, fontWeight: '800' },
  modeDescription: { color: '#64748b', fontSize: 11, lineHeight: 16, fontWeight: '500' },
  errorBox: { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 12, padding: 11 },
  error: { color: '#991b1b', fontWeight: '700', fontSize: 12, lineHeight: 17 },
  quotePanel: { backgroundColor: '#ffffff', borderColor: '#dbe3ee', borderWidth: 1, borderRadius: 17, padding: 14, gap: 9, shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  quoteHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  quoteHeadingBlock: { flex: 1, minWidth: 0 },
  quoteEyebrow: { color: '#1d57d8', fontSize: 10, lineHeight: 14, fontWeight: '900', letterSpacing: 1.1 },
  quoteTitle: { color: '#0f172a', fontSize: 15, lineHeight: 20, fontWeight: '800', marginTop: 2 },
  quoteReference: { color: '#94a3b8', fontSize: 10, lineHeight: 14, fontWeight: '600', marginTop: 2 },
  closeQuote: { color: '#64748b', fontSize: 12, lineHeight: 17, fontWeight: '800' },
  acceptButton: { backgroundColor: '#ecfdf5', borderColor: '#bbf7d0', borderWidth: 1, borderRadius: 11, minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  acceptLabel: { color: '#166534', fontWeight: '700', fontSize: 12 },
  acceptButtonText: { color: '#166534', fontWeight: '900', fontSize: 17 },
  inputLabel: { color: '#475569', fontSize: 11, lineHeight: 15, fontWeight: '800', marginTop: 2 },
  input: { minHeight: 48, color: '#0f172a', backgroundColor: '#f8fafc', borderColor: '#cbd5e1', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12 },
  messageInput: { minHeight: 72, paddingTop: 12, textAlignVertical: 'top' },
  submitButton: { minHeight: 50, backgroundColor: '#f5a300', borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 3 },
  submitButtonDisabled: { opacity: 0.65 },
  submitText: { color: '#0f172a', fontWeight: '900', fontSize: 15 },
  list: { gap: 14, paddingBottom: 110 },
  stateCard: { minHeight: 190, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderWidth: 1, borderRadius: 18, padding: 24, gap: 8 },
  stateTitle: { color: '#0f172a', textAlign: 'center', fontSize: 16, lineHeight: 21, fontWeight: '800' },
  stateText: { color: '#64748b', textAlign: 'center', fontSize: 12, lineHeight: 18, fontWeight: '500' },
  swipeShell: { position: 'relative', borderRadius: 18, overflow: 'hidden', backgroundColor: '#e2e8f0' },
  swipeAction: { position: 'absolute', top: 0, bottom: 0, width: 110, alignItems: 'center', justifyContent: 'center' },
  pinAction: { left: 0, backgroundColor: '#1d57d8' },
  hideAction: { right: 0, backgroundColor: '#dc2626' },
  swipeText: { color: '#ffffff', fontWeight: '900', fontSize: 13, letterSpacing: 0.6 },
});
