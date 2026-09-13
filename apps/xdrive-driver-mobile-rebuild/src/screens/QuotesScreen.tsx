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
    <View style={styles.header}><Text style={styles.title}>Quotes</Text></View>
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
            <View style={styles.headerCopy}><Text style={styles.company} numberOfLines={1}>{companyName}{companyId ? ` (${companyId})` : ''}</Text><Text style={styles.loadId}>Load ID {job?.reference || jobId || '—'}</Text></View>
            <View style={[styles.statusPill, accepted && styles.statusAccepted]}><Text style={[styles.statusText, accepted && styles.statusAcceptedText]}>{status}</Text></View>
          </View>
          <View style={styles.routeBox}>
            <View style={styles.routeRail}><View style={styles.stopSquare}><Text style={styles.stopNumber}>1</Text></View><Text style={styles.routeDots}>•••</Text><View style={styles.stopPin}><Text style={styles.stopNumber}>2</Text></View></View>
            <View style={styles.routeCopy}><Text style={styles.place} numberOfLines={1}>{pickup}</Text><Text style={styles.place} numberOfLines={1}>{delivery}</Text></View>
          </View>
          <View style={styles.footer}><View><Text style={styles.quoteLabel}>MY QUOTE (EXC. VAT)</Text><Text style={styles.amount}>{quoteAmount(quote)}</Text></View><UiIcon name="chevron-forward" size={22} color="#A9AAB2" /></View>
        </Pressable>;
      })}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F2F3F7' },
  header: { minHeight: 86, backgroundColor: '#292837', alignItems: 'center', justifyContent: 'center', paddingTop: 12 },
  title: { fontFamily: 'Inter_600SemiBold', fontSize: 20, color: '#FFFFFF' },
  segmented: { margin: 16, flexDirection: 'row', minHeight: 58, padding: 4, borderRadius: 30, backgroundColor: '#3A3949' },
  segment: { flex: 1, borderRadius: 25, alignItems: 'center', justifyContent: 'center', gap: 2 },
  segmentActive: { backgroundColor: '#FFE66A' },
  segmentText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#FFFFFF' },
  segmentTextActive: { fontFamily: 'Inter_700Bold', color: '#111111' },
  count: { minWidth: 20, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: '#555463', alignItems: 'center', justifyContent: 'center' },
  countActive: { backgroundColor: '#292837' },
  countText: { fontFamily: 'Inter_700Bold', fontSize: 9, color: '#FFFFFF' },
  countTextActive: { color: '#FFE66A' },
  list: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 28, gap: 14 },
  empty: { borderRadius: 18, backgroundColor: '#FFFFFF', padding: 24, alignItems: 'center' },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#292837' },
  emptyText: { marginTop: 6, fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 19, color: '#777684', textAlign: 'center' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, gap: 14, ...shadow },
  pressed: { opacity: .78 },
  disabled: { opacity: .72 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  headerCopy: { flex: 1 },
  company: { fontFamily: 'Inter_700Bold', fontSize: 17, color: '#4A4958' },
  loadId: { marginTop: 4, fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#777684' },
  statusPill: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#ECEEF2' },
  statusAccepted: { backgroundColor: '#E8F6E5' },
  statusText: { fontFamily: 'Inter_700Bold', fontSize: 11, color: '#62616F' },
  statusAcceptedText: { color: '#2E7E34' },
  routeBox: { flexDirection: 'row', borderWidth: 1, borderColor: '#E1E2E7', borderRadius: 16, padding: 14, gap: 12 },
  routeRail: { width: 34, alignItems: 'center', justifyContent: 'space-between' },
  stopSquare: { width: 28, height: 28, borderRadius: 4, backgroundColor: '#5199D6', alignItems: 'center', justifyContent: 'center' },
  stopPin: { width: 28, height: 32, borderRadius: 16, borderBottomLeftRadius: 5, backgroundColor: '#5199D6', alignItems: 'center', justifyContent: 'center' },
  stopNumber: { fontFamily: 'Inter_700Bold', fontSize: 12, color: '#FFFFFF' },
  routeDots: { transform: [{ rotate: '90deg' }], color: '#CDD2D9', letterSpacing: 1 },
  routeCopy: { flex: 1, justifyContent: 'space-between', gap: 20 },
  place: { fontFamily: 'Inter_700Bold', fontSize: 17, color: '#4A4958' },
  footer: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 2 },
  quoteLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: .8, color: '#777684' },
  amount: { marginTop: 4, fontFamily: 'Inter_700Bold', fontSize: 22, color: '#292837' },
});