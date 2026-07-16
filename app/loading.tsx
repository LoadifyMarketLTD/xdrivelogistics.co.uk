'use client'

export default function Loading() {
  return (
    <main>
      <section style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <div className="spinner" />
        <p style={{ marginTop: '1rem', color: '#0B2F6B' }}>Loading...</p>
        <style jsx>{`
          .spinner {
            width: 50px;
            height: 50px;
            border: 4px solid #F4F6F8;
            border-top: 4px solid #1D57D8;
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
