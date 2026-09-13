import { useMemo, useState } from 'react';
import { UiIcon as Ionicons } from '../components/UiIcon';
import { Linking, StyleSheet } from 'react-native';
import { Pressable, ScrollView, Text, View } from '../theme/primitives';
import type { DriverJob, DriverJobStop } from '../types/driver';
import { getNextStep, statusLabel } from '../types/statusFlow';
import { ActionButton } from '../components/ActionButton';
import { DeliveryTimeline } from '../components/DeliveryTimeline';
import { shadow } from '../theme/tokens';
import { formatDeliveryDate } from '../utils/format';

type DetailTab = 'summary' | 'stops' | 'status';

function fallbackStops(job: DriverJob): DriverJobStop[] {
  return [
    { sequence: 1, type: 'collection', address: job.pickupLocation, timeWindowFrom: job.pickupTime, notes: job.pickupNote },
    { sequence: 2, type: 'delivery', address: job.deliveryLocation, timeWindowFrom: job.deliveryTime, notes: job.deliveryNote },
  ];
}

function stopTitle(stop: DriverJobStop, index: number) {
  const kind = String(stop.type ?? '').toLowerCase();
  if (kind.includes('collection')) return index === 0 ? 'Collection Details' : `Extra Stop ${index} - Collection`;
  if (kind.includes('delivery')) return index === 1 ? 'Delivery Details' : `Extra Stop ${index} - Delivery`;
  return `Stop ${index + 1}`;
}

function distanceLine(job: DriverJob) {
  if (job.distance) return job.eta ? `${job.distance} (${job.eta})` : job.distance;
  if (job.journeyDistanceMiles == null) return '';
  const miles = `${job.journeyDistanceMiles.toFixed(1)} miles`;
  if (job.estimatedJourneyMinutes == null) return miles;
  const minutes = Math.max(0, Math.round(job.estimatedJourneyMinutes));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${miles} (${hours ? `${hours}h ` : ''}${rest}m)`;
}

export function JobDetailScreen({ job, busy, onBack, onAdvance }: {
  job: DriverJob;
  busy: boolean;
  onBack: () => void;
  onAdvance: (endpoint: string) => void;
}) {
  const [tab, setTab] = useState<DetailTab>('summary');
  const next = getNextStep(job.status);
  const stops = useMemo(() => job.stops?.length ? job.stops : fallbackStops(job), [job]);
  const distance = distanceLine(job);
  const notes = [job.customerNotes, job.notesSummary, job.specialInstructions, job.pickupNote, job.deliveryNote].filter((value, index, all): value is string => Boolean(value) && all.indexOf(value) === index);

  return <View style={styles.page}>
    <View style={styles.topbar}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to bookings" onPress={onBack} style={styles.back}><Ionicons name="chevron-back" size={25} color="#FFFFFF" /></Pressable>
      <Text style={styles.topTitle}>Load ID {job.reference}</Text>
      <View style={styles.back} />
    </View>

    <View style={styles.tabs}>{(['summary', 'stops', 'status'] as DetailTab[]).map((item) => {
      const selected = tab === item;
      return <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => setTab(item)} style={[styles.tab, selected && styles.tabActive]}>
        <Text style={[styles.tabText, selected && styles.tabTextActive]}>{item.charAt(0).toUpperCase() + item.slice(1)}</Text>
      </Pressable>;
    })}</View>

    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.cardHeader}>
        <Text style={styles.company}>{job.postingCompanyName || job.client || 'XDrive Booking'}{job.postingCompanyMemberCode ? ` (${job.postingCompanyMemberCode})` : ''}</Text>
        {job.customerReference ? <Text style={styles.reference}>Cust. Ref. {job.customerReference}</Text> : <Text style={styles.reference}>Load ID {job.reference}</Text>}
      </View>

      {tab === 'summary' ? <View style={styles.card}>
        <View style={styles.routeCard}>
          <View style={styles.routeRail}>
            <View style={styles.stopSquare}><Text style={styles.stopNumber}>1</Text></View>
            <Text style={styles.routeDots}>•••</Text>
            <View style={styles.stopPin}><Text style={styles.stopNumber}>{Math.max(2, stops.length)}</Text></View>
          </View>
          <View style={styles.routeCopy}>
            <View><Text style={styles.place}>{job.pickupLocation}</Text><Text style={styles.routeTime}>{formatDeliveryDate(job.pickupTime)}</Text></View>
            <View><Text style={styles.place}>{job.deliveryLocation}</Text><Text style={styles.routeTime}>{formatDeliveryDate(job.deliveryTime)}</Text></View>
          </View>
        </View>

        {distance ? <View style={styles.distanceRow}><Ionicons name="navigate-outline" size={20} color="#292837" /><Text style={styles.distance}>{distance}</Text></View> : null}

        <View style={styles.loadDetails}>
          <Text style={styles.sectionLabel}>LOAD DETAILS</Text>
          <DetailRow label="Vehicle" value={job.vehicleRequirement} />
          {job.weight ? <DetailRow label="Weight" value={job.weight} /> : null}
          {job.dimensions ? <DetailRow label="Dimensions" value={job.dimensions} /> : null}
          {job.palletCount ? <DetailRow label="Pallets" value={String(job.palletCount)} /> : null}
          {job.tailLift ? <DetailRow label="Extras" value="Tail lift" /> : null}
        </View>

        {notes.map((note, index) => <View key={`${index}-${note.slice(0, 16)}`} style={styles.noteCard}>
          {index === 0 ? <Text style={styles.noteHeading}>NOTES</Text> : null}
          <Text style={styles.noteText}>{note}</Text>
        </View>)}

        <View style={styles.attachmentsSection}>
          <Text style={styles.sectionLabel}>ATTACHMENTS</Text>
          {job.attachments?.length ? job.attachments.map((attachment, index) => {
            const url = attachment.signedUrl || attachment.url;
            return <Pressable key={attachment.id || `${attachment.fileName}-${index}`} disabled={!url} onPress={() => url && void Linking.openURL(url)} style={styles.attachment}>
              <Ionicons name="document-text-outline" size={21} color="#292837" />
              <Text style={styles.attachmentName} numberOfLines={2}>{attachment.fileName || attachment.type || `Attachment ${index + 1}`}</Text>
              {url ? <Ionicons name="chevron-forward" size={20} color="#777684" /> : null}
            </Pressable>;
          }) : <Text style={styles.emptyText}>No attachments for this booking.</Text>}
        </View>

        {job.podCompleted ? <View style={styles.podButton}><Text style={styles.podButtonText}>View POD</Text></View> : null}
      </View> : null}

      {tab === 'stops' ? <View style={styles.card}>
        {stops.map((stop, index) => <StopBlock key={stop.id || `${stop.sequence}-${index}`} stop={stop} index={index} />)}
        {next ? <View style={styles.actionWrap}><ActionButton disabled={busy} label={busy ? 'Updating…' : next.label} onPress={() => onAdvance(next.endpoint)} /></View> : null}
      </View> : null}

      {tab === 'status' ? <View style={styles.card}>
        {job.status === 'cancelled' ? <View style={styles.terminalNotice}><Text style={styles.terminalTitle}>Booking cancelled</Text><Text style={styles.terminalText}>No further driver action is available for this job.</Text></View> : <DeliveryTimeline status={job.status} />}
        <View style={styles.statusCurrent}><Text style={styles.statusCurrentLabel}>CURRENT STATUS</Text><Text style={styles.statusCurrentValue}>{statusLabel(job.status)}</Text></View>
        {next ? <View style={styles.actionWrap}><ActionButton disabled={busy} label={busy ? 'Updating…' : next.label} onPress={() => onAdvance(next.endpoint)} /></View> : null}
      </View> : null}
    </ScrollView>
  </View>;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.detailRow}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value || 'Not supplied'}</Text></View>;
}

function StopBlock({ stop, index }: { stop: DriverJobStop; index: number }) {
  const time = stop.timeWindowFrom ? formatDeliveryDate(stop.timeWindowFrom) : 'ASAP';
  const title = stopTitle(stop, index);
  return <View style={styles.stopRow}>
    <View style={styles.stopMarkerColumn}>
      <View style={styles.stopSquare}><Text style={styles.stopNumber}>{index + 1}</Text></View>
      {index >= 0 ? <Text style={styles.stopDots}>•••</Text> : null}
    </View>
    <View style={styles.stopCopy}>
      <Text style={styles.stopTitle}>{title}</Text>
      <Text style={styles.stopTime}>{time}</Text>
      {stop.company ? <Text style={styles.stopCompany}>{stop.company}</Text> : null}
      <Text style={styles.stopAddress}>{stop.address}</Text>
      {stop.notes ? <Text style={styles.stopNotes}>{stop.notes}</Text> : null}
    </View>
    <Ionicons name="chevron-forward" size={20} color="#A6A6AF" />
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#292837' },
  topbar: { minHeight: 74, paddingTop: 16, paddingHorizontal: 12, backgroundColor: '#292837', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, textAlign: 'center', fontFamily: 'Inter_600SemiBold', fontSize: 18, color: '#FFFFFF' },
  tabs: { marginHorizontal: 16, marginBottom: 16, padding: 4, backgroundColor: '#3A3949', borderRadius: 30, flexDirection: 'row' },
  tab: { flex: 1, minHeight: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: '#FFE66A' },
  tabText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#FFFFFF' },
  tabTextActive: { fontFamily: 'Inter_700Bold', color: '#111111' },
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  cardHeader: { backgroundColor: '#E6E7EC', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, gap: 4 },
  company: { fontFamily: 'Inter_700Bold', fontSize: 18, lineHeight: 24, color: '#474655' },
  reference: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#777684' },
  card: { backgroundColor: '#FFFFFF', borderBottomLeftRadius: 18, borderBottomRightRadius: 18, padding: 16, gap: 16, minHeight: 420, ...shadow },
  routeCard: { flexDirection: 'row', borderWidth: 1, borderColor: '#E1E2E7', borderRadius: 16, padding: 14, gap: 12 },
  routeRail: { width: 34, alignItems: 'center', justifyContent: 'space-between' },
  stopSquare: { width: 30, height: 30, borderRadius: 4, backgroundColor: '#5199D6', alignItems: 'center', justifyContent: 'center' },
  stopPin: { width: 30, height: 34, borderRadius: 17, borderBottomLeftRadius: 5, backgroundColor: '#5199D6', alignItems: 'center', justifyContent: 'center' },
  stopNumber: { fontFamily: 'Inter_700Bold', fontSize: 12, color: '#FFFFFF' },
  routeDots: { transform: [{ rotate: '90deg' }], color: '#CDD2D9', letterSpacing: 1 },
  routeCopy: { flex: 1, justifyContent: 'space-between', gap: 20 },
  place: { fontFamily: 'Inter_700Bold', fontSize: 18, color: '#474655' },
  routeTime: { marginTop: 4, fontFamily: 'Inter_500Medium', fontSize: 14, color: '#7D7C8A' },
  distanceRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  distance: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#777684' },
  loadDetails: { gap: 8 },
  sectionLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 13, letterSpacing: 1.2, color: '#7A7987' },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  detailLabel: { width: 90, fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#292837' },
  detailValue: { flex: 1, fontFamily: 'Inter_700Bold', fontSize: 14, color: '#292837' },
  noteCard: { backgroundColor: '#F0F1F4', borderRadius: 14, padding: 14, gap: 8 },
  noteHeading: { fontFamily: 'Inter_600SemiBold', fontSize: 13, letterSpacing: 0.8, color: '#565563' },
  noteText: { fontFamily: 'Inter_500Medium', fontSize: 15, lineHeight: 23, color: '#292837' },
  attachmentsSection: { gap: 10, paddingTop: 4, borderTopWidth: 1, borderTopColor: '#E0E1E6' },
  attachment: { minHeight: 58, borderWidth: 2, borderStyle: 'dashed', borderColor: '#4D99D7', borderRadius: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  attachmentName: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#292837' },
  emptyText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#777684' },
  podButton: { minHeight: 54, borderRadius: 27, backgroundColor: '#65C653', alignItems: 'center', justifyContent: 'center' },
  podButtonText: { fontFamily: 'Inter_700Bold', fontSize: 17, color: '#FFFFFF' },
  stopRow: { minHeight: 112, flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 6 },
  stopMarkerColumn: { width: 34, alignItems: 'center' },
  stopDots: { marginTop: 8, transform: [{ rotate: '90deg' }], color: '#D0D2D8', letterSpacing: 1 },
  stopCopy: { flex: 1 },
  stopTitle: { fontFamily: 'Inter_700Bold', fontSize: 17, color: '#292837' },
  stopTime: { marginTop: 4, fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#777684' },
  stopCompany: { marginTop: 8, fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#777684' },
  stopAddress: { marginTop: 5, fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20, color: '#777684' },
  stopNotes: { marginTop: 7, fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 19, color: '#777684' },
  actionWrap: { paddingTop: 6 },
  statusCurrent: { borderTopWidth: 1, borderTopColor: '#E1E2E7', paddingTop: 12, gap: 4 },
  statusCurrentLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 1, color: '#777684' },
  statusCurrentValue: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#292837' },
  terminalNotice: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, backgroundColor: '#F8FAFC', padding: 14 },
  terminalTitle: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#292837' },
  terminalText: { marginTop: 4, fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 17, color: '#62616F' },
});