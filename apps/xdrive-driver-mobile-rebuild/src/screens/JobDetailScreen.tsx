import { useState } from 'react';
import { UiIcon as Ionicons } from '../components/UiIcon';
import { Linking, StyleSheet } from 'react-native';
import { Pressable, ScrollView, Text, View } from '../theme/primitives';
import type { DriverJob } from '../types/driver';
import { getNextStep, statusLabel } from '../types/statusFlow';
import { ActionButton } from '../components/ActionButton';
import { RouteBlock } from '../components/RouteBlock';
import { DeliveryTimeline } from '../components/DeliveryTimeline';
import { colors, radius, shadow, spacing } from '../theme/tokens';
import { formatDeliveryDate } from '../utils/format';

type DetailTab = 'summary' | 'stops' | 'status';

export function JobDetailScreen({ job, busy, onBack, onAdvance }: {
  job: DriverJob;
  busy: boolean;
  onBack: () => void;
  onAdvance: (endpoint: string) => void;
}) {
  const [tab, setTab] = useState<DetailTab>('summary');
  const next = getNextStep(job.status);
  return <View style={styles.page}>
    <View style={styles.topbar}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to deliveries" onPress={onBack} style={styles.back}><Ionicons name="chevron-back" size={24} color="#FFFFFF" /></Pressable>
      <Text style={styles.topTitle}>#{job.reference}</Text><View style={styles.back} />
    </View>
    <View style={styles.tabs}>{(['summary', 'stops', 'status'] as DetailTab[]).map((item) => <Pressable key={item} accessibilityRole="tab" accessibilityLabel={`${item.charAt(0).toUpperCase() + item.slice(1)} tab`} accessibilityState={{ selected: tab === item }} onPress={() => setTab(item)} style={[styles.tab, tab === item && styles.tabActive]}><Text style={[styles.tabText, tab === item && styles.tabTextActive]}>{item.charAt(0).toUpperCase() + item.slice(1)}</Text></Pressable>)}</View>
    <ScrollView contentContainerStyle={styles.content}>
      {tab === 'summary' ? <View style={styles.card}>
        <View style={styles.headerRow}><Text style={styles.sectionTitle}>Delivery Details</Text><Text style={styles.date}>{formatDeliveryDate(job.pickupTime)}</Text></View>
        <RouteBlock pickup={job.pickupLocation} delivery={job.deliveryLocation} />
        <View style={styles.infoBand}>
          <InfoRow label="Job ID" value={job.reference} />
          <InfoRow label="Vehicle" value={job.vehicleRequirement} />
          <InfoRow label="Cargo" value={job.cargoType} />
          <InfoRow label="Delivery fee" value={job.price || 'Not published'} />
        </View>
        {job.contactName || job.contactPhone ? <View style={styles.contactRow}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{job.contactName?.slice(0, 1).toUpperCase() || 'C'}</Text></View>
          <Text style={styles.contactName}>{job.contactName || 'Delivery contact'}</Text>
          {job.contactPhone ? <Pressable accessibilityRole="button" accessibilityLabel="Call delivery contact" onPress={() => Linking.openURL(`tel:${job.contactPhone}`)} style={styles.contactButton}><Ionicons name="call" size={19} color={colors.black} /></Pressable> : null}
        </View> : null}
        <NoteRow label="Pickup note" value={job.pickupNote} />
        <NoteRow label="Drop off note" value={job.deliveryNote} />
      </View> : null}
      {tab === 'stops' ? <View style={styles.card}>
        <Text style={styles.blockTitle}>Stops</Text>
        <StopBlock number="1" title="Collection" time={formatDeliveryDate(job.pickupTime)} address={job.pickupLocation} />
        <StopBlock number="2" title="Delivery" time={formatDeliveryDate(job.deliveryTime)} address={job.deliveryLocation} />
      </View> : null}
      {tab === 'status' ? <View style={styles.card}>
        <View style={styles.statusHeader}><Text style={styles.blockTitle}>Delivery Status</Text><Text style={styles.currentStatus}>{statusLabel(job.status)}</Text></View>
        {job.status === 'cancelled' ? <View style={styles.terminalNotice}><Text style={styles.terminalTitle}>Delivery cancelled</Text><Text style={styles.terminalText}>No further driver action is available for this job.</Text></View> : <DeliveryTimeline status={job.status} />}
        {next ? <View style={styles.actionWrap}><ActionButton disabled={busy} label={busy ? 'Updating…' : next.label} onPress={() => onAdvance(next.endpoint)} /></View> : null}
      </View> : null}
    </ScrollView>
  </View>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value || '—'}</Text></View>;
}

function NoteRow({ label, value }: { label: string; value?: string }) {
  return <View style={styles.noteRow}><View style={styles.noteCopy}><Text style={styles.noteLabel}>{label}</Text><Text style={styles.noteValue}>{value || 'No note published.'}</Text></View><Ionicons name="chevron-forward" size={20} color={colors.black} /></View>;
}
function StopBlock({ number, title, time, address }: { number: string; title: string; time: string; address: string }) {
  return <View style={styles.stopRow}>
    <View style={styles.stopNumber}><Text style={styles.stopNumberText}>{number}</Text></View>
    <View style={styles.stopCopy}><Text style={styles.stopTitle}>{title}</Text><Text style={styles.stopTime}>{time}</Text><Text style={styles.stopAddress}>{address}</Text></View>
    <Ionicons name="chevron-forward" size={20} color={colors.black} />
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#EEF2F6' },
  topbar: { minHeight: 82, paddingTop: 22, paddingHorizontal: spacing.md, backgroundColor: '#0B2F6B', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', ...shadow },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, textAlign: 'center', fontFamily: 'Inter_700Bold', fontSize: 16, color: '#FFFFFF' },
  tabs: { margin: spacing.md, marginBottom: 0, padding: 4, backgroundColor: colors.surface, borderRadius: radius.pill, flexDirection: 'row', ...shadow },
  tab: { flex: 1, minHeight: 38, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: colors.muted },
  tabTextActive: { color: colors.surface },
  content: { padding: spacing.md, paddingBottom: 32 },
  card: { backgroundColor: colors.surface, borderRadius: radius.medium, overflow: 'hidden', gap: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.md, ...shadow },
  headerRow: { paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  sectionTitle: { flex: 1, fontFamily: 'Inter_700Bold', fontSize: 15, color: colors.text },
  date: { width: 105, textAlign: 'right', fontFamily: 'Inter_500Medium', fontSize: 12, color: colors.muted },
  infoBand: { backgroundColor: colors.info, paddingHorizontal: spacing.md, paddingVertical: 13, gap: 9 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 15 },
  infoLabel: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#626262' },
  infoValue: { flex: 1, textAlign: 'right', fontFamily: 'Inter_700Bold', fontSize: 13, color: colors.text },
  contactRow: { minHeight: 58, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.iconWell, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'Inter_700Bold', color: colors.primary, fontSize: 15 },
  contactName: { flex: 1, fontFamily: 'Inter_700Bold', fontSize: 14, color: colors.text },
  contactButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.iconWell, alignItems: 'center', justifyContent: 'center' },
  noteRow: { marginHorizontal: spacing.md, minHeight: 56, borderWidth: 1, borderColor: colors.border, borderRadius: radius.small, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  noteCopy: { flex: 1 },
  noteLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: colors.text },
  noteValue: { marginTop: 3, fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 16, color: colors.muted },
  blockTitle: { paddingHorizontal: spacing.md, fontFamily: 'Inter_700Bold', fontSize: 15, color: colors.text },
  stopRow: { marginHorizontal: spacing.md, minHeight: 88, borderWidth: 1, borderColor: colors.border, borderRadius: radius.small, padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stopNumber: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.info, alignItems: 'center', justifyContent: 'center' },
  stopNumberText: { fontFamily: 'Inter_700Bold', fontSize: 12, color: colors.primary },
  stopCopy: { flex: 1 },
  stopTitle: { fontFamily: 'Inter_700Bold', fontSize: 13, color: colors.text },
  stopTime: { marginTop: 3, fontFamily: 'Inter_600SemiBold', fontSize: 11, color: colors.muted },
  stopAddress: { marginTop: 5, fontFamily: 'Inter_700Bold', fontSize: 13, color: colors.text },
  statusHeader: { paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  currentStatus: { maxWidth: 155, textAlign: 'right', fontFamily: 'Inter_600SemiBold', fontSize: 11, color: colors.primary },
  actionWrap: { paddingHorizontal: spacing.md },
  terminalNotice: { marginHorizontal: spacing.md, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: radius.small, backgroundColor: '#F8FAFC', padding: 12 },
  terminalTitle: { fontFamily: 'Inter_700Bold', fontSize: 13, color: '#172033' },
  terminalText: { marginTop: 4, fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 17, color: '#526071' },
});
