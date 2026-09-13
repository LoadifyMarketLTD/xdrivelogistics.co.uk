import { UiIcon as Ionicons } from './UiIcon';
import { Linking, StyleSheet } from 'react-native';
import { Pressable, Text, View } from '../theme/primitives';

export function RouteBlock({ pickup, delivery, pickupTiming, deliveryTiming }: { pickup: string; delivery: string; pickupTiming?: string; deliveryTiming?: string }) {
  const openRoute = () => {
    const origin = encodeURIComponent(pickup);
    const destination = encodeURIComponent(delivery);
    void Linking.openURL(`https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.routeRow}>
        <View style={styles.rail}>
          <View style={styles.square}><Text style={styles.markerText}>1</Text></View>
          <View style={styles.line} />
          <View style={styles.pin}><Text style={styles.markerText}>2</Text></View>
        </View>
        <View style={styles.copy}>
          <View>
            <Text style={styles.place} numberOfLines={2}>{pickup}</Text>
            <Text style={styles.time}>{pickupTiming || 'Collection'}</Text>
          </View>
          <View>
            <Text style={styles.place} numberOfLines={2}>{delivery}</Text>
            <Text style={styles.time}>{deliveryTiming || 'Delivery'}</Text>
          </View>
        </View>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="View route map" onPress={openRoute} style={({ pressed }) => [styles.mapButton, pressed && styles.pressed]}>
        <Ionicons name="map-outline" size={19} color="#FFFFFF" />
        <Text style={styles.mapButtonText}>View Route Map</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  routeRow: { flexDirection: 'row', gap: 12 },
  rail: { width: 34, alignItems: 'center', justifyContent: 'space-between' },
  square: { width: 28, height: 28, borderRadius: 4, backgroundColor: '#5199D6', alignItems: 'center', justifyContent: 'center' },
  pin: { width: 28, height: 32, borderRadius: 16, borderBottomLeftRadius: 5, backgroundColor: '#5199D6', alignItems: 'center', justifyContent: 'center' },
  markerText: { fontFamily: 'Inter_700Bold', fontSize: 12, color: '#FFFFFF' },
  line: { width: 2, flex: 1, minHeight: 34, marginVertical: 5, borderRadius: 1, backgroundColor: '#D6D9DF' },
  copy: { flex: 1, justifyContent: 'space-between', gap: 20 },
  place: { fontFamily: 'Inter_700Bold', fontSize: 18, lineHeight: 23, color: '#4A4958' },
  time: { marginTop: 4, fontFamily: 'Inter_500Medium', fontSize: 14, color: '#7F7E8C' },
  mapButton: { minHeight: 46, borderRadius: 23, backgroundColor: '#4D97D5', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  mapButtonText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#FFFFFF' },
  pressed: { opacity: 0.82 },
});