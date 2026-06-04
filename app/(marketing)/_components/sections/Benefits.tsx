import Link from 'next/link';
import { Section } from '../ui/Section';

const OWNER_OPERATOR_CAPABILITIES = [
  'Operate as company, dispatcher, and driver within one account context.',
  'Find available work on the exchange and submit quotes.',
  'Manage your own awarded jobs from assignment through delivery.',
  'Complete deliveries, upload POD, and create invoices.',
];

export function Benefits() {
  return (
    <Section backgroundColor="#0E253E">
      <div style={{ paddingTop: '4rem', paddingBottom: '4rem' }}>
        <div
          style={{
            backgroundColor: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(212,175,55,0.35)',
            borderRadius: '16px',
            padding: '1.2rem',
          }}
        >
          <p style={{ margin: 0, marginBottom: '0.65rem', color: '#D4AF37', fontWeight: 700, fontSize: '0.82rem', letterSpacing: '0.04em' }}>
            OWNER OPERATOR MODE
          </p>
          <h2 style={{ margin: '0 0 0.75rem', color: '#FFFFFF', fontSize: 'clamp(1.6rem, 4vw, 2.2rem)' }}>
            Owner Operators are a first-class user type on XDrive
          </h2>
          <p style={{ margin: '0 0 1rem', color: 'rgba(255,255,255,0.84)', lineHeight: 1.6 }}>
            If you run solo, XDrive supports your full workflow: commercial, dispatch, and delivery execution.
          </p>

          <ul style={{ margin: 0, paddingLeft: '1.05rem', color: 'rgba(255,255,255,0.9)', lineHeight: 1.6 }}>
            {OWNER_OPERATOR_CAPABILITIES.map((capability) => (
              <li key={capability} style={{ marginBottom: '0.45rem' }}>{capability}</li>
            ))}
          </ul>

          <div style={{ marginTop: '1rem' }}>
            <Link
              href="/register"
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
              Register as Owner Operator
            </Link>
          </div>
        </div>
      </div>
    </Section>
  );
}
