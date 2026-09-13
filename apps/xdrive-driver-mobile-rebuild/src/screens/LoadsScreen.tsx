import { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StyleSheet } from 'react-native';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from '../theme/primitives';
import { UiIcon } from '../components/UiIcon';
import type { DriverJob } from '../types/driver';
import { formatDeliveryDate } from '../utils/format';
import { shadow } from '../theme/tokens';

type Feed = 'inbox' | 'saved' | 'deleted';
type Preferences = { savedJobIds: string[]; hiddenJobIds: string[] };

const emptyPreferences: Preferences = { savedJobIds: [], hiddenJobIds: [] };

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

function routeDistance(job: DriverJob) {
  const bits: string[] = [];
  if (job.journeyDistanceMiles != null) bits.push(`${job.journeyDistanceMiles.toFixed(1)} miles`);
  if (job.estimatedJourneyMinutes != null) {
    const minutes = Math.max(0, Math.round(job.estimatedJourneyMinutes));
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    bits.push(`${hours ? `${hours}h ` : ''}${rest}m`);
  }
  return bits.length > 1 ? `${bits[0]} (${bits[1]})` : bits[0] ?? '';
}

function tagList(job: DriverJob) {
  const tags = ['NEW'];
  if (job.serviceMode) tags.push(job.serviceMode.replace(/[_-]+/g, ' ').toUpperCase());
  if (job.directDeliveryRequired) tags.push('DIRECT');
  return tags.slice(0, 3);
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
        <View style={styles.mapButton}><UiIcon name="location" size={22} color="#FFFFFF" /></View>
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
        <Text style={styles.emptyText}>{feed === 'inbox' ? 'Pull down to refresh available work.' : feed === 'saved' ? 'Save a load from Inbox to keep it here.' : 'Dismissed loads stay here so you can restore them.'}</Text>
      </View> : null}
      {visibleJobs.map((job) => <AlertCard
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

function AlertCard({ job, saved, deleted, onOpen, onSave, onDelete }: {
  job: DriverJob;
  saved: boolean;
  deleted: boolean;
  onOpen: () => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  const distance = routeDistance(job);
  const tags = tagList(job);
  return <View style={styles.card}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Open load ${job.reference}`} onPress={onOpen} style={({ pressed }) => [styles.cardMain, pressed && styles.pressed]}>
      <Text style={styles.company} numberOfLines={1}>{job.postingCompanyName || 'XDrive Load'}{job.postingCompanyMemberCode ? ` (${job.postingCompanyMemberCode})` : ''}</Text>
      <Text style={styles.metaLine}>{job.postedAt ? `${formatDeliveryDate(job.postedAt)} | ` : ''}{job.vehicleRequirement || 'Vehicle'} | Driver current location</Text>
      <View style={styles.tags}>{tags.map((tag) => <View key={tag} style={[styles.tag, tag === 'NEW' ? styles.tagNew : tag === 'DIRECT' ? styles.tagGreen : styles.tagBlue]}><Text style={[styles.tagText, tag === 'NEW' && styles.tagTextNew]}>{tag}</Text></View>)}</View>
      <View style={styles.routeBox}>
        <View style={styles.routeRail}>
          <View style={styles.stopSquare}><Text style={styles.stopNumber}>1</Text></View>
          <Text style={styles.routeDots}>•••</Text>
          <View style={styles.stopPin}><Text style={styles.stopNumber}>2</Text></View>
        </View>
        <View style={styles.routeCopy}>
          <View><Text style={styles.place} numberOfLines={1}>{job.pickupLocation}</Text><Text style={styles.routeTime}>{formatDeliveryDate(job.pickupTime)}</Text></View>
          <View><Text style={styles.place} numberOfLines={1}>{job.deliveryLocation}</Text><Text style={styles.routeTime}>{formatDeliveryDate(job.deliveryTime)}</Text></View>
        </View>
      </View>
      {job.cargoType ? <Text style={styles.cargo} numberOfLines={2}>{job.cargoType}</Text> : null}
      {distance ? <View style={styles.distanceRow}><UiIcon name="navigate-outline" size={18} color="#292837" /><Text style={styles.distance}>{distance}</Text></View> : null}
      {job.notesSummary ? <Text style={styles.notes} numberOfLines={3}>{job.notesSummary}</Text> : null}
      <View style={styles.quoteButton}><Text style={styles.quoteText}>Quote</Text></View>
    </Pressable>
    <View style={styles.cardActions}>
      <Pressable accessibilityRole="button" accessibilityLabel={saved ? 'Remove from saved' : 'Save load'} onPress={onSave} style={[styles.actionCircle, saved && styles.actionSaved]}><Text style={styles.actionText}>★</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={deleted ? 'Restore load' : 'Delete load'} onPress={onDelete} style={[styles.actionCircle, deleted && styles.actionDeleted]}><Text style={styles.actionText}>{deleted ? '↺' : '×'}</Text></Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F2F3F7' },
  header: { backgroundColor: '#292837', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 18 },
  segmented: { minHeight: 58, borderRadius: 30, backgroundColor: '#3A3949', flexDirection: 'row', alignItems: 'center', padding: 4 },
  segment: { flex: 1, minHeight: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: '#FFE66A' },
  segmentText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#FFFFFF' },
  segmentTextActive: { fontFamily: 'Inter_700Bold', color: '#111111' },
  segmentDivider: { width: 1, height: 32, backgroundColor: '#626172' },
  mapButton: { width: 52, height: 50, alignItems: 'center', justifyContent: 'center' },
  list: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 28 },
  loadingCard: { minHeight: 90, borderRadius: 18, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', gap: 8 },
  loadingText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#656473' },
  empty: { borderRadius: 18, backgroundColor: '#FFFFFF', padding: 24, alignItems: 'center' },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#292837' },
  emptyText: { marginTop: 6, fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 19, color: '#747381', textAlign: 'center' },
  card: { position: 'relative', backgroundColor: '#FFFFFF', borderRadius: 18, overflow: 'hidden', ...shadow },
  cardMain: { padding: 16, gap: 11 },
  pressed: { opacity: 0.78 },
  company: { fontFamily: 'Inter_700Bold', fontSize: 17, color: '#4B4A59' },
  metaLine: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#787786' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { borderRadius: 7, paddingHorizontal: 10, paddingVertical: 6 },
  tagNew: { backgroundColor: '#E8F6E5' },
  tagBlue: { backgroundColor: '#E8F2FB' },
  tagGreen: { backgroundColor: '#4CAD3F' },
  tagText: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.6, color: '#2473B7' },
  tagTextNew: { color: '#2D7B31' },
  routeBox: { flexDirection: 'row', borderWidth: 1, borderColor: '#E1E2E7', borderRadius: 16, padding: 14, gap: 12 },
  routeRail: { width: 34, alignItems: 'center', justifyContent: 'space-between' },
  stopSquare: { width: 28, height: 28, borderRadius: 4, backgroundColor: '#5199D6', alignItems: 'center', justifyContent: 'center' },
  stopPin: { width: 28, height: 32, borderRadius: 16, borderBottomLeftRadius: 5, backgroundColor: '#5199D6', alignItems: 'center', justifyContent: 'center' },
  stopNumber: { fontFamily: 'Inter_700Bold', fontSize: 12, color: '#FFFFFF' },
  routeDots: { transform: [{ rotate: '90deg' }], color: '#CDD2D9', letterSpacing: 1 },
  routeCopy: { flex: 1, justifyContent: 'space-between', gap: 20 },
  place: { fontFamily: 'Inter_700Bold', fontSize: 18, color: '#4A4958' },
  routeTime: { marginTop: 4, fontFamily: 'Inter_500Medium', fontSize: 14, color: '#7F7E8C' },
  cargo: { fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20, color: '#72717F' },
  distanceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  distance: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#777684' },
  notes: { fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 20, color: '#777684' },
  quoteButton: { minHeight: 52, borderRadius: 26, backgroundColor: '#FFD200', alignItems: 'center', justifyContent: 'center' },
  quoteText: { fontFamily: 'Inter_700Bold', fontSize: 17, color: '#111111' },
  cardActions: { position: 'absolute', right: 12, top: 12, flexDirection: 'row', gap: 8 },
  actionCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D7D8DE', alignItems: 'center', justifyContent: 'center' },
  actionSaved: { backgroundColor: '#FFB000', borderColor: '#FFB000' },
  actionDeleted: { backgroundColor: '#E4545C', borderColor: '#E4545C' },
  actionText: { fontFamily: 'Inter_700Bold', fontSize: 17, color: '#292837' },
});