import { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Pressable, ScrollView, Text, View } from '../theme/primitives';
import { UiIcon } from '../components/UiIcon';
import type { DriverJob, DriverResources } from '../types/driver';
import { radius, shadow } from '../theme/tokens';

function pick(row: Record<string, unknown>, keys: string[], fallback = '-') {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim()) return String(value);
  }
  return fallback;
}

function quoteAmount(row: Record<string, unknown>) {
  const raw = pick(row, ['amount', 'bid_price_gbp', 'price'], '-');
  if (raw === '-' || raw.startsWith('£')) return raw;
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? `£${numeric.toFixed(2)}` : raw;
}

function quoteStatus(row: Record<string, unknown>) {
  const raw = pick(row, ['status', 'quote_status'], 'Submitted').toLowerCase();
  if (['accepted', 'won', 'awarded'].includes(raw)) return 'Accepted';
  if (['declined', 'rejected', 'unsuccessful', 'lost'].includes(raw)) return 'Unsuccessful';
  if (['withdrawn', 'cancelled'].includes(raw)) return 'Withdrawn';
  return 'Submitted';
}
type QuoteFilter = 'All' | 'Sent' | 'Accepted' | 'Closed';

function quoteBucket(row: Record<string, unknown>): Exclude<QuoteFilter, 'All'> {
  const status = quoteStatus(row);
  if (status === 'Accepted') return 'Accepted';
  if (status === 'Submitted') return 'Sent';
  return 'Closed';
}

function statusPalette(status: string) {
  if (status === 'Accepted') return { bg: '#E8F7EE', text: '#16713C', dot: '#16A34A' };
  if (status === 'Unsuccessful') return { bg: '#FDECEC', text: '#A52B2B', dot: '#DC2626' };
  if (status === 'Withdrawn') return { bg: '#F0F1F3', text: '#555D69', dot: '#7A8390' };
  return { bg: '#EAF1FF', text: '#1D57D8', dot: '#1D57D8' };
}

export function QuotesScreen({ resources, jobs = [], onOpen }: { resources?: DriverResources; jobs?: DriverJob[]; onOpen: (job: DriverJob, quote: Record<string, unknown>) => void }) {
  const quotes = resources?.quotes ?? [];
  const jobsById = useMemo(() => new Map(jobs.map((job) => [job.id, job])), [jobs]);
  const [filter, setFilter] = useState<QuoteFilter>('All');
  const counts = useMemo(() => ({
    All: quotes.length,
    Sent: quotes.filter((quote) => quoteBucket(quote) === 'Sent').length,
    Accepted: quotes.filter((quote) => quoteBucket(quote) === 'Accepted').length,
    Closed: quotes.filter((quote) => quoteBucket(quote) === 'Closed').length,
  }), [quotes]);
  const filtered = useMemo(
    () => quotes.filter((quote) => filter === 'All' || quoteBucket(quote) === filter),
    [filter, quotes],
  );

  return <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <View style={styles.hero}>
      <Text style={styles.eyebrow}>XDRIVE DRIVER</Text>
      <Text style={styles.title}>My Quotes</Text>
      <Text style={styles.subtitle}>Track every offer you have sent to the XDrive marketplace.</Text>
    </View>

    <View style={styles.segmented}>
      {(['All', 'Sent', 'Accepted', 'Closed'] as QuoteFilter[]).map((item) => {
        const active = filter === item;
        return <Pressable key={item} onPress={() => setFilter(item)} style={[styles.segment, active && styles.segmentActive]}>
          <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>{item}</Text>
          <View style={[styles.countPill, active && styles.countPillActive]}>
            <Text style={[styles.countText, active && styles.countTextActive]}>{counts[item]}</Text>
          </View>
        </Pressable>;
      })}
    </View>

    {quotes.length === 0 ? <EmptyState title="No quotes yet" body="Submitted quotes will appear here." /> : null}
    {quotes.length > 0 && filtered.length === 0 ? <EmptyState title="Nothing in this tab" body="Quotes will move here when their status changes." /> : null}

    {filtered.map((quote, index) => {
      const status = quoteStatus(quote);
      const palette = statusPalette(status);
      const jobId = pick(quote, ['job_id', 'load_id'], '');
      const job = jobId ? jobsById.get(jobId) : undefined;
      const directReference = pick(quote, ['job_reference', 'load_reference'], '');
      const reference = job?.reference || directReference || (jobId ? `XDL-${jobId.slice(0, 8).toUpperCase()}` : 'Load quote');
      const pickup = job?.pickupLocation || pick(quote, ['pickup_location', 'collection'], 'Collection not published');
      const delivery = job?.deliveryLocation || pick(quote, ['delivery_location', 'destination'], 'Delivery not published');
      const vehicle = job?.vehicleRequirement || pick(quote, ['vehicle_type', 'requested_vehicle_type'], 'Vehicle not published');

      return <Pressable key={String(quote.id ?? index)} accessibilityRole="button" accessibilityLabel={`Open details for ${reference}`} disabled={!job} onPress={() => job && onOpen(job, quote)} style={({ pressed }) => [styles.card, pressed && styles.cardPressed, !job && styles.cardDisabled]}>
        <View style={styles.cardAccent} />
        <View style={styles.cardHeader}>
          <View style={styles.referenceWrap}>
            <Text style={styles.referenceLabel}>LOAD REFERENCE</Text>
            <Text style={styles.reference}>{reference}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: palette.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: palette.dot }]} />
            <Text style={[styles.statusText, { color: palette.text }]}>{status}</Text>
          </View>
        </View>

        <View style={styles.routeBlock}>
          <View style={styles.routeRail}>
            <View style={styles.pickupDot} />
            <View style={styles.routeLine} />
            <UiIcon name="location" size={18} color="#F5A300" />
          </View>
          <View style={styles.routeCopy}>
            <View><Text style={styles.stopLabel}>COLLECTION</Text><Text style={styles.stopText} numberOfLines={2}>{pickup}</Text></View>
            <View><Text style={styles.stopLabel}>DELIVERY</Text><Text style={styles.stopText} numberOfLines={2}>{delivery}</Text></View>
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.vehicleWrap}>
            <View style={styles.vehicleIcon}><UiIcon name="car-outline" size={16} color="#1D57D8" /></View>
            <View><Text style={styles.metaLabel}>VEHICLE</Text><Text style={styles.vehicleText}>{vehicle}</Text></View>
          </View>
          <View style={styles.amountPanel}>
            <Text style={styles.amountLabel}>YOUR QUOTE</Text>
            <Text style={styles.amount}>{quoteAmount(quote)}</Text>
          </View>
        </View>
      </Pressable>;
    })}
  </ScrollView>;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return <View style={styles.empty}>
    <View style={styles.emptyIcon}><UiIcon name="receipt-outline" size={24} color="#1D57D8" /></View>
    <Text style={styles.emptyTitle}>{title}</Text>
    <Text style={styles.emptyText}>{body}</Text>
  </View>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#EEF3F9' },
  content: { paddingBottom: 28, gap: 12 },
  hero: { backgroundColor: '#0B2F6B', paddingHorizontal: 18, paddingTop: 18, paddingBottom: 20 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.2, color: '#91B4F2' },
  title: { marginTop: 4, fontFamily: 'Inter_700Bold', fontSize: 28, color: '#FFFFFF' },
  subtitle: { marginTop: 5, maxWidth: 330, fontFamily: 'Inter_600SemiBold', fontSize: 12, lineHeight: 18, color: '#D8E5FA' },
  segmented: { marginHorizontal: 16, marginTop: -2, flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 14, padding: 4, ...shadow },
  segment: { flex: 1, minHeight: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 2 },
  segmentActive: { backgroundColor: '#EAF1FF' },
  segmentLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#4B5565' },
  segmentLabelActive: { color: '#0B2F6B' },
  countPill: { minWidth: 22, height: 18, borderRadius: 9, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F3F6' },
  countPillActive: { backgroundColor: '#1D57D8' },
  countText: { fontFamily: 'Inter_700Bold', fontSize: 9, color: '#667085' },
  countTextActive: { color: '#FFFFFF' },
  card: { marginHorizontal: 16, position: 'relative', overflow: 'hidden', backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, gap: 14, ...shadow },
  cardPressed: { opacity: 0.72 },
  cardDisabled: { opacity: 0.82 },
  cardAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, backgroundColor: '#1D57D8' },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  referenceWrap: { flex: 1 },
  referenceLabel: { fontFamily: 'Inter_500Medium', fontSize: 11, letterSpacing: 0.25, color: '#526071' },
  reference: { marginTop: 3, fontFamily: 'Inter_700Bold', fontSize: 17, color: '#0B2F6B' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  routeBlock: { flexDirection: 'row', gap: 10, backgroundColor: '#F7F9FC', borderRadius: 14, padding: 12 },
  routeRail: { width: 22, alignItems: 'center', paddingTop: 4 },
  pickupDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#1D57D8' },
  routeLine: { width: 1, flex: 1, minHeight: 32, marginVertical: 3, borderLeftWidth: 1, borderStyle: 'dashed', borderColor: '#AAB4C3' },
  routeCopy: { flex: 1, gap: 12 },
  stopLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 0.2, color: '#526071' },
  stopText: { marginTop: 3, fontFamily: 'Inter_700Bold', fontSize: 16, lineHeight: 22, color: '#172033' },
  footer: { flexDirection: 'row', alignItems: 'stretch', gap: 10 },
  vehicleWrap: { flex: 1, minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#F8FAFD', borderRadius: 12, paddingHorizontal: 10 },
  vehicleIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF1FF' },
  metaLabel: { fontFamily: 'Inter_500Medium', fontSize: 11, letterSpacing: 0.2, color: '#526071' },
  vehicleText: { marginTop: 2, fontFamily: 'Inter_700Bold', fontSize: 16, lineHeight: 22, color: '#172033' },
  amountPanel: { minWidth: 112, borderRadius: 12, paddingHorizontal: 12, justifyContent: 'center', alignItems: 'flex-end', backgroundColor: '#0B2F6B' },
  amountLabel: { fontFamily: 'Inter_500Medium', fontSize: 10, letterSpacing: 0.2, color: '#C6D6EE' },
  amount: { marginTop: 2, fontFamily: 'Inter_700Bold', fontSize: 18, color: '#FFFFFF' },
  empty: { marginHorizontal: 16, backgroundColor: '#FFFFFF', borderRadius: radius.medium, padding: 24, alignItems: 'center', ...shadow },
  emptyIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF1FF' },
  emptyTitle: { marginTop: 10, fontFamily: 'Inter_700Bold', fontSize: 16, color: '#172033' },
  emptyText: { marginTop: 4, fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#7A8493', textAlign: 'center' },
});