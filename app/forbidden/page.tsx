import Link from 'next/link';

export default function ForbiddenPage() {
  return (
    <main>
      <section style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 'bold', color: '#dc2626' }}>403</h1>
        <h2>Access Forbidden</h2>
        <p>Your account does not have permission to access this page.</p>
        <Link
          href="/"
          style={{
            display: 'inline-block',
            marginTop: '2rem',
            padding: '0.75rem 1.5rem',
            backgroundColor: '#0A2239',
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
  );
}
