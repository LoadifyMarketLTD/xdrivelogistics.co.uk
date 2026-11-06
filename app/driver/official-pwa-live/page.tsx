'use client';

import { useEffect } from 'react';

/** Route the authenticated driver to the actual standalone PWA document.
 * Never mount the PWA inside the platform workspace or an iframe.
 */
export default function OfficialDriverPwaLivePage() {
  useEffect(() => {
    window.location.replace('/driver/official-pwa/index.html?live=1');
  }, []);

  return <main aria-live="polite">Opening XDrive Driver...</main>;
}
