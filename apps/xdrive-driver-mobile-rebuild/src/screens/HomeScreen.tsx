import { ThemeIonicons as Ionicons } from '../theme/primitives';
import { useEffect, useState } from 'react';
import { supabase } from '../auth/supabase';
import { Image, Modal, StyleSheet } from 'react-native';
import { Pressable, RefreshControl, SafeAreaView, ScrollView, Text, View } from '../theme/primitives';
import type { DriverJob, DriverResources } from '../types/driver';

const palette = { navy: '#0B2F6B', tile: '#20447B', accent: '#F5A300', paper: '#F1F3F6', ink: '#242737', muted: '#5F6878' };
// React Native requires a static require for bundled image assets.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const homeLogo = require('../../assets/xdrive-home-logo.png');
function field(row: Record<string, unknown> | null | undefined, keys: string[], fallback: string) {
  for (const key of keys) if (row?.[key] !== null && row?.[key] !== undefined && String(row[key]).trim()) return String(row[key]);
  return fallback;
}
function trackingState(resources?: DriverResources) {
  const raw = field(resources?.driver, ['tracking_enabled', 'mobile_tracking', 'is_tracking'], field(resources?.vehicle, ['tracking_enabled', 'mobile_tracking', 'is_tracking'], '')).toLowerCase();
  return ['true', '1', 'on', 'active', 'enabled'].includes(raw) ? 'On' : ['false', '0', 'off', 'inactive', 'disabled'].includes(raw) ? 'Off' : 'Not set';
}
type Props = {
  jobs: DriverJob[]; activeJob?: DriverJob; recentJob?: DriverJob; resources?: DriverResources;
  loading: boolean; dataError?: string; onRefresh: () => Promise<void> | void; onOpen: (job: DriverJob) => void;
  onGoLoads: () => void; onGoQuotes: () => void; onGoHistory: () => void; onGoMore: () => void; onAvailabilitySaved: (value: string) => void;
};
export function HomeScreen({ jobs, activeJob, recentJob, resources, loading, dataError, onRefresh, onOpen, onGoLoads, onGoQuotes, onGoHistory, onAvailabilitySaved }: Props) {
  const [panel, setPanel] = useState<'profile' | 'tools' | 'vehicle' | 'tracking' | 'status' | null>(null);
  const [panelParent, setPanelParent] = useState<'tools' | null>(null);
  const [availability, setAvailability] = useState('');
  const [draftAvailability, setDraftAvailability] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');
  const [trackingCheckedAt, setTrackingCheckedAt] = useState('');
  useEffect(() => { setAvailability(field(resources?.driver, ['availability_status'], '')); }, [resources?.driver]);
  function openStatus(parent: 'tools' | null = null) { setDraftAvailability(availability); setSaveError(''); setSavedMessage(''); setPanelParent(parent); setPanel('status'); }
  function openNested(next: 'vehicle' | 'tracking') { setPanelParent('tools'); setPanel(next); }
  function closePanel() {
    if (saving) return;
    if (panelParent) { setPanel(panelParent); setPanelParent(null); return; }
    setPanel(null);
  }
  function navigate(action: () => void) { setPanelParent(null); setPanel(null); action(); }
  async function refreshTracking() {
    await onRefresh();
    setTrackingCheckedAt(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
  }
  async function saveAvailability() {
    const driverId = field(resources?.driver, ['id'], '');
    if (!driverId || saving || !AVAILABILITY.some(item => item.value === draftAvailability)) return;
    setSaving(true); setSaveError(''); setSavedMessage('');
    try {
      const result = await supabase.from('drivers').update({ availability_status: draftAvailability }).eq('id', driverId).select('id, availability_status').single();
      if (result.error) throw result.error;
      if (result.data?.availability_status !== draftAvailability) throw new Error('The server did not confirm your availability.');
      setAvailability(result.data.availability_status);
      onAvailabilitySaved(result.data.availability_status);
      setSavedMessage('Availability saved.');
    } catch { setSaveError('Availability could not be saved. Your previous status is unchanged. Please try again.'); }
    finally { setSaving(false); }
  }
  const resourcesLoading = loading && !resources;
  const name = resources?.name || field(resources?.driver, ['display_name', 'name'], resourcesLoading ? 'Loading...' : 'Driver');
  const vehicle = resourcesLoading ? 'Loading...' : field(resources?.vehicle, ['vehicle_type', 'type'], 'Vehicle not assigned');
  const registration = resourcesLoading ? '' : field(resources?.vehicle, ['reg_plate', 'registration', 'registration_number'], '');
  const tracking = resourcesLoading ? 'Loading' : trackingState(resources);
  const recentJobSummaryTitle = !recentJob && loading ? 'Last closed' : recentJob?.status === 'cancelled' ? 'Last cancelled' : 'Last completed';
  const date = new Date().toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric' });
  const status = resourcesLoading ? 'Loading...' : (AVAILABILITY.find(item => item.value === availability)?.label ?? 'Set availability');
  const statusColor = availability === 'available' ? '#7BD268' : availability === 'busy' ? '#FFD180' : availability === 'offline' ? '#F7B5AF' : '#D0DBEE';
  const trackingColor = tracking === 'On' ? '#7BD268' : tracking === 'Off' ? '#F7B5AF' : '#D0DBEE';
  const panelTitle = { profile: 'My Profile', tools: 'Driver Tools', vehicle: 'My Vehicle', tracking: 'Tracking', status: 'Availability Status' };
  return <ScrollView style={s.page} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={palette.accent} colors={[palette.navy]} />}>
    <View style={s.hero}>
      <View style={s.topRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Open my profile" onPress={() => { setPanelParent(null); setPanel('profile'); }} style={({ pressed }) => [s.roundButton, s.profile, pressed && s.pressed]}>
          <Ionicons name="person" size={24} color={palette.navy} />
        </Pressable>
        <View accessible accessibilityLabel="XDrive Logistics" style={s.brand}><Image source={homeLogo} style={s.brandLogo} resizeMode="contain" /></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Open driver tools" onPress={() => { setPanelParent(null); setPanel('tools'); }} style={({ pressed }) => [s.roundButton, s.tools, pressed && s.pressed]}>
          <Ionicons name="grid-outline" size={23} color="#FFFFFF" />
        </Pressable>
      </View>
      <Text style={s.date}>{date}</Text>
      <View style={s.facts}>
        <Pressable accessibilityRole="button" accessibilityLabel="View assigned vehicle" onPress={() => { setPanelParent(null); setPanel('vehicle'); }} style={({ pressed }) => [s.vehicleTile, pressed && s.pressed]}>
          <Text style={s.vehicleHeading}>Vehicle <Text style={s.driverName}>{name.toUpperCase()}</Text></Text>
          <Text style={s.vehicleType}>{vehicle}</Text>
          {registration ? <Text style={s.registration}>{registration}</Text> : null}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={'Tracking details: ' + tracking} onPress={() => { setPanelParent(null); setPanel('tracking'); }} style={({ pressed }) => [s.trackingTile, pressed && s.pressed]}>
          <Text style={s.factHeading}>Tracking</Text>
          <Ionicons name={tracking === 'On' ? 'radio' : 'radio-outline'} size={30} color={trackingColor} />
          <Text style={[s.trackingValue, { color: trackingColor }]}>{tracking}</Text>
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Update availability status" onPress={() => openStatus(null)} style={({ pressed }) => [s.status, pressed && s.pressed]}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: statusColor }} /><Text style={s.statusLabel}>Status</Text><Text style={s.statusValue}>{status}</Text><Ionicons name="chevron-forward" size={24} color={palette.accent} />
      </Pressable>
    </View>
    <View style={s.quickRow}>
      <Shortcut label="Search" onPress={onGoLoads} />
      <Shortcut label="Quotes" onPress={onGoQuotes} />
      <Shortcut label="History" onPress={onGoHistory} />
    </View>
    <View style={s.mainCard}>
      <Text style={s.cardTitle}>{activeJob ? 'Your current delivery' : 'XDrive Driver'}</Text>
      <Text style={s.intro}>{activeJob ? 'Your next stop, all in one place.' : 'Your working day, all in one place.'}</Text>
      {activeJob ? <View style={s.route}>
        <Text style={s.routeLabel}>COLLECTION</Text><Text style={s.routePlace}>{activeJob.pickupLocation}</Text>
        <View style={s.routeDivider} />
        <Text style={s.routeLabel}>DELIVERY</Text><Text style={s.routePlace}>{activeJob.deliveryLocation}</Text>
        <Text style={s.reference}>{activeJob.reference}</Text>
      </View> : <View style={s.summary}>
        <Summary icon="search-outline" title="Available loads" value={loading && !jobs.length ? '...' : dataError && !jobs.length ? '?' : String(jobs.length)} onPress={onGoLoads} />
        <Summary icon="pricetag-outline" title="Your quotes" value={resources ? String(resources.quotes?.length ?? 0) : '?'} onPress={onGoQuotes} />
        <Summary icon="checkmark-circle-outline" title={recentJobSummaryTitle} value={recentJob ? recentJob.reference : loading ? '...' : dataError ? '?' : 'None yet'} onPress={recentJob ? () => onOpen(recentJob) : onGoHistory} />
      </View>}
      {activeJob ? <Text style={s.helper}>Open your delivery to see the full details and next steps.</Text> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={activeJob ? 'Continue Delivery' : 'Find Loads'} onPress={activeJob ? () => onOpen(activeJob) : onGoLoads} style={({ pressed }) => [s.primaryButton, pressed && s.pressed]}>
        <Text style={s.primaryText}>{activeJob ? 'Continue Delivery' : 'Find Loads'}</Text><Ionicons name="arrow-forward" size={22} color={palette.ink} />
      </Pressable>
    </View>
    <Modal visible={panel !== null} animationType="slide" onRequestClose={closePanel}>
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.paper }}>
        <View style={s.panelHeader}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to Home" disabled={saving} onPress={closePanel} style={s.panelBack}>
            <Ionicons name="arrow-back" size={26} color="#FFFFFF" />
          </Pressable>
          <Text accessibilityRole="header" style={s.panelTitle}>{panel ? panelTitle[panel] : ''}</Text>
        </View>
        <ScrollView contentContainerStyle={s.panelContent}>
          {panel === 'profile' ? <>
            <View style={[s.panelCard, { alignItems: 'center' }]}>
              <View style={[s.roundButton, s.profile]}><Ionicons name="person" size={26} color={palette.navy} /></View>
              <Text style={[s.cardTitle, { marginTop: 12 }]}>{name}</Text>
            </View>
            <View style={s.panelCard}>
              <ProfileField label="Email" value={resources?.email || 'Not set'} />
              <ProfileField label="Phone" value={resources?.phone || field(resources?.driver, ['phone', 'phone_number', 'mobile'], 'Not set')} />
              <ProfileField label="Role" value={resources?.role || 'Driver'} />
              <ProfileField label="Company" value={field(resources?.company, ['name'], 'Not set')} />
            </View>
          </> : null}
          {panel === 'vehicle' ? <View style={s.panelCard}>
            <Ionicons name="car-outline" size={36} color={palette.navy} />
            <ProfileField label="Vehicle type" value={vehicle} />
            <ProfileField label="Registration" value={registration || 'Not assigned'} />
            <ProfileField label="Assigned driver" value={name} />
            <ProfileField label="Make / model" value={[field(resources?.vehicle, ['make'], ''), field(resources?.vehicle, ['model'], '')].filter(Boolean).join(' ') || 'Not set'} />
            <Text style={s.panelText}>Vehicle assignments are managed by your dispatcher.</Text>
          </View> : null}
          {panel === 'tracking' ? <View style={s.panelCard}>
            <Ionicons name="radio-outline" size={40} color={tracking === 'On' ? '#237A41' : palette.muted} />
            <ProfileField label="Reported tracking status" value={tracking === 'Not set' ? 'Unknown' : tracking} />
            <Text style={s.panelText}>{tracking === 'On' ? 'Your account reports tracking enabled. This does not confirm a recent GPS position.' : tracking === 'Off' ? 'Your account reports tracking disabled.' : 'No tracking status has been returned for your driver or vehicle.'}</Text>
            {dataError ? <Text accessibilityRole="alert" style={{ color: '#B42318' }}>Some data could not be refreshed. Please try again.</Text> : null}
            <Text style={s.panelText}>Tracking controls are not available in this preview. Contact your dispatcher to check the setup.</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Refresh tracking status" disabled={loading} onPress={() => void refreshTracking()} style={[s.primaryButton, loading && s.pressed]}><Text style={s.primaryText}>{loading ? 'Refreshing...' : 'Refresh Status'}</Text></Pressable>{trackingCheckedAt ? <Text style={s.panelText}>Last checked {trackingCheckedAt}</Text> : null}
          </View> : null}
          {panel === 'status' ? <View style={s.panelCard}>
            <Text style={s.panelText}>Choose whether you are available for new work. This does not change a delivery's progress.</Text>
            {AVAILABILITY.map(item => <Pressable key={item.value} accessibilityRole="radio" accessibilityLabel={item.label} accessibilityState={{ checked: draftAvailability === item.value, disabled: saving }} disabled={saving} onPress={() => { setDraftAvailability(item.value); setSavedMessage(''); }} style={[s.option, { borderColor: draftAvailability === item.value ? item.color : '#D8DFEA' }]}>
              <Ionicons name={draftAvailability === item.value ? 'radio-button-on' : 'radio-button-off'} size={24} color={item.color} />
              <View style={{ flex: 1 }}><Text style={s.optionTitle}>{item.label}</Text><Text style={s.panelText}>{item.description}</Text></View>
            </Pressable>)}
            {saveError ? <Text accessibilityRole="alert" style={{ color: '#B42318' }}>{saveError}</Text> : null}
            {savedMessage ? <Text accessibilityLiveRegion="polite" style={{ color: '#237A41' }}>{savedMessage}</Text> : null}
            {!resources?.driver?.id ? <Text style={s.panelText}>Load your driver profile before changing availability.</Text> : null}
            <Pressable accessibilityRole="button" accessibilityLabel="Save availability" disabled={saving || !draftAvailability || draftAvailability === availability || !resources?.driver?.id} onPress={saveAvailability} style={[s.primaryButton, (saving || !draftAvailability || draftAvailability === availability || !resources?.driver?.id) && s.disabled]}><Text style={s.primaryText}>{saving ? 'Saving...' : 'Save Availability'}</Text></Pressable>
          </View> : null}
          {panel === 'tools' ? <View style={s.panelCard}>
            <ToolRow icon="search-outline" label="Search loads" detail="Find your next job" onPress={() => navigate(onGoLoads)} />
            <ToolRow icon="pricetag-outline" label="My quotes" detail="View submitted quotes" onPress={() => navigate(onGoQuotes)} />
            <ToolRow icon="time-outline" label="Delivery history" detail="View completed jobs" onPress={() => navigate(onGoHistory)} />
            <ToolRow icon="car-outline" label="My vehicle" detail="View your assigned vehicle" onPress={() => openNested('vehicle')} />
            <ToolRow icon="radio-outline" label="Tracking" detail="Check reported tracking status" onPress={() => openNested('tracking')} />
            <ToolRow icon="checkmark-circle-outline" label="Availability" detail="Set your working status" onPress={() => openStatus('tools')} />
          </View> : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  </ScrollView>;
}
function ProfileField({ label, value }: { label: string; value: string }) {
  return <View style={{ gap: 5 }}><Text style={{ fontSize: 12, fontWeight: '600', color: palette.muted }}>{label}</Text><Text selectable style={{ fontSize: 16, color: palette.ink }}>{value}</Text></View>;
}
function Shortcut({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.shortcut, pressed && s.pressed]}><Text style={s.shortcutText}>{label}</Text></Pressable>;
}
function Summary({ icon, title, value, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; value: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title + ": " + value} onPress={onPress} style={({ pressed }) => [s.summaryRow, pressed && s.pressed]}>
    <Ionicons name={icon} size={23} color={palette.navy} /><Text style={s.summaryTitle}>{title}</Text><Text style={s.summaryValue} numberOfLines={1}>{value}</Text>
  </Pressable>;
}
const AVAILABILITY = [
  { value: 'available', label: 'Available', description: 'Ready for new work', color: '#237A41' },
  { value: 'busy', label: 'On a Job', description: 'Currently working on a delivery', color: '#A65B00' },
  { value: 'offline', label: 'Offline', description: 'Not available for new work', color: '#B42318' },
] as const;
function ToolRow({ icon, label, detail, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; detail: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [s.toolRow, pressed && s.pressed]}>
    <Ionicons name={icon} size={24} color={palette.navy} /><View style={{ flex: 1 }}><Text style={s.optionTitle}>{label}</Text><Text style={s.panelText}>{detail}</Text></View><Ionicons name="chevron-forward" size={22} color={palette.navy} />
  </Pressable>;
}
const s = StyleSheet.create({
  panelHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: palette.navy },
  panelBack: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  panelTitle: { flex: 1, fontSize: 22, fontWeight: '700', color: '#FFFFFF' },
  panelContent: { padding: 18, gap: 16 },
  panelCard: { padding: 18, borderRadius: 18, backgroundColor: '#FFFFFF', gap: 18 },
  panelText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: '#536174', lineHeight: 21 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 2, borderRadius: 12, minHeight: 66 },
  optionTitle: { fontSize: 16, fontWeight: '700', color: palette.ink },
  toolRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64 },
  disabled: { backgroundColor: '#D7DCE3', opacity: 0.65 },
  page: { flex: 1, backgroundColor: palette.paper },
  content: { paddingBottom: 24 },
  hero: { backgroundColor: palette.navy, paddingHorizontal: 18, paddingTop: 6, paddingBottom: 16, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 },
  roundButton: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  profile: { backgroundColor: palette.accent }, tools: { backgroundColor: palette.tile },
  brand: { alignItems: 'center', justifyContent: 'center' }, brandLogo: { width: 110, height: 37 }, wordmark: { color: '#FFFFFF', fontFamily: 'Inter_700Bold', fontWeight: '700', fontSize: 30, letterSpacing: -1.3 },
  wordmarkAccent: { color: palette.accent }, brandSub: { color: '#D0DBEE', fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 8, letterSpacing: 3.6, marginTop: 1 },
  date: { textAlign: 'center', color: '#C3CEE1', fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 15, marginTop: 10, marginBottom: 12 },
  facts: { flexDirection: 'row', gap: 12 },
  vehicleTile: { flex: 2, minHeight: 76, borderRadius: 16, backgroundColor: palette.tile, padding: 12, alignItems: 'center', justifyContent: 'center' },
  vehicleHeading: { color: '#FFFFFF', fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  driverName: { fontFamily: 'Inter_700Bold', fontWeight: '700' },
  vehicleType: { color: '#C3CEE1', fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 15, marginTop: 8, textAlign: 'center', textTransform: 'capitalize' },
  registration: { color: '#C3CEE1', fontFamily: 'Inter_500Medium', fontSize: 12, marginTop: 3 },
  trackingTile: { flex: 1, backgroundColor: palette.tile, borderRadius: 16, padding: 10, alignItems: 'center', justifyContent: 'center', gap: 4 },
  factHeading: { color: '#FFFFFF', fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 15 },
  trackingValue: { color: '#D0DBEE', fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 11 },
  status: { marginTop: 12, borderRadius: 16, backgroundColor: palette.tile, paddingHorizontal: 12, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54 },
  statusLabel: { color: '#FFFFFF', fontFamily: 'Inter_700Bold', fontWeight: '700', fontSize: 15 },
  statusValue: { flex: 1, color: '#FFFFFF', fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 15, textTransform: 'capitalize' },
  quickRow: { flexDirection: 'row', gap: 10, marginHorizontal: 24, marginTop: 14, marginBottom: 14 },
  shortcut: { flex: 1, minHeight: 44, borderRadius: 24, backgroundColor: '#DCDFE5', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  shortcutText: { fontFamily: 'Inter_700Bold', fontWeight: '700', fontSize: 15, color: palette.ink },
  mainCard: { backgroundColor: '#FFFFFF', borderRadius: 18, marginHorizontal: 18, padding: 16 },
  cardTitle: { fontFamily: 'Inter_700Bold', fontWeight: '700', fontSize: 22, color: palette.ink, textAlign: 'center', marginTop: 4 },
  intro: { fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 14, lineHeight: 20, color: '#4B5565', textAlign: 'center', marginTop: 12 },
  summary: { marginVertical: 8 }, summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, minHeight: 40 },
  summaryTitle: { flex: 1, fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 14, color: '#4B5565' },
  summaryValue: { maxWidth: 105, fontFamily: 'Inter_700Bold', fontWeight: '700', fontSize: 15, color: palette.ink },
  helper: { fontFamily: 'Inter_500Medium', fontWeight: '500', fontSize: 14, color: palette.muted, textAlign: 'center', lineHeight: 22, marginBottom: 12 },
  primaryButton: { backgroundColor: palette.accent, borderRadius: 28, minHeight: 52, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: 'Inter_700Bold', fontWeight: '700', fontSize: 18, color: palette.ink },
  route: { marginVertical: 20, backgroundColor: palette.paper, borderRadius: 12, padding: 16 },
  routeLabel: { fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 10, letterSpacing: 1, color: palette.muted },
  routePlace: { fontFamily: 'Inter_700Bold', fontWeight: '700', fontSize: 16, lineHeight: 23, color: palette.ink, marginTop: 4 },
  routeDivider: { height: 1, backgroundColor: '#DCDFE5', marginVertical: 12 },
  reference: { fontFamily: 'Inter_500Medium', fontSize: 12, color: palette.muted, marginTop: 12 },
  pressed: { opacity: 0.7 },
});
