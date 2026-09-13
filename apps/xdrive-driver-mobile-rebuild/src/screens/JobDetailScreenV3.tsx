import { useMemo, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Image, Linking, Modal, StyleSheet } from 'react-native';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from '../theme/primitives';
import { UiIcon as Ionicons } from '../components/UiIcon';
import { BottomNav, type MainTab } from '../components/BottomNav';
import type { DriverJob, DriverJobStop } from '../types/driver';
import { getNextStep, statusLabel } from '../types/statusFlow';
import { uploadJobEvidence, type JobEvidenceCategory } from '../api/driver';
import { submitPod } from '../api/pod';
import { formatDeliveryDate } from '../utils/format';

// React Native requires a static require for bundled image assets.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const xdriveLogo = require('../../assets/xdrive-home-logo.png');

type EvidenceItem = { name: string; path: string; category: JobEvidenceCategory };
type PodView = {
  receiverName?: string;
  receiverCompany?: string;
  date?: string;
  time?: string;
  quantityDelivered?: string;
  itemsMissing?: string;
  itemsDamaged?: string;
  comments?: string;
  deliveryPhotoUris?: string[];
  damagePhotoUris?: string[];
  documentUris?: string[];
};

type Props = {
  job: DriverJob;
  busy: boolean;
  onBack: () => void;
  onAdvance: (endpoint: string) => void;
  onNavigate?: (tab: MainTab) => void;
  alertCount?: number;
};

const palette = {
  navy: '#0B2F6B',
  blue: '#0E4D8A',
  yellow: '#F4A300',
  green: '#16A34A',
  paper: '#F3F5F8',
  card: '#FFFFFF',
  ink: '#262B35',
  muted: '#6E7787',
  border: '#DDE2E8',
};

function fallbackStops(job: DriverJob): DriverJobStop[] {
  return [
    { sequence: 1, type: 'collection', address: job.pickupLocation, timeWindowFrom: job.pickupTime, notes: job.pickupNote },
    { sequence: 2, type: 'delivery', address: job.deliveryLocation, timeWindowFrom: job.deliveryTime, notes: job.deliveryNote },
  ];
}

function stopTime(stop: DriverJobStop) {
  const from = stop.timeWindowFrom ? formatDeliveryDate(stop.timeWindowFrom) : 'ASAP';
  if (!stop.timeWindowTo || stop.timeWindowTo === stop.timeWindowFrom) return from;
  return `${from} - ${formatDeliveryDate(stop.timeWindowTo)}`;
}

function stopKind(stop: DriverJobStop, index: number) {
  const kind = String(stop.type ?? '').toLowerCase();
  if (kind.includes('collection')) return index === 0 ? 'Collection' : 'Collection stop';
  if (kind.includes('delivery')) return index === 1 ? 'Delivery' : 'Delivery stop';
  return `Stop ${index + 1}`;
}

function operationalStatus(job: DriverJob) {
  if (job.status === 'arrived_pickup' || job.status === 'arrived_delivery') return 'On Site';
  if (job.status === 'on_my_way_pickup') return 'On My Way';
  if (job.status === 'on_my_way_delivery') return 'On My Way';
  if (job.status === 'awarded') return 'Accepted';
  if (job.status === 'delivered') return 'Delivered';
  return statusLabel(job.status);
}

function podView(value: DriverJob['pod']): PodView | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const pod = value as Record<string, unknown>;
  const str = (key: string) => typeof pod[key] === 'string' && String(pod[key]).trim() ? String(pod[key]).trim() : undefined;
  const urls = (key: string) => Array.isArray(pod[key]) ? (pod[key] as unknown[]).filter((item): item is string => typeof item === 'string' && item.startsWith('http')) : undefined;
  return {
    receiverName: str('receiverName'), receiverCompany: str('receiverCompany'), date: str('date'), time: str('time'),
    quantityDelivered: str('quantityDelivered'), itemsMissing: str('itemsMissing'), itemsDamaged: str('itemsDamaged'),
    comments: str('comments'), deliveryPhotoUris: urls('deliveryPhotoUris'), damagePhotoUris: urls('damagePhotoUris'), documentUris: urls('documentUris'),
  };
}

export function JobDetailScreen({ job, busy, onBack, onAdvance, onNavigate, alertCount = 0 }: Props) {
  const [selectedStop, setSelectedStop] = useState<{ stop: DriverJobStop; index: number } | null>(null);
  const [showPod, setShowPod] = useState(false);
  const [capturePod, setCapturePod] = useState(false);
  const [evidenceBusy, setEvidenceBusy] = useState<JobEvidenceCategory | null>(null);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [evidenceMessage, setEvidenceMessage] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [podNotes, setPodNotes] = useState('');
  const [signatureData, setSignatureData] = useState('');
  const [signatureLabel, setSignatureLabel] = useState('');
  const [podBusy, setPodBusy] = useState(false);
  const [podError, setPodError] = useState('');

  const stops = useMemo(() => job.stops?.length ? job.stops : fallbackStops(job), [job]);
  const next = getNextStep(job.status);
  const pod = podView(job.pod);
  const paymentBadge = job.badges?.find((badge) => /paid|smartpay/i.test(badge));
  const notes = [job.customerNotes, job.notesSummary, job.specialInstructions, job.pickupNote, job.deliveryNote]
    .filter((value, index, all): value is string => Boolean(value) && all.indexOf(value) === index);

  async function pickEvidence(category: JobEvidenceCategory) {
    if (evidenceBusy || podBusy) return;
    setEvidenceMessage('');
    setPodError('');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: category === 'photos' ? ['image/jpeg', 'image/png'] : ['application/pdf', 'image/jpeg', 'image/png'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (asset.size && asset.size > 10 * 1024 * 1024) throw new Error('Evidence files must be 10 MB or smaller.');
      setEvidenceBusy(category);
      const uploaded = await uploadJobEvidence({ jobId: job.id, uri: asset.uri, fileName: asset.name, mimeType: asset.mimeType, category });
      setEvidence((current) => [...current, { name: asset.name, path: uploaded.storagePath, category }]);
      setEvidenceMessage(`${asset.name} is staged for this booking.`);
    } catch (cause) {
      setEvidenceMessage(cause instanceof Error ? cause.message : 'Evidence could not be uploaded.');
    } finally {
      setEvidenceBusy(null);
    }
  }

  async function pickSignature() {
    setPodError('');
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['image/jpeg', 'image/png'], copyToCacheDirectory: true, multiple: false });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (asset.size && asset.size > 1_800_000) throw new Error('Signature image must be smaller than 1.8 MB.');
      const lower = asset.name.toLowerCase();
      const mime = asset.mimeType === 'image/png' || lower.endsWith('.png') ? 'image/png' : 'image/jpeg';
      const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      setSignatureData(`data:${mime};base64,${base64}`);
      setSignatureLabel(asset.name);
    } catch (cause) {
      setPodError(cause instanceof Error ? cause.message : 'Signature image could not be selected.');
    }
  }

  async function submitPodAndDeliver() {
    setPodError('');
    const photos = evidence.filter((item) => item.category === 'photos').map((item) => item.path);
    const documents = evidence.filter((item) => item.category === 'documents').map((item) => item.path);
    if (!recipientName.trim()) return setPodError('Recipient name is required.');
    if (job.podRequired && photos.length === 0) return setPodError('At least one delivery image is required.');
    if (job.podRequired && !signatureData) return setPodError('A recipient signature image is required.');
    if (!job.podRequired && photos.length === 0 && documents.length === 0 && !signatureData) return setPodError('Add a signature, image or document before submitting POD.');
    setPodBusy(true);
    try {
      await submitPod(job.id, { recipientName, signatureData, photoUris: photos, documentUris: documents, notes: podNotes });
      setCapturePod(false);
      onAdvance('delivered');
    } catch (cause) {
      setPodError(cause instanceof Error ? cause.message : 'POD could not be submitted.');
    } finally {
      setPodBusy(false);
    }
  }

  function navigate(tab: MainTab) {
    if (tab === 'bookings') return;
    if (onNavigate) onNavigate(tab);
    else onBack();
  }

  return <View style={styles.page}>
    <View style={styles.header}>
      <Image source={xdriveLogo} resizeMode="contain" style={styles.logo} />
      <Pressable accessibilityRole="button" accessibilityLabel="Back to bookings" onPress={onBack} style={styles.headerButton}>
        <Ionicons name="log-out-outline" size={26} color="#FFFFFF" />
      </Pressable>
    </View>

    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.metaRow}>
        <View style={styles.badgeColumn}>
          {paymentBadge ? <View style={styles.paymentPill}><Text style={styles.paymentText}>{paymentBadge}</Text></View> : null}
          <View style={styles.statusPill}><Text style={styles.statusText}>{operationalStatus(job)}</Text></View>
        </View>
        <Text style={styles.reference}>Ref {job.customerReference || job.reference}</Text>
      </View>

      <RouteCard job={job} />

      <SectionCard title="What I'm moving">
        <InfoRow label="Vehicle" value={job.vehicleRequirement || 'Not supplied'} />
        <InfoRow label="Load Size" value={job.cargoType || 'Not supplied'} />
        <InfoRow label="Dimensions" value={job.dimensions || 'Not supplied'} />
        <InfoRow label="Weight" value={job.weight || 'Not supplied'} />
        <InfoRow label="Quantity" value={job.palletCount ? `${job.palletCount} pallet${job.palletCount === 1 ? '' : 's'}` : 'Not supplied'} />
      </SectionCard>

      <SectionCard title="Stops">
        {stops.map((stop, index) => <StopRow key={stop.id || `${stop.sequence}-${index}`} stop={stop} index={index} onPress={() => setSelectedStop({ stop, index })} />)}
      </SectionCard>

      {notes.length ? <SectionCard title="Notes">{notes.map((note, index) => <Text key={`${index}-${note.slice(0, 12)}`} style={styles.noteText}>{note}</Text>)}</SectionCard> : null}

      {(job.attachments?.length || job.status !== 'delivered') ? <SectionCard title="Documents & POD">
        {job.attachments?.map((attachment, index) => {
          const url = attachment.signedUrl || attachment.url;
          return <Pressable key={attachment.id || `${index}`} disabled={!url} onPress={() => url && void Linking.openURL(url)} style={styles.documentRow}>
            <Ionicons name="document-text-outline" size={20} color={palette.navy} />
            <Text style={styles.documentText}>{attachment.fileName || attachment.type || `Attachment ${index + 1}`}</Text>
            <Ionicons name="chevron-forward" size={18} color={palette.muted} />
          </Pressable>;
        })}
        {job.status !== 'delivered' ? <View style={styles.evidenceRow}>
          <EvidenceButton label="Add Document" busy={evidenceBusy === 'documents'} onPress={() => void pickEvidence('documents')} />
          <EvidenceButton label="Add Image" busy={evidenceBusy === 'photos'} onPress={() => void pickEvidence('photos')} />
        </View> : null}
        {evidenceMessage ? <Text style={styles.helper}>{evidenceMessage}</Text> : null}
      </SectionCard> : null}

      {job.podCompleted && pod ? <Pressable onPress={() => setShowPod(true)} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>View POD</Text></Pressable> : null}
      {next ? <Pressable disabled={busy || podBusy} onPress={() => next.endpoint === 'delivered' ? setCapturePod(true) : onAdvance(next.endpoint)} style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>{busy ? 'Updating…' : next.endpoint === 'delivered' ? 'Capture POD' : next.label}</Text>
      </Pressable> : null}
      <View style={{ height: 12 }} />
    </ScrollView>

    <BottomNav active="bookings" onChange={navigate} alertCount={alertCount} />
    <StopModal selected={selectedStop} onClose={() => setSelectedStop(null)} />
    <PodViewModal visible={showPod} pod={pod} onClose={() => setShowPod(false)} />
    <PodCaptureModal
      visible={capturePod} job={job} evidence={evidence} recipientName={recipientName} setRecipientName={setRecipientName}
      notes={podNotes} setNotes={setPodNotes} signatureLabel={signatureLabel} signatureReady={Boolean(signatureData)}
      podBusy={podBusy} podError={podError} evidenceBusy={evidenceBusy} onAddImage={() => void pickEvidence('photos')}
      onAddDocument={() => void pickEvidence('documents')} onPickSignature={() => void pickSignature()}
      onSubmit={() => void submitPodAndDeliver()} onClose={() => setCapturePod(false)}
    />
  </View>;
}

function RouteCard({ job }: { job: DriverJob }) {
  return <View style={styles.routeCard}>
    <RoutePoint number={1} place={job.pickupLocation} time={formatDeliveryDate(job.pickupTime)} first />
    <View style={styles.routeConnector} />
    <RoutePoint number={2} place={job.deliveryLocation} time={formatDeliveryDate(job.deliveryTime)} />
  </View>;
}

function RoutePoint({ number, place, time, first = false }: { number: number; place: string; time: string; first?: boolean }) {
  return <View style={styles.routePoint}>
    <View style={[styles.routeMarker, first ? styles.routeMarkerSquare : styles.routeMarkerRound]}><Text style={styles.markerText}>{number}</Text></View>
    <View style={styles.routeCopy}><Text style={styles.routePlace}>{place}</Text><Text style={styles.routeTime}>{time}</Text></View>
  </View>;
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={styles.sectionCard}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>;
}

function StopRow({ stop, index, onPress }: { stop: DriverJobStop; index: number; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.stopRow}>
    <View style={[styles.stopMarker, index === 0 ? styles.routeMarkerSquare : styles.routeMarkerRound]}><Text style={styles.markerText}>{index + 1}</Text></View>
    <View style={styles.stopCopy}><Text style={styles.stopTitle}>{stopKind(stop, index)}</Text><Text style={styles.stopAddress}>{stop.address}</Text><Text style={styles.stopTime}>{stopTime(stop)}</Text></View>
    <Ionicons name="chevron-forward" size={19} color="#A5ACB7" />
  </Pressable>;
}

function EvidenceButton({ label, busy, onPress }: { label: string; busy: boolean; onPress: () => void }) {
  return <Pressable disabled={busy} onPress={onPress} style={styles.evidenceButton}>{busy ? <ActivityIndicator size="small" color={palette.navy} /> : <Ionicons name="add-circle-outline" size={21} color={palette.navy} />}<Text style={styles.evidenceText}>{label}</Text></Pressable>;
}

function StopModal({ selected, onClose }: { selected: { stop: DriverJobStop; index: number } | null; onClose: () => void }) {
  const stop = selected?.stop;
  const index = selected?.index ?? 0;
  return <Modal visible={Boolean(stop)} transparent animationType="fade" onRequestClose={onClose}><View style={styles.backdrop}><View style={styles.modal}>{stop ? <>
    <View style={styles.modalHead}><View style={[styles.stopMarker, index === 0 ? styles.routeMarkerSquare : styles.routeMarkerRound]}><Text style={styles.markerText}>{index + 1}</Text></View><View style={{ flex: 1 }}><Text style={styles.modalTitle}>{stopKind(stop, index)}</Text><Text style={styles.modalSubtitle}>{stop.address}</Text></View></View>
    <View style={styles.modalDivider} /><ModalField label="Time" value={stopTime(stop)} /><ModalField label="Company" value={stop.company || 'Not supplied'} /><ModalField label="Address" value={stop.address} />
    {stop.contactPerson ? <ModalField label="Contact" value={stop.contactPerson} /> : null}
    {stop.telephone ? <Pressable onPress={() => void Linking.openURL(`tel:${stop.telephone}`)}><ModalField label="Telephone" value={stop.telephone} /></Pressable> : null}
    {stop.notes ? <ModalField label="Notes" value={stop.notes} /> : null}
    <Pressable onPress={onClose} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Close</Text></Pressable>
  </> : null}</View></View></Modal>;
}

function ModalField({ label, value }: { label: string; value: string }) {
  return <View style={styles.modalField}><Text style={styles.modalLabel}>{label}</Text><Text style={styles.modalValue}>{value}</Text></View>;
}

function PodViewModal({ visible, pod, onClose }: { visible: boolean; pod: PodView | null; onClose: () => void }) {
  const links = [...(pod?.deliveryPhotoUris ?? []), ...(pod?.damagePhotoUris ?? []), ...(pod?.documentUris ?? [])];
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={styles.backdrop}><View style={styles.modal}><ScrollView>
    <Text style={styles.modalTitle}>Proof of Delivery</Text><Text style={styles.modalSubtitle}>{[pod?.date, pod?.time].filter(Boolean).join(' · ')}</Text><View style={styles.modalDivider} />
    <ModalField label="Received by" value={pod?.receiverName || 'Recipient'} />{pod?.receiverCompany ? <ModalField label="Company" value={pod.receiverCompany} /> : null}{pod?.quantityDelivered ? <ModalField label="Quantity" value={pod.quantityDelivered} /> : null}{pod?.itemsMissing ? <ModalField label="Missing" value={pod.itemsMissing} /> : null}{pod?.itemsDamaged ? <ModalField label="Damaged" value={pod.itemsDamaged} /> : null}{pod?.comments ? <ModalField label="Comments" value={pod.comments} /> : null}
    {links.map((url, index) => <Pressable key={url} onPress={() => void Linking.openURL(url)} style={styles.documentRow}><Ionicons name="document-text-outline" size={20} color={palette.navy} /><Text style={styles.documentText}>POD evidence {index + 1}</Text><Ionicons name="chevron-forward" size={18} color={palette.muted} /></Pressable>)}
    <Pressable onPress={onClose} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Close</Text></Pressable>
  </ScrollView></View></View></Modal>;
}

function PodCaptureModal(props: { visible: boolean; job: DriverJob; evidence: EvidenceItem[]; recipientName: string; setRecipientName: (value: string) => void; notes: string; setNotes: (value: string) => void; signatureLabel: string; signatureReady: boolean; podBusy: boolean; podError: string; evidenceBusy: JobEvidenceCategory | null; onAddImage: () => void; onAddDocument: () => void; onPickSignature: () => void; onSubmit: () => void; onClose: () => void }) {
  return <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onClose}><View style={styles.backdrop}><View style={styles.modal}><ScrollView showsVerticalScrollIndicator={false}>
    <Text style={styles.modalTitle}>Capture POD</Text><Text style={styles.modalSubtitle}>{props.job.podRequired ? 'Recipient name, delivery image and signature are required.' : 'Add delivery evidence.'}</Text><View style={styles.modalDivider} />
    <Text style={styles.fieldLabel}>RECIPIENT NAME</Text><TextInput value={props.recipientName} onChangeText={props.setRecipientName} placeholder="Name of person receiving goods" style={styles.input} />
    <View style={styles.evidenceRow}><EvidenceButton label="Add Image" busy={props.evidenceBusy === 'photos'} onPress={props.onAddImage} /><EvidenceButton label="Add Document" busy={props.evidenceBusy === 'documents'} onPress={props.onAddDocument} /></View>
    <Pressable onPress={props.onPickSignature} style={[styles.signatureButton, props.signatureReady && styles.signatureReady]}><Ionicons name="create-outline" size={21} color={palette.navy} /><View style={{ flex: 1 }}><Text style={styles.signatureTitle}>{props.signatureReady ? 'Signature added' : 'Add Signature Image'}</Text><Text style={styles.helper}>{props.signatureLabel || 'PNG or JPG of recipient signature'}</Text></View></Pressable>
    <Text style={styles.fieldLabel}>DRIVER NOTES</Text><TextInput value={props.notes} onChangeText={props.setNotes} multiline maxLength={5000} placeholder="Optional POD notes" style={[styles.input, styles.notesInput]} />
    {props.podError ? <Text style={styles.error}>{props.podError}</Text> : null}
    <Pressable disabled={props.podBusy} onPress={props.onSubmit} style={styles.primaryButton}>{props.podBusy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Submit POD & Complete Delivery</Text>}</Pressable>
    <Pressable disabled={props.podBusy} onPress={props.onClose} style={styles.cancelButton}><Text style={styles.cancelText}>Cancel</Text></Pressable>
  </ScrollView></View></View></Modal>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: palette.paper },
  header: { height: 58, backgroundColor: palette.navy, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logo: { width: 126, height: 34 },
  headerButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 14, gap: 12 },
  metaRow: { minHeight: 44, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  badgeColumn: { alignItems: 'flex-start', gap: 6 },
  paymentPill: { minHeight: 25, paddingHorizontal: 13, borderRadius: 6, backgroundColor: '#22B64B', alignItems: 'center', justifyContent: 'center' },
  paymentText: { fontFamily: 'Inter_700Bold', fontSize: 12, color: '#FFFFFF' },
  statusPill: { minHeight: 25, paddingHorizontal: 13, borderRadius: 6, backgroundColor: palette.green, alignItems: 'center', justifyContent: 'center' },
  statusText: { fontFamily: 'Inter_700Bold', fontSize: 12, color: '#FFFFFF' },
  reference: { paddingTop: 4, fontFamily: 'Inter_500Medium', fontSize: 12, color: palette.muted },
  routeCard: { borderRadius: 9, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card, paddingHorizontal: 16, paddingVertical: 17 },
  routePoint: { minHeight: 74, flexDirection: 'row', alignItems: 'flex-start', gap: 13 },
  routeMarker: { width: 30, height: 30, backgroundColor: palette.blue, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  routeMarkerSquare: { borderRadius: 3 },
  routeMarkerRound: { borderRadius: 15 },
  markerText: { fontFamily: 'Inter_700Bold', fontSize: 13, color: '#FFFFFF' },
  routeConnector: { position: 'absolute', left: 30, top: 45, width: 1, height: 66, backgroundColor: '#B9C1CB' },
  routeCopy: { flex: 1, paddingTop: 1 },
  routePlace: { fontFamily: 'Inter_700Bold', fontSize: 16, lineHeight: 21, color: palette.ink, textTransform: 'uppercase' },
  routeTime: { marginTop: 4, fontFamily: 'Inter_500Medium', fontSize: 12, color: palette.muted },
  sectionCard: { borderRadius: 9, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card, paddingHorizontal: 16, paddingVertical: 15 },
  sectionTitle: { marginBottom: 11, fontFamily: 'Inter_700Bold', fontSize: 17, color: palette.ink },
  infoRow: { minHeight: 28, flexDirection: 'row', alignItems: 'baseline' },
  infoLabel: { width: 112, fontFamily: 'Inter_500Medium', fontSize: 12, color: palette.muted },
  infoValue: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 12, color: palette.ink },
  stopRow: { minHeight: 83, flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 7 },
  stopMarker: { width: 28, height: 28, backgroundColor: palette.blue, alignItems: 'center', justifyContent: 'center' },
  stopCopy: { flex: 1 },
  stopTitle: { fontFamily: 'Inter_700Bold', fontSize: 13, color: palette.ink },
  stopAddress: { marginTop: 3, fontFamily: 'Inter_600SemiBold', fontSize: 12, lineHeight: 17, color: palette.ink },
  stopTime: { marginTop: 3, fontFamily: 'Inter_500Medium', fontSize: 11, color: palette.muted },
  noteText: { marginBottom: 9, fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 18, color: palette.ink },
  documentRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 9, borderTopWidth: 1, borderTopColor: '#EDF0F3' },
  documentText: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 12, color: palette.ink },
  evidenceRow: { marginTop: 8, flexDirection: 'row', gap: 8 },
  evidenceButton: { flex: 1, minHeight: 46, borderRadius: 7, borderWidth: 1, borderColor: '#C9D1DB', backgroundColor: '#F9FAFB', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  evidenceText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: palette.navy },
  helper: { marginTop: 6, fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 16, color: palette.muted },
  primaryButton: { minHeight: 52, borderRadius: 8, backgroundColor: palette.navy, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, marginTop: 4 },
  primaryButtonText: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#FFFFFF' },
  secondaryButton: { minHeight: 50, borderRadius: 8, borderWidth: 1, borderColor: palette.navy, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: palette.navy },
  backdrop: { flex: 1, backgroundColor: 'rgba(8,24,48,.58)', justifyContent: 'center', padding: 18 },
  modal: { maxHeight: '88%', borderRadius: 12, backgroundColor: '#FFFFFF', padding: 18 },
  modalHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modalTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, color: palette.ink },
  modalSubtitle: { marginTop: 3, fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 17, color: palette.muted },
  modalDivider: { height: 1, backgroundColor: '#E5E9EE', marginVertical: 15 },
  modalField: { marginBottom: 12 },
  modalLabel: { fontFamily: 'Inter_500Medium', fontSize: 11, color: palette.muted },
  modalValue: { marginTop: 3, fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 18, color: palette.ink },
  fieldLabel: { marginTop: 4, fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: .7, color: palette.muted },
  input: { minHeight: 46, borderWidth: 1, borderColor: '#CBD2DB', borderRadius: 7, paddingHorizontal: 11, marginTop: 6, marginBottom: 13, fontFamily: 'Inter_500Medium', fontSize: 13, color: palette.ink },
  notesInput: { minHeight: 86, paddingTop: 10, textAlignVertical: 'top' },
  signatureButton: { minHeight: 62, borderWidth: 1, borderColor: '#CBD2DB', borderRadius: 7, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 9, marginVertical: 13 },
  signatureReady: { backgroundColor: '#EFF9F1', borderColor: '#8BCF9A' },
  signatureTitle: { fontFamily: 'Inter_700Bold', fontSize: 13, color: palette.ink },
  error: { marginBottom: 9, fontFamily: 'Inter_600SemiBold', fontSize: 12, lineHeight: 17, color: '#B42318' },
  cancelButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  cancelText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: palette.muted },
});