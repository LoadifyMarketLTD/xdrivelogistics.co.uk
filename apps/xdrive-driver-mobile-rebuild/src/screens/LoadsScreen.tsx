import { useMemo, useState } from 'react';
import { UiIcon as Ionicons } from '../components/UiIcon';
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { DriverJob } from '../types/driver';
import { LoadCard } from '../components/LoadCard';
import { colors, radius, spacing } from '../theme/tokens';

export function LoadsScreen({ jobs, loading, onRefresh, onOpen }: {
  jobs: DriverJob[];
  loading: boolean;
  onRefresh: () => void;
  onOpen: (job: DriverJob) => void;
}) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return jobs;
    return jobs.filter((job) => [job.reference, job.pickupLocation, job.deliveryLocation, job.vehicleRequirement, job.cargoType]
      .some((value) => value.toLowerCase().includes(needle)));
  }, [jobs, query]);
  return <ScrollView style={styles.page} contentContainerStyle={styles.content}
    refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}>
    <Text style={styles.title}>Loads</Text>
    <View style={styles.search}>
      <TextInput value={query} onChangeText={setQuery} style={styles.searchInput} placeholder="Search loads" placeholderTextColor={colors.muted} />
      <Ionicons name="search-outline" size={21} color={colors.muted} />
    </View>
    <View style={styles.sectionRow}><Text style={styles.sectionTitle}>Available Loads</Text><Text style={styles.count}>{filtered.length}</Text></View>
    {filtered.length ? filtered.map((job) => <LoadCard key={job.id} job={job} onOpen={() => onOpen(job)} />) :
      <View style={styles.empty}><Text style={styles.emptyTitle}>No loads available</Text><Text style={styles.emptyText}>Pull down to refresh live XDrive loads.</Text></View>}
  </ScrollView>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.appBackground },
  content: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 22, gap: 8 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 22, color: colors.surface },
  search: { height: 44, backgroundColor: colors.surface, borderRadius: radius.small, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11 },
  searchInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.text },
  sectionRow: { marginTop: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 14, color: colors.surface },
  count: { minWidth: 30, textAlign: 'center', paddingVertical: 4, paddingHorizontal: 8, backgroundColor: colors.surface, borderRadius: radius.pill, fontFamily: 'Inter_700Bold', fontSize: 11, color: colors.text },
  empty: { backgroundColor: colors.surface, borderRadius: radius.medium, padding: spacing.lg, alignItems: 'center' },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, color: colors.text },
  emptyText: { marginTop: 6, fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.muted, textAlign: 'center' },
});