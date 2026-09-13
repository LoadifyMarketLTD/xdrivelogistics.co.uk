import { StyleSheet } from 'react-native';
import { Text, View } from '../theme/primitives';

export function RouteBlock({ pickup, delivery, pickupTiming, deliveryTiming }: {
  pickup: string;
  delivery: string;
  pickupTiming?: string;
  deliveryTiming?: string;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.rail}>
        <View style={styles.square}><Text style={styles.markerText}>1</Text></View>
        <Text style={styles.dots}>•••</Text>
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
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 132,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rail: { width: 34, alignItems: 'center', justifyContent: 'space-between' },
  square: {
    width: 30,
    height: 30,
    borderRadius: 4,
    backgroundColor: '#5199D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pin: {
    width: 30,
    height: 34,
    borderRadius: 17,
    borderBottomLeftRadius: 5,
    backgroundColor: '#5199D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerText: { fontFamily: 'Inter_700Bold', fontSize: 12, color: '#FFFFFF' },
  dots: { transform: [{ rotate: '90deg' }], color: '#CDD2D9', letterSpacing: 1 },
  copy: { flex: 1, justifyContent: 'space-between', gap: 20 },
  place: { fontFamily: 'Inter_700Bold', fontSize: 18, lineHeight: 22, color: '#474655' },
  time: { marginTop: 4, fontFamily: 'Inter_500Medium', fontSize: 14, color: '#7D7C8A' },
});
