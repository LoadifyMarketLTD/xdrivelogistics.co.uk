'use client';

import { useEffect, useState } from 'react';

const NATIVE_SCHEME = 'xdrivedriver://';
const APK_FALLBACK_URL = '/m/get-app';

export default function MobileDeepLinkPage() {
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    // Attempt to open the installed native app via custom scheme.
    // The browser will ignore this silently if the app is not installed.
    window.location.href = NATIVE_SCHEME;
    const timer = setTimeout(() => setAttempted(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1.5rem',
        padding: '2rem 1.5rem',
        backgroundColor: '#050f1f',
        color: '#f1f5f9',
        fontFamily: 'system-ui, sans-serif',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '3rem' }}>🚛</div>

      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0 0 0.5rem' }}>
          XDrive Driver App
        </h1>
        <p style={{ color: '#94a3b8', margin: 0, fontSize: '1rem' }}>
          {attempted
            ? 'App not installed? Download it below.'
            : 'Opening the XDrive Driver app…'}
        </p>
      </div>

      {attempted && (
        <a
          href={APK_FALLBACK_URL}
          style={{
            display: 'inline-block',
            backgroundColor: '#0B2F6B',
            color: '#fff',
            borderRadius: '0.5rem',
            padding: '0.875rem 2rem',
            fontWeight: 700,
            fontSize: '1rem',
            textDecoration: 'none',
          }}
        >
          Download APK
        </a>
      )}

      <a
        href="/driver"
        style={{ color: '#60a5fa', fontSize: '0.9rem', textDecoration: 'underline' }}
      >
        Continue on web instead ›
      </a>
    </main>
  );
}
