import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { LiveLoad } from '../api/liveLoads';

const BADGE_COLOURS: Record<string, { bg: string; text: string }> = {
  Hotshot:           { bg: '#92400e', text: '#fef3c7' },
  SmartPay:          { bg: '#14532d', text: '#bbf7d0' },
  'Same Day':        { bg: '#1e3a5f', text: '#bfdbfe' },
  Express:           { bg: '#7c2d12', text: '#fed7aa' },
  'Tail Lift':       { bg: '#1e293b', text: '#cbd5e1' },
  ADR:               { bg: '#7f1d1d', text: '#fecaca' },
  Fragile:           { bg: '#713f12', text: '#fef08a' },
  'High Value':      { bg: '#3b0764', text: '#e9d5ff' },
  'Temp Controlled': { bg: '#0c4a6e', text: '#bae6fd' },
};

function companyLabel(job: LiveLoad) {
  const company = job.postingCompanyName?.trim() || 'Posting company unavailable';
  return job.postingCompanyMemberCode ? `${company} (${job.postingCompanyMemberCode})` : company;
}

function schedule(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function scheduleWindow(from: string, to?: string) {
  const start = schedule(from);
  if (!to) return start;
  const end = schedule(to);
  return `${start} – ${end}`;
}

function formatEta(minutes?: number) {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function Stop({ pickup, location, time, timeTo }: { pickup: boolean; location: string; time: string; timeTo?: string }) {
  return <View style={styles.stop}>
    <View style={[styles.dot, pickup ? styles.pickupDot : styles.deliveryDot]} />
    <View style={styles.stopContent}>
      <Text style={[styles.stopLabel, pickup ? styles.pickupLabel : styles.deliveryLabel]}>{pickup ? 'PICKUP' : 'DELIVERY'}</Text>
      <Text style={styles.location} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.84}>{location}</Text>
      <Text style={styles.time} numberOfLines={1}>{scheduleWindow(time, timeTo)}</Text>
    </View>
  </View>;
}

function BadgeRow({ badges, adr, tailLift, temperatureControlled }: { badges?: string[]; adr?: boolean; tailLift?: boolean; temperatureControlled?: boolean }) {
  const all: string[] = [...(badges ?? [])];
  if (adr && !all.includes('ADR')) all.push('ADR');
  if (tailLift && !all.includes('Tail Lift')) all.push('Tail Lift');
  if (temperatureControlled && !all.includes('Temp Controlled')) all.push('Temp Controlled');
  if (all.length === 0) return null;
  return (
    <View style={styles.badgeRow}>
      {all.map((badge) => {
        const colours = BADGE_COLOURS[badge] ?? { bg: '#1f2937', text: '#f8fafc' };
        return (
          <View key={badge} style={[styles.badge, { backgroundColor: colours.bg }]}>
            <Text style={[styles.badgeText, { color: colours.text }]}>{badge.toUpperCase()}</Text>
          </View>
        );
      })}
    </View>
  );
}

function MetaRow({ job }: { job: LiveLoad }) {
  const items: { label: string; value: string }[] = [];
  if (job.distanceMiles != null) items.push({ label: 'DISTANCE', value: `${job.distanceMiles} mi` });
  const eta = formatEta(job.estimatedDrivingMinutes);
  if (eta) items.push({ label: 'ETA', value: eta });
  if (job.weightKg != null) items.push({ label: 'WEIGHT', value: `${job.weightKg} kg` });
  if (job.dimensions) items.push({ label: 'DIMS', value: job.dimensions });
  if (job.palletCount != null) items.push({ label: 'PALLETS', value: String(job.palletCount) });
  if (items.length === 0) return null;
  return (
    <View style={styles.metaGrid}>
      {items.map((item) => (
        <View key={item.label} style={styles.metaCell}>
          <Text style={styles.metaLabel}>{item.label}</Text>
          <Text style={styles.metaValue} numberOfLines={1}>{item.value}</Text>
        </View>
      ))}
    </View>
  );
}

export function LiveLoadCard({ job, onOpen, onQuote }: { job: LiveLoad; onOpen: () => void; onQuote: () => void }) {
  const company = companyLabel(job);
  return <View
    style={styles.card}
    accessibilityRole="none"
    accessibilityLabel={`${company}, ${job.pickupLocation} to ${job.deliveryLocation}`}
  >
    <TouchableOpacity onPress={onOpen} activeOpacity={0.85}>
      <View style={styles.header}>
        <View style={styles.companyRow}>
          <View style={styles.companyMark}><Text style={styles.companyMarkText}>X</Text></View>
          <Text style={styles.companyName} numberOfLines={1}>{company}</Text>
        </View>
        <Text style={styles.vehicle} numberOfLines={1}>{job.vehicleRequirement || 'Vehicle required'}</Text>
      </View>
      {job.destinationPriority ? <Text style={styles.priority}>NEAR YOUR DELIVERY DESTINATION</Text> : null}
      <BadgeRow badges={job.badges} adr={job.adr} tailLift={job.tailLift} temperatureControlled={job.temperatureControlled} />
      <Stop pickup location={job.pickupLocation} time={job.pickupTime} timeTo={job.pickupTimeTo} />
      <Stop pickup={false} location={job.deliveryLocation} time={job.deliveryTime} timeTo={job.deliveryTimeTo} />
      <MetaRow job={job} />
      <View style={styles.fields}>
        <View style={styles.field}><Text style={styles.fieldLabel}>JOB ID</Text><Text style={styles.fieldValue} numberOfLines={1}>{job.reference || 'Not provided'}</Text></View>
        <View style={styles.field}><Text style={styles.fieldLabel}>FREIGHT TYPE</Text><Text style={styles.fieldValue} numberOfLines={1}>{job.cargoType || 'Not provided'}</Text></View>
      </View>
      {job.publicPricePublished && job.price ? (
        <View style={styles.proposedChip}>
          <Text style={styles.proposedChipText}>PROPOSED: {job.price}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
    <View style={styles.actions}>
      <TouchableOpacity style={styles.detailsButton} onPress={onOpen} accessibilityRole="button" accessibilityLabel="View Details">
        <Text style={styles.detailsText}>VIEW DETAILS</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.quoteButton, job.canQuote === false && styles.actionLocked]}
        onPress={onQuote}
        disabled={job.canQuote === false}
        accessibilityRole="button"
        accessibilityLabel={job.canQuote === false ? 'Check Eligibility' : 'Quote'}
      >
        <Text style={styles.quoteText}>{job.canQuote === false ? 'CHECK ELIGIBILITY' : 'QUOTE'}</Text>
      </TouchableOpacity>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#0d1a24', borderColor: '#1f2937', borderWidth: 1, borderRadius: 18, padding: 16, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  companyRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 7 },
  companyMark: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffc107' },
  companyMarkText: { color: '#111827', fontSize: 14, fontWeight: '900' },
  companyName: { color: '#f8fafc', fontSize: 16, fontWeight: '900', flex: 1 },
  vehicle: { color: '#f8fafc', fontSize: 14, fontWeight: '900', backgroundColor: '#111827', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, maxWidth: '43%' },
  priority: { alignSelf: 'flex-start', color: '#fff', backgroundColor: '#22c55e', borderRadius: 999, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 5, fontSize: 10, fontWeight: '900' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  badgeText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
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
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metaCell: { backgroundColor: '#08131f', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, minWidth: 72 },
  metaLabel: { color: '#9ba9bd', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  metaValue: { color: '#f8fafc', fontSize: 13, fontWeight: '800', marginTop: 2 },
  fields: { minWidth: 0, flexDirection: 'row', gap: 12 },
  field: { flex: 1, minWidth: 0, backgroundColor: '#08131f', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  fieldLabel: { color: '#9ba9bd', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  fieldValue: { color: '#f8fafc', fontSize: 13, fontWeight: '800', marginTop: 2 },
  proposedChip: { alignSelf: 'flex-start', backgroundColor: '#14532d', borderColor: '#16a34a', borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  proposedChipText: { color: '#4ade80', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  actions: { flexDirection: 'row', gap: 10 },
  detailsButton: { flex: 1, minHeight: 52, backgroundColor: '#1f2937', borderRadius: 13, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderColor: '#374151', borderWidth: 1 },
  detailsText: { color: '#f8fafc', fontSize: 14, fontWeight: '900', letterSpacing: 0.4 },
  quoteButton: { flex: 2, minHeight: 52, backgroundColor: '#ffc107', borderRadius: 13, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  actionLocked: { backgroundColor: '#9ca3af' },
  quoteText: { color: '#111827', fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },
});
