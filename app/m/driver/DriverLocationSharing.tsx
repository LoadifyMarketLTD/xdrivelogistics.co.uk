'use client';
import { useEffect, useRef, useState } from 'react';
import { readRouteAuthAccessToken } from '../../../lib/routeAuthCookie';

export default function DriverLocationSharing() {
 const [status, setStatus] = useState('Location sharing is off.');
 const [sharing, setSharing] = useState(false);
 const [permissionDenied, setPermissionDenied] = useState(false);
 const watch = useRef<number | null>(null);
 const lastSent = useRef(0);
 const busy = useRef(false);
 const sharingRef = useRef(false);
 const stopWatch = () => {
  sharingRef.current = false;
  if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
  watch.current = null;
  setSharing(false);
 };
 useEffect(() => {
  return () => {
   if (watch.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(watch.current);
  };
 }, []);
 const send = async (position: GeolocationPosition) => {
  if (!sharingRef.current || busy.current || Date.now() - lastSent.current < 20000) return;
  const token = readRouteAuthAccessToken();
  if (!token) { stopWatch(); setStatus('Session expired. Sign in again.'); return; }
  busy.current = true;
  try {
   const response = await fetch('/api/driver/availability-presence', {
    method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat: position.coords.latitude, lng: position.coords.longitude, visibility: 'exchange', hours: 4 }),
   });
   if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    stopWatch();
    setStatus(typeof payload.error === 'string' ? payload.error : 'XDrive could not save your GPS location.');
    return;
   }
   lastSent.current = Date.now();
   setStatus('GPS shared with XDrive Live Availability. Updated ' + new Date().toLocaleTimeString() + '.');
  } catch { setStatus('GPS available, but the server could not be reached. Retrying while this page is open.'); }
  finally { busy.current = false; }
 };
 const start = () => {
  if (!navigator.geolocation || !window.isSecureContext) { setStatus('GPS requires a secure browser with location enabled.'); return; }
  setPermissionDenied(false);
  sharingRef.current = true;
  setSharing(true);
  setStatus('Requesting location permission...');
  watch.current = navigator.geolocation.watchPosition(position => { void send(position); }, error => {
   stopWatch();
   setPermissionDenied(error.code === 1);
   setStatus(error.code === 1 ? 'Location blocked by browser or site settings. Allow Location for www.xdrivelogistics.co.uk, then retry this button.' : 'GPS unavailable. Check phone location services.');
  }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 });
 };
 const stop = async () => {
  stopWatch();
  const token = readRouteAuthAccessToken();
  if (token) {
   try { await fetch('/api/driver/availability-presence', { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } }); }
   catch { setStatus('Tracking stopped on this page; server availability could not be cleared.'); return; }
  }
  setStatus('Location sharing stopped.');
 };
 return <section className="xd-mobile-card" aria-label="Live GPS availability">
  <h2>Live GPS availability</h2>
  <p>Share your current position with XDrive to be discoverable for nearby jobs. Requires Available status. Sharing runs while this page remains open; mobile browsers may suspend GPS in the background.</p>
  <p role="status">{status}</p>
  {permissionDenied ? <p>Open the browser that installed XDrive PWA, go to Site settings → Location → www.xdrivelogistics.co.uk → Allow. Also check Android Settings → Apps → your browser → Permissions → Location. Return here and press the same GPS button again. A website cannot open or change these protected settings automatically.</p> : null}
  {sharing ? <button type="button" onClick={() => void stop()}>Stop sharing GPS</button> :
   <button type="button" onClick={start}>{permissionDenied ? 'Retry GPS after allowing location' : 'Share my GPS for nearby jobs'}</button>}
 </section>;
}
