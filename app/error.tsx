'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main>
      <section style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <h2>Something went wrong!</h2>
        <p>We apologize for the inconvenience. An error has occurred.</p>
        <button
          onClick={reset}
          style={{
            marginTop: '2rem',
            padding: '0.75rem 1.5rem',
            backgroundColor: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: '600',
          }}
        >
          Try again
        </button>
      </section>
    </main>
  )
}
