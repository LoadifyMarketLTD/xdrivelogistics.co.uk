'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './components/AuthContext';
import { LandingPage } from './(marketing)/_components/LandingPage';
import { getPostLoginRoute } from '../lib/authSession';

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
      router.push(getPostLoginRoute(user));
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
