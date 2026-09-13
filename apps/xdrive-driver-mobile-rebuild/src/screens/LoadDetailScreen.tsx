import { useState } from 'react';
import { UiIcon as Ionicons } from '../components/UiIcon';
import { Linking, StyleSheet } from 'react-native';
import { Pressable, ScrollView, Text, TextInput, View } from '../theme/primitives';
import type { DriverJob, DriverQuoteReadiness } from '../types/driver';
import { shadow } from '../theme/tokens';
import { formatDeliveryDate } from '../utils/format';
import { isQuoteWindowOpen, quoteReadinessMessage } from '../api/driver';

function journeyLabel(job: DriverJob) {
  const bits: string[] = [];
  if (job.journeyDistanceMiles != null) bits.push(`${job.journeyDistanceMiles.toFixed(1)} miles`);
  if (job.estimatedJourneyMinutes != null) {
    const minutes = Math.max(0, Math.round(job.estimatedJourneyMinutes));
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    bits.push(`${hours ? `${hours}h ` : ''}${rest}mins`);
  }
  return bits.length > 1 ? `${bits[0]} (${bits[1]})` : bits[0] ?? '';
}

export function LoadDetailScreen({ job, busy, existingQuote, quoteReadiness, onBack, onOpenDocuments, onQuote }: {
  job: DriverJob;
  busy: boolean;
  existingQuote?: Record<string, unknown>;
  quoteReadiness?: DriverQuoteReadiness;
  onBack: () => void;
  onOpenDocuments: () => void;
  onQuote: (amount: number) => void;
}) {
  const [quote, setQuote] = useState('');
  const [notes, setNotes] = useState('');
  const amount = Number(quote.replace(/[^0-9.]/g, ''));
  const existingAmountRaw = existingQuote ? String(existingQuote.amount ?? existingQuote.bid_price_gbp ?? existingQuote.price ?? '-') : '';
  const existingAmount = existingAmountRaw && existingAmountRaw !== '-' && !existingAmountRaw.startsWith('£')
    ? (Number.isFinite(Number(existingAmountRaw)) ? `£${Number(existingAmountRaw).toFixed(2)}` : existingAmountRaw)
    : existingAmountRaw;
  const existingStatusRaw = existingQuote ? String(existingQuote.status ?? existingQuote.quote_status ?? 'Submitted') : '';
  const existingStatus = ['accepted','won','awarded'].includes(existingStatusRaw.toLowerCase())
    ? 'Accepted'
    : ['declined','rejected','unsuccessful','lost'].includes(existingStatusRaw.toLowerCase())
      ? 'Unsuccessful'
      : ['withdrawn','cancelled'].includes(existingStatusRaw.toLowerCase()) ? 'Withdrawn' : 'Submitted';
  const quoteWindowOpen = isQuoteWindowOpen(job);
  const readinessBlocked = quoteReadiness?.eligible === false;
  const quoteBlocked = !existingQuote && (!quoteWindowOpen || job.canQuote === false || readinessBlocked);
  const blockMessage = !quoteWindowOpen
    ? 'This load is no longer open for quotation.'
    : job.canQuote === false
      ? (job.quoteWarning || 'This load is not currently eligible for quotation.')
      : quoteReadinessMessage(quoteReadiness);
  const distance = journeyLabel(job);

  return <View style={styles.page}>
    <View style={styles.topbar}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to alerts" onPress={onBack} style={styles.back}><Ionicons name="chevron-back" size={26} color="#FFFFFF" /></Pressable>
      <Text style={styles.topTitle}>Load ID {job.reference}</Text>
      <View style={styles.back} />
    </View>

    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.summaryCard}>
        <Text style={styles.company} numberOfLines={1}>{job.postingCompanyName || 'XDrive Load'}{job.postingCompanyMemberCode ? ` (${job.postingCompanyMemberCode})` : ''}</Text>
        <Text style={styles.meta}>{job.postedAt ? `${formatDeliveryDate(job.postedAt)} | ` : ''}{job.vehicleRequirement || 'Vehicle'}</Text>
        <View style={styles.tags}>
          {job.serviceMode ? <View style={styles.tagBlue}><Text style={styles.tagBlueText}>{job.serviceMode.replace(/[_-]+/g, ' ').toUpperCase()}</Text></View> : null}
          {job.directDeliveryRequired ? <View style={styles.tagGreen}><Text style={styles.tagGreenText}>DIRECT</Text></View> : null}
        </View>
        <View style={styles.routeCard}>
          <View style={styles.routeRail}>
            <View style={styles.stopSquare}><Text style={styles.stopNumber}>1</Text></View>
            <Text style={styles.routeDots}>•••</Text>
            <View style={styles.stopPin}><Text style={styles.stopNumber}>2</Text></View>
          </View>
          <View style={styles.routeCopy}>
            <View><Text style={styles.place}>{job.pickupLocation}</Text><Text style={styles.routeTime}>{formatDeliveryDate(job.pickupTime)}</Text></View>
            <View><Text style={styles.place}>{job.deliveryLocation}</Text><Text style={styles.routeTime}>{formatDeliveryDate(job.deliveryTime)}</Text></View>
          </View>
        </View>
        {distance ? <View style={styles.distanceRow}><Ionicons name="navigate-outline" size={19} color="#292837" /><Text style={styles.distance}>{distance}</Text></View> : null}
      </View>

      <View style={styles.infoCard}>
        <InfoRow icon="car-outline" label="VEHICLE" value={job.vehicleRequirement || 'Not supplied'} />
        {job.cargoType ? <InfoRow icon="cube-outline" label="LOAD" value={job.cargoType} /> : null}
        {job.dimensions ? <InfoRow icon="document-text-outline" label="DIMENSIONS" value={job.dimensions} /> : null}
        {job.weight ? <InfoRow icon="document-text-outline" label="WEIGHT" value={job.weight} /> : null}
        {job.notesSummary || job.pickupNote || job.deliveryNote ? <View style={styles.notesCard}>
          <Text style={styles.notesHeading}>NOTES</Text>
          <Text style={styles.notesText}>{job.notesSummary || job.pickupNote || job.deliveryNote}</Text>
        </View> : null}
      </View>

      {job.contactAllowed && (job.contactName || job.contactPhone) ? <View style={styles.customerCard}>
        <Text style={styles.sectionHeading}>CUSTOMER</Text>
        <Text style={styles.customerName}>{job.contactName || job.postingCompanyName || 'Booking contact'}</Text>
        {job.contactPhone ? <Pressable accessibilityRole="button" accessibilityLabel="Call booking contact" onPress={() => void Linking.openURL(`tel:${job.contactPhone}`)} style={styles.contactAction}>
          <Ionicons name="call" size={20} color="#292837" /><Text style={styles.contactText}>{job.contactPhone}</Text>
        </Pressable> : null}
      </View> : null}

      <View style={styles.quoteCard}>
        <Text style={styles.sectionHeading}>MY QUOTE (EXC. VAT)</Text>
        {existingQuote ? <View style={styles.existingQuote}>
          <View><Text style={styles.existingLabel}>YOUR QUOTE</Text><Text style={styles.existingAmount}>{existingAmount || '—'}</Text></View>
          <View style={[styles.statusPill, existingStatus === 'Accepted' && styles.statusAccepted]}><Text style={[styles.statusText, existingStatus === 'Accepted' && styles.statusAcceptedText]}>{existingStatus}</Text></View>
        </View> : quoteBlocked ? <View style={styles.blockedQuote}>
          <Text style={styles.blockedTitle}>Quote unavailable</Text>
          <Text style={styles.blockedText}>{blockMessage}</Text>
          {readinessBlocked ? <Pressable accessibilityRole="button" accessibilityLabel="Open compliance documents" onPress={onOpenDocuments} style={styles.documentsButton}><Text style={styles.documentsText}>Open Documents</Text></Pressable> : null}
        </View> : <>
          <View style={styles.quoteRow}>
            <View style={styles.currencyBox}><Text style={styles.currency}>GBP</Text><Ionicons name="chevron-forward" size={20} color="#B4B5BC" /></View>
            <View style={styles.amountBox}><Text style={styles.pound}>£</Text><TextInput keyboardType="decimal-pad" value={quote} onChangeText={setQuote} placeholder="0.00" placeholderTextColor="#B2B2BA" style={styles.amountInput} /></View>
          </View>
          <View style={styles.extrasBox}><View style={styles.plusCircle}><Text style={styles.plus}>+</Text></View><Text style={styles.extrasText}>Additional extras</Text></View>
          <View style={styles.totalRow}><Text style={styles.totalLabel}>Total:</Text><Text style={styles.totalValue}>£{Number.isFinite(amount) && amount > 0 ? amount.toFixed(2) : '0.00'}</Text></View>
          <Text style={styles.fieldLabel}>WILL COLLECT WITHIN</Text>
          <View style={styles.selectBox}><Text style={styles.selectText}>Not supplied</Text><Ionicons name="chevron-forward" size={20} color="#C5C6CC" /></View>
          <Text style={styles.fieldLabel}>VEHICLE</Text>
          <View style={styles.selectBox}><Text style={styles.selectValue}>{job.vehicleRequirement || 'Not supplied'}</Text><Ionicons name="chevron-forward" size={20} color="#C5C6CC" /></View>
          <View style={styles.notesLabelRow}><Text style={styles.fieldLabel}>NOTES</Text><Text style={styles.counter}>{notes.length}/300</Text></View>
          <TextInput value={notes} onChangeText={(value) => setNotes(value.slice(0, 300))} multiline placeholder="Your notes" placeholderTextColor="#BABAC2" style={styles.notesInput} />
          <Pressable accessibilityRole="button" accessibilityLabel="Submit quote" disabled={busy || !Number.isFinite(amount) || amount <= 0} onPress={() => onQuote(amount)} style={({ pressed }) => [styles.submitButton, (busy || !Number.isFinite(amount) || amount <= 0) && styles.submitDisabled, pressed && styles.submitPressed]}>
            <Text style={styles.submitText}>{busy ? 'Submitting…' : 'Submit Quote'}</Text>
          </Pressable>
        </>}
      </View>
    </ScrollView>
  </View>;
}

function InfoRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return <View style={styles.infoRow}><Ionicons name={icon} size={21} color="#292837" /><View style={styles.infoCopy}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View></View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F2F3F7' },
  topbar: { minHeight: 80, paddingTop: 18, paddingHorizontal: 12, backgroundColor: '#292837', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, textAlign: 'center', fontFamily: 'Inter_600SemiBold', fontSize: 18, color: '#FFFFFF' },
  content: { padding: 16, gap: 14, paddingBottom: 28 },
  summaryCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, gap: 12, ...shadow },
  company: { fontFamily: 'Inter_700Bold', fontSize: 18, color: '#4A4958' },
  meta: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#777684' },
  tags: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tagBlue: { borderRadius: 7, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#E8F2FB' },
  tagBlueText: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: .6, color: '#2473B7' },
  tagGreen: { borderRadius: 7, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#4CAD3F' },
  tagGreenText: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: .6, color: '#FFFFFF' },
  routeCard: { flexDirection: 'row', borderWidth: 1, borderColor: '#E1E2E7', borderRadius: 16, padding: 14, gap: 12 },
  routeRail: { width: 34, alignItems: 'center', justifyContent: 'space-between' },
  stopSquare: { width: 30, height: 30, borderRadius: 4, backgroundColor: '#5199D6', alignItems: 'center', justifyContent: 'center' },
  stopPin: { width: 30, height: 34, borderRadius: 17, borderBottomLeftRadius: 5, backgroundColor: '#5199D6', alignItems: 'center', justifyContent: 'center' },
  stopNumber: { fontFamily: 'Inter_700Bold', fontSize: 12, color: '#FFFFFF' },
  routeDots: { transform: [{ rotate: '90deg' }], color: '#CDD2D9', letterSpacing: 1 },
  routeCopy: { flex: 1, justifyContent: 'space-between', gap: 20 },
  place: { fontFamily: 'Inter_700Bold', fontSize: 18, color: '#4A4958' },
  routeTime: { marginTop: 4, fontFamily: 'Inter_500Medium', fontSize: 14, color: '#7F7E8C' },
  distanceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  distance: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#777684' },
  infoCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, gap: 16, ...shadow },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  infoCopy: { flex: 1 },
  infoLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: .9, color: '#777684' },
  infoValue: { marginTop: 3, fontFamily: 'Inter_700Bold', fontSize: 16, lineHeight: 22, color: '#292837' },
  notesCard: { backgroundColor: '#F0F1F4', borderRadius: 14, padding: 14 },
  notesHeading: { fontFamily: 'Inter_600SemiBold', fontSize: 13, letterSpacing: .8, color: '#565563' },
  notesText: { marginTop: 8, fontFamily: 'Inter_500Medium', fontSize: 15, lineHeight: 23, color: '#292837' },
  customerCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, gap: 12, ...shadow },
  sectionHeading: { fontFamily: 'Inter_600SemiBold', fontSize: 13, letterSpacing: 1.1, color: '#777684' },
  customerName: { fontFamily: 'Inter_700Bold', fontSize: 17, color: '#292837' },
  contactAction: { minHeight: 48, borderRadius: 24, backgroundColor: '#4F98D7', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  contactText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#FFFFFF' },
  quoteCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, gap: 14, ...shadow },
  existingQuote: { minHeight: 74, borderWidth: 1, borderColor: '#E1E2E7', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  existingLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: .8, color: '#777684' },
  existingAmount: { marginTop: 4, fontFamily: 'Inter_700Bold', fontSize: 22, color: '#292837' },
  statusPill: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#ECEEF2' },
  statusAccepted: { backgroundColor: '#E8F6E5' },
  statusText: { fontFamily: 'Inter_700Bold', fontSize: 12, color: '#62616F' },
  statusAcceptedText: { color: '#2E7E34' },
  blockedQuote: { borderWidth: 1, borderColor: '#D7D8DE', borderRadius: 14, padding: 14 },
  blockedTitle: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#292837' },
  blockedText: { marginTop: 5, fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 19, color: '#777684' },
  documentsButton: { alignSelf: 'flex-start', marginTop: 12, minHeight: 40, borderRadius: 20, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#4F98D7' },
  documentsText: { fontFamily: 'Inter_700Bold', fontSize: 13, color: '#FFFFFF' },
  quoteRow: { flexDirection: 'row', gap: 10 },
  currencyBox: { flex: 1, minHeight: 58, borderWidth: 1, borderColor: '#E0E1E6', borderRadius: 13, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  currency: { fontFamily: 'Inter_700Bold', fontSize: 17, color: '#292837' },
  amountBox: { width: 128, minHeight: 58, borderWidth: 2, borderColor: '#777684', borderRadius: 13, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  pound: { fontFamily: 'Inter_600SemiBold', fontSize: 17, color: '#B2B2BA' },
  amountInput: { flex: 1, fontFamily: 'Inter_700Bold', fontSize: 18, color: '#292837' },
  extrasBox: { minHeight: 64, borderWidth: 1, borderStyle: 'dashed', borderColor: '#D8D9DE', borderRadius: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  plusCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#4CAD3F', alignItems: 'center', justifyContent: 'center' },
  plus: { fontFamily: 'Inter_500Medium', fontSize: 28, lineHeight: 30, color: '#FFFFFF' },
  extrasText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#C0C1C7' },
  totalRow: { minHeight: 60, borderWidth: 1, borderColor: '#ECEDEF', borderRadius: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalLabel: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#292837' },
  totalValue: { fontFamily: 'Inter_700Bold', fontSize: 20, color: '#292837' },
  fieldLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12, letterSpacing: 1.1, color: '#777684' },
  selectBox: { minHeight: 58, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#ECEDEF', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#C0C1C7' },
  selectValue: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#292837' },
  notesLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  counter: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#B4B5BC' },
  notesInput: { minHeight: 94, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#ECEDEF', padding: 14, textAlignVertical: 'top', fontFamily: 'Inter_500Medium', fontSize: 15, color: '#292837' },
  submitButton: { minHeight: 58, borderRadius: 14, backgroundColor: '#FFD200', alignItems: 'center', justifyContent: 'center' },
  submitDisabled: { backgroundColor: '#B8B9C0' },
  submitPressed: { opacity: .8 },
  submitText: { fontFamily: 'Inter_700Bold', fontSize: 17, color: '#111111' },
});