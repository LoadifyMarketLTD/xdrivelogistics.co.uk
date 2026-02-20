'use client';

import { useState, useEffect } from 'react';
import { COMPANY_CONFIG } from '../../../config/company';
import { LoginModal } from '../../../components/LoginModal';

const NAV_LINKS = [
  { label: 'Home', href: '#home' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'For Drivers', href: '#for-drivers' },
  { label: 'For Companies', href: '#for-companies' },
  { label: 'FAQ', href: '#faq' },
  { label: 'Contact', href: '#contact' },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isLight = scrolled;

  return (
    <>
      <header
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          backgroundColor: scrolled ? 'rgba(255, 255, 255, 0.97)' : 'transparent',
          backdropFilter: scrolled ? 'blur(12px)' : 'none',
          boxShadow: scrolled ? '0 2px 20px rgba(0,0,0,0.08)' : 'none',
          transition: 'all 0.3s ease',
          borderBottom: scrolled ? '1px solid rgba(31,58,95,0.08)' : '1px solid transparent',
        }}
      >
        <div
          style={{
            maxWidth: '1400px',
            margin: '0 auto',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: '4.5rem',
          }}
        >
          <a
            href="#home"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              textDecoration: 'none',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                color: '#D4AF37',
                letterSpacing: '-0.5px',
              }}
            >
              X
            </span>
            <span
              style={{
                fontSize: '1.1rem',
                fontWeight: 700,
                color: isLight ? '#1F3A5F' : '#FFFFFF',
                transition: 'color 0.3s ease',
              }}
            >
              Drive Logistics
            </span>
          </a>

          <nav
            aria-label="Main navigation"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
            className="desktop-nav"
          >
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                style={{
                  padding: '0.5rem 0.875rem',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  color: isLight ? '#374151' : 'rgba(255,255,255,0.9)',
                  textDecoration: 'none',
                  borderRadius: '8px',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#1F3A5F';
                  e.currentTarget.style.backgroundColor = isLight ? 'rgba(31,58,95,0.06)' : 'rgba(255,255,255,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = isLight ? '#374151' : 'rgba(255,255,255,0.9)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              flexShrink: 0,
            }}
          >
            <a
              href={`tel:${COMPANY_CONFIG.phone}`}
              aria-label="Call us"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: isLight ? '#1F3A5F' : '#D4AF37',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                transition: 'color 0.3s ease',
              }}
              className="phone-link"
            >
              <span>📞</span>
              <span>{COMPANY_CONFIG.phoneDisplay}</span>
            </a>

            <button
              onClick={() => setIsLoginModalOpen(true)}
              style={{
                padding: '0.5rem 1.25rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                borderRadius: '8px',
                border: `1.5px solid ${isLight ? '#1F3A5F' : '#D4AF37'}`,
                backgroundColor: isLight ? '#1F3A5F' : 'transparent',
                color: isLight ? '#FFFFFF' : '#D4AF37',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#2E7D32';
                e.currentTarget.style.borderColor = '#2E7D32';
                e.currentTarget.style.color = '#FFFFFF';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = isLight ? '#1F3A5F' : 'transparent';
                e.currentTarget.style.borderColor = isLight ? '#1F3A5F' : '#D4AF37';
                e.currentTarget.style.color = isLight ? '#FFFFFF' : '#D4AF37';
              }}
            >
              Login
            </button>

            <button
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              style={{
                display: 'none',
                background: 'none',
                border: 'none',
                color: isLight ? '#1F3A5F' : '#FFFFFF',
                cursor: 'pointer',
                padding: '0.25rem',
                fontSize: '1.5rem',
                transition: 'color 0.3s ease',
              }}
              className="mobile-menu-btn"
            >
              {menuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav
            aria-label="Mobile navigation"
            style={{
              backgroundColor: '#FFFFFF',
              borderTop: '1px solid rgba(31,58,95,0.1)',
              padding: '1rem 24px 1.5rem',
            }}
          >
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                style={{
                  display: 'block',
                  padding: '0.75rem 0',
                  fontSize: '1rem',
                  fontWeight: 500,
                  color: '#374151',
                  textDecoration: 'none',
                  borderBottom: '1px solid rgba(31,58,95,0.06)',
                }}
              >
                {link.label}
              </a>
            ))}
            <a
              href={`tel:${COMPANY_CONFIG.phone}`}
              style={{
                display: 'block',
                marginTop: '1rem',
                padding: '0.75rem 1.5rem',
                fontSize: '1rem',
                fontWeight: 600,
                color: '#FFFFFF',
                backgroundColor: '#1F3A5F',
                textDecoration: 'none',
                borderRadius: '8px',
                textAlign: 'center',
              }}
            >
              📞 Call {COMPANY_CONFIG.phoneDisplay}
            </a>
          </nav>
        )}
      </header>

      <style jsx>{`
        @media (max-width: 900px) {
          .desktop-nav {
            display: none !important;
          }
          .phone-link {
            display: none !important;
          }
          .mobile-menu-btn {
            display: flex !important;
          }
        }
      `}</style>

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />
    </>
  );
}
