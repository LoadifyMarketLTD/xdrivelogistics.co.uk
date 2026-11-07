import { useEffect, useState } from 'react'

type Preferences = {
  radiusMiles: number
  available: boolean
  notifications: boolean
  returnLoads: boolean
  navigation: 'Google Maps' | 'Waze' | 'Apple Maps' | 'Device default'
}
const storageKey = 'xdrive-driver-preferences-v1'
function loadPreferences(): Preferences {
  const defaults: Preferences = { radiusMiles: 30, available: false, notifications: false, returnLoads: false, navigation: 'Device default' }
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey) || 'null')
    if (!parsed || typeof parsed !== 'object') return defaults
    const p = parsed as Partial<Preferences>
    return {
      radiusMiles: typeof p.radiusMiles === 'number' && Number.isFinite(p.radiusMiles) && p.radiusMiles >= 1 && p.radiusMiles <= 30 ? p.radiusMiles : 30,
      available: p.available === true,
      notifications: p.notifications === true,
      returnLoads: p.returnLoads === true,
      navigation: p.navigation === 'Google Maps' || p.navigation === 'Waze' || p.navigation === 'Apple Maps' ? p.navigation : 'Device default',
    }
  } catch { return defaults }
}
export default function DriverSettings({ role }: { role: 'Owner Driver' | 'Company Driver' }) {
  const [prefs, setPrefs] = useState<Preferences>(loadPreferences)
  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(prefs)); window.dispatchEvent(new Event('xdrive-radius-change')) }, [prefs])
  const change = (patch: Partial<Preferences>) => setPrefs(current => ({ ...current, ...patch }))
  return <section className="settings" aria-label="Driver Settings">
    <h2>Settings</h2>
    <p>Device preferences for {role}.</p>
    <h3>Availability & job search</h3>
    <p>Use Driver Menu → Availability to change your LIVE availability status.</p>
    <label>Search radius (miles)
      <select value={prefs.radiusMiles} onChange={e => change({ radiusMiles: Number(e.target.value) })}>
        {[5, 10, 15, 20, 25, 30].map(radius => <option key={radius} value={radius}>{radius} miles</option>)}
      </select>
    </label>
    <label className="check"><input type="checkbox" checked={prefs.returnLoads} onChange={e => change({ returnLoads: e.target.checked })}/> Show jobs near delivery destination</label>
    <p>Also find collections within {prefs.radiusMiles} road miles of your active delivery destination.</p>
    <h3>Navigation</h3>
    <label>Preferred navigation application
      <select value={prefs.navigation} onChange={e => change({ navigation: e.target.value as Preferences['navigation'] })}>
        <option>Device default</option><option>Google Maps</option><option>Waze</option><option>Apple Maps</option>
      </select>
    </label>
    <h3>Notifications</h3>
    <p>Manage LIVE notification channels in Driver Menu → Load Alerts. Device notification permission is controlled by your browser settings.</p>
  </section>
}
