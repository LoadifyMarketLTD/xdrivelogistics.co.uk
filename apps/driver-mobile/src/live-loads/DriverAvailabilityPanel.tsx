import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import {
  fetchAvailabilityPresence,
  fetchMarketIntelligence,
  fetchReturnJourney,
  saveReturnJourney,
  startAvailabilityPresence,
  stopAvailabilityPresence,
  type AvailabilityPresence,
  type MarketIntelligence,
  type ReturnJourney,
} from '../api/operations';
import { getSessionToken } from '../auth/sessionStore';

type Visibility = AvailabilityPresence['visibility'];

const visibilityOptions: Array<[Visibility, string]> = [
  ['private', 'Private'],
  ['fleet', 'Fleet'],
  ['exchange', 'Exchange'],
];
const hourOptions = [2, 4, 8];
const marketRadiusOptions = [10, 30, 50, 100, 200, 300] as const;

async function requireToken() {
  const token = (await getSessionToken())?.trim() || '';
  if (!token) throw new Error('Driver session is not available.');
  return token;
}

async function currentCoords() {
  let permission = await Location.getForegroundPermissionsAsync();
  if (permission.status !== Location.PermissionStatus.GRANTED) {
    permission = await Location.requestForegroundPermissionsAsync();
  }
  if (permission.status !== Location.PermissionStatus.GRANTED) {
    throw new Error('Location permission is required to publish availability.');
  }
  const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { lat: location.coords.latitude, lng: location.coords.longitude };
}

function moneyPerMile(value: number | null) {
  return value == null ? null : `£${value.toFixed(2)}/mi`;
}

export function DriverAvailabilityPanel() {
  const [availability, setAvailability] = useState<AvailabilityPresence | null>(null);
  const [visibility, setVisibility] = useState<Visibility>('exchange');
  const [availabilityHours, setAvailabilityHours] = useState(4);
  const [returnHours, setReturnHours] = useState(8);
  const [fromPostcode, setFromPostcode] = useState('');
  const [toPostcode, setToPostcode] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [notes, setNotes] = useState('');
  const [marketRadius, setMarketRadius] = useState<number>(30);
  const [market, setMarket] = useState<MarketIntelligence | null>(null);
  const [marketBusy, setMarketBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const loadMarket = useCallback(async (radius = marketRadius) => {
    setMarketBusy(true);
    try {
      const token = await requireToken();
      const intelligence = await fetchMarketIntelligence(token, radius);
      setMarket(intelligence);
    } catch (error) {
      setMarket(null);
      setMessage(error instanceof Error ? error.message : 'Market intelligence could not be loaded.');
    } finally {
      setMarketBusy(false);
    }
  }, [marketRadius]);

  const load = useCallback(async () => {
    try {
      const token = await requireToken();
      const [availabilityState, returnState] = await Promise.all([
        fetchAvailabilityPresence(token),
        fetchReturnJourney(token),
      ]);
      setAvailability(availabilityState.active ? availabilityState.presence : null);
      const journey = returnState.journey;
      if (journey) {
        setFromPostcode(journey.from_postcode ?? '');
        setToPostcode(journey.to_postcode ?? '');
        setVehicleType(journey.vehicle_type ?? '');
        setNotes(journey.notes ?? '');
      }
      await loadMarket(marketRadius);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Availability could not be loaded.');
    }
  }, [loadMarket, marketRadius]);

  useEffect(() => {
    void load();
  }, [load]);

  async function publishAvailability() {
    setBusy(true);
    setMessage('');
    try {
      const token = await requireToken();
      const coords = await currentCoords();
      const result = await startAvailabilityPresence(token, {
        ...coords,
        visibility,
        hours: availabilityHours,
      });
      setAvailability({ visibility: result.visibility, available_until: result.available_until });
      setMessage('Availability published.');
      await loadMarket(marketRadius);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Availability could not be published.');
    } finally {
      setBusy(false);
    }
  }

  async function stopAvailability() {
    setBusy(true);
    setMessage('');
    try {
      const token = await requireToken();
      await stopAvailabilityPresence(token);
      setAvailability(null);
      setMarket(null);
      setMessage('Availability stopped.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Availability could not be stopped.');
    } finally {
      setBusy(false);
    }
  }

  async function publishReturnJourney() {
    if (!fromPostcode.trim()) {
      Alert.alert('Starting postcode required', 'Enter the postcode where your return journey starts.');
      return;
    }

    setBusy(true);
    setMessage('');
    try {
      const token = await requireToken();
      const availableFrom = new Date();
      const availableTo = new Date(availableFrom.getTime() + returnHours * 60 * 60 * 1000);
      const journey: ReturnJourney = {
        from_postcode: fromPostcode.trim().toUpperCase(),
        to_postcode: toPostcode.trim().toUpperCase() || null,
        available_from: availableFrom.toISOString(),
        available_to: availableTo.toISOString(),
        vehicle_type: vehicleType.trim() || null,
        notes: notes.trim() || null,
      };
      const result = await saveReturnJourney(token, journey);
      const saved = result.journey;
      setFromPostcode(saved?.from_postcode ?? '');
      setToPostcode(saved?.to_postcode ?? '');
      setVehicleType(saved?.vehicle_type ?? '');
      setNotes(saved?.notes ?? '');
      setMessage('Return journey published.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Return journey could not be published.');
    } finally {
      setBusy(false);
    }
  }

  async function clearReturnJourney() {
    setBusy(true);
    setMessage('');
    try {
      const token = await requireToken();
      await saveReturnJourney(token, {
        from_postcode: null,
        to_postcode: null,
        available_from: null,
        available_to: null,
        vehicle_type: null,
        notes: null,
      });
      setFromPostcode('');
      setToPostcode('');
      setVehicleType('');
      setNotes('');
      setMessage('Return journey cleared.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Return journey could not be cleared.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.heading}>Driver availability</Text>
        <Text style={styles.copy}>Publish where you are available for suitable XDrive work.</Text>
        <View style={styles.chips}>
          {visibilityOptions.map(([value, label]) => (
            <TouchableOpacity key={value} style={[styles.chip, visibility === value && styles.chipActive]} onPress={() => setVisibility(value)} disabled={busy}>
              <Text style={[styles.chipText, visibility === value && styles.chipTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.chips}>
          {hourOptions.map((hours) => (
            <TouchableOpacity key={hours} style={[styles.chip, availabilityHours === hours && styles.chipActive]} onPress={() => setAvailabilityHours(hours)} disabled={busy}>
              <Text style={[styles.chipText, availabilityHours === hours && styles.chipTextActive]}>{hours}h</Text>
            </TouchableOpacity>
          ))}
        </View>
        {availability ? <Text style={styles.active}>Active until {new Date(availability.available_until).toLocaleString('en-GB')}</Text> : null}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.primary} onPress={() => void publishAvailability()} disabled={busy}><Text style={styles.primaryText}>{busy ? 'PLEASE WAIT' : 'PUBLISH AVAILABILITY'}</Text></TouchableOpacity>
          {availability ? <TouchableOpacity style={styles.secondary} onPress={() => void stopAvailability()} disabled={busy}><Text style={styles.secondaryText}>STOP</Text></TouchableOpacity> : null}
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.marketHeader}>
          <View style={styles.marketTitleWrap}>
            <Text style={styles.heading}>Market intelligence</Text>
            <Text style={styles.copy}>Privacy-safe competition and £/mile benchmarks. No exact competitor locations are exposed.</Text>
          </View>
          <TouchableOpacity style={styles.refreshButton} onPress={() => void loadMarket(marketRadius)} disabled={marketBusy}>
            <Text style={styles.refreshText}>{marketBusy ? '...' : 'REFRESH'}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.chips}>
          {marketRadiusOptions.map((radius) => (
            <TouchableOpacity
              key={radius}
              style={[styles.chip, marketRadius === radius && styles.chipActive]}
              onPress={() => {
                setMarketRadius(radius);
                void loadMarket(radius);
              }}
              disabled={marketBusy}
            >
              <Text style={[styles.chipText, marketRadius === radius && styles.chipTextActive]}>{radius} mi</Text>
            </TouchableOpacity>
          ))}
        </View>
        {market?.whoIsNearby.active ? (
          <>
            <View style={styles.marketMetricRow}>
              <Text style={styles.marketMetricLabel}>Competition</Text>
              <Text style={styles.marketMetricValue}>{market.whoIsNearby.competition.toUpperCase()}</Text>
            </View>
            <Text style={styles.privacyText}>
              {market.whoIsNearby.clusters.length > 0
                ? `${market.whoIsNearby.clusters.length} privacy-safe competitor cluster${market.whoIsNearby.clusters.length === 1 ? '' : 's'} detected within ${market.radiusMiles} mi.`
                : `No competitor cluster meets the minimum privacy threshold within ${market.radiusMiles} mi.`}
            </Text>
          </>
        ) : (
          <Text style={styles.privacyText}>{market?.whoIsNearby.reason || 'Publish availability to enable nearby market intelligence.'}</Text>
        )}
        {market?.ppm.visible && market.ppm.median != null ? (
          <View style={styles.rateBox}>
            <Text style={styles.rateTitle}>7-day market benchmark</Text>
            <Text style={styles.rateMain}>Median {moneyPerMile(market.ppm.median)}</Text>
            {market.ppm.low != null && market.ppm.high != null ? (
              <Text style={styles.rateRange}>Typical range {moneyPerMile(market.ppm.low)} – {moneyPerMile(market.ppm.high)}</Text>
            ) : null}
            {market.ppm.vehicleType ? <Text style={styles.rateMeta}>Vehicle: {market.ppm.vehicleType.replace(/_/g, ' ')}</Text> : null}
          </View>
        ) : (
          <Text style={styles.privacyText}>
            Rate benchmark stays hidden until at least {market?.ppm.privacyMinimum ?? 5} anonymous completed-job samples are available.
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Return journey</Text>
        <Text style={styles.copy}>Publish a return route so suitable XDrive loads can be matched to your direction.</Text>
        <TextInput value={fromPostcode} onChangeText={setFromPostcode} autoCapitalize="characters" placeholder="From postcode *" placeholderTextColor="#6b7280" style={styles.input} editable={!busy} />
        <TextInput value={toPostcode} onChangeText={setToPostcode} autoCapitalize="characters" placeholder="Destination postcode (optional)" placeholderTextColor="#6b7280" style={styles.input} editable={!busy} />
        <TextInput value={vehicleType} onChangeText={setVehicleType} placeholder="Vehicle type (optional)" placeholderTextColor="#6b7280" style={styles.input} editable={!busy} />
        <TextInput value={notes} onChangeText={setNotes} placeholder="Notes (optional)" placeholderTextColor="#6b7280" style={[styles.input, styles.notes]} multiline editable={!busy} />
        <View style={styles.chips}>
          {hourOptions.map((hours) => (
            <TouchableOpacity key={hours} style={[styles.chip, returnHours === hours && styles.chipActive]} onPress={() => setReturnHours(hours)} disabled={busy}>
              <Text style={[styles.chipText, returnHours === hours && styles.chipTextActive]}>{hours}h window</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.primary} onPress={() => void publishReturnJourney()} disabled={busy}><Text style={styles.primaryText}>PUBLISH RETURN</Text></TouchableOpacity>
          <TouchableOpacity style={styles.secondary} onPress={() => void clearReturnJourney()} disabled={busy}><Text style={styles.secondaryText}>CLEAR</Text></TouchableOpacity>
        </View>
      </View>

      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  card: { backgroundColor: '#0d1a24', borderColor: '#1f2937', borderWidth: 1, borderRadius: 14, padding: 12, gap: 10 },
  heading: { color: '#f8fafc', fontSize: 16, fontWeight: '900' },
  copy: { color: '#9ca3af', fontSize: 13, lineHeight: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 38, borderRadius: 10, borderColor: '#374151', borderWidth: 1, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111827' },
  chipActive: { backgroundColor: '#ffc107', borderColor: '#ffc107' },
  chipText: { color: '#cbd5e1', fontWeight: '800', fontSize: 12 },
  chipTextActive: { color: '#111827' },
  active: { color: '#4ade80', fontWeight: '800', fontSize: 12 },
  input: { minHeight: 46, color: '#f8fafc', backgroundColor: '#111827', borderColor: '#1f2937', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12 },
  notes: { minHeight: 72, paddingTop: 12, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: 8 },
  primary: { flex: 2, minHeight: 44, backgroundColor: '#ffc107', borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  primaryText: { color: '#111827', fontWeight: '900', fontSize: 12 },
  secondary: { flex: 1, minHeight: 44, borderColor: '#374151', borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  secondaryText: { color: '#f8fafc', fontWeight: '900', fontSize: 12 },
  marketHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  marketTitleWrap: { flex: 1, gap: 4 },
  refreshButton: { minHeight: 36, borderColor: '#374151', borderWidth: 1, borderRadius: 9, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  refreshText: { color: '#fbbf24', fontWeight: '900', fontSize: 11 },
  marketMetricRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#111827', borderRadius: 10, padding: 10 },
  marketMetricLabel: { color: '#9ca3af', fontWeight: '700', fontSize: 12 },
  marketMetricValue: { color: '#fbbf24', fontWeight: '900', fontSize: 13 },
  privacyText: { color: '#9ca3af', fontSize: 12, lineHeight: 17 },
  rateBox: { backgroundColor: '#111827', borderColor: '#1f2937', borderWidth: 1, borderRadius: 10, padding: 10, gap: 4 },
  rateTitle: { color: '#9ca3af', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  rateMain: { color: '#4ade80', fontSize: 17, fontWeight: '900' },
  rateRange: { color: '#e5e7eb', fontSize: 12, fontWeight: '700' },
  rateMeta: { color: '#9ca3af', fontSize: 11 },
  message: { color: '#fbbf24', fontWeight: '700', fontSize: 12 },
});