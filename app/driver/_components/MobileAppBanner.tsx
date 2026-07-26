'use client';

import { useEffect, useState } from 'react';

const DISMISS_KEY = 'xdrive:native-banner-dismissed';
const NATIVE_SCHEME = 'xdrivedriver://';

type Props = { isMobile: boolean };

export default function MobileAppBanner({ isMobile }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isMobile) return;
    try {
      if (!sessionStorage.getItem(DISMISS_KEY)) setVisible(true);
    } catch {
      // sessionStorage unavailable (e.g. private browsing with strict settings)
    }
  }, [isMobile]);

  if (!visible) return null;

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore
    }
    setVisible(false);
  }

  function openNativeApp() {
    // Attempt to launch the installed native app via custom scheme.
    window.location.href = NATIVE_SCHEME;
  }

  return (
    <div
      role="banner"
      aria-label="XDrive Driver native app available"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backgroundColor: '#0B2F6B',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.625rem 1rem',
        fontSize: '0.875rem',
        flexWrap: 'wrap',
      }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        📱 Better experience on the <strong>XDrive Driver</strong> native app.
      </span>
      <button
        onClick={openNativeApp}
        style={{
          background: '#fff',
          color: '#0B2F6B',
          border: 'none',
          borderRadius: '0.375rem',
          padding: '0.375rem 0.75rem',
          fontWeight: 700,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        Open app
      </button>
      <a
        href="/m"
        style={{
          color: '#93c5fd',
          textDecoration: 'underline',
          whiteSpace: 'nowrap',
          fontWeight: 600,
        }}
      >
        Get the app
      </a>
      <button
        onClick={dismiss}
        aria-label="Dismiss banner"
        style={{
          background: 'transparent',
          border: 'none',
          color: '#93c5fd',
          cursor: 'pointer',
          fontSize: '1.25rem',
          lineHeight: 1,
          padding: '0 0.25rem',
        }}
      >
        ✕
      </button>
    </div>
  );
}
