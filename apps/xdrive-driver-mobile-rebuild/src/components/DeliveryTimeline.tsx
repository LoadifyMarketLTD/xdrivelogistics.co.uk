import { StyleSheet } from 'react-native';
import { Text, View } from '../theme/primitives';
import type { CanonicalJobStatus } from '../types/driver';
import { formatDeliveryDate } from '../utils/format';

type AuditRow = Record<string, unknown>;
type StageStatus = CanonicalJobStatus | 'invoice_generated';

const stages: Array<{ status: StageStatus; label: string }> = [
  { status: 'awarded', label: 'Accepted' },
  { status: 'on_my_way_pickup', label: 'On My Way to Collection' },
  { status: 'arrived_pickup', label: 'On Site (Collection)' },
  { status: 'loaded', label: 'Loaded' },
  { status: 'on_my_way_delivery', label: 'On My Way to Delivery' },
  { status: 'arrived_delivery', label: 'On Site (Delivery)' },
  { status: 'delivered', label: 'Delivered (POD)' },
  { status: 'invoice_generated', label: 'Invoice' },
];

function canonicalAuditStatus(value: unknown): StageStatus | null {
  const raw = String(value ?? '').trim().toLowerCase();
  if (['awarded', 'allocated', 'assigned', 'accepted'].includes(raw)) return 'awarded';
  if (['on_my_way', 'on_my_way_pickup', 'on_my_way_to_pickup'].includes(raw)) return 'on_my_way_pickup';
  if (['arrived_pickup', 'on_site_pickup'].includes(raw)) return 'arrived_pickup';
  if (['loaded', 'collected'].includes(raw)) return 'loaded';
  if (['on_my_way_delivery', 'on_my_way_to_delivery', 'in_transit', 'on_route_delivery'].includes(raw)) return 'on_my_way_delivery';
  if (['arrived_delivery', 'on_site_delivery'].includes(raw)) return 'arrived_delivery';
  if (['delivered', 'pod_completed', 'completed'].includes(raw)) return 'delivered';
  if (['invoice_generated', 'invoiced'].includes(raw)) return 'invoice_generated';
  return null;
}

function auditTimestamp(auditTrail: AuditRow[] | undefined, status: StageStatus) {
  if (!auditTrail?.length) return '';
  const rows = auditTrail
    .map((row) => ({ status: canonicalAuditStatus(row.status), timestamp: String(row.timestamp ?? row.created_at ?? row.event_time ?? '').trim() }))
    .filter((row) => row.status === status && row.timestamp)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const timestamp = rows.at(-1)?.timestamp;
  return timestamp ? formatDeliveryDate(timestamp) : '';
}

function stageComplete(stage: StageStatus, status: CanonicalJobStatus, auditTrail?: AuditRow[]) {
  const hasAudit = Boolean(auditTimestamp(auditTrail, stage));
  if (stage === 'invoice_generated') return hasAudit;
  const order: CanonicalJobStatus[] = ['awarded', 'on_my_way_pickup', 'arrived_pickup', 'loaded', 'on_my_way_delivery', 'arrived_delivery', 'delivered'];
  return hasAudit || order.indexOf(stage as CanonicalJobStatus) <= order.indexOf(status);
}

export function DeliveryTimeline({ status, auditTrail }: { status: CanonicalJobStatus; auditTrail?: AuditRow[] }) {
  if (status === 'available' || status === 'cancelled') return null;
  const visibleStages = stages.filter((stage) => stage.status !== 'invoice_generated' || stageComplete(stage.status, status, auditTrail));

  return <View style={styles.wrap}>
    {visibleStages.slice().reverse().map((stage, index) => {
      const complete = stageComplete(stage.status, status, auditTrail);
      const timestamp = auditTimestamp(auditTrail, stage.status);
      return <View key={stage.status} style={styles.row}>
        <View style={styles.markerColumn}>
          <View style={[styles.dot, complete && styles.dotActive]}>{complete ? <Text style={styles.check}>✓</Text> : null}</View>
          {index < visibleStages.length - 1 ? <View style={[styles.line, complete && styles.lineActive]} /> : null}
        </View>
        <View style={styles.copy}>
          <Text style={[styles.label, complete && styles.labelActive]}>{stage.label}</Text>
          {timestamp ? <Text style={styles.timestamp}>{timestamp}</Text> : complete ? <Text style={styles.timestamp}>Completed</Text> : null}
        </View>
        <Text style={styles.chevron}>›</Text>
      </View>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 4, paddingVertical: 2 },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'flex-start' },
  markerColumn: { width: 42, alignItems: 'center' },
  dot: { width: 24, height: 24, borderRadius: 12, marginTop: 1, backgroundColor: '#D8D9DE', alignItems: 'center', justifyContent: 'center' },
  dotActive: { backgroundColor: '#65C653' },
  check: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#FFFFFF', lineHeight: 16 },
  line: { width: 3, flex: 1, minHeight: 32, marginVertical: 3, backgroundColor: '#E1E2E6', borderRadius: 2 },
  lineActive: { backgroundColor: '#C8CACF' },
  copy: { flex: 1, paddingTop: 1, paddingBottom: 14 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#858491' },
  labelActive: { color: '#292837' },
  timestamp: { marginTop: 4, fontFamily: 'Inter_500Medium', fontSize: 12, color: '#777684' },
  chevron: { paddingTop: 0, fontFamily: 'Inter_500Medium', fontSize: 28, lineHeight: 28, color: '#B0B1B8' },
});