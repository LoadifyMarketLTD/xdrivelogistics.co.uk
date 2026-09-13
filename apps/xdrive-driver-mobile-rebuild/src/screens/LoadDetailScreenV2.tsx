import { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
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

export function LoadDetailScreen({ job, busy, existingQuote, quoteReadiness, onBack, onOpenDocuments, onQuote }: {
  job: DriverJob;
  busy: boolean;
  existingQuote?: Record<string, unknown>;
  quoteReadiness?: DriverQuoteReadiness;
  onBack: () => void;
  onOpenDocuments: () => void;
  onQuote: (input: DriverQuoteInput) => void;
}) {
  const [baseText, setBaseText] = useState('');
  const [extrasText, setExtrasText] = useState('0.00');
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
    if (job.journeyDistanceMiles == null) return '';
    if (job.estimatedJourneyMinutes == null) return `${job.journeyDistanceMiles.toFixed(1)} miles`;
    const mins = Math.round(job.estimatedJourneyMinutes);
    return `${job.journeyDistanceMiles.toFixed(1)} miles (${Math.floor(mins / 60)}h ${mins % 60}m)`;
  }, [job.estimatedJourneyMinutes, job.journeyDistanceMiles]);

  const existingAmount = first(existingQuote, ['amount', 'bid_price_gbp', 'price']);
  const existingBase = first(existingQuote, ['baseAmount', 'base_amount']);
  const existingExtras = first(existingQuote, ['additionalExtrasGbp', 'additional_extras_gbp']);
  const existingCollect = first(existingQuote, ['collectWithinMinutes', 'collect_within_minutes']);
  const existingMessage = first(existingQuote, ['message']);

  return <View style={styles.page}>
    <View style={styles.topbar}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to alerts" onPress={onBack} style={styles.back}><Ionicons name="chevron-back" size={25} color="#FFFFFF" /></Pressable>
      <Text style={styles.topTitle}>Load ID {job.reference}</Text><View style={styles.back} />
    </View>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.headerCard}>
        <Text style={styles.company}>{job.postingCompanyName || 'XDrive Load'}{job.postingCompanyMemberCode ? ` (${job.postingCompanyMemberCode})` : ''}</Text>
        <View style={styles.tags}>
          {job.serviceMode ? <Pill text={job.serviceMode.replace(/[_-]+/g, ' ').toUpperCase()} /> : null}
          {job.directDeliveryRequired ? <Pill text="DIRECT" green /> : null}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>ROUTE</Text>
        <View style={styles.route}><RouteBlock pickup={job.pickupLocation} delivery={job.deliveryLocation} pickupTiming={formatRouteTime(job.pickupTiming ?? job.pickupTime)} deliveryTiming={formatRouteTime(job.deliveryTiming ?? job.deliveryTime)} /></View>
        {distance ? <View style={styles.distance}><Ionicons name="navigate-outline" size={20} color="#292837" /><Text style={styles.distanceText}>{distance}</Text></View> : null}
        <View style={styles.info}>
          <Info label="Vehicle" value={job.vehicleRequirement} />
          <Info label="Cargo" value={job.cargoType} />
          {job.distanceToPickupMiles != null ? <Info label="Distance to pickup" value={`${job.distanceToPickupMiles.toFixed(1)} miles`} /> : null}
          {job.expiresAt ? <Info label="Quote closes" value={formatDeliveryDate(job.expiresAt)} /> : null}
          <Info label="POD" value={job.podRequired ? 'Required' : 'Not required'} />
        </View>
        <View style={styles.notes}><Text style={styles.label}>NOTES</Text><Text style={styles.notesText}>{job.notesSummary || job.pickupNote || job.deliveryNote || 'No additional instructions published.'}</Text></View>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>{existingQuote ? 'YOUR QUOTE' : 'SUBMIT QUOTE'}</Text>
        {existingQuote ? <>
          <View style={styles.summary}><View><Text style={styles.label}>TOTAL</Text><Text style={styles.amount}>{existingAmount == null ? '—' : `£${Number(existingAmount).toFixed(2)}`}</Text></View><Pill text={quoteStatus(existingQuote)} green={quoteStatus(existingQuote) === 'Accepted'} /></View>
          {existingBase != null ? <Info label="Base amount" value={`£${Number(existingBase).toFixed(2)}`} /> : null}
          {existingExtras != null ? <Info label="Additional extras" value={`£${Number(existingExtras).toFixed(2)}`} /> : null}
          {existingCollect != null ? <Info label="Collect within" value={`${existingCollect} minutes`} /> : null}
          {existingMessage ? <View style={styles.notes}><Text style={styles.label}>NOTES</Text><Text style={styles.notesText}>{String(existingMessage)}</Text></View> : null}
        </> : blocked ? <View style={styles.blocked}>
          <Text style={styles.blockedTitle}>Quote unavailable</Text><Text style={styles.blockedText}>{blockText}</Text>
          {blockedByReadiness ? <Pressable onPress={onOpenDocuments} style={styles.darkButton}><Text style={styles.darkButtonText}>Open Documents</Text></Pressable> : null}
        </View> : <>
          <View style={styles.moneyRow}><View style={styles.currency}><Text style={styles.currencyText}>GBP</Text></View><View style={styles.moneyInput}><Text style={styles.pound}>£</Text><TextInput accessibilityLabel="Quote amount excluding VAT" keyboardType="decimal-pad" value={baseText} onChangeText={setBaseText} placeholder="0.00" style={styles.moneyText} /></View></View>
          <Text style={styles.label}>MY QUOTE (EXC. VAT)</Text>

          <View style={styles.extras}><View style={{ flex: 1 }}><Text style={styles.label}>ADDITIONAL EXTRAS</Text><Text style={styles.helper}>Parking, tolls or agreed extras</Text></View><View style={styles.extrasInput}><Text style={styles.pound}>£</Text><TextInput accessibilityLabel="Additional extras" keyboardType="decimal-pad" value={extrasText} onChangeText={setExtrasText} style={styles.extrasText} /></View></View>
          <View style={styles.total}><Text style={styles.totalLabel}>TOTAL</Text><Text style={styles.totalValue}>{Number.isFinite(total) ? `£${total.toFixed(2)}` : '£0.00'}</Text></View>

          <Text style={styles.label}>WILL COLLECT WITHIN</Text>
          <View style={styles.collect}>{[[null, 'Not supplied'], [30, '30 min'], [60, '60 min'], [120, '2 hrs']].map(([value, label]) => <Pressable key={String(label)} onPress={() => setCollectWithin(value as number | null)} style={[styles.collectPill, collectWithin === value && styles.collectActive]}><Text style={[styles.collectText, collectWithin === value && styles.collectTextActive]}>{label}</Text></Pressable>)}</View>

          <Text style={styles.label}>VEHICLE</Text>
          <View style={styles.vehicle}><Ionicons name="car-outline" size={21} color="#292837" /><Text style={styles.vehicleText}>{job.vehicleRequirement || 'Assigned XDrive vehicle'}</Text></View>
          <Text style={styles.label}>NOTES</Text>
          <TextInput accessibilityLabel="Quote notes" value={message} onChangeText={setMessage} multiline maxLength={500} placeholder="Add a note for the customer" style={styles.noteInput} />
          <Pressable disabled={busy || !valid} onPress={() => onQuote({ baseAmount: base, additionalExtrasGbp: extras, collectWithinMinutes: collectWithin, message })} style={[styles.submit, (busy || !valid) && styles.submitDisabled]}><Text style={styles.submitText}>{busy ? 'Submitting…' : 'Submit Quote'}</Text></Pressable>
        </>}
      </View>
    </ScrollView>
  </View>;
}

function Pill({ text, green = false }: { text: string; green?: boolean }) {
  return <View style={[styles.pill, green && styles.pillGreen]}><Text style={styles.pillText}>{text}</Text></View>;
}
function Info({ label, value }: { label: string; value: string }) {
  return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value || 'Not supplied'}</Text></View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#292837' }, topbar: { minHeight: 78, paddingTop: 16, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' }, back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, topTitle: { flex: 1, textAlign: 'center', fontFamily: 'Inter_600SemiBold', fontSize: 18, color: '#FFFFFF' },
  scroll: { flex: 1, backgroundColor: '#F2F3F7' }, content: { padding: 16, paddingBottom: 32, gap: 14 }, headerCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, gap: 10, ...shadow }, company: { fontFamily: 'Inter_700Bold', fontSize: 19, color: '#454453' }, tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, pill: { alignSelf: 'flex-start', borderRadius: 7, backgroundColor: '#4F98D7', paddingHorizontal: 9, paddingVertical: 5 }, pillGreen: { backgroundColor: '#49AF3F' }, pillText: { fontFamily: 'Inter_700Bold', fontSize: 10, color: '#FFFFFF' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, gap: 12, ...shadow }, heading: { fontFamily: 'Inter_700Bold', fontSize: 18, color: '#292837' }, label: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: .8, color: '#777684' }, route: { borderWidth: 1, borderColor: '#E1E2E7', borderRadius: 15, paddingVertical: 5, overflow: 'hidden' }, distance: { flexDirection: 'row', gap: 8, alignItems: 'center' }, distanceText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#777684' }, info: { backgroundColor: '#EDF4FC', borderRadius: 12, padding: 12, gap: 8 }, infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 14 }, infoLabel: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#6F6E7D' }, infoValue: { flex: 1, textAlign: 'right', fontFamily: 'Inter_700Bold', fontSize: 13, color: '#292837' }, notes: { backgroundColor: '#F1F1F4', borderRadius: 12, padding: 12, gap: 5 }, notesText: { fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 20, color: '#292837' },
  summary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F4F4F6', borderRadius: 14, padding: 14 }, amount: { marginTop: 3, fontFamily: 'Inter_700Bold', fontSize: 24, color: '#292837' }, blocked: { borderWidth: 1, borderColor: '#E0E1E5', borderRadius: 14, backgroundColor: '#F5F5F7', padding: 14 }, blockedTitle: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#292837' }, blockedText: { marginTop: 4, fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 19, color: '#777684' }, darkButton: { alignSelf: 'flex-start', marginTop: 12, minHeight: 42, borderRadius: 21, backgroundColor: '#292837', paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' }, darkButtonText: { fontFamily: 'Inter_700Bold', fontSize: 13, color: '#FFFFFF' },
  moneyRow: { flexDirection: 'row', gap: 10 }, currency: { width: 70, height: 52, borderRadius: 12, backgroundColor: '#292837', alignItems: 'center', justifyContent: 'center' }, currencyText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#FFFFFF' }, moneyInput: { flex: 1, height: 52, borderWidth: 1, borderColor: '#CBCBD2', borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13 }, pound: { fontFamily: 'Inter_700Bold', fontSize: 17, color: '#292837' }, moneyText: { flex: 1, marginLeft: 5, fontFamily: 'Inter_700Bold', fontSize: 19, color: '#292837' },
  extras: { minHeight: 72, borderWidth: 1, borderStyle: 'dashed', borderColor: '#B9BAC2', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }, helper: { marginTop: 4, fontFamily: 'Inter_500Medium', fontSize: 11, color: '#8B8A96' }, extrasInput: { width: 106, height: 42, borderWidth: 1, borderColor: '#D0D1D6', borderRadius: 10, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9 }, extrasText: { flex: 1, marginLeft: 3, fontFamily: 'Inter_700Bold', fontSize: 14, textAlign: 'right', color: '#292837' }, total: { minHeight: 54, borderRadius: 12, backgroundColor: '#F3F3F5', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, totalLabel: { fontFamily: 'Inter_700Bold', fontSize: 13, color: '#777684' }, totalValue: { fontFamily: 'Inter_700Bold', fontSize: 21, color: '#292837' },
  collect: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, collectPill: { minHeight: 38, borderRadius: 19, backgroundColor: '#F1F1F4', paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' }, collectActive: { backgroundColor: '#FFE66A' }, collectText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#666573' }, collectTextActive: { fontFamily: 'Inter_700Bold', color: '#111111' }, vehicle: { minHeight: 50, borderWidth: 1, borderColor: '#D9DADE', borderRadius: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }, vehicleText: { flex: 1, fontFamily: 'Inter_700Bold', fontSize: 14, color: '#292837' }, noteInput: { minHeight: 92, borderWidth: 1, borderColor: '#D0D1D6', borderRadius: 12, padding: 12, textAlignVertical: 'top', fontFamily: 'Inter_500Medium', fontSize: 14, color: '#292837' }, submit: { minHeight: 56, borderRadius: 28, backgroundColor: '#FFD200', alignItems: 'center', justifyContent: 'center' }, submitDisabled: { backgroundColor: '#DDDEE2' }, submitText: { fontFamily: 'Inter_700Bold', fontSize: 17, color: '#111111' },
});
