import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { DriverResources } from '../types/driver';
import { colors, radius, spacing } from '../theme/tokens';

function value(row: Record<string, unknown>, keys: string[], fallback: string) {
  for (const key of keys) {
    const raw = row[key];
    if (raw !== null && raw !== undefined && String(raw).trim()) return String(raw);
  }
  return fallback;
}

export function WalletScreen({ resources }: { resources?: DriverResources }) {
  const invoices = resources?.invoices ?? [];
  const quotes = resources?.quotes ?? [];
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Wallet</Text>
      <View style={styles.summary}>
        <Text style={styles.summaryLabel}>Invoices</Text>
        <Text style={styles.summaryValue}>{invoices.length}</Text>
        <Text style={styles.summaryMeta}>{quotes.length} quote{quotes.length === 1 ? '' : 's'} on record</Text>
      </View>
      <Text style={styles.sectionTitle}>Recent invoices</Text>
      {invoices.length ? invoices.map((invoice, index) => (
        <View key={String(invoice.id ?? index)} style={styles.rowCard}>
          <View><Text style={styles.rowTitle}>{value(invoice, ['invoice_number', 'id'], 'Invoice')}</Text><Text style={styles.rowMeta}>{value(invoice, ['client_name', 'status'], 'XDrive job')}</Text></View>
          <View><Text style={styles.amount}>{value(invoice, ['amount'], '—')}</Text><Text style={styles.status}>{value(invoice, ['payment_status', 'status'], 'Pending')}</Text></View>
        </View>
      )) : <Empty text="No invoices available yet." />}
      <Text style={styles.sectionTitle}>Quotes</Text>
      {quotes.slice(0, 8).map((quote, index) => (
        <View key={String(quote.id ?? index)} style={styles.rowCard}>
          <View><Text style={styles.rowTitle}>{value(quote, ['job_reference', 'job_id'], 'Delivery quote')}</Text><Text style={styles.rowMeta}>{value(quote, ['status'], 'Submitted')}</Text></View>
          <Text style={styles.amount}>{value(quote, ['amount', 'bid_price_gbp'], '—')}</Text>
        </View>
      ))}
      {!quotes.length ? <Empty text="No quotes available yet." /> : null}
    </ScrollView>
  );
}

function Empty({ text }: { text: string }) {
  return <View style={styles.empty}><Text style={styles.emptyText}>{text}</Text></View>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.appBackground },
  content: { padding: spacing.lg, paddingBottom: 40, gap: 12 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 24, color: colors.surface, marginBottom: 4 },
  summary: { backgroundColor: colors.info, borderRadius: radius.medium, padding: spacing.lg },
  summaryLabel: { fontFamily: 'Inter_600SemiBold', color: '#626262', fontSize: 13 },
  summaryValue: { marginTop: 3, fontFamily: 'Inter_700Bold', color: colors.text, fontSize: 36 },
  summaryMeta: { marginTop: 3, fontFamily: 'Inter_400Regular', color: colors.muted, fontSize: 12 },
  sectionTitle: { marginTop: 7, fontFamily: 'Inter_700Bold', fontSize: 15, color: colors.surface },
  rowCard: { minHeight: 74, backgroundColor: colors.surface, borderRadius: radius.medium, paddingHorizontal: spacing.md, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: colors.text },
  rowMeta: { marginTop: 3, fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.muted },
  amount: { fontFamily: 'Inter_700Bold', fontSize: 14, color: colors.text, textAlign: 'right' },
  status: { marginTop: 3, fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.primary, textAlign: 'right' },
  empty: { backgroundColor: colors.surface, borderRadius: radius.medium, padding: spacing.lg },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.muted, textAlign: 'center' },
});