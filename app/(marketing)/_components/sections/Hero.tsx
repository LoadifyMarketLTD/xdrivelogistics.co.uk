import Link from 'next/link';

export function Hero() {
  return (
    <section
      style={{
        background: 'linear-gradient(135deg, #1F3A5F 0%, #274C77 60%, #0A2239 100%)',
        minHeight: '90vh',
        display: 'flex',
        alignItems: 'center',
        paddingTop: '6rem',
        paddingBottom: '3rem',
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 16px', width: '100%' }}>
        <div
          style={{
            maxWidth: '760px',
            backgroundColor: 'rgba(10,34,57,0.45)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '16px',
            padding: '1.5rem',
          }}
        >
          <p style={{ margin: 0, marginBottom: '0.9rem', color: '#81C784', fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.04em' }}>
            EARLY-STAGE LOGISTICS EXCHANGE PLATFORM
          </p>
          <h1 style={{ fontSize: 'clamp(1.9rem, 8vw, 3rem)', fontWeight: 800, lineHeight: 1.15, margin: '0 0 1rem', color: '#FFFFFF' }}>
            XDrive connects load posters, carriers, owner operators, drivers, and customers in one operational workflow.
          </h1>
          <p style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.85)', lineHeight: 1.6, margin: '0 0 1.5rem' }}>
            Post or request transport work, collect quotes, award jobs, assign drivers, complete delivery with POD, and raise invoices from a single platform.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <Link
              href="/request-quote"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.85rem 1.1rem',
                fontSize: '0.95rem',
                fontWeight: 700,
                borderRadius: '10px',
                backgroundColor: '#2E7D32',
                color: '#FFFFFF',
                textDecoration: 'none',
              }}
            >
              Request a Quote / Post a Load
            </Link>
            <Link
              href="/register"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.85rem 1.1rem',
                fontSize: '0.95rem',
                fontWeight: 700,
                borderRadius: '10px',
                backgroundColor: 'transparent',
                color: '#FFFFFF',
                border: '1.5px solid rgba(255,255,255,0.35)',
                textDecoration: 'none',
              }}
            >
              Join as Carrier / Owner Operator
            </Link>
          </div>

          <Link
            href="/login"
            style={{
              display: 'inline-flex',
              fontSize: '0.92rem',
              color: '#D4AF37',
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            Login to your dashboard →
          </Link>
        </div>
      </div>
    </section>
  );
}
