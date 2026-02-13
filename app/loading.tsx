export default function Loading() {
  return (
    <main>
      <section style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <div
          style={{
            width: '50px',
            height: '50px',
            border: '4px solid #e5e7eb',
            borderTop: '4px solid #2563eb',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto',
          }}
        />
        <p style={{ marginTop: '1rem', color: '#6b7280' }}>Loading...</p>
      </section>
    </main>
  )
}
