import { useMemo, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { Linking, Modal, StyleSheet } from 'react-native';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from '../theme/primitives';
import { UiIcon as Ionicons } from '../components/UiIcon';
import type { DriverJob, DriverJobStop } from '../types/driver';
import { getNextStep, statusLabel } from '../types/statusFlow';
import { ActionButton } from '../components/ActionButton';
import { DeliveryTimeline } from '../components/DeliveryTimeline';
import { uploadJobEvidence, type JobEvidenceCategory } from '../api/driver';
import { shadow } from '../theme/tokens';
import { formatDeliveryDate } from '../utils/format';

type DetailTab = 'summary' | 'stops' | 'status';

type PodView = {
  receiverName?: string;
  receiverCompany?: string;
  date?: string;
  time?: string;
  quantityDelivered?: string;
  itemsMissing?: string;
  itemsDamaged?: string;
  receiverNotes?: string;
  driverNotes?: string;
  comments?: string;
  deliveryPhotoUris?: string[];
  damagePhotoUris?: string[];
  documentUris?: string[];
};

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

function stopTime(stop: DriverJobStop) {
  const from = stop.timeWindowFrom ? formatDeliveryDate(stop.timeWindowFrom) : 'ASAP';
  if (!stop.timeWindowTo || stop.timeWindowTo === stop.timeWindowFrom) return from;
  return `${from} - ${formatDeliveryDate(stop.timeWindowTo)}`;
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

function podView(value: DriverJob['pod']): PodView | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const pod = value as Record<string, unknown>;
  const stringValue = (key: string) => typeof pod[key] === 'string' && String(pod[key]).trim() ? String(pod[key]).trim() : undefined;
  const urls = (key: string) => Array.isArray(pod[key]) ? (pod[key] as unknown[]).filter((item): item is string => typeof item === 'string' && item.startsWith('http')) : undefined;
  return {
    receiverName: stringValue('receiverName'),
    receiverCompany: stringValue('receiverCompany'),
    date: stringValue('date'),
    time: stringValue('time'),
    quantityDelivered: stringValue('quantityDelivered'),
    itemsMissing: stringValue('itemsMissing'),
    itemsDamaged: stringValue('itemsDamaged'),
    receiverNotes: stringValue('receiverNotes'),
    driverNotes: stringValue('driverNotes'),
    comments: stringValue('comments'),
    deliveryPhotoUris: urls('deliveryPhotoUris'),
    damagePhotoUris: urls('damagePhotoUris'),
    documentUris: urls('documentUris'),
  };
}

export function JobDetailScreen({ job, busy, onBack, onAdvance }: {
  job: DriverJob;
  busy: boolean;
  onBack: () => void;
  onAdvance: (endpoint: string) => void;
}) {
  const [tab, setTab] = useState<DetailTab>('summary');
  const [selectedStop, setSelectedStop] = useState<{ stop: DriverJobStop; index: number } | null>(null);
  const [showPod, setShowPod] = useState(false);
  const [evidenceBusy, setEvidenceBusy] = useState<JobEvidenceCategory | null>(null);
  const [evidenceMessage, setEvidenceMessage] = useState('');
  const [stagedEvidence, setStagedEvidence] = useState<string[]>([]);
  const next = getNextStep(job.status);
  const stops = useMemo(() => job.stops?.length ? job.stops : fallbackStops(job), [job]);
  const distance = distanceLine(job);
  const notes = [job.customerNotes, job.notesSummary, job.specialInstructions, job.pickupNote, job.deliveryNote].filter((value, index, all): value is string => Boolean(value) && all.indexOf(value) === index);
  const pod = podView(job.pod);
  const canStageEvidence = job.status !== 'delivered' && job.status !== 'cancelled';

  async function pickEvidence(category: JobEvidenceCategory) {
    if (evidenceBusy) return;
    setEvidenceMessage('');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: category === 'photos' ? ['image/jpeg', 'image/png'] : ['application/pdf', 'image/jpeg', 'image/png'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const lowerName = asset.name.toLowerCase();
      if (lowerName.endsWith('.webp')) throw new Error('Use a JPG or PNG image for POD evidence.');
      if (asset.size && asset.size > 10 * 1024 * 1024) throw new Error('Evidence files must be 10 MB or smaller.');
      setEvidenceBusy(category);
      await uploadJobEvidence({
        jobId: job.id,
        uri: asset.uri,
        fileName: asset.name,
        mimeType: asset.mimeType,
        category,
      });
      setStagedEvidence((current) => [...current, asset.name]);
      setEvidenceMessage(`${asset.name} is securely staged for this booking's POD.`);
    } catch (cause) {
      setEvidenceMessage(cause instanceof Error ? cause.message : 'Evidence could not be uploaded.');
    } finally {
      setEvidenceBusy(null);
    }
  }

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
          }) : <Text style={styles.emptyText}>No customer attachments for this booking.</Text>}

          {canStageEvidence ? <View style={styles.evidenceActions}>
            <Pressable accessibilityRole="button" accessibilityLabel="Add POD document" disabled={Boolean(evidenceBusy)} onPress={() => void pickEvidence('documents')} style={styles.evidenceAction}>
              {evidenceBusy === 'documents' ? <ActivityIndicator size="small" color="#292837" /> : <Ionicons name="document-text-outline" size={24} color="#292837" />}
              <Text style={styles.evidenceActionTitle}>Add Document</Text>
              <Text style={styles.evidenceActionHint}>PDF, JPG or PNG</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Add POD image" disabled={Boolean(evidenceBusy)} onPress={() => void pickEvidence('photos')} style={styles.evidenceAction}>
              {evidenceBusy === 'photos' ? <ActivityIndicator size="small" color="#292837" /> : <Ionicons name="cube-outline" size={24} color="#292837" />}
              <Text style={styles.evidenceActionTitle}>Add Image</Text>
              <Text style={styles.evidenceActionHint}>JPG or PNG</Text>
            </Pressable>
          </View> : null}
          {stagedEvidence.map((name, index) => <View key={`${name}-${index}`} style={styles.stagedRow}><View style={styles.stagedDot} /><Text style={styles.stagedText}>{name} · staged for POD</Text></View>)}
          {evidenceMessage ? <Text style={styles.evidenceMessage}>{evidenceMessage}</Text> : null}
        </View>

        {job.podCompleted && pod ? <Pressable accessibilityRole="button" accessibilityLabel="View proof of delivery" onPress={() => setShowPod(true)} style={styles.podButton}><Text style={styles.podButtonText}>View POD</Text></Pressable> : null}
      </View> : null}

      {tab === 'stops' ? <View style={styles.card}>
        {stops.map((stop, index) => <StopBlock key={stop.id || `${stop.sequence}-${index}`} stop={stop} index={index} onOpen={() => setSelectedStop({ stop, index })} />)}
        {next ? <View style={styles.actionWrap}><ActionButton disabled={busy} label={busy ? 'Updating…' : next.label} onPress={() => onAdvance(next.endpoint)} /></View> : null}
      </View> : null}

      {tab === 'status' ? <View style={styles.card}>
        {job.status === 'cancelled' ? <View style={styles.terminalNotice}><Text style={styles.terminalTitle}>Booking cancelled</Text><Text style={styles.terminalText}>No further driver action is available for this job.</Text></View> : <DeliveryTimeline status={job.status} />}
        <View style={styles.statusCurrent}><Text style={styles.statusCurrentLabel}>CURRENT STATUS</Text><Text style={styles.statusCurrentValue}>{statusLabel(job.status)}</Text></View>
        {next ? <View style={styles.actionWrap}><ActionButton disabled={busy} label={busy ? 'Updating…' : next.label} onPress={() => onAdvance(next.endpoint)} /></View> : null}
      </View> : null}
    </ScrollView>

    <StopDetailModal selected={selectedStop} onClose={() => setSelectedStop(null)} />
    <PodModal visible={showPod} pod={pod} onClose={() => setShowPod(false)} />
  </View>;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.detailRow}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value || 'Not supplied'}</Text></View>;
}

function StopBlock({ stop, index, onOpen }: { stop: DriverJobStop; index: number; onOpen: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open stop ${index + 1} details`} onPress={onOpen} style={({ pressed }) => [styles.stopRow, pressed && styles.pressed]}>
    <View style={styles.stopMarkerColumn}>
      <View style={styles.stopSquare}><Text style={styles.stopNumber}>{index + 1}</Text></View>
      <Text style={styles.stopDots}>•••</Text>
    </View>
    <View style={styles.stopCopy}>
      <Text style={styles.stopTitle}>{stopTitle(stop, index)}</Text>
      <Text style={styles.stopTime}>{stopTime(stop)}</Text>
      {stop.company ? <Text style={styles.stopCompany}>{stop.company}</Text> : null}
      <Text style={styles.stopAddress}>{stop.address}</Text>
      {stop.notes ? <Text style={styles.stopNotes}>{stop.notes}</Text> : null}
    </View>
    <Ionicons name="chevron-forward" size={20} color="#A6A6AF" />
  </Pressable>;
}

function StopDetailModal({ selected, onClose }: { selected: { stop: DriverJobStop; index: number } | null; onClose: () => void }) {
  const stop = selected?.stop;
  const index = selected?.index ?? 0;
  return <Modal visible={Boolean(stop)} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.modalBackdrop}>
      <View style={styles.modalCard}>
        {stop ? <>
          <View style={styles.modalHeader}>
            <View style={styles.modalStopNumber}><Text style={styles.modalStopNumberText}>{index + 1}</Text></View>
            <View style={styles.modalHeaderCopy}><Text style={styles.modalTitle}>{stopTitle(stop, index)}</Text><Text style={styles.modalSubtitle}>{stop.address}</Text></View>
          </View>
          <View style={styles.modalDivider} />
          <ModalField label="Time" value={stopTime(stop)} />
          <ModalField label="Company" value={stop.company || 'Not supplied'} />
          <ModalField label="Address" value={stop.address} />
          {stop.contactPerson ? <ModalField label="Contact" value={stop.contactPerson} /> : null}
          {stop.telephone ? <Pressable accessibilityRole="button" accessibilityLabel="Call stop contact" onPress={() => void Linking.openURL(`tel:${stop.telephone}`)}><ModalField label="Telephone" value={stop.telephone} link /></Pressable> : null}
          {stop.status ? <ModalField label="Status" value={stop.status.replace(/[_-]+/g, ' ')} /> : null}
          {stop.notes ? <ModalField label="Notes" value={stop.notes} /> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Close stop details" onPress={onClose} style={styles.modalClose}><Text style={styles.modalCloseText}>Close</Text></Pressable>
        </> : null}
      </View>
    </View>
  </Modal>;
}

function ModalField({ label, value, link = false }: { label: string; value: string; link?: boolean }) {
  return <View style={styles.modalField}><Text style={styles.modalFieldLabel}>{label}</Text><Text style={[styles.modalFieldValue, link && styles.modalLink]}>{value}</Text></View>;
}

function PodModal({ visible, pod, onClose }: { visible: boolean; pod: PodView | null; onClose: () => void }) {
  const evidence = [
    ...(pod?.deliveryPhotoUris ?? []).map((url, index) => ({ url, label: `Delivery image ${index + 1}` })),
    ...(pod?.damagePhotoUris ?? []).map((url, index) => ({ url, label: `Damage image ${index + 1}` })),
    ...(pod?.documentUris ?? []).map((url, index) => ({ url, label: `POD document ${index + 1}` })),
  ];
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.modalBackdrop}>
      <View style={[styles.modalCard, styles.podModalCard]}>
        <Text style={styles.podModalTitle}>Proof of Delivery</Text>
        <Text style={styles.podModalSubtitle}>{[pod?.date, pod?.time].filter(Boolean).join(' · ') || 'Completed POD'}</Text>
        <View style={styles.modalDivider} />
        <ModalField label="Received by" value={pod?.receiverName || 'Recipient'} />
        {pod?.receiverCompany ? <ModalField label="Company" value={pod.receiverCompany} /> : null}
        {pod?.quantityDelivered ? <ModalField label="Quantity" value={pod.quantityDelivered} /> : null}
        {pod?.itemsMissing ? <ModalField label="Missing" value={pod.itemsMissing} /> : null}
        {pod?.itemsDamaged ? <ModalField label="Damaged" value={pod.itemsDamaged} /> : null}
        {pod?.receiverNotes ? <ModalField label="Receiver notes" value={pod.receiverNotes} /> : null}
        {pod?.driverNotes ? <ModalField label="Driver notes" value={pod.driverNotes} /> : null}
        {pod?.comments ? <ModalField label="Comments" value={pod.comments} /> : null}
        {evidence.length ? <View style={styles.podEvidenceList}>{evidence.map((item) => <Pressable key={item.url} accessibilityRole="link" onPress={() => void Linking.openURL(item.url)} style={styles.podEvidenceRow}><Ionicons name="document-text-outline" size={20} color="#292837" /><Text style={styles.podEvidenceText}>{item.label}</Text><Ionicons name="chevron-forward" size={18} color="#777684" /></Pressable>)}</View> : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Close POD" onPress={onClose} style={styles.modalClose}><Text style={styles.modalCloseText}>Close</Text></Pressable>
      </View>
    </View>
  </Modal>;
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
  evidenceActions: { flexDirection: 'row', gap: 10 },
  evidenceAction: { flex: 1, minHeight: 96, borderRadius: 14, borderWidth: 1, borderColor: '#D9DAE0', backgroundColor: '#F6F6F8', padding: 12, alignItems: 'center', justifyContent: 'center' },
  evidenceActionTitle: { marginTop: 6, fontFamily: 'Inter_700Bold', fontSize: 14, color: '#292837' },
  evidenceActionHint: { marginTop: 2, fontFamily: 'Inter_500Medium', fontSize: 11, color: '#777684' },
  stagedRow: { minHeight: 34, borderRadius: 10, backgroundColor: '#EFF8ED', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 8 },
  stagedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#65C653' },
  stagedText: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#3A6632' },
  evidenceMessage: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 17, color: '#565563' },
  podButton: { minHeight: 54, borderRadius: 27, backgroundColor: '#65C653', alignItems: 'center', justifyContent: 'center' },
  podButtonText: { fontFamily: 'Inter_700Bold', fontSize: 17, color: '#FFFFFF' },
  pressed: { opacity: 0.7 },
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
  terminalNotice: { borderWidth: 1, borderColor: '#D8D9DE', borderRadius: 12, backgroundColor: '#F6F6F8', padding: 14 },
  terminalTitle: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#292837' },
  terminalText: { marginTop: 4, fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 19, color: '#777684' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(13, 13, 20, 0.62)', justifyContent: 'center', padding: 20 },
  modalCard: { maxHeight: '88%', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, ...shadow },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modalStopNumber: { width: 42, height: 42, borderRadius: 8, backgroundColor: '#5199D6', alignItems: 'center', justifyContent: 'center' },
  modalStopNumberText: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#FFFFFF' },
  modalHeaderCopy: { flex: 1 },
  modalTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, color: '#292837' },
  modalSubtitle: { marginTop: 3, fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 18, color: '#777684' },
  modalDivider: { height: 1, backgroundColor: '#E2E3E7', marginVertical: 14 },
  modalField: { marginBottom: 12 },
  modalFieldLabel: { fontFamily: 'Inter_500Medium', fontSize: 11, letterSpacing: 0.7, textTransform: 'uppercase', color: '#8A8996' },
  modalFieldValue: { marginTop: 3, fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20, color: '#292837' },
  modalLink: { color: '#287FC3' },
  modalClose: { marginTop: 6, minHeight: 50, borderRadius: 25, backgroundColor: '#292837', alignItems: 'center', justifyContent: 'center' },
  modalCloseText: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#FFFFFF' },
  podModalCard: { alignSelf: 'stretch' },
  podModalTitle: { fontFamily: 'Inter_700Bold', fontSize: 22, color: '#292837' },
  podModalSubtitle: { marginTop: 3, fontFamily: 'Inter_500Medium', fontSize: 13, color: '#777684' },
  podEvidenceList: { gap: 8, marginBottom: 8 },
  podEvidenceRow: { minHeight: 46, borderWidth: 1, borderColor: '#DFE0E5', borderRadius: 10, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  podEvidenceText: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#292837' },
});
