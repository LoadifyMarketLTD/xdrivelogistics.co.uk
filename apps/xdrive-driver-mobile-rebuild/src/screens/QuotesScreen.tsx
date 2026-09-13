import { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Pressable, ScrollView, Text, View } from '../theme/primitives';
import { UiIcon } from '../components/UiIcon';
import type { DriverJob, DriverResources } from '../types/driver';
import { shadow } from '../theme/tokens';
import { mapJob } from '../api/driver';

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

type QuoteFilter = 'Sent' | 'Accepted' | 'Closed';

function quoteBucket(row: Record<string, unknown>): QuoteFilter {
  const status = quoteStatus(row);
  if (status === 'Accepted') return 'Accepted';
  if (status === 'Submitted') return 'Sent';
  return 'Closed';
}

export function QuotesScreen({ resources, jobs = [], onOpen }: {
  resources?: DriverResources;
  jobs?: DriverJob[];
  onOpen: (job: DriverJob, quote: Record<string, unknown>) => void;
}) {
  const quotes = useMemo(() => resources?.quotes ?? [], [resources?.quotes]);
  const jobsById = useMemo(() => new Map(jobs.map((job) => [job.id, job])), [jobs]);
  const [filter, setFilter] = useState<QuoteFilter>('Sent');
  const counts = useMemo(() => ({
    Sent: quotes.filter((quote) => quoteBucket(quote) === 'Sent').length,
    Accepted: quotes.filter((quote) => quoteBucket(quote) === 'Accepted').length,
    Closed: quotes.filter((quote) => quoteBucket(quote) === 'Closed').length,
  }), [quotes]);
  const filtered = useMemo(() => quotes.filter((quote) => quoteBucket(quote) === filter), [filter, quotes]);

  return <View style={styles.page}>
    <View style={styles.header}>
      <Text style={styles.brand}><Text style={styles.brandX}>X</Text>Drive</Text>
      <Text style={styles.title}>Quotes</Text>
    </View>
    <View style={styles.segmented}>
      {(['Sent', 'Accepted', 'Closed'] as QuoteFilter[]).map((item) => {
        const active = filter === item;
        return <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => setFilter(item)} style={[styles.segment, active && styles.segmentActive]}>
          <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{item}</Text>
          <View style={[styles.count, active && styles.countActive]}><Text style={[styles.countText, active && styles.countTextActive]}>{counts[item]}</Text></View>
        </Pressable>;
      })}
    </View>

    <ScrollView style={styles.list} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {!filtered.length ? <View style={styles.empty}><Text style={styles.emptyTitle}>Nothing in {filter}</Text><Text style={styles.emptyText}>Your XDrive quotes will move here as their status changes.</Text></View> : null}
      {filtered.map((quote, index) => {
        const status = quoteStatus(quote);
        const jobId = pick(quote, ['job_id', 'load_id'], '');
        const embeddedJobRaw = quote.job && typeof quote.job === 'object' && !Array.isArray(quote.job)
          ? quote.job as Record<string, unknown>
          : undefined;
        const embeddedJob = embeddedJobRaw ? mapJob(embeddedJobRaw) : undefined;
        const job = (jobId ? jobsById.get(jobId) : undefined) ?? embeddedJob;
        const pickup = job?.pickupLocation || pick(quote, ['pickup_location', 'collection'], 'Collection not published');
        const delivery = job?.deliveryLocation || pick(quote, ['delivery_location', 'destination'], 'Delivery not published');
        const companyName = job?.postingCompanyName || pick(quote, ['posting_company_name', 'company_name'], 'XDrive load');
        const companyId = job?.postingCompanyMemberCode || pick(quote, ['posting_company_member_code', 'company_xd_id'], '');
        const accepted = status === 'Accepted';

        return <Pressable key={String(quote.id ?? index)} accessibilityRole="button" accessibilityLabel={`Open quote from ${companyName}`} disabled={!job} onPress={() => job && onOpen(job, quote)} style={({ pressed }) => [styles.card, pressed && styles.pressed, !job && styles.disabled]}>
          <View style={styles.cardHeader}>
            <View style={styles.headerCopy}><Text style={styles.company} numberOfLines={2}>{companyName}{companyId ? ` (${companyId})` : ''}</Text><Text style={styles.loadId}>Load ID {job?.reference || jobId || '—'}</Text></View>
            <View style={[styles.statusPill, accepted && styles.statusAccepted]}><Text style={[styles.statusText, accepted && styles.statusAcceptedText]}>{status}</Text></View>
          </View>
          <View style={styles.routeBox}>
            <View style={styles.routeRail}><View style={styles.stopSquare}><Text style={styles.stopNumber}>1</Text></View><View style={styles.routeLine} /><View style={styles.stopPin}><Text style={styles.stopNumber}>2</Text></View></View>
            <View style={styles.routeCopy}><Text style={styles.place} numberOfLines={1}>{pickup}</Text><Text style={styles.place} numberOfLines={1}>{delivery}</Text></View>
          </View>
          <View style={styles.footer}><View><Text style={styles.quoteLabel}>MY QUOTE (EXC. VAT)</Text><Text style={styles.amount}>{quoteAmount(quote)}</Text></View><UiIcon name="chevron-forward" size={20} color="#A9AAB2" /></View>
        </Pressable>;
      })}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F2F3F7' },
  header: { minHeight: 67, backgroundColor: '#292837', alignItems: 'center', justifyContent: 'center', paddingTop: 6 },
  brand: { fontFamily: 'Inter_600SemiBold', fontSize: 20, color: '#FFFFFF' },
  brandX: { fontFamily: 'Inter_700Bold', color: '#FFD200' },
  title: { marginTop: 1, fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#FFFFFF' },
  segmented: { marginHorizontal: 12, marginTop: 10, marginBottom: 10, flexDirection: 'row', minHeight: 46, padding: 3, borderRadius: 23, backgroundColor: '#3A3949' },
  segment: { flex: 1, borderRadius: 20, alignItems: 'center', justifyContent: 'center', gap: 1 },
  segmentActive: { backgroundColor: '#FFE66A' },
  segmentText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#FFFFFF' },
  segmentTextActive: { fontFamily: 'Inter_700Bold', color: '#111111' },
  count: { minWidth: 18, height: 16, borderRadius: 8, paddingHorizontal: 4, backgroundColor: '#555463', alignItems: 'center', justifyContent: 'center' },
  countActive: { backgroundColor: '#292837' },
  countText: { fontFamily: 'Inter_700Bold', fontSize: 8, color: '#FFFFFF' },
  countTextActive: { color: '#FFE66A' },
  list: { flex: 1 },
  content: { paddingHorizontal: 12, paddingBottom: 24, gap: 10 },
  empty: { borderRadius: 14, backgroundColor: '#FFFFFF', padding: 22, alignItems: 'center' },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#292837' },
  emptyText: { marginTop: 6, fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 18, color: '#777684', textAlign: 'center' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, gap: 10, ...shadow },
  pressed: { opacity: .78 },
  disabled: { opacity: .72 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  headerCopy: { flex: 1 },
  company: { fontFamily: 'Inter_700Bold', fontSize: 14, lineHeight: 18, color: '#4A4958' },
  loadId: { marginTop: 3, fontFamily: 'Inter_500Medium', fontSize: 10, color: '#777684' },
  statusPill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: '#ECEEF2' },
  statusAccepted: { backgroundColor: '#E8F6E5' },
  statusText: { fontFamily: 'Inter_700Bold', fontSize: 9, color: '#62616F' },
  statusAcceptedText: { color: '#2E7E34' },
  routeBox: { flexDirection: 'row', borderWidth: 1, borderColor: '#E1E2E7', borderRadius: 10, padding: 10, gap: 9 },
  routeRail: { width: 27, alignItems: 'center', justifyContent: 'space-between' },
  stopSquare: { width: 25, height: 25, borderRadius: 3, backgroundColor: '#5199D6', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  stopPin: { width: 25, height: 28, borderRadius: 14, borderBottomLeftRadius: 4, backgroundColor: '#5199D6', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  stopNumber: { fontFamily: 'Inter_700Bold', fontSize: 10, color: '#FFFFFF' },
  routeLine: { width: 1, flex: 1, minHeight: 18, backgroundColor: '#CDD2D9' },
  routeCopy: { flex: 1, justifyContent: 'space-between', gap: 12 },
  place: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#4A4958' },
  footer: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 1 },
  quoteLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: .6, color: '#777684' },
  amount: { marginTop: 3, fontFamily: 'Inter_700Bold', fontSize: 20, color: '#292837' },
});