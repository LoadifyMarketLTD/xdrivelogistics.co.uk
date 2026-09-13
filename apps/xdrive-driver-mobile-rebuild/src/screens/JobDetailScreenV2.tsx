import { useMemo, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Linking, Modal, StyleSheet } from 'react-native';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from '../theme/primitives';
import { UiIcon as Ionicons } from '../components/UiIcon';
import type { DriverJob, DriverJobStop } from '../types/driver';
import { getNextStep, statusLabel } from '../types/statusFlow';
import { ActionButton } from '../components/ActionButton';
import { DeliveryTimeline } from '../components/DeliveryTimeline';
import { uploadJobEvidence, type JobEvidenceCategory } from '../api/driver';
import { submitPod } from '../api/pod';
import { formatDeliveryDate } from '../utils/format';
import { shadow } from '../theme/tokens';

type DetailTab = 'summary' | 'stops' | 'status';
type EvidenceItem = { name: string; path: string; category: JobEvidenceCategory };
type PodView = {
  receiverName?: string; receiverCompany?: string; date?: string; time?: string;
  quantityDelivered?: string; itemsMissing?: string; itemsDamaged?: string;
  receiverNotes?: string; driverNotes?: string; comments?: string;
  deliveryPhotoUris?: string[]; damagePhotoUris?: string[]; documentUris?: string[];
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
  return stop.timeWindowTo && stop.timeWindowTo !== stop.timeWindowFrom ? `${from} - ${formatDeliveryDate(stop.timeWindowTo)}` : from;
}
function distanceLine(job: DriverJob) {
  if (job.distance) return job.eta ? `${job.distance} (${job.eta})` : job.distance;
  if (job.journeyDistanceMiles == null) return '';
  if (job.estimatedJourneyMinutes == null) return `${job.journeyDistanceMiles.toFixed(1)} miles`;
  const mins = Math.round(job.estimatedJourneyMinutes);
  return `${job.journeyDistanceMiles.toFixed(1)} miles (${Math.floor(mins / 60)}h ${mins % 60}m)`;
}
function podView(value: DriverJob['pod']): PodView | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const pod = value as Record<string, unknown>;
  const str = (key: string) => typeof pod[key] === 'string' && String(pod[key]).trim() ? String(pod[key]).trim() : undefined;
  const urls = (key: string) => Array.isArray(pod[key]) ? (pod[key] as unknown[]).filter((item): item is string => typeof item === 'string' && item.startsWith('http')) : undefined;
  return { receiverName: str('receiverName'), receiverCompany: str('receiverCompany'), date: str('date'), time: str('time'), quantityDelivered: str('quantityDelivered'), itemsMissing: str('itemsMissing'), itemsDamaged: str('itemsDamaged'), receiverNotes: str('receiverNotes'), driverNotes: str('driverNotes'), comments: str('comments'), deliveryPhotoUris: urls('deliveryPhotoUris'), damagePhotoUris: urls('damagePhotoUris'), documentUris: urls('documentUris') };
}

export function JobDetailScreen({ job, busy, onBack, onAdvance }: { job: DriverJob; busy: boolean; onBack: () => void; onAdvance: (endpoint: string) => void }) {
  const [tab, setTab] = useState<DetailTab>('summary');
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
  const next = getNextStep(job.status);
  const stops = useMemo(() => job.stops?.length ? job.stops : fallbackStops(job), [job]);
  const notes = [job.customerNotes, job.notesSummary, job.specialInstructions, job.pickupNote, job.deliveryNote].filter((value, index, all): value is string => Boolean(value) && all.indexOf(value) === index);
  const pod = podView(job.pod);
  const canStageEvidence = job.status !== 'delivered' && job.status !== 'cancelled';

  async function pickEvidence(category: JobEvidenceCategory) {
    if (evidenceBusy || podBusy) return;
    setEvidenceMessage(''); setPodError('');
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: category === 'photos' ? ['image/jpeg', 'image/png'] : ['application/pdf', 'image/jpeg', 'image/png'], copyToCacheDirectory: true, multiple: false });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (asset.name.toLowerCase().endsWith('.webp')) throw new Error('Use a JPG or PNG image for POD evidence.');
      if (asset.size && asset.size > 10 * 1024 * 1024) throw new Error('Evidence files must be 10 MB or smaller.');
      setEvidenceBusy(category);
      const uploaded = await uploadJobEvidence({ jobId: job.id, uri: asset.uri, fileName: asset.name, mimeType: asset.mimeType, category });
      setEvidence((current) => [...current, { name: asset.name, path: uploaded.storagePath, category }]);
      setEvidenceMessage(`${asset.name} is securely staged for this booking's POD.`);
    } catch (cause) { setEvidenceMessage(cause instanceof Error ? cause.message : 'Evidence could not be uploaded.'); }
    finally { setEvidenceBusy(null); }
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
      setSignatureData(`data:${mime};base64,${base64}`); setSignatureLabel(asset.name);
    } catch (cause) { setPodError(cause instanceof Error ? cause.message : 'Signature image could not be selected.'); }
  }

  async function submitPodAndDeliver() {
    setPodError('');
    const photos = evidence.filter((item) => item.category === 'photos').map((item) => item.path);
    const documents = evidence.filter((item) => item.category === 'documents').map((item) => item.path);
    if (!recipientName.trim()) { setPodError('Recipient name is required.'); return; }
    if (job.podRequired && photos.length === 0) { setPodError('At least one delivery image is required.'); return; }
    if (job.podRequired && !signatureData) { setPodError('A recipient signature image is required.'); return; }
    if (!job.podRequired && photos.length === 0 && documents.length === 0 && !signatureData) { setPodError('Add a signature, image or document before submitting POD.'); return; }
    setPodBusy(true);
    try {
      await submitPod(job.id, { recipientName, signatureData, photoUris: photos, documentUris: documents, notes: podNotes });
      setCapturePod(false); onAdvance('delivered');
    } catch (cause) { setPodError(cause instanceof Error ? cause.message : 'POD could not be submitted.'); }
    finally { setPodBusy(false); }
  }

  const nextAction = next?.endpoint === 'delivered'
    ? <Pressable disabled={busy || podBusy} onPress={() => setCapturePod(true)} style={styles.captureButton}><Text style={styles.captureText}>Capture POD</Text></Pressable>
    : next ? <ActionButton disabled={busy} label={busy ? 'Updating…' : next.label} onPress={() => onAdvance(next.endpoint)} /> : null;

  return <View style={styles.page}>
    <View style={styles.topbar}>
      <Pressable onPress={onBack} style={styles.back}><Ionicons name="chevron-back" size={25} color="#FFFFFF" /></Pressable>
      <View style={styles.brandTitle}><Text style={styles.brandX}>X</Text><Text style={styles.brandDrive}>Drive</Text></View>
      <View style={styles.back} />
    </View>
    <View style={styles.tabs}>{(['summary', 'stops', 'status'] as DetailTab[]).map((item) => <Pressable key={item} onPress={() => setTab(item)} style={[styles.tab, tab === item && styles.tabActive]}><Text style={[styles.tabText, tab === item && styles.tabTextActive]}>{item.charAt(0).toUpperCase() + item.slice(1)}</Text></Pressable>)}</View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.cardHeader}><Text style={styles.company}>{job.postingCompanyName || job.client || 'XDrive Booking'}{job.postingCompanyMemberCode ? ` (${job.postingCompanyMemberCode})` : ''}</Text><Text style={styles.reference}>{job.customerReference ? `Cust. Ref. ${job.customerReference}` : `Load ID ${job.reference}`}</Text></View>

      {tab === 'summary' ? <View style={styles.card}>
        <RouteSummary job={job} stopCount={stops.length} />
        {distanceLine(job) ? <View style={styles.distanceRow}><Ionicons name="navigate-outline" size={20} color="#292837" /><Text style={styles.distance}>{distanceLine(job)}</Text></View> : null}
        <View style={styles.details}><Text style={styles.label}>LOAD DETAILS</Text><Detail label="Vehicle" value={job.vehicleRequirement} />{job.weight ? <Detail label="Weight" value={job.weight} /> : null}{job.dimensions ? <Detail label="Dimensions" value={job.dimensions} /> : null}{job.palletCount ? <Detail label="Pallets" value={String(job.palletCount)} /> : null}</View>
        {notes.map((note, index) => <View key={`${index}-${note.slice(0, 12)}`} style={styles.note}><Text style={styles.noteText}>{note}</Text></View>)}
        <View style={styles.attachments}><Text style={styles.label}>ATTACHMENTS</Text>
          {job.attachments?.length ? job.attachments.map((attachment, index) => { const url = attachment.signedUrl || attachment.url; return <Pressable key={attachment.id || `${index}`} disabled={!url} onPress={() => url && void Linking.openURL(url)} style={styles.attachment}><Ionicons name="document-text-outline" size={21} color="#292837" /><Text style={styles.attachmentText}>{attachment.fileName || attachment.type || `Attachment ${index + 1}`}</Text><Ionicons name="chevron-forward" size={18} color="#777684" /></Pressable>; }) : <Text style={styles.muted}>No customer attachments for this booking.</Text>}
          {canStageEvidence ? <View style={styles.evidenceActions}><EvidenceButton title="Add Document" hint="PDF, JPG or PNG" busy={evidenceBusy === 'documents'} onPress={() => void pickEvidence('documents')} /><EvidenceButton title="Add Image" hint="JPG or PNG" busy={evidenceBusy === 'photos'} onPress={() => void pickEvidence('photos')} /></View> : null}
          {evidence.map((item, index) => <View key={`${item.path}-${index}`} style={styles.staged}><View style={styles.greenDot} /><Text style={styles.stagedText}>{item.name} · staged for POD</Text></View>)}
          {evidenceMessage ? <Text style={styles.muted}>{evidenceMessage}</Text> : null}
        </View>
        {job.podCompleted && pod ? <Pressable onPress={() => setShowPod(true)} style={styles.viewPod}><Text style={styles.viewPodText}>View POD</Text></Pressable> : null}
      </View> : null}

      {tab === 'stops' ? <View style={styles.card}>{stops.map((stop, index) => <StopRow key={stop.id || `${stop.sequence}-${index}`} stop={stop} index={index} onOpen={() => setSelectedStop({ stop, index })} />)}{nextAction ? <View style={styles.actionWrap}>{nextAction}</View> : null}</View> : null}
      {tab === 'status' ? <View style={styles.card}>{job.status === 'cancelled' ? <View style={styles.note}><Text style={styles.noteText}>Booking cancelled. No further driver action is available.</Text></View> : <DeliveryTimeline status={job.status} auditTrail={job.auditTrail} />}<View style={styles.current}><Text style={styles.label}>CURRENT STATUS</Text><Text style={styles.currentValue}>{statusLabel(job.status)}</Text></View>{nextAction ? <View style={styles.actionWrap}>{nextAction}</View> : null}</View> : null}
    </ScrollView>

    <StopModal selected={selectedStop} onClose={() => setSelectedStop(null)} />
    <PodViewModal visible={showPod} pod={pod} onClose={() => setShowPod(false)} />
    <PodCaptureModal visible={capturePod} job={job} evidence={evidence} recipientName={recipientName} setRecipientName={setRecipientName} notes={podNotes} setNotes={setPodNotes} signatureLabel={signatureLabel} signatureReady={Boolean(signatureData)} podBusy={podBusy} podError={podError} evidenceBusy={evidenceBusy} onAddImage={() => void pickEvidence('photos')} onAddDocument={() => void pickEvidence('documents')} onPickSignature={() => void pickSignature()} onSubmit={() => void submitPodAndDeliver()} onClose={() => setCapturePod(false)} />
  </View>;
}

function RouteSummary({ job, stopCount }: { job: DriverJob; stopCount: number }) {
  return <View style={styles.route}><View style={styles.rail}><View style={styles.square}><Text style={styles.markerText}>1</Text></View><Text style={styles.dots}>•••</Text><View style={styles.pin}><Text style={styles.markerText}>{Math.max(2, stopCount)}</Text></View></View><View style={styles.routeCopy}><View><Text style={styles.place}>{job.pickupLocation}</Text><Text style={styles.routeTime}>{formatDeliveryDate(job.pickupTime)}</Text></View><View><Text style={styles.place}>{job.deliveryLocation}</Text><Text style={styles.routeTime}>{formatDeliveryDate(job.deliveryTime)}</Text></View></View></View>;
}
function Detail({ label, value }: { label: string; value: string }) { return <View style={styles.detailRow}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value || 'Not supplied'}</Text></View>; }
function EvidenceButton({ title, hint, busy, onPress }: { title: string; hint: string; busy: boolean; onPress: () => void }) { return <Pressable disabled={busy} onPress={onPress} style={styles.evidenceButton}>{busy ? <ActivityIndicator size="small" color="#292837" /> : <Ionicons name="document-text-outline" size={23} color="#292837" />}<Text style={styles.evidenceTitle}>{title}</Text><Text style={styles.evidenceHint}>{hint}</Text></Pressable>; }
function StopRow({ stop, index, onOpen }: { stop: DriverJobStop; index: number; onOpen: () => void }) { return <Pressable onPress={onOpen} style={styles.stopRow}><View style={styles.square}><Text style={styles.markerText}>{index + 1}</Text></View><View style={{ flex: 1 }}><Text style={styles.stopTitle}>{stopTitle(stop, index)}</Text><Text style={styles.stopTime}>{stopTime(stop)}</Text>{stop.company ? <Text style={styles.stopBody}>{stop.company}</Text> : null}<Text style={styles.stopBody}>{stop.address}</Text>{stop.notes ? <Text style={styles.stopNotes}>{stop.notes}</Text> : null}</View><Ionicons name="chevron-forward" size={20} color="#A6A6AF" /></Pressable>; }

function StopModal({ selected, onClose }: { selected: { stop: DriverJobStop; index: number } | null; onClose: () => void }) {
  const stop = selected?.stop; const index = selected?.index ?? 0;
  return <Modal visible={Boolean(stop)} transparent animationType="fade" onRequestClose={onClose}><View style={styles.backdrop}><View style={styles.modal}>{stop ? <><View style={styles.modalHead}><View style={styles.modalMarker}><Text style={styles.markerText}>{index + 1}</Text></View><View style={{ flex: 1 }}><Text style={styles.modalTitle}>{stop.address}</Text><Text style={styles.modalSubtitle}>{stopTitle(stop, index)}</Text></View></View><View style={styles.divider} /><Field label="Time" value={stopTime(stop)} /><Field label="Company" value={stop.company || 'Not supplied'} /><Field label="Address" value={stop.address} />{stop.contactPerson ? <Field label="Contact" value={stop.contactPerson} /> : null}{stop.telephone ? <Pressable onPress={() => void Linking.openURL(`tel:${stop.telephone}`)}><Field label="Telephone" value={stop.telephone} link /></Pressable> : null}{stop.notes ? <Field label="Notes" value={stop.notes} /> : null}<CloseButton onPress={onClose} /></> : null}</View></View></Modal>;
}
function Field({ label, value, link = false }: { label: string; value: string; link?: boolean }) { return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><Text style={[styles.fieldValue, link && styles.link]}>{value}</Text></View>; }
function CloseButton({ onPress }: { onPress: () => void }) { return <Pressable onPress={onPress} style={styles.close}><Text style={styles.closeText}>Close</Text></Pressable>; }

function PodViewModal({ visible, pod, onClose }: { visible: boolean; pod: PodView | null; onClose: () => void }) {
  const links = [...(pod?.deliveryPhotoUris ?? []), ...(pod?.damagePhotoUris ?? []), ...(pod?.documentUris ?? [])];
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={styles.backdrop}><View style={styles.modal}><ScrollView><Text style={styles.podTitle}>Proof of Delivery</Text><Text style={styles.muted}>{[pod?.date, pod?.time].filter(Boolean).join(' · ')}</Text><View style={styles.divider} /><Field label="Received by" value={pod?.receiverName || 'Recipient'} />{pod?.receiverCompany ? <Field label="Company" value={pod.receiverCompany} /> : null}{pod?.quantityDelivered ? <Field label="Quantity" value={pod.quantityDelivered} /> : null}{pod?.itemsMissing ? <Field label="Missing" value={pod.itemsMissing} /> : null}{pod?.itemsDamaged ? <Field label="Damaged" value={pod.itemsDamaged} /> : null}{pod?.comments ? <Field label="Comments" value={pod.comments} /> : null}{links.map((url, index) => <Pressable key={url} onPress={() => void Linking.openURL(url)} style={styles.attachment}><Ionicons name="document-text-outline" size={20} color="#292837" /><Text style={styles.attachmentText}>POD evidence {index + 1}</Text><Ionicons name="chevron-forward" size={18} color="#777684" /></Pressable>)}<CloseButton onPress={onClose} /></ScrollView></View></View></Modal>;
}

function PodCaptureModal(props: { visible: boolean; job: DriverJob; evidence: EvidenceItem[]; recipientName: string; setRecipientName: (v: string) => void; notes: string; setNotes: (v: string) => void; signatureLabel: string; signatureReady: boolean; podBusy: boolean; podError: string; evidenceBusy: JobEvidenceCategory | null; onAddImage: () => void; onAddDocument: () => void; onPickSignature: () => void; onSubmit: () => void; onClose: () => void }) {
  const photos = props.evidence.filter((item) => item.category === 'photos').length; const docs = props.evidence.filter((item) => item.category === 'documents').length;
  return <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onClose}><View style={styles.backdrop}><View style={[styles.modal, styles.captureModal]}><ScrollView showsVerticalScrollIndicator={false}>
    <Text style={styles.podTitle}>Capture POD</Text><Text style={styles.muted}>{props.job.podRequired ? 'Recipient name, delivery image and signature are required.' : 'Add at least one item of delivery evidence.'}</Text><View style={styles.divider} />
    <Text style={styles.fieldLabel}>RECIPIENT NAME</Text><TextInput value={props.recipientName} onChangeText={props.setRecipientName} placeholder="Name of person receiving goods" style={styles.input} />
    <View style={styles.evidenceActions}><EvidenceButton title={`Add Image (${photos})`} hint="JPG or PNG" busy={props.evidenceBusy === 'photos'} onPress={props.onAddImage} /><EvidenceButton title={`Add Document (${docs})`} hint="PDF, JPG or PNG" busy={props.evidenceBusy === 'documents'} onPress={props.onAddDocument} /></View>
    <Pressable onPress={props.onPickSignature} style={[styles.signatureButton, props.signatureReady && styles.signatureReady]}><Ionicons name="document-text-outline" size={22} color="#292837" /><View style={{ flex: 1 }}><Text style={styles.evidenceTitle}>{props.signatureReady ? 'Signature added' : 'Add Signature Image'}</Text><Text style={styles.evidenceHint}>{props.signatureLabel || 'PNG or JPG of recipient signature'}</Text></View></Pressable>
    <Text style={styles.fieldLabel}>DRIVER NOTES</Text><TextInput value={props.notes} onChangeText={props.setNotes} multiline maxLength={5000} placeholder="Optional POD notes" style={[styles.input, styles.notesInput]} />
    {props.podError ? <Text style={styles.error}>{props.podError}</Text> : null}
    <Pressable disabled={props.podBusy} onPress={props.onSubmit} style={styles.submitPod}>{props.podBusy ? <ActivityIndicator size="small" color="#111111" /> : <Text style={styles.submitPodText}>Submit POD & Complete Delivery</Text>}</Pressable>
    <CloseButton onPress={props.onClose} />
  </ScrollView></View></View></Modal>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#292837' },
  topbar: { minHeight: 66, paddingTop: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  brandTitle: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  brandX: { fontFamily: 'Inter_700Bold', fontSize: 20, color: '#FFD200' },
  brandDrive: { fontFamily: 'Inter_700Bold', fontSize: 20, color: '#FFFFFF' },
  tabs: { marginHorizontal: 16, marginBottom: 14, padding: 4, backgroundColor: '#3A3949', borderRadius: 30, flexDirection: 'row' },
  tab: { flex: 1, minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: '#FFE66A' },
  tabText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#FFFFFF' },
  tabTextActive: { fontFamily: 'Inter_700Bold', color: '#111111' },
  content: { paddingHorizontal: 14, paddingBottom: 32 },
  cardHeader: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 14, gap: 4, borderBottomWidth: 1, borderBottomColor: '#E7E8EC' },
  company: { fontFamily: 'Inter_700Bold', fontSize: 17, color: '#474655' },
  reference: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#777684' },
  card: { backgroundColor: '#FFFFFF', borderBottomLeftRadius: 16, borderBottomRightRadius: 16, padding: 14, gap: 14, minHeight: 420, ...shadow },
  route: { flexDirection: 'row', borderWidth: 1, borderColor: '#E1E2E7', borderRadius: 14, padding: 13, gap: 12 },
  rail: { width: 34, alignItems: 'center', justifyContent: 'space-between' },
  square: { width: 28, height: 28, borderRadius: 4, backgroundColor: '#5199D6', alignItems: 'center', justifyContent: 'center' },
  pin: { width: 28, height: 32, borderRadius: 16, borderBottomLeftRadius: 5, backgroundColor: '#5199D6', alignItems: 'center', justifyContent: 'center' },
  markerText: { fontFamily: 'Inter_700Bold', fontSize: 12, color: '#FFFFFF' },
  dots: { transform: [{ rotate: '90deg' }], color: '#CDD2D9' },
  routeCopy: { flex: 1, justifyContent: 'space-between', gap: 18 },
  place: { fontFamily: 'Inter_700Bold', fontSize: 17, color: '#474655' },
  routeTime: { marginTop: 4, fontFamily: 'Inter_500Medium', fontSize: 13, color: '#7D7C8A' },
  distanceRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  distance: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#777684' },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: .8, color: '#777684' },
  details: { gap: 8 },
  detailRow: { flexDirection: 'row', gap: 12 },
  detailLabel: { width: 88, fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#292837' },
  detailValue: { flex: 1, fontFamily: 'Inter_700Bold', fontSize: 13, color: '#292837' },
  note: { backgroundColor: '#F0F1F4', borderRadius: 12, padding: 12 },
  noteText: { fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 20, color: '#292837' },
  attachments: { gap: 8, borderTopWidth: 1, borderTopColor: '#E0E1E6', paddingTop: 10 },
  attachment: { minHeight: 44, borderWidth: 1, borderColor: '#4D99D7', borderRadius: 8, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 9 },
  attachmentText: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#292837' },
  muted: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 18, color: '#777684' },
  evidenceActions: { flexDirection: 'row', gap: 8 },
  evidenceButton: { flex: 1, minHeight: 58, borderRadius: 10, backgroundColor: '#F6F6F8', borderWidth: 1, borderColor: '#D9DAE0', alignItems: 'center', justifyContent: 'center', padding: 8 },
  evidenceTitle: { marginTop: 3, fontFamily: 'Inter_700Bold', fontSize: 12, color: '#292837' },
  evidenceHint: { marginTop: 1, fontFamily: 'Inter_500Medium', fontSize: 10, color: '#777684' },
  staged: { minHeight: 32, borderRadius: 8, backgroundColor: '#EFF8ED', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, gap: 8 },
  greenDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#65C653' },
  stagedText: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#3A6632' },
  viewPod: { minHeight: 50, borderRadius: 10, backgroundColor: '#FFD200', alignItems: 'center', justifyContent: 'center' },
  viewPodText: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#111111' },
  stopRow: { minHeight: 96, flexDirection: 'row', alignItems: 'flex-start', gap: 11, paddingVertical: 5 },
  stopTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#292837' },
  stopTime: { marginTop: 3, fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#777684' },
  stopBody: { marginTop: 5, fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#777684' },
  stopNotes: { marginTop: 5, fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 18, color: '#777684' },
  current: { borderTopWidth: 1, borderTopColor: '#E1E2E7', paddingTop: 10, gap: 4 },
  currentValue: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#292837' },
  actionWrap: { paddingTop: 4 },
  captureButton: { minHeight: 52, borderRadius: 26, backgroundColor: '#FFD200', alignItems: 'center', justifyContent: 'center' },
  captureText: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#111111' },
  backdrop: { flex: 1, backgroundColor: 'rgba(13,13,20,.72)', justifyContent: 'center', padding: 20 },
  modal: { maxHeight: '88%', backgroundColor: '#FFFFFF', borderRadius: 14, padding: 18, overflow: 'hidden', ...shadow },
  captureModal: { alignSelf: 'stretch' },
  modalHead: { marginHorizontal: -18, marginTop: -18, marginBottom: 0, paddingHorizontal: 18, paddingVertical: 16, flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: '#292837' },
  modalMarker: { width: 34, height: 34, borderRadius: 5, backgroundColor: '#5199D6', alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontFamily: 'Inter_700Bold', fontSize: 17, color: '#FFFFFF' },
  modalSubtitle: { marginTop: 2, fontFamily: 'Inter_500Medium', fontSize: 11, color: '#D6D7DD' },
  podTitle: { fontFamily: 'Inter_700Bold', fontSize: 21, color: '#292837' },
  divider: { height: 1, backgroundColor: '#E2E3E7', marginVertical: 14 },
  field: { marginBottom: 12 },
  fieldLabel: { fontFamily: 'Inter_500Medium', fontSize: 11, letterSpacing: .7, color: '#8A8996' },
  fieldValue: { marginTop: 3, fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20, color: '#292837' },
  link: { color: '#287FC3' },
  close: { marginTop: 10, minHeight: 48, borderRadius: 10, backgroundColor: '#FFD200', alignItems: 'center', justifyContent: 'center' },
  closeText: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#111111' },
  input: { minHeight: 48, borderWidth: 1, borderColor: '#D0D1D6', borderRadius: 10, paddingHorizontal: 12, marginTop: 6, marginBottom: 14, fontFamily: 'Inter_500Medium', fontSize: 14, color: '#292837' },
  notesInput: { minHeight: 90, paddingTop: 12, textAlignVertical: 'top' },
  signatureButton: { minHeight: 64, borderWidth: 1, borderColor: '#D9DADE', borderRadius: 10, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 14 },
  signatureReady: { backgroundColor: '#EFF8ED', borderColor: '#8DCA82' },
  error: { marginBottom: 10, fontFamily: 'Inter_600SemiBold', fontSize: 12, lineHeight: 18, color: '#B42318' },
  submitPod: { minHeight: 52, borderRadius: 10, backgroundColor: '#FFD200', alignItems: 'center', justifyContent: 'center' },
  submitPodText: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#111111' },
});