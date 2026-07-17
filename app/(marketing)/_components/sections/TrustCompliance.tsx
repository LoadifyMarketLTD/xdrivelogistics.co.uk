import { Section } from '../ui/Section';
import { COMPANY_CONFIG } from '../../../config/company';

const TRUST_ITEMS = [
  `Registered UK company (${COMPANY_CONFIG.legalName}, Company No. ${COMPANY_CONFIG.companyNumber}).`,
  'Professional courier workflow from request to invoice.',
  'Documents and POD support during operational delivery.',
  'Role-based access by account type and workspace permissions.',
  'Secure dashboard and authenticated account access.',
];

export function TrustCompliance() {
  return (
    <Section>
      <div style={{ paddingTop: '4rem', paddingBottom: '4rem' }}>
        <h2 style={{ margin: '0 0 0.75rem', color: '#FFFFFF', fontSize: 'clamp(1.6rem, 4vw, 2.2rem)' }}>
          Trust & Compliance
        </h2>
        <p style={{ margin: '0 0 1.4rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.6 }}>
          Real commitments and operational safeguards.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '0.85rem' }}>
          {TRUST_ITEMS.map((item) => (
            <article
              key={item}
              style={{
                backgroundColor: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.14)',
                borderRadius: '12px',
                padding: '1rem',
              }}
            >
              <p style={{ margin: 0, color: 'rgba(255,255,255,0.9)', lineHeight: 1.55, fontSize: '0.92rem' }}>{item}</p>
            </article>
          ))}
        </div>
      </div>
    </Section>
  );
}
