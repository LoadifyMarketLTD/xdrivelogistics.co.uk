'use client';

import Link from 'next/link';
import { useAuth } from '../components/AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';

export default function CustomerPage() {
  const { user, logout } = useAuth();

  return (
    <ProtectedRoute allowedRoles={['customer']}>
      <main
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #0A2239 0%, #1E4E8C 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
        }}
      >
        <section
          style={{
            width: '100%',
            maxWidth: '640px',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            padding: '2rem',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
          }}
        >
          <h1 style={{ marginTop: 0, marginBottom: '0.5rem', color: '#0A2239' }}>Customer Dashboard</h1>
          <p style={{ marginTop: 0, color: '#5B6B85' }}>
            Signed in as <strong>{user?.email ?? 'customer'}</strong>.
          </p>
          <p style={{ color: '#334155', lineHeight: 1.6 }}>
            Your account is active. Customer-specific tools are being finalized. You can continue browsing the public
            pages while your dashboard features are enabled.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1.25rem' }}>
            <Link
              href="/"
              style={{
                padding: '0.7rem 1rem',
                borderRadius: '8px',
                textDecoration: 'none',
                backgroundColor: '#1E4E8C',
                color: '#fff',
                fontWeight: 600,
              }}
            >
              Go to Home
            </Link>
            <button
              type="button"
              onClick={() => logout()}
              style={{
                padding: '0.7rem 1rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#fff',
                color: '#0A2239',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Logout
            </button>
          </div>
        </section>
      </main>
    </ProtectedRoute>
  );
}
