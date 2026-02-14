'use client';

import { useState, FormEvent } from 'react';
import { useAuth } from '../components/AuthContext';
import { COMPANY_CONFIG } from '../config/company';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!showOtp) {
      // First step: validate credentials and send OTP
      const result = await login(email, password, false); // Don't complete login yet
      
      if (!result.success) {
        setError(result.error || 'Login failed');
        setIsLoading(false);
      } else if (result.requiresOtp) {
        // Show OTP input
        setShowOtp(true);
        setOtpSent(true);
        setIsLoading(false);
      }
    } else {
      // Second step: verify OTP
      const result = await login(email, password, true, otp);
      
      if (!result.success) {
        setError(result.error || 'Invalid OTP');
        setIsLoading(false);
      }
    }
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
            Sign in to your account
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {!showOtp ? (
            <>
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

              <div style={{ marginBottom: '1.5rem' }}>
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
            </>
          ) : (
            <div style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="otp" style={{
                display: 'block',
                marginBottom: '0.5rem',
                color: '#0B1B33',
                fontWeight: '500',
                fontSize: '0.95rem'
              }}>
                Enter 6-Digit Code
              </label>
              <p style={{
                fontSize: '0.85rem',
                color: '#5B6B85',
                marginBottom: '1rem'
              }}>
                We've sent a verification code to <strong>{email}</strong>
              </p>
              <input
                id="otp"
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                disabled={isLoading}
                placeholder="000000"
                maxLength={6}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid rgba(14, 36, 72, 0.12)',
                  borderRadius: '6px',
                  fontSize: '1.5rem',
                  letterSpacing: '0.5rem',
                  textAlign: 'center',
                  transition: 'border-color 0.2s',
                  outline: 'none',
                  fontWeight: '600'
                }}
                onFocus={(e) => e.target.style.borderColor = '#1E4E8C'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(14, 36, 72, 0.12)'}
              />
              <button
                type="button"
                onClick={() => {
                  setShowOtp(false);
                  setOtp('');
                  setError('');
                }}
                style={{
                  marginTop: '1rem',
                  color: '#1E4E8C',
                  background: 'none',
                  border: 'none',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                ← Back to login
              </button>
            </div>
          )}

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

          {otpSent && showOtp && !error && (
            <div style={{
              padding: '0.75rem',
              marginBottom: '1.5rem',
              backgroundColor: '#d1fae5',
              color: '#065f46',
              borderRadius: '6px',
              fontSize: '0.9rem',
              border: '1px solid #6ee7b7'
            }}>
              ✓ Verification code sent to your email
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
            {isLoading ? 'Please wait...' : showOtp ? 'Verify Code' : 'Sign In'}
          </button>
        </form>

        <div style={{
          marginTop: '1.5rem',
          padding: '1rem',
          backgroundColor: '#eff6ff',
          borderRadius: '6px',
          border: '1px solid #bfdbfe'
        }}>
          <p style={{
            fontSize: '0.85rem',
            color: '#1E4E8C',
            margin: 0,
            textAlign: 'center'
          }}>
            <strong>🔒 Secure Login:</strong> Two-factor authentication enabled for enhanced security.
          </p>
        </div>
      </div>
    </div>
  );
}
