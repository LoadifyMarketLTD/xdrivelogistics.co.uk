'use client';

import { Section } from '../ui/Section';

const BENEFITS = [
  {
    icon: '⏰',
    title: '24/7 Availability',
    description: 'Round-the-clock service for urgent deliveries',
  },
  {
    icon: '✅',
    title: 'Fully Insured',
    description: 'Complete coverage for peace of mind',
  },
  {
    icon: '👨‍✈️',
    title: 'Professional Drivers',
    description: 'Experienced and vetted transport professionals',
  },
  {
    icon: '💬',
    title: 'Real-Time Updates',
    description: 'Stay informed throughout the delivery process',
  },
  {
    icon: '💳',
    title: 'Flexible Payment',
    description: 'Multiple payment options to suit your needs',
  },
  {
    icon: '🌟',
    title: 'Competitive Rates',
    description: 'Quality service at fair, transparent pricing',
  },
];

export function Benefits() {
  return (
    <Section>
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
            Why Choose XDrive Logistics
          </h2>
          <p
            style={{
              fontSize: '1.1rem',
              color: 'var(--color-text-white-transparent)',
              maxWidth: '600px',
              margin: '0 auto',
            }}
          >
            Trusted by businesses across the UK and Europe for reliable transport solutions
          </p>
        </div>

        {/* Benefits Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '2rem',
          }}
        >
          {BENEFITS.map((benefit) => (
            <div
              key={benefit.title}
              style={{
                backgroundColor: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                borderRadius: '20px',
                padding: '2rem',
                backdropFilter: 'blur(10px)',
                transition: 'transform 0.3s ease, border-color 0.3s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.borderColor = 'var(--color-gold-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = 'var(--glass-border)';
              }}
            >
              <div
                style={{
                  fontSize: '3rem',
                  marginBottom: '1rem',
                }}
              >
                {benefit.icon}
              </div>

              <h3
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 'var(--font-weight-semibold)',
                  color: 'var(--color-text-white)',
                  marginBottom: '0.75rem',
                }}
              >
                {benefit.title}
              </h3>

              <p
                style={{
                  fontSize: '0.95rem',
                  color: 'var(--color-text-white-transparent)',
                  lineHeight: '1.5',
                }}
              >
                {benefit.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
