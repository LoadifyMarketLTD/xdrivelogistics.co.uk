import { useEffect, useMemo, useState } from 'react'

type Position = { lat: number; lon: number }
type Candidate = { id: string; from: string; pickupAddress?: string; status: string; quote?: number }
type Result = { miles: Record<string, number>; state: 'locating' | 'calculating' | 'ready' | 'error'; message: string }
const geocoded = new Map<string, Position | null>()
const routes = new Map<string, number | null>()
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
async function geocode(address: string): Promise<Position | null> {
  if (geocoded.has(address)) return geocoded.get(address)!
  const response = await fetch('https://nominatim.openstreetmap.org/search?format=json&countrycodes=gb&limit=1&q=' + encodeURIComponent(address + ', United Kingdom'))
  if (!response.ok) throw Error('Pickup location lookup unavailable')
  const data: { lat: string; lon: string }[] = await response.json()
  const point = data.length ? { lat: Number(data[0].lat), lon: Number(data[0].lon) } : null
  geocoded.set(address, point)
  return point
}
export function useRoadRadius(jobs: Candidate[], radius: number, destination?: string): Result {
  const [position, setPosition] = useState<Position | null>(null)
  const [gpsError, setGpsError] = useState('')
  const [result, setResult] = useState<Result>({ miles: {}, state: 'locating', message: 'Waiting for driver GPS location...' })
  const pickups = useMemo(() => jobs.filter(j => j.status === 'OPEN' && j.quote === undefined).map(j => ({ id: j.id, address: j.pickupAddress && !j.pickupAddress.includes('(TEST ADDRESS)') ? j.pickupAddress : j.from })), [jobs])
  useEffect(() => {
    if (!navigator.geolocation) { setGpsError('GPS is not supported on this device.'); return }
    const watch = navigator.geolocation.watchPosition(
      p => { setPosition({ lat: Math.round(p.coords.latitude * 1000) / 1000, lon: Math.round(p.coords.longitude * 1000) / 1000 }); setGpsError('') },
      e => { setPosition(null); setGpsError(e.code === 1 ? 'Allow location access to show nearby jobs.' : 'GPS unavailable. Nearby jobs cannot be verified.') },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 15000 }
    )
    return () => navigator.geolocation.clearWatch(watch)
  }, [])
  useEffect(() => {
    if (!position && !destination) { setResult({ miles: {}, state: gpsError ? 'error' : 'locating', message: gpsError || 'Waiting for driver GPS location...' }); return }
    let active = true
    setResult({ miles: {}, state: 'calculating', message: 'Calculating road distance to collection points...' })
    async function calculate() {
      const miles: Record<string, number> = {}
      let failures = 0
      let destinationPoint: Position | null = null
      if (destination) { try { destinationPoint = await geocode(destination) } catch { failures++ } }
      if (destination && !destinationPoint) failures++
      for (const job of pickups) {
        if (!active) return
        try {
          const point = await geocode(job.address)
          if (!point) { failures++; continue }
          const origins = [position, destinationPoint].filter((p): p is Position => p !== null)
          for (const origin of origins) {
          const key = [origin.lon, origin.lat, point.lon, point.lat].join(',')
          let distance = routes.get(key)
          if (distance === undefined) {
            const url = 'https://router.project-osrm.org/route/v1/driving/' + origin.lon + ',' + origin.lat + ';' + point.lon + ',' + point.lat + '?overview=false'
            const response = await fetch(url)
            if (!response.ok) throw Error('Routing unavailable')
            const data: { routes?: { distance: number }[] } = await response.json()
            distance = data.routes?.[0]?.distance !== undefined ? data.routes[0].distance / 1609.344 : null
            routes.set(key, distance)
          }
          if (distance !== null && distance <= radius) { miles[job.id] = Math.min(miles[job.id] ?? Infinity, distance) }
          else if (distance === null) failures++
          }
          if (active) setResult({ miles: { ...miles }, state: 'calculating', message: 'Calculating road distance to collection points...' })
          if (geocoded.size > 1) await pause(1000)
        } catch { failures++ }
      }
      if (active) setResult({ miles, state: failures ? 'error' : 'ready', message: failures ? 'Some collection routes could not be verified and are hidden.' : '' })
    }
    void calculate()
    return () => { active = false }
  }, [position?.lat, position?.lon, radius, pickups, destination])
  return result
}
