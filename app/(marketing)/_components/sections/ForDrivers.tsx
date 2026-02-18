'use client';

import { Section } from '../ui/Section';
import { PrimaryButton } from '../ui/PrimaryButton';

const FEATURES = [
  {
    icon: '💰',
    title: 'Competitive Rates',
    description: 'Fair pricing with transparent invoicing',
  },
  {
    icon: '📱',
    title: 'Easy Communication',
    description: 'Stay connected throughout delivery',
  },
  {
    icon: '⚡',
    title: 'Flexible Work',
    description: 'Choose jobs that fit your schedule',
  },
  {
    icon: '📊',
    title: 'Track Earnings',
    description: 'Monitor your performance and payments',
  },
];

export function ForDrivers() {
  return (
    <Section backgroundColor="var(--color-primary-navy)">
      <div style={{ paddingTop: '4rem', paddingBottom: '4rem' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '3rem',
          }}
        >
          {/* Left: Content */}
          <div>
            <div
              style={{
                display: 'inline-block',
                backgroundColor: 'var(--color-gold-primary)',
                color: 'var(--color-primary-navy-dark)',
                padding: '0.5rem 1rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
                fontWeight: 'var(--font-weight-semibold)',
                marginBottom: '1.5rem',
              }}
            >
              FOR DRIVERS
            </div>

            <h2
              style={{
                fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
                fontWeight: 'var(--font-weight-bold)',
                color: 'var(--color-text-white)',
                marginBottom: '1rem',
              }}
            >
              Join Our Network of Professional Drivers
            </h2>

            <p
              style={{
                fontSize: '1.1rem',
                color: 'var(--color-text-white-transparent)',
                marginBottom: '2rem',
                lineHeight: '1.6',
              }}
            >
              Access consistent work opportunities with competitive pay. 
              Manage your jobs efficiently with our mobile-friendly platform.
            </p>

            {/* Features Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1.5rem',
                marginBottom: '2rem',
              }}
            >
              {FEATURES.map((feature) => (
                <div key={feature.title}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
                    {feature.icon}
                  </div>
                  <h3
                    style={{
                      fontSize: '1.1rem',
                      fontWeight: 'var(--font-weight-semibold)',
                      color: 'var(--color-text-white)',
                      marginBottom: '0.5rem',
                    }}
                  >
                    {feature.title}
                  </h3>
                  <p
                    style={{
                      fontSize: '0.95rem',
                      color: 'var(--color-text-white-transparent)',
                      lineHeight: '1.5',
                    }}
                  >
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>

            <PrimaryButton href="/login" variant="primary" size="lg">
              Driver Login
            </PrimaryButton>
          </div>
        </div>
      </div>
    </Section>
  );
}
