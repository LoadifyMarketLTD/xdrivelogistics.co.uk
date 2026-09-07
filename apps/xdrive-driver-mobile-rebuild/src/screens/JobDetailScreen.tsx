import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { DriverJob } from '../types/driver';
import { getNextStep, statusLabel } from '../types/statusFlow';
import { ActionButton } from '../components/ActionButton';
import { RouteBlock } from '../components/RouteBlock';
import { colors, radius, shadow, spacing } from '../theme/tokens';

export function JobDetailScreen({
  job,
  busy,
  onBack,
  onAdvance,
}: {
  job: DriverJob;
  busy: boolean;
  onBack: () => void;
  onAdvance: (endpoint: string) => void;
}) {
  const next = getNextStep(job.status);
  return (
    <View style={styles.page}>
      <View style={styles.topbar}>
        <Pressable onPress={onBack} style={styles.back}><Ionicons name="chevron-back" size={24} color={colors.black} /></Pressable>
        <Text style={styles.topTitle}>#{job.reference}</Text>
        <View style={styles.back} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.headerRow}><Text style={styles.ref}>#{job.reference}</Text><Text style={styles.date}>{job.pickupTime}</Text></View>
          <RouteBlock pickup={job.pickupLocation} delivery={job.deliveryLocation} />
          <View style={styles.infoBand}>
            <InfoRow label="Package ID" value={job.reference} />
            <InfoRow label="Delivery fee" value={job.price || 'Not published'} />
            <InfoRow label="Package Item" value={job.cargoType} />
          </View>
          {job.contactName || job.contactPhone ? (
            <View style={styles.contactRow}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{job.contactName?.slice(0, 1).toUpperCase() || 'C'}</Text></View>
              <Text style={styles.contactName}>{job.contactName || 'Delivery contact'}</Text>
              {job.contactPhone ? <ContactButton icon="call" onPress={() => Linking.openURL(`tel:${job.contactPhone}`)} /> : null}
            </View>
          ) : null}
          <NoteRow label="Pickup note" value={job.pickupNote} />
          <NoteRow label="Drop off note" value={job.deliveryNote} />
          <View style={styles.statusArea}>
            <Text style={styles.statusTitle}>Delivery Status</Text>
            <View style={styles.statusBox}><Text style={styles.statusValue}>{statusLabel(job.status)}</Text><Ionicons name="chevron-up" size={19} color={colors.black} /></View>
          </View>
          {next ? <View style={styles.actionWrap}><ActionButton disabled={busy} label={busy ? 'Updating…' : next.label} onPress={() => onAdvance(next.endpoint)} /></View> : null}
        </View>
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label} :</Text><Text style={styles.infoValue}>{value}</Text></View>;
}

function NoteRow({ label, value }: { label: string; value?: string }) {
  return <View style={styles.noteRow}><View><Text style={styles.noteLabel}>{label}</Text>{value ? <Text style={styles.noteValue}>{value}</Text> : null}</View><Ionicons name="chevron-forward" size={22} color={colors.black} /></View>;
}

function ContactButton({ icon, onPress }: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.contactButton}><Ionicons name={icon} size={19} color={colors.black} /></Pressable>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F7F7F7' },
  topbar: { minHeight: 82, paddingTop: 22, paddingHorizontal: spacing.md, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', ...shadow },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontFamily: 'Inter_700Bold', fontSize: 15, color: colors.text },
  content: { padding: spacing.lg, paddingBottom: 42 },
  card: { backgroundColor: colors.surface, borderRadius: radius.medium, overflow: 'hidden', gap: spacing.md, paddingTop: spacing.md, ...shadow },
  headerRow: { paddingHorizontal: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ref: { fontFamily: 'Inter_700Bold', fontSize: 15, color: colors.text },
  date: { fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.muted },
  infoBand: { backgroundColor: colors.info, paddingHorizontal: spacing.md, paddingVertical: 14, gap: 10 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 20 },
  infoLabel: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#626262' },
  infoValue: { flex: 1, textAlign: 'right', fontFamily: 'Inter_700Bold', fontSize: 13, color: colors.text },
  contactRow: { minHeight: 60, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#949494', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'Inter_700Bold', color: colors.surface, fontSize: 16 },
  contactName: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 14, color: colors.text },
  contactButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.iconWell, alignItems: 'center', justifyContent: 'center' },
  noteRow: { marginHorizontal: spacing.md, minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: radius.small, paddingHorizontal: 10, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  noteLabel: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.text },
  noteValue: { marginTop: 3, maxWidth: 250, fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.muted },
  statusArea: { paddingHorizontal: spacing.md, gap: 9 },
  statusTitle: { fontFamily: 'Inter_700Bold', fontSize: 14, color: colors.text },
  statusBox: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.small, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusValue: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.text },
  actionWrap: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
});