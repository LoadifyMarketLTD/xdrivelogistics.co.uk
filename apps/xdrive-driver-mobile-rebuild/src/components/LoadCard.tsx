import { UiIcon as Ionicons } from './UiIcon';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DriverJob } from '../types/driver';
import { colors, radius, spacing } from '../theme/tokens';
import { formatDeliveryDate } from '../utils/format';

export function LoadCard({ job, onOpen }: { job: DriverJob; onOpen: () => void }) {
  return (
    <Pressable onPress={onOpen} style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.reference}>{job.reference}</Text>
        <Text style={styles.time}>{formatDeliveryDate(job.pickupTime)}</Text>
      </View>
      <View style={styles.routeRow}>
        <View style={styles.routeIcon}><View style={styles.dot} /><View style={styles.line} /><Ionicons name="location" size={16} color={colors.black} /></View>
        <View style={styles.routeCopy}>
          <Text style={styles.place} numberOfLines={1}>{job.pickupLocation}</Text>
          <Text style={styles.place} numberOfLines={1}>{job.deliveryLocation}</Text>
        </View>
      </View>
      <View style={styles.metaRow}>
        <View style={styles.tag}><Ionicons name="cube-outline" size={15} color={colors.primary} /><Text style={styles.tagText}>{job.cargoType}</Text></View>
        <View style={styles.tag}><Ionicons name="car-outline" size={15} color={colors.primary} /><Text style={styles.tagText}>{job.vehicleRequirement}</Text></View>
        {job.price ? <Text style={styles.price}>{job.price}</Text> : job.status === 'available' ? <Text style={styles.price}>Quote</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.medium, paddingHorizontal: 12, paddingVertical: 11, gap: 8 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  reference: { flex: 1, fontFamily: 'Inter_700Bold', fontSize: 14, color: colors.text },
  time: { fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.muted },
  routeRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  routeIcon: { width: 24, alignItems: 'center' },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.black },
  line: { width: 1, height: 14, borderStyle: 'dashed', borderWidth: 1, borderColor: '#A0A0A0' },
  routeCopy: { flex: 1, gap: 6 },
  place: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.iconWell, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 4 },
  tagText: { fontFamily: 'Inter_400Regular', fontSize: 10, color: '#626262', maxWidth: 86 },
  price: { marginLeft: 'auto', fontFamily: 'Inter_700Bold', fontSize: 13, color: colors.primary },
});