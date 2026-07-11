'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    // Log with context — never expose to user
    console.error('[ErrorBoundary]', {
      message: error.message,
      digest: error.digest,
      route: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
      stack: error.stack,
    })
  }, [error])

  return (
    <main>
      <section style={{ textAlign: 'center', padding: '4rem 2rem', maxWidth: 480, margin: '0 auto' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem' }}>Something went wrong</h2>
        <p style={{ color: '#6b7280', marginBottom: '2rem' }}>
          An unexpected error occurred. You can try again or return to the home page.
          {error.digest && (
            <><br /><span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Reference: {error.digest}</span></>
          )}
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={reset}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: '600',
            }}
          >
            Try Again
          </button>
          <button
            onClick={() => router.push('/')}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'transparent',
              color: '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: '600',
            }}
          >
            Go Home
          </button>
        </div>
      </section>
    </main>
  )
}
