'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './components/AuthContext';
import { LandingPage } from './(marketing)/_components/LandingPage';

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // If user is authenticated, redirect to appropriate dashboard
    if (!isLoading && user) {
      if (user.role === 'mobile') {
        router.push('/m');
      } else {
        router.push('/admin');
      }
    }
  }, [user, isLoading, router]);

  // Show nothing while loading or redirecting
  if (isLoading || user) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--color-primary-navy-dark)',
        }}
      >
        <div
          style={{
            fontSize: '1.5rem',
            color: 'var(--color-gold-primary)',
          }}
        >
          Loading...
        </div>
      </div>
    );
  }

  // Show landing page if not authenticated
  return <LandingPage />;
}
