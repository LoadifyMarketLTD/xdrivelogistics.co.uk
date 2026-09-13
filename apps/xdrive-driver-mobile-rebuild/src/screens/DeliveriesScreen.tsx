import { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Pressable, ScrollView, Text, View } from '../theme/primitives';
import { UiIcon } from '../components/UiIcon';
import type { DriverJob } from '../types/driver';
import { formatDeliveryDate } from '../utils/format';
import { shadow } from '../theme/tokens';

type BookingRange = 'current' | '7' | '14';

function jobTimestamp(job: DriverJob) {
  for (const value of [job.deliveryTime, job.pickupTime, job.postedAt]) {
    const timestamp = Date.parse(value ?? '');
    if (Number.isFinite(timestamp)) return timestamp;
  }
  return 0;
}

function inPastDays(job: DriverJob, days: number) {
  const timestamp = jobTimestamp(job);
  if (!timestamp) return true;
  const age = Date.now() - timestamp;
  return age >= 0 && age <= days * 86400000;
}

function distanceLabel(job: DriverJob) {
  const bits: string[] = [];
  if (job.journeyDistanceMiles != null) bits.push(`${job.journeyDistanceMiles.toFixed(1)} miles`);
  if (job.estimatedJourneyMinutes != null) {
    const minutes = Math.max(0, Math.round(job.estimatedJourneyMinutes));
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    bits.push(`${hours ? `${hours}h ` : ''}${remainder}m`);
  }
  return bits.length > 1 ? `${bits[0]} (${bits[1]})` : bits[0] ?? '';
}

export function BookingsScreen({ active, history, onOpen }: {
  active: DriverJob[];
  history: DriverJob[];
  onOpen: (job: DriverJob) => void;
}) {
  const [range, setRange] = useState<BookingRange>('current');
  const jobs = useMemo(() => {
    if (range === 'current') return active;
    const days = range === '7' ? 7 : 14;
    return history.filter((job) => inPastDays(job, days));
  }, [active, history, range]);

  return <View style={styles.page}>
    <View style={styles.header}>
      <Text style={styles.brand}><Text style={styles.brandX}>X</Text>Drive</Text>
      <Text style={styles.title}>Bookings</Text>
    </View>
    <View style={styles.segmentWrap}>
      {([
        ['current', 'Current'],
        ['7', 'Past 7 days'],
        ['14', 'Past 14 days'],
      ] as const).map(([key, label]) => {
        const selected = range === key;
        return <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => setRange(key)} style={[styles.segment, selected && styles.segmentActive]}>
          <Text style={[styles.segmentText, selected && styles.segmentTextActive]}>{label}</Text>
        </Pressable>;
      })}
    </View>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {jobs.length ? jobs.map((job) => <BookingCard key={job.id} job={job} onOpen={() => onOpen(job)} />) : <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No bookings in this view</Text>
        <Text style={styles.emptyText}>{range === 'current' ? 'Assigned work will appear here.' : 'Completed work will appear here when it falls inside this period.'}</Text>
      </View>}
    </ScrollView>
  </View>;
}

function BookingCard({ job, onOpen }: { job: DriverJob; onOpen: () => void }) {
  const completed = job.status === 'delivered';
  const distance = distanceLabel(job);
  const lastStopNumber = Math.max(2, job.stops?.length ?? 2);
  const extraTags = [...new Set([
    ...(job.serviceMode ? [job.serviceMode.replace(/[_-]+/g, ' ').toUpperCase()] : []),
    ...(job.badges ?? []).map((badge) => String(badge).toUpperCase()),
  ])].slice(0, 2);

  return <Pressable accessibilityRole="button" accessibilityLabel={`Open booking ${job.reference}`} onPress={onOpen} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
    <Text style={styles.company} numberOfLines={2}>{job.postingCompanyName || 'XDrive Booking'}{job.postingCompanyMemberCode ? ` (${job.postingCompanyMemberCode})` : ''}</Text>
    {job.customerReference ? <Text style={styles.customerReference}>Cust. Ref. {job.customerReference}</Text> : null}
    <Text style={styles.reference}>Load ID {job.reference}</Text>
    <View style={styles.tags}>
      <View style={[styles.tag, completed ? styles.tagCompleted : styles.tagCurrent]}><Text style={styles.tagText}>{completed ? 'COMPLETED' : 'CURRENT'}</Text></View>
      {extraTags.map((tag) => <View key={tag} style={[styles.tag, /SMARTPAY/.test(tag) ? styles.tagSmart : styles.tagBlue]}><Text style={[styles.tagText, !/SMARTPAY/.test(tag) && styles.tagBlueText]}>{tag}</Text></View>)}
    </View>
    <View style={styles.routeCard}>
      <View style={styles.routeRail}>
        <View style={styles.numberSquare}><Text style={styles.numberText}>1</Text></View>
        <View style={styles.routeLine} />
        <View style={styles.pin}><Text style={styles.pinText}>{lastStopNumber}</Text></View>
      </View>
      <View style={styles.routeCopy}>
        <View><Text style={styles.place} numberOfLines={1}>{job.pickupLocation}</Text><Text style={styles.time}>{formatDeliveryDate(job.pickupTime)}</Text></View>
        <View><Text style={styles.place} numberOfLines={1}>{job.deliveryLocation}</Text><Text style={styles.time}>{formatDeliveryDate(job.deliveryTime)}</Text></View>
      </View>
    </View>
    {distance ? <View style={styles.distanceRow}><UiIcon name="navigate-outline" size={18} color="#242432" /><Text style={styles.distance}>{distance}</Text></View> : null}
    {job.notesSummary || job.pickupNote || job.deliveryNote ? <View style={styles.notesRow}><UiIcon name="document-text-outline" size={17} color="#242432" /><Text style={styles.notes} numberOfLines={5}>{job.notesSummary || job.pickupNote || job.deliveryNote}</Text></View> : null}
    {completed && job.podCompleted ? <View style={styles.podButton}><Text style={styles.podText}>View POD</Text></View> : null}
  </Pressable>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F2F3F7' },
  header: { minHeight: 67, backgroundColor: '#292837', alignItems: 'center', justifyContent: 'center', paddingTop: 6 },
  brand: { fontFamily: 'Inter_600SemiBold', fontSize: 20, color: '#FFFFFF' },
  brandX: { fontFamily: 'Inter_700Bold', color: '#FFD200' },
  title: { marginTop: 1, fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#FFFFFF' },
  segmentWrap: { flexDirection: 'row', marginHorizontal: 12, marginTop: 10, marginBottom: 10, gap: 7 },
  segment: { flex: 1, minHeight: 38, borderRadius: 20, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E6EA' },
  segmentActive: { backgroundColor: '#292837', borderColor: '#292837' },
  segmentText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#292837', textAlign: 'center' },
  segmentTextActive: { fontFamily: 'Inter_700Bold', color: '#FFFFFF' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 12, paddingBottom: 24, gap: 10 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, gap: 8, ...shadow },
  pressed: { opacity: 0.78 },
  company: { fontFamily: 'Inter_700Bold', fontSize: 14, lineHeight: 18, color: '#454453' },
  customerReference: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: '#5F5E6D' },
  reference: { fontFamily: 'Inter_500Medium', fontSize: 11, color: '#777786' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  tag: { borderRadius: 5, paddingHorizontal: 7, paddingVertical: 4 },
  tagCompleted: { backgroundColor: '#65C653' },
  tagCurrent: { backgroundColor: '#4E97D7' },
  tagSmart: { backgroundColor: '#49AF3F' },
  tagBlue: { backgroundColor: '#E8F2FB' },
  tagText: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: .2, color: '#FFFFFF' },
  tagBlueText: { color: '#2473B7' },
  routeCard: { flexDirection: 'row', borderWidth: 1, borderColor: '#E1E2E7', borderRadius: 10, padding: 10, gap: 9 },
  routeRail: { width: 27, alignItems: 'center', justifyContent: 'space-between' },
  numberSquare: { width: 25, height: 25, borderRadius: 3, backgroundColor: '#5199D6', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  numberText: { fontFamily: 'Inter_700Bold', fontSize: 11, color: '#FFFFFF' },
  routeLine: { width: 1, flex: 1, minHeight: 20, backgroundColor: '#CDD2D9' },
  pin: { width: 25, height: 28, borderRadius: 14, borderBottomLeftRadius: 4, backgroundColor: '#5199D6', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  pinText: { fontFamily: 'Inter_700Bold', fontSize: 10, color: '#FFFFFF' },
  routeCopy: { flex: 1, justifyContent: 'space-between', gap: 12 },
  place: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#454453' },
  time: { marginTop: 2, fontFamily: 'Inter_500Medium', fontSize: 10, color: '#7E7D8B' },
  distanceRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  distance: { fontFamily: 'Inter_500Medium', fontSize: 11, color: '#777786' },
  notesRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E2E3E8' },
  notes: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 16, color: '#6D6C7A' },
  podButton: { minHeight: 42, borderRadius: 21, backgroundColor: '#FFD200', alignItems: 'center', justifyContent: 'center' },
  podText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#111111' },
  empty: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 22, alignItems: 'center' },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#292837' },
  emptyText: { marginTop: 6, fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 18, color: '#737280', textAlign: 'center' },
});