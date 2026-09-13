import { useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Animated, PanResponder, StyleSheet } from 'react-native';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from '../theme/primitives';
import { UiIcon } from '../components/UiIcon';
import type { DriverJob } from '../types/driver';
import { formatDeliveryDate } from '../utils/format';
import { shadow } from '../theme/tokens';

type Feed = 'inbox' | 'saved' | 'deleted';
type Preferences = { savedJobIds: string[]; hiddenJobIds: string[] };

const emptyPreferences: Preferences = { savedJobIds: [], hiddenJobIds: [] };
const swipeWidth = 72;

function storageKey(accountKey: string) {
  return `xdrive:alerts:${accountKey.trim().toLowerCase() || 'anonymous'}`;
}

function normalizePreferences(value: unknown): Preferences {
  if (!value || typeof value !== 'object') return emptyPreferences;
  const input = value as Partial<Preferences>;
  return {
    savedJobIds: Array.isArray(input.savedJobIds) ? [...new Set(input.savedJobIds.map(String))] : [],
    hiddenJobIds: Array.isArray(input.hiddenJobIds) ? [...new Set(input.hiddenJobIds.map(String))] : [],
  };
}

function tagList(job: DriverJob) {
  const tags = ['NEW'];
  if (job.serviceMode) tags.push(job.serviceMode.replace(/[_-]+/g, ' ').toUpperCase());
  for (const badge of job.badges ?? []) {
    const normalized = String(badge).trim().toUpperCase();
    if (normalized && !tags.includes(normalized) && /HOTSHOT|SMARTPAY/.test(normalized)) tags.push(normalized);
  }
  if (job.directDeliveryRequired && !tags.includes('DIRECT')) tags.push('DIRECT');
  return tags.slice(0, 4);
}

export function LoadsScreen({ jobs, loading, accountKey = 'device', onRefresh, onOpen }: {
  jobs: DriverJob[];
  loading: boolean;
  accountKey?: string;
  onRefresh: () => void;
  onOpen: (job: DriverJob) => void;
}) {
  const [feed, setFeed] = useState<Feed>('inbox');
  const [preferences, setPreferences] = useState<Preferences>(emptyPreferences);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    setReady(false);
    AsyncStorage.getItem(storageKey(accountKey)).then((stored) => {
      if (!mounted) return;
      if (!stored) setPreferences(emptyPreferences);
      else {
        try { setPreferences(normalizePreferences(JSON.parse(stored))); }
        catch { setPreferences(emptyPreferences); }
      }
    }).catch(() => mounted && setPreferences(emptyPreferences)).finally(() => mounted && setReady(true));
    return () => { mounted = false; };
  }, [accountKey]);

  async function persist(next: Preferences) {
    setPreferences(next);
    await AsyncStorage.setItem(storageKey(accountKey), JSON.stringify(next)).catch(() => undefined);
  }

  function toggleSaved(jobId: string) {
    const saved = new Set(preferences.savedJobIds);
    const hidden = new Set(preferences.hiddenJobIds);
    hidden.delete(jobId);
    if (saved.has(jobId)) saved.delete(jobId); else saved.add(jobId);
    void persist({ savedJobIds: [...saved], hiddenJobIds: [...hidden] });
  }

  function toggleHidden(jobId: string) {
    const saved = new Set(preferences.savedJobIds);
    const hidden = new Set(preferences.hiddenJobIds);
    saved.delete(jobId);
    if (hidden.has(jobId)) hidden.delete(jobId); else hidden.add(jobId);
    void persist({ savedJobIds: [...saved], hiddenJobIds: [...hidden] });
  }

  const visibleJobs = useMemo(() => jobs.filter((job) => {
    const saved = preferences.savedJobIds.includes(job.id);
    const hidden = preferences.hiddenJobIds.includes(job.id);
    if (feed === 'saved') return saved && !hidden;
    if (feed === 'deleted') return hidden;
    return !hidden;
  }), [feed, jobs, preferences.hiddenJobIds, preferences.savedJobIds]);

  return <View style={styles.page}>
    <View style={styles.header}>
      <Text style={styles.brand}><Text style={styles.brandX}>X</Text>Drive</Text>
      <View style={styles.segmented}>
        {([
          ['inbox', 'Inbox'],
          ['saved', 'Saved'],
          ['deleted', 'Deleted'],
        ] as const).map(([key, label]) => {
          const selected = feed === key;
          return <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => setFeed(key)} style={[styles.segment, selected && styles.segmentActive]}>
            <Text style={[styles.segmentText, selected && styles.segmentTextActive]}>{label}</Text>
          </Pressable>;
        })}
        <View style={styles.segmentDivider} />
        <View style={styles.mapButton}><UiIcon name="location" size={21} color="#FFFFFF" /></View>
      </View>
    </View>

    <ScrollView
      style={styles.list}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor="#292837" colors={['#292837']} />}
      showsVerticalScrollIndicator={false}
    >
      {!ready || loading && jobs.length === 0 ? <View style={styles.loadingCard}><ActivityIndicator size="small" color="#292837" /><Text style={styles.loadingText}>Loading XDrive alerts…</Text></View> : null}
      {ready && !visibleJobs.length ? <View style={styles.empty}>
        <Text style={styles.emptyTitle}>{feed === 'inbox' ? 'No new load alerts' : feed === 'saved' ? 'No saved loads' : 'No deleted loads'}</Text>
        <Text style={styles.emptyText}>{feed === 'inbox' ? 'Pull down to refresh available work.' : feed === 'saved' ? 'Swipe right on an Inbox load to save it.' : 'Swipe left on an Inbox load to delete it. Deleted loads can be restored here.'}</Text>
      </View> : null}
      {visibleJobs.map((job) => <SwipeAlertCard
        key={job.id}
        job={job}
        saved={preferences.savedJobIds.includes(job.id)}
        deleted={preferences.hiddenJobIds.includes(job.id)}
        onOpen={() => onOpen(job)}
        onSave={() => toggleSaved(job.id)}
        onDelete={() => toggleHidden(job.id)}
      />)}
    </ScrollView>
  </View>;
}

function SwipeAlertCard({ job, saved, deleted, onOpen, onSave, onDelete }: {
  job: DriverJob;
  saved: boolean;
  deleted: boolean;
  onOpen: () => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  const x = useRef(new Animated.Value(0)).current;
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2,
    onPanResponderMove: (_event, gesture) => x.setValue(Math.max(-swipeWidth, Math.min(swipeWidth, gesture.dx))),
    onPanResponderRelease: (_event, gesture) => {
      const target = gesture.dx < -44 ? -swipeWidth : gesture.dx > 44 ? swipeWidth : 0;
      Animated.spring(x, { toValue: target, useNativeDriver: true, speed: 24, bounciness: 0 }).start();
    },
    onPanResponderTerminate: () => Animated.spring(x, { toValue: 0, useNativeDriver: true, speed: 24, bounciness: 0 }).start(),
  }), [x]);

  function act(action: () => void) {
    action();
    Animated.spring(x, { toValue: 0, useNativeDriver: true, speed: 24, bounciness: 0 }).start();
  }

  return <View style={styles.swipeShell}>
    <View style={styles.swipeActions}>
      <Pressable accessibilityRole="button" accessibilityLabel={saved ? 'Remove from saved' : 'Save load'} onPress={() => act(onSave)} style={styles.saveAction}><UiIcon name={saved ? 'bookmark' : 'bookmark-outline'} size={23} color="#FFFFFF" /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={deleted ? 'Restore load' : 'Delete load'} onPress={() => act(onDelete)} style={styles.deleteAction}><UiIcon name={deleted ? 'refresh' : 'trash'} size={22} color="#FFFFFF" /></Pressable>
    </View>
    <Animated.View style={[styles.swipeCard, { transform: [{ translateX: x }] }]} {...pan.panHandlers}>
      <AlertCard job={job} onOpen={onOpen} />
    </Animated.View>
  </View>;
}

function AlertCard({ job, onOpen }: { job: DriverJob; onOpen: () => void }) {
  const tags = tagList(job);
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open load ${job.reference}`} onPress={onOpen} style={({ pressed }) => [styles.cardMain, pressed && styles.pressed]}>
    <Text style={styles.company} numberOfLines={2}>{job.postingCompanyName || 'XDrive Load'}{job.postingCompanyMemberCode ? ` (${job.postingCompanyMemberCode})` : ''}</Text>
    <Text style={styles.metaLine}>{job.postedAt ? `${formatDeliveryDate(job.postedAt)} | ` : ''}{job.vehicleRequirement || 'Vehicle'} | Driver current location</Text>
    <View style={styles.tags}>{tags.map((tag) => <View key={tag} style={[styles.tag, tag === 'NEW' ? styles.tagNew : /SMARTPAY|DIRECT/.test(tag) ? styles.tagGreen : styles.tagBlue]}><Text style={[styles.tagText, tag === 'NEW' ? styles.tagTextNew : /SMARTPAY|DIRECT/.test(tag) && styles.tagTextWhite]}>{tag}</Text></View>)}</View>
    <View style={styles.routeBox}>
      <View style={styles.routeRail}>
        <View style={styles.stopSquare}><Text style={styles.stopNumber}>1</Text></View>
        <View style={styles.routeLine} />
        <View style={styles.stopPin}><Text style={styles.stopNumber}>2</Text></View>
      </View>
      <View style={styles.routeCopy}>
        <View><Text style={styles.place} numberOfLines={1}>{job.pickupLocation}</Text><Text style={styles.routeTime}>{formatDeliveryDate(job.pickupTime)}</Text></View>
        <View><Text style={styles.place} numberOfLines={1}>{job.deliveryLocation}</Text><Text style={styles.routeTime}>{formatDeliveryDate(job.deliveryTime)}</Text></View>
      </View>
    </View>
    {job.dimensions ? <Text style={styles.freightMeta}>Dimensions: {job.dimensions}</Text> : null}
    {job.weight ? <Text style={styles.freightMeta}>Weight: {job.weight}</Text> : null}
    {!job.dimensions && !job.weight && job.cargoType ? <Text style={styles.freightMeta} numberOfLines={2}>{job.cargoType}</Text> : null}
    <View style={styles.quoteButton}><Text style={styles.quoteText}>Quote</Text></View>
  </Pressable>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F2F3F7' },
  header: { backgroundColor: '#292837', paddingHorizontal: 12, paddingTop: 7, paddingBottom: 11 },
  brand: { textAlign: 'center', marginBottom: 7, fontFamily: 'Inter_600SemiBold', fontSize: 20, color: '#FFFFFF' },
  brandX: { color: '#FFD200', fontFamily: 'Inter_700Bold' },
  segmented: { minHeight: 46, borderRadius: 23, backgroundColor: '#3A3949', flexDirection: 'row', alignItems: 'center', padding: 3 },
  segment: { flex: 1, minHeight: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: '#FFE66A' },
  segmentText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#FFFFFF' },
  segmentTextActive: { fontFamily: 'Inter_700Bold', color: '#111111' },
  segmentDivider: { width: 1, height: 28, backgroundColor: '#626172' },
  mapButton: { width: 45, height: 40, alignItems: 'center', justifyContent: 'center' },
  list: { flex: 1 },
  content: { padding: 12, gap: 10, paddingBottom: 24 },
  loadingCard: { minHeight: 80, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', gap: 8 },
  loadingText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#656473' },
  empty: { borderRadius: 14, backgroundColor: '#FFFFFF', padding: 22, alignItems: 'center' },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#292837' },
  emptyText: { marginTop: 6, fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 18, color: '#747381', textAlign: 'center' },
  swipeShell: { position: 'relative', borderRadius: 14, overflow: 'hidden' },
  swipeActions: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'stretch' },
  saveAction: { width: swipeWidth, backgroundColor: '#E0A500', alignItems: 'center', justifyContent: 'center' },
  deleteAction: { width: swipeWidth, backgroundColor: '#E4545C', alignItems: 'center', justifyContent: 'center' },
  swipeCard: { backgroundColor: '#FFFFFF', borderRadius: 14, ...shadow },
  cardMain: { padding: 12, gap: 8 },
  pressed: { opacity: 0.78 },
  company: { fontFamily: 'Inter_700Bold', fontSize: 14, lineHeight: 19, color: '#41414F', paddingRight: 4 },
  metaLine: { fontFamily: 'Inter_500Medium', fontSize: 10, color: '#777684' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  tag: { borderRadius: 5, paddingHorizontal: 7, paddingVertical: 4 },
  tagNew: { backgroundColor: '#E8F6E5' },
  tagBlue: { backgroundColor: '#E8F2FB' },
  tagGreen: { backgroundColor: '#4CAD3F' },
  tagText: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: .2, color: '#2473B7' },
  tagTextNew: { color: '#2D7B31' },
  tagTextWhite: { color: '#FFFFFF' },
  routeBox: { flexDirection: 'row', borderWidth: 1, borderColor: '#E1E2E7', borderRadius: 10, padding: 10, gap: 9 },
  routeRail: { width: 27, alignItems: 'center', justifyContent: 'space-between' },
  stopSquare: { width: 25, height: 25, borderRadius: 3, backgroundColor: '#5199D6', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  stopPin: { width: 25, height: 28, borderRadius: 14, borderBottomLeftRadius: 4, backgroundColor: '#5199D6', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  stopNumber: { fontFamily: 'Inter_700Bold', fontSize: 11, color: '#FFFFFF' },
  routeLine: { width: 1, flex: 1, minHeight: 20, backgroundColor: '#CED3DA' },
  routeCopy: { flex: 1, justifyContent: 'space-between', gap: 12 },
  place: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#41414F' },
  routeTime: { marginTop: 2, fontFamily: 'Inter_500Medium', fontSize: 10, color: '#777684' },
  freightMeta: { fontFamily: 'Inter_500Medium', fontSize: 11, color: '#777684' },
  quoteButton: { minHeight: 42, borderRadius: 21, backgroundColor: '#FFD200', alignItems: 'center', justifyContent: 'center' },
  quoteText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#111111' },
});