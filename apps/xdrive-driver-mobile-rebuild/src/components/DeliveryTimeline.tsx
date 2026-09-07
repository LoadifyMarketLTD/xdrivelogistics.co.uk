import { StyleSheet, Text, View } from 'react-native';
import type { CanonicalJobStatus } from '../types/driver';
import { colors } from '../theme/tokens';

const stages: Array<{ status: CanonicalJobStatus; label: string }> = [
  { status: 'awarded', label: 'Accepted' },
  { status: 'on_my_way_pickup', label: 'On my way to pickup' },
  { status: 'arrived_pickup', label: 'At pickup' },
  { status: 'loaded', label: 'Loaded' },
  { status: 'on_my_way_delivery', label: 'On my way to delivery' },
  { status: 'arrived_delivery', label: 'At delivery' },
  { status: 'delivered', label: 'Delivered' },
];

export function DeliveryTimeline({ status }: { status: CanonicalJobStatus }) {
  if (status === 'available') return null;
  const activeIndex = Math.max(0, stages.findIndex((item) => item.status === status));
  return <View style={styles.wrap}>
    <Text style={styles.heading}>Delivery progress</Text>
    {stages.map((stage, index) => <View key={stage.status} style={styles.row}>
      <View style={styles.markerColumn}><View style={[styles.dot, index <= activeIndex && styles.dotActive]} />{index < stages.length - 1 ? <View style={[styles.line, index < activeIndex && styles.lineActive]} /> : null}</View>
      <Text style={[styles.label, index <= activeIndex && styles.labelActive]}>{stage.label}</Text>
    </View>)}
  </View>;
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingVertical: 4 },
  heading: { marginBottom: 10, fontFamily: 'Inter_700Bold', fontSize: 14, color: colors.text },
  row: { minHeight: 36, flexDirection: 'row', alignItems: 'flex-start' },
  markerColumn: { width: 24, alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 3, backgroundColor: '#D8D8D8' },
  dotActive: { backgroundColor: colors.primary },
  line: { width: 2, flex: 1, minHeight: 22, marginVertical: 2, backgroundColor: '#E1E1E1' },
  lineActive: { backgroundColor: colors.primary },
  label: { flex: 1, paddingBottom: 12, fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.muted },
  labelActive: { fontFamily: 'Inter_600SemiBold', color: colors.text },
});