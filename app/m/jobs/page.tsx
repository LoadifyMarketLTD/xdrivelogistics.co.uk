'use client';

import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';

export default function MobileJobsPage() {
  const router = useRouter();

  return (
    <ProtectedRoute allowedRoles={['company', 'admin', 'owner']}>
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '2rem', textAlign: 'center' }}>
        <div>
          <h1 style={{ marginBottom: '0.75rem' }}>Mobile jobs module disabled</h1>
          <p style={{ marginBottom: '1rem', color: '#6b7280' }}>
            This legacy mobile jobs screen has been disabled for pre-launch hardening.
          </p>
          <button
            onClick={() => router.push('/admin/jobs')}
            style={{
              padding: '0.75rem 1.25rem',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#0A2239',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Open Admin Jobs
          </button>
        </div>
      </div>
    </ProtectedRoute>
  );
}
