import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { DriverJob, DriverResources } from '../types/driver';
import { colors, radius, spacing } from '../theme/tokens';

function pick(row: Record<string, unknown>, keys: string[], fallback = '\u2014') {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim()) return String(value);
  }
  return fallback;
}

function quoteAmount(row: Record<string, unknown>) {
  const raw = pick(row, ['amount', 'bid_price_gbp', 'price'], '\u2014');
  if (raw === '\u2014' || raw.startsWith('\u00A3')) return raw;
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? `\u00A3${numeric.toFixed(2)}` : raw;
}

function quoteStatus(row: Record<string, unknown>) {
  const raw = pick(row, ['status', 'quote_status'], 'Submitted').toLowerCase();
  if (['accepted', 'won', 'awarded'].includes(raw)) return 'Accepted';
  if (['declined', 'rejected', 'unsuccessful', 'lost'].includes(raw)) return 'Unsuccessful';
  if (['withdrawn', 'cancelled'].includes(raw)) return 'Withdrawn';
  return 'Submitted';
}

export function QuotesScreen({ resources, jobs = [] }: { resources?: DriverResources; jobs?: DriverJob[] }) {
  const quotes = resources?.quotes ?? [];
  const jobsById = new Map(jobs.map((job) => [job.id, job]));
  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>XDrive Driver</Text>
    <Text style={styles.title}>Quotes</Text>
    <Text style={styles.subtitle}>Quotes you have submitted for available loads.</Text>
    {quotes.length ? quotes.map((quote, index) => {
      const status = quoteStatus(quote);
      const jobId = pick(quote, ['job_id', 'load_id'], '');
      const job = jobId ? jobsById.get(jobId) : undefined;
      const directReference = pick(quote, ['job_reference', 'load_reference'], '');
      const reference = job?.reference || directReference || (jobId ? `XDL-${jobId.slice(0, 8).toUpperCase()}` : 'Load quote');
      const route = job
        ? `${job.pickupLocation} → ${job.deliveryLocation}`
        : pick(quote, ['route', 'pickup_location', 'collection'], 'XDrive load');
      return <View key={String(quote.id ?? index)} style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.ref}>{reference}</Text>
          <Text style={styles.amount}>{quoteAmount(quote)}</Text>
        </View>
        <Text style={styles.route} numberOfLines={2}>{route}</Text>
        <View style={[styles.badge, status === 'Accepted' ? styles.accepted : status === 'Unsuccessful' ? styles.failed : undefined]}>
          <Text style={styles.badgeText}>{status}</Text>
        </View>
      </View>;
    }) : <View style={styles.empty}>
      <Text style={styles.emptyTitle}>No submitted quotes</Text>
      <Text style={styles.emptyText}>When you quote on a load, it will appear here.</Text>
    </View>}
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.appBackground },
  content: { padding: spacing.lg, paddingBottom: 30, gap: 12 },
  eyebrow: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#ECECEC' },
  title: { fontFamily: 'Inter_700Bold', fontSize: 26, color: colors.surface },
  subtitle: { marginBottom: 2, fontFamily: 'Inter_400Regular', fontSize: 12, color: '#ECECEC' },
  card: { backgroundColor: colors.surface, borderRadius: radius.medium, padding: spacing.md, gap: 9 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  ref: { flex: 1, fontFamily: 'Inter_700Bold', fontSize: 14, color: colors.text },
  amount: { fontFamily: 'Inter_700Bold', fontSize: 14, color: colors.primary },
  route: { fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.muted },
  badge: { alignSelf: 'flex-start', backgroundColor: colors.info, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  accepted: { backgroundColor: '#E7F6ED' },
  failed: { backgroundColor: '#FCEAEA' },
  badgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: colors.text },
  empty: { backgroundColor: colors.surface, borderRadius: radius.medium, padding: spacing.lg, alignItems: 'center' },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 15, color: colors.text },
  emptyText: { marginTop: 5, fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.muted, textAlign: 'center' },
});
