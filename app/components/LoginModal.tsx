'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import { supabase } from '../../lib/supabaseClient';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const getErrorMessage = (err: unknown, fallback: string) => {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
};

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isResetMode, setIsResetMode] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      if (!supabase) {
        throw new Error('Authentication service is currently unavailable. Please try again later.');
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
          // Use Next.js router for client-side navigation
          router.push('/admin');
        }, 1000);
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to login'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    if (isResetMode) {
      handleResetPassword(e);
      return;
    }
    handleLogin(e);
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      if (!supabase) {
        throw new Error('Authentication service is currently unavailable. Please try again later.');
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback`,
      });

      if (error) throw error;
      setSuccessMessage('Password reset email sent. Please check your inbox.');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to send reset email'));
    } finally {
      setLoading(false);
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
            {isResetMode ? 'Reset Password' : 'Sign In'}
          </Dialog.Title>

          <Dialog.Description
            style={{
              fontSize: '0.95rem',
              color: '#5B6B85',
              marginBottom: '1.5rem',
            }}
          >
            {isResetMode
              ? 'Enter your account email to receive a password reset link'
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

            {!isResetMode && (
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
                  required={!isResetMode}
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

             {!isResetMode && !isRegisterMode && (
               <div style={{ textAlign: 'right', marginBottom: '1rem' }}>
                 <button
                   type="button"
                   onClick={() => {
                     setIsResetMode(true);
                     setIsRegisterMode(false);
                     setPassword('');
                     setConfirmPassword('');
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
                     padding: 0,
                   }}
                 >
                   Forgot password?
                 </button>
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
                : isResetMode
                ? 'Send Reset Email'
                : 'Sign In'}
            </button>

            <div style={{ textAlign: 'center' }}>
              {isResetMode ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsResetMode(false);
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
                  Back to Sign in
                </button>
              ) : (
                <p style={{ margin: 0, color: '#6B7280', fontSize: '0.85rem' }}>
                  Account onboarding is managed by XDrive Logistics operations.
                </p>
              )}
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
