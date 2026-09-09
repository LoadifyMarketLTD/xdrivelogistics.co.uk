import { useAppTheme } from '../theme/ThemeProvider';
import { useMemo, useState } from 'react';
import { UiIcon as Ionicons } from '../components/UiIcon';
import { StyleSheet } from 'react-native';
import { Pressable, ScrollView, Text, TextInput, View } from '../theme/primitives';
import type { DriverJob, DriverQuoteReadiness } from '../types/driver';
import { RouteBlock } from '../components/RouteBlock';
import { colors, radius, shadow, spacing } from '../theme/tokens';
import { formatDeliveryDate } from '../utils/format';
import { isQuoteWindowOpen, quoteReadinessMessage } from '../api/driver';

export function LoadDetailScreen({ job, busy, existingQuote, quoteReadiness, onBack, onOpenDocuments, onQuote }: {
  job: DriverJob;
  busy: boolean;
  existingQuote?: Record<string, unknown>;
  quoteReadiness?: DriverQuoteReadiness;
  onBack: () => void;
  onOpenDocuments: () => void;
  onQuote: (amount: number) => void;
}) {
  const { isDark: night } = useAppTheme();
  const adaptive = useMemo(() => night ? {
    page: '#090F1A', surface: '#182231', text: '#F8FAFC', muted: '#CBD5E1',
    info: '#223044', notes: '#202C3C', border: '#64748B', topbar: '#111827',
    input: '#0F172A', routePanel: '#DDE3EA', accent: '#16A34A', disabled: '#475569',
  } : {
    page: '#F3F4F6', surface: '#FFFFFF', text: '#0A0A0A', muted: '#334155',
    info: '#E6F0FF', notes: '#F1F3F5', border: '#64748B', topbar: '#FFFFFF',
    input: '#FFFFFF', routePanel: 'transparent', accent: '#15803D', disabled: '#64748B',
  }, [night]);
  const [quote, setQuote] = useState('');
  const amount = Number(quote.replace(/[^0-9.]/g, ''));
  const existingAmountRaw = existingQuote ? String(existingQuote.amount ?? existingQuote.bid_price_gbp ?? existingQuote.price ?? 'â€”') : '';
  const existingAmount = existingAmountRaw && existingAmountRaw !== 'â€”' && !existingAmountRaw.startsWith('Â£') ? `Â£${Number(existingAmountRaw).toFixed(2)}` : existingAmountRaw;
  const existingStatusRaw = existingQuote ? String(existingQuote.status ?? existingQuote.quote_status ?? 'Submitted') : '';
  const existingStatus = ['accepted','won','awarded'].includes(existingStatusRaw.toLowerCase()) ? 'Accepted' : ['declined','rejected','unsuccessful','lost'].includes(existingStatusRaw.toLowerCase()) ? 'Unsuccessful' : ['withdrawn','cancelled'].includes(existingStatusRaw.toLowerCase()) ? 'Withdrawn' : 'Submitted';
  const quoteWindowOpen = isQuoteWindowOpen(job);
  const readinessBlocked = quoteReadiness?.eligible === false;
  const quoteBlocked = !existingQuote && (!quoteWindowOpen || job.canQuote === false || readinessBlocked);
  const blockMessage = !quoteWindowOpen
    ? 'This load is no longer open for quotation.'
    : job.canQuote === false
      ? (job.quoteWarning || 'This load is not currently eligible for quotation.')
      : quoteReadinessMessage(quoteReadiness);
  return <View style={[styles.page, { backgroundColor: adaptive.page }]}>
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to loads" onPress={onBack} style={[styles.floatingBack, { backgroundColor: adaptive.surface, borderColor: adaptive.border }]}>
        <Ionicons name="chevron-back" size={24} color={adaptive.text} />
      </Pressable>
      <View style={[styles.card, { backgroundColor: adaptive.surface }]}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.heading, { color: adaptive.text }]}>Delivery Information</Text>
            <Text style={[styles.referenceLabel, { color: adaptive.muted }]}>LOAD REFERENCE</Text>
            <Text style={[styles.identity, { color: adaptive.text }]}>{job.reference}</Text>
            {job.postingCompanyName ? <Text style={[styles.companyCode, { color: adaptive.muted }]}>{job.postingCompanyName}{job.postingCompanyMemberCode ? ` | Member ${job.postingCompanyMemberCode}` : ''}</Text> : null}
          </View>
          {job.postedAt ? <Text style={[styles.date, { color: adaptive.muted }]}>Posted {formatDeliveryDate(job.postedAt)}</Text> : null}
        </View>
        <View style={[styles.routePanel, { backgroundColor: adaptive.routePanel }]}><RouteBlock pickup={job.pickupLocation} delivery={job.deliveryLocation} /></View>
        <View style={[styles.infoBand, { backgroundColor: adaptive.info }]}>
          {job.postingCompanyName ? <InfoRow adaptive={adaptive} label="Posted by" value={job.postingCompanyName} /> : null}
          <InfoRow adaptive={adaptive} label="Vehicle" value={job.vehicleRequirement} />
          <InfoRow adaptive={adaptive} label="Cargo" value={job.cargoType} />
          <InfoRow adaptive={adaptive} label="Collection" value={formatDeliveryDate(job.pickupTime)} />
          <InfoRow adaptive={adaptive} label="Delivery" value={formatDeliveryDate(job.deliveryTime)} />
          {job.distanceToPickupMiles != null ? <InfoRow adaptive={adaptive} label="Distance to pickup" value={`${job.distanceToPickupMiles.toFixed(1)} miles`} /> : null}
          {job.journeyDistanceMiles != null ? <InfoRow adaptive={adaptive} label="Journey distance" value={`${job.journeyDistanceMiles.toFixed(1)} miles`} /> : null}
          {job.estimatedJourneyMinutes != null ? <InfoRow adaptive={adaptive} label="Estimated journey" value={`${Math.round(job.estimatedJourneyMinutes)} min`} /> : null}
          {job.serviceMode ? <InfoRow adaptive={adaptive} label="Service" value={job.serviceMode.replace(/_/g, ' ')} /> : null}
          {job.directDeliveryRequired ? <InfoRow adaptive={adaptive} label="Delivery type" value="Direct delivery" /> : null}
          {job.expiresAt ? <InfoRow adaptive={adaptive} label="Quote closes" value={formatDeliveryDate(job.expiresAt)} /> : null}
          <InfoRow adaptive={adaptive} label="POD" value={job.podRequired ? 'Required' : 'Not required'} />
        </View>
        <View style={[styles.notes, { backgroundColor: adaptive.notes }]}>
          <Text style={[styles.notesTitle, { color: adaptive.text }]}>Job instructions</Text>
          <Text style={[styles.notesText, { color: adaptive.muted }]}>{job.notesSummary || job.pickupNote || job.deliveryNote || 'No additional instructions published.'}</Text>
        </View>
        <View style={styles.quoteBox}>
          <Text style={[styles.quoteLabel, { color: adaptive.text }]}>Your quote</Text>
          {existingQuote ? <View style={[styles.existingQuote, { backgroundColor: adaptive.input, borderColor: adaptive.border }]}>
            <Text style={[styles.existingQuoteAmount, { color: adaptive.text }]}>{existingAmount || '\u2014'}</Text>
            <Text style={[styles.existingQuoteStatus, { color: existingStatus === 'Accepted' ? '#22A55A' : adaptive.muted }]}>{existingStatus}</Text>
          </View> : quoteBlocked ? <View style={[styles.blockedQuote, { backgroundColor: adaptive.input, borderColor: adaptive.border }]}>
            <Text style={[styles.blockedQuoteTitle, { color: adaptive.text }]}>Quote unavailable</Text>
            <Text style={[styles.blockedQuoteText, { color: adaptive.muted }]}>{blockMessage}</Text>
            {readinessBlocked ? <Pressable accessibilityRole="button" accessibilityLabel="Open compliance documents" onPress={onOpenDocuments} style={[styles.blockedAction, { borderColor: adaptive.accent }]}><Text style={[styles.blockedActionText, { color: adaptive.accent }]}>Open Documents</Text></Pressable> : null}
          </View> : <>
            <View style={[styles.quoteInputRow, { backgroundColor: adaptive.input, borderColor: adaptive.border }]}><Text style={[styles.pound, { color: adaptive.text }]}>{'\u00A3'}</Text><TextInput keyboardType="decimal-pad" value={quote} onChangeText={setQuote} placeholder="0.00" placeholderTextColor={adaptive.muted} style={[styles.quoteInput, { color: adaptive.text }]} /></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Submit quote" disabled={busy || !Number.isFinite(amount) || amount <= 0} onPress={() => onQuote(amount)} style={({ pressed }) => [styles.quoteButton, (busy || !Number.isFinite(amount) || amount <= 0) && styles.quoteButtonDisabled, { backgroundColor: (busy || !Number.isFinite(amount) || amount <= 0) ? adaptive.disabled : adaptive.accent }, pressed && styles.quoteButtonPressed]}>
              <Text style={styles.quoteButtonText}>{busy ? 'Submitting...' : 'Submit Quote'}</Text>
            </Pressable>
          </>}
        </View>
      </View>
    </ScrollView>
  </View>;
}

function InfoRow({ label, value, adaptive }: { label: string; value: string; adaptive: { text: string; muted: string } }) {
  return <View style={styles.infoRow}><Text style={[styles.infoLabel, { color: adaptive.muted }]}>{label}</Text><Text style={[styles.infoValue, { color: adaptive.text }]}>{value || 'â€”'}</Text></View>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F7F7F7' },
  floatingBack: { width: 44, height: 44, marginBottom: 8, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: spacing.md, paddingTop: 10, paddingBottom: 12 },
  card: { backgroundColor: colors.surface, borderRadius: radius.medium, overflow: 'hidden', gap: 8, paddingTop: 10, ...shadow },
  routePanel: { marginHorizontal: spacing.md, borderRadius: 12, paddingVertical: 5 },
  header: { paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  heading: { flex: 1, fontFamily: 'Inter_700Bold', fontSize: 18, color: colors.text },
  referenceLabel: { marginTop: 10, fontFamily: 'Inter_500Medium', fontSize: 10, letterSpacing: 0.9 },
  identity: { marginTop: 2, fontFamily: 'Inter_700Bold', fontSize: 18 },
  companyCode: { marginTop: 3, fontFamily: 'Inter_500Medium', fontSize: 12, color: '#64748B' },
  date: { width: 120, textAlign: 'right', fontFamily: 'Inter_500Medium', fontSize: 12, color: colors.muted },
  infoBand: { backgroundColor: colors.info, paddingHorizontal: spacing.md, paddingVertical: 9, gap: 6 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 15 },
  infoLabel: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#526071' },
  infoValue: { flex: 1, textAlign: 'right', fontFamily: 'Inter_600SemiBold', fontSize: 14, color: colors.text },
  notes: { marginHorizontal: spacing.md, backgroundColor: '#F4F6F8', borderRadius: radius.small, paddingHorizontal: 12, paddingVertical: 9 },
  notesTitle: { fontFamily: 'Inter_700Bold', fontSize: 13, color: colors.text },
  notesText: { marginTop: 3, fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20, color: '#526071' },
  quoteBox: { marginHorizontal: spacing.md, marginBottom: 10, gap: 6 },
  quoteLabel: { fontFamily: 'Inter_700Bold', fontSize: 13, color: colors.text },
  existingQuote: { minHeight: 52, borderWidth: 1, borderRadius: radius.small, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  existingQuoteAmount: { fontFamily: 'Inter_700Bold', fontSize: 20 },
  existingQuoteStatus: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  blockedQuote: { borderWidth: 1, borderRadius: radius.small, padding: 12 },
  blockedQuoteTitle: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  blockedQuoteText: { marginTop: 4, fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 17 },
  blockedAction: { alignSelf: 'flex-start', marginTop: 10, minHeight: 38, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  blockedActionText: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  quoteInputRow: { height: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radius.small, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  pound: { marginRight: 4, fontFamily: 'Inter_700Bold', fontSize: 16, color: colors.text },
  quoteInput: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 15, color: colors.text },
  quoteButton: { minHeight: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#16A34A', paddingHorizontal: 18 },
  quoteButtonDisabled: { backgroundColor: '#94A3B8' },
  quoteButtonPressed: { opacity: 0.82 },
  quoteButtonText: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#FFFFFF' },
});
