'use client';

import { COMPANY_CONFIG } from '../../../config/company';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      style={{
        backgroundColor: '#0A2239',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        color: '#FFFFFF',
      }}
    >
      {/* Trust Badges Bar */}
      <div
        style={{
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          padding: '1.25rem 24px',
          backgroundColor: 'rgba(255,255,255,0.03)',
        }}
      >
        <div
          style={{
            maxWidth: '1400px',
            margin: '0 auto',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2rem',
          }}
        >
          {[
            { icon: '🔒', label: 'Secure Payments', sub: 'Stripe Protected' },
            { icon: '✅', label: 'Fully Insured', sub: 'Goods in Transit' },
            { icon: '🏢', label: 'Registered Company', sub: `No. ${COMPANY_CONFIG.companyNumber}` },
            { icon: '📋', label: 'ICO Registered', sub: 'Data Protection' },
          ].map((badge) => (
            <div
              key={badge.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>{badge.icon}</span>
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>
                  {badge.label}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.8)' }}>
                  {badge.sub}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '3.5rem 24px 2rem',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '2.5rem',
            marginBottom: '2.5rem',
          }}
          className="footer-grid"
        >
          {/* Column 1: Company */}
          <div>
            <div style={{ marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#D4AF37' }}>X</span>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: '#FFFFFF', marginLeft: '0.4rem' }}>
                Drive Logistics
              </span>
            </div>
            <p
              style={{
                fontSize: '0.875rem',
                color: 'rgba(255,255,255,0.6)',
                lineHeight: '1.7',
                marginBottom: '1rem',
              }}
            >
              {COMPANY_CONFIG.tagline}. Professional transport across UK & Europe.
            </p>
            <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.75)', lineHeight: '1.5' }}>
              📍 {COMPANY_CONFIG.address.street},<br />
              {COMPANY_CONFIG.address.city}, {COMPANY_CONFIG.address.postcode}
            </p>
            <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.65)', marginTop: '0.5rem' }}>
              Co. No. {COMPANY_CONFIG.companyNumber}
            </p>
          </div>

          {/* Column 2: Services */}
          <div>
            <h4
              style={{
                fontSize: '0.9rem',
                fontWeight: 700,
                color: '#FFFFFF',
                marginBottom: '1.25rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Services
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
              {[
                'Express Courier',
                'Pallet & Freight',
                'UK & EU Delivery',
                'Same-Day Service',
                'Temperature Controlled',
              ].map((service) => (
                <span
                  key={service}
                  style={{
                    fontSize: '0.875rem',
                    color: 'rgba(255,255,255,0.6)',
                  }}
                >
                  {service}
                </span>
              ))}
            </div>
          </div>

          {/* Column 3: Legal */}
          <div>
            <h4
              style={{
                fontSize: '0.9rem',
                fontWeight: 700,
                color: '#FFFFFF',
                marginBottom: '1.25rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Legal
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
              {[
                { label: 'Terms & Conditions', href: '/terms' },
                { label: 'Privacy Policy', href: '/privacy' },
                { label: 'Cookie Policy', href: '/cookies' },
                { label: 'Driver Login', href: '/login' },
              ].map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  style={{
                    fontSize: '0.875rem',
                    color: 'rgba(255,255,255,0.6)',
                    textDecoration: 'none',
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#D4AF37')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          {/* Column 4: Contact */}
          <div>
            <h4
              style={{
                fontSize: '0.9rem',
                fontWeight: 700,
                color: '#FFFFFF',
                marginBottom: '1.25rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Contact
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <a
                href={`tel:${COMPANY_CONFIG.phone}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: 'rgba(255,255,255,0.7)',
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#D4AF37')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
              >
                <span>📞</span>
                <span>{COMPANY_CONFIG.phoneDisplay}</span>
              </a>
              <a
                href={`mailto:${COMPANY_CONFIG.email}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: 'rgba(255,255,255,0.7)',
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                  transition: 'color 0.2s',
                  wordBreak: 'break-word',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#D4AF37')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
              >
                <span>✉️</span>
                <span>{COMPANY_CONFIG.email}</span>
              </a>
              <a
                href={`https://wa.me/${COMPANY_CONFIG.whatsapp.number}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: 'rgba(255,255,255,0.7)',
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#25D366')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
              >
                <span>💬</span>
                <span>WhatsApp</span>
              </a>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
              {COMPANY_CONFIG.social.facebook && (
                <a
                  href={COMPANY_CONFIG.social.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'rgba(255,255,255,0.7)',
                    textDecoration: 'none',
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#D4AF37';
                    e.currentTarget.style.color = '#0A2239';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)';
                    e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
                  }}
                >
                  f
                </a>
              )}
              {COMPANY_CONFIG.social.instagram && (
                <a
                  href={COMPANY_CONFIG.social.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'rgba(255,255,255,0.7)',
                    textDecoration: 'none',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#D4AF37';
                    e.currentTarget.style.color = '#0A2239';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)';
                    e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
                  }}
                >
                  📷
                </a>
              )}
            </div>
          </div>
        </div>

        <div
          style={{
            borderTop: '1px solid rgba(255,255,255,0.07)',
            paddingTop: '1.5rem',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <p
            style={{
              fontSize: '0.8rem',
              color: 'rgba(255,255,255,0.7)',
              margin: 0,
            }}
          >
            © {currentYear} {COMPANY_CONFIG.name}. All rights reserved.
          </p>
          <p
            style={{
              fontSize: '0.75rem',
              color: 'rgba(255,255,255,0.6)',
              margin: 0,
              textAlign: 'right',
            }}
          >
            {COMPANY_CONFIG.name} is a trading name of {COMPANY_CONFIG.legalName} · Registered in England & Wales
          </p>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 900px) {
          .footer-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 560px) {
          .footer-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </footer>
  );
}
