/**
 * My Jobs Screen — tabbed list: Active / Upcoming / Completed
 */
import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { fetchJobs } from '../../src/api/client';
import type { JobSummary } from '../../src/types';

type Scope = 'active' | 'upcoming' | 'completed';

const TABS: { key: Scope; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
];

export default function MyJobsScreen() {
  const [scope, setScope] = useState<Scope>('active');
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (currentScope: Scope) => {
      try {
        const data = await fetchJobs(currentScope);
        setJobs(data);
      } catch (err) {
        console.error('MyJobs load error:', err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    setLoading(true);
    void load(scope);
  }, [scope, load]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Jobs</Text>

      {/* Tab bar */}
      <View style={styles.tabs}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, scope === tab.key && styles.tabActive]}
            onPress={() => setScope(tab.key)}
          >
            <Text style={[styles.tabText, scope === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load(scope);
              }}
              tintColor="#3b82f6"
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No {scope} jobs</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.jobCard}
              onPress={() => router.push(`/(app)/job/${item.id}`)}
            >
              <View style={styles.jobCardHeader}>
                <StatusDot status={item.status} />
                <Text style={styles.jobStatus}>{item.status.replace(/_/g, ' ').toUpperCase()}</Text>
              </View>
              <Text style={styles.jobRoute} numberOfLines={2}>
                {item.pickup_location ?? '—'} → {item.delivery_location ?? '—'}
              </Text>
              {item.pickup_datetime && (
                <Text style={styles.jobMeta}>
                  {new Date(item.pickup_datetime).toLocaleDateString('en-GB', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </Text>
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    awarded: '#f59e0b',
    allocated: '#3b82f6',
    collected: '#8b5cf6',
    in_transit: '#10b981',
    delivered: '#22c55e',
    invoiced: '#06b6d4',
    paid: '#22c55e',
  };
  const color = colors[status] ?? '#64748b';
  return <View style={[styles.dot, { backgroundColor: color }]} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#f1f5f9',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 20,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: { backgroundColor: '#3b82f6' },
  tabText: { color: '#64748b', fontWeight: '600', fontSize: 13 },
  tabTextActive: { color: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  empty: { paddingTop: 60, alignItems: 'center' },
  emptyText: { color: '#64748b', fontSize: 16 },
  jobCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  jobCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  jobStatus: { fontSize: 11, fontWeight: '700', color: '#94a3b8', letterSpacing: 0.5 },
  jobRoute: { fontSize: 15, fontWeight: '600', color: '#f1f5f9', marginBottom: 4 },
  jobMeta: { fontSize: 12, color: '#64748b' },
});
