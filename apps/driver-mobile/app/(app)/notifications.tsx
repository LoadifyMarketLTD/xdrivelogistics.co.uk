/**
 * Notifications Screen — critical push notification inbox.
 * Limited to: job awarded, job changed, job cancelled, urgent dispatcher update.
 */
import { View, Text, StyleSheet, FlatList } from 'react-native';

interface Notification {
  id: string;
  title: string;
  body: string;
  type: 'job_awarded' | 'job_changed' | 'job_cancelled' | 'dispatcher_update';
  read: boolean;
  created_at: string;
}

// Placeholder — real notifications come from expo-notifications local store
const SAMPLE: Notification[] = [];

export default function NotificationsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Notifications</Text>
      <FlatList
        data={SAMPLE}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyText}>No notifications</Text>
            <Text style={styles.emptySubtitle}>
              You&apos;ll see job updates and dispatcher messages here.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, !item.read && styles.cardUnread]}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardBody}>{item.body}</Text>
            <Text style={styles.cardTime}>
              {new Date(item.created_at).toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        )}
      />
    </View>
  );
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
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  empty: { paddingTop: 80, alignItems: 'center', paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 18, fontWeight: '700', color: '#f1f5f9', marginBottom: 8 },
  emptySubtitle: { fontSize: 13, color: '#64748b', textAlign: 'center' },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  cardUnread: { borderLeftWidth: 3, borderLeftColor: '#3b82f6' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#f1f5f9', marginBottom: 2 },
  cardBody: { fontSize: 13, color: '#94a3b8', marginBottom: 4 },
  cardTime: { fontSize: 11, color: '#64748b' },
});
