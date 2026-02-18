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
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
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
                marginBottom: '1rem',
                lineHeight: '1.6',
              }}
            >
              {COMPANY_CONFIG.tagline}
            </p>
            <p
              style={{
                fontSize: '0.9rem',
                color: 'var(--color-text-white-transparent)',
              }}
            >
              Professional 24/7 courier and transport services across the UK and Europe.
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
              <a
                href="/login"
                style={{
                  color: 'var(--color-text-white-transparent)',
                  textDecoration: 'none',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-gold-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-white-transparent)')}
              >
                Login
              </a>
              <a
                href={`https://wa.me/${COMPANY_CONFIG.whatsapp.number}?text=${encodeURIComponent('I would like to get a quote')}`}
                style={{
                  color: 'var(--color-text-white-transparent)',
                  textDecoration: 'none',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-gold-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-white-transparent)')}
              >
                Get Quote
              </a>
            </div>
          </div>

          {/* Social Media */}
          <div>
            <h4
              style={{
                fontSize: '1.1rem',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text-white)',
                marginBottom: '1rem',
              }}
            >
              Follow Us
            </h4>
            <div style={{ display: 'flex', gap: '1rem' }}>
              {COMPANY_CONFIG.social.facebook && (
                <a
                  href={COMPANY_CONFIG.social.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  style={{
                    width: '2.5rem',
                    height: '2.5rem',
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
                    width: '2.5rem',
                    height: '2.5rem',
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
                    width: '2.5rem',
                    height: '2.5rem',
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
            © {currentYear} {COMPANY_CONFIG.name}. All rights reserved.
          </p>
          <p
            style={{
              fontSize: '0.8rem',
              color: 'rgba(255,255,255,0.5)',
              textAlign: 'center',
              margin: 0,
            }}
          >
            Professional transport services across the UK and Europe
          </p>
        </div>
      </div>
    </footer>
  );
}
