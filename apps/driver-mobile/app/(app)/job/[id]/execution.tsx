/**
 * Execution Flow Screen — one-action-at-a-time status advancement.
 * Follows the rule: one screen = one primary action.
 */
import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { fetchJobDetail, sendStatus } from '../../../../src/api/client';
import { enqueue } from '../../../../src/offline/queue';
import { loadSession } from '../../../../src/auth/session';
import type { JobDetail, DriverAction } from '../../../../src/types';
import { AVAILABLE_ACTIONS, ACTION_LABELS } from '../../../../src/types';

export default function ExecutionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<DriverAction | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const { job: j } = await fetchJobDetail(id);
      setJob(j);
    } catch {
      // if offline, job may be stale — show last known state
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAction = useCallback(
    async (action: DriverAction) => {
      if (!id) return;
      setActionLoading(action);
      try {
        await sendStatus(id, action);
        await load();
        // If all actions done → go back to active job
        const nextJob = await fetchJobDetail(id);
        const remaining = AVAILABLE_ACTIONS[nextJob.job.status as keyof typeof AVAILABLE_ACTIONS] ?? [];
        if (remaining.length === 0) {
          router.replace('/(app)/active-job');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed';

        // Check if offline — queue for later
        if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch')) {
          const session = await loadSession();
          if (session) {
            await enqueue(`/api/driver/mobile/jobs/${id}/status`, 'POST', { action });
            Alert.alert(
              'Saved Offline',
              `"${ACTION_LABELS[action]}" saved locally and will sync when you're back online.`
            );
          }
        } else if (msg.includes('POD_REQUIRED')) {
          Alert.alert(
            'POD Required',
            'Capture proof of delivery before marking as delivered.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Capture POD', onPress: () => router.push(`/(app)/job/${id}/pod`) },
            ]
          );
        } else {
          Alert.alert('Error', msg);
        }
      } finally {
        setActionLoading(null);
      }
    },
    [id, load]
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  const availableActions = job
    ? (AVAILABLE_ACTIONS[job.status as keyof typeof AVAILABLE_ACTIONS] ?? [])
    : [];

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Execution',
          headerShown: true,
          headerStyle: { backgroundColor: '#0f172a' },
          headerTintColor: '#f1f5f9',
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {job && (
          <>
            <Text style={styles.route} numberOfLines={3}>
              {job.pickup_location} → {job.delivery_location}
            </Text>
            <View style={styles.currentStatus}>
              <Text style={styles.currentStatusLabel}>Current status</Text>
              <Text style={styles.currentStatusValue}>
                {job.status.replace(/_/g, ' ').toUpperCase()}
              </Text>
            </View>

            {availableActions.length === 0 ? (
              <View style={styles.complete}>
                <Text style={styles.completeIcon}>✅</Text>
                <Text style={styles.completeText}>All steps complete</Text>
              </View>
            ) : (
              availableActions.map((action) => (
                <View key={action} style={styles.actionBlock}>
                  <Text style={styles.actionHint}>Next step</Text>
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      actionLoading === action && styles.buttonDisabled,
                    ]}
                    onPress={() => void handleAction(action)}
                    disabled={actionLoading !== null}
                  >
                    {actionLoading === action ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.actionButtonText}>{ACTION_LABELS[action]}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ))
            )}

            {(job.status === 'in_transit' ||
              job.status === 'allocated' ||
              job.status === 'collected') && (
              <TouchableOpacity
                style={styles.podLink}
                onPress={() => router.push(`/(app)/job/${id}/pod`)}
              >
                <Text style={styles.podLinkText}>📸 Upload Proof of Delivery</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  center: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' },
  content: { padding: 24, paddingBottom: 60 },
  route: { fontSize: 17, fontWeight: '700', color: '#f1f5f9', marginBottom: 24, lineHeight: 24 },
  currentStatus: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  currentStatusLabel: { color: '#64748b', fontSize: 13, fontWeight: '600' },
  currentStatusValue: { color: '#3b82f6', fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  actionBlock: { marginBottom: 16 },
  actionHint: { color: '#64748b', fontSize: 12, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  actionButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  actionButtonText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  complete: { alignItems: 'center', paddingTop: 40 },
  completeIcon: { fontSize: 56, marginBottom: 12 },
  completeText: { color: '#22c55e', fontSize: 20, fontWeight: '700' },
  podLink: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  podLinkText: { color: '#94a3b8', fontWeight: '600', fontSize: 14 },
});
