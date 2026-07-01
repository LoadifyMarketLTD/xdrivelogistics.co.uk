/**
 * Active Job Screen — the home screen after login when a job is in progress.
 *
 * Rule: "one screen = one primary action"
 * If a job is allocated/collected/in_transit → show the job with its next action CTA.
 * If no active job → show "No active job" with link to My Jobs.
 */
import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { fetchJobs, sendStatus } from '../../src/api/client';
import { getPendingCount } from '../../src/offline/queue';
import type { JobSummary, DriverAction } from '../../src/types';
import { AVAILABLE_ACTIONS, ACTION_LABELS } from '../../src/types';

export default function ActiveJobScreen() {
  const [job, setJob] = useState<JobSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [pendingSync, setPendingSync] = useState(0);

  const load = useCallback(async () => {
    try {
      const [activeJobs, count] = await Promise.all([
        fetchJobs('active'),
        getPendingCount(),
      ]);
      // Take the first active job as the "current" job
      setJob(activeJobs[0] ?? null);
      setPendingSync(count);
    } catch (err) {
      console.error('ActiveJob load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAction = useCallback(
    async (action: DriverAction) => {
      if (!job) return;
      setActionLoading(true);
      try {
        await sendStatus(job.id, action);
        await load();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to update status.';
        if (msg.includes('POD_REQUIRED')) {
          Alert.alert(
            'POD Required',
            'Please capture proof of delivery before marking this job as delivered.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Capture POD', onPress: () => router.push(`/(app)/job/${job.id}/pod`) },
            ]
          );
        } else {
          Alert.alert('Error', msg);
        }
      } finally {
        setActionLoading(false);
      }
    },
    [job, load]
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
          tintColor="#3b82f6"
        />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Active Job</Text>
        {pendingSync > 0 && (
          <View style={styles.syncBadge}>
            <Text style={styles.syncText}>⏳ {pendingSync} pending sync</Text>
          </View>
        )}
      </View>

      {!job ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>✅</Text>
          <Text style={styles.emptyTitle}>No active job</Text>
          <Text style={styles.emptySubtitle}>Check "My Jobs" for upcoming assignments.</Text>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/(app)/my-jobs')}
          >
            <Text style={styles.secondaryButtonText}>View My Jobs</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.jobCard}>
          <StatusBadge status={job.status} />
          <Text style={styles.jobRoute} numberOfLines={2}>
            {job.pickup_location ?? 'Pickup'} → {job.delivery_location ?? 'Delivery'}
          </Text>
          {job.pickup_datetime && (
            <Text style={styles.jobTime}>
              📅 {new Date(job.pickup_datetime).toLocaleDateString('en-GB', {
                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
              })}
            </Text>
          )}
          {job.vehicle_type && (
            <Text style={styles.jobVehicle}>🚛 {job.vehicle_type.replace(/_/g, ' ')}</Text>
          )}

          <TouchableOpacity
            style={styles.detailButton}
            onPress={() => router.push(`/(app)/job/${job.id}`)}
          >
            <Text style={styles.detailButtonText}>View Full Details</Text>
          </TouchableOpacity>

          {/* Primary action CTAs */}
          {(AVAILABLE_ACTIONS[job.status as keyof typeof AVAILABLE_ACTIONS] ?? []).map(
            (action) => (
              <TouchableOpacity
                key={action}
                style={[styles.actionButton, actionLoading && styles.buttonDisabled]}
                onPress={() => void handleAction(action)}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.actionButtonText}>{ACTION_LABELS[action]}</Text>
                )}
              </TouchableOpacity>
            )
          )}

          {/* POD capture shortcut */}
          {(job.status === 'in_transit' || job.status === 'allocated' || job.status === 'collected') && (
            <TouchableOpacity
              style={styles.podButton}
              onPress={() => router.push(`/(app)/job/${job.id}/pod`)}
            >
              <Text style={styles.podButtonText}>📸 Capture POD</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </ScrollView>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    awarded: '#f59e0b',
    allocated: '#3b82f6',
    collected: '#8b5cf6',
    in_transit: '#10b981',
    delivered: '#22c55e',
  };
  const color = colors[status] ?? '#64748b';
  return (
    <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color }]}>
      <Text style={[styles.badgeText, { color }]}>{status.replace(/_/g, ' ').toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  center: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 28, fontWeight: '800', color: '#f1f5f9' },
  syncBadge: {
    backgroundColor: '#f59e0b22',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  syncText: { color: '#f59e0b', fontSize: 12, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#f1f5f9', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 24 },
  secondaryButton: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  secondaryButtonText: { color: '#3b82f6', fontWeight: '700', fontSize: 15 },
  jobCard: {
    margin: 20,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    marginBottom: 12,
  },
  badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  jobRoute: { fontSize: 18, fontWeight: '700', color: '#f1f5f9', marginBottom: 8 },
  jobTime: { fontSize: 13, color: '#94a3b8', marginBottom: 4 },
  jobVehicle: { fontSize: 13, color: '#94a3b8', marginBottom: 20 },
  detailButton: {
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
  },
  detailButtonText: { color: '#94a3b8', fontWeight: '600', fontSize: 14 },
  actionButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonDisabled: { opacity: 0.6 },
  actionButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  podButton: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    marginTop: 4,
  },
  podButtonText: { color: '#94a3b8', fontWeight: '600', fontSize: 14 },
});
