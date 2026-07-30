import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { LiveLoad } from '../api/liveLoads';

function companyName(job: LiveLoad) {
  return job.postingCompanyName?.trim() || 'Verified marketplace member';
}

function schedule(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Stop({ pickup, location, time }: { pickup: boolean; location: string; time: string }) {
  return (
    <View style={styles.stopRow}>
      <View style={styles.routeRail}>
        <View style={[styles.routeDot, pickup ? styles.pickupDot : styles.deliveryDot]} />
        {pickup ? <View style={styles.routeLine} /> : null}
      </View>
      <View style={styles.stopContent}>
        <Text style={[styles.stopLabel, pickup ? styles.pickupLabel : styles.deliveryLabel]}>
          {pickup ? 'Pickup' : 'Delivery'}
        </Text>
        <Text style={styles.location} numberOfLines={2}>{location}</Text>
        <Text style={styles.time} numberOfLines={1}>{schedule(time)}</Text>
      </View>
    </View>
  );
}

function DetailPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailPill}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

export function LiveLoadCard({
  job,
  action = 'QUOTE',
  onOpen,
  onAction,
}: {
  job: LiveLoad;
  action?: string;
  onOpen: () => void;
  onAction: () => void;
}) {
  const company = companyName(job);
  const distance = typeof job.distanceFromCurrentDeliveryMiles === 'number'
    ? `${job.distanceFromCurrentDeliveryMiles.toFixed(job.distanceFromCurrentDeliveryMiles < 10 ? 1 : 0)} mi`
    : '';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onOpen}
      activeOpacity={0.92}
      accessibilityRole="button"
      accessibilityLabel={`${company}, pickup ${job.pickupLocation}, delivery ${job.deliveryLocation}`}
    >
      <View style={styles.header}>
        <View style={styles.companyBlock}>
          <Text style={styles.companyName} numberOfLines={1}>{company}</Text>
          {job.postingCompanyMemberCode ? (
            <Text style={styles.memberCode} numberOfLines={1}>Member {job.postingCompanyMemberCode}</Text>
          ) : null}
        </View>
        {job.publicPricePublished && job.price ? (
          <View style={styles.priceBlock}>
            <Text style={styles.price}>{job.price}</Text>
            <Text style={styles.priceLabel}>Proposed</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.badgeRow}>
        <View style={styles.vehicleBadge}><Text style={styles.vehicleText}>{job.vehicleRequirement || 'Vehicle required'}</Text></View>
        {job.destinationPriority ? <View style={styles.priorityBadge}><Text style={styles.priorityText}>Near destination</Text></View> : null}
        {job.directDeliveryRequired ? <View style={styles.directBadge}><Text style={styles.directText}>Direct</Text></View> : null}
      </View>

      <View style={styles.routeCard}>
        <Stop pickup location={job.pickupLocation} time={job.pickupTime} />
        <Stop pickup={false} location={job.deliveryLocation} time={job.deliveryTime} />
      </View>

      <View style={styles.detailsRow}>
        <DetailPill label="Freight" value={job.cargoType || 'Not provided'} />
        {distance ? <DetailPill label="Distance" value={distance} /> : null}
        {job.serviceMode ? <DetailPill label="Service" value={job.serviceMode} /> : null}
      </View>

      <View style={styles.footerMeta}>
        <Text style={styles.reference} numberOfLines={1}>{job.reference}</Text>
        <Text style={styles.swipeHint}>Swipe right to save · left to hide</Text>
      </View>

      {job.canQuote === false && job.quoteWarning ? (
        <Text style={styles.warning}>{job.quoteWarning}</Text>
      ) : null}

      <TouchableOpacity
        style={[styles.action, job.canQuote === false && styles.actionLocked]}
        onPress={(event) => {
          event.stopPropagation();
          onAction();
        }}
        disabled={job.canQuote === false}
        accessibilityRole="button"
        accessibilityLabel={job.canQuote === false ? 'Quote eligibility required' : action}
      >
        <Text style={styles.actionText}>{job.canQuote === false ? 'CHECK ELIGIBILITY' : action.toUpperCase()}</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 13,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  companyBlock: { flex: 1, minWidth: 0 },
  companyName: { color: '#0f172a', fontSize: 16, lineHeight: 21, fontWeight: '800' },
  memberCode: { color: '#64748b', fontSize: 11, lineHeight: 16, fontWeight: '600', marginTop: 1 },
  priceBlock: { alignItems: 'flex-end' },
  price: { color: '#0b2f6b', fontSize: 19, lineHeight: 23, fontWeight: '900' },
  priceLabel: { color: '#64748b', fontSize: 10, lineHeight: 14, fontWeight: '700' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  vehicleBadge: { backgroundColor: '#e8eef9', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  vehicleText: { color: '#0b2f6b', fontSize: 11, fontWeight: '800' },
  priorityBadge: { backgroundColor: '#dcfce7', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  priorityText: { color: '#166534', fontSize: 11, fontWeight: '800' },
  directBadge: { backgroundColor: '#fff7ed', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  directText: { color: '#c2410c', fontSize: 11, fontWeight: '800' },
  routeCard: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0', borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12, gap: 2 },
  stopRow: { minHeight: 68, flexDirection: 'row', alignItems: 'stretch', gap: 10 },
  routeRail: { width: 18, alignItems: 'center' },
  routeDot: { width: 13, height: 13, borderRadius: 7, borderWidth: 3, backgroundColor: '#ffffff', marginTop: 4, zIndex: 2 },
  pickupDot: { borderColor: '#16a34a' },
  deliveryDot: { borderColor: '#dc2626' },
  routeLine: { width: 2, flex: 1, minHeight: 42, backgroundColor: '#cbd5e1', marginTop: 1, marginBottom: -3 },
  stopContent: { flex: 1, minWidth: 0, paddingBottom: 8 },
  stopLabel: { fontSize: 11, lineHeight: 15, fontWeight: '800' },
  pickupLabel: { color: '#15803d' },
  deliveryLabel: { color: '#b91c1c' },
  location: { color: '#0f172a', fontSize: 16, lineHeight: 21, fontWeight: '800', marginTop: 1 },
  time: { color: '#64748b', fontSize: 12, lineHeight: 17, fontWeight: '600', marginTop: 2 },
  detailsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  detailPill: { minWidth: 92, maxWidth: '100%', flexGrow: 1, backgroundColor: '#f8fafc', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  detailLabel: { color: '#64748b', fontSize: 10, lineHeight: 14, fontWeight: '700' },
  detailValue: { color: '#1e293b', fontSize: 12, lineHeight: 16, fontWeight: '800', marginTop: 1 },
  footerMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  reference: { flexShrink: 1, color: '#94a3b8', fontSize: 10, lineHeight: 14, fontWeight: '600' },
  swipeHint: { color: '#94a3b8', fontSize: 9, lineHeight: 13, fontWeight: '600', textAlign: 'right' },
  warning: { color: '#991b1b', backgroundColor: '#fef2f2', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  action: { width: '100%', minHeight: 52, backgroundColor: '#f5a300', borderRadius: 13, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  actionLocked: { backgroundColor: '#cbd5e1' },
  actionText: { color: '#0f172a', fontSize: 16, lineHeight: 20, fontWeight: '900', letterSpacing: 0.3 },
});
