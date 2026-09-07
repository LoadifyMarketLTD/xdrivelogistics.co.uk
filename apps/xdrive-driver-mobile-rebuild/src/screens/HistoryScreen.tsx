import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { DriverJob } from '../types/driver';
import { LoadCard } from '../components/LoadCard';
import { colors, radius, spacing } from '../theme/tokens';

export function HistoryScreen({ jobs, onOpen }: {
  jobs: DriverJob[];
  onOpen: (job: DriverJob) => void;
}) {
  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <Text style={styles.title}>History</Text>
    <Text style={styles.subtitle}>All completed XDrive deliveries</Text>
    {jobs.length ? jobs.map((job) => <LoadCard key={job.id} job={job} onOpen={() => onOpen(job)} />) :
      <View style={styles.empty}><Text style={styles.emptyTitle}>No completed deliveries yet</Text><Text style={styles.emptyText}>Completed jobs will stay here without a date-range limit.</Text></View>}
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.appBackground },
  content: { padding: spacing.lg, paddingBottom: 30, gap: 12 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 24, color: colors.surface },
  subtitle: { marginBottom: 2, fontFamily: 'Inter_400Regular', fontSize: 12, color: '#ECECEC' },
  empty: { backgroundColor: colors.surface, borderRadius: radius.medium, padding: spacing.lg, alignItems: 'center' },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, color: colors.text },
  emptyText: { marginTop: 6, fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.muted, textAlign: 'center' },
});