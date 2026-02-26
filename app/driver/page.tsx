'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';

export default function DriverLoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDigit = (d: string) => {
    if (pin.length < 6) setPin(prev => prev + d);
  };

  const handleBackspace = () => setPin(prev => prev.slice(0, -1));

  const handleSubmit = async () => {
    if (pin.length < 4) {
      setError('Enter your 4–6 digit PIN');
      return;
    }
    setLoading(true);
    setError('');

    if (!isSupabaseConfigured) {
      setError('Service not available. Please try again later.');
      setLoading(false);
      return;
    }

    const { data, error: dbError } = await supabase
      .from('drivers')
      .select('id, display_name, app_access, login_pin')
      .eq('login_pin', pin)
      .eq('app_access', true)
      .maybeSingle();

    if (dbError || !data) {
      setError('Invalid PIN. Please try again.');
      setPin('');
      setLoading(false);
      return;
    }

    // Record last login
    await supabase
      .from('drivers')
      .update({ last_app_login: new Date().toISOString() })
      .eq('id', data.id);

    // Store driver id in sessionStorage for subsequent pages
    sessionStorage.setItem('driver_id', data.id);
    sessionStorage.setItem('driver_name', data.display_name);

    router.push('/driver/jobs');
  };

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1.5rem',
        backgroundColor: '#0A2239',
      }}
    >
      {/* Logo / title */}
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🚚</div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ffffff', margin: 0 }}>
          Driver App
        </h1>
        <p style={{ color: '#93c5fd', fontSize: '0.9rem', marginTop: '0.4rem' }}>
          Enter your PIN to continue
        </p>
      </div>

      {/* PIN dots */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {Array.from({ length: Math.max(pin.length, 4) }).map((_, i) => (
          <div
            key={i}
            style={{
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              backgroundColor: i < pin.length ? '#60a5fa' : '#1e3a5f',
              border: '2px solid #3b82f6',
              transition: 'background-color 0.1s',
            }}
          />
        ))}
      </div>

      {/* Error message */}
      {error && (
        <p style={{ color: '#f87171', fontSize: '0.875rem', marginBottom: '1rem', textAlign: 'center' }}>
          {error}
        </p>
      )}

      {/* Numpad */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '0.75rem',
          width: '100%',
          maxWidth: '280px',
          marginBottom: '1.5rem',
        }}
      >
        {digits.map((d, i) =>
          d === '' ? (
            <div key={i} />
          ) : (
            <button
              key={i}
              onClick={() => (d === '⌫' ? handleBackspace() : handleDigit(d))}
              style={{
                padding: '1.1rem',
                backgroundColor: d === '⌫' ? '#1e3a5f' : '#1e4d7b',
                color: '#ffffff',
                border: '1px solid #2d5f96',
                borderRadius: '12px',
                fontSize: '1.4rem',
                fontWeight: '600',
                cursor: 'pointer',
                touchAction: 'manipulation',
              }}
            >
              {d}
            </button>
          )
        )}
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={loading || pin.length < 4}
        style={{
          width: '100%',
          maxWidth: '280px',
          padding: '1rem',
          backgroundColor: pin.length >= 4 ? '#16a34a' : '#374151',
          color: '#ffffff',
          border: 'none',
          borderRadius: '12px',
          fontSize: '1rem',
          fontWeight: '700',
          cursor: pin.length >= 4 ? 'pointer' : 'not-allowed',
          transition: 'background-color 0.2s',
        }}
      >
        {loading ? 'Verifying…' : 'Login'}
      </button>
    </div>
  );
}
