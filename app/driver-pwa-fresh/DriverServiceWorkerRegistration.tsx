'use client';

import { useEffect } from 'react';

// Check for a newly deployed shell on resume and while the PWA stays open.
// Do not force reload during a driver's form submission or unfinished edits.
export default function DriverServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let registration: ServiceWorkerRegistration | null = null;
    let reloaded = false;
    // Initial service-worker takeover is not an app update.
    const hadControllerAtMount = Boolean(navigator.serviceWorker.controller);
    const check = () => {
      if (document.visibilityState === 'visible') void registration?.update().catch(() => {});
    };
    const safeToReload = () => {
      const focused = document.activeElement;
      const editing = focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement || focused instanceof HTMLSelectElement || Boolean(focused?.closest('[contenteditable="true"]'));
      return !editing && !document.querySelector('[aria-busy="true"]');
    };
    const onControllerChange = () => {
      if (reloaded || !hadControllerAtMount || !navigator.serviceWorker.controller) return;
      if (safeToReload()) {
        reloaded = true;
        window.location.reload();
      } else {
        // Preserve unsent quotes, POD evidence and messages until the driver
        // navigates away or returns to the app.
        const reloadWhenSafe = () => {
          if (!safeToReload() || document.visibilityState !== 'visible') return;
          document.removeEventListener('visibilitychange', reloadWhenSafe);
          window.removeEventListener('focus', reloadWhenSafe);
          if (!reloaded) { reloaded = true; window.location.reload(); }
        };
        document.addEventListener('visibilitychange', reloadWhenSafe);
        window.addEventListener('focus', reloadWhenSafe);
      }
    };
    const register = async () => {
      try {
        registration = await navigator.serviceWorker.register('/driver-pwa-fresh/sw.js', {
          scope: '/driver-pwa-fresh/',
          updateViaCache: 'none',
        });
        await registration.update();
      } catch (error) {
        console.warn('Driver PWA service worker registration failed:', error);
      }
    };
    if (document.readyState === 'complete') void register();
    else window.addEventListener('load', register, { once: true });
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    const timer = window.setInterval(check, 5 * 60_000);
    return () => {
      window.removeEventListener('load', register);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
      window.clearInterval(timer);
    };
  }, []);
  return null;
}
