'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './components/AuthContext';
import { LandingPage } from './(marketing)/_components/LandingPage';

const AUTH_TIMEOUT_MS = 5000;

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!isLoading) return;
    const id = setTimeout(() => setTimedOut(true), AUTH_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [isLoading]);

  useEffect(() => {
    if (!isLoading && user) {
      if (user.role === 'driver') {
        router.push('/driver/jobs');
      } else if (user.role === 'company' || user.role === 'admin' || user.role === 'owner') {
        router.push('/admin');
      } else if (user.role === 'customer') {
        router.push('/customer');
      } else {
        router.push('/forbidden');
      }
    }
  }, [user, isLoading, router]);

  if ((isLoading && !timedOut) || user) {
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

  return <LandingPage />;
}
