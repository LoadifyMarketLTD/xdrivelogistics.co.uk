import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DriverJob } from '../types/driver';
import { ActionButton } from './ActionButton';
import { RouteBlock } from './RouteBlock';
import { colors, radius, shadow, spacing } from '../theme/tokens';
import { formatDeliveryDate } from '../utils/format';

export function JobCard({
  job,
  actionLabel,
  onOpen,
  onAction,
}: {
  job: DriverJob;
  actionLabel?: string;
  onOpen: () => void;
  onAction?: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.heading}>Delivery Information</Text>
        <Text style={styles.date} numberOfLines={1}>{formatDeliveryDate(job.pickupTime)}</Text>
      </View>
      <RouteBlock pickup={job.pickupLocation} delivery={job.deliveryLocation} />
      <View style={styles.infoBand}>
        <View style={styles.infoRow}><Text style={styles.muted}>Job ID :</Text><Text style={styles.value}>{job.reference}</Text></View>
        <View style={styles.infoRow}><Text style={styles.muted}>Delivery fee:</Text><Text style={styles.value}>{job.price || 'Quote required'}</Text></View>
        <View style={styles.infoRow}><Text style={styles.muted}>Vehicle:</Text><Text style={styles.value}>{job.vehicleRequirement}</Text></View>
      </View>
      <Pressable onPress={onOpen} style={styles.noteRow}>
        <Text style={styles.noteText}>{job.pickupNote || 'Pickup note'}</Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
      {actionLabel && onAction ? <ActionButton label={actionLabel} onPress={onAction} /> : null}
      <ActionButton label="Open Details" onPress={onOpen} outline />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.medium, overflow: 'hidden', paddingTop: spacing.md, gap: spacing.sm, ...shadow },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: spacing.md, gap: 10 },
  heading: { flex: 1, fontFamily: 'Inter_700Bold', fontSize: 16, color: colors.text },
  date: { width: 100, fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.muted, textAlign: 'right' },
  infoBand: { backgroundColor: colors.info, paddingHorizontal: spacing.md, paddingVertical: 11, gap: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  muted: { fontFamily: 'Inter_400Regular', color: '#626262', fontSize: 13 },
  value: { flex: 1, fontFamily: 'Inter_700Bold', color: colors.text, fontSize: 13, textAlign: 'right' },
  noteRow: { marginHorizontal: spacing.md, minHeight: 46, borderWidth: 1, borderColor: colors.border, borderRadius: radius.small, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  noteText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.text },
  chevron: { fontSize: 28, lineHeight: 28, color: colors.black },
});