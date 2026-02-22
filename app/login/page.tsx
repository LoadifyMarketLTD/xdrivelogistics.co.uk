'use client';

import { useState, FormEvent } from 'react';
import { useAuth } from '../components/AuthContext';
import { COMPANY_CONFIG } from '../config/company';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const { login, resetPassword } = useAuth();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Authenticate with email and password only
    const result = await login(email, password);
    
    if (!result.success) {
      setError(result.error || 'Login failed');
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetMessage('');
    setResetLoading(true);
    const result = await resetPassword(resetEmail);
    setResetLoading(false);
    if (result.success) {
      setResetMessage('Password reset email sent. Please check your inbox.');
    } else {
      setResetError(result.error || 'Failed to send reset email.');
    }
  };

  const handleShowReset = () => {
    setShowReset(true);
    setError('');
    setResetEmail(email);
  };

  const handleBackToSignIn = () => {
    setShowReset(false);
    setResetMessage('');
    setResetError('');
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0A2239 0%, #1E4E8C 100%)',
      padding: '1rem'
    }}>
      <div style={{
        background: 'white',
        padding: '2.5rem',
        borderRadius: '12px',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
        width: '100%',
        maxWidth: '400px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{
            fontSize: '2rem',
            fontWeight: '700',
            color: '#0A2239',
            marginBottom: '0.5rem'
          }}>
            {COMPANY_CONFIG.name}
          </h1>
          <p style={{ color: '#5B6B85', fontSize: '0.95rem' }}>
            {showReset ? 'Reset your password' : 'Sign in to your account'}
          </p>
        </div>

        {!showReset ? (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="email" style={{
                display: 'block',
                marginBottom: '0.5rem',
                color: '#0B1B33',
                fontWeight: '500',
                fontSize: '0.95rem'
              }}>
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid rgba(14, 36, 72, 0.12)',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  transition: 'border-color 0.2s',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = '#1E4E8C'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(14, 36, 72, 0.12)'}
              />
            </div>

            <div style={{ marginBottom: '0.5rem' }}>
              <label htmlFor="password" style={{
                display: 'block',
                marginBottom: '0.5rem',
                color: '#0B1B33',
                fontWeight: '500',
                fontSize: '0.95rem'
              }}>
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid rgba(14, 36, 72, 0.12)',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  transition: 'border-color 0.2s',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = '#1E4E8C'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(14, 36, 72, 0.12)'}
              />
            </div>

            <div style={{ textAlign: 'right', marginBottom: '1.5rem' }}>
              <button
                type="button"
                onClick={handleShowReset}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#1E4E8C',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline'
                }}
              >
                Forgot password?
              </button>
            </div>

            {error && (
              <div style={{
                padding: '0.75rem',
                marginBottom: '1.5rem',
                backgroundColor: '#fee2e2',
                color: '#dc2626',
                borderRadius: '6px',
                fontSize: '0.9rem',
                border: '1px solid #fecaca'
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '0.875rem',
                backgroundColor: isLoading ? '#86efac' : '#1F7A3D',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                if (!isLoading) e.currentTarget.style.backgroundColor = '#166534';
              }}
              onMouseLeave={(e) => {
                if (!isLoading) e.currentTarget.style.backgroundColor = '#1F7A3D';
              }}
            >
              {isLoading ? 'Please wait...' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="reset-email" style={{
                display: 'block',
                marginBottom: '0.5rem',
                color: '#0B1B33',
                fontWeight: '500',
                fontSize: '0.95rem'
              }}>
                Email Address
              </label>
              <input
                id="reset-email"
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
                disabled={resetLoading}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid rgba(14, 36, 72, 0.12)',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  transition: 'border-color 0.2s',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = '#1E4E8C'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(14, 36, 72, 0.12)'}
              />
            </div>

            {resetError && (
              <div style={{
                padding: '0.75rem',
                marginBottom: '1.5rem',
                backgroundColor: '#fee2e2',
                color: '#dc2626',
                borderRadius: '6px',
                fontSize: '0.9rem',
                border: '1px solid #fecaca'
              }}>
                {resetError}
              </div>
            )}

            {resetMessage && (
              <div style={{
                padding: '0.75rem',
                marginBottom: '1.5rem',
                backgroundColor: '#dcfce7',
                color: '#166534',
                borderRadius: '6px',
                fontSize: '0.9rem',
                border: '1px solid #bbf7d0'
              }}>
                {resetMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={resetLoading}
              style={{
                width: '100%',
                padding: '0.875rem',
                backgroundColor: resetLoading ? '#86efac' : '#1F7A3D',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: resetLoading ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s',
                marginBottom: '1rem'
              }}
              onMouseEnter={(e) => {
                if (!resetLoading) e.currentTarget.style.backgroundColor = '#166534';
              }}
              onMouseLeave={(e) => {
                if (!resetLoading) e.currentTarget.style.backgroundColor = '#1F7A3D';
              }}
            >
              {resetLoading ? 'Sending...' : 'Send Reset Email'}
            </button>

            <button
              type="button"
              onClick={handleBackToSignIn}
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: 'transparent',
                color: '#5B6B85',
                border: '1px solid rgba(14, 36, 72, 0.2)',
                borderRadius: '6px',
                fontSize: '0.95rem',
                cursor: 'pointer',
                transition: 'border-color 0.2s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#1E4E8C'; e.currentTarget.style.color = '#1E4E8C'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(14, 36, 72, 0.2)'; e.currentTarget.style.color = '#5B6B85'; }}
            >
              Back to Sign In
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
