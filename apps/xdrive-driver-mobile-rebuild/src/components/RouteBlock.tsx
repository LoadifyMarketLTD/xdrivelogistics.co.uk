import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/tokens';

export function RouteBlock({ pickup, delivery }: { pickup: string; delivery: string }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconColumn}>
        <View style={styles.iconWell}><View style={styles.dot} /></View>
        <View style={styles.dash} />
        <View style={styles.iconWell}><Ionicons name="location" size={20} color={colors.black} /></View>
      </View>
      <View style={styles.addressColumn}>
        <View style={styles.addressPill}>
          <Text style={styles.title}>Pickup <Text style={styles.green}>(Collection)</Text></Text>
          <Text style={styles.sub} numberOfLines={2}>{pickup}</Text>
        </View>
        <View style={styles.addressPill}>
          <Text style={styles.title}>Delivery <Text style={styles.green}>(Drop Off)</Text></Text>
          <Text style={styles.sub} numberOfLines={2}>{delivery}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 12 },
  iconColumn: { width: 38, alignItems: 'center' },
  iconWell: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.iconWell, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 15, height: 15, borderRadius: 8, backgroundColor: colors.black },
  dash: { width: 1, height: 18, borderStyle: 'dashed', borderWidth: 1, borderColor: colors.black },
  addressColumn: { flex: 1, gap: 12 },
  addressPill: { borderWidth: 1, borderColor: colors.border, borderRadius: 24, paddingHorizontal: 15, paddingVertical: 8, minHeight: 54 },
  title: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: colors.text },
  green: { color: colors.primary },
  sub: { marginTop: 2, fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.muted },
});