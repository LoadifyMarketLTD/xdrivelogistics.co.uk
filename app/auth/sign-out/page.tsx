'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '../../components/AuthContext';

export default function SignOutPage() {
  const { logout } = useAuth();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void logout();
  }, [logout]);

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px', background: '#FFFFFF' }}>
      <section style={{ padding: '24px', borderRadius: '8px', background: '#FFFFFF', boxShadow: '0px 2px 6px rgba(0,0,0,0.08)', color: '#8A9099', fontFamily: 'Inter, Arial, sans-serif' }}>
        <h1 style={{ margin: 0, color: '#1A73E8', fontSize: '20px', fontWeight: 700 }}>Signing out</h1>
      </section>
    </main>
  );
}
