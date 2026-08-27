import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import {
  fetchAvailabilityPresence,
  fetchReturnJourney,
  saveReturnJourney,
  startAvailabilityPresence,
  stopAvailabilityPresence,
  type AvailabilityPresence,
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

export function DriverAvailabilityPanel() {
  const [availability, setAvailability] = useState<AvailabilityPresence | null>(null);
  const [visibility, setVisibility] = useState<Visibility>('exchange');
  const [availabilityHours, setAvailabilityHours] = useState(4);
  const [returnHours, setReturnHours] = useState(8);
  const [fromPostcode, setFromPostcode] = useState('');
  const [toPostcode, setToPostcode] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

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
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Availability could not be loaded.');
    }
  }, []);

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
  message: { color: '#fbbf24', fontWeight: '700', fontSize: 12 },
});
