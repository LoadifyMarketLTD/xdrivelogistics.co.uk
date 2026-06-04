import Link from 'next/link';
import { Section } from '../ui/Section';

const EXCHANGE_POINTS = [
  'Brokers and load posters can publish transport work to the exchange board.',
  'Carrier companies and owner operators can review work and send quotes.',
  'Awarded work moves directly into the operational workflow for execution.',
];

export function ForDrivers() {
  return (
    <Section backgroundColor="var(--color-primary-navy)">
      <div style={{ paddingTop: '4rem', paddingBottom: '4rem' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr)',
            gap: '1.2rem',
            backgroundColor: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(212,175,55,0.35)',
            borderRadius: '16px',
            padding: '1.2rem',
          }}
        >
          <p style={{ margin: 0, color: '#D4AF37', fontWeight: 700, fontSize: '0.82rem', letterSpacing: '0.04em' }}>
            MARKETPLACE / WORK EXCHANGE
          </p>
          <h2 style={{ margin: 0, color: '#FFFFFF', fontSize: 'clamp(1.6rem, 4vw, 2.25rem)', lineHeight: 1.2 }}>
            Exchange-first workflow for posting, quoting, and awarding transport work
          </h2>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.8)', lineHeight: 1.6 }}>
            XDrive is designed as an operational exchange where work is posted, priced, awarded, then executed through delivery operations.
          </p>

          <ul style={{ margin: 0, paddingLeft: '1.05rem', color: 'rgba(255,255,255,0.88)', lineHeight: 1.6 }}>
            {EXCHANGE_POINTS.map((point) => (
              <li key={point} style={{ marginBottom: '0.35rem' }}>{point}</li>
            ))}
          </ul>

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
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '0.9rem',
              }}
            >
              Post Work / Request Quote
            </Link>
            <Link
              href="/register"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.8rem 1rem',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.3)',
                color: '#FFFFFF',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '0.9rem',
              }}
            >
              Join to Quote as Carrier / Owner Operator
            </Link>
          </div>
        </div>
      </div>
    </Section>
  );
}
