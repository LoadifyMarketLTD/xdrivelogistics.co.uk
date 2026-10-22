'use client';
import { useEffect } from 'react';

/**
 * Dedicated scope keeps the PWA independent of the operational web workspace.
 * No sensitive GET or POST responses are cached by this worker.
 */
export default function DriverPwaRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
    void navigator.serviceWorker.register('/driver-pwa-sw.js', {
      scope: '/m/driver/',
      updateViaCache: 'none',
    }).catch(() => undefined);
  }, []);
  return null;
}
