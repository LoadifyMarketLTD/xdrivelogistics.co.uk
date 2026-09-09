import { ThemeSelector } from '../theme/ThemeSelector';
import { UiIcon as Ionicons } from '../components/UiIcon';
import { Alert, StyleSheet } from 'react-native';
import { Pressable, ScrollView, Text, View } from '../theme/primitives';
import type { DriverResources } from '../types/driver';
import { BrandedHeader } from '../components/BrandedHeader';
import { colors, radius, spacing } from '../theme/tokens';

function vehicleTypeLabel(value: string) {
  const acronyms = new Set(['lwb', 'swb', 'mwb', 'xlwb', 'hgv']);
  return value.replace(/[_-]+/g, ' ').trim().split(/\s+/).filter(Boolean).map((part) => {
    const lower = part.toLowerCase();
    return acronyms.has(lower) ? lower.toUpperCase() : lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join(' ') || 'Vehicle';
}

function field(row: Record<string, unknown> | null | undefined, keys: string[], fallback = 'Not set') {
  if (!row) return fallback;
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim()) return String(value);
  }
  return fallback;
}

export function MoreScreen({ resources, onSignOut, onOpenResource }: { resources?: DriverResources; onSignOut: () => void; onOpenResource: (page: 'vehicle' | 'documents' | 'alerts' | 'journeys' | 'messenger' | 'invoices') => void }) {
  const name = resources?.name || field(resources?.driver, ['display_name', 'name'], 'Driver');
  const vehicle = resources?.vehicle;
  const reg = field(vehicle, ['reg_plate', 'registration', 'registration_number']);
  const vehicleType = vehicleTypeLabel(field(vehicle, ['vehicle_type', 'type'], 'Vehicle'));
  const invoiceCount = resources?.invoices.length ?? 0;
  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <BrandedHeader title="More" subtitle="Driver account, tools and records" />
    <ThemeSelector />
    <View style={styles.profileCard}>
      <View style={styles.avatar}><Text style={styles.avatarText}>{name.slice(0, 1).toUpperCase()}</Text></View>
      <View style={styles.profileCopy}><Text style={styles.name}>{name}</Text><Text style={styles.email}>{resources?.email || ''}</Text></View>
    </View>
    <MenuRow icon="car-outline" label="Vehicle" value={`${vehicleType} \u00B7 ${reg}`} onPress={() => onOpenResource('vehicle')} />
    <MenuRow icon="document-text-outline" label="Documents" value={`${resources?.documents.length ?? 0} records`} onPress={() => onOpenResource('documents')} />
    <MenuRow icon="notifications-outline" label="Alerts" value={`${resources?.alerts.length ?? 0} events`} onPress={() => onOpenResource('alerts')} />
    <MenuRow icon="navigate-outline" label="Return Journey" value="Journey availability and matching" onPress={() => onOpenResource('journeys')} />
    <MenuRow icon="chatbubble-ellipses-outline" label="Messenger" value="Job and dispatcher messages" onPress={() => onOpenResource('messenger')} />
    <MenuRow icon="receipt-outline" label="Invoices & Earnings" value={`${invoiceCount} invoice${invoiceCount === 1 ? '' : 's'}`} onPress={() => onOpenResource('invoices')} />
    <Pressable onPress={onSignOut} style={styles.signOut}><Text style={styles.signOutText}>Sign Out</Text></Pressable>
  </ScrollView>;
}

function MenuRow({ icon, label, value, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}>
    <View style={styles.iconWell}><Ionicons name={icon} size={20} color={colors.primary} /></View>
    <View style={styles.menuCopy}><Text style={styles.menuLabel}>{label}</Text><Text style={styles.menuValue}>{value}</Text></View>
    <Ionicons name="chevron-forward" size={20} color={colors.black} />
  </Pressable>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#EEF2F6' },
  content: { paddingBottom: 22, gap: 10 },
  eyebrow: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#ECECEC' },
  title: { fontFamily: 'Inter_700Bold', fontSize: 22, color: colors.surface },
  profileCard: { marginHorizontal: 16, minHeight: 70, backgroundColor: colors.surface, borderRadius: radius.medium, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.iconWell, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'Inter_700Bold', fontSize: 18, color: colors.primary },
  profileCopy: { flex: 1 },
  name: { fontFamily: 'Inter_700Bold', fontSize: 15, color: colors.text },
  email: { marginTop: 2, fontFamily: 'Inter_500Medium', fontSize: 12, color: '#526071' },
  menuRow: { marginHorizontal: 16, minHeight: 58, backgroundColor: colors.surface, borderRadius: radius.medium, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  menuRowPressed: { opacity: 0.68 },
  iconWell: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.iconWell, alignItems: 'center', justifyContent: 'center' },
  menuCopy: { flex: 1 },
  menuLabel: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#172033' },
  menuValue: { marginTop: 2, fontFamily: 'Inter_500Medium', fontSize: 12, color: '#526071' },
  signOut: { marginHorizontal: 16, minHeight: 48, marginTop: 4, borderWidth: 1.2, borderColor: colors.primary, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  signOutText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: colors.primary },
});
