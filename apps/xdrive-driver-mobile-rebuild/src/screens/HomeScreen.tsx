import { Ionicons } from '@expo/vector-icons';
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { DriverJob } from '../types/driver';
import { JobCard } from '../components/JobCard';
import { colors, radius, spacing } from '../theme/tokens';

export function HomeScreen({
  jobs,
  activeJob,
  loading,
  onRefresh,
  onOpen,
}: {
  jobs: DriverJob[];
  activeJob?: DriverJob;
  loading: boolean;
  onRefresh: () => void;
  onOpen: (job: DriverJob) => void;
}) {
  const featured = activeJob ?? jobs[0];
  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}
    >
      <View style={styles.search}>
        <TextInput style={styles.searchInput} placeholder="Search Here" placeholderTextColor="#949494" />
        <Ionicons name="search-outline" size={22} color="#777" />
      </View>
      <View style={styles.spacer} />
      {featured ? (
        <JobCard
          job={featured}
          actionLabel={activeJob ? 'Continue Delivery' : 'View Delivery'}
          onOpen={() => onOpen(featured)}
          onAction={() => onOpen(featured)}
        />
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No delivery available</Text>
          <Text style={styles.emptyText}>Pull down to refresh live XDrive work.</Text>
        </View>
      )}
      {jobs.length > 1 ? <Text style={styles.more}>+ {jobs.length - 1} more available deliveries</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.appBackground },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: 36 },
  search: { height: 48, backgroundColor: colors.surface, borderRadius: radius.small, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  searchInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.text },
  spacer: { height: 118 },
  empty: { backgroundColor: colors.surface, borderRadius: radius.medium, padding: spacing.lg, alignItems: 'center' },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, color: colors.text },
  emptyText: { marginTop: 6, fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.muted, textAlign: 'center' },
  more: { marginTop: 12, fontFamily: 'Inter_600SemiBold', fontSize: 12, color: colors.surface, textAlign: 'center' },
});