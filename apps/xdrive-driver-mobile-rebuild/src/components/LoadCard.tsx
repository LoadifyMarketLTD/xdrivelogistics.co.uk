import { UiIcon as Ionicons } from './UiIcon';
import { StyleSheet } from 'react-native';
import { Pressable, Text, View } from '../theme/primitives';
import type { DriverJob } from '../types/driver';
import { colors, radius } from '../theme/tokens';
import { formatDeliveryDate } from '../utils/format';

export function LoadCard({ job, onOpen, tone = 'default' }: { job: DriverJob; onOpen: () => void; tone?: 'default' | 'xdrive' }) {
  const xdrive = tone === 'xdrive';
  const tags = [job.serviceMode ? job.serviceMode.replace(/_/g, ' ').toUpperCase() : '', job.directDeliveryRequired ? 'DIRECT DELIVERY' : ''].filter(Boolean);
  const distanceBits = [job.distanceToPickupMiles != null ? `${job.distanceToPickupMiles.toFixed(1)} mi to pickup` : '', job.journeyDistanceMiles != null ? `${job.journeyDistanceMiles.toFixed(1)} mi trip` : '', job.estimatedJourneyMinutes != null ? `${Math.round(job.estimatedJourneyMinutes)} min` : ''].filter(Boolean);
  const badgeText = job.status === 'available' ? (job.price || 'QUOTE') : job.status === 'cancelled' ? 'CANCELLED' : job.status === 'delivered' ? 'COMPLETED' : (job.price || 'VIEW');
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open load ${job.reference}`} onPress={onOpen} style={({ pressed }) => [styles.card, xdrive && styles.xdriveCard, pressed && styles.pressed]}>
    <View style={styles.topRow}>
      <View style={styles.refWrap}>
        <Text style={[styles.reference, xdrive && styles.xdriveReference]}>{job.postingCompanyName || 'Company withheld'}</Text>
        <Text style={styles.memberLine}>{job.postingCompanyMemberCode ? `Member ${job.postingCompanyMemberCode} | ${job.reference}` : job.reference}</Text>
        {job.postedAt ? <Text style={[styles.time, xdrive && styles.xdriveMuted]}>Posted {formatDeliveryDate(job.postedAt)}</Text> : null}
      </View>
    </View>
    {tags.length ? <View style={styles.tagsRow}>{tags.map(tag => <View key={tag} style={styles.tagPill}><Text style={styles.tagPillText}>{tag}</Text></View>)}</View> : null}
    <View style={styles.routeRow}>
      <View style={styles.routeIcon}><View style={[styles.dot, xdrive && styles.xdriveDot]} /><View style={styles.line} /><Ionicons name="location" size={17} color={xdrive ? '#F5A300' : colors.black} /></View>
      <View style={styles.routeCopy}>
        <Text style={[styles.place, xdrive && styles.xdrivePlace]} numberOfLines={1}>{job.pickupLocation}</Text>
        <Text style={styles.routeTime}>{formatDeliveryDate(job.pickupTime)}</Text>
        <Text style={styles.routeLabel}>COLLECTION</Text>
        <View style={styles.destinationRow}>
          <View style={styles.destinationCopy}>
            <Text style={[styles.place, xdrive && styles.xdrivePlace]} numberOfLines={1}>{job.deliveryLocation}</Text>
            <Text style={styles.routeTime}>{formatDeliveryDate(job.deliveryTime)}</Text>
            <Text style={styles.routeLabel}>DELIVERY</Text>
          </View>
          <View style={[styles.quoteBadge, xdrive && styles.xdriveQuoteBadge, job.status === 'cancelled' && styles.closedBadge]}>
            <Text style={[styles.quoteBadgeText, xdrive && styles.xdriveQuoteText]}>{badgeText}</Text>
          </View>
        </View>
      </View>
    </View>
    {distanceBits.length ? <Text style={styles.distanceLine}>{distanceBits.join(' | ')}</Text> : null}
    {(job.notesSummary || job.pickupNote || job.deliveryNote) ? <Text style={styles.notesPreview} numberOfLines={2}>{job.notesSummary || job.pickupNote || job.deliveryNote}</Text> : null}
    <View style={styles.divider} />
    <View style={styles.metaRow}>
      <View style={styles.meta}><Ionicons name="car-outline" size={16} color="#1D57D8" /><View><Text style={styles.metaLabel}>VEHICLE</Text><Text style={styles.metaValue} numberOfLines={1}>{job.vehicleRequirement || 'Not specified'}</Text></View></View>
      <View style={styles.meta}><Ionicons name="cube-outline" size={16} color="#1D57D8" /><View><Text style={styles.metaLabel}>CARGO</Text><Text style={styles.metaValue} numberOfLines={1}>{job.cargoType || 'Not specified'}</Text></View></View>
      <Ionicons name="chevron-forward" size={21} color="#8EA0B9" />
    </View>
  </Pressable>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.medium, paddingHorizontal: 14, paddingVertical: 13, gap: 10 },
  pressed: { opacity: 0.8 },  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  refWrap: { flex: 1 },
  reference: { fontFamily: 'Inter_700Bold', fontSize: 16, color: colors.text },
  memberLine: { marginTop: 2, fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#64748B' },
  time: { marginTop: 2, fontFamily: 'Inter_600SemiBold', fontSize: 11, color: colors.muted },
  quoteBadge: { minWidth: 100, minHeight: 46, borderRadius: 12, paddingHorizontal: 17, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F0F0' },
  quoteBadgeText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#FFFFFF' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tagPill: { backgroundColor: '#E8F0FF', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  tagPillText: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: .4, color: '#1D57D8' },
  routeRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  routeIcon: { width: 24, alignItems: 'center' },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.black },
  line: { width: 1, height: 28, borderStyle: 'dashed', borderWidth: 1, borderColor: '#AAB6C5' },
  routeCopy: { flex: 1 },
  destinationRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  destinationCopy: { flex: 1, minWidth: 0 },
  place: { fontFamily: 'Inter_700Bold', fontSize: 15, lineHeight: 20, color: colors.text },
  routeTime: { marginTop: 2, fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#3F4A5A' },
  routeLabel: { marginTop: 1, marginBottom: 7, fontFamily: 'Inter_600SemiBold', fontSize: 9, letterSpacing: .8, color: '#475569' },
  distanceLine: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#0B2F6B' },
  notesPreview: { backgroundColor: '#F1F5F9', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7, fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 15, color: '#344054' },
  divider: { height: 1, backgroundColor: '#DCE3EC' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  meta: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 7 },
  metaLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 9, letterSpacing: .6, color: '#475569' },
  metaValue: { marginTop: 1, fontFamily: 'Inter_700Bold', fontSize: 15, lineHeight: 20, color: '#172033', maxWidth: 115 },
  xdriveCard: { backgroundColor: '#FFFFFF', borderWidth: 1.2, borderColor: '#CBD5E1' },  xdriveReference: { color: '#0B2F6B' },
  xdriveMuted: { color: '#64748B' },
  xdriveDot: { backgroundColor: '#1D57D8' },
  xdrivePlace: { color: '#172033' },
  xdriveQuoteBadge: { backgroundColor: '#16A34A' },
  xdriveQuoteText: { color: '#FFFFFF' },
  closedBadge: { backgroundColor: '#64748B' },
});