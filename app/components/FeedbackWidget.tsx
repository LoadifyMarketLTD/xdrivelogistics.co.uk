'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from './AuthContext';
import { supabase } from '../../lib/supabaseClient';

type FeedbackCategory = 'bug' | 'feature_request' | 'general' | 'compliment' | 'other';

const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  bug: '🐛 Bug Report',
  feature_request: '💡 Feature Request',
  general: '💬 General Feedback',
  compliment: '🎉 Compliment',
  other: '📝 Other',
};

const STAR_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

export default function FeedbackWidget() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [category, setCategory] = useState<FeedbackCategory>('general');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const resetForm = () => {
    setRating(0);
    setHoverRating(0);
    setCategory('general');
    setMessage('');
    setError(null);
    setSubmitted(false);
  };

  const handleOpen = () => {
    resetForm();
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setError('Please enter a message.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Session expired. Please refresh and try again.');
        setSubmitting(false);
        return;
      }

      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: ['Bearer', session.access_token].join(' '),
        },
        body: JSON.stringify({
          rating: rating > 0 ? rating : undefined,
          category,
          message: message.trim(),
          page_url: typeof window !== 'undefined' ? window.location.pathname : pathname,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setError(body.error ?? 'Failed to submit feedback. Please try again.');
        setSubmitting(false);
        return;
      }

      setSubmitted(true);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Only show for authenticated users
  if (!user) return null;

  const displayRating = hoverRating || rating;

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={handleOpen}
        aria-label="Send feedback"
        style={{
          position: 'fixed',
          bottom: '88px',
          right: '20px',
          zIndex: 9000,
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          backgroundColor: '#1849d6',
          color: '#ffffff',
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(24,73,214,0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.2rem',
          transition: 'background-color 0.15s, transform 0.15s',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#113bb5'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1849d6'; }}
      >
        💬
      </button>

      {/* Backdrop + Dialog */}
      {open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15,23,42,0.55)',
            zIndex: 9010,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'flex-end',
            padding: '1rem',
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Feedback form"
            style={{
              width: '100%',
              maxWidth: '400px',
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              boxShadow: '0 20px 60px rgba(15,23,42,0.22)',
              overflow: 'hidden',
              marginBottom: '3.5rem',
            }}
          >
            {/* Header */}
            <div
              style={{
                backgroundColor: '#1849d6',
                padding: '1rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#ffffff' }}>Share Feedback</div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.75)', marginTop: '0.1rem' }}>
                  Help us improve XDrive Logistics
                </div>
              </div>
              <button
                onClick={handleClose}
                aria-label="Close feedback form"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,0.8)',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  lineHeight: 1,
                  padding: '0.2rem',
                }}
              >
                ✕
              </button>
            </div>

            {submitted ? (
              /* Success state */
              <div style={{ padding: '2rem 1.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🎉</div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a', marginBottom: '0.4rem' }}>
                  Thank you for your feedback!
                </div>
                <p style={{ fontSize: '0.82rem', color: '#475569', marginBottom: '1.25rem' }}>
                  We read every submission and use it to make XDrive better.
                </p>
                <button
                  onClick={handleClose}
                  style={{
                    backgroundColor: '#1849d6',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.55rem 1.25rem',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </div>
            ) : (
              /* Form */
              <form onSubmit={(e) => void handleSubmit(e)} style={{ padding: '1.25rem' }}>
                {/* Star rating */}
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.45rem' }}>
                    Overall experience <span style={{ color: '#6b7280', fontWeight: 400 }}>(optional)</span>
                  </label>
                  <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        aria-label={`${star} star${star > 1 ? 's' : ''}`}
                        onClick={() => setRating(star === rating ? 0 : star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '1.5rem',
                          color: star <= displayRating ? '#f59e0b' : '#d1d5db',
                          padding: '0.1rem',
                          transition: 'color 0.1s',
                          lineHeight: 1,
                        }}
                      >
                        ★
                      </button>
                    ))}
                    {displayRating > 0 && (
                      <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: '0.25rem' }}>
                        {STAR_LABELS[displayRating]}
                      </span>
                    )}
                  </div>
                </div>

                {/* Category */}
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.45rem' }}>
                    Category
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                    {(Object.keys(CATEGORY_LABELS) as FeedbackCategory[]).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategory(cat)}
                        style={{
                          padding: '0.4rem 0.5rem',
                          border: `1.5px solid ${category === cat ? '#1849d6' : '#e5e7eb'}`,
                          backgroundColor: category === cat ? '#eff6ff' : '#ffffff',
                          color: category === cat ? '#1849d6' : '#374151',
                          borderRadius: '8px',
                          fontSize: '0.72rem',
                          fontWeight: category === cat ? 700 : 500,
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'border-color 0.1s, background-color 0.1s',
                        }}
                      >
                        {CATEGORY_LABELS[cat]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Message */}
                <div style={{ marginBottom: '1rem' }}>
                  <label
                    htmlFor="feedback-message"
                    style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.45rem' }}
                  >
                    Message <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <textarea
                    id="feedback-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell us what you think…"
                    rows={4}
                    maxLength={3000}
                    required
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.75rem',
                      border: '1.5px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                      color: '#0f172a',
                      resize: 'vertical',
                      outline: 'none',
                      boxSizing: 'border-box',
                      fontFamily: 'inherit',
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.2rem' }}>
                    <span style={{ fontSize: '0.68rem', color: '#9ca3af' }}>{message.length}/3000</span>
                  </div>
                </div>

                {error && (
                  <div
                    style={{
                      backgroundColor: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '6px',
                      padding: '0.5rem 0.75rem',
                      color: '#dc2626',
                      fontSize: '0.78rem',
                      marginBottom: '0.75rem',
                    }}
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || !message.trim()}
                  style={{
                    width: '100%',
                    padding: '0.65rem',
                    backgroundColor: submitting || !message.trim() ? '#93c5fd' : '#1849d6',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: submitting || !message.trim() ? 'not-allowed' : 'pointer',
                    transition: 'background-color 0.15s',
                  }}
                >
                  {submitting ? 'Sending…' : 'Send Feedback'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
