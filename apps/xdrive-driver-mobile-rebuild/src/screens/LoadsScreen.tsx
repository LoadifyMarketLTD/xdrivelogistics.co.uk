import { useMemo, useState } from 'react';
import { UiIcon as Ionicons } from '../components/UiIcon';
import { StyleSheet } from 'react-native';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from '../theme/primitives';
import type { DriverJob } from '../types/driver';
import { LoadCard } from '../components/LoadCard';
import { radius } from '../theme/tokens';

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
    return jobs.filter((job) => [
      job.reference,
      job.postingCompanyName,
      job.postingCompanyMemberCode,
      job.pickupLocation,
      job.deliveryLocation,
      job.vehicleRequirement,
      job.cargoType,
      job.serviceMode,
      job.directDeliveryRequired ? 'direct delivery' : '',
    ].filter(Boolean).some((value) => String(value).toLowerCase().includes(needle)));
  }, [jobs, query]);

  return <View style={styles.page}>
    <View style={styles.header}>
      <Text style={styles.eyebrow}>XDRIVE MARKETPLACE</Text>
      <Text style={styles.title}>Loads</Text>
      <Text style={styles.subtitle}>Available work matched to your driver account</Text>
      <View style={styles.search}>
        <Ionicons name="search-outline" size={20} color="#475569" />
        <TextInput accessibilityLabel="Search available loads" value={query} onChangeText={setQuery}
          autoCapitalize="none" autoCorrect={false} returnKeyType="search"
          style={styles.searchInput} placeholder="Search loads" placeholderTextColor="#667085" />
        {query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear load search" onPress={() => setQuery('')} style={styles.clearSearch}>
          <Text style={styles.clearSearchText}>×</Text>
        </Pressable> : null}
      </View>
    </View>
    <ScrollView style={styles.list} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor="#1D57D8" colors={['#1D57D8']} />}>
      <View style={styles.sectionRow}>
        <View>
          <Text style={styles.sectionTitle}>Available Loads</Text>
          <Text style={styles.sectionHint}>{query ? 'Filtered results' : 'Pull down to refresh live loads'}</Text>
        </View>
        <View style={styles.count}><Text style={styles.countText}>{filtered.length}</Text></View>
      </View>
      {filtered.length ? filtered.map((job) => <LoadCard key={job.id} job={job} onOpen={() => onOpen(job)} tone="xdrive" />) :
        <View style={styles.empty}>
          {loading ? <ActivityIndicator size="small" color="#1D57D8" /> : <Ionicons name="search-outline" size={27} color="#1D57D8" />}
          <Text style={styles.emptyTitle}>{loading ? 'Loading live loads' : query ? 'No matching loads' : 'No loads available'}</Text>
          <Text style={styles.emptyText}>{loading ? 'Searching the XDrive marketplace…' : query ? 'Try another company, reference, place, vehicle, cargo or service type.' : 'Pull down to refresh live XDrive loads.'}</Text>
        </View>}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#EEF2F6' },
  header: { backgroundColor: '#0B2F6B', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 18 },  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.1, color: '#C3D7FF' },
  title: { marginTop: 3, fontFamily: 'Inter_700Bold', fontSize: 27, color: '#FFFFFF' },
  subtitle: { marginTop: 2, fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#E2E8F0' },
  search: { marginTop: 13, height: 48, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#CBD5E1', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  searchInput: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#111827' },
  clearSearch: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  clearSearchText: { fontFamily: 'Inter_700Bold', fontSize: 22, lineHeight: 24, color: '#475569' },
  list: { flex: 1 },
  content: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 24, gap: 10 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#111827' },
  sectionHint: { marginTop: 2, fontFamily: 'Inter_500Medium', fontSize: 12, color: '#3F4A5A' },
  count: { minWidth: 38, height: 30, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#DCE8FF', borderRadius: radius.pill, borderWidth: 1, borderColor: '#B8CCF5' },
  countText: { fontFamily: 'Inter_700Bold', fontSize: 12, color: '#174EBF' },
  empty: { backgroundColor: '#FFFFFF', borderWidth: 1.2, borderColor: '#CBD5E1', borderRadius: 16, padding: 24, alignItems: 'center' },
  emptyTitle: { marginTop: 8, fontFamily: 'Inter_700Bold', fontSize: 16, color: '#111827' },
  emptyText: { marginTop: 5, fontFamily: 'Inter_600SemiBold', fontSize: 12, lineHeight: 18, color: '#475569', textAlign: 'center' },
});