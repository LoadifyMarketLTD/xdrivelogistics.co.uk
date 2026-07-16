'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * /admin/drivers-vehicles has been superseded by the canonical management pages:
 *   /admin/drivers  – full CRUD driver management
 *   /admin/vehicles – full CRUD vehicle management
 *   /admin/fleet    – fleet tracking overview
 *
 * This page redirects to /admin/drivers to preserve any existing bookmarks.
 */
export default function DriversVehiclesRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/drivers');
  }, [router]);

  return (
    <div style={{ minHeight: '100vh', background: '#F4F6F8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#0B2F6B', fontSize: '0.95rem' }}>Redirecting to Drivers…</p>
    </div>
  );
}
