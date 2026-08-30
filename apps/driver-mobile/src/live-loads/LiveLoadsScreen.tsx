import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Animated, PanResponder, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { fetchActiveQuotedJobIds, fetchLiveLoads, submitLiveLoadQuote, type LiveLoad } from '../api/liveLoads';
import { supabase } from '../auth/supabase';
import { loadMarketplacePreferences, saveMarketplacePreferences, type MarketplacePreferences } from '../jobs/marketplacePreferences';
import {
  buildQuoteMessage,
  computeStructuredExtras,
  computeSubtotal,
  computeTotal,
  DEFAULT_LINE_ITEMS,
  parseNum,
  SUPPORTED_CURRENCY,
  validateQuote,
  type QuoteLineItems,
} from '../jobs/quoteHelpers';
import { LiveLoadCard } from './LiveLoadCard';

type Feed = 'live' | 'pinned' | 'hidden';

const defaultPreferences: MarketplacePreferences = {
  savedJobIds: [],
  hiddenJobIds: [],
  destinationPriorityEnabled: true,
  destinationRadiusMiles: 10,
};

function numericInput(label: string, value: string, onChange: (v: string) => void, disabled: boolean) {
  return (
    <View style={styles.lineRow} key={label}>
      <Text style={styles.lineLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        placeholder="0.00"
        placeholderTextColor="#6b7280"
        style={[styles.lineInput, disabled && styles.inputDisabled]}
        editable={!disabled}
      />
    </View>
  );
}

function QuotePanel({ job, onCancel, onSubmit, submitting }: {
  job: LiveLoad;
  onCancel: () => void;
  onSubmit: (items: QuoteLineItems) => void;
  submitting: boolean;
}) {
  const [items, setItems] = useState<QuoteLineItems>({
    ...DEFAULT_LINE_ITEMS,
    amount: job.proposedPriceAmount != null ? String(job.proposedPriceAmount) : '',
  });

  const set = (key: keyof QuoteLineItems, value: string | boolean) =>
    setItems((current) => ({ ...current, [key]: value }));

  const total = computeTotal(items);
  const canSubmit = !submitting && parseNum(items.amount) > 0;

  return (
    <View style={styles.quotePanel}>
      <Text style={styles.quoteTitle}>{job.reference}: {job.pickupLocation} → {job.deliveryLocation}</Text>
      {job.publicPricePublished && job.proposedPriceAmount != null && (
        <>
          <Text style={styles.proposedPrice}>Proposed: {job.price} — accept or enter your own</Text>
          <TouchableOpacity style={styles.acceptButton} onPress={() => set('amount', String(job.proposedPriceAmount))} disabled={submitting}>
            <Text style={styles.acceptButtonText}>ACCEPT PROPOSED ({job.price})</Text>
          </TouchableOpacity>
        </>
      )}

      <View style={styles.lineRow}>
        <Text style={styles.lineLabel}>Currency</Text>
        <Text style={styles.currencyFixed}>{SUPPORTED_CURRENCY}</Text>
      </View>

      {numericInput('Quote Amount *', items.amount, (v) => set('amount', v), submitting)}
      {numericInput('Additional Extras', items.extras, (v) => set('extras', v), submitting)}
      {numericInput('Waiting Time', items.waitingTime, (v) => set('waitingTime', v), submitting)}
      {numericInput('Tolls', items.tolls, (v) => set('tolls', v), submitting)}
      {numericInput('Ferry', items.ferry, (v) => set('ferry', v), submitting)}
      {numericInput('Overnight Charges', items.overnight, (v) => set('overnight', v), submitting)}
      {numericInput('Parking Charges', items.parking, (v) => set('parking', v), submitting)}
      {numericInput('Congestion Charges', items.congestion, (v) => set('congestion', v), submitting)}

      <View style={styles.lineRow}>
        <Text style={styles.lineLabel}>Collect within (min)</Text>
        <TextInput
          value={items.collectWithinMinutes}
          onChangeText={(v) => set('collectWithinMinutes', v)}
          keyboardType="number-pad"
          placeholder="e.g. 30"
          placeholderTextColor="#6b7280"
          style={[styles.lineInput, submitting && styles.inputDisabled]}
          editable={!submitting}
        />
      </View>

      <View style={styles.lineRow}>
        <Text style={styles.lineLabel}>Est. Collection Time</Text>
        <TextInput
          value={items.estimatedCollectionTime}
          onChangeText={(v) => set('estimatedCollectionTime', v)}
          placeholder="e.g. 09:00"
          placeholderTextColor="#6b7280"
          style={[styles.lineInput, submitting && styles.inputDisabled]}
          editable={!submitting}
        />
      </View>

      <TextInput
        value={items.driverNotes}
        onChangeText={(v) => set('driverNotes', v)}
        placeholder="Driver notes (optional)"
        placeholderTextColor="#6b7280"
        style={[styles.input, styles.messageInput, submitting && styles.inputDisabled]}
        multiline
        editable={!submitting}
      />

      <TouchableOpacity style={styles.vatRow} onPress={() => set('vatEnabled', !items.vatEnabled)} disabled={submitting}>
        <View style={[styles.vatCheck, items.vatEnabled && styles.vatCheckActive]}>
          {items.vatEnabled ? <Text style={styles.vatCheckMark}>✓</Text> : null}
        </View>
        <Text style={styles.vatLabel}>Apply VAT (20%)</Text>
      </TouchableOpacity>

      {items.vatEnabled && (
        <>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>SUBTOTAL</Text>
            <Text style={styles.totalValue}>{SUPPORTED_CURRENCY} {computeSubtotal(items).toFixed(2)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>VAT (20%)</Text>
            <Text style={styles.totalValue}>{SUPPORTED_CURRENCY} {(total - computeSubtotal(items)).toFixed(2)}</Text>
          </View>
        </>
      )}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>TOTAL</Text>
        <Text style={styles.totalValue}>{SUPPORTED_CURRENCY} {total.toFixed(2)}</Text>
      </View>

      <View style={styles.quoteActions}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel} disabled={submitting}><Text style={styles.cancelText}>CANCEL</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.submitButton, !canSubmit && styles.submitDisabled]} onPress={() => onSubmit(items)} disabled={!canSubmit}>
          <Text style={styles.submitText}>{submitting ? 'SENDING...' : 'SUBMIT QUOTE'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

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
      <LiveLoadCard job={job} onOpen={onOpen} onQuote={onQuote} />
    </Animated.View>
  </View>;
}

function RestoreCard({ job, onRestore }: { job: LiveLoad; onRestore: () => void }) {
  return (
    <View style={styles.restoreCard}>
      <Text style={styles.restoreRef} numberOfLines={1}>{job.reference}</Text>
      <Text style={styles.restoreRoute} numberOfLines={1}>{job.pickupLocation} → {job.deliveryLocation}</Text>
      <TouchableOpacity style={styles.restoreButton} onPress={onRestore} accessibilityRole="button" accessibilityLabel="Restore hidden job">
        <Text style={styles.restoreButtonText}>RESTORE</Text>
      </TouchableOpacity>
    </View>
  );
}

export function LiveLoadsScreen({ canCommercialBid }: { canCommercialBid?: boolean | null }) {
  const [feed, setFeed] = useState<Feed>('live');
  const [jobs, setJobs] = useState<LiveLoad[]>([]);
  const [preferences, setPreferences] = useState<MarketplacePreferences>(defaultPreferences);
  const [accountEmail, setAccountEmail] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [quoteJob, setQuoteJob] = useState<LiveLoad | null>(null);
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
  }, [canCommercialBid]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const email = data.session?.user?.email?.trim().toLowerCase() || '';
        const stored = await loadMarketplacePreferences(email);
        if (!active) return;
        setAccountEmail(email);
        setPreferences(stored);
        await loadJobs(stored);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to initialize live loads.');
      }
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
  }, []);

  const handleSubmitQuote = useCallback(async (items: QuoteLineItems) => {
    if (!quoteJob) return;
    const validationError = validateQuote(items);
    if (validationError) {
      setError(validationError);
      return;
    }
    const total = computeTotal(items);
    const baseAmount = parseNum(items.amount);
    const additionalExtrasGbp = computeStructuredExtras(items);
    const collectWithinMinutes = items.collectWithinMinutes.trim()
      ? Number(items.collectWithinMinutes)
      : null;
    const message = buildQuoteMessage(items);
    setSubmitting(true);
    setError('');
    try {
      await submitLiveLoadQuote(quoteJob.id, {
        totalAmount: total,
        baseAmount,
        additionalExtrasGbp,
        collectWithinMinutes,
        message: message || undefined,
      });
      setJobs((current) => current.filter((job) => job.id !== quoteJob.id));
      setQuoteJob(null);
      Alert.alert('Quote sent', 'Your quote was submitted successfully.');
    } catch (quoteError) {
      setError(quoteError instanceof Error ? quoteError.message : 'Unable to submit this quote.');
    } finally {
      setSubmitting(false);
    }
  }, [quoteJob]);

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
    {quoteJob ? (
      <QuotePanel job={quoteJob} onCancel={() => setQuoteJob(null)} onSubmit={(items) => void handleSubmitQuote(items)} submitting={submitting} />
    ) : null}
    <ScrollView contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadJobs(preferences)} tintColor="#ffc107" colors={['#ffc107']} />}>
      {displayed.length === 0 ? <Text style={styles.empty}>No loads in this section.</Text> : displayed.map((job) => feed === 'hidden'
        ? <RestoreCard key={job.id} job={job} onRestore={() => restore(job.id)} />
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
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lineLabel: { flex: 1, color: '#9ca3af', fontSize: 13, fontWeight: '700' },
  lineInput: { width: 110, minHeight: 44, color: '#f8fafc', backgroundColor: '#111827', borderColor: '#1f2937', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, textAlign: 'right' },
  currencyRow: { flexDirection: 'row', gap: 6 },
  currencyChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#111827', borderColor: '#1f2937', borderWidth: 1 },
  currencyChipActive: { backgroundColor: '#ffc107', borderColor: '#ffc107' },
  currencyChipText: { color: '#9ca3af', fontWeight: '800', fontSize: 13 },
  currencyChipTextActive: { color: '#111827' },
  currencyFixed: { color: '#ffc107', fontWeight: '900', fontSize: 14, letterSpacing: 0.5 },
  vatRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  vatCheck: { width: 22, height: 22, borderRadius: 6, borderColor: '#374151', borderWidth: 2, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' },
  vatCheckActive: { backgroundColor: '#ffc107', borderColor: '#ffc107' },
  vatCheckMark: { color: '#111827', fontWeight: '900', fontSize: 14, lineHeight: 16 },
  vatLabel: { color: '#f8fafc', fontWeight: '700', fontSize: 14 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopColor: '#1f2937', borderTopWidth: 1, paddingTop: 10, marginTop: 4 },
  totalLabel: { color: '#9ca3af', fontWeight: '900', fontSize: 13, letterSpacing: 1 },
  totalValue: { color: '#ffc107', fontWeight: '900', fontSize: 20 },
  input: { minHeight: 48, color: '#f8fafc', backgroundColor: '#111827', borderColor: '#1f2937', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12 },
  messageInput: { minHeight: 76, paddingTop: 12, textAlignVertical: 'top' },
  inputDisabled: { opacity: 0.5 },
  quoteActions: { flexDirection: 'row', gap: 10 },
  cancelButton: { flex: 1, minHeight: 46, borderColor: '#334155', borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: '#cbd5e1', fontWeight: '900' },
  submitButton: { flex: 2, minHeight: 46, backgroundColor: '#ffc107', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  submitDisabled: { backgroundColor: '#9ca3af' },
  submitText: { color: '#111827', fontWeight: '900' },
  list: { gap: 14, paddingBottom: 110 },
  empty: { color: '#9ca3af', textAlign: 'center', marginTop: 40 },
  swipeShell: { position: 'relative', borderRadius: 18, overflow: 'hidden', backgroundColor: '#08131f' },
  swipeAction: { position: 'absolute', top: 0, bottom: 0, width: 110, alignItems: 'center', justifyContent: 'center' },
  pinAction: { left: 0, backgroundColor: '#3b82f6' },
  hideAction: { right: 0, backgroundColor: '#ef4444' },
  swipeText: { color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 0.8 },
  restoreCard: { backgroundColor: '#0d1a24', borderColor: '#1f2937', borderWidth: 1, borderRadius: 14, padding: 14, gap: 8 },
  restoreRef: { color: '#9ca3af', fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  restoreRoute: { color: '#f8fafc', fontSize: 14, fontWeight: '800' },
  restoreButton: { minHeight: 44, backgroundColor: '#1f2937', borderColor: '#374151', borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  restoreButtonText: { color: '#f8fafc', fontWeight: '900', fontSize: 13, letterSpacing: 0.6 },
});
