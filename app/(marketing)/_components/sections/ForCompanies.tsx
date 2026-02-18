'use client';

import { Section } from '../ui/Section';
import { PrimaryButton } from '../ui/PrimaryButton';
import { COMPANY_CONFIG } from '../../../config/company';

const FEATURES = [
  {
    icon: '🚚',
    title: 'Express Courier',
    description: 'Same-day and next-day delivery services',
  },
  {
    icon: '📦',
    title: 'Pallet & Freight',
    description: 'Secure transport for large shipments',
  },
  {
    icon: '🌍',
    title: 'UK & EU Coverage',
    description: 'Reliable cross-border logistics',
  },
  {
    icon: '📋',
    title: 'Real-Time Tracking',
    description: 'Monitor your deliveries every step',
  },
];

export function ForCompanies() {
  return (
    <Section>
      <div style={{ paddingTop: '4rem', paddingBottom: '4rem' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '3rem',
          }}
        >
          {/* Content */}
          <div>
            <div
              style={{
                display: 'inline-block',
                backgroundColor: 'var(--color-green-primary)',
                color: 'var(--color-text-white)',
                padding: '0.5rem 1rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
                fontWeight: 'var(--font-weight-semibold)',
                marginBottom: '1.5rem',
              }}
            >
              FOR COMPANIES
            </div>

            <h2
              style={{
                fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
                fontWeight: 'var(--font-weight-bold)',
                color: 'var(--color-text-white)',
                marginBottom: '1rem',
              }}
            >
              Trusted Logistics Partner for Your Business
            </h2>

            <p
              style={{
                fontSize: '1.1rem',
                color: 'var(--color-text-white-transparent)',
                marginBottom: '2rem',
                lineHeight: '1.6',
              }}
            >
              Professional transport solutions tailored to your business needs. 
              From documents to pallets, we handle it all with care and efficiency.
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

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <PrimaryButton 
                href={`https://wa.me/${COMPANY_CONFIG.whatsapp.number}?text=${encodeURIComponent('I would like to get a quote for my business')}`}
                variant="primary" 
                size="lg"
              >
                Get Business Quote
              </PrimaryButton>
              <PrimaryButton href="/login" variant="secondary" size="lg">
                Company Login
              </PrimaryButton>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
