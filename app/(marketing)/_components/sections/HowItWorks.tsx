import { Section } from '../ui/Section';

const FLOW = ['Post / Request', 'Quote', 'Award / Accept', 'Assign', 'Deliver', 'POD', 'Invoice'];

export function HowItWorks() {
  return (
    <Section backgroundColor="#102A46">
      <div style={{ paddingTop: '4rem', paddingBottom: '4rem' }}>
        <h2 style={{ margin: '0 0 0.75rem', color: '#FFFFFF', fontSize: 'clamp(1.6rem, 4vw, 2.2rem)' }}>
          How XDrive Works
        </h2>
        <p style={{ margin: '0 0 1.5rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.6 }}>
          Operational flow from first request to final invoice.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
          {FLOW.map((step, index) => (
            <div
              key={step}
              style={{
                backgroundColor: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.14)',
                borderRadius: '12px',
                padding: '0.9rem',
                minHeight: '84px',
              }}
            >
              <div style={{ color: '#D4AF37', fontSize: '0.74rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                STEP {index + 1}
              </div>
              <div style={{ color: '#FFFFFF', fontSize: '0.95rem', fontWeight: 700, lineHeight: 1.35 }}>{step}</div>
            </div>
          ))}
        </div>

        <p style={{ margin: '1.2rem 0 0', color: 'rgba(255,255,255,0.85)', fontSize: '0.92rem' }}>
          Post Load → Quote → Award → Assign → Deliver → POD → Invoice
        </p>
      </div>
    </Section>
  );
}
