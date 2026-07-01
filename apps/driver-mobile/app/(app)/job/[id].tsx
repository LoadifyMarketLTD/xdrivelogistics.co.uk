/**
 * Job Detail Screen — full information for a single job.
 * Shows contacts, addresses, load info, timeline, and navigation to Execution Flow or POD.
 */
import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { fetchJobDetail } from '../../../src/api/client';
import type { JobDetail, TrackingEvent } from '../../../src/types';
import { AVAILABLE_ACTIONS, ACTION_LABELS } from '../../../src/types';

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const { job: j, tracking_events } = await fetchJobDetail(id);
      setJob(j);
      setEvents(tracking_events);
    } catch (err) {
      console.error('JobDetail load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (!job) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Job not found.</Text>
      </View>
    );
  }

  const availableActions = AVAILABLE_ACTIONS[job.status as keyof typeof AVAILABLE_ACTIONS] ?? [];

  return (
    <>
      <Stack.Screen options={{ title: 'Job Detail', headerShown: true, headerStyle: { backgroundColor: '#0f172a' }, headerTintColor: '#f1f5f9' }} />
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor="#3b82f6" />
        }
      >
        {/* Status */}
        <View style={styles.section}>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Status</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>{job.status.replace(/_/g, ' ').toUpperCase()}</Text>
            </View>
          </View>
        </View>

        {/* Pickup */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📍 Pickup</Text>
          <Text style={styles.address}>{job.pickup_location ?? '—'}</Text>
          {job.pickup_datetime && (
            <Text style={styles.meta}>
              {new Date(job.pickup_datetime).toLocaleDateString('en-GB', {
                weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
              })}
            </Text>
          )}
          {job.pickup_contact_name && (
            <Text style={styles.meta}>👤 {job.pickup_contact_name}</Text>
          )}
          {job.pickup_contact_phone && (
            <TouchableOpacity onPress={() => Linking.openURL(`tel:${job.pickup_contact_phone}`)}>
              <Text style={styles.phone}>📞 {job.pickup_contact_phone}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Delivery */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏁 Delivery</Text>
          <Text style={styles.address}>{job.delivery_location ?? '—'}</Text>
          {job.delivery_datetime && (
            <Text style={styles.meta}>
              {new Date(job.delivery_datetime).toLocaleDateString('en-GB', {
                weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
              })}
            </Text>
          )}
          {job.delivery_contact_name && (
            <Text style={styles.meta}>👤 {job.delivery_contact_name}</Text>
          )}
          {job.delivery_contact_phone && (
            <TouchableOpacity onPress={() => Linking.openURL(`tel:${job.delivery_contact_phone}`)}>
              <Text style={styles.phone}>📞 {job.delivery_contact_phone}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Load info */}
        {(job.load_details || job.vehicle_type) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📦 Load</Text>
            {job.vehicle_type && <Text style={styles.meta}>🚛 {job.vehicle_type.replace(/_/g, ' ')}</Text>}
            {job.load_details && <Text style={styles.meta}>{job.load_details}</Text>}
          </View>
        )}

        {/* Special instructions */}
        {job.special_instructions && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚠️ Instructions</Text>
            <Text style={styles.instructions}>{job.special_instructions}</Text>
          </View>
        )}

        {/* Timeline */}
        {events.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📋 Timeline</Text>
            {events.map((ev) => (
              <View key={ev.id} style={styles.timelineRow}>
                <View style={styles.timelineDot} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineEvent}>{ev.event_type.replace(/_/g, ' ')}</Text>
                  {ev.message && <Text style={styles.timelineMsg}>{ev.message}</Text>}
                  <Text style={styles.timelineTime}>
                    {new Date(ev.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* CTAs */}
        <View style={styles.actions}>
          {availableActions.map((action) => (
            <TouchableOpacity
              key={action}
              style={styles.actionButton}
              onPress={() => router.push(`/(app)/job/${id}/execution`)}
            >
              <Text style={styles.actionButtonText}>{ACTION_LABELS[action]}</Text>
            </TouchableOpacity>
          ))}
          {job.pod_required && !job.pod_generated && (
            <TouchableOpacity
              style={styles.podButton}
              onPress={() => router.push(`/(app)/job/${id}/pod`)}
            >
              <Text style={styles.podButtonText}>📸 Capture Proof of Delivery</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  center: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#ef4444', fontSize: 16 },
  section: {
    backgroundColor: '#1e293b',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
  },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusLabel: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
  statusBadge: { backgroundColor: '#3b82f622', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#3b82f6' },
  statusText: { color: '#3b82f6', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  address: { fontSize: 16, fontWeight: '600', color: '#f1f5f9', marginBottom: 4 },
  meta: { fontSize: 13, color: '#94a3b8', marginBottom: 2 },
  phone: { fontSize: 13, color: '#3b82f6', marginTop: 4 },
  instructions: { fontSize: 14, color: '#fbbf24', lineHeight: 20 },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  timelineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3b82f6', marginTop: 4, marginRight: 10 },
  timelineContent: { flex: 1 },
  timelineEvent: { fontSize: 13, fontWeight: '600', color: '#f1f5f9', textTransform: 'capitalize' },
  timelineMsg: { fontSize: 12, color: '#94a3b8' },
  timelineTime: { fontSize: 11, color: '#64748b' },
  actions: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 8 },
  actionButton: { backgroundColor: '#3b82f6', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 10 },
  actionButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  podButton: { backgroundColor: '#1e293b', borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  podButtonText: { color: '#94a3b8', fontWeight: '600', fontSize: 14 },
});
