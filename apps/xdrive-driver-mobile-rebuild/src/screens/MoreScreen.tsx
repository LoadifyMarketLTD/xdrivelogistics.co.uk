import { UiIcon as Ionicons } from '../components/UiIcon';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { DriverResources } from '../types/driver';
import { colors, radius, spacing } from '../theme/tokens';

function field(row: Record<string, unknown> | null | undefined, keys: string[], fallback = 'Not set') {
  if (!row) return fallback;
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim()) return String(value);
  }
  return fallback;
}

export function MoreScreen({ resources, onSignOut }: { resources?: DriverResources; onSignOut: () => void }) {
  const name = resources?.name || field(resources?.driver, ['display_name', 'name'], 'Driver');
  const vehicle = resources?.vehicle;
  const reg = field(vehicle, ['reg_plate', 'registration', 'registration_number']);
  const vehicleType = field(vehicle, ['vehicle_type', 'type'], 'Vehicle');
  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>XDrive Driver</Text>
    <Text style={styles.title}>More</Text>
    <View style={styles.profileCard}>
      <View style={styles.avatar}><Text style={styles.avatarText}>{name.slice(0, 1).toUpperCase()}</Text></View>
      <View style={styles.profileCopy}><Text style={styles.name}>{name}</Text><Text style={styles.email}>{resources?.email || ''}</Text></View>
    </View>
    <MenuRow icon="car-outline" label="Vehicle" value={`${vehicleType} · ${reg}`} />
    <MenuRow icon="document-text-outline" label="Documents" value={`${resources?.documents.length ?? 0} records`} />
    <MenuRow icon="notifications-outline" label="Alerts" value={`${resources?.alerts.length ?? 0} events`} />
    <MenuRow icon="navigate-outline" label="Return Journey" value="Journey availability and matching" />
    <MenuRow icon="chatbubble-ellipses-outline" label="Messenger" value="Job and dispatcher messages" />
    <MenuRow icon="receipt-outline" label="Invoices & Earnings" value={`${resources?.invoices.length ?? 0} invoices`} />
    <Pressable onPress={onSignOut} style={styles.signOut}><Text style={styles.signOutText}>Sign Out</Text></Pressable>
  </ScrollView>;
}

function MenuRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return <View style={styles.menuRow}>
    <View style={styles.iconWell}><Ionicons name={icon} size={20} color={colors.primary} /></View>
    <View style={styles.menuCopy}><Text style={styles.menuLabel}>{label}</Text><Text style={styles.menuValue}>{value}</Text></View>
    <Ionicons name="chevron-forward" size={20} color={colors.black} />
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.appBackground },
  content: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 22, gap: 8 },
  eyebrow: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#ECECEC' },
  title: { fontFamily: 'Inter_700Bold', fontSize: 22, color: colors.surface },
  profileCard: { minHeight: 70, backgroundColor: colors.surface, borderRadius: radius.medium, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.iconWell, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'Inter_700Bold', fontSize: 18, color: colors.primary },
  profileCopy: { flex: 1 },
  name: { fontFamily: 'Inter_700Bold', fontSize: 14, color: colors.text },
  email: { marginTop: 2, fontFamily: 'Inter_400Regular', fontSize: 10, color: colors.muted },
  menuRow: { minHeight: 58, backgroundColor: colors.surface, borderRadius: radius.medium, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWell: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.iconWell, alignItems: 'center', justifyContent: 'center' },
  menuCopy: { flex: 1 },
  menuLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.text },
  menuValue: { marginTop: 2, fontFamily: 'Inter_400Regular', fontSize: 10, color: colors.muted },
  signOut: { minHeight: 48, marginTop: 4, borderWidth: 1.2, borderColor: colors.primary, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  signOutText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: colors.primary },
});
