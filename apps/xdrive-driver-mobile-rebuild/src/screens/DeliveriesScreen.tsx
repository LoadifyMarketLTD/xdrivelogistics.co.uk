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
    <View style={styles.header}><Text style={styles.title}>Bookings</Text></View>
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
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open booking ${job.reference}`} onPress={onOpen} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
    <Text style={styles.company} numberOfLines={1}>{job.postingCompanyName || 'XDrive Booking'}{job.postingCompanyMemberCode ? ` (${job.postingCompanyMemberCode})` : ''}</Text>
    <Text style={styles.reference}>Load ID {job.reference}</Text>
    <View style={styles.tags}>
      <View style={[styles.tag, completed ? styles.tagCompleted : styles.tagCurrent]}><Text style={styles.tagText}>{completed ? 'COMPLETED' : 'CURRENT'}</Text></View>
      {job.serviceMode ? <View style={styles.tagSmart}><Text style={styles.tagText}>{job.serviceMode.replace(/[_-]+/g, ' ').toUpperCase()}</Text></View> : null}
    </View>
    <View style={styles.routeCard}>
      <View style={styles.routeRail}>
        <View style={styles.numberSquare}><Text style={styles.numberText}>1</Text></View>
        <View style={styles.routeDots}><Text style={styles.dots}>•••</Text></View>
        <View style={styles.pin}><Text style={styles.pinText}>2</Text></View>
      </View>
      <View style={styles.routeCopy}>
        <View><Text style={styles.place} numberOfLines={1}>{job.pickupLocation}</Text><Text style={styles.time}>{formatDeliveryDate(job.pickupTime)}</Text></View>
        <View><Text style={styles.place} numberOfLines={1}>{job.deliveryLocation}</Text><Text style={styles.time}>{formatDeliveryDate(job.deliveryTime)}</Text></View>
      </View>
    </View>
    {distance ? <View style={styles.distanceRow}><UiIcon name="navigate-outline" size={20} color="#242432" /><Text style={styles.distance}>{distance}</Text></View> : null}
    {job.notesSummary || job.pickupNote || job.deliveryNote ? <View style={styles.notesRow}><UiIcon name="document-text-outline" size={18} color="#242432" /><Text style={styles.notes} numberOfLines={4}>{job.notesSummary || job.pickupNote || job.deliveryNote}</Text></View> : null}
    {completed && job.podRequired ? <View style={styles.podButton}><Text style={styles.podText}>View POD</Text></View> : null}
  </Pressable>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F2F3F7' },
  header: { minHeight: 86, backgroundColor: '#292837', alignItems: 'center', justifyContent: 'center', paddingTop: 12 },
  title: { fontFamily: 'Inter_600SemiBold', fontSize: 20, color: '#FFFFFF' },
  segmentWrap: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 18, backgroundColor: '#F2F3F7' },
  segment: { flex: 1, minHeight: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  segmentActive: { backgroundColor: '#292837' },
  segmentText: { fontFamily: 'Inter_700Bold', fontSize: 13, color: '#292837', textAlign: 'center' },
  segmentTextActive: { color: '#FFFFFF' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 28, gap: 14 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, gap: 12, ...shadow },
  pressed: { opacity: 0.78 },
  company: { fontFamily: 'Inter_700Bold', fontSize: 18, color: '#454453' },
  reference: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#777786' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  tagCompleted: { backgroundColor: '#65C653' },
  tagCurrent: { backgroundColor: '#4E97D7' },
  tagSmart: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#49AF3F' },
  tagText: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 0.7, color: '#FFFFFF' },
  routeCard: { flexDirection: 'row', borderWidth: 1, borderColor: '#E1E2E7', borderRadius: 16, padding: 14, gap: 12 },
  routeRail: { width: 34, alignItems: 'center', justifyContent: 'space-between' },
  numberSquare: { width: 28, height: 28, borderRadius: 4, backgroundColor: '#5199D6', alignItems: 'center', justifyContent: 'center' },
  numberText: { fontFamily: 'Inter_700Bold', fontSize: 13, color: '#FFFFFF' },
  routeDots: { height: 35, justifyContent: 'center' },
  dots: { transform: [{ rotate: '90deg' }], color: '#CDD2D9', letterSpacing: 1 },
  pin: { width: 28, height: 32, borderRadius: 16, borderBottomLeftRadius: 5, backgroundColor: '#5199D6', alignItems: 'center', justifyContent: 'center' },
  pinText: { fontFamily: 'Inter_700Bold', fontSize: 12, color: '#FFFFFF' },
  routeCopy: { flex: 1, justifyContent: 'space-between', gap: 18 },
  place: { fontFamily: 'Inter_700Bold', fontSize: 18, color: '#454453' },
  time: { marginTop: 4, fontFamily: 'Inter_500Medium', fontSize: 14, color: '#7E7D8B' },
  distanceRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  distance: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#777786' },
  notesRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingTop: 11, borderTopWidth: 1, borderTopColor: '#E2E3E8' },
  notes: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 20, color: '#6D6C7A' },
  podButton: { minHeight: 50, borderRadius: 25, backgroundColor: '#FFD200', alignItems: 'center', justifyContent: 'center' },
  podText: { fontFamily: 'Inter_700Bold', fontSize: 17, color: '#111111' },
  empty: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 24, alignItems: 'center' },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#292837' },
  emptyText: { marginTop: 6, fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 19, color: '#737280', textAlign: 'center' },
});