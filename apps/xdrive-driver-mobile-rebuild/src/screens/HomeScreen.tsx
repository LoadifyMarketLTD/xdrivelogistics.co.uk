import { UiIcon as Ionicons } from '../components/UiIcon';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { DriverJob, DriverResources } from '../types/driver';
import { JobCard } from '../components/JobCard';
import { LoadCard } from '../components/LoadCard';
import { colors, radius, spacing } from '../theme/tokens';

function resourceField(row: Record<string, unknown> | null | undefined, keys: string[], fallback = 'Not set') {
  if (!row) return fallback;
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim()) return String(value);
  }
  return fallback;
}

function trackingLabel(resources?: DriverResources) {
  const raw = resourceField(resources?.driver, ['tracking_enabled', 'mobile_tracking', 'is_tracking'], resourceField(resources?.vehicle, ['tracking_enabled', 'mobile_tracking', 'is_tracking'], 'Not set')).toLowerCase();
  if (['true', '1', 'on', 'active', 'enabled'].includes(raw)) return 'On';
  if (['false', '0', 'off', 'inactive', 'disabled'].includes(raw)) return 'Off';
  return raw === 'not set' ? 'Not set' : raw;
}

export function HomeScreen({ jobs, activeJob, recentJob, resources, loading, onRefresh, onOpen, onGoLoads, onGoQuotes, onGoHistory, onGoMore }: {
  jobs: DriverJob[];
  activeJob?: DriverJob;
  recentJob?: DriverJob;
  resources?: DriverResources;
  loading: boolean;
  onRefresh: () => void;
  onOpen: (job: DriverJob) => void;
  onGoLoads: () => void;
  onGoQuotes: () => void;
  onGoHistory: () => void;
  onGoMore: () => void;
}) {
  const quoteCount = resources?.quotes.length ?? 0;
  const driverName = resources?.name || resourceField(resources?.driver, ['display_name', 'name'], 'Driver');
  const vehicleType = resourceField(resources?.vehicle, ['vehicle_type', 'type'], 'Vehicle');
  const registration = resourceField(resources?.vehicle, ['reg_plate', 'registration', 'registration_number'], 'Not set');
  const tracking = trackingLabel(resources);
  return <ScrollView style={styles.page} contentContainerStyle={styles.content}
    refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}>
    <View style={styles.header}>
      <View><Text style={styles.eyebrow}>XDrive Driver</Text><Text style={styles.title}>Home</Text></View>
      <View style={styles.livePill}><View style={styles.liveDot} /><Text style={styles.liveText}>{jobs.length} live</Text></View>
    </View>
    <View style={styles.driverCard}>
      <View style={styles.driverAvatar}><Text style={styles.driverAvatarText}>{driverName.slice(0, 1).toUpperCase()}</Text></View>
      <View style={styles.driverCopy}>
        <Text style={styles.driverName}>{driverName}</Text>
        <Text style={styles.driverMeta} numberOfLines={1}>{vehicleType} | {registration}</Text>
      </View>
      <View style={styles.statusStack}>
        <Text style={styles.statusLabel}>Tracking</Text>
        <Text style={styles.statusValue}>{tracking}</Text>
        <Text style={styles.workValue}>{activeJob ? 'On job' : 'Available'}</Text>
      </View>
    </View>
    <View style={styles.quickRow}>
      <QuickCard icon="cube-outline" label="Loads" value={String(jobs.length)} onPress={onGoLoads} />
      <QuickCard icon="pricetag-outline" label="Quotes" value={String(quoteCount)} onPress={onGoQuotes} />
      <QuickCard icon="navigate-outline" label="Driver tools" value="More" onPress={onGoMore} />
    </View>
    <SectionTitle title="Active Delivery" />
    {activeJob ? <JobCard job={activeJob} actionLabel="Continue Delivery" onOpen={() => onOpen(activeJob)} onAction={() => onOpen(activeJob)} /> : <EmptyCard title="No active delivery" text="Your awarded job will appear here." />}
    <SectionTitle title="Available Loads" action={`View all (${jobs.length})`} onPress={onGoLoads} />
    {jobs.slice(0, 2).map((job) => <LoadCard key={job.id} job={job} onOpen={() => onOpen(job)} />)}
    {!jobs.length ? <EmptyCard title="No loads available" text="Pull down to refresh live XDrive loads." /> : null}
    <SectionTitle title="Recent Delivery" action="History" onPress={onGoHistory} />
    {recentJob ? <LoadCard job={recentJob} onOpen={() => onOpen(recentJob)} /> : <EmptyCard title="No delivery history" text="Completed deliveries will appear here." />}
    <Pressable onPress={onGoMore} style={styles.secondaryCard}>
      <View><Text style={styles.secondaryTitle}>Return Journey & driver tools</Text><Text style={styles.secondaryText}>Availability, documents, messenger and account tools.</Text></View>
      <Ionicons name="chevron-forward" size={21} color={colors.black} />
    </Pressable>
  </ScrollView>;
}
function QuickCard({ icon, label, value, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.quickCard}>
    <Ionicons name={icon} size={20} color={colors.primary} />
    <Text style={styles.quickValue}>{value}</Text>
    <Text style={styles.quickLabel}>{label}</Text>
  </Pressable>;
}
function SectionTitle({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  return <View style={styles.sectionRow}><Text style={styles.sectionTitle}>{title}</Text>{action && onPress ? <Pressable onPress={onPress}><Text style={styles.sectionAction}>{action}</Text></Pressable> : null}</View>;
}
function EmptyCard({ title, text }: { title: string; text: string }) {
  return <View style={styles.empty}><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyText}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.appBackground },
  content: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 22, gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#ECECEC' },
  title: { marginTop: 1, fontFamily: 'Inter_700Bold', fontSize: 22, color: colors.surface },
  livePill: { backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  liveText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: colors.text },
  driverCard: { minHeight: 72, backgroundColor: colors.surface, borderRadius: radius.medium, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  driverTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  driverAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.iconWell, alignItems: 'center', justifyContent: 'center' },
  driverAvatarText: { fontFamily: 'Inter_700Bold', fontSize: 15, color: colors.primary },
  driverCopy: { flex: 1 },
  driverMeta: { marginTop: 2, fontFamily: 'Inter_400Regular', fontSize: 10, color: colors.muted },
  statusStack: { minWidth: 76, alignItems: 'flex-end' },
  statusLabel: { fontFamily: 'Inter_400Regular', fontSize: 8, color: colors.muted },
  statusValue: { marginTop: 1, fontFamily: 'Inter_700Bold', fontSize: 10, color: colors.primary },
  workValue: { marginTop: 3, fontFamily: 'Inter_600SemiBold', fontSize: 9, color: colors.text },
  driverName: { fontFamily: 'Inter_700Bold', fontSize: 14, color: colors.text },
  driverEmail: { marginTop: 2, fontFamily: 'Inter_400Regular', fontSize: 10, color: colors.muted },
  driverFacts: { flexDirection: 'row', gap: 8 },
  fact: { flex: 1, minWidth: 0, backgroundColor: colors.iconWell, borderRadius: radius.small, paddingHorizontal: 9, paddingVertical: 8 },
  factLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 9, color: colors.muted },
  factValue: { marginTop: 2, fontFamily: 'Inter_600SemiBold', fontSize: 10, color: colors.text },
  quickRow: { flexDirection: 'row', gap: 7 },
  quickCard: { flex: 1, minHeight: 58, backgroundColor: colors.surface, borderRadius: radius.medium, alignItems: 'center', justifyContent: 'center', paddingVertical: 6, paddingHorizontal: 5 },
  quickValue: { marginTop: 1, fontFamily: 'Inter_700Bold', fontSize: 14, color: colors.text },
  quickLabel: { marginTop: 1, fontFamily: 'Inter_400Regular', fontSize: 10, color: colors.muted },
  sectionRow: { marginTop: 3, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 15, color: colors.surface },
  sectionAction: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#F2F2F2' },
  empty: { backgroundColor: colors.surface, borderRadius: radius.medium, paddingHorizontal: 14, paddingVertical: 12, alignItems: 'center' },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 13, color: colors.text },
  emptyText: { marginTop: 3, fontFamily: 'Inter_400Regular', fontSize: 10, color: colors.muted, textAlign: 'center' },
  secondaryCard: { minHeight: 72, backgroundColor: colors.surface, borderRadius: radius.medium, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  secondaryTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.text },
  secondaryText: { marginTop: 3, maxWidth: 270, fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.muted },
});
