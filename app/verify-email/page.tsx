export default function VerifyEmailPage() {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f8fafc', padding: '1rem' }}>
      <section style={{ width: '100%', maxWidth: '520px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem' }}>
        <h1 style={{ marginTop: 0, color: '#0f172a' }}>Verify your email</h1>
        <p style={{ color: '#475569', lineHeight: 1.5 }}>
          Your account must be email-verified before workspace access can be enabled.
          Please confirm your email from your inbox, then sign in again.
        </p>
      </section>
    </main>
  );
}
