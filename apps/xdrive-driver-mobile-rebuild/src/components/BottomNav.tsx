import { UiIcon as Ionicons } from './UiIcon';
import { StyleSheet } from 'react-native';
import { Pressable, Text, View } from '../theme/primitives';
import { colors, shadow } from '../theme/tokens';

export type MainTab = 'home' | 'alerts' | 'quotes' | 'bookings' | 'more';

const items: Array<{ key: MainTab; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: 'home', label: 'Home', icon: 'home-outline' },
  { key: 'alerts', label: 'Alerts', icon: 'notifications-outline' },
  { key: 'quotes', label: 'Quotes', icon: 'pricetag-outline' },
  { key: 'bookings', label: 'Bookings', icon: 'calendar-outline' },
  { key: 'more', label: 'More', icon: 'ellipsis-horizontal-circle-outline' },
];

export function BottomNav({ active, onChange, alertCount = 0 }: {
  active: MainTab;
  onChange: (tab: MainTab) => void;
  alertCount?: number;
}) {
  return <View style={styles.wrap}>{items.map((item) => {
    const selected = item.key === active;
    const count = item.key === 'alerts' ? alertCount : 0;
    return <Pressable
      key={item.key}
      accessibilityRole="tab"
      accessibilityLabel={item.label}
      accessibilityState={{ selected }}
      onPress={() => onChange(item.key)}
      style={styles.item}
    >
      <View style={[styles.activeBar, selected && styles.activeBarVisible]} />
      <View style={styles.iconWrap}>
        <Ionicons name={item.icon} size={22} color="#242432" />
        {count > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text></View> : null}
      </View>
      <Text style={[styles.label, selected && styles.activeLabel]}>{item.label}</Text>
    </Pressable>;
  })}</View>;
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 62,
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingBottom: 6,
    ...shadow,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 2, paddingTop: 5 },
  activeBar: { position: 'absolute', top: 0, width: 26, height: 3, borderRadius: 2, backgroundColor: 'transparent' },
  activeBarVisible: { backgroundColor: '#2E8FE5' },
  iconWrap: { width: 36, height: 27, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: 'Inter_500Medium', fontSize: 10, color: '#4B4B59' },
  activeLabel: { fontFamily: 'Inter_700Bold', color: '#242432' },
  badge: {
    position: 'absolute',
    right: -1,
    top: -5,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E4545C',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  badgeText: { fontFamily: 'Inter_700Bold', fontSize: 8, color: '#FFFFFF' },
});