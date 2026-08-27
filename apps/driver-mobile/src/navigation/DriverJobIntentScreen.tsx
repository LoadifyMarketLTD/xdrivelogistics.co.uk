import { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { fetchJob } from '../api/jobs';
import { getSessionToken } from '../auth/sessionStore';
import type { DriverJob } from '../jobs/types';
import { colors, spacing } from '../ui/theme';

export function DriverJobIntentScreen({ jobId, onClose }: { jobId: string; onClose: () => void }) {
  const [job, setJob] = useState<DriverJob | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const token = (await getSessionToken())?.trim() || '';
        if (!token) throw new Error('Sign in to XDrive Driver before opening this job.');
        const response = await fetchJob(jobId, token);
        if (!active) return;
        setJob(response.job);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : 'This job cannot be opened.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [jobId]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>XDRIVE</Text>
          <Text style={styles.title}>Job update</Text>
        </View>
        <TouchableOpacity style={styles.closeButton} onPress={onClose} accessibilityRole="button">
          <Text style={styles.closeText}>CLOSE</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? <Text style={styles.copy}>Opening authorised job…</Text> : null}
        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Job unavailable</Text>
            <Text style={styles.copy}>{error}</Text>
          </View>
        ) : null}
        {job ? (
          <>
            <View style={styles.card}>
              <Text style={styles.reference}>{job.reference}</Text>
              <Text style={styles.status}>{job.status.replace(/_/g, ' ').toUpperCase()}</Text>
            </View>
            <View style={styles.card}>
              <Info label="Pickup" value={job.pickupLocation} />
              <Info label="Pickup time" value={job.pickupTime} />
              <Info label="Delivery" value={job.deliveryLocation} />
              <Info label="Delivery time" value={job.deliveryTime} />
            </View>
            <View style={styles.card}>
              <Info label="Cargo" value={job.cargoType} />
              <Info label="Vehicle" value={job.vehicleRequirement} />
              {job.distance ? <Info label="Distance" value={job.distance} /> : null}
              {job.eta ? <Info label="ETA" value={job.eta} /> : null}
              {job.price ? <Info label="Price" value={job.price} /> : null}
            </View>
            {(job.customerNotes || job.dispatcherNotes || job.specialInstructions) ? (
              <View style={styles.card}>
                {job.customerNotes ? <Info label="Customer notes" value={job.customerNotes} /> : null}
                {job.dispatcherNotes ? <Info label="Dispatcher notes" value={job.dispatcherNotes} /> : null}
                {job.specialInstructions ? <Info label="Special instructions" value={job.specialInstructions} /> : null}
              </View>
            ) : null}
            <TouchableOpacity style={styles.primary} onPress={onClose} accessibilityRole="button">
              <Text style={styles.primaryText}>OPEN DRIVER WORKSPACE</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.info}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { padding: spacing.md, borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { color: colors.warning, fontWeight: '900', letterSpacing: 2 },
  title: { color: colors.text, fontSize: 22, fontWeight: '900' },
  closeButton: { minHeight: 42, borderColor: colors.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: colors.text, fontWeight: '800' },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: 80 },
  card: { backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: spacing.md, gap: spacing.sm },
  errorCard: { backgroundColor: colors.panel, borderColor: colors.danger, borderWidth: 1, borderRadius: 12, padding: spacing.md, gap: spacing.sm },
  errorTitle: { color: colors.danger, fontWeight: '900', fontSize: 18 },
  reference: { color: colors.text, fontSize: 24, fontWeight: '900' },
  status: { color: colors.warning, fontWeight: '900', fontSize: 12, letterSpacing: 1 },
  info: { gap: 4 },
  label: { color: colors.muted, fontSize: 12, textTransform: 'uppercase' },
  value: { color: colors.text, fontSize: 16, fontWeight: '700' },
  copy: { color: colors.muted, lineHeight: 20 },
  primary: { minHeight: 54, backgroundColor: colors.primary, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontWeight: '900' },
});
