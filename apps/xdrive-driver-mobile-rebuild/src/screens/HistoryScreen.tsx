import { StyleSheet } from 'react-native';
import { ScrollView, Text, View } from '../theme/primitives';
import type { DriverJob } from '../types/driver';
import { LoadCard } from '../components/LoadCard';
import { BrandedHeader } from '../components/BrandedHeader';
import { colors, radius, spacing } from '../theme/tokens';

export function HistoryScreen({ jobs, onOpen }: {
  jobs: DriverJob[];
  onOpen: (job: DriverJob) => void;
}) {
  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <BrandedHeader title="History" subtitle="Completed and closed XDrive deliveries" />
    {jobs.length ? jobs.map((job) => <LoadCard key={job.id} job={job} onOpen={() => onOpen(job)} tone="xdrive" />) :
      <View style={styles.empty}><Text style={styles.emptyTitle}>No completed or closed deliveries yet</Text><Text style={styles.emptyText}>Completed jobs will stay here without a date-range limit.</Text></View>}
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#EEF2F6' },
  content: { paddingBottom: 22, gap: 10 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 22, color: colors.surface },
  subtitle: { marginBottom: 0, fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#ECECEC' },
  empty: { marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: radius.medium, paddingHorizontal: 14, paddingVertical: 12, alignItems: 'center' },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, color: colors.text },
  emptyText: { marginTop: 6, fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.muted, textAlign: 'center' },
});