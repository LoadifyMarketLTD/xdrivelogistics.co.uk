'use client';

import { COMPANY_CONFIG } from '../../../config/company';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      style={{
        backgroundColor: 'var(--color-primary-navy-dark)',
        borderTop: '1px solid var(--glass-border)',
        color: 'var(--color-text-white)',
      }}
    >
      <div
        className="container"
        style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '3rem 24px 2rem',
        }}
      >
        {/* Main Footer Content */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '2rem',
            marginBottom: '2rem',
          }}
        >
          {/* Company Info */}
          <div>
            <h3
              style={{
                fontSize: '1.5rem',
                fontWeight: 'var(--font-weight-bold)',
                color: 'var(--color-gold-primary)',
                marginBottom: '1rem',
              }}
            >
              {COMPANY_CONFIG.name}
            </h3>
            <p
              style={{
                fontSize: '0.95rem',
                color: 'var(--color-text-white-transparent)',
                marginBottom: '0.75rem',
                lineHeight: '1.6',
              }}
            >
              {COMPANY_CONFIG.tagline}
            </p>
            <p
              style={{
                fontSize: '0.875rem',
                color: 'var(--color-text-white-transparent)',
                lineHeight: '1.6',
                marginBottom: '0.5rem',
              }}
            >
              📍 {COMPANY_CONFIG.address.street},<br />
              {COMPANY_CONFIG.address.city}, {COMPANY_CONFIG.address.postcode}
            </p>
            <p
              style={{
                fontSize: '0.8rem',
                color: 'rgba(255,255,255,0.75)',
                lineHeight: '1.5',
              }}
            >
              Company No. {COMPANY_CONFIG.companyNumber}
            </p>
          </div>

          {/* Contact Info */}
          <div>
            <h4
              style={{
                fontSize: '1.1rem',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text-white)',
                marginBottom: '1rem',
              }}
            >
              Contact Us
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <a
                href={`tel:${COMPANY_CONFIG.phone}`}
                style={{
                  color: 'var(--color-text-white-transparent)',
                  textDecoration: 'none',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-gold-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-white-transparent)')}
              >
                📞 {COMPANY_CONFIG.phoneDisplay}
              </a>
              <a
                href={`mailto:${COMPANY_CONFIG.email}`}
                style={{
                  color: 'var(--color-text-white-transparent)',
                  textDecoration: 'none',
                  transition: 'color 0.2s',
                  wordBreak: 'break-word',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-gold-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-white-transparent)')}
              >
                ✉️ {COMPANY_CONFIG.email}
              </a>
              <a
                href={`https://wa.me/${COMPANY_CONFIG.whatsapp.number}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: 'var(--color-text-white-transparent)',
                  textDecoration: 'none',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-green-whatsapp)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-white-transparent)')}
              >
                💬 WhatsApp
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4
              style={{
                fontSize: '1.1rem',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text-white)',
                marginBottom: '1rem',
              }}
            >
              Quick Links
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[
                { label: 'Login', href: '/login' },
                { label: 'How It Works', href: '#how-it-works' },
                { label: 'For Drivers', href: '#for-drivers' },
                { label: 'For Companies', href: '#for-companies' },
                { label: 'FAQ', href: '#faq' },
              ].map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  style={{
                    color: 'var(--color-text-white-transparent)',
                    textDecoration: 'none',
                    transition: 'color 0.2s',
                    fontSize: '0.9rem',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-gold-primary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-white-transparent)')}
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          {/* Legal & Social */}
          <div>
            <h4
              style={{
                fontSize: '1.1rem',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text-white)',
                marginBottom: '1rem',
              }}
            >
              Legal
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {[
                { label: 'Terms & Conditions', href: '/terms' },
                { label: 'Privacy Policy', href: '/privacy' },
                { label: 'Cookie Policy', href: '/cookies' },
              ].map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  style={{
                    color: 'var(--color-text-white-transparent)',
                    textDecoration: 'none',
                    transition: 'color 0.2s',
                    fontSize: '0.9rem',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-gold-primary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-white-transparent)')}
                >
                  {link.label}
                </a>
              ))}
            </div>

            <h4
              style={{
                fontSize: '1rem',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text-white)',
                marginBottom: '0.75rem',
              }}
            >
              Follow Us
            </h4>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {COMPANY_CONFIG.social.facebook && (
                <a
                  href={COMPANY_CONFIG.social.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  style={{
                    width: '2.25rem',
                    height: '2.25rem',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--color-text-white)',
                    textDecoration: 'none',
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    transition: 'all 0.3s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-gold-primary)';
                    e.currentTarget.style.color = 'var(--color-primary-navy-dark)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
                    e.currentTarget.style.color = 'var(--color-text-white)';
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
                    width: '2.25rem',
                    height: '2.25rem',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--color-text-white)',
                    textDecoration: 'none',
                    transition: 'all 0.3s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-gold-primary)';
                    e.currentTarget.style.color = 'var(--color-primary-navy-dark)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
                    e.currentTarget.style.color = 'var(--color-text-white)';
                  }}
                >
                  📷
                </a>
              )}
              {COMPANY_CONFIG.social.tiktok && (
                <a
                  href={COMPANY_CONFIG.social.tiktok}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="TikTok"
                  style={{
                    width: '2.25rem',
                    height: '2.25rem',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--color-text-white)',
                    textDecoration: 'none',
                    transition: 'all 0.3s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-gold-primary)';
                    e.currentTarget.style.color = 'var(--color-primary-navy-dark)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
                    e.currentTarget.style.color = 'var(--color-text-white)';
                  }}
                >
                  🎵
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div
          style={{
            borderTop: '1px solid var(--glass-border)',
            paddingTop: '1.5rem',
            marginTop: '2rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <p
            style={{
              fontSize: '0.875rem',
              color: 'var(--color-text-white-transparent)',
              textAlign: 'center',
              margin: 0,
            }}
          >
            © {currentYear} {COMPANY_CONFIG.name}. All rights reserved. Company No. {COMPANY_CONFIG.companyNumber}
          </p>
          <p
            style={{
              fontSize: '0.8rem',
              color: 'rgba(255,255,255,0.75)',
              textAlign: 'center',
              margin: 0,
            }}
          >
            Registered in England & Wales · {COMPANY_CONFIG.address.full}
          </p>
          {/* Legal trading name disclosure */}
          <p
            style={{
              fontSize: '0.75rem',
              color: 'rgba(255,255,255,0.65)',
              textAlign: 'center',
              margin: '0.5rem 0 0 0',
              lineHeight: '1.5',
            }}
          >
            {COMPANY_CONFIG.name} is a trading name of {COMPANY_CONFIG.legalName}.
          </p>
        </div>
      </div>
    </footer>
  );
}
