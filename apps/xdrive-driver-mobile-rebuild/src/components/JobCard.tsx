import { StyleSheet } from 'react-native';
import { Pressable, Text, View } from '../theme/primitives';
import type { DriverJob } from '../types/driver';
import { ActionButton } from './ActionButton';
import { RouteBlock } from './RouteBlock';
import { colors, radius, shadow, spacing } from '../theme/tokens';
import { formatDeliveryDate, formatRouteTime } from '../utils/format';

export function JobCard({
  job,
  actionLabel,
  onOpen,
  onAction,
  tone = 'default',
}: {
  job: DriverJob;
  actionLabel?: string;
  onOpen: () => void;
  onAction?: () => void;
  tone?: 'default' | 'xdrive';
}) {
  const xdrive = tone === 'xdrive';
  const companyIdentity = [job.postingCompanyName, job.postingCompanyMemberCode].filter(Boolean).join(' | ');
  return (
    <View style={[styles.card, xdrive && styles.xdriveCard]}>
      <View style={styles.header}>
        <Text style={[styles.heading, xdrive && styles.xdriveHeading]}>Delivery Information</Text>
        <Text style={[styles.date, xdrive && styles.xdriveMuted]} numberOfLines={1}>{formatDeliveryDate(job.pickupTime)}</Text>
      </View>
      <RouteBlock pickup={job.pickupLocation} delivery={job.deliveryLocation} pickupTiming={formatRouteTime(job.pickupTiming ?? job.pickupTime)} deliveryTiming={formatRouteTime(job.deliveryTiming ?? job.deliveryTime)} />
      <View style={[styles.infoBand, xdrive && styles.xdriveInfoBand]}>
        <View style={styles.infoRow}><Text style={styles.muted}>Company:</Text><Text style={styles.value}>{companyIdentity || 'XDrive marketplace'}</Text></View>
        <View style={styles.infoRow}><Text style={styles.muted}>Delivery fee:</Text><Text style={styles.value}>{job.price || 'Quote required'}</Text></View>
        <View style={styles.infoRow}><Text style={styles.muted}>Vehicle:</Text><Text style={styles.value}>{job.vehicleRequirement}</Text></View>
      </View>
      <Pressable onPress={onOpen} style={styles.noteRow}>
        <Text style={styles.noteText}>{job.pickupNote || 'Pickup note'}</Text>
        <Text style={styles.chevron}>{'\u203A'}</Text>
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
  date: { width: 100, fontFamily: 'Inter_500Medium', fontSize: 12, color: colors.muted, textAlign: 'right' },
  infoBand: { backgroundColor: colors.info, paddingHorizontal: spacing.md, paddingVertical: 11, gap: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  muted: { fontFamily: 'Inter_500Medium', color: '#4B5563', fontSize: 13 },
  value: { flex: 1, fontFamily: 'Inter_700Bold', color: colors.text, fontSize: 13, textAlign: 'right' },
  noteRow: { marginHorizontal: spacing.md, minHeight: 46, borderWidth: 1, borderColor: colors.border, borderRadius: radius.small, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  noteText: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.text },
  chevron: { fontSize: 28, lineHeight: 28, color: colors.black },
  xdriveCard: { borderWidth: 1, borderColor: '#E3EAF5' },
  xdriveHeading: { color: '#0B2F6B' },
  xdriveMuted: { color: '#64748B' },
  xdriveInfoBand: { backgroundColor: '#EAF1FF' },
});
