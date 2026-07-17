import Link from 'next/link'

export default function NotFound() {
  return (
    <main>
      <section style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <h1 style={{ fontSize: '4rem', fontWeight: 'bold', color: '#2563eb' }}>404</h1>
        <h2>Page Not Found</h2>
        <p>Sorry, we couldn&apos;t find the page you&apos;re looking for.</p>
        <Link
          href="/"
          style={{
            display: 'inline-block',
            marginTop: '2rem',
            padding: '0.75rem 1.5rem',
            backgroundColor: '#2563eb',
            color: 'white',
            borderRadius: '4px',
            textDecoration: 'none',
            fontWeight: '600',
          }}
        >
          Return Home
        </Link>
      </section>
    </main>
  )
}
