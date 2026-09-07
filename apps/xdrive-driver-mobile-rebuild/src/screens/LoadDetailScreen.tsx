import { useState } from 'react';
import { UiIcon as Ionicons } from '../components/UiIcon';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { DriverJob } from '../types/driver';
import { RouteBlock } from '../components/RouteBlock';
import { ActionButton } from '../components/ActionButton';
import { colors, radius, shadow, spacing } from '../theme/tokens';
import { formatDeliveryDate } from '../utils/format';

export function LoadDetailScreen({ job, busy, onBack, onQuote }: {
  job: DriverJob;
  busy: boolean;
  onBack: () => void;
  onQuote: (amount: number) => void;
}) {
  const [quote, setQuote] = useState('');
  const amount = Number(quote.replace(/[^0-9.]/g, ''));
  return <View style={styles.page}>
    <View style={styles.topbar}>
      <Pressable onPress={onBack} style={styles.back}><Ionicons name="chevron-back" size={24} color={colors.black} /></Pressable>
      <Text style={styles.topTitle}>Load {job.reference}</Text><View style={styles.back} />
    </View>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.header}><Text style={styles.heading}>Delivery Information</Text><Text style={styles.date}>{formatDeliveryDate(job.pickupTime)}</Text></View>
        <RouteBlock pickup={job.pickupLocation} delivery={job.deliveryLocation} />
        <View style={styles.infoBand}>
          <InfoRow label="Load ID" value={job.reference} />
          <InfoRow label="Vehicle" value={job.vehicleRequirement} />
          <InfoRow label="Cargo" value={job.cargoType} />
          <InfoRow label="Collection" value={formatDeliveryDate(job.pickupTime)} />
          <InfoRow label="Delivery" value={formatDeliveryDate(job.deliveryTime)} />
        </View>
        <View style={styles.notes}>
          <Text style={styles.notesTitle}>Job instructions</Text>
          <Text style={styles.notesText}>{job.pickupNote || job.deliveryNote || 'No additional instructions published.'}</Text>
        </View>
        <View style={styles.quoteBox}>
          <Text style={styles.quoteLabel}>Your quote</Text>
          <View style={styles.quoteInputRow}><Text style={styles.pound}>£</Text><TextInput keyboardType="decimal-pad" value={quote} onChangeText={setQuote} placeholder="0.00" placeholderTextColor={colors.muted} style={styles.quoteInput} /></View>
          <ActionButton disabled={busy || !Number.isFinite(amount) || amount <= 0} label={busy ? 'Submitting…' : 'Submit Quote'} onPress={() => onQuote(amount)} />
        </View>
      </View>
    </ScrollView>
  </View>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value || '—'}</Text></View>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F7F7F7' },
  topbar: { minHeight: 82, paddingTop: 22, paddingHorizontal: spacing.md, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', ...shadow },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, textAlign: 'center', fontFamily: 'Inter_700Bold', fontSize: 15, color: colors.text },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 32 },
  card: { backgroundColor: colors.surface, borderRadius: radius.medium, overflow: 'hidden', gap: spacing.md, paddingTop: spacing.md, ...shadow },
  header: { paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  heading: { flex: 1, fontFamily: 'Inter_700Bold', fontSize: 16, color: colors.text },
  date: { width: 105, textAlign: 'right', fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.muted },
  infoBand: { backgroundColor: colors.info, paddingHorizontal: spacing.md, paddingVertical: 13, gap: 9 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 15 },
  infoLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#626262' },
  infoValue: { flex: 1, textAlign: 'right', fontFamily: 'Inter_600SemiBold', fontSize: 12, color: colors.text },
  notes: { marginHorizontal: spacing.md, backgroundColor: '#F4F6F8', borderRadius: radius.small, padding: spacing.md },
  notesTitle: { fontFamily: 'Inter_700Bold', fontSize: 13, color: colors.text },
  notesText: { marginTop: 6, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, color: '#626262' },
  quoteBox: { marginHorizontal: spacing.md, marginBottom: spacing.md, gap: 10 },
  quoteLabel: { fontFamily: 'Inter_700Bold', fontSize: 13, color: colors.text },
  quoteInputRow: { height: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.small, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  pound: { marginRight: 4, fontFamily: 'Inter_700Bold', fontSize: 16, color: colors.text },
  quoteInput: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 15, color: colors.text },
});
