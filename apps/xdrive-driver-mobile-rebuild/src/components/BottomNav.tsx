import { UiIcon as Ionicons } from './UiIcon';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, shadow } from '../theme/tokens';

export type MainTab = 'home' | 'loads' | 'quotes' | 'history' | 'more';

const items: Array<{ key: MainTab; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: 'home', label: 'Home', icon: 'home-outline' },
  { key: 'loads', label: 'Loads', icon: 'cube-outline' },
  { key: 'quotes', label: 'Quotes', icon: 'pricetag-outline' },
  { key: 'history', label: 'History', icon: 'time-outline' },
  { key: 'more', label: 'More', icon: 'ellipsis-horizontal-circle-outline' },
];

export function BottomNav({ active, onChange }: { active: MainTab; onChange: (tab: MainTab) => void }) {
  return <View style={styles.wrap}>{items.map((item) => {
    const selected = item.key === active;
    return <Pressable key={item.key} onPress={() => onChange(item.key)} style={styles.item}>
      <Ionicons name={item.icon} size={22} color={selected ? colors.primary : '#B8B8B8'} />
      <Text style={[styles.label, selected && styles.activeLabel]}>{item.label}</Text>
    </Pressable>;
  })}</View>;
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', backgroundColor: colors.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 11, paddingBottom: 8, ...shadow },
  item: { flex: 1, alignItems: 'center', gap: 3 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: '#B8B8B8' },
  activeLabel: { color: colors.text },
});
