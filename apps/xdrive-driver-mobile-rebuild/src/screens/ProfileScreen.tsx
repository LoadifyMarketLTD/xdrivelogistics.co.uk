import { UiIcon as Ionicons } from '../components/UiIcon';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { DriverResources } from '../types/driver';
import { colors, radius, spacing } from '../theme/tokens';

function field(row: Record<string, unknown> | null | undefined, keys: string[], fallback = 'Not set') {
  if (!row) return fallback;
  for (const key of keys) {
    const raw = row[key];
    if (raw !== null && raw !== undefined && String(raw).trim()) return String(raw);
  }
  return fallback;
}

export function ProfileScreen({ resources, onSignOut }: { resources?: DriverResources; onSignOut: () => void }) {
  const name = resources?.name || field(resources?.driver, ['display_name', 'name'], 'Driver');
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'XD';
  const vehicle = resources?.vehicle;
  const reg = field(vehicle, ['reg_plate', 'registration', 'registration_number']);
  const vehicleType = field(vehicle, ['vehicle_type', 'type'], 'Vehicle');
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Profile</Text>
      <View style={styles.profileCard}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
        <View style={styles.profileCopy}><Text style={styles.name}>{name}</Text><Text style={styles.email}>{resources?.email || ''}</Text></View>
      </View>
      <Text style={styles.sectionTitle}>Driver</Text>
      <MenuRow icon="person-outline" label="Contact details" value={resources?.phone || 'Profile details'} />
      <MenuRow icon="car-outline" label="Vehicle" value={`${vehicleType} · ${reg}`} />
      <MenuRow icon="document-text-outline" label="Documents" value={`${resources?.documents.length ?? 0} records`} />
      <Text style={styles.sectionTitle}>Account</Text>
      <MenuRow icon="notifications-outline" label="Alerts" value={`${resources?.alerts.length ?? 0} events`} />
      <Pressable onPress={onSignOut} style={styles.signOut}><Text style={styles.signOutText}>Sign Out</Text></Pressable>
    </ScrollView>
  );
}

function MenuRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.menuRow}>
      <View style={styles.iconWell}><Ionicons name={icon} size={20} color={colors.black} /></View>
      <View style={styles.menuCopy}><Text style={styles.menuLabel}>{label}</Text><Text style={styles.menuValue}>{value}</Text></View>
      <Ionicons name="chevron-forward" size={21} color={colors.black} />
    </View>
  );
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.appBackground },
  content: { padding: spacing.lg, paddingBottom: 40, gap: 12 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 24, color: colors.surface, marginBottom: 4 },
  profileCard: { backgroundColor: colors.surface, borderRadius: radius.medium, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#929292', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'Inter_700Bold', fontSize: 17, color: colors.surface },
  profileCopy: { flex: 1 },
  name: { fontFamily: 'Inter_700Bold', fontSize: 17, color: colors.text },
  email: { marginTop: 3, fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.muted },
  sectionTitle: { marginTop: 7, fontFamily: 'Inter_700Bold', fontSize: 14, color: colors.surface },
  menuRow: { minHeight: 74, backgroundColor: colors.surface, borderRadius: radius.medium, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWell: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.iconWell, alignItems: 'center', justifyContent: 'center' },
  menuCopy: { flex: 1 },
  menuLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: colors.text },
  menuValue: { marginTop: 3, fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.muted },
  signOut: { minHeight: 48, borderWidth: 1.2, borderColor: colors.primary, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, marginTop: 8 },
  signOutText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: colors.primary },
});