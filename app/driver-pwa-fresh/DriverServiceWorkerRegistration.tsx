'use client';

import { useEffect } from 'react';

export default function DriverServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const register = () => {
      void navigator.serviceWorker.register('/driver-pwa-fresh/sw.js', { scope: '/driver-pwa-fresh/' }).catch((error: unknown) => {
        console.warn('Driver PWA service worker registration failed:', error);
      });
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
    return () => window.removeEventListener('load', register);
  }, []);
  return null;
}
