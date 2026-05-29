'use client';

import Link from 'next/link';
import { Section } from '../ui/Section';

const STEPS = [
  {
    number: '01',
    title: 'Request Quote',
    description: 'Fill in your shipment details online and receive a tailored quote instantly',
    icon: '📋',
    href: '/request-quote',
  },
  {
    number: '02',
    title: 'Get Confirmed',
    description: 'Our team reviews your request and confirms pricing within minutes',
    icon: '💰',
    href: null,
  },
  {
    number: '03',
    title: 'Book Service',
    description: 'Confirm your booking and schedule pickup time',
    icon: '📅',
    href: null,
  },
  {
    number: '04',
    title: 'Track Delivery',
    description: 'Receive status updates until safe delivery',
    icon: '📍',
    href: null,
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
          {STEPS.map((step, index) => {
            const isFirst = step.href !== null;
            const cardStyle: React.CSSProperties = {
              backgroundColor: isFirst ? 'rgba(46,125,50,0.12)' : 'var(--glass-bg)',
              border: isFirst ? '1px solid rgba(46,125,50,0.35)' : '1px solid var(--glass-border)',
              borderRadius: 'var(--radius-lg)',
              padding: '2rem',
              position: 'relative',
              backdropFilter: 'blur(10px)',
              transition: 'transform 0.2s ease, border-color 0.2s ease',
              textDecoration: 'none',
              display: 'block',
            };

            const innerContent = (
              <>
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

                {isFirst && (
                  <div style={{ marginTop: '1rem', fontSize: '0.875rem', fontWeight: 700, color: '#81C784' }}>
                    Start here →
                  </div>
                )}

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
              </>
            );

            return step.href ? (
              <Link
                key={step.number}
                href={step.href}
                style={cardStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.borderColor = 'rgba(46,125,50,0.65)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = 'rgba(46,125,50,0.35)';
                }}
              >
                {innerContent}
              </Link>
            ) : (
              <div key={step.number} style={cardStyle}>
                {innerContent}
              </div>
            );
          })}
        </div>

        {/* CTA below steps */}
        <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
          <Link
            href="/request-quote"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.9rem 2rem',
              fontSize: '1rem',
              fontWeight: 700,
              borderRadius: '10px',
              backgroundColor: '#2E7D32',
              color: '#FFFFFF',
              textDecoration: 'none',
              boxShadow: '0 4px 20px rgba(46,125,50,0.3)',
            }}
          >
            🚀 Start with a Quote
          </Link>
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
