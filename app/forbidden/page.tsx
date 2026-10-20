

export default function ForbiddenPage() {
  return (
    <main>
      <section style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 'bold', color: '#dc2626' }}>403</h1>
        <h2>Access Forbidden</h2>
        <p>This page is not available for your current workspace. Return Home will recheck your account and open the workspace you are authorised to use.</p>
        <a
          href="/auth/recover-access"
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
        </a>
      </section>
    </main>
  );
}
