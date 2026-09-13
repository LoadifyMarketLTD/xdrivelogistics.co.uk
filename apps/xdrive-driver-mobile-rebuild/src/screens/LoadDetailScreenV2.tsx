import { useMemo, useState } from 'react';
import { Linking, StyleSheet } from 'react-native';
import { Pressable, ScrollView, Text, TextInput, View } from '../theme/primitives';
import { UiIcon as Ionicons } from '../components/UiIcon';
import type { DriverJob, DriverQuoteReadiness } from '../types/driver';
import type { DriverQuoteInput } from '../api/quote';
import { RouteBlock } from '../components/RouteBlock';
import { isQuoteWindowOpen, quoteReadinessMessage } from '../api/driver';
import { formatDeliveryDate, formatRouteTime } from '../utils/format';
import { shadow } from '../theme/tokens';

function num(value: string) {
  const parsed = Number(value.replace(/,/g, '.').replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function first(row: Record<string, unknown> | undefined, keys: string[]) {
  if (!row) return undefined;
  for (const key of keys) if (row[key] !== null && row[key] !== undefined && String(row[key]).trim()) return row[key];
  return undefined;
}

function quoteStatus(row?: Record<string, unknown>) {
  const raw = String(first(row, ['status', 'quote_status']) ?? 'Submitted').toLowerCase();
  if (['accepted', 'won', 'awarded'].includes(raw)) return 'Accepted';
  if (['declined', 'rejected', 'unsuccessful', 'lost'].includes(raw)) return 'Unsuccessful';
  if (['withdrawn', 'cancelled'].includes(raw)) return 'Withdrawn';
  return 'Submitted';
}

function postedLine(job: DriverJob) {
  const bits: string[] = [];
  if (job.postedAt) bits.push(formatDeliveryDate(job.postedAt));
  if (job.vehicleRequirement) bits.push(job.vehicleRequirement);
  return bits.join(' | ');
}

function customerName(job: DriverJob) {
  return `${job.postingCompanyName || 'XDrive Customer'}${job.postingCompanyMemberCode ? ` (${job.postingCompanyMemberCode})` : ''}`;
}

export function LoadDetailScreen({ job, busy, existingQuote, quoteReadiness, onBack, onOpenDocuments, onQuote }: {
  job: DriverJob;
  busy: boolean;
  existingQuote?: Record<string, unknown>;
  quoteReadiness?: DriverQuoteReadiness;
  onBack: () => void;
  onOpenDocuments: () => void;
  onQuote: (input: DriverQuoteInput) => void;
}) {
  const [quoteForm, setQuoteForm] = useState(false);
  const [baseText, setBaseText] = useState('');
  const [extrasText, setExtrasText] = useState('0.00');
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [collectOpen, setCollectOpen] = useState(false);
  const [collectWithin, setCollectWithin] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  const base = num(baseText);
  const extras = num(extrasText || '0');
  const total = Number.isFinite(base) && Number.isFinite(extras) ? base + extras : Number.NaN;
  const valid = Number.isFinite(base) && base > 0 && Number.isFinite(extras) && extras >= 0;
  const blockedByReadiness = quoteReadiness?.eligible === false;
  const blocked = !existingQuote && (!isQuoteWindowOpen(job) || job.canQuote === false || blockedByReadiness);
  const blockText = !isQuoteWindowOpen(job)
    ? 'This load is no longer open for quotation.'
    : job.canQuote === false
      ? (job.quoteWarning || 'This load is not currently eligible for quotation.')
      : quoteReadinessMessage(quoteReadiness);

  const distance = useMemo(() => {
    if (job.journeyDistanceMiles == null) return job.distance || '';
    if (job.estimatedJourneyMinutes == null) return `${job.journeyDistanceMiles.toFixed(1)} miles`;
    const mins = Math.round(job.estimatedJourneyMinutes);
    return `${job.journeyDistanceMiles.toFixed(1)} miles (${Math.floor(mins / 60)}h ${mins % 60}m)`;
  }, [job.distance, job.estimatedJourneyMinutes, job.journeyDistanceMiles]);

  const existingAmount = first(existingQuote, ['amount', 'bid_price_gbp', 'price']);
  const existingBase = first(existingQuote, ['baseAmount', 'base_amount']);
  const existingExtras = first(existingQuote, ['additionalExtrasGbp', 'additional_extras_gbp']);
  const existingCollect = first(existingQuote, ['collectWithinMinutes', 'collect_within_minutes']);
  const existingMessage = first(existingQuote, ['message']);
  const collectLabel = collectWithin == null ? 'Not supplied' : collectWithin === 30 ? '30 min' : collectWithin === 60 ? '60 min' : '2 hrs';

  function goBack() {
    if (quoteForm) setQuoteForm(false);
    else onBack();
  }

  return <View style={styles.page}>
    <View style={styles.topbar}>
      <Pressable accessibilityRole="button" accessibilityLabel={quoteForm ? 'Back to load details' : 'Back to alerts'} onPress={goBack} style={styles.back}><Ionicons name="chevron-back" size={25} color="#FFFFFF" /></Pressable>
      <Text style={styles.topTitle}>Load ID {job.reference}</Text><View style={styles.back} />
    </View>

    {quoteForm ? <QuoteForm
      job={job}
      busy={busy}
      baseText={baseText}
      setBaseText={setBaseText}
      extrasText={extrasText}
      setExtrasText={setExtrasText}
      extrasOpen={extrasOpen}
      setExtrasOpen={setExtrasOpen}
      total={total}
      collectWithin={collectWithin}
      collectLabel={collectLabel}
      collectOpen={collectOpen}
      setCollectOpen={setCollectOpen}
      setCollectWithin={setCollectWithin}
      message={message}
      setMessage={setMessage}
      valid={valid}
      onQuote={() => onQuote({ baseAmount: base, additionalExtrasGbp: extras, collectWithinMinutes: collectWithin, message })}
    /> : <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.headerCard}>
        <Text style={styles.company}>{job.postingCompanyName || 'XDrive Load'}{job.postingCompanyMemberCode ? ` (${job.postingCompanyMemberCode})` : ''}</Text>
        {postedLine(job) ? <Text style={styles.posted}>{postedLine(job)}</Text> : null}
        <View style={styles.tags}>
          {job.serviceMode ? <Pill text={job.serviceMode.replace(/[_-]+/g, ' ').toUpperCase()} /> : null}
          {job.directDeliveryRequired ? <Pill text="DIRECT" green /> : null}
          {(job.badges ?? []).filter((badge) => /smartpay|hotshot/i.test(badge)).slice(0, 2).map((badge) => <Pill key={badge} text={badge.toUpperCase()} green={/smartpay/i.test(badge)} />)}
        </View>
        <View style={styles.route}><RouteBlock pickup={job.pickupLocation} delivery={job.deliveryLocation} pickupTiming={formatRouteTime(job.pickupTiming ?? job.pickupTime)} deliveryTiming={formatRouteTime(job.deliveryTiming ?? job.deliveryTime)} /></View>
      </View>

      <View style={styles.card}>
        <InfoIcon icon="car" label="VEHICLE" value={job.vehicleRequirement || 'Not supplied'} />
        <InfoIcon icon="location" label="DISTANCE" value={distance || 'Not supplied'} />
        <InfoIcon icon="create" label="NOTES" value={[job.dimensions ? `Dimensions: ${job.dimensions}` : '', job.weight ? `Weight: ${job.weight}` : '', job.notesSummary || job.pickupNote || job.deliveryNote || ''].filter(Boolean).join('\n') || 'No additional instructions published.'} multiline />
      </View>

      <FeedbackCard />
      <CustomerCard job={job} />

      {existingQuote ? <View style={styles.card}>
        <Text style={styles.heading}>MY QUOTE</Text>
        <View style={styles.summary}><View><Text style={styles.label}>TOTAL</Text><Text style={styles.amount}>{existingAmount == null ? '—' : `£${Number(existingAmount).toFixed(2)}`}</Text></View><Pill text={quoteStatus(existingQuote)} green={quoteStatus(existingQuote) === 'Accepted'} /></View>
        {existingBase != null ? <Info label="Base amount" value={`£${Number(existingBase).toFixed(2)}`} /> : null}
        {existingExtras != null ? <Info label="Additional extras" value={`£${Number(existingExtras).toFixed(2)}`} /> : null}
        {existingCollect != null ? <Info label="Collect within" value={`${existingCollect} minutes`} /> : null}
        {existingMessage ? <View style={styles.notes}><Text style={styles.label}>NOTES</Text><Text style={styles.notesText}>{String(existingMessage)}</Text></View> : null}
      </View> : blocked ? <View style={styles.blocked}>
        <Text style={styles.blockedTitle}>Quote unavailable</Text><Text style={styles.blockedText}>{blockText}</Text>
        {blockedByReadiness ? <Pressable onPress={onOpenDocuments} style={styles.darkButton}><Text style={styles.darkButtonText}>Open Documents</Text></Pressable> : null}
      </View> : <Pressable accessibilityRole="button" accessibilityLabel="Quote this load" onPress={() => setQuoteForm(true)} style={styles.quoteButton}><Text style={styles.quoteButtonText}>Quote</Text></Pressable>}
    </ScrollView>}
  </View>;
}

function FeedbackCard() {
  return <View style={styles.card}>
    <View style={styles.feedbackTitleRow}><View><Text style={styles.heading}>Feedback</Text><Text style={styles.feedbackPeriod}>Past 90 days</Text></View><View style={styles.feedbackIcons}><Ionicons name="thumbs-up" size={18} color="#292837" /><Ionicons name="remove-circle" size={18} color="#292837" /><Ionicons name="thumbs-down" size={18} color="#292837" /></View></View>
    <View style={styles.feedbackDivider} />
    <FeedbackRow label="Payment" />
    <FeedbackRow label="Delivery" />
    <View style={styles.blueButtonMuted}><Text style={styles.blueButtonText}>All Feedback</Text></View>
  </View>;
}

function FeedbackRow({ label }: { label: string }) {
  return <View style={styles.feedbackRow}><Text style={styles.feedbackLabel}>{label}</Text><Text style={styles.feedbackNumbers}>—     —     —</Text></View>;
}

function CustomerCard({ job }: { job: DriverJob }) {
  const canContact = job.contactAllowed && Boolean(job.contactPhone);
  function message() {
    if (canContact && job.contactPhone) void Linking.openURL(`sms:${job.contactPhone}`);
  }
  return <View style={styles.card}>
    <CustomerRow icon="shield-checkmark" label="CUSTOMER" value={customerName(job)} />
    <CustomerRow icon="document-text" label="TERMS" value="Not published" />
    <CustomerRow icon="call" label="PHONE" value={canContact ? job.contactPhone! : 'Available after allocation'} />
    {canContact ? <Pressable onPress={message} style={styles.blueButton}><Text style={styles.blueButtonText}>Message</Text></Pressable> : null}
  </View>;
}

function CustomerRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return <View style={styles.customerRow}><Ionicons name={icon} size={22} color="#292837" /><View style={{ flex: 1 }}><Text style={styles.customerLabel}>{label}</Text><Text style={styles.customerValue}>{value}</Text></View></View>;
}

function QuoteForm(props: {
  job: DriverJob;
  busy: boolean;
  baseText: string;
  setBaseText: (value: string) => void;
  extrasText: string;
  setExtrasText: (value: string) => void;
  extrasOpen: boolean;
  setExtrasOpen: (value: boolean) => void;
  total: number;
  collectWithin: number | null;
  collectLabel: string;
  collectOpen: boolean;
  setCollectOpen: (value: boolean) => void;
  setCollectWithin: (value: number | null) => void;
  message: string;
  setMessage: (value: string) => void;
  valid: boolean;
  onQuote: () => void;
}) {
  return <ScrollView style={styles.scroll} contentContainerStyle={styles.formContent} showsVerticalScrollIndicator={false}>
    <View style={styles.formCard}>
      <Text style={styles.formHeading}>MY QUOTE (EXC. VAT)</Text>
      <View style={styles.moneyRow}>
        <View style={styles.currency}><Text style={styles.currencyText}>GBP</Text><Ionicons name="chevron-forward" size={17} color="#777684" /></View>
        <View style={styles.moneyInput}><Text style={styles.pound}>£</Text><TextInput accessibilityLabel="Quote amount excluding VAT" keyboardType="decimal-pad" value={props.baseText} onChangeText={props.setBaseText} placeholder="0.00" style={styles.moneyText} /></View>
      </View>

      <Pressable onPress={() => props.setExtrasOpen(!props.extrasOpen)} style={styles.extrasToggle}><View style={styles.plusCircle}><Text style={styles.plusText}>+</Text></View><Text style={styles.extrasToggleText}>Additional extras</Text><Ionicons name={props.extrasOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#8A8996" /></Pressable>
      {props.extrasOpen ? <View style={styles.extrasInputRow}><Text style={styles.label}>ADDITIONAL EXTRAS</Text><View style={styles.extrasInput}><Text style={styles.pound}>£</Text><TextInput accessibilityLabel="Additional extras" keyboardType="decimal-pad" value={props.extrasText} onChangeText={props.setExtrasText} style={styles.extrasText} /></View></View> : null}

      <View style={styles.total}><Text style={styles.totalLabel}>Total:</Text><Text style={styles.totalValue}>{Number.isFinite(props.total) ? `£${props.total.toFixed(2)}` : '£0.00'}</Text></View>

      <Text style={styles.formSectionLabel}>WILL COLLECT WITHIN</Text>
      <Pressable onPress={() => props.setCollectOpen(!props.collectOpen)} style={styles.selector}><Text style={styles.selectorText}>{props.collectLabel}</Text><Ionicons name="chevron-forward" size={18} color="#777684" /></Pressable>
      {props.collectOpen ? <View style={styles.collectOptions}>{[[null, 'Not supplied'], [30, '30 min'], [60, '60 min'], [120, '2 hrs']].map(([value, label]) => <Pressable key={String(label)} onPress={() => { props.setCollectWithin(value as number | null); props.setCollectOpen(false); }} style={[styles.collectOption, props.collectWithin === value && styles.collectOptionActive]}><Text style={styles.collectOptionText}>{label}</Text></Pressable>)}</View> : null}

      <Text style={styles.formSectionLabel}>VEHICLE</Text>
      <View style={styles.selector}><Text style={[styles.selectorText, styles.vehicleName]}>{props.job.vehicleRequirement || 'Assigned XDrive vehicle'}</Text><Ionicons name="chevron-forward" size={18} color="#777684" /></View>

      <View style={styles.notesLabelRow}><Text style={styles.formSectionLabel}>NOTES</Text><Text style={styles.counter}>{props.message.length}/500</Text></View>
      <TextInput accessibilityLabel="Quote notes" value={props.message} onChangeText={props.setMessage} multiline maxLength={500} placeholder="Your notes" style={styles.noteInput} />
      <Pressable disabled={props.busy || !props.valid} onPress={props.onQuote} style={[styles.submit, (props.busy || !props.valid) && styles.submitDisabled]}><Text style={styles.submitText}>{props.busy ? 'Submitting…' : 'Submit Quote'}</Text></Pressable>
    </View>
  </ScrollView>;
}

function Pill({ text, green = false }: { text: string; green?: boolean }) {
  return <View style={[styles.pill, green && styles.pillGreen]}><Text style={styles.pillText}>{text}</Text></View>;
}
function Info({ label, value }: { label: string; value: string }) {
  return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value || 'Not supplied'}</Text></View>;
}
function InfoIcon({ icon, label, value, multiline = false }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; multiline?: boolean }) {
  return <View style={styles.infoIconRow}><Ionicons name={icon} size={22} color="#292837" /><View style={{ flex: 1 }}><Text style={styles.infoIconLabel}>{label}</Text><Text style={[styles.infoIconValue, multiline && styles.infoIconMultiline]}>{value}</Text></View></View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#292837' },
  topbar: { minHeight: 70, paddingTop: 12, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center' },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, textAlign: 'center', fontFamily: 'Inter_600SemiBold', fontSize: 18, color: '#FFFFFF' },
  scroll: { flex: 1, backgroundColor: '#F2F3F7' },
  content: { padding: 12, paddingBottom: 24, gap: 10 },
  headerCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, gap: 8, ...shadow },
  company: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#41414F' },
  posted: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#777684' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { alignSelf: 'flex-start', borderRadius: 5, backgroundColor: '#E8F2FB', paddingHorizontal: 7, paddingVertical: 4 },
  pillGreen: { backgroundColor: '#4CAD3F' },
  pillText: { fontFamily: 'Inter_700Bold', fontSize: 9, color: '#2473B7' },
  route: { marginTop: 2, borderWidth: 1, borderColor: '#E1E2E7', borderRadius: 12, overflow: 'hidden' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 13, gap: 11, ...shadow },
  heading: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#292837' },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: .7, color: '#777684' },
  infoIconRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  infoIconLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: .7, color: '#777684' },
  infoIconValue: { marginTop: 2, fontFamily: 'Inter_700Bold', fontSize: 14, color: '#292837' },
  infoIconMultiline: { lineHeight: 19 },
  feedbackTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  feedbackPeriod: { marginTop: 2, fontFamily: 'Inter_500Medium', fontSize: 10, color: '#777684' },
  feedbackIcons: { width: 110, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6 },
  feedbackDivider: { height: 2, backgroundColor: '#4D97D5', marginTop: -4 },
  feedbackRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2 },
  feedbackLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#292837' },
  feedbackNumbers: { width: 120, textAlign: 'center', fontFamily: 'Inter_700Bold', fontSize: 12, color: '#777684' },
  blueButton: { minHeight: 42, borderRadius: 21, backgroundColor: '#2F93DE', alignItems: 'center', justifyContent: 'center' },
  blueButtonMuted: { minHeight: 38, borderRadius: 19, backgroundColor: '#2F93DE', alignItems: 'center', justifyContent: 'center', opacity: .82 },
  blueButtonText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#FFFFFF' },
  customerRow: { flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 54 },
  customerLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: .7, color: '#777684' },
  customerValue: { marginTop: 3, fontFamily: 'Inter_700Bold', fontSize: 13, lineHeight: 18, color: '#292837' },
  quoteButton: { minHeight: 50, borderRadius: 25, backgroundColor: '#FFD200', alignItems: 'center', justifyContent: 'center', marginHorizontal: 2 },
  quoteButtonText: { fontFamily: 'Inter_700Bold', fontSize: 17, color: '#111111' },
  summary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F4F4F6', borderRadius: 12, padding: 12 },
  amount: { marginTop: 3, fontFamily: 'Inter_700Bold', fontSize: 22, color: '#292837' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 14 },
  infoLabel: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#6F6E7D' },
  infoValue: { flex: 1, textAlign: 'right', fontFamily: 'Inter_700Bold', fontSize: 13, color: '#292837' },
  notes: { backgroundColor: '#F1F1F4', borderRadius: 10, padding: 11, gap: 5 },
  notesText: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 19, color: '#292837' },
  blocked: { borderWidth: 1, borderColor: '#E0E1E5', borderRadius: 14, backgroundColor: '#FFFFFF', padding: 14, ...shadow },
  blockedTitle: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#292837' },
  blockedText: { marginTop: 4, fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 19, color: '#777684' },
  darkButton: { alignSelf: 'flex-start', marginTop: 12, minHeight: 42, borderRadius: 21, backgroundColor: '#292837', paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  darkButtonText: { fontFamily: 'Inter_700Bold', fontSize: 13, color: '#FFFFFF' },
  formContent: { padding: 12, paddingBottom: 24 },
  formCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 13, gap: 10, ...shadow },
  formHeading: { fontFamily: 'Inter_600SemiBold', fontSize: 12, letterSpacing: .5, color: '#777684' },
  moneyRow: { flexDirection: 'row', gap: 10 },
  currency: { width: 126, height: 50, borderWidth: 1, borderColor: '#D1D4DA', borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 13 },
  currencyText: { fontFamily: 'Inter_700Bold', fontSize: 13, color: '#292837' },
  moneyInput: { flex: 1, height: 50, borderWidth: 1, borderColor: '#747887', borderRadius: 8, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11 },
  pound: { fontFamily: 'Inter_700Bold', fontSize: 17, color: '#292837' },
  moneyText: { flex: 1, marginLeft: 3, fontFamily: 'Inter_600SemiBold', fontSize: 18, color: '#292837' },
  extrasToggle: { minHeight: 52, borderWidth: 1, borderStyle: 'dashed', borderColor: '#C7CBD2', borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12 },
  plusCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#39AF48', alignItems: 'center', justifyContent: 'center' },
  plusText: { fontFamily: 'Inter_700Bold', fontSize: 21, color: '#FFFFFF', lineHeight: 24 },
  extrasToggleText: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#777684' },
  extrasInputRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  extrasInput: { width: 120, height: 42, borderWidth: 1, borderColor: '#D0D1D6', borderRadius: 8, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9 },
  extrasText: { flex: 1, marginLeft: 3, fontFamily: 'Inter_700Bold', fontSize: 14, textAlign: 'right', color: '#292837' },
  total: { minHeight: 50, borderRadius: 8, backgroundColor: '#F3F3F5', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalLabel: { fontFamily: 'Inter_700Bold', fontSize: 13, color: '#292837' },
  totalValue: { fontFamily: 'Inter_700Bold', fontSize: 20, color: '#292837' },
  formSectionLabel: { marginTop: 3, fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: .7, color: '#777684' },
  selector: { minHeight: 48, borderRadius: 8, backgroundColor: '#F7F7F9', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  selectorText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#777684' },
  vehicleName: { color: '#292837', fontFamily: 'Inter_700Bold' },
  collectOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  collectOption: { minHeight: 36, borderRadius: 18, backgroundColor: '#F1F1F4', paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center' },
  collectOptionActive: { backgroundColor: '#FFE66A' },
  collectOptionText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#4E4D5A' },
  notesLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  counter: { fontFamily: 'Inter_500Medium', fontSize: 10, color: '#777684' },
  noteInput: { minHeight: 54, borderRadius: 8, backgroundColor: '#F7F7F9', padding: 11, textAlignVertical: 'top', fontFamily: 'Inter_500Medium', fontSize: 13, color: '#292837' },
  submit: { minHeight: 50, borderRadius: 25, backgroundColor: '#FFD200', alignItems: 'center', justifyContent: 'center' },
  submitDisabled: { backgroundColor: '#D8D9DE' },
  submitText: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#111111' },
});