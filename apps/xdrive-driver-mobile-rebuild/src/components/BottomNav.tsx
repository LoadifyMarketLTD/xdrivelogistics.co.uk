import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, shadow } from '../theme/tokens';

export type MainTab = 'home' | 'deliveries' | 'wallet' | 'profile';

const items: Array<{ key: MainTab; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'deliveries', label: 'Deliveries', icon: 'location' },
  { key: 'wallet', label: 'Wallet', icon: 'wallet' },
  { key: 'profile', label: 'Profile', icon: 'person-circle' },
];

export function BottomNav({ active, onChange }: { active: MainTab; onChange: (tab: MainTab) => void }) {
  return (
    <View style={styles.wrap}>
      {items.map((item) => {
        const selected = item.key === active;
        return (
          <Pressable key={item.key} onPress={() => onChange(item.key)} style={styles.item}>
            <Ionicons name={item.icon} size={24} color={selected ? colors.black : '#D1D1D1'} />
            <Text style={[styles.label, selected && styles.activeLabel]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 13, paddingBottom: 10, ...shadow },
  item: { flex: 1, alignItems: 'center', gap: 4 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#D1D1D1' },
  activeLabel: { color: colors.black },
});