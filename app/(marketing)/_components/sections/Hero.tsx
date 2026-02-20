'use client';

import { useState } from 'react';
import { Section } from '../ui/Section';
import { StatCard } from '../ui/StatCard';
import { PrimaryButton } from '../ui/PrimaryButton';
import { COMPANY_CONFIG } from '../../../config/company';
import { LoginModal } from '../../../components/LoginModal';

const WHATSAPP_URL = `https://wa.me/${COMPANY_CONFIG.whatsapp.number}?text=${encodeURIComponent(COMPANY_CONFIG.whatsapp.defaultMessage)}`;

export function Hero() {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  return (
    <Section>
      <div style={{ paddingTop: '8rem', paddingBottom: '4rem' }}>
        {/* Hero Content */}
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <h1
            style={{
              fontSize: 'var(--font-size-hero)',
              fontWeight: 'var(--font-weight-extrabold)',
              lineHeight: '1.1',
              marginBottom: '1.5rem',
              color: 'var(--color-text-white)',
            }}
          >
            Professional Transport Services
            <br />
            <span style={{ color: 'var(--color-gold-primary)' }}>
              Across UK & Europe
            </span>
          </h1>
          
          <p
            style={{
              fontSize: 'clamp(1rem, 2vw, 1.25rem)',
              color: 'var(--color-text-white-transparent)',
              maxWidth: '700px',
              margin: '0 auto 2.5rem',
              lineHeight: '1.6',
            }}
          >
            24/7 reliable courier and freight services. Express delivery, pallet transport, 
            and comprehensive logistics solutions for your business needs.
          </p>

          {/* CTA Buttons */}
          <div
            style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'center',
              flexWrap: 'wrap',
              marginBottom: '4rem',
            }}
          >
            <PrimaryButton
              href={WHATSAPP_URL}
              variant="primary"
              size="lg"
            >
              Get Instant Quote
            </PrimaryButton>
            <PrimaryButton
              href={`tel:${COMPANY_CONFIG.phone}`}
              variant="secondary"
              size="lg"
            >
              Call {COMPANY_CONFIG.phoneDisplay}
            </PrimaryButton>
            <button
              onClick={() => setIsLoginModalOpen(true)}
              style={{
                padding: '0.875rem 2rem',
                fontSize: '1.1rem',
                fontWeight: '600',
                borderRadius: '8px',
                border: '2px solid var(--color-gold-primary)',
                backgroundColor: 'transparent',
                color: 'var(--color-gold-primary)',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-gold-primary)';
                e.currentTarget.style.color = 'var(--color-primary-navy-dark)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--color-gold-primary)';
              }}
            >
              Intră în Cont
            </button>
          </div>

          {/* Stats Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1.5rem',
              maxWidth: '900px',
              margin: '0 auto',
            }}
          >
            <StatCard value="24/7" label="Available" />
            <StatCard value="99.8%" label="On-Time Delivery" />
            <StatCard value="5000+" label="Deliveries Completed" />
            <StatCard value="UK & EU" label="Coverage" />
          </div>
        </div>
      </div>

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />
    </Section>
  );
}
