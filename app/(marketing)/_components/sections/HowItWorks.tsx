'use client';

import { Section } from '../ui/Section';

const STEPS = [
  {
    number: '01',
    title: 'Contact Us',
    description: 'Reach out via WhatsApp, phone, or email with your requirements',
    icon: '📞',
  },
  {
    number: '02',
    title: 'Get Quote',
    description: 'Receive a competitive quote tailored to your specific needs',
    icon: '💰',
  },
  {
    number: '03',
    title: 'Book Service',
    description: 'Confirm your booking and schedule pickup time',
    icon: '📅',
  },
  {
    number: '04',
    title: 'Track Delivery',
    description: 'Monitor your shipment in real-time until safe delivery',
    icon: '📍',
  },
];

export function HowItWorks() {
  return (
    <Section backgroundColor="var(--color-primary-navy)">
      <div style={{ paddingTop: '4rem', paddingBottom: '4rem' }}>
        {/* Section Header */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h2
            style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: 'var(--font-weight-bold)',
              color: 'var(--color-text-white)',
              marginBottom: '1rem',
            }}
          >
            How It Works
          </h2>
          <p
            style={{
              fontSize: '1.1rem',
              color: 'var(--color-text-white-transparent)',
              maxWidth: '600px',
              margin: '0 auto',
            }}
          >
            Simple, fast, and reliable. Get your shipment moving in four easy steps.
          </p>
        </div>

        {/* Steps Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '2rem',
          }}
        >
          {STEPS.map((step, index) => (
            <div
              key={step.number}
              style={{
                backgroundColor: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                borderRadius: 'var(--radius-lg)',
                padding: '2rem',
                position: 'relative',
                backdropFilter: 'blur(10px)',
              }}
            >
              {/* Step Number Badge */}
              <div
                style={{
                  position: 'absolute',
                  top: '-1rem',
                  right: '1.5rem',
                  backgroundColor: 'var(--color-gold-primary)',
                  color: 'var(--color-primary-navy-dark)',
                  width: '3rem',
                  height: '3rem',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.25rem',
                  fontWeight: 'var(--font-weight-bold)',
                }}
              >
                {step.number}
              </div>

              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
                {step.icon}
              </div>

              <h3
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 'var(--font-weight-semibold)',
                  color: 'var(--color-text-white)',
                  marginBottom: '0.75rem',
                }}
              >
                {step.title}
              </h3>

              <p
                style={{
                  fontSize: '0.95rem',
                  color: 'var(--color-text-white-transparent)',
                  lineHeight: '1.5',
                }}
              >
                {step.description}
              </p>

              {/* Connection Line (except last item) */}
              {index < STEPS.length - 1 && (
                <div
                  className="connection-line"
                  style={{
                    position: 'absolute',
                    right: '-1rem',
                    top: '50%',
                    width: '2rem',
                    height: '2px',
                    backgroundColor: 'var(--color-gold-primary)',
                    opacity: 0.3,
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Hide connection lines on mobile */}
      <style jsx>{`
        @media (max-width: 768px) {
          .connection-line {
            display: none !important;
          }
        }
      `}</style>
    </Section>
  );
}
