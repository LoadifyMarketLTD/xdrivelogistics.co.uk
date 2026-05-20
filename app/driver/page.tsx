'use client';

import { useRouter } from 'next/navigation';
import ProtectedRoute from '../components/ProtectedRoute';
import { useAuth } from '../components/AuthContext';

export default function DriverEntryPage() {
  const router = useRouter();
  const { user, logout } = useAuth();

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem 1.5rem',
          backgroundColor: '#0A2239',
          color: '#ffffff',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Driver App</h1>
        <p style={{ marginBottom: '1.5rem', color: '#cbd5e1' }}>
          Signed in as {user?.email}
        </p>
        <button
          onClick={() => router.push('/driver/jobs')}
          style={{
            width: '100%',
            maxWidth: '280px',
            padding: '1rem',
            backgroundColor: '#16a34a',
            color: '#ffffff',
            border: 'none',
            borderRadius: '12px',
            fontSize: '1rem',
            fontWeight: '700',
            cursor: 'pointer',
            marginBottom: '0.75rem',
          }}
        >
          Open Driver Jobs
        </button>
        <button
          onClick={logout}
          style={{
            width: '100%',
            maxWidth: '280px',
            padding: '0.9rem',
            backgroundColor: 'transparent',
            color: '#93c5fd',
            border: '1px solid #3b5c7c',
            borderRadius: '12px',
            fontSize: '0.95rem',
            cursor: 'pointer',
          }}
        >
          Logout
        </button>
      </div>
    </ProtectedRoute>
  );
}
