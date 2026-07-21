'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export default function PendingApprovalPage() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      router.replace('/login');
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a', display: 'grid', placeItems: 'center', padding: '2rem' }}>
      <section style={{ width: '100%', maxWidth: '560px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '2rem', boxShadow: '0 16px 40px rgba(15, 23, 42, 0.08)' }}>
        <p style={{ margin: '0 0 0.5rem', color: '#ca8a04', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.8rem' }}>Onboarding submitted</p>
        <h1 style={{ margin: '0 0 1rem', fontSize: '1.8rem' }}>Your account is pending approval.</h1>
        <p style={{ margin: '0 0 1.5rem', color: '#475569', lineHeight: 1.6 }}>
          XDrive is reviewing your account and supporting documents. Your selected workspace will open automatically after approval. This is not a suspension.
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          disabled={signingOut}
          style={{ background: '#0A2239', color: '#fff', border: 0, borderRadius: '8px', padding: '0.75rem 1rem', fontWeight: 800, cursor: signingOut ? 'wait' : 'pointer' }}
        >
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </section>
    </main>
  );
}
