'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * CX-style Drivers & Vehicles entry point.
 * The combined operational resource view lives at /admin/fleet/resources while
 * canonical CRUD remains on the dedicated Drivers and Vehicles registers.
 */
export default function DriversVehiclesRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/fleet/resources');
  }, [router]);

  return (
    <div className="carrier-redirect-page" style={{ minHeight: '100vh', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#6b7280', fontSize: '0.95rem' }}>Opening Drivers &amp; Vehicles…</p>
    </div>
  );
}
