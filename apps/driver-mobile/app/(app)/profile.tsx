/**
 * Profile Screen — minimal driver profile + logout.
 */
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { loadSession, clearSession } from '../../src/auth/session';
import { getPendingCount } from '../../src/offline/queue';

export default function ProfileScreen() {
  const [email, setEmail] = useState<string>('');
  const [pendingSync, setPendingSync] = useState(0);

  useEffect(() => {
    loadSession().then((s) => {
      if (s) setEmail(s.email);
    });
    getPendingCount().then(setPendingSync);
  }, []);

  async function handleLogout() {
    if (pendingSync > 0) {
      Alert.alert(
        'Pending Sync',
        `You have ${pendingSync} action(s) waiting to sync. Logging out now may lose unsaved data.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Logout Anyway',
            style: 'destructive',
            onPress: async () => {
              await clearSession();
              router.replace('/(auth)/login');
            },
          },
        ]
      );
    } else {
      await clearSession();
      router.replace('/(auth)/login');
    }
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Profile</Text>

      <View style={styles.section}>
        <Text style={styles.label}>Signed in as</Text>
        <Text style={styles.value}>{email || '—'}</Text>
      </View>

      {pendingSync > 0 && (
        <View style={styles.syncBanner}>
          <Text style={styles.syncText}>
            ⏳ {pendingSync} action{pendingSync !== 1 ? 's' : ''} pending sync
          </Text>
          <Text style={styles.syncSubtitle}>
            These will be sent automatically when you&apos;re back online.
          </Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.label}>App version</Text>
        <Text style={styles.value}>1.0.0</Text>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
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
    paddingBottom: 24,
  },
  section: {
    backgroundColor: '#1e293b',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
  },
  label: { fontSize: 12, color: '#64748b', fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { fontSize: 15, color: '#f1f5f9', fontWeight: '500' },
  syncBanner: {
    backgroundColor: '#f59e0b22',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  syncText: { color: '#f59e0b', fontWeight: '700', fontSize: 14, marginBottom: 2 },
  syncSubtitle: { color: '#f59e0b', fontSize: 12, opacity: 0.7 },
  logoutButton: {
    backgroundColor: '#ef444422',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  logoutText: { color: '#ef4444', fontWeight: '700', fontSize: 15 },
});
