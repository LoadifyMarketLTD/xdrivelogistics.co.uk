import Link from 'next/link';
import { Section } from '../ui/Section';

export function FinalCTA() {
  return (
    <Section backgroundColor="#102A46">
      <div style={{ paddingTop: '3.5rem', paddingBottom: '3.5rem' }}>
        <div
          style={{
            backgroundColor: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: '14px',
            padding: '1.2rem',
          }}
        >
          <h2 style={{ margin: '0 0 0.7rem', color: '#FFFFFF', fontSize: 'clamp(1.55rem, 4vw, 2rem)' }}>
            Ready to start on XDrive?
          </h2>
          <p style={{ margin: '0 0 1rem', color: 'rgba(255,255,255,0.82)', lineHeight: 1.6 }}>
            Request transport, register your role, or login to continue your workflow.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            <Link
              href="/request-quote"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.8rem 1rem',
                borderRadius: '10px',
                backgroundColor: '#2E7D32',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '0.9rem',
                textDecoration: 'none',
              }}
            >
              Request a Quote
            </Link>
            <Link
              href="/register"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.8rem 1rem',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.32)',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '0.9rem',
                textDecoration: 'none',
              }}
            >
              Register as Broker / Carrier / Owner Operator
            </Link>
            <Link
              href="/login"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.8rem 1rem',
                borderRadius: '10px',
                border: '1px solid #D4AF37',
                color: '#D4AF37',
                fontWeight: 700,
                fontSize: '0.9rem',
                textDecoration: 'none',
              }}
            >
              Login
            </Link>
          </div>
        </div>
      </div>
    </Section>
  );
}
