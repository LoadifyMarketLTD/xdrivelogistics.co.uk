'use client'

export default function Loading() {
  return (
    <main>
      <section style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <div className="spinner" />
        <p style={{ marginTop: '1rem', color: '#6b7280' }}>Loading...</p>
        <style jsx>{`
          .spinner {
            width: 50px;
            height: 50px;
            border: 4px solid #e5e7eb;
            border-top: 4px solid #2563eb;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </section>
    </main>
  )
}
