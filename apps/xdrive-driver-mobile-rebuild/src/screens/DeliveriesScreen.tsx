import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { DriverJob } from '../types/driver';
import { JobCard } from '../components/JobCard';
import { colors, radius, spacing } from '../theme/tokens';

type Segment = 'available' | 'active' | 'history';

export function DeliveriesScreen({
  available,
  active,
  history,
  onOpen,
}: {
  available: DriverJob[];
  active: DriverJob[];
  history: DriverJob[];
  onOpen: (job: DriverJob) => void;
}) {
  const [segment, setSegment] = useState<Segment>('available');
  const jobs = segment === 'available' ? available : segment === 'active' ? active : history;
  return (
    <View style={styles.page}>
      <View style={styles.header}><Text style={styles.title}>Deliveries</Text></View>
      <View style={styles.segments}>
        {(['available', 'active', 'history'] as Segment[]).map((item) => (
          <Pressable key={item} onPress={() => setSegment(item)} style={[styles.segment, segment === item && styles.segmentActive]}>
            <Text style={[styles.segmentText, segment === item && styles.segmentTextActive]}>{item.charAt(0).toUpperCase() + item.slice(1)}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView contentContainerStyle={styles.list}>
        {jobs.length ? jobs.map((job) => (
          <JobCard key={job.id} job={job} onOpen={() => onOpen(job)} />
        )) : (
          <View style={styles.empty}><Text style={styles.emptyTitle}>Nothing here yet</Text><Text style={styles.emptyText}>Your {segment} deliveries will appear here.</Text></View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.appBackground },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: 10 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 24, color: colors.surface },
  segments: { marginHorizontal: spacing.lg, flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.pill, padding: 4 },
  segment: { flex: 1, minHeight: 38, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: colors.muted },
  segmentTextActive: { color: colors.surface },
  list: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },
  empty: { backgroundColor: colors.surface, borderRadius: radius.medium, padding: spacing.lg, alignItems: 'center' },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, color: colors.text },
  emptyText: { marginTop: 6, fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.muted },
});
