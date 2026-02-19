'use client';

import { useState, FormEvent } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      if (!isSupabaseConfigured() || !supabase) {
        throw new Error('Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.');
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        setSuccessMessage('Successfully logged in!');
        setTimeout(() => {
          onClose();
          // Redirect to appropriate dashboard based on user metadata
          window.location.href = '/admin';
        }, 1000);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      if (!isSupabaseConfigured() || !supabase) {
        throw new Error('Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.');
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;

      if (data.user) {
        setSuccessMessage('Registration successful! Please check your email to confirm your account.');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          setIsRegisterMode(false);
        }, 3000);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to register');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    if (isRegisterMode) {
      handleRegister(e);
    } else {
      handleLogin(e);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            zIndex: 50,
          }}
        />
        <Dialog.Content
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '2rem',
            width: '90%',
            maxWidth: '450px',
            maxHeight: '90vh',
            overflow: 'auto',
            zIndex: 51,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          }}
        >
          <Dialog.Title
            style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              color: '#0A2239',
              marginBottom: '1rem',
            }}
          >
            {isRegisterMode ? 'Create Account' : 'Sign In'}
          </Dialog.Title>

          <Dialog.Description
            style={{
              fontSize: '0.95rem',
              color: '#5B6B85',
              marginBottom: '1.5rem',
            }}
          >
            {isRegisterMode
              ? 'Create a new account to get started'
              : 'Sign in to access your dashboard'}
          </Dialog.Description>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1.25rem' }}>
              <label
                htmlFor="email"
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  color: '#0B1B33',
                  fontWeight: '500',
                  fontSize: '0.9rem',
                }}
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #E5E7EB',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#1E4E8C')}
                onBlur={(e) => (e.target.style.borderColor = '#E5E7EB')}
              />
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label
                htmlFor="password"
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  color: '#0B1B33',
                  fontWeight: '500',
                  fontSize: '0.9rem',
                }}
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #E5E7EB',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#1E4E8C')}
                onBlur={(e) => (e.target.style.borderColor = '#E5E7EB')}
              />
            </div>

            {isRegisterMode && (
              <div style={{ marginBottom: '1.25rem' }}>
                <label
                  htmlFor="confirmPassword"
                  style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    color: '#0B1B33',
                    fontWeight: '500',
                    fontSize: '0.9rem',
                  }}
                >
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #E5E7EB',
                    borderRadius: '6px',
                    fontSize: '1rem',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#1E4E8C')}
                  onBlur={(e) => (e.target.style.borderColor = '#E5E7EB')}
                />
              </div>
            )}

            {error && (
              <div
                style={{
                  padding: '0.75rem',
                  marginBottom: '1rem',
                  backgroundColor: '#FEE2E2',
                  color: '#DC2626',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  border: '1px solid #FCA5A5',
                }}
              >
                {error}
              </div>
            )}

            {successMessage && (
              <div
                style={{
                  padding: '0.75rem',
                  marginBottom: '1rem',
                  backgroundColor: '#D1FAE5',
                  color: '#065F46',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  border: '1px solid #6EE7B7',
                }}
              >
                {successMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.875rem',
                backgroundColor: loading ? '#86EFAC' : '#1F7A3D',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s',
                marginBottom: '1rem',
              }}
              onMouseEnter={(e) => {
                if (!loading)
                  e.currentTarget.style.backgroundColor = '#166534';
              }}
              onMouseLeave={(e) => {
                if (!loading)
                  e.currentTarget.style.backgroundColor = '#1F7A3D';
              }}
            >
              {loading
                ? 'Please wait...'
                : isRegisterMode
                ? 'Create Account'
                : 'Sign In'}
            </button>

            <div style={{ textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  setIsRegisterMode(!isRegisterMode);
                  setError('');
                  setSuccessMessage('');
                }}
                disabled={loading}
                style={{
                  color: '#1E4E8C',
                  background: 'none',
                  border: 'none',
                  fontSize: '0.9rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  textDecoration: 'underline',
                }}
              >
                {isRegisterMode
                  ? 'Already have an account? Sign in'
                  : "Don't have an account? Register"}
              </button>
            </div>
          </form>

          <Dialog.Close asChild>
            <button
              aria-label="Close"
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                width: '2rem',
                height: '2rem',
                borderRadius: '50%',
                border: 'none',
                background: 'rgba(0, 0, 0, 0.1)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
                color: '#6B7280',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.2)')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.1)')
              }
            >
              ×
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
