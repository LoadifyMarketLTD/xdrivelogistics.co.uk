import { StyleSheet } from 'react-native';
import { Text, View } from '../theme/primitives';
import type { CanonicalJobStatus } from '../types/driver';

const stages: Array<{ status: CanonicalJobStatus; label: string }> = [
  { status: 'awarded', label: 'Accepted' },
  { status: 'on_my_way_pickup', label: 'On My Way to Collection' },
  { status: 'arrived_pickup', label: 'On Site (Collection)' },
  { status: 'loaded', label: 'Loaded' },
  { status: 'on_my_way_delivery', label: 'On My Way to Delivery' },
  { status: 'arrived_delivery', label: 'On Site (Delivery)' },
  { status: 'delivered', label: 'Delivered (POD)' },
];

export function DeliveryTimeline({ status }: { status: CanonicalJobStatus }) {
  if (status === 'available' || status === 'cancelled') return null;
  const activeIndex = Math.max(0, stages.findIndex((item) => item.status === status));
  return <View style={styles.wrap}>
    {stages.slice().reverse().map((stage) => {
      const originalIndex = stages.findIndex((item) => item.status === stage.status);
      const complete = originalIndex <= activeIndex;
      return <View key={stage.status} style={styles.row}>
        <View style={styles.markerColumn}>
          <View style={[styles.dot, complete && styles.dotActive]}>{complete ? <Text style={styles.check}>✓</Text> : null}</View>
          {originalIndex > 0 ? <View style={[styles.line, originalIndex <= activeIndex && styles.lineActive]} /> : null}
        </View>
        <View style={styles.copy}>
          <Text style={[styles.label, complete && styles.labelActive]}>{stage.label}</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </View>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 4, paddingVertical: 2 },
  row: { minHeight: 58, flexDirection: 'row', alignItems: 'flex-start' },
  markerColumn: { width: 42, alignItems: 'center' },
  dot: { width: 24, height: 24, borderRadius: 12, marginTop: 1, backgroundColor: '#D8D9DE', alignItems: 'center', justifyContent: 'center' },
  dotActive: { backgroundColor: '#65C653' },
  check: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#FFFFFF', lineHeight: 16 },
  line: { width: 3, flex: 1, minHeight: 28, marginVertical: 3, backgroundColor: '#E1E2E6', borderRadius: 2 },
  lineActive: { backgroundColor: '#D8D9DE' },
  copy: { flex: 1, paddingTop: 1, paddingBottom: 12 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#858491' },
  labelActive: { color: '#292837' },
  chevron: { paddingTop: 0, fontFamily: 'Inter_500Medium', fontSize: 28, lineHeight: 28, color: '#B0B1B8' },
});