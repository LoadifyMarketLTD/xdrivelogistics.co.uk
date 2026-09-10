import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Pressable, ScrollView, Text, View } from '../theme/primitives';
import type { DriverJob } from '../types/driver';
import { BrandedHeader } from '../components/BrandedHeader';
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
      <BrandedHeader title="Deliveries" subtitle="Available, active and completed work" />
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
  page: { flex: 1, backgroundColor: '#EEF2F6' },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: 10 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 24, color: colors.surface },
  segments: { marginHorizontal: spacing.lg, marginTop: 14, flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.pill, padding: 4 },
  segment: { flex: 1, minHeight: 38, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: '#EAF1FF' },
  segmentText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: colors.muted },
  segmentTextActive: { color: '#0B2F6B' },
  list: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },
  empty: { backgroundColor: colors.surface, borderRadius: radius.medium, padding: spacing.lg, alignItems: 'center' },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, color: colors.text },
  emptyText: { marginTop: 6, fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.muted },
});
