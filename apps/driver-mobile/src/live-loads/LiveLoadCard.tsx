import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { LiveLoad } from '../api/liveLoads';

function companyLabel(job: LiveLoad) {
  const company = job.postingCompanyName?.trim() || 'Posting company unavailable';
  return job.postingCompanyMemberCode ? `${company} (${job.postingCompanyMemberCode})` : company;
}

function schedule(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function Stop({ pickup, location, time }: { pickup: boolean; location: string; time: string }) {
  return <View style={styles.stop}>
    <View style={[styles.dot, pickup ? styles.pickupDot : styles.deliveryDot]} />
    <View style={styles.stopContent}>
      <Text style={[styles.stopLabel, pickup ? styles.pickupLabel : styles.deliveryLabel]}>{pickup ? 'PICKUP' : 'DELIVERY'}</Text>
      <Text style={styles.location} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.84}>{location}</Text>
      <Text style={styles.time} numberOfLines={1}>{schedule(time)}</Text>
    </View>
  </View>;
}

export function LiveLoadCard({ job, action = 'QUOTE', onOpen, onAction }: { job: LiveLoad; action?: string; onOpen: () => void; onAction: () => void }) {
  const company = companyLabel(job);
  return <TouchableOpacity
    style={styles.card}
    onPress={onOpen}
    accessibilityRole="button"
    accessibilityLabel={`${company}, ${job.pickupLocation} to ${job.deliveryLocation}`}
  >
    <View style={styles.header}>
      <View style={styles.companyRow}>
        <View style={styles.companyMark}><Text style={styles.companyMarkText}>X</Text></View>
        <Text style={styles.companyName} numberOfLines={1}>{company}</Text>
      </View>
      <Text style={styles.vehicle} numberOfLines={1}>{job.vehicleRequirement || 'Vehicle required'}</Text>
    </View>
    {job.destinationPriority ? <Text style={styles.priority}>NEAR YOUR DELIVERY DESTINATION</Text> : null}
    <Stop pickup location={job.pickupLocation} time={job.pickupTime} />
    <Stop pickup={false} location={job.deliveryLocation} time={job.deliveryTime} />
    <View style={styles.fields}>
      <View style={styles.field}><Text style={styles.fieldLabel}>JOB ID</Text><Text style={styles.fieldValue} numberOfLines={1}>{job.reference || 'Not provided'}</Text></View>
      <View style={styles.field}><Text style={styles.fieldLabel}>FREIGHT TYPE</Text><Text style={styles.fieldValue} numberOfLines={1}>{job.cargoType || 'Not provided'}</Text></View>
    </View>
    <TouchableOpacity style={[styles.action, job.canQuote === false && styles.actionLocked]} onPress={onAction} disabled={job.canQuote === false} accessibilityRole="button">
      <Text style={styles.actionText}>{job.canQuote === false ? 'CHECK ELIGIBILITY' : action.toUpperCase()}</Text>
    </TouchableOpacity>
  </TouchableOpacity>;
}

const styles = StyleSheet.create({
  card: { minHeight: 286, backgroundColor: '#0d1a24', borderColor: '#1f2937', borderWidth: 1, borderRadius: 18, padding: 16, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  companyRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 7 },
  companyMark: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffc107' },
  companyMarkText: { color: '#111827', fontSize: 14, fontWeight: '900' },
  companyName: { color: '#f8fafc', fontSize: 16, fontWeight: '900', flex: 1 },
  vehicle: { color: '#f8fafc', fontSize: 14, fontWeight: '900', backgroundColor: '#111827', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, maxWidth: '43%' },
  priority: { alignSelf: 'flex-start', color: '#fff', backgroundColor: '#22c55e', borderRadius: 999, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 5, fontSize: 10, fontWeight: '900' },
  stop: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#111827', borderColor: '#17263a', borderWidth: 1, borderRadius: 13, paddingHorizontal: 12, paddingVertical: 9 },
  dot: { width: 15, height: 15, borderRadius: 8, borderWidth: 4 },
  pickupDot: { borderColor: '#22c55e' },
  deliveryDot: { borderColor: '#ef4444' },
  stopContent: { flex: 1, minWidth: 0, gap: 1 },
  stopLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 0.9 },
  pickupLabel: { color: '#22c55e' },
  deliveryLabel: { color: '#ef4444' },
  location: { color: '#f8fafc', fontSize: 20, lineHeight: 24, fontWeight: '900' },
  time: { color: '#b8c3d4', fontSize: 13, lineHeight: 17, fontWeight: '700' },
  fields: { minWidth: 0, flexDirection: 'row', gap: 12 },
  field: { flex: 1, minWidth: 0, backgroundColor: '#08131f', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  fieldLabel: { color: '#9ba9bd', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  fieldValue: { color: '#f8fafc', fontSize: 13, fontWeight: '800', marginTop: 2 },
  action: { width: '100%', minHeight: 52, backgroundColor: '#ffc107', borderRadius: 13, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  actionLocked: { backgroundColor: '#9ca3af' },
  actionText: { color: '#111827', fontSize: 17, fontWeight: '900', letterSpacing: 0.6 },
});
