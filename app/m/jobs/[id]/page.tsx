'use client';

import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../../components/ProtectedRoute';

export default function MobileJobDetailPage() {
  const router = useRouter();

  return (
    <ProtectedRoute allowedRoles={['company', 'admin', 'owner']}>
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '2rem', textAlign: 'center' }}>
        <div>
          <h1 style={{ marginBottom: '0.75rem' }}>Legacy mobile detail disabled</h1>
          <p style={{ marginBottom: '1rem', color: '#6b7280' }}>
            Use the hardened admin job detail flow instead.
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
