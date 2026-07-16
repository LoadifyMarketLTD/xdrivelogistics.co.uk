import Link from 'next/link';

export default function PendingApprovalPage() {
  return (
    <main style={{ minHeight: '100vh', background: '#F4F6F8', color: '#1A1F2B', display: 'grid', placeItems: 'center', padding: '2rem' }}>
      <section style={{ width: '100%', maxWidth: '560px', background: '#FFFFFF', border: '1px solid #F4F6F8', borderRadius: '8px', padding: '2rem', boxShadow: '0 16px 40px rgba(26, 31, 43, 0.08)' }}>
        <p style={{ margin: '0 0 0.5rem', color: '#F5A300', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.8rem' }}>Account confirmed</p>
        <h1 style={{ margin: '0 0 1rem', fontSize: '1.8rem' }}>Your account has been confirmed and is pending approval.</h1>
        <p style={{ margin: '0 0 1.5rem', color: '#0B2F6B', lineHeight: 1.6 }}>
          XDrive is reviewing your account setup. You will be able to access your workspace once approval and required onboarding checks are complete.
        </p>
        <Link
          href="/login"
          style={{
            display: 'inline-block',
            background: '#1A1F2B',
            color: '#FFFFFF',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            textDecoration: 'none',
            fontWeight: 800,
          }}
        >
          Back to sign in
        </Link>
      </section>
    </main>
  );
}
